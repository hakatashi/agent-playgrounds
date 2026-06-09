import type { BingoCard } from '../types';
import { BingoCardGrid } from './BingoCard';
import { NumberDisplay } from './NumberDisplay';

interface Props {
  card: BingoCard;
  calledNumbers: number[];
  elapsedMs: number;
  manualHighlightEnabled: boolean;
  onToggleHighlight: (row: number, col: number) => void;
  onDeclareBingo: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

export function GameScreen({
  card,
  calledNumbers,
  elapsedMs,
  manualHighlightEnabled,
  onToggleHighlight,
  onDeclareBingo,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="text-sm text-gray-400">
          読み上げ済み:{' '}
          <span className="text-white font-semibold">{calledNumbers.length}</span>
          <span className="text-gray-500"> / 75</span>
        </div>
        <div className="text-2xl font-mono font-bold text-yellow-400">
          {formatTime(elapsedMs)}
        </div>
        <div className="text-sm text-gray-400">
          {manualHighlightEnabled ? (
            <span className="text-blue-400">手動ハイライト ON</span>
          ) : (
            <span className="text-gray-500">ハイライトなし</span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col md:flex-row gap-0 overflow-hidden">
        {/* Bingo card */}
        <div className="flex flex-col items-center justify-center p-6 md:flex-1">
          <BingoCardGrid
            card={card}
            onCellClick={manualHighlightEnabled ? onToggleHighlight : undefined}
          />
          {manualHighlightEnabled && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              マス目をクリックしてハイライトをオン/オフ
            </p>
          )}
        </div>

        {/* Number display panel */}
        <div className="md:w-64 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col">
          <NumberDisplay calledNumbers={calledNumbers} />
        </div>
      </div>

      {/* Bingo button */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-center">
        <button
          onClick={onDeclareBingo}
          className="px-16 py-5 bg-red-500 hover:bg-red-400 active:scale-95 text-white font-black text-3xl rounded-2xl shadow-2xl transition-all focus:outline-none focus:ring-4 focus:ring-red-300"
        >
          ビンゴ！
        </button>
      </div>
    </div>
  );
}
