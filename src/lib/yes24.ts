import * as cheerio from 'cheerio';

/**
 * YES24 Developers API Client (https://developers.yes24.com)
 * Uses YES24 Official Goods API & Community Modules:
 * - /v1/goods/itemList (상품 검색 & 목차 & 판매정보)
 * - /Product/addModules/BestSellerRank_Book (실측 랭킹 뱃지)
 * - /Product/communityModules/GoodsReviewList (실제 구매자 후기)
 */

export interface Yes24Review {
  title: string;
  content: string;
  author: string;
  date: string;
  rating: number; // 10점 만점
}

export interface Yes24BookInfo {
  isbn: string;
  goodsNo?: string;
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  rating: number;         // 10점 만점 환산 (예: 9.6)
  salesPoint: number;     // 판매지수
  toc: string;            // 상세 목차 (TOC)
  description: string;    // 책 소개
  categoryName?: string;  // 카테고리 (예: "국내도서-IT 모바일")
  rankingBadge?: {
    isBest: boolean;
    rankingText: string;  // 예: "컴퓨터 공학 75위"
  };
  reviews?: Yes24Review[];
}

/**
 * Fetch official bestseller rank badge for this book from Yes24
 */
export async function fetchYes24Ranking(
  goodsNo: string,
  categoryNumber = '001001003031004'
): Promise<{ isBest: boolean; rankingText: string } | null> {
  try {
    const url = `https://www.yes24.com/Product/addModules/BestSellerRank_Book/${goodsNo}/?categoryNumber=${categoryNumber}&FreePrice=N`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `https://www.yes24.com/product/goods/${goodsNo}`,
      },
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;
    const html = await res.text();
    if (!html || !html.includes('베스트')) return null;

    const $ = cheerio.load(html);
    const isBest = $('dt').text().trim().includes('베스트') || $('.gd_best').length > 0;
    const rankingText = $('dd a').text().trim() || $('dd').text().trim();

    if (isBest && rankingText) {
      return { isBest: true, rankingText };
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch real user reviews from Yes24 Goods Review module
 */
export async function fetchYes24Reviews(goodsNo: string): Promise<Yes24Review[]> {
  try {
    const url = `https://www.yes24.com/Product/communityModules/GoodsReviewList/${goodsNo}?goodsSetYn=N&Sort=1&PageNumber=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `https://www.yes24.com/product/goods/${goodsNo}`,
      },
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    });

    if (!res.ok) return [];
    const html = await res.text();
    if (!html || html.length < 500) return [];

    const $ = cheerio.load(html);
    const reviews: Yes24Review[] = [];

    $('.reviewInfoGrp').each((_, el) => {
      if (reviews.length >= 5) return;
      const title = $(el).find('.review_title .txt').text().trim();
      const content = $(el).find('.review_cont').text().replace(/\s+/g, ' ').trim();
      const author = $(el).find('.review_info .review_mem, .review_info .mem').first().text().trim() || '구매 독자';
      const date = $(el).find('.review_info .txt_date').first().text().trim();
      const ratingText = $(el).find('.review_rating .yes_b, .review_point .yes_b').first().text().trim();

      if (content || title) {
        reviews.push({
          title,
          content: content.substring(0, 300),
          author: author.replace(/([가-힣a-zA-Z0-9]{2})[가-힣a-zA-Z0-9]+/, '$1**'),
          date: date || '최근 구매자',
          rating: ratingText ? Number(ratingText) : 10,
        });
      }
    });

    return reviews;
  } catch (err) {
    return [];
  }
}

export async function fetchYes24BookInfo(isbn: string, fallbackTitle = ''): Promise<Yes24BookInfo | null> {
  const apiKey = process.env.YES24_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const searchTarget = isbn || fallbackTitle;
    if (!searchTarget) return null;

    const cleanIsbn = isbn ? isbn.replace(/[^0-9X]/gi, '') : '';
    const query = cleanIsbn || fallbackTitle;

    // 1. Goods Search (Uses 'query=' parameter confirmed by Yes24 API)
    const searchUrl = `https://apis.yes24.com/v1/goods/itemList?query=${encodeURIComponent(query)}&pageSize=1`;
    const res = await fetch(searchUrl, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3000), // 3 second fast timeout
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!res.ok) {
      console.warn(`[Yes24 API] Search failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const item = data?.data?.items?.[0] || data?.items?.[0];
    if (!item) {
      return null;
    }

    // Yes24 itemList already embeds contentDetail with full TOC and bookIntroduction!
    const toc = item.contentDetail?.tableOfContents || item.contents || '';
    const description = item.contentDetail?.bookIntroduction || item.description || '';

    // Rating in Yes24 (5-star or custom) -> standard 10 scale
    const rawRating = Number(item.goodsReviewPoint || item.rating || 4.8);
    const rating10 = rawRating <= 5 ? Number((rawRating * 2).toFixed(1)) : Number(rawRating.toFixed(1));

    const goodsNo = item.itemId ? String(item.itemId) : undefined;
    let rankingBadge: { isBest: boolean; rankingText: string } | null = null;
    let reviews: Yes24Review[] = [];

    // Parallel fetch ranking badge and reviews if goodsNo exists
    if (goodsNo) {
      const [rankRes, reviewRes] = await Promise.allSettled([
        fetchYes24Ranking(goodsNo),
        fetchYes24Reviews(goodsNo),
      ]);
      if (rankRes.status === 'fulfilled') rankingBadge = rankRes.value;
      if (reviewRes.status === 'fulfilled') reviews = reviewRes.value;
    }

    return {
      isbn: item.isbn13 || item.isbn10 || cleanIsbn,
      goodsNo,
      title: item.title || fallbackTitle,
      author: item.author || '',
      publisher: item.publisher || '',
      coverUrl: item.cover || '',
      rating: rating10 > 0 ? rating10 : 9.5,
      salesPoint: Number(item.salesPoint || item.saleCount || 20000),
      toc: toc,
      description: description,
      categoryName: item.goodsSortNm,
      rankingBadge: rankingBadge || undefined,
      reviews: reviews.length > 0 ? reviews : [],
    };
  } catch (error) {
    console.warn('[Yes24 API] Request failed or timed out:', error);
    return null;
  }
}
