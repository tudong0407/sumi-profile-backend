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

const TEAM_BATTLE_CACHE_MAX = 80;
const teamBattleCache = new Map();
const latestTeamBattleByUser = new Map();

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

export function applyFatigueToCombatant(combatant, fatigueStacks = 0) {
  const baseUnit = normalizeUnitPetAndPower(combatant);
  const stacks = Math.max(0, Math.min(3, Math.floor(Number(fatigueStacks) || 0)));
  const penaltyPct = Math.min(0.75, stacks * 0.25);
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
    fatiguePenaltyPct: Math.round(penaltyPct * 100),
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
    return {
      ...u,
      side: 'A',
      slotIndex: idx,
      currentHp: Number(u.currentHp || u.maxHp || 1000),
      maxHp: Number(u.maxHp || 1000),
      shield: Number(u.shield || 0),
      state: u.state || createInitialCombatState(),
    };
  });

  const teamB = (sideBRaw || []).slice(0, 3).map((raw, idx) => {
    const u = normalizeUnitPetAndPower(raw);
    return {
      ...u,
      side: 'B',
      slotIndex: idx,
      currentHp: Number(u.currentHp || u.maxHp || 1000),
      maxHp: Number(u.maxHp || 1000),
      shield: Number(u.shield || 0),
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
        ...teamA.map((u) => ({ side: 'A', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: u.maxHp, maxHp: u.maxHp, shield: u.shield || 0 })),
        ...teamB.map((u) => ({ side: 'B', label: `${u.name} (${u.pet.pet_name})`, hp: u.currentHp, prevHp: u.maxHp, maxHp: u.maxHp, shield: u.shield || 0 })),
      ],
      events: [`• **Khai Trận:** ${teamA.map((u) => u.name).join(', ')} ⚔️ ${teamB.map((u) => u.name).join(', ')}`],
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
          thisTurnLines.push(`  • 🌐 **[Linh Vực]** ${ev.desc || ev.skill}`);
        }
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
              thisTurnLines.push(`  • 🔥 **[Thiêu Đốt Vực]** **${member.name}** chịu \`-${dot.toLocaleString('vi-VN')} HP\` *(còn ${member.currentHp.toLocaleString('vi-VN')}/${member.maxHp.toLocaleString('vi-VN')})*`);
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
        thisTurnLines.push(`  • 💨 **${actor.name}** tung đòn vào **${target.name}** nhưng bị **Né Tránh / Lệch Hướng** *(0 ST)*`);
        continue;
      }

      // Ngũ Hành & Dị Tố
      const elemAdv = getElementalAdvantage(actor.pet?.element || actor.element || 'Kim', target.pet?.element || target.element || 'Kim');
      const defPierce = Math.min(0.80, Number(ownBuffs.defPiercePct || 0) + Number(targetDebuffs.defReductionPct || 0) + (elemAdv.armorPierce || 0));
      const effDef = Math.max(0, target.def * (1 - defPierce));

      // Công thức sát thương cân bằng
      const mitigation = 100 / (100 + effDef / Math.max(1, actor.atk) * 55);
      let rawDmg = actor.atk * (1.25 + rng() * 0.25) * mitigation * Number(elemAdv.multiplier || 1.0);

      // Bạo kích (hỗ trợ cả critRate thập phân 0.05..1.0 từ compileCombatant lẫn % nguyên 22 từ Boss)
      const rawCrit = Number(actor.critRate || 0);
      const critFromStat = rawCrit > 1 ? rawCrit / 100 : rawCrit;
      const critChance = Math.min(0.75, Math.max(0.12, critFromStat));
      const isCrit = rng() < critChance;
      if (isCrit) {
        const critBonus = Math.max(1.15, 1.55 + Number(targetDebuffs.critTakenBonusPct || 0) - Number(targetBuffs.critResistPct || 0));
        rawDmg *= critBonus;
      }

      const finalDmg = Math.max(1, Math.round(rawDmg));
      let remainingDmg = finalDmg;
      let absorbedByShield = 0;

      // Khiên chắn
      if (target.shield > 0) {
        const shieldPierce = Math.min(0.80, Number(ownBuffs.shieldPiercePct || 0));
        const directPart = Math.round(remainingDmg * shieldPierce);
        const shieldPart = remainingDmg - directPart;
        absorbedByShield = Math.min(target.shield, shieldPart);
        target.shield -= absorbedByShield;
        remainingDmg = directPart + (shieldPart - absorbedByShield);
      }

      target.currentHp = Math.max(0, target.currentHp - remainingDmg);

      // Hút máu từ Linh Vực
      let healAmt = 0;
      const lsPct = Number(ownBuffs.lifestealPct || 0);
      if (lsPct > 0 && remainingDmg > 0 && actor.currentHp > 0) {
        const healPenalty = Math.min(0.85, Number(actorDebuffs.healReductionPct || 0));
        healAmt = Math.floor(remainingDmg * lsPct * (1 - healPenalty));
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

      const critTag = isCrit ? '💥 **BẠO KÍCH!** ' : '⚔️ ';
      const elemTag = elemAdv?.label ? ` *(${elemAdv.label})*` : '';
      const shieldTag = absorbedByShield > 0 ? ` *(khiên chặn ${absorbedByShield.toLocaleString('vi-VN')})*` : '';
      const healTag = healAmt > 0 ? ` *(hút +${healAmt.toLocaleString('vi-VN')} HP)*` : '';
      const koTag = target.currentHp === 0 ? ' — ☠️ **HẠ GỤC!**' : ` *(HP còn ${target.currentHp.toLocaleString('vi-VN')}/${target.maxHp.toLocaleString('vi-VN')})*`;
      thisTurnLines.push(`  • ${critTag}**${actor.name}** → **${target.name}**${elemTag}: **-${remainingDmg.toLocaleString('vi-VN')} ST**${shieldTag}${healTag}${koTag}`);

      if (target.currentHp === 0) {
        highlights.push(`**Hiệp ${turn}:** ${actor.name} hạ gục **${target.name}** (${remainingDmg.toLocaleString('vi-VN')} ST)!`);
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
    return `• ${idx === 0 ? '👑 ' : ''}**${u.name}** (${u.pet.pet_name} • Hệ ${u.pet.element} • Lv.${u.pet.level} • ${u.pet.star}★${fatTxt}) — \`${Number(u.powerScore).toLocaleString('vi-VN')} Lực\` | ATK \`${u.atk.toLocaleString('vi-VN')}\` • DEF \`${u.def.toLocaleString('vi-VN')}\` • SPD \`${u.spd.toLocaleString('vi-VN')}\` • HP \`${u.maxHp.toLocaleString('vi-VN')}\` | Pháp Bảo: ${eqList}${domTxt}`;
  };

  const untruncatedLogLines = [
    `**1. Đội Hình & Chỉ Số Đầu Trận (${opts.veinLabel || 'Chiếm Đoạt Linh Mạch'})**`,
    `🚩 **Phe Khiêu Chiến (${teamA.length} người):**`,
    ...teamA.map(formatRosterLine),
    `🛡️ **Phe Phòng Thủ (${teamB[0]?.isBoss ? 'BOSS LINH MẠCH' : `${teamB.length} người`}):**`,
    ...teamB.map(formatRosterLine),
    '',
    '**2. Diễn Biến Từng Hiệp (Theo Thứ Tự SPD)**',
    ...turnDetailLines,
    '',
    `**3. Kết Quả Trận Đấu (${turnCount} Hiệp)**`,
    `• **KẾT QUẢ:** ${winnerSide === 'A' ? '🏆 **ĐỘI KHIÊU CHIẾN CHIẾM MỎ THÀNH CÔNG!**' : '🛡️ **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH!**'}`,
    `• **Phe A còn sống:** ${teamA.filter((u) => u.currentHp > 0).length}/${teamA.length} • **Phe B còn sống:** ${teamB.filter((u) => u.currentHp > 0).length}/${teamB.length}`,
    `• 📜 **Xem Bản Web Đầy Đủ:** [Mở Chiến Báo Chi Tiết](${webLogUrl})`,
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
  const winnerSummaryHtml = stripDiscordTagsToHtml(
    r.winnerSide === 'A'
      ? `🏆 **ĐỘI KHIÊU CHIẾN CHIẾM MỎ THÀNH CÔNG** sau **${r.turnCount} hiệp**!`
      : `🛡️ **PHE PHÒNG THỦ GIỮ VỮNG LINH MẠCH** sau **${r.turnCount} hiệp**!`,
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
    winnerSummaryHtml,
    themeAccent: '#f59e0b',
  });

  return { found: true, html };
}
