/**
 * scripts/generate_v1_8_prompts_pdf.mjs
 * Xuất 2 file PDF Prompt chuẩn AAA Tu Tiên Hiện Đại (Handoff Section 0G + Rule 0G.10) cho Ver 1.8:
 *   1) SuMi_Ver_1_8_Pet_Bond_Icons_Prompts.pdf (16 Game Item & Interaction Icons, 0 trùng custom_emojis.json)
 *   2) SuMi_Ver_1_8_41_Evolved_Bond_Frames_Prompts.pdf (41 Hollow Circular Avatar Frames cho 40 Chân Thần + Hồng Mông Đế Nữ)
 *
 * Output vào CẢ HAI thư mục:
 *   - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\
 *   - C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\brain\6c4e030b-fb59-4575-8414-9779337f61d9\
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { V17_PET_EVOLUTIONS, FUYUMI_SUPREME_EVOLUTION } from '../src/data/v17ExpansionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(BACKEND_ROOT, 'tmp');
const HANDOFF_DOCS_DIR = path.resolve(BACKEND_ROOT, '..', 'handoff_docs');
const ARTIFACT_DIR = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9';

const EMOJIS_PATH = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

const ICON_NEG_LOCK = 'Negative / Forbidden: Zero vintage scroll ink, zero dull antique gouache, zero flat cartoon vector, zero muddy AI oil smudge, zero plastic 3D stiffness, zero human/extra hands with wrong finger count, zero text, zero numbers, zero letters, zero watermark, zero square corner fill, zero outer box or card frame.';

const FRAME_NEG_LOCK = 'Negative / Forbidden: Zero subject/portrait/creature/pet/face inside the center circle (center 70% diameter MUST remain 100% pure solid #000000 black empty void), zero inner halo mist or glow crossing into the center 70% circle, zero vintage flat ink, zero plastic 3D bevel, zero text, zero watermark, zero square border corners.';

const ICONS_DATA = [
  {
    group: 'NHÓM 1 — 8 ICON HÀNH ĐỘNG TƯƠNG TÁC LINH THÚ (/pet)',
    items: [
      {
        uid: 'pet_act_pat',
        title: '1. Vuốt Ve (Pat — Nâng Niu Hào Quang)',
        file: 'pet_act_pat (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Vuốt Ve] trong /pet & log thiện cảm',
        prompt: `AAA modern anime-xianxia game UI icon (Honkai Star Rail / Genshin Impact item render style), fine colored lineart, warm luminous peach-gold translucent spirit energy ribbon curving like a gentle protective crescent cradling two floating glowing pastel lotus-sparkle hearts and soft celestial feather wisps — NO disembodied human hand; crystal-clear glowing jade-gold emblem silhouette readable at 64px Discord emoji size, centered with 12% empty margin on all 4 sides on pure solid #000000 pitch-black background. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_hug',
        title: '2. Ôm Ấp (Hug — Vòng Ôm Lụa Tiên Khí)',
        file: 'pet_act_hug (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Ôm Ấp] trong /pet',
        prompt: `AAA modern anime-xianxia game UI icon (Genshin Impact / Onmyoji 2025 style), fine colored lineart, twin intertwining translucent rose-pink and warm ivory-gold celestial silk ribbons looping gracefully into a warm glowing heart embrace knot around a radiant faceted rose-quartz spirit core gem, delicate golden stardust sparkles, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp readable silhouette at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_sleep',
        title: '3. Ngủ Cùng (Sleep — Trăng Khuyết Mộng Lành)',
        file: 'pet_act_sleep (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Ngủ Cùng] trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, a serene luminous crescent moon carved from pearlescent sapphire-indigo crystal resting atop a soft curled translucent silver-lavender starlight cloud pillow, adorned with a tiny hanging golden star tassel and tranquil glowing dream-motes, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, high contrast at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_play',
        title: '4. Chơi Đùa (Play — Cầu Ngọc Hí Đùa)',
        file: 'pet_act_play (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Chơi Đùa] trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, an ornate translucent azure-jade spirit temari playball wrapped in crisp imperial gold embroidery threads with a tiny crimson-gold bell and swirling turquoise wind ribbons orbiting mid-air in joyful motion, centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp silhouette at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_brush',
        title: '5. Chải Lông (Brush — Ngọc Trâm Lược Tiên)',
        file: 'pet_act_brush (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Chải Lông / Vuốt Vảy] trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Genshin Impact / Onmyoji 2025 style), fine colored lineart, an exquisite carved imperial-gold and translucent white-jade spiritual grooming comb inlaid with an iridescent opal teardrop gem, trailing soft shimmering silver-cyan silk aura wisps and tiny luminous star sparkles, centered floating isolated icon with 12% empty margin on all 4 sides on pure solid #000000 background, crisp at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_snack',
        title: '6. Cho Ăn Vặt (Snack — Bánh Quế Hoa Tiên Lộ)',
        file: 'pet_act_snack (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Cho Ăn Vặt] trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Genshin Impact / Honkai Star Rail food item style), fine colored lineart, two delicate glossy amber-gold and sakura-pink lotus-shaped spirit nectar pastries resting on a dainty porcelain-jade saucer, garnished with luminous golden osmanthus blossoms and faint curling warm sweet aroma ribbons, centered floating isolated icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, readable at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_gift',
        title: '7. Tặng Quà (Gift — Hộp Gấm Đồng Tâm)',
        file: 'pet_act_gift (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút hành động [Tặng Quà] trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, a compact luxury crimson-lacquer and imperial-gold octagonal xianxia gift box tied with a crisp shimmering emerald-jade silk ribbon bow and a faceted golden-amber heart clasp, soft starlight glints radiating cleanly, centered floating isolated icon with 12% empty margin on all 4 sides on pure solid #000000 background, bold 64px silhouette. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'pet_act_chat',
        title: '8. Tâm Sự (Chat — Minh Ngọc Truyền Âm)',
        file: 'pet_act_chat (Discord Emoji & Button Icon • 1:1 • #000000)',
        usage: 'Nút [Tâm Sự / Chat AI] với Linh Thú trong /pet',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, an iridescent sky-cyan and pearl-white translucent jade sound-resonance chime pearl shaped like a sleek glowing lotus speech-emblem with three tiny floating golden harmonic wave crescents beside it (zero text or letters), centered floating isolated icon with 12% empty margin on all 4 sides on pure solid #000000 background, razor-sharp at 64px. ${ICON_NEG_LOCK}`,
      },
    ],
  },
  {
    group: 'NHÓM 2 — 6 ICON BẬC THIỆN CẢM & ĐẶC QUYỀN ĐỒNG HÀNH',
    items: [
      {
        uid: 'bond_tier_low',
        title: '9. Thiện Cảm Cấp Thấp (Xa Lạ / Sơ Giao)',
        file: 'bond_tier_low (Discord Emoji • 1:1 • #000000)',
        usage: 'Badge hiển thị mốc thiện cảm khởi đầu',
        prompt: `AAA modern anime-xianxia game rank emblem icon (Genshin Impact / Honkai Star Rail style), fine colored lineart, a modest tranquil pale silver-azure crystal seed-heart pendant wrapped cleanly in a single delicate silver filigree vine sprout, cool frosted rim-lighting, centered floating isolated icon with 12% empty margin on all 4 sides on pure solid #000000 background, clean silhouette at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'bond_tier_mid',
        title: '10. Thiện Cảm Cấp Trung (Tin Cậy / Thân Thiết)',
        file: 'bond_tier_mid (Discord Emoji • 1:1 • #000000)',
        usage: 'Badge hiển thị mốc thiện cảm trung cấp',
        prompt: `AAA modern anime-xianxia game rank emblem icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, a luminous faceted emerald-jade and cyan twin-petal heart crystal clasped in polished imperial gold filigree with two symmetrical curling spirit-mist wisps, high-contrast dual cyan-gold rim lighting, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'bond_tier_high',
        title: '11. Thiện Cảm Cấp Cao (Khế Ước / Tri Kỷ)',
        file: 'bond_tier_high (Discord Emoji • 1:1 • #000000)',
        usage: 'Badge hiển thị mốc thiện cảm cao cấp',
        prompt: `AAA modern anime-xianxia game rank emblem icon (Honkai Star Rail / Onmyoji 2025 style), fine colored lineart, an ornate faceted violet-amethyst and rose-gold sacred soul-bond heart jewel cradled by a pair of sharp gilded celestial wings and swirling translucent lavender-gold halo ribbons, vivid dual rim lighting, centered floating isolated icon with 12% empty margin on all 4 sides on pure solid #000000 background, readable at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'bond_tier_max',
        title: '12. Thiện Cảm Đỉnh Phong (Sinh Tử Cộng Hưởng)',
        file: 'bond_tier_max (Discord Emoji • 1:1 • #000000)',
        usage: 'Badge mốc Max Thiện Cảm (Chân Thần / Độc Tôn)',
        prompt: `AAA modern anime-xianxia EX rank emblem icon (Honkai Star Rail / Pixiv top artist style), fine colored lineart, a transcendent radiant crimson-magenta and prismatic Hongmeng rainbow diamond heart core crowned with a miniature imperial golden phoenix-dragon diadem and flanked by luminous dual cosmic flame wings, dazzling rim lighting, centered floating icon with 12% empty margin on all 4 sides on pure solid #000000 background, iconic silhouette at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'bond_gift_box',
        title: '13. Túi Quà Thú Cưng Đem Về (Thám Hiểm / Thụ Lộc)',
        file: 'bond_gift_box (Discord Emoji & DM Log • 1:1 • #000000)',
        usage: 'Biểu tượng khi Pet tự mang về LT / TT / Hỗn Độn / Hồng Mông',
        prompt: `AAA modern anime-xianxia game item icon (Genshin Impact / Honkai Star Rail style), fine colored lineart, an exquisite celestial brocade fortune pouch overflowing subtly at the cinched golden mouth with glowing sapphire crystal shards and iridescent golden stardust sparkles, tied with a crimson jade bell charm, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'bond_auto_farm',
        title: '14. Ấn Ký Tự Thu Hoạch Dùm (/farm Passive)',
        file: 'bond_auto_farm (Discord Emoji & DM Log • 1:1 • #000000)',
        usage: 'Biểu tượng khi Pet Thiện Cảm Cao tự chăm/thu hoạch /farm dùm chủ nhân',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact style), fine colored lineart, a radiant emerald-gold spirit lotus harvest seal cradling a tiny faceted jade dewdrop and golden grain sprout inside an open crescent filigree ring (NO square borders), crisp bioluminescent cyan-gold rim lighting, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, legible at 64px. ${ICON_NEG_LOCK}`,
      },
    ],
  },
  {
    group: 'NHÓM 3 — 2 ICON NÂNG CẤP (/upgrade)',
    items: [
      {
        uid: 'upgrade_exp_orb',
        title: '15. Tinh Cầu EXP Linh Thú (/upgrade level)',
        file: 'upgrade_exp_orb (Discord Emoji & Button • 1:1 • #000000)',
        usage: 'Icon đại diện thanh EXP & nâng cấp Level Linh Thú bằng LT / LQ / Đan',
        prompt: `AAA modern anime-xianxia game item icon (Honkai Star Rail / Genshin Impact EXP material style), fine colored lineart, a luminous faceted celestial azure-cyan and star-gold spirit crystal orb swirling internally with ascending liquid galaxy light ribbons and tiny upward golden starlight motes, razor-sharp glossy highlights, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, crystal-clear at 64px. ${ICON_NEG_LOCK}`,
      },
      {
        uid: 'upgrade_star_burst',
        title: '16. Tinh Quang Đột Phá Sao (/upgrade star)',
        file: 'upgrade_star_burst (Discord Emoji & Button • 1:1 • #000000)',
        usage: 'Icon đại diện nút Đột Phá Sao Linh Thú 1★ → 10★',
        prompt: `AAA modern anime-xianxia game item icon (Genshin Impact / Honkai Star Rail ascension icon style), fine colored lineart, an imperial faceted blazing-gold eight-pointed celestial star crystal surrounded by an angled prismatic sapphire-rose cosmic halo ring and crisp radiant burst sparks, intense metallic gold rim lighting, centered floating icon with 12% clean empty margin on all 4 sides on pure solid #000000 background, sharp at 64px. ${ICON_NEG_LOCK}`,
      },
    ],
  },
];

// Palette & motif riêng cho từng hệ và từng Chân Thần để 41 khung KHÔNG bị trùng lặp đơn điệu
const ELEMENT_PALETTE_STYLE = {
  'Hỗn Độn': 'iridescent Hongmeng nebula magenta-rose, royal cosmic violet and imperial star-gold filigree',
  'Hỏa': 'incandescent crimson-scarlet phoenix flames, molten imperial gold and translucent ruby-ember crystals',
  'Kim': 'razor-sharp platinum-silver, radiant pale champagne-gold astral sword reliefs and faceted white-diamond shards',
  'Thủy': 'translucent abyssal sapphire, frosted glacial aqua-cyan water ribbons and luminous sea-pearl filigree',
  'Hư Không': 'deep cosmic indigo-violet stardust, prismatic astral rift crescents and silver-lilac spatial crystal facets',
  'Quang': 'pure radiant celestial sunlight gold, opalescent ivory-white sacred feathers and iridescent prism crystals',
  'Ám': 'velvet obsidian-crimson, dark blood-rose crystal thorns and glowing amethyst shadow wisps',
  'Mộc': 'bioluminescent emerald-jade, blooming celestial lotus petals, luminous golden-green spirit vines and dew pearls',
  'Lôi': 'crackling royal violet-indigo and bright electric gold plasma lightning arcs and thunder-drum crystal sigils',
  'Thổ': 'regal imperial amber-ochre, carved jade-mountain hexagonal reliefs and radiant bronze-gold earth-core gems',
};

const MOTIF_HINTS = {
  hon_don_chi_to_long: 'twin primordial chaos dragon horns and cosmic scale ridges curving neatly along the outer rim',
  thai_so_cuu_phuong_hoang: 'nine layered radiant phoenix tail-feather arcs and flame crest plumes wrapping the outer bezel',
  van_kiem_de_ton_ho: 'crisp crossed astral tiger-fang blades and sharp platinum sword-guard wings flanking the ring',
  bac_hai_huyen_vu_de: 'interlocking ancient sapphire-gold hexagonal Xuanwu shell plates and twin serpent-wave crests',
  thoi_khong_than_tinh_ho: 'glowing celestial astrolabe clockwork rings with ethereal nine-tail fox mist wisps around the edge',
  thai_cuc_thanh_quang_thu: 'balanced luminous gold-and-ivory Taiji halo arcs with four sacred sun-crest crystal feathers',
  cuu_u_do_than_diem_lang: 'jagged dark-crimson wolf-fang obsidian spikes and curling abyssal purple soul-flame crests',
  thanh_de_van_co_long: 'blooming emerald ancient-dragon antlers entwined with radiant jade lotus vines and golden pearls',
  cuu_thien_loi_de_ho: 'crisp orbiting thunder-drum medallions and forked golden-violet fox-tail lightning arcs',
  hoang_thien_ban_co_lan: 'monumental imperial gold qilin-antler reliefs and carved terracotta-jade mountain cornerstones',
  hong_mong_nguyen_phuong: 'majestic Hongmeng rainbow-magenta phoenix pinions sweeping symmetrically around the outer bezel',
  thai_so_van_tuong_ho: 'iridescent primordial illusion silk tails and prismatic chaos-gem lotuses cradling the outer ring',
  phan_thien_kim_o_de: 'radiant three-legged golden sun-crow solar halo spikes and crisp obsidian-gold sunflare petals',
  xich_diem_chuc_long_vuong: 'fiery candle-dragon scales and luminous crimson-gold solar lantern gems along the ring',
  bach_de_tru_tien_ung: 'razor-edged silver-gold divine hawk pinions and miniature hovering sword-crests at 3 and 9 oclock',
  thai_bach_thien_kiem_lan: 'sleek white-gold qilin scales and radiant dual sword-point crescents framing top and bottom',
  thuong_hai_bang_phuong: 'delicate faceted sapphire ice-phoenix feathers and translucent frosted pearl frost-blooms',
  huyen_minh_co_long_vuong: 'deep abyssal sea-dragon fins, glistening aqua crystal coral spikes and misty wave whorls',
  tinh_ha_hu_khong_long: 'sleek constellation star-dragon spine ridges and tiny orbiting crescent space-portals',
  vo_cuc_nguyet_anh_diep: 'translucent stained-glass moon-moth/butterfly wings inlaid with silver-violet stardust veins',
  cuu_tieu_thanh_loan: 'graceful nine-heavens sacred Luan-bird golden ribbons and opalescent sun-pearl plumes',
  nhat_nguyet_thien_ma_de: 'paired golden sun disk at top and crescent silver moon at bottom with winged pegasus filigree',
  vinh_da_huyet_nha_hoang: 'layered blood-obsidian raven wingtips, ruby teardrops and nocturnal violet mist curls',
  u_minh_man_chau_ho: 'glowing crimson spider-lily (Higanbana) petals entwined with phantom silver fox-fire wisps',
  van_hoa_linh_loc_vuong: 'sweeping crystalline spring-stag antlers adorned with tiny sakura-jade blossoms and dew beads',
  thai_at_co_moc_phuong: 'ancient verdant spirit-wood phoenix plumes and glowing emerald leaf-blade filigree',
  tu_tieu_thien_loi_long: 'coiled violet-purple celestial storm-dragon whiskers and jagged gold plasma lightning arcs',
  loi_hoang_kim_dieu: 'sweeping golden roc storm-wings and gleaming electric sapphire talons clasping the lower rim',
  hau_tho_tran_nhac_quy: 'fortified golden-jade mountain rampart reliefs and ancient imperial earth-seal medallions',
  huyen_hoang_thach_su: 'sculpted obsidian-gold guardian lion mane crests and warm amber core gemstones',
  hong_mong_cuu_vy_tien: 'gossamer translucent peach-rose & gold nine-tail spirit ribbons swirling delicately like celestial scarves',
  huyet_nguyet_thien_lang_nu: 'curved blood-moon silver-crimson crescent blades and dark velvet gothic-xianxia hairpin chains',
  xich_diem_phuong_hoang_co: 'flaming golden hairpin diadem and graceful translucent scarlet-amber silk tail ribbons',
  bach_de_kiem_ho_quan: 'crisp white-gold armored collar motifs, twin saber-fang arcs and cold platinum tassel chains',
  thuong_hai_long_nu: 'delicate translucent coral-pearl dragon horns, sea-silk wave sashes and hanging aquamarine drops',
  tu_tieu_loi_ho_quan: 'aristocratic purple-gold fox-ear bell ornaments and crisp swirling lightning-talismans',
  van_hoa_linh_loc_co: 'delicate blooming emerald flower crown and soft floating bioluminescent petal garlands',
  thai_am_ngoc_tho_tien: 'pure crescent moon-jade rabbit ear filigree, pearl lantern drops and soft silver-white celestial silk',
  tinh_ha_nguyet_mieu_co: 'sleek cosmic cat-ear crystal crest, hanging crescent moon bell charm and starry indigo silk loops',
  hoang_thien_ky_lan_quan: 'noble imperial gold qilin crest, warm topaz lotus gems and floating sandstone-gold sash knots',
  cuu_vi_hong_ho: 'exclusive supreme Hongmeng nine-tailed empress regalia: floating nine-petal chaos lotus halo, iridescent rose-gold phoenix-fox ribbons, prismatic cosmic gems and imperial celestial filigree',
};

function buildFramePrompt(petType, evolvedName, element, isFuyumi = false) {
  const palette = ELEMENT_PALETTE_STYLE[element] || ELEMENT_PALETTE_STYLE['Hỗn Độn'];
  const motif = MOTIF_HINTS[petType] || `ornate ${element} celestial beast filigree`;
  return [
    'AAA modern anime-xianxia circular avatar portrait frame border overlay ONLY (Honkai Star Rail / Genshin Impact profile nameplate frame style), fine colored lineart, luxury crystal and metallic filigree craft.',
    `HOLLOW CENTER MANDATE: The entire inner circular area occupying 70% of the canvas diameter MUST remain 100% completely EMPTY pure solid #000000 black void so a user Discord avatar cleanly shows inside — ZERO character, ZERO pet, ZERO emblem, ZERO fog, ZERO glow crossing inside that central 70% circle.`,
    `Outer Ring Band (72% to 90% diameter): ${isFuyumi ? 'Transcendent Supreme Exclusive Empress' : 'Sovereign Chân Thần'} ring sculpted in ${palette}; featuring ${motif}.`,
    'Outer Canvas Margin: Keep 10–12% pure empty #000000 pitch-black margin on ALL 4 edges so zero frame ornament touches the square border.',
    `Theme tag: frame_bond_${petType} (${evolvedName} • Hệ ${element}).`,
    FRAME_NEG_LOCK,
  ].join(' ');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml({ docTitle, subtitle, rulesTitle, rules, negLock, groups }) {
  const rulesHtml = rules.map((r) => `
    <div class="rule-item">
      <div class="rule-title">${esc(r.code)}</div>
      <div class="rule-desc">${esc(r.detail)}</div>
    </div>
  `).join('');

  const sectionsHtml = groups.map((grp) => `
    <div class="section">
      <h2>${esc(grp.group)}</h2>
      ${grp.items.map((it) => `
        <div class="card">
          <div class="title">${esc(it.title)}</div>
          <div class="meta">UID: <code>${esc(it.uid)}</code> • Output: <code>${esc(it.file)}</code></div>
          <div class="stats">${esc(it.usage)}</div>
          <div class="prompt-box">${esc(it.prompt)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${esc(docTitle)}</title>
<style>
  @page { size: A4; margin: 11mm; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    background: #0d0817;
    color: #f8fafc;
    margin: 0;
    padding: 10px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    background: linear-gradient(135deg, #2e1065, #831843);
    border: 1px solid #f472b6;
    border-radius: 10px;
    padding: 12px 15px;
    margin-bottom: 10px;
  }
  .header h1 { margin: 0 0 4px; font-size: 16.5px; color: #fde68a; }
  .header p { margin: 0; font-size: 10.6px; color: #e2e8f0; }
  .rules-box {
    background: #1d1024;
    border: 1.5px solid #fb7185;
    border-radius: 10px;
    padding: 9px 12px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .rules-box h2 {
    margin: 0 0 7px;
    font-size: 12.5px;
    color: #fda4af;
    border-bottom: 1px solid rgba(251, 113, 133, 0.35);
    padding-bottom: 4px;
  }
  .rule-item { margin-bottom: 5px; }
  .rule-item:last-child { margin-bottom: 0; }
  .rule-title { font-size: 10.6px; font-weight: 700; color: #fcd34d; }
  .rule-desc { font-size: 9.8px; color: #f1f5f9; line-height: 1.38; }
  .neg-lock {
    margin-top: 7px;
    background: #090510;
    border: 1px dashed #f43f5e;
    border-radius: 6px;
    padding: 5px 8px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.2px;
    color: #fecdd3;
  }
  .section h2 {
    font-size: 12.5px;
    color: #f9a8d4;
    border-bottom: 1px solid rgba(244, 114, 182, 0.35);
    padding-bottom: 4px;
    margin: 12px 0 8px;
  }
  .card {
    background: #171026;
    border: 1px solid rgba(168, 85, 247, 0.45);
    border-radius: 8px;
    padding: 8px 11px;
    margin-bottom: 7px;
    page-break-inside: avoid;
  }
  .title { font-weight: 700; font-size: 11.8px; color: #fcd34d; margin-bottom: 2px; }
  .meta { font-size: 9.8px; color: #cbd5e1; margin-bottom: 2px; }
  .stats { font-size: 9.8px; color: #67e8f9; margin-bottom: 5px; }
  code { background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 4px; color: #f5d0fe; }
  .prompt-box {
    background: #090612;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 6px;
    padding: 6px 8px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.1px;
    line-height: 1.36;
    color: #e2e8f0;
  }
  .footer { text-align: center; font-size: 9.2px; color: #94a3b8; margin-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${esc(docTitle)}</h1>
    <p>${esc(subtitle)}</p>
  </div>
  <div class="rules-box">
    <h2>${esc(rulesTitle)}</h2>
    ${rulesHtml}
    <div class="neg-lock"><strong>GLOBAL NEGATIVE LOCK:</strong> ${esc(negLock)}</div>
  </div>
  ${sectionsHtml}
  <div class="footer">SuMi Family Ver 1.8 • Chuẩn Handoff Section 0G &amp; Rule 0G.10 • 0 trùng custom_emojis.json</div>
</body>
</html>`;
}

async function renderPdf(htmlContent, baseFilename) {
  const tmpHtml = path.join(TMP_DIR, `${baseFilename}.html`);
  const handoffPdf = path.join(HANDOFF_DOCS_DIR, `${baseFilename}.pdf`);
  const artifactPdf = path.join(ARTIFACT_DIR, `${baseFilename}.pdf`);

  await fs.promises.writeFile(tmpHtml, htmlContent, 'utf8');
  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const isolatedProfile = path.join(TMP_DIR, 'edge_pdf_profile');
  await fs.promises.mkdir(isolatedProfile, { recursive: true });
  execFileSync(edgeExe, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${isolatedProfile}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${handoffPdf}`,
    pathToFileURL(tmpHtml).href,
  ], { stdio: 'inherit' });

  const buf = await fs.promises.readFile(handoffPdf);
  await fs.promises.writeFile(artifactPdf, buf);
  console.log(`[generate_v1_8_prompts_pdf] Exported ${baseFilename}.pdf (${(buf.length / 1024).toFixed(1)} KB) -> handoff_docs & artifacts`);
}

async function main() {
  const existingEmojis = JSON.parse(await fs.promises.readFile(EMOJIS_PATH, 'utf8'));
  const iconIds = ICONS_DATA.flatMap((g) => g.items.map((i) => i.uid));
  const evoKeys = Object.keys(V17_PET_EVOLUTIONS);
  const frameIds = [...evoKeys.map((k) => `frame_bond_${k}`), `frame_bond_${FUYUMI_SUPREME_EVOLUTION.base_pet_type}`];

  const collisions = [...iconIds, ...frameIds].filter((id) => Object.hasOwn(existingEmojis, id));
  if (collisions.length > 0) {
    throw new Error(`Emoji key collision detected with custom_emojis.json: ${collisions.join(', ')}`);
  }
  console.log(`[generate_v1_8_prompts_pdf] Verified 0 collisions (${iconIds.length} icons + ${frameIds.length} frames vs ${Object.keys(existingEmojis).length} existing emojis).`);

  await fs.promises.mkdir(TMP_DIR, { recursive: true });
  await fs.promises.mkdir(HANDOFF_DOCS_DIR, { recursive: true });
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });

  // PDF 1: 16 Icons
  const iconsHtml = buildHtml({
    docTitle: 'SuMi Family Ver 1.8 — Bộ Prompt 16 Icon Tương Tác Pet & Nâng Cấp (AAA Tu Tiên Hiện Đại)',
    subtitle: '8 Icon Hành Động /pet + 6 Icon Thiện Cảm & Tự Thu Hoạch + 2 Icon /upgrade • Chuẩn nền #000000 lề 12% • 0 trùng 1.026 Emojis hiện có',
    rulesTitle: 'QUY TẮC MỸ THUẬT HANDOFF 0G CHO ICON & EMOJI DISCORD',
    rules: [
      { code: 'Luật 0G.1 — Phong Cách Cốt Lõi (AAA Tu Tiên Hiện Đại)', detail: 'Honkai: Star Rail / Genshin Impact / Onmyoji 2025 game item icon: fine colored lineart, rim-lighting sắc nét, vật liệu pha lê & kim hoàn cao cấp, lụa linh khí bán trong suốt.' },
      { code: 'Luật 0G.4 — Cách Ly Nền Đen 12% & Rõ Ở 64px', detail: 'Tất cả icon căn giữa 1:1, chừa ít nhất 12% lề trống ở cả 4 cạnh trên nền đen đặc #000000, hình khối cô đọng sắc nét để thu nhỏ 64×64 Discord emoji không bị rối.' },
      { code: 'Cấm Bàn Tay Dị Dạng & Chữ Trong Icon', detail: 'Không vẽ bàn tay rời dễ lỗi ngón ở cỡ 64px (thay bằng lụa khí/bảo vật biểu trưng); tuyệt đối không chèn chữ/số/watermark.' },
    ],
    negLock: ICON_NEG_LOCK,
    groups: ICONS_DATA,
  });

  // PDF 2: 41 Hollow Circular Bond Frames
  const evoItems = evoKeys.map((k, idx) => {
    const v = V17_PET_EVOLUTIONS[k];
    return {
      uid: `frame_bond_${k}`,
      title: `${idx + 1}. Khung ${v.evolved_name} (Hệ ${v.element})`,
      file: `assets/frames/frame_bond_${k}.png (1:1 • Rỗng Tâm 70% • #000000)`,
      usage: `Khung Avatar mở khóa khi đạt MAX Thiện Cảm cùng ${v.evolved_name}`,
      prompt: buildFramePrompt(k, v.evolved_name, v.element, false),
    };
  });
  const fuyumiItem = {
    uid: `frame_bond_${FUYUMI_SUPREME_EVOLUTION.base_pet_type}`,
    title: `41. [ĐỘC TÔN FUYUMI] Khung ${FUYUMI_SUPREME_EVOLUTION.evolved_name} (Hệ ${FUYUMI_SUPREME_EVOLUTION.element})`,
    file: `assets/frames/frame_bond_${FUYUMI_SUPREME_EVOLUTION.base_pet_type}.png (1:1 • Rỗng Tâm 70% • #000000)`,
    usage: `Khung Avatar Độc Quyền khi Hồng Mông Đế Nữ của Tiểu thư Fuyumi đạt MAX Thiện Cảm`,
    prompt: buildFramePrompt(FUYUMI_SUPREME_EVOLUTION.base_pet_type, FUYUMI_SUPREME_EVOLUTION.evolved_name, FUYUMI_SUPREME_EVOLUTION.element, true),
  };

  const framesHtml = buildHtml({
    docTitle: 'SuMi Family Ver 1.8 — Bộ Prompt 41 Khung Avatar MAX Thiện Cảm (40 Chân Thần + Hồng Mông Đế Nữ)',
    subtitle: 'Chuẩn Rule 0G.10: Khung Vòng Tròn Rỗng Tâm 70% (#000000) • Họa Tiết Ôm Vành 72%–90% • Chừa Lề 10–12% • Độc Bản Từng Chân Thần',
    rulesTitle: 'QUY TẮC 0G.10 — CHUẨN KHUNG AVATAR RỖNG TÂM & TỈ LỆ VÒNG (BẮT BUỘC)',
    rules: [
      { code: 'Rule 0G.10a — Khóa Tâm Trống 70% Tuyệt Đối', detail: 'Vùng tròn trung tâm chiếm 70% đường kính ảnh PHẢI trống hoàn toàn nền đen đặc #000000 để Canvas đè đúng avatar tròn của người chơi. CẤM vẽ mặt thú, nhân vật, sương mù hay tia sáng chọc vào tâm.' },
      { code: 'Rule 0G.10b — Vành Hoa Văn 72%–90% & Lề Ngoài 10–12%', detail: 'Họa tiết sừng, lông vũ, vảy rồng, kiếm quang, lụa tiên chỉ phân bổ quanh vành nhẫn ngoài từ 72% đến 90% đường kính; chừa lề trống #000000 tối thiểu 10–12% ở cả 4 cạnh vuông.' },
      { code: 'Rule 0G.10c — Đồng Bộ Phong Cách & Hậu Kỳ RGBA', detail: 'Chấp hành nét mảnh nhuộm màu AAA Tu Tiên Hiện Đại + cắt alpha trong suốt sạch vùng tâm trước khi lưu assets/frames/frame_bond_<pet_type>.png.' },
    ],
    negLock: FRAME_NEG_LOCK,
    groups: [
      { group: 'PHẦN 1 — 40 KHUNG TỐI THƯỢNG CHÂN THẦN (V17_PET_EVOLUTIONS)', items: evoItems },
      { group: 'PHẦN 2 — 1 KHUNG ĐỘC TÔN TỐI THƯỢNG THẦN THOẠI (FUYUMI)', items: [fuyumiItem] },
    ],
  });

  await renderPdf(iconsHtml, 'SuMi_Ver_1_8_Pet_Bond_Icons_Prompts');
  await renderPdf(framesHtml, 'SuMi_Ver_1_8_41_Evolved_Bond_Frames_Prompts');
}

main().catch((err) => {
  console.error('[generate_v1_8_prompts_pdf] FAILED:', err);
  process.exit(1);
});
