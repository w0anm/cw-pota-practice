import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Live activator spots (callsign, park reference, park name, mode, frequency)
const POTA_SPOTS_URL = 'https://api.pota.app/spot/activator';

export async function GET() {
  try {
    const response = await fetch(POTA_SPOTS_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `POTA upstream request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }

    // Prefer CW spots since this is a CW practice app; fall back to all spots.
    const cw = data.filter((s: any) => String(s.mode ?? '').toUpperCase() === 'CW');
    return NextResponse.json(cw.length > 0 ? cw : data);
  } catch (error) {
    console.error('Failed to proxy POTA API:', error);
    return NextResponse.json({ error: 'Failed to fetch POTA data' }, { status: 500 });
  }
}
