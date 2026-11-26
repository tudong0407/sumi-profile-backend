import crypto from 'crypto';
import { compileCombatant } from './statsCompiler.js';
import { getElementalAdvantage } from './elementalMatrix.js';
import {
  PUBLIC_BASE_URL,
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
} from '../../data/catalog.js';
import { em, petEmoji, itemEmoji, domainEmoji, domainElementEmoji, senseEmoji, realmEmojiById, uiEm } from '../../config/emojiHelper.js';
import { initDomainBattleState, processTurnDomainPhase, computeEffectiveDomainEnergy } from './domainEngine.js';
import { getCombatantV13HaxList, V13_PET_HAX } from './v13HaxRegistry.js';
import { supabase } from '../../config/supabase.js';
import { recordClanWarScore } from '../clanService.js';
import { trackQuestActivity } from '../questService.js';
import {
  BATTLE_LOG_TTL_MS,
  getCachedTurnBuffer,
  setCachedTurnBuffer,
  saveBattleLogRecord,
  loadBattleLogRecord,
} from './battleLogStore.js';
import {
  renderExpiredBattleLogHtml,
  renderInteractiveBattleLogPage,
  stripDiscordTagsToHtml,
} from './webBattleLogHtml.js';

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
  getEffectiveCombatSpd,
  getTrueDamageResistPct,
} from './haxEngine.js';
import {
  tickUltimateTurn,
  recordUltimateCombatMetrics,
  tryTriggerUltimate,
} from './ultimateEngine.js';

export const PVP_DAILY_LT_LIMIT = 15;
export const PVE_FREE_DAILY_LT_LIMIT = 25;
export const BATTLE_WIN_LT = 10;
export const BATTLE_LOSS_LT = 5;
export const BATTLE_COOLDOWN_MS = 15000;

const BATTLE_CACHE_MAX = 30;
const BATTLE_CACHE_TTL_MS = BATTLE_LOG_TTL_MS;
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

export async function loadBattleReport(battleId) {
  return getCacheEntry(battleId)?.result || await loadBattleLogRecord({ battleId, battleKind: '1v1' });
}

export function getCachedBattleFrame(battleId, frameIndex) {
  const entry = getCacheEntry(battleId);
  const ram = entry?.frameBuffers?.get(Number(frameIndex));
  if (ram) return ram;
  return getCachedTurnBuffer(battleId, `frame:${frameIndex}`);
}

export function setCachedBattleFrame(battleId, frameIndex, buffer) {
  const entry = getCacheEntry(battleId);
  if (entry && buffer) entry.frameBuffers.set(Number(frameIndex), buffer);
  if (buffer) setCachedTurnBuffer(battleId, `frame:${frameIndex}`, buffer);
}

export function getBattleFrameMeta(battleId, frameIndex, cachedReport = null) {
  const entry = getCacheEntry(battleId);
  const metaList = entry?.framesMeta || cachedReport?.framesMeta || [];
  const idx = Number(frameIndex);
  return metaList.find((f) => f.index === idx) || null;
}

