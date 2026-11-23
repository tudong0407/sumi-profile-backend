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
import {
  triggerBattleStart,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
  triggerPostDamage,
  triggerLethalInterception,
  applyHeal,
} from './haxEngine.js';
import { em, uiEm, petEmoji, itemEmoji, domainEmoji, domainElementEmoji, senseEmoji, realmEmojiById } from '../../config/emojiHelper.js';
import {
  PUBLIC_BASE_URL,
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
} from '../../data/catalog.js';
import { renderTeamBattleCard } from '../../canvas/teamBattleRenderer.js';
import { withCanvasRenderSlot } from './battleService.js';
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

const TEAM_BATTLE_CACHE_MAX = 20;
const teamBattleCache = new Map();
const latestTeamBattleByUser = new Map();

export function getTeamBattleCacheStats() {
  return {
    reports: teamBattleCache.size,
    limit: TEAM_BATTLE_CACHE_MAX,
  };
}

function normalizeUnitPetAndPower(u) {
  if (!u || typeof u !== 'object') return u;
  const p = u.pet && typeof u.pet === 'object' ? u.pet : {};
  const normalizedPet = {
    ...p,
    pet_type: p.pet_type || u.petType || 'hoa_thach_nham_nham',
    pet_name: p.pet_name || u.petName || 'Linh Thú',
    element: p.element || u.element || 'Thổ',
    rarity: p.rarity || u.petRarity || 'Phàm Phẩm',
    rarity_key: p.rarity_key || u.petRarityKey || 'common',
    level: Number(p.level || u.level || 1),
    star: Number(p.star || u.star || 1),
    enchant_grade: String(p.enchant_grade || u.enchantGrade || u.enchant_grade || 'D').toUpperCase(),
    hax_skill: p.hax_skill ?? u.petHaxName ?? u.hax?.pet ?? null,
    hax_description: p.hax_description ?? u.petHaxDesc ?? null,
  };
  const computedPower = Number(u.powerScore || u.power || 0)
    || (Number(u.atk || 0) * 3 + Number(u.def || 0) * 2 + Number(u.spd || 0) * 2 + normalizedPet.level * 50);
  return {
    ...u,
    pet: normalizedPet,
    powerScore: Math.max(100, Math.round(computedPower)),
  };
}

export function cacheTeamBattle(battleId, result) {
  if (!battleId || !result) return;
  if (teamBattleCache.has(battleId)) teamBattleCache.delete(battleId);
  while (teamBattleCache.size >= TEAM_BATTLE_CACHE_MAX) {
    const oldest = teamBattleCache.keys().next().value;
    if (!oldest) break;
    teamBattleCache.delete(oldest);
  }
  teamBattleCache.set(battleId, { result, createdAt: Date.now() });
  for (const u of [...(result.teamA || []), ...(result.teamB || [])]) {
    const uid = String(u?.id || '').trim();
    if (/^[0-9]{17,20}$/.test(uid)) {
      latestTeamBattleByUser.delete(uid);
      latestTeamBattleByUser.set(uid, battleId);
      if (latestTeamBattleByUser.size > 300) {
        const oldestU = latestTeamBattleByUser.keys().next().value;
        if (oldestU) latestTeamBattleByUser.delete(oldestU);
      }
    }
  }
}

export function getCachedTeamBattle(battleId) {
  const entry = teamBattleCache.get(battleId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > BATTLE_LOG_TTL_MS) {
    teamBattleCache.delete(battleId);
    return null;
  }
  return entry.result;
}

export async function loadTeamBattleReport(battleId) {
  const cleanId = String(battleId || '').trim();
  return getCachedTeamBattle(cleanId) || await loadBattleLogRecord({ battleId: cleanId, battleKind: 'team' });
}

