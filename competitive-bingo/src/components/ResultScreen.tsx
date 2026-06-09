import type { BingoCard, GameResult } from '../types';
import { getBingoLetter } from '../utils/bingoCard';
import { BingoCardGrid } from './BingoCard';

interface Props {
  card: BingoCard;
  result: GameResult;
  onReset: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

const LETTER_COLORS: Record<string, string> = {
  B: 'text-blue-400',
  I: 'text-green-400',
  N: 'text-yellow-400',
  G: 'text-orange-400',
  O: 'text-red-400',
};

export function ResultScreen({ card, result, onReset }: Props) {
  const { elapsedMs, calledNumbers, isValid, firstBingoPossibleAt, highlightAccuracy } = result;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4">
      {/* Verdict banner */}
      <div
        className={`w-full max-w-xl text-center py-5 rounded-2xl mb-8 ${
          isValid
            ? 'bg-green-700 border-2 border-green-400'
            : 'bg-red-800 border-2 border-red-500'
        }`}
      >
        <div className="text-5xl font-black mb-1">
          {isValid ? '🎯 ビンゴ成立！' : '❌ 失格'}
        </div>
        <div className="text-gray-200 text-sm mt-1">
          {isValid
            ? 'ビンゴが正しく成立していました'
            : '申告時点でビンゴは成立していませんでした'}
        </div>
      </div>

      <div className="w-full max-w-xl space-y-4 mb-8">
        {/* Time */}
        <div className="bg-gray-800 rounded-xl px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400">申告タイム</span>
          <span className="text-3xl font-mono font-bold text-yellow-400">
            {formatTime(elapsedMs)}
          </span>
        </div>

        {/* Called count */}
        <div className="bg-gray-800 rounded-xl px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400">申告時の読み上げ数</span>
          <span className="text-2xl font-bold text-white">
            {calledNumbers.length}
            <span className="text-gray-500 text-base"> / 75</span>
          </span>
        </div>

        {/* First bingo achievable */}
        {firstBingoPossibleAt !== null && (
          <div className="bg-gray-800 rounded-xl px-6 py-4 flex justify-between items-center">
            <span className="text-gray-400">
              最初にビンゴが成立した読み上げ番号
            </span>
            <span className="text-2xl font-bold text-green-400">
              #{firstBingoPossibleAt}
            </span>
          </div>
        )}

        {/* Highlight accuracy */}
        {highlightAccuracy !== null && (
          <div className="bg-gray-800 rounded-xl px-6 py-4 flex justify-between items-center">
            <span className="text-gray-400">ハイライト精度</span>
            <span className="text-2xl font-bold text-blue-400">
              {Math.round(highlightAccuracy * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Card state */}
      <div className="mb-8">
        <h3 className="text-gray-400 text-center mb-3 text-sm">申告時のカード状態</h3>
        <BingoCardGrid card={card} compact />
      </div>

      {/* Called numbers */}
      <div className="w-full max-w-xl bg-gray-800 rounded-xl p-4 mb-8">
        <h3 className="text-gray-400 text-sm mb-3">
          読み上げられた数字 ({calledNumbers.length}個)
        </h3>
        <div className="flex flex-wrap gap-2">
          {calledNumbers.map((n, i) => {
            const letter = getBingoLetter(n);
            return (
              <div
                key={i}
                className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1"
              >
                <span className={`text-xs font-bold ${LETTER_COLORS[letter]}`}>
                  {letter}
                </span>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onReset}
        className="px-10 py-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-xl rounded-2xl shadow-lg transition-colors"
      >
        もう一度プレイ
      </button>
    </div>
  );
}
