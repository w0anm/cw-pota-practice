'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { playMorseAudio, type MorseSettings } from '@/lib/cw';
import { callDatabase, type CallRecord } from '@/lib/callDatabase';
import { createQSO, downloadCSV, exportQSOsToCSV, type QSO } from '@/lib/simulator';

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
    'CA', 'CO', 'WA', 'TX', 'NY', 'FL', 'AZ', 'OR', 'PA', 'NC', 'TN', 'OH', 'WA', 'MI', 'MN', 'UT', 'NM', 'ID', 'GA', 'AL'
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
  const [sessionComplete, setSessionComplete] = useState(false);
  const playbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (playbackRef.current) playbackRef.current();
    };
  }, []);

  const startSession = () => {
    const nextCall = getRandomCall();
    setStationCall(nextCall.callsign);
    setCurrentState(randomState());
    setRstReport('');
    setStatus('Station is calling...');
    setSessionStarted(true);
    setSessionComplete(false);
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
      setStatus('Send your RST and state');
      setPhase('report');
      setRstReport('');
      return;
    }

    if (phase === 'report') {
      // Parse RST from combined string (e.g., "599" -> R=5, S=9, T=9)
      const r = rstReport.charAt(0);
      const s = rstReport.charAt(1);
      const t = rstReport.charAt(2);

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
        setStatus(`QSO logged: ${qso.stationCall} - ${qso.state}`);
      } else {
        setStatus(qso.error || 'QSO failed. Check your report and state.');
      }

      if (qsos.length >= 9) {
        setSessionComplete(true);
        setPhase('summary');
      } else {
        const next = getRandomCall();
        setStationCall(next.callsign);
        setCurrentState(randomState());
        setRstReport('');
        setPhase('call');
      }
    }
  };

  const handleSettingsChange = (key: keyof MorseSettings, value: number | boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleExportCSV = () => {
    const csv = exportQSOsToCSV(qsos);
    downloadCSV(csv, 'pota-qsos.csv');
  };

  return (
    <main className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">POTA Simulator</p>
          <h1>Activation practice exchange</h1>
        </div>
      </section>

      {!sessionStarted && phase === 'setup' && (
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

      {sessionStarted && phase !== 'summary' && (
        <section className="panel practice-panel">
          <div className="call-header">
            <div>
              <p className="eyebrow">Unknown station</p>
              <h2>---</h2>
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
                  onChange={(event) => setRstReport(event.target.value)}
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
          <p>Total QSOs: {qsos.length}</p>
          <p>Successful QSOs: {qsos.filter((qso) => qso.valid).length}</p>
          <p>Failed QSOs: {qsos.filter((qso) => !qso.valid).length}</p>

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
            }}>New Session</button>
          </div>
        </section>
      )}
    </main>
  );
}
