/**
 * src/services/battleEngine/domainEngine.js
 * Hệ thống Lãnh Địa (Linh Vực • Thần Thức • Thần Cảnh) kích hoạt từ Hiệp 2 trong mọi trận đấu.
 * v1.4 Nâng cấp:
 * - Debuff Cấp 2 « Đạo Áp » cho toàn bộ 16 Linh Vực Thần Thoại & Tối Thượng:
 *   Chỉ kích hoạt ở đầu hiệp kế tiếp sau khi đánh vỡ Linh Vực đang hoạt động của đối thủ
 *   (KHÔNG kích nếu địch vốn không mang Linh Vực). Duy trì 1-2 lượt (Thần Thoại Thường)
 *   hoặc tối đa 3 lượt (Thần Thoại Độc Nhất & Tối Thượng), mạnh hơn debuff gốc +20%..+30%.
 * - Hook chuẩn `drainEnemyDomainEnergy()` cho tương lai gắn Vũ Khí / Pet có HAX bào mòn Linh Mạch địch.
 */

import { V13_DOMAIN_ELEMENTS } from '../../data/v13ExpansionCatalog.js';
import { V14_DAO_AP_CONFIG } from '../../data/v14ExpansionCatalog.js';
import { em, domainElementEmoji, senseEmoji, realmEmojiById } from '../../config/emojiHelper.js';
import { cleanseCombatantDebuffs } from './haxEngine.js';

function getEquipDomainBonuses(combatant) {
  let extraEnergy = 0;
  let buffBonusPct = 0;
  let debuffBonusPct = 0;
  let drainResistChance = 0;

  const eq = combatant?.equipment || {};
  for (const piece of [eq.weapon, eq.gem, eq.soul]) {
    if (!piece) continue;
    const id = String(piece.item_id || '').toLowerCase();
    if (id === 'gem_mythic_22') extraEnergy += 1;
    if (id === 'gem_unique_10') {
      extraEnergy += 1;
      drainResistChance += 0.25;
      buffBonusPct += 0.10;
    }
    if (id === 'weapon_mythic_6') buffBonusPct += 0.15;
    if (id === 'weapon_mythic_18') buffBonusPct += 0.10;
    if (id === 'weapon_unique_10') {
      buffBonusPct += 0.20;
      debuffBonusPct += 0.10;
    }
    if (id === 'soul_mythic_20') debuffBonusPct += 0.12;
    if (id === 'soul_unique_10') {
      extraEnergy += 2;
      debuffBonusPct += 0.20;
    }
  }
  return { extraEnergy, buffBonusPct, debuffBonusPct, drainResistChance: Math.min(0.95, drainResistChance) };
}

function getDaoApConfigForDomain(domain) {
  if (!domain) return null;
  return domain.dao_ap || V14_DAO_AP_CONFIG[domain.domain_id] || null;
}

export function createDomainCombatSide(combatant) {
  const loadout = combatant?.domainLoadout || {};
  const domain = loadout.domain || null;
  const sense = loadout.sense || null;
  const realm = loadout.realm || null;
  const eqBonuses = getEquipDomainBonuses(combatant);

  if (!domain) {
    return {
      hasDomain: false,
      domain: null,
      sense: null,
      realm: null,
      activated: false,
      indestructible: false,
      maxEnergy: 0,
      energy: 0,
      eqBonuses,
      appliedMaxHpCutPct: 0,
      originalMaxHp: Number(combatant?.maxHp || 0),
      daoApArmed: false,
      daoApActiveTurns: 0,
      daoApUsed: false,
    };
  }

  const indestructible = Boolean(domain.is_exclusive_fuyumi) || Number(domain.base_energy) >= 999;
  const baseEnergy = indestructible ? 999 : Number(domain.base_energy || 3);
  const senseBonus = indestructible ? 0 : Number(sense?.bonus_energy || 0);
  const setEnergyBonus = indestructible ? 0 : Number(combatant?.setBonus?.bonusStartingLinhMach || 0);
  const maxEnergy = indestructible ? 999 : (baseEnergy + senseBonus + eqBonuses.extraEnergy + setEnergyBonus);

  return {
    hasDomain: true,
    domain,
    sense,
    realm,
    activated: false,
    indestructible,
    maxEnergy,
    energy: maxEnergy,
    eqBonuses,
    appliedMaxHpCutPct: 0,
    originalMaxHp: Number(combatant?.maxHp || 0),
    daoApArmed: false,
    daoApActiveTurns: 0,
    daoApUsed: false,
  };
}

