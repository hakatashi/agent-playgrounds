import Anthropic from '@anthropic-ai/sdk';
import {config} from '../../config.js';
import type {LLMService} from './index.js';

const client = new Anthropic({apiKey: config.anthropicApiKey});

export const claudeService: LLMService = {
  async streamGenerate(prompt, modelName, onEvent, signal) {
    const stream = client.messages.stream({
      model: modelName,
      max_tokens: 16000,
      messages: [{role: 'user', content: prompt}],
    });

    stream.on('text', (text) => {
      if (!signal?.aborted) {
        onEvent({type: 'chunk', content: text});
      }
    });

    await stream.finalMessage();
    onEvent({type: 'done'});
  },

  async listModels() {
    return ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
  },
};
