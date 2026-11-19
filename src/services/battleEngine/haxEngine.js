/**
 * Engine kích hoạt kỹ năng HAX cho 21 Linh Thú và 9 Trang Bị Thần Thoại
 * Phân chia theo 5 giai đoạn vòng đời chiến đấu (Battle Lifecycle Phases):
 * 1. onBattleStart: Kích hoạt hiệu ứng đầu trận (Khiên, cướp Tốc, khóa Bất Tử, Tốc độ xuất chiêu)
 * 2. onTurnStart: Kích hoạt đầu hiệp (Hồi phục, Trúng độc DoT, Mị hoặc, Đóng băng, Hỗn loạn)
 * 3. onAttack: Kích hoạt khi xuất chiêu (Xuyên giáp, Đánh trượt, Cuồng nộ, Hút máu, Trảm quyết)
 * 4. onDamageReceived: Kích hoạt khi nhận sát thương (Phản đòn, Giảm sát thương, Khiên hộ thể, Hóa đá)
 * 5. onLethalDamage: Kích hoạt khi chịu đòn chí mạng (Bất tử, Hồi sinh Niết Bàn, Hoán đổi sinh mệnh)
 */

/**
 * Kiểm tra đấu sĩ có sở hữu kỹ năng HAX không (tính cả Pet và 3 món trang bị)
 */
export function hasHax(combatant, keyword) {
  if (!combatant) return false;
  if (combatant.state.haxLockedTurns > 0) return false;

  const kw = String(keyword).toLowerCase().trim();
  const { hax, petType } = combatant;

  if (petType && petType.toLowerCase().includes(kw)) return true;
  if (hax.pet && hax.pet.toLowerCase().includes(kw)) return true;
  if (hax.weapon && hax.weapon.toLowerCase().includes(kw)) return true;
  if (hax.gem && hax.gem.toLowerCase().includes(kw)) return true;
  if (hax.soul && hax.soul.toLowerCase().includes(kw)) return true;

  return false;
}

/**
 * Giai đoạn 1: Kích hoạt đầu trận (onBattleStart)
 */
export function triggerBattleStart(attacker, defender, rng) {
  const events = [];

  // 1. « Tru Tiên Diệt Thần Kiếm »: Tuyệt Diệt Bất Tử (Khóa bất tử & xuyên khiên 3 lượt đầu)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasHax(actor, 'tru tiên') || hasHax(actor, 'tuyệt diệt bất tử')) {
      target.state.antiImmortalityTurns = 3;
      target.shield = 0;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: '« Tru Tiên Diệt Thần Kiếm » Tuyệt Diệt Bất Tử',
        desc: `${actor.name} khai mở Tru Tiên Kiếm Trận, vô hiệu hóa hoàn toàn Bất Tử & Khiên Chắn của ${target.name} trong 3 lượt đầu!`,
      });
    }
  }

  // 2. « Thiên Hồ Hóa Thần Ngọc »: Thần Hồ Diễm Hộ (Tạo khiên = 100% max HP)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (actor.state.antiImmortalityTurns === 0 && (hasHax(actor, 'thiên hồ hóa thần') || hasHax(actor, 'thần hồ diễm hộ'))) {
      actor.shield = actor.maxHp;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: '« Thiên Hồ Hóa Thần Ngọc » Thần Hồ Diễm Hộ',
        desc: `${actor.name} triệu hồi Thiên Hồ Diễm Khiên bằng 100% máu (${actor.shield.toLocaleString()} HP)!`,
      });
    }
  }

  // 3. Thảo Mộc Linh Viên: Đất Mẹ Che Chở (+50% max HP shield)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (actor.state.antiImmortalityTurns === 0 && (hasHax(actor, 'thao_moc_linh_vien') || hasHax(actor, 'đất mẹ che chở'))) {
      actor.shield += Math.floor(actor.maxHp * 0.5);
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: 'Đất Mẹ Che Chở',
        desc: `${actor.name} nhận thêm lớp khiên Thảo Mộc trị giá ${Math.floor(actor.maxHp * 0.5).toLocaleString()} HP!`,
      });
    }
  }

  // 4. « Cửu Thiên Lôi Đình Cổ Thần Thương »: Lôi Thần Trấn Áp (Cướp 40% Tốc đối phương thành Công)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasHax(actor, 'cửu thiên lôi đình') || hasHax(actor, 'lôi thần trấn áp')) {
      const stolenSpd = Math.floor(target.spd * 0.4);
      target.spd = Math.max(10, target.spd - stolenSpd);
      actor.atk += stolenSpd;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: '« Cửu Thiên Lôi Đình Cổ Thần Thương » Lôi Thần Trấn Áp',
        desc: `${actor.name} tước đoạt ${stolenSpd} Tốc của ${target.name} chuyển hóa thành Sức Mạnh Tấn Công!`,
      });
    }
  }

  // 5. Cửu Vĩ Hồng Hồ: Cửu Vĩ Hộ Thể (Bất tử 3 đòn đầu)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (actor.state.antiImmortalityTurns === 0 && (hasHax(actor, 'cuu_vi_hong_ho') || hasHax(actor, 'cửu vĩ hộ thể'))) {
      actor.state.isImmortalTurns = 3;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
        desc: `${actor.name} kích hoạt Cửu Vĩ Hộ Thể: Bất tử 3 lượt và phản 100% sát thương gốc!`,
      });
    }
  }

  // 6. Linh Miêu Hoa Tiên: Gai Mộc Trói Chân (Khóa HAX 2 lượt)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasHax(actor, 'linh_mieu_hoa_tien') || hasHax(actor, 'gai mộc trói chân')) {
      target.state.haxLockedTurns = 2;
      events.push({
        actor: actor.id,
        action: 'hax_start',
        skill: 'Gai Mộc Trói Chân',
        desc: `${actor.name} phóng Gai Mộc phong ấn toàn bộ kỹ năng HAX của ${target.name} trong 2 hiệp!`,
      });
    }
  }

  return events;
}

