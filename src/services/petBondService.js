/**
 * src/services/petBondService.js
 * SuMi Family Ver 1.8B — Hệ Thống Thiện Cảm & Đồng Hành Linh Thú (/pet):
 * - Điểm thiện cảm & Bậc tuyến tính theo phẩm chất (3 / 5 / 7 / 8 / 10).
 * - Tương tác hằng ngày (6 lượt/ngày × 15đ, hồi chiêu 30s) + Quà đồng hành lượt đầu ngày (Tier 4+).
 * - Tặng quà từ Túi/Kho/TT (+2/+45/+100/+25đ trần 200/ngày; Mảnh Hỗn Độn +350đ & Đá Tuyệt Ấn +1800đ không trần).
 * - Điểm chiến đấu: PvP/PvE (+2, trần 20/ngày), Tháp/Linh Mạch (+3, trần 15/ngày), Khám Phá (+10..25).
 * - Tự động mở khóa Viền Chân Thần độc quyền (frame_bond_<pet_type>) khi đạt Tiến Hóa + Bậc 10/10.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import { PET_BY_TYPE, FUYUMI_USER_ID } from '../data/catalog.js';
import { em, uiEm, petEmoji } from '../config/emojiHelper.js';
import { getVnDateKey } from './luckAndFortuneService.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import {
  PET_BOND_INTERACT_DAILY_MAX,
  PET_BOND_INTERACT_POINTS,
  PET_BOND_INTERACT_COOLDOWN_MS,
  PET_BOND_GIFT_DAILY_CAP,
  PET_BOND_COMBAT_BATTLE_DAILY_CAP,
  PET_BOND_COMBAT_TOWER_VEIN_DAILY_CAP,
  PET_BOND_GIFT_CATALOG,
  PET_BOND_INTERACTIONS,
  V18_BOND_FRAME_BY_PET,
  computeBondTierState,
  computeBondBuffsForTier,
  getAiChatDailyLimitForPet,
  getBondFrameIdForPet,
  getPetArchetype,
} from '../data/v18PetBondCatalog.js';
import { pickPetInteractionDialogue, ARCHETYPE_STYLE_PROMPTS } from '../data/v18PetDialogueBank.js';

const bondLocks = new Map();

// Offline in-memory test store (khi chạy unit test với seedUsers)
const memBondStore = {
  users: new Map(),
  pets: new Map(), // userId -> pet[]
  inventory: new Map(), // userId -> { item_id: qty }
  chatHistory: new Map(), // `${userId}:${petId}` -> [{ role, content, mode, created_at }]
};

export function __resetPetBondTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memBondStore.users.clear();
  memBondStore.pets.clear();
  memBondStore.inventory.clear();
  memBondStore.chatHistory.clear();

  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      const cleanId = String(uid);
      memBondStore.users.set(cleanId, {
        user_id: cleanId,
        username: data.username || `TuSi_${cleanId}`,
        avatar_url: data.avatar_url || null,
        linh_thach: Number(data.linh_thach ?? data.coins ?? 0),
        red_gold_crystals: Number(data.red_gold_crystals ?? data.tinh_thach ?? 0),
        farm_essence: Number(data.farm_essence ?? 0),
        owned_frames: Array.isArray(data.owned_frames) ? [...data.owned_frames] : [],
        avatar_frame: data.avatar_frame || 'default',
      });
      const pets = Array.isArray(data.pets) ? data.pets.map((p, idx) => ({
        pet_id: Number(p.pet_id ?? (idx + 1)),
        user_id: cleanId,
        pet_type: p.pet_type || 'hoa_thach_nham_nham',
        pet_name: p.pet_name || PET_BY_TYPE[p.pet_type || 'hoa_thach_nham_nham']?.pet_name || 'Linh Thú',
        pet_rarity: p.pet_rarity || PET_BY_TYPE[p.pet_type || 'hoa_thach_nham_nham']?.rarity || 'Phàm Phẩm',
        level: Number(p.level || 1),
        exp: Number(p.exp || 0),
        star: Number(p.star || 1),
        is_active: p.is_active !== false && idx === 0 ? true : Boolean(p.is_active),
        is_evolved: Boolean(p.is_evolved),
        status: p.status || 'ready',
        affection_points: Number(p.affection_points || 0),
        affection_tier: Number(p.affection_tier || 0),
        daily_interact_date: p.daily_interact_date || null,
        daily_interact_count: Number(p.daily_interact_count || 0),
        daily_gift_date: p.daily_gift_date || null,
        daily_gift_points: Number(p.daily_gift_points || 0),
        daily_companion_reward_date: p.daily_companion_reward_date || null,
        daily_ai_chat_date: p.daily_ai_chat_date || null,
        daily_ai_chat_count: Number(p.daily_ai_chat_count || 0),
        bond_frame_unlocked: Boolean(p.bond_frame_unlocked),
        last_interacted_at: p.last_interacted_at || null,
        daily_combat_bond_date: p.daily_combat_bond_date || null,
        daily_battle_bond_pts: Number(p.daily_battle_bond_pts || 0),
        daily_tower_vein_bond_pts: Number(p.daily_tower_vein_bond_pts || 0),
      })) : [];
      memBondStore.pets.set(cleanId, pets);
      memBondStore.inventory.set(cleanId, { ...(data.inventory || {}) });
    }
  }
}

export function __getPetBondTestState(userId) {
  const cleanId = String(userId);
  return {
    user: memBondStore.users.get(cleanId) || null,
    pets: memBondStore.pets.get(cleanId) || [],
    inventory: { ...(memBondStore.inventory.get(cleanId) || {}) },
    chatHistory: Array.from(memBondStore.chatHistory.entries())
      .filter(([k]) => k.startsWith(`${cleanId}:`))
      .flatMap(([, arr]) => arr),
  };
}

export function __getMemBondStore() {
  return memBondStore;
}

export function isPetBondTestMode() {
  return !supabase;
}

async function withBondLock(userId, fn) {
  const k = String(userId || '');
  const prev = bondLocks.get(k) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  bondLocks.set(k, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (bondLocks.get(k) === queued) bondLocks.delete(k);
  }
}

function randomInt(min, max, rng = Math.random) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

export function buildBondProgressBar(ratio = 0, width = 10) {
  const w = Math.max(4, Math.min(20, Math.floor(Number(width) || 10)));
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  const filled = Math.min(w, Math.max(0, Math.round(r * w)));
  return `${'▓'.repeat(filled)}${'░'.repeat(w - filled)}`;
}

function getTierEmote(tier, maxTier) {
  if (tier >= maxTier && maxTier >= 8) return em('bond_tier_max', em('su_sparkle'));
  if (tier >= Math.ceil(maxTier * 0.65)) return em('bond_tier_high', em('su_sparkle'));
  if (tier >= Math.ceil(maxTier * 0.3)) return em('bond_tier_mid', em('su_sparkle'));
  return em('bond_tier_low', em('su_pet_paw'));
}

async function fetchUserAndActivePet(userId, displayOpts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { user: null, pet: null, pets: [], inventory: {}, ownedFrames: [] };

  if (!supabase) {
    const user = memBondStore.users.get(cleanId) || null;
    const pets = memBondStore.pets.get(cleanId) || [];
    const activePet = pets.find((p) => p.is_active) || pets[0] || null;
    const inv = memBondStore.inventory.get(cleanId) || {};
    const ownedFrames = Array.isArray(user?.owned_frames) ? [...user.owned_frames] : [];
    return { user, pet: activePet, pets, inventory: inv, ownedFrames };
  }

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(displayOpts.username, displayOpts.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(displayOpts.avatarUrl),
  });
  const [{ data: pets }, { data: invRows }, { data: frameRows }] = await Promise.all([
    supabase
      .from('user_pets')
      .select('*')
      .eq('user_id', cleanId)
      .order('is_active', { ascending: false })
      .order('pet_id', { ascending: true }),
    supabase
      .from('user_inventory')
      .select('item_id, quantity')
      .eq('user_id', cleanId)
      .in('item_id', ['pill_ess_1', 'pill_ess_2', 'chaos_essence_shard', 'evo_crystal']),
    supabase
      .from('user_frames')
      .select('frame_id')
      .eq('user_id', cleanId),
  ]);

  const list = pets || [];
  const activePet = list.find((p) => p.is_active) || list[0] || null;
  const inventory = Object.fromEntries((invRows || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
  const ownedFrames = (frameRows || []).map((f) => String(f.frame_id)).filter(Boolean);
  if (user) user.owned_frames = ownedFrames;
  return { user, pet: activePet, pets: list, inventory, ownedFrames };
}

async function persistPetPatch(pet, patch) {
  if (!pet) return null;
  const merged = { ...pet, ...patch };
  if (!supabase) {
    Object.assign(pet, patch);
    return pet;
  }
  const { error } = await supabase
    .from('user_pets')
    .update(patch)
    .eq('pet_id', pet.pet_id);
  if (error) throw new Error(`Update user_pets affection failed: ${error.message}`);
  return merged;
}

async function persistUserPatch(userId, userObj, patch) {
  if (!userId) return;
  if (!supabase) {
    if (userObj) Object.assign(userObj, patch);
    return;
  }
  const { error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(`Update user bond field failed: ${error.message}`);
}

async function grantInventoryItem(userId, itemId, qtyDelta, itemCategory = 'material') {
  const delta = Math.floor(Number(qtyDelta) || 0);
  if (delta === 0 || !itemId) return 0;

  if (!supabase) {
    const bag = memBondStore.inventory.get(userId) || {};
    const next = Math.max(0, Number(bag[itemId] || 0) + delta);
    bag[itemId] = next;
    memBondStore.inventory.set(userId, bag);
    return next;
  }

  const nowIso = new Date().toISOString();
  const { data: ex } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  const cur = Number(ex?.quantity || 0);
  const next = Math.max(0, cur + delta);
  if (next <= 0) {
    if (ex) {
      await supabase.from('user_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
    }
    return 0;
  }
  await supabase.from('user_inventory').upsert({
    user_id: userId,
    item_id: itemId,
    item_category: itemCategory,
    quantity: next,
    updated_at: nowIso,
  }, { onConflict: 'user_id,item_id' });
  return next;
}

/**
 * Tự động mở khóa Avatar Frame Chân Thần độc quyền khi Pet Độc Nhất đã Tiến Hóa (hoặc Cửu Vĩ Hồng Hồ) đạt Bậc 10/10.
 */
