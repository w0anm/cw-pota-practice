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
  const dotDuration = dotDurationForWpm(settings.wpm) / 1000; // convert to seconds for Web Audio API
  const dashDuration = dotDuration * 3;

  // Farnsworth spacing: increase gaps between letters/words while keeping dot/dash ratio
  const symbolGap = settings.farnsworth ? dotDuration * 3 : dotDuration;
  const letterGap = settings.farnsworth ? dotDuration * 7 : dotDuration * 3;
  const wordGap = settings.farnsworth ? dotDuration * 14 : dotDuration * 7;

  const pattern = getMorseForText(text).split('');
  let index = 0;
  let audioTime = audioContext.currentTime;

  const scheduleSymbol = () => {
    if (index >= pattern.length) {
      audioContext.close();
      onComplete?.();
      return;
    }

    const char = pattern[index];

    if (char === ' ') {
      audioTime += symbolGap;
      index += 1;
      scheduleSymbol();
      return;
    }

    if (char === '/') {
      audioTime += wordGap;
      index += 1;
      scheduleSymbol();
      return;
    }

    const isDot = char === '.';
    const duration = isDot ? dotDuration : dashDuration;

    // Create oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = settings.frequency;

    // Smooth envelope to prevent clicking
    const rampTime = 0.005; // 5ms rise/fall time
    gainNode.gain.setValueAtTime(0, audioTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioTime + rampTime);
    gainNode.gain.setValueAtTime(0.1, audioTime + duration - rampTime);
    gainNode.gain.linearRampToValueAtTime(0, audioTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioTime);
    oscillator.stop(audioTime + duration);

    audioTime += duration + symbolGap;
    index += 1;
    scheduleSymbol();
  };

  scheduleSymbol();

  return () => {
    try {
      audioContext.close();
    } catch (e) {
      // Context may already be closed
    }
  };
};

export const encodeMorse = (text: string) => getMorseForText(text);
