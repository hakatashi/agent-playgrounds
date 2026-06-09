import { useGameEngine } from './hooks/useGameEngine';
import { SetupScreen } from './components/SetupScreen';
import { CardSelectionScreen } from './components/CardSelectionScreen';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';

export default function App() {
  const {
    state,
    updateSettings,
    startCardSelection,
    selectCard,
    toggleHighlight,
    declareBingo,
    reset,
  } = useGameEngine();

  const { phase, settings, cards, selectedCard, calledNumbers, elapsedMs, result } = state;

  if (phase === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        onUpdateSettings={updateSettings}
        onStart={startCardSelection}
      />
    );
  }

  if (phase === 'card-selection') {
    return <CardSelectionScreen cards={cards} onSelect={selectCard} />;
  }

  if (phase === 'playing' && selectedCard) {
    return (
      <GameScreen
        card={selectedCard}
        calledNumbers={calledNumbers}
        elapsedMs={elapsedMs}
        manualHighlightEnabled={settings.manualHighlightEnabled}
        onToggleHighlight={toggleHighlight}
        onDeclareBingo={declareBingo}
      />
    );
  }

  if (phase === 'result' && selectedCard && result) {
    return (
      <ResultScreen
        card={selectedCard}
        result={result}
        onReset={reset}
      />
    );
  }

  return null;
}