export async function getBattleLogPayload({ battleId, channelId, userId } = {}) {
  const cleanId = battleId && !/^\{/.test(String(battleId)) ? String(battleId).trim() : null;
  let r = cleanId ? getCacheEntry(cleanId)?.result : null;
  if (!r) {
    r = await loadBattleLogRecord({ battleId: cleanId, channelId, userId, battleKind: '1v1' });
  }

  if (!r) {
    return {
      success: true,
      found: false,
      battleId: null,
      webLogUrl: `${PUBLIC_BASE_URL}/api/battle/logs/expired/view`,
      title: `${em('su_wiki_scroll')} NHẬT KÝ TRẬN ĐẤU`,
      description: 'Nhật ký trận đấu này đã quá hạn lưu trữ (tối đa 2 ngày) hoặc không tồn tại. Hãy dùng `/battle` để mở trận đấu mới!',
      footer: '',
    };
  }

  const bid = r.battleId || cleanId;
  return {
    success: true,
    found: true,
    battleId: bid,
    webLogUrl: r.webLogUrl || `${PUBLIC_BASE_URL}/api/battle/logs/${bid}/view`,
    title: `${em('su_wiki_scroll')} NHẬT KÝ TRẬN ĐẤU • ${r.winner.name} VS ${r.loser.name}`,
    description: r.fullBattleLog || r.discordReport || r.summary,
    footer: '',
  };
}

function buildFrameFromTurnSnapshot(r, snap) {
  const atkHp = snap?.hpBars?.[0]?.hp ?? r.finalHp?.attacker ?? 0;
  const defHp = snap?.hpBars?.[1]?.hp ?? r.finalHp?.defender ?? 0;
  const isFinal = Boolean(snap?.isFinal) || Number(snap?.turn) >= Number(r.turnCount || 1);
  return {
    index: Number(snap?.turn || 0),
    scale: 0.9,
    isFinal,
    currentTurn: Number(snap?.turn || 0),
    totalTurns: Number(r.turnCount || 1),
    turnLabel: Number(snap?.turn || 0) === 0
      ? 'KHAI TRẬN • CHUẨN BỊ XUẤT CHIÊU'
      : isFinal
        ? `HIỆP ${snap.turn} • KẾT THÚC`
        : `HIỆP ${snap.turn} / ${r.turnCount}`,
    attackerHp: atkHp,
    defenderHp: defHp,
    domainAtkEnergy: snap?.domainAtkEnergy,
    domainDefEnergy: snap?.domainDefEnergy,
  };
}

export async function renderSingleBattleTurnOnDemand(battleId, rawTurn) {
  const cleanId = String(battleId || '').trim();
  const r = await loadBattleReport(cleanId);
  if (!r) return null;

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [{ turn: Number(r.turnCount || 1), isFinal: true, hpBars: [{ hp: r.finalHp?.attacker ?? 0 }, { hp: r.finalHp?.defender ?? 0 }] }];

  const targetTurn = Math.max(0, Math.min(Number(r.turnCount || 1), Number(rawTurn) || 0));
  const cacheKey = `turn:${targetTurn}`;
  const hit = getCachedTurnBuffer(cleanId, cacheKey);
  if (hit) return hit;

  const snap = snaps.find((s) => Number(s.turn) === targetTurn) || snaps[snaps.length - 1];
  const frameObj = buildFrameFromTurnSnapshot(r, snap);
  const buf = await renderBattleCardQueued(`battle:${cleanId}:${cacheKey}:webp`, r, {
    scale: 0.9,
    format: 'webp',
    webpQuality: 74,
    frame: frameObj,
  });
  if (buf) setCachedTurnBuffer(cleanId, cacheKey, buf);
  return buf;
}

export async function renderAllBattleTurnsOnDemand(battleId) {
  const cleanId = String(battleId || '').trim();
  const r = await loadBattleReport(cleanId);
  if (!r) return { success: false, found: false, rendered_count: 0, urls: [] };

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [{ turn: Number(r.turnCount || 1), isFinal: true }];

  const urls = [];
  for (const snap of snaps) {
    const t = Number(snap.turn || 0);
    await renderSingleBattleTurnOnDemand(cleanId, t);
    urls.push(`/api/battle/logs/${encodeURIComponent(cleanId)}/turn/${t}.webp`);
  }
  return {
    success: true,
    found: true,
    battle_id: cleanId,
    rendered_count: urls.length,
    total_turns: Number(r.turnCount || 1),
    urls,
  };
}

export function getBattleCacheStats() {
  return {
    reports: battleReportCache.size,
    limit: BATTLE_CACHE_MAX,
  };
}

function resolveCombatantDomainMeta(c, domSummarySide = null) {
  const dl = c?.domainLoadout || {};
  const rawDom = dl.domain || (domSummarySide?.domainId ? DOMAIN_BY_ID[domSummarySide.domainId] : null);
  const dom = rawDom?.domain_id ? (DOMAIN_BY_ID[rawDom.domain_id] || rawDom) : rawDom;
  if (!dom) return null;

  const rawSense = dl.sense || (domSummarySide?.senseId ? DIVINE_SENSE_BY_ID[domSummarySide.senseId] : null)
    || (domSummarySide?.senseName ? Object.values(DIVINE_SENSE_BY_ID).find((x) => x.name === domSummarySide.senseName) : null);
  const sense = rawSense?.sense_id ? (DIVINE_SENSE_BY_ID[rawSense.sense_id] || rawSense) : rawSense;

  const rawRealm = dl.realm || (domSummarySide?.realmId ? DIVINE_REALM_BY_ID[domSummarySide.realmId] : null)
    || (domSummarySide?.realmName ? Object.values(DIVINE_REALM_BY_ID).find((x) => x.name === domSummarySide.realmName) : null);
  const realm = rawRealm?.realm_id ? (DIVINE_REALM_BY_ID[rawRealm.realm_id] || rawRealm) : rawRealm;

  const energyInfo = computeEffectiveDomainEnergy({
    domain: dom,
    sense,
    equipment: c?.equipment,
    setBonus: c?.setBonus,
  });
  const lm = energyInfo.isInfinite ? '∞ Linh Mạch' : `${energyInfo.totalEnergy} Linh Mạch`;

  return {
    iconTag: domainEmoji(dom.domain_id, em('su_realm_star')),
    name: dom.name,
    elementTag: domainElementEmoji(dom.element, em('su_realm_star')),
    element: dom.element || '',
    energyLabel: lm,
    buffDesc: dom.buff_desc || '',
    debuffDesc: dom.debuff_desc || '',
    daoApLabel: dom.dao_ap?.label || '',
    sense: sense
      ? {
          iconTag: senseEmoji(sense.sense_id, em('su_sparkle')),
          name: sense.name,
          desc: sense.desc || '',
        }
      : null,
    realm: realm
      ? {
          iconTag: realmEmojiById(realm.realm_id, em('su_arena')),
          name: realm.name,
          desc: realm.desc || '',
        }
      : null,
  };
}

function buildStructuredUnitForWeb(c, initHp, domSummarySide = null) {
  if (!c) return null;
  const catPet = PET_BY_TYPE[c.petType];
  const petHaxName = c.petHaxName || c.hax?.pet || catPet?.hax_skill || '';
  const petHaxDesc = c.petHaxDesc || c.hax?.petDesc || catPet?.hax_description || '';
  const mapEquip = (rawItem, slotLabel, fallbackIcon) => {
    if (!rawItem) return { slotLabel, name: '' };
    const cat = rawItem.item_id ? (EQUIPMENT_BY_ID[rawItem.item_id] || rawItem) : rawItem;
    return {
      slotLabel,
      iconTag: itemEmoji(rawItem.item_id || cat.item_id, fallbackIcon),
      name: rawItem.item_name || cat.item_name || rawItem.item_id || '',
      grade: rawItem.enchant_grade || rawItem.enchantGrade || '',
      haxName: rawItem.hax_skill || cat.hax_skill || '',
      haxDesc: rawItem.hax_description || cat.hax_description || '',
    };
  };
  return {
    playerName: c.name || 'Tu Sĩ',
    petIconTag: c.petIcon || petEmoji(c.petType, em('su_pet_paw')),
    petName: c.petName || catPet?.pet_name || 'Linh Thú',
    metaLine: `${c.petRarity || catPet?.rarity || 'Phàm Phẩm'} • Hệ ${c.element || catPet?.element || 'Thổ'} • Lv.${c.level || 1} • ${c.star || 1}★`,
    stats: {
      atk: c.atk || 0,
      def: c.def || 0,
      spd: c.spd || 0,
      hp: initHp || c.maxHp || 0,
    },
    petHax: petHaxName ? { name: petHaxName, desc: petHaxDesc } : null,
    domain: resolveCombatantDomainMeta(c, domSummarySide),
    equipment: [
      mapEquip(c.equipment?.weapon, 'Vũ Khí', em('su_crossed_swords')),
      mapEquip(c.equipment?.gem, 'Bảo Ngọc', em('su_linhthach')),
      mapEquip(c.equipment?.soul, 'Chiến Hồn', em('su_sparkle')),
    ],
  };
}

export async function renderBattleLogHtml(battleId) {
  const cleanId = String(battleId || '').trim();
  const r = await loadBattleReport(cleanId);
  if (!r) {
    return {
      found: false,
      html: renderExpiredBattleLogHtml(cleanId, false),
    };
  }

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [
        {
          turn: 0,
          isFinal: false,
          hpBars: [
            { side: 'A', label: `${r.combatants?.attacker?.name || 'Công'} (${r.combatants?.attacker?.petName || 'Pet'})`, hp: r.initialHp?.attacker || 0, prevHp: r.initialHp?.attacker || 0, maxHp: r.initialHp?.attacker || 1, shield: 0 },
            { side: 'B', label: `${r.combatants?.defender?.name || 'Thủ'} (${r.combatants?.defender?.petName || 'Pet'})`, hp: r.initialHp?.defender || 0, prevHp: r.initialHp?.defender || 0, maxHp: r.initialHp?.defender || 1, shield: 0 },
          ],
          events: ['• Khai trận đấu 1v1!'],
        },
        {
          turn: Number(r.turnCount || 1),
          isFinal: true,
          hpBars: [
            { side: 'A', label: `${r.combatants?.attacker?.name || 'Công'} (${r.combatants?.attacker?.petName || 'Pet'})`, hp: r.finalHp?.attacker ?? 0, prevHp: r.initialHp?.attacker || 0, maxHp: r.initialHp?.attacker || 1, shield: 0 },
            { side: 'B', label: `${r.combatants?.defender?.name || 'Thủ'} (${r.combatants?.defender?.petName || 'Pet'})`, hp: r.finalHp?.defender ?? 0, prevHp: r.initialHp?.defender || 0, maxHp: r.initialHp?.defender || 1, shield: 0 },
          ],
          events: (r.untruncatedLogLines || []).filter((l) => l.startsWith('• **H')),
        },
      ];

  const headerEndIdx = (r.untruncatedLogLines || []).findIndex((l) => l.startsWith('**Diễn Biến'));
  const rosterHtmlLines = headerEndIdx > 0 ? r.untruncatedLogLines.slice(0, headerEndIdx) : [];
  const openingIdx = rosterHtmlLines.findIndex((l) => l.includes('Khai Trận HAX'));
  const openingEvents = openingIdx >= 0 ? rosterHtmlLines.slice(openingIdx + 1).filter((l) => l.trim()) : [];
  const matchupLineRaw = rosterHtmlLines.find((l) => l.includes('Tương khắc:')) || '';
  const matchupNote = matchupLineRaw
    ? matchupLineRaw.replace(/^•\s*Tương khắc:\s*/i, '').replace(/\*\*/g, '').trim()
    : '';
  const leftUnit = buildStructuredUnitForWeb(r.combatants?.attacker, r.initialHp?.attacker, r.domainSummary?.attacker);
  const rightUnit = buildStructuredUnitForWeb(r.combatants?.defender, r.initialHp?.defender, r.domainSummary?.defender);
  const rosterStructured = (leftUnit && rightUnit)
    ? {
        leftTitle: 'Phe Công',
        rightTitle: 'Phe Thủ',
        leftUnits: [leftUnit],
        rightUnits: [rightUnit],
        matchupNote,
        openingEvents,
      }
    : null;
  const winnerSummaryHtml = stripDiscordTagsToHtml(
    `${em('su_winner_trophy')} **KẾT QUẢ:** **${r.winner?.name}** (${r.winner?.pet}) chiến thắng **${r.loser?.name}** (${r.loser?.pet}) sau **${r.turnCount} hiệp**!${r.reward_summary ? ` • ${r.reward_summary}` : ''}`,
  );

  const html = renderInteractiveBattleLogPage({
    battleId: cleanId,
    title: `${r.combatants?.attacker?.name || 'Phe Công'} vs ${r.combatants?.defender?.name || 'Phe Thủ'}`,
    subtitle: `${r.opponent_tier_label || r.mode || '1v1'} • ${r.combatants?.attacker?.petName || ''} vs ${r.combatants?.defender?.petName || ''}`,
    totalTurns: r.turnCount || 1,
    expiresAtMs: r.expiresAtMs || ((r.createdAtMs || Date.now()) + BATTLE_LOG_TTL_MS),
    renderAllUrl: `/api/battle/logs/${encodeURIComponent(cleanId)}/render-all`,
    turnImageTemplate: `/api/battle/logs/${encodeURIComponent(cleanId)}/turn/{turn}.webp`,
    snapshots: snaps,
    rosterHtmlLines,
    rosterStructured,
    winnerSummaryHtml,
    themeAccent: '#ec4899',
  });

  return { found: true, html };
}

export function buildAdaptiveFrames(turns, turnCount, initialHp, finalHp, headline) {
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
        scale: 0.72,
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
        scale: 1.25,
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

  // Discord render: H1 -> H5 -> H10 -> H15 -> H20 -> Final (thắng sớm dừng sớm)
  const milestones = [1, 5, 10, 15, 20].filter((m) => m < turnCount);
  if (milestones.length === 0) milestones.push(1);
  const frames = [];
  let idx = 1;
  for (const m of milestones) {
    const hp = getHpAtEndOfTurn(m);
    frames.push({
      index: idx,
      scale: 0.72,
      isFinal: false,
      currentTurn: m,
      totalTurns: turnCount,
      turnLabel: `ĐANG GIAO CHIẾN • HIỆP ${m}/${turnCount}`,
      title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • HIỆP ${m}/${turnCount}...`,
      attackerHp: hp.attackerHp,
      defenderHp: hp.defenderHp,
    });
    idx += 1;
  }

  frames.push({
    index: idx,
    scale: 1.25,
    isFinal: true,
    currentTurn: turnCount,
    totalTurns: turnCount,
    turnLabel: `HIỆP ${turnCount} • KẾT THÚC`,
    title: headline,
    attackerHp: finalHp.attacker,
    defenderHp: finalHp.defender,
  });

  return frames;
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
      `• Pháp Bảo: ${shortDesc(w, `${em('su_crossed_swords')}`, 'VK')} • ${shortDesc(g, `${em('su_linhthach')}`, 'Ngọc')} • ${shortDesc(s, `${em('su_el_hoa')}`, 'Hồn')}`,
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
    `• ${w ? itemEmoji(w.item_id, em('su_crossed_swords')) : em('su_crossed_swords')} ${desc(w, 'Vũ Khí')}`,
    `• ${g ? itemEmoji(g.item_id, em('su_linhthach')) : em('su_linhthach')} ${desc(g, 'Bảo Ngọc')}`,
    `• ${s ? itemEmoji(s.item_id, em('su_sparkle')) : em('su_sparkle')} ${desc(s, 'Chiến Hồn')}`,
  ];
}

function buildFullBattleLog({
  battleId,
  attacker,
  defender,
  initialHp,
  elementMatchup,
  battleStartEvents,
  domainEvents = [],
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
    if (a2d?.multiplier >= 1.25 && d2a?.multiplier >= 1.25) return `Ám <-> Quang Tương Sát (+25% DMG)`;
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

  const domainLineTxt = (c, compact = false) => {
    const dl = c.domainLoadout || {};
    if (!dl.domain) return null;
    const d = DOMAIN_BY_ID[dl.domain.domain_id] || dl.domain;
    const sense = dl.sense ? (DIVINE_SENSE_BY_ID[dl.sense.sense_id] || dl.sense) : null;
    const realm = dl.realm ? (DIVINE_REALM_BY_ID[dl.realm.realm_id] || dl.realm) : null;
    const lm = d.base_energy >= 999 ? '∞' : (d.base_energy + (sense?.bonus_energy || 0));
    const domElIcon = domainElementEmoji(d.element, em('su_realm_star'));
    if (compact) {
      const compactParts = [
        sense ? `${senseEmoji(sense.sense_id, em('su_sparkle'))} ${sense.name}` : null,
        realm ? `${realmEmojiById(realm.realm_id, em('su_arena'))} ${realm.name}` : null,
      ].filter(Boolean).join(' • ');
      return `• ${domainEmoji(d.domain_id, em('su_realm_star'))} Linh Vực: **${d.name}** *(${domElIcon} ${d.element} • ${lm} Linh Mạch${compactParts ? ` | ${compactParts}` : ''})*`;
    }
    const sensePart = sense
      ? `${senseEmoji(sense.sense_id, em('su_sparkle'))} ${sense.name}${sense.desc ? ` (${sense.desc})` : ''}`.trim()
      : null;
    const realmPart = realm
      ? `${realmEmojiById(realm.realm_id, em('su_arena'))} ${realm.name}${realm.desc ? ` (${realm.desc})` : ''}`.trim()
      : null;
    const haxParts = [d.buff_desc, d.debuff_desc, d.dao_ap?.label].filter(Boolean).join(' • ');
    const extras = [sensePart, realmPart].filter(Boolean).join(' • ');
    return `• ${domainEmoji(d.domain_id, em('su_realm_star'))} Linh Vực: **${d.name}** *(${domElIcon} ${d.element} • ${lm} Linh Mạch${haxParts ? ` — ${haxParts}` : ''}${extras ? ` | ${extras}` : ''})*`;
  };

  const makeHeaderLines = (compact = false) => [
    `**1. Phe Công:** **${attacker.name}** — ${atkIcon} **${attacker.petName}** *(${attacker.petRarity || 'Phàm'} • Hệ ${attacker.element} • Lv.${attacker.level} • ${attacker.star || 1}★)*`,
    `• \`ATK ${attacker.atk.toLocaleString('vi-VN')} | DEF ${attacker.def.toLocaleString('vi-VN')} | SPD ${attacker.spd.toLocaleString('vi-VN')} | HP ${initialHp.attacker.toLocaleString('vi-VN')}\``,
    `• HAX Pet: ${petHaxTxt(attacker)}`,
    ...(domainLineTxt(attacker, compact) ? [domainLineTxt(attacker, compact)] : []),
    ...formatEquipDetailedLines(attacker, compact),
    '',
    `**2. Phe Thủ:** **${defender.name}** — ${defIcon} **${defender.petName}** *(${defender.petRarity || 'Phàm'} • Hệ ${defender.element} • Lv.${defender.level} • ${defender.star || 1}★)*`,
    `• \`ATK ${defender.atk.toLocaleString('vi-VN')} | DEF ${defender.def.toLocaleString('vi-VN')} | SPD ${defender.spd.toLocaleString('vi-VN')} | HP ${initialHp.defender.toLocaleString('vi-VN')}\``,
    `• HAX Pet: ${petHaxTxt(defender)}`,
    ...(domainLineTxt(defender, compact) ? [domainLineTxt(defender, compact)] : []),
    ...formatEquipDetailedLines(defender, compact),
    `• Tương khắc: **${elemNote}**`,
  ];

  const headerLines = makeHeaderLines(false);
  const compactHeaderLines = makeHeaderLines(true);

  const combinedStartEvents = [
    ...battleStartEvents.map((ev) => ({
      pet: ev.actor === attacker.id ? attacker.petName : defender.petName,
      skill: ev.skill,
      tag: 'Khai Trận',
    })),
    ...domainEvents.slice(0, 8).map((ev) => ({
      pet: ev.actor === attacker.id ? attacker.petName : defender.petName,
      skill: `H${ev.turn} • ${ev.skill}`,
      tag: 'Linh Vực',
    })),
  ];

  const startLines = combinedStartEvents.length > 0
    ? ['', '**Khai Trận HAX & Đấu Linh Vực:**', ...combinedStartEvents.map((ev) => `• ${em('su_thunder_hax')} **${ev.pet}**: ${ev.skill}`)]
    : [];

  const buildTurnLines = (compactMode = false) => turns.map((t) => {
    const actorObj = t.actor === 'attacker' ? attacker : defender;
    const targetObj = t.actor === 'attacker' ? defender : attacker;
    if (t.action === 'skip') {
      const sIcon = compactMode ? `${em('su_shield_def')}` : em('su_shield_def');
      return `• **H${t.turn}** [${actorObj.petName}]: ${sIcon} ${t.haxTriggered || 'Mất lượt'}`;
    }
    if (t.action === 'miss') {
      return compactMode
        ? `• **H${t.turn}** **${actorObj.petName}**: *Trượt (${t.haxTriggered || 'Né'})*`
        : `• **H${t.turn}** **${actorObj.petName}** → **${targetObj.petName}**: *Trượt (${t.haxTriggered || 'Né'})*`;
    }
    const cIcon = compactMode ? `${em('su_crit_boom')}` : em('su_crit_boom');
    const critTag = t.isCrit ? ` ${cIcon} **CRIT**` : '';
    const shieldTag = t.absorbedByShield > 0 ? ` *(khiên chặn ${t.absorbedByShield.toLocaleString('vi-VN')})*` : '';
    const haxTag = t.haxTriggered ? ` *(${t.haxTriggered})*` : '';
    if (compactMode) {
      return `• **H${t.turn}** **${actorObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${shieldTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')}/${t.defenderHp.toLocaleString('vi-VN')})*`;
    }
    return `• **H${t.turn}** **${actorObj.petName}** → **${targetObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${shieldTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')} / ${t.defenderHp.toLocaleString('vi-VN')})*`;
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
    ...(webLogUrl ? [`• ${em('su_realm_star')} **Bản Web đầy đủ 100% hiệp:** [Mở Xem Chi Tiết Trên Web](${webLogUrl})`] : []),
  ];

  const untruncatedLogLines = [
    ...headerLines,
    ...startLines,
    '',
    `**Diễn Biến Chi Tiết (${turnNumber} Hiệp):**`,
    ...allTurnLines,
    ...webFooterLines,
  ];

  const assembleBody = (tLines, hLines = headerLines) => [
    ...hLines,
    ...startLines,
    '',
    `**Diễn Biến Chi Tiết (${turnNumber} Hiệp):**`,
    ...tLines,
  ].join('\n');

  const footerBlock = '\n' + discordFooterLines.join('\n');
  const assembleDiscord = (tLines, hLines = headerLines) => `${assembleBody(tLines, hLines)}${footerBlock}`;

  let activeHeader = headerLines;
  let activeTurns = allTurnLines;
  let fullText = assembleDiscord(activeTurns, activeHeader);
  if (fullText.length > 3880) {
    activeHeader = compactHeaderLines;
    fullText = assembleDiscord(activeTurns, activeHeader);
  }
  if (fullText.length > 3880) {
    activeTurns = compactTurnLines;
    fullText = assembleDiscord(activeTurns, activeHeader);
  }

  if (fullText.length > 3880 && compactTurnLines.length > 2) {
    for (let keep = compactTurnLines.length - 1; keep >= 2; keep -= 1) {
      const headCount = Math.ceil(keep / 2);
      const tailCount = Math.floor(keep / 2);
      const omitted = compactTurnLines.length - headCount - tailCount;
      const omitNote = webLogUrl
        ? `• *... (đã ẩn ${omitted} lượt giữa do giới hạn 4096 ký tự Discord — [Bấm xem Full 100% trên Web](${webLogUrl})) ...*`
        : `• *... (đã rút gọn ${omitted} lượt giữa để vừa giới hạn tin nhắn Discord) ...*`;
      const trimmedTurns = [
        ...compactTurnLines.slice(0, headCount),
        omitNote,
        ...compactTurnLines.slice(-tailCount),
      ];
      const candidate = assembleDiscord(trimmedTurns, activeHeader);
      if (candidate.length <= 3880 || keep === 2) {
        activeTurns = trimmedTurns;
        fullText = candidate;
        break;
      }
    }
  }

  if (fullText.length > 3950) {
    const bodyOnly = assembleBody(activeTurns, activeHeader);
    const maxBodyLen = Math.max(400, 3920 - footerBlock.length - 4);
    const clippedBody = bodyOnly.length > maxBodyLen ? `${bodyOnly.slice(0, maxBodyLen)}\n…` : bodyOnly;
    fullText = `${clippedBody}${footerBlock}`;
    if (fullText.length > 3950) {
      fullText = fullText.slice(0, 3940) + '\n…';
    }
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
  forcedShieldPiercePct = 0,
  extraEvents = [],
}) {
  let attackPhase;
  if (forcedDamage !== null) {
    const totalDefRed = Math.min(0.75, (target.state?.defDebuffPct || 0) + Number(target.domainRuntime?.incomingDebuffs?.defReductionPct || 0));
    const baseDefTarget = elemData.isTrueDamage ? 0 : Math.max(0, Math.round(target.def * (1 - totalDefRed)));
    const effDef = forcedDefPiercePct >= 1.0 ? 0 : Math.floor(baseDefTarget * Math.max(0, 1 - forcedDefPiercePct));
    const calc = Math.max(50, Math.floor((forcedDamage - effDef * 0.4) * (elemData.multiplier || 1)));
    attackPhase = {
      damage: calc,
      isCrit: false,
      isMiss: false,
      isDodged: false,
      triggerCounter: false,
      shieldPiercePct: forcedShieldPiercePct,
      shieldDamageMult: 1.0,
      bonusTrueOnShieldBreakPct: 0,
      ignoreEnemyDmgRedPct: 0,
      isTrueDamage: Boolean(elemData.isTrueDamage),
      lifestealPct: 0,
      onHitMaxHpHealPct: 0,
      applyOnHitEffects: null,
      instantExecute: false,
      haxTriggered: label,
    };
  } else {
    attackPhase = triggerAttackPhase(actor, target, rawBaseDamage, rng, elemData, { deferOnHitEffects: true });
  }

  const notes = [...extraEvents];
  if (attackPhase.haxTriggered) notes.push(attackPhase.haxTriggered);
  let actualDamageDealt = 0;
  let absorbedByShield = 0;

  if (!attackPhase.isMiss) {
    const damageRecv = triggerDamageReceived(target, attackPhase.damage, actor, rng, {
      ignoreEnemyDmgRedPct: attackPhase.ignoreEnemyDmgRedPct || 0,
      isTrueDamage: Boolean(attackPhase.isTrueDamage),
    });
    if (!damageRecv.nullified && typeof attackPhase.applyOnHitEffects === 'function') {
      const onHitNotes = attackPhase.applyOnHitEffects();
      if (onHitNotes.length > 0) notes.push(...onHitNotes);
    }
    for (const ev of damageRecv.events || []) {
      if (ev?.skill) notes.push(ev.skill);
    }

    let dmgToApply = damageRecv.finalDamage;
    const hadShield = target.shield || 0;

    if (hadShield > 0) {
      const piercePct = Math.min(1, Math.max(0, Number(attackPhase.shieldPiercePct) || 0));
      const shieldMult = Math.max(1.0, Number(attackPhase.shieldDamageMult) || 1.0);
      const bypassDmg = Math.floor(dmgToApply * piercePct);
      let shieldableDmg = dmgToApply - bypassDmg;

      const shieldCost = Math.ceil(shieldableDmg * shieldMult);
      if (target.shield >= shieldCost) {
        target.shield -= shieldCost;
        absorbedByShield = shieldableDmg;
        shieldableDmg = 0;
      } else {
        absorbedByShield = Math.floor(target.shield / shieldMult);
        shieldableDmg = Math.max(0, shieldableDmg - absorbedByShield);
        target.shield = 0;
      }
      dmgToApply = bypassDmg + shieldableDmg;

      if (target.shield === 0) {
        if (attackPhase.bonusTrueOnShieldBreakPct > 0) {
          const breakBonus = Math.floor(target.maxHp * attackPhase.bonusTrueOnShieldBreakPct * (1 - getTrueDamageResistPct(target)));
          dmgToApply += breakBonus;
          notes.push(`Vỡ Khiên +${breakBonus.toLocaleString('vi-VN')} ST Chuẩn`);
        }
        if (target.state.shieldExplodePct > 0) {
          const pct = target.state.shieldExplodePct;
          target.state.shieldExplodePct = 0;
          const explodeDmg = Math.floor(target.maxHp * pct * (1 - getTrueDamageResistPct(actor)));
          actor.currentHp = Math.max(0, actor.currentHp - explodeDmg);
          notes.push(`Nổ Hộ Thuẫn (-${explodeDmg.toLocaleString('vi-VN')} ST chuẩn, bỏ qua khiên)`);
          if (actor.currentHp <= 0) {
            const li = triggerLethalInterception(actor, target, rng);
            if (li.survived && li.skill) notes.push(li.skill);
          }
        }
      }
    }

    target.currentHp = Math.max(0, target.currentHp - dmgToApply);
    actualDamageDealt = dmgToApply;
    recordUltimateCombatMetrics(actor, target, {
      damageDealt: actualDamageDealt,
      isCrit: attackPhase.isCrit,
      dodgedByTarget: attackPhase.isMiss,
      burnApplied: Boolean(target.state?.burnTurns > 0),
      stunApplied: Boolean(target.state?.isStunned),
    });

    if (attackPhase.lifestealPct > 0 && actualDamageDealt > 0 && actor.currentHp > 0) {
      const healed = applyHeal(actor, actualDamageDealt * attackPhase.lifestealPct);
      if (healed > 0) notes.push(`Hút Máu +${healed.toLocaleString('vi-VN')}`);
    }

    if (!damageRecv.nullified && attackPhase.onHitMaxHpHealPct > 0 && actor.currentHp > 0) {
      const healed = applyHeal(actor, actor.maxHp * attackPhase.onHitMaxHpHealPct);
      if (healed > 0) notes.push(`Ngọc Tiêu Hồi +${healed.toLocaleString('vi-VN')} HP`);
    }

    if (damageRecv.reflectedDamage > 0 && actor.currentHp > 0) {
      actor.currentHp = Math.max(0, actor.currentHp - damageRecv.reflectedDamage);
      notes.push(`Phản Đòn -${damageRecv.reflectedDamage.toLocaleString('vi-VN')} ST (thẳng máu, bỏ qua khiên)`);
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
    absorbedByShield,
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

  // Chặn nếu Linh Thú chính của người khiêu chiến đang bận đi Khám Phá (/explorer) hoặc Trọng Thương!
  const rawAttackerId = typeof attackerUserOrId === 'string'
    ? attackerUserOrId
    : (attackerUserOrId?.user_id || attackerUserOrId?.userId || '');
  if (supabase && /^[0-9]{15,22}$/.test(String(rawAttackerId)) && !safeOptions.skipExplorerPetCheck) {
    const { data: activePetRow } = await supabase
      .from('user_pets')
      .select('pet_name, status')
      .eq('user_id', String(rawAttackerId))
      .eq('is_active', true)
      .maybeSingle();
    if (activePetRow?.status === 'exploring') {
      return {
        success: false,
        status: 400,
        error: 'PET_BUSY_EXPLORING',
        message: `${uiEm('ui_compass_dir')} Linh Thú chính **${activePetRow.pet_name}** của bạn hiện đang đi **Khám Phá Bản Đồ** (\`/explorer\`) nên không thể tham gia PvP/PvE!\n• Bạn có thể dùng \`/linhthu\` chuyển sang một **Linh Thú phụ đang rảnh** làm Pet chính để tiếp tục chiến đấu bình thường.`,
      };
    }
    if (activePetRow?.status === 'injured') {
      return {
        success: false,
        status: 400,
        error: 'PET_INJURED',
        message: `${uiEm('ui_heal_band')} Linh Thú chính **${activePetRow.pet_name}** đang bị **Trọng Thương** sau chuyến khám phá! Hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` hoặc đổi sang Linh Thú khác.`,
      };
    }
  }

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
  const domainState = initDomainBattleState(attacker, defender);
  const domainEvents = [];

  const atkHasSpeedPriority = hasPet(attacker, 'loi_dinh_kim_ho') || hasHax(attacker, 'lôi quang tốc') || Boolean(V13_PET_HAX[attacker.petType]?.firstStrike);
  const defHasSpeedPriority = hasPet(defender, 'loi_dinh_kim_ho') || hasHax(defender, 'lôi quang tốc') || Boolean(V13_PET_HAX[defender.petType]?.firstStrike);

  const computeAttackerFirst = () => {
    if (atkHasSpeedPriority && !defHasSpeedPriority) return true;
    if (!atkHasSpeedPriority && defHasSpeedPriority) return false;
    return getEffectiveCombatSpd(attacker) >= getEffectiveCombatSpd(defender);
  };
  let attackerFirst = computeAttackerFirst();

  const formatDomainTurnInfo = () => {
    const da = domainState.attacker;
    const dd = domainState.defender;
    if (!da.hasDomain && !dd.hasDomain) return '';
    const fa = da.hasDomain ? `${da.domain.name}: ${da.indestructible ? '∞' : da.energy}/${da.indestructible ? '∞' : da.maxEnergy}` : 'Trống';
    const fb = dd.hasDomain ? `${dd.domain.name}: ${dd.indestructible ? '∞' : dd.energy}/${dd.indestructible ? '∞' : dd.maxEnergy}` : 'Trống';
    return `Linh Mạch: ${fa} vs ${fb}`;
  };

  const turnSnapshots = [
    {
      turn: 0,
      isFinal: false,
      domainAtkEnergy: domainState.attacker.energy,
      domainDefEnergy: domainState.defender.energy,
      domainLabel: formatDomainTurnInfo(),
      hpBars: [
        { side: 'A', label: `${attacker.name} (${attacker.petName})`, hp: attacker.currentHp, prevHp: initialHp.attacker, maxHp: initialHp.attacker, shield: attacker.shield || 0 },
        { side: 'B', label: `${defender.name} (${defender.petName})`, hp: defender.currentHp, prevHp: initialHp.defender, maxHp: initialHp.defender, shield: defender.shield || 0 },
      ],
      events: battleStartEvents.length > 0
        ? battleStartEvents.map((ev) => `• ${em('su_thunder_hax')} **${ev.actor === attacker.id ? attacker.petName : defender.petName}**: ${ev.skill}`)
        : ['• Đôi bên chuẩn bị khai chiến!'],
    },
  ];

  let turnNumber = 0;

  while (attacker.currentHp > 0 && defender.currentHp > 0 && turnNumber < maxTurns) {
    turnNumber += 1;
    const prevAtkHp = attacker.currentHp;
    const prevDefHp = defender.currentHp;
    const startTurnIdx = turns.length;
    const turnDomLogLines = [];

    if (turnNumber >= 2) {
      const dEvs = processTurnDomainPhase(turnNumber, attacker, defender, domainState, rng) || [];
      if (dEvs.length > 0) {
        domainEvents.push(...dEvs.map((e) => ({ ...e, turn: turnNumber })));
        for (const ev of dEvs) {
          const petLabel = ev.actor === attacker.id ? attacker.petName : defender.petName;
          turnDomLogLines.push(`• ${em('su_realm_star')} **[Linh Vực • ${petLabel}]** ${ev.skill}`);
        }
      }
    }

    attackerFirst = computeAttackerFirst();
    const order = attackerFirst
      ? [{ actor: attacker, target: defender, role: 'attacker' }, { actor: defender, target: attacker, role: 'defender' }]
      : [{ actor: defender, target: attacker, role: 'defender' }, { actor: attacker, target: defender, role: 'attacker' }];

    for (const step of order) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

      const { actor, target, role } = step;
      const oppRole = role === 'attacker' ? 'defender' : 'attacker';
      tickUltimateTurn(actor, turnNumber);
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
          haxTriggered: startTags.length > 0 ? startTags.join(' • ') : 'Mất lượt do khống chế',
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

      // Phản công tức thì nếu Thái Âm Ngọc Thỏ hoặc Thiên Cơ Ngọc Hồ / Chiến Hồn né đòn thành công
      if (mainRes.attackPhase.triggerCounter && actualTarget.currentHp > 0 && actor.currentHp > 0) {
        const counterElem = getElementalAdvantage(actualTarget.element, actor.element);
        const ratio = mainRes.attackPhase.counterAtkRatio || 0.80;
        const pierce = mainRes.attackPhase.counterDefPierce || 0;
        const cLabel = mainRes.attackPhase.counterLabel || 'Nguyệt Hoa Phản Công (80% ATK)';
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
          label: cLabel,
          forcedDamage: Math.floor(actualTarget.atk * ratio),
          forcedDefPiercePct: pierce,
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

      // Liên kích phụ & Tuyệt kỹ chu kỳ 2 hiệp v1.3 (Thanh Lam Tiểu Diều, Thiên Khung Kim Điêu, Lôi Tiễn, Thời Không Trảm, Đế Kiếm...)
      if (actor.currentHp > 0 && actualTarget.currentHp > 0 && (actor.state?.haxLockedTurns || 0) === 0) {
        const actorV13 = getCombatantV13HaxList(actor);
        const haxBoost = 1 + Number(actor.domainRuntime?.own?.buffs?.haxProcBonusPct || 0);
        for (const h of actorV13) {
          if (h.extraStrike && actor.currentHp > 0 && actualTarget.currentHp > 0) {
            const p = Math.min(0.60, h.extraStrike.chance * haxBoost);
            if (rng() < p) {
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
                label: h.extraStrike.label,
                forcedDamage: Math.floor(actor.atk * h.extraStrike.atkRatio),
                forcedDefPiercePct: h.extraStrike.defPierce || 0,
                forcedShieldPiercePct: h.extraStrike.shieldPierce || 0,
              });
            }
          }
          if (h.every2TurnStrike && turnNumber % 2 === 0 && actor.currentHp > 0 && actualTarget.currentHp > 0) {
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
              label: h.every2TurnStrike.label,
              forcedDamage: Math.floor(actor.atk * h.every2TurnStrike.atkRatio),
              forcedDefPiercePct: h.every2TurnStrike.defPierce || 0,
              forcedShieldPiercePct: h.every2TurnStrike.shieldPierce || 0,
            });
          }
        }
      }

      // Skill Ultimate Tái Kích Hoạt (40 Pet Tối Thượng Chân Thần)
      if (!turnStartResult.attackSelf && actor.currentHp > 0 && actualTarget.currentHp > 0) {
        const ultRes = tryTriggerUltimate(actor, actualTarget, { rng, turnNumber });
        if (ultRes.triggered) {
          turns.push({
            turn: turnNumber,
            actor: role,
            action: 'ultimate',
            damage: ultRes.damage || 0,
            shieldAbsorbed: ultRes.shieldAbsorbed || 0,
            isCrit: false,
            elementAdvantage: null,
            haxTriggered: `[ULTIMATE #${ultRes.triggerCount}] ${ultRes.ultimateName} • ${ultRes.logs.join(' • ')}`,
            attackerHp: attacker.currentHp,
            defenderHp: defender.currentHp,
          });
        }
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

    const thisTurnActions = turns.slice(startTurnIdx).map((t) => {
      const actorObj = t.actor === 'attacker' ? attacker : defender;
      const targetObj = t.actor === 'attacker' ? defender : attacker;
      if (t.action === 'skip') {
        return `• ${em('su_shield_def')} **${actorObj.petName}**: ${t.haxTriggered || 'Mất lượt'}`;
      }
      if (t.action === 'miss') {
        return `• **${actorObj.petName}** → **${targetObj.petName}**: *Trượt (${t.haxTriggered || 'Né'})*`;
      }
      const critTag = t.isCrit ? ` ${em('su_crit_boom')} **CRIT**` : '';
      const shieldTag = t.absorbedByShield > 0 ? ` *(khiên chặn ${t.absorbedByShield.toLocaleString('vi-VN')})*` : '';
      const haxTag = t.haxTriggered ? ` *(${t.haxTriggered})*` : '';
      return `• **${actorObj.petName}** → **${targetObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${shieldTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')} / ${t.defenderHp.toLocaleString('vi-VN')})*`;
    });

    turnSnapshots.push({
      turn: turnNumber,
      isFinal: false,
      domainAtkEnergy: domainState.attacker.energy,
      domainDefEnergy: domainState.defender.energy,
      domainLabel: formatDomainTurnInfo(),
      hpBars: [
        { side: 'A', label: `${attacker.name} (${attacker.petName})`, hp: attacker.currentHp, prevHp: prevAtkHp, maxHp: initialHp.attacker, shield: attacker.shield || 0 },
        { side: 'B', label: `${defender.name} (${defender.petName})`, hp: defender.currentHp, prevHp: prevDefHp, maxHp: initialHp.defender, shield: defender.shield || 0 },
      ],
      events: [...turnDomLogLines, ...thisTurnActions],
    });
  }

  if (turnSnapshots.length > 0) {
    turnSnapshots[turnSnapshots.length - 1].isFinal = true;
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
    isEvolved: Boolean(c.isEvolved),
    ultCount: Number(c.state?.ultimate?.triggerCount || 0),
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
    domainLoadout: c.domainLoadout || {},
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
    domainEvents,
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
  const frameAt = (pos) => framesMeta[pos] || framesMeta[framesMeta.length - 1];
  const frameUrlFor = (idxNum) => `${PUBLIC_BASE_URL}/api/battle/report/${battleId}/${idxNum}.webp`;
  const frame1 = frameAt(0);
  const frame2 = frameAt(1);
  const frame3 = frameAt(2);
  const frame4 = frameAt(3);
  const frame5 = frameAt(4);
  const frame6 = frameAt(5);
  const frameLast = framesMeta[framesMeta.length - 1];
  const nowCreatedMs = Date.now();
  const expiresAtMs = nowCreatedMs + BATTLE_LOG_TTL_MS;

  const finalResult = {
    success: true,
    mode,
    opponent_tier_label: opponentBand?.label || (mode === 'pvp' ? 'PvP 1v1' : 'PvE'),
    linh_thach_delta: rewardInfo.delta || 0,
    reward_summary: rewardInfo.reward_summary || '',
    battleId,
    createdAtMs: nowCreatedMs,
    expiresAtMs,
    turnCount: turnNumber,
    winnerRole: attackerWon ? 'attacker' : 'defender',
    winner,
    loser,
    turns,
    turnSnapshots,
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
    domainSummary: {
      activatedAtTurn2: domainState.activatedAtTurn2,
      attacker: {
        hasDomain: domainState.attacker.hasDomain,
        domainId: domainState.attacker.domain?.domain_id || null,
        domainName: domainState.attacker.domain?.name || null,
        element: domainState.attacker.domain?.element || null,
        senseName: domainState.attacker.sense?.name || null,
        realmName: domainState.attacker.realm?.name || null,
        startEnergy: domainState.attacker.maxEnergy,
        endEnergy: domainState.attacker.energy,
      },
      defender: {
        hasDomain: domainState.defender.hasDomain,
        domainId: domainState.defender.domain?.domain_id || null,
        domainName: domainState.defender.domain?.name || null,
        element: domainState.defender.domain?.element || null,
        senseName: domainState.defender.sense?.name || null,
        realmName: domainState.defender.realm?.name || null,
        startEnergy: domainState.defender.maxEnergy,
        endEnergy: domainState.defender.energy,
      },
      events: domainEvents,
    },
    reportImagePath,
    reportImageUrl,
    frameCount: framesMeta.length,
    hasFrame3: framesMeta.length >= 3,
    hasFrame4: framesMeta.length >= 4,
    hasFrame5: framesMeta.length >= 5,
    hasFrame6: framesMeta.length >= 6,
    frame1Url: frameUrlFor(frame1.index),
    frame1Title: frame1.title,
    frame2Url: frameUrlFor(frame2.index),
    frame2Title: frame2.title,
    frame3Url: frameUrlFor(frame3.index),
    frame3Title: frame3.title,
    frame4Url: frameUrlFor(frame4.index),
    frame4Title: frame4.title,
    frame5Url: frameUrlFor(frame5.index),
    frame5Title: frame5.title,
    frame6Url: frameUrlFor(frame6.index),
    frame6Title: frame6.title,
    finalImageWebpUrl: frameUrlFor(frameLast.index),
    framesMeta,
    fullBattleLog,
    discordReport: fullBattleLog,
    untruncatedLogLines: logBundle.untruncatedLogLines,
    webLogUrl: logBundle.webLogUrl,
    footer: '',
  };

  const frameBuffers = new Map();
  cacheBattleReport(battleId, finalResult, {
    channelId,
    attackerId: attacker.id,
    defenderId: defender.id,
    framesMeta,
    frameBuffers,
  });

  const persistLogTask = saveBattleLogRecord({
    battleId,
    battleKind: safeOptions.battleKind || (mode === 'tower' ? 'tower' : '1v1'),
    channelId,
    participantIds: [attacker.id, defender.id],
    payload: finalResult,
    nowMs: nowCreatedMs,
  });

  // Ver 1.5 Speed-up:
  // - Tháp (preRenderMode === 'final_only' hoặc mode === 'tower'): CHỈ pre-render đúng 1 khung Kết Quả Cuối (giảm ~80% CPU).
  // - 1v1 (/battle): CHỈ pre-render Khung 1 + Khung Cuối; các khung giữa render on-demand 0.62x khi mở Web Log.
  const isFinalOnly = safeOptions.preRenderMode === 'final_only' || mode === 'tower';
  const framesToPreRender = safeOptions.preRender === false
    ? []
    : isFinalOnly
      ? framesMeta.filter((f) => f.isFinal)
      : framesMeta.filter((f) => f.index === 1 || f.isFinal);

  const preRenderTask = framesToPreRender.length > 0
    ? Promise.all(
      framesToPreRender.map(async (f) => {
        try {
          const buf = await renderBattleCardQueued(`battle:${battleId}:${f.index}:webp`, finalResult, {
            scale: f.scale,
            format: 'webp',
            webpQuality: f.scale <= 1 ? 72 : 75,
            frame: f,
          });
          if (buf) {
            frameBuffers.set(f.index, buf);
            setCachedTurnBuffer(battleId, `frame:${f.index}`, buf);
          }
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

  const bgTasks = Promise.allSettled([persistLogTask, preRenderTask, clanWarTask, questTrackTask]);
  if (safeOptions.awaitBackgroundTasks) {
    await bgTasks;
  } else {
    void bgTasks;
  }

  return finalResult;
}
