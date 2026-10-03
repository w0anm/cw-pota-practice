'use client';

import { useEffect, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import { loadCallDatabase, getCallDatabase, type CallRecord } from '@/lib/callDatabase';
import { createQSO, downloadCSV, exportQSOsToCSV, type QSO } from '@/lib/simulator';
import '../simulator.css';

const initialSettings: MorseSettings = {
  wpm: 18,
  farnsworth: true,
  frequency: 700,
};

function getRandomCall(): CallRecord | null {
  const db = getCallDatabase();
  if (db.length === 0) return null;
  return db[Math.floor(Math.random() * db.length)];
}

const randomState = () => {
  const states = [
    'CA', 'CO', 'WA', 'TX', 'NY', 'FL', 'AZ', 'OR', 'PA', 'NC', 'TN', 'OH', 'MI', 'MN', 'UT', 'NM', 'ID', 'GA', 'AL', 'VA'
  ];
  return states[Math.floor(Math.random() * states.length)];
};

export default function SimulatorPage() {
  const [settings, setSettings] = useState<MorseSettings>(initialSettings);
  const [yourCall, setYourCall] = useState('W0ANM');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [stationCall, setStationCall] = useState<string>('');
  const [currentState, setCurrentState] = useState<string>('');
  const [yourCallEntry, setYourCallEntry] = useState('');
  const [rstReport, setRstReport] = useState('');
  const [status, setStatus] = useState('Ready for the next QSO');
  const [qsos, setQsos] = useState<QSO[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'call' | 'yourcall' | 'yourreport' | 'response' | 'summary'>('setup');
  const playbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

  const resetExchangeState = () => {
    setYourCallEntry('');
    setRstReport('');
    setCurrentState(randomState());
  };

  const startSession = async () => {
    // Load calls from the source selected on the practice page (POTA API or custom file)
    setIsLoadingCalls(true);
    setStatus('Loading callsigns...');
    const db = await loadCallDatabase();
    setIsLoadingCalls(false);

    if (db.length === 0) {
      setStatus('No callsigns available. Choose POTA or upload a custom file on the practice page, then try again.');
      return;
    }

    const nextCall = getRandomCall();
    if (!nextCall) return;

    setStationCall(nextCall.callsign);
    resetExchangeState();
    setStatus('Listening to station call...');
    setSessionStarted(true);
    setPhase('call');
    setQsos([]);
    playCurrentStationCall(nextCall.callsign);
  };

  const playCurrentStationCall = (call: string) => {
    setIsPlaying(true);
    setStatus('Sending station call...');
    setSendCooldown(true);

    const stop = playMorseAudio(call, settings, () => {
      setIsPlaying(false);
      setStatus('Type your callsign response');
      setSendCooldown(false);
    });

    playbackRef.current = stop;

    window.setTimeout(() => {
      setSendCooldown(false);
    }, 2000);
  };

  const playYourCall = () => {
    if (!yourCallEntry.trim()) {
      setStatus('Enter your callsign first');
      return;
    }

    setIsPlaying(true);
    setStatus('Sending your call...');
    setSendCooldown(true);

    const stop = playMorseAudio(yourCallEntry.toUpperCase(), settings, () => {
      setIsPlaying(false);
      setStatus('Station is sending their report...');
      setSendCooldown(false);
    });

    playbackRef.current = stop;

    window.setTimeout(() => {
      setSendCooldown(false);
    }, 2000);
  };

  const handleSubmitYourCall = () => {
    if (!yourCallEntry.trim()) {
      setStatus('Enter your callsign first');
      return;
    }
    setStatus('Ready to send your callsign');
    setPhase('yourreport');
  };

  const handlePlayResponse = () => {
    setIsPlaying(true);
    setStatus('Listening to their report...');
    setSendCooldown(true);

    // Play a simple response (could be "Roger" or similar)
    const stop = playMorseAudio('R', settings, () => {
      setIsPlaying(false);
      setStatus('Enter the signal report you heard and state');
      setSendCooldown(false);
    });

    playbackRef.current = stop;

    window.setTimeout(() => {
      setSendCooldown(false);
    }, 2000);
  };

  const handleSubmitReport = () => {
    if (!rstReport.trim()) {
      setStatus('Enter your RST report');
      return;
    }
    setPhase('response');
    setStatus('Ready to send your report and state');
  };

  const handleCompleteExchange = () => {
    if (!currentState.trim()) {
      setStatus('Enter your state/province');
      return;
    }

    const digits = rstReport.trim().replace(/[^0-9]/g, '');
    const r = digits.charAt(0) || '0';
    const s = digits.charAt(1) || '0';
    const t = digits.charAt(2) || '0';

    const qso = createQSO(
      stationCall,
      yourCallEntry.toUpperCase(),
      r,
      s,
      t,
      currentState
    );

    setQsos((current) => [...current, qso]);

    if (qso.valid) {
      setStatus(`QSO logged successfully for ${qso.state}.`);
    } else {
      setStatus(qso.error || 'Invalid QSO. Check your RST and state.');
    }

    const next = getRandomCall();

    if (qsos.length >= 9 || !next) {
      setPhase('summary');
      setSessionStarted(false);
      return;
    }

    setStationCall(next.callsign);
    resetExchangeState();
    setPhase('call');
    playCurrentStationCall(next.callsign);
  };

  const handleSettingsChange = (key: keyof MorseSettings, value: number | boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleExportCSV = () => {
    const csv = exportQSOsToCSV(qsos);
    downloadCSV(csv, 'pota-qsos.csv');
  };

  const successfulQsos = qsos.filter((qso) => qso.valid).length;

  return (
    <main className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">POTA Simulator</p>
          <h1>Activation practice exchange</h1>
        </div>
      </section>

      {phase === 'setup' && (
        <section className="panel">
          <div className="settings-grid">
            <label>
              <span>Your callsign</span>
              <input
                value={yourCall}
                onChange={(event) => setYourCall(event.target.value.toUpperCase())}
                placeholder="W0ANM"
              />
            </label>

            <label>
              <span>Speed (WPM)</span>
              <input
                type="range"
                min={5}
                max={30}
                value={settings.wpm}
                onChange={(event) => handleSettingsChange('wpm', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Frequency</span>
              <input
                type="number"
                min={400}
                max={1200}
                value={settings.frequency}
                onChange={(event) => handleSettingsChange('frequency', Number(event.target.value))}
              />
            </label>
          </div>

          <button className="primary" onClick={startSession} disabled={isLoadingCalls}>
            {isLoadingCalls ? 'Loading...' : 'Start Session'}
          </button>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>
        </section>
      )}

      {phase === 'call' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Unknown station calling</p>
              <h2>Listening...</h2>
            </div>
            <div className="button-stack">
              <button onClick={() => playCurrentStationCall(stationCall)} disabled={isPlaying || sendCooldown}>
                {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Replay Call'}
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          <div className="exchange-form">
            <label>
              <span>Enter the callsign you heard</span>
              <input
                value={yourCallEntry}
                onChange={(event) => setYourCallEntry(event.target.value.toUpperCase())}
                placeholder="Enter your callsign response"
              />
            </label>
          </div>

          <button className="primary" onClick={handleSubmitYourCall}>
            Next Step
          </button>
        </section>
      )}

      {phase === 'yourcall' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Send your callsign</p>
              <h2>{yourCallEntry}</h2>
            </div>
            <div className="button-stack">
              <button onClick={playYourCall} disabled={isPlaying || sendCooldown}>
                {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Send Call'}
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          <button className="primary" onClick={() => {
            setPhase('response');
            setStatus('Ready to listen for their report');
          }}>
            Next Step
          </button>
        </section>
      )}

      {phase === 'yourreport' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Send your callsign</p>
              <h2>{yourCallEntry}</h2>
            </div>
            <div className="button-stack">
              <button onClick={playYourCall} disabled={isPlaying || sendCooldown}>
                {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Send Call'}
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          <button className="primary" onClick={handlePlayResponse}>
            Listen for their report
          </button>
        </section>
      )}

      {phase === 'response' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Receiving report</p>
              <h2>Listening...</h2>
            </div>
            <div className="button-stack">
              <button onClick={handlePlayResponse} disabled={isPlaying || sendCooldown}>
                {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Replay Report'}
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          <div className="exchange-form">
            <label>
              <span>RST Report (e.g., 599)</span>
              <input
                value={rstReport}
                onChange={(event) => setRstReport(event.target.value.toUpperCase().slice(0, 3))}
                placeholder="599"
                maxLength={3}
              />
            </label>

            <label>
              <span>State / Province</span>
              <input
                value={currentState}
                onChange={(event) => setCurrentState(event.target.value.toUpperCase())}
                placeholder="CO"
              />
            </label>
          </div>

          <button className="primary" onClick={handleCompleteExchange}>
            Complete Exchange
          </button>
        </section>
      )}

      {phase === 'summary' && (
        <section className="panel">
          <h2>Session Summary</h2>
          <div className="summary-grid">
            <div className="summary-stat">
              <span>Total QSOs</span>
              <strong>{qsos.length}</strong>
            </div>
            <div className="summary-stat success">
              <span>Successful</span>
              <strong>{successfulQsos}</strong>
            </div>
            <div className="summary-stat warning">
              <span>Failed</span>
              <strong>{qsos.length - successfulQsos}</strong>
            </div>
          </div>

          <div className="qso-table">
            <div className="qso-header">
              <span>Station</span>
              <span>Your RST</span>
              <span>Station RST</span>
              <span>State</span>
              <span>Valid</span>
            </div>
            {qsos.map((qso, index) => (
              <div className="qso-row" key={`${qso.stationCall}-${index}`}>
                <span>{qso.stationCall}</span>
                <span>{qso.yourReadability}{qso.yourStrength}{qso.yourTone}</span>
                <span>{qso.stationReadability}{qso.stationStrength}{qso.stationTone}</span>
                <span>{qso.state}</span>
                <span>{qso.valid ? 'Yes' : 'No'}</span>
              </div>
            ))}
          </div>

          <div className="button-stack summary-actions">
            <button className="primary" onClick={handleExportCSV}>Export CSV</button>
            <button className="secondary" onClick={() => {
              setPhase('setup');
              setSessionStarted(false);
              setQsos([]);
              setStatus('Ready for the next QSO');
            }}>New Session</button>
          </div>
        </section>
      )}
    </main>
  );
}
