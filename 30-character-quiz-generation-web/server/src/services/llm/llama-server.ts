import {spawn, type ChildProcess} from 'child_process';
import {config} from '../../config.js';
import type {LLMService} from './index.js';

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

  // 別モデルで起動中 or 未起動 → 新しい起動シーケンスを開始（同時リクエストは同じPromiseを待つ）
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

// ── SSEストリーミング共通ヘルパー ──────────────────────────────
async function streamFromLlamaServer(
  prompt: string,
  onEvent: (e: {type: 'chunk'; content: string} | {type: 'done'} | {type: 'error'; error: string}) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${config.llamaServerUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      messages: [{role: 'user', content: prompt}],
      stream: true,
      max_tokens: 16000,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`llama-server returned HTTP ${response.status}: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        onEvent({type: 'done'});
        return;
      }
      try {
        const parsed = JSON.parse(data) as {choices?: {delta?: {content?: string}}[]};
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onEvent({type: 'chunk', content});
      } catch {
        // ignore malformed chunks
      }
    }
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
    // 設定されたモデルパス一覧を返す（サーバーが停止中でも選択できるようにする）
    if (config.llamaModelPaths.length > 0) return config.llamaModelPaths;

    // 設定なしの場合、起動中のサーバーから取得を試みる
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
