export type MorseSettings = {
  wpm: number;
  farnsworth: boolean;
  frequency: number;
  tailSilenceMode: 'fixed' | 'wpm-based' | 'character-based';
  fixedSilenceMs: number;
};

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.',
  '/': '-..-.', '?': '..--..', '.': '.-.-.-', ',': '--..--', '=': '-...-'
};

/**
 * Convert text to array of Morse code strings
 * Spaces in input become '/' (word break marker)
 */
const getMorseLetters = (text: string): string[] =>
  text
    .toUpperCase()
    .split('')
    .map((char) => (char === ' ' ? '/' : MORSE[char] ?? ''));

/**
 * Calculate tail silence in milliseconds based on settings
 */
const calculateTailSilence = (
  text: string,
  wpm: number,
  mode: 'fixed' | 'wpm-based' | 'character-based',
  fixedSilenceMs: number
): number => {
  const dotDurationMs = 1200 / wpm;

  switch (mode) {
    case 'fixed':
      return fixedSilenceMs;
    case 'wpm-based':
      // 5 times the dot duration for the given WPM
      return Math.round(dotDurationMs * 5);
    case 'character-based':
      // 3 dots per character average, so tail = 1 character duration
      return Math.round(dotDurationMs * 9); // 3 symbols * 3 dots each
    default:
      return fixedSilenceMs;
  }
};

/**
 * Play Morse code audio for the given text
 * @param text - Text to encode and play
 * @param settings - WPM, Farnsworth mode, frequency, and tail silence settings
 * @param onComplete - Callback when playback finishes
 * @returns Function to stop/cancel playback
 */
export const playMorseAudio = (
  text: string,
  settings: MorseSettings,
  onComplete?: () => void
): (() => void) => {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtor) {
    onComplete?.();
    return () => undefined;
  }

  const audioContext = new AudioCtor();

  // Calculate timing based on WPM (Paris standard: 1200ms / WPM = dot duration in ms)
  const dotDurationMs = 1200 / settings.wpm;
  const dotDuration = dotDurationMs / 1000; // Convert to seconds for Web Audio API
  const dashDuration = dotDuration * 3;

  // Farnsworth spacing: increase gaps between letters/words, keep dot/dash timing tight
  const symbolGap = dotDuration; // Gap between dot/dash within a letter: 1 dot
  const letterGap = settings.farnsworth ? dotDuration * 7 : dotDuration * 3; // Gap between letters
  const wordGap = settings.farnsworth ? dotDuration * 14 : dotDuration * 7; // Gap between words

  const morseLetters = getMorseLetters(text);
  let audioTime = audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];

  // Schedule all symbols
  for (let letterIdx = 0; letterIdx < morseLetters.length; letterIdx++) {
    const morse = morseLetters[letterIdx];

    // Handle word breaks
    if (morse === '/') {
      audioTime += wordGap;
      continue;
    }

    // Process each symbol (dot/dash) in the letter
    const symbols = morse.split('');

    for (let symIdx = 0; symIdx < symbols.length; symIdx++) {
      const symbol = symbols[symIdx];
      const isDot = symbol === '.';
      const duration = isDot ? dotDuration : dashDuration;

      // Create oscillator and gain node
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = settings.frequency;

      // Smooth attack/release envelope (3ms) to prevent clicking
      const rampTime = 0.003;
      gainNode.gain.setValueAtTime(0, audioTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioTime + rampTime);
      gainNode.gain.setValueAtTime(0.15, audioTime + duration - rampTime);
      gainNode.gain.linearRampToValueAtTime(0, audioTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioTime);
      oscillator.stop(audioTime + duration);
      oscillators.push(oscillator);

      audioTime += duration;

      // Add gap after symbol
      if (symIdx < symbols.length - 1) {
        // Gap between symbols within a letter
        audioTime += symbolGap;
      }
    }

    // Add gap after letter (if not the last letter)
    if (letterIdx < morseLetters.length - 1 && morseLetters[letterIdx + 1] !== '/') {
      audioTime += letterGap;
    }
  }

  // Calculate tail silence based on selected mode
  const tailSilenceMs = calculateTailSilence(
    text,
    settings.wpm,
    settings.tailSilenceMode,
    settings.fixedSilenceMs
  );
  const tailSilenceSec = tailSilenceMs / 1000;

  // Schedule context close and completion callback with configurable tail
  const totalDuration = audioTime - audioContext.currentTime + tailSilenceSec;
  const timeoutId = setTimeout(() => {
    audioContext.close();
    onComplete?.();
  }, totalDuration * 1000);

  // Return cancellation function
  return () => {
    clearTimeout(timeoutId);
    try {
      audioContext.close();
    } catch (e) {
      // Context may already be closed
    }
  };
};

/**
 * Encode text to Morse code string (for reference/display)
 * @param text - Text to encode
 * @returns Morse code with spaces between symbols and words
 */
export const encodeMorse = (text: string): string =>
  getMorseLetters(text)
    .map((morse) => morse.split('').join(' '))
    .join(' | ');
