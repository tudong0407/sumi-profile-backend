/**
 * src/services/evolutionService.js
 * Hệ thống Tiến Hóa Pet Tối Thượng Chân Thần (/tienhoa) — SuMi Family Ver 1.7:
 * - Áp dụng cho toàn bộ 40 Pet Độc Nhất (V17_PET_EVOLUTIONS: 10 gốc + 20 Linh Thú mới + 10 Thú Nhân mới).
 * - Tab 1: Tiến Hóa Chân Thần (Lv.40 & 8★ + 1 Hồng Mông Tiến Hóa Tinh + 1.000..9.000 LT cho 60%..100%).
 *   + Giữ nguyên Lv / Sao / Khắc Ấn; nâng cấp chỉ số & mở khóa Skill Ultimate tái kích hoạt.
 *   + Thất bại CHỈ mất LT, GIỮ NGUYÊN Hồng Mông Tiến Hóa Tinh!
 * - Tab 2: Chế Tạo Hồng Mông Tiến Hóa Tinh (3 Mảnh Tinh Hoa Hỗn Độn + 1 Pet Thần Thoại thường + 2.500 LT, xác nhận 2 lớp).
 * - KHÔNG hỗ trợ hiến đồ Độc Nhất /hiente.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import {
  PET_BY_TYPE,
  V17_PET_EVOLUTIONS,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import { em, petEmoji, tierEmoji, uiEm } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { computeScaledPetBaseStats, invalidateInventoryCache } from './inventoryService.js';
import { invalidateUniqueItemCard } from './staticAssetCacheService.js';

export const EVOLUTION_MIN_LEVEL = 40;
export const EVOLUTION_MIN_STAR = 8;
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
  inventory: new Map(),
  loadouts: new Map(),
};

export function __resetEvolutionTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memEvoStore.users.clear();
  memEvoStore.pets.clear();
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
    inventory: memEvoStore.inventory.get(id) || {},
    loadouts: memEvoStore.loadouts.get(id) || [],
  };
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
    const [{ user }, { data: pets }, { data: invRows }] = await Promise.all([
      ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      }),
      supabase.from('user_pets').select('*').eq('user_id', cleanId).order('power_score', { ascending: false }),
      supabase.from('user_inventory').select('item_id, quantity').eq('user_id', cleanId).in('item_id', ['evo_crystal', 'chaos_essence_shard']),
    ]);
    const inv = Object.fromEntries((invRows || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
    return { user, pets: pets || [], inv };
  }
  return {
    user: memEvoStore.users.get(cleanId) || { user_id: cleanId, linh_thach: 0 },
    pets: memEvoStore.pets.get(cleanId) || [],
    inv: memEvoStore.inventory.get(cleanId) || {},
  };
}

export async function getEvolutionHub(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const { user, pets, inv } = await loadEvolutionContext(cleanId, options);
  const bal = Number(user?.linh_thach || 0);
  const crystals = Number(inv.evo_crystal || 0);
  const shards = Number(inv.chaos_essence_shard || 0);

  const uniquePets = pets.filter((p) => Boolean(V17_PET_EVOLUTIONS[p.pet_type]));
  const sacrificePool = pets.filter((p) => {
    const meta = PET_BY_TYPE[p.pet_type];
    return meta && meta.rarity_key === 'mythic' && !meta.is_unique && !meta.is_exclusive_fuyumi && !p.is_evolved && !p.is_active && p.status === 'ready';
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
      return `• ${petEmoji(p.pet_type)} \`${p.pet_type}\` **${p.pet_name}**: ${statusBadge}`;
    })
    : ['• Bạn chưa sở hữu Linh Thú Độc Nhất nào trong 40 chủng loại có thể Tiến Hóa.'];

  return {
    success: true,
    linh_thach: bal,
    evo_crystal: crystals,
    chaos_essence_shard: shards,
    unique_pets_count: uniquePets.length,
    sacrifice_candidates_count: sacrificePool.length,
    lt_tiers: EVOLUTION_LT_TIERS,
    title: `${tierEmoji('evolved_supreme')} ĐIỆN TIẾN HÓA CHÂN THẦN (/tienhoa)`,
    description: [
      `• ${em('su_linhthach')} **Linh Thạch:** **${bal.toLocaleString('vi-VN')} LT** • ${em('evo_crystal')} **Hồng Mông Tiến Hóa Tinh:** \`${crystals}\` • ${em('chaos_essence_shard')} **Mảnh Tinh Hoa Hỗn Độn:** \`${shards}\``,
      '',
      `**Tab 1 — Tiến Hóa Linh Thú Độc Nhất (Cần \`Lv.40 & 8★\` + \`1 Hồng Mông Tiến Hóa Tinh\`):**`,
      ...evoLines,
      '',
      `**Mức Phí Linh Thạch (Xịt CHỈ mất LT, GIỮ Hồng Mông):**`,
      `• \`1.000 LT (60%)\` • \`3.000 LT (70%)\` • \`5.000 LT (80%)\` • \`7.000 LT (90%)\` • \`9.000 LT (100%)\``,
      '',
      `**Tab 2 — Chế Tạo Hồng Mông Tiến Hóa Tinh:**`,
      `• Công thức: **\`3\` Mảnh Tinh Hoa Hỗn Độn + \`1\` Pet Thần Thoại thường + \`2.500 LT\` = \`1\` Hồng Mông Tiến Hóa Tinh** *(Sẵn sàng hiến: ${sacrificePool.length} Pet)*`,
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
    if (crystalQty < 1) {
      return {
        success: false,
        status: 400,
        error: 'MISSING_EVO_CRYSTAL',
        message: `Cần **1 ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh** để tiến hóa *(Hãy chế tạo ở Tab 2 hoặc mua ở \`/shop_dacbiet\`)*!`,
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
    const nextCrystal = crystalQty - 1;

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
        `${petEmoji(target.pet_type)} **${evoDef.evolved_name}** chính thức bước vào cảnh giới **Tối Thượng Chân Thần**!`,
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
    const { user, pets, inv } = await loadEvolutionContext(cleanId, options);
    const reqPetId = options.targetPetId ? String(options.targetPetId) : null;
    const reqPetType = options.targetPetType ? String(options.targetPetType).trim().toLowerCase() : null;

    const target = pets.find((p) => (reqPetId && String(p.pet_id) === reqPetId) || (reqPetType && p.pet_type === reqPetType));
    if (!target) {
      return { success: false, status: 404, error: 'SACRIFICE_PET_NOT_FOUND', message: 'Không tìm thấy Linh Thú nguyên liệu trong kho của bạn.' };
    }

    const meta = PET_BY_TYPE[target.pet_type];
    const isFuyumiPet = target.pet_type === 'cuu_vi_hong_ho' || Boolean(meta?.is_exclusive_fuyumi);
    const isUniquePet = Boolean(target.is_unique || meta?.is_unique || target.is_evolved || V17_PET_EVOLUTIONS[target.pet_type]);
    const isMythicNormal = meta?.rarity_key === 'mythic' && !isUniquePet && !isFuyumiPet;

    if (isFuyumiPet || cleanId === FUYUMI_USER_ID && target.pet_type === 'cuu_vi_hong_ho') {
      return { success: false, status: 403, error: 'PROTECTED_FUYUMI_PET', message: 'Không thể dùng Linh Thú độc quyền Tiểu thư làm nguyên liệu!' };
    }
    if (!isMythicNormal) {
      return {
        success: false,
        status: 400,
        error: 'INVALID_SACRIFICE_RARITY',
        message: 'Chỉ được dùng **Pet Thần Thoại thường (KHÔNG Độc Nhất, chưa Tiến Hóa)** để chế tạo Hồng Mông Tiến Hóa Tinh!',
      };
    }
    if (target.is_active) {
      return {
        success: false,
        status: 400,
        error: 'PET_IS_ACTIVE',
        message: `Không thể dùng **${target.pet_name}** khi đang đặt làm **Pet Chính**! Hãy đổi Pet Chính khác trước.`,
      };
    }
    if (target.status === 'exploring' || target.status === 'injured') {
      return {
        success: false,
        status: 400,
        error: 'PET_BUSY',
        message: `Linh Thú **${target.pet_name}** đang \`${target.status}\`, không thể dùng làm nguyên liệu!`,
      };
    }
    const totalOwnedRows = pets.filter((p) => Number(p.quantity || 1) >= 1).length;
    if (totalOwnedRows <= 1 && Number(target.quantity || 1) <= 1) {
      return {
        success: false,
        status: 400,
        error: 'CANNOT_SACRIFICE_LAST_PET',
        message: 'Không thể tiêu hao con Linh Thú duy nhất còn lại trong kho!',
      };
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

    // Xác nhận 2 lớp
    if (options.confirmed !== true) {
      return {
        success: true,
        requires_confirmation: true,
        pet_id: String(target.pet_id),
        pet_type: target.pet_type,
        pet_name: target.pet_name,
        title: `${uiEm('ui_warn')} XÁC NHẬN CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH`,
        description: [
          `Thao tác này sẽ **TIÊU HAO VĨNH VIỄN** các nguyên liệu sau:`,
          `• **1×** ${petEmoji(target.pet_type)} **${target.pet_name}** *(Lv.${target.level || 1} • ${target.star || 1}★ • đang có SL ${target.quantity || 1})*`,
          `• **${CRAFT_EVO_CRYSTAL_SHARDS}×** ${em('chaos_essence_shard')} **Mảnh Tinh Hoa Hỗn Độn**`,
          `• **${CRAFT_EVO_CRYSTAL_LT.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`,
          '',
          `→ Thu về: **+1 ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh**. Bấm **Xác Nhận Chế Tạo** để hoàn tất!`,
        ].join('\n'),
        color: '#f59e0b',
      };
    }

    const nextBal = bal - CRAFT_EVO_CRYSTAL_LT;
    const nextShards = shardQty - CRAFT_EVO_CRYSTAL_SHARDS;
    const nextCrystals = Number(inv.evo_crystal || 0) + 1;
    const prevPetQty = Math.max(1, Number(target.quantity || 1));

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

      if (prevPetQty > 1) {
        await supabase.from('user_pets').update({ quantity: prevPetQty - 1 }).eq('pet_id', target.pet_id);
      } else {
        await supabase.from('user_pets').delete().eq('pet_id', target.pet_id);
        await supabase
          .from('user_loadouts')
          .update({ pet_id: null, pet_type: null, updated_at: nowIso })
          .eq('user_id', cleanId)
          .eq('pet_id', String(target.pet_id));
      }
      invalidateInventoryCache(cleanId);
    } else {
      user.linh_thach = nextBal;
      inv.chaos_essence_shard = nextShards;
      inv.evo_crystal = nextCrystals;
      if (prevPetQty > 1) {
        target.quantity = prevPetQty - 1;
      } else {
        const list = memEvoStore.pets.get(cleanId) || [];
        memEvoStore.pets.set(cleanId, list.filter((p) => String(p.pet_id) !== String(target.pet_id)));
        for (const lo of memEvoStore.loadouts.get(cleanId) || []) {
          if (String(lo.pet_id) === String(target.pet_id)) {
            lo.pet_id = null;
            lo.pet_type = null;
          }
        }
      }
    }

    return {
      success: true,
      crafted: 1,
      evo_crystal: nextCrystals,
      chaos_essence_shard: nextShards,
      linh_thach: nextBal,
      consumed_pet: { pet_id: String(target.pet_id), pet_type: target.pet_type, pet_name: target.pet_name },
      title: `${em('evo_crystal')} CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH THÀNH CÔNG!`,
      description: [
        `Đã dung hợp thành công **1 ${em('evo_crystal')} Hồng Mông Tiến Hóa Tinh**!`,
        `• **Đã tiêu hao:** \`${CRAFT_EVO_CRYSTAL_SHARDS}\` Mảnh Hỗn Độn + **${target.pet_name}** + \`${CRAFT_EVO_CRYSTAL_LT.toLocaleString('vi-VN')} LT\``,
        `• **Hiện có:** ${em('evo_crystal')} \`${nextCrystals}\` • ${em('chaos_essence_shard')} \`${nextShards}\` • **${nextBal.toLocaleString('vi-VN')} LT**`,
      ].join('\n'),
      color: '#10b981',
    };
  });
}
