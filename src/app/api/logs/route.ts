import { NextRequest, NextResponse } from 'next/server';
import { getRecentSearchLogs, SearchLogItem } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeCsvField(val: string | undefined): string {
  if (!val) return '""';
  const clean = val.replace(/"/g, '""');
  return `"${clean}"`;
}

function generateCsv(logs: SearchLogItem[]): string {
  const header = ['번호', '검색일시(KST)', '검색어', '학습목적', '캠퍼스', '추천도서1', '추천도서2', '추천도서3', '추천도서4', '추천도서5'];
  const rows = logs.map((log, idx) => {
    const num = logs.length - idx;
    let kstDate = log.created_at || '';
    try {
      if (log.created_at) {
        kstDate = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      }
    } catch {
      kstDate = log.created_at || '';
    }
    const intentLabel = log.intent === 'beginner' ? '입문/교양' : '실무/실습';
    const campusLabel = log.campus === 'yeosu' ? '여수캠퍼스' : '광주(본관)';
    const titles = log.recommended_titles || [];

    return [
      num,
      escapeCsvField(kstDate),
      escapeCsvField(log.query),
      escapeCsvField(intentLabel),
      escapeCsvField(campusLabel),
      escapeCsvField(titles[0] || ''),
      escapeCsvField(titles[1] || ''),
      escapeCsvField(titles[2] || ''),
      escapeCsvField(titles[3] || ''),
      escapeCsvField(titles[4] || ''),
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

function generateHtml(logs: SearchLogItem[]): string {
  const rowsHtml = logs.map((log, idx) => {
    const num = logs.length - idx;
    let kstDate = log.created_at || '';
    try {
      if (log.created_at) {
        kstDate = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      }
    } catch {
      kstDate = log.created_at || '';
    }
    const isBeginner = log.intent === 'beginner';
    const isYeosu = log.campus === 'yeosu';
    const titles = log.recommended_titles || [];

    const bookListItems = titles.map((t, bIdx) => `
      <div style="margin-bottom: 4px; display: flex; align-items: baseline; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; border-radius: 4px; padding: 1px 5px; flex-shrink: 0;">#${bIdx + 1}</span>
        <span style="font-size: 13px; color: #1e293b; line-height: 1.4;">${escapeHtml(t)}</span>
      </div>
    `).join('');

    return `
      <tr class="log-row">
        <td style="text-align: center; color: #64748b; font-weight: 600; font-size: 12px;">${num}</td>
        <td style="white-space: nowrap; font-size: 12px; color: #475569;">${kstDate}</td>
        <td style="font-weight: 700; font-size: 14px; color: #0f172a;" class="query-cell">${escapeHtml(log.query)}</td>
        <td>
          <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; background: ${isBeginner ? '#f0fdf4' : '#eff6ff'}; color: ${isBeginner ? '#15803d' : '#1d4ed8'}; border: 1px solid ${isBeginner ? '#bbf7d0' : '#bfdbfe'};">
            ${isBeginner ? '입문/교양' : '실무/실습'}
          </span>
        </td>
        <td>
          <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; background: ${isYeosu ? '#fef3c7' : '#f1f5f9'}; color: ${isYeosu ? '#b45309' : '#334155'}; border: 1px solid ${isYeosu ? '#fde68a' : '#cbd5e1'};">
            ${isYeosu ? '여수캠퍼스' : '광주(본관)'}
          </span>
        </td>
        <td style="padding: 10px 14px;">
          ${bookListItems || '<span style="color: #94a3b8; font-size: 12px;">추천 기록 없음</span>'}
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>전남대 AI 도서관 - 검색 및 추천 기록 로그</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", sans-serif; background-color: #f8fafc; color: #0f172a; padding: 24px; }
    .container { max-width: 1280px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; }
    .header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; background: #fafafa; }
    .title-area h1 { font-size: 20px; font-weight: 800; color: #0f172a; }
    .title-area p { font-size: 13px; color: #64748b; margin-top: 4px; }
    .btn-group { display: flex; gap: 10px; align-items: center; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-excel { background: #16a34a; color: white; }
    .btn-excel:hover { background: #15803d; }
    .btn-refresh { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .btn-refresh:hover { background: #e2e8f0; }
    .btn-json { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
    .btn-json:hover { background: #f1f5f9; color: #0f172a; }
    .filter-bar { padding: 12px 24px; border-bottom: 1px solid #e2e8f0; background: #fff; display: flex; justify-content: space-between; align-items: center; }
    .search-input { width: 320px; max-width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
    .search-input:focus { border-color: #10b981; ring: 2px solid #a7f3d0; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #f8fafc; color: #475569; font-size: 12px; font-weight: 700; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:hover { background-color: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title-area">
        <h1>📚 전남대학교 AI 도서관 - 실시간 검색 & 추천 기록</h1>
        <p>사용자 검색 키워드 및 최종 엄선된 5권의 도서 추천 이력을 모니터링합니다 (총 ${logs.length}건)</p>
      </div>
      <div class="btn-group">
        <a href="/api/logs?format=csv" class="btn btn-excel" download>📥 엑셀(CSV) 다운로드</a>
        <a href="javascript:location.reload()" class="btn btn-refresh">🔄 새로고침</a>
        <a href="/api/logs?format=json" class="btn btn-json" target="_blank">🔍 JSON 원본</a>
      </div>
    </div>
    <div class="filter-bar">
      <input type="text" id="filterInput" class="search-input" placeholder="검색어 또는 책 제목으로 필터링...">
      <span style="font-size: 12px; color: #64748b;">최근 ${logs.length}건 표시 중</span>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">No</th>
            <th style="width: 150px;">검색 일시 (KST)</th>
            <th style="width: 140px;">검색어</th>
            <th style="width: 100px;">학습 목적</th>
            <th style="width: 110px;">캠퍼스</th>
            <th>추천된 5권의 도서 목록</th>
          </tr>
        </thead>
        <tbody id="logTableBody">
          ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #94a3b8;">아직 기록된 검색 로그가 없습니다.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const filterInput = document.getElementById('filterInput');
    filterInput.addEventListener('input', function(e) {
      const q = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('.log-row');
      rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const format = searchParams.get('format');
  const acceptHeader = request.headers.get('accept') || '';

  try {
    const logs = await getRecentSearchLogs(limit);

    // 1. CSV format (Excel UTF-8 BOM)
    if (format === 'csv') {
      const csvData = generateCsv(logs);
      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="cnu_search_logs.csv"',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // 2. HTML format (Browser view)
    const isHtmlPreferred = format === 'html' || (acceptHeader.includes('text/html') && !format && !acceptHeader.includes('application/json'));
    if (isHtmlPreferred) {
      const htmlData = generateHtml(logs);
      return new Response(htmlData, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // 3. Default: JSON format
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

