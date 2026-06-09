import type { BingoCard } from '../types';

const HEADERS = ['B', 'I', 'N', 'G', 'O'];

interface Props {
  card: BingoCard;
  /** If provided, clicking a non-FREE cell calls this callback */
  onCellClick?: (row: number, col: number) => void;
  /** Compact mode for card selection (smaller text) */
  compact?: boolean;
}

export function BingoCardGrid({ card, onCellClick, compact = false }: Props) {
  const cellSize = compact
    ? 'w-10 h-10 text-sm'
    : 'w-14 h-14 text-base md:w-16 md:h-16 md:text-lg';
  const headerSize = compact ? 'w-10 h-8 text-sm' : 'w-14 h-10 md:w-16 md:h-10 text-base';

  return (
    <div className="inline-block select-none">
      {/* Column headers */}
      <div className="flex">
        {HEADERS.map((h) => (
          <div
            key={h}
            className={`${headerSize} flex items-center justify-center font-bold text-yellow-400`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {card.map((row, r) => (
        <div key={r} className="flex">
          {row.map((cell, c) => {
            const isFree = cell.number === null;
            const clickable = !isFree && !!onCellClick;

            return (
              <div
                key={c}
                onClick={() => clickable && onCellClick!(r, c)}
                className={[
                  cellSize,
                  'm-0.5 rounded-lg flex items-center justify-center font-semibold transition-colors border-2',
                  isFree
                    ? 'bg-yellow-400 text-gray-900 border-yellow-300 text-xs font-bold'
                    : cell.highlighted
                    ? 'bg-blue-500 text-white border-blue-400'
                    : 'bg-gray-700 text-gray-200 border-gray-600',
                  clickable ? 'cursor-pointer hover:border-blue-300' : '',
                ].join(' ')}
              >
                {isFree ? 'FREE' : cell.number}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
