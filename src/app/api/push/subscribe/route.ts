import { NextRequest, NextResponse } from 'next/server';
import { registerPushSubscriber, PushSubscriber } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { isbn, bookTitle, subscription } = body;

    if (!isbn || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: '필수 정보(ISBN, Subscription)가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const newSub: PushSubscriber = {
      isbn,
      bookTitle: bookTitle || '신청 도서',
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      createdAt: new Date().toISOString(),
    };

    const success = await registerPushSubscriber(newSub);

    return NextResponse.json({
      success,
      message: `'${newSub.bookTitle}' 반납 알림 신청이 완료되었습니다. 도서가 반납되는 즉시 무료 푸시 알림을 보내드립니다.`,
    });
  } catch (err: any) {
    console.error('[API /push/subscribe] Error:', err);
    return NextResponse.json({ error: '알림 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
