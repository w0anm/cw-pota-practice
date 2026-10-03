import { getPOTAActivations, type POTAActivation } from './potaApi';

export type CallRecord = {
  callsign: string;
  location: string;
  notes?: string;
  parkCode?: string;
};

export type CallSource = 'pota' | 'custom';

const SOURCE_KEY = 'cw_call_source';
const CUSTOM_CALLS_KEY = 'cw_custom_calls';

let callDatabase: CallRecord[] = [];
let isLoading = false;

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

/** Which source the practice page should use. Defaults to POTA. */
export const getSource = (): CallSource => {
  if (!hasStorage()) return 'pota';
  return window.localStorage.getItem(SOURCE_KEY) === 'custom' ? 'custom' : 'pota';
};

export const setSource = (source: CallSource): void => {
  if (!hasStorage()) return;
  window.localStorage.setItem(SOURCE_KEY, source);
};

/**
 * Parse text with one callsign per line (commas also accepted).
 */
export const parseCallsignText = (text: string): CallRecord[] => {
  const seen = new Set<string>();
  const records: CallRecord[] = [];

  text
    .split(/[\r\n,]+/)
    .map((line) => line.trim().toUpperCase())
    .forEach((callsign) => {
      if (!callsign || seen.has(callsign)) return;
      if (!/^[A-Z0-9/]{3,14}$/.test(callsign)) return;
      seen.add(callsign);
      records.push({ callsign, location: 'Custom list', notes: '' });
    });

  return records;
};

export const getCustomCalls = (): CallRecord[] => {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CALLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CallRecord[]) : [];
  } catch {
    return [];
  }
};

export const saveCustomCalls = (calls: CallRecord[]): void => {
  if (!hasStorage()) return;
  window.localStorage.setItem(CUSTOM_CALLS_KEY, JSON.stringify(calls));
};

export const clearCustomCalls = (): void => {
  if (!hasStorage()) return;
  window.localStorage.removeItem(CUSTOM_CALLS_KEY);
};

const convertPOTAToCallRecords = (activations: POTAActivation[]): CallRecord[] =>
  activations.map((a) => ({
    callsign: a.callsign,
    location: a.parkName,
    notes: a.qsoCount ? `${a.parkCode} - ${a.qsoCount} QSOs` : a.parkCode,
    parkCode: a.parkCode,
  }));

/**
 * Load the call database from the currently selected source.
 * No built-in fallback list: if the source is empty, the database is empty.
 */
export const loadCallDatabase = async (forceRefresh = false): Promise<CallRecord[]> => {
  if (isLoading) return callDatabase;
  isLoading = true;

  try {
    if (getSource() === 'custom') {
      callDatabase = getCustomCalls();
    } else {
      const activations = await getPOTAActivations(forceRefresh);
      callDatabase = convertPOTAToCallRecords(activations);
    }
  } catch (error) {
    console.error('Failed to load call database:', error);
    callDatabase = [];
  } finally {
    isLoading = false;
  }

  return callDatabase;
};

export const getCallDatabase = (): CallRecord[] => callDatabase;