export async function maybeUnlockBondFrameForPet({ userId, user, pet }) {
  if (!userId || !pet) return { unlockedNow: false, frameId: null, frameMeta: null };
  const frameId = getBondFrameIdForPet(pet.pet_type);
  if (!frameId) return { unlockedNow: false, frameId: null, frameMeta: null };

  const bondState = computeBondTierState(pet);
  const eligible = Boolean(pet.is_evolved || pet.pet_type === 'cuu_vi_hong_ho') && bondState.tier >= 10;
  if (!eligible) return { unlockedNow: false, frameId, frameMeta: V18_BOND_FRAME_BY_PET[pet.pet_type] || null };

  const ownedFrames = Array.isArray(user?.owned_frames) ? [...user.owned_frames] : [];
  const alreadyOwned = ownedFrames.includes(frameId) && Boolean(pet.bond_frame_unlocked);
  if (alreadyOwned) {
    return { unlockedNow: false, alreadyUnlocked: true, frameId, frameMeta: V18_BOND_FRAME_BY_PET[pet.pet_type] || null };
  }

  if (!ownedFrames.includes(frameId)) ownedFrames.push(frameId);
  if (user) user.owned_frames = ownedFrames;

  const tasks = [];
  if (supabase) {
    tasks.push(
      supabase.from('user_frames').upsert(
        { user_id: userId, frame_id: frameId, purchased_at: new Date().toISOString() },
        { onConflict: 'user_id,frame_id' },
      ),
    );
  }
  if (!pet.bond_frame_unlocked) {
    tasks.push(persistPetPatch(pet, { bond_frame_unlocked: true }));
  }
  await Promise.all(tasks);
  pet.bond_frame_unlocked = true;

  return {
    unlockedNow: true,
    alreadyUnlocked: true,
    frameId,
    frameMeta: V18_BOND_FRAME_BY_PET[pet.pet_type] || null,
  };
}

