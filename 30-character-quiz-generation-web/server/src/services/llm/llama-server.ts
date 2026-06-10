import {spawn, type ChildProcess} from 'child_process';
import {config} from '../../config.js';
import type {LLMService, LLMStreamEvent} from './index.js';

// ── プロセス状態 ──────────────────────────────────────────────
let serverProcess: ChildProcess | null = null;
let loadedModelPath: string | null = null;
let startingPromise: Promise<void> | null = null;

export type LlamaServerStatus =
  | {state: 'stopped'}
  | {state: 'starting'; modelPath: string}
  | {state: 'running'; modelPath: string; pid: number};

export function getLlamaServerStatus(): LlamaServerStatus {
  if (startingPromise && loadedModelPath === null) {
    return {state: 'starting', modelPath: '(unknown)'};
  }
  if (serverProcess && loadedModelPath) {
    return {state: 'running', modelPath: loadedModelPath, pid: serverProcess.pid!};
  }
  return {state: 'stopped'};
}

// ── ヘルスチェック ─────────────────────────────────────────────
async function waitForHealth(url: string, timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`, {signal: AbortSignal.timeout(3000)});
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`llama-server did not become healthy within ${timeoutMs / 1000}s`);
}

// ── プロセス起動・再起動 ────────────────────────────────────────
async function startServer(modelPath: string): Promise<void> {
  // 既存プロセスを停止
  if (serverProcess) {
    console.log(`[llama-server] Stopping existing process (PID ${serverProcess.pid}) to load: ${modelPath}`);
    serverProcess.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        serverProcess?.kill('SIGKILL');
        resolve();
      }, 10_000);
      serverProcess!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    serverProcess = null;
    loadedModelPath = null;
  }

  const parsedUrl = new URL(config.llamaServerUrl);
  const host = parsedUrl.hostname;
  const port = parsedUrl.port || '8080';

  const args = [
    '-m', modelPath,
    '--host', host,
    '--port', port,
    '-c', config.llamaCtxSize,
    '-ngl', config.llamaGpuLayers,
    '--parallel', '1',
  ];

  console.log(`[llama-server] Starting: ${config.llamaServerBinary} ${args.join(' ')}`);

  const proc = spawn(config.llamaServerBinary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (d: Buffer) => process.stdout.write(`[llama-server] ${d}`));
  proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[llama-server] ${d}`));

  proc.on('exit', (code, signal) => {
    console.log(`[llama-server] Process exited (code=${code} signal=${signal})`);
    if (serverProcess === proc) {
      serverProcess = null;
      loadedModelPath = null;
    }
  });

  serverProcess = proc;

  try {
    await waitForHealth(config.llamaServerUrl);
  } catch (err) {
    proc.kill('SIGTERM');
    serverProcess = null;
    throw err;
  }

  loadedModelPath = modelPath;
  console.log(`[llama-server] Ready on ${config.llamaServerUrl} (model: ${modelPath})`);
}

// ── 必要に応じて起動（並列リクエスト対応）──────────────────────
async function ensureServer(modelPath: string): Promise<void> {
  if (serverProcess && loadedModelPath === modelPath) return;

  if (!startingPromise || loadedModelPath !== modelPath) {
    startingPromise = startServer(modelPath).finally(() => {
      startingPromise = null;
    });
  }
  await startingPromise;
}

// ── 明示的な停止 ───────────────────────────────────────────────
export function stopLlamaServer(): void {
  if (!serverProcess) return;
  console.log(`[llama-server] Stopping by user request (PID ${serverProcess.pid})`);
  serverProcess.kill('SIGTERM');
  serverProcess = null;
  loadedModelPath = null;
}

// Express サーバー終了時にも子プロセスを終了
process.once('exit', () => stopLlamaServer());
process.once('SIGTERM', () => { stopLlamaServer(); process.exit(0); });
process.once('SIGINT', () => { stopLlamaServer(); process.exit(0); });

// ── ツール定義 ─────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'count_characters',
      description: '問題文の文字数をUnicode文字（コードポイント）単位で正確にカウントします。手順4・手順5での文字数確認には必ずこのツールを使用してください。',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {type: 'string'},
            description: '文字数をカウントする問題文のリスト',
          },
        },
        required: ['questions'],
      },
    },
  },
];

function executeCountCharacters(argsJson: string): string {
  try {
    const {questions} = JSON.parse(argsJson) as {questions: string[]};
    if (!Array.isArray(questions)) return 'エラー: questions は配列である必要があります';
    return questions.map((q) => `"${q}": ${[...q].length}文字`).join('\n');
  } catch {
    return 'エラー: 引数の JSON パースに失敗しました';
  }
}

