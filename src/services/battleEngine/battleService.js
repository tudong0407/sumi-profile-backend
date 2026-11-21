import crypto from 'crypto';
import { compileCombatant } from './statsCompiler.js';
import { getElementalAdvantage } from './elementalMatrix.js';
import { PUBLIC_BASE_URL } from '../../data/catalog.js';
import { em, petEmoji } from '../../config/emojiHelper.js';
import { supabase } from '../../config/supabase.js';
import { recordClanWarScore } from '../clanService.js';
import { renderBattleCard } from '../../canvas/battleRenderer.js';
import {
  triggerBattleStart,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
  triggerLethalInterception,
  hasHax,
} from './haxEngine.js';

const BATTLE_CACHE_MAX = 120;
const BATTLE_CACHE_TTL_MS = 30 * 60 * 1000;
const battleReportCache = new Map();
const latestBattleByChannel = new Map();
const latestBattleByUser = new Map();

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
  return {
    success: true,
    found: true,
    battleId: r.battleId || targetBattleId,
    title: `${em('su_wiki_scroll')} NHẬT KÝ TRẬN ĐẤU • ${r.winner.name} VS ${r.loser.name}`,
    description: r.fullBattleLog || r.discordReport || r.summary,
    footer: `SuMi Family • ${r.turnCount} Hiệp • Mã trận: ${r.battleId}`,
  };
}

/**
 * Xây dựng lịch khung hình Adaptive Resolution (Phương án 1):
 * - 1 hiệp: 2 khung (1000x500 Khai trận -> 2000x1000 WINNER)
 * - 2-4 hiệp: 2 khung (1000x500 Hiệp 1 -> 2000x1000 WINNER)
 * - 5+ hiệp: 3 khung (1000x500 Hiệp 1 -> 1000x500 Hiệp giữa -> 2000x1000 WINNER)
 */
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
        scale: 1,
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
        scale: 2,
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
        scale: 1,
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
        scale: 2,
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
      scale: 1,
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
      scale: 1,
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
      scale: 2,
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

