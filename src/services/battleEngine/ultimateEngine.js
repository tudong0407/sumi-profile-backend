/**
 * src/services/battleEngine/ultimateEngine.js
 * Hệ thống 40 Skill Ultimate Tái Kích Hoạt (Tối Thượng Chân Thần — SuMi Ver 1.7).
 * - Kích hoạt tự động lặp lại suốt trận (1v1 / 3v3 / 3vBoss) khi đủ Điều Kiện Kích Hoạt & hết Cooldown.
 * - Dùng unified helpers từ haxEngine.js: cleanseCombatantDebuffs(), getTrueDamageResistPct(), applyHeal().
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { cleanseCombatantDebuffs, getTrueDamageResistPct, applyHeal, triggerLethalInterception } from './haxEngine.js';

export function createUltimateState(ultimateDef = null, isEvolved = false) {
  return {
    active: Boolean(isEvolved && ultimateDef),
    ultDef: ultimateDef || null,
    cooldown: 0,
    triggerCount: 0,
    dmgDealt: 0,
    dmgTaken: 0,
    crits: 0,
    dodges: 0,
    burnTicksApplied: 0,
    reviveTriggered: false,
    healsPctAccum: 0,
    healEvents: 0,
    cleanses: 0,
    turnsLived: 0,
    shieldTurns: 0,
    firstStrikes: 0,
    stunsApplied: 0,
  };
}

function resetAccumulators(u) {
  u.dmgDealt = 0;
  u.dmgTaken = 0;
  u.crits = 0;
  u.dodges = 0;
  u.burnTicksApplied = 0;
  u.reviveTriggered = false;
  u.healsPctAccum = 0;
  u.healEvents = 0;
  u.cleanses = 0;
  u.turnsLived = 0;
  u.shieldTurns = 0;
  u.firstStrikes = 0;
  u.stunsApplied = 0;
}

export function tickUltimateTurn(combatant, turnNumber = 1) {
  const u = combatant?.state?.ultimate;
  if (!u || !u.active || !u.ultDef) return;
  if (u.cooldown > 0) u.cooldown = Math.max(0, u.cooldown - 1);
  u.turnsLived += 1;
  if (Number(combatant.shield || 0) > 0) u.shieldTurns += 1;
  if (turnNumber === 1) {
    u.firstStrikes += 1;
  }
}

export function recordUltimateCombatMetrics(actor, target, metrics = {}) {
  const au = actor?.state?.ultimate;
  const tu = target?.state?.ultimate;
  if (au && au.active) {
    if (metrics.damageDealt > 0) au.dmgDealt += Number(metrics.damageDealt);
    if (metrics.isCrit) au.crits += 1;
    if (metrics.burnApplied) au.burnTicksApplied += 1;
    if (metrics.stunApplied) au.stunsApplied += 1;
    if (metrics.healPct > 0 || metrics.healed) {
      au.healsPctAccum += Number(metrics.healPct || 0);
      au.healEvents += 1;
    }
    if (metrics.cleanses > 0) au.cleanses += Number(metrics.cleanses);
    if (metrics.firstStrike) au.firstStrikes += 1;
  }
  if (tu && tu.active) {
    if (metrics.damageDealt > 0) tu.dmgTaken += Number(metrics.damageDealt);
    if (metrics.dodgedByTarget) tu.dodges += 1;
    if (metrics.reviveTriggered) tu.reviveTriggered = true;
  }
}

export function isUltimateReadyToFire(actor, target) {
  const u = actor?.state?.ultimate;
  if (!u || !u.active || !u.ultDef || u.cooldown > 0) return false;
  if (!actor || actor.currentHp <= 0 || !target || target.currentHp <= 0) return false;

  const tr = u.ultDef.trigger || {};
  const maxHp = Math.max(1, Number(actor.maxHp || 1000));
  const targetMaxHp = Math.max(1, Number(target.maxHp || 1000));

  switch (tr.kind) {
    case 'dmgDealtAndTaken':
      return (u.dmgDealt + u.dmgTaken) >= maxHp * Number(tr.pctMaxHp || 2.0);
    case 'burnStacksOrRevive':
      return u.burnTicksApplied >= Number(tr.stacks || 3) || u.reviveTriggered;
    case 'critsOrDmgDealt':
      return u.crits >= Number(tr.crits || 3) || u.dmgDealt >= maxHp * Number(tr.pctMaxHp || 2.0);
    case 'dmgTaken':
      return u.dmgTaken >= maxHp * Number(tr.pctMaxHp || 1.2);
    case 'turnsOrDodges':
      return u.turnsLived >= Number(tr.turns || 3) || u.dodges >= Number(tr.dodges || 2);
    case 'healsOrCleanses':
      return (u.healEvents + u.cleanses) >= Number(tr.count || tr.cleanses || 3)
        || u.healsPctAccum >= Number(tr.pctMaxHp || 0.5);
    case 'dmgOrLowEnemyHp':
      return u.dmgDealt >= maxHp * Number(tr.pctMaxHp || 1.6)
        || (target.currentHp / targetMaxHp) <= Number(tr.enemyHpLt ?? tr.enemyHpBelow ?? 0.45);
    case 'shieldTurnsOrHeal':
      return u.shieldTurns >= Number(tr.turns || 3)
        || u.healsPctAccum >= Number(tr.healPctMaxHp || 0.8);
    case 'firstStrikesOrStuns':
      return (u.stunsApplied + u.firstStrikes) >= Number(tr.count || 2);
    default:
      return u.dmgDealt >= maxHp * 1.5;
  }
}

/**
 * Thử kích hoạt Skill Ultimate nếu đủ điều kiện & hết cooldown.
 * @returns {{ triggered: boolean, ultimateName?: string, damage?: number, shieldAbsorbed?: number, healAmt?: number, logs?: string[], ko?: boolean }}
 */
