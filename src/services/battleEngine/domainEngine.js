/**
 * src/services/battleEngine/domainEngine.js
 * Hệ thống Lãnh Địa (Linh Vực • Thần Thức • Thần Cảnh) kích hoạt từ Hiệp 2 trong mọi trận đấu.
 * - KHÔNG buff ATK/DEF/SPD thô: chỉ cường hóa Buff cơ chế (Xuyên Giáp, Xuyên Khiên, Xác suất/Uy lực HAX, Hút Máu, Né, Thanh Tẩy, Kháng ST Chuẩn/Phản/Khống)
 *   và áp Debuff (Giảm Giáp, Trừ Trần HP, Khóa Hồi Máu, Đốt HP, Bào Mòn Khiên, Trừ Chính Xác, Dễ Bạo Kích, Khóa HAX).
 * - Đấu Linh Mạch từ Hiệp 2: 5 Hệ Vực khắc vòng tròn (Kiếm -> Huyễn -> Trận -> Minh -> Thánh -> Kiếm) + Hỗn Độn Vực (Fuyumi) khắc toàn bộ & bất hoại.
 */

import { V13_DOMAIN_ELEMENTS } from '../../data/v13ExpansionCatalog.js';
import { em, domainElementEmoji, senseEmoji, realmEmojiById } from '../../config/emojiHelper.js';

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
      drainResistChance += 0.20;
    }
    if (id === 'weapon_mythic_6') buffBonusPct += 0.15;
    if (id === 'weapon_mythic_18') buffBonusPct += 0.15;
    if (id === 'weapon_unique_10') {
      buffBonusPct += 0.20;
      debuffBonusPct += 0.10;
    }
    if (id === 'soul_mythic_20') buffBonusPct += 0.18;
    if (id === 'soul_unique_10') {
      buffBonusPct += 0.22;
      debuffBonusPct += 0.22;
    }
  }
  return { extraEnergy, buffBonusPct, debuffBonusPct, drainResistChance: Math.min(0.95, drainResistChance) };
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
    };
  }

  const indestructible = Boolean(domain.is_exclusive_fuyumi) || Number(domain.base_energy) >= 999;
  const baseEnergy = indestructible ? 999 : Number(domain.base_energy || 3);
  const senseBonus = indestructible ? 0 : Number(sense?.bonus_energy || 0);
  const maxEnergy = indestructible ? 999 : (baseEnergy + senseBonus + eqBonuses.extraEnergy);

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

function combineModifierMaps(baseMap = {}, extraMap = {}, scale = 1.0) {
  const out = {};
  if (scale <= 0) return out;
  const addEntry = (k, val) => {
    const n = Number(val) || 0;
    if (n <= 0) return;
    if (k === 'cleansePerTurn') {
      out[k] = (out[k] || 0) + Math.max(1, Math.round(n));
    } else {
      out[k] = (out[k] || 0) + n * scale;
    }
  };
  for (const [k, v] of Object.entries(baseMap || {})) addEntry(k, v);
  for (const [k, v] of Object.entries(extraMap || {})) addEntry(k, v);

  // An toàn biên độ thực chiến
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

  if (out.defReductionPct) out.defReductionPct = Math.min(0.65, out.defReductionPct);
  if (out.accuracyDownPct) out.accuracyDownPct = Math.min(0.40, out.accuracyDownPct);
  if (out.healReductionPct) out.healReductionPct = Math.min(0.85, out.healReductionPct);
  if (out.dotMaxHpPct) out.dotMaxHpPct = Math.min(0.18, out.dotMaxHpPct);
  if (out.critTakenBonusPct) out.critTakenBonusPct = Math.min(0.50, out.critTakenBonusPct);
  if (out.shieldDecayPct) out.shieldDecayPct = Math.min(0.50, out.shieldDecayPct);
  if (out.haxFailPct) out.haxFailPct = Math.min(0.35, out.haxFailPct);
  if (out.maxHpCutPct) out.maxHpCutPct = Math.min(0.45, out.maxHpCutPct);
  if (out.enemyShieldCapReductionPct) out.enemyShieldCapReductionPct = Math.min(0.55, out.enemyShieldCapReductionPct);

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
    buffs: combineModifierMaps(mySide.domain.buffs, null, buffScale),
    debuffsOnEnemy: debuffScale > 0
      ? combineModifierMaps(mySide.domain.debuffs, mySide.realm?.extra_debuffs, debuffScale)
      : {},
  };
}

