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
 * Uses the /activations endpoint which returns completed activations
 */
const fetchActivationsFromPOTA = async (): Promise<POTAActivation[]> => {
  try {
    const fromDate = getThirtyDaysAgoDate();
    // Use the summaries endpoint which returns actual completed activations
    const url = `${POTA_API_BASE}/activations/summaries?activatedFrom=${fromDate}`;
    
    console.log('Fetching POTA activations from:', url);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`POTA API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log('POTA API raw response:', data);

    // Extract unique callsigns with their park information
    const activationMap = new Map<string, POTAActivation>();

    if (Array.isArray(data)) {
      console.log(`Processing ${data.length} activations from POTA API`);
      
      data.forEach((activation: any) => {
        // The API returns 'activator' field for callsign in summaries endpoint
        const callsign = activation.activator?.toUpperCase();
        // Park code is under 'reference'
        const parkCode = activation.reference || 'UNKNOWN';
        // Park name is under 'name'
        const parkName = activation.name || 'Unknown Park';
        // QSO count from the summaries
        const qsoCount = activation.qsoCount || activation.qualifyingCount || 0;
        // Activity date
        const date = activation.activationDate || activation.startDate || new Date().toISOString();

        if (callsign && !activationMap.has(callsign)) {
          activationMap.set(callsign, {
            callsign,
            parkCode,
            parkName,
            date,
            qsoCount,
          });
          console.log(`Added: ${callsign} from ${parkCode} (${parkName}) - ${qsoCount} QSOs`);
        }
      });
    } else {
      console.error('POTA API response is not an array:', data);
    }

    const result = Array.from(activationMap.values());
    console.log(`Successfully processed ${result.length} unique activations`);
    return result;
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
    if (!cached) {
      console.log('No cached POTA data found');
      return null;
    }

    const { activations, timestamp }: CachedPOTAData = JSON.parse(cached);
    const now = Date.now();
    const age = now - timestamp;

    // Check if cache is still valid
    if (age < CACHE_DURATION_MS) {
      console.log(`Using cached POTA data (${Math.round(age / 1000 / 60)} minutes old, ${activations.length} activations)`);
      return activations;
    }

    // Cache expired, remove it
    console.log('POTA cache expired, removing');
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
    console.log(`Cached ${activations.length} POTA activations`);
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
  console.log(`getPOTAActivations called (forceRefresh: ${forceRefresh})`);
  
  // Check cache first if not forcing refresh
  if (!forceRefresh) {
    const cached = getCachedActivations();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // Fetch fresh data from API
  console.log('Fetching fresh data from POTA API');
  const activations = await fetchActivationsFromPOTA();

  // Cache the results if we got any
  if (activations.length > 0) {
    setCachedActivations(activations);
  } else {
    console.warn('No activations returned from POTA API');
  }

  return activations;
};

/**
 * Clear the cached activations
 */
export const clearPOTACache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('Cleared POTA cache');
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
