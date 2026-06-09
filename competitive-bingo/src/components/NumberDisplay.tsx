import { useEffect, useRef } from 'react';
import { getBingoLetter } from '../utils/bingoCard';

interface Props {
  calledNumbers: number[];
}

const LETTER_COLORS: Record<string, string> = {
  B: 'text-blue-400',
  I: 'text-green-400',
  N: 'text-yellow-400',
  G: 'text-orange-400',
  O: 'text-red-400',
};

export function NumberDisplay({ calledNumbers }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom (newest number)
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [calledNumbers.length]);

  const latest = calledNumbers.at(-1);

  return (
    <div className="flex flex-col h-full">
      {/* Current number – large display */}
      <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-700">
        {latest !== undefined ? (
          <>
            <span
              className={`text-3xl font-black ${LETTER_COLORS[getBingoLetter(latest)]}`}
            >
              {getBingoLetter(latest)}
            </span>
            <span className="text-6xl font-black text-white tabular-nums">
              {latest}
            </span>
          </>
        ) : (
          <span className="text-gray-500 text-xl">開始待ち...</span>
        )}
      </div>

      {/* Scrolling history */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-2 px-1 space-y-1"
        style={{ maxHeight: '300px' }}
      >
        {calledNumbers.length === 0 && (
          <p className="text-gray-600 text-sm text-center pt-4">
            読み上げた数字がここに表示されます
          </p>
        )}
        {[...calledNumbers].reverse().map((n, i) => {
          const letter = getBingoLetter(n);
          const isLatest = i === 0;
          return (
            <div
              key={calledNumbers.length - i}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-opacity ${
                isLatest ? 'bg-gray-700 opacity-100' : 'opacity-60'
              }`}
            >
              <span
                className={`text-xs font-bold w-5 ${LETTER_COLORS[letter]}`}
              >
                {letter}
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  isLatest ? 'text-white text-lg' : 'text-gray-300 text-sm'
                }`}
              >
                {n}
              </span>
              <span className="text-gray-600 text-xs ml-auto">
                #{calledNumbers.length - i}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