function syncDomainModifiersAndMaxHp(attacker, defender, domainState, events) {
  const atkMod = resolveSideModifiers(domainState.attacker, domainState.defender);
  const defMod = resolveSideModifiers(domainState.defender, domainState.attacker);

  // Mỗi bên giữ cả buff của bản thân lẫn debuff đang gánh từ Vực đối thủ để haxEngine/battleService đọc O(1)
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
    const targetCut = Math.min(0.45, Number(enemyMod.debuffsOnEnemy?.maxHpCutPct || 0));
    if (targetCut > victimSide.appliedMaxHpCutPct && victim.currentHp > 0) {
      victimSide.appliedMaxHpCutPct = targetCut;
      const newMax = Math.max(200, Math.floor(victimSide.originalMaxHp * (1 - targetCut)));
      if (newMax < victim.maxHp) {
        victim.maxHp = newMax;
        if (victim.currentHp > newMax) victim.currentHp = newMax;
        events.push({
          actor: victim.id,
          action: 'domain_hp_cut',
          skill: `Thần Cảnh Áp Chế (-${Math.round(targetCut * 100)}% Trần HP Tối Đa)`,
          desc: `Linh Vực & Thần Cảnh từ ${casterName} ép giảm trần máu của ${victim.name} xuống còn ${newMax.toLocaleString('vi-VN')} HP!`,
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

  // 1. Kích hoạt lần đầu tại Hiệp 2 (chưa trừ điểm ở thời điểm mở màn Hiệp 2; bắt đầu đấu trừ năng lượng từ Hiệp 2 -> hết)
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
      events.push({
        actor: owner.id,
        action: 'domain_open',
        skill: `Khai Mở Linh Vực: ${domElIcon} ${side.domain.name}`,
        desc: `${owner.name} triển khai ${domElIcon} **${side.domain.name}** (${side.domain.element} • ${eLabel} Linh Mạch${extras ? ` • ${extras}` : ''})!`,
      });
    }
  }

  // 2. Tính tương khắc & tiêu hao Linh Mạch mỗi hiệp từ Hiệp 2 trở đi
  const aUp = sideA.hasDomain && sideA.activated && sideA.energy > 0;
  const bUp = sideB.hasDomain && sideB.activated && sideB.energy > 0;

  if (aUp && bUp) {
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

    // Kháng hao tổn khắc hệ từ Thần Thức / Bảo Ngọc (không kháng được Hỗn Độn Vực Fuyumi)
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

    if (sideA.energy === 0 && !sideA.indestructible) {
      events.push({ actor: attacker.id, action: 'domain_break', skill: `Vỡ Linh Vực (${sideA.domain.name})`, desc: `${sideA.domain.name} đã cạn Linh Mạch và tan vỡ!` });
    }
    if (sideB.energy === 0 && !sideB.indestructible) {
      events.push({ actor: defender.id, action: 'domain_break', skill: `Vỡ Linh Vực (${sideB.domain.name})`, desc: `${sideB.domain.name} đã cạn Linh Mạch và tan vỡ!` });
    }
  } else if (aUp || bUp) {
    const activeSide = aUp ? sideA : sideB;
    const owner = aUp ? attacker : defender;
    if (!activeSide.indestructible) {
      activeSide.energy = Math.max(0, activeSide.energy - 1);
      if (activeSide.energy === 0) {
        events.push({ actor: owner.id, action: 'domain_break', skill: `Vỡ Linh Vực (${activeSide.domain.name})`, desc: `${activeSide.domain.name} đã cạn Linh Mạch!` });
      }
    }
  }

  // 3. Đồng bộ Buff/Debuff & áp Debuff giảm trần HP nếu có
  syncDomainModifiersAndMaxHp(attacker, defender, domainState, events);

  // 4. Hiệu ứng đầu hiệp từ Debuff Linh Vực / Thần Cảnh (DoT, Bào Mòn Khiên, Thanh Tẩy Sân Nhà) & Hư Không Phá Vực Cung
  for (const [enemySide, owner, enemyOwner] of [[sideB, attacker, defender], [sideA, defender, attacker]]) {
    if (
      owner.equipment?.weapon?.item_id === 'weapon_mythic_22'
      && (owner.state?.haxLockedTurns || 0) === 0
      && (turnNumber % 3 === 0)
      && enemySide.hasDomain
      && enemySide.energy > 0
      && !enemySide.indestructible
    ) {
      enemySide.energy = Math.max(0, enemySide.energy - 1);
      events.push({ actor: owner.id, action: 'domain_erode', skill: 'Xuyên Vực Tiễn (-1 Linh Mạch Địch)' });
    }

    const mods = owner.domainRuntime?.own;
    if (!mods?.active) continue;

    const cleanCount = Number(mods.buffs?.cleansePerTurn || 0);
    if (cleanCount > 0) {
      for (let i = 0; i < cleanCount; i += 1) {
        if (owner.state.isStunned) owner.state.isStunned = false;
        else if (owner.state.blindTurns > 0) owner.state.blindTurns = 0;
        else if (owner.state.burnTurns > 0) owner.state.burnTurns = 0;
        else if (owner.state.atkDebuffTurns > 0) { owner.state.atkDebuffTurns = 0; owner.state.atkDebuffPct = 0; }
        else if (owner.state.defDebuffTurns > 0) { owner.state.defDebuffTurns = 0; owner.state.defDebuffPct = 0; }
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
        skill: `Linh Vực Phệ Hồn (-${dotDmg.toLocaleString('vi-VN')} HP)`,
      });
    }
  }

  return events;
}