export function initDomainBattleState(attacker, defender) {
  const state = {
    attacker: createDomainCombatSide(attacker),
    defender: createDomainCombatSide(defender),
    activatedAtTurn2: false,
  };
  if (attacker) attacker.domainRuntime = { modifiers: null };
  if (defender) defender.domainRuntime = { modifiers: null };
  return state;
}

export function getDomainElementCounterResult(elemA, elemB) {
  if (!elemA || !elemB) return { aCountersB: false, bCountersA: false };
  const isChaosA = elemA === V13_DOMAIN_ELEMENTS.supreme;
  const isChaosB = elemB === V13_DOMAIN_ELEMENTS.supreme;
  if (isChaosA && !isChaosB) return { aCountersB: true, bCountersA: false, isChaos: true };
  if (isChaosB && !isChaosA) return { aCountersB: false, bCountersA: true, isChaos: true };
  if (isChaosA && isChaosB) return { aCountersB: false, bCountersA: false, isChaos: true };
  return {
    aCountersB: V13_DOMAIN_ELEMENTS.counters[elemA] === elemB,
    bCountersA: V13_DOMAIN_ELEMENTS.counters[elemB] === elemA,
    isChaos: false,
  };
}

/**
 * Helper chuẩn hóa cho tương lai: bất kỳ Vũ Khí / Linh Thú nào có HAX bào mòn Linh Mạch đối thủ
 * đều gọi hàm này để giảm energy đối phương và tự động kích chờ « Đạo Áp » nếu vừa đánh vỡ Vực địch!
 */
export function drainEnemyDomainEnergy(sourceSide, targetSide, amount, { sourceLabel = 'Phá Vực HAX', events = null, ownerId = null, targetName = '' } = {}) {
  const drain = Math.max(0, Math.floor(Number(amount) || 0));
  if (!targetSide?.hasDomain || !targetSide.activated || targetSide.indestructible || targetSide.energy <= 0 || drain <= 0) {
    return { drained: 0, brokeEnemyDomain: false };
  }
  const prevEnergy = targetSide.energy;
  targetSide.energy = Math.max(0, prevEnergy - drain);
  const actualDrained = prevEnergy - targetSide.energy;
  const brokeEnemyDomain = prevEnergy > 0 && targetSide.energy === 0;

  if (Array.isArray(events) && actualDrained > 0) {
    events.push({
      actor: ownerId || 'system',
      action: 'domain_erode',
      skill: `${sourceLabel} (-${actualDrained} Linh Mạch Địch)`,
    });
  }

  if (brokeEnemyDomain) {
    if (Array.isArray(events)) {
      events.push({
        actor: ownerId || 'system',
        action: 'domain_break',
        skill: `Vỡ Linh Vực (${targetSide.domain.name})`,
        desc: `${targetSide.domain.name}${targetName ? ` của ${targetName}` : ''} đã bị đánh vỡ hoàn toàn!`,
      });
    }
    armDaoApIfEligible(sourceSide, targetSide);
  }

  return { drained: actualDrained, brokeEnemyDomain };
}

/**
 * Ghi nhận chờ kích hoạt « Đạo Áp » vào hiệp kế tiếp khi Linh Vực Thần Thoại còn đứng vững
 * vừa đánh vỡ một Linh Vực đang tồn tại của đối thủ.
 */
