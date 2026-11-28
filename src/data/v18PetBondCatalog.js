/**
 * src/data/v18PetBondCatalog.js
 * SuMi Family Ver 1.8B — Hệ Thống Thiện Cảm Linh Thú (/pet), 41 Viền Chân Thần & 10 Loài Tâm Tính:
 * - 5 Thang bậc Thiện Cảm (Phàm 3 / Linh 5 / Tiên 7 / Thần Thoại 8 / Độc Nhất & Chân Thần & Tối Thượng 10).
 * - Tặng Linh Quả / Tinh Hoa Đan / Tinh Thạch Hồng Kim (trần +200/ngày); Mảnh Hỗn Độn & Đá Tuyệt Ấn (không trần).
 * - 5 Buff Tuyến Tính theo Bậc T đang đạt của Pet Chính.
 * - 41 Avatar Frame Chân Thần mở khóa vĩnh viễn khi Pet Độc Nhất đã Tiến Hóa đạt Bậc 10/10 (12.000 điểm).
 */

import { PET_CATALOG, PET_BY_TYPE } from './catalog.js';
import { PET_BOND_FRAME_PET_TYPES, buildV18BondAvatarFrames } from './v18BondFrameCatalog.js';

export const PET_BOND_INTERACT_DAILY_MAX = 6;
export const PET_BOND_INTERACT_POINTS = 15;
export const PET_BOND_INTERACT_COOLDOWN_MS = 30 * 1000;
export const PET_BOND_GIFT_DAILY_CAP = 200;
export const PET_BOND_COMBAT_BATTLE_DAILY_CAP = 20;
export const PET_BOND_COMBAT_TOWER_VEIN_DAILY_CAP = 15;
export const PET_BOND_EVOLUTION_BONUS_POINTS = 1800; // +15% trên thang 12.000 điểm Độc Nhất

export const PET_BOND_SCALES = {
  common: {
    key: 'common',
    label: 'Phàm Phẩm (3 Bậc)',
    maxTier: 3,
    maxPoints: 120,
    thresholds: [0, 30, 70, 120],
    tierNames: [
      'Xa Lạ',
      'Quen Thuộc',
      'Thân Thiết',
      'Tri Kỷ Phàm Trần',
    ],
  },
  rare: {
    key: 'rare',
    label: 'Linh Phẩm (5 Bậc)',
    maxTier: 5,
    maxPoints: 1200,
    thresholds: [0, 100, 260, 500, 820, 1200],
    tierNames: [
      'Xa Lạ',
      'Cảm Mến',
      'Thân Quen',
      'Gắn Bó',
      'Tín Nhiệm',
      'Đồng Tâm Hợp Ý',
    ],
  },
  epic: {
    key: 'epic',
    label: 'Tiên Phẩm (7 Bậc)',
    maxTier: 7,
    maxPoints: 4200,
    thresholds: [0, 120, 360, 760, 1320, 2100, 3050, 4200],
    tierNames: [
      'Sơ Ngộ',
      'Hiếu Kỳ',
      'Thân Quen',
      'Quyến Luyến',
      'Tin Tưởng',
      'Cộng Minh',
      'Khế Ước Sâu Đậm',
      'Tiên Duyên Vĩnh Kết',
    ],
  },
  mythic: {
    key: 'mythic',
    label: 'Thần Thoại (8 Bậc)',
    maxTier: 8,
    maxPoints: 7200,
    thresholds: [0, 150, 450, 950, 1650, 2600, 3850, 5350, 7200],
    tierNames: [
      'Thần Thú Kiêu Ngạo',
      'Khẽ Ngoái Đầu',
      'Nhận Chủ Nhân',
      'Gắn Bó',
      'Nương Tựa',
      'Hộ Đạo Tín Thần',
      'Tri Kỷ Cửu Châu',
      'Sinh Tử Bất Ly',
      'Thần Hồn Cộng Cảm',
    ],
  },
  supreme: {
    key: 'supreme',
    label: 'Độc Nhất / Chân Thần (10 Bậc)',
    maxTier: 10,
    maxPoints: 12000,
    thresholds: [0, 200, 550, 1100, 1900, 3000, 4400, 6000, 7800, 9800, 12000],
    tierNames: [
      'Sơ Kiến Cao Ngạo',
      'Khẽ Động Linh Tâm',
      'Quen Hơi Chủ Nhân',
      'Gần Gũi Thân Quen',
      'Tin Tưởng Sâu Sắc',
      'Thân Thiết Gắn Bó',
      'Nương Tựa Tri Âm',
      'Tri Kỷ Tuyệt Đối',
      'Sinh Tử Đồng Tâm',
      'Cộng Sinh Linh Hồn',
      'Vĩnh Kết Đồng Tâm',
    ],
  },
};

