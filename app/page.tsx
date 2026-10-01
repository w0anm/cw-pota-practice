'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import { callDatabase } from '@/lib/callDatabase';

const initialSettings: MorseSettings = {
  wpm: 18,
  farnsworth: true,
  frequency: 700,
};

function getRandomCall() {
  return callDatabase[Math.floor(Math.random() * callDatabase.length)];
}

export default function HomePage() {
  const [settings, setSettings] = useState<MorseSettings>(initialSettings);
  const [currentCall, setCurrentCall] = useState(getRandomCall());
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState('Ready for the next call');
  const [firstTimeCorrect, setFirstTimeCorrect] = useState(0);
  const [repeats, setRepeats] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        playbackRef.current();
      }
    };
  }, []);

  const callListText = useMemo(
    () => callDatabase.map((item) => item.callsign).join(', '),
    []
  );

  const playCurrentCall = () => {
    setIsPlaying(true);
    setStatus(`Sending ${currentCall.callsign}`);
    const stop = playMorseAudio(currentCall.callsign, settings, () => {
      setIsPlaying(false);
      setStatus(`Finished sending ${currentCall.callsign}`);
    });
    playbackRef.current = stop;
  };

  const handleNextCall = () => {
    const next = getRandomCall();
    setCurrentCall(next);
    setUserInput('');
    setLastResult(null);
    setStatus(`New call ready: ${next.callsign}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedValue = userInput.trim().toUpperCase();
    const expectedValue = currentCall.callsign.toUpperCase();
    setAttempts((current) => current + 1);

    if (normalizedValue === expectedValue) {
      setFirstTimeCorrect((count) => count + 1);
      setLastResult('correct');
      setStatus(`Correct copy: ${expectedValue}`);
      setTimeout(() => handleNextCall(), 800);
      return;
    }

    setLastResult('incorrect');
    setStatus(`Not quite. Try again or repeat the call.`);
    setRepeats((count) => count + 1);
  };

  const handleRepeat = () => {
    setRepeats((count) => count + 1);
    playCurrentCall();
  };

  const handleSettingsChange = (key: keyof MorseSettings, value: number | boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">POTA CW Practice</p>
          <h1>CW Parks on the Air Practice</h1>
        </div>
        <div className="stats-row">
          <div className="stat-box">
            <span>First-time copies</span>
            <strong>{firstTimeCorrect}</strong>
          </div>
          <div className="stat-box">
            <span>Repeats</span>
            <strong>{repeats}</strong>
          </div>
          <div className="stat-box">
            <span>Attempts</span>
            <strong>{attempts}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="control-grid">
          <label>
            <span>Speed (WPM)</span>
            <input
              type="range"
              min={5}
              max={30}
              value={settings.wpm}
              onChange={(event) => handleSettingsChange('wpm', Number(event.target.value))}
            />
            <strong>{settings.wpm} WPM</strong>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.farnsworth}
              onChange={(event) => handleSettingsChange('farnsworth', event.target.checked)}
            />
            <span>Use Farnsworth spacing</span>
          </label>

          <label>
            <span>Audio frequency</span>
            <input
              type="number"
              min={400}
              max={1200}
              value={settings.frequency}
              onChange={(event) => handleSettingsChange('frequency', Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="panel practice-panel">
        <div className="call-header">
          <div>
            <p className="eyebrow">Current target</p>
            <h2>{currentCall.callsign}</h2>
          </div>
          <div className="button-stack">
            <button onClick={playCurrentCall} disabled={isPlaying}>
              {isPlaying ? 'Sending...' : 'Play call'}
            </button>
            <button className="secondary" onClick={handleRepeat}>
              Repeat key
            </button>
            <button className="secondary" onClick={handleNextCall}>
              New call
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="entry-form">
          <label>
            <span>Type the call you copied</span>
            <input
              value={userInput}
              onChange={(event) => setUserInput(event.target.value.toUpperCase())}
              placeholder="e.g. K1ABC"
              autoComplete="off"
            />
          </label>
          <button type="submit">Submit copy</button>
        </form>

        <div className={`status ${lastResult ?? ''}`}>
          {status}
        </div>
      </section>

      <section className="panel">
        <h3>Practice call database</h3>
        <p className="call-list">{callListText}</p>
      </section>
    </main>
  );
}
