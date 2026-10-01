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

function generateRandomRST(): string {
  const readability = Math.floor(Math.random() * 5) + 1; // 1-5
  const strength = Math.floor(Math.random() * 9) + 1;    // 1-9
  const tone = Math.floor(Math.random() * 9) + 1;        // 1-9
  return `${readability}${strength}${tone}`;
}

function isValidRST(readability: string, strength: string, tone: string): boolean {
  const r = parseInt(readability, 10);
  const s = parseInt(strength, 10);
  const t = parseInt(tone, 10);
  
  return (
    !isNaN(r) && r >= 1 && r <= 5 &&
    !isNaN(s) && s >= 1 && s <= 9 &&
    !isNaN(t) && t >= 1 && t <= 9
  );
}

function isValidState(state: string): boolean {
  return VALID_STATES.includes(state.toUpperCase());
}

export function createQSO(
  stationCall: string,
  yourCall: string,
  yourReadability: string,
  yourStrength: string,
  yourTone: string,
  state: string
): QSO {
  const valid = 
    isValidRST(yourReadability, yourStrength, yourTone) &&
    isValidState(state);

  let error: string | undefined;
  if (!isValidRST(yourReadability, yourStrength, yourTone)) {
    error = 'Invalid RST format (R:1-5, S:1-9, T:1-9)';
  } else if (!isValidState(state)) {
    error = `Invalid state/province: ${state}`;
  }

  const stationRST = generateRandomRST();

  return {
    timestamp: new Date(),
    stationCall,
    yourCall: yourCall.toUpperCase(),
    yourReadability,
    yourStrength,
    yourTone,
    stationReadability: stationRST[0],
    stationStrength: stationRST[1],
    stationTone: stationRST[2],
    state: state.toUpperCase(),
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