export const PET_BOND_GIFT_CATALOG = {
  farm_essence: {
    item_id: 'farm_essence',
    name: 'Linh Quả',
    points: 2,
    capped: true,
    storage: 'user_farm_essence',
    emoji_key: 'farm_harvest',
    desc: '+2 Thiện Cảm/quả (tính vào trần +200/ngày)',
  },
  pill_ess_1: {
    item_id: 'pill_ess_1',
    name: 'Linh Quả Thanh Tâm Đan',
    points: 45,
    capped: true,
    storage: 'user_inventory',
    emoji_key: 'pill_ess_1',
    desc: '+45 Thiện Cảm/viên (tính vào trần +200/ngày)',
  },
  pill_ess_2: {
    item_id: 'pill_ess_2',
    name: 'Hồng Mông Tạo Hóa Đan',
    points: 100,
    capped: true,
    storage: 'user_inventory',
    emoji_key: 'pill_ess_2',
    desc: '+100 Thiện Cảm/viên (tính vào trần +200/ngày)',
  },
  red_gold_crystals: {
    item_id: 'red_gold_crystals',
    name: 'Tinh Thạch Hồng Kim (TT)',
    points: 25,
    capped: true,
    storage: 'user_tt',
    emoji_key: 'su_tinh_thach',
    desc: '+25 Thiện Cảm/viên (tính vào trần +200/ngày)',
  },
  chaos_essence_shard: {
    item_id: 'chaos_essence_shard',
    name: 'Mảnh Linh Hoa Hỗn Độn',
    points: 350,
    capped: false,
    storage: 'user_inventory',
    emoji_key: 'chaos_essence_shard',
    desc: '+350 Thiện Cảm/mảnh (KHÔNG giới hạn ngày)',
  },
  evo_crystal: {
    item_id: 'evo_crystal',
    name: 'Đá Tuyệt Ấn',
    points: 1800,
    capped: false,
    storage: 'user_inventory',
    emoji_key: 'evo_crystal',
    desc: '+1.800 Thiện Cảm/viên (KHÔNG giới hạn ngày)',
  },
};

export const PET_BOND_INTERACTIONS = [
  { key: 'pat', label: 'Xoa Đầu', emojiKey: 'pet_act_pat', vibe: 'dịu dàng xoa nhẹ đỉnh đầu và vầng trán' },
  { key: 'hug', label: 'Ôm Ấp', emojiKey: 'pet_act_hug', vibe: 'ôm sát vào lòng truyền hơi ấm linh lực' },
  { key: 'snack', label: 'Cho Ăn', emojiKey: 'pet_act_snack', vibe: 'đưa điểm tâm linh quả ngọt ngào' },
  { key: 'brush', label: 'Chải Lông', emojiKey: 'pet_act_brush', vibe: 'dùng lược ngọc chải chuốt bộ lông/vảy mượt mà' },
  { key: 'play', label: 'Chơi Đùa', emojiKey: 'pet_act_play', vibe: 'tung hứng linh cầu đùa giỡn cùng nhau' },
  { key: 'sleep', label: 'Ngủ Cùng', emojiKey: 'pet_act_sleep', vibe: 'tựa lưng nghỉ ngơi yên bình dưới ánh trăng' },
  { key: 'chat', label: 'Trò Chuyện', emojiKey: 'pet_act_chat', vibe: 'tâm tình bằng thần thức' },
];

export { PET_BOND_FRAME_PET_TYPES };
export const V18_BOND_AVATAR_FRAMES = buildV18BondAvatarFrames(PET_BY_TYPE);

export const V18_BOND_FRAME_BY_PET = Object.fromEntries(
  V18_BOND_AVATAR_FRAMES.map((f) => [f.pet_type, f]),
);

const ARCHETYPE_BY_PET_TYPE = new Map();
const EXPLICIT_ARCHETYPE_OVERRIDES = {
  cuu_vi_hong_ho: 'kemonomimi',
  hong_mong_cuu_vy_tien: 'kemonomimi',
  huyet_nguyet_thien_lang_nu: 'kemonomimi',
  xich_diem_phuong_hoang_co: 'kemonomimi',
  bach_de_kiem_ho_quan: 'kemonomimi',
  thuong_hai_long_nu: 'kemonomimi',
  tu_tieu_loi_ho_quan: 'kemonomimi',
  van_hoa_linh_loc_co: 'kemonomimi',
  thai_am_ngoc_tho_tien: 'kemonomimi',
  tinh_ha_nguyet_mieu_co: 'kemonomimi',
  hoang_thien_ky_lan_quan: 'kemonomimi',
};

