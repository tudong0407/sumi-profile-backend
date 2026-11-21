/**
 * scripts/generate_v1_3_prompts_pdf.mjs
 * Kiểm định toàn vẹn 237 UID & Prompt cho Bản Cập Nhật v1.3, dựng HTML chuẩn in A4,
 * và xuất file PDF tại C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\handoff_docs\SUMI_V1_3_AI_PROMPTS_FULL.pdf
 * bằng Microsoft Edge Headless (--user-data-dir riêng để không đụng process Edge đang mở).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { PET_CATALOG, EQUIPMENT_CATALOG, SHOP_CONSUMABLES } from '../src/data/catalog.js';
import {
  V13_DOMAIN_ELEMENTS,
  V13_DOMAINS,
  V13_DIVINE_SENSES,
  V13_DIVINE_REALMS,
  V13_NEW_PETS,
  V13_NEW_EQUIPMENT,
  V13_MINIGAME_EMOJI_PROMPTS,
  V13_FARM_ASSETS,
} from '../src/data/v13ExpansionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const HANDOFF_DOCS_DIR = path.resolve(BACKEND_ROOT, '..', 'handoff_docs');
const OUTPUT_PDF_PATH = path.join(HANDOFF_DOCS_DIR, 'SUMI_V1_3_AI_PROMPTS_FULL.pdf');
const TMP_HTML_DIR = path.join(BACKEND_ROOT, 'tmp');
const TMP_HTML_PATH = path.join(TMP_HTML_DIR, 'SUMI_V1_3_AI_PROMPTS_FULL.html');

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

function assertCatalogIntegrity() {
  const uniquePets = V13_NEW_PETS.filter((p) => p.is_unique && p.rarity_key === 'mythic');
  const nonUniqueMythicPets = V13_NEW_PETS.filter((p) => !p.is_unique && p.rarity_key === 'mythic');
  const lowerPets = V13_NEW_PETS.filter((p) => ['common', 'rare', 'epic'].includes(p.rarity_key));

  if (V13_NEW_PETS.length !== 50 || uniquePets.length !== 10 || nonUniqueMythicPets.length !== 30 || lowerPets.length !== 10) {
    throw new Error(`Invalid V13_NEW_PETS counts: total=${V13_NEW_PETS.length}, unique=${uniquePets.length}, mythic=${nonUniqueMythicPets.length}, lower=${lowerPets.length}`);
  }

  const weapons = V13_NEW_EQUIPMENT.filter((e) => e.item_type === 'weapon');
  const gems = V13_NEW_EQUIPMENT.filter((e) => e.item_type === 'gem');
  const souls = V13_NEW_EQUIPMENT.filter((e) => e.item_type === 'soul');
  const uniqueEquip = V13_NEW_EQUIPMENT.filter((e) => e.is_unique && e.rarity_key === 'mythic');
  const nonUniqueMythicEquip = V13_NEW_EQUIPMENT.filter((e) => !e.is_unique && e.rarity_key === 'mythic');
  const lowerEquip = V13_NEW_EQUIPMENT.filter((e) => ['common', 'rare', 'epic'].includes(e.rarity_key));

  if (
    V13_NEW_EQUIPMENT.length !== 100
    || weapons.length !== 34
    || gems.length !== 33
    || souls.length !== 33
    || uniqueEquip.length !== 30
    || nonUniqueMythicEquip.length !== 50
    || lowerEquip.length !== 20
  ) {
    throw new Error(`Invalid V13_NEW_EQUIPMENT counts: total=${V13_NEW_EQUIPMENT.length}, w=${weapons.length}, g=${gems.length}, s=${souls.length}, u=${uniqueEquip.length}, m=${nonUniqueMythicEquip.length}, l=${lowerEquip.length}`);
  }

  const publicDomains = V13_DOMAINS.filter((d) => !d.is_exclusive_fuyumi);
  const uniqueDomains = publicDomains.filter((d) => d.is_unique);
  const mythicNonUniqueDomains = publicDomains.filter((d) => !d.is_unique && d.rarity_key === 'mythic');
  if (V13_DOMAINS.length !== 31 || publicDomains.length !== 30 || uniqueDomains.length !== 5 || mythicNonUniqueDomains.length !== 10) {
    throw new Error(`Invalid V13_DOMAINS counts: total=${V13_DOMAINS.length}`);
  }
  if (V13_DIVINE_SENSES.length !== 16 || V13_DIVINE_REALMS.length !== 16) {
    throw new Error(`Invalid senses/realms counts: senses=${V13_DIVINE_SENSES.length}, realms=${V13_DIVINE_REALMS.length}`);
  }
  if (V13_MINIGAME_EMOJI_PROMPTS.length !== 17 || V13_FARM_ASSETS.length !== 7) {
    throw new Error(`Invalid minigame/farm counts: mg=${V13_MINIGAME_EMOJI_PROMPTS.length}, farm=${V13_FARM_ASSETS.length}`);
  }

  // Enforce zero UID collisions with existing catalog + Discord emoji regex /^[a-z0-9_]{2,32}$/
  const existingIds = new Set([
    ...PET_CATALOG.map((p) => p.pet_type),
    ...EQUIPMENT_CATALOG.map((e) => e.item_id),
    ...SHOP_CONSUMABLES.map((c) => c.item_id),
  ]);

  const seenNewIds = new Set();
  const discordEmojiRe = /^[a-z0-9_]{2,32}$/;
  const allNewEntries = [
    ...V13_MINIGAME_EMOJI_PROMPTS.map((x) => ({ uid: x.uid, label: x.name, prompt: x.visual_prompt })),
    ...V13_DOMAINS.map((x) => ({ uid: x.domain_id, label: x.name, prompt: x.visual_prompt })),
    ...V13_DIVINE_SENSES.map((x) => ({ uid: x.sense_id, label: x.name, prompt: x.visual_prompt })),
    ...V13_DIVINE_REALMS.map((x) => ({ uid: x.realm_id, label: x.name, prompt: x.visual_prompt })),
    ...V13_NEW_PETS.map((x) => ({ uid: x.pet_type, label: x.pet_name, prompt: x.visual_prompt })),
    ...V13_NEW_EQUIPMENT.map((x) => ({ uid: x.item_id, label: x.item_name, prompt: x.visual_prompt })),
    ...V13_FARM_ASSETS.map((x) => ({ uid: x.uid, label: x.name, prompt: x.visual_prompt })),
  ];

  for (const item of allNewEntries) {
    if (!discordEmojiRe.test(item.uid)) {
      throw new Error(`UID "${item.uid}" (${item.label}) violates Discord emoji name rules (/^[a-z0-9_]{2,32}$/)`);
    }
    if (existingIds.has(item.uid)) {
      throw new Error(`UID collision with existing catalog: "${item.uid}"`);
    }
    if (seenNewIds.has(item.uid)) {
      throw new Error(`Duplicate UID inside v1.3 catalog: "${item.uid}"`);
    }
    seenNewIds.add(item.uid);

    if (!item.prompt || item.prompt.trim().length < 100) {
      throw new Error(`Prompt too short (<100 chars) for "${item.uid}"`);
    }
  }

  return allNewEntries.length;
}

function rarityBadge(rarityKey, isUnique = false, isFuyumi = false) {
  if (isFuyumi) return '<span class="badge badge-supreme">Tối Thượng Độc Tôn Fuyumi</span>';
  const labels = {
    common: ['Phàm Phẩm', 'badge-common'],
    rare: ['Linh Phẩm', 'badge-rare'],
    epic: ['Tiên Phẩm', 'badge-epic'],
    mythic: ['Thần Thoại', 'badge-mythic'],
    supreme: ['Tối Thượng', 'badge-supreme'],
  };
  const [text, cls] = labels[rarityKey] || ['Phàm Phẩm', 'badge-common'];
  const uniqueBadge = isUnique ? '<span class="badge badge-unique">Độc Nhất Server</span>' : '';
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>${uniqueBadge}`;
}

function renderCard({ index, uid, title, badgesHtml, metaLines = [], effectDesc = '', prompt }) {
  const metaHtml = metaLines
    .filter(Boolean)
    .map((m) => `<span class="meta-pill">${escapeHtml(m)}</span>`)
    .join('');

  return `
    <article class="prompt-card">
      <div class="card-header">
        <div class="card-title-row">
          <span class="card-idx">#${String(index).padStart(3, '0')}</span>
          <h3 class="card-title">${escapeHtml(title)}</h3>
        </div>
        <div class="card-badges">
          <code class="uid-tag">:${escapeHtml(uid)}:</code>
          ${badgesHtml || ''}
        </div>
      </div>
      ${metaHtml ? `<div class="meta-row">${metaHtml}</div>` : ''}
      ${effectDesc ? `<p class="effect-desc">${escapeHtml(effectDesc)}</p>` : ''}
      <div class="prompt-box">
        <div class="prompt-label">AI IMAGE PROMPT (READY TO PASTE)</div>
        <pre class="prompt-text">${escapeHtml(prompt)}</pre>
      </div>
    </article>`;
}

function buildHtmlDocument(totalCount) {
  let idx = 0;
  const nextIdx = () => { idx += 1; return idx; };

  const minigameCards = V13_MINIGAME_EMOJI_PROMPTS.map((m) =>
    renderCard({
      index: nextIdx(),
      uid: m.uid,
      title: `${m.game} — ${m.name}`,
      badgesHtml: `<span class="badge badge-anim">${escapeHtml(m.type)}</span>`,
      metaLines: [`Emoji UID & Tên File: ${m.uid}`, m.usage],
      prompt: m.visual_prompt,
    }),
  ).join('\n');

  const domainCards = V13_DOMAINS.map((d) =>
    renderCard({
      index: nextIdx(),
      uid: d.domain_id,
      title: d.name,
      badgesHtml: rarityBadge(d.rarity_key, d.is_unique, d.is_exclusive_fuyumi),
      metaLines: [
        `Hệ Vực: ${d.element}`,
        `Linh Mạch Gốc: ${d.base_energy >= 999 ? '∞ Bất Hoại' : d.base_energy}`,
        `Xuyên Debuff khi Vực địch còn: ${Math.round(d.enemy_active_debuff_pierce * 100)}%`,
        d.enemy_buff_suppression > 0 ? `Giảm Buff Vực địch: ${Math.round(d.enemy_buff_suppression * 100)}%` : null,
      ],
      effectDesc: `Buff sân nhà: ${d.buff_desc} | Debuff lên địch: ${d.debuff_desc}`,
      prompt: d.visual_prompt,
    }),
  ).join('\n');

  const senseCards = V13_DIVINE_SENSES.map((s) =>
    renderCard({
      index: nextIdx(),
      uid: s.sense_id,
      title: `Thần Thức: ${s.name}`,
      badgesHtml: rarityBadge(s.rarity_key, s.is_unique, s.is_exclusive_fuyumi),
      metaLines: [
        s.bonus_energy >= 999 ? 'Gia cố: ∞ Linh Mạch' : `Gia cố: +${s.bonus_energy} Linh Mạch`,
        `Tăng Buff sân nhà: +${Math.round(s.buff_boost_pct * 100)}%`,
        s.clash_resist_chance > 0 ? `Kháng hao tổn khắc hệ: ${Math.round(s.clash_resist_chance * 100)}%` : null,
      ],
      effectDesc: s.desc,
      prompt: s.visual_prompt,
    }),
  ).join('\n');

  const realmCards = V13_DIVINE_REALMS.map((r) =>
    renderCard({
      index: nextIdx(),
      uid: r.realm_id,
      title: `Thần Cảnh: ${r.name}`,
      badgesHtml: rarityBadge(r.rarity_key, r.is_unique, r.is_exclusive_fuyumi),
      metaLines: [
        `Cường hóa Debuff gốc: +${Math.round(r.debuff_boost_pct * 100)}%`,
        `Kèm Debuff Độc Lập Mới`,
      ],
      effectDesc: r.desc,
      prompt: r.visual_prompt,
    }),
  ).join('\n');

  const petCards = V13_NEW_PETS.map((p) =>
    renderCard({
      index: nextIdx(),
      uid: p.pet_type,
      title: p.pet_name,
      badgesHtml: rarityBadge(p.rarity_key, p.is_unique, false),
      metaLines: [
        `Hệ: ${p.element}`,
        `ATK ${p.base_atk} • DEF ${p.base_def} • SPD ${p.base_spd}`,
        `HAX: ${p.hax_skill}`,
      ],
      effectDesc: p.hax_description,
      prompt: p.visual_prompt,
    }),
  ).join('\n');

  const renderEquipGroup = (slotType, heading) => {
    const items = V13_NEW_EQUIPMENT.filter((e) => e.item_type === slotType);
    const cards = items.map((it) => {
      const statParts = [];
      if (it.bonus_atk) statParts.push(`ATK +${it.bonus_atk}`);
      if (it.bonus_def) statParts.push(`DEF +${it.bonus_def}`);
      if (it.bonus_spd) statParts.push(`SPD +${it.bonus_spd}`);
      if (it.bonus_hp) statParts.push(`HP +${it.bonus_hp.toLocaleString('vi-VN')}`);
      if (it.bonus_crit) statParts.push(`Crit +${it.bonus_crit}%`);
      return renderCard({
        index: nextIdx(),
        uid: it.item_id,
        title: it.item_name,
        badgesHtml: rarityBadge(it.rarity_key, it.is_unique, false),
        metaLines: [
          `Nhánh: ${heading}`,
          `Hệ: ${it.element}`,
          statParts.join(' • '),
          it.hax_skill ? `HAX: ${it.hax_skill}` : null,
        ],
        effectDesc: it.hax_description,
        prompt: it.visual_prompt,
      });
    }).join('\n');
    return `
      <div class="subsection-header">
        <h3>${escapeHtml(heading)} (${items.length} món mới)</h3>
      </div>
      ${cards}`;
  };

  const weaponGroupHtml = renderEquipGroup('weapon', '4A. Vũ Khí Mới');
  const gemGroupHtml = renderEquipGroup('gem', '4B. Bảo Ngọc Mới');
  const soulGroupHtml = renderEquipGroup('soul', '4C. Chiến Hồn Mới');

  const farmCards = V13_FARM_ASSETS.map((f) =>
    renderCard({
      index: nextIdx(),
      uid: f.uid,
      title: f.name,
      badgesHtml: `<span class="badge badge-farm">${escapeHtml(f.slot_type)}</span>`,
      metaLines: [f.care_window, f.reward_summary],
      prompt: f.visual_prompt,
    }),
  ).join('\n');

  const cycleChain = `${V13_DOMAIN_ELEMENTS.cycle.join(' → ')} → ${V13_DOMAIN_ELEMENTS.cycle[0]}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>SuMi Family v1.3 — Bộ Prompt Tạo Ảnh & Emoji Động Chuẩn UID (${totalCount} Assets)</title>
  <style>
    @page {
      size: A4;
      margin: 13mm 12mm 14mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', 'Arial', sans-serif;
      color: #1e1b4b;
      background: #ffffff;
      font-size: 9.2pt;
      line-height: 1.42;
    }
    .cover {
      border: 2px solid #4338ca;
      border-radius: 12px;
      padding: 20px 22px;
      background: linear-gradient(135deg, #f8faff 0%, #fdf2f8 100%);
      margin-bottom: 18px;
      break-after: page;
    }
    .cover-kicker {
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #7c3aed;
      margin-bottom: 6px;
    }
    .cover h1 {
      margin: 0 0 8px 0;
      font-size: 20pt;
      color: #1e1b4b;
      line-height: 1.2;
    }
    .cover-sub {
      margin: 0 0 14px 0;
      font-size: 10pt;
      color: #475569;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 12px 0 16px;
    }
    .stat-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 9px 10px;
      text-align: center;
    }
    .stat-num {
      font-size: 15pt;
      font-weight: 800;
      color: #4338ca;
      display: block;
    }
    .stat-lbl {
      font-size: 7.8pt;
      color: #475569;
      font-weight: 600;
    }
    .guide-box {
      background: #ffffff;
      border: 1px solid #c7d2fe;
      border-left: 4px solid #4f46e5;
      border-radius: 8px;
      padding: 11px 14px;
      margin-bottom: 10px;
    }
    .guide-box h2 {
      margin: 0 0 6px 0;
      font-size: 10.5pt;
      color: #312e81;
    }
    .guide-box ul {
      margin: 0;
      padding-left: 16px;
    }
    .guide-box li { margin-bottom: 3px; }
    code {
      font-family: 'Cascadia Code', 'Consolas', monospace;
      background: #eef2ff;
      color: #3730a3;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 8.3pt;
    }
    .section-banner {
      background: linear-gradient(90deg, #312e81 0%, #6d28d9 100%);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      margin: 16px 0 10px;
      break-after: avoid;
    }
    .section-banner h2 {
      margin: 0;
      font-size: 12.5pt;
      letter-spacing: 0.2px;
    }
    .section-banner p {
      margin: 3px 0 0 0;
      font-size: 8.4pt;
      color: #e0e7ff;
    }
    .subsection-header {
      border-bottom: 2px solid #4f46e5;
      margin: 12px 0 8px;
      padding-bottom: 3px;
      break-after: avoid;
    }
    .subsection-header h3 {
      margin: 0;
      font-size: 10.5pt;
      color: #312e81;
    }
    .prompt-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 8px;
      background: #fcfdff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .card-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-idx {
      background: #1e1b4b;
      color: #ffffff;
      font-weight: 700;
      font-size: 7.5pt;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
    }
    .card-title {
      margin: 0;
      font-size: 9.8pt;
      color: #0f172a;
      font-weight: 700;
    }
    .card-badges {
      display: flex;
      gap: 4px;
      align-items: center;
      flex-wrap: wrap;
    }
    .uid-tag {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      color: #0f172a;
      font-weight: 700;
      font-size: 8pt;
      padding: 1px 6px;
    }
    .badge {
      font-size: 7.2pt;
      font-weight: 700;
      padding: 1.5px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .badge-common { background: #e2e8f0; color: #334155; }
    .badge-rare { background: #dbeafe; color: #1d4ed8; }
    .badge-epic { background: #f3e8ff; color: #7e22ce; }
    .badge-mythic { background: #fef3c7; color: #b45309; border: 1px solid #f59e0b; }
    .badge-unique { background: #fee2e2; color: #b91c1c; border: 1px solid #ef4444; }
    .badge-supreme { background: #fce7f3; color: #be185d; border: 1px solid #ec4899; }
    .badge-anim { background: #cffafe; color: #0e7490; border: 1px solid #06b6d4; }
    .badge-farm { background: #dcfce7; color: #15803d; border: 1px solid #22c55e; }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }
    .meta-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 7.5pt;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .effect-desc {
      margin: 2px 0 5px 0;
      font-size: 8pt;
      color: #334155;
    }
    .prompt-box {
      background: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 5px 8px;
    }
    .prompt-label {
      font-size: 6.8pt;
      font-weight: 800;
      letter-spacing: 0.7px;
      color: #4f46e5;
      margin-bottom: 2px;
    }
    .prompt-text {
      margin: 0;
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 7.7pt;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
      color: #0f172a;
    }
    .page-break { break-before: page; }
  </style>
</head>
<body>

  <section class="cover">
    <div class="cover-kicker">SuMi Family • Tu Tiên Giới Nhiễm Nhiễm • Update v1.3</div>
    <h1>Toàn Thư Prompt Tạo Ảnh AI & Emoji Động Chuẩn UID (${totalCount} Assets)</h1>
    <p class="cover-sub">
      Tài liệu sản xuất mỹ thuật đồng bộ 100% mã UID Discord Emoji (tên emoji trùng khớp 1:1 với mã UID trong database để gõ/copy-paste thẳng vào mọi lệnh).
    </p>

    <div class="stats-grid">
      <div class="stat-box"><span class="stat-num">${V13_MINIGAME_EMOJI_PROMPTS.length}</span><span class="stat-lbl">Emoji Minigame (Động/Tĩnh)</span></div>
      <div class="stat-box"><span class="stat-num">${V13_DOMAINS.length + V13_DIVINE_SENSES.length + V13_DIVINE_REALMS.length}</span><span class="stat-lbl">Linh Vực + Thần Thức + Thần Cảnh</span></div>
      <div class="stat-box"><span class="stat-num">${V13_NEW_PETS.length}</span><span class="stat-lbl">Linh Thú Mới (40 Thần Thoại)</span></div>
      <div class="stat-box"><span class="stat-num">${V13_NEW_EQUIPMENT.length + V13_FARM_ASSETS.length}</span><span class="stat-lbl">Pháp Bảo Mới & Nông Trại</span></div>
    </div>

    <div class="guide-box">
      <h2>1. Quy Tắc Kỹ Thuật Ảnh Tĩnh & Emoji Discord (PNG)</h2>
      <ul>
        <li><strong>Đặt tên file & tên Emoji Discord</strong>: Dùng chính xác chuỗi UID in đậm trong khung xám (ví dụ <code>cuu_tieu_kim_long.png</code> -> upload Emoji tên <code>:cuu_tieu_kim_long:</code>). Toàn bộ ${totalCount} UID đều chuẩn hóa <code>2–32 ký tự [a-z0-9_]</code>.</li>
        <li><strong>Kích thước khuyến nghị</strong>: Xuất ảnh gốc AI ở tỷ lệ vuông <code>1:1</code> (<code>1024×1024px</code>), tách nền trong suốt (hoặc nền tối đồng nhất cho Card Wiki/Profile), sau đó nén xuống <code>128×128px (&lt; 256 KB)</code> làm Emoji Discord.</li>
        <li><strong>Công cụ đề xuất</strong>: Gemini Imagen 3 / Flux.1 Dev / Midjourney v6 (tắt text watermark, bật tham số nền trong suốt nếu tạo icon UI).</li>
      </ul>
    </div>

    <div class="guide-box">
      <h2>2. Quy Trình Dựng Emoji Động GIF Cho Minigame (&lt; 256 KB)</h2>
      <ul>
        <li><strong>Bước 1 (Tạo Sprite Sheet)</strong>: Copy nguyên văn Prompt có nhãn <em>Animated GIF (6–8 frames)</em> vào công cụ AI để xuất 1 dải ảnh ngang (horizontal strip) chứa 6 hoặc 8 khung hình nối tiếp nhau.</li>
        <li><strong>Bước 2 (Cắt & Ghép GIF chuẩn Discord)</strong>: Chia dải ngang thành 6–8 frame vuông bằng nhau (<code>128×128px</code> mỗi frame), giữ nguyên nền trong suốt (RGBA) và xuất GIF lặp vô hạn với độ trễ <code>65–80ms/frame</code> (12–15 FPS).</li>
        <li><strong>Lệnh FFmpeg / ImageMagick một dòng gợi ý</strong>: <code>magick sprite.png -crop 8x1@ +repage -resize 128x128 -set delay 7 -loop 0 -layers OptimizePlus coin_spin.gif</code> (đảm bảo dung lượng <code>&lt; 256 KB</code> để upload lên Discord Application Emoji).</li>
      </ul>
    </div>

    <div class="guide-box">
      <h2>3. Tóm Tắt Vòng Tương Khắc 5 Hệ Vực Mới (Linh Vực Hiệp 2+)</h2>
      <ul>
        <li><strong>Vòng Tương Khắc</strong>: <code>${escapeHtml(cycleChain)}</code> (Hệ khắc giảm <code>-1</code> Linh Mạch/hiệp; Hệ bị khắc giảm <code>-2</code> Linh Mạch/hiệp).</li>
        <li><strong>Hỗn Độn Vực (Độc Tôn Fuyumi)</strong>: Bất hoại (<code>∞</code> Linh Mạch), khắc toàn bộ 5 Hệ Vực, xuyên 100% Debuff ngay từ Hiệp 2 và khóa 100% Debuff Vực địch.</li>
      </ul>
    </div>
  </section>

  <section>
    <div class="section-banner">
      <h2>PHẦN I — 17 EMOJI ĐỘNG & TĨNH CHO 4 MINIGAME (/coinflip, /slots 4 ô, /blackjack, /crash)</h2>
      <p>Gồm 5 Animated GIF (coin_spin, slot_spin, card_deal, crash_fly, crash_boom) + 12 Emoji tĩnh độ phân giải 128×128px tối ưu hiệu ứng Edit tin nhắn sau 2 giây.</p>
    </div>
    ${minigameCards}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN II — HỆ THỐNG LINH VỰC (${V13_DOMAINS.length}), THẦN THỨC (${V13_DIVINE_SENSES.length}) & THẦN CẢNH (${V13_DIVINE_REALMS.length})</h2>
      <p>30 Linh Vực Công Khai + 15 Thần Thức + 15 Thần Cảnh + Bộ Độc Tôn Hỗn Độn của Tiểu thư Fuyumi. Cân bằng sức mạnh giữa Thần Thoại Độc Nhất và Không Độc Nhất &lt;= 15%.</p>
    </div>
    <div class="subsection-header"><h3>2A. 31 Linh Vực (30 Công Khai + 1 Độc Tôn Fuyumi)</h3></div>
    ${domainCards}
    <div class="subsection-header"><h3>2B. 16 Thần Thức — Gia Cố Trần Linh Mạch &amp; Buff Sân Nhà</h3></div>
    ${senseCards}
    <div class="subsection-header"><h3>2C. 16 Thần Cảnh — Cường Hóa &amp; Gán Thêm Debuff Lên Địch</h3></div>
    ${realmCards}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN III — 50 LINH THÚ MỚI (10 Thần Thoại Độc Nhất • 30 Thần Thoại Thường • 10 Phàm/Linh/Tiên)</h2>
      <p>Nâng tổng kho Linh Thú SuMi Family lên 91 loài. Tên Emoji trùng khớp 100% với pet_type UID.</p>
    </div>
    ${petCards}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN IV — 100 PHÁP BẢO MỚI (34 Vũ Khí • 33 Bảo Ngọc • 33 Chiến Hồn)</h2>
      <p>Gồm 30 Thần Thoại Độc Nhất + 50 Thần Thoại Không Độc Nhất + 20 Phàm/Linh/Tiên (Chênh lệch tổng lực giữa Độc Nhất &amp; Thường &lt;= 15%).</p>
    </div>
    ${weaponGroupHtml}
    ${gemGroupHtml}
    ${soulGroupHtml}
  </section>

  <section class="page-break">
    <div class="section-banner">
      <h2>PHẦN V — 7 ICON NÔNG TRẠI THỜI GIAN THỰC (/farm) &amp; ĐỔI QUÀ (/exchange)</h2>
      <p>Đồng Linh Quả Tiên Giới (farm_essence) cùng 3 Hạt Giống Linh Điền và 3 Trứng Linh Các theo chu kỳ 6h / 12h / 24h.</p>
    </div>
    ${farmCards}
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
  console.log('[PDF Export] Validating v1.3 catalog integrity & Discord UIDs...');
  const totalCount = assertCatalogIntegrity();
  console.log(`[PDF Export] Verified ${totalCount} unique v1.3 assets with 0 collisions and 100% Discord emoji UID compliance.`);

  fs.mkdirSync(HANDOFF_DOCS_DIR, { recursive: true });
  fs.mkdirSync(TMP_HTML_DIR, { recursive: true });

  const html = buildHtmlDocument(totalCount);

  // Security & confidentiality sanity guard: ensure no internal winrate tuning text leaks into the PDF
  if (/\b40%\b|house edge|tlt của người|giữ bí mật/i.test(html)) {
    throw new Error('Confidentiality check failed: sensitive backend tuning terms found in HTML output!');
  }

  fs.writeFileSync(TMP_HTML_PATH, html, 'utf8');
  console.log(`[PDF Export] Wrote temporary HTML (${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB) -> ${TMP_HTML_PATH}`);

  const browserExe = findBrowserExecutable();
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sumi_edge_pdf_'));
  const htmlFileUrl = pathToFileURL(TMP_HTML_PATH).href;

  try {
    console.log(`[PDF Export] Rendering A4 PDF via ${path.basename(browserExe)}...`);
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

  if (!fs.existsSync(OUTPUT_PDF_PATH)) {
    throw new Error(`PDF output file was not created at ${OUTPUT_PDF_PATH}`);
  }

  const pdfBuf = fs.readFileSync(OUTPUT_PDF_PATH);
  const header = pdfBuf.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error(`Invalid PDF header "${header}" in ${OUTPUT_PDF_PATH}`);
  }

  const pageCount = countPdfPages(pdfBuf);
  const sizeKb = (pdfBuf.length / 1024).toFixed(1);
  console.log(`[PDF Export] SUCCESS! Generated ${OUTPUT_PDF_PATH}`);
  console.log(`[PDF Export] Size: ${sizeKb} KB | Pages: ${pageCount} | Total Prompts: ${totalCount}`);
}

run();
