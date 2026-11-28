/**
 * scripts/generate_v1_7_1_mini_prompts_pdf.mjs
 * Xuất PDF Prompt chuẩn cho Ver 1.7.1 Mini Update (4 Boss Linh Mạch mới + 4 Icon Tính Năng mới):
 * Output:
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SuMi_Ver_1_7_1_Mini_Prompts.pdf
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\brain\6c4e030b-fb59-4575-8414-9779337f61d9\SuMi_Ver_1_7_1_Mini_Prompts.pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const TMP_HTML = path.join(BACKEND_ROOT, 'tmp', 'SuMi_Ver_1_7_1_Mini_Prompts.html');
const HANDOFF_PDF = path.resolve(BACKEND_ROOT, '..', 'handoff_docs', 'SuMi_Ver_1_7_1_Mini_Prompts.pdf');
const ARTIFACT_PDF = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\SuMi_Ver_1_7_1_Mini_Prompts.pdf';

const ASSET_PROMPTS = [
  {
    group: '4 BOSS LINH MẠCH MỚI (/linhmach — assets/veins/)',
    items: [
      {
        uid: 'vein_mine_ss',
        title: 'Hạng SS — Tinh Hà Kiếm Ngục Tôn',
        file: 'assets/veins/vein_mine_ss.png (Canvas & Emoji)',
        stats: 'Lực: 240,000 • 68 LT/phút • Hệ Kim • AoE 40% • Khiên 25% • Giảm ST 15%',
        prompt: 'Traditional Chinese xianxia ink and mineral gouache fantasy boss emblem, centered isolated subject on pure pitch-black solid #000000 background for clean chroma keying, celestial sword prison sovereign forged of floating golden-silver astral blades, starlight runes and metallic spirit ore halo, regal intimidating aura, intricate gilded engraving, clean crisp silhouette, zero text, zero borders, 1:1 square icon composition.',
      },
      {
        uid: 'vein_mine_ssp',
        title: 'Hạng SS+ — Băng Phách Huyền Đế Quân',
        file: 'assets/veins/vein_mine_ssp.png (Canvas & Emoji)',
        stats: 'Lực: 380,000 • 82 LT/phút • Hệ Thủy • AoE 45% • Khiên 35% • Giảm ST 20% • Phản 15%',
        prompt: 'Traditional Chinese xianxia ink and mineral gouache fantasy boss emblem, centered isolated subject on pure pitch-black solid #000000 background, ancient glacial jade sovereign dragon-tortoise crowned in translucent sapphire frost crystals and frozen mist, swirling abyssal water spirit veins, luminescent cyan and royal blue highlights, clean crisp silhouette, zero text, zero UI chrome, 1:1 square icon.',
      },
      {
        uid: 'vein_mine_sss',
        title: 'Hạng SSS — Thái Sơ Lôi Đình Đạo Tổ',
        file: 'assets/veins/vein_mine_sss.png (Canvas & Emoji)',
        stats: 'Lực: 560,000 • 100 LT/phút • Hệ Lôi • AoE 50% • Khiên 45% • Giảm ST 25% • Phản 20% • Miễn CC Cơ Bản',
        prompt: 'Traditional Chinese xianxia ink and mineral gouache fantasy boss emblem, centered isolated subject on pure pitch-black solid #000000 background, primordial thunder dao patriarch encased in violet-gold heavenly lightning coils, levitating bagua thunder drums and glowing storm sigils, dramatic rim lighting, razor-sharp silhouette, zero text, zero borders, 1:1 square icon.',
      },
      {
        uid: 'vein_mine_sssp',
        title: 'Hạng SSS+ (1%) — Hồng Mông Chung Cực Thánh Hoàng',
        file: 'assets/veins/vein_mine_sssp.png (Canvas & Emoji)',
        stats: 'Lực: 850,000 • 125 LT/phút • Hệ Hỗn Độn • AoE 55% • Khiên 60% • Giảm ST 30% • Phản 25% • Miễn Mọi CC',
        prompt: 'Traditional Chinese xianxia ink and mineral gouache supreme boss emblem, centered isolated subject on pure pitch-black solid #000000 background, primordial Hongmeng chaos emperor phoenix-dragon hybrid bathed in iridescent magenta, gold and cosmic void nebula, orbiting nine-ring sacred halo, ultimate apex majesty, ultra crisp silhouette for clean transparency, zero text, zero frame, 1:1 square.',
      },
    ],
  },
  {
    group: '4 ICON TÍNH NĂNG MỚI (Emoji Discord & UI — assets/shop/ hoặc custom_emojis/)',
    items: [
      {
        uid: 'tea_ceremony_pot',
        title: 'Ấm Trà Tiên Đạo (/thuongtra)',
        file: 'tea_ceremony_pot (Emoji & Embed Icon)',
        stats: 'Pha miễn phí 3 ấm/ngày • Nhận 200–300 LT ngay',
        prompt: 'Traditional Chinese xianxia mineral gouache game item icon, centered ornate celadon jade porcelain teapot carved with golden cloud reliefs and warm rising jade-gold spiritual steam wisps, isolated on pure solid #000000 background, glossy ceramic specular highlights, clean crisp outline, zero text, 1:1 square Discord emoji & UI icon.',
      },
      {
        uid: 'tea_cup_cheers',
        title: 'Chén Trà Đối Ẩm (Nút [Ké Chén])',
        file: 'tea_cup_cheers (Button Emoji)',
        stats: 'Tối đa 2 khách/ấm (2 phút) • Cả 2 nhận 200–300 LT + (%Luck × 5 LT)',
        prompt: 'Traditional Chinese xianxia mineral gouache game item icon, centered pair of delicate translucent white-jade tea cups touching gently mid-air with golden tea ripples and tiny glowing lotus petals sparkles, isolated on pure solid #000000 background, warm festive gold-emerald rim glow, crisp silhouette readable at 64px Discord emoji size, zero text, 1:1 square.',
      },
      {
        uid: 'spirit_incense_burner',
        title: 'Lư Đồng Thắp Linh Hương (/thaplinhhuong)',
        file: 'spirit_incense_burner (Command & Buff Icon)',
        stats: 'Phí 600–800 LT theo Luck • Tăng +5% đến +15% Luck đến 24:00 UTC+7',
        prompt: 'Traditional Chinese xianxia mineral gouache game item icon, centered three-legged antique bronze dragon-carved incense censer holding three glowing sandalwood incense sticks releasing curled auspicious peach-gold smoke ribbons, isolated on pure solid #000000 background, clean metallic bronze patina and warm ember glow, sharp silhouette readable at 64px, zero text, 1:1 square.',
      },
      {
        uid: 'auspicious_hour_bell',
        title: 'Chuông Vàng Giờ Hoàng Đạo (+10% Luck Server)',
        file: 'auspicious_hour_bell (Server Event & Luck Sync Icon)',
        stats: 'Mở 11:00 • 17:00 • 21:00 UTC+7 • Toàn Server +10% Luck',
        prompt: 'Traditional Chinese xianxia mineral gouache game item icon, centered sacred golden temple handbell engraved with celestial sun-cloud motifs surrounded by radiant chime soundwaves and tiny golden stars, isolated on pure solid #000000 background, luminous imperial gold sheen, crisp silhouette readable at 64px Discord emoji size, zero text, 1:1 square.',
      },
    ],
  },
];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml() {
  const sectionsHtml = ASSET_PROMPTS.map((grp) => `
    <div class="section">
      <h2>${esc(grp.group)}</h2>
      ${grp.items.map((it) => `
        <div class="card">
          <div class="card-head">
            <div>
              <div class="title">${esc(it.title)}</div>
              <div class="meta">UID: <code>${esc(it.uid)}</code> • File: <code>${esc(it.file)}</code></div>
              <div class="stats">${esc(it.stats)}</div>
            </div>
          </div>
          <div class="prompt-box">${esc(it.prompt)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>SuMi Family Ver 1.7.1 Mini — Artist Asset Prompts</title>
<style>
  @page { size: A4; margin: 14mm; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    background: #0f0a1a;
    color: #f8fafc;
    margin: 0;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    background: linear-gradient(135deg, #2e1065, #831843);
    border: 1px solid #f472b6;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 18px;
  }
  .header h1 { margin: 0 0 6px; font-size: 20px; color: #fde68a; }
  .header p { margin: 0; font-size: 12px; color: #e2e8f0; }
  .section h2 {
    font-size: 14px;
    color: #f9a8d4;
    border-bottom: 1px solid rgba(244, 114, 182, 0.35);
    padding-bottom: 6px;
    margin: 16px 0 12px;
  }
  .card {
    background: #1a1229;
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .title { font-weight: 700; font-size: 13.5px; color: #fcd34d; margin-bottom: 3px; }
  .meta { font-size: 11px; color: #cbd5e1; margin-bottom: 4px; }
  .stats { font-size: 11px; color: #67e8f9; margin-bottom: 8px; }
  code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; color: #f5d0fe; }
  .prompt-box {
    background: #0b0713;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 10.5px;
    line-height: 1.45;
    color: #e2e8f0;
  }
  .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h1>SuMi Family Ver 1.7.1 Mini — Prompt Pack (4 Boss Linh Mạch + 4 Icon Mới)</h1>
    <p>Phong cách đồng bộ SuMi Tiên Hiệp (Ink &amp; Mineral Gouache • Nền đen #000000 dễ tách nền • Tỉ lệ 1:1 • Không chữ/khung thừa)</p>
  </div>
  ${sectionsHtml}
  <div class="footer">SuMi Family Ver 1.7.1 Mini • Ngày xuất: 28/11/2026 • Lưu trữ tại handoff_docs/SuMi_Ver_1_7_1_Mini_Prompts.pdf</div>
</body>
</html>`;
}

async function main() {
  await fs.promises.mkdir(path.dirname(TMP_HTML), { recursive: true });
  await fs.promises.mkdir(path.dirname(HANDOFF_PDF), { recursive: true });
  await fs.promises.mkdir(path.dirname(ARTIFACT_PDF), { recursive: true });

  await fs.promises.writeFile(TMP_HTML, buildHtml(), 'utf8');
  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const isolatedProfile = path.join(BACKEND_ROOT, 'tmp', 'edge_pdf_profile');
  await fs.promises.mkdir(isolatedProfile, { recursive: true });
  execFileSync(edgeExe, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${isolatedProfile}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${HANDOFF_PDF}`,
    pathToFileURL(TMP_HTML).href,
  ], { stdio: 'inherit' });

  const pdfBuf = await fs.promises.readFile(HANDOFF_PDF);
  await fs.promises.writeFile(ARTIFACT_PDF, pdfBuf);
  console.log(`[generate_v1_7_1_mini_prompts_pdf] Exported PDF (${(pdfBuf.length / 1024).toFixed(1)} KB) -> ${HANDOFF_PDF}`);
}

main().catch((err) => {
  console.error('[generate_v1_7_1_mini_prompts_pdf] FAILED:', err);
  process.exit(1);
});
