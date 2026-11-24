/**
 * src/services/explorerService.js
 * Hệ thống Khám Phá Bản Đồ Đại Lục SuMi (/explorer — v1.4):
 * - 12 Địa danh (10k -> 1M lực chiến, Dễ -> Nightmare), 4 mốc giờ (2/3/6/12h).
 * - Đội hình Khám Phá (Loadout) riêng: 1 Pet (chính hoặc phụ) + 3 Pháp Bảo + 1 Linh Vực (kèm Thần Thức/Thần Cảnh).
 * - Khóa tài sản chặt (Pet + Pháp Bảo + Linh Vực đang đi khám phá không dùng được ở PvP/PvE/Tháp/Địa Mạch/Phá/Khắc/Tặng).
 * - Công thức sống sót:
 *   + P >= M: 90% + 5% mỗi +10% cách biệt lực (+Thức Ăn A +8%), trần 100%.
 *   + P < M: chết từ 20% + 10% mỗi -10% thua lực (-Thức Ăn A -8%), trần 95%.
 * - Tử vong:
 *   + Pet thường/Thần Thoại không Độc Nhất: mất vĩnh viễn (mất con cuối tự cấp 1 Pet Phàm khởi đầu Lv.1).
 *   + Pet Độc Nhất: chuyển 'injured', hồi sinh bằng Cửu Chuyển Hoàn Hồn Lộ (explorer_revive_elixir).
 *   + Cả 3 Pháp Bảo không Độc Nhất: rớt tại đúng tọa độ map + mốc giờ -> người sau đi qua cùng vị trí & giờ >= mà sống sót có 60% nhặt được (giữ nguyên bậc Khắc Ấn)!
 *   + Pháp Bảo Độc Nhất & Linh Vực: an toàn tuyệt đối, bay về kho chủ nhân.
 */

import { supabase } from '../config/supabase.js';
import {
  PET_CATALOG,
  PET_BY_TYPE,
  EQUIPMENT_CATALOG,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  MYTHIC_UNIQUE_PET_TYPES,
  MYTHIC_UNIQUE_ITEM_IDS,
  PUBLIC_BASE_URL,
  getEnchantBonusPct,
  getEnchantMultiplier,
  normalizeEnchantGrade,
  computeCosmeticBuffTotals,
} from '../data/catalog.js';
import {
  V14_EXPLORER_MAPS,
  V14_EXPLORER_MAP_BY_ID,
  V14_CONSUMABLES,
} from '../data/v14ExpansionCatalog.js';
import { em, petEmoji, itemEmoji, gradeEmoji, domainEmoji, tierEmoji, uiEm } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  computeRoleBuffTotals,
} from './profileService.js';
import { computeMarriageBuffs } from './marryService.js';
import { trackQuestActivity } from './questService.js';
import { getEffectiveLuckAndFortune } from './luckAndFortuneService.js';
import { evaluateSetBonus, DOMAIN_TO_PET_ELEMENTS } from './battleEngine/setBonusEngine.js';

export const VALID_EXPLORER_DURATIONS = [2, 3, 6, 12];
export const EXPLORER_FOOD_EFFECTS = {
  food_survival_pill: { label: 'Hộ Mệnh Linh Đan (+8% Sống Sót)', survivalBonus: 0.08, yieldBonus: 0, timeReduction: 0 },
  food_yield_tea: { label: 'Tụ Bảo Tiên Trà (+18% Linh Thạch)', survivalBonus: 0, yieldBonus: 0.18, timeReduction: 0 },
  food_speed_fruit: { label: 'Ngự Phong Tốc Quả (-25% Thời Gian)', survivalBonus: 0, yieldBonus: 0, timeReduction: 0.25 },
};
export const EXPLORER_TERRAIN_SURVIVAL_BONUS = 0.06;
export const EXPLORER_TERRAIN_YIELD_BONUS = 0.10;
export const EXPLORER_BASE_LT_PER_HOUR_MIN = 210; // +5% so với 200 cũ
export const EXPLORER_BASE_LT_PER_HOUR_MAX = 315; // +5% so với 300 cũ

export function evaluateExplorerTerrainBonus(mapDef, petOrType = null, domainOrIds = null) {
  const favored = Array.isArray(mapDef?.favored_elements) ? mapDef.favored_elements : [];
  if (favored.length === 0) {
    return { active: false, survivalBonus: 0, yieldBonus: 0, matchedElements: [], favoredElements: [] };
  }

  const matched = new Set();
  let petElem = '';
  if (typeof petOrType === 'string') {
    petElem = PET_BY_TYPE[petOrType]?.element || '';
  } else if (petOrType && typeof petOrType === 'object') {
    petElem = petOrType.element || PET_BY_TYPE[petOrType.pet_type || petOrType.type]?.element || '';
  }
  if (petElem && favored.includes(petElem)) {
    matched.add(petElem);
  }

  const domainCandidates = [];
  if (Array.isArray(domainOrIds)) {
    for (const id of domainOrIds) {
      if (id && DOMAIN_BY_ID[id]) domainCandidates.push(DOMAIN_BY_ID[id]);
    }
  } else if (typeof domainOrIds === 'string' && DOMAIN_BY_ID[domainOrIds]) {
    domainCandidates.push(DOMAIN_BY_ID[domainOrIds]);
  } else if (domainOrIds && typeof domainOrIds === 'object') {
    const did = domainOrIds.entity_id || domainOrIds.domain_id || domainOrIds.id;
    const cat = did && DOMAIN_BY_ID[did] ? DOMAIN_BY_ID[did] : domainOrIds;
    if (cat?.element) domainCandidates.push(cat);
  }

  for (const dom of domainCandidates) {
    const mapped = DOMAIN_TO_PET_ELEMENTS[String(dom?.element || '').trim()] || [];
    for (const el of mapped) {
      if (favored.includes(el)) matched.add(el);
    }
  }

  const active = matched.size > 0;
  return {
    active,
    survivalBonus: active ? EXPLORER_TERRAIN_SURVIVAL_BONUS : 0,
    yieldBonus: active ? EXPLORER_TERRAIN_YIELD_BONUS : 0,
    matchedElements: Array.from(matched),
    favoredElements: favored,
  };
}

const explorerLocks = new Map();
const memUiSelections = new Map();

async function withExplorerLock(userId, fn) {
  const prev = explorerLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  explorerLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (explorerLocks.get(userId) === queued) explorerLocks.delete(userId);
  }
}

/**
 * Công thức sống sót & tử vong /explorer:
 * - Lực >= Map: 90% (+5% mỗi +10% vượt trội, tối đa 100% ở >= 120%; +8% từ Hộ Mệnh Linh Đan).
 * - 50% < Lực/Map < 100%: Giảm tuyến tính mượt từ 80% xuống >0% (+8% từ Hộ Mệnh Linh Đan, cap 88%).
 * - Lực <= 50% Map (thua >= 2x lực chiến): Chắc chắn 0% sống sót (100% tử vong), Hộ Mệnh Linh Đan không thể cứu.
 */
export function computeExplorerSurvival(petPowerRaw, mapPowerRaw, foodId = null, terrainBonus = 0) {
  const petPower = Math.max(0, Number(petPowerRaw) || 0);
  const mapPower = Math.max(1, Number(mapPowerRaw) || 10000);
  const foodCfg = foodId ? EXPLORER_FOOD_EFFECTS[foodId] : null;
  const foodBonus = Number(foodCfg?.survivalBonus || 0);
  const tBonus = Math.max(0, Number(terrainBonus) || 0);

  if (petPower >= mapPower) {
    const diffRatio = (petPower - mapPower) / mapPower;
    const diffSteps = Math.floor(diffRatio / 0.10 + 1e-9);
    const survivalRate = Math.min(1.0, Math.max(0.05, 0.90 + diffSteps * 0.05 + foodBonus + tBonus));
    return {
      survivalRate: Number(survivalRate.toFixed(4)),
      deathRate: Number((1 - survivalRate).toFixed(4)),
      survivalPct: Math.round(survivalRate * 100),
      deathPct: Math.round((1 - survivalRate) * 100),
      advantage: true,
      tooWeak: false,
      diffSteps,
    };
  }

  const ratio = petPower / mapPower;
  const deficitRatio = (mapPower - petPower) / mapPower;
  const diffSteps = Math.floor(deficitRatio / 0.10 + 1e-9);

  if (ratio <= 0.50 + 1e-9) {
    return {
      survivalRate: 0,
      deathRate: 1,
      survivalPct: 0,
      deathPct: 100,
      advantage: false,
      tooWeak: true,
      diffSteps,
    };
  }

  const baseSurvival = Math.max(0.01, 0.80 * ((ratio - 0.50) / 0.50));
  const maxCap = Math.min(0.94, 0.88 + tBonus);
  const survivalRate = Math.min(maxCap, Math.max(0.01, baseSurvival + foodBonus + tBonus));
  const deathRate = Math.max(0.0, 1.0 - survivalRate);
  return {
    survivalRate: Number(survivalRate.toFixed(4)),
    deathRate: Number(deathRate.toFixed(4)),
    survivalPct: Math.round(survivalRate * 100),
    deathPct: Math.round(deathRate * 100),
    advantage: false,
    tooWeak: false,
    diffSteps,
  };
}

function formatSurvivalSuffix(surv) {
  return surv.tooWeak ? ` ${uiEm('ui_skull_ko')} *(Quá yếu so với map — chắc chắn tử nạn!)*` : '';
}

function explorerError(status, error, title, message, extra = {}) {
  return {
    success: false,
    status,
    error,
    title,
    description: message,
    message,
    ...extra,
  };
}

/**
 * Tính tổng lực chiến cho 1 bộ Loadout Khám Phá (Pet + 3 Pháp Bảo + Linh Vực),
 * đồng bộ 100% công thức Chiến Lực của /profile (Khắc Ấn, Pháp Bảo, Hôn Nhân, Role/Cảnh Giới).
 */
