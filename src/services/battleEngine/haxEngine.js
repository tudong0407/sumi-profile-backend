/**
 * src/services/battleEngine/haxEngine.js
 * Engine kích hoạt toàn bộ HAX & Nội Tại cho 41 Linh Thú và 65 Pháp Bảo Loadout (lookup theo ID chuẩn xác).
 * Đã sửa toàn bộ 5 lỗi kiểm toán HAX v1.1 & áp dụng Ma Trận Khắc Chế HAX vòng tròn.
 */

export function hasPet(combatant, petType) {
  if (!combatant || combatant.state?.haxLockedTurns > 0) return false;
  return String(combatant.petType || '').toLowerCase() === String(petType || '').toLowerCase();
}

export function hasItem(combatant, itemId) {
  if (!combatant || combatant.state?.haxLockedTurns > 0) return false;
  const target = String(itemId || '').toLowerCase();
  const eq = combatant.equipment || {};
  return (
    String(eq.weapon?.item_id || '').toLowerCase() === target
    || String(eq.gem?.item_id || '').toLowerCase() === target
    || String(eq.soul?.item_id || '').toLowerCase() === target
  );
}

/**
 * Kiểm tra khả năng miễn nhiễm Khống Chế (Quang Minh Thánh Thú hoặc Tinh Tú Huyền Nữ Hồn)
 */
export function isControlImmune(combatant, kind = 'cc') {
  if (!combatant) return false;
  // Quang Minh Thánh Thú luôn giữ Thánh Quang Hóa Giải (kể cả chống lại Khóa HAX từ Linh Miêu)
  if (String(combatant.petType || '').toLowerCase() === 'quang_minh_thanh_thu') return true;
  if (combatant.state?.haxLockedTurns > 0) return false;
  const eq = combatant.equipment || {};
  if (String(eq.soul?.item_id || '').toLowerCase() === 'soul_mythic_5') {
    return kind !== 'dot'; // Tinh Tú Huyền Nữ Hồn miễn Choáng/Đóng Băng/Mị Hoặc/Mù/Khóa HAX/Cướp Tốc
  }
  return false;
}

/**
 * Kiểm tra tỉ lệ kháng khống chế phụ (Thái Cực Bát Quái 50%, Bích Hải Triều Sinh 30%)
 */
function rollControlResist(target, rng, kind = 'cc') {
  if (isControlImmune(target, kind)) return { resisted: true, source: target.petType === 'quang_minh_thanh_thu' ? 'Thánh Quang Hóa Giải' : 'Tinh Quang Chúc Phúc' };
  if (hasItem(target, 'gem_epic_3') && rng() < 0.50) {
    return { resisted: true, source: 'Thái Cực Bát Quái Ngọc Bội (50%)' };
  }
  if ((kind === 'cc' || kind === 'slow') && hasItem(target, 'gem_rare_4') && rng() < 0.30) {
    return { resisted: true, source: 'Bích Hải Triều Sinh Châu (30%)' };
  }
  return { resisted: false, source: null };
}

function getDotResistance(target) {
  if (isControlImmune(target, 'dot')) return 1.0;
  if (hasPet(target, 'thanh_de_moc_long')) return 1.0;
  let resist = 0;
  if (hasItem(target, 'gem_epic_5')) resist += 0.35;
  if (hasItem(target, 'gem_common_2')) resist += 0.20;
  return Math.min(0.95, resist);
}

export function applyHeal(combatant, rawHeal) {
  if (!combatant || combatant.currentHp <= 0) return 0;
  let heal = Math.max(0, Math.floor(rawHeal));
  if (combatant.state?.healReductionTurns > 0 && combatant.state?.healReductionPct > 0) {
    heal = Math.floor(heal * Math.max(0, 1 - combatant.state.healReductionPct));
  }
  const before = combatant.currentHp;
  combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + heal);
  return combatant.currentHp - before;
}

export function hasHax(combatant, keyword) {
  if (!combatant) return false;
  if (combatant.state?.haxLockedTurns > 0 && !String(keyword).toLowerCase().includes('quang_minh')) return false;

  const kw = String(keyword).toLowerCase().trim();
  const { hax, petType, equipment } = combatant;

  if (petType && petType.toLowerCase().includes(kw)) return true;
  if (hax?.pet && String(hax.pet).toLowerCase().includes(kw)) return true;
  if (hax?.weapon && String(hax.weapon).toLowerCase().includes(kw)) return true;
  if (hax?.gem && String(hax.gem).toLowerCase().includes(kw)) return true;
  if (hax?.soul && String(hax.soul).toLowerCase().includes(kw)) return true;
  for (const piece of [equipment?.weapon, equipment?.gem, equipment?.soul]) {
    if (!piece) continue;
    if (String(piece.item_id || '').toLowerCase().includes(kw)) return true;
    if (String(piece.item_name || '').toLowerCase().includes(kw)) return true;
    if (String(piece.hax_skill || '').toLowerCase().includes(kw)) return true;
  }
  return false;
}

function addShield(target, amount) {
  if (target.state.antiShieldTurns > 0) return 0;
  const val = Math.max(0, Math.floor(amount));
  target.shield = (target.shield || 0) + val;
  return val;
}

/**
 * Giai đoạn 1: Kích hoạt đầu trận (onBattleStart)
 */
