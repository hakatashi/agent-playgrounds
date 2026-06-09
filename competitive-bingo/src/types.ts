export type GamePhase = 'setup' | 'card-selection' | 'playing' | 'result';

/** Single cell on a bingo card. number===null means FREE cell. */
export interface BingoCell {
  number: number | null;
  highlighted: boolean;
}

/** 5×5 grid: BingoCard[row][col] */
export type BingoCard = BingoCell[][];

export interface GameSettings {
  /** Total seconds from the start of one number announcement to the next (min 1) */
  intervalSeconds: number;
  /** SpeechSynthesis rate (0.5–2.0) */
  speechRate: number;
  /** Whether the player can click cells to manually highlight them */
  manualHighlightEnabled: boolean;
}

export interface GameResult {
  /** Elapsed milliseconds from game start to bingo declaration */
  elapsedMs: number;
  /** Numbers called up to and including the moment bingo was declared */
  calledNumbers: number[];
  /** true if bingo was actually complete at declaration time */
  isValid: boolean;
  /** Call index (1-based) at which the first valid bingo line was achievable */
  firstBingoPossibleAt: number | null;
  /** Manually highlighted cells vs. actual called cells accuracy (0–1), null if manual highlight was disabled */
  highlightAccuracy: number | null;
}