// ── メッセージ型 ───────────────────────────────────────────────
interface ToolCall {
  id: string;
  type: 'function';
  function: {name: string; arguments: string};
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ── ループ検出 ─────────────────────────────────────────────────
// 直近 windowSize 文字の中に seqLen 文字の同一シーケンスが2回以上現れたらループと判定
function createLoopDetector(windowSize = 600, seqLen = 150) {
  let buffer = '';
  return (chunk: string): boolean => {
    buffer += chunk;
    if (buffer.length > windowSize) buffer = buffer.slice(-windowSize);
    if (buffer.length < seqLen * 2) return false;
    const seq = buffer.slice(-seqLen);
    const preceding = buffer.slice(0, buffer.length - seqLen);
    return preceding.includes(seq);
  };
}

// ── SSEストリーミング（ツール呼び出し＋ループ検出対応）──────────
async function streamFromLlamaServer(
  prompt: string,
  onEvent: (e: LLMStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const messages: ChatMessage[] = [{role: 'user', content: prompt}];
  const MAX_LOOP_BREAKS = 3;
  let loopBreaks = 0;

  // ツール呼び出し or ループ継続がある限りループ（最大13ターン）
  for (let turn = 0; turn < 13; turn++) {
    const response = await fetch(`${config.llamaServerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: true,
        max_tokens: 32000,
        temperature: 0.7,
        top_p: 0.95,
        top_k: 20,
        repeat_penalty: 1.1,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`llama-server returned HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: string | null = null;
    let assistantText = '';
    const toolCallAccum = new Map<number, {id: string; name: string; arguments: string}>();
    // コンテンツ用（短いウィンドウで敏感に検知）
    const detectContentLoop = createLoopDetector(600, 150);
    // thinking block 用（長いウィンドウ・長いシーケンスで誤検知を抑制）
    const detectReasoningLoop = createLoopDetector(1000, 250);

    streamLoop: while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break streamLoop;

        try {
          const parsed = JSON.parse(data) as {
            choices?: {
              delta?: {
                content?: string;
                reasoning_content?: string;
                tool_calls?: {
                  index: number;
                  id?: string;
                  function?: {name?: string; arguments?: string};
                }[];
              };
              finish_reason?: string | null;
            }[];
          };

          const choice = parsed.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finishReason = choice.finish_reason;

          const delta = choice.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            onEvent({type: 'reasoning', content: delta.reasoning_content});

            // thinking block のループを検出
            if (loopBreaks < MAX_LOOP_BREAKS && detectReasoningLoop(delta.reasoning_content)) {
              await reader.cancel();
              finishReason = 'loop_detected';
              break streamLoop;
            }
          }
          if (delta.content) {
            assistantText += delta.content;
            onEvent({type: 'chunk', content: delta.content});

            // コンテンツのループを検出
            if (loopBreaks < MAX_LOOP_BREAKS && detectContentLoop(delta.content)) {
              await reader.cancel();
              finishReason = 'loop_detected';
              break streamLoop;
            }
          }

          for (const tc of delta.tool_calls ?? []) {
            const acc = toolCallAccum.get(tc.index) ?? {id: '', name: '', arguments: ''};
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            toolCallAccum.set(tc.index, acc);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    // ── ループ検出時: 継続メッセージを付けて再リクエスト ─────────
    if (finishReason === 'loop_detected') {
      loopBreaks++;
      onEvent({type: 'reasoning', content: `\n[ループ検出 (${loopBreaks}/${MAX_LOOP_BREAKS})。継続リクエストを送信します...]\n`});
      messages.push({role: 'assistant', content: assistantText || null});
      messages.push({
        role: 'user',
        content: '出力が繰り返しループしています。繰り返しを止めて、残りの作業を続けてください。',
      });
      continue;
    }

    // ── ツール呼び出しがあった場合 ───────────────────────────────
    if (finishReason === 'tool_calls' && toolCallAccum.size > 0) {
      const toolCalls: ToolCall[] = [...toolCallAccum.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, acc]) => ({
          id: acc.id || `call_${Date.now()}`,
          type: 'function' as const,
          function: {name: acc.name, arguments: acc.arguments},
        }));

      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let result: string;
        if (tc.function.name === 'count_characters') {
          result = executeCountCharacters(tc.function.arguments);
        } else {
          result = `未知のツール: ${tc.function.name}`;
        }

        onEvent({type: 'reasoning', content: `\n[count_characters の結果]\n${result}\n`});
        messages.push({role: 'tool', content: result, tool_call_id: tc.id});
      }

      continue;
    }

    // ツール呼び出しなし・ループなし → 生成完了
    break;
  }

  onEvent({type: 'done'});
}

// ── LLMService 実装 ────────────────────────────────────────────
export const llamaServerService: LLMService = {
  async streamGenerate(prompt, modelName, onEvent, signal) {
    if (!modelName) throw new Error('llama-server: モデルパス (modelName) が指定されていません');
    await ensureServer(modelName);
    await streamFromLlamaServer(prompt, onEvent, signal);
  },

  async listModels() {
    if (config.llamaModelPaths.length > 0) return config.llamaModelPaths;

    try {
      const response = await fetch(`${config.llamaServerUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return [];
      const data = await response.json() as {data?: {id: string}[]};
      return data.data?.map((m) => m.id) ?? [];
    } catch {
      return [];
    }
  },
};
