/**
 * POTA API integration for fetching real activator callsigns
 * Caches results locally with 24-hour expiration
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

const POTA_API_BASE = 'https://api.pota.app/v1';
const CACHE_KEY = 'pota_activations_cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculate date string for 30 days ago in ISO format
 */
const getThirtyDaysAgoDate = (): string => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return thirtyDaysAgo.toISOString().split('T')[0];
};

/**
 * Fetch activations from POTA API for the last 30 days
 */
const fetchActivationsFromPOTA = async (): Promise<POTAActivation[]> => {
  try {
    const fromDate = getThirtyDaysAgoDate();
    const response = await fetch(
      `${POTA_API_BASE}/activations?activatedFrom=${fromDate}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!response.ok) {
      console.error(`POTA API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // Extract unique callsigns with their park information
    const activationMap = new Map<string, POTAActivation>();

    if (Array.isArray(data)) {
      data.forEach((activation: any) => {
        const callsign = activation.callsign?.toUpperCase();
        const parkCode = activation.parkCode || 'UNKNOWN';
        const parkName = activation.parkName || 'Unknown Park';

        if (callsign && !activationMap.has(callsign)) {
          activationMap.set(callsign, {
            callsign,
            parkCode,
            parkName,
            date: activation.activatedDate || new Date().toISOString(),
            qsoCount: activation.qsoCount || 0,
          });
        }
      });
    }

    return Array.from(activationMap.values());
  } catch (error) {
    console.error('Failed to fetch POTA activations:', error);
    return [];
  }
};

/**
 * Get cached activations if they're still fresh
 */
const getCachedActivations = (): POTAActivation[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { activations, timestamp }: CachedPOTAData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - timestamp < CACHE_DURATION_MS) {
      return activations;
    }

    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Failed to read cache:', error);
    return null;
  }
};

/**
 * Cache activations locally
 */
const setCachedActivations = (activations: POTAActivation[]): void => {
  try {
    const data: CachedPOTAData = {
      activations,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to cache activations:', error);
  }
};

/**
 * Fetch POTA activations, using cache if available and fresh
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns Array of activations with callsign and park info
 */
export const getPOTAActivations = async (
  forceRefresh = false
): Promise<POTAActivation[]> => {
  // Check cache first if not forcing refresh
  if (!forceRefresh) {
    const cached = getCachedActivations();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // Fetch fresh data from API
  const activations = await fetchActivationsFromPOTA();

  // Cache the results if we got any
  if (activations.length > 0) {
    setCachedActivations(activations);
  }

  return activations;
};

/**
 * Clear the cached activations
 */
export const clearPOTACache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

/**
 * Get cache info for display
 */
export const getCacheInfo = (): { isCached: boolean; age: number } | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { timestamp }: CachedPOTAData = JSON.parse(cached);
    const age = Date.now() - timestamp;

    return {
      isCached: true,
      age,
    };
  } catch (error) {
    return null;
  }
};