/**
 * Giai đoạn 2: Kích hoạt đầu hiệp đấu (onTurnStart)
 */
export function triggerTurnStart(actor, target, rng) {
  const result = {
    skipTurn: false,
    attackSelf: false,
    events: [],
  };

  // Giảm thời hạn các hiệu ứng có thời hạn
  if (actor.state.antiImmortalityTurns > 0) actor.state.antiImmortalityTurns--;
  if (actor.state.haxLockedTurns > 0) actor.state.haxLockedTurns--;
  if (actor.state.missChanceTurns > 0) actor.state.missChanceTurns--;

  // Miễn nhiễm hoàn toàn nếu có Quang Minh Thánh Thú
  const isQuangMinh = hasHax(actor, 'quang_minh_thanh_thu') || hasHax(actor, 'thánh quang hóa giải');

  // Kiểm tra trạng thái bị khống chế (Choáng / Đóng Băng / Hóa Đá)
  if (actor.state.isStunned) {
    if (!isQuangMinh) {
      actor.state.isStunned = false;
      result.skipTurn = true;
      result.events.push({
        actor: actor.id,
        action: 'turn_skip',
        skill: 'Khống Chế',
        desc: `${actor.name} đang bị Đóng Băng / Hóa Đá, mất lượt hành động!`,
      });
      return result;
    }
    actor.state.isStunned = false;
  }

  // Thanh Tẩy Linh Triều (Hải Dương Tiên Ngư): Xóa bỏ khiên & buff của đối phương
  if (hasHax(actor, 'hai_duong_tien_ngu') || hasHax(actor, 'thanh tẩy linh triều')) {
    if (target.shield > 0) {
      target.shield = 0;
      result.events.push({
        actor: actor.id,
        action: 'cleanse',
        skill: 'Thanh Tẩy Linh Triều',
        desc: `${actor.name} dâng sóng Linh Triều cuốn phăng toàn bộ lớp khiên của ${target.name}!`,
      });
    }
  }

  // Linh Mộc Hồi Xuân (Thanh Trúc Tiên Lộc): Hồi 25% máu mỗi hiệp
  if (hasHax(actor, 'thanh_truc_tien_loc') || hasHax(actor, 'linh mộc hồi xuân')) {
    const heal = Math.floor(actor.maxHp * 0.25);
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
    result.events.push({
      actor: actor.id,
      action: 'heal',
      skill: 'Linh Mộc Hồi Xuân',
      desc: `${actor.name} hấp thụ tinh hoa đất trời, hồi phục ${heal.toLocaleString()} HP!`,
    });
  }

  // Hỏa Độc Huyết (Xích Xà Hỏa Long): Đối thủ mất 15% máu tối đa
  if (hasHax(actor, 'xich_xa_hoa_long') || hasHax(actor, 'hỏa độc huyết')) {
    if (!hasHax(target, 'quang_minh_thanh_thu')) {
      const poisonDmg = Math.floor(target.maxHp * 0.15);
      target.currentHp = Math.max(1, target.currentHp - poisonDmg);
      result.events.push({
        actor: actor.id,
        action: 'dot',
        skill: 'Hỏa Độc Huyết',
        desc: `${target.name} trúng Hỏa Độc Huyết, thiêu đốt mất ${poisonDmg.toLocaleString()} HP!`,
      });
    }
  }

  // « Cửu Vĩ Thiên Tiên Hồn »: Mị Hoặc Chúng Sinh (40% ép đối thủ tự đánh chính mình)
  if (hasHax(target, 'cửu vĩ thiên tiên hồn') || hasHax(target, 'mị hoặc chúng sinh')) {
    if (!isQuangMinh && rng() < 0.40) {
      result.attackSelf = true;
      result.events.push({
        actor: actor.id,
        action: 'charm',
        skill: '« Cửu Vĩ Thiên Tiên Hồn » Mị Hoặc Chúng Sinh',
        desc: `${actor.name} trúng ảo giác Mị Hoặc của Cửu Vĩ Thiên Tiên Hồn, mất kiểm soát tự tấn công bản thân!`,
      });
      return result;
    }
  }

  // Tinh Không Dạ Thao: Hư Không Hỗn Loạn (Gây hỗn loạn tự đánh)
  if (hasHax(target, 'tinh_khong_da_thao') || hasHax(target, 'hư không hỗn loạn')) {
    if (!isQuangMinh && rng() < 0.35) {
      result.attackSelf = true;
      result.events.push({
        actor: actor.id,
        action: 'confusion',
        skill: 'Hư Không Hỗn Loạn',
        desc: `${actor.name} bị cuốn vào dòng xoáy Hư Không, tâm trí điên loạn tự đả thương mình!`,
      });
      return result;
    }
  }

  // « Thái Sơ Thời Không Ma Thần Hồn »: Thời Không Đình Chỉ (Kích hoạt đi 2 lượt 1 lần)
  if (!actor.state.doubleTurnUsed && (hasHax(actor, 'thái sơ thời không') || hasHax(actor, 'thời không đình chỉ'))) {
    actor.state.doubleTurnUsed = true;
    actor.state.isDoubleTurn = true;
    result.events.push({
      actor: actor.id,
      action: 'double_turn',
      skill: '« Thái Sơ Thời Không Ma Thần Hồn » Thời Không Đình Chỉ',
      desc: `${actor.name} đóng băng thời gian! Giành thêm 1 lượt tấn công liên hoàn không gián đoạn!`,
    });
  }

  return result;
}