export function computeExplorerLoadoutPower(petRow, equipRows = [], domainRow = null, buffContext = {}) {
  if (!petRow) return 0;
  const petGrade = normalizeEnchantGrade(petRow.enchant_grade || 'D');
  const petMult = getEnchantMultiplier(petGrade);

  const rawBaseAtk = Number(petRow.atk) || 0;
  const rawBaseDef = Number(petRow.def) || 0;
  const rawBaseSpd = Number(petRow.spd) || 0;

  let basePower = 0;
  if (rawBaseAtk === 0 && rawBaseDef === 0 && rawBaseSpd === 0 && Number(petRow.power_score) > 0) {
    basePower = Math.round(Number(petRow.power_score) * petMult);
  } else {
    const baseAtk = Math.round(rawBaseAtk * petMult);
    const baseDef = Math.round(rawBaseDef * petMult);
    const baseSpd = Math.round(rawBaseSpd * petMult);
    const petLvl = Math.max(1, Number(petRow.level) || 1);
    const computedBasePower = baseAtk * 3 + baseDef * 2 + baseSpd * 2 + petLvl * 50;
    basePower = petRow.pet_type === 'cuu_vi_hong_ho' && Number(petRow.power_score) > computedBasePower
      ? Math.round(Number(petRow.power_score) * petMult)
      : computedBasePower;
  }

  let bonusAtk = 0;
  let bonusDef = 0;
  let bonusSpd = 0;
  let bonusHp = 0;
  const eqBySlot = {};
  for (const eq of equipRows || []) {
    if (!eq) continue;
    const def = EQUIPMENT_BY_ID[eq.item_id];
    if (!def) continue;
    eqBySlot[def.item_type] = def;
    const itemMult = getEnchantMultiplier(normalizeEnchantGrade(eq.enchant_grade || 'D'));
    bonusAtk += Math.round((Number(def.bonus_atk) || 0) * itemMult);
    bonusDef += Math.round((Number(def.bonus_def) || 0) * itemMult);
    bonusSpd += Math.round((Number(def.bonus_spd) || 0) * itemMult);
    bonusHp += Math.round((Number(def.bonus_hp) || 0) * itemMult);
  }

  const bonusPower = (bonusAtk * 3) + (bonusDef * 2) + (bonusSpd * 2) + Math.floor(bonusHp * 0.5);
  const rawTotalPower = basePower + bonusPower;

  const couplePowerPct = Number(buffContext?.couplePowerPct || 0);
  const couplePowerBonus = couplePowerPct > 0 ? Math.round(rawTotalPower * (couplePowerPct / 100)) : 0;
  let finalPower = rawTotalPower + couplePowerBonus;

  const rolePetPowerPct = Number(buffContext?.rolePetPowerPct || 0);
  if (rolePetPowerPct > 0) {
    finalPower = Math.round(finalPower * (1 + rolePetPowerPct / 100));
  }

  const petCatalog = PET_BY_TYPE[petRow.pet_type || petRow.type] || null;
  const domId = domainRow?.entity_id || domainRow?.domain_id || null;
  const domCatalog = domId ? DOMAIN_BY_ID[domId] : (domainRow?.element ? domainRow : null);
  const setBonus = evaluateSetBonus({
    pet: {
      element: petRow.element || petCatalog?.element || '',
      rarity_key: petCatalog?.rarity_key || petRow.rarity_key || 'common',
    },
    equipment: eqBySlot,
    domainLoadout: { domain: domCatalog || null },
  });
  if (setBonus.statBonusPct > 0) {
    finalPower = Math.round(finalPower * (1 + setBonus.statBonusPct / 100));
  }

  return Math.max(100, Math.round(finalPower));
}

/**
 * Helper tập trung kiểm tra toàn bộ tài sản đang bị khóa bởi chuyến khám phá đang chạy của user.
 * Được dùng bởi /battle, /nhiemvu tower, /linhmach, /equip, /unequip, /dismantle, /enchant, /tangqua, /linhthu!
 */
export async function getUserBusyExplorationAssets(userId) {
  const cleanId = sanitizeUserId(userId || '');
  const empty = {
    isExploring: false,
    expedition: null,
    busyPetId: null,
    busyPetType: null,
    busyEquipIds: new Set(),
    busyDomainIds: new Set(),
  };
  if (!cleanId || !supabase) return empty;

  const { data: exp } = await supabase
    .from('explorer_expeditions')
    .select('*')
    .eq('user_id', cleanId)
    .eq('status', 'active')
    .maybeSingle();

  if (!exp) return empty;
  return {
    isExploring: true,
    expedition: exp,
    busyPetId: exp.pet_id ? String(exp.pet_id) : null,
    busyPetType: exp.pet_type || null,
    busyEquipIds: new Set((Array.isArray(exp.locked_equip_ids) ? exp.locked_equip_ids : []).map(String)),
    busyDomainIds: new Set((Array.isArray(exp.locked_domain_ids) ? exp.locked_domain_ids : []).map(String)),
  };
}

async function saveUiState(userId, patch) {
  const cur = await loadUiState(userId);
  const next = {
    user_id: userId,
    selected_duration: patch.selected_duration ?? cur.selected_duration ?? 2,
    selected_map_id: patch.selected_map_id !== undefined ? patch.selected_map_id : (cur.selected_map_id ?? null),
    selected_food_id: patch.selected_food_id !== undefined ? patch.selected_food_id : (cur.selected_food_id ?? null),
    draft_pet_id: patch.draft_pet_id !== undefined ? patch.draft_pet_id : (cur.draft_pet_id ?? null),
    draft_weapon_id: patch.draft_weapon_id !== undefined ? patch.draft_weapon_id : (cur.draft_weapon_id ?? null),
    draft_gem_id: patch.draft_gem_id !== undefined ? patch.draft_gem_id : (cur.draft_gem_id ?? null),
    draft_soul_id: patch.draft_soul_id !== undefined ? patch.draft_soul_id : (cur.draft_soul_id ?? null),
    draft_domain_id: patch.draft_domain_id !== undefined ? patch.draft_domain_id : (cur.draft_domain_id ?? null),
    updated_at: new Date().toISOString(),
  };
  memUiSelections.set(userId, next);
  if (supabase) {
    try {
      await supabase.from('explorer_ui_selections').upsert(next, { onConflict: 'user_id' });
    } catch { /* fallback to mem */ }
  }
  return next;
}

async function loadUiState(userId) {
  if (supabase) {
    try {
      const { data } = await supabase.from('explorer_ui_selections').select('*').eq('user_id', userId).maybeSingle();
      if (data) return data;
    } catch { /* fallback */ }
  }
  return memUiSelections.get(userId) || { selected_duration: 2, selected_map_id: null, selected_food_id: null };
}

