/**
 * src/services/loadoutService.js
 * Hệ thống 3 Loadout Tự Động Lưu (/inv Bộ 1 / Bộ 2 / Bộ 3) cho SuMi Family v1.6.3:
 * - Mỗi thao tác /equip, /unequip, /pet, /linhvuc tự động đồng bộ vào active_loadout_slot hiện tại.
 * - Lần đầu chuyển sang Bộ 2 hoặc Bộ 3 chưa khởi tạo: giữ nguyên Linh Thú xuất trận, tháo sạch Pháp Bảo & Lãnh Địa để tự phối bộ mới.
 */

import { supabase } from '../config/supabase.js';
import { EQUIPMENT_BY_ID } from '../data/catalog.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';
import { getUserBusyExplorationAssets } from './explorerService.js';
import { getInventory, invalidateInventoryCache } from './inventoryService.js';

const loadoutLocks = new Map();

async function withLoadoutLock(userId, fn) {
  const prev = loadoutLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  loadoutLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (loadoutLocks.get(userId) === queued) loadoutLocks.delete(userId);
  }
}

export async function syncActiveLoadoutFromCurrentGear(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !supabase) return null;

  const [{ data: user }, { data: activePet }, { data: equippedItems }, { data: equippedDomains }] = await Promise.all([
    supabase.from('users').select('active_loadout_slot').eq('user_id', cleanId).maybeSingle(),
    supabase.from('user_pets').select('pet_id, pet_type').eq('user_id', cleanId).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('user_pet_items').select('item_id, slot, equipped_to_pet').eq('user_id', cleanId),
    supabase.from('user_domains').select('entity_kind, entity_id').eq('user_id', cleanId).eq('is_equipped', true),
  ]);

  const slotIndex = [1, 2, 3].includes(Number(user?.active_loadout_slot))
    ? Number(user.active_loadout_slot)
    : 1;

  let weaponId = null;
  let gemId = null;
  let soulId = null;
  for (const row of equippedItems || []) {
    const slot = String(row.slot || EQUIPMENT_BY_ID[row.item_id]?.item_type || '').toLowerCase();
    if (!row.equipped_to_pet && !row.slot) continue;
    if (slot === 'weapon' && !weaponId) weaponId = row.item_id;
    else if (slot === 'gem' && !gemId) gemId = row.item_id;
    else if (slot === 'soul' && !soulId) soulId = row.item_id;
  }

  let domainId = null;
  let senseId = null;
  let realmId = null;
  for (const d of equippedDomains || []) {
    if (d.entity_kind === 'domain' && !domainId) domainId = d.entity_id;
    else if (d.entity_kind === 'sense' && !senseId) senseId = d.entity_id;
    else if (d.entity_kind === 'realm' && !realmId) realmId = d.entity_id;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    user_id: cleanId,
    slot_index: slotIndex,
    pet_id: activePet?.pet_id ? String(activePet.pet_id) : null,
    pet_type: activePet?.pet_type || null,
    weapon_id: weaponId,
    gem_id: gemId,
    soul_id: soulId,
    domain_id: domainId,
    sense_id: senseId,
    realm_id: realmId,
    is_initialized: true,
    updated_at: nowIso,
  };

  await supabase.from('user_loadouts').upsert(payload, { onConflict: 'user_id,slot_index' });
  return payload;
}