/**
 * Quay thưởng Quà Đồng Hành từ Linh Thú (khi Thu hoạch Nông Trại / Lần tương tác đầu ngày).
 * - Tier 4+: 100-400 LT (Farm harvest 25%, first daily interact 100%)
 * - Tier 6+: 5-12% cơ hội nhận 1-2 Tinh Thạch Hồng Kim
 * - Tier 8+: 1.5-4% cơ hội nhận 1 Mảnh Linh Hoa Hỗn Độn
 * - Tier 9-10 (Thần Thoại / Độc Nhất): 0.15-0.5% cơ hội nhận 1 Đá Tuyệt Ấn
 */
export async function rollPetCompanionReward({
  userId,
  user = null,
  pet = null,
  context = 'interact', // 'interact' | 'farm_harvest'
  rng = Math.random,
} = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !pet) return null;

  const bondState = computeBondTierState(pet);
  const buffs = computeBondBuffsForTier(bondState.tier, pet);
  if (!buffs.companionLtUnlock) return null;

  if (context === 'farm_harvest' && rng() >= 0.25) {
    return null;
  }

  let ltGained = randomInt(100, 400, rng);
  let ttGained = 0;
  let chaosShardGained = 0;
  let evoCrystalGained = 0;

  if (buffs.companionTtChancePct > 0 && rng() * 100 < buffs.companionTtChancePct) {
    ttGained = randomInt(1, 2, rng);
  }
  if (buffs.companionChaosChancePct > 0 && rng() * 100 < buffs.companionChaosChancePct) {
    chaosShardGained = 1;
  }
  if (buffs.companionEvoChancePct > 0 && rng() * 100 < buffs.companionEvoChancePct) {
    evoCrystalGained = 1;
  }

  let userRow = user;
  if (!userRow && supabase) {
    const { data } = await supabase.from('users').select('user_id, linh_thach, red_gold_crystals, farm_essence').eq('user_id', cleanId).maybeSingle();
    userRow = data;
  } else if (!userRow && !supabase) {
    userRow = memBondStore.users.get(cleanId) || null;
  }

  const userPatch = {};
  if (ltGained > 0 && userRow) {
    userPatch.linh_thach = Number(userRow.linh_thach || 0) + ltGained;
  }
  if (ttGained > 0 && userRow) {
    userPatch.red_gold_crystals = Number(userRow.red_gold_crystals || 0) + ttGained;
  }
  if (Object.keys(userPatch).length > 0) {
    await persistUserPatch(cleanId, userRow, userPatch);
  }
  if (chaosShardGained > 0) {
    await grantInventoryItem(cleanId, 'chaos_essence_shard', chaosShardGained, 'material');
  }
  if (evoCrystalGained > 0) {
    await grantInventoryItem(cleanId, 'evo_crystal', evoCrystalGained, 'material');
  }

  const parts = [`**+${ltGained.toLocaleString('vi-VN')}** ${em('su_linhthach')}`];
  if (ttGained > 0) parts.push(`**+${ttGained}** ${em('su_tinh_thach')}`);
  if (chaosShardGained > 0) parts.push(`**+${chaosShardGained}** ${em('chaos_essence_shard', em('su_sparkle'))} **Mảnh Hỗn Độn**`);
  if (evoCrystalGained > 0) parts.push(`**+${evoCrystalGained}** ${em('evo_crystal', em('su_sparkle'))} **Đá Tuyệt Ấn**`);

  return {
    ltGained,
    ttGained,
    chaosShardGained,
    evoCrystalGained,
    summaryText: parts.join(' • '),
  };
}