function formatDurationLeft(endsAtIso, now = new Date()) {
  const diffSec = Math.max(0, Math.floor((new Date(endsAtIso).getTime() - now.getTime()) / 1000));
  if (diffSec === 0) return 'Đã hoàn thành — Bấm Nhận Quà ngay!';
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${h} giờ ${m} phút ${s} giây`;
}

async function resolveUserLoadoutDetails(userId) {
  const [{ data: loadoutRow }, { data: pets }, { data: equipRows }, { data: domainRows }, { data: userRow }] = await Promise.all([
    supabase.from('explorer_loadouts').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_pets').select('*').eq('user_id', userId).order('power_score', { ascending: false }),
    supabase.from('user_pet_items').select('*').eq('user_id', userId),
    supabase.from('user_domains').select('*').eq('user_id', userId),
    supabase.from('users').select('level, marry_user_id, marry_ring_id, marry_date').eq('user_id', userId).maybeSingle(),
  ]);

  const userLevel = Number(userRow?.level || 1);
  let couplePowerPct = 0;
  if (userRow?.marry_user_id) {
    const mBuffs = computeMarriageBuffs(userRow.marry_ring_id || 'ring_common', userRow.marry_date);
    couplePowerPct = Number(mBuffs?.total_power_bonus_pct || 0);
  }
  const roleBuffs = await computeRoleBuffTotals(userId, userLevel);
  const buffContext = {
    couplePowerPct,
    rolePetPowerPct: Number(roleBuffs?.petPowerBonusPct || 0),
  };

  const allPets = pets || [];
  const allEquip = equipRows || [];
  const allDomains = domainRows || [];

  const hasSavedLoadout = Boolean(loadoutRow?.pet_id);
  const findEqById = (itemId, type) => {
    if (!itemId) return null;
    return allEquip.find((e) => e.item_id === itemId && EQUIPMENT_BY_ID[e.item_id]?.item_type === type) || null;
  };
  const findEquippedSlot = (slotType) =>
    allEquip.find((e) => String(e.slot || '').toLowerCase() === slotType) || null;

  let chosenPet = null;
  let weapon = null;
  let gem = null;
  let soul = null;
  let domain = null;
  let sense = null;
  let realm = null;

  if (hasSavedLoadout) {
    chosenPet = allPets.find((p) => String(p.pet_id) === String(loadoutRow.pet_id)) || null;
    if (!chosenPet) {
      chosenPet = allPets.find((p) => p.is_active && p.status === 'ready')
        || allPets.find((p) => p.status === 'ready')
        || allPets[0]
        || null;
    }
    weapon = findEqById(loadoutRow?.weapon_id, 'weapon');
    gem = findEqById(loadoutRow?.gem_id, 'gem');
    soul = findEqById(loadoutRow?.soul_id, 'soul');
    domain = loadoutRow?.domain_id
      ? allDomains.find((d) => d.entity_kind === 'domain' && d.entity_id === loadoutRow.domain_id) || null
      : null;
    sense = loadoutRow?.sense_id
      ? allDomains.find((d) => d.entity_kind === 'sense' && d.entity_id === loadoutRow.sense_id) || null
      : null;
    realm = loadoutRow?.realm_id
      ? allDomains.find((d) => d.entity_kind === 'realm' && d.entity_id === loadoutRow.realm_id) || null
      : null;
  } else {
    // Mặc định dùng Pet Chính đang xuất trận + 3 Pháp Bảo đang mặc + Linh Vực / Thần Thức / Thần Cảnh đang trang bị
    chosenPet = allPets.find((p) => p.is_active && p.status === 'ready')
      || allPets.find((p) => p.is_active)
      || allPets.find((p) => p.status === 'ready')
      || allPets[0]
      || null;
    weapon = findEquippedSlot('weapon');
    gem = findEquippedSlot('gem');
    soul = findEquippedSlot('soul');
    domain = allDomains.find((d) => d.entity_kind === 'domain' && d.is_equipped) || null;
    sense = allDomains.find((d) => d.entity_kind === 'sense' && d.is_equipped) || null;
    realm = allDomains.find((d) => d.entity_kind === 'realm' && d.is_equipped) || null;
  }

  const power = computeExplorerLoadoutPower(chosenPet, [weapon, gem, soul].filter(Boolean), domain, buffContext);
  return {
    hasSavedLoadout,
    loadoutRow,
    chosenPet,
    weapon,
    gem,
    soul,
    domain,
    sense,
    realm,
    power,
    buffContext,
    allPets,
    allEquip,
    allDomains,
  };
}

/**
 * Trung Tâm Khám Phá (/explorer — 0 tham số slash).
 */
export async function getExplorerHub(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI KHÁM PHÁ`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
  });

  const now = opts.now instanceof Date ? opts.now : new Date();
  const [busy, details, { data: invFoods }] = await Promise.all([
    getUserBusyExplorationAssets(cleanId),
    resolveUserLoadoutDetails(cleanId),
    supabase
      .from('user_inventory')
      .select('item_id, quantity')
      .eq('user_id', cleanId)
      .in('item_id', ['food_survival_pill', 'food_yield_tea', 'food_speed_fruit', 'explorer_revive_elixir']),
  ]);

  const foodCounts = Object.fromEntries((invFoods || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
  const injuredPets = details.allPets.filter((p) => p.status === 'injured');

  const petLine = details.chosenPet
    ? `${petEmoji(details.chosenPet.pet_type)} **${details.chosenPet.pet_name}** *(Lv.${details.chosenPet.level} • ${details.chosenPet.star}★ • ${details.chosenPet.is_active ? 'Pet Chính' : 'Pet Phụ'})*`
    : '*Chưa chọn Linh Thú*';
  const eqLine = [details.weapon, details.gem, details.soul]
    .filter(Boolean)
    .map((e) => `${itemEmoji(e.item_id)} ${EQUIPMENT_BY_ID[e.item_id]?.item_name || e.item_id} (${gradeEmoji(e.enchant_grade)}${e.enchant_grade})`)
    .join(' • ') || '*Chưa gắn Pháp Bảo*';
  const domLine = details.domain
    ? `${domainEmoji(details.domain.entity_id)} **${DOMAIN_BY_ID[details.domain.entity_id]?.name || details.domain.entity_id}**`
    : '*Không dùng Linh Vực*';

  let activeBlock = '• **Trạng Thái:** Sẵn sàng xuất hành! Bấm **[Xuất Phát Khám Phá]** hoặc **[Chỉnh Loadout]** bên dưới.';
  let canClaim = false;
  if (busy.isExploring && busy.expedition) {
    const exp = busy.expedition;
    const mapDef = V14_EXPLORER_MAP_BY_ID[exp.map_id];
    const expPetRow = details.allPets.find((p) => String(p.pet_id) === String(exp.pet_id));
    const isStillMain = Boolean(expPetRow?.is_active);
    canClaim = now.getTime() >= new Date(exp.ends_at).getTime();
    activeBlock = [
      `${uiEm('ui_compass_dir')} **ĐANG KHÁM PHÁ:** **${mapDef?.name || exp.map_id}** *(${mapDef?.difficulty || ''} • Mốc ${exp.duration_hours} giờ)*`,
      `• **Linh Thú Xuất Hành:** ${petEmoji(exp.pet_type)} **${exp.pet_name}** (${isStillMain ? `${uiEm('ui_warn')} Pet Chính đang khóa chiến đấu` : 'Pet Phụ • Đang khám phá'})`,
      `• **Thời Gian Còn Lại:** **${formatDurationLeft(exp.ends_at, now)}**`,
    ].join('\n');
  }

  const injuredBlock = injuredPets.length > 0
    ? `\n${uiEm('ui_heal_band')} **Linh Thú Độc Nhất Trọng Thương (${injuredPets.length}):** ${injuredPets.map((p) => `${petEmoji(p.pet_type)} **${p.pet_name}**`).join(', ')} — dùng ${em('explorer_revive_elixir')} **Cửu Chuyển Hoàn Hồn Lộ** *(đang có ×${foodCounts.explorer_revive_elixir || 0})* để hồi sinh!`
    : '';

  const desc = [
    activeBlock,
    '',
    `**${uiEm('ui_backpack_inv')} Đội Hình Khám Phá Hiện Tại (${details.hasSavedLoadout ? 'Đã Lưu' : 'Mặc Định Pet Chính'}):**`,
    `• **Linh Thú:** ${petLine}`,
    `• **Pháp Bảo (3 ô):** ${eqLine}`,
    `• **Linh Vực:** ${domLine}`,
    `• **Tổng Lực Chiến Đội Hình:** **${details.power.toLocaleString('vi-VN')} Lực**`,
    `• **Lương Thảo & Dược Phẩm:** ${em('food_survival_pill')}×${foodCounts.food_survival_pill || 0} | ${em('food_yield_tea')}×${foodCounts.food_yield_tea || 0} | ${em('food_speed_fruit')}×${foodCounts.food_speed_fruit || 0} | ${em('explorer_revive_elixir')}×${foodCounts.explorer_revive_elixir || 0}`,
    injuredBlock,
  ].filter(Boolean).join('\n');

  return {
    success: true,
    is_exploring: busy.isExploring,
    can_claim: canClaim,
    has_saved_loadout: details.hasSavedLoadout,
    injured_count: injuredPets.length,
    loadout_power: details.power,
    map_image_url: `${PUBLIC_BASE_URL}/api/explorer/map.webp?v=1.4`,
    title: `${em('explorer_world_map_v14')} TRUNG TÂM KHÁM PHÁ ĐẠI LỤC CỬU CHÂU (/explorer)`,
    description: desc,
    message: desc,
  };
}

/**
 * Hiển thị danh sách Pet / Vũ Khí / Bảo Ngọc / Chiến Hồn / Linh Vực hiện có để chỉnh Loadout qua Dropdown.
 */
export async function getExplorerLoadoutEditor(userId, rawTab = 'pet') {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI LOADOUT`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  const tab = String(rawTab || 'pet').trim().toLowerCase();
  const details = await resolveUserLoadoutDetails(cleanId);
  let items = [];
  let heading = '';

  if (tab === 'pet') {
    heading = 'CHỌN LINH THÚ KHÁM PHÁ (Chính hoặc Phụ)';
    items = details.allPets.slice(0, 15).map((p, idx) => {
      const petPower = computeExplorerLoadoutPower(p, [], null, details.buffContext);
      return {
        slot: idx + 1,
        id: String(p.pet_id),
        label: `#${idx + 1} ${p.pet_name} (Lv.${p.level} • ${p.star}★ • ${p.is_active ? 'Chính' : 'Phụ'})`,
        line: `• **#${idx + 1}** ${petEmoji(p.pet_type)} **${p.pet_name}** *(Lv.${p.level} • ${p.star}★ • ${petPower.toLocaleString('vi-VN')} Lực • ${p.is_active ? 'Pet Chính' : 'Pet Phụ'}${p.status !== 'ready' ? ` • ${uiEm('ui_warn')} ${p.status}` : ''})*`,
      };
    });
  } else if (['weapon', 'gem', 'soul'].includes(tab)) {
    const typeLabel = tab === 'weapon' ? 'VŨ KHÍ' : tab === 'gem' ? 'BẢO NGỌC' : 'CHIẾN HỒN';
    heading = `CHỌN ${typeLabel} CHO LOADOUT KHÁM PHÁ`;
    const filtered = details.allEquip.filter((e) => EQUIPMENT_BY_ID[e.item_id]?.item_type === tab).slice(0, 15);
    items = filtered.map((e, idx) => {
      const def = EQUIPMENT_BY_ID[e.item_id];
      return {
        slot: idx + 1,
        id: e.item_id,
        label: `#${idx + 1} ${def?.item_name || e.item_id} (${e.enchant_grade})`,
        line: `• **#${idx + 1}** ${itemEmoji(e.item_id)} ${gradeEmoji(e.enchant_grade)} **${def?.item_name || e.item_id}** *(${def?.rarity || ''}${def?.is_unique ? ' • Độc Nhất — Không Mất' : ''})*`,
      };
    });
  } else {
    heading = 'CHỌN LINH VỰC CHO LOADOUT KHÁM PHÁ';
    const filtered = details.allDomains.filter((d) => d.entity_kind === 'domain').slice(0, 15);
    items = filtered.map((d, idx) => {
      const def = DOMAIN_BY_ID[d.entity_id];
      return {
        slot: idx + 1,
        id: d.entity_id,
        label: `#${idx + 1} ${def?.name || d.entity_id}`,
        line: `• **#${idx + 1}** ${domainEmoji(d.entity_id)} **${def?.name || d.entity_id}** *(${def?.element || ''} • ${def?.rarity || ''})*`,
      };
    });
  }

  return {
    success: true,
    tab,
    title: `${uiEm('ui_backpack_inv')} ${heading}`,
    description: [
      `Chọn số **#1 → #${Math.max(1, items.length)}** ở Dropdown bên dưới (hoặc chọn **0** để tháo ô này):`,
      '',
      ...(items.length > 0 ? items.map((i) => i.line) : ['• Kho hiện chưa có mục nào thuộc nhóm này.']),
    ].join('\n'),
    items,
  };
}

/**
 * Lưu 1 ô trong Loadout Khám Phá (hỗ trợ cả slot số #1..#15 lẫn ID trực tiếp).
 */
