/**
 * src/data/v161AlchemyCatalog.js
 * Catalog & hằng số cho Bản Cập Nhật v1.6.1 — Hệ Thống Lò Luyện Đan (/luyendan).
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows — chỉ sử dụng Discord custom emojis từ emojiHelper.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_BASE_URL } from './catalog.js';
import { em, uiEm, farmEmoji } from '../config/emojiHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ASSETS_ALCHEMY_DIR = path.resolve(__dirname, '..', '..', 'assets', 'alchemy');

export const ALCHEMY_DAILY_LIMIT = 6;
export const ALCHEMY_SLOT2_FREE_LEVEL = 45;
export const ALCHEMY_SLOT2_UNLOCK_COST = 2500;
export const ALCHEMY_BURN_PAYOUT_LT = 30;
export const ALCHEMY_EXPLODE_LOCK_HOURS = 4;
export const ALCHEMY_INSTANT_REPAIR_COST = 300;
export const ALCHEMY_DM_WARN_MINUTES = 10;
export const ALCHEMY_EXPLODED_IMAGE = 'furnace_exploded.webp';

export const FURNACE_TIERS = [
  {
    level: 1,
    name: 'Thổ Đào Dược Đỉnh',
    upgradeCostLt: 0,
    minBatches: 0,
    ltBonusPct: 0,
    timeReducePct: 0,
    graceMin: 20,
    superiorPct: 10,
    cloudPct: 3,
    image: 'furnace_lv1.webp',
    explodedImage: 'furnace_lv1_exploded.webp',
    emojiKey: 'furnace_lv1',
    explodedEmojiKey: 'furnace_lv1_exploded',
    badgeEm: 'su_sprout',
  },
  {
    level: 2,
    name: 'Thanh Đồng Đan Lô',
    upgradeCostLt: 1200,
    minBatches: 5,
    ltBonusPct: 6,
    timeReducePct: 5,
    graceMin: 30,
    superiorPct: 14,
    cloudPct: 5,
    image: 'furnace_lv2.webp',
    explodedImage: 'furnace_lv2_exploded.webp',
    emojiKey: 'furnace_lv2',
    explodedEmojiKey: 'furnace_lv2_exploded',
    badgeEm: 'su_el_moc',
  },
  {
    level: 3,
    name: 'Xích Hỏa Huyền Đỉnh',
    upgradeCostLt: 3000,
    minBatches: 15,
    ltBonusPct: 12,
    timeReducePct: 10,
    graceMin: 40,
    superiorPct: 18,
    cloudPct: 7,
    image: 'furnace_lv3.webp',
    explodedImage: 'furnace_lv3_exploded.webp',
    emojiKey: 'furnace_lv3',
    explodedEmojiKey: 'furnace_lv3_exploded',
    badgeEm: 'su_el_hoa',
  },
  {
    level: 4,
    name: 'Tử Kim Long Văn Lô',
    upgradeCostLt: 6500,
    minBatches: 30,
    ltBonusPct: 18,
    timeReducePct: 15,
    graceMin: 50,
    superiorPct: 22,
    cloudPct: 10,
    image: 'furnace_lv4.webp',
    explodedImage: 'furnace_lv4_exploded.webp',
    emojiKey: 'furnace_lv4',
    explodedEmojiKey: 'furnace_lv4_exploded',
    badgeEm: 'su_el_kim',
  },
  {
    level: 5,
    name: 'Hỗn Độn Cửu Chuyển Đỉnh',
    upgradeCostLt: 12000,
    minBatches: 55,
    ltBonusPct: 25,
    timeReducePct: 20,
    graceMin: 60,
    superiorPct: 28,
    cloudPct: 14,
    image: 'furnace_lv5.webp',
    explodedImage: 'furnace_lv5_exploded.webp',
    emojiKey: 'furnace_lv5',
    explodedEmojiKey: 'furnace_lv5_exploded',
    badgeEm: 'su_el_hondon',
  },
];

export const FURNACE_BY_LEVEL = Object.fromEntries(FURNACE_TIERS.map((t) => [t.level, t]));

export const ALCHEMY_RECIPES = [
  {
    id: 'pill_t1',
    tierLabel: 'Bậc 1',
    name: 'Tụ Khí Thanh Đan',
    minLevel: 1,
    altFurnaceLevel: 1,
    costLt: 14,
    costEssence: 0,
    durationMin: 60,
    minLt: 160,
    maxLt: 200,
    exp: 20,
    image: 'pill_t1.webp',
    iconKey: 'pill_t1',
  },
  {
    id: 'pill_t2',
    tierLabel: 'Bậc 2',
    name: 'Trúc Cơ Ngọc Lộ Đan',
    minLevel: 15,
    altFurnaceLevel: 2,
    costLt: 35,
    costEssence: 0,
    durationMin: 75,
    minLt: 240,
    maxLt: 290,
    exp: 30,
    image: 'pill_t2.webp',
    iconKey: 'pill_t2',
  },
  {
    id: 'pill_t3',
    tierLabel: 'Bậc 3',
    name: 'Kim Đan Hỏa Linh Đan',
    minLevel: 35,
    altFurnaceLevel: 3,
    costLt: 56,
    costEssence: 0,
    durationMin: 95,
    minLt: 340,
    maxLt: 400,
    exp: 45,
    image: 'pill_t3.webp',
    iconKey: 'pill_t3',
  },
  {
    id: 'pill_t4',
    tierLabel: 'Bậc 4',
    name: 'Nguyên Anh Cửu Chuyển Đan',
    minLevel: 60,
    altFurnaceLevel: 4,
    costLt: 84,
    costEssence: 0,
    durationMin: 120,
    minLt: 420,
    maxLt: 500,
    exp: 65,
    image: 'pill_t4.webp',
    iconKey: 'pill_t4',
  },
  {
    id: 'pill_ess_1',
    tierLabel: 'Tinh Hoa I',
    name: 'Linh Quả Thanh Tâm Đan',
    minLevel: 35,
    altFurnaceLevel: null,
    costLt: 56,
    costEssence: 28,
    durationMin: 105,
    minLt: 470,
    maxLt: 530,
    exp: 60,
    image: 'pill_ess_1.webp',
    iconKey: 'pill_ess_1',
  },
  {
    id: 'pill_ess_2',
    tierLabel: 'Tinh Hoa II',
    name: 'Hồng Mông Tạo Hóa Đan',
    minLevel: 60,
    altFurnaceLevel: null,
    costLt: 84,
    costEssence: 56,
    durationMin: 120,
    minLt: 540,
    maxLt: 600,
    exp: 80,
    image: 'pill_ess_2.webp',
    iconKey: 'pill_ess_2',
  },
];

export const ALCHEMY_RECIPE_BY_ID = Object.fromEntries(ALCHEMY_RECIPES.map((r) => [r.id, r]));

export const PILL_QUALITIES = {
  normal: {
    key: 'normal',
    label: 'Thành Đan',
    multiplier: 1.0,
    color: '#10b981',
  },
  superior: {
    key: 'superior',
    label: 'Thượng Phẩm',
    multiplier: 1.25,
    color: '#3b82f6',
  },
  cloud: {
    key: 'cloud',
    label: 'Đan Vân Cực Phẩm',
    multiplier: 1.5,
    color: '#f59e0b',
  },
};

export function getFurnaceTier(level) {
  const lv = Math.min(5, Math.max(1, Number(level) || 1));
  return FURNACE_BY_LEVEL[lv] || FURNACE_TIERS[0];
}

export function computeBrewDurationMs(recipe, furnaceLevel) {
  const tier = getFurnaceTier(furnaceLevel);
  const factor = Math.max(0.1, 1 - Number(tier.timeReducePct || 0) / 100);
  return Math.round(Number(recipe.durationMin || 60) * 60000 * factor);
}

export function computeGraceMs(furnaceLevel) {
  const tier = getFurnaceTier(furnaceLevel);
  return Number(tier.graceMin || 20) * 60000;
}

export function checkRecipeUnlock(recipe, userLevel, furnaceLevel) {
  const lv = Math.max(1, Number(userLevel) || 1);
  const flv = Math.min(5, Math.max(1, Number(furnaceLevel) || 1));
  const byLevel = lv >= Number(recipe.minLevel || 1);
  const byFurnace = recipe.altFurnaceLevel != null && flv >= Number(recipe.altFurnaceLevel);
  return {
    unlocked: byLevel || byFurnace,
    byLevel,
    byFurnace,
    requirementText: recipe.altFurnaceLevel
      ? `Lv.${recipe.minLevel} hoặc Lò Lv.${recipe.altFurnaceLevel}`
      : `Lv.${recipe.minLevel}`,
  };
}

export function resolveAlchemyImageUrl(filename) {
  const clean = String(filename || '').trim();
  if (!clean) return '';
  const fullPath = path.join(ASSETS_ALCHEMY_DIR, clean);
  if (fs.existsSync(fullPath)) {
    return `${PUBLIC_BASE_URL}/assets/alchemy/${clean}?v=1.6.1`;
  }
  return '';
}

export function resolveExplodedFurnaceImageUrl(furnaceLevel) {
  const tier = getFurnaceTier(furnaceLevel);
  if (tier?.explodedImage) {
    const perLevel = resolveAlchemyImageUrl(tier.explodedImage);
    if (perLevel) return perLevel;
  }
  return resolveAlchemyImageUrl(ALCHEMY_EXPLODED_IMAGE);
}

export function alchemyIcon(key) {
  if (key === 'farm_essence') return farmEmoji('farm_essence') || em('su_sprout');
  if (key === 'ui_warn') return uiEm('ui_warn') || em('su_sparkle');
  if (key === 'ui_clock_timer') return uiEm('ui_clock_timer') || em('su_sparkle');
  return em(key) || em('su_sparkle') || '';
}
