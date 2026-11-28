/**
 * scripts/generate_v1_7_1_mini_prompts_pdf.mjs
 * Xuất PDF Prompt chuẩn AAA Tu Tiên Hiện Đại Ver 1.7.1 Mini cho Tiểu thư:
 * - Tích hợp ĐẦY ĐỦ 8 LUẬT MỸ THUẬT từ Handoff Section 0G (AAA Modern Anime-Xianxia, NO Vintage Flat Ink/AI Plastic,
 *   Isolation 12% margin NO Square Box, Negative Lock, 70/30 Gender Balance, CẤM LẶP POSE "ngửa mặt nhìn lên trời + xòe tay ra camera",
 *   Khóa QA Giải Phẫu Bàn Tay ĐÚNG 5 NGÓN).
 * - Gồm 4 Boss Linh Mạch mới (SS, SS+, SSS, SSS+) + 4 Icon Tính Năng mới (/thuongtra, [Ké Chén], /thaplinhhuong, Giờ Hoàng Đạo).
 *
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

const HANDOFF_ART_RULES = [
  {
    code: 'Luật 1 — Phong Cách Cốt Lõi (AAA Tu Tiên Hiện Đại)',
    detail: 'AAA modern anime-xianxia splash art phong cách Honkai: Star Rail / Genshin Impact / Onmyoji 2025 / Pixiv Top Artist: nét mảnh nhuộm màu (fine colored lineart) hòa mượt khối sáng tối trong trẻo, rim-lighting tương phản cao, lụa linh khí bán trong suốt, pha lê tán sắc, tia plasma sắc cạnh, mắt ngọc biểu cảm, trang sức kim hoàn tinh xảo.',
  },
  {
    code: 'Luật 2 — Cấm Tuyệt Đối 2 Thái Cực Lỗi Thời',
    detail: 'CẤM tranh cổ phẳng/lì (vintage scroll, flat woodblock ink, dull desaturated antique gouache) VÀ CẤM rác AI rẻ tiền (muddy oil smudge, plastic 3D CGI stiffness, melted anatomy, từ khóa rác 8k/masterpiece/hyperrealistic).',
  },
  {
    code: 'Luật 3 & 4 — Phân Tầng Lộng Lẫy + Cách Ly Chống Khung Vuông (ISOLATION 12%)',
    detail: 'Self-contained floating organic medallion/vignette căn giữa chừa lề trống >= 12% ở CẢ 4 CẠNH — hào quang không chạm mép ảnh vuông, nền đen đặc #000000 (hoặc PNG trong suốt / trắng #FFFFFF) để tách nền sạch, KHÔNG đóng khung thẻ bài hay viền vuông lên ảnh.',
  },
  {
    code: 'Luật 7 & 8a — Tỉ Lệ ~70% Nữ / 30% Nam & CẤM LẶP POSE',
    detail: 'Ưu tiên ~70% tạo hình Nữ / Thú Nhân uyển chuyển kèm linh thú bản thể phát quang sau lưng. CẤM TUYỆT ĐỐI khuôn nhân vật nam "ngửa mặt nhìn lên trời + giơ tay xòe về phía camera", CẤM khuôn "nhìn lệch một bên rồi đưa tay xòe ra". Phải chỉ định từng pose riêng biệt: cầm kiếm bằng hai tay trước ngực, ngồi ngai chống trượng, xoay lưng ngoái nhìn qua vai, tung pháp khí góc nghiêng...',
  },
  {
    code: 'Luật 8b — Khóa QA Giải Phẫu Bàn Tay ĐÚNG 5 NGÓN (Ưu Tiên Số 1)',
    detail: 'Mọi prompt nhân vật BẮT BUỘC khóa: "anatomically accurate hands with exactly five well-proportioned natural fingers per hand" và ưu tiên tay đang NẮM CHẶT chuôi kiếm / trượng / quạt thay vì xòe tay không. PHẢI zoom soi ngón tay 100% trước khi duyệt nhập server (loại thẳng ảnh 4 ngón, 6 ngón hoặc dính khớp).',
  },
];

const GLOBAL_NEGATIVE_LOCK = 'Negative / Forbidden: Zero upward chin tilt looking at the sky, zero open hand splayed reaching toward the viewer/camera, zero male upward-gaze palm-reach cliché, zero side-glance hand-reaching repetition, zero mutated/6/4/fused fingers, zero vintage traditional dull antique gouache, zero flat woodblock ink, zero muddy AI oil-paint smear, zero plastic 3D CGI stiffness, zero text, zero watermark, zero square corner fill, zero baked frame or card border.';

const ASSET_PROMPTS = [
  {
    group: 'PHẦN 1 — 4 BOSS LINH MẠCH MỚI (/linhmach — assets/veins/*.png • Đã áp dụng Pose Đa Dạng + Cấm Ngửa Mặt Xòe Tay + 5 Ngón)',
    items: [
      {
        uid: 'vein_mine_ss',
        title: 'Hạng SS — Tinh Hà Kiếm Ngục Tôn (Nam Kiếm Đế — Thế Thủ Nghiêm Nhìn Thẳng, Hai Tay Nắm Trọng Kiếm)',
        file: 'assets/veins/vein_mine_ss.png (1:1 • #000000)',
        stats: 'Lực: 240,000 • 68 LT/phút • Hệ Kim • AoE 40% • Khiên 25% • Giảm ST 15% • Pose: Cầm kiếm bằng 2 tay, mắt nhìn thẳng sắc lạnh',
        prompt: [
          'AAA modern anime-xianxia character splash icon in Honkai Star Rail and Onmyoji style, fine colored lineart, high-contrast celestial gold and silver-indigo rim lighting.',
          'Subject: A dignified imperial male sword sovereign wearing flowing white-gold and midnight-blue armored robes with sharp metallic star motifs.',
          'STRICT POSE RULE: Head level looking forward with piercing focused eyes (level chin, calm intimidating direct gaze), standing in a grounded martial stance with BOTH hands firmly gripping the hilt of a massive glowing astral greatsword held vertically in front of his torso — zero open palm gesture, hands wrapped naturally around the hilt with anatomically accurate hands and exactly five well-proportioned natural fingers per hand.',
          'Back & Aura: Orbiting ring of translucent crystalline astral blades, geometric golden star-prison sigils, floating metallic spirit ore shards forming a self-contained floating circular vignette centered with 12% clean empty margin on all 4 sides.',
          'Background: Pure solid #000000 pitch-black exterior for razor-clean cutout.',
          GLOBAL_NEGATIVE_LOCK,
        ].join(' '),
      },
      {
        uid: 'vein_mine_ssp',
        title: 'Hạng SS+ — Băng Phách Huyền Đế Quân (Nữ Long-Quy Thần Đế — Ngồi Nghiêng Ngai Băng, Cầm Trượng Hàn Ngọc)',
        file: 'assets/veins/vein_mine_ssp.png (1:1 • #000000)',
        stats: 'Lực: 380,000 • 82 LT/phút • Hệ Thủy • AoE 45% • Khiên 35% • Giảm ST 20% • Phản 15% • Đảm bảo tỉ lệ 70/30 Nữ/Nam',
        prompt: [
          'AAA modern anime-xianxia sovereign splash icon in Honkai Star Rail and Genshin Impact style, fine colored lineart, translucent faceted sapphire ice crystals, luminescent cyan and royal blue dual rim-lighting.',
          'Subject: A regal female glacial empress (celestial dragon-tortoise spirit maiden with subtle translucent frost-jade horns and crystal hairpins) clad in layered flowing ice-silk and pearl-silver xianxia gown.',
          'STRICT POSE RULE: Seated gracefully at a 3/4 angle upon a floating lotus-shaped glacial crystal throne, chin slightly lowered in serene royal authority looking straight toward the viewer; one hand resting calmly holding an ornate frosted-jade imperial scepter vertically, the other hand delicately holding a folded translucent crystal folding fan against her sleeve — anatomically accurate hands with exactly five well-proportioned natural fingers per hand, zero reaching palm toward camera.',
          'Back & Aura: Luminous translucent spectral Xuanwu dragon-tortoise spirit coiling behind her inside swirling abyssal water ribbons, self-contained floating organic vignette with 12% clean empty #000000 margin on all 4 sides.',
          'Background: Pure solid #000000 pitch-black exterior.',
          GLOBAL_NEGATIVE_LOCK,
        ].join(' '),
      },
      {
        uid: 'vein_mine_sss',
        title: 'Hạng SSS — Thái Sơ Lôi Đình Đạo Tổ (Thiền Tọa Lơ Lửng Góc Nghiêng Động — Cầm Chày Lôi & Ấn Quyết)',
        file: 'assets/veins/vein_mine_sss.png (1:1 • #000000)',
        stats: 'Lực: 560,000 • 100 LT/phút • Hệ Lôi • AoE 50% • Khiên 45% • Giảm ST 25% • Phản 20% • Miễn CC Cơ Bản',
        prompt: [
          'AAA modern anime-xianxia character splash icon in Honkai Star Rail and Onmyoji 2025 style, fine colored lineart, razor-sharp violet and imperial-gold plasma lightning arcs, vivid rim lighting.',
          'Subject: An ancient yet sharp-featured primordial thunder dao patriarch in dark-violet and gold celestial daoist vestments with floating storm ribbons.',
          'STRICT POSE RULE: Levitating cross-legged in mid-air meditation posture at a dynamic diagonal angle, head slightly bowed looking fiercely downward toward enemies below (level/downward commanding gaze, NEVER tilted skyward); right hand firmly grasping an electrified golden vajra-thunderbolt staff across his lap, left hand resting on his knee holding a floating crackling Bagua thunder seal orb — anatomically accurate hands with exactly five well-proportioned natural fingers per hand.',
          'Back & Aura: Floating ring of luminous violet-gold thunder drums and radiant lightning lion-beast spirit silhouette shimmering behind him, tapered cleanly inside a floating circular vignette with 12% empty #000000 margin on all 4 sides.',
          'Background: Pure solid #000000 pitch-black exterior.',
          GLOBAL_NEGATIVE_LOCK,
        ].join(' '),
      },
      {
        uid: 'vein_mine_sssp',
        title: 'Hạng SSS+ (1%) — Hồng Mông Chung Cực Thánh Hoàng (Nữ Thánh Hoàng Hỗn Độn — Xoay 3/4 Ngoái Nhìn, Cầm Quyền Trượng Cửu Hoàn)',
        file: 'assets/veins/vein_mine_sssp.png (1:1 • #000000)',
        stats: 'Lực: 850,000 • 125 LT/phút • Hệ Hỗn Độn • AoE 55% • Khiên 60% • Giảm ST 30% • Phản 25% • Miễn Mọi CC',
        prompt: [
          'AAA modern anime-xianxia UR/EX supreme sovereign splash icon in Honkai Star Rail and Pixiv top artist style, iridescent magenta-rose, imperial gold and cosmic obsidian dual rim-lighting, crystalline nebula particles.',
          'Subject: A transcendent female Hongmeng chaos empress with flowing silver-peach cosmic hair, golden phoenix-dragon crown and layered translucent celestial nebula silk robes adorned with fine filigree jewelry.',
          'STRICT POSE RULE: Three-quarter back-turning dynamic pose glancing proudly over her shoulder directly toward the viewer with luminous amber-magenta gem eyes; holding a radiant nine-ringed Hongmeng cosmic scepter diagonally in her right hand while her left hand gathers glowing nebula silk ribbons gracefully at chest height — anatomically accurate hands with exactly five well-proportioned natural fingers per hand, zero reaching splayed hand toward camera.',
          'Back & Aura: Translucent glowing primordial cosmic dragon-phoenix spirit coiling through a luminous nine-ring sacred star halo behind her, self-contained floating organic vignette with 12% clean empty margin on all 4 sides.',
          'Background: Pure solid #000000 pitch-black exterior.',
          GLOBAL_NEGATIVE_LOCK,
        ].join(' '),
      },
    ],
  },
  {
    group: 'PHẦN 2 — 4 ICON TÍNH NĂNG MỚI (Chuẩn AAA Anime-Xianxia Game Item Icon — Lề Trống 12% • Nền Đen #000000)',
    items: [
      {
        uid: 'tea_ceremony_pot',
        title: 'Ấm Trà Tiên Đạo (/thuongtra)',
        file: 'tea_ceremony_pot (Discord Emoji & Embed)',
        stats: 'Pha miễn phí 3 ấm/ngày • Nhận 200–300 LT ngay',
        prompt: 'AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact item render), fine colored lineart, luminous jade-celadon porcelain teapot inlaid with delicate embossed imperial-gold cloud filigree and faceted emerald crystal lid finial, warm translucent jade-gold spiritual tea mist ribbons curling gently upward from the spout; centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, glossy ceramic rim-lighting, readable silhouette at 64px Discord emoji size, zero text, zero square borders.',
      },
      {
        uid: 'tea_cup_cheers',
        title: 'Chén Trà Đối Ẩm (Nút [Ké Chén])',
        file: 'tea_cup_cheers (Button Emoji)',
        stats: 'Tối đa 2 khách/ấm (2 phút) • Cả 2 nhận 200–300 LT + (%Luck × 5 LT)',
        prompt: 'AAA modern anime-xianxia game item icon (Genshin Impact / Honkai Star Rail style), fine colored lineart, a pair of delicate translucent white-jade and emerald-gold teacups tilting together mid-air in a graceful cheers toast, glowing golden tea ripples, tiny luminous lotus petals and stardust sparks swirling between the cups; centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, crisp readable silhouette at 64px Discord emoji size, zero text, zero square borders.',
      },
      {
        uid: 'spirit_incense_burner',
        title: 'Lư Đồng Thắp Linh Hương (/thaplinhhuong)',
        file: 'spirit_incense_burner (Command & Buff Icon)',
        stats: 'Phí 600–800 LT theo Luck • Tăng +5% đến +15% Luck đến 24:00 UTC+7',
        prompt: 'AAA modern anime-xianxia game item icon (Honkai Star Rail / Onmyoji item render), fine colored lineart, ornate three-legged imperial bronze-gold dragon incense censer inlaid with glowing ruby-amber spirit gems, three slender sandalwood incense sticks burning with crisp glowing embers and curling luminous peach-gold auspicious smoke ribbons; centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp high-contrast silhouette at 64px, zero text, zero square borders.',
      },
      {
        uid: 'auspicious_hour_bell',
        title: 'Chuông Vàng Giờ Hoàng Đạo (+10% Luck Server)',
        file: 'auspicious_hour_bell (Server Event & Luck Sync Icon)',
        stats: 'Mở 11:00 • 17:00 • 21:00 UTC+7 • Toàn Server +10% Luck',
        prompt: 'AAA modern anime-xianxia game item icon (Genshin Impact / Honkai Star Rail item style), fine colored lineart, radiant celestial golden temple handbell engraved with sun-cloud daoist reliefs and tied with a flowing crimson-gold silk ribbon tassel, translucent golden chime soundwave rings and sparkling starlight particles radiating smoothly around the bell; centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, luminous metallic gold highlights, readable at 64px, zero text, zero borders.',
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
  const rulesHtml = HANDOFF_ART_RULES.map((r) => `
    <div class="rule-item">
      <div class="rule-title">${esc(r.code)}</div>
      <div class="rule-desc">${esc(r.detail)}</div>
    </div>
  `).join('');

  const sectionsHtml = ASSET_PROMPTS.map((grp) => `
    <div class="section">
      <h2>${esc(grp.group)}</h2>
      ${grp.items.map((it) => `
        <div class="card">
          <div class="title">${esc(it.title)}</div>
          <div class="meta">UID: <code>${esc(it.uid)}</code> • File: <code>${esc(it.file)}</code></div>
          <div class="stats">${esc(it.stats)}</div>
          <div class="prompt-box">${esc(it.prompt)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>SuMi Family Ver 1.7.1 Mini — AAA Art Prompts &amp; Handoff Art Rules</title>
<style>
  @page { size: A4; margin: 12mm; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    background: #0d0817;
    color: #f8fafc;
    margin: 0;
    padding: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    background: linear-gradient(135deg, #2e1065, #831843);
    border: 1px solid #f472b6;
    border-radius: 10px;
    padding: 13px 16px;
    margin-bottom: 12px;
  }
  .header h1 { margin: 0 0 4px; font-size: 17.5px; color: #fde68a; }
  .header p { margin: 0; font-size: 11px; color: #e2e8f0; }
  .rules-box {
    background: #1d1024;
    border: 1.5px solid #fb7185;
    border-radius: 10px;
    padding: 10px 13px;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .rules-box h2 {
    margin: 0 0 8px;
    font-size: 13px;
    color: #fda4af;
    border-bottom: 1px solid rgba(251, 113, 133, 0.35);
    padding-bottom: 4px;
  }
  .rule-item { margin-bottom: 6px; }
  .rule-item:last-child { margin-bottom: 0; }
  .rule-title { font-size: 11px; font-weight: 700; color: #fcd34d; }
  .rule-desc { font-size: 10.2px; color: #f1f5f9; line-height: 1.4; }
  .neg-lock {
    margin-top: 8px;
    background: #090510;
    border: 1px dashed #f43f5e;
    border-radius: 6px;
    padding: 6px 9px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.5px;
    color: #fecdd3;
  }
  .section h2 {
    font-size: 13px;
    color: #f9a8d4;
    border-bottom: 1px solid rgba(244, 114, 182, 0.35);
    padding-bottom: 5px;
    margin: 14px 0 9px;
  }
  .card {
    background: #171026;
    border: 1px solid rgba(168, 85, 247, 0.45);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 9px;
    page-break-inside: avoid;
  }
  .title { font-weight: 700; font-size: 12.5px; color: #fcd34d; margin-bottom: 2px; }
  .meta { font-size: 10.2px; color: #cbd5e1; margin-bottom: 3px; }
  .stats { font-size: 10.2px; color: #67e8f9; margin-bottom: 6px; }
  code { background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 4px; color: #f5d0fe; }
  .prompt-box {
    background: #090612;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 6px;
    padding: 7px 9px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.6px;
    line-height: 1.4;
    color: #e2e8f0;
  }
  .footer { text-align: center; font-size: 9.5px; color: #94a3b8; margin-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <h1>SuMi Family Ver 1.7.1 Mini — Bộ Prompt AAA Tu Tiên Hiện Đại &amp; Luật Mỹ Thuật Handoff (0G)</h1>
    <p>Phong cách Honkai: Star Rail / Genshin Impact / Onmyoji 2025 • Nền đen #000000 chừa lề 12% • Đã khóa CẤM ngửa mặt nhìn trời &amp; xòe tay • Khóa QA 5 ngón</p>
  </div>

  <div class="rules-box">
    <h2>QUY TẮC MỸ THUẬT BẮT BUỘC TỪ HANDOFF (SECTION 0G — LUẬT 1..8 &amp; QA 5 NGÓN)</h2>
    ${rulesHtml}
    <div class="neg-lock"><strong>GLOBAL NEGATIVE LOCK:</strong> ${esc(GLOBAL_NEGATIVE_LOCK)}</div>
  </div>

  ${sectionsHtml}
  <div class="footer">SuMi Family Ver 1.7.1 Mini • Cập nhật chuẩn Handoff 0G &amp; Rule #8 • Ngày xuất: 28/11/2026</div>
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
  console.log(`[generate_v1_7_1_mini_prompts_pdf] Exported AAA + Handoff Rules PDF (${(pdfBuf.length / 1024).toFixed(1)} KB) -> ${HANDOFF_PDF}`);
}

main().catch((err) => {
  console.error('[generate_v1_7_1_mini_prompts_pdf] FAILED:', err);
  process.exit(1);
});
