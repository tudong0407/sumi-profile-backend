/**
 * src/services/evolutionService.js
 * Hệ thống Tiến Hóa Pet Tối Thượng Chân Thần (/tienhoa) — SuMi Family Ver 1.7:
 * - Áp dụng cho toàn bộ 40 Pet Độc Nhất (V17_PET_EVOLUTIONS: 10 gốc + 20 Linh Thú mới + 10 Thú Nhân mới).
 * - Tab 1: Tiến Hóa Chân Thần (Lv.40 & 8★ + 1 Hồng Mông Tiến Hóa Tinh + 1.000..9.000 LT cho 60%..100%).
 *   + Giữ nguyên Lv / Sao / Khắc Ấn; nâng cấp chỉ số & mở khóa Skill Ultimate tái kích hoạt.
 *   + Thất bại CHỈ mất LT, GIỮ NGUYÊN Hồng Mông Tiến Hóa Tinh!
 * - Tab 2: Chế Tạo Hồng Mông Tiến Hóa Tinh (3 Mảnh Tinh Hoa Hỗn Độn + 1 Đồ Thần Thoại thường: Pet / Vũ Khí / Bảo Ngọc / Chiến Hồn / Linh Vực / Thần Thức / Thần Cảnh + 2.500 LT, xác nhận 2 lớp).
 * - KHÔNG hỗ trợ hiến đồ Độc Nhất /hiente.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import {
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  MYTHIC_UNIQUE_ITEM_IDS,
  V17_PET_EVOLUTIONS,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import {
  em,
  petEmoji,
  itemEmoji,
  domainEmoji,
  senseEmoji,
  realmEmojiById,
  tierEmoji,
  uiEm,
} from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { computeScaledPetBaseStats, invalidateInventoryCache, normalizeEmojiAwareQuery } from './inventoryService.js';
import { getUserBusyExplorationAssets } from './explorerService.js';
import { invalidateUniqueItemCard, invalidateUniquePetCard } from './staticAssetCacheService.js';

export const EVOLUTION_MIN_LEVEL = 40;
export const EVOLUTION_MIN_STAR = 8;
export const EVOLUTION_CRYSTAL_COST = 2;
export const CRAFT_EVO_CRYSTAL_SHARDS = 3;
export const CRAFT_EVO_CRYSTAL_LT = 2500;

export const EVOLUTION_LT_TIERS = [
  { tier: 1, lt: 1000, chance: 0.60, label: '1.000 LT (60%)' },
  { tier: 2, lt: 3000, chance: 0.70, label: '3.000 LT (70%)' },
  { tier: 3, lt: 5000, chance: 0.80, label: '5.000 LT (80%)' },
  { tier: 4, lt: 7000, chance: 0.90, label: '7.000 LT (90%)' },
  { tier: 5, lt: 9000, chance: 1.00, label: '9.000 LT (100%)' },
];

export const EVOLUTION_TIER_BY_KEY = Object.fromEntries(EVOLUTION_LT_TIERS.map((t) => [String(t.tier), t]));

const evoLocks = new Map();
const memEvoStore = {
  users: new Map(),
  pets: new Map(),
  items: new Map(),
  domains: new Map(),
  inventory: new Map(),
  loadouts: new Map(),
};

export function __resetEvolutionTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memEvoStore.users.clear();
  memEvoStore.pets.clear();
  memEvoStore.items.clear();
  memEvoStore.domains.clear();
  memEvoStore.inventory.clear();
  memEvoStore.loadouts.clear();
  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      const id = String(uid);
      memEvoStore.users.set(id, {
        user_id: id,
        username: data.username || `TuSi_${id}`,
        linh_thach: Number(data.linh_thach ?? data.coins ?? 0),
      });
      memEvoStore.pets.set(id, Array.isArray(data.pets) ? data.pets.map((p) => ({ ...p })) : []);
      memEvoStore.items.set(id, Array.isArray(data.items) ? data.items.map((it) => ({ ...it })) : []);
      memEvoStore.domains.set(id, Array.isArray(data.domains) ? data.domains.map((d) => ({ ...d })) : []);
      memEvoStore.inventory.set(id, { ...(data.inventory || {}) });
      memEvoStore.loadouts.set(id, Array.isArray(data.loadouts) ? data.loadouts.map((l) => ({ ...l })) : []);
    }
  }
}

export function __getEvolutionTestState(userId) {
  const id = String(userId);
  return {
    user: memEvoStore.users.get(id) || null,
    pets: memEvoStore.pets.get(id) || [],
    items: memEvoStore.items.get(id) || [],
    domains: memEvoStore.domains.get(id) || [],
    inventory: memEvoStore.inventory.get(id) || {},
    loadouts: memEvoStore.loadouts.get(id) || [],
  };
}

function normSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[«»`"'[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDomainMetaByRow(row) {
  if (!row) return null;
  if (row.entity_kind === 'domain') return DOMAIN_BY_ID[row.entity_id] || null;
  if (row.entity_kind === 'sense') return DIVINE_SENSE_BY_ID[row.entity_id] || null;
  if (row.entity_kind === 'realm') return DIVINE_REALM_BY_ID[row.entity_id] || null;
  return DOMAIN_BY_ID[row.entity_id] || DIVINE_SENSE_BY_ID[row.entity_id] || DIVINE_REALM_BY_ID[row.entity_id] || null;
}

function getDomainKindLabel(kind) {
  if (kind === 'domain') return 'Linh Vực';
  if (kind === 'sense') return 'Thần Thức';
  if (kind === 'realm') return 'Thần Cảnh';
  return 'Lãnh Địa';
}

function getItemSlotLabel(slot) {
  if (slot === 'weapon') return 'Vũ Khí';
  if (slot === 'gem') return 'Bảo Ngọc';
  if (slot === 'soul') return 'Chiến Hồn';
  return 'Pháp Bảo';
}

function getAssetEmoji(kind, id, fallback = '') {
  if (kind === 'pet') return petEmoji(id, fallback);
  if (kind === 'item') return itemEmoji(id, fallback);
  if (kind === 'domain') return domainEmoji(id, fallback);
  if (kind === 'sense') return senseEmoji(id, fallback);
  if (kind === 'realm') return realmEmojiById(id, fallback);
  return fallback;
}

function isNormalMythicPet(p) {
  const meta = PET_BY_TYPE[p?.pet_type];
  if (!meta) return false;
  const isFuyumi = p.pet_type === 'cuu_vi_hong_ho' || Boolean(meta.is_exclusive_fuyumi);
  const isUnique = Boolean(p.is_unique || meta.is_unique || p.is_evolved || V17_PET_EVOLUTIONS[p.pet_type]);
  return meta.rarity_key === 'mythic' && !isUnique && !isFuyumi;
}

function isNormalMythicItem(row) {
  const meta = EQUIPMENT_BY_ID[row?.item_id];
  if (!meta) return false;
  const isUnique = Boolean(row.is_unique || meta.is_unique || meta.is_exclusive_fuyumi || MYTHIC_UNIQUE_ITEM_IDS.has(row.item_id));
  return meta.rarity_key === 'mythic' && !isUnique;
}

function isNormalMythicDomain(row) {
  const meta = getDomainMetaByRow(row);
  if (!meta) return false;
  const isUnique = Boolean(row.is_unique || meta.is_unique || meta.is_exclusive_fuyumi);
  return meta.rarity_key === 'mythic' && !isUnique;
}

async function withEvoLock(userId, fn) {
  const prev = evoLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  evoLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (evoLocks.get(userId) === queued) evoLocks.delete(userId);
  }
}

export function resolveEvolutionLtTier(rawTierOrLt = 5) {
  const num = Number(rawTierOrLt);
  if (num >= 1000) {
    return EVOLUTION_LT_TIERS.find((t) => t.lt === num) || EVOLUTION_LT_TIERS[4];
  }
  return EVOLUTION_TIER_BY_KEY[String(Math.floor(num))] || EVOLUTION_LT_TIERS[4];
}

async function loadEvolutionContext(cleanId, options = {}) {
  if (supabase) {
    const [{ user }, { data: pets }, { data: items }, { data: domains }, { data: invRows }, busyAssets] = await Promise.all([
      ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      }),
      supabase.from('user_pets').select('*').eq('user_id', cleanId).order('power_score', { ascending: false }),
      supabase.from('user_pet_items').select('*').eq('user_id', cleanId),
      supabase.from('user_domains').select('*').eq('user_id', cleanId),
      supabase.from('user_inventory').select('item_id, quantity').eq('user_id', cleanId).in('item_id', ['evo_crystal', 'chaos_essence_shard']),
      getUserBusyExplorationAssets(cleanId).catch(() => null),
    ]);
    const inv = Object.fromEntries((invRows || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
    return {
      user,
      pets: pets || [],
      items: items || [],
      domains: domains || [],
      inv,
      busyAssets: busyAssets || { isExploring: false, busyPetIds: new Set(), busyItemIds: new Set(), busyDomainIds: new Set() },
    };
  }
  return {
    user: memEvoStore.users.get(cleanId) || { user_id: cleanId, linh_thach: 0 },
    pets: memEvoStore.pets.get(cleanId) || [],
    items: memEvoStore.items.get(cleanId) || [],
    domains: memEvoStore.domains.get(cleanId) || [],
    inv: memEvoStore.inventory.get(cleanId) || {},
    busyAssets: { isExploring: false, busyPetIds: new Set(), busyItemIds: new Set(), busyDomainIds: new Set() },
  };
}

export async function getEvolutionHub(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const { user, pets, items, domains, inv, busyAssets } = await loadEvolutionContext(cleanId, options);
  const bal = Number(user?.linh_thach || 0);
  const crystals = Number(inv.evo_crystal || 0);
  const shards = Number(inv.chaos_essence_shard || 0);

  const uniquePets = pets.filter((p) => Boolean(V17_PET_EVOLUTIONS[p.pet_type]));
  const totalOwnedPetRows = pets.filter((p) => Number(p.quantity || 1) >= 1).length;
  const sacrificePetPool = pets.filter((p) => (
    isNormalMythicPet(p)
    && !p.is_active
    && p.status === 'ready'
    && !(busyAssets?.isExploring && busyAssets.busyPetIds?.has(String(p.pet_id)) && Number(p.quantity || 1) <= 1)
    && !(totalOwnedPetRows <= 1 && Number(p.quantity || 1) <= 1)
  ));
  const sacrificeItemPool = items.filter((it) => {
    if (!isNormalMythicItem(it)) return false;
    const qty = Math.max(1, Number(it.quantity || 1));
    const isEq = Boolean(it.equipped_to_pet || it.slot);
    if (isEq && qty <= 1) return false;
    if (busyAssets?.isExploring && busyAssets.busyItemIds?.has(it.item_id) && qty <= 1) return false;
    return true;
  });
  const sacrificeDomainPool = domains.filter((d) => {
    if (!isNormalMythicDomain(d)) return false;
    const qty = Math.max(1, Number(d.quantity || 1));
    if (d.is_equipped && qty <= 1) return false;
    if (busyAssets?.isExploring && busyAssets.busyDomainIds?.has(d.entity_id) && qty <= 1) return false;
    return true;
  });

  const evoLines = uniquePets.length > 0
    ? uniquePets.map((p) => {
      const evo = V17_PET_EVOLUTIONS[p.pet_type];
      const eligible = !p.is_evolved && Number(p.level || 1) >= EVOLUTION_MIN_LEVEL && Number(p.star || 1) >= EVOLUTION_MIN_STAR && p.status === 'ready';
      const statusBadge = p.is_evolved
        ? `${tierEmoji('evolved_supreme')} **ĐÃ CHÂN THẦN** *(Ult: ${evo.ultimate.name})*`
        : eligible
          ? `${uiEm('ui_check')} Sẵn sàng tiến hóa`
          : `*(Cần Lv.${EVOLUTION_MIN_LEVEL} & ${EVOLUTION_MIN_STAR}★ — hiện Lv.${p.level || 1} • ${p.star || 1}★)*`;
      return `• ${petEmoji(p.pet_type, '', Boolean(p.is_evolved))} \`${p.pet_type}\` **${p.pet_name}**: ${statusBadge}`;
    })
    : ['• Bạn chưa sở hữu Linh Thú Độc Nhất nào trong 40 chủng loại có thể Tiến Hóa.'];

  const totalSacrificeCount = sacrificePetPool.length + sacrificeItemPool.length + sacrificeDomainPool.length;
  const readySummary = totalSacrificeCount > 0
    ? `${sacrificePetPool.length} Pet • ${sacrificeItemPool.length} Pháp Bảo • ${sacrificeDomainPool.length} Vực/Thức/Cảnh`
    : '0 món sẵn sàng';

  return {
    success: true,
    linh_thach: bal,
    evo_crystal: crystals,
    chaos_essence_shard: shards,
    unique_pets_count: uniquePets.length,
    sacrifice_candidates_count: totalSacrificeCount,
    sacrifice_counts: {
      pets: sacrificePetPool.length,
      items: sacrificeItemPool.length,
      domains: sacrificeDomainPool.length,
    },
    lt_tiers: EVOLUTION_LT_TIERS,
    title: `${tierEmoji('evolved_supreme')} ĐIỆN TIẾN HÓA CHÂN THẦN (/tienhoa)`,
    description: [
      `• ${em('su_linhthach')} **Linh Thạch:** **${bal.toLocaleString('vi-VN')} LT** • ${em('evo_crystal')} **Hồng Mông Tiến Hóa Tinh:** \`${crystals}\` • ${em('chaos_essence_shard')} **Mảnh Tinh Hoa Hỗn Độn:** \`${shards}\``,
      '',
      `**Tab 1 — Tiến Hóa Linh Thú Độc Nhất (Cần \`Lv.40 & 8★\` + \`${EVOLUTION_CRYSTAL_COST} Hồng Mông Tiến Hóa Tinh\`):**`,
      ...evoLines,
      '',
      `**Mức Phí Linh Thạch (Xịt CHỈ mất LT, GIỮ Hồng Mông):**`,
      `• \`1.000 LT (60%)\` • \`3.000 LT (70%)\` • \`5.000 LT (80%)\` • \`7.000 LT (90%)\` • \`9.000 LT (100%)\``,
      '',
      `**Tab 2 — Chế Tạo Hồng Mông Tiến Hóa Tinh:**`,
      `• Công thức: **\`3\` Mảnh Tinh Hoa Hỗn Độn + \`1\` Đồ Thần Thoại thường** *(Pet / Vũ Khí / Bảo Ngọc / Chiến Hồn / Linh Vực / Thần Thức / Thần Cảnh)* **+ \`2.500 LT\` = \`1\` Hồng Mông Tiến Hóa Tinh** *(${readySummary})*`,
    ].join('\n'),
    color: '#fb7185',
    footer: '',
  };
}

export async function evolveUniquePet(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowIso = now.toISOString();
  const ltTier = resolveEvolutionLtTier(options.ltTier ?? options.ltAmount ?? 5);

  return withEvoLock(cleanId, async () => {
    const { user, pets, inv } = await loadEvolutionContext(cleanId, options);
    const reqPetId = options.petId ? String(options.petId) : null;
    const reqPetType = options.petType ? String(options.petType).trim().toLowerCase() : null;

    const target = pets.find((p) => (reqPetId && String(p.pet_id) === reqPetId) || (reqPetType && p.pet_type === reqPetType));
    if (!target) {
      return { success: false, status: 404, error: 'PET_NOT_FOUND', message: 'Không tìm thấy Linh Thú cần tiến hóa trong kho của bạn.' };
    }

    const evoDef = V17_PET_EVOLUTIONS[target.pet_type];
    if (!evoDef) {
      return {
        success: false,
        status: 400,
        error: 'PET_NOT_EVOLVABLE',
        message: `${petEmoji(target.pet_type)} **${target.pet_name}** không nằm trong 40 Linh Thú Độc Nhất có thể Tiến Hóa Chân Thần!`,
      };
    }

    if (target.is_evolved) {
      return {
        success: false,
        status: 409,
        error: 'ALREADY_EVOLVED',
        message: `${tierEmoji('evolved_supreme')} **${target.pet_name}** đã tiến hóa lên **Tối Thượng Chân Thần** rồi!`,
      };
    }

    if (target.status === 'exploring' || target.status === 'injured') {
      return {
        success: false,
        status: 400,
        error: 'PET_UNAVAILABLE',
        message: `Linh Thú **${target.pet_name}** đang ở trạng thái \`${target.status}\`, không thể tiến hóa lúc này!`,
      };
    }

    const lvl = Number(target.level || 1);
    const star = Number(target.star || 1);
    if (lvl < EVOLUTION_MIN_LEVEL || star < EVOLUTION_MIN_STAR) {
      return {
        success: false,
        status: 400,
        error: 'REQUIREMENTS_NOT_MET',
        message: `Cần đạt tối thiểu **Lv.${EVOLUTION_MIN_LEVEL} & ${EVOLUTION_MIN_STAR}★** để tiến hóa *(Hiện tại: **Lv.${lvl} • ${star}★**)*!`,
      };
    }

    const crystalQty = Number(inv.evo_crystal || 0);
    if (crystalQty < EVOLUTION_CRYSTAL_COST) {
      return {
        success: false,
        status: 400,
        error: 'MISSING_EVO_CRYSTAL',
        message: `Cần **${EVOLUTION_CRYSTAL_COST} ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh** để tiến hóa *(Hiện có: \`${crystalQty}\` — Hãy chế tạo ở Tab 2 hoặc mua ở \`/shop_dacbiet\`)*!`,
      };
    }

    const bal = Number(user.linh_thach || 0);
    if (bal < ltTier.lt) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FUNDS',
        message: `Cần **${ltTier.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} **LT** cho gói **${ltTier.label}** *(Hiện có: ${bal.toLocaleString('vi-VN')} LT)*!`,
      };
    }

    const nextBal = bal - ltTier.lt;
    const succeeded = options.forceSuccess === true ? true : options.forceFail === true ? false : rng() < ltTier.chance;

    if (!succeeded) {
      // THẤT BẠI: CHỈ trừ Linh Thạch, GIỮ NGUYÊN Hồng Mông Tiến Hóa Tinh!
      if (supabase) {
        await supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId);
      } else {
        user.linh_thach = nextBal;
      }

      return {
        success: true,
        evolved: false,
        pet_type: target.pet_type,
        lt_spent: ltTier.lt,
        linh_thach: nextBal,
        evo_crystal_remaining: crystalQty,
        chance_pct: Math.round(ltTier.chance * 100),
        title: `${uiEm('ui_warn')} TIẾN HÓA TẠM THỜI THẤT BẠI!`,
        description: `Ngọn lửa Hồng Mông chưa đủ ngưng tụ (${Math.round(ltTier.chance * 100)}%)!\n• Đã tiêu hao **-${ltTier.lt.toLocaleString('vi-VN')} LT** *(còn **${nextBal.toLocaleString('vi-VN')} LT**)*\n• ${em('evo_crystal')} **Hồng Mông Tiến Hóa Tinh ĐƯỢC GIỮ NGUYÊN (${crystalQty})!**`,
        color: '#f59e0b',
      };
    }

    // THÀNH CÔNG: Trừ LT + 1 evo_crystal, nâng cấp is_evolved = true, tăng stats (giữ Lv/Star/Enchant)
    const baseMeta = PET_BY_TYPE[target.pet_type] || {
      pet_type: target.pet_type,
      base_atk: target.atk || 500,
      base_def: target.def || 500,
      base_spd: target.spd || 500,
    };
    const scaled = computeScaledPetBaseStats(baseMeta, lvl, star, true);
    const nextCrystal = crystalQty - EVOLUTION_CRYSTAL_COST;

    if (supabase) {
      await Promise.all([
        supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId),
        supabase.from('user_inventory').update({ quantity: nextCrystal, updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', 'evo_crystal'),
        supabase.from('user_pets').update({
          is_evolved: true,
          evolved_at: nowIso,
          pet_rarity: 'Tối Thượng Chân Thần',
          pet_name: evoDef.evolved_name,
          atk: scaled.atk,
          def: scaled.def,
          spd: scaled.spd,
          power_score: scaled.power_score,
        }).eq('pet_id', target.pet_id),
      ]);
      invalidateInventoryCache(cleanId);
      invalidateUniqueItemCard(target.pet_type);
      invalidateUniquePetCard(target.pet_type);
    } else {
      user.linh_thach = nextBal;
      inv.evo_crystal = nextCrystal;
      target.is_evolved = true;
      target.evolved_at = nowIso;
      target.pet_rarity = 'Tối Thượng Chân Thần';
      target.pet_name = evoDef.evolved_name;
      target.atk = scaled.atk;
      target.def = scaled.def;
      target.spd = scaled.spd;
      target.power_score = scaled.power_score;
    }

    return {
      success: true,
      evolved: true,
      pet_type: target.pet_type,
      evolved_name: evoDef.evolved_name,
      level: lvl,
      star,
      enchant_grade: target.enchant_grade || 'D',
      new_stats: { atk: scaled.atk, def: scaled.def, spd: scaled.spd, power_score: scaled.power_score },
      ultimate: evoDef.ultimate,
      lt_spent: ltTier.lt,
      linh_thach: nextBal,
      evo_crystal_remaining: nextCrystal,
      title: `${tierEmoji('evolved_supreme')} TIẾN HÓA CHÂN THẦN THÀNH CÔNG!!`,
      description: [
        `${petEmoji(target.pet_type, '', true)} **${evoDef.evolved_name}** chính thức bước vào cảnh giới **Tối Thượng Chân Thần**!`,
        `• **Giữ nguyên:** \`Lv.${lvl}\` • \`${star}★\` • Khắc Ấn \`${target.enchant_grade || 'D'}\``,
        `• **Chỉ số mới:** ATK **${scaled.atk.toLocaleString('vi-VN')}** • DEF **${scaled.def.toLocaleString('vi-VN')}** • SPD **${scaled.spd.toLocaleString('vi-VN')}** • Lực **${scaled.power_score.toLocaleString('vi-VN')}**`,
        `• **Mở khóa Skill Ultimate Tái Kích Hoạt:** **${evoDef.ultimate.name}** — *${evoDef.ultimate.desc}*`,
      ].join('\n'),
      color: '#fb7185',
    };
  });
}

export async function craftEvoCrystal(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const nowIso = now.toISOString();

  return withEvoLock(cleanId, async () => {
    const { user, pets, items, domains, inv, busyAssets } = await loadEvolutionContext(cleanId, options);
    const reqRefRaw = options.targetPetId ? String(options.targetPetId).trim() : null;
    const rawQuery = options.targetAsset ?? options.targetPetType ?? '';
    const emojiNormalized = normalizeEmojiAwareQuery(rawQuery);
    const normQ = normSearchText(emojiNormalized || rawQuery);

    // Xây dựng danh sách ứng viên từ cả 3 kho: Pet, Pháp Bảo (Vũ Khí/Bảo Ngọc/Chiến Hồn), Vực/Thức/Cảnh
    let matched = null; // { kind: 'pet'|'item'|'domain', row, id, name, categoryLabel, subKind, icon }

    if (reqRefRaw) {
      if (reqRefRaw.startsWith('pet:')) {
        const pid = reqRefRaw.slice(4);
        const r = pets.find((p) => String(p.pet_id) === pid);
        if (r) matched = { kind: 'pet', row: r, id: r.pet_type, name: r.pet_name || PET_BY_TYPE[r.pet_type]?.pet_name || r.pet_type, categoryLabel: 'Pet Thần Thoại', subKind: 'pet', icon: petEmoji(r.pet_type) };
      } else if (reqRefRaw.startsWith('item:')) {
        const iid = reqRefRaw.slice(5);
        const r = items.find((it) => String(it.id ?? it.item_id) === iid || it.item_id === iid);
        const meta = r ? EQUIPMENT_BY_ID[r.item_id] : null;
        if (r) matched = { kind: 'item', row: r, id: r.item_id, name: meta?.item_name || r.item_id, categoryLabel: `${getItemSlotLabel(meta?.item_type || r.slot)} Thần Thoại`, subKind: meta?.item_type || r.slot || 'weapon', icon: itemEmoji(r.item_id) };
      } else if (reqRefRaw.startsWith('domain:')) {
        const did = reqRefRaw.slice(7);
        const r = domains.find((d) => String(d.id ?? `${d.entity_kind}_${d.entity_id}`) === did || d.entity_id === did);
        const meta = r ? getDomainMetaByRow(r) : null;
        if (r) matched = { kind: 'domain', row: r, id: r.entity_id, name: meta?.name || r.entity_id, categoryLabel: `${getDomainKindLabel(r.entity_kind)} Thần Thoại`, subKind: r.entity_kind, icon: getAssetEmoji(r.entity_kind, r.entity_id) };
      } else {
        // Legacy raw targetPetId
        const r = pets.find((p) => String(p.pet_id) === reqRefRaw);
        if (r) matched = { kind: 'pet', row: r, id: r.pet_type, name: r.pet_name || PET_BY_TYPE[r.pet_type]?.pet_name || r.pet_type, categoryLabel: 'Pet Thần Thoại', subKind: 'pet', icon: petEmoji(r.pet_type) };
      }
    }

    if (!matched && normQ) {
      const petMatches = pets.filter((p) => (
        normSearchText(p.pet_type) === normQ
        || normSearchText(p.pet_name) === normQ
        || normSearchText(PET_BY_TYPE[p.pet_type]?.pet_name) === normQ
      ));
      const itemMatches = items.filter((it) => {
        const meta = EQUIPMENT_BY_ID[it.item_id];
        return normSearchText(it.item_id) === normQ || normSearchText(meta?.item_name) === normQ;
      });
      const domMatches = domains.filter((d) => {
        const meta = getDomainMetaByRow(d);
        return normSearchText(d.entity_id) === normQ || normSearchText(meta?.name) === normQ;
      });

      const bestPet = petMatches.find((p) => isNormalMythicPet(p) && !p.is_active && p.status === 'ready') || petMatches[0];
      const bestItem = itemMatches.find((it) => isNormalMythicItem(it) && (!(it.equipped_to_pet || it.slot) || Number(it.quantity || 1) > 1)) || itemMatches[0];
      const bestDom = domMatches.find((d) => isNormalMythicDomain(d) && (!d.is_equipped || Number(d.quantity || 1) > 1)) || domMatches[0];

      if (bestPet && isNormalMythicPet(bestPet)) {
        matched = { kind: 'pet', row: bestPet, id: bestPet.pet_type, name: bestPet.pet_name || PET_BY_TYPE[bestPet.pet_type]?.pet_name || bestPet.pet_type, categoryLabel: 'Pet Thần Thoại', subKind: 'pet', icon: petEmoji(bestPet.pet_type) };
      } else if (bestItem && isNormalMythicItem(bestItem)) {
        const meta = EQUIPMENT_BY_ID[bestItem.item_id];
        matched = { kind: 'item', row: bestItem, id: bestItem.item_id, name: meta?.item_name || bestItem.item_id, categoryLabel: `${getItemSlotLabel(meta?.item_type || bestItem.slot)} Thần Thoại`, subKind: meta?.item_type || bestItem.slot || 'weapon', icon: itemEmoji(bestItem.item_id) };
      } else if (bestDom && isNormalMythicDomain(bestDom)) {
        const meta = getDomainMetaByRow(bestDom);
        matched = { kind: 'domain', row: bestDom, id: bestDom.entity_id, name: meta?.name || bestDom.entity_id, categoryLabel: `${getDomainKindLabel(bestDom.entity_kind)} Thần Thoại`, subKind: bestDom.entity_kind, icon: getAssetEmoji(bestDom.entity_kind, bestDom.entity_id) };
      } else if (bestPet) {
        matched = { kind: 'pet', row: bestPet, id: bestPet.pet_type, name: bestPet.pet_name || bestPet.pet_type, categoryLabel: 'Pet', subKind: 'pet', icon: petEmoji(bestPet.pet_type) };
      } else if (bestItem) {
        const meta = EQUIPMENT_BY_ID[bestItem.item_id];
        matched = { kind: 'item', row: bestItem, id: bestItem.item_id, name: meta?.item_name || bestItem.item_id, categoryLabel: getItemSlotLabel(meta?.item_type || bestItem.slot), subKind: meta?.item_type || bestItem.slot || 'weapon', icon: itemEmoji(bestItem.item_id) };
      } else if (bestDom) {
        const meta = getDomainMetaByRow(bestDom);
        matched = { kind: 'domain', row: bestDom, id: bestDom.entity_id, name: meta?.name || bestDom.entity_id, categoryLabel: getDomainKindLabel(bestDom.entity_kind), subKind: bestDom.entity_kind, icon: getAssetEmoji(bestDom.entity_kind, bestDom.entity_id) };
      }
    }

    if (!matched) {
      return {
        success: false,
        status: 404,
        error: 'SACRIFICE_PET_NOT_FOUND',
        message: 'Không tìm thấy **Đồ Thần Thoại thường** *(Pet / Vũ Khí / Bảo Ngọc / Chiến Hồn / Linh Vực / Thần Thức / Thần Cảnh)* hợp lệ trong kho của bạn! Hãy nhập đúng mã ID hoặc tên món đồ ở tham số `linh_thu`.',
      };
    }

    // Kiểm tra bảo vệ từng loại
    if (matched.kind === 'pet') {
      const target = matched.row;
      const meta = PET_BY_TYPE[target.pet_type];
      const isFuyumiPet = target.pet_type === 'cuu_vi_hong_ho' || Boolean(meta?.is_exclusive_fuyumi);
      if (isFuyumiPet || (cleanId === FUYUMI_USER_ID && target.pet_type === 'cuu_vi_hong_ho')) {
        return { success: false, status: 403, error: 'PROTECTED_FUYUMI_PET', message: 'Không thể dùng Linh Thú độc quyền Tiểu thư làm nguyên liệu!' };
      }
      if (!isNormalMythicPet(target)) {
        return {
          success: false,
          status: 400,
          error: 'INVALID_SACRIFICE_RARITY',
          message: 'Chỉ được dùng **Đồ Thần Thoại thường (KHÔNG Độc Nhất, chưa Tiến Hóa)** — gồm Pet, Pháp Bảo hoặc Linh Vực / Thần Thức / Thần Cảnh — để chế tạo Hồng Mông Tiến Hóa Tinh!',
        };
      }
      if (target.is_active) {
        return {
          success: false,
          status: 400,
          error: 'PET_IS_ACTIVE',
          message: `Không thể dùng **${matched.name}** khi đang đặt làm **Pet Chính**! Hãy đổi Pet Chính khác trước.`,
        };
      }
      const qty = Math.max(1, Number(target.quantity || 1));
      if (target.status === 'exploring' || target.status === 'injured' || (busyAssets?.isExploring && busyAssets.busyPetIds?.has(String(target.pet_id)) && qty <= 1)) {
        return {
          success: false,
          status: 400,
          error: 'PET_BUSY',
          message: `Linh Thú **${matched.name}** đang bận Khám Phá / Bị Thương (\`${target.status}\`), không thể dùng làm nguyên liệu!`,
        };
      }
      const totalOwnedRows = pets.filter((p) => Number(p.quantity || 1) >= 1).length;
      if (totalOwnedRows <= 1 && qty <= 1) {
        return {
          success: false,
          status: 400,
          error: 'CANNOT_SACRIFICE_LAST_PET',
          message: 'Không thể tiêu hao con Linh Thú duy nhất còn lại trong kho!',
        };
      }
    } else if (matched.kind === 'item') {
      const target = matched.row;
      const meta = EQUIPMENT_BY_ID[target.item_id];
      if (meta?.is_exclusive_fuyumi) {
        return { success: false, status: 403, error: 'PROTECTED_FUYUMI_ASSET', message: 'Không thể dùng Pháp Bảo độc quyền Tiểu thư làm nguyên liệu!' };
      }
      if (!isNormalMythicItem(target)) {
        return {
          success: false,
          status: 400,
          error: 'INVALID_SACRIFICE_RARITY',
          message: 'Chỉ được dùng **Đồ Thần Thoại thường (KHÔNG Độc Nhất)** — gồm Pet, Pháp Bảo hoặc Linh Vực / Thần Thức / Thần Cảnh — để chế tạo Hồng Mông Tiến Hóa Tinh!',
        };
      }
      const qty = Math.max(1, Number(target.quantity || 1));
      const isEq = Boolean(target.equipped_to_pet || target.slot);
      if (isEq && qty <= 1) {
        return {
          success: false,
          status: 400,
          error: 'ITEM_EQUIPPED',
          message: `Pháp Bảo **${matched.name}** hiện đang được trang bị! Hãy tháo ra bằng \`/unequip loai:item ma_id:${target.item_id}\` trước khi dùng chế tạo.`,
        };
      }
      if (busyAssets?.isExploring && busyAssets.busyItemIds?.has(target.item_id) && qty <= 1) {
        return {
          success: false,
          status: 400,
          error: 'ITEM_BUSY',
          message: `Pháp Bảo **${matched.name}** đang khóa trong chuyến Khám Phá (\`/explorer\`), không thể dùng lúc này!`,
        };
      }
    } else if (matched.kind === 'domain') {
      const target = matched.row;
      const meta = getDomainMetaByRow(target);
      if (meta?.is_exclusive_fuyumi) {
        return { success: false, status: 403, error: 'PROTECTED_FUYUMI_ASSET', message: 'Không thể dùng bảo vật Độc Tôn làm nguyên liệu!' };
      }
      if (!isNormalMythicDomain(target)) {
        return {
          success: false,
          status: 400,
          error: 'INVALID_SACRIFICE_RARITY',
          message: 'Chỉ được dùng **Đồ Thần Thoại thường (KHÔNG Độc Nhất)** — gồm Pet, Pháp Bảo hoặc Linh Vực / Thần Thức / Thần Cảnh — để chế tạo Hồng Mông Tiến Hóa Tinh!',
        };
      }
      const qty = Math.max(1, Number(target.quantity || 1));
      if (target.is_equipped && qty <= 1) {
        return {
          success: false,
          status: 400,
          error: 'DOMAIN_EQUIPPED',
          message: `**${matched.name}** hiện đang được trang bị ở \`/linhvuc\`! Hãy tháo ra trước khi dùng chế tạo.`,
        };
      }
      if (busyAssets?.isExploring && busyAssets.busyDomainIds?.has(target.entity_id) && qty <= 1) {
        return {
          success: false,
          status: 400,
          error: 'DOMAIN_BUSY',
          message: `**${matched.name}** đang khóa trong chuyến Khám Phá (\`/explorer\`), không thể dùng lúc này!`,
        };
      }
    }

    const shardQty = Number(inv.chaos_essence_shard || 0);
    if (shardQty < CRAFT_EVO_CRYSTAL_SHARDS) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_CHAOS_SHARDS',
        message: `Cần **${CRAFT_EVO_CRYSTAL_SHARDS} ${em('chaos_essence_shard')} Mảnh Tinh Hoa Hỗn Độn** *(hiện có: **${shardQty}**)*!`,
      };
    }
    const bal = Number(user.linh_thach || 0);
    if (bal < CRAFT_EVO_CRYSTAL_LT) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FUNDS',
        message: `Cần **${CRAFT_EVO_CRYSTAL_LT.toLocaleString('vi-VN')}** ${em('su_linhthach')} **LT** *(hiện có: ${bal.toLocaleString('vi-VN')} LT)*!`,
      };
    }

    const targetRow = matched.row;
    const prevQty = Math.max(1, Number(targetRow.quantity || 1));
    const encodedTargetId = matched.kind === 'pet'
      ? `pet:${targetRow.pet_id}`
      : matched.kind === 'item'
        ? `item:${targetRow.id ?? targetRow.item_id}`
        : `domain:${targetRow.id ?? targetRow.entity_id}`;
    const detailSub = matched.kind === 'pet'
      ? `Lv.${targetRow.level || 1} • ${targetRow.star || 1}★ • đang có SL ${prevQty}`
      : `${matched.categoryLabel}${targetRow.enchant_grade ? ` • Ấn ${targetRow.enchant_grade}` : ''} • đang có SL ${prevQty}`;

    // Xác nhận 2 lớp
    if (options.confirmed !== true) {
      const previewMsg = [
        `Thao tác này sẽ **TIÊU HAO VĨNH VIỄN** các nguyên liệu sau:`,
        `• **1×** ${matched.icon} **${matched.name}** *(${detailSub})*`,
        `• **${CRAFT_EVO_CRYSTAL_SHARDS}×** ${em('chaos_essence_shard')} **Mảnh Tinh Hoa Hỗn Độn**`,
        `• **${CRAFT_EVO_CRYSTAL_LT.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`,
        '',
        `→ Thu về: **+1 ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh**. Bấm **Xác Nhận Chế Tạo** để hoàn tất!`,
      ].join('\n');
      return {
        success: true,
        requires_confirmation: true,
        target_pet_id: encodedTargetId,
        target_kind: matched.kind,
        target_id: matched.id,
        pet_id: matched.kind === 'pet' ? String(targetRow.pet_id) : encodedTargetId,
        pet_type: matched.id,
        pet_name: matched.name,
        title: `${uiEm('ui_warn')} XÁC NHẬN CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH`,
        description: previewMsg,
        message: previewMsg,
        color: '#f59e0b',
      };
    }

    const nextBal = bal - CRAFT_EVO_CRYSTAL_LT;
    const nextShards = shardQty - CRAFT_EVO_CRYSTAL_SHARDS;
    const nextCrystals = Number(inv.evo_crystal || 0) + 1;

    if (supabase) {
      await Promise.all([
        supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId),
        supabase.from('user_inventory').update({ quantity: nextShards, updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', 'chaos_essence_shard'),
      ]);

      const { data: exCr } = await supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'evo_crystal').maybeSingle();
      if (exCr) {
        await supabase.from('user_inventory').update({ quantity: Number(exCr.quantity || 0) + 1, updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', 'evo_crystal');
      } else {
        await supabase.from('user_inventory').insert({ user_id: cleanId, item_id: 'evo_crystal', item_category: 'consumable', quantity: 1, updated_at: nowIso });
      }

      if (matched.kind === 'pet') {
        if (prevQty > 1) {
          await supabase.from('user_pets').update({ quantity: prevQty - 1 }).eq('pet_id', targetRow.pet_id);
        } else {
          await supabase.from('user_pets').delete().eq('pet_id', targetRow.pet_id);
          await supabase
            .from('user_loadouts')
            .update({ pet_id: null, pet_type: null, updated_at: nowIso })
            .eq('user_id', cleanId)
            .eq('pet_id', String(targetRow.pet_id));
        }
      } else if (matched.kind === 'item') {
        if (prevQty > 1) {
          await supabase.from('user_pet_items').update({ quantity: prevQty - 1 }).eq('id', targetRow.id);
        } else {
          await supabase.from('user_pet_items').delete().eq('id', targetRow.id);
          const slotCol = matched.subKind === 'gem' ? 'gem_id' : matched.subKind === 'soul' ? 'soul_id' : 'weapon_id';
          await supabase
            .from('user_loadouts')
            .update({ [slotCol]: null, updated_at: nowIso })
            .eq('user_id', cleanId)
            .eq(slotCol, matched.id);
        }
      } else if (matched.kind === 'domain') {
        if (prevQty > 1) {
          await supabase.from('user_domains').update({ quantity: prevQty - 1, updated_at: nowIso }).eq('id', targetRow.id);
        } else {
          await supabase.from('user_domains').delete().eq('id', targetRow.id);
          const domCol = matched.subKind === 'sense' ? 'sense_id' : matched.subKind === 'realm' ? 'realm_id' : 'domain_id';
          await supabase
            .from('user_loadouts')
            .update({ [domCol]: null, updated_at: nowIso })
            .eq('user_id', cleanId)
            .eq(domCol, matched.id);
        }
      }
      invalidateInventoryCache(cleanId);
    } else {
      user.linh_thach = nextBal;
      inv.chaos_essence_shard = nextShards;
      inv.evo_crystal = nextCrystals;
      if (matched.kind === 'pet') {
        if (prevQty > 1) {
          targetRow.quantity = prevQty - 1;
        } else {
          const list = memEvoStore.pets.get(cleanId) || [];
          memEvoStore.pets.set(cleanId, list.filter((p) => String(p.pet_id) !== String(targetRow.pet_id)));
          for (const lo of memEvoStore.loadouts.get(cleanId) || []) {
            if (String(lo.pet_id) === String(targetRow.pet_id)) {
              lo.pet_id = null;
              lo.pet_type = null;
            }
          }
        }
      } else if (matched.kind === 'item') {
        if (prevQty > 1) {
          targetRow.quantity = prevQty - 1;
        } else {
          const list = memEvoStore.items.get(cleanId) || [];
          memEvoStore.items.set(cleanId, list.filter((it) => String(it.id ?? it.item_id) !== String(targetRow.id ?? targetRow.item_id)));
          const slotCol = matched.subKind === 'gem' ? 'gem_id' : matched.subKind === 'soul' ? 'soul_id' : 'weapon_id';
          for (const lo of memEvoStore.loadouts.get(cleanId) || []) {
            if (lo[slotCol] === matched.id) lo[slotCol] = null;
          }
        }
      } else if (matched.kind === 'domain') {
        if (prevQty > 1) {
          targetRow.quantity = prevQty - 1;
        } else {
          const list = memEvoStore.domains.get(cleanId) || [];
          memEvoStore.domains.set(cleanId, list.filter((d) => String(d.id ?? d.entity_id) !== String(targetRow.id ?? targetRow.entity_id)));
          const domCol = matched.subKind === 'sense' ? 'sense_id' : matched.subKind === 'realm' ? 'realm_id' : 'domain_id';
          for (const lo of memEvoStore.loadouts.get(cleanId) || []) {
            if (lo[domCol] === matched.id) lo[domCol] = null;
          }
        }
      }
    }

    const successMsg = [
      `Đã dung hợp thành công **1 ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh**!`,
      `• **Đã tiêu hao:** \`${CRAFT_EVO_CRYSTAL_SHARDS}\` Mảnh Hỗn Độn + ${matched.icon} **${matched.name}** *(${matched.categoryLabel})* + \`${CRAFT_EVO_CRYSTAL_LT.toLocaleString('vi-VN')} LT\``,
      `• **Hiện có:** ${em('evo_crystal')} \`${nextCrystals}\` • ${em('chaos_essence_shard')} \`${nextShards}\` • **${nextBal.toLocaleString('vi-VN')} LT**`,
    ].join('\n');

    return {
      success: true,
      crafted: 1,
      evo_crystal: nextCrystals,
      chaos_essence_shard: nextShards,
      linh_thach: nextBal,
      consumed_asset: { kind: matched.kind, sub_kind: matched.subKind, id: matched.id, name: matched.name },
      consumed_pet: { pet_id: encodedTargetId, pet_type: matched.id, pet_name: matched.name },
      title: `${em('evo_crystal')} CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH THÀNH CÔNG!`,
      description: successMsg,
      message: successMsg,
      color: '#10b981',
    };
  });
}
