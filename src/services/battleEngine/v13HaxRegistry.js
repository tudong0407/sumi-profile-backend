/**
 * src/services/battleEngine/v13HaxRegistry.js
 * Bảng khai báo chuẩn hóa toàn bộ hiệu ứng HAX cho 50 Linh Thú mới & 100 Pháp Bảo mới (v1.3).
 */

export const V13_PET_HAX = {
  // 3 Phàm Phẩm
  linh_ho_tieu_bach: { startShieldPct: 0.18, flatAccuracyBonus: 0.08, label: 'Bạch Quang Hộ Thể' },
  xich_thach_tieu_quy: { earlyDmgRedTurns: 3, earlyDmgRedPct: 0.14, label: 'Thạch Giáp Nặng Nề' },
  thanh_lam_tieu_dieu: { extraStrike: { chance: 0.18, atkRatio: 0.35, defPierce: 0, label: 'Thủy Tiễn Liên Kích' } },

  // 3 Linh Phẩm
  kim_van_linh_bao: { critDefPiercePct: 0.35, label: 'Kim Trảo Phá Phong' },
  u_lam_linh_diep: { ccProc: { chance: 0.20, kind: 'sleep', skill: 'Phấn Hoa Mê Hoặc' }, turnHealPct: 0.06 },
  hac_diem_linh_nha: { burnOnHitPct: 0.06, burnMode: 'current', label: 'U Minh Ám Hỏa' },

  // 4 Tiên Phẩm
  bach_ngoc_ky_lan: { startShieldPct: 0.45, stunImmuneTurns: 2, label: 'Thánh Ngọc Hộ Chủ' },
  thien_loi_thach_vien: { ccProc: { chance: 0.25, kind: 'stun', skill: 'Lôi Côn Chấn Địa' }, flatCritPct: 0.15 },
  huyen_bang_thuy_long: { ccProc: { chance: 0.25, kind: 'freeze', skill: 'Hàn Long Thổ Tức' }, startSpdDebuffPct: 0.15 },
  huyet_sat_kiem_ho: { defPiercePct: 0.40, highHpThreshold: 0.60, highHpBonusDmgPct: 0.20, label: 'Bạch Hổ Kiếm Khí' },

  // 30 Thần Thoại Không Độc Nhất
  cuu_tieu_kim_long: { defPiercePct: 0.50, atkStackPct: 0.06, atkStackMax: 5, label: 'Long Hoàng Trấn Áp' },
  thai_co_bach_ho: { flatCritPct: 0.20, critShieldPiercePct: 0.70, label: 'Canh Kim Sát Lục' },
  huyen_minh_cuu_phuong: { burnOnHitPct: 0.09, reviveHpPct: 0.45, label: 'Cửu Vỹ Hỏa Vũ' },
  tu_vi_huyen_quy: { dmgRedPct: 0.28, reflectPct: 0.40, label: 'Bắc Đẩu Giáp Thần' },
  hon_nguyen_thanh_long: { turnHealPct: 0.07, turnCleanse: 1, label: 'Thái Ất Trường Sinh' },
  loi_than_cuu_ung: { ccProc: { chance: 0.30, kind: 'stun', skill: 'Thần Lôi Chiết Quang' }, startSpdStealPct: 0.25 },
  thien_co_ngoc_ho: { dodgePct: 0.28, dodgeCounterAtkRatio: 0.90, dodgeCounterLabel: 'Thiên Cơ Đảo Ảnh' },
  u_do_ma_lang: { lifestealPct: 0.28, enemyHealRedPct: 0.45, label: 'Phệ Hồn Huyết Trảo' },
  van_nhac_than_ngu: { startShieldPct: 0.70, critDmgRedPct: 0.35, label: 'Trấn Nhạc Sơn Hà' },
  tinh_van_cuu_loc: { cheatDeathHpPct: 0.15, cheatDeathImmortalTurns: 1, turnHealPct: 0.06, label: 'Tinh Thần Độ Thế' },
  xich_diem_ky_lan: { defPiercePct: 0.55, burnOnHitPct: 0.09, burnIgnoresShield: true, label: 'Phần Thiên Thánh Hỏa' },
  thuy_vu_thanh_phuong: { ccProc: { chance: 0.28, kind: 'freeze', skill: 'Băng Tâm Tịnh Hóa' }, turnCleanseInterval: 2 },
  cuu_u_huyen_xoa: { poisonScaling: { base: 0.05, step: 0.02, max: 0.11 }, label: 'Thất Bộ Đoạt Mệnh Độc' },
  thien_khong_kim_dieu: { extraStrike: { chance: 0.30, atkRatio: 0.65, defPierce: 0.45, label: 'Thiên Nhận Trảm Phong' } },
  tu_tieu_loi_su: { shieldPiercePct: 0.65, ccProc: { chance: 0.25, kind: 'stun', skill: 'Tử Lôi Phá Khiên' } },
  moc_hoang_than_tuoc: { siphonEvery3TurnsPct: 0.12, atkDebuffPct: 0.25, atkDebuffTurns: 2, label: 'Vạn Mộc Triền Thân' },
  hoang_tuyen_minh_ho: { executeHpPct: 0.22, executeChance: 0.45, label: 'Minh Hổ Đoạt Hồn' },
  quang_linh_cuu_ho: { charmPct: 0.35, startShieldPct: 0.35, label: 'Thánh Hồ Mị Ảnh' },
  thai_at_than_trach: { startShieldPct: 0.60, dmgRedPct: 0.22, label: 'Thần Trạch Tiên Tri' },
  huyen_thien_vo_cuc_ngao: { stealShieldEvery2TurnsPct: 0.35, label: 'Thái Hư Thôn Phệ' },
  kim_quang_toan_nghe: { reflectPct: 0.35, reflectBurnPct: 0.06, label: 'Tiên Hỏa Phản Chấn' },
  thanh_bang_hai_hoang: { ccProc: { chance: 0.30, kind: 'freeze', skill: 'Vạn Hải Băng Phong' }, startAtkDebuffPct: 0.20, startAtkDebuffTurns: 3 },
  loi_kiet_thien_long: { every2TurnStrike: { atkRatio: 0.85, defPierce: 0.60, label: 'Cửu Trùng Thần Kiếp' } },
  xich_nguyet_tue_ho: { flatCritPct: 0.18, critLifestealPct: 0.22, label: 'Huyết Nguyệt Hỏa Ấn' },
  thach_hoang_cu_linh: { cheatDeathHpPct: 0.15, shieldExplodePct: 0.18, label: 'Đại Địa Bất Bại' },
  tinh_tu_thien_nga: { ccImmuneBasic: true, turnHealPct: 0.06, label: 'Tinh Hà Thánh Vũ' },
  u_linh_kiem_ma: { defPiercePct: 0.60, stealAtkPerHitPct: 0.05, stealAtkMaxStacks: 3, label: 'Quỷ Kiếm Tuyệt Sát' },
  vu_tru_khong_lo: { startHaxLockTurns: 1, shieldPiercePct: 0.50, label: 'Không Gian Đoạn Tầng' },
  van_moc_xuan_long: { turnHealPct: 0.07, startShieldPct: 0.25, label: 'Thiên Địa Hồi Xuân' },
  thai_duong_than_su: { defDebuffPerHitPct: 0.12, defDebuffMaxTotal: 0.48, burnOnHitPct: 0.08, label: 'Nhật Diệm Phá Giáp' },

  // 10 Thần Thoại Độc Nhất Toàn Server
  hon_don_chi_to_long: { defPiercePct: 0.55, shieldPiercePct: 0.55, atkStackPct: 0.07, atkStackMax: 5, label: 'Tổ Long Khai Thiên' },
  thai_so_cuu_phuong_hoang: { reviveHpPct: 0.48, burnOnHitPct: 0.08, label: 'Bất Tử Thần Diệm' },
  van_kiem_de_ton_ho: { shieldPiercePct: 0.70, flatCritPct: 0.20, defPiercePct: 0.52, label: 'Bạch Đế Tru Tiên' },
  bac_hai_huyen_vu_de: { dmgRedPct: 0.30, reflectPct: 0.42, reflectFreezeChance: 0.25, ccProc: { chance: 0.25, kind: 'freeze', skill: 'Thái Thủy Bất Hoại' } },
  thoi_khong_than_tinh_ho: { phaseShift: { hpRatio: 0.35, healPct: 0.32, doubleTurn: true, label: 'Thời Không Nghịch Chuyển' } },
  thai_cuc_thanh_quang_thu: { ccImmuneAll: true, turnHealPct: 0.08, turnCleanse: 1, label: 'Vạn Pháp Quy Tông' },
  cuu_u_do_than_diem_lang: { lifestealPct: 0.28, executeHpPct: 0.24, executeChance: 0.45, label: 'Đoạn Hồn Huyết Sát' },
  thanh_de_van_co_long: { turnHealPct: 0.09, dotImmune: true, startShieldPct: 0.35, label: 'Thần Mộc Bất Diệt' },
  cuu_thien_loi_de_ho: { firstStrike: true, startSpdStealPct: 0.28, ccProc: { chance: 0.26, kind: 'stun', skill: 'Lôi Đế Thần Tốc' } },
  hoang_thien_ban_co_lan: { startShieldPct: 0.72, shieldExplodePct: 0.20, label: 'Bàn Cổ Trấn Thiên' },
};

