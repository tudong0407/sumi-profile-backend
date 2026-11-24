/**
 * scripts/generate_v1_6_1_alchemy_pdf.mjs
 * Xuất PDF v2 Bộ Prompt 16 Ảnh cho Hệ Thống Lò Luyện Đan (/luyendan — v1.6.1):
 * - 5 Cấp Lò Luyện Đan chuẩn Đan Lô Tu Tiên cỡ lớn (KHÔNG phải lư hương để bàn)
 * - 5 Bản Lò Bị Nổ Hỏng tương ứng từng cấp (bắt buộc Rule Img2Img đính kèm ảnh gốc cùng cấp)
 * - 6 Viên Đan Dược thành phẩm
 *
 * Lưu tại:
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SuMi_v1_6_1_LuyenDan_Prompts_v2.pdf
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SuMi_v1_6_1_LuyenDan_Prompts.pdf
 * - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\brain\6c4e030b-fb59-4575-8414-9779337f61d9\SuMi_v1_6_1_LuyenDan_Prompts_v2.pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const HANDOFF_V2_PDF = path.resolve(BACKEND_ROOT, '..', 'handoff_docs', 'SuMi_v1_6_1_LuyenDan_Prompts_v2.pdf');
const HANDOFF_MAIN_PDF = path.resolve(BACKEND_ROOT, '..', 'handoff_docs', 'SuMi_v1_6_1_LuyenDan_Prompts.pdf');
const ARTIFACT_V2_PDF = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\SuMi_v1_6_1_LuyenDan_Prompts_v2.pdf';
const TMP_HTML = path.join(BACKEND_ROOT, 'tmp', 'SuMi_v1_6_1_LuyenDan_Prompts_v2.html');

const FURNACE_PAIRS = [
  {
    level: 1,
    intactFile: 'furnace_lv1.png',
    intactTitle: 'Lò Lv.1 — Thổ Đào Dược Đỉnh (Nguyên Vẹn)',
    intactPrompt: 'Realistic large floor-standing Eastern Xianxia clay pill-refining alchemy furnace (Đan Lô Tu Tiên cỡ lớn, NOT a small tabletop incense burner, NO joss sticks, NO ash bowl) resting on a heavy stone hearth platform inside an herbalist alchemy chamber. Waist-high thick bulbous dark terracotta refining chamber bound with hammered iron hoops, wide arched lower firebox opening at the base glowing with burning wood-charcoal and iron grate, heavy sealed earthen dome lid with twin steam-release vents and iron locking clasps. Wooden herb drying racks and ceramic medicine jars in the background to show large scale. Warm hearth firelight, natural daylight from lattice window, grounded realistic craft photography, no neon CGI, 1:1 square.',
    explodedFile: 'furnace_lv1_exploded.png',
    explodedTitle: 'Lò Lv.1 — Thổ Đào Dược Đỉnh (BỊ NỔ HỎNG)',
    explodedRule: 'BẮT BUỘC đính kèm ảnh furnace_lv1.png làm ảnh tham chiếu (Image Reference)',
    explodedPrompt: '[STRICT IMAGE-TO-IMAGE RULE: Use furnace_lv1.png as the exact structural reference. Preserve the EXACT same terracotta furnace silhouette, iron hoops, arched firebox base, camera angle, framing, and alchemy room background. Do NOT redesign the furnace — ONLY transform this exact furnace into a violently exploded and damaged state.] Deep jagged blast fractures split down the dark terracotta belly with broken clay chunks fallen onto the stone hearth, bent snapped iron hoop, heavy earthen lid blown crookedly off-center with soot-blackened steam vents, scorched charcoal ash and ruined charred pill crumbs scattered around the base, thick grey-black smoke billowing from the ruptured chamber, extinguished dull embers inside the firebox. Grounded realistic damage, 1:1 square.',
  },
  {
    level: 2,
    intactFile: 'furnace_lv2.png',
    intactTitle: 'Lò Lv.2 — Thanh Đồng Đan Lô (Nguyên Vẹn)',
    intactPrompt: 'Realistic massive floor-standing antique patinated bronze Xianxia pill-refining alchemy furnace (Thanh Đồng Đan Lô cỡ lớn, NOT a small tabletop incense burner, NO joss sticks) standing on a carved granite hearth plinth in a traditional Daoist alchemy hall. Heavy waist-high verdigris bronze cauldron with three thick beast-claw legs, open arched lower stoking firebox mouth glowing with hot amber charcoal embers, thick sealed round refining belly engraved with archaic Bagua trigrams and cloud reliefs, heavy bronze pressure lid locked with twin dragon-ring clasps and narrow vapor vents. Wooden apothecary cabinets and mortar tools behind for large scale. Warm natural hearth lighting, authentic weathered bronze patina, realistic photography, no neon glow, 1:1 square.',
    explodedFile: 'furnace_lv2_exploded.png',
    explodedTitle: 'Lò Lv.2 — Thanh Đồng Đan Lô (BỊ NỔ HỎNG)',
    explodedRule: 'BẮT BUỘC đính kèm ảnh furnace_lv2.png làm ảnh tham chiếu (Image Reference)',
    explodedPrompt: '[STRICT IMAGE-TO-IMAGE RULE: Use furnace_lv2.png as the exact structural reference. Preserve the EXACT same verdigris bronze furnace shape, three beast-claw legs, Bagua reliefs, granite plinth, camera angle, and alchemy hall background. Do NOT redesign into a different object — ONLY show this exact furnace ruptured after an alchemy explosion.] Wide blackened blast crack tearing open the bronze refining belly with warped inward/outward metal edges, one dragon-ring clasp snapped off, heavy bronze lid blown ajar and charred black, thick dark smoke and faint dying sparks leaking out of the fissure, soot streaks staining the green bronze patina, scorched ash and cracked ruined pill residue across the plinth. Grounded realism, 1:1 square.',
  },
  {
    level: 3,
    intactFile: 'furnace_lv3.png',
    intactTitle: 'Lò Lv.3 — Xích Hỏa Huyền Đỉnh (Nguyên Vẹn)',
    intactPrompt: 'Realistic monumental forged black-iron and red-copper Xianxia pill-refining alchemy furnace (Xích Hỏa Huyền Đỉnh cỡ lớn, NOT a small incense burner, NO joss sticks) anchored on a carved basalt hearth dais in a stone alchemy forge room. Chest-high heavy hammered black-iron cauldron inlaid with crimson-copper flame channels, wide vaulted firebox hearth opening below with roaring orange-red charcoal fire behind an iron grate, thick sealed double-walled refining belly with pressure rivets and twin heavy handles, tiered iron-and-copper dome lid with pressure relief chimneys venting faint golden medicinal vapor. Stone medicine jars and tongs nearby for scale. Moody warm forge lighting, realistic metalwork texture, no sci-fi neon, 1:1 square.',
    explodedFile: 'furnace_lv3_exploded.png',
    explodedTitle: 'Lò Lv.3 — Xích Hỏa Huyền Đỉnh (BỊ NỔ HỎNG)',
    explodedRule: 'BẮT BUỘC đính kèm ảnh furnace_lv3.png làm ảnh tham chiếu (Image Reference)',
    explodedPrompt: '[STRICT IMAGE-TO-IMAGE RULE: Use furnace_lv3.png as the exact structural reference. Preserve the EXACT same black-iron and red-copper furnace design, firebox grate, basalt dais, camera angle, and forge room background. Do NOT invent a new furnace — ONLY show this exact furnace damaged by an internal pill explosion.] Soot-blackened rupture splitting the riveted black-iron belly and warping the copper flame inlays, blown-open tiered lid hanging crookedly off its hinges, shattered iron grate at the firebox spilling cooled dark ash and dying embers onto the basalt dais, heavy grey-black smoke pouring from the cracked chamber and chimneys, scorched pill debris on the floor. Authentic heat-damaged metal texture, 1:1 square.',
  },
  {
    level: 4,
    intactFile: 'furnace_lv4.png',
    intactTitle: 'Lò Lv.4 — Tử Kim Long Văn Lô (Nguyên Vẹn)',
    intactPrompt: 'Realistic grand palace-grade purple-gold bronze and dark-jade Xianxia pill-refining alchemy furnace (Tử Kim Long Văn Lô cỡ lớn, NOT a small incense burner, NO joss sticks) set on an octagonal stone hearth altar inside a dignified master alchemy pavilion. Tall imposing burnished plum-gold alloy cauldron with deeply chiseled coiling dragon relief around the thick refining belly, lower arched hearth firebox glowing with steady golden-amber fire, carved nephrite jade seal rings and heavy locking latches holding a multi-tiered dragon-finial pressure dome lid with fine mist escaping from the vents. Tall apothecary shelves and jade scroll cases behind for monumental scale. Warm lantern and hearth lighting, museum-grade metal realism, no CGI neon, 1:1 square.',
    explodedFile: 'furnace_lv4_exploded.png',
    explodedTitle: 'Lò Lv.4 — Tử Kim Long Văn Lô (BỊ NỔ HỎNG)',
    explodedRule: 'BẮT BUỘC đính kèm ảnh furnace_lv4.png làm ảnh tham chiếu (Image Reference)',
    explodedPrompt: '[STRICT IMAGE-TO-IMAGE RULE: Use furnace_lv4.png as the exact structural reference. Preserve the EXACT same purple-gold dragon-relief furnace, octagonal stone altar, camera angle, lighting setup, and master alchemy pavilion background. Do NOT redesign — ONLY depict this exact furnace shattered after an alchemy blowout.] A jagged scorched blast fissure cleaving right through the chiseled dragon relief on the purple-gold belly, shattered nephrite jade ring fragments on the stone altar, tilted cracked dragon-finial lid knocked sideways with broken latches, dense black-grey smoke curling out of the ruptured core, blackened soot coating the burnished gold surface and extinguished ash spilling from the lower firebox. Grounded realism, 1:1 square.',
  },
  {
    level: 5,
    intactFile: 'furnace_lv5.png',
    intactTitle: 'Lò Lv.5 — Hỗn Độn Cửu Chuyển Đỉnh (Nguyên Vẹn)',
    intactPrompt: 'Realistic imperial monumental dark-nephrite-jade and ancient-gilt-bronze Xianxia pill-refining alchemy furnace (Hỗn Độn Cửu Chuyển Đỉnh cỡ lớn, NOT a small incense burner, NO joss sticks) standing in a serene stone-pillared alchemy sanctum. Tall imposing translucent ink-green jade cauldron reinforced by heavy ancient-gold-bronze ribs, nine suspended bronze spirit rings along the rim, wide carved stone-and-bronze lower firebox hearth burning with warm golden-white embers, massive sealed nine-turn refining chamber and heavy carved jade-and-bronze pressure dome lid venting tranquil ivory-gold medicinal cloud. Ancient stone pillars and elixir cabinets in background for grand scale. Chiaroscuro natural lighting, ultra-detailed realism, no laser neon, 1:1 square.',
    explodedFile: 'furnace_lv5_exploded.png',
    explodedTitle: 'Lò Lv.5 — Hỗn Độn Cửu Chuyển Đỉnh (BỊ NỔ HỎNG)',
    explodedRule: 'BẮT BUỘC đính kèm ảnh furnace_lv5.png làm ảnh tham chiếu (Image Reference)',
    explodedPrompt: '[STRICT IMAGE-TO-IMAGE RULE: Use furnace_lv5.png as the exact structural reference. Preserve the EXACT same ink-green nephrite jade and gilt-bronze nine-ring furnace, stone hearth base, camera angle, and stone-pillared sanctum background. Do NOT replace the design — ONLY render this exact furnace cracked and ruined by an overload explosion.] Deep spiderweb fractures and a gaping soot-charred hole blown through the ink-green jade chamber, snapped bent gilt-bronze ribs, several suspended spirit rings fallen onto the ash-strewn floor, heavy dome lid blown crooked and cracked in half, thick grey-black smoke and dull ember soot pouring from the ruptured interior. Authentic cracked stone-jade and scorched bronze realism, 1:1 square.',
  },
];

const PILL_PROMPTS = [
  {
    file: 'pill_t1.png',
    title: 'Bậc 1 — Tụ Khí Thanh Đan',
    prompt: 'Realistic macro studio photograph of a single smooth pale celadon-green herbal alchemy pill (Tụ Khí Thanh Đan), slightly matte natural mineral-jade sheen, resting inside a small handmade dark stoneware dish lined with natural linen cloth. Subtle dried medicinal herbs softly blurred in the background, warm natural window light, serene Eastern apothecary aesthetic, no neon glow, 1:1 square.',
  },
  {
    file: 'pill_t2.png',
    title: 'Bậc 2 — Trúc Cơ Ngọc Lộ Đan',
    prompt: 'Realistic macro studio photograph of a lustrous translucent mutton-fat white and dew-aqua jade elixir pill (Trúc Cơ Ngọc Lộ Đan), smooth porcelain-like polish with faint natural mineral veining, placed on a carved dark walnut tray with celadon ceramic cup nearby. Soft morning light, refined traditional craft photography, authentic stone-jade texture, no CGI glow, 1:1 square.',
  },
  {
    file: 'pill_t3.png',
    title: 'Bậc 3 — Kim Đan Hỏa Linh Đan',
    prompt: 'Realistic macro studio photograph of a rich amber-crimson and burnished-gold alchemy pill (Kim Đan Hỏa Linh Đan) with delicate natural cinnabar-gold marbling across its sphere, resting on an antique black lacquer and silk brocade cushion inside an open carved wooden pill box. Warm candlelight accents, crisp tactile detail, authentic museum photography, no artificial neon, 1:1 square.',
  },
  {
    file: 'pill_t4.png',
    title: 'Bậc 4 — Nguyên Anh Cửu Chuyển Đan',
    prompt: 'Realistic macro studio photograph of an extraordinary deep imperial-gold and midnight-indigo patterned pill (Nguyên Anh Cửu Chuyển Đan) showing natural nine-ring swirled cloud veins on its polished surface, displayed on a white nephrite lotus pedestal inside an heirloom brocade box. Soft warm directional studio light, fine gold-leaf and jade mineral texture, dignified realism, 1:1 square.',
  },
  {
    file: 'pill_ess_1.png',
    title: 'Tinh Hoa I — Linh Quả Thanh Tâm Đan (Dùng Linh Quả /farm)',
    prompt: 'Realistic macro studio photograph of a vibrant emerald-green botanical essence elixir pill (Linh Quả Thanh Tâm Đan) with natural dewdrop gloss and subtle golden leaf-vein markings, nestled on a dark stone dish beside two fresh translucent spirit-fruit berries and green tea leaves. Crisp natural daylight, fresh organic apothecary photography, no plastic CGI, 1:1 square.',
  },
  {
    file: 'pill_ess_2.png',
    title: 'Tinh Hoa II — Hồng Mông Tạo Hóa Đan (Dùng 40 Linh Quả /farm)',
    prompt: 'Realistic macro studio photograph of a supreme antique bronze-violet and starlight-gold marbled elixir pill (Hồng Mông Tạo Hóa Đan) featuring fine natural cloud-swirl rings (Đan Vân) on a satin-polished mineral sphere, resting on carved black obsidian and golden silk brocade beside an antique jade seal. Rich warm museum spotlight, extraordinary tactile realism, no sci-fi neon, 1:1 square.',
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml() {
  const pairsHtml = FURNACE_PAIRS.map((p) => `
    <div class="pair-block">
      <div class="card intact">
        <div class="card-head">
          <span class="title">Cấp ${p.level} (Nguyên) • ${esc(p.intactTitle)}</span>
          <code class="file">${esc(p.intactFile)}</code>
        </div>
        <div class="prompt">${esc(p.intactPrompt)}</div>
      </div>
      <div class="card exploded">
        <div class="card-head">
          <span class="title danger">Cấp ${p.level} (Hỏng) • ${esc(p.explodedTitle)}</span>
          <code class="file danger-file">${esc(p.explodedFile)}</code>
        </div>
        <div class="rule-tag">${esc(p.explodedRule)}</div>
        <div class="prompt">${esc(p.explodedPrompt)}</div>
      </div>
    </div>
  `).join('\n');

  const pillsHtml = PILL_PROMPTS.map((p, idx) => `
    <div class="card">
      <div class="card-head">
        <span class="title">${idx + 1}. ${esc(p.title)}</span>
        <code class="file">${esc(p.file)}</code>
      </div>
      <div class="prompt">${esc(p.prompt)}</div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>SuMi v1.6.1 — Bộ Prompt v2 (16 Ảnh Lò Luyện Đan &amp; Lò Hỏng Đồng Bộ)</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; margin: 0; font-size: 9.8pt; line-height: 1.38; }
  .header { border-bottom: 2px solid #ec4899; padding-bottom: 7px; margin-bottom: 10px; }
  h1 { font-size: 15pt; color: #be185d; margin: 0 0 4px 0; }
  .sub { font-size: 9pt; color: #4b5563; margin: 0; }
  .rules-box { background: #fff1f2; border: 1.5px solid #f43f5e; border-radius: 7px; padding: 8px 10px; margin-bottom: 10px; font-size: 9pt; }
  .rules-box strong { color: #9f1239; }
  h2 { font-size: 11.5pt; color: #9d174d; border-left: 4px solid #ec4899; padding-left: 8px; margin: 12px 0 8px 0; page-break-after: avoid; }
  .pair-block { page-break-inside: avoid; margin-bottom: 10px; border-left: 3px solid #cbd5e1; padding-left: 7px; }
  .card { border: 1px solid #e5e7eb; border-radius: 7px; padding: 7px 9px; margin-bottom: 6px; background: #fafafa; page-break-inside: avoid; }
  .card.exploded { background: #fef2f2; border-color: #fecaca; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px; }
  .title { font-weight: 700; color: #111827; font-size: 9.8pt; }
  .title.danger { color: #991b1b; }
  .file { background: #fce7f3; color: #9d174d; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 8.6pt; font-weight: 600; }
  .danger-file { background: #fee2e2; color: #991b1b; }
  .rule-tag { font-size: 8.5pt; font-weight: 700; color: #b91c1c; margin-bottom: 4px; }
  .prompt { font-size: 8.9pt; color: #374151; background: #ffffff; border: 1px dashed #d1d5db; border-radius: 5px; padding: 5px 7px; }
</style>
</head>
<body>
  <div class="header">
    <h1>SuMi Family v1.6.1 — Bộ Prompt v2: Lò Luyện Đan (5 Cặp Nguyên/Hỏng + 6 Đan Dược)</h1>
    <p class="sub">Tổng cộng: <strong>16 ảnh PNG (1:1, 1024×1024)</strong> • Lưu đúng tên file rồi chạy: <code>node scripts/install_v1_6_1_assets.mjs --dir "&lt;thư mục ảnh&gt;"</code></p>
  </div>
  <div class="rules-box">
    <strong>QUY TẮC BẮT BUỘC KHI GEN ẢNH:</strong><br/>
    1. <strong>Chống nhầm Lư Hương:</strong> Mọi prompt Lò đã khóa cứng dáng <strong>Đan Lô đặt sàn cỡ lớn cao ngang hông/ngực</strong>, có <strong>buồng đốt lửa hở phía dưới</strong>, thân tròn dày luyện đan, nắp chốt áp suất và kệ thuốc xung quanh để ra đúng tỷ lệ Lò Luyện Đan Tu Tiên.<br/>
    2. <strong>Quy Tắc Đồng Bộ Lò Hỏng (Image-to-Image):</strong> Với 5 ảnh <code>furnace_lv1_exploded.png</code> → <code>furnace_lv5_exploded.png</code>, <strong>BẮT BUỘC đính kèm ảnh <code>furnace_lv&#123;N&#125;.png</code> vừa gen xong</strong> làm ảnh tham chiếu rồi mới dán prompt hỏng để AI giữ nguyên 100% cùng 1 chiếc lò, chỉ làm nứt vỡ &amp; ám khói nổ lò!
  </div>
  <h2>PHẦN I — 5 CẶP LÒ LUYỆN ĐAN (NGUYÊN VẸN &amp; NỔ HỎNG ĐỒNG BỘ • 10 ẢNH)</h2>
  ${pairsHtml}
  <h2>PHẦN II — 6 VIÊN ĐAN DƯỢC THÀNH PHẨM (6 ẢNH)</h2>
  ${pillsHtml}
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
  await fs.promises.mkdir(path.dirname(HANDOFF_V2_PDF), { recursive: true });
  await fs.promises.mkdir(path.dirname(ARTIFACT_V2_PDF), { recursive: true });

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
      `--print-to-pdf=${HANDOFF_V2_PDF}`,
      pathToFileURL(TMP_HTML).href,
    ]);
    pdfBuf = await fs.promises.readFile(HANDOFF_V2_PDF);
  }

  await fs.promises.writeFile(HANDOFF_V2_PDF, pdfBuf);
  await fs.promises.writeFile(HANDOFF_MAIN_PDF, pdfBuf);
  await fs.promises.writeFile(ARTIFACT_V2_PDF, pdfBuf);
  console.log(`[generate_v1_6_1_alchemy_pdf] Exported 16-prompt v2 PDF (${(pdfBuf.length / 1024).toFixed(1)} KB) -> ${HANDOFF_V2_PDF}`);
}

main().catch((err) => {
  console.error('[generate_v1_6_1_alchemy_pdf] FAILED:', err);
  process.exit(1);
});
