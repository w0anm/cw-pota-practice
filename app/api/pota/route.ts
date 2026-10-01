import { NextResponse } from 'next/server';

const POTA_API_BASE = 'https://api.pota.app/v1';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate =
    searchParams.get('activatedFrom') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const upstreamUrl = `${POTA_API_BASE}/activations/summaries?activatedFrom=${encodeURIComponent(fromDate)}`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `POTA upstream request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to proxy POTA API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POTA data' },
      { status: 500 }
    );
  }
}