function buildHubResponsePayload({
  user,
  pet,
  inventory,
  dialogueObj = null,
  bannerText = '',
  companionGift = null,
  frameUnlocked = null,
  gainedPoints = 0,
  cooldownActive = false,
  cooldownSeconds = 0,
  dailyCapReached = false,
  now = new Date(),
  aiOverrides = null,
}) {
  const todayVn = getVnDateKey(now);
  const bond = computeBondTierState(pet);
  const buffs = computeBondBuffsForTier(bond.tier, pet);
  const meta = PET_BY_TYPE[pet.pet_type] || {};
  const petIcon = petEmoji(pet.pet_type, em('su_pet_paw'), Boolean(pet.is_evolved));
  const tierEm = getTierEmote(bond.tier, bond.maxTier);
  const bar = buildBondProgressBar(bond.progressRatio, 10);

  const interactUsed = pet.daily_interact_date === todayVn ? Number(pet.daily_interact_count || 0) : 0;
  const giftPtsUsed = pet.daily_gift_date === todayVn ? Number(pet.daily_gift_points || 0) : 0;
  const aiLimit = getAiChatDailyLimitForPet(pet);
  const aiUsed = pet.daily_ai_chat_date === todayVn ? Number(pet.daily_ai_chat_count || 0) : 0;
  const aiRemaining = aiLimit === Infinity ? 9999 : Math.max(0, aiLimit - aiUsed);

  const combatToday = pet.daily_combat_bond_date === todayVn;
  const battlePtsToday = combatToday ? Number(pet.daily_battle_bond_pts || 0) : 0;
  const towerVeinPtsToday = combatToday ? Number(pet.daily_tower_vein_bond_pts || 0) : 0;

  const lastInteractMs = pet.last_interacted_at ? new Date(pet.last_interacted_at).getTime() : 0;
  const elapsedMs = lastInteractMs > 0 ? Math.max(0, now.getTime() - lastInteractMs) : PET_BOND_INTERACT_COOLDOWN_MS;
  const interactCooldownRemainingMs = lastInteractMs > 0 && elapsedMs < PET_BOND_INTERACT_COOLDOWN_MS
    ? (PET_BOND_INTERACT_COOLDOWN_MS - elapsedMs)
    : 0;

  const frameMeta = V18_BOND_FRAME_BY_PET[pet.pet_type] || null;
  const ownedFrames = Array.isArray(user?.owned_frames) ? user.owned_frames : [];
  const hasFrame = frameMeta ? ownedFrames.includes(frameMeta.frame_id) : false;

  const archKey = getPetArchetype(pet.pet_type);
  const archLabel = ARCHETYPE_STYLE_PROMPTS[archKey]?.label || 'Linh Thú';

  const buffLines = [
    `\u00A0\u00A0↳ **Lực Chiến Pet Chính:** \`+${buffs.petPowerPct}%\` *(tối đa +40% • cộng cùng Role & Phu Thê)*`,
    `\u00A0\u00A0↳ **EXP Tăng Cấp Pet (\`/upgrade\`):** \`+${buffs.petExpPct}%\` *(tối đa +30% • chỉ Thiện Cảm buff)*`,
    `\u00A0\u00A0↳ **Sống Sót Khám Phá (\`/explorer\`):** \`+${buffs.explorerSurvivePct}%\` *(tối đa +15%)*`,
    `\u00A0\u00A0↳ **EXP Tu Sĩ (Chat/Voice/Nghề):** \`+${buffs.userExpPct}%\` *(tối đa +50%)*`,
    `\u00A0\u00A0↳ **Linh Thạch Toàn Nguồn:** \`+${buffs.allSourceLtPct}%\` *(tối đa +15% • trừ Minigame/Tách/Đổi/Tặng)*`,
  ];

  const farmLine = buffs.autoFarmChancePct > 0
    ? `${em('bond_auto_farm', em('farm_harvest'))} **Tự Thu Hoạch Nông Trại:** \`${buffs.autoFarmChancePct}%\`${buffs.autoFarmChancePct >= 100 ? ' *(Tự động 100% — Pet gửi DM báo thu hoạch!)*' : ' *(khi không bật Thẻ Tự Động)*'}`
    : `${em('bond_auto_farm', em('farm_harvest'))} **Tự Thu Hoạch Nông Trại:** *Mở khóa ở Bậc 5 (25% → 100% Chân Thần 10/10)*`;

  const giftDropLine = buffs.companionLtUnlock
    ? `${em('bond_gift_box', em('su_gift'))} **Quà Đồng Hành:** Đang bật *(Tương tác đầu ngày 100% + Farm 25%: 100–400 LT${buffs.companionTtChancePct > 0 ? ` • ${buffs.companionTtChancePct}% TT` : ''}${buffs.companionChaosChancePct > 0 ? ` • ${buffs.companionChaosChancePct}% Mảnh Hỗn Độn` : ''}${buffs.companionEvoChancePct > 0 ? ` • ${buffs.companionEvoChancePct}% Đá Tuyệt Ấn` : ''})*`
    : `${em('bond_gift_box', em('su_gift'))} **Quà Đồng Hành:** *Mở khóa từ Bậc 4 trở lên*`;

  let frameLine = '';
  if (frameMeta) {
    frameLine = hasFrame
      ? `${uiEm('ui_check')} **Viền Chân Thần (${frameMeta.name}):** Đã mở khóa! Dùng \`/equip loai:Khung Avatar\` *(+50% LT & EXP)*.`
      : `${uiEm('ui_lock')} **Viền Chân Thần (${frameMeta.name}):** Chưa mở *(cần Tiến Hóa Chân Thần & đạt Bậc 10/10)*.`;
  }

  const aiLine = aiLimit === Infinity
    ? `${em('pet_act_chat', em('su_sparkle'))} **AI Tâm Tình:** **Không giới hạn** *(Độc quyền ${petIcon})*`
    : aiLimit > 0
      ? `${em('pet_act_chat', em('su_sparkle'))} **AI Tâm Tình hôm nay:** Còn **${aiRemaining}/${aiLimit}** lượt *(sau đó chuyển kho thoại tự nhiên)*`
      : `${em('pet_act_chat', em('su_sparkle'))} **Kho Thoại Linh Thú:** Hoạt động tự nhiên *(AI chat mở từ Bậc Thần Thoại trở lên)*`;

  const lines = [
    bannerText || '',
    dialogueObj?.formatted ? `> ${dialogueObj.formatted}` : '',
    companionGift ? `${em('bond_gift_box', em('su_gift'))} **Quà Đồng Hành Hôm Nay:** ${pet.pet_name} mang tặng bạn ${companionGift.summaryText}!` : '',
    frameUnlocked?.unlockedNow ? `${em('bond_tier_max', em('su_sparkle'))} **MỞ KHÓA VIỀN ĐỘC QUYỀN:** Nhận vĩnh viễn **${frameUnlocked.frameMeta?.name}** *(+50% LT Điểm danh/Nghề & +50% EXP Chat/Voice)*!` : '',
    '',
    `${petIcon} **${pet.pet_name}** *(${meta.rarity || pet.pet_rarity} • Lv.${pet.level} • ${pet.star}★ • ${archLabel})*`,
    `• ${tierEm} **Thiện Cảm:** **Bậc ${bond.tier}/${bond.maxTier} — ${bond.tierLabel}**`,
    `\u00A0\u00A0↳ \`${bar}\` **${bond.points.toLocaleString('vi-VN')}/${bond.maxPoints.toLocaleString('vi-VN')}** điểm${!bond.isMaxTier ? ` *(còn ${bond.pointsToNext.toLocaleString('vi-VN')}đ lên Bậc ${bond.tier + 1})*` : ' *(ĐẠT ĐỈNH VĨNH CỬU)*'}`,
    `• **Sinh Hoạt Hôm Nay (UTC+7):**`,
    `\u00A0\u00A0↳ Tương tác tay: **${interactUsed}/${PET_BOND_INTERACT_DAILY_MAX}** lượt *(+15đ/lượt • hồi chiêu 30s)*`,
    `\u00A0\u00A0↳ Tặng quà thường: **${giftPtsUsed}/${PET_BOND_GIFT_DAILY_CAP}** điểm *(Mảnh Hỗn Độn & Đá Tuyệt Ấn không giới hạn)*`,
    `\u00A0\u00A0↳ Chiến đấu cộng thêm: Battle **${battlePtsToday}/${PET_BOND_COMBAT_BATTLE_DAILY_CAP}** • Tháp/Mạch **${towerVeinPtsToday}/${PET_BOND_COMBAT_TOWER_VEIN_DAILY_CAP}**`,
    `• **Quyền Lợi Đang Kích Hoạt:**`,
    ...buffLines,
    farmLine,
    giftDropLine,
    frameLine,
    aiLine,
    '',
    `*Bấm 7 nút bên dưới để chăm sóc, trò chuyện hoặc chọn **[${em('pet_act_gift', em('su_gift'))} Tặng Quà]** để gửi vật phẩm!*`,
  ].filter((x, idx, arr) => {
    if (x !== '') return true;
    return idx > 0 && arr[idx - 1] !== '';
  });

  const description = lines.join('\n').trim();
  const displayName = user?.username || pickCleanDisplayValue(pet.pet_name) || 'Tu Sĩ';

  return {
    success: true,
    status: 200,
    has_pet: true,
    user_id: user?.user_id || '',
    username: displayName,
    pet: {
      pet_id: pet.pet_id,
      pet_type: pet.pet_type,
      pet_name: pet.pet_name,
      pet_rarity: meta.rarity || pet.pet_rarity,
      level: Number(pet.level || 1),
      star: Number(pet.star || 1),
      is_evolved: Boolean(pet.is_evolved),
      status: pet.status || 'ready',
      archetype: archKey,
      archetype_label: archLabel,
    },
    bond,
    buffs,
    daily: {
      date_key: todayVn,
      interact_used: interactUsed,
      interact_max: PET_BOND_INTERACT_DAILY_MAX,
      interact_remaining: Math.max(0, PET_BOND_INTERACT_DAILY_MAX - interactUsed),
      gift_points_used: giftPtsUsed,
      gift_points_max: PET_BOND_GIFT_DAILY_CAP,
      gift_points_remaining: Math.max(0, PET_BOND_GIFT_DAILY_CAP - giftPtsUsed),
      battle_points_used: battlePtsToday,
      battle_points_max: PET_BOND_COMBAT_BATTLE_DAILY_CAP,
      tower_vein_points_used: towerVeinPtsToday,
      tower_vein_points_max: PET_BOND_COMBAT_TOWER_VEIN_DAILY_CAP,
      companion_reward_claimed_today: pet.daily_companion_reward_date === todayVn,
    },
    ai_chat: aiOverrides || {
      limit: aiLimit === Infinity ? 9999 : aiLimit,
      unlimited: aiLimit === Infinity,
      used: aiUsed,
      remaining: aiRemaining,
      eligible: aiLimit === Infinity || aiRemaining > 0,
    },
    bond_frame: frameMeta ? { ...frameMeta, unlocked: hasFrame } : null,
    gift_balances: {
      farm_essence: Number(user?.farm_essence || 0),
      pill_ess_1: Number(inventory?.pill_ess_1 || 0),
      pill_ess_2: Number(inventory?.pill_ess_2 || 0),
      red_gold_crystals: Number(user?.red_gold_crystals || 0),
      chaos_essence_shard: Number(inventory?.chaos_essence_shard || 0),
      evo_crystal: Number(inventory?.evo_crystal || 0),
    },
    dialogue: dialogueObj,
    companion_gift: companionGift,
    frame_unlocked: frameUnlocked,
    gained_points: gainedPoints,
    cooldown_active: cooldownActive,
    cooldown_seconds: cooldownSeconds,
    daily_cap_reached: dailyCapReached,
    interact_cooldown_remaining_ms: interactCooldownRemainingMs,
    interactions: PET_BOND_INTERACTIONS,
    title: `${tierEm} LINH THÚ TÂM GIAO — ${pet.pet_name.toUpperCase()}`,
    description,
    message: description,
    color: bond.tier >= bond.maxTier ? '#f59e0b' : (bond.tier >= 5 ? '#ec4899' : '#38bdf8'),
  };
}