export async function switchLoadout(userId, rawSlot, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  const targetSlot = Number(rawSlot);
  if (![1, 2, 3].includes(targetSlot)) {
    return { success: false, status: 400, error: 'INVALID_LOADOUT_SLOT', message: 'Chỉ hỗ trợ Bộ 1, Bộ 2 và Bộ 3.' };
  }

  return withLoadoutLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: opts.username,
      fallbackUsername: opts.fallbackUsername,
      avatarUrl: opts.avatarUrl,
    });
    if (!user) {
      return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
    }

    const currentSlot = [1, 2, 3].includes(Number(user.active_loadout_slot))
      ? Number(user.active_loadout_slot)
      : 1;

    if (currentSlot === targetSlot) {
      await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
      invalidateInventoryCache(cleanId);
      return getInventory(cleanId, {
        ...opts,
        bannerText: `Đang dùng sẵn **Bộ ${targetSlot}**.`,
      });
    }

    // 1. Lưu trạng thái bộ cũ trước khi chuyển
    await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});

    const nowIso = new Date().toISOString();
    // 2. Chuyển active_loadout_slot sang targetSlot
    await supabase
      .from('users')
      .update({ active_loadout_slot: targetSlot, updated_at: nowIso })
      .eq('user_id', cleanId);

    const { data: targetRow } = await supabase
      .from('user_loadouts')
      .select('*')
      .eq('user_id', cleanId)
      .eq('slot_index', targetSlot)
      .maybeSingle();

    let bannerText = '';

    if (targetSlot > 1 && !targetRow?.is_initialized) {
      // Lần đầu mở Bộ 2 hoặc Bộ 3: giữ nguyên Linh Thú hiện tại, tháo hết Pháp Bảo & Lãnh Địa
      await Promise.all([
        supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId),
        supabase.from('user_domains').update({ is_equipped: false, updated_at: nowIso }).eq('user_id', cleanId).eq('is_equipped', true),
      ]);
      await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
      bannerText = `Đã mở mới **Bộ ${targetSlot}** — giữ nguyên Linh Thú hiện tại, tháo Pháp Bảo & Lãnh Địa để bạn tự phối bộ!`;
    } else if (targetRow) {
      const notes = [];
      const [busyExp, petsRes, itemsRes, domainsRes] = await Promise.all([
        getUserBusyExplorationAssets(cleanId).catch(() => null),
        supabase.from('user_pets').select('*').eq('user_id', cleanId),
        supabase.from('user_pet_items').select('*').eq('user_id', cleanId),
        supabase.from('user_domains').select('*').eq('user_id', cleanId),
      ]);

      const pets = petsRes.data || [];
      const ownedItems = itemsRes.data || [];
      const ownedDomains = domainsRes.data || [];

      // Áp dụng Linh Thú đã lưu
      let activePetType = pets.find((p) => p.is_active)?.pet_type || 'hoa_thach_nham_nham';
      if (targetRow.pet_id || targetRow.pet_type) {
        const matchedPet = pets.find((p) => (targetRow.pet_id && String(p.pet_id) === String(targetRow.pet_id)) || p.pet_type === targetRow.pet_type);
        if (matchedPet && matchedPet.status !== 'exploring' && matchedPet.status !== 'injured') {
          await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
          await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', matchedPet.pet_id);
          activePetType = matchedPet.pet_type;
        } else if (targetRow.pet_type) {
          notes.push('Linh Thú cũ đang bận/không còn');
        }
      }

      // Tháo sạch Pháp Bảo & Lãnh Địa cũ rồi lắp lại theo Loadout đích
      await Promise.all([
        supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId),
        supabase.from('user_domains').update({ is_equipped: false, updated_at: nowIso }).eq('user_id', cleanId).eq('is_equipped', true),
      ]);

      const equipItemPromises = [];
      for (const [slotName, itemId] of [
        ['weapon', targetRow.weapon_id],
        ['gem', targetRow.gem_id],
        ['soul', targetRow.soul_id],
      ]) {
        if (!itemId) continue;
        const own = ownedItems.find((it) => it.item_id === itemId);
        const busy = busyExp?.isExploring && busyExp.busyEquipIds?.has(itemId) && Number(own?.quantity || 1) <= 1;
        if (own && !busy) {
          equipItemPromises.push(
            supabase.from('user_pet_items').update({ equipped_to_pet: activePetType, slot: slotName }).eq('id', own.id),
          );
        } else {
          notes.push(`thiếu/bận ${itemId}`);
        }
      }

      const equipDomPromises = [];
      for (const [kind, entId] of [
        ['domain', targetRow.domain_id],
        ['sense', targetRow.sense_id],
        ['realm', targetRow.realm_id],
      ]) {
        if (!entId) continue;
        const own = ownedDomains.find((d) => d.entity_kind === kind && d.entity_id === entId);
        const busy = busyExp?.isExploring && busyExp.busyDomainIds?.has(entId) && Number(own?.quantity || 1) <= 1;
        if (own && !busy) {
          equipDomPromises.push(
            supabase.from('user_domains').update({ is_equipped: true, updated_at: nowIso }).eq('id', own.id),
          );
        } else {
          notes.push(`thiếu/bận ${entId}`);
        }
      }

      await Promise.all([...equipItemPromises, ...equipDomPromises]);
      await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
      bannerText = notes.length > 0
        ? `Đã chuyển sang **Bộ ${targetSlot}** *(bỏ qua món đang bận/đã phân rã: ${notes.slice(0, 3).join(', ')})*.`
        : `Đã chuyển sang **Bộ ${targetSlot}** và tự động trang bị đầy đủ!`;
    }

    invalidateInventoryCache(cleanId);
    return getInventory(cleanId, { ...opts, bannerText });
  });
}
