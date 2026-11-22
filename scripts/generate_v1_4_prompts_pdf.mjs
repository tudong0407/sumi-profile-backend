/**
 * scripts/generate_v1_4_prompts_pdf.mjs
 * Kiểm định toàn vẹn 16 UID & Prompt Họa Sĩ Vẽ Tay Thực Tế cho Bản Cập Nhật v1.4,
 * dựng HTML chuẩn in A4 và xuất PDF tại:
 * C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SUMI_V1_4_ARTIST_PROMPTS.pdf
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { PET_CATALOG, EQUIPMENT_CATALOG, SHOP_CONSUMABLES } from '../src/data/catalog.js';
import {
  V14_ARTIST_PROMPTS,
  V14_EXPLORER_MAPS,
  V14_SPIRIT_VEIN_TIERS,
} from '../src/data/v14ExpansionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const HANDOFF_DOCS_DIR = path.resolve(BACKEND_ROOT, '..', 'handoff_docs');
const OUTPUT_PDF_PATH = path.join(HANDOFF_DOCS_DIR, 'SUMI_V1_4_ARTIST_PROMPTS.pdf');
const TMP_HTML_DIR = path.join(BACKEND_ROOT, 'tmp');
const TMP_HTML_PATH = path.join(TMP_HTML_DIR, 'SUMI_V1_4_ARTIST_PROMPTS.html');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function assertIntegrity() {
  if (V14_ARTIST_PROMPTS.length !== 16) {
    throw new Error(`Expected 16 v1.4 artist prompts, got ${V14_ARTIST_PROMPTS.length}`);
  }
  const existingIds = new Set([
    ...PET_CATALOG.map((p) => p.pet_type),
    ...EQUIPMENT_CATALOG.map((e) => e.item_id),
    ...SHOP_CONSUMABLES.map((c) => c.item_id),
  ]);
  const discordRe = /^[a-z0-9_]{2,32}$/;
  const seen = new Set();

  for (const item of V14_ARTIST_PROMPTS) {
    if (!discordRe.test(item.uid)) {
      throw new Error(`Invalid Discord UID "${item.uid}"`);
    }
    if (existingIds.has(item.uid) || seen.has(item.uid)) {
      throw new Error(`Duplicate/colliding UID "${item.uid}"`);
    }
    seen.add(item.uid);
    if (!item.visual_prompt || item.visual_prompt.length < 180) {
      throw new Error(`Prompt too short for "${item.uid}"`);
    }
  }
  return V14_ARTIST_PROMPTS.length;
}

function renderPromptCard(item, idx) {
  return `
    <article class="prompt-card">
      <div class="card-head">
        <div>
          <span class="badge-num">#${String(idx + 1).padStart(2, '0')}</span>
          <span class="item-name">${escapeHtml(item.name)}</span>
        </div>
        <code class="uid-pill">${escapeHtml(item.uid)}</code>
      </div>
      <div class="meta-row">
        <span><strong>Kích thước:</strong> ${escapeHtml(item.dimensions)}</span>
        <span><strong>Công dụng:</strong> ${escapeHtml(item.role)}</span>
      </div>
      <div class="prompt-box">${escapeHtml(item.visual_prompt)}</div>
    </article>
  `;
}

function buildHtmlDocument() {
  const mapPrompts = V14_ARTIST_PROMPTS.filter((p) => p.section === 'map');
  const itemPrompts = V14_ARTIST_PROMPTS.filter((p) => p.section === 'consumable');
  const bossPrompts = V14_ARTIST_PROMPTS.filter((p) => p.section === 'boss');
  const sysPrompts = V14_ARTIST_PROMPTS.filter((p) => p.section === 'system');

  const mapRows = V14_EXPLORER_MAPS.map((m) => `
    <tr>
      <td><strong>#${m.order}</strong></td>
      <td><code>${escapeHtml(m.map_id)}</code></td>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.difficulty)}</td>
      <td>${m.recommended_power.toLocaleString('vi-VN')}</td>
      <td>×${m.reward_multiplier.toFixed(2)}</td>
    </tr>
  `).join('');

  const veinRows = V14_SPIRIT_VEIN_TIERS.map((v) => `
    <tr>
      <td><strong>${escapeHtml(v.tier_code)}</strong></td>
      <td>${v.tier_group === 'low' ? 'Cấp Thấp' : 'Cấp Cao'}</td>
      <td><strong>${escapeHtml(v.boss_name)}</strong></td>
      <td>${v.boss_power.toLocaleString('vi-VN')}</td>
      <td>${v.lt_per_min} LT/phút</td>
      <td>${escapeHtml(v.element)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>SuMi Family v1.4 — Bộ 16 Prompt Họa Sĩ Vẽ Tay</title>
<style>
  @page { size: A4; margin: 14mm 13mm 15mm 13mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #1f2430;
    line-height: 1.48;
    font-size: 10.5pt;
    margin: 0;
  }
  .cover {
    background: linear-gradient(135deg, #1b1726 0%, #2d1f3d 60%, #43263d 100%);
    color: #fdf6ec;
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 16px;
    border: 1.5px solid #d4af37;
  }
  .cover h1 {
    margin: 0 0 6px 0;
    font-size: 19pt;
    color: #f6d57a;
    letter-spacing: 0.3px;
  }
  .cover .sub {
    margin: 0 0 10px 0;
    font-size: 10.5pt;
    color: #e8dcc8;
  }
  .directive-box {
    background: rgba(255, 255, 255, 0.08);
    border-left: 3.5px solid #f6d57a;
    padding: 9px 12px;
    border-radius: 6px;
    font-size: 9.5pt;
    color: #f5efe6;
  }
  .section-banner {
    background: #f5efe4;
    border-left: 4px solid #8b3a3a;
    padding: 8px 12px;
    margin: 14px 0 10px 0;
    border-radius: 4px;
    page-break-after: avoid;
  }
  .section-banner h2 {
    margin: 0 0 2px 0;
    font-size: 12.5pt;
    color: #5c1e24;
  }
  .section-banner p {
    margin: 0;
    font-size: 9.2pt;
    color: #4a4a55;
  }
  .prompt-card {
    border: 1px solid #d8cfc0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: #fffdf9;
    page-break-inside: avoid;
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
  }
  .badge-num {
    display: inline-block;
    background: #5c1e24;
    color: #fdf6ec;
    font-weight: 700;
    font-size: 8.8pt;
    padding: 2px 7px;
    border-radius: 4px;
    margin-right: 6px;
  }
  .item-name {
    font-weight: 700;
    font-size: 10.8pt;
    color: #1f2430;
  }
  .uid-pill {
    background: #efe7da;
    color: #4c2329;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 8.8pt;
    font-family: Consolas, monospace;
    border: 1px solid #d7c7b2;
  }
  .meta-row {
    display: flex;
    gap: 18px;
    font-size: 9pt;
    color: #525866;
    margin-bottom: 6px;
  }
  .prompt-box {
    background: #f8f5ef;
    border: 1px dashed #c8baa4;
    border-radius: 5px;
    padding: 8px 10px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.6pt;
    color: #20242c;
    white-space: pre-wrap;
    word-break: break-word;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #d8cfc0;
    padding: 5px 7px;
    text-align: left;
  }
  th {
    background: #efe7da;
    color: #4c2329;
    font-weight: 700;
  }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

  <header class="cover">
    <h1>SUMI FAMILY v1.4 — BỘ 16 PROMPT HỌA SĨ VẼ TAY THỰC TẾ</h1>
    <p class="sub">Tài liệu đặc tả mỹ thuật cho « Đạo Áp Cửu Châu &amp; Đại Thám Hiểm » • Tổng cộng 16 Asset mới (01 Bản Đồ 4K 12 địa danh + 15 Icon/Boss vẽ tay)</p>
    <div class="directive-box">
      <strong>Chuẩn phong cách bắt buộc (Anti-AI Plastic Look):</strong> Toàn bộ Prompt được viết theo phong cách họa sĩ chuyên nghiệp vẽ tay nhiều giờ bằng mực nho, màu bột gouache, sơn dầu trên giấy bông/lụa cổ, có nét cọ thật, hạt sắc tố khoáng và ánh sáng tự nhiên — tuyệt đối tránh bóng nhựa AI / neon CGI giả tạo. Khi gửi ảnh lại cho em tích hợp, Tiểu thư đặt tên file theo đúng <code>uid</code> (VD: <code>explorer_world_map_v14.png</code>, <code>food_survival_pill.png</code>...) là hệ thống nạp tự động 100%!
    </div>
  </header>

  <section>
    <div class="section-banner">
      <h2>PHẦN I — BẢN ĐỒ KHÁM PHÁ ĐẠI LỤC SUMI CỠ CỰC LỚN 4K (01 ASSET)</h2>
      <p>Khổ ngang 16:9 độ phân giải 4K (3840×2160+) đánh dấu rõ 12 địa danh từ Tân Thủ (10k) tới Nightmare (1M).</p>
    </div>
    ${mapPrompts.map((p, i) => renderPromptCard(p, i)).join('')}

    <table>
      <thead>
        <tr><th>#</th><th>Map ID</th><th>Tên Địa Danh</th><th>Độ Khó</th><th>Lực Chiến Khuyến Nghị</th><th>Hệ Số Quà</th></tr>
      </thead>
      <tbody>${mapRows}</tbody>
    </table>
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN II — 05 VẬT PHẨM KHÁM PHÁ &amp; ĐÁ KHẮC ẤN TUYỆT ĐỐI (1024×1024)</h2>
      <p>3 Loại Thức Ăn (/shop), 1 Elixir Hồi Sinh Pet Độc Nhất (/shop), và 1 Thiên Đạo Tuyệt Ấn Thạch (rớt 0.5% từ /explorer — 100% mọi bậc, khuyên dùng A→S).</p>
    </div>
    ${itemPrompts.map((p, i) => renderPromptCard(p, i + 1)).join('')}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN III — 08 MỎ &amp; BOSS ĐỊA MẠCH TỪ CẤP F ĐẾN S+ (1024×1024)</h2>
      <p>Áp dụng cho 6 Khung Giờ Vàng mỗi ngày (08:00, 12:00, 18:00, 20:00, 21:00, 22:00 UTC+7). Sản lượng từ 6 LT/phút (F) lên tới 56 LT/phút (S+).</p>
    </div>
    <table>
      <thead>
        <tr><th>Hạng</th><th>Nhóm Mỏ</th><th>Tên Boss Địa Mạch</th><th>Lực Chiến Boss</th><th>Sản Lượng</th><th>Hệ</th></tr>
      </thead>
      <tbody>${veinRows}</tbody>
    </table>
    ${bossPrompts.map((p, i) => renderPromptCard(p, i + 6)).join('')}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN IV — 02 BIỂU TƯỢNG HỆ THỐNG MỚI V1.4 (1024×1024)</h2>
      <p>Ấn ký Debuff Cấp 2 « Đạo Áp » (16 Linh Vực Thần Thoại) và Biểu tượng Shop Ngày « Vạn Bảo Lưu Động Các ».</p>
    </div>
    ${sysPrompts.map((p, i) => renderPromptCard(p, i + 14)).join('')}
  </section>

</body>
</html>`;
}

function findBrowserExecutable() {
  for (const candidate of EDGE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No Edge/Chrome executable found among: ${EDGE_CANDIDATES.join(', ')}`);
}

function countPdfPages(pdfBuffer) {
  const str = pdfBuffer.toString('latin1');
  const matches = str.match(/\/Type\s*\/Page\b(?!s)/g);
  return matches ? matches.length : 0;
}

function run() {
  const totalCount = assertIntegrity();
  fs.mkdirSync(HANDOFF_DOCS_DIR, { recursive: true });
  fs.mkdirSync(TMP_HTML_DIR, { recursive: true });

  const html = buildHtmlDocument();
  fs.writeFileSync(TMP_HTML_PATH, html, 'utf8');

  const browserExe = findBrowserExecutable();
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sumi_edge_pdf_v14_'));
  const htmlFileUrl = pathToFileURL(TMP_HTML_PATH).href;

  try {
    execFileSync(browserExe, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pdf-header-footer',
      `--user-data-dir=${tempProfileDir}`,
      `--print-to-pdf=${OUTPUT_PDF_PATH}`,
      htmlFileUrl,
    ], { stdio: 'pipe', timeout: 120000 });
  } finally {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
    fs.rmSync(TMP_HTML_PATH, { force: true });
  }

  const pdfBuf = fs.readFileSync(OUTPUT_PDF_PATH);
  if (pdfBuf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error(`Invalid PDF output at ${OUTPUT_PDF_PATH}`);
  }
  console.log(`[v1.4 PDF] SUCCESS: ${OUTPUT_PDF_PATH}`);
  console.log(`[v1.4 PDF] Size: ${(pdfBuf.length / 1024).toFixed(1)} KB | Pages: ${countPdfPages(pdfBuf)} | Prompts: ${totalCount}`);
}

run();
