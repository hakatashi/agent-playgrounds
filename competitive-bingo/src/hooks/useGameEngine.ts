import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { BingoCard, GamePhase, GameResult, GameSettings } from '../types';
import {
  computeHighlightAccuracy,
  findFirstBingoPossibleAt,
  generateBingoCards,
  generateCallingSequence,
  hasBingo,
} from '../utils/bingoCard';
import { cancelSpeech, speakNumber } from '../utils/speech';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface GameState {
  phase: GamePhase;
  settings: GameSettings;
  /** Five cards shown during card-selection */
  cards: BingoCard[];
  /** The card the player chose (with mutable highlight) */
  selectedCard: BingoCard | null;
  /** Randomised order in which numbers 1-75 will be called */
  callingSequence: number[];
  /** Numbers called so far (in call order) */
  calledNumbers: number[];
  /** Milliseconds elapsed since the first number was called */
  elapsedMs: number;
  result: GameResult | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'UPDATE_SETTINGS'; payload: Partial<GameSettings> }
  | { type: 'START_CARD_SELECTION' }
  | { type: 'SELECT_CARD'; cardIndex: number }
  | { type: 'NUMBER_CALLED'; number: number }
  | { type: 'TICK'; elapsedMs: number }
  | { type: 'TOGGLE_HIGHLIGHT'; row: number; col: number }
  | { type: 'DECLARE_BINGO' }
  | { type: 'SET_RESULT'; result: GameResult }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: GameSettings = {
  intervalSeconds: 3,
  speechRate: 1.0,
  manualHighlightEnabled: true,
};