function armDaoApIfEligible(winnerSide, brokenEnemySide) {
  if (!winnerSide?.hasDomain || !winnerSide.activated || winnerSide.energy <= 0) return false;
  if (!brokenEnemySide?.hasDomain || !brokenEnemySide.activated || brokenEnemySide.energy > 0) return false;
  if (winnerSide.daoApUsed || winnerSide.daoApArmed || winnerSide.daoApActiveTurns > 0) return false;
  const cfg = getDaoApConfigForDomain(winnerSide.domain);
  if (!cfg) return false;
  winnerSide.daoApArmed = true;
  return true;
}

function combineModifierMaps(baseMap = {}, extraMap = {}, scale = 1.0, daoApBaseScale = 1.0) {
  const out = {};
  if (scale <= 0) return out;
  const addEntry = (k, val, mult) => {
    const n = Number(val) || 0;
    if (n <= 0) return;
    if (k === 'cleansePerTurn') {
      out[k] = (out[k] || 0) + Math.max(1, Math.round(n));
    } else {
      out[k] = (out[k] || 0) + n * mult;
    }
  };
  for (const [k, v] of Object.entries(baseMap || {})) addEntry(k, v, scale * daoApBaseScale);
  for (const [k, v] of Object.entries(extraMap || {})) addEntry(k, v, scale);

  // An toàn biên độ thực chiến (nới trần nhẹ để Đạo Áp +20..30% thể hiện rõ nhưng không vỡ game)
  if (out.defPiercePct) out.defPiercePct = Math.min(0.75, out.defPiercePct);
  if (out.shieldPiercePct) out.shieldPiercePct = Math.min(0.80, out.shieldPiercePct);
  if (out.haxProcBonusPct) out.haxProcBonusPct = Math.min(0.55, out.haxProcBonusPct);
  if (out.haxDamageBonusPct) out.haxDamageBonusPct = Math.min(0.50, out.haxDamageBonusPct);
  if (out.dodgeBonusPct) out.dodgeBonusPct = Math.min(0.28, out.dodgeBonusPct);
  if (out.lifestealPct) out.lifestealPct = Math.min(0.35, out.lifestealPct);
  if (out.shieldStrengthBonusPct) out.shieldStrengthBonusPct = Math.min(0.55, out.shieldStrengthBonusPct);
  if (out.controlResistPct) out.controlResistPct = Math.min(0.75, out.controlResistPct);
  if (out.trueDmgResistPct) out.trueDmgResistPct = Math.min(0.65, out.trueDmgResistPct);
  if (out.critResistPct) out.critResistPct = Math.min(0.65, out.critResistPct);
  if (out.reflectResistPct) out.reflectResistPct = Math.min(0.80, out.reflectResistPct);

  if (out.defReductionPct) out.defReductionPct = Math.min(0.75, out.defReductionPct);
  if (out.accuracyDownPct) out.accuracyDownPct = Math.min(0.48, out.accuracyDownPct);
  if (out.healReductionPct) out.healReductionPct = Math.min(0.90, out.healReductionPct);
  if (out.dotMaxHpPct) out.dotMaxHpPct = Math.min(0.22, out.dotMaxHpPct);
  if (out.critTakenBonusPct) out.critTakenBonusPct = Math.min(0.58, out.critTakenBonusPct);
  if (out.shieldDecayPct) out.shieldDecayPct = Math.min(0.58, out.shieldDecayPct);
  if (out.haxFailPct) out.haxFailPct = Math.min(0.42, out.haxFailPct);
  if (out.maxHpCutPct) out.maxHpCutPct = Math.min(0.48, out.maxHpCutPct);
  if (out.enemyShieldCapReductionPct) out.enemyShieldCapReductionPct = Math.min(0.62, out.enemyShieldCapReductionPct);

  return out;
}