export function applyFatigueToCombatant(combatant, fatigueInput = 0) {
  const baseUnit = normalizeUnitPetAndPower(combatant);
  let rawPct = 0;
  if (fatigueInput && typeof fatigueInput === 'object') {
    rawPct = Number(fatigueInput.fatiguePct ?? fatigueInput.fatigue_pct ?? 0);
  } else {
    const num = Math.max(0, Number(fatigueInput) || 0);
    // Tương thích ngược: <= 3 là số stack cũ (25%/stack), > 3 là % mệt mỏi trực tiếp (0..75)
    rawPct = num <= 3 ? num * 25 : num;
  }
  const penaltyPctInt = Math.min(75, Math.max(0, Math.round(rawPct)));
  const penaltyPct = penaltyPctInt / 100;
  const stacks = penaltyPctInt > 0 ? Math.min(3, Math.ceil(penaltyPctInt / 25)) : 0;
  const mult = Math.max(0.25, 1 - penaltyPct);

  const atk = Math.max(10, Math.round(Number(baseUnit.atk || 100) * mult));
  const def = Math.max(10, Math.round(Number(baseUnit.def || 100) * mult));
  const spd = Math.max(10, Math.round(Number(baseUnit.spd || 100) * mult));
  const maxHp = Math.max(200, Math.round(Number(baseUnit.maxHp || 1000) * mult));

  return {
    ...baseUnit,
    atk,
    def,
    spd,
    maxHp,
    currentHp: maxHp,
    shield: Number(baseUnit.shield || 0),
    fatigueStacks: stacks,
    fatiguePct: penaltyPctInt,
    fatiguePenaltyPct: penaltyPctInt,
    powerScore: Math.round(Number(baseUnit.powerScore || 0) * mult),
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

  const teamA = (sideARaw || []).slice(0, 3).map((raw, idx) => {
    const u = normalizeUnitPetAndPower(raw);
    const maxHp = Number(u.maxHp || 1000);
    return {
      ...u,
      side: 'A',
      slotIndex: idx,
      baseAtk: u.baseAtk ?? u.atk,
      baseDef: u.baseDef ?? u.def,
      baseSpd: u.baseSpd ?? u.spd,
      critRate: Number(u.critRate || 0) > 1 ? Number(u.critRate) / 100 : Number(u.critRate || 0.05),
      initialMaxHp: maxHp,
      currentHp: Number(u.currentHp || maxHp),
      maxHp,
      shield: Number(u.shield || 0),
      avatarFrame: u.avatarFrame || 'default',
      hax: u.hax || {
        pet: u.pet?.hax_skill || u.pet?.hax_description || null,
        petDesc: u.pet?.hax_description || null,
        weapon: u.equipment?.weapon?.hax_skill || u.equipment?.weapon?.hax_description || null,
        gem: u.equipment?.gem?.hax_skill || u.equipment?.gem?.hax_description || null,
        soul: u.equipment?.soul?.hax_skill || u.equipment?.soul?.hax_description || null,
      },
      state: u.state || createInitialCombatState(),
    };
  });

  const teamB = (sideBRaw || []).slice(0, 3).map((raw, idx) => {
    const u = normalizeUnitPetAndPower(raw);
    const maxHp = Number(u.maxHp || 1000);
    return {
      ...u,
      side: 'B',
      slotIndex: idx,
      baseAtk: u.baseAtk ?? u.atk,
      baseDef: u.baseDef ?? u.def,
      baseSpd: u.baseSpd ?? u.spd,
      critRate: Number(u.critRate || 0) > 1 ? Number(u.critRate) / 100 : Number(u.critRate || 0.05),
      initialMaxHp: maxHp,
      currentHp: Number(u.currentHp || maxHp),
      maxHp,
      shield: Number(u.shield || 0),
      avatarFrame: u.avatarFrame || 'default',
      hax: u.hax || {
        pet: u.pet?.hax_skill || u.pet?.hax_description || null,
        petDesc: u.pet?.hax_description || null,
        weapon: u.equipment?.weapon?.hax_skill || u.equipment?.weapon?.hax_description || null,
        gem: u.equipment?.gem?.hax_skill || u.equipment?.gem?.hax_description || null,
        soul: u.equipment?.soul?.hax_skill || u.equipment?.soul?.hax_description || null,
      },
      state: u.state || createInitialCombatState(),
    };
  });

  const leaderA = teamA[0];
  const leaderB = teamB[0];

  // Chỉ sử dụng DUY NHẤT Linh Vực của Đội Trưởng mỗi phe!
  const domainState = initDomainBattleState(leaderA, leaderB);

  const turnLogs = [];
  const highlights = [];
  const turnDetailLines = [];

  // Kích hoạt HAX Đầu Trận (Khiên đầu trận, Khóa HAX, Cướp Tốc, Miễn Nhiễm...)
  // Lưu ý: chỉ gọi 1 lần cho cặp Đội Trưởng (leaderA vs leaderB) để tránh nhân đôi khiên/buff!
  const startHaxLines = [];
  const seenStartPairs = new Set();
  const pushStartEvents = (events, filterActorId = null) => {
    for (const ev of events || []) {
      if (filterActorId && String(ev.actor) !== String(filterActorId)) continue;
      const key = `${ev.actor}:${ev.skill}:${ev.desc}`;
      if (seenStartPairs.has(key)) continue;
      seenStartPairs.add(key);
      if (ev.desc) {
        startHaxLines.push(`  • ${em('su_sparkle')} **[Khai Trận HAX]** ${ev.desc}`);
      } else if (ev.skill) {
        startHaxLines.push(`  • ${em('su_sparkle')} **[Khai Trận HAX]** ${ev.skill}`);
      }
    }
  };
  if (leaderA && leaderB) {
    pushStartEvents(triggerBattleStart(leaderA, leaderB, rng));
  }
  for (const unit of [...teamA.slice(1), ...teamB.slice(1)]) {
    const enemyLeader = unit.side === 'A' ? leaderB : leaderA;
    if (!enemyLeader) continue;
    const dummyEnemy = {
      id: enemyLeader.id,
      name: enemyLeader.name,
      spd: enemyLeader.spd,
      atk: enemyLeader.atk,
      def: enemyLeader.def,
      maxHp: enemyLeader.maxHp,
      currentHp: enemyLeader.currentHp,
      shield: 0,
      equipment: {},
      hax: {},
      petType: '',
      state: createInitialCombatState(),
    };
    pushStartEvents(triggerBattleStart(unit, dummyEnemy, rng), unit.id);
  }
  if (startHaxLines.length > 0) {
    turnDetailLines.push('• **Khai Trận HAX (Đầu Trận):**');
    turnDetailLines.push(...startHaxLines);
  }

  const leaderDomAInit = leaderA?.domainLoadout?.domain || null;
  const leaderDomBInit = leaderB?.domainLoadout?.domain || null;
  const formatTeamDomainLabel = () => {
    if (!leaderDomAInit && !leaderDomBInit) return '';
    const fa = leaderDomAInit ? `${leaderDomAInit.name}: ${domainState.attacker.indestructible ? '∞' : domainState.attacker.energy}/${domainState.attacker.indestructible ? '∞' : domainState.attacker.maxEnergy}` : 'Trống';
    const fb = leaderDomBInit ? `${leaderDomBInit.name}: ${domainState.defender.indestructible ? '∞' : domainState.defender.energy}/${domainState.defender.indestructible ? '∞' : domainState.defender.maxEnergy}` : 'Trống';
    return `Linh Mạch Đội Trưởng: ${fa} vs ${fb}`;
  };
  const turnSnapshots = [
    {
      turn: 0,
      isFinal: false,
      domainAEnergy: domainState.attacker.energy,
      domainBEnergy: domainState.defender.energy,
      domainLabel: formatTeamDomainLabel(),
      teamAHp: teamA.map((u) => u.currentHp),
      teamBHp: teamB.map((u) => u.currentHp),
      hpBars: [
        ...teamA.map((u) => ({ side: 'A', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: u.initialMaxHp, maxHp: u.initialMaxHp, shield: u.shield || 0 })),
        ...teamB.map((u) => ({ side: 'B', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: u.initialMaxHp, maxHp: u.initialMaxHp, shield: u.shield || 0 })),
      ],
      events: [
        `• **Khai Trận:** ${teamA.map((u) => u.name).join(', ')} ${em('su_crossed_swords')} ${teamB.map((u) => u.name).join(', ')}`,
        ...startHaxLines.map((l) => l.trim()),
      ],
    },
  ];
  let turnCount = 0;

  const isTeamAlive = (team) => team.some((u) => u.currentHp > 0);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (!isTeamAlive(teamA) || !isTeamAlive(teamB)) break;
    turnCount = turn;
    const prevAHp = teamA.map((u) => u.currentHp);
    const prevBHp = teamB.map((u) => u.currentHp);

    const turnEvents = [];
    const thisTurnLines = [];

    // 1. Pha Linh Vực Đội Trưởng (Hiệp >= 2, bao gồm Đạo Áp!)
    if (turn >= 2) {
      const domEvents = processTurnDomainPhase(turn, leaderA, leaderB, domainState, rng);
      for (const ev of domEvents) {
        turnEvents.push(ev);
        if (ev.desc || ev.skill) {
          thisTurnLines.push(`  • ${em('su_realm_star')} **[Linh Vực]** ${ev.desc || ev.skill}`);
        }
        if (['domain_open', 'domain_break', 'dao_ap_activate'].includes(ev.action)) {
          highlights.push(`**Hiệp ${turn}:** ${ev.desc || ev.skill}`);
        }
      }

      // Đảm bảo currentHp không vượt maxHp sau khi Linh Vực cắt giảm MaxHP
      for (const u of [...teamA, ...teamB]) {
        if (u.currentHp > u.maxHp) u.currentHp = u.maxHp;
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
              thisTurnLines.push(`  • ${em('su_el_hoa')} **[Thiêu Đốt Vực]** **${member.name}** chịu \`-${dot.toLocaleString('vi-VN')} HP\` *(còn ${member.currentHp.toLocaleString('vi-VN')}/${member.maxHp.toLocaleString('vi-VN')})*`);
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

    // 3. Từng đấu thủ ra đòn theo đúng thứ tự SPD (tích hợp full HAX Engine!)
    for (const actor of livingAll) {
      if (actor.currentHp <= 0) continue;
      const enemies = actor.side === 'A' ? teamB : teamA;
      const target = pickFrontlineTarget(enemies);
      if (!target) break;

      // 3a. Pha Đầu Lượt (triggerTurnStart: hồi máu, giải khống chế, choáng/đóng băng, đốt DoT)
      const turnStartRes = triggerTurnStart(actor, target, rng, turn);
      for (const ev of turnStartRes?.events || []) {
        if (ev?.desc || ev?.skill) {
          thisTurnLines.push(`  • ${em('su_sparkle')} **[HAX Đầu Lượt]** ${ev.desc || ev.skill}`);
        }
      }
      if (actor.currentHp <= 0) {
        const liSelf = triggerLethalInterception(actor, target, rng);
        if (liSelf.survived && liSelf.skill) {
          thisTurnLines.push(`  • ${em('su_shield_def')} **[Bất Tử]** **${actor.name}**: ${liSelf.skill}`);
        }
      }
      if (actor.currentHp <= 0 || turnStartRes?.skipTurn) {
        if (turnStartRes?.skipTurn && actor.currentHp > 0) {
          turnEvents.push({ actor: actor.id, target: target.id, action: 'stun', dmg: 0 });
        }
        continue;
      }

      const ownBuffs = actor.domainRuntime?.own?.buffs || {};
      const actorDebuffs = actor.domainRuntime?.incomingDebuffs || {};

      // 3b. Sát thương cơ bản & Ngũ Hành
      const elemAdv = getElementalAdvantage(actor.pet?.element || actor.element || 'Kim', target.pet?.element || target.element || 'Kim');
      const rawBaseDamage = Math.max(20, Math.round(actor.atk * (1.25 + rng() * 0.25)));

      // 3c. Pha Tấn Công HAX (triggerAttackPhase: Crit, Né, Xuyên Giáp, Kết Liễu, Hút Máu...)
      const attackPhase = triggerAttackPhase(actor, target, rawBaseDamage, rng, {
        multiplier: Number(elemAdv.multiplier || 1.0),
        isTrueDamage: Boolean(elemAdv.isTrueDamage),
        elementAdvantage: elemAdv.label,
      });

      if (attackPhase.isMiss) {
        turnEvents.push({ actor: actor.id, target: target.id, action: 'miss', dmg: 0 });
        thisTurnLines.push(`  • ${uiEm('ui_wind_spd')} **${actor.name}** tung đòn vào **${target.name}** nhưng bị **${attackPhase.haxTriggered || 'Né Tránh'}** *(0 ST)*`);
        continue;
      }

      // 3d. Pha Nhận Sát Thương HAX (triggerDamageReceived: Miễn Thương, Khiên, Phản Sát Thương!)
      const damageRecv = triggerDamageReceived(target, attackPhase.damage, actor, rng, {
        ignoreEnemyDmgRedPct: attackPhase.ignoreEnemyDmgRedPct || 0,
        isTrueDamage: Boolean(attackPhase.isTrueDamage),
      });

      const notes = [];
      if (attackPhase.haxTriggered) notes.push(attackPhase.haxTriggered);
      for (const ev of damageRecv.events || []) {
        if (ev?.skill) notes.push(ev.skill);
      }

      let dmgToApply = damageRecv.finalDamage;
      let absorbedByShield = 0;

      if ((target.shield || 0) > 0) {
        const piercePct = Math.min(1, Math.max(0, Number(attackPhase.shieldPiercePct || ownBuffs.shieldPiercePct || 0)));
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
            const breakBonus = Math.floor(target.maxHp * attackPhase.bonusTrueOnShieldBreakPct);
            dmgToApply += breakBonus;
            notes.push(`Vỡ Khiên +${breakBonus.toLocaleString('vi-VN')} ST Chuẩn`);
          }
          if (target.state?.shieldExplodePct > 0) {
            const pct = target.state.shieldExplodePct;
            target.state.shieldExplodePct = 0;
            const explodeDmg = Math.floor(target.maxHp * pct);
            actor.currentHp = Math.max(0, actor.currentHp - explodeDmg);
            notes.push(`Nổ Hộ Thuẫn (-${explodeDmg.toLocaleString('vi-VN')} ST)`);
            if (actor.currentHp <= 0) {
              const li = triggerLethalInterception(actor, target, rng);
              if (li.survived && li.skill) notes.push(li.skill);
            }
          }
        }
      }

      target.currentHp = Math.max(0, target.currentHp - dmgToApply);

      // 3e. Hút máu (HAX + Linh Vực)
      let healAmt = 0;
      const totalLifestealPct = Math.min(0.85, Number(attackPhase.lifestealPct || 0) + Number(ownBuffs.lifestealPct || 0));
      if (totalLifestealPct > 0 && dmgToApply > 0 && actor.currentHp > 0) {
        const healPenalty = Math.min(0.85, Number(actorDebuffs.healReductionPct || 0));
        healAmt = applyHeal(actor, dmgToApply * totalLifestealPct * (1 - healPenalty));
        if (healAmt > 0) notes.push(`Hút +${healAmt.toLocaleString('vi-VN')} HP`);
      }

      // 3f. Phản sát thương (Damage Reflection từ Bảo Ngọc / Pet / HAX)
      if (damageRecv.reflectedDamage > 0 && actor.currentHp > 0) {
        actor.currentHp = Math.max(0, actor.currentHp - damageRecv.reflectedDamage);
        notes.push(`Phản Đòn -${damageRecv.reflectedDamage.toLocaleString('vi-VN')} ST`);
        if (actor.currentHp <= 0) {
          const liActor = triggerLethalInterception(actor, target, rng);
          if (liActor.survived && liActor.skill) notes.push(liActor.skill);
        }
      }

      // 3g. Chặn Đòn Chí Tử (Bất Tử / Kim Thân Hộ Mệnh) hoặc Hậu Sát Thương
      if (target.currentHp > 0) {
        const postEvents = triggerPostDamage(target, actor) || [];
        for (const pev of postEvents) {
          if (pev?.skill) notes.push(pev.skill);
        }
      } else {
        const lethalInterception = triggerLethalInterception(target, actor, rng);
        if (lethalInterception.survived && lethalInterception.skill) {
          notes.push(lethalInterception.skill);
          highlights.push(`**Hiệp ${turn}:** ${target.name} kích hoạt **${lethalInterception.skill}**!`);
        }
      }

      turnEvents.push({
        actor: actor.id,
        actorName: actor.name,
        target: target.id,
        targetName: target.name,
        action: attackPhase.isCrit ? 'crit' : 'attack',
        dmg: dmgToApply,
        ko: target.currentHp === 0,
      });

      const critTag = attackPhase.isCrit ? `${em('su_crit_boom')} **BẠO KÍCH!** ` : `${em('su_crossed_swords')} `;
      const elemTag = elemAdv?.label ? ` *(${elemAdv.label})*` : '';
      const shieldTag = absorbedByShield > 0 ? ` *(khiên chặn ${absorbedByShield.toLocaleString('vi-VN')})*` : '';
      const haxTag = notes.length > 0 ? ` • *[${notes.join(' | ')}]*` : '';
      const koTag = target.currentHp === 0 ? ` — ${uiEm('ui_skull_ko')} **HẠ GỤC!**` : ` *(HP còn ${target.currentHp.toLocaleString('vi-VN')}/${target.maxHp.toLocaleString('vi-VN')})*`;
      thisTurnLines.push(`  • ${critTag}**${actor.name}** → **${target.name}**${elemTag}: **-${dmgToApply.toLocaleString('vi-VN')} ST**${shieldTag}${haxTag}${koTag}`);

      if (target.currentHp === 0) {
        highlights.push(`**Hiệp ${turn}:** ${actor.name} hạ gục **${target.name}** (${dmgToApply.toLocaleString('vi-VN')} ST)!`);
      }
    }

    if (thisTurnLines.length > 0) {
      turnDetailLines.push(`• **Hiệp ${turn}:** *(Thứ tự SPD: ${livingAll.map((u) => `${u.name} (${u.spd.toLocaleString('vi-VN')})`).join(' → ')})*`);
      turnDetailLines.push(...thisTurnLines);
    }

    turnSnapshots.push({
      turn,
      isFinal: false,
      domainAEnergy: domainState.attacker.energy,
      domainBEnergy: domainState.defender.energy,
      domainLabel: formatTeamDomainLabel(),
      teamAHp: teamA.map((u) => u.currentHp),
      teamBHp: teamB.map((u) => u.currentHp),
      hpBars: [
        ...teamA.map((u, idx) => ({ side: 'A', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: prevAHp[idx], maxHp: u.maxHp, shield: u.shield || 0 })),
        ...teamB.map((u, idx) => ({ side: 'B', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: prevBHp[idx], maxHp: u.maxHp, shield: u.shield || 0 })),
      ],
      events: thisTurnLines.length ? thisTurnLines.map((l) => l.trim()) : ['• Đôi bên thăm dò thế trận.'],
    });

    turnLogs.push({ turn, events: turnEvents });
  }

  if (turnSnapshots.length > 0) {
    turnSnapshots[turnSnapshots.length - 1].isFinal = true;
  }

  const hpPctA = teamA.reduce((s, u) => s + u.currentHp, 0) / Math.max(1, teamA.reduce((s, u) => s + u.maxHp, 0));
  const hpPctB = teamB.reduce((s, u) => s + u.currentHp, 0) / Math.max(1, teamB.reduce((s, u) => s + u.maxHp, 0));
  const winnerSide = isTeamAlive(teamA) && !isTeamAlive(teamB)
    ? 'A'
    : !isTeamAlive(teamA) && isTeamAlive(teamB)
      ? 'B'
      : hpPctA >= hpPctB ? 'A' : 'B';

  const battleId = crypto.randomBytes(6).toString('hex');
  const webLogUrl = `${PUBLIC_BASE_URL}/api/vein/battle/${battleId}/view`;
  const leaderDomA = leaderA?.domainLoadout?.domain || null;
  const leaderDomB = leaderB?.domainLoadout?.domain || null;

  const formatRosterLine = (u, idx) => {
    const eqList = [u.equipment?.weapon, u.equipment?.gem, u.equipment?.soul]
      .filter(Boolean)
      .map((e) => `${e.item_name || e.item_id} (${String(e.enchant_grade || 'D').toUpperCase()})`)
      .join(', ') || 'Không';
    const fatTxt = u.fatiguePenaltyPct > 0 ? ` • Mệt -${u.fatiguePenaltyPct}%` : '';
    const domTxt = idx === 0 && u.domainLoadout?.domain ? ` • Vực Đội Trưởng: **${u.domainLoadout.domain.name}**` : '';
    const setTxt = u.setBonus?.active ? ` • ${u.setBonus.badgeText}` : '';
    return `• ${idx === 0 ? `${uiEm('ui_crown_king')} ` : ''}**${u.name}** (${u.pet.pet_name} • Hệ ${u.pet.element} • Lv.${u.pet.level} • ${u.pet.star}★${fatTxt}) — \`${Number(u.powerScore).toLocaleString('vi-VN')} Lực\` | ATK \`${u.atk.toLocaleString('vi-VN')}\` • DEF \`${u.def.toLocaleString('vi-VN')}\` • SPD \`${u.spd.toLocaleString('vi-VN')}\` • HP \`${u.initialMaxHp.toLocaleString('vi-VN')}\` | Pháp Bảo: ${eqList}${domTxt}${setTxt}`;
  };

  const untruncatedLogLines = [
    `**1. Đội Hình & Chỉ Số Đầu Trận (${opts.veinLabel || 'Chiếm Đoạt Linh Mạch'})**`,
    `${uiEm('ui_flag_capture')} **Phe Khiêu Chiến (${teamA.length} người):**`,
    ...teamA.map(formatRosterLine),
    `${em('su_shield_def')} **Phe Phòng Thủ (${teamB[0]?.isBoss ? 'BOSS LINH MẠCH' : `${teamB.length} người`}):**`,
    ...teamB.map(formatRosterLine),
    '',
    '**2. Diễn Biến Từng Hiệp (Theo Thứ Tự SPD)**',
    ...turnDetailLines,
    '',
    `**3. Kết Quả Trận Đấu (${turnCount} Hiệp)**`,
    `• **KẾT QUẢ:** ${winnerSide === 'A' ? `${em('su_winner_trophy')} **ĐỘI KHIÊU CHIẾN CHIẾM MỎ THÀNH CÔNG!**` : `${em('su_shield_def')} **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH!**`}`,
    `• **Phe A còn sống:** ${teamA.filter((u) => u.currentHp > 0).length}/${teamA.length} • **Phe B còn sống:** ${teamB.filter((u) => u.currentHp > 0).length}/${teamB.length}`,
    `• ${em('su_wiki_scroll')} **Xem Bản Web Đầy Đủ:** [Mở Chiến Báo Chi Tiết](${webLogUrl})`,
  ];

  let fullBattleLog = '';
  for (const line of untruncatedLogLines) {
    if ((fullBattleLog + '\n' + line).length > 3500) {
      fullBattleLog += `\n• *... (Còn tiếp chi tiết từng hiệp tại [Trang Web Nhật Ký Đầy Đủ](${webLogUrl}))*`;
      break;
    }
    fullBattleLog += (fullBattleLog ? '\n' : '') + line;
  }

  const nowCreatedMs = Date.now();
  const expiresAtMs = nowCreatedMs + BATTLE_LOG_TTL_MS;

  const result = {
    battleId,
    createdAtMs: nowCreatedMs,
    expiresAtMs,
    mode: opts.mode || (teamB.length === 1 && teamB[0].isBoss ? '3vBoss' : '3v3'),
    veinLabel: opts.veinLabel || 'Tranh Đoạt Linh Mạch',
    winnerSide,
    turnCount,
    turnSnapshots,
    webLogUrl,
    untruncatedLogLines,
    fullBattleLog,
    footer: '',
    teamA: teamA.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl || null,
      avatarFrame: u.avatarFrame || 'default',
      userLevel: u.userLevel || 1,
      setBonus: u.setBonus || null,
      pet: u.pet,
      equipment: u.equipment || {},
      atk: u.atk,
      def: u.def,
      spd: u.spd,
      maxHp: u.initialMaxHp,
      effectiveMaxHp: u.maxHp,
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
      avatarFrame: u.avatarFrame || 'default',
      userLevel: u.userLevel || 1,
      setBonus: u.setBonus || null,
      pet: u.pet,
      equipment: u.equipment || {},
      atk: u.atk,
      def: u.def,
      spd: u.spd,
      maxHp: u.initialMaxHp,
      effectiveMaxHp: u.maxHp,
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
      `• **Kết Quả:** ${winnerSide === 'A' ? `${em('su_winner_trophy')} **ĐỘI KHIÊU CHIẾN THẮNG LỢI!**` : `${em('su_shield_def')} **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH!**`}`,
      leaderDomA || leaderDomB
        ? `• **Linh Vực Đội Trưởng:** ${leaderDomA ? `${domainElementEmoji(leaderDomA.element)} ${leaderDomA.name}` : 'Không'} vs ${leaderDomB ? `${domainElementEmoji(leaderDomB.element)} ${leaderDomB.name}` : 'Không'}`
        : '',
    ].filter(Boolean).join('\n'),
  };

  cacheTeamBattle(battleId, result);
  void saveBattleLogRecord({
    battleId,
    battleKind: 'team',
    participantIds: [...teamA, ...teamB].map((u) => u.id),
    payload: result,
    nowMs: nowCreatedMs,
  });
  return result;
}