function classifyPetArchetypeFromMeta(petMeta) {
  if (!petMeta) return 'lion_ape_bear_stone';
  if (EXPLICIT_ARCHETYPE_OVERRIDES[petMeta.pet_type]) return EXPLICIT_ARCHETYPE_OVERRIDES[petMeta.pet_type];
  if (petMeta.is_kemonomimi) return 'kemonomimi';
  const name = String(petMeta.pet_name || '');
  // Phân biệt chính xác Hổ (tiger) vs Hồ (fox) bằng chữ có dấu tiếng Việt!
  if (/(Cửu Vĩ|Thiên Hồ|U Hồ|Tiểu Hồ|Linh Hồ|Tuyết Hồ|Diễm Hồ|Ngọc Hồ|Tinh Hồ|Vạn Tượng Hồ|Lôi Đế Hồ|Mạn Châu Hồ|Huyền Hồ|Tuế Hồ|Bạch Vĩ Hồ|Hồng Hồ|Kim Hồ)/.test(name)) {
    return 'fox';
  }
  if (/(Hổ|Báo|Kiếm Hổ|Bạch Hổ|Minh Hổ|Kim Hổ)/.test(name)) {
    return 'tiger_leopard';
  }
  if (/(Long|Ấu Xà|Xà|Chúc Long|Tổ Long)/.test(name)) {
    return 'dragon';
  }
  if (/(Phượng|Điểu|Tước|Ưng|Loan|Kim Ô|Thiên Nga|Hạc|Linh Nha|Huyết Nha|Yến|Diều)/.test(name)) {
    return 'phoenix_bird';
  }
  if (/(Quy|Ngao)/.test(name)) {
    return 'turtle_snake';
  }
  if (/(Lang|Khuyển|Dạ Thao)/.test(name)) {
    return 'wolf';
  }
  if (/(Kỳ Lân|Lân|Lộc|Thiên Mã|Bạch Trạch|Thần Trạch|Ngưu)/.test(name)) {
    return 'qilin_deer_horse';
  }
  if (/(Miêu|Thỏ|Thố|Điệp)/.test(name)) {
    return 'cat_rabbit_butterfly';
  }
  return 'lion_ape_bear_stone';
}

for (const p of PET_CATALOG) {
  ARCHETYPE_BY_PET_TYPE.set(p.pet_type, classifyPetArchetypeFromMeta(p));
}

export function getPetArchetype(petOrType) {
  const petType = typeof petOrType === 'string' ? petOrType : (petOrType?.pet_type || '');
  if (ARCHETYPE_BY_PET_TYPE.has(petType)) return ARCHETYPE_BY_PET_TYPE.get(petType);
  return classifyPetArchetypeFromMeta(PET_BY_TYPE[petType]);
}

export function resolveBondScaleForPet(petOrType, isEvolved = false) {
  const petType = typeof petOrType === 'string' ? petOrType : (petOrType?.pet_type || '');
  const meta = PET_BY_TYPE[petType] || {};
  const evolvedFlag = Boolean(isEvolved || (typeof petOrType === 'object' && petOrType?.is_evolved));
  if (meta.is_unique || evolvedFlag || meta.is_exclusive_fuyumi || meta.rarity_key === 'supreme') {
    return PET_BOND_SCALES.supreme;
  }
  const rk = String(meta.rarity_key || (typeof petOrType === 'object' ? petOrType?.rarity_key : '') || 'common');
  if (rk === 'mythic') return PET_BOND_SCALES.mythic;
  if (rk === 'epic') return PET_BOND_SCALES.epic;
  if (rk === 'rare') return PET_BOND_SCALES.rare;
  return PET_BOND_SCALES.common;
}

