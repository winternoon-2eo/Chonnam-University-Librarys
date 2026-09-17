import { NextRequest, NextResponse } from 'next/server';
import { getRecentSearchLogs } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const logs = await getRecentSearchLogs(limit);
    return NextResponse.json({
      total: logs.length,
      logs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve search logs', details: err?.message },
      { status: 500 }
    );
  }
}
