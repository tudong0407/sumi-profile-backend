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
  if (Date.now() - entry.createdAt > 30 * 60 * 1000) {
    teamBattleCache.delete(battleId);
    return null;
  }
  return entry.result;
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
  let turnCount = 0;

  const isTeamAlive = (team) => team.some((u) => u.currentHp > 0);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (!isTeamAlive(teamA) || !isTeamAlive(teamB)) break;
    turnCount = turn;

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

  const result = {
    battleId,
    mode: opts.mode || (teamB.length === 1 && teamB[0].isBoss ? '3vBoss' : '3v3'),
    veinLabel: opts.veinLabel || 'Tranh Đoạt Linh Mạch',
    winnerSide,
    turnCount,
    webLogUrl,
    untruncatedLogLines,
    fullBattleLog,
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

export function getTeamBattleLogPayload({ battleId, userId } = {}) {
  let targetId = battleId && !/^\{/.test(String(battleId)) ? String(battleId).trim() : null;
  let r = targetId ? getCachedTeamBattle(targetId) : null;

  if (!r && userId && !/^\{/.test(String(userId))) {
    const fallbackBid = latestTeamBattleByUser.get(String(userId).trim());
    if (fallbackBid) {
      targetId = fallbackBid;
      r = getCachedTeamBattle(fallbackBid);
    }
  }

  if (!r) {
    return {
      success: true,
      found: false,
      battleId: null,
      title: `${em('su_wiki_scroll')} NHẬT KÝ CHIẾN BÁO LINH MẠCH`,
      description: 'Nhật ký trận Linh Mạch này đã quá hạn lưu tạm (30 phút) hoặc máy chủ vừa khởi động lại. Hãy mở trận `/linhmach` mới để xem chi tiết!',
      footer: 'SuMi Family • Nhật Ký Linh Mạch',
    };
  }

  return {
    success: true,
    found: true,
    battleId: r.battleId,
    webLogUrl: r.webLogUrl,
    title: `${em('su_wiki_scroll')} NHẬT KÝ LINH MẠCH • ${r.veinLabel}`,
    description: r.fullBattleLog || r.summaryLine,
    footer: `SuMi Family • ${r.turnCount} Hiệp • Mã trận: ${r.battleId}`,
  };
}

function escapeHtmlVein(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLineHtmlVein(text) {
  let s = escapeHtmlVein(text);
  s = s.replace(/&lt;(a?):([a-zA-Z0-9_]+):([0-9]{15,22})&gt;/g, (_, anim, name, id) => {
    const ext = anim === 'a' ? 'gif' : 'png';
    return `<img class="d-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:">`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function renderTeamBattleLogHtml(battleId) {
  const cleanId = String(battleId || '').trim();
  const r = getCachedTeamBattle(cleanId);
  if (!r) {
    return {
      found: false,
      html: `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nhật Ký Linh Mạch Đã Hết Hạn • SuMi Family</title>
<style>body{background:#0f0a1c;color:#f5e9ff;font-family:'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{max-width:560px;background:#1a1230;border:1px solid #f59e0b55;border-radius:16px;padding:28px;text-align:center;box-shadow:0 12px 40px #0008}h1{color:#fde68a;font-size:1.35rem;margin-top:0}</style></head>
<body><div class="card"><h1>⛰️ Nhật Ký Chiến Báo Linh Mạch Không Còn Trong Bộ Nhớ Tạm</h1><p>Mã trận <code>${escapeHtmlVein(cleanId)}</code> đã quá hạn lưu tạm (30 phút) hoặc máy chủ vừa khởi động lại.</p><p>Hãy dùng <code>/linhmach</code> trên Discord SuMi Family để mở trận mới nhé!</p></div></body></html>`,
    };
  }

  const linesHtml = (r.untruncatedLogLines || []).map((line) => {
    if (!line.trim()) return '<div class="spacer"></div>';
    const isHeader = /^\*\*[123]\./.test(line) || line.startsWith('🚩 ') || line.startsWith('🛡️ ');
    const isTurn = line.startsWith('• **Hiệp ');
    const isResult = line.includes('**KẾT QUẢ:**');
    const cls = isResult ? 'log-line result-line' : isHeader ? 'log-line section-title' : isTurn ? 'log-line turn-line' : 'log-line';
    return `<div class="${cls}">${formatLineHtmlVein(line)}</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Chiến Báo Linh Mạch #${escapeHtmlVein(r.battleId)} • ${escapeHtmlVein(r.veinLabel)}</title>
  <style>
    :root { color-scheme: dark; }
    body { background: radial-gradient(circle at top, #23133d 0%, #0d0818 70%); color: #f3e8ff; font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 24px 14px 48px; line-height: 1.6; }
    .container { max-width: 980px; margin: 0 auto; background: rgba(23, 15, 42, 0.94); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 18px; padding: 24px 26px; box-shadow: 0 16px 48px rgba(0,0,0,0.65); }
    .header-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(245, 158, 11, 0.3); padding-bottom: 14px; margin-bottom: 18px; }
    h1 { font-size: 1.3rem; margin: 0; color: #fde68a; }
    .badge { background: rgba(236, 72, 153, 0.18); border: 1px solid rgba(244, 114, 182, 0.45); color: #fbcfe8; padding: 4px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
    .banner-wrap { margin: 14px 0 22px; text-align: center; }
    .banner-wrap img { max-width: 100%; border-radius: 14px; border: 1px solid rgba(245, 158, 11, 0.35); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .log-line { padding: 4px 10px; border-radius: 8px; margin-bottom: 2px; font-size: 0.94rem; word-break: break-word; }
    .section-title { margin-top: 14px; color: #f9a8d4; font-size: 1.04rem; background: rgba(236, 72, 153, 0.1); border-left: 3px solid #ec4899; padding: 6px 12px; }
    .turn-line { margin-top: 8px; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #f59e0b; padding: 5px 10px; }
    .result-line { margin-top: 14px; background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.4); padding: 10px 14px; font-size: 1.02rem; }
    .spacer { height: 8px; }
    code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 5px; font-size: 0.88em; color: #fde68a; }
    a { color: #93c5fd; }
    .d-emoji { width: 1.15em; height: 1.15em; vertical-align: -0.2em; object-fit: contain; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <h1>⛰️ ${escapeHtmlVein(r.veinLabel)}</h1>
      <span class="badge">${r.turnCount} Hiệp • Mã #${escapeHtmlVein(r.battleId)}</span>
    </div>
    <div class="banner-wrap"><img src="/api/vein/battle/${escapeHtmlVein(r.battleId)}.webp" alt="Chiến Báo Linh Mạch"></div>
    <div class="logs-box">${linesHtml}</div>
  </div>
</body>
</html>`;

  return { found: true, html };
}
