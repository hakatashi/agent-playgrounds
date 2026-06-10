export interface LLMChunkEvent {
  type: 'chunk';
  content: string;
}

export interface LLMDoneEvent {
  type: 'done';
}

export interface LLMErrorEvent {
  type: 'error';
  error: string;
}

export type LLMStreamEvent = LLMChunkEvent | LLMDoneEvent | LLMErrorEvent;

export interface LLMService {
  streamGenerate(
    prompt: string,
    modelName: string,
    onEvent: (event: LLMStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  listModels(): Promise<string[]>;
}
