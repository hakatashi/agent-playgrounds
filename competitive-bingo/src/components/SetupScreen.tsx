import type { GameSettings } from '../types';
import { initSpeech } from '../utils/speech';

interface Props {
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onStart: () => void;
}

export function SetupScreen({ settings, onUpdateSettings, onStart }: Props) {
  const handleStart = () => {
    initSpeech();
    onStart();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold mb-2 tracking-tight text-yellow-400">
        競技ビンゴ
      </h1>
      <p className="text-gray-400 mb-10 text-center max-w-md">
        5枚のカードから1枚を選び、ビンゴが完成したと思ったら
        <span className="text-yellow-300 font-semibold">「ビンゴ！」</span>
        を申告してください。
      </p>

      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md space-y-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-gray-200 border-b border-gray-700 pb-3">
          ゲーム設定
        </h2>

        {/* Interval */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-300">
            数字の間隔
            <span className="ml-2 text-yellow-400 font-bold text-base">
              {settings.intervalSeconds} 秒
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={settings.intervalSeconds}
            onChange={(e) =>
              onUpdateSettings({ intervalSeconds: parseFloat(e.target.value) })
            }
            className="w-full accent-yellow-400"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>速い (1秒)</span>
            <span>遅い (10秒)</span>
          </div>
        </label>

        {/* Speech rate */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-300">
            音声速度
            <span className="ml-2 text-yellow-400 font-bold text-base">
              ×{settings.speechRate.toFixed(1)}
            </span>
          </span>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) =>
              onUpdateSettings({ speechRate: parseFloat(e.target.value) })
            }
            className="w-full accent-yellow-400"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>遅い (×0.5)</span>
            <span>速い (×2.0)</span>
          </div>
        </label>

        {/* Manual highlight toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-300">
            手動ハイライトモード
            <p className="text-xs text-gray-500 font-normal mt-0.5">
              カードのマス目をクリックして自分でハイライトできます
            </p>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.manualHighlightEnabled}
            onClick={() =>
              onUpdateSettings({
                manualHighlightEnabled: !settings.manualHighlightEnabled,
              })
            }
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
              settings.manualHighlightEnabled
                ? 'bg-yellow-400'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                settings.manualHighlightEnabled
                  ? 'translate-x-8'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      <button
        onClick={handleStart}
        className="mt-8 px-10 py-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-xl rounded-2xl shadow-lg transition-colors"
      >
        カードを選ぶ →
      </button>
    </div>
  );
}
