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

const dotDurationForWpm = (wpm: number) => (1200 / wpm) * 1;

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
  const dotDuration = dotDurationForWpm(settings.wpm);
  const symbolGap = settings.farnsworth ? dotDuration * 2 : dotDuration;
  const letterGap = settings.farnsworth ? dotDuration * 3 : dotDuration * 3;
  const wordGap = settings.farnsworth ? dotDuration * 7 : dotDuration * 7;

  const pattern = getMorseForText(text).split('');
  let index = 0;

  const schedule = () => {
    if (index >= pattern.length) {
      audioContext.close();
      onComplete?.();
      return;
    }

    const char = pattern[index];

    if (char === ' ') {
      index += 1;
      setTimeout(schedule, wordGap);
      return;
    }

    if (char === '/') {
      index += 1;
      setTimeout(schedule, wordGap);
      return;
    }

    const isDot = char === '.';
    const duration = isDot ? dotDuration : dotDuration * 3;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = settings.frequency;

    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration / 1000);

    index += 1;
    const nextDelay = isDot ? symbolGap : symbolGap * 2;
    setTimeout(schedule, duration + nextDelay);
  };

  schedule();

  return () => {
    audioContext.close();
  };
};

export const encodeMorse = (text: string) => getMorseForText(text);