function buildFullBattleLog({
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
  formatEquipLine,
  formatHaxLine,
}) {
  const atkIcon = attacker.petIcon || petEmoji(attacker.petType, em('su_pet_paw'));
  const defIcon = defender.petIcon || petEmoji(defender.petType, em('su_pet_paw'));

  const elemNote = (() => {
    const a2d = elementMatchup?.attackerToDefender;
    const d2a = elementMatchup?.defenderToAttacker;
    if (a2d?.isTrueDamage && !d2a?.isTrueDamage) return `Hỗn Độn xuyên giáp (+20% DMG)`;
    if (d2a?.isTrueDamage && !a2d?.isTrueDamage) return `Hỗn Độn xuyên giáp (+20% DMG)`;
    if (a2d?.multiplier >= 1.25 && d2a?.multiplier >= 1.25) return `Ám ↔ Quang Tương Sát (+25% DMG)`;
    if (a2d?.multiplier > 1.0) return `${attacker.element} khắc ${defender.element} (+${Math.round((a2d.multiplier - 1) * 100)}% DMG)`;
    if (d2a?.multiplier > 1.0) return `${defender.element} khắc ${attacker.element} (+${Math.round((d2a.multiplier - 1) * 100)}% DMG)`;
    return 'Ngũ Hành Cân Bằng';
  })();

  const headerLines = [
    `**1. Phe Công:** **${attacker.name}** — ${atkIcon} **${attacker.petName}** *(Hệ ${attacker.element} • Lv.${attacker.level})*`,
    `• \`ATK ${attacker.atk.toLocaleString('vi-VN')} | DEF ${attacker.def.toLocaleString('vi-VN')} | SPD ${attacker.spd.toLocaleString('vi-VN')} | HP ${initialHp.attacker.toLocaleString('vi-VN')}\``,
    `• Trang bị: ${formatEquipLine(attacker)}`,
    `• HAX: \`${formatHaxLine(attacker)}\``,
    ``,
    `**2. Phe Thủ:** **${defender.name}** — ${defIcon} **${defender.petName}** *(Hệ ${defender.element} • Lv.${defender.level})*`,
    `• \`ATK ${defender.atk.toLocaleString('vi-VN')} | DEF ${defender.def.toLocaleString('vi-VN')} | SPD ${defender.spd.toLocaleString('vi-VN')} | HP ${initialHp.defender.toLocaleString('vi-VN')}\``,
    `• Trang bị: ${formatEquipLine(defender)}`,
    `• HAX: \`${formatHaxLine(defender)}\``,
    `• Tương khắc: **${elemNote}**`,
  ];

  const startLines = battleStartEvents.length > 0
    ? [``, `**Khai Trận HAX:**`, ...battleStartEvents.map((ev) => {
      const aPet = ev.actor === attacker.id ? attacker.petName : defender.petName;
      return `• ${em('su_thunder_hax')} **${aPet}**: ${ev.skill}`;
    })]
    : [];

  const allTurnLines = turns.map((t) => {
    const actorObj = t.actor === 'attacker' ? attacker : defender;
    const targetObj = t.actor === 'attacker' ? defender : attacker;
    if (t.action === 'skip') {
      return `• **H${t.turn}** [${actorObj.petName}]: ${em('su_shield_def')} ${t.haxTriggered || 'Mất lượt'}`;
    }
    const critTag = t.isCrit ? ` ${em('su_crit_boom')} **CRIT**` : '';
    const haxTag = t.haxTriggered ? ` *(${t.haxTriggered})*` : '';
    return `• **H${t.turn}** **${actorObj.petName}** → **${targetObj.petName}**: **-${t.damage.toLocaleString('vi-VN')} HP**${critTag}${haxTag} *(HP: ${t.attackerHp.toLocaleString('vi-VN')} / ${t.defenderHp.toLocaleString('vi-VN')})*`;
  });

  const footerLines = [
    ``,
    `${em('su_winner_trophy')} **KẾT QUẢ:** **${winner.name}** (${winnerPetEmoji} **${winner.pet}**) thắng **${loser.name}** (${loser.pet}) sau **${turnNumber} hiệp**!`,
  ];

  const assemble = (tLines) => [
    ...headerLines,
    ...startLines,
    ``,
    `**Diễn Biến Chi Tiết (${turnNumber} Hiệp):**`,
    ...tLines,
    ...footerLines,
  ].join('\n');

  let fullText = assemble(allTurnLines);
  if (fullText.length > 3850 && allTurnLines.length > 12) {
    const headCount = 6;
    const tailCount = 6;
    const omitted = allTurnLines.length - headCount - tailCount;
    const compactTurns = [
      ...allTurnLines.slice(0, headCount),
      `• *... (đã rút gọn ${omitted} lượt giữa để vừa giới hạn tin nhắn Discord) ...*`,
      ...allTurnLines.slice(-tailCount),
    ];
    fullText = assemble(compactTurns);
  }
  if (fullText.length > 3950) {
    fullText = fullText.slice(0, 3940) + '\n…';
  }
  return fullText;
}

/**
 * Trình tạo số giả ngẫu nhiên có hỗ trợ Seed cho kiểm thử tất định (Deterministic testing)
 */
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
 * Điều phối trận chiến Linh Thú theo lượt (Turn-based Pet Battle Simulation)
 * Hỗ trợ song song hóa Supabase, Adaptive Resolution WebP pre-render RAM & Full Battle Log.
 */
