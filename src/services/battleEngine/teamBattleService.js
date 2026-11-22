/**
 * src/services/battleEngine/teamBattleService.js
 * Động cơ Chiến Đấu Tổ Đội (1–3 người vs BOSS hoặc 3v3) cho Chiếm Đoạt Linh Mạch:
 * - Thứ tự đánh mỗi hiệp: toàn bộ đấu thủ còn sống cả 2 phe xếp theo SPD cao nhất đánh trước (ưu tiên Lôi Quang Tốc).
 * - Linh Vực: chỉ dùng DUY NHẤT Linh Vực + Thần Thức + Thần Cảnh của Đội Trưởng mỗi phe (áp dụng cho cả 3 người trong đội, hỗ trợ đầy đủ « Đạo Áp »!).
 * - Mệt Mỏi (Fatigue): giảm 25% chỉ số chiến đấu mỗi stack đi chiếm mỏ liên tiếp (trần -75%).
 */

import crypto from 'crypto';
import { getElementalAdvantage } from './elementalMatrix.js';
import { initDomainBattleState, processTurnDomainPhase } from './domainEngine.js';
import { createInitialCombatState } from './statsCompiler.js';
import { em, domainElementEmoji } from '../../config/emojiHelper.js';
import { PUBLIC_BASE_URL } from '../../data/catalog.js';

const TEAM_BATTLE_CACHE_MAX = 80;
const teamBattleCache = new Map();

export function cacheTeamBattle(battleId, result) {
  if (!battleId || !result) return;
  if (teamBattleCache.has(battleId)) teamBattleCache.delete(battleId);
  while (teamBattleCache.size >= TEAM_BATTLE_CACHE_MAX) {
    const oldest = teamBattleCache.keys().next().value;
    if (!oldest) break;
    teamBattleCache.delete(oldest);
  }
  teamBattleCache.set(battleId, { result, createdAt: Date.now() });
}

export function getCachedTeamBattle(battleId) {
  const entry = teamBattleCache.get(battleId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 30 * 60 * 1000) {
    teamBattleCache.delete(battleId);
    return null;
  }
  return entry.result;
}

export function applyFatigueToCombatant(combatant, fatigueStacks = 0) {
  const stacks = Math.max(0, Math.min(3, Math.floor(Number(fatigueStacks) || 0)));
  const penaltyPct = Math.min(0.75, stacks * 0.25);
  const mult = Math.max(0.25, 1 - penaltyPct);

  const atk = Math.max(10, Math.round(Number(combatant.atk || 100) * mult));
  const def = Math.max(10, Math.round(Number(combatant.def || 100) * mult));
  const spd = Math.max(10, Math.round(Number(combatant.spd || 100) * mult));
  const maxHp = Math.max(200, Math.round(Number(combatant.maxHp || 1000) * mult));

  return {
    ...combatant,
    atk,
    def,
    spd,
    maxHp,
    currentHp: maxHp,
    shield: Number(combatant.shield || 0),
    fatigueStacks: stacks,
    fatiguePenaltyPct: Math.round(penaltyPct * 100),
    powerScore: Math.round(Number(combatant.powerScore || 0) * mult),
    state: createInitialCombatState(),
  };
}

function pickFrontlineTarget(enemyTeam) {
  return enemyTeam.find((u) => u.currentHp > 0) || null;
}

function hasThunderFirstStrike(unit) {
  const skill = String(unit?.pet?.hax_skill || '').toLowerCase();
  return skill.includes('lôi quang tốc') || skill.includes('loi quang toc');
}

/**
 * Mô phỏng trận chiến tổ đội (sideA: 1..3 người, sideB: 1..3 người hoặc 1 Boss Địa Mạch).
 */
