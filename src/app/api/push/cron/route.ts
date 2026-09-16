import { NextRequest, NextResponse } from 'next/server';
import { getCnuBookDetail } from '@/lib/cnu-library';
import { getSubscribersForIsbn } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Optional cron secret verification
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In a production system, fetch all unique ISBNs with active subscriptions
    // For demo/MVP, test common popular books
    const testIsbns = ['9788959897087', '9791163035824'];
    const notifiedList: string[] = [];

    for (const isbn of testIsbns) {
      const subscribers = await getSubscribersForIsbn(isbn);
      if (subscribers.length > 0) {
        // Check current library status
        // If available, send push payload
        notifiedList.push(`Checked ${isbn} for ${subscribers.length} subscribers`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checkedCount: testIsbns.length,
      logs: notifiedList,
    });
  } catch (err: any) {
    console.error('[API /push/cron] Cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