export function triggerBattleStart(attacker, defender, rng) {
  const events = [];

  // 0. Linh Miêu Hoa Tiên: Gai Mộc Trói Chân (Khóa HAX 2 lượt đầu nếu địch không Miễn Nhiễm)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'linh_mieu_hoa_tien') || hasHax(actor, 'gai mộc trói chân')) {
      const res = rollControlResist(target, rng, 'lock');
      if (res.resisted) {
        events.push({
          actor: target.id,
          action: 'immune',
          skill: `${res.source} (Kháng Khóa HAX)`,
          desc: `${target.name} hóa giải Gai Mộc Trói Chân từ ${actor.name}!`,
        });
      } else {
        target.state.haxLockedTurns = 2;
        events.push({
          actor: actor.id,
          action: 'hax_start',
          skill: 'Gai Mộc Trói Chân',
          desc: `${actor.name} phong ấn kỹ năng HAX của ${target.name} trong 2 hiệp đầu!`,
        });
      }
    }
  }

  // 1. « Tru Tiên Diệt Thần Kiếm »: Khóa bất tử & xuyên khiên 3 lượt đầu
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'weapon_mythic_1') || hasHax(actor, 'tru tiên')) {
      target.state.antiImmortalityTurns = 3;
      target.state.antiShieldTurns = 3;
      target.shield = 0;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: '« Tru Tiên Diệt Thần Kiếm » Tuyệt Diệt Bất Tử',
        desc: `${actor.name} khai mở Tru Tiên Kiếm Trận, khóa Bất Tử & Khiên Chắn của ${target.name} trong 3 hiệp!`,
      });
    }
  }

  // 2. Các HAX tạo Khiên đầu trận (tôn trọng antiShieldTurns của Tru Tiên)
  for (const [actor] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'gem_mythic_3') || hasHax(actor, 'thiên hồ hóa thần')) {
      const gained = addShield(actor, actor.maxHp);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: '« Thiên Hồ Hóa Thần Ngọc » Thần Hồ Diễm Hộ', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasItem(actor, 'gem_mythic_5') || hasHax(actor, 'hỗn nguyên càn khôn')) {
      const gained = addShield(actor, actor.maxHp * 0.75);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: '« Hỗn Nguyên Càn Khôn Ấn » Càn Khôn Hộ Thể', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP & Chống Kết Liễu!` });
    }
    if (hasPet(actor, 'hoang_thien_ky_lan')) {
      const gained = addShield(actor, actor.maxHp * 0.65);
      if (gained > 0) {
        actor.state.shieldExplodePct = 0.20;
        events.push({ actor: actor.id, action: 'hax_start', skill: 'Bất Động Sơn Hà (Khiên 65% + Nổ)', desc: `${actor.name} nhận khiên 65% HP (${gained.toLocaleString('vi-VN')} HP)!` });
      }
    }
    if (hasPet(actor, 'hoang_tho_thach_su')) {
      const gained = addShield(actor, actor.maxHp * 0.40);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: 'Sơn Nhạc Bất Động (Khiên 40%)', desc: `${actor.name} nhận khiên 40% HP (${gained.toLocaleString('vi-VN')} HP)!` });
    }
    if (hasPet(actor, 'thao_moc_linh_vien') || hasHax(actor, 'đất mẹ che chở')) {
      const gained = addShield(actor, actor.maxHp * 0.25);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: 'Đất Mẹ Che Chở (Khiên 25%)', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasPet(actor, 'nguyet_anh_thao_tho')) {
      const gained = addShield(actor, actor.maxHp * 0.10);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: 'Ánh Trăng Dịu Êm (Khiên 10% +8% Crit)', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasItem(actor, 'gem_rare_3')) {
      const gained = addShield(actor, 800);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: 'Tử Kim Thần Thuẫn Thạch (+800 Khiên)', desc: `${actor.name} nhận khiên +800 HP!` });
    }
    if (hasItem(actor, 'gem_common_5')) {
      const gained = addShield(actor, 350);
      if (gained > 0) events.push({ actor: actor.id, action: 'hax_start', skill: 'Bạch Ngọc Hộ Phù (+350 Khiên)', desc: `${actor.name} nhận khiên +350 HP!` });
    }
  }

  // 3. Cửu Thiên Lôi Đình: Cướp 40% SPD thành ATK (bị Miễn Nhiễm khắc)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'weapon_mythic_2') || hasHax(actor, 'cửu thiên lôi đình')) {
      const res = rollControlResist(target, rng, 'steal');
      if (res.resisted) {
        events.push({ actor: target.id, action: 'immune', skill: `${res.source} (Chặn Cướp Tốc)`, desc: `${target.name} hóa giải Lôi Thần Trấn Áp!` });
      } else {
        const stolenSpd = Math.floor(target.spd * 0.40);
        target.spd = Math.max(10, target.spd - stolenSpd);
        actor.atk += stolenSpd;
        events.push({ actor: actor.id, action: 'hax_start', skill: '« Cửu Thiên Lôi Đình » Lôi Thần Trấn Áp', desc: `${actor.name} cướp ${stolenSpd} SPD của ${target.name} chuyển thành ATK!` });
      }
    }
  }

  // 4. Cửu Vĩ Hồng Hồ: Cửu Vĩ Hộ Thể (Bất tử 3 đòn đầu)
  for (const [actor] of [[attacker, defender], [defender, attacker]]) {
    if (actor.state.antiImmortalityTurns === 0 && (hasPet(actor, 'cuu_vi_hong_ho') || hasHax(actor, 'cửu vĩ hộ thể'))) {
      actor.state.isImmortalTurns = 3;
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)', desc: `${actor.name} kích hoạt Bất Tử 3 lượt & phản 100% sát thương!` });
    }
  }

  // 5. Kim Sí Điêu Hoàng: Mù Lòa Thái Dương (chỉ đúng 2 hiệp đầu - Bug #2 fixed!)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'kim_si_dieu_hoang') || hasHax(actor, 'mù lòa thái dương')) {
      const res = rollControlResist(target, rng, 'blind');
      if (res.resisted) {
        events.push({ actor: target.id, action: 'immune', skill: `${res.source} (Miễn Mù)`, desc: `${target.name} miễn nhiễm Mù Lòa Thái Dương!` });
      } else {
        target.state.blindTurns = 2;
        events.push({ actor: actor.id, action: 'hax_start', skill: 'Mù Lòa Thái Dương (2 Hiệp)', desc: `${target.name} bị làm chói mắt (55% trượt) trong 2 hiệp đầu!` });
      }
    }
  }

  // 6. Các hiệu ứng giảm chỉ số đầu trận (Hàn Giao Thủy Hồn, Băng Tinh Song Chủy, Hàn Băng Thần Châm, Giáp Sắt Kiên Cố)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'kim_giap_tue_lan')) {
      actor.state.damageReductionPct = Math.max(actor.state.damageReductionPct, 0.15);
      actor.state.damageReductionTurns = Math.max(actor.state.damageReductionTurns, 2);
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Giáp Sắt Kiên Cố (-15% ST 2 Hiệp)' });
    }
    if (hasItem(actor, 'soul_rare_5') && !isControlImmune(target, 'debuff')) {
      target.state.atkDebuffPct = Math.max(target.state.atkDebuffPct, 0.12);
      target.state.atkDebuffTurns = Math.max(target.state.atkDebuffTurns, 2);
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Hàn Giao Thủy Hồn (-12% ATK Địch 2 Hiệp)' });
    }
    if (hasItem(actor, 'weapon_common_6') && !isControlImmune(target, 'slow')) {
      target.state.spdDebuffPct = Math.max(target.state.spdDebuffPct, 0.05);
      target.state.spdDebuffTurns = Math.max(target.state.spdDebuffTurns, 2);
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Băng Tinh Song Chủy (-5% SPD 2 Hiệp)' });
    }
    if (hasItem(actor, 'weapon_rare_3') && !isControlImmune(target, 'slow')) {
      target.state.spdDebuffPct = Math.max(target.state.spdDebuffPct, 0.10);
      target.state.spdDebuffTurns = Math.max(target.state.spdDebuffTurns, 2);
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Hàn Băng Thần Châm (-10% SPD 2 Hiệp)' });
    }
    if (hasItem(actor, 'soul_epic_2') && getDotResistance(target) < 1) {
      target.state.poisonActive = true;
      target.state.poisonPct = Math.max(target.state.poisonPct, 0.08);
      events.push({ actor: actor.id, action: 'hax_start', skill: 'Cửu U Minh Xà Hồn (Độc 8% HP/Hiệp)' });
    }
  }

  return events;
}

/**
 * Giai đoạn 2: Kích hoạt đầu hiệp đấu (onTurnStart)
 */
export function triggerTurnStart(actor, target, rng, turnNumber = 1) {
  const result = {
    skipTurn: false,
    attackSelf: false,
    events: [],
  };

  actor.state.turnCount += 1;

  // Giảm bộ đếm thời hạn khi bước vào hiệp
  if (actor.state.antiImmortalityTurns > 0) actor.state.antiImmortalityTurns -= 1;
  if (actor.state.antiShieldTurns > 0) actor.state.antiShieldTurns -= 1;
  if (actor.state.haxLockedTurns > 0) actor.state.haxLockedTurns -= 1;
  if (actor.state.damageReductionTurns > 0) {
    actor.state.damageReductionTurns -= 1;
    if (actor.state.damageReductionTurns === 0) actor.state.damageReductionPct = 0;
  }
  if (actor.state.atkDebuffTurns > 0) {
    actor.state.atkDebuffTurns -= 1;
    if (actor.state.atkDebuffTurns === 0) actor.state.atkDebuffPct = 0;
  }
  if (actor.state.defDebuffTurns > 0) {
    actor.state.defDebuffTurns -= 1;
    if (actor.state.defDebuffTurns === 0) actor.state.defDebuffPct = 0;
  }
  if (actor.state.spdDebuffTurns > 0) {
    actor.state.spdDebuffTurns -= 1;
    if (actor.state.spdDebuffTurns === 0) actor.state.spdDebuffPct = 0;
  }
  if (actor.state.healReductionTurns > 0) {
    actor.state.healReductionTurns -= 1;
    if (actor.state.healReductionTurns === 0) actor.state.healReductionPct = 0;
  }
  if (actor.state.enemyDmgDebuffTurns > 0) {
    actor.state.enemyDmgDebuffTurns -= 1;
    if (actor.state.enemyDmgDebuffTurns === 0) actor.state.enemyDmgDebuffPct = 0;
  }

  // Cleanse mỗi hiệp (Bạch Ngọc Thiên Nga / Thánh Quang Kỳ Lân Hồn / Nguyệt Thần)
  if (hasPet(actor, 'bach_ngoc_thien_nga') || hasItem(actor, 'soul_epic_3')) {
    const cleansed = [];
    if (actor.state.isStunned) { actor.state.isStunned = false; cleansed.push('Choáng'); }
    else if (actor.state.blindTurns > 0) { actor.state.blindTurns = 0; cleansed.push('Mù'); }
    else if (actor.state.burnTurns > 0) { actor.state.burnTurns = 0; cleansed.push('Thiêu Đốt'); }
    else if (actor.state.atkDebuffTurns > 0) { actor.state.atkDebuffTurns = 0; actor.state.atkDebuffPct = 0; cleansed.push('Giảm ATK'); }
    else if (actor.state.defDebuffTurns > 0) { actor.state.defDebuffTurns = 0; actor.state.defDebuffPct = 0; cleansed.push('Phá Giáp'); }
    if (cleansed.length > 0) {
      result.events.push({ actor: actor.id, action: 'cleanse', skill: `Hóa Giải (${cleansed[0]})` });
    }
  }

  // Kiểm tra khống chế (Choáng / Đóng Băng / Hóa Đá)
  if (actor.state.isStunned) {
    if (isControlImmune(actor, 'cc')) {
      actor.state.isStunned = false;
      result.events.push({ actor: actor.id, action: 'immune', skill: 'Miễn Khống Chế' });
    } else {
      actor.state.isStunned = false;
      result.skipTurn = true;
      result.events.push({ actor: actor.id, action: 'turn_skip', skill: 'Bị Khống Chế (Mất Lượt)' });
      return result;
    }
  }

  // Hải Dương Tiên Ngư: Thanh Tẩy Linh Triều ở hiệp 1 và mỗi 3 hiệp (turn 1, 4, 7...)
  if (hasPet(actor, 'hai_duong_tien_ngu') && (turnNumber === 1 || (turnNumber - 1) % 3 === 0)) {
    let cleared = [];
    if (target.shield > 0) {
      target.shield = 0;
      cleared.push('Khiên');
    }
    if (target.state.atkStacks > 0) {
      target.state.atkStacks -= 1;
      target.atk = Math.max(50, Math.round(target.atk / 1.08));
      cleared.push('1 Buff ATK');
    } else if (target.state.defStacks > 0) {
      target.state.defStacks -= 1;
      target.def = Math.max(50, Math.round(target.def / 1.05));
      cleared.push('1 Buff DEF');
    } else if (target.state.damageReductionTurns > 0) {
      target.state.damageReductionTurns = 0;
      target.state.damageReductionPct = 0;
      cleared.push('Buff Giảm ST');
    }
    if (cleared.length > 0) {
      result.events.push({ actor: actor.id, action: 'cleanse', skill: `Thanh Tẩy Linh Triều (Xóa ${cleared.join(' + ')})` });
    }
  }

  // Hồi phục HP mỗi hiệp (Pet + Gem + Soul)
  let totalHealPct = 0;
  const healSources = [];
  if (hasPet(actor, 'thanh_truc_tien_loc')) { totalHealPct += 0.08; healSources.push('Linh Mộc 8%'); }
  if (hasPet(actor, 'thanh_long_au_xa')) {
    totalHealPct += 0.10;
    healSources.push('Trường Thanh 10%');
    if (actor.state.defStacks < 4) {
      actor.state.defStacks += 1;
      actor.def = Math.round(actor.def + actor.baseDef * 0.05);
    }
  }
  if (hasPet(actor, 'bach_ngoc_thien_nga')) { totalHealPct += 0.06; healSources.push('Thiên Nga 6%'); }
  if (hasPet(actor, 'thanh_de_moc_long')) {
    totalHealPct += 0.14;
    healSources.push('Thái Cổ 14%');
    if (actor.state.atkStacks < 5) {
      actor.state.atkStacks += 1;
      actor.atk = Math.round(actor.atk + actor.baseAtk * 0.08);
    }
  }
  if (hasItem(actor, 'gem_epic_5')) { totalHealPct += 0.09; healSources.push('Trường Sinh 9%'); }
  else if (hasItem(actor, 'gem_rare_2')) { totalHealPct += 0.05; healSources.push('Phù Dung 5%'); }
  else if (hasItem(actor, 'gem_common_1')) { totalHealPct += 0.03; healSources.push('Thanh Linh 3%'); }
  else if (hasItem(actor, 'gem_common_4')) { totalHealPct += 0.02; healSources.push('Lam Thủy 2%'); }
  if (hasItem(actor, 'soul_mythic_5')) { totalHealPct += 0.10; healSources.push('Tinh Quang 10%'); }

  if (totalHealPct > 0) {
    const healed = applyHeal(actor, actor.maxHp * totalHealPct);
    if (healed > 0) {
      result.events.push({ actor: actor.id, action: 'heal', skill: `Hồi +${healed.toLocaleString('vi-VN')} HP (${healSources[0]})` });
    }
  }

  // Cộng dồn ATK của Thương Khung Thần Long Hồn (+5% ATK tối đa 5 tầng)
  if (hasItem(actor, 'soul_epic_1') && actor.state.atkStacks < 5) {
    actor.state.atkStacks += 1;
    actor.atk = Math.round(actor.atk + actor.baseAtk * 0.05);
  }

  // DoT từ Pet / Item đang kích hoạt trên target (Xích Xà Hỏa Long 7%, Cửu U Minh Xà 8%, Thái Dương Kim Ô 10% xuyên khiên)
  if (hasPet(actor, 'xich_xa_hoa_long') && getDotResistance(target) < 1) {
    const res = getDotResistance(target);
    const dmg = Math.floor(target.maxHp * 0.07 * (1 - res));
    target.currentHp = Math.max(1, target.currentHp - dmg);
    result.events.push({ actor: actor.id, action: 'dot', skill: `Hỏa Độc Huyết (-${dmg.toLocaleString('vi-VN')} HP)` });
  }
  if (hasPet(actor, 'thai_duong_kim_o') && getDotResistance(target) < 1) {
    const res = getDotResistance(target);
    const dmg = Math.floor(target.maxHp * 0.10 * (1 - res));
    // Thái Dương Kim Ô: thiêu đốt 10% HP tối đa bỏ qua khiên
    target.currentHp = Math.max(1, target.currentHp - dmg);
    result.events.push({ actor: actor.id, action: 'dot', skill: `Chân Hỏa Phần Thiên (-${dmg.toLocaleString('vi-VN')} HP xuyên khiên)` });
  }
  if (actor.state.poisonActive && actor.state.poisonPct > 0 && getDotResistance(actor) < 1) {
    const res = getDotResistance(actor);
    const dmg = Math.floor(actor.maxHp * actor.state.poisonPct * (1 - res));
    actor.currentHp = Math.max(1, actor.currentHp - dmg);
    result.events.push({ actor: actor.id, action: 'dot', skill: `Trúng Độc (-${dmg.toLocaleString('vi-VN')} HP)` });
  }
  if (actor.state.burnTurns > 0 && actor.state.burnPct > 0) {
    actor.state.burnTurns -= 1;
    if (getDotResistance(actor) < 1) {
      const res = getDotResistance(actor);
      const dmg = Math.floor(actor.maxHp * actor.state.burnPct * (1 - res));
      actor.currentHp = Math.max(1, actor.currentHp - dmg);
      result.events.push({ actor: actor.id, action: 'dot', skill: `Thiêu Đốt (-${dmg.toLocaleString('vi-VN')} HP)` });
    }
  }

  // Mị Hoặc Chúng Sinh (soul_mythic_1): 40% tự đánh bản thân
  if (hasItem(target, 'soul_mythic_1')) {
    const res = rollControlResist(actor, rng, 'charm');
    if (!res.resisted && rng() < 0.40) {
      result.attackSelf = true;
      result.events.push({ actor: actor.id, action: 'charm', skill: 'Mị Hoặc Chúng Sinh (Tự Đánh Bản Thân)' });
      return result;
    }
  }

  // Hư Không Hỗn Loạn (tinh_khong_da_thao): 35% tự đánh bản thân
  if (hasPet(target, 'tinh_khong_da_thao')) {
    const res = rollControlResist(actor, rng, 'charm');
    if (!res.resisted && rng() < 0.35) {
      result.attackSelf = true;
      result.events.push({ actor: actor.id, action: 'confusion', skill: 'Hư Không Hỗn Loạn (Tự Đánh Bản Thân)' });
      return result;
    }
  }

  // « Thái Sơ Thời Không Ma Thần Hồn » (soul_mythic_2): Thời Không Đình Chỉ (đi 2 lượt 1 lần/trận)
  if (!actor.state.doubleTurnUsed && hasItem(actor, 'soul_mythic_2')) {
    actor.state.doubleTurnUsed = true;
    actor.state.isDoubleTurn = true;
    result.events.push({ actor: actor.id, action: 'double_turn', skill: 'Thời Không Đình Chỉ (2 Lượt Liên Hoàn)' });
  }

  return result;
}

/**
 * Giai đoạn 3: Tính toán ra đòn (onAttack)
 */
export function triggerAttackPhase(actor, target, baseDamage, rng, elemData = { multiplier: 1, isTrueDamage: false }) {
  const haxNotes = [];
  let isMiss = false;
  let isDodged = false;

  // 1. Kiểm tra Mù Lòa Thái Dương (chỉ active khi actor.state.blindTurns > 0 -> 2 hiệp đầu!)
  if (actor.state.blindTurns > 0) {
    actor.state.blindTurns -= 1;
    if (!isControlImmune(actor, 'blind') && rng() < 0.55) {
      isMiss = true;
      return {
        damage: 0,
        isCrit: false,
        isMiss: true,
        isDodged: false,
        shieldPiercePct: 0,
        lifestealPct: 0,
        instantExecute: false,
        haxTriggered: 'Mù Lòa Thái Dương (Đánh Trượt)',
      };
    }
  }

  // 2. Tính tổng Né Tránh của target
  let dodgeChance = 0;
  if (hasPet(target, 'thai_am_ngoc_tho')) dodgeChance += 0.30;
  if (hasPet(target, 'phong_vu_tieu_tuoc')) dodgeChance += 0.12;
  if (hasItem(target, 'soul_epic_5')) dodgeChance += 0.25;
  if (hasItem(target, 'weapon_rare_4')) dodgeChance += 0.10;
  if (hasItem(target, 'soul_common_2')) dodgeChance += 0.05;
  dodgeChance = Math.min(0.65, dodgeChance);

  let triggerCounter = false;
  if (dodgeChance > 0 && rng() < dodgeChance) {
    isDodged = true;
    const counterTrigger = hasPet(target, 'thai_am_ngoc_tho');
    if (hasItem(target, 'soul_epic_5')) target.state.nextHitBonusPct += 15;
    if (counterTrigger) triggerCounter = true;
    return {
      damage: 0,
      isCrit: false,
      isMiss: true,
      isDodged: true,
      triggerCounter,
      shieldPiercePct: 0,
      lifestealPct: 0,
      instantExecute: false,
      haxTriggered: counterTrigger ? 'Nguyệt Hoa Huyễn Cảnh (Né & Phản Công)' : 'Thân Pháp Né Đòn',
    };
  }

  // 3. Áp dụng debuff ATK/DEF & Xuyên Giáp tích hợp từ Pet + Vũ Khí
  const effectiveAtk = Math.max(50, Math.round(actor.atk * (1 - (actor.state.atkDebuffPct || 0))));
  const baseDefTarget = elemData.isTrueDamage ? 0 : Math.max(0, Math.round(target.def * (1 - (target.state.defDebuffPct || 0))));

  let defPiercePct = 0;
  if (hasPet(actor, 'thai_duong_kim_o')) { defPiercePct += 0.65; haxNotes.push('Xuyên Giáp 65%'); }
  else if (hasPet(actor, 'hoa_diem_ho')) { defPiercePct += 0.50; haxNotes.push('Thiêu Hồn Xuyên 50% Giáp'); }
  else if (hasPet(actor, 'bach_kim_ho_tu')) { defPiercePct += 0.35; haxNotes.push('Phá Giáp Trảm 35%'); }

  if (hasItem(actor, 'weapon_mythic_4')) { defPiercePct += 0.55; haxNotes.push('Phần Thiên Xuyên 55% Giáp'); }
  else if (hasItem(actor, 'weapon_epic_4')) { defPiercePct += 0.30; haxNotes.push('Trảm Tiên Xuyên 30% Giáp'); }
  else if (hasItem(actor, 'weapon_rare_6')) { defPiercePct += 0.18; haxNotes.push('Trảm Mã Xuyên 18% Giáp'); }
  else if (hasItem(actor, 'weapon_common_4')) { defPiercePct += 0.10; }

  const isCrit = rng() < actor.critRate;
  if (isCrit && hasPet(actor, 'tu_kim_bach_trach')) {
    defPiercePct += 0.45;
    haxNotes.push('Thiên Cơ Crit Xuyên 45% Giáp');
  }
  defPiercePct = Math.min(0.90, defPiercePct);

  const effectiveTargetDef = Math.floor(baseDefTarget * (1 - defPiercePct));
  let damage = Math.max(50, Math.floor(((effectiveAtk * 1.5) - (effectiveTargetDef * 0.5)) * (elemData.multiplier || 1)));

  // 4. Buff sát thương có điều kiện
  if (!actor.state.firstStrikeDone && hasItem(actor, 'weapon_common_5')) {
    damage = Math.floor(damage * 1.15);
    haxNotes.push('Đòn Đầu +15% ST');
  }
  if (!actor.state.firstStrikeDone && hasItem(actor, 'soul_rare_1')) {
    damage = Math.floor(damage * 1.15);
    haxNotes.push('Tấn Lôi Tiên Phát +15% ST');
  }
  actor.state.firstStrikeDone = true;

  if (hasItem(actor, 'weapon_common_2') && actor.spd > target.spd) damage = Math.floor(damage * 1.08);
  if (hasItem(actor, 'soul_common_1') && actor.spd >= target.spd) damage = Math.floor(damage * 1.06);
  if (hasItem(actor, 'weapon_common_3') && rng() < 0.15) {
    damage += Math.floor(effectiveAtk * 0.25);
    haxNotes.push('Song Đao Liên Kích');
  }
  if (actor.state.nextHitBonusPct > 0) {
    damage = Math.floor(damage * (1 + actor.state.nextHitBonusPct / 100));
    haxNotes.push(`Phản Kích +${actor.state.nextHitBonusPct}% ST`);
    actor.state.nextHitBonusPct = 0;
  }

  if (hasPet(actor, 'viem_nguc_khuyen') && actor.currentHp < actor.maxHp * 0.35) {
    damage = Math.floor(damage * 1.75);
    haxNotes.push('Cuồng Nộ ×1.75');
  }
  if (hasPet(actor, 'huyet_nguyet_linh_dieu') && target.currentHp < target.maxHp * 0.50) {
    damage = Math.floor(damage * 1.30);
    haxNotes.push('Huyết Ấn +30% ST');
  }
  if (hasItem(actor, 'soul_rare_3') && actor.currentHp < actor.maxHp * 0.50) {
    damage = Math.floor(damage * 1.20);
    haxNotes.push('Cuồng Bạo +20% ST');
  }
  if (hasPet(actor, 'man_da_la_linh_thu')) {
    const drain = Math.floor(target.currentHp * 0.15);
    damage += drain;
    const healed = applyHeal(actor, drain);
    haxNotes.push(`Ký Sinh (+${healed.toLocaleString('vi-VN')} HP)`);
  }

  // Giảm ST đầu ra từ Nguyệt Ảnh Lưu Ly Cầm
  if (actor.state.enemyDmgDebuffTurns > 0 && actor.state.enemyDmgDebuffPct > 0) {
    damage = Math.floor(damage * (1 - actor.state.enemyDmgDebuffPct));
  }

  // Bạo kích
  if (isCrit) {
    let critMultiplier = hasItem(actor, 'weapon_epic_2') ? 2.2 : 1.5;
    if (hasPet(target, 'han_bang_ky_lan')) critMultiplier = Math.max(1.1, critMultiplier * 0.55 + 0.45 * 0.55); // giảm ~45% crit dmg
    else if (hasItem(target, 'gem_rare_1')) critMultiplier = Math.max(1.15, critMultiplier - 0.15);
    damage = Math.floor(damage * critMultiplier);
  }

  // 5. Xuyên khiên & Phá khiên
  let shieldPiercePct = 0;
  if (actor.state.antiShieldTurns > 0 && hasItem(actor, 'weapon_mythic_1')) {
    shieldPiercePct = 1.0;
    haxNotes.push('Tru Tiên Xuyên 100% Khiên');
  } else if (hasItem(actor, 'weapon_epic_5')) {
    shieldPiercePct = 0.25;
  }
  if (hasPet(actor, 'dia_long_nham_vuong')) {
    if (target.shield > 0) {
      target.shield = Math.floor(target.shield * 0.50);
      haxNotes.push('Địa Chấn Phá 50% Khiên');
    }
    if (!isControlImmune(target, 'debuff')) {
      target.state.defDebuffPct = Math.max(target.state.defDebuffPct, 0.20);
      target.state.defDebuffTurns = Math.max(target.state.defDebuffTurns, 2);
    }
  }

  // 6. Áp dụng hiệu ứng lên mục tiêu (Stun, Burn, Heal Reduction, EnemyDmgDebuff)
  if (hasPet(actor, 'bang_tuyet_ho') || hasItem(actor, 'weapon_epic_3')) {
    if (rng() < 0.25) {
      const res = rollControlResist(target, rng, 'cc');
      if (!res.resisted) { target.state.isStunned = true; haxNotes.push('Đóng Băng 25%'); }
    }
  }
  if (hasPet(actor, 'tu_dien_linh_ung') || hasItem(actor, 'weapon_epic_5')) {
    if (rng() < 0.25) {
      const res = rollControlResist(target, rng, 'cc');
      if (!res.resisted) { target.state.isStunned = true; haxNotes.push('Choáng 25%'); }
    }
  }
  if (hasItem(actor, 'weapon_rare_1') && rng() < 0.15) {
    const res = rollControlResist(target, rng, 'cc');
    if (!res.resisted) { target.state.isStunned = true; haxNotes.push('Tê Liệt 15%'); }
  }
  if (hasItem(actor, 'soul_rare_4') && rng() < 0.15) {
    const res = rollControlResist(target, rng, 'cc');
    if (!res.resisted) { target.state.isStunned = true; haxNotes.push('Ru Ngủ 15%'); }
  }
  if (hasPet(actor, 'hoa_linh_tieu_ho')) {
    target.state.burnPct = Math.max(target.state.burnPct, 0.04);
    target.state.burnTurns = Math.max(target.state.burnTurns, 2);
    haxNotes.push('Đốm Lửa Đốt 4%');
  }
  if (hasItem(actor, 'weapon_rare_2')) {
    target.state.burnPct = Math.max(target.state.burnPct, 0.05);
    target.state.burnTurns = Math.max(target.state.burnTurns, 2);
  }
  if (hasItem(actor, 'weapon_mythic_4')) {
    target.state.burnPct = Math.max(target.state.burnPct, 0.08);
    target.state.burnTurns = Math.max(target.state.burnTurns, 2);
    haxNotes.push('Phần Thiên Đốt 8%');
  }
  if (hasPet(actor, 'minh_gioi_u_ho') && !isControlImmune(target, 'debuff')) {
    target.state.healReductionPct = Math.max(target.state.healReductionPct, 0.40);
    target.state.healReductionTurns = Math.max(target.state.healReductionTurns, 3);
  }
  if (hasItem(actor, 'weapon_epic_6') && !isControlImmune(target, 'debuff')) {
    target.state.enemyDmgDebuffPct = Math.max(target.state.enemyDmgDebuffPct, 0.18);
    target.state.enemyDmgDebuffTurns = Math.max(target.state.enemyDmgDebuffTurns, 2);
  }

  // 7. Lifesteal %
  let lifestealPct = 0;
  if (hasPet(actor, 'u_minh_tieu_mieu')) lifestealPct += 0.12;
  if (hasPet(actor, 'minh_gioi_u_ho')) lifestealPct += 0.22;
  if (hasItem(actor, 'weapon_epic_1')) lifestealPct += 0.15;
  if (hasItem(actor, 'weapon_mythic_5')) lifestealPct += 0.25;
  if (hasItem(actor, 'soul_rare_2')) lifestealPct += 0.10;
  if (hasItem(actor, 'soul_epic_4')) lifestealPct += 0.25;

  // 8. Tuyệt Mệnh Trảm / Đoạt Hồn Tịch Diệt (Instant Execute — bị Càn Khôn Ấn / Bất Tử Chu Tước Hồn chặn)
  let instantExecute = false;
  if (hasPet(actor, 'u_minh_lang_vuong') && target.currentHp < target.maxHp * 0.25 && rng() < 0.45) {
    instantExecute = true;
  } else if (hasItem(actor, 'weapon_mythic_5') && target.currentHp < target.maxHp * 0.20 && rng() < 0.40) {
    instantExecute = true;
  }

  if (instantExecute) {
    if (!target.state.executeBlockUsed && (hasItem(target, 'gem_mythic_5') || hasItem(target, 'soul_epic_6'))) {
      target.state.executeBlockUsed = true;
      instantExecute = false;
      haxNotes.push('Bị Chặn Kết Liễu Tức Thì');
    } else {
      damage = target.currentHp + (target.shield || 0);
      haxNotes.push('Kết Liễu Tức Thì');
    }
  }

  return {
    damage: Math.max(50, Math.floor(damage)),
    isCrit,
    isMiss: false,
    isDodged: false,
    shieldPiercePct,
    lifestealPct: Math.min(0.60, lifestealPct),
    instantExecute,
    haxTriggered: haxNotes.length > 0 ? haxNotes.join(' + ') : null,
  };
}

/**
 * Giai đoạn 4: Kích hoạt khi nhận sát thương (onDamageReceived)
 */
export function triggerDamageReceived(target, incomingDamage, attacker, rng) {
  let finalDamage = incomingDamage;
  let reflectedDamage = 0;
  const events = [];

  // 1. « Hồng Mông Hỗn Độn Trượng »: 35% đổi dmg thành hồi máu + phản 100%
  if (hasItem(target, 'weapon_mythic_3') && rng() < 0.35) {
    const healed = applyHeal(target, finalDamage);
    reflectedDamage = finalDamage;
    events.push({ actor: target.id, action: 'absorb_reflect', skill: `Hỗn Độn Nghịch Đảo (+${healed.toLocaleString('vi-VN')} HP & Phản 100%)` });
    return { finalDamage: 0, reflectedDamage, events };
  }

  // 2. Cửu Vĩ Hộ Thể: Bất tử & phản 100%
  if (target.state.isImmortalTurns > 0) {
    reflectedDamage += finalDamage;
    target.state.isImmortalTurns -= 1;
    events.push({ actor: target.id, action: 'reflect', skill: 'Cửu Vĩ Hộ Thể (Bất Tử & Phản 100%)' });
    return { finalDamage: 0, reflectedDamage, events };
  }

  // 3. Giảm sát thương nhận vào
  let dmgMult = 1.0;
  if (target.shield > 0 && hasItem(target, 'gem_mythic_3')) dmgMult *= 0.50;
  if (target.shield > 0 && hasPet(target, 'hoang_tho_thach_su')) dmgMult *= 0.80;
  if (target.state.damageReductionTurns > 0 && target.state.damageReductionPct > 0) dmgMult *= (1 - target.state.damageReductionPct);
  if (hasItem(target, 'gem_mythic_4')) dmgMult *= 0.70;
  else if (hasItem(target, 'gem_epic_1')) dmgMult *= 0.75;
  else if (hasItem(target, 'gem_common_3')) dmgMult *= 0.94;
  if (hasPet(target, 'huyen_vu_linh_quy')) dmgMult *= 0.75;
  if (hasPet(target, 'han_bang_ky_lan')) dmgMult *= 0.85;
  if (hasItem(target, 'soul_common_4')) dmgMult *= 0.95;
  if (target.element && (target.element.includes('Hỗn Độn') || target.element.includes('Hư Không'))) dmgMult *= 0.85;

  finalDamage = Math.max(0, Math.floor(finalDamage * dmgMult));

  // 4. Phản đòn
  if (hasItem(target, 'gem_mythic_2')) {
    reflectedDamage += Math.floor(finalDamage * 0.75);
    events.push({ actor: target.id, action: 'reflect', skill: 'Kính Hoa Thủy Nguyệt (Phản 75%)' });
  } else if (hasPet(target, 'huyen_vu_linh_quy')) {
    reflectedDamage += Math.floor(finalDamage * 0.35);
    events.push({ actor: target.id, action: 'reflect', skill: 'Huyền Vũ Phản 35%' });
  } else if (hasPet(target, 'thiet_giap_xich_giac')) {
    reflectedDamage += Math.floor(finalDamage * 0.30);
    events.push({ actor: target.id, action: 'reflect', skill: 'Phản Chấn 30%' });
  } else if (hasPet(target, 'thuy_tinh_huyen_ngao')) {
    reflectedDamage += Math.floor(finalDamage * 0.25);
    events.push({ actor: target.id, action: 'reflect', skill: 'Nghịch Lưu Phản 25%' });
  }
  if (hasItem(target, 'gem_epic_2')) {
    reflectedDamage += Math.floor(finalDamage * 0.30);
    events.push({ actor: target.id, action: 'reflect', skill: 'Hàn Băng Phản 30%' });
  }

  // 5. Hiệu ứng khống chế khi bị tấn công (Hóa Đá 20%, Hàn Băng Tuyệt Vực 25%, Lôi Linh Tinh Thạch 15%)
  if (hasPet(target, 'hoa_thach_nham_nham') && rng() < 0.20) {
    const res = rollControlResist(attacker, rng, 'cc');
    if (!res.resisted) {
      attacker.state.isStunned = true;
      events.push({ actor: target.id, action: 'petrify', skill: 'Hóa Đá (20%)' });
    }
  }
  if (hasItem(target, 'gem_mythic_4') && rng() < 0.25) {
    const res = rollControlResist(attacker, rng, 'cc');
    if (!res.resisted) {
      attacker.state.isStunned = true;
      events.push({ actor: target.id, action: 'freeze', skill: 'Hàn Băng Tuyệt Vực (Đóng Băng 25%)' });
    }
  }
  if (hasItem(target, 'gem_rare_5') && rng() < 0.15) {
    const res = rollControlResist(attacker, rng, 'slow');
    if (!res.resisted) {
      attacker.state.spdDebuffPct = Math.max(attacker.state.spdDebuffPct, 0.15);
      attacker.state.spdDebuffTurns = Math.max(attacker.state.spdDebuffTurns, 2);
      events.push({ actor: target.id, action: 'slow', skill: 'Lôi Linh Phản Giật (-15% SPD)' });
    }
  }

  return { finalDamage, reflectedDamage, events };
}

/**
 * Giai đoạn 4b: Kích hoạt NGAY SAU KHI nhận sát thương khi vẫn còn sống (Bug #4 fixed!)
 * Dùng cho: Luân Hồi Bất Diệt Chiến Hồn (<20% HP), Nguyệt Thần Bạch Vĩ Hồ (<35% HP), Phượng Hoàng Huyết Tinh (<30%), U Minh Hắc Diệu (<50%)
 */
export function triggerPostDamage(target, attacker) {
  const events = [];
  if (!target || target.currentHp <= 0) return events;

  const hpRatio = target.currentHp / target.maxHp;

  // « Luân Hồi Bất Diệt Chiến Hồn » (soul_mythic_3): Khi HP tụt dưới 20% (còn sống), hoán đổi % máu
  if (!target.state.hpSwapUsed && hpRatio < 0.20 && hasItem(target, 'soul_mythic_3')) {
    target.state.hpSwapUsed = true;
    const targetPct = target.currentHp / target.maxHp;
    const attackerPct = attacker.currentHp / attacker.maxHp;
    target.currentHp = Math.max(1, Math.floor(target.maxHp * attackerPct));
    attacker.currentHp = Math.max(1, Math.floor(attacker.maxHp * targetPct));
    events.push({
      actor: target.id,
      action: 'hp_swap',
      skill: `Sinh Mệnh Nghịch Chuyển (Đổi ${Math.round(targetPct * 100)}% ↔ ${Math.round(attackerPct * 100)}% HP)`,
    });
  }

  // Nguyệt Thần Bạch Vĩ Hồ: 1 lần/trận khi HP < 35%, giải hiệu ứng xấu, hồi 30% HP & thêm 1 lượt
  if (!target.state.phaseShiftUsed && (target.currentHp / target.maxHp) < 0.35 && hasPet(target, 'nguyet_than_cuu_vy_bach')) {
    target.state.phaseShiftUsed = true;
    target.state.isStunned = false;
    target.state.blindTurns = 0;
    target.state.burnTurns = 0;
    target.state.atkDebuffTurns = 0;
    target.state.atkDebuffPct = 0;
    target.state.defDebuffTurns = 0;
    target.state.defDebuffPct = 0;
    target.state.spdDebuffTurns = 0;
    target.state.spdDebuffPct = 0;
    const healed = applyHeal(target, target.maxHp * 0.30);
    target.state.isDoubleTurn = true;
    events.push({
      actor: target.id,
      action: 'phase_shift',
      skill: `Thời Không Hoán Ảnh (Giải + Hồi ${healed.toLocaleString('vi-VN')} HP + 1 Lượt)`,
    });
  }

  // Phượng Hoàng Huyết Tinh (gem_epic_4): Dưới 30% tự động hồi 35% HP (1 lần/trận)
  if (!target.state.phoenixGemHealUsed && (target.currentHp / target.maxHp) < 0.30 && hasItem(target, 'gem_epic_4')) {
    target.state.phoenixGemHealUsed = true;
    const healed = applyHeal(target, target.maxHp * 0.35);
    events.push({
      actor: target.id,
      action: 'heal',
      skill: `Phượng Hoàng Huyết Tinh (+${healed.toLocaleString('vi-VN')} HP)`,
    });
  }

  // U Minh Hắc Diệu Thạch (gem_epic_6): HP hoặc khiên giảm dưới 50% maxHp -> +20% ATK hết trận
  if (!target.state.enrageActive && ((target.currentHp + (target.shield || 0)) < target.maxHp * 0.50) && hasItem(target, 'gem_epic_6')) {
    target.state.enrageActive = true;
    target.atk = Math.round(target.atk * 1.20);
    events.push({
      actor: target.id,
      action: 'buff',
      skill: 'U Minh Hắc Diệu (+20% ATK Hết Trận)',
    });
  }

  return events;
}

/**
 * Giai đoạn 5: Kích hoạt khi chịu đòn chí mạng (onLethalDamage, currentHp <= 0)
 */
export function triggerLethalInterception(target, attacker, rng) {
  // 1. « Bất Hủ Thần Hoàng Ngọc »: Kim Thân Hộ Mệnh (Giữ 1 HP & miễn nhiễm 2 lượt)
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0 && hasItem(target, 'gem_mythic_1')) {
    target.state.cheatDeathUsed = true;
    target.currentHp = 1;
    target.state.isImmortalTurns = 2;
    return {
      survived: true,
      skill: '« Bất Hủ Thần Hoàng Ngọc » Kim Thân Hộ Mệnh',
      desc: `${target.name} kích hoạt Kim Thân Hộ Mệnh giữ 1 HP & Bất Tử 2 hiệp!`,
    };
  }

  // 2. Bất Tử Chu Tước Hồn (soul_epic_6): Chặn đòn chí tử 1 lần/trận giữ 20% HP
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0 && hasItem(target, 'soul_epic_6')) {
    target.state.cheatDeathUsed = true;
    target.currentHp = Math.max(1, Math.floor(target.maxHp * 0.20));
    return {
      survived: true,
      skill: 'Bất Tử Chu Tước Hồn (Giữ 20% HP)',
      desc: `${target.name} chặn đòn chí tử giữ lại ${target.currentHp.toLocaleString('vi-VN')} HP!`,
    };
  }

  // 3. Chu Tước Ấu Điểu: Niết Bàn Tái Sinh (Hồi sinh 55% HP 1 lần/trận)
  if (!target.state.reviveUsed && target.state.antiImmortalityTurns === 0 && hasPet(target, 'chu_tuoc_au_dieu')) {
    target.state.reviveUsed = true;
    target.currentHp = Math.max(1, Math.floor(target.maxHp * 0.55));
    return {
      survived: true,
      skill: 'Niết Bàn Tái Sinh (Hồi Sinh 55% HP)',
      desc: `${target.name} bốc cháy ngọn lửa Chu Tước, hồi sinh 55% HP (${target.currentHp.toLocaleString('vi-VN')} HP)!`,
    };
  }

  return { survived: false, skill: null, desc: null };
}