export function tryTriggerUltimate(actor, target, options = {}) {
  if (!isUltimateReadyToFire(actor, target)) {
    return { triggered: false };
  }

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const u = actor.state.ultimate;
  const def = u.ultDef;
  const ef = def.effect || {};
  const logs = [];
  let totalDamage = 0;
  let totalShieldAbsorbed = 0;
  let totalHeal = 0;

  // 1. Sát thương chuẩn theo % MaxHP địch (bỏ qua DEF/Khiên)
  if (ef.trueMaxHpDmgPct > 0) {
    const resist = getTrueDamageResistPct(target);
    const dmg = Math.max(100, Math.floor(target.maxHp * Number(ef.trueMaxHpDmgPct) * (1 - resist)));
    target.currentHp = Math.max(0, target.currentHp - dmg);
    totalDamage += dmg;
    logs.push(`ST Chuẩn -${dmg.toLocaleString('vi-VN')} HP`);
  }

  // 2. Sát thương theo % ATK (có thể xuyên DEF & Khiên)
  if (ef.atkDmgPct > 0 && target.currentHp > 0) {
    const baseDmg = Math.floor(Number(actor.atk || 500) * Number(ef.atkDmgPct));
    const dmgRed = ef.ignoreDmgRed ? 0 : Math.min(0.65, Number(target.state?.damageReductionPct || 0));
    const finalRaw = Math.max(120, Math.floor(baseDmg * (1 - dmgRed)));
    const pierce = Math.min(1, Math.max(0, Number(ef.shieldPierce || 0)));
    const bypass = Math.floor(finalRaw * pierce);
    const shieldPart = Math.max(0, finalRaw - bypass);
    let absorbed = 0;
    let intoHp = bypass;
    if (shieldPart > 0) {
      if (Number(target.shield || 0) >= shieldPart) {
        target.shield -= shieldPart;
        absorbed = shieldPart;
      } else {
        absorbed = Math.max(0, Number(target.shield || 0));
        intoHp += shieldPart - absorbed;
        target.shield = 0;
      }
    }
    target.currentHp = Math.max(0, target.currentHp - intoHp);
    totalDamage += intoHp;
    totalShieldAbsorbed += absorbed;
    logs.push(`-${intoHp.toLocaleString('vi-VN')} HP${absorbed > 0 ? ` *(khiên chặn ${absorbed.toLocaleString('vi-VN')})*` : ''}`);
  }

  // 3. Rút % HP hiện tại của địch (hút máu)
  if (ef.drainEnemyCurrHpPct > 0 && target.currentHp > 0) {
    const drain = Math.max(80, Math.floor(target.currentHp * Number(ef.drainEnemyCurrHpPct)));
    target.currentHp = Math.max(0, target.currentHp - drain);
    totalDamage += drain;
    const healed = applyHeal(actor, drain);
    totalHeal += healed;
    logs.push(`Hút Hồn -${drain.toLocaleString('vi-VN')} HP`);
  }

  // 4. Hồi máu & Hồi theo % HP đã mất
  if (ef.healMaxHpPct > 0 && actor.currentHp > 0) {
    const healed = applyHeal(actor, actor.maxHp * Number(ef.healMaxHpPct));
    if (healed > 0) {
      totalHeal += healed;
      logs.push(`Hồi +${healed.toLocaleString('vi-VN')} HP`);
    }
  }
  if (ef.restoreMissingHpPct > 0 && actor.currentHp > 0) {
    const missing = Math.max(0, actor.maxHp - actor.currentHp);
    const healed = applyHeal(actor, missing * Number(ef.restoreMissingHpPct));
    if (healed > 0) {
      totalHeal += healed;
      logs.push(`Phục Sinh +${healed.toLocaleString('vi-VN')} HP`);
    }
  }

  // 5. Tạo Khiên % MaxHP bản thân
  if (ef.shieldMaxHpPct > 0 && actor.currentHp > 0) {
    const sh = Math.round(actor.maxHp * Number(ef.shieldMaxHpPct));
    actor.shield = Math.max(0, Number(actor.shield || 0) + sh);
    logs.push(`+${sh.toLocaleString('vi-VN')} Khiên`);
  }

  // 6. Thanh tẩy toàn bộ debuff bản thân (dùng cleanseCombatantDebuffs thống nhất!)
  if (ef.cleanseAll && actor.currentHp > 0) {
    cleanseCombatantDebuffs(actor, 99);
    logs.push('Thanh Tẩy Toàn Bộ Debuff');
  }

  // 7. Giảm sát thương nhận vào
  if (ef.dmgRedPct > 0 && actor.currentHp > 0) {
    actor.state.damageReductionPct = Math.max(Number(actor.state.damageReductionPct || 0), Number(ef.dmgRedPct));
    actor.state.damageReductionTurns = Math.max(Number(actor.state.damageReductionTurns || 0), Number(ef.dmgRedTurns || 2));
    logs.push(`Giảm ${Math.round(ef.dmgRedPct * 100)}% ST (${ef.dmgRedTurns || 2}h)`);
  }

  // 8. Xóa buff địch (Strip all enemy buffs / shield)
  if (ef.stripAllBuffs && target.currentHp > 0) {
    target.shield = 0;
    if (target.state) {
      target.state.atkStacks = 0;
      target.state.defStacks = 0;
      target.state.damageReductionTurns = 0;
      target.state.damageReductionPct = 0;
      target.state.earlySpdBonusTurns = 0;
      target.state.stunImmuneTurns = 0;
    }
    logs.push('Xóa Sạch Buff Địch');
  }

  // 9. Tích tầng Linh Mạch (nếu có Domain Runtime)
  if (ef.addLinhMach > 0 && actor.domainRuntime?.own) {
    actor.domainRuntime.own.linhMachCount = Math.min(5, Number(actor.domainRuntime.own.linhMachCount || 0) + Number(ef.addLinhMach));
    logs.push(`+${ef.addLinhMach} Linh Mạch`);
  }

  // 10. Debuff địch: Giảm DEF, Đóng Băng, Choáng, Thiêu Đốt, Trúng Độc, Giảm Hồi Máu, Cướp SPD
  if (target.currentHp > 0 && target.state) {
    if (ef.defDebuffPct > 0) {
      target.state.defDebuffPct = Math.max(Number(target.state.defDebuffPct || 0), Number(ef.defDebuffPct));
      target.state.defDebuffTurns = Math.max(Number(target.state.defDebuffTurns || 0), Number(ef.defDebuffTurns || 2));
      logs.push(`Giảm ${Math.round(ef.defDebuffPct * 100)}% DEF`);
    }
    if (ef.freezeTurns > 0) {
      target.state.isStunned = true;
      logs.push('Đóng Băng (Mất Lượt)');
    }
    if (ef.stunChance > 0 && rng() < Number(ef.stunChance)) {
      target.state.isStunned = true;
      logs.push('Choáng Lôi Phạt');
    }
    if (ef.burnPct > 0) {
      target.state.burnPct = Math.max(Number(target.state.burnPct || 0), Number(ef.burnPct));
      target.state.burnTurns = Math.max(Number(target.state.burnTurns || 0), Number(ef.burnTurns || 2));
      target.state.burnIgnoresShield = true;
      logs.push(`Thiêu Đốt ${Math.round(ef.burnPct * 100)}% MaxHP`);
    }
    if (ef.poisonPct > 0) {
      target.state.poisonActive = true;
      target.state.poisonPct = Math.max(Number(target.state.poisonPct || 0), Number(ef.poisonPct));
      target.state.poisonTurns = Math.max(Number(target.state.poisonTurns || 0), Number(ef.poisonTurns || 2));
      logs.push(`Trúng Độc ${Math.round(ef.poisonPct * 100)}%`);
    }
    if (ef.healReductionPct > 0) {
      target.state.healReductionPct = Math.max(Number(target.state.healReductionPct || 0), Number(ef.healReductionPct));
      target.state.healReductionTurns = Math.max(Number(target.state.healReductionTurns || 0), Number(ef.healReductionTurns || 2));
      logs.push(`Giảm ${Math.round(ef.healReductionPct * 100)}% Hồi Máu`);
    }
    if (ef.spdStealPct > 0) {
      const stealAmt = Math.round(Number(target.baseSpd || target.spd || 300) * Number(ef.spdStealPct));
      target.spd = Math.max(50, Number(target.spd || 300) - stealAmt);
      actor.spd = Number(actor.spd || 300) + stealAmt;
      logs.push(`Cướp ${Math.round(ef.spdStealPct * 100)}% SPD`);
    }
  }

  // Check Lethal Interception nếu target về 0 HP sau Ultimate
  if (target.currentHp <= 0) {
    const li = triggerLethalInterception(target, actor, rng);
    if (li?.survived && li.skill) {
      logs.push(li.skill);
    }
  }

  u.triggerCount += 1;
  u.cooldown = Math.max(1, Number(def.cooldownTurns || 4));
  resetAccumulators(u);

  return {
    triggered: true,
    ultimateId: def.id,
    ultimateName: def.name,
    triggerCount: u.triggerCount,
    cooldownTurns: u.cooldown,
    damage: totalDamage,
    shieldAbsorbed: totalShieldAbsorbed,
    healAmt: totalHeal,
    logs,
    ko: target.currentHp === 0,
  };
}