export async function simulateBattle(attackerUserOrId, defenderUserOrId, options = {}) {
  const safeOptions = options || {};
  const maxTurns = Math.max(1, Math.min(100, Number(safeOptions.maxTurns) || 30));
  const rng = createRng(safeOptions.seed);
  const channelId = safeOptions.channelId ? String(safeOptions.channelId).trim() : null;

  // 1. Song song biên dịch chỉ số 2 đấu sĩ
  const [attacker, defender] = await Promise.all([
    compileCombatant(attackerUserOrId, 'attacker'),
    compileCombatant(defenderUserOrId, 'defender'),
  ]);

  const initialHp = {
    attacker: attacker.maxHp,
    defender: defender.maxHp,
  };

  const turns = [];

  // 2. Kích hoạt hiệu ứng đầu trận
  const battleStartEvents = triggerBattleStart(attacker, defender, rng) || [];

  // 3. Xác định thứ tự đánh
  let attackerFirst = true;
  const atkHasSpeedPriority = hasHax(attacker, 'loi_dinh_kim_ho') || hasHax(attacker, 'lôi quang tốc');
  const defHasSpeedPriority = hasHax(defender, 'loi_dinh_kim_ho') || hasHax(defender, 'lôi quang tốc');

  if (atkHasSpeedPriority && !defHasSpeedPriority) {
    attackerFirst = true;
  } else if (!atkHasSpeedPriority && defHasSpeedPriority) {
    attackerFirst = false;
  } else {
    attackerFirst = attacker.spd >= defender.spd;
  }

  let turnNumber = 0;

  // 4. Vòng lặp chiến đấu theo lượt
  while (attacker.currentHp > 0 && defender.currentHp > 0 && turnNumber < maxTurns) {
    turnNumber++;

    const order = attackerFirst
      ? [{ actor: attacker, target: defender, role: 'attacker' }, { actor: defender, target: attacker, role: 'defender' }]
      : [{ actor: defender, target: attacker, role: 'defender' }, { actor: attacker, target: defender, role: 'attacker' }];

    for (const step of order) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

      const { actor, target, role } = step;

      const turnStartResult = triggerTurnStart(actor, target, rng);

      if (turnStartResult.skipTurn) {
        turns.push({
          turn: turnNumber,
          actor: role,
          action: 'skip',
          damage: 0,
          isCrit: false,
          elementAdvantage: null,
          haxTriggered: 'Mất lượt do khống chế',
          attackerHp: attacker.currentHp,
          defenderHp: defender.currentHp,
        });
        continue;
      }

      const actualTarget = turnStartResult.attackSelf ? actor : target;
      const elemData = getElementalAdvantage(actor.element, actualTarget.element);
      const targetDef = elemData.isTrueDamage ? 0 : actualTarget.def;
      const rawBaseDmg = Math.max(50, Math.floor(((actor.atk * 1.5) - (targetDef * 0.5)) * elemData.multiplier));
      const attackPhase = triggerAttackPhase(actor, actualTarget, rawBaseDmg, rng);

      let actualDamageDealt = 0;
      const turnStartHax = turnStartResult?.events?.length > 0
        ? (typeof turnStartResult.events[0] === 'object' ? turnStartResult.events[0]?.skill : turnStartResult.events[0])
        : null;
      let haxEventName = attackPhase.haxTriggered || turnStartHax;

      if (!attackPhase.isMiss) {
        const damageRecv = triggerDamageReceived(actualTarget, attackPhase.damage, actor, rng);
        let dmgToApply = damageRecv.finalDamage;

        if (actualTarget.shield > 0 && !actor.state.antiShieldTurns) {
          if (actualTarget.shield >= dmgToApply) {
            actualTarget.shield -= dmgToApply;
            dmgToApply = 0;
          } else {
            dmgToApply -= actualTarget.shield;
            actualTarget.shield = 0;
          }
        }

        actualTarget.currentHp = Math.max(0, actualTarget.currentHp - dmgToApply);
        actualDamageDealt = dmgToApply;

        if (damageRecv.reflectedDamage > 0) {
          actor.currentHp = Math.max(0, actor.currentHp - damageRecv.reflectedDamage);
          haxEventName = haxEventName ? `${haxEventName} + Phản Đòn` : 'Phản Đòn';
        }

        if (actualTarget.currentHp <= 0) {
          const lethalInterception = triggerLethalInterception(actualTarget, actor, rng);
          if (lethalInterception.survived) {
            haxEventName = lethalInterception.skill;
          }
        }
      }

      turns.push({
        turn: turnNumber,
        actor: role,
        action: 'attack',
        damage: actualDamageDealt,
        isCrit: attackPhase.isCrit,
        elementAdvantage: elemData.elementAdvantage,
        haxTriggered: haxEventName || null,
        attackerHp: attacker.currentHp,
        defenderHp: defender.currentHp,
      });

      if (actor.state.isDoubleTurn) {
        actor.state.isDoubleTurn = false;
        if (actualTarget.currentHp > 0) {
          const extraRawDmg = Math.max(50, Math.floor(((actor.atk * 1.5) - (targetDef * 0.5)) * elemData.multiplier));
          const extraAttack = triggerAttackPhase(actor, actualTarget, extraRawDmg, rng);
          actualTarget.currentHp = Math.max(0, actualTarget.currentHp - extraAttack.damage);

          turns.push({
            turn: turnNumber,
            actor: role,
            action: 'attack',
            damage: extraAttack.damage,
            isCrit: extraAttack.isCrit,
            elementAdvantage: elemData.elementAdvantage,
            haxTriggered: 'Thời Không Đình Chỉ (Liên Hoàn Đòn)',
            attackerHp: attacker.currentHp,
            defenderHp: defender.currentHp,
          });
        }
      }
    }
  }

  // 5. Xác định Người chiến thắng / Kẻ thất bại
  const attackerWon = attacker.currentHp > defender.currentHp;
  const winnerCombatant = attackerWon ? attacker : defender;
  const loserCombatant = attackerWon ? defender : attacker;
  const winner = { id: winnerCombatant.id, name: winnerCombatant.name, pet: winnerCombatant.petName };
  const loser = { id: loserCombatant.id, name: loserCombatant.name, pet: loserCombatant.petName };

  const winnerPetEmoji = winnerCombatant.petIcon || petEmoji(winnerCombatant.petType, em('su_pet_paw'));
  const summary = `Trận đấu kết thúc sau ${turnNumber} hiệp. ${winner.name} cùng linh thú ${winner.pet} giành chiến thắng áp đảo!`;
  const headline = `${em('su_winner_trophy')} ${winner.name} (${winnerPetEmoji} ${winner.pet}) chiến thắng ${loser.name} (${loser.pet}) sau ${turnNumber} hiệp!`;

  const elementMatchup = {
    attackerToDefender: getElementalAdvantage(attacker.element, defender.element),
    defenderToAttacker: getElementalAdvantage(defender.element, attacker.element),
  };

  // Trích lọc highlights giữ tương thích schema cũ
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
      const haxTxt = t.haxTriggered ? ` (${t.haxTriggered.split('(')[0].trim()})` : '';
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

  const formatEquipLine = (c) => {
    const w = c.equipment?.weapon?.item_name || 'Không có';
    const g = c.equipment?.gem?.item_name || 'Không có';
    const s = c.equipment?.soul?.item_name || 'Không có';
    return `${em('su_crossed_swords')} ${w} • ${em('su_linhthach')} ${g} • ${em('su_fox_mascot')} ${s}`;
  };
  const formatHaxLine = (c) => {
    const list = [c.hax?.pet, c.hax?.weapon, c.hax?.gem, c.hax?.soul].filter(Boolean);
    return list.length > 0 ? list.join(' • ') : 'Không có';
  };
  const turnLines = turns.slice(0, 8).map((t) => {
    const actorObj = t.actor === 'attacker' ? attacker : defender;
    const targetObj = t.actor === 'attacker' ? defender : attacker;
    if (t.action === 'skip') {
      return `• **Hiệp ${t.turn}** [${actorObj.petName}]: ${em('su_shield_def')} ${t.haxTriggered || 'Mất lượt'}`;
    }
    const critTag = t.isCrit ? ` ${em('su_crit_boom')} **BẠO KÍCH!**` : '';
    const elemTag = t.elementAdvantage ? ` *(${t.elementAdvantage})*` : '';
    const haxTag = t.haxTriggered ? `\n  -> ${em('su_thunder_hax')} *HAX: ${t.haxTriggered}*` : '';
    return `• **Hiệp ${t.turn}** — **${actorObj.petName}** (${actorObj.name}) công kích **${targetObj.petName}** gây **${t.damage.toLocaleString('vi-VN')}** sát thương!${critTag}${elemTag}${haxTag}\n  -> ${em('su_sparkle')} HP còn lại: ${attacker.petName} **${t.attackerHp.toLocaleString('vi-VN')}** | ${defender.petName} **${t.defenderHp.toLocaleString('vi-VN')}**`;
  });

  const discordReport = [
    `### ${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ NGŨ HÀNH & HAX`,
    `**1. Phe Công Kích:** **${attacker.name}** — **${attacker.petName}** *(Hệ ${attacker.element} • Cấp ${attacker.level})*`,
    `• Chỉ số: \`ATK ${attacker.atk.toLocaleString('vi-VN')} | DEF ${attacker.def.toLocaleString('vi-VN')} | SPD ${attacker.spd.toLocaleString('vi-VN')} | HP ${initialHp.attacker.toLocaleString('vi-VN')}\``,
    `• Trang bị Loadout: ${formatEquipLine(attacker)}`,
    `• Tuyệt kỹ HAX: \`${formatHaxLine(attacker)}\``,
    ``,
    `**2. Phe Phòng Thủ:** **${defender.name}** — **${defender.petName}** *(Hệ ${defender.element} • Cấp ${defender.level})*`,
    `• Chỉ số: \`ATK ${defender.atk.toLocaleString('vi-VN')} | DEF ${defender.def.toLocaleString('vi-VN')} | SPD ${defender.spd.toLocaleString('vi-VN')} | HP ${initialHp.defender.toLocaleString('vi-VN')}\``,
    `• Trang bị Loadout: ${formatEquipLine(defender)}`,
    `• Tuyệt kỹ HAX: \`${formatHaxLine(defender)}\``,
    ``,
    `### ${em('su_wiki_scroll')} DIỄN BIẾN TRẬN CHIẾN (${turnNumber} HIỆP)`,
    ...turnLines,
    ``,
    `${em('su_winner_trophy')} **KẾT QUẢ CHUNG CUỘC:** **${winner.name}** cùng linh thú **${winner.pet}** đã đánh bại **${loser.name}** (${loser.pet}) sau **${turnNumber} hiệp**!`
  ].join('\n');

  const fullBattleLog = buildFullBattleLog({
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
    formatEquipLine,
    formatHaxLine,
  });

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
    discordReport,
  };

  // Pre-render sẵn toàn bộ WebP frames vào RAM song song với cộng điểm Bang Chiến 24H
  const frameBuffers = new Map();
  const preRenderTask = safeOptions.preRender !== false
    ? Promise.all(
      framesMeta.map(async (f) => {
        try {
          const buf = await renderBattleCard(finalResult, {
            scale: f.scale,
            format: 'webp',
            webpQuality: f.scale === 1 ? 82 : 85,
            frame: f,
          });
          if (buf) frameBuffers.set(f.index, buf);
        } catch (err) {
          console.warn(`[BattleService] Pre-render frame ${f.index} failed:`, err.message);
        }
      })
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

  await Promise.all([preRenderTask, clanWarTask]);

  cacheBattleReport(battleId, finalResult, {
    channelId,
    attackerId: attacker.id,
    defenderId: defender.id,
    framesMeta,
    frameBuffers,
  });

  return finalResult;
}
