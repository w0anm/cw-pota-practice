'use client';

import { useEffect, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import {
  loadCallDatabase,
  getCallDatabase,
  getSource,
  setSource,
  parseCallsignText,
  saveCustomCalls,
  getCustomCalls,
  type CallRecord,
  type CallSource,
} from '@/lib/callDatabase';

const initialSettings: MorseSettings = {
  wpm: 18,
  farnsworth: true,
  frequency: 700,
  tailSilenceMode: 'fixed',
  fixedSilenceMs: 1000,
};

function pickRandom(db: CallRecord[], avoid?: string): CallRecord | null {
  if (db.length === 0) return null;
  if (db.length === 1) return db[0];
  let next = db[Math.floor(Math.random() * db.length)];
  let guard = 0;
  while (next.callsign === avoid && guard++ < 10) {
    next = db[Math.floor(Math.random() * db.length)];
  }
  return next;
}

export default function HomePage() {
  const [settings, setSettings] = useState<MorseSettings>(initialSettings);
  const [source, setSourceState] = useState<CallSource>('pota');
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [currentCall, setCurrentCall] = useState<CallRecord | null>(null);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState('Loading calls...');
  const [firstTimeCorrect, setFirstTimeCorrect] = useState(0);
  const [repeats, setRepeats] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | 'missed' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [callAttempts, setCallAttempts] = useState(0);
  const [missedCall, setMissedCall] = useState<string | null>(null);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const playbackRef = useRef<(() => void) | null>(null);

  const applyDatabase = (db: CallRecord[], src: CallSource) => {
    setCalls(db);
    setCurrentCall(pickRandom(db));
    setUserInput('');
    setLastResult(null);
    setCallAttempts(0);
    setLastRefreshTime(new Date().toLocaleTimeString());
    if (db.length === 0) {
      setStatus(
        src === 'custom'
          ? 'No custom calls loaded. Upload a file with one callsign per line.'
          : 'No POTA callsigns returned. Try Refresh, or switch to a custom file.'
      );
    } else {
      setStatus(`Loaded ${db.length} calls. Press Play call.`);
    }
  };

  const reload = async (src: CallSource, force = false) => {
    setIsRefreshing(true);
    setStatus(src === 'pota' ? 'Fetching POTA callsigns...' : 'Loading custom calls...');
    const db = await loadCallDatabase(force);
    applyDatabase(db, src);
    setIsRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    const src = getSource();
    setSourceState(src);
    reload(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

  // Auto-play when a new call is selected
  useEffect(() => {
    if (!currentCall) return;
    setIsPlaying(true);
    setStatus('Sending...');
    setSendCooldown(true);
    const stop = playMorseAudio(currentCall.callsign, settings, () => {
      setIsPlaying(false);
      setStatus('Ready to copy');
    });
    playbackRef.current = stop;

    const cooldownTimer = window.setTimeout(() => setSendCooldown(false), 2000);
    return () => window.clearTimeout(cooldownTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCall]);

  const handleSourceChange = async (next: CallSource) => {
    setSource(next);
    setSourceState(next);
    await reload(next);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const parsed = parseCallsignText(String(e.target?.result ?? ''));
      if (parsed.length === 0) {
        setStatus('No valid callsigns found in that file (expected one per line).');
        return;
      }
      saveCustomCalls(parsed);
      setSource('custom');
      setSourceState('custom');
      await reload('custom');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRefresh = () => reload(source, true);

  const nextCall = () => {
    setCurrentCall(pickRandom(getCallDatabase(), currentCall?.callsign));
    setUserInput('');
    setLastResult(null);
    setCallAttempts(0);
    setStatus('New call ready. Press Play call.');
  };

  const playCurrentCall = () => {
    if (!currentCall || isPlaying || sendCooldown) return;
    setIsPlaying(true);
    setStatus('Sending...');
    setSendCooldown(true);
    playbackRef.current = playMorseAudio(currentCall.callsign, settings, () => {
      setIsPlaying(false);
      setStatus('Ready to copy');
      setSendCooldown(false);
    });
    window.setTimeout(() => setSendCooldown(false), 2000);
  };

  const handleNextCall = () => {
    if (currentCall && callAttempts > 0 && lastResult !== 'correct') {
      setMissedCall(currentCall.callsign);
    }
    nextCall();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentCall) return;
    const normalized = userInput.trim().toUpperCase();
    const expected = currentCall.callsign.toUpperCase();

    const newAttempts = callAttempts + 1;
    setCallAttempts(newAttempts);
    setAttempts((c) => c + 1);

    if (normalized === expected) {
      if (newAttempts === 1) setFirstTimeCorrect((c) => c + 1);
      setLastResult('correct');
      setStatus(`Correct copy: ${expected}`);
      setMissedCall(null);
      setTimeout(nextCall, 800);
      return;
    }

    setRepeats((c) => c + 1);
    if (newAttempts < 3) {
      setLastResult('incorrect');
      setStatus('Not quite right');
    } else {
      setLastResult('missed');
      setStatus(`Missed Call: ${expected}`);
      setMissedCall(expected);
      setTimeout(nextCall, 1500);
    }
  };

  const handleRepeat = () => {
    setRepeats((c) => c + 1);
    playCurrentCall();
  };

  const handleSettingsChange = (key: keyof MorseSettings, value: number | boolean | string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const customCount = typeof window !== 'undefined' ? getCustomCalls().length : 0;

  return (
    <main className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">POTA CW Practice</p>
          <h1>CW Parks on the Air Practice</h1>
        </div>
        <div className="stats-row">
          <div className="stat-box"><span>First-time copies</span><strong>{firstTimeCorrect}</strong></div>
          <div className="stat-box"><span>Repeats</span><strong>{repeats}</strong></div>
          <div className="stat-box"><span>Attempts</span><strong>{attempts}</strong></div>
        </div>
      </section>

      <section className="panel">
        <h3>Callsign source</h3>
        <div className="control-grid">
          <label className="checkbox-row">
            <input
              type="radio"
              name="source"
              checked={source === 'pota'}
              onChange={() => handleSourceChange('pota')}
            />
            <span>POTA API (live activators)</span>
          </label>

          <label className="checkbox-row">
            <input
              type="radio"
              name="source"
              checked={source === 'custom'}
              onChange={() => handleSourceChange('custom')}
            />
            <span>My own file{customCount > 0 ? ` (${customCount} calls saved)` : ''}</span>
          </label>

          <label>
            <span>Upload callsign file (one per line)</span>
            <input type="file" accept=".txt,.csv" onChange={handleFileUpload} />
          </label>

          <div>
            <button onClick={handleRefresh} disabled={isRefreshing} className="secondary">
              {isRefreshing ? 'Loading...' : source === 'pota' ? 'Refresh POTA Data' : 'Reload file'}
            </button>
            {lastRefreshTime && (
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Last loaded: {lastRefreshTime}</p>
            )}
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
              onChange={(e) => handleSettingsChange('wpm', Number(e.target.value))}
            />
            <strong>{settings.wpm} WPM</strong>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.farnsworth}
              onChange={(e) => handleSettingsChange('farnsworth', e.target.checked)}
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
              onChange={(e) => handleSettingsChange('frequency', Number(e.target.value))}
            />
          </label>

          <label>
            <span>Tail silence mode</span>
            <select
              value={settings.tailSilenceMode}
              onChange={(e) => handleSettingsChange('tailSilenceMode', e.target.value)}
            >
              <option value="fixed">Fixed (1s)</option>
              <option value="wpm-based">WPM-based</option>
              <option value="character-based">Character-based</option>
            </select>
          </label>

          {settings.tailSilenceMode === 'fixed' && (
            <label>
              <span>Silence duration (ms)</span>
              <input
                type="number"
                min={100}
                max={2000}
                step={100}
                value={settings.fixedSilenceMs}
                onChange={(e) => handleSettingsChange('fixedSilenceMs', Number(e.target.value))}
              />
            </label>
          )}
        </div>
      </section>

      <section className="panel practice-panel">
        <div className="call-header">
          <div>
            <p className="eyebrow">Call attempt {callAttempts}/3</p>
            <h2>Listen to the call</h2>
            {currentCall?.parkCode && (
              <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
                {currentCall.location} ({currentCall.parkCode})
              </p>
            )}
          </div>
          <div className="button-stack">
            <button onClick={playCurrentCall} disabled={!currentCall || isPlaying || sendCooldown}>
              {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Play call'}
            </button>
            <button className="secondary" onClick={handleRepeat} disabled={!currentCall || isPlaying || sendCooldown}>
              Repeat key
            </button>
            <button className="secondary" onClick={handleNextCall} disabled={!currentCall}>
              New call
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="entry-form">
          <label>
            <span>Type the call you copied</span>
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value.toUpperCase())}
              placeholder="e.g. K1ABC"
              autoComplete="off"
              disabled={!currentCall}
            />
          </label>
          <button type="submit" disabled={!currentCall}>Submit copy</button>
        </form>

        <div className={`status ${lastResult ?? ''}`}>{status}</div>

        {missedCall && (
          <div className="missed-call-section">
            <p className="eyebrow">Last missed</p>
            <p className="missed-callsign">{missedCall}</p>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Practice call list ({calls.length})</h3>
        <p className="call-list">{calls.map((c) => c.callsign).join(', ')}</p>
      </section>
    </main>
  );
}