/**
 * Giai đoạn 3: Tính toán trước khi ra đòn (onAttack)
 */
export function triggerAttackPhase(actor, target, baseDamage, rng) {
  let damage = baseDamage;
  let isCrit = rng() < actor.critRate;
  let haxTriggered = null;
  let isMiss = false;

  // 1. Mù Lòa Thái Dương (Kim Sí Điêu Hoàng): 70% đánh trượt
  if (actor.state.missChanceTurns > 0 || hasHax(target, 'mù lòa thái dương')) {
    if (rng() < 0.70) {
      isMiss = true;
      haxTriggered = 'Mù Lòa Thái Dương (Đánh Trượt)';
      return { damage: 0, isCrit: false, isMiss: true, haxTriggered };
    }
  }

  // 2. Viêm Ngục Khuyển: Cuồng Nộ (Khi máu < 30%, sát thương gấp 3)
  if (hasHax(actor, 'viem_nguc_khuyen') || hasHax(actor, 'cuồng nộ')) {
    if (actor.currentHp < actor.maxHp * 0.30) {
      damage *= 3;
      haxTriggered = 'Cuồng Nộ (x3 Sát Thương)';
    }
  }

  // 3. Thiêu Hồn (Hỏa Diễm Hồ): Bỏ qua 50% giáp đối thủ
  if (hasHax(actor, 'hoa_diem_ho') || hasHax(actor, 'thiêu hồn')) {
    damage += Math.floor((target.def * 0.5) * 0.5);
    if (!haxTriggered) haxTriggered = 'Thiêu Hồn (Xuyên 50% Giáp)';
  }

  // 4. Phá Giáp Trảm (Bạch Kim Hổ Tử): 100% xuyên giáp
  if (hasHax(actor, 'bach_kim_ho_tu') || hasHax(actor, 'phá giáp trảm')) {
    damage += Math.floor(target.def * 0.5);
    haxTriggered = 'Phá Giáp Trảm (Xuyên 100% Giáp)';
  }

  // 5. Ký Sinh Hút Máu (Mạn Đà La Linh Thú): Gây 30% máu đối thủ và hút về
  if (hasHax(actor, 'man_da_la_linh_thu') || hasHax(actor, 'ký sinh hút máu')) {
    const drain = Math.floor(target.currentHp * 0.30);
    damage += drain;
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + drain);
    haxTriggered = `Ký Sinh Hút Máu (+${drain.toLocaleString()} HP)`;
  }

  // 6. U Minh Lang Vương: Tuyệt Mệnh Trảm (Khi máu địch < 25%, 50% kết liễu ngay)
  if (hasHax(actor, 'u_minh_lang_vuong') || hasHax(actor, 'tuyệt mệnh trảm')) {
    if (target.currentHp < target.maxHp * 0.25 && rng() < 0.50) {
      damage = target.currentHp + (target.shield || 0);
      haxTriggered = 'Tuyệt Mệnh Trảm (Trảm Quyết Chí Tử)';
    }
  }

  // 7. Băng Phong (Băng Tuyết Hồ): 35% đóng băng đối thủ
  if (hasHax(actor, 'bang_tuyet_ho') || hasHax(actor, 'băng phong')) {
    if (!hasHax(target, 'quang_minh_thanh_thu') && rng() < 0.35) {
      target.state.isStunned = true;
      if (!haxTriggered) haxTriggered = 'Băng Phong (Đóng Băng 1 Hiệp)';
    }
  }

  // Sát thương bạo kích
  if (isCrit) {
    let critMultiplier = 1.5;
    // Hàn Băng Kỳ Lân: Hàn Khí Giáp (Giảm 40% sát thương bạo kích nhận vào)
    if (hasHax(target, 'han_bang_ky_lan') || hasHax(target, 'hàn khí giáp')) {
      critMultiplier = 1.2;
    }
    damage = Math.floor(damage * critMultiplier);
  }

  return { damage: Math.max(50, Math.floor(damage)), isCrit, isMiss: false, haxTriggered };
}

