import {useRef, useCallback} from 'react';

export interface SSEHandlers {
  onChunk?: (content: string) => void;
  onStatus?: (message: string) => void;
  onResult?: (data: unknown) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (url: string, body: unknown, handlers: SSEHandlers) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: abortRef.current.signal,
    });

    if (!response.ok || !response.body) {
      handlers.onError?.(`HTTP ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          if (line.startsWith('data: ')) data = line.slice(6);
        }
        if (!data) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (event === 'chunk') handlers.onChunk?.(parsed.content as string);
          else if (event === 'status') handlers.onStatus?.(parsed.message as string);
          else if (event === 'result') handlers.onResult?.(parsed);
          else if (event === 'error') handlers.onError?.(parsed.error as string);
          else if (event === 'done') handlers.onDone?.();
        } catch {
          // ignore parse errors
        }
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return {start, abort};
}
