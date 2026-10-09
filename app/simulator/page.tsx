'use client';

import { useEffect, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import { loadCallDatabase, getCallDatabase, type CallRecord } from '@/lib/callDatabase';
import { createQSO, downloadCSV, exportQSOsToCSV, formatReport, generateRandomRST, randomState, type QSO } from '@/lib/simulator';
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

const MAX_ATTEMPTS = 3;

export default function SimulatorPage() {
  const [settings, setSettings] = useState<MorseSettings>(initialSettings);
  const [yourCall, setYourCall] = useState('W0ANM');
  const [stationCall, setStationCall] = useState<string>('');
  const [stationRST, setStationRST] = useState<string>('');
  const [stationState, setStationState] = useState<string>('');
  const [stateEntry, setStateEntry] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [yourCallEntry, setYourCallEntry] = useState('');
  const [rstReport, setRstReport] = useState('');
  const [status, setStatus] = useState('Ready for the next QSO');
  const [qsos, setQsos] = useState<QSO[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'call' | 'exchange' | 'summary'>('setup');
  const playbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

  const chooseStation = (call: string) => {
    setStationCall(call);
    setStationRST(generateRandomRST());
    setStationState(randomState());
    setYourCallEntry('');
    setRstReport('');
    setStateEntry('');
    setAttempts(0);
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

    chooseStation(nextCall.callsign);
    setStatus('Listening to station call...');
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
      setStatus('Type the callsign you heard');
      setSendCooldown(false);
    });

    playbackRef.current = stop;

    window.setTimeout(() => {
      setSendCooldown(false);
    }, 2000);
  };

  const playReport = () => {
    setIsPlaying(true);
    setStatus('Listening to their report...');

    const stop = playMorseAudio(formatReport(stationRST, stationState), settings, () => {
      setIsPlaying(false);
      setStatus('Enter the RST and state you heard');
    });

    playbackRef.current = stop;
  };

  const sendYourCall = () => {
    const call = yourCall.trim().toUpperCase();
    if (!call) {
      setStatus('Set your callsign on the setup screen first');
      return;
    }

    setIsPlaying(true);
    setStatus('Sending your call...');

    const stop = playMorseAudio(call, settings, () => {
      window.setTimeout(playReport, 500);
    });

    playbackRef.current = stop;
  };

  const handleSubmitYourCall = () => {
    if (!yourCallEntry.trim()) {
      setStatus('Enter the callsign you heard first');
      return;
    }
    setStatus('Send your callsign to the station');
    setPhase('exchange');
  };

  const handleCompleteExchange = () => {
    if (!rstReport.trim() || !stateEntry.trim()) {
      setStatus('Enter both the RST and the state');
      return;
    }

    const qso = createQSO(stationCall, yourCall, stationRST, stationState, rstReport, stateEntry);
    const attemptCount = attempts + 1;

    if (!qso.valid && attemptCount < MAX_ATTEMPTS) {
      setAttempts(attemptCount);
      setStatus(`${qso.error}. Replay the report and try again.`);
      return;
    }

    setQsos((current) => [...current, qso]);
    setStatus(qso.valid ? `QSO logged successfully for ${qso.state}.` : `Missed: ${formatReport(stationRST, stationState)}`);

    const next = getRandomCall();

    if (qsos.length >= 9 || !next) {
      setPhase('summary');
      return;
    }

    chooseStation(next.callsign);
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

      {phase === 'exchange' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Exchange</p>
              <h2>{yourCall}</h2>
            </div>
            <div className="button-stack">
              <button onClick={sendYourCall} disabled={isPlaying}>
                {isPlaying ? 'Sending...' : 'Send Call'}
              </button>
              <button onClick={playReport} disabled={isPlaying}>
                Replay Report
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          <div className="exchange-form">
            <label>
              <span>RST Report (e.g., 5NN)</span>
              <input
                value={rstReport}
                onChange={(event) => setRstReport(event.target.value.toUpperCase().slice(0, 3))}
                placeholder="5NN"
                maxLength={3}
              />
            </label>

            <label>
              <span>State / Province</span>
              <input
                value={stateEntry}
                onChange={(event) => setStateEntry(event.target.value.toUpperCase())}
                placeholder="State"
              />
            </label>
          </div>

          <button className="primary" onClick={handleCompleteExchange}>
            Complete QSO
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
              setQsos([]);
              setStatus('Ready for the next QSO');
            }}>New Session</button>
          </div>
        </section>
      )}
    </main>
  );
}
