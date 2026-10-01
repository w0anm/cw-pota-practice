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

  // Farnsworth spacing: increase gaps between letters/words while keeping dot/dash ratio
  const symbolGap = settings.farnsworth ? dotDuration * 3 : dotDuration;
  const wordGap = settings.farnsworth ? dotDuration * 7 : dotDuration * 7;

  const pattern = getMorseForText(text).split('');
  let audioTime = audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];

  // Pre-schedule all symbols
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === ' ') {
      // Space between symbols (dot/dash)
      audioTime += symbolGap;
      continue;
    }

    if (char === '/') {
      // Word gap
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

    audioTime += duration + symbolGap;
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
