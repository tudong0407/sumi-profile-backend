/**
 * scripts/generate_v1_6_1_alchemy_pdf.mjs
 * Xuất PDF Bộ Prompt 12 Ảnh WebP cho Hệ Thống Lò Luyện Đan (/luyendan — v1.6.1):
 * - 5 Cấp Lò Luyện Đan (furnace_lv1..5.png)
 * - 1 Lò Luyện Đan Bị Nổ (furnace_exploded.png)
 * - 6 Viên Đan Dược (pill_t1..4.png, pill_ess_1..2.png)
 *
 * Lưu tại:
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SuMi_v1_6_1_LuyenDan_Prompts.pdf
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\brain\6c4e030b-fb59-4575-8414-9779337f61d9\SuMi_v1_6_1_LuyenDan_Prompts.pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const HANDOFF_PDF = path.resolve(BACKEND_ROOT, '..', 'handoff_docs', 'SuMi_v1_6_1_LuyenDan_Prompts.pdf');
const ARTIFACT_PDF = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\SuMi_v1_6_1_LuyenDan_Prompts.pdf';
const TMP_HTML = path.join(BACKEND_ROOT, 'tmp', 'SuMi_v1_6_1_LuyenDan_Prompts.html');

const PROMPTS = [
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_lv1.png',
    title: 'Lò Lv.1 — Thổ Đào Dược Đỉnh (Đất Nung Mộc Mạc)',
    prompt: 'Realistic handcrafted antique Eastern clay alchemy tripod censer (Thổ Đào Dược Đỉnh) sitting on a weathered stone workbench in a quiet mountain herbal workshop. Rough dark terracotta pottery surface with subtle soot marks, simple hand-carved rim, warm natural wood-charcoal embers glowing gently underneath, faint thin trail of herbal incense smoke rising from the vented lid. Natural daylight from a wooden lattice window, authentic museum artifact macro photography, grounded earthy tones, no neon glow, no CGI plastic, 1:1 square aspect ratio.',
  },
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_lv2.png',
    title: 'Lò Lv.2 — Thanh Đồng Đan Lô (Thanh Đồng Cổ Điển)',
    prompt: 'Realistic antique weathered bronze alchemy tripod cauldron (Thanh Đồng Đan Lô) resting on an aged dark hardwood stand in a traditional apothecary studio. Patinated verdigris bronze body with crisp archaic cloud-scroll relief engravings, twin bronze ring handles, warm amber charcoal fire beneath the base, soft wisps of white herbal steam drifting through a pierced bronze dome lid. Warm natural side lighting, rich metallic patina texture, realistic editorial craft photography, no sci-fi neon, no cartoon style, 1:1 square.',
  },
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_lv3.png',
    title: 'Lò Lv.3 — Xích Hỏa Huyền Đỉnh (Huyền Thiết Xích Hỏa)',
    prompt: 'Realistic masterwork forged black-iron and red-copper alchemy cauldron (Xích Hỏa Huyền Đỉnh) set on a carved basalt altar. Heavy hammered dark iron vessel inlaid with fine crimson-copper flame motifs, three sturdy beast-foot legs, lively orange-red hearth embers heating the belly, fragrant golden-white mist curling out of delicate lotus vents on the lid. Moody warm workshop lighting, authentic blacksmith metalwork texture, sharp photographic depth of field, no digital neon, 1:1 square.',
  },
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_lv4.png',
    title: 'Lò Lv.4 — Tử Kim Long Văn Lô (Tử Kim Long Văn)',
    prompt: 'Realistic museum-grade antique purple-gold bronze and dark-jade alchemy tripod furnace (Tử Kim Long Văn Lô) on a polished rosewood plinth. Deep burnished plum-gold alloy body with finely chiseled coiling dragon relief and inlaid nephrite jade rings, warm golden hearth fire below, serene silver-gold herbal vapor rising softly from a carved dragon-pearl finial lid. Soft dramatic lantern lighting, exquisite traditional craftsmanship, realistic metal and stone reflections, no CGI neon, 1:1 square.',
  },
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_lv5.png',
    title: 'Lò Lv.5 — Hỗn Độn Cửu Chuyển Đỉnh (Cửu Chuyển Huyền Ngọc)',
    prompt: 'Realistic imperial antique dark-jade and ancient-gilt-bronze nine-ring alchemy tripod censer (Hỗn Độn Cửu Chuyển Đỉnh) inside a tranquil stone sanctuary. Translucent ink-green nephrite jade body encased in intricate aged gold-bronze filigree with nine tiny suspended rings, gentle golden ember warmth beneath, luminous ivory-gold aromatic cloud curling gracefully upward. Chiaroscuro natural lighting, ultra-detailed museum photography, dignified timeless aura, no laser neon or sci-fi effects, 1:1 square.',
  },
  {
    group: 'PHẦN I — 5 CẤP LÒ LUYỆN ĐAN & TRẠNG THÁI NỔ LÒ (6 ẢNH)',
    file: 'furnace_exploded.png',
    title: 'Trạng Thái Nổ Lò — Đan Lô Nứt Vỡ & Tro Tàn',
    prompt: 'Realistic aftermath of an overheated cracked antique bronze alchemy cauldron (Lò Luyện Đan bị nổ) on a charred stone table. Deep soot-blackened fractures running down the vessel wall, tilted broken lid resting beside scorched black ash and ruined charred pill crumbs, thick grey-black residual smoke drifting upward, extinguished dull red embers below. Dramatic moody studio lighting, authentic soot and cracked clay/bronze texture, grounded realism, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_t1.png',
    title: 'Bậc 1 — Tụ Khí Thanh Đan',
    prompt: 'Realistic macro studio photograph of a single smooth pale celadon-green herbal alchemy pill (Tụ Khí Thanh Đan), slightly matte natural mineral-jade sheen, resting inside a small handmade dark stoneware dish lined with natural linen cloth. Subtle dried medicinal herbs softly blurred in the background, warm natural window light, serene Eastern apothecary aesthetic, no neon glow, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_t2.png',
    title: 'Bậc 2 — Trúc Cơ Ngọc Lộ Đan',
    prompt: 'Realistic macro studio photograph of a lustrous translucent mutton-fat white and dew-aqua jade elixir pill (Trúc Cơ Ngọc Lộ Đan), smooth porcelain-like polish with faint natural mineral veining, placed on a carved dark walnut tray with celadon ceramic cup nearby. Soft morning light, refined traditional craft photography, authentic stone-jade texture, no CGI glow, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_t3.png',
    title: 'Bậc 3 — Kim Đan Hỏa Linh Đan',
    prompt: 'Realistic macro studio photograph of a rich amber-crimson and burnished-gold alchemy pill (Kim Đan Hỏa Linh Đan) with delicate natural cinnabar-gold marbling across its sphere, resting on an antique black lacquer and silk brocade cushion inside an open carved wooden pill box. Warm candlelight accents, crisp tactile detail, authentic museum photography, no artificial neon, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_t4.png',
    title: 'Bậc 4 — Nguyên Anh Cửu Chuyển Đan',
    prompt: 'Realistic macro studio photograph of an extraordinary deep imperial-gold and midnight-indigo patterned pill (Nguyên Anh Cửu Chuyển Đan) showing natural nine-ring swirled cloud veins on its polished surface, displayed on a white nephrite lotus pedestal inside an heirloom brocade box. Soft warm directional studio light, fine gold-leaf and jade mineral texture, dignified realism, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_ess_1.png',
    title: 'Tinh Hoa I — Linh Quả Thanh Tâm Đan (Dùng Linh Quả /farm)',
    prompt: 'Realistic macro studio photograph of a vibrant emerald-green botanical essence elixir pill (Linh Quả Thanh Tâm Đan) with natural dewdrop gloss and subtle golden leaf-vein markings, nestled on a dark stone dish beside two fresh translucent spirit-fruit berries and green tea leaves. Crisp natural daylight, fresh organic apothecary photography, no plastic CGI, 1:1 square.',
  },
  {
    group: 'PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)',
    file: 'pill_ess_2.png',
    title: 'Tinh Hoa II — Hồng Mông Tạo Hóa Đan (Dùng 40 Linh Quả /farm)',
    prompt: 'Realistic macro studio photograph of a supreme antique bronze-violet and starlight-gold marbled elixir pill (Hồng Mông Tạo Hóa Đan) featuring fine natural cloud-swirl rings (Đan Vân) on a satin-polished mineral sphere, resting on carved black obsidian and golden silk brocade beside an antique jade seal. Rich warm museum spotlight, extraordinary tactile realism, no sci-fi neon, 1:1 square.',
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml() {
  const groups = [...new Set(PROMPTS.map((p) => p.group))];
  const sectionsHtml = groups.map((g) => {
    const cards = PROMPTS.filter((p) => p.group === g).map((p, i) => `
      <div class="card">
        <div class="card-head">
          <span class="title">${i + 1}. ${esc(p.title)}</span>
          <code class="file">${esc(p.file)}</code>
        </div>
        <div class="prompt">${esc(p.prompt)}</div>
      </div>
    `).join('\n');
    return `<section><h2>${esc(g)}</h2>${cards}</section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>SuMi v1.6.1 — Bộ Prompt 12 Ảnh Lò Luyện Đan</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; margin: 0; font-size: 10.5pt; line-height: 1.42; }
  .header { border-bottom: 2px solid #ec4899; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 16pt; color: #be185d; margin: 0 0 4px 0; }
  .sub { font-size: 9.5pt; color: #4b5563; margin: 0; }
  h2 { font-size: 12pt; color: #9d174d; border-left: 4px solid #ec4899; padding-left: 8px; margin: 14px 0 8px 0; page-break-after: avoid; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 11px; margin-bottom: 9px; background: #fafafa; page-break-inside: avoid; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; gap: 8px; }
  .title { font-weight: 700; color: #111827; font-size: 10.5pt; }
  .file { background: #fce7f3; color: #9d174d; padding: 2px 7px; border-radius: 5px; font-family: Consolas, monospace; font-size: 9pt; font-weight: 600; }
  .prompt { font-size: 9.4pt; color: #374151; background: #ffffff; border: 1px dashed #d1d5db; border-radius: 6px; padding: 6px 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>SuMi Family v1.6.1 — Bộ Prompt Hình Ảnh Lò Luyện Đan (/luyendan)</h1>
    <p class="sub">Tổng cộng: <strong>12 ảnh PNG (tỷ lệ 1:1, gợi ý 1024×1024)</strong> • Sau khi tạo ảnh xong, lưu đúng tên file như cột bên phải rồi chạy <code>node scripts/install_v1_6_1_assets.mjs --dir "&lt;thư mục ảnh&gt;"</code> để nén sang <code>assets/alchemy/*.webp</code> (&lt; 1 MB).</p>
  </div>
  ${sectionsHtml}
</body>
</html>`;
}

async function printViaCdp(htmlPath) {
  const res = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
  if (!res.ok) throw new Error(`CDP /json/new failed: ${res.status}`);
  const tab = await res.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  let nextId = 1;
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) {
        ws.off('message', onMsg);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

  try {
    await call('Page.enable');
    await call('Page.navigate', { url: pathToFileURL(htmlPath).href });
    await new Promise((r) => setTimeout(r, 900));
    const { data } = await call('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(data, 'base64');
  } finally {
    ws.close();
    await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`).catch(() => null);
  }
}

async function main() {
  await fs.promises.mkdir(path.dirname(TMP_HTML), { recursive: true });
  await fs.promises.mkdir(path.dirname(HANDOFF_PDF), { recursive: true });
  await fs.promises.mkdir(path.dirname(ARTIFACT_PDF), { recursive: true });

  await fs.promises.writeFile(TMP_HTML, buildHtml(), 'utf8');

  let pdfBuf;
  try {
    pdfBuf = await printViaCdp(TMP_HTML);
  } catch (err) {
    console.warn('[generate_v1_6_1_alchemy_pdf] CDP fallback to headless edge:', err.message);
    const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    execFileSync(edgeExe, [
      '--headless',
      '--disable-gpu',
      `--print-to-pdf=${HANDOFF_PDF}`,
      pathToFileURL(TMP_HTML).href,
    ]);
    pdfBuf = await fs.promises.readFile(HANDOFF_PDF);
  }

  await fs.promises.writeFile(HANDOFF_PDF, pdfBuf);
  await fs.promises.writeFile(ARTIFACT_PDF, pdfBuf);
  console.log(`[generate_v1_6_1_alchemy_pdf] Exported 12 prompts PDF (${(pdfBuf.length / 1024).toFixed(1)} KB) -> ${HANDOFF_PDF}`);
}

main().catch((err) => {
  console.error('[generate_v1_6_1_alchemy_pdf] FAILED:', err);
  process.exit(1);
});
