'use client';

import { useEffect, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import { callDatabase, type CallRecord } from '@/lib/callDatabase';
import { createQSO, downloadCSV, exportQSOsToCSV, type QSO } from '@/lib/simulator';
import '../simulator.css';

const initialSettings: MorseSettings = {
  wpm: 18,
  farnsworth: true,
  frequency: 700,
};

function getRandomCall(): CallRecord {
  return callDatabase[Math.floor(Math.random() * callDatabase.length)];
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
  const [rstReport, setRstReport] = useState('');
  const [status, setStatus] = useState('Ready for the next QSO');
  const [qsos, setQsos] = useState<QSO[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'call' | 'report' | 'summary'>('setup');
  const playbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

  const resetExchangeState = () => {
    setRstReport('');
    setCurrentState(randomState());
  };

  const startSession = () => {
    const nextCall = getRandomCall();
    setStationCall(nextCall.callsign);
    resetExchangeState();
    setStatus('Unknown station calling...');
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
      setStatus('Listen for the response');
      setSendCooldown(false);
    });

    playbackRef.current = stop;

    window.setTimeout(() => {
      setSendCooldown(false);
    }, 2000);
  };

  const handleSubmitExchange = () => {
    if (!stationCall) return;

    if (phase === 'call') {
      setStatus('Ready for your report and state');
      setPhase('report');
      setRstReport('');
      return;
    }

    if (phase === 'report') {
      const digits = rstReport.trim().replace(/[^0-9]/g, '');
      const r = digits.charAt(0) || '0';
      const s = digits.charAt(1) || '0';
      const t = digits.charAt(2) || '0';

      const qso = createQSO(
        stationCall,
        yourCall,
        r,
        s,
        t,
        currentState
      );

      setQsos((current) => [...current, qso]);

      if (qso.valid) {
        setStatus(`QSO logged successfully for ${qso.state}. Next station ready.`);
      } else {
        setStatus(qso.error || 'Invalid QSO. Check your RST and state and try again.');
      }

      if (qsos.length >= 9) {
        setPhase('summary');
        setSessionStarted(false);
        return;
      }

      const next = getRandomCall();
      setStationCall(next.callsign);
      resetExchangeState();
      setPhase('call');
      playCurrentStationCall(next.callsign);
    }
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

          <button className="primary" onClick={startSession}>Start Session</button>
        </section>
      )}

      {phase !== 'setup' && phase !== 'summary' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Unknown station</p>
              <h2>Unknown station</h2>
            </div>
            <div className="button-stack">
              <button onClick={() => playCurrentStationCall(stationCall)} disabled={isPlaying || sendCooldown}>
                {isPlaying ? 'Sending...' : sendCooldown ? 'Wait 2s...' : 'Send Call'}
              </button>
            </div>
          </div>

          <div className="status-row">
            <strong>Status:</strong> {status}
          </div>

          {phase === 'report' && (
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
          )}

          <button className="primary" onClick={handleSubmitExchange}>
            {phase === 'call' ? 'Reply' : 'Submit Exchange'}
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
