import crypto from 'crypto';
import { compileCombatant } from './statsCompiler.js';
import { getElementalAdvantage } from './elementalMatrix.js';
import {
  PUBLIC_BASE_URL,
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
} from '../../data/catalog.js';
import { em, petEmoji } from '../../config/emojiHelper.js';
import { supabase } from '../../config/supabase.js';
import { recordClanWarScore } from '../clanService.js';
import { trackQuestActivity } from '../questService.js';

function getVietnamDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}
import { ensureUserInitialized } from '../profileService.js';
import { renderBattleCard } from '../../canvas/battleRenderer.js';
import {
  triggerBattleStart,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
  triggerPostDamage,
  triggerLethalInterception,
  hasHax,
  hasPet,
  hasItem,
  applyHeal,
} from './haxEngine.js';

export const PVP_DAILY_LT_LIMIT = 15;
export const PVE_FREE_DAILY_LT_LIMIT = 25;
export const BATTLE_WIN_LT = 10;
export const BATTLE_LOSS_LT = 5;
export const BATTLE_COOLDOWN_MS = 5000;

const BATTLE_CACHE_MAX = 120;
const BATTLE_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CANVAS_CONCURRENT = 2;
const battleReportCache = new Map();
const latestBattleByChannel = new Map();
const latestBattleByUser = new Map();
const battleCooldowns = new Map();
const inFlightCanvasRenders = new Map();
const canvasWaitQueue = [];
let activeCanvasRenders = 0;

export function withCanvasRenderSlot(dedupKey, fn) {
  const key = dedupKey ? String(dedupKey) : '';
  if (key && inFlightCanvasRenders.has(key)) {
    return inFlightCanvasRenders.get(key);
  }

  const exec = (async () => {
    if (activeCanvasRenders >= MAX_CANVAS_CONCURRENT) {
      await new Promise((resolve) => canvasWaitQueue.push(resolve));
    }
    activeCanvasRenders += 1;
    try {
      return await fn();
    } finally {
      activeCanvasRenders = Math.max(0, activeCanvasRenders - 1);
      const next = canvasWaitQueue.shift();
      if (next) next();
      if (key && inFlightCanvasRenders.get(key) === exec) {
        inFlightCanvasRenders.delete(key);
      }
    }
  })();

  if (key) {
    inFlightCanvasRenders.set(key, exec);
  }
  return exec;
}

export function renderBattleCardQueued(dedupKey, battleResult, options = {}) {
  return withCanvasRenderSlot(dedupKey, () => renderBattleCard(battleResult, options));
}

export function checkBattleCooldown(userId, nowMs = Date.now()) {
  const uid = String(userId || '').replace(/[<@!>]/g, '').trim();
  if (!uid) return { blocked: false, waitSeconds: 0, remainingMs: 0 };
  const lastAt = battleCooldowns.get(uid) || 0;
  const elapsed = nowMs - lastAt;
  if (lastAt > 0 && elapsed < BATTLE_COOLDOWN_MS) {
    const remainingMs = BATTLE_COOLDOWN_MS - elapsed;
    return {
      blocked: true,
      waitSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      remainingMs,
    };
  }
  return { blocked: false, waitSeconds: 0, remainingMs: 0 };
}

export function markBattleCooldown(userId, nowMs = Date.now()) {
  const uid = String(userId || '').replace(/[<@!>]/g, '').trim();
  if (!uid) return;
  battleCooldowns.delete(uid);
  battleCooldowns.set(uid, nowMs);
  if (battleCooldowns.size > 500) {
    const cutoff = nowMs - BATTLE_COOLDOWN_MS * 2;
    for (const [k, ts] of battleCooldowns.entries()) {
      if (ts < cutoff) battleCooldowns.delete(k);
    }
    trimIndexMap(battleCooldowns, 500);
  }
}

