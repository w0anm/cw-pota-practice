'use client';

import { useState } from 'react';
import { callDatabase } from '@/lib/callDatabase';
import '../admin.css';

export default function AdminPage() {
  const [calls, setCalls] = useState(callDatabase);
  const [newCall, setNewCall] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [message, setMessage] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      const parsedCalls = lines.map((line) => {
        const callsign = line.trim().toUpperCase();
        return {
          callsign,
          location: 'Unknown',
          notes: '',
        };
      });

      setCalls(parsedCalls);
      setMessage(`✓ Loaded ${parsedCalls.length} calls from file`);
    };

    reader.readAsText(uploadedFile);
  };

  const handleAddCall = () => {
    if (!newCall.trim()) {
      setMessage('⚠ Enter a callsign');
      return;
    }

    const callRecord = {
      callsign: newCall.toUpperCase().trim(),
      location: newLocation || 'Unknown',
      notes: newNotes || '',
    };

    if (editingIndex !== null) {
      const updated = [...calls];
      updated[editingIndex] = callRecord;
      setCalls(updated);
      setEditingIndex(null);
      setMessage(`✓ Updated ${callRecord.callsign}`);
    } else {
      setCalls([...calls, callRecord]);
      setMessage(`✓ Added ${callRecord.callsign}`);
    }

    setNewCall('');
    setNewLocation('');
    setNewNotes('');
  };

  const handleEdit = (index: number) => {
    const call = calls[index];
    setNewCall(call.callsign);
    setNewLocation(call.location);
    setNewNotes(call.notes);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    const deleted = calls[index].callsign;
    setCalls(calls.filter((_, i) => i !== index));
    setMessage(`✓ Deleted ${deleted}`);
  };

  const handleExport = () => {
    const text = calls.map((c) => c.callsign).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calls.txt';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('✓ Exported calls');
  };

  const handleSave = () => {
    const jsCode = `export type CallRecord = {
  callsign: string;
  location: string;
  notes?: string;
};

export const callDatabase: CallRecord[] = [
${calls.map((c) => `  { callsign: '${c.callsign}', location: '${c.location}', notes: '${c.notes}' }`).join(',\n')}
];
`;

    const blob = new Blob([jsCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'callDatabase.ts';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('✓ Downloaded callDatabase.ts - Replace lib/callDatabase.ts with this file');
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel hero">
        <h1>Call Database Admin</h1>
        <p>Manage the POTA call practice database</p>
      </section>

      <section className="admin-panel">
        <h2>Import Calls</h2>
        <div className="upload-area">
          <input
            type="file"
            accept=".txt,.csv"
            onChange={handleFileUpload}
            className="file-input"
          />
          <p className="help-text">
            Upload a .txt or .csv file with one callsign per line<br />
            Example: K1ABC, N7RDX, W3POTA, K9SUN
          </p>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Add/Edit Call</h2>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Callsign (e.g., K1ABC)"
            value={newCall}
            onChange={(e) => setNewCall(e.target.value.toUpperCase())}
            className="form-input"
          />
          <input
            type="text"
            placeholder="Location (optional)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="form-input"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className="form-input"
          />
          <button onClick={handleAddCall} className="btn-primary">
            {editingIndex !== null ? 'Update Call' : 'Add Call'}
          </button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="admin-panel">
        <div className="section-header">
          <h2>Calls ({calls.length})</h2>
          <div className="button-group">
            <button onClick={handleExport} className="btn-secondary">
              Export to Text
            </button>
            <button onClick={handleSave} className="btn-success">
              Download callDatabase.ts
            </button>
          </div>
        </div>

        <div className="calls-table">
          <div className="table-header">
            <div className="col-call">Callsign</div>
            <div className="col-location">Location</div>
            <div className="col-notes">Notes</div>
            <div className="col-actions">Actions</div>
          </div>
          {calls.map((call, idx) => (
            <div key={idx} className="table-row">
              <div className="col-call">{call.callsign}</div>
              <div className="col-location">{call.location}</div>
              <div className="col-notes">{call.notes}</div>
              <div className="col-actions">
                <button onClick={() => handleEdit(idx)} className="btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(idx)} className="btn-small btn-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel help">
        <h3>How to use:</h3>
        <ol>
          <li>Upload a text file with one callsign per line</li>
          <li>Or add calls manually one at a time</li>
          <li>Click "Download callDatabase.ts" when done</li>
          <li>Replace <code>lib/callDatabase.ts</code> in your project with the downloaded file</li>
          <li>Reload the app to see the new calls</li>
        </ol>
      </section>
    </main>
  );
}
