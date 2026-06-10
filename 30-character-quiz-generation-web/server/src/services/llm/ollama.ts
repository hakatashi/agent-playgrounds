import {Ollama} from 'ollama';
import type {LLMService} from './index.js';

const ollama = new Ollama({host: 'http://localhost:11434'});

export const ollamaService: LLMService = {
  async streamGenerate(prompt, modelName, onEvent, signal) {
    const stream = await ollama.chat({
      model: modelName,
      messages: [{role: 'user', content: prompt}],
      stream: true,
    });

    for await (const chunk of stream) {
      if (signal?.aborted) break;
      onEvent({type: 'chunk', content: chunk.message.content});
    }

    onEvent({type: 'done'});
  },

  async listModels() {
    const response = await ollama.list();
    return response.models.map((m) => m.name);
  },
};