function trimIndexMap(map, maxSize) {
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

export function cacheBattleReport(battleId, result, extra = {}) {
  if (!battleId || !result) return;
  if (battleReportCache.has(battleId)) battleReportCache.delete(battleId);
  while (battleReportCache.size >= BATTLE_CACHE_MAX) {
    const oldestKey = battleReportCache.keys().next().value;
    if (!oldestKey) break;
    battleReportCache.delete(oldestKey);
  }
  battleReportCache.set(battleId, {
    result,
    framesMeta: extra.framesMeta || result.framesMeta || [],
    frameBuffers: extra.frameBuffers || new Map(),
    createdAt: Date.now(),
  });

  if (extra.channelId) {
    latestBattleByChannel.delete(extra.channelId);
    latestBattleByChannel.set(extra.channelId, battleId);
    trimIndexMap(latestBattleByChannel, 200);
  }
  for (const uid of [extra.attackerId, extra.defenderId]) {
    if (uid && /^[0-9]{17,20}$/.test(String(uid))) {
      const sUid = String(uid);
      latestBattleByUser.delete(sUid);
      latestBattleByUser.set(sUid, battleId);
    }
  }
  trimIndexMap(latestBattleByUser, 300);
}

function getCacheEntry(battleId) {
  if (!battleId || !battleReportCache.has(battleId)) return null;
  const entry = battleReportCache.get(battleId);
  if (Date.now() - entry.createdAt > BATTLE_CACHE_TTL_MS) {
    battleReportCache.delete(battleId);
    return null;
  }
  return entry;
}

export function getCachedBattleReport(battleId) {
  return getCacheEntry(battleId)?.result || null;
}

export function getCachedBattleFrame(battleId, frameIndex) {
  const entry = getCacheEntry(battleId);
  if (!entry) return null;
  return entry.frameBuffers?.get(Number(frameIndex)) || null;
}

export function setCachedBattleFrame(battleId, frameIndex, buffer) {
  const entry = getCacheEntry(battleId);
  if (!entry || !buffer) return;
  entry.frameBuffers.set(Number(frameIndex), buffer);
}

export function getBattleFrameMeta(battleId, frameIndex) {
  const entry = getCacheEntry(battleId);
  if (!entry) return null;
  const idx = Number(frameIndex);
  const meta = (entry.framesMeta || []).find((f) => f.index === idx);
  return meta || null;
}

export function getBattleLogPayload({ battleId, channelId, userId } = {}) {
  let targetBattleId = battleId && !/^\{/.test(String(battleId)) ? String(battleId).trim() : null;
  let entry = targetBattleId ? getCacheEntry(targetBattleId) : null;

  if (!entry && channelId && !/^\{/.test(String(channelId))) {
    const chBid = latestBattleByChannel.get(String(channelId).trim());
    if (chBid) {
      targetBattleId = chBid;
      entry = getCacheEntry(chBid);
    }
  }

  if (!entry && userId && !/^\{/.test(String(userId))) {
    const uBid = latestBattleByUser.get(String(userId).trim());
    if (uBid) {
      targetBattleId = uBid;
      entry = getCacheEntry(uBid);
    }
  }

  if (!entry?.result) {
    return {
      success: true,
      found: false,
      battleId: null,
      title: `${em('su_wiki_scroll')} NHẬT KÝ TRẬN ĐẤU`,
      description: 'Nhật ký trận đấu này đã quá hạn lưu tạm (30 phút) hoặc máy chủ vừa khởi động lại. Hãy dùng `/battle` để mở trận đấu mới!',
      footer: 'SuMi Family • Nhật Ký Đấu Trường',
    };
  }

  const r = entry.result;
  const bid = r.battleId || targetBattleId;
  return {
    success: true,
    found: true,
    battleId: bid,
    webLogUrl: r.webLogUrl || `${PUBLIC_BASE_URL}/api/battle/logs/${bid}/view`,
    title: `${em('su_wiki_scroll')} NHẬT KÝ TRẬN ĐẤU • ${r.winner.name} VS ${r.loser.name}`,
    description: r.fullBattleLog || r.discordReport || r.summary,
    footer: `SuMi Family • ${r.turnCount} Hiệp • Mã trận: ${bid}`,
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripDiscordTagsToHtml(text) {
  let s = escapeHtml(text);
  // Convert Discord custom emoji <a:name:id> or <:name:id> to inline <img>
  s = s.replace(/&lt;(a?):([a-zA-Z0-9_]+):([0-9]{15,22})&gt;/g, (_, anim, name, id) => {
    const ext = anim === 'a' ? 'gif' : 'png';
    return `<img class="d-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:">`;
  });
  // Markdown links [label](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Bold **...**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *...*
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code `...`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function renderBattleLogHtml(battleId) {
  const cleanId = String(battleId || '').trim();
  const entry = getCacheEntry(cleanId);
  if (!entry?.result) {
    return {
      found: false,
      html: `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nhật Ký Trận Đấu Đã Hết Hạn • SuMi Family</title>
<style>body{background:#0f0a1c;color:#f5e9ff;font-family:'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{max-width:560px;background:#1a1230;border:1px solid #ec489955;border-radius:16px;padding:28px;text-align:center;box-shadow:0 12px 40px #0008}h1{color:#f472b6;font-size:1.35rem;margin-top:0}</style></head>
<body><div class="card"><h1>📜 Nhật Ký Trận Đấu Không Còn Trong Bộ Nhớ Tạm</h1><p>Mã trận <code>${escapeHtml(cleanId)}</code> đã quá hạn lưu tạm (30 phút) hoặc máy chủ vừa khởi động lại.</p><p>Hãy gõ <code>/battle</code> hoặc <code>/nhiemvu hanh_dong:tower</code> trên Discord SuMi Family để mở trận mới nhé!</p></div></body></html>`,
    };
  }

  const r = entry.result;
  const rawLines = r.untruncatedLogLines || (r.fullBattleLog || '').split('\n');
  const linesHtml = rawLines
    .map((line) => {
      if (!line.trim()) return '<div class="spacer"></div>';
      const isTurn = line.startsWith('• **H');
      const isHeader = line.startsWith('**1.') || line.startsWith('**2.') || line.startsWith('**Diễn Biến') || line.startsWith('**Khai Trận');
      const isResult = line.includes('**KẾT QUẢ:**');
      const cls = isResult ? 'log-line result-line' : isHeader ? 'log-line section-title' : isTurn ? 'log-line turn-line' : 'log-line';
      return `<div class="${cls}">${stripDiscordTagsToHtml(line)}</div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nhật Ký Trận Đấu #${escapeHtml(cleanId)} • ${escapeHtml(r.winner?.name)} vs ${escapeHtml(r.loser?.name)}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      background: radial-gradient(circle at top, #23133d 0%, #0d0818 70%);
      color: #f3e8ff;
      font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px 14px 48px;
      line-height: 1.6;
    }
    .container {
      max-width: 920px;
      margin: 0 auto;
      background: rgba(23, 15, 42, 0.92);
      border: 1px solid rgba(236, 72, 153, 0.4);
      border-radius: 18px;
      padding: 24px 26px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65);
    }
    .header-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid rgba(236, 72, 153, 0.28);
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: 1.3rem;
      margin: 0;
      color: #f9a8d4;
      letter-spacing: 0.3px;
    }
    .badge {
      background: rgba(236, 72, 153, 0.18);
      border: 1px solid rgba(244, 114, 182, 0.45);
      color: #fbcfe8;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .banner-wrap {
      margin: 14px 0 22px;
      text-align: center;
    }
    .banner-wrap img {
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid rgba(251, 191, 36, 0.35);
      box-shadow: 0 8px 28px rgba(0,0,0,0.55);
    }
    .log-line {
      padding: 4px 0;
      font-size: 0.96rem;
      word-break: break-word;
    }
    .section-title {
      margin-top: 12px;
      padding: 6px 10px;
      background: rgba(168, 85, 247, 0.14);
      border-left: 3px solid #ec4899;
      border-radius: 6px;
      color: #fde047;
      font-size: 1.02rem;
    }
    .turn-line {
      padding: 6px 10px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border-left: 2px solid rgba(244, 114, 182, 0.35);
    }
    .result-line {
      margin-top: 14px;
      padding: 10px 14px;
      background: linear-gradient(90deg, rgba(236,72,153,0.22), rgba(234,179,8,0.16));
      border: 1px solid rgba(250, 204, 21, 0.45);
      border-radius: 10px;
      font-size: 1.05rem;
    }
    .spacer { height: 8px; }
    code {
      background: rgba(15, 23, 42, 0.75);
      color: #67e8f9;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 0.9em;
    }
    strong { color: #fff; }
    em { color: #cbd5e1; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img.d-emoji {
      width: 20px;
      height: 20px;
      vertical-align: -4px;
      margin: 0 2px;
    }
    .footer-meta {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      font-size: 0.84rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <h1>📜 NHẬT KÝ TRẬN ĐẤU CHI TIẾT (FULL 100% HIỆP)</h1>
      <span class="badge">${escapeHtml(r.turnCount)} Hiệp • Mã trận: ${escapeHtml(cleanId)}</span>
    </div>
    <div class="banner-wrap">
      <img src="/api/battle/report/${encodeURIComponent(cleanId)}.png" alt="Battle Report Card" loading="lazy">
    </div>
    <div class="log-body">
      ${linesHtml}
    </div>
    <div class="footer-meta">
      <span>🦊 SuMi Family • Tu Tiên Giới Đấu Trường HAX v1.1</span>
      <span>Chế độ: ${escapeHtml(r.opponent_tier_label || r.mode || '1v1')}</span>
    </div>
  </div>
</body>
</html>`;

  return { found: true, html };
}

function buildAdaptiveFrames(turns, turnCount, initialHp, finalHp, headline) {
  const getHpAtEndOfTurn = (tNum) => {
    let found = null;
    for (const t of turns) {
      if (t.turn <= tNum) found = t;
      else break;
    }
    return found
      ? { attackerHp: found.attackerHp, defenderHp: found.defenderHp }
      : { attackerHp: initialHp.attacker, defenderHp: initialHp.defender };
  };

  if (turnCount <= 1) {
    return [
      {
        index: 1,
        scale: 0.8,
        isFinal: false,
        currentTurn: 0,
        totalTurns: turnCount,
        turnLabel: 'KHAI TRẬN • CHUẨN BỊ XUẤT CHIÊU',
        title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • KHAI TRẬN!`,
        attackerHp: initialHp.attacker,
        defenderHp: initialHp.defender,
      },
      {
        index: 2,
        scale: 1.4,
        isFinal: true,
        currentTurn: turnCount,
        totalTurns: turnCount,
        turnLabel: `HIỆP ${turnCount} • KẾT THÚC`,
        title: headline,
        attackerHp: finalHp.attacker,
        defenderHp: finalHp.defender,
      },
    ];
  }

  if (turnCount <= 4) {
    const hp1 = getHpAtEndOfTurn(1);
    return [
      {
        index: 1,
        scale: 0.8,
        isFinal: false,
        currentTurn: 1,
        totalTurns: turnCount,
        turnLabel: `ĐANG GIAO CHIẾN • HIỆP 1/${turnCount}`,
        title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • HIỆP 1/${turnCount}...`,
        attackerHp: hp1.attacker,
        defenderHp: hp1.defender,
      },
      {
        index: 2,
        scale: 1.4,
        isFinal: true,
        currentTurn: turnCount,
        totalTurns: turnCount,
        turnLabel: `HIỆP ${turnCount} • KẾT THÚC`,
        title: headline,
        attackerHp: finalHp.attacker,
        defenderHp: finalHp.defender,
      },
    ];
  }

  const midTurn = Math.ceil(turnCount / 2);
  const hp1 = getHpAtEndOfTurn(1);
  const hpMid = getHpAtEndOfTurn(midTurn);
  return [
    {
      index: 1,
      scale: 0.8,
      isFinal: false,
      currentTurn: 1,
      totalTurns: turnCount,
      turnLabel: `ĐANG GIAO CHIẾN • HIỆP 1/${turnCount}`,
      title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • HIỆP 1/${turnCount}...`,
      attackerHp: hp1.attacker,
      defenderHp: hp1.defender,
    },
    {
      index: 2,
      scale: 0.8,
      isFinal: false,
      currentTurn: midTurn,
      totalTurns: turnCount,
      turnLabel: `ĐANG GIAO CHIẾN • HIỆP ${midTurn}/${turnCount}`,
      title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • HIỆP ${midTurn}/${turnCount}...`,
      attackerHp: hpMid.attacker,
      defenderHp: hpMid.defender,
    },
    {
      index: 3,
      scale: 1.4,
      isFinal: true,
      currentTurn: turnCount,
      totalTurns: turnCount,
      turnLabel: `HIỆP ${turnCount} • KẾT THÚC`,
      title: headline,
      attackerHp: finalHp.attacker,
      defenderHp: finalHp.defender,
    },
  ];
}

function formatEquipDetailedLines(c, compact = false) {
  const w = c.equipment?.weapon;
  const g = c.equipment?.gem;
  const s = c.equipment?.soul;
  if (compact) {
    const shortDesc = (item, icon, label) => {
      if (!item) return `${icon} ${label}: *Trống*`;
      const tag = item.hax_skill ? ` *[${item.hax_skill}]*` : '';
      return `${icon} **${item.item_name}**${tag}`;
    };
    return [
      `• Pháp Bảo: ${shortDesc(w, '⚔️', 'VK')} • ${shortDesc(g, '💎', 'Ngọc')} • ${shortDesc(s, '🔥', 'Hồn')}`,
    ];
  }
  const desc = (item, label) => {
    if (!item) return `${label}: *Chưa trang bị*`;
    const haxTxt = item.hax_skill
      ? `[${item.hax_skill}] ${item.hax_description || ''}`
      : (item.hax_description || 'Cộng chỉ số nền');
    return `${label}: **${item.item_name}** — *${haxTxt}*`;
  };
  return [
    `• ${em('su_crossed_swords')} ${desc(w, 'Vũ Khí')}`,
    `• ${em('su_linhthach')} ${desc(g, 'Bảo Ngọc')}`,
    `• ${em('su_fox_mascot')} ${desc(s, 'Chiến Hồn')}`,
  ];
}

function buildFullBattleLog({
  battleId,
  attacker,
  defender,
  initialHp,
  elementMatchup,
  battleStartEvents,
  turns,
  turnNumber,
  winner,
  winnerPetEmoji,
  loser,
  rewardSummary,
}) {
  const atkIcon = attacker.petIcon || petEmoji(attacker.petType, em('su_pet_paw'));
  const defIcon = defender.petIcon || petEmoji(defender.petType, em('su_pet_paw'));
  const webLogUrl = battleId ? `${PUBLIC_BASE_URL}/api/battle/logs/${battleId}/view` : null;

  const elemNote = (() => {
    const a2d = elementMatchup?.attackerToDefender;
    const d2a = elementMatchup?.defenderToAttacker;
    if (a2d?.isTrueDamage && !d2a?.isTrueDamage) return 'Hỗn Độn xuyên giáp (+20% DMG)';
    if (d2a?.isTrueDamage && !a2d?.isTrueDamage) return 'Hỗn Độn xuyên giáp (+20% DMG)';
    if (a2d?.multiplier >= 1.25 && d2a?.multiplier >= 1.25) return 'Ám ↔ Quang Tương Sát (+25% DMG)';
    if (a2d?.multiplier > 1.0) return `${attacker.element} khắc ${defender.element} (+${Math.round((a2d.multiplier - 1) * 100)}% DMG)`;
    if (d2a?.multiplier > 1.0) return `${defender.element} khắc ${attacker.element} (+${Math.round((d2a.multiplier - 1) * 100)}% DMG)`;
    return 'Ngũ Hành Cân Bằng';
  })();

  const petHaxTxt = (c) => {
    const cat = PET_BY_TYPE[c.petType];
    const name = c.petHaxName || c.hax?.pet || cat?.hax_skill || 'Không có';
    const d = c.petHaxDesc || c.hax?.petDesc || cat?.hax_description || '';
    return d ? `**${name}** — *${d}*` : `**${name}**`;
  };

  const makeHeaderLines = (compact = false) => [
    `**1. Phe Công:** **${attacker.name}** — ${atkIcon} **${attacker.petName}** *(${attacker.petRarity || 'Phàm'} • Hệ ${attacker.element} • Lv.${attacker.level} • ${attacker.star || 1}★)*`,
    `• \`ATK ${attacker.atk.toLocaleString('vi-VN')} | DEF ${attacker.def.toLocaleString('vi-VN')} | SPD ${attacker.spd.toLocaleString('vi-VN')} | HP ${initialHp.attacker.toLocaleString('vi-VN')}\``,
    `• HAX Pet: ${petHaxTxt(attacker)}`,
    ...formatEquipDetailedLines(attacker, compact),
    '',
    `**2. Phe Thủ:** **${defender.name}** — ${defIcon} **${defender.petName}** *(${defender.petRarity || 'Phàm'} • Hệ ${defender.element} • Lv.${defender.level} • ${defender.star || 1}★)*`,
    `• \`ATK ${defender.atk.toLocaleString('vi-VN')} | DEF ${defender.def.toLocaleString('vi-VN')} | SPD ${defender.spd.toLocaleString('vi-VN')} | HP ${initialHp.defender.toLocaleString('vi-VN')}\``,
    `• HAX Pet: ${petHaxTxt(defender)}`,
    ...formatEquipDetailedLines(defender, compact),
    `• Tương khắc: **${elemNote}**`,
  ];

  const headerLines = makeHeaderLines(false);
  const compactHeaderLines = makeHeaderLines(true);

  const startLines = battleStartEvents.length > 0
    ? ['', '**Khai Trận HAX:**', ...battleStartEvents.map((ev) => {
      const aPet = ev.actor === attacker.id ? attacker.petName : defender.petName;
      return `• ${em('su_thunder_hax')} **${aPet}**: ${ev.skill}`;
    })]
    : [];

  const buildTurnLines = (compactMode = false) => turns.map((t) => {
    const actorObj = t.actor === 'attacker' ? attacker : defender;
    const targetObj = t.actor === 'attacker' ? defender : attacker;
    if (t.action === 'skip') {
      const sIcon = compactMode ? '🛡️' : em('su_shield_def');
      return `• **H${t.turn}** [${actorObj.petName}]: ${sIcon} ${t.haxTriggered || 'Mất lượt'}`;
    }
    if (t.action === 'miss') {
      return compactMode
        ? `• **H${t.turn}** **${actorObj.petName}**: *Trượt (${t.haxTriggered || 'Né'})*`
        : `• **H${t.turn}** **${actorObj.petName}** → **${targetObj.petName}**: *Trượt (${t.haxTriggered || 'Né'})*`;
    }
    const cIcon = compactMode ? '💥' : em('su_crit_boom');
    const critTag = t.isCrit ? ` ${cIcon} **CRIT**` : '';
    const haxTag = t.haxTriggered ? ` *(${t.haxTriggered})*` : '';
    if (compactMode) {
      return `• **H${t.turn}** **${actorObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')}/${t.defenderHp.toLocaleString('vi-VN')})*`;
    }
    return `• **H${t.turn}** **${actorObj.petName}** → **${targetObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')} / ${t.defenderHp.toLocaleString('vi-VN')})*`;
  });

  const allTurnLines = buildTurnLines(false);
  const compactTurnLines = buildTurnLines(true);

  const webFooterLines = [
    '',
    `${em('su_winner_trophy')} **KẾT QUẢ:** **${winner.name}** (${winnerPetEmoji} **${winner.pet}**) thắng **${loser.name}** (${loser.pet}) sau **${turnNumber} hiệp**!`,
    ...(rewardSummary ? [`• ${rewardSummary}`] : []),
  ];

  const discordFooterLines = [
    ...webFooterLines,
    ...(webLogUrl ? [`• 🌐 **Bản Web đầy đủ 100% hiệp:** [Mở Xem Chi Tiết Trên Web](${webLogUrl})`] : []),
  ];

  const untruncatedLogLines = [
    ...headerLines,
    ...startLines,
    '',
    `**Diễn Biến Chi Tiết (${turnNumber} Hiệp):**`,
    ...allTurnLines,
    ...webFooterLines,
  ];

  const assembleDiscord = (tLines, hLines = headerLines) => [
    ...hLines,
    ...startLines,
    '',
    `**Diễn Biến Chi Tiết (${turnNumber} Hiệp):**`,
    ...tLines,
    ...discordFooterLines,
  ].join('\n');

  let fullText = assembleDiscord(allTurnLines, headerLines);
  if (fullText.length > 3880) {
    fullText = assembleDiscord(allTurnLines, compactHeaderLines);
  }
  if (fullText.length > 3880) {
    fullText = assembleDiscord(compactTurnLines, compactHeaderLines);
  }

  if (fullText.length > 3880 && compactTurnLines.length > 6) {
    for (let keep = compactTurnLines.length - 1; keep >= 6; keep -= 1) {
      const headCount = Math.ceil(keep / 2);
      const tailCount = Math.floor(keep / 2);
      const omitted = compactTurnLines.length - headCount - tailCount;
      const omitNote = webLogUrl
        ? `• *... (đã ẩn ${omitted} lượt giữa do giới hạn 4096 ký tự Discord — [Bấm xem Full 100% trên Web](${webLogUrl})) ...*`
        : `• *... (đã rút gọn ${omitted} lượt giữa để vừa giới hạn tin nhắn Discord) ...*`;
      const candidate = assembleDiscord([
        ...compactTurnLines.slice(0, headCount),
        omitNote,
        ...compactTurnLines.slice(-tailCount),
      ], compactHeaderLines);
      if (candidate.length <= 3880 || keep === 6) {
        fullText = candidate;
        break;
      }
    }
  }

  if (fullText.length > 3950) {
    fullText = fullText.slice(0, 3940) + '\n…';
  }
  return {
    fullText,
    untruncatedLogLines,
    webLogUrl,
  };
}

function createRng(seed) {
  if (typeof seed === 'number') {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  return () => Math.random();
}

/**
 * Chọn đối thủ PvE Tự Do theo đúng tỉ lệ 50% Ngang Cấp / 10% Dưới Cấp / 40% Trên Cấp
 * (60% Huyễn Ảnh người chơi thật read-only, 40% Yêu Linh hoang dã).
 */
export async function resolveFreePveOpponent(attackerCombatant, rng = Math.random) {
  const rDiff = rng();
  const band = rDiff < 0.50
    ? { key: 'even', label: 'Ngang Cấp', minRatio: 0.92, maxRatio: 1.08 }
    : rDiff < 0.60
      ? { key: 'weaker', label: 'Dưới Cấp', minRatio: 0.72, maxRatio: 0.88 }
      : { key: 'stronger', label: 'Trên Cấp', minRatio: 1.12, maxRatio: 1.32 };

  const targetRatio = band.minRatio + rng() * (band.maxRatio - band.minRatio);
  const attackerPower = Math.max(
    1500,
    attackerCombatant.atk * 3 + attackerCombatant.def * 2 + attackerCombatant.spd * 2 + attackerCombatant.level * 50,
  );
  const targetPower = Math.round(attackerPower * targetRatio);

  const scaleCombatantToRatio = (c) => {
    const curPow = Math.max(1000, c.atk * 3 + c.def * 2 + c.spd * 2 + c.level * 50);
    const ratio = curPow / attackerPower;
    if (ratio >= band.minRatio && ratio <= band.maxRatio) return c;
    const factor = Math.max(0.25, Math.min(3.0, targetPower / curPow));
    c.atk = Math.max(100, Math.round(c.atk * factor));
    c.def = Math.max(80, Math.round(c.def * factor));
    c.spd = Math.max(80, Math.round(c.spd * factor));
    c.baseAtk = c.atk;
    c.baseDef = c.def;
    c.baseSpd = c.spd;
    c.maxHp = Math.max(800, Math.round(c.maxHp * factor));
    c.currentHp = c.maxHp;
    return c;
  };

  const pickItem = (slot, rKeys) => {
    const items = EQUIPMENT_CATALOG.filter((i) => i.item_type === slot && rKeys.includes(i.rarity_key) && !i.is_unique);
    return items.length ? items[Math.floor(rng() * items.length)] : null;
  };
  const equipTiers = band.key === 'weaker' ? ['common', 'rare'] : band.key === 'even' ? ['rare', 'epic'] : ['epic', 'mythic'];

  const tryShadow = rng() < 0.60 && Boolean(supabase);
  if (tryShadow) {
    try {
      const { data: candidates } = await supabase
        .from('users')
        .select('user_id, username, avatar_url, level, avatar_frame')
        .neq('user_id', attackerCombatant.id)
        .limit(25);

      if (candidates && candidates.length > 0) {
        const pickedUser = candidates[Math.floor(rng() * candidates.length)];
        const shadowCombatant = await compileCombatant(pickedUser.user_id, 'defender');
        shadowCombatant.id = `pve_shadow_${pickedUser.user_id}`;
        shadowCombatant.name = `${shadowCombatant.name} (Huyễn Ảnh • ${band.label})`;
        shadowCombatant.isShadow = true;
        shadowCombatant.isNpc = true;
        if (!shadowCombatant.equipment) shadowCombatant.equipment = { weapon: null, gem: null, soul: null };
        if (!shadowCombatant.hax) shadowCombatant.hax = { pet: shadowCombatant.petHaxName || null, weapon: null, gem: null, soul: null };
        for (const slot of ['weapon', 'gem', 'soul']) {
          if (!shadowCombatant.equipment[slot]) {
            const filler = pickItem(slot, equipTiers);
            if (filler) {
              shadowCombatant.equipment[slot] = { ...filler, slot };
              shadowCombatant.hax[slot] = filler.hax_skill || filler.hax_description || null;
              shadowCombatant.atk += Number(filler.bonus_atk || 0);
              shadowCombatant.def += Number(filler.bonus_def || 0);
              shadowCombatant.spd += Number(filler.bonus_spd || 0);
              shadowCombatant.maxHp += Number(filler.bonus_hp || 0);
              shadowCombatant.currentHp = shadowCombatant.maxHp;
            }
          }
        }
        return { combatant: scaleCombatantToRatio(shadowCombatant), band, sourceType: 'shadow' };
      }
    } catch {
      // fallback to wild spirit
    }
  }

  const publicPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const preferredRarity = band.key === 'weaker'
    ? ['common', 'rare']
    : band.key === 'even'
      ? ['rare', 'epic']
      : ['epic', 'mythic'];
  const poolPets = publicPets.filter((p) => preferredRarity.includes(p.rarity_key));
  const pickedPet = (poolPets.length ? poolPets : publicPets)[Math.floor(rng() * (poolPets.length || publicPets.length))];

  const weapon = pickItem('weapon', equipTiers);
  const gem = pickItem('gem', equipTiers);
  const soul = pickItem('soul', equipTiers);

  const botLevel = Math.max(1, Math.round(attackerCombatant.level * targetRatio));
  const botProfile = {
    user_id: 'pve_wild_spirit',
    username: `Yêu Linh • ${pickedPet.pet_name} (${band.label})`,
    level: botLevel,
    avatar_frame: 'default',
    pet: {
      name: pickedPet.pet_name,
      pet_type: pickedPet.pet_type,
      rarity: pickedPet.rarity,
      element: pickedPet.element,
      hax_skill: pickedPet.hax_skill,
      hax_desc: pickedPet.hax_description,
      level: botLevel,
      star: Math.max(1, Math.min(10, Math.round((attackerCombatant.star || 1) * targetRatio))),
      atk: pickedPet.base_atk,
      def: pickedPet.base_def,
      spd: pickedPet.base_spd,
      base_atk: pickedPet.base_atk,
      base_def: pickedPet.base_def,
      base_spd: pickedPet.base_spd,
      bonus_atk: 0,
      bonus_def: 0,
      bonus_spd: 0,
      bonus_hp: 0,
      equipment: { weapon, gem, soul },
    },
  };

  const botCombatant = await compileCombatant(botProfile, 'defender');
  botCombatant.isNpc = true;
  return { combatant: scaleCombatantToRatio(botCombatant), band, sourceType: 'wild_spirit' };
}

async function adjustUserLinhThach(userId, delta) {
  if (!supabase || !/^[0-9]{17,20}$/.test(String(userId || ''))) return null;
  const { user } = await ensureUserInitialized(userId);
  if (!user) return null;
  const before = Number(user.linh_thach || 0);
  const after = Math.max(0, before + delta);
  await supabase
    .from('users')
    .update({ linh_thach: after, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  return { before, after, delta: after - before };
}

export async function applyBattleLinhThachReward({
  mode,
  attackerId,
  defenderId,
  attackerWon,
  isMirror = false,
  now = new Date(),
} = {}) {
  if (!supabase || !/^[0-9]{17,20}$/.test(String(attackerId || ''))) {
    return { applied: false, delta: 0, reward_summary: '' };
  }

  const today = getVietnamDateKey(now);
  await ensureUserInitialized(attackerId);

  const { data: existingQ } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', attackerId)
    .maybeSingle();

  const qRow = existingQ || { user_id: attackerId };

  if (mode === 'pve_free') {
    const usedToday = qRow.pve_free_date === today ? Number(qRow.pve_free_rewards_today || 0) : 0;
    if (usedToday >= PVE_FREE_DAILY_LT_LIMIT) {
      return {
        applied: false,
        delta: 0,
        used_today: usedToday,
        daily_limit: PVE_FREE_DAILY_LT_LIMIT,
        reward_summary: `${em('su_linhthach')} Đã hết **${PVE_FREE_DAILY_LT_LIMIT}/${PVE_FREE_DAILY_LT_LIMIT}** lượt nhận thưởng PvE Tự Do hôm nay (vẫn giao đấu tự do 0 LT).`,
      };
    }

    const nextCount = usedToday + 1;
    await supabase.from('user_quests').upsert({
      user_id: attackerId,
      pve_free_date: today,
      pve_free_rewards_today: nextCount,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });

    const rawDelta = attackerWon ? BATTLE_WIN_LT : -BATTLE_LOSS_LT;
    const bal = await adjustUserLinhThach(attackerId, rawDelta);
    const actualDelta = bal ? bal.delta : rawDelta;
    const signStr = actualDelta >= 0 ? `+${actualDelta}` : `${actualDelta}`;
    return {
      applied: true,
      delta: actualDelta,
      used_today: nextCount,
      daily_limit: PVE_FREE_DAILY_LT_LIMIT,
      linh_thach: bal?.after,
      reward_summary: `${em('su_linhthach')} PvE Tự Do: **${signStr} Linh Thạch** *(Lượt thưởng hôm nay: ${nextCount}/${PVE_FREE_DAILY_LT_LIMIT} • Ví: ${(bal?.after ?? 0).toLocaleString('vi-VN')} LT)*`,
    };
  }

  if (mode === 'pvp' && !isMirror) {
    const usedToday = qRow.pvp_reward_date === today ? Number(qRow.pvp_rewards_today || 0) : 0;
    if (usedToday >= PVP_DAILY_LT_LIMIT) {
      return {
        applied: false,
        delta: 0,
        used_today: usedToday,
        daily_limit: PVP_DAILY_LT_LIMIT,
        reward_summary: `${em('su_linhthach')} Đã đạt giới hạn **${PVP_DAILY_LT_LIMIT}/${PVP_DAILY_LT_LIMIT}** trận PvP tính LT hôm nay (giao đấu danh dự 0 LT).`,
      };
    }

    const nextCount = usedToday + 1;
    await supabase.from('user_quests').upsert({
      user_id: attackerId,
      pvp_reward_date: today,
      pvp_rewards_today: nextCount,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });

    const atkDeltaRaw = attackerWon ? BATTLE_WIN_LT : -BATTLE_LOSS_LT;
    const defDeltaRaw = attackerWon ? -BATTLE_LOSS_LT : BATTLE_WIN_LT;

    const atkBal = await adjustUserLinhThach(attackerId, atkDeltaRaw);
    const defBal = /^[0-9]{17,20}$/.test(String(defenderId || '')) && defenderId !== attackerId
      ? await adjustUserLinhThach(defenderId, defDeltaRaw)
      : null;

    const aSign = (atkBal?.delta ?? atkDeltaRaw) >= 0 ? `+${atkBal?.delta ?? atkDeltaRaw}` : `${atkBal?.delta ?? atkDeltaRaw}`;
    const dSign = (defBal?.delta ?? defDeltaRaw) >= 0 ? `+${defBal?.delta ?? defDeltaRaw}` : `${defBal?.delta ?? defDeltaRaw}`;
    return {
      applied: true,
      delta: atkBal?.delta ?? atkDeltaRaw,
      defender_delta: defBal?.delta ?? 0,
      used_today: nextCount,
      daily_limit: PVP_DAILY_LT_LIMIT,
      reward_summary: `${em('su_linhthach')} Thưởng/Phạt PvP: Bên Công **${aSign} LT** • Bên Thủ **${dSign} LT** *(${nextCount}/${PVP_DAILY_LT_LIMIT} trận hôm nay)*`,
    };
  }

  return { applied: false, delta: 0, reward_summary: '' };
}

/**
 * Thống nhất thực thi 1 đòn đánh (chính & phụ) đi qua đầy đủ Né, Giảm ST, Khiên, Nổ Khiên, Phản Đòn, PostDamage & Bất Tử (Bug #5 fixed!)
 */
function executeHit({
  actor,
  target,
  rawBaseDamage,
  elemData,
  rng,
  attacker,
  defender,
  turnNumber,
  role,
  turns,
  label = null,
  forcedDamage = null,
  forcedDefPiercePct = 0,
  extraEvents = [],
}) {
  let attackPhase;
  if (forcedDamage !== null) {
    const baseDefTarget = elemData.isTrueDamage ? 0 : Math.max(0, Math.round(target.def * (1 - (target.state.defDebuffPct || 0))));
    const effDef = Math.floor(baseDefTarget * Math.max(0, 1 - forcedDefPiercePct));
    const calc = Math.max(50, Math.floor((forcedDamage - effDef * 0.4) * (elemData.multiplier || 1)));
    attackPhase = {
      damage: calc,
      isCrit: false,
      isMiss: false,
      isDodged: false,
      triggerCounter: false,
      shieldPiercePct: 0,
      lifestealPct: 0,
      instantExecute: false,
      haxTriggered: label,
    };
  } else {
    attackPhase = triggerAttackPhase(actor, target, rawBaseDamage, rng, elemData);
  }

  const notes = [...extraEvents];
  if (attackPhase.haxTriggered) notes.push(attackPhase.haxTriggered);
  let actualDamageDealt = 0;

  if (!attackPhase.isMiss) {
    const damageRecv = triggerDamageReceived(target, attackPhase.damage, actor, rng);
    for (const ev of damageRecv.events || []) {
      if (ev?.skill) notes.push(ev.skill);
    }

    let dmgToApply = damageRecv.finalDamage;
    const hadShield = target.shield || 0;

    if (hadShield > 0) {
      const piercePct = Math.min(1, Math.max(0, Number(attackPhase.shieldPiercePct) || 0));
      const bypassDmg = Math.floor(dmgToApply * piercePct);
      let shieldableDmg = dmgToApply - bypassDmg;

      if (target.shield >= shieldableDmg) {
        target.shield -= shieldableDmg;
        shieldableDmg = 0;
      } else {
        shieldableDmg -= target.shield;
        target.shield = 0;
      }
      dmgToApply = bypassDmg + shieldableDmg;

      if (target.shield === 0 && target.state.shieldExplodePct > 0) {
        const pct = target.state.shieldExplodePct;
        target.state.shieldExplodePct = 0;
        const explodeDmg = Math.floor(target.maxHp * pct);
        actor.currentHp = Math.max(0, actor.currentHp - explodeDmg);
        notes.push(`Vỡ Khiên Bất Động Sơn Hà (-${explodeDmg.toLocaleString('vi-VN')} ST Chuẩn)`);
        if (actor.currentHp <= 0) {
          const li = triggerLethalInterception(actor, target, rng);
          if (li.survived && li.skill) notes.push(li.skill);
        }
      }
    }

    target.currentHp = Math.max(0, target.currentHp - dmgToApply);
    actualDamageDealt = dmgToApply;

    if (attackPhase.lifestealPct > 0 && actualDamageDealt > 0 && actor.currentHp > 0) {
      const healed = applyHeal(actor, actualDamageDealt * attackPhase.lifestealPct);
      if (healed > 0) notes.push(`Hút Máu +${healed.toLocaleString('vi-VN')}`);
    }

    if (damageRecv.reflectedDamage > 0 && actor.currentHp > 0) {
      actor.currentHp = Math.max(0, actor.currentHp - damageRecv.reflectedDamage);
      notes.push(`Phản Đòn -${damageRecv.reflectedDamage.toLocaleString('vi-VN')}`);
      if (actor.currentHp <= 0) {
        const li = triggerLethalInterception(actor, target, rng);
        if (li.survived && li.skill) notes.push(li.skill);
      }
    }

    if (target.currentHp > 0) {
      const postEvents = triggerPostDamage(target, actor);
      for (const pev of postEvents) {
        if (pev?.skill) notes.push(pev.skill);
      }
    } else {
      const lethalInterception = triggerLethalInterception(target, actor, rng);
      if (lethalInterception.survived && lethalInterception.skill) {
        notes.push(lethalInterception.skill);
      }
    }
  }

  turns.push({
    turn: turnNumber,
    actor: role,
    action: attackPhase.isMiss ? 'miss' : 'attack',
    damage: actualDamageDealt,
    isCrit: attackPhase.isCrit,
    elementAdvantage: elemData.elementAdvantage,
    haxTriggered: notes.length > 0 ? notes.join(' • ') : null,
    attackerHp: attacker.currentHp,
    defenderHp: defender.currentHp,
  });

  return { attackPhase, actualDamageDealt };
}

/**
 * Điều phối trận chiến Linh Thú theo lượt (Turn-based Pet Battle Simulation)
 */
export async function simulateBattle(attackerUserOrId, defenderUserOrId, options = {}) {
  const safeOptions = options || {};
  const maxTurns = Math.max(1, Math.min(100, Number(safeOptions.maxTurns) || 30));
  const rng = createRng(safeOptions.seed);
  const channelId = safeOptions.channelId ? String(safeOptions.channelId).trim() : null;

  const isFreePve = safeOptions.mode === 'pve_free' || defenderUserOrId === 'pve_free' || !defenderUserOrId;
  const mode = safeOptions.mode || (isFreePve ? 'pve_free' : 'pvp');

  if (safeOptions.enforceCooldown === true) {
    const rawCdUid = typeof attackerUserOrId === 'string'
      ? attackerUserOrId
      : (attackerUserOrId?.user_id || attackerUserOrId?.userId || '');
    const cd = checkBattleCooldown(rawCdUid);
    if (cd.blocked) {
      return {
        success: false,
        status: 200,
        error: 'BATTLE_COOLDOWN',
        cooldown_seconds: cd.waitSeconds,
        remaining_ms: cd.remainingMs,
        message: `${em('su_thunder_hax')} Đạo hữu thao tác quá nhanh! Vui lòng chờ **${cd.waitSeconds} giây** để Linh Thú hồi sức rồi hãy khiêu chiến trận tiếp theo.`,
      };
    }
    markBattleCooldown(rawCdUid);
  }

  const attacker = await compileCombatant(attackerUserOrId, 'attacker');
  let defender = null;
  let opponentBand = null;

  if (mode === 'pve_free') {
    const pve = await resolveFreePveOpponent(attacker, rng);
    defender = pve.combatant;
    opponentBand = pve.band;
  } else {
    defender = await compileCombatant(defenderUserOrId, 'defender');
  }

  const initialHp = {
    attacker: attacker.maxHp,
    defender: defender.maxHp,
  };

  const turns = [];
  const battleStartEvents = triggerBattleStart(attacker, defender, rng) || [];

  const getEffSpd = (c) => {
    let base = Math.round(c.spd * (1 - (c.state.spdDebuffPct || 0)));
    if (hasItem(c, 'soul_rare_1')) base = Math.round(base * 1.15);
    return base;
  };

  let attackerFirst = true;
  const atkHasSpeedPriority = hasPet(attacker, 'loi_dinh_kim_ho') || hasHax(attacker, 'lôi quang tốc');
  const defHasSpeedPriority = hasPet(defender, 'loi_dinh_kim_ho') || hasHax(defender, 'lôi quang tốc');

  if (atkHasSpeedPriority && !defHasSpeedPriority) {
    attackerFirst = true;
  } else if (!atkHasSpeedPriority && defHasSpeedPriority) {
    attackerFirst = false;
  } else {
    attackerFirst = getEffSpd(attacker) >= getEffSpd(defender);
  }

  let turnNumber = 0;

  while (attacker.currentHp > 0 && defender.currentHp > 0 && turnNumber < maxTurns) {
    turnNumber += 1;

    const order = attackerFirst
      ? [{ actor: attacker, target: defender, role: 'attacker' }, { actor: defender, target: attacker, role: 'defender' }]
      : [{ actor: defender, target: attacker, role: 'defender' }, { actor: attacker, target: defender, role: 'attacker' }];

    for (const step of order) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

      const { actor, target, role } = step;
      const oppRole = role === 'attacker' ? 'defender' : 'attacker';
      const turnStartResult = triggerTurnStart(actor, target, rng, turnNumber);
      const startTags = (turnStartResult.events || []).map((e) => (typeof e === 'object' ? e.skill : e)).filter(Boolean);

      if (turnStartResult.skipTurn) {
        turns.push({
          turn: turnNumber,
          actor: role,
          action: 'skip',
          damage: 0,
          isCrit: false,
          elementAdvantage: null,
          haxTriggered: startTags[0] || 'Mất lượt do khống chế',
          attackerHp: attacker.currentHp,
          defenderHp: defender.currentHp,
        });
        continue;
      }

      if (actor.currentHp <= 0 || defender.currentHp <= 0) break;

      const actualTarget = turnStartResult.attackSelf ? actor : target;
      const elemData = getElementalAdvantage(actor.element, actualTarget.element);
      const rawBaseDmg = Math.max(50, Math.floor(((actor.atk * 1.5) - (actualTarget.def * 0.5)) * elemData.multiplier));

      const mainRes = executeHit({
        actor,
        target: actualTarget,
        rawBaseDamage: rawBaseDmg,
        elemData,
        rng,
        attacker,
        defender,
        turnNumber,
        role,
        turns,
        extraEvents: startTags,
      });

      // Phản công tức thì nếu Thái Âm Ngọc Thỏ né đòn thành công
      if (mainRes.attackPhase.triggerCounter && actualTarget.currentHp > 0 && actor.currentHp > 0) {
        const counterElem = getElementalAdvantage(actualTarget.element, actor.element);
        executeHit({
          actor: actualTarget,
          target: actor,
          rawBaseDamage: 0,
          elemData: counterElem,
          rng,
          attacker,
          defender,
          turnNumber,
          role: oppRole,
          turns,
          label: 'Nguyệt Hoa Phản Công (80% ATK)',
          forcedDamage: Math.floor(actualTarget.atk * 0.80),
          forcedDefPiercePct: 0,
        });
      }

      // Cửu Thiên Lôi Phượng: 30% đánh thêm đòn sét 60% ATK xuyên 30% DEF
      if (actor.currentHp > 0 && actualTarget.currentHp > 0 && hasPet(actor, 'cuu_thien_loi_phuong') && rng() < 0.30) {
        executeHit({
          actor,
          target: actualTarget,
          rawBaseDamage: 0,
          elemData,
          rng,
          attacker,
          defender,
          turnNumber,
          role,
          turns,
          label: 'Lôi Kiếp Liên Hoàn (60% ATK • Xuyên 30% Giáp)',
          forcedDamage: Math.floor(actor.atk * 0.60),
          forcedDefPiercePct: 0.30,
        });
      }

      // « Thái Bạch Kiếm Tiên Hồn » (soul_mythic_4): Mỗi 2 hiệp tung kiếm khí 70% ATK xuyên 50% DEF
      if (actor.currentHp > 0 && actualTarget.currentHp > 0 && turnNumber % 2 === 0 && hasItem(actor, 'soul_mythic_4')) {
        executeHit({
          actor,
          target: actualTarget,
          rawBaseDamage: 0,
          elemData,
          rng,
          attacker,
          defender,
          turnNumber,
          role,
          turns,
          label: 'Vạn Kiếm Quy Tông (70% ATK • Xuyên 50% Giáp)',
          forcedDamage: Math.floor(actor.atk * 0.70),
          forcedDefPiercePct: 0.50,
        });
      }

      // Thời Không Đình Chỉ / Nguyệt Thần Bạch Vĩ Hồ: Đánh thêm 1 lượt qua cùng pipeline chuẩn!
      if (actor.state.isDoubleTurn) {
        actor.state.isDoubleTurn = false;
        if (actor.currentHp > 0 && target.currentHp > 0) {
          executeHit({
            actor,
            target,
            rawBaseDamage: rawBaseDmg,
            elemData: getElementalAdvantage(actor.element, target.element),
            rng,
            attacker,
            defender,
            turnNumber,
            role,
            turns,
            extraEvents: ['Liên Hoàn Đòn (Thêm Lượt)'],
          });
        }
      }
    }
  }

  const attackerWon = attacker.currentHp > defender.currentHp;
  const winnerCombatant = attackerWon ? attacker : defender;
  const loserCombatant = attackerWon ? defender : attacker;
  const winner = { id: winnerCombatant.id, name: winnerCombatant.name, pet: winnerCombatant.petName };
  const loser = { id: loserCombatant.id, name: loserCombatant.name, pet: loserCombatant.petName };

  // Tính thưởng/phạt Linh Thạch nếu được kích hoạt từ endpoint đấu trường
  let rewardInfo = { applied: false, delta: 0, reward_summary: '' };
  if (safeOptions.applyRewards) {
    rewardInfo = await applyBattleLinhThachReward({
      mode,
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerWon,
      isMirror: attacker.id === defender.id,
      now: new Date(),
    });
  }

  const winnerPetEmoji = winnerCombatant.petIcon || petEmoji(winnerCombatant.petType, em('su_pet_paw'));
  const summary = `Trận đấu kết thúc sau ${turnNumber} hiệp. ${winner.name} cùng linh thú ${winner.pet} giành chiến thắng áp đảo!`;
  const headline = `${em('su_winner_trophy')} ${winner.name} (${winnerPetEmoji} ${winner.pet}) chiến thắng ${loser.name} (${loser.pet}) sau ${turnNumber} hiệp!`;

  const elementMatchup = {
    attackerToDefender: getElementalAdvantage(attacker.element, defender.element),
    defenderToAttacker: getElementalAdvantage(defender.element, attacker.element),
  };

  const shortPet = (s) => (s && s.length > 12 ? s.slice(0, 11) + '…' : s);
  const highlights = [];
  for (const ev of battleStartEvents.slice(0, 2)) {
    const actorName = shortPet(ev.actor === attacker.id ? attacker.petName : defender.petName);
    const skillShort = String(ev.skill || '').replace(/«[^»]+»\s*/g, '').trim();
    highlights.push(`Khai trận • ${actorName}: ${skillShort}`);
  }
  for (const t of turns) {
    if (highlights.length >= 5) break;
    const aName = shortPet(t.actor === 'attacker' ? attacker.petName : defender.petName);
    const dName = shortPet(t.actor === 'attacker' ? defender.petName : attacker.petName);
    if (t.action === 'skip') {
      highlights.push(`H${t.turn} • ${aName}: ${t.haxTriggered || 'Mất lượt'}`);
    } else if (t.haxTriggered || t.isCrit || t.turn === 1 || t.turn === turnNumber) {
      const critTxt = t.isCrit ? ' CRIT' : '';
      const haxTxt = t.haxTriggered ? ` (${t.haxTriggered.split('(')[0].trim().slice(0, 26)})` : '';
      highlights.push(`H${t.turn} • ${aName} → ${dName}: -${t.damage.toLocaleString('vi-VN')} HP${critTxt}${haxTxt}`);
    }
  }
  if (highlights.length === 0 && turns.length > 0) {
    const lastT = turns[turns.length - 1];
    const aName = shortPet(lastT.actor === 'attacker' ? attacker.petName : defender.petName);
    highlights.push(`H${lastT.turn} • ${aName} tung đòn kết liễu -${lastT.damage.toLocaleString('vi-VN')} HP`);
  }

  const snapshotCombatant = (c, initHp) => ({
    id: c.id,
    name: c.name,
    avatarUrl: c.avatarUrl || null,
    userLevel: c.userLevel || 1,
    avatarFrame: c.avatarFrame || 'default',
    petName: c.petName,
    petType: c.petType,
    petRarity: c.petRarity || 'Phàm Phẩm',
    petIcon: c.petIcon || petEmoji(c.petType, em('su_pet_paw')),
    element: c.element,
    level: c.level,
    star: c.star,
    enchantGrade: c.enchantGrade || c.enchant_grade || 'D',
    enchant_grade: c.enchantGrade || c.enchant_grade || 'D',
    atk: c.atk,
    def: c.def,
    spd: c.spd,
    maxHp: initHp,
    finalHp: c.currentHp,
    shield: c.shield || 0,
    critRate: c.critRate,
    equipment: c.equipment,
    hax: c.hax,
  });

  const battleId = crypto.randomBytes(6).toString('hex');
  const reportImagePath = `/api/battle/report/${battleId}.png`;
  const reportImageUrl = `${PUBLIC_BASE_URL}${reportImagePath}`;

  const logBundle = buildFullBattleLog({
    battleId,
    attacker,
    defender,
    initialHp,
    elementMatchup,
    battleStartEvents,
    turns,
    turnNumber,
    winner,
    winnerPetEmoji,
    loser,
    rewardSummary: rewardInfo.reward_summary,
  });
  const fullBattleLog = logBundle.fullText;

  const finalHp = {
    attacker: attacker.currentHp,
    defender: defender.currentHp,
  };
  const framesMeta = buildAdaptiveFrames(turns, turnNumber, initialHp, finalHp, headline);
  const frame1 = framesMeta[0];
  const frame2 = framesMeta[1] || frame1;
  const frameLast = framesMeta[framesMeta.length - 1];

  const finalResult = {
    success: true,
    mode,
    opponent_tier_label: opponentBand?.label || (mode === 'pvp' ? 'PvP 1v1' : 'PvE'),
    linh_thach_delta: rewardInfo.delta || 0,
    reward_summary: rewardInfo.reward_summary || '',
    battleId,
    turnCount: turnNumber,
    winnerRole: attackerWon ? 'attacker' : 'defender',
    winner,
    loser,
    turns,
    initialHp,
    finalHp,
    combatants: {
      attacker: snapshotCombatant(attacker, initialHp.attacker),
      defender: snapshotCombatant(defender, initialHp.defender),
    },
    elementMatchup,
    highlights,
    headline,
    summary,
    reportImagePath,
    reportImageUrl,
    frameCount: framesMeta.length,
    hasFrame3: framesMeta.length >= 3,
    frame1Url: `${PUBLIC_BASE_URL}/api/battle/report/${battleId}/1.webp`,
    frame1Title: frame1.title,
    frame2Url: `${PUBLIC_BASE_URL}/api/battle/report/${battleId}/2.webp`,
    frame2Title: frame2.title,
    frame3Url: `${PUBLIC_BASE_URL}/api/battle/report/${battleId}/${frameLast.index}.webp`,
    finalImageWebpUrl: `${PUBLIC_BASE_URL}/api/battle/report/${battleId}/${frameLast.index}.webp`,
    framesMeta,
    fullBattleLog,
    discordReport: fullBattleLog,
    untruncatedLogLines: logBundle.untruncatedLogLines,
    webLogUrl: logBundle.webLogUrl,
  };

  const frameBuffers = new Map();
  cacheBattleReport(battleId, finalResult, {
    channelId,
    attackerId: attacker.id,
    defenderId: defender.id,
    framesMeta,
    frameBuffers,
  });

  const preRenderTask = safeOptions.preRender !== false
    ? Promise.all(
      framesMeta.map(async (f) => {
        try {
          const buf = await renderBattleCardQueued(`battle:${battleId}:${f.index}:webp`, finalResult, {
            scale: f.scale,
            format: 'webp',
            webpQuality: f.scale <= 1 ? 80 : 84,
            frame: f,
          });
          if (buf) frameBuffers.set(f.index, buf);
        } catch (err) {
          console.warn(`[BattleService] Pre-render frame ${f.index} failed:`, err.message);
        }
      }),
    )
    : Promise.resolve();

  const clanWarTask = (supabase && /^[0-9]{17,20}$/.test(String(winner.id || '')))
    ? (async () => {
      try {
        const ids = /^[0-9]{17,20}$/.test(String(loser.id || '')) ? [winner.id, loser.id] : [winner.id];
        const { data: clanRows } = await supabase.from('users').select('user_id, clan_id').in('user_id', ids);
        const wClanId = clanRows?.find((r) => r.user_id === winner.id)?.clan_id || null;
        const lClanId = clanRows?.find((r) => r.user_id === loser.id)?.clan_id || null;
        if (wClanId) {
          let warPoints = 500;
          if (lClanId && lClanId !== wClanId) {
            const { data: directWar } = await supabase
              .from('clan_wars')
              .select('war_id')
              .eq('status', 'active')
              .or(`and(challenger_clan_id.eq.${wClanId},target_clan_id.eq.${lClanId}),and(challenger_clan_id.eq.${lClanId},target_clan_id.eq.${wClanId})`)
              .limit(1)
              .maybeSingle();
            if (directWar) warPoints = 1000;
          }
          await recordClanWarScore(wClanId, warPoints);
        }
      } catch {
        // non-blocking
      }
    })()
    : Promise.resolve();

  const questTrackTask = (!safeOptions.skipQuestTracking && /^[0-9]{17,20}$/.test(String(attacker.id || '')))
    ? trackQuestActivity(attacker.id, { battleDelta: 1, winDelta: attackerWon ? 1 : 0 })
    : Promise.resolve();

  const bgTasks = Promise.allSettled([preRenderTask, clanWarTask, questTrackTask]);
  if (safeOptions.awaitBackgroundTasks) {
    await bgTasks;
  } else {
    void bgTasks;
  }

  return finalResult;
}
