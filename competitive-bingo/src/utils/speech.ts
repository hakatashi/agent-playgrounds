import { getBingoLetter } from './bingoCard';

let jaVoice: SpeechSynthesisVoice | null | undefined = undefined;

/** Lazily resolve a Japanese voice (cached after first call). */
function getJaVoice(): SpeechSynthesisVoice | null {
  if (jaVoice !== undefined) return jaVoice;
  const voices = window.speechSynthesis.getVoices();
  jaVoice =
    voices.find((v) => v.lang.startsWith('ja')) ??
    voices.find((v) => v.default) ??
    voices[0] ??
    null;
  return jaVoice;
}

/** Speak a bingo number (e.g. "B 3") in Japanese. Returns a promise that resolves when speech ends. */
export function speakNumber(n: number, rate: number): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();

    const letter = getBingoLetter(n);
    // Build Japanese-friendly text: "ビー 3" etc.
    const letterPronunciation: Record<string, string> = {
      B: 'ビー',
      I: 'アイ',
      N: 'エヌ',
      G: 'ジー',
      O: 'オー',
    };
    const text = `${letterPronunciation[letter]} ${n}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = rate;

    const voice = getJaVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

/** Pre-warm voice list (call on user interaction to avoid browser restrictions). */
export function initSpeech(): void {
  window.speechSynthesis.getVoices();
  // Some browsers load voices asynchronously
  window.speechSynthesis.onvoiceschanged = () => {
    jaVoice = undefined; // reset cache so next call re-resolves
  };
}

/** Stop any ongoing speech immediately. */
export function cancelSpeech(): void {
  window.speechSynthesis.cancel();
}
