/**
 * scripts/generate_v1_5_prompts_pdf.mjs
 * Kiểm định toàn vẹn 63 UID & Prompt Họa Sĩ cho Bản Cập Nhật Ver 1.5
 * (43 Emojis + 20 Khung Viền Avatar 512x512 PNG nền trong suốt),
 * dựng HTML chuẩn in A4 và xuất PDF tại:
 * C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SUMI_V1_5_EMOJI_AND_FRAMES_PROMPTS.pdf
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { V15_NEW_EMOJI_PROMPTS, V15_AVATAR_FRAME_SPECS } from '../src/data/v15AssetsCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const HANDOFF_DOCS_DIR = path.resolve(BACKEND_ROOT, '..', 'handoff_docs');
const OUTPUT_PDF_PATH = path.join(HANDOFF_DOCS_DIR, 'SUMI_V1_5_EMOJI_AND_FRAMES_PROMPTS.pdf');
const TMP_HTML_DIR = path.join(BACKEND_ROOT, 'tmp');
const TMP_HTML_PATH = path.join(TMP_HTML_DIR, 'SUMI_V1_5_EMOJI_AND_FRAMES_PROMPTS.html');
const CUSTOM_EMOJIS_PATH = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

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
  if (V15_NEW_EMOJI_PROMPTS.length !== 43) {
    throw new Error(`Expected 43 emoji prompts, got ${V15_NEW_EMOJI_PROMPTS.length}`);
  }
  if (V15_AVATAR_FRAME_SPECS.length !== 20) {
    throw new Error(`Expected 20 avatar frame specs, got ${V15_AVATAR_FRAME_SPECS.length}`);
  }

  const existingEmojis = fs.existsSync(CUSTOM_EMOJIS_PATH)
    ? JSON.parse(fs.readFileSync(CUSTOM_EMOJIS_PATH, 'utf8'))
    : {};
  const discordRe = /^[a-z0-9_]{2,32}$/;
  const seenEmojis = new Set();
  for (const item of V15_NEW_EMOJI_PROMPTS) {
    if (!discordRe.test(item.uid)) {
      throw new Error(`Invalid Discord emoji UID "${item.uid}"`);
    }
    if (seenEmojis.has(item.uid) || existingEmojis[item.uid]) {
      throw new Error(`Duplicate/colliding emoji UID "${item.uid}"`);
    }
    seenEmojis.add(item.uid);
    if (!item.visual_prompt || item.visual_prompt.length < 100) {
      throw new Error(`Emoji prompt too short for "${item.uid}"`);
    }
  }

  const seenFrames = new Set();
  for (const frame of V15_AVATAR_FRAME_SPECS) {
    if (!discordRe.test(frame.frame_id)) {
      throw new Error(`Invalid frame_id "${frame.frame_id}"`);
    }
    if (seenFrames.has(frame.frame_id)) {
      throw new Error(`Duplicate frame_id "${frame.frame_id}"`);
    }
    seenFrames.add(frame.frame_id);
    if (!frame.visual_prompt || frame.visual_prompt.length < 120) {
      throw new Error(`Frame prompt too short for "${frame.frame_id}"`);
    }
  }

  return V15_NEW_EMOJI_PROMPTS.length + V15_AVATAR_FRAME_SPECS.length;
}

function renderEmojiCard(item, idx) {
  return `
    <article class="prompt-card">
      <div class="card-head">
        <div>
          <span class="badge-num">#${String(idx + 1).padStart(2, '0')}</span>
          <span class="item-name">${escapeHtml(item.name)}</span>
        </div>
        <code class="uid-pill">${escapeHtml(item.uid)}.png</code>
      </div>
      <div class="meta-row">
        <span><strong>Kích thước:</strong> ${escapeHtml(item.dimensions)}</span>
        <span><strong>Vị trí dùng:</strong> ${escapeHtml(item.role)}</span>
      </div>
      <div class="prompt-box">${escapeHtml(item.visual_prompt)}</div>
    </article>
  `;
}

function renderFrameCard(frame, idx) {
  return `
    <article class="prompt-card frame-card">
      <div class="card-head">
        <div>
          <span class="badge-num">#${String(idx + 44).padStart(2, '0')}</span>
          <span class="item-name">${escapeHtml(frame.name)}</span>
          <span class="tier-pill tier-${escapeHtml(frame.rarity_key)}">${escapeHtml(frame.rarity)} • ${frame.price.toLocaleString('vi-VN')} LT</span>
        </div>
        <code class="uid-pill">${escapeHtml(frame.frame_id)}.png</code>
      </div>
      <div class="meta-row">
        <span><strong>Kích thước:</strong> 512×512 PNG nền trong suốt (lòng giữa trong suốt >= 72%)</span>
        <span><strong>Mô tả Shop:</strong> ${escapeHtml(frame.description)}</span>
      </div>
      <div class="prompt-box">${escapeHtml(frame.visual_prompt)}</div>
    </article>
  `;
}

function buildHtmlDocument() {
  const emojiRows = V15_NEW_EMOJI_PROMPTS.map((e, i) => `
    <tr>
      <td><strong>#${String(i + 1).padStart(2, '0')}</strong></td>
      <td><code>${escapeHtml(e.uid)}.png</code></td>
      <td><strong>${escapeHtml(e.name)}</strong></td>
      <td>${escapeHtml(e.role)}</td>
    </tr>
  `).join('');

  const frameRows = V15_AVATAR_FRAME_SPECS.map((f, i) => `
    <tr>
      <td><strong>#${String(i + 44).padStart(2, '0')}</strong></td>
      <td><code>${escapeHtml(f.frame_id)}.png</code></td>
      <td><strong>${escapeHtml(f.name)}</strong></td>
      <td>${escapeHtml(f.rarity)}</td>
      <td>${f.price.toLocaleString('vi-VN')} LT</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>SuMi Family v1.5 — Bộ 63 Prompt Emoji & Khung Viền Avatar</title>
<style>
  @page { size: A4; margin: 13mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #1f2430;
    line-height: 1.45;
    font-size: 9.8pt;
    margin: 0;
  }
  .cover {
    background: linear-gradient(135deg, #1b1726 0%, #2d1f3d 60%, #4a2342 100%);
    color: #fdf6ec;
    border-radius: 10px;
    padding: 18px 20px;
    margin-bottom: 14px;
    border: 1.5px solid #d4af37;
  }
  .cover h1 { margin: 0 0 6px 0; font-size: 18pt; color: #f6d57a; }
  .cover .sub { margin: 0 0 10px 0; font-size: 10pt; color: #e8dcc8; }
  .directive-box {
    background: rgba(255,255,255,0.08);
    border-left: 3px solid #f6d57a;
    padding: 9px 12px;
    border-radius: 5px;
    font-size: 9.3pt;
  }
  h2 {
    font-size: 13pt;
    color: #3a1f4d;
    border-bottom: 2px solid #d4af37;
    padding-bottom: 4px;
    margin: 16px 0 8px 0;
    page-break-after: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 8.8pt;
  }
  th, td {
    border: 1px solid #d8d0e0;
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f3edf8; color: #2f1b42; }
  code {
    font-family: Consolas, "Courier New", monospace;
    background: #f2eef8;
    color: #4c1d95;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8.6pt;
  }
  .prompt-card {
    border: 1px solid #d9d1e3;
    border-radius: 8px;
    padding: 9px 11px;
    margin-bottom: 9px;
    background: #ffffff;
    page-break-inside: avoid;
  }
  .frame-card { border-left: 4px solid #a855f7; }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .badge-num {
    display: inline-block;
    background: #3a1f4d;
    color: #f6d57a;
    font-weight: 700;
    font-size: 8.4pt;
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: 5px;
  }
  .item-name { font-weight: 700; font-size: 10.2pt; color: #1b1726; }
  .tier-pill {
    display: inline-block;
    font-size: 8pt;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    margin-left: 6px;
  }
  .tier-common { background: #e2e8f0; color: #334155; }
  .tier-rare { background: #dbeafe; color: #1d4ed8; }
  .tier-epic { background: #f3e8ff; color: #7e22ce; }
  .tier-mythic { background: #fef3c7; color: #b45309; }
  .uid-pill { background: #ede9fe; color: #5b21b6; font-weight: 700; white-space: nowrap; }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 8.6pt;
    color: #4b5563;
    margin-bottom: 5px;
  }
  .prompt-box {
    background: #f9f7fc;
    border: 1px dashed #c4b5fd;
    border-radius: 6px;
    padding: 7px 9px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.5pt;
    color: #1e1b4b;
    line-height: 1.4;
  }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <section class="cover">
    <h1>SUMI FAMILY VER 1.5 — BỘ 63 PROMPT HỌA SĨ</h1>
    <p class="sub">43 Application Emojis mới (thay thế 100% Emoji Unicode Windows + Vé Linh Vực) &amp; 20 Khung Viền Avatar 512×512 PNG nền trong suốt</p>
    <div class="directive-box">
      <strong>Quy chuẩn xuất file bắt buộc để auto-nạp Nhịp 2:</strong><br/>
      1. Đặt tên file <strong>chính xác tuyệt đối</strong> theo cột <code>&lt;uid&gt;.png</code> (ví dụ <code>gacha_ticket_domain.png</code>, <code>ui_toggle_on.png</code>, <code>frame_royal_legacy.png</code>).<br/>
      2. <strong>43 Emojis (#01 – #43):</strong> PNG nền trong suốt <strong>128×128</strong> (hoặc 512×512 sạch viền), silhouette đậm nét để nhìn rõ ở kích thước icon Discord, không chữ, không watermark.<br/>
      3. <strong>20 Khung Viền Avatar (#44 – #63):</strong> PNG nền trong suốt <strong>512×512</strong>, <strong>lòng giữa hình tròn phải trống hoàn toàn (trong suốt tối thiểu 72% đường kính)</strong> để ghép đè lên Avatar người chơi trên /profile, /rank, /battle &amp; /linhmach. Tuyệt đối không vẽ mặt người/nhân vật ở giữa.
    </div>
  </section>

  <h2>BẢNG TỔNG HỢP 43 APPLICATION EMOJIS MỚI (#01 – #43)</h2>
  <table>
    <thead><tr><th>STT</th><th>Tên File Bắt Buộc</th><th>Tên Hiển Thị</th><th>Vị Trí Sử Dụng Trong Bot</th></tr></thead>
    <tbody>${emojiRows}</tbody>
  </table>

  <h2>BẢNG TỔNG HỢP 20 KHUNG VIỀN AVATAR (#44 – #63)</h2>
  <table>
    <thead><tr><th>STT</th><th>Tên File Bắt Buộc</th><th>Tên Khung Viền</th><th>Phẩm Chất</th><th>Giá Shop</th></tr></thead>
    <tbody>${frameRows}</tbody>
  </table>

  <div class="page-break"></div>
  <h2>PHẦN I — CHI TIẾT 43 PROMPT EMOJIS (128×128 PNG TRONG SUỐT)</h2>
  ${V15_NEW_EMOJI_PROMPTS.map((it, idx) => renderEmojiCard(it, idx)).join('')}

  <div class="page-break"></div>
  <h2>PHẦN II — CHI TIẾT 20 PROMPT KHUNG VIỀN AVATAR (512×512 PNG LÒNG TRONG SUỐT)</h2>
  ${V15_AVATAR_FRAME_SPECS.map((fr, idx) => renderFrameCard(fr, idx)).join('')}
</body>
</html>`;
}

async function run() {
  const count = assertIntegrity();
  fs.mkdirSync(HANDOFF_DOCS_DIR, { recursive: true });
  fs.mkdirSync(TMP_HTML_DIR, { recursive: true });

  const html = buildHtmlDocument();
  fs.writeFileSync(TMP_HTML_PATH, html, 'utf8');

  const browserExe = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
  if (!browserExe) {
    throw new Error('Could not find msedge.exe or chrome.exe for headless PDF generation');
  }

  const fileUrl = pathToFileURL(TMP_HTML_PATH).href;
  execFileSync(
    browserExe,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      `--print-to-pdf=${OUTPUT_PDF_PATH}`,
      '--no-pdf-header-footer',
      fileUrl,
    ],
    { stdio: 'pipe', timeout: 60000 },
  );

  const stat = fs.statSync(OUTPUT_PDF_PATH);
  console.log(`[v1.5 PDF] Verified ${count} prompts (43 emojis + 20 frames).`);
  console.log(`[v1.5 PDF] Generated: ${OUTPUT_PDF_PATH} (${(stat.size / 1024).toFixed(1)} KB)`);
}

run().catch((err) => {
  console.error('[v1.5 PDF] FAILED:', err);
  process.exit(1);
});
