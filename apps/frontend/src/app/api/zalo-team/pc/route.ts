import { NextResponse } from 'next/server';

// Retired PC entrypoint. Keep old bookmarks from starting Windows Zalo again.
export async function POST() {
  return NextResponse.json({ error: 'PC_PROVIDER_RETIRED' }, { status: 410 });
}
