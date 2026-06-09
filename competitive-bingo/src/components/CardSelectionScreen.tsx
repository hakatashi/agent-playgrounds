import type { BingoCard } from '../types';
import { BingoCardGrid } from './BingoCard';

interface Props {
  cards: BingoCard[];
  onSelect: (index: number) => void;
}

export function CardSelectionScreen({ cards, onSelect }: Props) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4">
      <h2 className="text-3xl font-bold text-yellow-400 mb-2">カードを選んでください</h2>
      <p className="text-gray-400 mb-8 text-center">
        5枚のカードから1枚を選びます。選んだ瞬間にゲームが始まります。
      </p>

      <div className="flex flex-wrap gap-6 justify-center">
        {cards.map((card, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="group bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-yellow-400 rounded-2xl p-4 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <p className="text-yellow-400 font-bold text-center mb-2 group-hover:text-yellow-300">
              カード {i + 1}
            </p>
            <BingoCardGrid card={card} compact />
          </button>
        ))}
      </div>
    </div>
  );
}
