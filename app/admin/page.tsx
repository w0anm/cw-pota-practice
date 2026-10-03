'use client';

import { useEffect, useState } from 'react';
import {
  getCustomCalls,
  saveCustomCalls,
  clearCustomCalls,
  parseCallsignText,
  setSource,
  type CallRecord,
} from '@/lib/callDatabase';
import '../admin.css';

export default function AdminPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [newCall, setNewCall] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCalls(getCustomCalls());
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCallsignText(String(e.target?.result ?? ''));
      setCalls(parsed);
      setMessage(`Loaded ${parsed.length} calls. Click "Save & use for practice".`);
    };
    reader.readAsText(file);
  };

  const handleAdd = () => {
    const parsed = parseCallsignText(newCall);
    if (parsed.length === 0) {
      setMessage('Enter a valid callsign');
      return;
    }
    const existing = new Set(calls.map((c) => c.callsign));
    setCalls([...calls, ...parsed.filter((p) => !existing.has(p.callsign))]);
    setNewCall('');
  };

  const handleDelete = (index: number) => setCalls(calls.filter((_, i) => i !== index));

  const handleSave = () => {
    if (calls.length === 0) {
      setMessage('No calls to save');
      return;
    }
    saveCustomCalls(calls);
    setSource('custom');
    setMessage(`Saved ${calls.length} calls. Practice page is now using your custom list.`);
  };

  const handleClear = () => {
    clearCustomCalls();
    setSource('pota');
    setCalls([]);
    setMessage('Custom list cleared. Practice page is back to the POTA API.');
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel hero">
        <h1>Custom Call List</h1>
        <p>Upload a text file with one callsign per line.</p>
      </section>

      <section className="admin-panel">
        <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="file-input" />
        <div className="form-grid">
          <input
            type="text"
            placeholder="Add callsign (e.g., K1ABC)"
            value={newCall}
            onChange={(e) => setNewCall(e.target.value.toUpperCase())}
            className="form-input"
          />
          <button onClick={handleAdd} className="btn-primary">Add</button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="admin-panel">
        <div className="section-header">
          <h2>Calls ({calls.length})</h2>
          <div className="button-group">
            <button onClick={handleClear} className="btn-secondary">Clear &amp; use POTA</button>
            <button onClick={handleSave} className="btn-success">Save &amp; use for practice</button>
          </div>
        </div>
        <div className="calls-table">
          {calls.map((call, idx) => (
            <div key={call.callsign} className="table-row">
              <div className="col-call">{call.callsign}</div>
              <div className="col-actions">
                <button onClick={() => handleDelete(idx)} className="btn-small btn-danger">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