export async function saveExplorerLoadout(userId, patch = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI LOADOUT`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  return withExplorerLock(cleanId, async () => {
    const busy = await getUserBusyExplorationAssets(cleanId);
    if (busy.isExploring) {
      return explorerError(
        400,
        'EXPEDITION_IN_PROGRESS',
        `${uiEm('ui_clock_timer')} KHÔNG THỂ SỬA LOADOUT LÚC NÀY`,
        'Đang có chuyến khám phá đang diễn ra! Hãy chờ hoàn thành và nhận quà rồi mới chỉnh sửa Loadout.',
      );
    }

    const details = await resolveUserLoadoutDetails(cleanId);
    const cur = details.loadoutRow || {};

    let nextPetId = details.hasSavedLoadout ? (cur.pet_id || null) : (details.chosenPet ? String(details.chosenPet.pet_id) : null);
    let nextWeapon = details.hasSavedLoadout ? (cur.weapon_id || null) : (details.weapon?.item_id || null);
    let nextGem = details.hasSavedLoadout ? (cur.gem_id || null) : (details.gem?.item_id || null);
    let nextSoul = details.hasSavedLoadout ? (cur.soul_id || null) : (details.soul?.item_id || null);
    let nextDomain = details.hasSavedLoadout ? (cur.domain_id || null) : (details.domain?.entity_id || null);

    // Resolve slot index or explicit ID
    if (patch.slotType && patch.slotValue !== undefined) {
      const t = String(patch.slotType).toLowerCase();
      const v = String(patch.slotValue).trim();
      if (v === '0' || v === 'none' || v === 'clear') {
        if (t === 'weapon') nextWeapon = null;
        if (t === 'gem') nextGem = null;
        if (t === 'soul') nextSoul = null;
        if (t === 'domain') nextDomain = null;
      } else {
        const editor = await getExplorerLoadoutEditor(cleanId, t);
        const picked = /^\d{1,2}$/.test(v)
          ? editor.items[parseInt(v, 10) - 1]
          : editor.items.find((it) => String(it.id) === v);
        if (!picked) {
          return explorerError(404, 'LOADOUT_ITEM_NOT_FOUND', `${uiEm('ui_warn')} KHÔNG TÌM THẤY MỤC`, `Không tìm thấy mục '${v}' trong kho ${t}.`);
        }
        if (t === 'pet') nextPetId = String(picked.id);
        if (t === 'weapon') nextWeapon = String(picked.id);
        if (t === 'gem') nextGem = String(picked.id);
        if (t === 'soul') nextSoul = String(picked.id);
        if (t === 'domain') nextDomain = String(picked.id);
      }
    }

    if (patch.petId !== undefined) nextPetId = patch.petId ? String(patch.petId) : null;
    if (patch.weaponId !== undefined) nextWeapon = patch.weaponId || null;
    if (patch.gemId !== undefined) nextGem = patch.gemId || null;
    if (patch.soulId !== undefined) nextSoul = patch.soulId || null;
    if (patch.domainId !== undefined) nextDomain = patch.domainId || null;

    // Validate ownership
    if (nextPetId) {
      const petObj = details.allPets.find((p) => String(p.pet_id) === String(nextPetId) || p.pet_type === String(nextPetId));
      if (!petObj) return explorerError(404, 'PET_NOT_OWNED', `${uiEm('ui_warn')} CHƯA SỞ HỮU LINH THÚ`, 'Bạn không sở hữu Linh Thú này!');
      if (petObj.status === 'injured') {
        return explorerError(
          400,
          'PET_INJURED',
          `${uiEm('ui_heal_band')} LINH THÚ ĐANG TRỌNG THƯƠNG`,
          `Linh Thú **${petObj.pet_name}** đang bị Trọng Thương — cần dùng Cửu Chuyển Hoàn Hồn Lộ để hồi sinh trước!`,
        );
      }
      nextPetId = String(petObj.pet_id);
    }

    for (const [idVal, expectedType] of [[nextWeapon, 'weapon'], [nextGem, 'gem'], [nextSoul, 'soul']]) {
      if (!idVal) continue;
      const owned = details.allEquip.find((e) => e.item_id === idVal && EQUIPMENT_BY_ID[e.item_id]?.item_type === expectedType);
      if (!owned) return explorerError(404, 'EQUIP_NOT_OWNED', `${uiEm('ui_warn')} CHƯA SỞ HỮU PHÁP BẢO`, `Bạn không sở hữu Pháp Bảo \`${idVal}\` đúng loại ${expectedType}!`);
    }
    if (nextDomain) {
      const ownedDom = details.allDomains.find((d) => d.entity_kind === 'domain' && d.entity_id === nextDomain);
      if (!ownedDom) return explorerError(404, 'DOMAIN_NOT_OWNED', `${uiEm('ui_warn')} CHƯA SỞ HỮU LINH VỰC`, `Bạn không sở hữu Linh Vực \`${nextDomain}\`!`);
    }

    await supabase.from('explorer_loadouts').upsert({
      user_id: cleanId,
      pet_id: nextPetId,
      weapon_id: nextWeapon,
      gem_id: nextGem,
      soul_id: nextSoul,
      domain_id: nextDomain,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    const hub = await getExplorerHub(cleanId);
    const updatedMsg = [
      `${uiEm('ui_check')} **Đã cập nhật Loadout Khám Phá thành công!**`,
      `-> *Bạn có thể tiếp tục bấm các nút ô khác ở bảng **[Chỉnh Loadout]** phía trên để gắn thêm đồ, hoặc bấm **[Xuất Phát Khám Phá]** ở bảng chính!*`,
      '',
      hub.description,
    ].join('\n');

    return {
      ...hub,
      saved: true,
      title: `${uiEm('ui_check')} ĐÃ CẬP NHẬT LOADOUT KHÁM PHÁ`,
      description: updatedMsg,
      message: updatedMsg,
    };
  });
}

async function getFoodShopPrice(userId, foodId) {
  const foodDef = V14_CONSUMABLES.find((c) => c.item_id === foodId);
  const basePrice = Number(foodDef?.shop_price || 200);
  const { data: userRow } = await supabase
    .from('users')
    .select('level, linh_thach')
    .eq('user_id', userId)
    .maybeSingle();
  const roleBuffs = await computeRoleBuffTotals(userId, Number(userRow?.level || 1));
  const discountPct = Number(roleBuffs?.shopDiscountPct || 0);
  const finalPrice = Math.max(1, Math.round(basePrice * (1 - discountPct / 100)));
  return {
    foodDef,
    basePrice,
    finalPrice,
    discountPct,
    userLt: Number(userRow?.linh_thach || 0),
  };
}

/**
 * Luồng chọn từng bước khi Xuất Phát:
 * step = 'duration' (chọn 2/3/6/12h -> hiện bảng 12 Địa Danh kèm tỉ lệ sống sót dự kiến)
 * step = 'map' (chọn 1 trong 12 Địa Danh -> hiện bảng chọn Thức Ăn + nút Xác Nhận Xuất Phát)
 * step = 'food' (chọn Thức Ăn -> kiểm tra túi đồ, không cho dùng miễn phí nếu = 0; gợi ý Mua & Dùng Ngay)
 */