export function resolveSideModifiers(mySide, enemySide) {
  if (!mySide?.hasDomain || !mySide.activated || mySide.energy <= 0) {
    return {
      active: false,
      energy: 0,
      maxEnergy: mySide?.maxEnergy || 0,
      isDominating: false,
      pierceRatio: 0,
      daoApActive: false,
      daoApTurnsLeft: 0,
      daoApScale: 1.0,
      buffs: {},
      debuffsOnEnemy: {},
    };
  }

  const enemyStanding = Boolean(enemySide?.hasDomain && enemySide.activated && enemySide.energy > 0);
  const isFuyumi = Boolean(mySide.domain.is_exclusive_fuyumi);

  let buffScale = 1 + Number(mySide.sense?.buff_boost_pct || 0) + Number(mySide.eqBonuses?.buffBonusPct || 0);
  if (enemyStanding && !isFuyumi) {
    const enemySuppress = Number(enemySide.domain?.enemy_buff_suppression || 0);
    if (enemySuppress > 0) buffScale *= Math.max(0.25, 1 - enemySuppress);
  }

  let pierceRatio = 1.0;
  if (enemyStanding) {
    if (enemySide.domain?.lock_enemy_debuffs && !isFuyumi) {
      pierceRatio = 0;
    } else {
      pierceRatio = Number(mySide.domain?.enemy_active_debuff_pierce || 0);
    }
  }

  const realmDebuffBoost = Number(mySide.realm?.debuff_boost_pct || 0) + Number(mySide.eqBonuses?.debuffBonusPct || 0);
  const debuffScale = pierceRatio > 0 ? pierceRatio * (1 + realmDebuffBoost) : 0;

  const daoApCfg = getDaoApConfigForDomain(mySide.domain);
  const daoApActive = Boolean(!enemyStanding && daoApCfg && mySide.daoApActiveTurns > 0);
  const daoApBaseScale = daoApActive ? Number(daoApCfg.scaleFactor || 1.25) : 1.0;

  return {
    active: true,
    domainName: mySide.domain.name,
    domainElement: mySide.domain.element,
    senseName: mySide.sense?.name || null,
    realmName: mySide.realm?.name || null,
    energy: mySide.energy,
    maxEnergy: mySide.maxEnergy,
    isDominating: !enemyStanding,
    pierceRatio,
    daoApActive,
    daoApTurnsLeft: daoApActive ? mySide.daoApActiveTurns : 0,
    daoApScale: daoApBaseScale,
    buffs: combineModifierMaps(mySide.domain.buffs, null, buffScale, 1.0),
    debuffsOnEnemy: debuffScale > 0
      ? combineModifierMaps(mySide.domain.debuffs, mySide.realm?.extra_debuffs, debuffScale, daoApBaseScale)
      : {},
  };
}

function syncDomainModifiersAndMaxHp(attacker, defender, domainState, events) {
  const atkMod = resolveSideModifiers(domainState.attacker, domainState.defender);
  const defMod = resolveSideModifiers(domainState.defender, domainState.attacker);

  attacker.domainRuntime = {
    own: atkMod,
    incomingDebuffs: defMod.debuffsOnEnemy || {},
  };
  defender.domainRuntime = {
    own: defMod,
    incomingDebuffs: atkMod.debuffsOnEnemy || {},
  };

  for (const [victim, enemyMod, victimSide, casterName] of [
    [defender, atkMod, domainState.defender, attacker.name],
    [attacker, defMod, domainState.attacker, defender.name],
  ]) {
    const targetCut = Math.min(0.48, Number(enemyMod.debuffsOnEnemy?.maxHpCutPct || 0));
    if (targetCut > victimSide.appliedMaxHpCutPct && victim.currentHp > 0) {
      victimSide.appliedMaxHpCutPct = targetCut;
      const newMax = Math.max(200, Math.floor(victimSide.originalMaxHp * (1 - targetCut)));
      if (newMax < victim.maxHp) {
        victim.maxHp = newMax;
        if (victim.currentHp > newMax) victim.currentHp = newMax;
        events.push({
          actor: victim.id,
          action: 'domain_hp_cut',
          skill: enemyMod.daoApActive
            ? `${em('dao_ap_crest')} Đạo Áp Cắt Trần HP (-${Math.round(targetCut * 100)}% HP Tối Đa)`
            : `Thần Cảnh Áp Chế (-${Math.round(targetCut * 100)}% Trần HP Tối Đa)`,
          desc: `Linh Vực từ ${casterName} ép giảm trần máu của ${victim.name} xuống còn ${newMax.toLocaleString('vi-VN')} HP!`,
        });
      }
    }
  }
}