export async function renderSingleTeamBattleTurnOnDemand(battleId, rawTurn) {
  const cleanId = String(battleId || '').trim();
  const r = await loadTeamBattleReport(cleanId);
  if (!r) return null;

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [{ turn: Number(r.turnCount || 1), isFinal: true, teamAHp: (r.teamA || []).map((u) => u.currentHp), teamBHp: (r.teamB || []).map((u) => u.currentHp) }];

  const targetTurn = Math.max(0, Math.min(Number(r.turnCount || 1), Number(rawTurn) || 0));
  const cacheKey = `vein-turn:${targetTurn}`;
  const hit = getCachedTurnBuffer(cleanId, cacheKey);
  if (hit) return hit;

  const snap = snaps.find((s) => Number(s.turn) === targetTurn) || snaps[snaps.length - 1];
  const frameObj = {
    turn: Number(snap.turn || 0),
    totalTurns: Number(r.turnCount || 1),
    isFinal: Boolean(snap.isFinal) || Number(snap.turn) >= Number(r.turnCount || 1),
    teamAHp: snap.teamAHp,
    teamBHp: snap.teamBHp,
    domainAEnergy: snap.domainAEnergy,
    domainBEnergy: snap.domainBEnergy,
  };
  const buf = await withCanvasRenderSlot(`vein:${cleanId}:${cacheKey}`, () => renderTeamBattleCard(r, {
    format: 'webp',
    scale: 0.78,
    webpQuality: 74,
    frame: frameObj,
  }));
  if (buf) setCachedTurnBuffer(cleanId, cacheKey, buf);
  return buf;
}