export async function selectExplorerPlanStep(userId, step, rawValue) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI KHÁM PHÁ`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  const details = await resolveUserLoadoutDetails(cleanId);
  const { data: availDrops } = await supabase
    .from('explorer_map_drops')
    .select('map_id, min_duration_hours')
    .eq('status', 'available')
    .neq('dropped_by_user_id', cleanId);

  if (step === 'duration') {
    const hrs = parseInt(String(rawValue || '2'), 10);
    const validHrs = VALID_EXPLORER_DURATIONS.includes(hrs) ? hrs : 2;
    await saveUiState(cleanId, { selected_duration: validHrs });

    const mapLines = V14_EXPLORER_MAPS.map((m) => {
      const terrain = evaluateExplorerTerrainBonus(m, details.chosenPet, details.domain);
      const surv = computeExplorerSurvival(details.power, m.recommended_power, null, terrain.survivalBonus);
      const dropCnt = (availDrops || []).filter((d) => d.map_id === m.map_id && Number(d.min_duration_hours) <= validHrs).length;
      const dropHint = dropCnt > 0 ? ` • ${uiEm('ui_gift_box')} **${dropCnt} đồ rơi!**` : '';
      const terrainHint = terrain.active ? ` • ${em('su_sparkle')} **Thuận Hệ (${terrain.matchedElements.join('/')}: +6% sống/+10% LT)**` : '';
      const survLabel = surv.tooWeak ? `Sống: **0%** ${uiEm('ui_skull_ko')}` : `Sống: **${surv.survivalPct}%**`;
      return `• **#${m.order} ${m.name}** *(${m.difficulty} • ${(m.recommended_power / 1000).toLocaleString('vi-VN')}k • Hệ ${m.favored_elements.join('/')})* — ${survLabel}${terrainHint}${dropHint}`;
    });

    return {
      success: true,
      step: 'choose_map',
      selected_duration: validHrs,
      map_image_url: `${PUBLIC_BASE_URL}/api/explorer/map.webp?v=1.4`,
      title: `${em('explorer_world_map_v14')} BƯỚC 2/3 — CHỌN ĐỊA DANH KHÁM PHÁ (MỐC ${validHrs} GIỜ)`,
      description: [
        `• **Đội Hình:** ${details.chosenPet ? `${petEmoji(details.chosenPet.pet_type)} **${details.chosenPet.pet_name}**` : '*Chưa chọn*'} — **${details.power.toLocaleString('vi-VN')} Lực**`,
        `• Chọn 1 trong **12 Địa Danh** ở Dropdown bên dưới *(quà cơ bản ~${(validHrs * EXPLORER_BASE_LT_PER_HOUR_MIN).toLocaleString('vi-VN')}–${(validHrs * EXPLORER_BASE_LT_PER_HOUR_MAX).toLocaleString('vi-VN')} LT × hệ số map + cơ hội rơi ${em('enchant_stone_absolute')} 0.5%)*:`,
        '',
        ...mapLines,
      ].join('\n'),
    };
  }

  if (step === 'map') {
    const raw = String(rawValue || '').trim();
    const mapDef = V14_EXPLORER_MAP_BY_ID[raw] || V14_EXPLORER_MAPS[parseInt(raw, 10) - 1] || null;
    if (!mapDef) return explorerError(404, 'MAP_NOT_FOUND', `${uiEm('ui_warn')} KHÔNG TÌM THẤY ĐỊA DANH`, 'Địa danh không hợp lệ!');

    const [ui, { data: invFoods }] = await Promise.all([
      saveUiState(cleanId, { selected_map_id: mapDef.map_id, selected_food_id: null }),
      supabase
        .from('user_inventory')
        .select('item_id, quantity')
        .eq('user_id', cleanId)
        .in('item_id', ['food_survival_pill', 'food_yield_tea', 'food_speed_fruit']),
    ]);
    const fc = Object.fromEntries((invFoods || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
    const hrs = Number(ui.selected_duration || 2);
    const terrain = evaluateExplorerTerrainBonus(mapDef, details.chosenPet, details.domain);
    const survBase = computeExplorerSurvival(details.power, mapDef.recommended_power, null, terrain.survivalBonus);
    const survFoodA = computeExplorerSurvival(details.power, mapDef.recommended_power, 'food_survival_pill', terrain.survivalBonus);
    const terrainLine = terrain.active
      ? `• **Thuận Hệ Địa Hình:** ${em('su_sparkle')} **Đang Kích Hoạt (${terrain.matchedElements.join(', ')})** — Cộng **+6% Sống Sót & +10% Linh Thạch**!`
      : `• **Hệ Địa Hình Thuận Lợi:** \`${(mapDef.favored_elements || []).join(' • ')}\` *(khớp Hệ Pet/Linh Vực để nhận +6% Sống & +10% LT)*`;

    return {
      success: true,
      step: 'choose_food',
      selected_duration: hrs,
      selected_map_id: mapDef.map_id,
      title: `${uiEm('ui_compass_dir')} BƯỚC 3/3 — XÁC NHẬN XUẤT PHÁT: ${mapDef.name.toUpperCase()}`,
      description: [
        `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(${mapDef.difficulty} • Yêu cầu ${mapDef.recommended_power.toLocaleString('vi-VN')} Lực • Hệ số ×${mapDef.reward_multiplier})*`,
        terrainLine,
        `• **Thời Gian:** **${hrs} giờ** *(dùng ${em('food_speed_fruit')} giảm còn **${(hrs * 0.75).toFixed(2)} giờ**)*`,
        survBase.tooWeak
          ? `• **Tỉ Lệ Sống Sót Dự Kiến:** **0%** ${uiEm('ui_skull_ko')} *(Lực chiến thua từ 2× trở lên — chắc chắn tử nạn, ${em('food_survival_pill')} không thể cứu!)*`
          : `• **Tỉ Lệ Sống Sót Dự Kiến:** **${survBase.survivalPct}%** *(dùng ${em('food_survival_pill')} tăng lên **${survFoodA.survivalPct}%**)*`,
        `• **Thức Ăn Trong Túi:** ${em('food_survival_pill')}×${fc.food_survival_pill || 0} *(180 LT)* | ${em('food_yield_tea')}×${fc.food_yield_tea || 0} *(220 LT)* | ${em('food_speed_fruit')}×${fc.food_speed_fruit || 0} *(250 LT)*`,
        `• **Cảnh Báo Nguy Hiểm:** Nếu tử nạn, Pet không Độc Nhất sẽ **mất vĩnh viễn** và Pháp Bảo không Độc Nhất sẽ **rớt lại trên bản đồ**!`,
        '',
        `Chọn **Thức Ăn Khám Phá** ở Dropdown bên dưới (tùy chọn; nếu chưa có có thể mua trực tiếp!) rồi bấm **[${em('crash_fly')} Xác Nhận Xuất Phát]**!`,
      ].join('\n'),
    };
  }

  // step === 'food'
  const foodId = rawValue && rawValue !== 'none' && EXPLORER_FOOD_EFFECTS[rawValue] ? rawValue : null;
  if (foodId) {
    const { data: invRow } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', foodId)
      .maybeSingle();
    const ownedQty = Number(invRow?.quantity || 0);

    if (ownedQty < 1) {
      // Tuyệt đối không cho dùng miễn phí nếu chưa có trong túi!
      const ui = await saveUiState(cleanId, { selected_food_id: null });
      const mapDef = V14_EXPLORER_MAP_BY_ID[ui.selected_map_id] || V14_EXPLORER_MAPS[0];
      const { foodDef, finalPrice, discountPct, userLt } = await getFoodShopPrice(cleanId, foodId);
      const ltIcon = em('su_linhthach');
      return {
        success: true,
        step: 'food_needs_buy',
        needs_buy: true,
        has_food: false,
        pending_food_id: foodId,
        food_price: finalPrice,
        user_lt: userLt,
        selected_food_id: null,
        selected_map_id: mapDef.map_id,
        selected_duration: Number(ui.selected_duration || 2),
        title: `${em(foodId)} CHƯA SỞ HỮU ${String(foodDef?.name || foodId).toUpperCase()}`,
        description: [
          `• Trong túi của bạn hiện đang có ${em(foodId)} **${foodDef?.name || foodId} ×0** — không thể dùng miễn phí!`,
          `• **Công Dụng:** ${EXPLORER_FOOD_EFFECTS[foodId].label}`,
          `• **Giá Mua 1 Phần:** **${finalPrice.toLocaleString('vi-VN')}** ${ltIcon}${discountPct > 0 ? ` *(đã giảm -${discountPct}% Role)*` : ''} • **Số Dư Của Bạn:** **${userLt.toLocaleString('vi-VN')}** ${ltIcon}`,
          '',
          `Bấm **[Mua & Dùng Ngay]** bên dưới để mua luôn từ Linh Thạch của bạn (hoặc mua số lượng lớn ở \`/shop\`), hoặc bấm **[Xuất Phát Không Thức Ăn]**!`,
        ].join('\n'),
      };
    }

    const ui = await saveUiState(cleanId, { selected_food_id: foodId });
    const mapDef = V14_EXPLORER_MAP_BY_ID[ui.selected_map_id] || V14_EXPLORER_MAPS[0];
    const hrs = Number(ui.selected_duration || 2);
    const terrain = evaluateExplorerTerrainBonus(mapDef, details.chosenPet, details.domain);
    const surv = computeExplorerSurvival(details.power, mapDef.recommended_power, foodId, terrain.survivalBonus);
    const effHours = foodId === 'food_speed_fruit' ? +(hrs * 0.75).toFixed(2) : hrs;

    return {
      success: true,
      step: 'ready_launch',
      needs_buy: false,
      has_food: true,
      owned_qty: ownedQty,
      selected_duration: hrs,
      selected_map_id: mapDef.map_id,
      selected_food_id: foodId,
      title: `${em('crash_fly')} SẴN SÀNG XUẤT PHÁT — ${mapDef.name.toUpperCase()}`,
      description: [
        `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(${mapDef.difficulty})*`,
        terrain.active ? `• **Thuận Hệ Địa Hình (${terrain.matchedElements.join('/')}):** **+6% Sống Sót • +10% LT**` : '',
        `• **Thời Gian Thực Tế:** **${effHours} giờ** *(Mốc thưởng ${hrs} giờ)*`,
        `• **Thức Ăn Mang Theo:** ${em(foodId)} **${EXPLORER_FOOD_EFFECTS[foodId].label}** *(đang có ×${ownedQty} — tiêu hao ×1)*`,
        `• **Tỉ Lệ Sống Sót Cuối:** **${surv.survivalPct}%** (Tử vong: ${surv.deathPct}%)${formatSurvivalSuffix(surv)}`,
        '',
        `Bấm **[${em('crash_fly')} Xác Nhận Xuất Phát]** để đưa Linh Thú lên đường ngay!`,
      ].filter(Boolean).join('\n'),
    };
  }

  const ui = await saveUiState(cleanId, { selected_food_id: null });
  const mapDef = V14_EXPLORER_MAP_BY_ID[ui.selected_map_id] || V14_EXPLORER_MAPS[0];
  const hrs = Number(ui.selected_duration || 2);
  const terrain = evaluateExplorerTerrainBonus(mapDef, details.chosenPet, details.domain);
  const surv = computeExplorerSurvival(details.power, mapDef.recommended_power, null, terrain.survivalBonus);

  return {
    success: true,
    step: 'ready_launch',
    needs_buy: false,
    has_food: true,
    selected_duration: hrs,
    selected_map_id: mapDef.map_id,
    selected_food_id: null,
    title: `${em('crash_fly')} SẴN SÀNG XUẤT PHÁT — ${mapDef.name.toUpperCase()}`,
    description: [
      `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(${mapDef.difficulty})*`,
      terrain.active ? `• **Thuận Hệ Địa Hình (${terrain.matchedElements.join('/')}):** **+6% Sống Sót • +10% LT**` : '',
      `• **Thời Gian Thực Tế:** **${hrs} giờ** *(Mốc thưởng ${hrs} giờ)*`,
      `• **Thức Ăn Mang Theo:** *Không mang thức ăn*`,
      `• **Tỉ Lệ Sống Sót Cuối:** **${surv.survivalPct}%** (Tử vong: ${surv.deathPct}%)${formatSurvivalSuffix(surv)}`,
      '',
      `Bấm **[${em('crash_fly')} Xác Nhận Xuất Phát]** để đưa Linh Thú lên đường ngay!`,
    ].filter(Boolean).join('\n'),
  };
}

/**
 * Mua trực tiếp 1 phần Thức Ăn Khám Phá tại màn hình /explorer và tự động chọn để xuất phát luôn.
 */
export async function buyAndSelectExplorerFood(userId, rawFoodId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI MUA THỨC ĂN`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  const foodId = String(rawFoodId || '').trim();
  if (!EXPLORER_FOOD_EFFECTS[foodId]) {
    return explorerError(400, 'INVALID_FOOD', `${uiEm('ui_warn')} THỨC ĂN KHÔNG HỢP LỆ`, 'Vui lòng chọn đúng loại thức ăn khám phá trước khi mua.');
  }

  return withExplorerLock(cleanId, async () => {
    const { foodDef, finalPrice, discountPct, userLt } = await getFoodShopPrice(cleanId, foodId);
    const ltIcon = em('su_linhthach');

    if (userLt < finalPrice) {
      return explorerError(
        400,
        'INSUFFICIENT_LT',
        `${uiEm('ui_cross')} KHÔNG ĐỦ LINH THẠCH`,
        `Cần **${finalPrice.toLocaleString('vi-VN')}** ${ltIcon} để mua ${em(foodId)} **${foodDef?.name || foodId}**, nhưng bạn hiện chỉ có **${userLt.toLocaleString('vi-VN')}** ${ltIcon}! Bạn vẫn có thể bấm **[Xuất Phát Không Thức Ăn]**.`,
      );
    }

    const remainingLt = userLt - finalPrice;
    await supabase
      .from('users')
      .update({ linh_thach: remainingLt, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    await addInventoryConsumable(cleanId, foodId, 1);
    const ui = await saveUiState(cleanId, { selected_food_id: foodId });
    const details = await resolveUserLoadoutDetails(cleanId);
    const mapDef = V14_EXPLORER_MAP_BY_ID[ui.selected_map_id] || V14_EXPLORER_MAPS[0];
    const hrs = Number(ui.selected_duration || 2);
    const terrain = evaluateExplorerTerrainBonus(mapDef, details.chosenPet, details.domain);
    const surv = computeExplorerSurvival(details.power, mapDef.recommended_power, foodId, terrain.survivalBonus);
    const effHours = foodId === 'food_speed_fruit' ? +(hrs * 0.75).toFixed(2) : hrs;

    const desc = [
      `${uiEm('ui_check')} Đã mua **1× ${em(foodId)} ${foodDef?.name || foodId}** với giá **${finalPrice.toLocaleString('vi-VN')}** ${ltIcon}${discountPct > 0 ? ` *(-${discountPct}%)*` : ''} *(Còn **${remainingLt.toLocaleString('vi-VN')}** ${ltIcon})*!`,
      '',
      `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(${mapDef.difficulty})*`,
      `• **Thời Gian Thực Tế:** **${effHours} giờ** *(Mốc thưởng ${hrs} giờ)*`,
      `• **Thức Ăn Mang Theo:** ${em(foodId)} **${EXPLORER_FOOD_EFFECTS[foodId].label}**`,
      `• **Tỉ Lệ Sống Sót Cuối:** **${surv.survivalPct}%** (Tử vong: ${surv.deathPct}%)${formatSurvivalSuffix(surv)}`,
      '',
      `Bấm **[${em('crash_fly')} Xác Nhận Xuất Phát]** để đưa Linh Thú lên đường ngay!`,
    ].join('\n');

    return {
      success: true,
      bought: true,
      selected_food_id: foodId,
      price_paid: finalPrice,
      remaining_lt: remainingLt,
      title: `${em('crash_fly')} ĐÃ MUA & SẴN SÀNG XUẤT PHÁT — ${mapDef.name.toUpperCase()}`,
      description: desc,
      message: desc,
    };
  });
}

/**
 * Khởi chạy chuyến khám phá thực tế: khóa Pet + Pháp Bảo + Linh Vực & trừ Thức Ăn.
 */
export async function startExpedition(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI KHÁM PHÁ`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  return withExplorerLock(cleanId, async () => {
    const busy = await getUserBusyExplorationAssets(cleanId);
    if (busy.isExploring) {
      return explorerError(
        400,
        'ALREADY_EXPLORING',
        `${uiEm('ui_compass_dir')} ĐANG CÓ CHUYẾN KHÁM PHÁ CHƯA KẾT THÚC`,
        'Bạn đang có một chuyến khám phá đang diễn ra! Hãy hoàn thành và nhận quà trước khi đi chuyến mới.',
      );
    }

    const ui = await loadUiState(cleanId);
    const durationHours = VALID_EXPLORER_DURATIONS.includes(Number(opts.durationHours))
      ? Number(opts.durationHours)
      : (VALID_EXPLORER_DURATIONS.includes(Number(ui.selected_duration)) ? Number(ui.selected_duration) : 2);
    const mapId = opts.mapId || ui.selected_map_id || 'map_01_truc_lam';
    const mapDef = V14_EXPLORER_MAP_BY_ID[mapId];
    if (!mapDef) return explorerError(404, 'MAP_NOT_FOUND', `${uiEm('ui_warn')} CHƯA CHỌN ĐỊA DANH`, 'Chưa chọn địa danh hợp lệ!');

    const foodIdRaw = opts.foodId !== undefined ? opts.foodId : ui.selected_food_id;
    const foodId = foodIdRaw && foodIdRaw !== 'none' && EXPLORER_FOOD_EFFECTS[foodIdRaw] ? foodIdRaw : null;

    const details = await resolveUserLoadoutDetails(cleanId);
    const pet = details.chosenPet;
    if (!pet) {
      return explorerError(400, 'NO_PET_FOR_EXPLORER', `${uiEm('ui_warn')} CHƯA CÓ LINH THÚ`, 'Bạn chưa có Linh Thú nào trong kho để đi khám phá!');
    }
    if (pet.status === 'exploring') {
      return explorerError(400, 'PET_BUSY_EXPLORING', `${uiEm('ui_compass_dir')} LINH THÚ ĐANG BẬN`, `Linh Thú **${pet.pet_name}** đang đi khám phá rồi!`);
    }
    if (pet.status === 'injured') {
      return explorerError(
        400,
        'PET_INJURED',
        `${uiEm('ui_heal_band')} LINH THÚ ĐANG TRỌNG THƯƠNG`,
        `Linh Thú **${pet.pet_name}** đang bị Trọng Thương — hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** để hồi sinh trước!`,
      );
    }

    // Kiểm tra và trừ Thức Ăn nếu người chơi chọn
    if (foodId) {
      const { data: foodRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', foodId)
        .maybeSingle();
      if (!foodRow || Number(foodRow.quantity || 0) < 1) {
        return explorerError(
          400,
          'INSUFFICIENT_FOOD',
          `${em(foodId)} THIẾU THỨC ĂN KHÁM PHÁ`,
          `Bạn không có ${em(foodId)} **${EXPLORER_FOOD_EFFECTS[foodId].label}** trong túi! Hãy mua tại \`/shop\` hoặc bấm **[Mua & Dùng Ngay]** trước.`,
        );
      }
      await supabase
        .from('user_inventory')
        .update({ quantity: Number(foodRow.quantity) - 1, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId)
        .eq('item_id', foodId);
    }

    const now = opts.now instanceof Date ? opts.now : new Date();
    const timeReduction = foodId ? Number(EXPLORER_FOOD_EFFECTS[foodId].timeReduction || 0) : 0;
    const effectiveSeconds = Math.max(60, Math.round(durationHours * 3600 * (1 - timeReduction)));
    const endsAtIso = new Date(now.getTime() + effectiveSeconds * 1000).toISOString();

    const lockedEquipIds = [details.weapon?.item_id, details.gem?.item_id, details.soul?.item_id].filter(Boolean);
    const lockedDomainIds = [details.domain?.entity_id, details.sense?.entity_id, details.realm?.entity_id].filter(Boolean);
    const isUniquePet = Boolean(pet.is_unique || MYTHIC_UNIQUE_PET_TYPES.has(pet.pet_type) || pet.pet_type === 'cuu_vi_hong_ho');

    // Khóa Pet sang trạng thái 'exploring'
    await supabase.from('user_pets').update({ status: 'exploring' }).eq('pet_id', pet.pet_id);

    const { data: exp, error: expErr } = await supabase
      .from('explorer_expeditions')
      .insert({
        user_id: cleanId,
        map_id: mapDef.map_id,
        duration_hours: durationHours,
        effective_seconds: effectiveSeconds,
        food_item_id: foodId,
        pet_id: String(pet.pet_id),
        pet_type: pet.pet_type,
        pet_name: pet.pet_name,
        pet_is_unique: isUniquePet,
        is_main_pet: Boolean(pet.is_active),
        locked_equip_ids: lockedEquipIds,
        locked_domain_ids: lockedDomainIds,
        pet_power: details.power,
        map_power: mapDef.recommended_power,
        started_at: now.toISOString(),
        ends_at: endsAtIso,
        status: 'active',
      })
      .select('*')
      .single();

    if (expErr) {
      await supabase.from('user_pets').update({ status: 'ready' }).eq('pet_id', pet.pet_id);
      throw new Error(`Start expedition failed: ${expErr.message}`);
    }

    const terrain = evaluateExplorerTerrainBonus(mapDef, pet, details.domain);
    const surv = computeExplorerSurvival(details.power, mapDef.recommended_power, foodId, terrain.survivalBonus);
    const mainPetNotice = pet.is_active
      ? `\n${uiEm('ui_warn')} *Bạn đang dùng **Pet Chính** để khám phá — Pet này tạm khóa khỏi PvP/PvE/Tháp/Địa Mạch (bạn có thể dùng \`/linhthu\` đổi sang Pet phụ khác để vẫn chiến đấu bình thường!).*`
      : '';

    const startDesc = [
      `• **Linh Thú:** ${petEmoji(pet.pet_type)} **${pet.pet_name}** (${details.power.toLocaleString('vi-VN')} Lực)`,
      `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(${mapDef.difficulty} • ${mapDef.recommended_power.toLocaleString('vi-VN')} Lực)*`,
      terrain.active ? `• **Thuận Hệ Địa Hình (${terrain.matchedElements.join('/')}):** **+6% Sống Sót • +10% Linh Thạch**` : '',
      `• **Thời Gian:** **${(effectiveSeconds / 3600).toFixed(2)} giờ** *(Mốc ${durationHours}h${foodId ? ` • Đã dùng ${em(foodId)}` : ''})*`,
      `• **Tỉ Lệ Sống Sót:** **${surv.survivalPct}%**${formatSurvivalSuffix(surv)}`,
      mainPetNotice,
    ].filter(Boolean).join('\n');

    await trackQuestActivity(cleanId, { explorerDelta: 1, now });

    return {
      success: true,
      expedition: exp,
      survival_pct: surv.survivalPct,
      effective_seconds: effectiveSeconds,
      ends_at: endsAtIso,
      title: `${em('crash_fly')} ĐÃ XUẤT PHÁT KHÁM PHÁ — ${mapDef.name.toUpperCase()}`,
      description: startDesc,
      message: startDesc,
    };
  });
}

async function addInventoryConsumable(userId, itemId, qty) {
  if (!supabase || !userId || !itemId || qty <= 0) return;
  const nowIso = new Date().toISOString();
  const { data: ex } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (ex) {
    await supabase
      .from('user_inventory')
      .update({ quantity: Number(ex.quantity || 0) + qty, item_category: 'consumable', updated_at: nowIso })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: 'consumable',
      quantity: qty,
    });
  }
}

async function grantEquipmentPreserveGrade(userId, itemId, grade = 'D', source = 'explorer') {
  const cleanGrade = normalizeEnchantGrade(grade);
  const gradeOrder = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  const { data: ex } = await supabase
    .from('user_pet_items')
    .select('id, quantity, enchant_grade')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (ex) {
    const bestGrade = (gradeOrder[cleanGrade] || 1) > (gradeOrder[normalizeEnchantGrade(ex.enchant_grade)] || 1)
      ? cleanGrade
      : normalizeEnchantGrade(ex.enchant_grade);
    await supabase
      .from('user_pet_items')
      .update({ quantity: Number(ex.quantity || 1) + 1, enchant_grade: bestGrade })
      .eq('id', ex.id);
  } else {
    await supabase.from('user_pet_items').insert({
      user_id: userId,
      item_id: itemId,
      equipped_to_pet: null,
      slot: null,
      source,
      paid_price: 0,
      enchant_grade: cleanGrade,
      enchant_pity: 0,
      quantity: 1,
    });
  }
}

/**
 * Hoàn tất & Nhận kết quả chuyến khám phá (Sống sót: thưởng LT + đồ + 0.5% Đá Tuyệt Ấn + 0.01% Vũ Khí Thần Thoại + 60% nhặt đồ rơi;
 * Tử vong: mất Pet thường / hôn mê Pet Độc Nhất + rớt cả 3 Pháp Bảo không Độc Nhất lên đúng tọa độ Map!).
 */
export async function claimExpedition(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI NHẬN THƯỞNG`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

  return withExplorerLock(cleanId, async () => {
    const busy = await getUserBusyExplorationAssets(cleanId);
    if (!busy.isExploring || !busy.expedition) {
      return explorerError(
        404,
        'NO_ACTIVE_EXPEDITION',
        `${em('explorer_world_map_v14')} CHƯA CÓ CHUYẾN KHÁM PHÁ NÀO`,
        'Bạn hiện chưa xuất phát chuyến khám phá nào! Hãy bấm **[Xuất Phát Khám Phá]** (hoặc **[Chỉnh Loadout]** trước) để đưa Linh Thú lên đường.',
      );
    }

    const exp = busy.expedition;
    const mapDef = V14_EXPLORER_MAP_BY_ID[exp.map_id] || V14_EXPLORER_MAPS[0];
    const now = opts.now instanceof Date ? opts.now : new Date();
    const nowIso = now.toISOString();
    if (!opts.forceComplete && now.getTime() < new Date(exp.ends_at).getTime()) {
      const rem = formatDurationLeft(exp.ends_at, now);
      return explorerError(
        400,
        'EXPEDITION_NOT_FINISHED',
        `${uiEm('ui_clock_timer')} CHUYẾN KHÁM PHÁ ĐANG TIẾN HÀNH`,
        `• **Linh Thú:** ${petEmoji(exp.pet_type)} **${exp.pet_name}**\n• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(Mốc ${exp.duration_hours} giờ)*\n• **Thời Gian Còn Lại:** **${rem}**\n\nHãy quay lại nhận quà sau khi chuyến khám phá kết thúc nhé!`,
        { remaining_text: rem },
      );
    }
    const lockedDomainIds = Array.isArray(exp.locked_domain_ids) ? exp.locked_domain_ids : [];
    const terrain = evaluateExplorerTerrainBonus(mapDef, { pet_type: exp.pet_type }, lockedDomainIds);
    const surv = computeExplorerSurvival(exp.pet_power, exp.map_power, exp.food_item_id, terrain.survivalBonus);
    const survivalRoll = opts.forceOutcome === 'survive' ? 0.0 : opts.forceOutcome === 'die' ? 0.9999 : rng();
    const survived = survivalRoll < surv.survivalRate;

    const ltIcon = em('su_linhthach');
    const lockedEquipIds = Array.isArray(exp.locked_equip_ids) ? exp.locked_equip_ids : [];

    if (survived) {
      // 1. Trả Pet về trạng thái 'ready'
      await supabase.from('user_pets').update({ status: 'ready' }).eq('pet_id', exp.pet_id);

      // 2. Tính Linh Thạch (+5% mới: 210-315 LT/giờ) * giờ * hệ số map * (1 + thức ăn B + Thuận Hệ +10% + Buff Viền/Nền)
      const { data: uRow } = await supabase.from('users').select('linh_thach, avatar_frame, background_url').eq('user_id', cleanId).maybeSingle();
      const cosmeticBuffs = computeCosmeticBuffTotals(uRow?.avatar_frame, uRow?.background_url);
      const fortuneInfo = await getEffectiveLuckAndFortune(cleanId);
      const foodYieldBonus = exp.food_item_id ? Number(EXPLORER_FOOD_EFFECTS[exp.food_item_id]?.yieldBonus || 0) : 0;
      const basePerHour = (200 + rng() * 100) * 1.05;
      const earnedLt = Math.round(exp.duration_hours * basePerHour * mapDef.reward_multiplier * Math.max(0.5, 1 + foodYieldBonus + terrain.yieldBonus + (cosmeticBuffs.ltPct || 0) / 100 + Number(fortuneInfo?.fortuneLtPct || 0) / 100));

      if (uRow) {
        await supabase
          .from('users')
          .update({ linh_thach: Number(uRow.linh_thach || 0) + earnedLt, updated_at: nowIso })
          .eq('user_id', cleanId);
      }

      // 3. Quà rớt theo mốc thời gian
      const bonusRollCount = exp.duration_hours >= 12 ? 5 : exp.duration_hours >= 6 ? 3 : exp.duration_hours >= 3 ? 2 : 1;
      const lootPool = ['enchant_stone', 'pet_star_stone', 'gacha_ticket_equip', 'gacha_ticket_pet', 'gacha_ticket_domain', 'tower_reset_card', 'food_survival_pill', 'food_yield_tea', 'food_speed_fruit'];
      const gainedItems = new Map();
      for (let i = 0; i < bonusRollCount; i += 1) {
        if (rng() < 0.65) {
          const picked = lootPool[Math.floor(rng() * lootPool.length) % lootPool.length];
          gainedItems.set(picked, (gainedItems.get(picked) || 0) + 1);
        }
      }

      // 4. Đá Khắc Ấn Tuyệt Đối (0.5%)
      const gotAbsoluteStone = opts.forceAbsoluteStone === true || rng() < 0.005;
      if (gotAbsoluteStone) {
        gainedItems.set('enchant_stone_absolute', (gainedItems.get('enchant_stone_absolute') || 0) + 1);
      }

      for (const [iid, qty] of gainedItems.entries()) {
        await addInventoryConsumable(cleanId, iid, qty);
      }

      // 5. Vũ Khí Thần Thoại KHÔNG Độc Nhất (0.01%)
      let mythicWeaponDrop = null;
      if (opts.forceMythicWeapon === true || rng() < 0.0001) {
        const mythicWeapons = EQUIPMENT_CATALOG.filter((e) => e.item_type === 'weapon' && e.rarity_key === 'mythic' && !e.is_unique && !e.is_exclusive_fuyumi);
        if (mythicWeapons.length > 0) {
          const w = mythicWeapons[Math.floor(rng() * mythicWeapons.length) % mythicWeapons.length];
          await grantEquipmentPreserveGrade(cleanId, w.item_id, 'C', 'explorer_mythic_drop');
          mythicWeaponDrop = w;
        }
      }

      // 6. Cơ chế nhặt đồ rơi của người trước (60% tỉ lệ nếu đúng map & duration >= min_duration_hours!)
      let salvagedDrop = null;
      const { data: candidates } = await supabase
        .from('explorer_map_drops')
        .select('*')
        .eq('map_id', exp.map_id)
        .eq('status', 'available')
        .lte('min_duration_hours', exp.duration_hours)
        .neq('dropped_by_user_id', cleanId)
        .order('dropped_at', { ascending: true })
        .limit(5);

      if (candidates && candidates.length > 0 && (opts.forceSalvage === true || rng() < 0.60)) {
        for (const cand of candidates) {
          // Atomic conditional update chống 2 người nhặt trùng 1 món!
          const { data: claimedRow } = await supabase
            .from('explorer_map_drops')
            .update({ status: 'claimed', claimed_by_user_id: cleanId, claimed_at: nowIso })
            .eq('drop_id', cand.drop_id)
            .eq('status', 'available')
            .select('*')
            .maybeSingle();
          if (claimedRow) {
            await grantEquipmentPreserveGrade(cleanId, claimedRow.item_id, claimedRow.enchant_grade, 'explorer_salvage');
            salvagedDrop = claimedRow;
            break;
          }
        }
      }

      const outcome = {
        survived: true,
        survivalPct: surv.survivalPct,
        earnedLt,
        gainedItems: Object.fromEntries(gainedItems),
        gotAbsoluteStone,
        mythicWeaponDrop: mythicWeaponDrop ? mythicWeaponDrop.item_id : null,
        salvagedDrop: salvagedDrop ? { drop_id: salvagedDrop.drop_id, item_id: salvagedDrop.item_id, enchant_grade: salvagedDrop.enchant_grade } : null,
      };

      await supabase
        .from('explorer_expeditions')
        .update({ status: 'claimed', outcome_json: outcome, updated_at: nowIso })
        .eq('expedition_id', exp.expedition_id);

      const lootText = Array.from(gainedItems.entries())
        .map(([iid, qty]) => `${em(iid)} ×${qty}`)
        .join('  ');

      const lines = [
        `${uiEm('ui_party_celebrate')} **KHÁM PHÁ THÀNH CÔNG — TRỞ VỀ AN TOÀN!**`,
        `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(Mốc ${exp.duration_hours}h • Sống sót ${surv.survivalPct}%)*`,
        terrain.active ? `• **Thuận Hệ Địa Hình (${terrain.matchedElements.join('/')}):** **+6% Sống Sót • +10% Linh Thạch**` : '',
        `• **Linh Thạch Thu Hoạch:** **+${earnedLt.toLocaleString('vi-VN')}** ${ltIcon}`,
        lootText ? `• **Vật Phẩm Nhặt Được:** ${lootText}` : '',
        gotAbsoluteStone ? `• ${em('su_sparkle')} **CỰC PHẨM 0.5%:** Nhặt được ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch** *(100% Khắc Ấn — khuyên dùng A → S)*!` : '',
        mythicWeaponDrop ? `• ${em('su_crossed_swords')} **KỲ NGỘ 0.01%:** Nhặt được Vũ Khí Thần Thoại ${itemEmoji(mythicWeaponDrop.item_id)} **${mythicWeaponDrop.item_name}**!` : '',
        salvagedDrop
          ? `• ${em('su_linhthach')} **NHẶT BẢO VẬT RƠI TRÊN BẢN ĐỒ (60%):** Nhặt được ${itemEmoji(salvagedDrop.item_id)} ${gradeEmoji(salvagedDrop.enchant_grade)} **${EQUIPMENT_BY_ID[salvagedDrop.item_id]?.item_name || salvagedDrop.item_id}** *(Bậc ${salvagedDrop.enchant_grade} — của tu sĩ đi trước bỏ lại)*!`
          : '',
      ].filter(Boolean);

      await trackQuestActivity(cleanId, { explorerDelta: 1 });

      return {
        success: true,
        survived: true,
        outcome,
        title: `${uiEm('ui_party_celebrate')} KẾT QUẢ KHÁM PHÁ — ${mapDef.name.toUpperCase()}`,
        description: lines.join('\n'),
        message: lines.join('\n'),
      };
    }

    // ==================== NHÁNH TỬ VONG ====================
    const petIsUnique = Boolean(exp.pet_is_unique || MYTHIC_UNIQUE_PET_TYPES.has(exp.pet_type) || exp.pet_type === 'cuu_vi_hong_ho');
    let petDeathNote = '';
    let starterPetGranted = false;

    if (petIsUnique) {
      await supabase.from('user_pets').update({ status: 'injured', is_active: false }).eq('pet_id', exp.pet_id);
      petDeathNote = `${uiEm('ui_heal_band')} Linh Thú Độc Nhất ${petEmoji(exp.pet_type)} **${exp.pet_name}** bị **Trọng Thương Hôn Mê**! Hãy dùng ${em('explorer_revive_elixir')} **Cửu Chuyển Hoàn Hồn Lộ** để hồi sinh.`;
    } else {
      const { data: petRow } = await supabase.from('user_pets').select('pet_id, quantity').eq('pet_id', exp.pet_id).maybeSingle();
      if (petRow && Number(petRow.quantity || 1) > 1) {
        await supabase.from('user_pets').update({ quantity: Number(petRow.quantity) - 1, status: 'ready' }).eq('pet_id', exp.pet_id);
      } else {
        await supabase.from('user_pets').delete().eq('pet_id', exp.pet_id);
      }
      petDeathNote = `${uiEm('ui_skull_ko')} Linh Thú ${petEmoji(exp.pet_type)} **${exp.pet_name}** đã **tử nạn vĩnh viễn** nơi hiểm địa!`;
    }

    // Kiểm tra đảm bảo user luôn còn ít nhất 1 Pet active sẵn sàng (nếu mất con cuối -> cấp 1 Pet Phàm khởi đầu Lv.1!)
    const { data: remainingPets } = await supabase
      .from('user_pets')
      .select('pet_id, status, is_active, power_score')
      .eq('user_id', cleanId)
      .order('power_score', { ascending: false });

    const readyRem = (remainingPets || []).filter((p) => p.status === 'ready');
    if ((remainingPets || []).length === 0) {
      const starter = PET_CATALOG.find((p) => p.rarity_key === 'common' && !p.is_unique) || PET_CATALOG[0];
      await supabase.from('user_pets').insert({
        user_id: cleanId,
        pet_type: starter.pet_type,
        pet_name: starter.pet_name,
        pet_rarity: starter.rarity,
        element: starter.element,
        hax_skill: starter.hax_skill || null,
        hax_description: starter.hax_description || '',
        level: 1,
        star: 1,
        atk: Number(starter.base_atk || 100),
        def: Number(starter.base_def || 100),
        spd: Number(starter.base_spd || 100),
        power_score: Number(starter.base_power || 3000),
        is_active: true,
        is_unique: false,
        status: 'ready',
        source: 'starter_fallback',
        paid_price: 0,
        enchant_grade: 'D',
        enchant_pity: 0,
        quantity: 1,
      });
      starterPetGranted = true;
    } else if (!readyRem.some((p) => p.is_active) && readyRem.length > 0) {
      await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', readyRem[0].pet_id);
    }

    // Xử lý cả 3 Pháp Bảo đang mang theo: Độc Nhất tự bay về kho, KHÔNG Độc Nhất rớt lại đúng tọa độ Map!
    const droppedItems = [];
    const returnedUniqueItems = [];

    for (const eqId of lockedEquipIds) {
      const eqDef = EQUIPMENT_BY_ID[eqId];
      if (!eqDef) continue;
      const isUniqueEq = Boolean(eqDef.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(eqId) || eqDef.is_exclusive_fuyumi);
      if (isUniqueEq) {
        returnedUniqueItems.push(eqDef.item_name);
        continue;
      }

      const { data: eqRow } = await supabase
        .from('user_pet_items')
        .select('id, item_id, quantity, enchant_grade')
        .eq('user_id', cleanId)
        .eq('item_id', eqId)
        .maybeSingle();

      if (eqRow) {
        const grade = normalizeEnchantGrade(eqRow.enchant_grade || 'D');
        if (Number(eqRow.quantity || 1) > 1) {
          await supabase.from('user_pet_items').update({ quantity: Number(eqRow.quantity) - 1 }).eq('id', eqRow.id);
        } else {
          await supabase.from('user_pet_items').delete().eq('id', eqRow.id);
        }
        await supabase.from('explorer_map_drops').insert({
          map_id: exp.map_id,
          min_duration_hours: exp.duration_hours,
          item_id: eqId,
          item_type: eqDef.item_type,
          enchant_grade: grade,
          dropped_by_user_id: cleanId,
          status: 'available',
          dropped_at: nowIso,
        });
        droppedItems.push({ item_id: eqId, item_name: eqDef.item_name, enchant_grade: grade });
      }
    }

    // Gỡ loadout cũ để tránh tham chiếu tới pet/item đã mất
    await supabase.from('explorer_loadouts').delete().eq('user_id', cleanId);

    const outcome = {
      survived: false,
      survivalPct: surv.survivalPct,
      petIsUnique,
      starterPetGranted,
      droppedItems,
      returnedUniqueItems,
    };

    await supabase
      .from('explorer_expeditions')
      .update({ status: 'claimed', outcome_json: outcome, updated_at: nowIso })
      .eq('expedition_id', exp.expedition_id);

    const lines = [
      `${uiEm('ui_skull_ko')} **KHÁM PHÁ THẤT BẠI — LINH THÚ GẶP NẠN!**`,
      `• **Địa Danh:** **#${mapDef.order} ${mapDef.name}** *(Sống sót ${surv.survivalPct}%)*`,
      `• ${petDeathNote}`,
      starterPetGranted ? `• ${em('su_sprout')} *(Bạn vừa mất con Linh Thú cuối cùng — Tông Môn đã cấp tặng 1 Linh Thú Phàm Phẩm Lv.1 để tiếp tục tu luyện!)*` : '',
      droppedItems.length > 0
        ? `• ${uiEm('ui_wind_spd')} **Pháp Bảo Bị Rớt Tại ${mapDef.name}:** ${droppedItems.map((d) => `${itemEmoji(d.item_id)} **${d.item_name}** (${d.enchant_grade})`).join(', ')} *(Tu sĩ khác đi tới đây mốc ≥${exp.duration_hours}h có 60% cơ hội nhặt được!)*`
        : '',
      returnedUniqueItems.length > 0
        ? `• ${em('su_sparkle')} **Pháp Bảo Độc Nhất Tự Hộ Chủ Bay Về Kho:** ${returnedUniqueItems.join(', ')}`
        : '',
      `• ${em('su_shield_def')} **Linh Vực / Thần Thức / Thần Cảnh:** Hoàn toàn nguyên vẹn, đã thu hồi về kho.`,
    ].filter(Boolean);

    await trackQuestActivity(cleanId, { explorerDelta: 1 });

    return {
      success: true,
      survived: false,
      outcome,
      title: `${uiEm('ui_skull_ko')} BÁO TỬ KHÁM PHÁ — ${mapDef.name.toUpperCase()}`,
      description: lines.join('\n'),
      message: lines.join('\n'),
    };
  });
}