export function simulateTeamBattle(sideARaw, sideBRaw, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const maxTurns = Number(opts.maxTurns || 30);

  const teamA = (sideARaw || []).slice(0, 3).map((u, idx) => ({
    ...u,
    side: 'A',
    slotIndex: idx,
    currentHp: Number(u.currentHp || u.maxHp || 1000),
    maxHp: Number(u.maxHp || 1000),
    shield: Number(u.shield || 0),
    state: u.state || createInitialCombatState(),
  }));

  const teamB = (sideBRaw || []).slice(0, 3).map((u, idx) => ({
    ...u,
    side: 'B',
    slotIndex: idx,
    currentHp: Number(u.currentHp || u.maxHp || 1000),
    maxHp: Number(u.maxHp || 1000),
    shield: Number(u.shield || 0),
    state: u.state || createInitialCombatState(),
  }));

  const leaderA = teamA[0];
  const leaderB = teamB[0];

  // Chỉ sử dụng DUY NHẤT Linh Vực của Đội Trưởng mỗi phe!
  const domainState = initDomainBattleState(leaderA, leaderB);

  const turnLogs = [];
  const highlights = [];
  let turnCount = 0;

  const isTeamAlive = (team) => team.some((u) => u.currentHp > 0);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (!isTeamAlive(teamA) || !isTeamAlive(teamB)) break;
    turnCount = turn;

    const turnEvents = [];

    // 1. Pha Linh Vực Đội Trưởng (Hiệp >= 2, bao gồm Đạo Áp!)
    if (turn >= 2) {
      const domEvents = processTurnDomainPhase(turn, leaderA, leaderB, domainState, rng);
      for (const ev of domEvents) {
        turnEvents.push(ev);
        if (['domain_open', 'domain_break', 'dao_ap_activate'].includes(ev.action)) {
          highlights.push(`**Hiệp ${turn}:** ${ev.desc || ev.skill}`);
        }
      }

      // Lan tỏa Buff/Debuff Linh Vực Đội Trưởng cho toàn bộ thành viên trong đội
      const runtimeA = leaderA.domainRuntime || { own: {}, incomingDebuffs: {} };
      const runtimeB = leaderB.domainRuntime || { own: {}, incomingDebuffs: {} };
      for (const u of teamA) u.domainRuntime = runtimeA;
      for (const u of teamB) u.domainRuntime = runtimeB;

      // DoT Linh Vực lên các đồng đội khác ngoài Đội Trưởng (Đội Trưởng đã nhận trong processTurnDomainPhase)
      for (const [allies, enemyRuntime] of [[teamA.slice(1), runtimeB], [teamB.slice(1), runtimeA]]) {
        const dotPct = Number(enemyRuntime?.own?.debuffsOnEnemy?.dotMaxHpPct || 0);
        if (dotPct > 0) {
          for (const member of allies) {
            if (member.currentHp > 1) {
              const dot = Math.max(1, Math.floor(member.maxHp * dotPct * 0.65));
              member.currentHp = Math.max(1, member.currentHp - dot);
            }
          }
        }
      }
    }

    // 2. Sắp xếp tất cả đấu thủ còn sống theo SPD giảm dần (Lôi Quang Tốc ưu tiên đầu)
    const livingAll = [...teamA, ...teamB].filter((u) => u.currentHp > 0);
    livingAll.sort((u1, u2) => {
      const p1 = hasThunderFirstStrike(u1) ? 1 : 0;
      const p2 = hasThunderFirstStrike(u2) ? 1 : 0;
      if (p1 !== p2) return p2 - p1;
      if (u2.spd !== u1.spd) return u2.spd - u1.spd;
      return rng() < 0.5 ? -1 : 1;
    });

    // 3. Từng đấu thủ ra đòn theo đúng thứ tự SPD
    for (const actor of livingAll) {
      if (actor.currentHp <= 0) continue;
      const enemies = actor.side === 'A' ? teamB : teamA;
      const target = pickFrontlineTarget(enemies);
      if (!target) break;

      const ownBuffs = actor.domainRuntime?.own?.buffs || {};
      const actorDebuffs = actor.domainRuntime?.incomingDebuffs || {};
      const targetBuffs = target.domainRuntime?.own?.buffs || {};
      const targetDebuffs = target.domainRuntime?.incomingDebuffs || {};

      // Kiểm tra Né / Giảm Chính Xác từ Linh Vực
      const missChance = Math.min(0.45, Number(actorDebuffs.accuracyDownPct || 0) + Number(targetBuffs.dodgeBonusPct || 0));
      if (missChance > 0 && rng() < missChance) {
        turnEvents.push({ actor: actor.id, target: target.id, action: 'miss', dmg: 0 });
        continue;
      }

      // Ngũ Hành & Dị Tố
      const elemAdv = getElementalAdvantage(actor.pet?.element || actor.element || 'Kim', target.pet?.element || target.element || 'Kim');
      const defPierce = Math.min(0.80, Number(ownBuffs.defPiercePct || 0) + Number(targetDebuffs.defReductionPct || 0) + (elemAdv.armorPierce || 0));
      const effDef = Math.max(0, target.def * (1 - defPierce));

      // Công thức sát thương cân bằng
      const mitigation = 100 / (100 + effDef / Math.max(1, actor.atk) * 55);
      let rawDmg = actor.atk * (1.25 + rng() * 0.25) * mitigation * Number(elemAdv.multiplier || 1.0);

      // Bạo kích
      const critChance = Math.min(0.75, 0.12 + Number(actor.critRate || 0) / 100);
      const isCrit = rng() < critChance;
      if (isCrit) {
        const critBonus = Math.max(1.15, 1.55 + Number(targetDebuffs.critTakenBonusPct || 0) - Number(targetBuffs.critResistPct || 0));
        rawDmg *= critBonus;
      }

      const finalDmg = Math.max(1, Math.round(rawDmg));
      let remainingDmg = finalDmg;

      // Khiên chắn
      if (target.shield > 0) {
        const shieldPierce = Math.min(0.80, Number(ownBuffs.shieldPiercePct || 0));
        const directPart = Math.round(remainingDmg * shieldPierce);
        const shieldPart = remainingDmg - directPart;
        const absorbed = Math.min(target.shield, shieldPart);
        target.shield -= absorbed;
        remainingDmg = directPart + (shieldPart - absorbed);
      }

      target.currentHp = Math.max(0, target.currentHp - remainingDmg);

      // Hút máu từ Linh Vực
      const lsPct = Number(ownBuffs.lifestealPct || 0);
      if (lsPct > 0 && remainingDmg > 0 && actor.currentHp > 0) {
        const healPenalty = Math.min(0.85, Number(actorDebuffs.healReductionPct || 0));
        const healAmt = Math.floor(remainingDmg * lsPct * (1 - healPenalty));
        if (healAmt > 0) actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmt);
      }

      turnEvents.push({
        actor: actor.id,
        actorName: actor.name,
        target: target.id,
        targetName: target.name,
        action: isCrit ? 'crit' : 'attack',
        dmg: remainingDmg,
        ko: target.currentHp === 0,
      });

      if (target.currentHp === 0) {
        highlights.push(`**Hiệp ${turn}:** ${actor.name} hạ gục **${target.name}** (${remainingDmg.toLocaleString('vi-VN')} ST)!`);
      }
    }

    turnLogs.push({ turn, events: turnEvents });
  }

  const hpPctA = teamA.reduce((s, u) => s + u.currentHp, 0) / Math.max(1, teamA.reduce((s, u) => s + u.maxHp, 0));
  const hpPctB = teamB.reduce((s, u) => s + u.currentHp, 0) / Math.max(1, teamB.reduce((s, u) => s + u.maxHp, 0));
  const winnerSide = isTeamAlive(teamA) && !isTeamAlive(teamB)
    ? 'A'
    : !isTeamAlive(teamA) && isTeamAlive(teamB)
      ? 'B'
      : hpPctA >= hpPctB ? 'A' : 'B';

  const battleId = crypto.randomBytes(6).toString('hex');
  const leaderDomA = leaderA?.domainLoadout?.domain || null;
  const leaderDomB = leaderB?.domainLoadout?.domain || null;

  const result = {
    battleId,
    mode: opts.mode || (teamB.length === 1 && teamB[0].isBoss ? '3vBoss' : '3v3'),
    veinLabel: opts.veinLabel || 'Tranh Đoạt Linh Mạch',
    winnerSide,
    turnCount,
    teamA: teamA.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl || null,
      pet: u.pet,
      equipment: u.equipment || {},
      atk: u.atk,
      def: u.def,
      spd: u.spd,
      maxHp: u.maxHp,
      currentHp: u.currentHp,
      powerScore: u.powerScore || 0,
      fatigueStacks: u.fatigueStacks || 0,
      fatiguePenaltyPct: u.fatiguePenaltyPct || 0,
      isLeader: u.slotIndex === 0,
      isBoss: Boolean(u.isBoss),
    })),
    teamB: teamB.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl || null,
      pet: u.pet,
      equipment: u.equipment || {},
      atk: u.atk,
      def: u.def,
      spd: u.spd,
      maxHp: u.maxHp,
      currentHp: u.currentHp,
      powerScore: u.powerScore || 0,
      fatigueStacks: u.fatigueStacks || 0,
      fatiguePenaltyPct: u.fatiguePenaltyPct || 0,
      isLeader: u.slotIndex === 0,
      isBoss: Boolean(u.isBoss),
      bossImageFile: u.bossImageFile || null,
    })),
    leaderDomainA: leaderDomA
      ? {
          domain_id: leaderDomA.domain_id,
          name: leaderDomA.name,
          element: leaderDomA.element,
          sense: leaderA.domainLoadout?.sense || null,
          realm: leaderA.domainLoadout?.realm || null,
          finalEnergy: domainState.attacker.energy,
          maxEnergy: domainState.attacker.maxEnergy,
          indestructible: domainState.attacker.indestructible,
          daoApUsed: domainState.attacker.daoApUsed,
        }
      : null,
    leaderDomainB: leaderDomB
      ? {
          domain_id: leaderDomB.domain_id,
          name: leaderDomB.name,
          element: leaderDomB.element,
          sense: leaderB.domainLoadout?.sense || null,
          realm: leaderB.domainLoadout?.realm || null,
          finalEnergy: domainState.defender.energy,
          maxEnergy: domainState.defender.maxEnergy,
          indestructible: domainState.defender.indestructible,
          daoApUsed: domainState.defender.daoApUsed,
        }
      : null,
    highlights: highlights.slice(0, 8),
    imageUrl: `${PUBLIC_BASE_URL}/api/vein/battle/${battleId}.webp`,
    summaryLine: [
      `${em('su_crossed_swords')} **${opts.veinLabel || 'CHIẾN BÁO TỔ ĐỘI'}** (${turnCount} Hiệp)`,
      `• **Kết Quả:** ${winnerSide === 'A' ? '🏆 **ĐỘI KHIÊU CHIẾN THẮNG LỢI!**' : '🛡️ **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH!**'}`,
      leaderDomA || leaderDomB
        ? `• **Linh Vực Đội Trưởng:** ${leaderDomA ? `${domainElementEmoji(leaderDomA.element)} ${leaderDomA.name}` : 'Không'} vs ${leaderDomB ? `${domainElementEmoji(leaderDomB.element)} ${leaderDomB.name}` : 'Không'}`
        : '',
    ].filter(Boolean).join('\n'),
  };

  cacheTeamBattle(battleId, result);
  return result;
}