export async function getPetBondHub(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = opts.now instanceof Date ? opts.now : new Date();
  const { user, pet, inventory } = await fetchUserAndActivePet(cleanId, opts);
  if (!user) return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ tu sĩ.' };

  if (!pet) {
    const msg = `${em('su_pet_paw')} Bạn chưa sở hữu **Linh Thú** nào để bồi dưỡng thiện cảm! Hãy gõ \`/roll loai:pet\` để triệu hồi người bạn đồng hành đầu tiên.`;
    return {
      success: true,
      status: 200,
      has_pet: false,
      title: `${em('su_pet_paw')} LINH THÚ TÂM GIAO (/pet)`,
      description: msg,
      message: msg,
    };
  }

  const frameUnlocked = await maybeUnlockBondFrameForPet({ userId: cleanId, user, pet });
  const greeting = pickPetInteractionDialogue({
    petType: pet.pet_type,
    petName: pet.pet_name,
    action: 'chat',
    tier: computeBondTierState(pet).tier,
    maxTier: computeBondTierState(pet).maxTier,
  });

  return buildHubResponsePayload({
    user,
    pet,
    inventory,
    dialogueObj: greeting,
    frameUnlocked: frameUnlocked.unlockedNow ? frameUnlocked : null,
    now,
  });
}