/**
 * Dùng 1 lọ Cửu Chuyển Hoàn Hồn Lộ (explorer_revive_elixir) hồi sinh Pet Độc Nhất đang Trọng Thương.
 */
export async function reviveInjuredUniquePet(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return explorerError(400, 'INVALID_USER_ID', `${uiEm('ui_warn')} LỖI HỒI SINH`, 'ID không hợp lệ.');
  if (!supabase) return explorerError(503, 'DB_UNAVAILABLE', `${uiEm('ui_warn')} LỖI HỆ THỐNG`, 'Supabase chưa sẵn sàng.');

  return withExplorerLock(cleanId, async () => {
    const { data: injured } = await supabase
      .from('user_pets')
      .select('pet_id, pet_name, pet_type')
      .eq('user_id', cleanId)
      .eq('status', 'injured')
      .limit(1);

    const targetPet = injured?.[0] || null;
    if (!targetPet) {
      return explorerError(404, 'NO_INJURED_PET', `${uiEm('ui_heal_band')} KHÔNG CÓ LINH THÚ TRỌNG THƯƠNG`, 'Bạn không có Linh Thú Độc Nhất nào đang bị Trọng Thương!');
    }

    const { data: elixir } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', 'explorer_revive_elixir')
      .maybeSingle();

    if (!elixir || Number(elixir.quantity || 0) < 1) {
      return explorerError(
        400,
        'NO_REVIVE_ELIXIR',
        `${em('explorer_revive_elixir')} THIẾU CỬU CHUYỂN HOÀN HỒN LỘ`,
        `Cần 1 lọ ${em('explorer_revive_elixir')} **Cửu Chuyển Hoàn Hồn Lộ** (mua trong \`/shop\`) để hồi sinh **${targetPet.pet_name}**!`,
      );
    }

    await Promise.all([
      supabase.from('user_inventory').update({ quantity: Number(elixir.quantity) - 1, updated_at: new Date().toISOString() }).eq('user_id', cleanId).eq('item_id', 'explorer_revive_elixir'),
      supabase.from('user_pets').update({ status: 'ready' }).eq('pet_id', targetPet.pet_id),
    ]);

    const okMsg = `${em('explorer_revive_elixir')} **HỒI SINH THÀNH CÔNG!** Linh Thú Độc Nhất ${petEmoji(targetPet.pet_type)} **${targetPet.pet_name}** đã bình phục hoàn toàn và sẵn sàng xuất trận!`;
    return {
      success: true,
      revived_pet_id: targetPet.pet_id,
      pet_name: targetPet.pet_name,
      title: `${em('explorer_revive_elixir')} HỒI SINH LINH THÚ THÀNH CÔNG`,
      description: okMsg,
      message: okMsg,
    };
  });
}

