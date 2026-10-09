import { CallRecord } from './callDatabase';

export type QSO = {
  timestamp: Date;
  stationCall: string;
  yourCall: string;
  yourReadability: string;
  yourStrength: string;
  yourTone: string;
  stationReadability: string;
  stationStrength: string;
  stationTone: string;
  state: string;
  valid: boolean;
  error?: string;
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const CANADIAN_PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
];

const VALID_STATES = [...US_STATES, ...CANADIAN_PROVINCES];

export function generateRandomRST(): string {
  const readability = Math.floor(Math.random() * 5) + 1; // 1-5
  const strength = Math.floor(Math.random() * 9) + 1;    // 1-9
  const tone = Math.floor(Math.random() * 9) + 1;        // 1-9
  return `${readability}${strength}${tone}`;
}

export function randomState(): string {
  return VALID_STATES[Math.floor(Math.random() * VALID_STATES.length)];
}

// Cut number: 9 is sent as N (599 -> 5NN)
export function toCutRST(rst: string): string {
  return rst.replace(/9/g, 'N');
}

// Makes "5NN" and "599" compare equal
export function normalizeRST(rst: string): string {
  return rst.toUpperCase().replace(/[^0-9N]/g, '').replace(/N/g, '9');
}

export function formatReport(rst: string, state: string): string {
  return `${toCutRST(rst)} ${state.toUpperCase()}`;
}

// Validates what the user entered against the report that was actually sent
export function createQSO(
  stationCall: string,
  yourCall: string,
  enteredRST: string,
  enteredState: string,
  sentRST: string,
  sentState: string
): QSO {
  const normalizedEntered = normalizeRST(enteredRST);
  const rstOk = normalizedEntered === normalizeRST(sentRST);
  const stateOk = enteredState.trim().toUpperCase() === sentState.toUpperCase();
  const valid = rstOk && stateOk;

  let error: string | undefined;
  if (!rstOk) {
    error = `RST incorrect (sent ${toCutRST(sentRST)})`;
  } else if (!stateOk) {
    error = `State incorrect (sent ${sentState.toUpperCase()})`;
  }

  return {
    timestamp: new Date(),
    stationCall,
    yourCall: yourCall.toUpperCase(),
    yourReadability: normalizedEntered.charAt(0),
    yourStrength: normalizedEntered.charAt(1),
    yourTone: normalizedEntered.charAt(2),
    stationReadability: sentRST[0],
    stationStrength: sentRST[1],
    stationTone: sentRST[2],
    state: enteredState.trim().toUpperCase(),
    valid,
    error,
  };
}

export function exportQSOsToCSV(qsos: QSO[]): string {
  const headers = 'Timestamp,Station Call,Your Call,Your RST,Station RST,State,Valid\n';
  
  const rows = qsos.map((qso) => {
    const timestamp = qso.timestamp.toISOString().replace('T', ' ').substring(0, 19);
    const yourRST = `${qso.yourReadability}${qso.yourStrength}${qso.yourTone}`;
    const stationRST = `${qso.stationReadability}${qso.stationStrength}${qso.stationTone}`;
    const valid = qso.valid ? 'Yes' : 'No';
    
    return `${timestamp},${qso.stationCall},${qso.yourCall},${yourRST},${stationRST},${qso.state},${valid}`;
  });

  return headers + rows.join('\n');
}

export function downloadCSV(csv: string, filename: string = 'pota-qsos.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
