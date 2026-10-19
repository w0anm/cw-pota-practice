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

const START_DELAY_MS = 3000; // after pressing "Play call", wait before first send
const LISTEN_WINDOW_MS = 4000; // time to start typing before the call is replayed
const NEXT_CALL_DELAY_MS = 2000; // after a correct copy, wait before the next call

const initialSettings: MorseSettings = {
  wpm: 18,
  farnsworth: true,
  frequency: 700,
  tailSilenceMode: 'fixed',
  fixedSilenceMs: 1000,
};

type Phase = 'idle' | 'waiting' | 'sending' | 'listening' | 'resolved';

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
  const [sessionActive, setSessionActive] = useState(false);
  const [callAttempts, setCallAttempts] = useState(0);
  const [missedCall, setMissedCall] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);

  const playbackRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);
  const runRef = useRef(0); // invalidates stale timers/callbacks
  const phaseRef = useRef<Phase>('idle');
  const inputRef = useRef('');
  const callAttemptsRef = useRef(0);
  const currentCallRef = useRef<CallRecord | null>(null);
  const settingsRef = useRef<MorseSettings>(initialSettings);
  settingsRef.current = settings;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAll = () => {
    runRef.current += 1;
    clearTimer();
    if (playbackRef.current) {
      playbackRef.current();
      playbackRef.current = null;
    }
    phaseRef.current = 'idle';
    setIsPlaying(false);
    setSessionActive(false);
  };

  const resetEntry = () => {
    inputRef.current = '';
    callAttemptsRef.current = 0;
    setUserInput('');
    setLastResult(null);
    setCallAttempts(0);
  };

  /** Wait LISTEN_WINDOW_MS for input; replay the call if nothing was typed. */
  const startListening = (call: CallRecord, runId: number) => {
    phaseRef.current = 'listening';
    setStatus('Listening... type the call (replays in 4s if nothing entered)');
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      if (inputRef.current.trim() === '') {
        setRepeats((c) => c + 1);
        sendCall(call, runId);
      }
      // If something has been typed, wait for it to match or be submitted.
    }, LISTEN_WINDOW_MS);
  };

  const sendCall = (call: CallRecord, runId: number) => {
    phaseRef.current = 'sending';
    setIsPlaying(true);
    setStatus('Sending...');
    playbackRef.current = playMorseAudio(call.callsign, settingsRef.current, () => {
      if (runRef.current !== runId) return;
      setIsPlaying(false);
      startListening(call, runId);
    });
  };

  const beginCall = (call: CallRecord, runId: number) => {
    currentCallRef.current = call;
    sendCall(call, runId);
  };

  /** Pick the next call and send it immediately (used after the 2s pause). */
  const advance = (runId: number) => {
    if (runRef.current !== runId) return;
    const next = pickRandom(getCallDatabase(), currentCallRef.current?.callsign);
    if (!next) {
      stopAll();
      setStatus('No calls available.');
      return;
    }
    setCurrentCall(next);
    resetEntry();
    beginCall(next, runId);
  };

  const scheduleAdvance = () => {
    clearTimer();
    const runId = ++runRef.current;
    timerRef.current = window.setTimeout(() => advance(runId), NEXT_CALL_DELAY_MS);
  };

  const resolveCorrect = (expected: string) => {
    phaseRef.current = 'resolved';
    clearTimer();
    if (playbackRef.current) {
      playbackRef.current();
      playbackRef.current = null;
    }
    setIsPlaying(false);

    const newAttempts = callAttemptsRef.current + 1;
    callAttemptsRef.current = newAttempts;
    setCallAttempts(newAttempts);
    setAttempts((c) => c + 1);
    if (newAttempts === 1) setFirstTimeCorrect((c) => c + 1);

    setLastResult('correct');
    setStatus(`Correct copy: ${expected}. Next call in 2s...`);
    setMissedCall(null);
    scheduleAdvance();
  };

  const applyDatabase = (db: CallRecord[], src: CallSource) => {
    stopAll();
    const first = pickRandom(db);
    currentCallRef.current = first;
    setCalls(db);
    setCurrentCall(first);
    resetEntry();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

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

  /** "Play call": wait 3s, send, then listen for 4s (replaying if nothing typed). */
  const handlePlayCall = () => {
    const call = currentCallRef.current;
    if (!call || sessionActive) return;

    clearTimer();
    const runId = ++runRef.current;
    resetEntry();
    setSessionActive(true);
    phaseRef.current = 'waiting';
    setStatus('Get ready... sending in 3s');
    timerRef.current = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      beginCall(call, runId);
    }, START_DELAY_MS);
  };

  const handleStop = () => {
    stopAll();
    setStatus('Stopped. Press Play call to continue.');
  };

  const handleRepeat = () => {
    const call = currentCallRef.current;
    if (!call) return;
    clearTimer();
    if (playbackRef.current) playbackRef.current();
    const runId = ++runRef.current;
    setSessionActive(true);
    setRepeats((c) => c + 1);
    sendCall(call, runId);
  };

  const handleNextCall = () => {
    const call = currentCallRef.current;
    if (call && callAttemptsRef.current > 0 && lastResult !== 'correct') {
      setMissedCall(call.callsign);
    }
    stopAll();
    const next = pickRandom(getCallDatabase(), call?.callsign);
    currentCallRef.current = next;
    setCurrentCall(next);
    resetEntry();
    clearTimer();
    const runId = ++runRef.current;
    setSessionActive(true);
    phaseRef.current = 'waiting';
    setStatus('Get ready... sending in 3s');
    timerRef.current = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      beginCall(next, runId);
    }, START_DELAY_MS);
  };

  const handleInputChange = (value: string) => {
    const upper = value.toUpperCase();
    setUserInput(upper);
    inputRef.current = upper;

    // Auto-accept as soon as the typed call matches while a call is active.
    const call = currentCallRef.current;
    if (
      call &&
      (phaseRef.current === 'sending' || phaseRef.current === 'listening') &&
      upper.trim() === call.callsign.toUpperCase()
    ) {
      resolveCorrect(call.callsign.toUpperCase());
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const call = currentCallRef.current;
    if (!call) return;
    if (phaseRef.current === 'resolved') return;

    const normalized = inputRef.current.trim().toUpperCase();
    const expected = call.callsign.toUpperCase();
    if (!normalized) return;

    if (normalized === expected) {
      resolveCorrect(expected);
      return;
    }

    const newAttempts = callAttemptsRef.current + 1;
    callAttemptsRef.current = newAttempts;
    setCallAttempts(newAttempts);
    setAttempts((c) => c + 1);
    setRepeats((c) => c + 1);

    if (newAttempts < 3) {
      setLastResult('incorrect');
      setStatus('Not quite right');
      // Do NOT clear the input field
      if (sessionActive && phaseRef.current !== 'sending') {
        const runId = ++runRef.current;
        startListening(call, runId);
      }
    } else {
      phaseRef.current = 'resolved';
      clearTimer();
      if (playbackRef.current) playbackRef.current();
      setIsPlaying(false);
      setLastResult('missed');
      setStatus(`Missed Call: ${expected}. Next call in 2s...`);
      setMissedCall(expected);
      if (sessionActive) {
        scheduleAdvance();
      }
    }
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
            <button onClick={handlePlayCall} disabled={!currentCall || sessionActive}>
              {sessionActive ? (isPlaying ? 'Sending...' : 'Running...') : 'Play call'}
            </button>
            <button className="secondary" onClick={handleRepeat} disabled={!currentCall || isPlaying}>
              Repeat key
            </button>
            <button className="secondary" onClick={handleStop} disabled={!sessionActive}>
              Stop
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
              onChange={(e) => handleInputChange(e.target.value)}
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