/**
 * Hiển thị Bản Đồ Đại Lục 4K + số lượng đồ rơi đang nằm tại từng địa danh & quy tắc Khám Phá (/wiki).
 */
export async function getExplorerMapBoard(userId = null) {
  const cleanId = sanitizeUserId(userId || '');
  let drops = [];
  if (supabase) {
    const { data } = await supabase
      .from('explorer_map_drops')
      .select('map_id, min_duration_hours, dropped_by_user_id')
      .eq('status', 'available');
    drops = data || [];
  }

  const lines = V14_EXPLORER_MAPS.map((m) => {
    const countHere = drops.filter((d) => d.map_id === m.map_id && (!cleanId || d.dropped_by_user_id !== cleanId)).length;
    return `• **#${m.order} ${m.name}** *(${m.difficulty} • ${m.recommended_power.toLocaleString('vi-VN')} Lực • ×${m.reward_multiplier})*${countHere > 0 ? ` — ${em('su_linhthach')} **${countHere} bảo vật đang rơi!**` : ''}`;
  });

  const summary = [
    '',
    `**${em('su_wiki_scroll')} Quy Tắc & Phần Thưởng (/explorer):**`,
    `• **Mốc Thời Gian:** \`2 / 3 / 6 / 12 giờ\` • Thu hoạch \`200–300 LT/giờ × hệ số map\` + quà shop + **0.5%** ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch** *(100% Khắc Ấn)* + **0.01%** Vũ Khí Thần Thoại + **60%** nhặt Pháp Bảo rơi của người đi trước *(cùng địa danh & mốc ≥ giờ rơi)*.`,
    `• **Sinh Tử & Rớt Đồ:** Vượt lực map từ \`90% → 100%\` sống sót; yếu hơn map tử vong tăng dần về \`100%\` *(thua từ 2× lực chiến = **0% sống sót**, Hộ Mệnh Đan không thể cứu)*. Pet thường tử nạn mất vĩnh viễn; Pet Độc Nhất trọng thương hồi sinh bằng ${em('explorer_revive_elixir')} **Cửu Chuyển Hoàn Hồn Lộ**; Pháp Bảo Độc Nhất & Linh Vực an toàn tuyệt đối.`,
    `• **Thức Ăn Khám Phá (mua tại \`/shop\` hoặc ngay khi xuất phát):** ${em('food_survival_pill')} **Hộ Mệnh Linh Đan** *(+8% sống sót • 180 LT)* • ${em('food_yield_tea')} **Tụ Bảo Tiên Trà** *(+18% LT • 220 LT)* • ${em('food_speed_fruit')} **Ngự Phong Tốc Quả** *(-25% thời gian • 250 LT)*.`,
  ];

  return {
    success: true,
    map_image_url: `${PUBLIC_BASE_URL}/api/explorer/map.webp?v=1.4`,
    title: `${em('explorer_world_map_v14')} BẢN ĐỒ ĐẠI LỤC CỬU CHÂU — 12 ĐỊA DANH KHÁM PHÁ`,
    description: [...lines, ...summary].join('\n'),
  };
}