export function computeBondTierState(petRowOrType, rawPoints = null, isEvolved = null) {
  const petObj = typeof petRowOrType === 'object' && petRowOrType ? petRowOrType : null;
  const petType = petObj ? petObj.pet_type : String(petRowOrType || '');
  const evolved = isEvolved !== null ? Boolean(isEvolved) : Boolean(petObj?.is_evolved);
  const scale = resolveBondScaleForPet(petType, evolved);
  const points = Math.max(0, Math.min(scale.maxPoints, Math.floor(Number(rawPoints ?? petObj?.affection_points ?? 0) || 0)));

  let tier = 0;
  for (let i = 1; i <= scale.maxTier; i += 1) {
    if (points >= scale.thresholds[i]) tier = i;
  }

  let tierLabel = scale.tierNames[tier] || scale.tierNames[0];
  if (petType === 'cuu_vi_hong_ho' && tier >= scale.maxTier) {
    tierLabel = 'Vĩnh Hằng Thủ Hộ';
  }

  const nextThreshold = tier < scale.maxTier ? scale.thresholds[tier + 1] : scale.maxPoints;
  const prevThreshold = scale.thresholds[tier] || 0;
  const span = Math.max(1, nextThreshold - prevThreshold);
  const progressRatio = tier >= scale.maxTier ? 1 : Math.max(0, Math.min(1, (points - prevThreshold) / span));

  return {
    scaleKey: scale.key,
    scaleLabel: scale.label,
    points,
    maxPoints: scale.maxPoints,
    tier,
    maxTier: scale.maxTier,
    tierLabel,
    isMaxTier: tier >= scale.maxTier,
    prevThreshold,
    nextThreshold,
    pointsToNext: Math.max(0, nextThreshold - points),
    progressRatio,
  };
}

export function computeBondBuffsForTier(tier, petOrType = null, isEvolved = false) {
  const t = Math.max(0, Math.min(10, Math.floor(Number(tier) || 0)));
  const petObj = typeof petOrType === 'object' && petOrType ? petOrType : null;
  const petType = petObj ? petObj.pet_type : String(petOrType || '');
  const meta = PET_BY_TYPE[petType] || {};
  const evolved = Boolean(isEvolved || petObj?.is_evolved);
  const isFuyumi = petType === 'cuu_vi_hong_ho' || Boolean(meta.is_exclusive_fuyumi);

  let autoFarmChancePct = 0;
  if ((evolved || isFuyumi) && t >= 10) autoFarmChancePct = 100;
  else if (t >= 9) autoFarmChancePct = 75;
  else if (t >= 8) autoFarmChancePct = 60;
  else if (t >= 7) autoFarmChancePct = 45;
  else if (t >= 6) autoFarmChancePct = 35;
  else if (t >= 5) autoFarmChancePct = 25;

  const scaleKey = petType ? resolveBondScaleForPet(petType, evolved).key : 'supreme';
  let companionTtChancePct = 0;
  if (t >= 10) companionTtChancePct = 12;
  else if (t >= 8) companionTtChancePct = 9;
  else if (t >= 6) companionTtChancePct = 5;

  let companionChaosChancePct = 0;
  if (t >= 10) companionChaosChancePct = 4;
  else if (t >= 9) companionChaosChancePct = 2.5;
  else if (t >= 8) companionChaosChancePct = 1.5;

  let companionEvoChancePct = 0;
  if ((scaleKey === 'mythic' || scaleKey === 'supreme') && t >= 9) {
    companionEvoChancePct = t >= 10 ? 0.5 : 0.15;
  }

  return {
    tier: t,
    petPowerPct: +(t * 4).toFixed(1), // tối đa +40% (cộng dồn additive cùng Role/Couple)
    petExpPct: +(t * 3).toFixed(1), // tối đa +30% (CHỈ dùng cho Pet EXP /upgrade)
    explorerSurvivePct: +(t * 1.5).toFixed(1), // tối đa +15%
    userExpPct: +(t * 5).toFixed(1), // tối đa +50% (Chat/Voice/Job)
    allSourceLtPct: +(t * 1.5).toFixed(1), // tối đa +15% (trừ minigames/dismantle/exchange/tangqua)
    autoFarmChancePct,
    companionLtUnlock: t >= 4,
    companionTtChancePct,
    companionChaosChancePct,
    companionEvoChancePct,
  };
}

export function getAiChatDailyLimitForPet(petRowOrType) {
  const petObj = typeof petRowOrType === 'object' && petRowOrType ? petRowOrType : null;
  const petType = petObj ? petObj.pet_type : String(petRowOrType || '');
  const meta = PET_BY_TYPE[petType] || {};
  const evolved = Boolean(petObj?.is_evolved);
  if (petType === 'cuu_vi_hong_ho' || meta.is_exclusive_fuyumi) return Infinity;
  if (meta.is_unique || evolved || meta.rarity_key === 'supreme') return 10;
  if (meta.rarity_key === 'mythic') return 5;
  return 0;
}

export function getBondFrameIdForPet(petType) {
  return V18_BOND_FRAME_BY_PET[String(petType || '')]?.frame_id || null;
}

export { ARCHETYPE_BY_PET_TYPE };