/**
 * Giai đoạn 4: Kích hoạt khi nhận sát thương (onDamageReceived)
 */
export function triggerDamageReceived(target, incomingDamage, attacker, rng) {
  let finalDamage = incomingDamage;
  let reflectedDamage = 0;
  let healedDamage = 0;
  const events = [];

  // 1. « Hồng Mông Hỗn Độn Trượng »: Hỗn Độn Nghịch Đảo (35% đổi dmg thành hồi máu + phản 100%)
  if (hasHax(target, 'hồng mông hỗn độn') || hasHax(target, 'hỗn độn nghịch đảo')) {
    if (rng() < 0.35) {
      healedDamage = finalDamage;
      target.currentHp = Math.min(target.maxHp, target.currentHp + healedDamage);
      reflectedDamage = finalDamage;
      finalDamage = 0;
      events.push({
        actor: target.id,
        action: 'absorb_reflect',
        skill: '« Hồng Mông Hỗn Độn Trượng » Hỗn Độn Nghịch Đảo',
        desc: `${target.name} chuyển hóa ${healedDamage.toLocaleString()} sát thương thành Máu và phản hồi 100% đòn đánh!`,
      });
      return { finalDamage: 0, reflectedDamage, events };
    }
  }

  // 2. Cửu Vĩ Hộ Thể: Bất tử 3 lượt và phản 100% sát thương
  if (target.state.isImmortalTurns > 0) {
    reflectedDamage += finalDamage;
    finalDamage = 0;
    target.state.isImmortalTurns--;
    events.push({
      actor: target.id,
      action: 'reflect',
      skill: 'Cửu Vĩ Hộ Thể',
      desc: `${target.name} trong trạng thái Bất Tử! Chặn đứng toàn bộ sát thương và phản lại ${reflectedDamage.toLocaleString()} uy lực!`,
    });
    return { finalDamage: 0, reflectedDamage, events };
  }

  // 3. « Thiên Hồ Hóa Thần Ngọc »: Giảm 50% sát thương khi khiên còn tồn tại
  if (target.shield > 0 && (hasHax(target, 'thiên hồ hóa thần') || hasHax(target, 'thần hồ diễm hộ'))) {
    finalDamage = Math.floor(finalDamage * 0.5);
  }

  // 4. Giảm sát thương bản nguyên của Hỗn Độn (15%)
  if (target.element && target.element.includes('Hỗn Độn')) {
    finalDamage = Math.floor(finalDamage * 0.85);
  }

  // 5. Phản đòn: « Vạn Tượng Quy Nhất Châu » (75%), Thiết Giáp Xích Giác (80%), Thủy Tinh Huyền Ngao (60%)
  if (hasHax(target, 'vạn tượng quy nhất') || hasHax(target, 'kính hoa thủy nguyệt')) {
    reflectedDamage += Math.floor(finalDamage * 0.75);
  } else if (hasHax(target, 'thiet_giap_xich_giac') || hasHax(target, 'phản chấn thần lực')) {
    reflectedDamage += Math.floor(finalDamage * 0.80);
  } else if (hasHax(target, 'thuy_tinh_huyen_ngao') || hasHax(target, 'nghịch lưu phản xạ')) {
    reflectedDamage += Math.floor(finalDamage * 0.60);
  }

  // 6. Hóa Đá (Hỏa Thạch Nham Nham): 50% hóa đá kẻ tấn công
  if (hasHax(target, 'hoa_thach_nham_nham') || hasHax(target, 'hóa đá')) {
    if (!hasHax(attacker, 'quang_minh_thanh_thu') && rng() < 0.50) {
      attacker.state.isStunned = true;
      events.push({
        actor: target.id,
        action: 'petrify',
        skill: 'Hóa Đá',
        desc: `${target.name} phóng luồng nham thạch hóa đá ${attacker.name} trong 1 hiệp!`,
      });
    }
  }

  return { finalDamage: Math.max(0, finalDamage), reflectedDamage, events };
}

