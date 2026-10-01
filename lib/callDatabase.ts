import { getPOTAActivations, type POTAActivation } from './potaApi';

export type CallRecord = {
  callsign: string;
  location: string;
  notes?: string;
  parkCode?: string;
};

// Fallback training set used when POTA API is unavailable
const TRAINING_CALLSIGNS: CallRecord[] = [
  { callsign: 'K1ABC', location: 'New England', notes: 'POTA friendly training set' },
  { callsign: 'N7RDX', location: 'Oregon', notes: 'Mountain activation' },
  { callsign: 'W3POTA', location: 'Pennsylvania', notes: 'Classic parks contact' },
  { callsign: 'K9SUN', location: 'Illinois', notes: 'Field station' },
  { callsign: 'N4BAY', location: 'Florida', notes: 'Coastal call' },
  { callsign: 'WA7JIM', location: 'Arizona', notes: 'Desert activation' },
  { callsign: 'K0LARK', location: 'Colorado', notes: 'Mountain state' },
  { callsign: 'N8PARK', location: 'Ohio', notes: 'Park operations' },
  { callsign: 'W6COVE', location: 'California', notes: 'West coast practice' },
  { callsign: 'K2MOSS', location: 'New York', notes: 'Forest activation' },
  { callsign: 'N5RIVER', location: 'Texas', notes: 'Wide-open field' },
  { callsign: 'K7CREEK', location: 'Washington', notes: 'Northwest practice' }
];

let callDatabase: CallRecord[] = TRAINING_CALLSIGNS;
let isLoadingFromPOTA = false;

/**
 * Convert POTA activations to CallRecord format
 */
const convertPOTAToCallRecords = (activations: POTAActivation[]): CallRecord[] => {
  return activations.map((activation) => ({
    callsign: activation.callsign,
    location: activation.parkName,
    notes: `${activation.parkCode} - ${activation.qsoCount} QSOs`,
    parkCode: activation.parkCode,
  }));
};

/**
 * Load POTA activations and populate the call database
 * Falls back to training set if POTA API fails
 * @param forceRefresh - Force refresh even if cached
 */
export const loadPOTACallDatabase = async (forceRefresh = false): Promise<void> => {
  if (isLoadingFromPOTA) return;

  isLoadingFromPOTA = true;

  try {
    const activations = await getPOTAActivations(forceRefresh);

    if (activations.length > 0) {
      callDatabase = convertPOTAToCallRecords(activations);
    } else {
      // Fallback to training set if no POTA data available
      callDatabase = TRAINING_CALLSIGNS;
    }
  } catch (error) {
    console.error('Failed to load POTA data, falling back to training set:', error);
    callDatabase = TRAINING_CALLSIGNS;
  } finally {
    isLoadingFromPOTA = false;
  }
};

/**
 * Get the current call database
 * Returns POTA activations if loaded, otherwise training set
 */
export const getCallDatabase = (): CallRecord[] => {
  return callDatabase;
};

/**
 * Export for use in components
 * This is the primary export used by the app
 */
export { callDatabase };
