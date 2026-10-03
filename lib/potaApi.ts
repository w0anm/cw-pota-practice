/**
 * POTA API integration (via server-side proxy to avoid CORS).
 * Caches results in localStorage for a short time.
 */

export type POTAActivation = {
  callsign: string;
  parkCode: string;
  parkName: string;
  date: string;
  qsoCount: number;
};

export type CachedPOTAData = {
  activations: POTAActivation[];
  timestamp: number;
};

const CACHE_KEY = 'pota_activations_cache';
const CACHE_DURATION_MS = 15 * 60 * 1000; // spots are live data, keep cache short

const fetchActivationsFromPOTA = async (): Promise<POTAActivation[]> => {
  try {
    const response = await fetch('/api/pota', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`POTA proxy error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error('POTA response is not an array:', data);
      return [];
    }

    const map = new Map<string, POTAActivation>();
    for (const item of data) {
      const callsign = String(item.activator ?? '').toUpperCase().trim();
      if (!callsign || map.has(callsign)) continue;
      map.set(callsign, {
        callsign,
        parkCode: item.reference || 'UNKNOWN',
        parkName: item.name || item.parkName || 'Unknown Park',
        date: item.spotTime || new Date().toISOString(),
        qsoCount: 0,
      });
    }

    const result = Array.from(map.values());
    console.log(`POTA: ${data.length} spots -> ${result.length} unique activators`);
    return result;
  } catch (error) {
    console.error('Failed to fetch POTA activations:', error);
    return [];
  }
};

const getCachedActivations = (): POTAActivation[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { activations, timestamp }: CachedPOTAData = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS && activations.length > 0) {
      return activations;
    }
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
};

const setCachedActivations = (activations: POTAActivation[]): void => {
  try {
    const data: CachedPOTAData = { activations, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to cache activations:', error);
  }
};

export const getPOTAActivations = async (forceRefresh = false): Promise<POTAActivation[]> => {
  if (!forceRefresh) {
    const cached = getCachedActivations();
    if (cached) return cached;
  }

  const activations = await fetchActivationsFromPOTA();
  if (activations.length > 0) setCachedActivations(activations);
  return activations;
};

export const clearPOTACache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};