function initialState(): GameState {
  return {
    phase: 'setup',
    settings: DEFAULT_SETTINGS,
    cards: [],
    selectedCard: null,
    callingSequence: [],
    calledNumbers: [],
    elapsedMs: 0,
    result: null,
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'START_CARD_SELECTION':
      return {
        ...state,
        phase: 'card-selection',
        cards: generateBingoCards(5),
        selectedCard: null,
        callingSequence: generateCallingSequence(),
        calledNumbers: [],
        elapsedMs: 0,
        result: null,
      };

    case 'SELECT_CARD': {
      const selected = structuredClone(state.cards[action.cardIndex]);
      return { ...state, phase: 'playing', selectedCard: selected };
    }

    case 'NUMBER_CALLED':
      return {
        ...state,
        calledNumbers: [...state.calledNumbers, action.number],
      };

    case 'TICK':
      return { ...state, elapsedMs: action.elapsedMs };

    case 'TOGGLE_HIGHLIGHT': {
      if (!state.selectedCard || !state.settings.manualHighlightEnabled)
        return state;
      const card = structuredClone(state.selectedCard);
      card[action.row][action.col].highlighted =
        !card[action.row][action.col].highlighted;
      return { ...state, selectedCard: card };
    }

    case 'SET_RESULT':
      return { ...state, phase: 'result', result: action.result };

    case 'RESET':
      return initialState();

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameEngine() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Refs to access latest state values inside async callbacks without stale closures
  const phaseRef = useRef<GamePhase>(state.phase);
  const calledCountRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const tickRafRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  // ---------------------------------------------------------------------------
  // Tick (elapsed timer)
  // ---------------------------------------------------------------------------

  const stopTick = useCallback(() => {
    if (tickRafRef.current !== null) {
      cancelAnimationFrame(tickRafRef.current);
      tickRafRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    const tick = () => {
      if (startTimeRef.current !== null) {
        dispatch({
          type: 'TICK',
          elapsedMs: Date.now() - startTimeRef.current,
        });
      }
      tickRafRef.current = requestAnimationFrame(tick);
    };
    tickRafRef.current = requestAnimationFrame(tick);
  }, []);

  // ---------------------------------------------------------------------------
  // Number calling loop
  // ---------------------------------------------------------------------------

  const stopCalling = useCallback(() => {
    if (callTimeoutRef.current !== null) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    cancelSpeech();
  }, []);

  // Passed into the effect so it can reference the latest callingSequence & settings
  const callingSequenceRef = useRef<number[]>([]);
  const settingsRef = useRef<GameSettings>(state.settings);
  const selectedCardRef = useRef<BingoCard | null>(null);

  useEffect(() => {
    callingSequenceRef.current = state.callingSequence;
  }, [state.callingSequence]);

  useEffect(() => {
    settingsRef.current = state.settings;
  }, [state.settings]);

  useEffect(() => {
    selectedCardRef.current = state.selectedCard;
  }, [state.selectedCard]);

  const callNextNumber = useCallback(
    (index: number) => {
      if (phaseRef.current !== 'playing') return;

      const seq = callingSequenceRef.current;
      if (index >= seq.length) return; // all 75 called

      const n = seq[index];
      const callStartMs = Date.now();

      if (startTimeRef.current === null) {
        startTimeRef.current = callStartMs;
        startTick();
      }

      dispatch({ type: 'NUMBER_CALLED', number: n });
      calledCountRef.current = index + 1;

      const { intervalSeconds, speechRate } = settingsRef.current;
      const intervalMs = intervalSeconds * 1000;

      speakNumber(n, speechRate).then(() => {
        if (phaseRef.current !== 'playing') return;
        const elapsed = Date.now() - callStartMs;
        const remaining = Math.max(0, intervalMs - elapsed);
        callTimeoutRef.current = setTimeout(() => {
          callNextNumber(index + 1);
        }, remaining);
      });
    },
    [startTick],
  );

  // Start calling when phase becomes 'playing'
  useEffect(() => {
    if (state.phase !== 'playing') return;

    calledCountRef.current = 0;
    startTimeRef.current = null;

    callNextNumber(0);

    return () => {
      stopCalling();
      stopTick();
    };
  }, [state.phase]); // intentionally omit callNextNumber/stopCalling/stopTick refs

  // ---------------------------------------------------------------------------
  // Public actions
  // ---------------------------------------------------------------------------

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  }, []);

  const startCardSelection = useCallback(() => {
    dispatch({ type: 'START_CARD_SELECTION' });
  }, []);

  const selectCard = useCallback((cardIndex: number) => {
    dispatch({ type: 'SELECT_CARD', cardIndex });
  }, []);

  const toggleHighlight = useCallback((row: number, col: number) => {
    dispatch({ type: 'TOGGLE_HIGHLIGHT', row, col });
  }, []);

  const declareBingo = useCallback(() => {
    if (state.phase !== 'playing') return;
    if (!state.selectedCard) return;

    stopCalling();
    stopTick();

    const elapsedMs =
      startTimeRef.current !== null
        ? Date.now() - startTimeRef.current
        : 0;

    const calledNumbers = callingSequenceRef.current.slice(
      0,
      calledCountRef.current,
    );
    const calledSet = new Set(calledNumbers);

    const isValid = hasBingo(state.selectedCard, calledSet);

    const firstBingoPossibleAt = findFirstBingoPossibleAt(
      state.selectedCard,
      callingSequenceRef.current,
    );

    const highlightAccuracy = state.settings.manualHighlightEnabled
      ? computeHighlightAccuracy(state.selectedCard, calledSet)
      : null;

    const result: GameResult = {
      elapsedMs,
      calledNumbers,
      isValid,
      firstBingoPossibleAt,
      highlightAccuracy,
    };

    dispatch({ type: 'SET_RESULT', result });
  }, [state.phase, state.selectedCard, state.settings.manualHighlightEnabled, stopCalling, stopTick]);

  const reset = useCallback(() => {
    stopCalling();
    stopTick();
    dispatch({ type: 'RESET' });
  }, [stopCalling, stopTick]);

  return {
    state,
    updateSettings,
    startCardSelection,
    selectCard,
    toggleHighlight,
    declareBingo,
    reset,
  };
}