/**
 * Giai đoạn 5: Kích hoạt khi chịu đòn chí mạng (onLethalDamage)
 */
export function triggerLethalInterception(target, attacker, rng) {
  // 1. « Bất Hủ Thần Hoàng Ngọc »: Kim Thân Hộ Mệnh (Giữ 1 HP & miễn nhiễm 2 lượt)
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0 &&
      (hasHax(target, 'bất hủ thần hoàng') || hasHax(target, 'kim thân hộ mệnh'))) {
    target.state.cheatDeathUsed = true;
    target.currentHp = 1;
    target.state.isImmortalTurns = 2;
    return {
      survived: true,
      skill: '« Bất Hủ Thần Hoàng Ngọc » Kim Thân Hộ Mệnh',
      desc: `${target.name} kích hoạt Kim Thân Hộ Mệnh! Tử thần bị chặn đứng tại 1 HP, nhận miễn nhiễm sát thương 2 hiệp!`,
    };
  }

  // 2. Chu Tước Ấu Điểu: Niết Bàn Tái Sinh (Hồi sinh 50% máu 1 lần)
  if (!target.state.reviveUsed && target.state.antiImmortalityTurns === 0 &&
      (hasHax(target, 'chu_tuoc_au_dieu') || hasHax(target, 'niết bàn tái sinh'))) {
    target.state.reviveUsed = true;
    target.currentHp = Math.floor(target.maxHp * 0.5);
    return {
      survived: true,
      skill: 'Niết Bàn Tái Sinh',
      desc: `${target.name} bốc cháy ngọn lửa Chu Tước, Niết Bàn Hồi Sinh với 50% lượng máu (${target.currentHp.toLocaleString()} HP)!`,
    };
  }

  // 3. « Luân Hồi Bất Diệt Chiến Hồn »: Sinh Mệnh Nghịch Chuyển (Đổi % máu với đối thủ khi < 20%)
  if (!target.state.hpSwapUsed && (hasHax(target, 'luân hồi bất diệt') || hasHax(target, 'sinh mệnh nghịch chuyển'))) {
    target.state.hpSwapUsed = true;
    const targetPct = target.currentHp / target.maxHp;
    const attackerPct = attacker.currentHp / attacker.maxHp;
    target.currentHp = Math.floor(target.maxHp * attackerPct);
    attacker.currentHp = Math.max(1, Math.floor(attacker.maxHp * targetPct));
    return {
      survived: true,
      skill: '« Luân Hồi Bất Diệt Chiến Hồn » Sinh Mệnh Nghịch Chuyển',
      desc: `${target.name} đảo ngược Luân Hồi! Hoán đổi toàn bộ tỷ lệ phần trăm máu với ${attacker.name}!`,
    };
  }

  return { survived: false, skill: null, desc: null };
}
