import type { BingoCard, BingoCell } from '../types';

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `count` unique random numbers from [start, end] inclusive */
function pickUnique(start: number, end: number, count: number): number[] {
  const pool = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return shuffle(pool).slice(0, count);
}

/** Standard bingo column ranges: B I N G O */
const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

/** Generate one standard 5×5 bingo card. Card[row][col]. Center is FREE. */
export function generateBingoCard(): BingoCard {
  const columns = COLUMN_RANGES.map(([start, end]) =>
    pickUnique(start, end, 5),
  );

  return Array.from({ length: 5 }, (_, row): BingoCell[] =>
    Array.from({ length: 5 }, (_, col): BingoCell => {
      const isFree = row === 2 && col === 2;
      return {
        number: isFree ? null : columns[col][row],
        highlighted: isFree, // FREE cell is pre-highlighted
      };
    }),
  );
}

/** Generate `count` distinct bingo cards */
export function generateBingoCards(count: number): BingoCard[] {
  return Array.from({ length: count }, () => generateBingoCard());
}

/** Shuffled sequence of all 75 bingo numbers */
export function generateCallingSequence(): number[] {
  return shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
}

/** BINGO letter for a given number */
export function getBingoLetter(n: number): string {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

/** Check if a card has at least one complete bingo line based on called numbers */
export function hasBingo(card: BingoCard, calledSet: Set<number>): boolean {
  const marked = (r: number, c: number) =>
    card[r][c].number === null || calledSet.has(card[r][c].number!);

  // Rows
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => marked(r, c))) return true;
  }
  // Columns
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => marked(r, c))) return true;
  }
  // Diagonals
  if ([0, 1, 2, 3, 4].every((i) => marked(i, i))) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked(i, 4 - i))) return true;

  return false;
}

/**
 * Find the 1-based call index at which the first bingo became achievable.
 * Returns null if bingo never occurs within the given sequence.
 */
export function findFirstBingoPossibleAt(
  card: BingoCard,
  callingSequence: number[],
): number | null {
  const calledSet = new Set<number>();
  for (let i = 0; i < callingSequence.length; i++) {
    calledSet.add(callingSequence[i]);
    if (hasBingo(card, calledSet)) return i + 1;
  }
  return null;
}

/**
 * Compute highlight accuracy: fraction of card cells where highlighted===called
 * (both highlighted+called or neither highlighted+not called).
 * FREE cell is excluded.
 */
export function computeHighlightAccuracy(
  card: BingoCard,
  calledSet: Set<number>,
): number {
  let correct = 0;
  let total = 0;
  for (const row of card) {
    for (const cell of row) {
      if (cell.number === null) continue; // skip FREE
      total++;
      const isCalled = calledSet.has(cell.number);
      if (cell.highlighted === isCalled) correct++;
    }
  }
  return total === 0 ? 1 : correct / total;
}