export const V13_EQUIP_HAX = {
  // ---- 34 VŨ KHÍ MỚI ----
  weapon_common_7: { critLifestealPct: 0.04 },
  weapon_common_8: { defPiercePct: 0.12 },
  weapon_rare_7: { enemyAccDebuffPct: 0.10, enemyAccDebuffTurns: 2 },
  weapon_rare_8: { burnChance: 0.20, burnOnHitPct: 0.06 },
  weapon_epic_7: { ccProc: { chance: 0.25, kind: 'freeze', skill: 'Băng Phách Tuyệt Mệnh' }, shieldPiercePct: 0.25 },
  weapon_epic_8: { ccProc: { chance: 0.25, kind: 'stun', skill: 'Tử Lôi Chấn Thiên' }, defDebuffPct: 0.20, defDebuffTurns: 2 },
  weapon_epic_9: { lifestealPct: 0.18, enemyHealRedPct: 0.30 },
  weapon_mythic_6: { shieldPiercePct: 0.60, domainActiveDmgBonusPct: 0.15 },
  weapon_mythic_7: { defPiercePct: 0.50, burnOnHitPct: 0.09, burnIgnoresShield: true },
  weapon_mythic_8: { ccProc: { chance: 0.28, kind: 'freeze', skill: 'Băng Phong Tịch Diệt' }, startSpdDebuffPct: 0.20 },
  weapon_mythic_9: { extraStrike: { chance: 0.30, atkRatio: 0.65, shieldPierce: 0.50, label: 'Lôi Tiễn Liên Hoàn' } },
  weapon_mythic_10: { lifestealPct: 0.22, turnCleanseInterval: 2 },
  weapon_mythic_11: { shieldDamageMult: 2.0, defPiercePct: 0.55 },
  weapon_mythic_12: { stripEnemyBuffInterval: 2, bonusTrueAtkPct: 0.18 },
  weapon_mythic_13: { enemyHealRedPct: 0.50, lifestealPct: 0.22 },
  weapon_mythic_14: { critDefPiercePct: 0.45, critDodgeIgnorePct: 0.45 },
  weapon_mythic_15: { dodgePct: 0.18, burnOnHitPct: 0.07 },
  weapon_mythic_16: { defDebuffPerHitPct: 0.10, defDebuffMaxTotal: 0.40, shieldPiercePct: 0.45 },
  weapon_mythic_17: { executeHpPct: 0.22, executeChance: 0.40, lifestealPct: 0.25 },
  weapon_mythic_18: { dodgeCounterAtkRatio: 0.70, dodgeCounterLabel: 'Nhật Nguyệt Luân Chuyển' },
  weapon_mythic_19: { poisonPct: 0.08, enemyHealRedPct: 0.30 },
  weapon_mythic_20: { ccProc: { chance: 0.26, kind: 'stun', skill: 'Lôi Chùy Oanh Kích' }, bonusTrueOnShieldBreakPct: 0.10 },
  weapon_mythic_21: { hitEnemyDmgDebuffPct: 0.20, hitEnemyDmgDebuffTurns: 2, turnHealPct: 0.06 },
  weapon_mythic_22: { antiShieldDmgBonusPct: 0.25 },
  weapon_unique_1: { shieldPiercePct: 0.70, defPiercePct: 0.55, ignoreEnemyDmgRedPct: 0.15 },
  weapon_unique_2: { defPiercePct: 0.58, burnOnHitPct: 0.11, burnIgnoresShield: true },
  weapon_unique_3: { ccProc: { chance: 0.32, kind: 'freeze', skill: 'Vĩnh Đống Cấm Chế' }, startSpdDebuffPct: 0.24, enemyHealRedPct: 0.25 },
  weapon_unique_4: { extraStrike: { chance: 0.35, atkRatio: 0.75, shieldPierce: 0.60, label: 'Thần Kiếp Xuyên Vân' }, startSpdStealPct: 0.25 },
  weapon_unique_5: { lifestealPct: 0.26, turnCleanse: 1, burnOnHitPct: 0.07 },
  weapon_unique_6: { defPiercePct: 0.60, shieldDamageMult: 2.2 },
  weapon_unique_7: { stripEnemyBuffInterval: 2, critBonusTrueAtkPct: 0.20 },
  weapon_unique_8: { enemyHealRedPct: 0.58, lifestealPct: 0.26, executeHpPct: 0.22, executeChance: 0.38 },
  weapon_unique_9: { defPiercePct: 0.55, extraStrike: { chance: 0.35, atkRatio: 0.55, defPierce: 1.0, label: 'Thời Không Trảm' } },
  weapon_unique_10: { shieldPiercePct: 0.68 },

  // ---- 33 BẢO NGỌC MỚI ----
  gem_common_6: { turnHealPct: 0.03, dmgRedPct: 0.05 },
  gem_common_7: { startShieldFlat: 400 },
  gem_rare_6: { reflectPct: 0.20, dotResistPct: 0.25 },
  gem_rare_7: { cleanseTurn2: true, critDmgRedPct: 0.10 },
  gem_epic_7: { startShieldPct: 0.45, reflectStunChance: 0.20 },
  gem_epic_8: { dmgRedPct: 0.24, critDmgRedPct: 0.30 },
  gem_mythic_6: { startShieldPct: 0.85, dmgRedPct: 0.26 },
  gem_mythic_7: { turnHealPct: 0.12, dotResistPct: 0.75 },
  gem_mythic_8: { reflectPct: 0.65, ccResistPct: 0.60 },
  gem_mythic_9: { dmgRedPct: 0.30, cheatDeathHpPct: 0.15 },
  gem_mythic_10: { reviveHpPct: 0.50, reflectBurnPct: 0.06 },
  gem_mythic_11: { reflectAtkDebuffPct: 0.12, reflectBurnPct: 0.07 },
  gem_mythic_12: { startShieldPct: 0.70, reflectStunChance: 0.25 },
  gem_mythic_13: { startShieldPct: 0.90, critDmgRedPct: 0.45 },
  gem_mythic_14: { dodgePct: 0.24, startShieldPct: 0.55 },
  gem_mythic_15: { ccResistPct: 0.75, turnCleanse: 1 },
  gem_mythic_16: { dmgRedPct: 0.28, turnHealPct: 0.09 },
  gem_mythic_17: { dotImmune: true, reflectPct: 0.35 },
  gem_mythic_18: { startShieldPct: 0.75, shieldActiveAtkBonusPct: 0.18, reflectPct: 0.30 },
  gem_mythic_19: { absorbDmgAsShieldPct: 0.30 },
  gem_mythic_20: { emergencyHealPct: 0.40, emergencyThreshold: 0.40, emergencyDefBonusPct: 0.20 },
  gem_mythic_21: { cheatDeathMinHp1ImmortalTurns: 1 },
  gem_mythic_22: { startShieldPct: 0.65 },
  gem_unique_1: { startShieldPct: 0.95, shieldActiveDmgRedPct: 0.30 },
  gem_unique_2: { ccResistPct: 0.85, trueDmgResistPct: 0.30, turnHealPct: 0.08 },
  gem_unique_3: { dmgRedPct: 0.34, reflectFreezeChance: 0.30 },
  gem_unique_4: { reviveHpPct: 0.60, reviveShieldPct: 0.40 },
  gem_unique_5: { turnHealPct: 0.14, dotImmune: true, turnCleanse: 1 },
  gem_unique_6: { startShieldPct: 1.05, executeBlock: true },
  gem_unique_7: { reflectPct: 0.78, dodgePct: 0.20 },
  gem_unique_8: { cheatDeathMinHp1ImmortalTurns: 2, reflectStunChance: 0.30 },
  gem_unique_9: { absorbDmgAsShieldPct: 0.35, reflectBurnPct: 0.08 },
  gem_unique_10: { startShieldPct: 0.90 },

  // ---- 33 CHIẾN HỒN MỚI ----
  soul_common_6: { lowHpThreshold: 0.45, lowHpBonusDmgPct: 0.12 },
  soul_common_7: { dodgePct: 0.06 },
  soul_rare_6: { earlySpdBonusTurns: 2, earlySpdBonusPct: 0.12 },
  soul_rare_7: { turnHealPct: 0.05 },
  soul_epic_7: { defPiercePct: 0.30, flatCritPct: 0.10 },
  soul_epic_8: { ccProc: { chance: 0.25, kind: 'freeze', skill: 'Huyền Minh Giao Long' }, lifestealPct: 0.14 },
  soul_epic_9: { lifestealPct: 0.24, enemyHealRedPct: 0.25 },
  soul_mythic_6: { atkStackPct: 0.06, atkStackMax: 5, turnHealPct: 0.08 },
  soul_mythic_7: { reviveHpPct: 0.48, burnOnHitPct: 0.08 },
  soul_mythic_8: { shieldPiercePct: 0.60, flatCritPct: 0.16 },
  soul_mythic_9: { dmgRedPct: 0.26, reflectPct: 0.42 },
  soul_mythic_10: { startSpdStealPct: 0.30, ccProc: { chance: 0.25, kind: 'stun', skill: 'Lôi Hoàng Cướp Tốc' } },
  soul_mythic_11: { dodgePct: 0.30, dodgeCounterAtkRatio: 0.80, dodgeCounterDefPierce: 0.40, dodgeCounterLabel: 'Tinh Hồ Hoán Ảnh' },
  soul_mythic_12: { lifestealPct: 0.28, enemyHealRedPct: 0.45 },
  soul_mythic_13: { defPiercePct: 0.55, burnOnHitPct: 0.09 },
  soul_mythic_14: { startShieldPct: 0.65, critDmgRedPct: 0.35 },
  soul_mythic_15: { ccImmuneAll: true, turnHealPct: 0.10 },
  soul_mythic_16: { charmPct: 0.36 },
  soul_mythic_17: { every2TurnStrike: { atkRatio: 0.75, defPierce: 0.55, label: 'Kiếm Ý Cửu Thiên' } },
  soul_mythic_18: { ccProc: { chance: 0.28, kind: 'freeze', skill: 'Băng Hoàng Đông Kết' }, startAtkDebuffPct: 0.18, startAtkDebuffTurns: 3 },
  soul_mythic_19: { poisonPct: 0.09, enemyHealRedPct: 0.35 },
  soul_mythic_20: { ccProc: { chance: 0.26, kind: 'stun', skill: 'Lôi Phạt Phá Vực' } },
  soul_mythic_21: { hpSwapThreshold: 0.22, dodgePct: 0.12 },
  soul_unique_1: { atkStackPct: 0.07, atkStackMax: 5, defPiercePct: 0.50, turnHealPct: 0.06 },
  soul_unique_2: { reviveHpPct: 0.58, burnOnHitPct: 0.10, burnIgnoresShield: true },
  soul_unique_3: { every2TurnStrike: { atkRatio: 0.85, defPierce: 0.65, shieldPierce: 0.60, label: 'Đế Kiếm Quy Nhất' } },
  soul_unique_4: { doubleTurnOnce: true, dodgePct: 0.15 },
  soul_unique_5: { dmgRedPct: 0.32, reflectPct: 0.50, reflectFreezeChance: 0.25 },
  soul_unique_6: { startSpdStealPct: 0.36, ccProc: { chance: 0.30, kind: 'stun', skill: 'Cửu Lôi Chấn Tốc' } },
  soul_unique_7: { charmPct: 0.42, ccImmuneBasic: true },
  soul_unique_8: { lifestealPct: 0.32, enemyHealRedPct: 0.55, executeHpPct: 0.22, executeChance: 0.35 },
  soul_unique_9: { turnHealPct: 0.14, turnCleanse: 1, dotImmune: true },
  soul_unique_10: { startShieldPct: 0.72 },
};

/**
 * Thu thập tất cả entry HAX v1.3 đang hoạt động trên một Combatant (Pet + Weapon + Gem + Soul).
 */
export function getCombatantV13HaxList(combatant) {
  const list = [];
  const petEff = combatant?.petType ? V13_PET_HAX[combatant.petType] : null;
  if (petEff) list.push({ id: combatant.petType, source: combatant.petName || combatant.petType, ...petEff });

  const eq = combatant?.equipment || {};
  for (const piece of [eq.weapon, eq.gem, eq.soul]) {
    if (!piece?.item_id) continue;
    const eqEff = V13_EQUIP_HAX[piece.item_id];
    if (eqEff) list.push({ id: piece.item_id, source: piece.item_name || piece.item_id, ...eqEff });
  }
  return list;
}