export async function renderAllTeamBattleTurnsOnDemand(battleId) {
  const cleanId = String(battleId || '').trim();
  const r = await loadTeamBattleReport(cleanId);
  if (!r) return { success: false, found: false, rendered_count: 0, urls: [] };

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [{ turn: Number(r.turnCount || 1), isFinal: true }];

  const urls = [];
  for (const snap of snaps) {
    const t = Number(snap.turn || 0);
    await renderSingleTeamBattleTurnOnDemand(cleanId, t);
    urls.push(`/api/vein/battle/${encodeURIComponent(cleanId)}/turn/${t}.webp`);
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

export async function getTeamBattleLogPayload({ battleId, userId } = {}) {
  const cleanId = battleId && !/^\{/.test(String(battleId)) ? String(battleId).trim() : null;
  let r = cleanId ? getCachedTeamBattle(cleanId) : null;
  if (!r) {
    r = await loadBattleLogRecord({ battleId: cleanId, userId, battleKind: 'team' });
  }

  if (!r) {
    return {
      success: true,
      found: false,
      battleId: null,
      title: `${em('su_wiki_scroll')} NHẬT KÝ CHIẾN BÁO LINH MẠCH`,
      description: 'Nhật ký trận Linh Mạch này đã quá hạn lưu trữ (tối đa 2 ngày) hoặc không tồn tại. Hãy mở trận `/linhmach` mới để xem chi tiết!',
      footer: '',
    };
  }

  return {
    success: true,
    found: true,
    battleId: r.battleId,
    webLogUrl: r.webLogUrl,
    title: `${em('su_wiki_scroll')} NHẬT KÝ LINH MẠCH • ${r.veinLabel}`,
    description: r.fullBattleLog || r.summaryLine,
    footer: '',
  };
}

function resolveTeamLeaderDomainMeta(leaderDomObj) {
  if (!leaderDomObj) return null;
  const dom = leaderDomObj.domain_id ? (DOMAIN_BY_ID[leaderDomObj.domain_id] || leaderDomObj) : leaderDomObj;
  if (!dom?.name) return null;
  const rawSense = leaderDomObj.sense;
  const sense = rawSense?.sense_id ? (DIVINE_SENSE_BY_ID[rawSense.sense_id] || rawSense) : rawSense;
  const rawRealm = leaderDomObj.realm;
  const realm = rawRealm?.realm_id ? (DIVINE_REALM_BY_ID[rawRealm.realm_id] || rawRealm) : rawRealm;
  const maxEnergy = Number(leaderDomObj.maxEnergy || dom.base_energy || 0);
  const lm = (leaderDomObj.indestructible || maxEnergy >= 999)
    ? '∞ Linh Mạch'
    : `${maxEnergy} Linh Mạch`;
  return {
    iconTag: domainEmoji(dom.domain_id, em('su_realm_star')),
    name: dom.name,
    elementTag: domainElementEmoji(dom.element, em('su_realm_star')),
    element: dom.element || '',
    energyLabel: lm,
    buffDesc: dom.buff_desc || '',
    debuffDesc: dom.debuff_desc || '',
    daoApLabel: dom.dao_ap?.label || '',
    sense: sense?.name ? { iconTag: senseEmoji(sense.sense_id, em('su_sparkle')), name: sense.name, desc: sense.desc || '' } : null,
    realm: realm?.name ? { iconTag: realmEmojiById(realm.realm_id, em('su_arena')), name: realm.name, desc: realm.desc || '' } : null,
  };
}

function buildTeamStructuredUnits(units = [], leaderDomObj = null) {
  const leaderDomain = resolveTeamLeaderDomainMeta(leaderDomObj);
  return (units || []).map((u, idx) => {
    const p = u.pet || {};
    const catPet = p.pet_type ? PET_BY_TYPE[p.pet_type] : null;
    const mapEq = (rawItem, slotLabel, fallbackIcon) => {
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
      roleBadge: u.isBoss ? 'BOSS' : (idx === 0 ? `${uiEm('ui_crown_king')} Đội Trưởng` : `Thành Viên #${idx + 1}`),
      playerName: u.name || 'Tu Sĩ',
      petIconTag: petEmoji(p.pet_type, em('su_pet_paw')),
      petName: p.pet_name || catPet?.pet_name || 'Linh Thú',
      metaLine: `${p.rarity || catPet?.rarity || 'Phàm Phẩm'} • Hệ ${p.element || catPet?.element || 'Thổ'} • Lv.${p.level || 1} • ${p.star || 1}★`,
      stats: { atk: u.atk || 0, def: u.def || 0, spd: u.spd || 0, hp: u.maxHp || 0 },
      fatiguePct: Number(u.fatiguePenaltyPct || 0),
      petHax: catPet?.hax_skill ? { name: catPet.hax_skill, desc: catPet.hax_description || '' } : null,
      showDomain: idx === 0,
      domain: idx === 0 ? leaderDomain : null,
      equipment: u.isBoss
        ? []
        : [
            mapEq(u.equipment?.weapon, 'Vũ Khí', em('su_crossed_swords')),
            mapEq(u.equipment?.gem, 'Bảo Ngọc', em('su_linhthach')),
            mapEq(u.equipment?.soul, 'Chiến Hồn', em('su_sparkle')),
          ],
    };
  });
}

export async function renderTeamBattleLogHtml(battleId) {
  const cleanId = String(battleId || '').trim();
  const r = await loadTeamBattleReport(cleanId);
  if (!r) {
    return {
      found: false,
      html: renderExpiredBattleLogHtml(cleanId, true),
    };
  }

  const snaps = Array.isArray(r.turnSnapshots) && r.turnSnapshots.length > 0
    ? r.turnSnapshots
    : [{
        turn: Number(r.turnCount || 1),
        isFinal: true,
        teamAHp: (r.teamA || []).map((u) => u.currentHp),
        teamBHp: (r.teamB || []).map((u) => u.currentHp),
        hpBars: [
          ...(r.teamA || []).map((u) => ({ side: 'A', label: u.name, hp: u.currentHp, prevHp: u.maxHp, maxHp: u.maxHp, shield: 0 })),
          ...(r.teamB || []).map((u) => ({ side: 'B', label: u.name, hp: u.currentHp, prevHp: u.maxHp, maxHp: u.maxHp, shield: 0 })),
        ],
        events: (r.untruncatedLogLines || []).slice(0, 20),
      }];

  const headerEndIdx = (r.untruncatedLogLines || []).findIndex((l) => l.startsWith('**2.'));
  const rosterHtmlLines = headerEndIdx > 0 ? r.untruncatedLogLines.slice(0, headerEndIdx) : [];
  const rosterStructured = {
    leftTitle: `Phe Khiêu Chiến (${(r.teamA || []).length} người)`,
    rightTitle: r.teamB?.[0]?.isBoss ? 'Phe Phòng Thủ (BOSS Linh Mạch)' : `Phe Phòng Thủ (${(r.teamB || []).length} người)`,
    leftUnits: buildTeamStructuredUnits(r.teamA, r.leaderDomainA),
    rightUnits: buildTeamStructuredUnits(r.teamB, r.leaderDomainB),
    openingEvents: (r.highlights || []).slice(0, 6).map((h) => `• ${em('su_thunder_hax')} ${h}`),
  };
  const winnerSummaryHtml = stripDiscordTagsToHtml(
    r.winnerSide === 'A'
      ? `${em('su_winner_trophy')} **ĐỘI KHIÊU CHIẾN CHIẾM MỎ THÀNH CÔNG** sau **${r.turnCount} hiệp**!`
      : `${em('su_shield_def')} **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH** sau **${r.turnCount} hiệp**!`,
  );

  const html = renderInteractiveBattleLogPage({
    battleId: cleanId,
    title: r.veinLabel || 'Chiến Báo Linh Mạch',
    subtitle: `${r.mode || 'Tổ Đội'} • ${(r.teamA || []).map((u) => u.name).join(', ')} vs ${(r.teamB || []).map((u) => u.name).join(', ')}`,
    totalTurns: r.turnCount || 1,
    expiresAtMs: r.expiresAtMs || ((r.createdAtMs || Date.now()) + BATTLE_LOG_TTL_MS),
    renderAllUrl: `/api/vein/battle/${encodeURIComponent(cleanId)}/render-all`,
    turnImageTemplate: `/api/vein/battle/${encodeURIComponent(cleanId)}/turn/{turn}.webp`,
    snapshots: snaps,
    rosterHtmlLines,
    rosterStructured,
    winnerSummaryHtml,
    themeAccent: '#f59e0b',
  });

  return { found: true, html };
}
