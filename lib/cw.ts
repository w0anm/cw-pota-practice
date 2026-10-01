export type MorseSettings = {
  wpm: number;
  farnsworth: boolean;
  frequency: number;
};

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.',
  '/': '-..-.', '?': '..--..', '.': '.-.-.-', ',': '--..--', '=': '-...-'
};

// Paris standard: 50 dots per word at 1 WPM = 1.2 seconds per dot
const dotDurationForWpm = (wpm: number) => 1200 / wpm; // milliseconds

const getMorseForText = (text: string) =>
  text
    .toUpperCase()
    .split('')
    .map((char) => {
      if (char === ' ') return '/';
      return MORSE[char] ?? '';
    })
    .join(' ');

export const playMorseAudio = (
  text: string,
  settings: MorseSettings,
  onComplete?: () => void
) => {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtor) {
    onComplete?.();
    return () => undefined;
  }

  const audioContext = new AudioCtor();
  const dotDurationMs = dotDurationForWpm(settings.wpm);
  const dotDuration = dotDurationMs / 1000; // convert to seconds for Web Audio API
  const dashDuration = dotDuration * 3;

  // Standard CW timing:
  // - Space between dot/dash within a letter: 1 dot
  // - Space between letters: 3 dots
  // - Space between words: 7 dots
  // Farnsworth spacing increases letter/word gaps while keeping dot/dash timing
  const symbolGap = dotDuration; // space between dot/dash within a letter (always 1 dot)
  const letterGap = settings.farnsworth ? dotDuration * 7 : dotDuration * 3; // space between letters
  const wordGap = settings.farnsworth ? dotDuration * 14 : dotDuration * 7; // space between words

  const pattern = getMorseForText(text).split('');
  let audioTime = audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];

  // Pre-schedule all symbols
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === ' ') {
      // Space between symbols (dot/dash) within a letter
      audioTime += symbolGap;
      continue;
    }

    if (char === '/') {
      // Word gap (includes the letter gap, so subtract one letter gap)
      audioTime += wordGap;
      continue;
    }

    const isDot = char === '.';
    const duration = isDot ? dotDuration : dashDuration;

    // Create oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = settings.frequency;

    // Smooth envelope to prevent clicking
    const rampTime = 0.003; // 3ms rise/fall time
    gainNode.gain.setValueAtTime(0, audioTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioTime + rampTime);
    gainNode.gain.setValueAtTime(0.15, audioTime + duration - rampTime);
    gainNode.gain.linearRampToValueAtTime(0, audioTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioTime);
    oscillator.stop(audioTime + duration);
    oscillators.push(oscillator);

    // Check if next character is space (letter gap) or / (word gap) or end
    const nextChar = pattern[i + 1];
    if (nextChar === ' ') {
      audioTime += duration + symbolGap;
    } else if (nextChar === '/') {
      audioTime += duration + letterGap;
    } else if (i === pattern.length - 1) {
      audioTime += duration;
    } else {
      // Next is a dot/dash, add letter gap
      audioTime += duration + letterGap;
    }
  }

  // Close context after all audio is done
  const totalDuration = audioTime - audioContext.currentTime;
  setTimeout(() => {
    audioContext.close();
    onComplete?.();
  }, totalDuration * 1000 + 100);

  return () => {
    try {
      audioContext.close();
    } catch (e) {
      // Context may already be closed
    }
  };
};

export const encodeMorse = (text: string) => getMorseForText(text);