/**
 * Chạy pha Linh Vực đầu mỗi hiệp >= 2 trước khi các Linh Thú ra đòn.
 */
export function processTurnDomainPhase(turnNumber, attacker, defender, domainState, rng = Math.random) {
  const events = [];
  if (!domainState || turnNumber < 2) return events;

  const sideA = domainState.attacker;
  const sideB = domainState.defender;

  if (!sideA.hasDomain && !sideB.hasDomain) return events;

  // 0. Cập nhật vòng đời « Đạo Áp » đầu hiệp:
  //    - Giảm lượt Đạo Áp đã chạy xong từ hiệp trước
  //    - Nếu vừa phá Vực địch ở hiệp trước (daoApArmed = true), chính thức khai mở « Đạo Áp » ngay đầu hiệp này!
  for (const [side, enemySide, owner, enemyOwner] of [
    [sideA, sideB, attacker, defender],
    [sideB, sideA, defender, attacker],
  ]) {
    if (side.daoApActiveTurns > 0) {
      side.daoApActiveTurns = Math.max(0, side.daoApActiveTurns - 1);
      if (side.daoApActiveTurns === 0) {
        events.push({
          actor: owner.id,
          action: 'dao_ap_end',
          skill: `Dư Chấn Đạo Áp tan dần (${side.domain?.name || 'Linh Vực'})`,
        });
      }
    }

    if (side.daoApArmed && side.hasDomain && side.energy > 0 && (!enemySide.hasDomain || enemySide.energy === 0)) {
      const cfg = getDaoApConfigForDomain(side.domain);
      side.daoApArmed = false;
      side.daoApUsed = true;
      if (cfg) {
        side.daoApActiveTurns = cfg.durationTurns;
        const crest = em('dao_ap_crest');
        events.push({
          actor: owner.id,
          action: 'dao_ap_activate',
          skill: `${crest} KHAI MỞ ĐẠO ÁP — ${cfg.label} (${cfg.durationTurns} hiệp)`,
          desc: `${crest} Linh Vực **${side.domain.name}** của ${owner.name} nghiền nát tàn tích Vực địch, giáng **Đạo Áp Cấp 2** (+${Math.round((cfg.scaleFactor - 1) * 100)}% uy lực) lên ${enemyOwner.name} trong **${cfg.durationTurns} hiệp**!`,
        });
      }
    }
  }

  // 1. Kích hoạt lần đầu tại Hiệp 2
  if (turnNumber === 2 && !domainState.activatedAtTurn2) {
    domainState.activatedAtTurn2 = true;
    for (const [side, owner] of [[sideA, attacker], [sideB, defender]]) {
      if (!side.hasDomain) continue;
      side.activated = true;
      const eLabel = side.indestructible ? '∞' : side.maxEnergy;
      const domElIcon = domainElementEmoji(side.domain.element, em('su_realm_star'));
      const senseTxt = side.sense ? `${senseEmoji(side.sense.sense_id, em('su_sparkle'))} ${side.sense.name}`.trim() : null;
      const realmTxt = side.realm ? `${realmEmojiById(side.realm.realm_id, em('su_arena'))} ${side.realm.name}`.trim() : null;
      const extras = [senseTxt, realmTxt].filter(Boolean).join(' • ');
      const otherSide = side === sideA ? sideB : sideA;
      const waitNote = otherSide.hasDomain && !side.domain.is_exclusive_fuyumi && Number(side.domain.enemy_active_debuff_pierce || 0) === 0
        ? ' *(Debuff Vực/Cảnh chờ Vực địch vỡ)*'
        : '';
      events.push({
        actor: owner.id,
        action: 'domain_open',
        skill: `Khai Mở Linh Vực: ${domElIcon} ${side.domain.name}`,
        desc: `${owner.name} triển khai ${domElIcon} **${side.domain.name}** (${side.domain.element} • ${eLabel} Linh Mạch${extras ? ` • ${extras}` : ''})${waitNote}!`,
      });
    }
  }

  // 2. Tính tương khắc & tiêu hao Linh Mạch mỗi hiệp từ Hiệp 2 trở đi
  const aUp = sideA.hasDomain && sideA.activated && sideA.energy > 0;
  const bUp = sideB.hasDomain && sideB.activated && sideB.energy > 0;

  if (aUp && bUp) {
    const prevA = sideA.energy;
    const prevB = sideB.energy;
    const counter = getDomainElementCounterResult(sideA.domain.element, sideB.domain.element);
    let drainA = 1;
    let drainB = 1;

    if (counter.aCountersB) {
      drainB = 2 + Number(sideA.sense?.extra_enemy_drain || 0);
      drainA = sideA.indestructible ? 0 : 1;
    } else if (counter.bCountersA) {
      drainA = 2 + Number(sideB.sense?.extra_enemy_drain || 0);
      drainB = sideB.indestructible ? 0 : 1;
    } else {
      drainA = sideA.indestructible ? 0 : 1;
      drainB = sideB.indestructible ? 0 : 1;
    }

    if (drainA > 1 && !sideB.indestructible) {
      const resistChance = Math.min(0.95, Number(sideA.sense?.clash_resist_chance || 0) + Number(sideA.eqBonuses?.drainResistChance || 0));
      if (resistChance > 0 && rng() < resistChance) drainA = 1;
    }
    if (drainB > 1 && !sideA.indestructible) {
      const resistChance = Math.min(0.95, Number(sideB.sense?.clash_resist_chance || 0) + Number(sideB.eqBonuses?.drainResistChance || 0));
      if (resistChance > 0 && rng() < resistChance) drainB = 1;
    }

    if (!sideA.indestructible) sideA.energy = Math.max(0, sideA.energy - drainA);
    if (!sideB.indestructible) sideB.energy = Math.max(0, sideB.energy - drainB);

    if (counter.aCountersB) {
      const eA = domainElementEmoji(sideA.domain.element, em('su_realm_star'));
      const eB = domainElementEmoji(sideB.domain.element, em('su_realm_star'));
      events.push({
        actor: attacker.id,
        action: 'domain_clash',
        skill: `Khắc Chế Hệ Vực (${eA} ${sideA.domain.element} ▸ ${eB} ${sideB.domain.element})`,
        desc: `${eA} ${sideA.domain.name} áp chế ${eB} ${sideB.domain.name} (${sideA.indestructible ? '∞' : `${sideA.energy}/${sideA.maxEnergy}`} vs ${sideB.energy}/${sideB.maxEnergy} Linh Mạch)!`,
      });
    } else if (counter.bCountersA) {
      const eB = domainElementEmoji(sideB.domain.element, em('su_realm_star'));
      const eA = domainElementEmoji(sideA.domain.element, em('su_realm_star'));
      events.push({
        actor: defender.id,
        action: 'domain_clash',
        skill: `Khắc Chế Hệ Vực (${eB} ${sideB.domain.element} ▸ ${eA} ${sideA.domain.element})`,
        desc: `${eB} ${sideB.domain.name} áp chế ${eA} ${sideA.domain.name} (${sideB.indestructible ? '∞' : `${sideB.energy}/${sideB.maxEnergy}`} vs ${sideA.energy}/${sideA.maxEnergy} Linh Mạch)!`,
      });
    }

    const aBroke = prevA > 0 && sideA.energy === 0 && !sideA.indestructible;
    const bBroke = prevB > 0 && sideB.energy === 0 && !sideB.indestructible;

    if (aBroke) {
      events.push({ actor: attacker.id, action: 'domain_break', skill: `Vỡ Linh Vực (${sideA.domain.name})`, desc: `${sideA.domain.name} đã cạn Linh Mạch và tan vỡ!` });
      armDaoApIfEligible(sideB, sideA);
    }
    if (bBroke) {
      events.push({ actor: defender.id, action: 'domain_break', skill: `Vỡ Linh Vực (${sideB.domain.name})`, desc: `${sideB.domain.name} đã cạn Linh Mạch và tan vỡ!` });
      armDaoApIfEligible(sideA, sideB);
    }
  } else if (aUp || bUp) {
    const activeSide = aUp ? sideA : sideB;
    const owner = aUp ? attacker : defender;
    if (!activeSide.indestructible) {
      activeSide.energy = Math.max(0, activeSide.energy - 1);
      if (activeSide.energy === 0) {
        activeSide.daoApActiveTurns = 0;
        activeSide.daoApArmed = false;
        events.push({ actor: owner.id, action: 'domain_break', skill: `Vỡ Linh Vực (${activeSide.domain.name})`, desc: `${activeSide.domain.name} đã cạn Linh Mạch!` });
      }
    }
  }

  // 3. Đồng bộ Buff/Debuff & áp Debuff giảm trần HP nếu có
  syncDomainModifiersAndMaxHp(attacker, defender, domainState, events);

  // 4. Hiệu ứng đầu hiệp (DoT, Bào Mòn Khiên, Thanh Tẩy Sân Nhà) & Vũ Khí phá Linh Mạch (hook drainEnemyDomainEnergy)
  for (const [mySide, enemySide, owner, enemyOwner] of [
    [sideA, sideB, attacker, defender],
    [sideB, sideA, defender, attacker],
  ]) {
    if (
      owner.equipment?.weapon?.item_id === 'weapon_mythic_22'
      && (owner.state?.haxLockedTurns || 0) === 0
      && (turnNumber % 3 === 0)
    ) {
      drainEnemyDomainEnergy(mySide, enemySide, 1, {
        sourceLabel: 'Xuyên Vực Tiễn',
        events,
        ownerId: owner.id,
        targetName: enemyOwner.name,
      });
    }

    const mods = owner.domainRuntime?.own;
    if (!mods?.active) continue;

    const cleanCount = Number(mods.buffs?.cleansePerTurn || 0);
    if (cleanCount > 0) {
      const cleansed = cleanseCombatantDebuffs(owner, cleanCount);
      if (cleansed.length > 0) {
        events.push({
          actor: owner.id,
          action: 'domain_cleanse',
          skill: `Linh Vực Thanh Tẩy (${cleansed.join(' + ')})`,
        });
      }
    }

    const shieldDecayPct = Number(mods.debuffsOnEnemy?.shieldDecayPct || 0);
    if (shieldDecayPct > 0 && enemyOwner.shield > 0) {
      enemyOwner.shield = Math.max(0, Math.floor(enemyOwner.shield * (1 - shieldDecayPct)));
    }

    const dotPct = Number(mods.debuffsOnEnemy?.dotMaxHpPct || 0);
    if (dotPct > 0 && enemyOwner.currentHp > 1) {
      const dotDmg = Math.max(1, Math.floor(enemyOwner.maxHp * dotPct));
      enemyOwner.currentHp = Math.max(1, enemyOwner.currentHp - dotDmg);
      events.push({
        actor: owner.id,
        action: 'domain_dot',
        skill: mods.daoApActive
          ? `${em('dao_ap_crest')} Đạo Áp Phệ Hồn (-${dotDmg.toLocaleString('vi-VN')} HP)`
          : `Linh Vực Phệ Hồn (-${dotDmg.toLocaleString('vi-VN')} HP)`,
      });
    }
  }

  return events;
}
