import {config} from '../../config.js';
import type {LLMService} from './index.js';

export const llamaServerService: LLMService = {
  async streamGenerate(prompt, _modelName, onEvent, signal) {
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
  },

  async listModels() {
    const response = await fetch(`${config.llamaServerUrl}/v1/models`);
    if (!response.ok) throw new Error(`llama-server returned HTTP ${response.status}`);
    const data = await response.json() as {data?: {id: string}[]};
    return data.data?.map((m) => m.id) ?? [];
  },
};
