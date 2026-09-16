'use client';

import React, { useState } from 'react';
import { CuratedBookItem } from '@/lib/ai-curator';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, X, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

interface PushModalProps {
  book: CuratedBookItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PushModal({ book, isOpen, onClose }: PushModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !book) return null;

  const handleSubscribe = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      if (!('Notification' in window)) {
        setStatus('error');
        setErrorMessage('사용 중이신 브라우저가 웹 푸시 알림을 지원하지 않습니다.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        setErrorMessage('브라우저 알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        return;
      }

      // Check Service Worker registration
      let registration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      }

      // Prepare subscription payload
      const mockSub = {
        endpoint: `https://fcm.googleapis.com/fcm/send/vibelib-${Date.now()}`,
        keys: {
          p256dh: 'BNcRdreALRF87k5F4qR0...mockKey',
          auth: 'tBshsd76...',
        },
      };

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isbn: book.isbn,
          bookTitle: book.title,
          subscription: mockSub,
        }),
      });

      if (res.ok) {
        setStatus('success');
      } else {
        const data = await res.json();
        throw new Error(data.error || '등록 실패');
      }
    } catch (err: any) {
      console.error('Push error:', err);
      setStatus('error');
      setErrorMessage(err.message || '알림 등록 중 문제가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {status === 'success' ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">
              반납 알림 신청 완료!
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              <strong>[{book.title}]</strong> 도서가 도서관에 반납되어 대출 가능해지는 즉시 브라우저로 무료 푸시 알림을 보내드립니다.
            </p>
            <div className="mt-6">
              <Button onClick={handleClose} className="w-full bg-emerald-700 font-semibold text-white hover:bg-emerald-800">
                확인
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
              <Bell className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                스마트 반납 알림
              </span>
            </div>

            <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">
              이 책이 반납되면 바로 알려드릴까요?
            </h3>

            <div className="mt-3 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs text-foreground">
              <p className="font-bold line-clamp-1">{book.title}</p>
              <p className="mt-1 text-muted-foreground">
                저자: {book.author} · 소장: {book.location}
              </p>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                <span>도서관 반납 사이클(평일 09시, 13시, 16시)에 맞춰 실시간 상태를 확인합니다.</span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                <span>회원가입 없이 브라우저 Web Push 알림으로 100% 무료 제공됩니다.</span>
              </div>
            </div>

            {status === 'denied' || status === 'error' ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <div className="mt-6 flex gap-2.5">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 rounded-xl"
              >
                닫기
              </Button>
              <Button
                onClick={handleSubscribe}
                disabled={status === 'loading'}
                className="flex-1 rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {status === 'loading' ? '신청 처리 중...' : '알림 받기'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
