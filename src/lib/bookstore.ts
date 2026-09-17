import { fetchYes24BookInfo, Yes24Review } from './yes24';
import { fetchAladinBookInfo } from './aladin';

export interface BookstoreMetadata {
  isbn: string;
  goodsNo?: string;
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  rating: number;
  salesPoint: number;
  toc: string;
  description: string;
  categoryName?: string;
  rankingBadge?: {
    isBest: boolean;
    rankingText: string;
  };
  reviews?: Yes24Review[];
  source: 'yes24' | 'aladin' | 'cnu-fallback';
}

/**
 * Priority Order specified by User:
 * 1. YES24 Developers API & Community (if YES24_API_KEY is present)
 * 2. Aladin Open API (if ALADIN_TTB_KEY is present or fallback)
 * 3. CNU Library + Intelligent Fallback
 */
export async function fetchUnifiedBookMetadata(
  isbn: string,
  fallbackTitle = '',
  includeCommunity = false
): Promise<BookstoreMetadata> {
  // 1. Try YES24 (Primary)
  if (process.env.YES24_API_KEY) {
    try {
      const yes24Data = await fetchYes24BookInfo(isbn, fallbackTitle, includeCommunity);
      if (yes24Data && (yes24Data.toc || yes24Data.rating)) {
        return {
          ...yes24Data,
          source: 'yes24',
        };
      }
    } catch (err) {
      console.warn('[Bookstore Adapter] Yes24 lookup failed, falling back to Aladin:', err);
    }
  }

  // 2. Try Aladin (Secondary)
  const aladinData = await fetchAladinBookInfo(isbn, fallbackTitle);
  return {
    ...aladinData,
    source: process.env.ALADIN_TTB_KEY ? 'aladin' : 'cnu-fallback',
  };
}