export async function interactWithPet(userId, actionKey = 'pat', opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const normalizedAct = ['pat', 'hug', 'snack', 'brush', 'play', 'sleep', 'chat'].includes(String(actionKey || '').toLowerCase())
    ? String(actionKey).toLowerCase()
    : 'pat';

  return withBondLock(cleanId, async () => {
    const now = opts.now instanceof Date ? opts.now : new Date();
    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    const todayVn = getVnDateKey(now);
    const { user, pet, inventory } = await fetchUserAndActivePet(cleanId, opts);

    if (!user) return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' };
    if (!pet) {
      return {
        success: false,
        status: 200,
        has_pet: false,
        error: 'NO_ACTIVE_PET',
        message: `${em('su_pet_paw')} Bạn chưa có Linh Thú nào! Hãy dùng \`/roll loai:pet\` trước nhé.`,
      };
    }

    if (pet.status === 'injured') {
      return {
        success: false,
        status: 200,
        error: 'PET_INJURED',
        message: `${uiEm('ui_heal_band')} **${pet.pet_name}** đang bị **Trọng Thương**! Hãy hồi sinh bằng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` trước khi tương tác nhé.`,
      };
    }

    const beforeBond = computeBondTierState(pet);
    const usedToday = pet.daily_interact_date === todayVn ? Number(pet.daily_interact_count || 0) : 0;
    const lastMs = pet.last_interacted_at ? new Date(pet.last_interacted_at).getTime() : 0;
    const elapsedMs = lastMs > 0 ? Math.max(0, now.getTime() - lastMs) : PET_BOND_INTERACT_COOLDOWN_MS;
    const onCooldown = lastMs > 0 && elapsedMs < PET_BOND_INTERACT_COOLDOWN_MS;
    const cdSec = onCooldown ? Math.ceil((PET_BOND_INTERACT_COOLDOWN_MS - elapsedMs) / 1000) : 0;

    let gainedPoints = 0;
    let bannerText = '';
    let companionGift = null;
    let frameUnlocked = null;
    const dailyCapReached = usedToday >= PET_BOND_INTERACT_DAILY_MAX;
    const actionDef = PET_BOND_INTERACTIONS.find((x) => x.key === normalizedAct) || PET_BOND_INTERACTIONS[0];
    const actIcon = em(actionDef.emojiKey, em('su_pet_paw'));

    if (onCooldown) {
      bannerText = `${actIcon} **${actionDef.label}** • ${uiEm('ui_clock_timer')} Hồi chiêu cộng điểm còn **${cdSec} giây** *(vẫn lưu phản ứng, chưa cộng thêm điểm)*.`;
    } else if (dailyCapReached) {
      bannerText = `${actIcon} **${actionDef.label}** • Đã nhận đủ **${PET_BOND_INTERACT_DAILY_MAX}/${PET_BOND_INTERACT_DAILY_MAX}** lượt cộng điểm hôm nay *(bạn vẫn có thể tương tác hoặc tặng quà bất kỳ lúc nào!)*.`;
    } else {
      const nextPoints = Math.min(beforeBond.maxPoints, beforeBond.points + PET_BOND_INTERACT_POINTS);
      gainedPoints = nextPoints - beforeBond.points;
      const nextState = computeBondTierState(pet, nextPoints);
      const nextUsed = usedToday + 1;

      const patch = {
        affection_points: nextPoints,
        affection_tier: nextState.tier,
        daily_interact_date: todayVn,
        daily_interact_count: nextUsed,
        last_interacted_at: now.toISOString(),
      };

      // Quà đồng hành lượt đầu ngày (Tier 4+): 100% rơi ngay ở lần tương tác đầu tiên trong ngày!
      if (usedToday === 0 && pet.daily_companion_reward_date !== todayVn && nextState.tier >= 4) {
        patch.daily_companion_reward_date = todayVn;
      }

      await persistPetPatch(pet, patch);
      Object.assign(pet, patch);

      if (patch.daily_companion_reward_date === todayVn) {
        companionGift = await rollPetCompanionReward({
          userId: cleanId,
          user,
          pet,
          context: 'interact',
          rng,
        });
      }

      frameUnlocked = await maybeUnlockBondFrameForPet({ userId: cleanId, user, pet });

      const tierUpTxt = nextState.tier > beforeBond.tier
        ? ` — ${em('bond_tier_high', em('su_sparkle'))} **LÊN BẬC ${nextState.tier}: ${nextState.tierLabel}!**`
        : '';
      bannerText = gainedPoints > 0
        ? `${actIcon} **${actionDef.label}** thành công: **+${gainedPoints} Thiện Cảm** (${nextUsed}/${PET_BOND_INTERACT_DAILY_MAX})${tierUpTxt}`
        : `${actIcon} **${actionDef.label}** thành công (${nextUsed}/${PET_BOND_INTERACT_DAILY_MAX}) — Thiện cảm đã đạt đỉnh **${nextState.maxPoints}**!`;
    }

    const afterBond = computeBondTierState(pet);
    const dialogueObj = pickPetInteractionDialogue({
      petType: pet.pet_type,
      petName: pet.pet_name,
      action: normalizedAct,
      tier: afterBond.tier,
      maxTier: afterBond.maxTier,
      userMessage: opts.userMessage || '',
      seed: opts.seed !== undefined ? opts.seed : `${cleanId}:${now.getTime()}`,
    });

    return buildHubResponsePayload({
      user,
      pet,
      inventory,
      dialogueObj,
      bannerText,
      companionGift,
      frameUnlocked: frameUnlocked?.unlockedNow ? frameUnlocked : null,
      gainedPoints,
      cooldownActive: onCooldown,
      cooldownSeconds: cdSec,
      dailyCapReached,
      now,
    });
  });
}

export async function giftToPet(userId, rawGiftItemId, rawQuantity = 1, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const gift = PET_BOND_GIFT_CATALOG[String(rawGiftItemId || '').trim()];
  if (!gift) {
    return {
      success: false,
      status: 200,
      error: 'INVALID_GIFT_ITEM',
      message: `${uiEm('ui_cross')} Quà tặng \`${rawGiftItemId}\` không hợp lệ! Chỉ nhận: Linh Quả, 2 Đan Tinh Hoa, Tinh Thạch Hồng Kim, Mảnh Hỗn Độn, Đá Tuyệt Ấn.`,
    };
  }

  const reqQty = Math.floor(Number(rawQuantity) || 0);
  if (!Number.isFinite(reqQty) || reqQty <= 0) {
    return { success: false, status: 200, error: 'INVALID_QUANTITY', message: 'Số lượng quà tặng phải lớn hơn 0.' };
  }

  return withBondLock(cleanId, async () => {
    const now = opts.now instanceof Date ? opts.now : new Date();
    const todayVn = getVnDateKey(now);
    const { user, pet, inventory } = await fetchUserAndActivePet(cleanId, opts);
    if (!user) return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' };
    if (!pet) return { success: false, status: 200, error: 'NO_ACTIVE_PET', message: 'Bạn chưa có Linh Thú nào!' };

    const beforeBond = computeBondTierState(pet);
    if (beforeBond.isMaxTier) {
      return {
        success: false,
        status: 200,
        error: 'MAX_BOND_REACHED',
        message: `${em('bond_tier_max', em('su_sparkle'))} **${pet.pet_name}** đã đạt đỉnh **Bậc ${beforeBond.maxTier}/${beforeBond.maxTier} (${beforeBond.maxPoints.toLocaleString('vi-VN')} điểm)**! Không cần tiêu tốn thêm quà nữa đâu.`,
      };
    }

    const ownedQty = gift.storage === 'user_farm_essence'
      ? Number(user.farm_essence || 0)
      : gift.storage === 'user_tt'
        ? Number(user.red_gold_crystals || 0)
        : Number(inventory[gift.item_id] || 0);

    if (ownedQty <= 0 || ownedQty < reqQty) {
      return {
        success: false,
        status: 200,
        error: 'INSUFFICIENT_ITEM',
        message: `${uiEm('ui_cross')} Bạn hiện có **${ownedQty.toLocaleString('vi-VN')}× ${gift.name}**, không đủ **${reqQty}×** để tặng!`,
      };
    }

    const usedGiftToday = pet.daily_gift_date === todayVn ? Number(pet.daily_gift_points || 0) : 0;
    const remainingToMax = Math.max(0, beforeBond.maxPoints - beforeBond.points);

    let effectiveCap = remainingToMax;
    if (gift.capped) {
      const capLeft = Math.max(0, PET_BOND_GIFT_DAILY_CAP - usedGiftToday);
      if (capLeft <= 0) {
        return {
          success: false,
          status: 200,
          error: 'GIFT_DAILY_CAP_REACHED',
          message: `${uiEm('ui_warn')} Đã đạt trần quà thường hôm nay (**${PET_BOND_GIFT_DAILY_CAP}/${PET_BOND_GIFT_DAILY_CAP} điểm**)! Hãy quay lại sau 00:00 UTC+7 hoặc tặng **Mảnh Linh Hoa Hỗn Độn** / **Đá Tuyệt Ấn** *(không giới hạn ngày)*.`,
        };
      }
      effectiveCap = Math.min(remainingToMax, capLeft);
    }

    // Tự động kẹp số lượng tiêu thụ vừa đủ tới trần (không nuốt thừa đồ)
    const maxUsefulQty = Math.max(1, Math.min(reqQty, Math.ceil(effectiveCap / gift.points)));
    const actualQty = Math.min(reqQty, maxUsefulQty, ownedQty);
    const rawGain = actualQty * gift.points;
    const gainedPoints = Math.min(effectiveCap, rawGain);

    // Trừ vật phẩm/tiền tệ tương ứng
    if (gift.storage === 'user_farm_essence') {
      await persistUserPatch(cleanId, user, { farm_essence: Math.max(0, ownedQty - actualQty) });
    } else if (gift.storage === 'user_tt') {
      await persistUserPatch(cleanId, user, { red_gold_crystals: Math.max(0, ownedQty - actualQty) });
    } else {
      await grantInventoryItem(cleanId, gift.item_id, -actualQty, gift.item_id.startsWith('pill_') ? 'consumable' : 'material');
      inventory[gift.item_id] = Math.max(0, ownedQty - actualQty);
    }

    const nextPoints = Math.min(beforeBond.maxPoints, beforeBond.points + gainedPoints);
    const nextState = computeBondTierState(pet, nextPoints);
    const nextGiftUsed = gift.capped ? (usedGiftToday + gainedPoints) : usedGiftToday;

    const patch = {
      affection_points: nextPoints,
      affection_tier: nextState.tier,
      daily_gift_date: todayVn,
      daily_gift_points: nextGiftUsed,
    };
    await persistPetPatch(pet, patch);
    Object.assign(pet, patch);

    const frameUnlocked = await maybeUnlockBondFrameForPet({ userId: cleanId, user, pet });
    const dialogueObj = pickPetInteractionDialogue({
      petType: pet.pet_type,
      petName: pet.pet_name,
      action: 'gift',
      tier: nextState.tier,
      maxTier: nextState.maxTier,
      seed: opts.seed !== undefined ? opts.seed : `${cleanId}:gift:${now.getTime()}`,
    });

    const tierUpTxt = nextState.tier > beforeBond.tier
      ? ` — ${em('bond_tier_max', em('su_sparkle'))} **ĐỘT PHÁ BẬC ${nextState.tier}: ${nextState.tierLabel}!**`
      : '';
    const giftEm = em(gift.emoji_key, em('bond_gift_box'));
    const bannerText = `${giftEm} Đã tặng **${actualQty}× ${gift.name}**: **+${gainedPoints.toLocaleString('vi-VN')} Thiện Cảm**${tierUpTxt}`;

    const res = buildHubResponsePayload({
      user,
      pet,
      inventory,
      dialogueObj,
      bannerText,
      frameUnlocked: frameUnlocked.unlockedNow ? frameUnlocked : null,
      gainedPoints,
      now,
    });
    res.gifted_item_id = gift.item_id;
    res.gifted_quantity = actualQty;
    return res;
  });
}

/**
 * Cộng điểm thiện cảm thụ động từ Chiến đấu (/battle, /nhiemvu tower, /linhmach, /explorer).
 * - 'battle': +2/trận, trần 20/ngày
 * - 'tower_vein': +3/trận, trần 15/ngày
 * - 'explorer': +10..25 khi sống sót nhận quà
 */
export async function grantCombatBondPoints(userId, sourceType = 'battle', rawAmount = 2, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { gainedPoints: 0, frameUnlocked: null };

  const amt = Math.max(0, Math.floor(Number(rawAmount) || 0));
  if (amt <= 0) return { gainedPoints: 0, frameUnlocked: null };

  return withBondLock(cleanId, async () => {
    const now = opts.now instanceof Date ? opts.now : new Date();
    const todayVn = getVnDateKey(now);
    const { user, pet } = await fetchUserAndActivePet(cleanId);
    if (!user || !pet) return { gainedPoints: 0, frameUnlocked: null };

    const bond = computeBondTierState(pet);
    if (bond.isMaxTier) return { gainedPoints: 0, tier: bond.tier, frameUnlocked: null };

    const sameDay = pet.daily_combat_bond_date === todayVn;
    let battleUsed = sameDay ? Number(pet.daily_battle_bond_pts || 0) : 0;
    let towerVeinUsed = sameDay ? Number(pet.daily_tower_vein_bond_pts || 0) : 0;

    let allowed = amt;
    if (sourceType === 'battle') {
      allowed = Math.min(amt, Math.max(0, PET_BOND_COMBAT_BATTLE_DAILY_CAP - battleUsed));
      battleUsed += allowed;
    } else if (sourceType === 'tower_vein' || sourceType === 'tower' || sourceType === 'vein') {
      allowed = Math.min(amt, Math.max(0, PET_BOND_COMBAT_TOWER_VEIN_DAILY_CAP - towerVeinUsed));
      towerVeinUsed += allowed;
    }

    const maxRoom = Math.max(0, bond.maxPoints - bond.points);
    const gainedPoints = Math.min(allowed, maxRoom);
    if (gainedPoints <= 0) return { gainedPoints: 0, tier: bond.tier, frameUnlocked: null };

    const nextPoints = Math.min(bond.maxPoints, bond.points + gainedPoints);
    const nextState = computeBondTierState(pet, nextPoints);
    const patch = {
      affection_points: nextPoints,
      affection_tier: nextState.tier,
      daily_combat_bond_date: todayVn,
      daily_battle_bond_pts: battleUsed,
      daily_tower_vein_bond_pts: towerVeinUsed,
    };
    await persistPetPatch(pet, patch);
    Object.assign(pet, patch);

    const frameUnlocked = await maybeUnlockBondFrameForPet({ userId: cleanId, user, pet });
    return {
      gainedPoints,
      points: nextPoints,
      tier: nextState.tier,
      tierLabel: nextState.tierLabel,
      leveledUpTier: nextState.tier > bond.tier,
      frameUnlocked: frameUnlocked.unlockedNow ? frameUnlocked : null,
    };
  });
}

/**
 * Helper nhanh đọc toàn bộ Buff Thiện Cảm của Pet Chính hiện tại cho các service khác.
 */
export async function getActivePetBondBuffs(userId) {
  const cleanId = sanitizeUserId(userId);
  const empty = {
    hasPet: false,
    petId: null,
    petType: null,
    isEvolved: false,
    tier: 0,
    maxTier: 3,
    tierLabel: 'Xa Lạ',
    points: 0,
    maxPoints: 120,
    buffs: computeBondBuffsForTier(0, null, false),
  };
  if (!cleanId) return empty;

  let pet = null;
  if (!supabase) {
    const pets = memBondStore.pets.get(cleanId) || [];
    pet = pets.find((p) => p.is_active) || pets[0] || null;
  } else {
    const { data } = await supabase
      .from('user_pets')
      .select('pet_id, pet_type, pet_name, is_evolved, affection_points, affection_tier, is_active')
      .eq('user_id', cleanId)
      .order('is_active', { ascending: false })
      .order('pet_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    pet = data || null;
  }

  if (!pet) return empty;
  const bond = computeBondTierState(pet);
  const buffs = computeBondBuffsForTier(bond.tier, pet);
  return {
    hasPet: true,
    petId: pet.pet_id,
    petType: pet.pet_type,
    petName: pet.pet_name,
    isEvolved: Boolean(pet.is_evolved),
    tier: bond.tier,
    maxTier: bond.maxTier,
    tierLabel: bond.tierLabel,
    points: bond.points,
    maxPoints: bond.maxPoints,
    buffs,
    petRow: pet,
  };
}

/**
 * Helper cộng thêm buff % All-Source Linh Thạch (+1.5%/Bậc, max +15%) từ Pet Bond.
 * Tuyệt đối KHÔNG gọi ở minigames (/coinflip, /blackjack, /slots, /crash), /dismantle, /exchange, /tangqua, /updates.
 */
export async function applyAllSourceLtBonus(userId, baseLt) {
  const base = Math.max(0, Math.round(Number(baseLt) || 0));
  if (base <= 0 || !userId) return { finalLt: base, bonusLt: 0, bonusPct: 0 };
  const bondInfo = await getActivePetBondBuffs(userId).catch(() => null);
  const pct = Number(bondInfo?.buffs?.allSourceLtPct || 0);
  if (pct <= 0) return { finalLt: base, bonusLt: 0, bonusPct: 0 };
  const bonusLt = Math.round(base * (pct / 100));
  return {
    finalLt: base + bonusLt,
    bonusLt,
    bonusPct: pct,
    tier: bondInfo.tier,
  };
}

export { FUYUMI_USER_ID };
