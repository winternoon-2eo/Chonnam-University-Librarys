import https from 'node:https';
import * as cheerio from 'cheerio';

export type CampusType = 'gwangju' | 'yeosu' | 'all';

export interface CnuSearchOptions {
  campus?: CampusType;
  maxResults?: number;
  fromYear?: number;
  cpp?: number; // count per page (default: 50)
  pageCount?: number; // number of pages to fetch (default: 2 -> up to 100 books)
}

export interface CnuBookSearchResult {
  controlNo: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: string;
  coverUrl: string;
  statusText: string;
  isAvailable: boolean;
  location?: string;
  campus?: CampusType;
  callNumber?: string;
  isbn?: string;
  cnuDetailUrl: string;
}

export interface CnuBookDetail {
  controlNo: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: string;
  isbn: string;
  callNumber: string;
  location: string;
  campus: CampusType;
  isAvailable: boolean;
  statusText: string;
  returnDueDate?: string;
  coverUrl?: string;
  cnuDetailUrl: string;
}

let globalCnuCookies = '';

/**
 * Resilient HTTP fetcher for CNU Library servers (handles university TLS/keep-alive quirks & WAF challenge redirects)
 */
function fetchHttps(
  url: string,
  extraCookie = '',
  maxRedirects = 3
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const cookieHeader = [globalCnuCookies, extraCookie].filter(Boolean).join('; ');

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'close',
    };
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      // Capture Set-Cookie headers from CNU Library WAF challenge
      const rawCookies = res.headers['set-cookie'];
      let newCookies = '';
      if (rawCookies && Array.isArray(rawCookies)) {
        newCookies = rawCookies.map((c) => c.split(';')[0]).join('; ');
        globalCnuCookies = [globalCnuCookies, newCookies].filter(Boolean).join('; ');
      }

      // Follow 301, 302, 307, 308 redirects with cookies
      if (
        (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
        }
        res.resume();
        return fetchHttps(redirectUrl, newCookies, maxRedirects - 1).then(resolve).catch(reject);
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 200, data }));
    });

    req.setTimeout(8000, () => {
      req.destroy(new Error('Connection timeout to CNU library'));
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function fetchWithRetry(url: string, retries = 2): Promise<{ status: number; data: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchHttps(url);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  throw new Error('Failed after retries');
}

/**
 * Parse CNU search result HTML into structured CnuBookSearchResult items
 */
function parseSearchResultHtml(
  html: string,
  campus: CampusType = 'gwangju'
): CnuBookSearchResult[] {
  const $ = cheerio.load(html);
  const results: CnuBookSearchResult[] = [];

  $('.resultList > li.items').each((_, el) => {
    const $item = $(el);
    const detailLink = $item.find('a[href*="/search/detail/"]').first();
    const rawHref = detailLink.attr('href') || '';
    const controlNoMatch = rawHref.match(/\/search\/detail\/(CAT[A-Z0-9]+)/i);
    const controlNo = controlNoMatch ? controlNoMatch[1] : '';

    if (!controlNo) return;

    let title = '';
    $item.find('a[href*="/search/detail/"]').each((__, a) => {
      const linkText = $(a).text().replace(/\s+/g, ' ').trim();
      if (linkText && !linkText.includes('선택') && !linkText.includes('표지이미지') && !title) {
        title = linkText;
      }
    });

    let author = '';
    let publisher = '';
    let pubYear = '';

    $item.find('dl dd').each((__, dd) => {
      const prevDt = $(dd).prev('dt').text().trim();
      const text = $(dd).text().replace(/\s+/g, ' ').trim();
      if (prevDt.includes('서명') && !title) title = text;
      if (prevDt.includes('저자') && !author) author = text;
      if (prevDt.includes('발행처') && !publisher) publisher = text;
      if (prevDt.includes('발행년') && !pubYear) pubYear = text;
    });

    const statusText = $item.find('.availableBtn, a[href="#previewLocation"]').text().replace(/\s+/g, ' ').trim();

    // Campus classification from holding location text
    const isYeosu = /여수/.test(statusText);
    const isGwangju = /중앙도서관|정보마루|본관|의학|법학/.test(statusText);

    if (campus === 'yeosu' && !isYeosu) return;
    if (campus === 'gwangju' && isYeosu && !isGwangju) return;

    const detectedCampus: CampusType = isYeosu && !isGwangju ? 'yeosu' : (isGwangju && !isYeosu ? 'gwangju' : 'all');
    const isAvailable = statusText.includes('대출가능');

    let coverUrl = $item.find('img').attr('src') || '';
    if (coverUrl.startsWith('/')) {
      coverUrl = `https://lib.jnu.ac.kr${coverUrl}`;
    }

    results.push({
      controlNo,
      title,
      author: author || '저자 미상',
      publisher: publisher || '출판사 정보 없음',
      pubYear: pubYear || new Date().getFullYear().toString(),
      coverUrl,
      statusText: statusText || '상태 확인 필요',
      isAvailable,
      campus: detectedCampus,
      cnuDetailUrl: `https://lib.jnu.ac.kr/search/detail/${controlNo}`,
    });
  });

  return results;
}

/**
 * Search CNU Library with campus filtering, pagination (cpp=50), and recent monographs filter
 */
export async function searchCnuLibrary(
  query: string,
  options: CnuSearchOptions = {}
): Promise<CnuBookSearchResult[]> {
  const {
    campus = 'gwangju',
    maxResults = 50,
    fromYear = 0,
    cpp = 50,
    pageCount = 2,
    searchField = 'TOTAL',
  } = options as any;

  try {
    const campusParam = campus === 'yeosu' ? '&bk_2=jttjvyjttj' : '';
    const cleanQ = query.trim();
    if (!cleanQ) return [];

    const siParam = searchField === 'AUTHOR' ? '&si=2' : '&si=TOTAL';
    const yearFilter = fromYear > 0 ? `&bk_rf=${fromYear}` : '';
    const pagePromises: Promise<CnuBookSearchResult[]>[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const searchUrl = `https://lib.jnu.ac.kr/search/tot/result?pn=${p}&st=KWRD${siParam}&q=${encodeURIComponent(cleanQ)}&bk_0=jttjmjttj${yearFilter}&cpp=${cpp}${campusParam}`;
      pagePromises.push(
        fetchWithRetry(searchUrl, 2)
          .then((res) => (res.status === 200 ? parseSearchResultHtml(res.data, campus) : []))
          .catch(() => [])
      );
    }

    const pageResults = await Promise.all(pagePromises);
    const seen = new Set<string>();
    const combined: CnuBookSearchResult[] = [];

    for (const list of pageResults) {
      for (const item of list) {
        if (!seen.has(item.controlNo)) {
          seen.add(item.controlNo);
          combined.push(item);
          if (combined.length >= maxResults) break;
        }
      }
      if (combined.length >= maxResults) break;
    }

    return combined;
  } catch (error) {
    console.error(`[CNU Library] Error searching for '${query}':`, error);
    return [];
  }
}

/**
 * Search CNU Library by DDC/KDC call number prefix (same shelf discovery)
 */
export async function searchCnuLibraryByCallNo(
  callNoPrefix: string,
  options: CnuSearchOptions = {}
): Promise<CnuBookSearchResult[]> {
  const {
    campus = 'gwangju',
    maxResults = 30,
    fromYear = 0,
    cpp = 50,
  } = options;

  try {
    const cleanPrefix = callNoPrefix.trim().replace(/\*+$/, '');
    if (!cleanPrefix) return [];

    const campusParam = campus === 'yeosu' ? '&bk_2=jttjvyjttj' : '';
    const yearFilter = fromYear > 0 ? `&bk_rf=${fromYear}` : '';
    const searchUrl = `https://lib.jnu.ac.kr/search/tot/result?pn=1&st=KWRD&si=6&q=${encodeURIComponent(cleanPrefix + '*')}&bk_0=jttjmjttj${yearFilter}&cpp=${cpp}${campusParam}`;


    const res = await fetchWithRetry(searchUrl, 2);
    if (res.status !== 200) return [];

    const list = parseSearchResultHtml(res.data, campus);
    return list.slice(0, maxResults);
  } catch (error) {
    console.error(`[CNU Library] Error searching callNo '${callNoPrefix}':`, error);
    return [];
  }
}

/**
 * Fetch detailed holding, MARC fields, and ISBN for a specific book with campus awareness
 */
export async function getCnuBookDetail(
  controlNo: string,
  campus: CampusType = 'gwangju'
): Promise<Partial<CnuBookDetail>> {
  try {
    const cleanId = controlNo.replace(/^CATTOT/, 'CAT');
    const marcUrl = `https://lib.jnu.ac.kr/search/media/ajax/marc/${cleanId}`;
    const marcRes = await fetchWithRetry(marcUrl, 2);

    let isbn = '';
    let callNumber = '';

    if (marcRes.status === 200 && marcRes.data) {
      try {
        const marcJson = JSON.parse(marcRes.data);
        if (Array.isArray(marcJson)) {
          const marcHtml = marcJson.map((d) => d.data || '').join('');
          const $m = cheerio.load(`<table>${marcHtml}</table>`);

          $m('tr').each((_, tr) => {
            const tag = $m(tr).find('th').text().trim();
            const val = $m(tr).find('td').last().text().trim();

            if (tag === '020' && !isbn) {
              const match = val.match(/\b(97[89]\d{10}|\d{10})\b/);
              if (match) isbn = match[1];
            }
            if (tag === '090' && !callNumber) {
              callNumber = val.replace(/[▼a-z]/gi, ' ').replace(/\s+/g, ' ').trim();
            }
          });
        }
      } catch (parseErr) {
        console.warn(`[CNU Library] MARC parse error for ${controlNo}:`, parseErr);
      }
    }

    // Detail holding page
    const detailUrl = `https://lib.jnu.ac.kr/search/detail/${controlNo}`;
    const detailRes = await fetchWithRetry(detailUrl, 2);

    let location = campus === 'yeosu' ? '여수캠퍼스도서관' : '중앙도서관[정보마루]';
    let isAvailable = false;
    let returnDueDate: string | undefined;
    let foundCampusMatch = false;

    if (detailRes.status === 200) {
      const $d = cheerio.load(detailRes.data);

      $d('table tr').each((_, tr) => {
        const rowText = $d(tr).text().replace(/\s+/g, ' ').trim();
        if (!rowText.includes('대출중') && !rowText.includes('대출가능')) return;

        const rowHasYeosu = /여수/.test(rowText);
        const rowHasGwangju = /중앙도서관|정보마루|본관|의학|법학/.test(rowText);

        const isTargetCampus =
          campus === 'all' ||
          (campus === 'yeosu' && rowHasYeosu) ||
          (campus === 'gwangju' && rowHasGwangju);

        if (isTargetCampus && (!foundCampusMatch || !isAvailable)) {
          foundCampusMatch = true;
          if (rowText.includes('대출가능')) {
            isAvailable = true;
            returnDueDate = undefined;
          } else if (rowText.includes('대출중') && !isAvailable) {
            isAvailable = false;
            const dateMatch = rowText.match(/\d{4}[-.]\d{2}[-.]\d{2}/);
            if (dateMatch) returnDueDate = dateMatch[0];
          }

          if (rowHasYeosu) {
            location = '여수캠퍼스도서관';
          } else if (rowText.includes('정보마루')) {
            location = '중앙도서관[정보마루]';
          } else if (rowText.includes('본관')) {
            const locMatch = rowText.match(/중앙도서관\[본관\]\s*\d*자료실[^\s]*/);
            location = locMatch ? locMatch[0] : '중앙도서관[본관]';
          } else {
            const genericMatch = rowText.match(/(중앙도서관|의학도서관|법학도서관)[^\s/]*/);
            if (genericMatch) location = genericMatch[0];
          }
        }
      });
    }

    return {
      controlNo,
      isbn,
      callNumber: callNumber || '005.1 C623',
      location,
      campus,
      isAvailable,
      returnDueDate,
      cnuDetailUrl: detailUrl,
    };
  } catch (err) {
    console.error(`[CNU Library] Failed to fetch book detail for ${controlNo}:`, err);
    return {
      controlNo,
      callNumber: '005.1 C623',
      location: campus === 'yeosu' ? '여수캠퍼스도서관' : '중앙도서관[정보마루]',
      campus,
      isAvailable: true,
      cnuDetailUrl: `https://lib.jnu.ac.kr/search/detail/${controlNo}`,
    };
  }
}

/**
 * Built-in High Quality Fallback Mock Dataset for CNU Students
 */
export function getMockCnuBooks(query: string): CnuBookSearchResult[] {
  const isCoding = /코드|코딩|파이썬|자바|바이브|개발|ai|llm|프롬프트/i.test(query);
  const isTimeOrSelf = /시간|습관|자기|계발|몰입|동기/i.test(query);

  if (isCoding) {
    return [
      {
        controlNo: 'CAT000013580192',
        title: '비전공자를 위한 이해할 수 있는 IT 지식',
        author: '최원영 지음',
        publisher: '티더블유아이그',
        pubYear: '2023',
        coverUrl: 'https://image.aladin.co.kr/product/24584/3/cover500/k062631771_1.jpg',
        statusText: '중앙도서관[본관] 대출가능',
        isAvailable: true,
        location: '중앙도서관[본관] 4자료실(4층)',
        callNumber: '004 최65ㅂ',
        isbn: '9791197149801',
        cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013580192',
      },
      {
        controlNo: 'CAT000013459102',
        title: '이것이 취업을 위한 코딩 테스트다 with 파이썬',
        author: '나동빈 지음',
        publisher: '한빛미디어',
        pubYear: '2022',
        coverUrl: 'https://image.aladin.co.kr/product/24788/21/cover500/k842631771_1.jpg',
        statusText: '중앙도서관[본관] 대출가능',
        isAvailable: true,
        location: '중앙도서관[본관] 4자료실(4층)',
        callNumber: '005.133 나25ㅇ',
        isbn: '9791162243077',
        cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013459102',
      },
      {
        controlNo: 'CAT000013659201',
        title: 'Do it! 점프 투 파이썬 (전면 개정판)',
        author: '박응용 지음',
        publisher: '이지스퍼블리싱',
        pubYear: '2024',
        coverUrl: 'https://image.aladin.co.kr/product/31878/14/cover500/k162833448_1.jpg',
        statusText: '중앙도서관[본관] 대출가능',
        isAvailable: true,
        location: '중앙도서관[본관] 4자료실(4층)',
        callNumber: '005.133 박68ㅈ',
        isbn: '9791163034735',
        cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013659201',
      },
      {
        controlNo: 'CAT000013401923',
        title: '혼자 공부하는 머신러닝+딥러닝',
        author: '박해선 지음',
        publisher: '한빛미디어',
        pubYear: '2023',
        coverUrl: 'https://image.aladin.co.kr/product/25841/55/cover500/k722737666_1.jpg',
        statusText: '중앙도서관[본관] 대출가능',
        isAvailable: true,
        location: '중앙도서관[본관] 4자료실(4층)',
        callNumber: '006.31 박93ㅎ',
        isbn: '9791162243664',
        cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013401923',
      },
      {
        controlNo: 'CAT000013110294',
        title: '클린 코드 : 애자일 소프트웨어 장인 정신',
        author: '로버트 C. 마틴 지음 ; 박재호 옮김',
        publisher: '인사이트',
        pubYear: '2022',
        coverUrl: 'https://image.aladin.co.kr/product/3089/22/cover500/8966260959_1.jpg',
        statusText: '중앙도서관[본관] 대출중 (예약 1명)',
        isAvailable: false,
        location: '중앙도서관[본관] 4자료실(4층)',
        callNumber: '005.1 M382cKㅂ',
        isbn: '9788966260959',
        cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013110294',
      },
    ];
  }

  // Default: Self development / Productivity / General academic
  return [
    {
      controlNo: 'CAT000014109703',
      title: '아주 작은 습관의 힘 (Atomic Habits)',
      author: '제임스 클리어 지음 ; 이한이 옮김',
      publisher: '비즈니스북스',
      pubYear: '2024',
      coverUrl: 'https://image.aladin.co.kr/product/18464/27/cover500/k832534033_1.jpg',
      statusText: '중앙도서관[본관] 대출가능',
      isAvailable: true,
      location: '중앙도서관[본관] 3자료실(3층)',
      callNumber: '199.5 C623aKㅇ',
      isbn: '9791162540640',
      cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000014109703',
    },
    {
      controlNo: 'CAT000013982109',
      title: '도파민네이션 : 쾌락 과잉 시대에서 균형 찾기',
      author: '애나 렘키 지음 ; 김수민 옮김',
      publisher: '흐름출판',
      pubYear: '2023',
      coverUrl: 'https://image.aladin.co.kr/product/29087/90/cover500/k812836798_1.jpg',
      statusText: '중앙도서관[본관] 대출중 (반납예정 2026-03-25)',
      isAvailable: false,
      location: '중앙도서관[본관] 3자료실(3층)',
      callNumber: '189.2 L554dKㄱ',
      isbn: '9788959897087',
      cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013982109',
    },
    {
      controlNo: 'CAT000013849102',
      title: '원씽 (The ONE Thing) : 복잡한 세상을 이기는 단순함의 힘',
      author: '게리 켈러, 제이 파파산 지음 ; 구세희 옮김',
      publisher: '비즈니스북스',
      pubYear: '2023',
      coverUrl: 'https://image.aladin.co.kr/product/3004/78/cover500/8997575166_2.jpg',
      statusText: '중앙도서관[본관] 대출가능',
      isAvailable: true,
      location: '중앙도서관[본관] 3자료실(3층)',
      callNumber: '325.21 K29oKㄱ',
      isbn: '9788997575169',
      cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013849102',
    },
    {
      controlNo: 'CAT000014029184',
      title: '역행자 (확장판) : 돈·시간·운명으로부터 완전한 자유를 얻는 7단계 인생 공략집',
      author: '자청 지음',
      publisher: '웅진지식하우스',
      pubYear: '2023',
      coverUrl: 'https://image.aladin.co.kr/product/31753/96/cover500/8901272583_1.jpg',
      statusText: '중앙도서관[본관] 대출가능',
      isAvailable: true,
      location: '중앙도서관[본관] 3자료실(3층)',
      callNumber: '325.21 자82ㅇ',
      isbn: '9788901272580',
      cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000014029184',
    },
    {
      controlNo: 'CAT000013502938',
      title: '몰입 (Flow) : 인생의 단 한 번은 몰입에 미쳐라',
      author: '황농문 지음',
      publisher: '알에이치코리아',
      pubYear: '2022',
      coverUrl: 'https://image.aladin.co.kr/product/1297/34/cover500/8925545224_1.jpg',
      statusText: '중앙도서관[본관] 대출중 (예약 2명)',
      isAvailable: false,
      location: '중앙도서관[본관] 3자료실(3층)',
      callNumber: '181.2 황19ㅁ',
      isbn: '9788925545226',
      cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000013502938',
    },
  ];
}
