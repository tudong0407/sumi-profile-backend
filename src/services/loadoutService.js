/**
 * src/services/loadoutService.js
 * Hệ thống 3 Loadout Tự Động Lưu (/inv Bộ 1 / Bộ 2 / Bộ 3) cho SuMi Family v1.6.3:
 * - Mỗi thao tác /equip, /unequip, /pet, /linhvuc tự động đồng bộ vào active_loadout_slot hiện tại.
 * - Lần đầu chuyển sang Bộ 2 hoặc Bộ 3 chưa khởi tạo: giữ nguyên Linh Thú xuất trận, tháo sạch Pháp Bảo & Lãnh Địa để tự phối bộ mới.
 */

import { supabase } from '../config/supabase.js';
import { EQUIPMENT_BY_ID } from '../data/catalog.js';
import { uiEm } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';
import { getUserBusyExplorationAssets } from './explorerService.js';
import { getInventory, invalidateInventoryCache } from './inventoryService.js';

const loadoutLocks = new Map();

export async function withLoadoutLock(userId, fn) {
  const key = String(userId || '');
  const prev = loadoutLocks.get(key) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  loadoutLocks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (loadoutLocks.get(key) === queued) loadoutLocks.delete(key);
  }
}

export function evaluateLoadoutExplorerLock({ slotIndex = 1, pet = null, busyExp = null } = {}) {
  const slotNum = [1, 2, 3].includes(Number(slotIndex)) ? Number(slotIndex) : 1;
  if (!busyExp?.isExploring) {
    return { locked: false, activeSlot: slotNum };
  }

  const petLocked = Boolean(
    pet && (
      pet.status === 'exploring'
      || (busyExp.busyPetId && pet.pet_id && String(pet.pet_id) === String(busyExp.busyPetId))
    ),
  );

  if (!petLocked) {
    return { locked: false, activeSlot: slotNum };
  }

  const otherSlots = [1, 2, 3].filter((s) => s !== slotNum).map((s) => `**Bộ ${s}**`).join(' hoặc ');
  return {
    locked: true,
    activeSlot: slotNum,
    error: 'LOADOUT_LOCKED_BY_EXPLORER',
    status: 400,
    message: `${uiEm('ui_compass_dir')} Linh Thú của **Bộ ${slotNum}** đang đi **Khám Phá Bản Đồ** (\`/explorer\`) nên tạm khóa thay trang bị lên Linh Thú này!\n• Hãy dùng \`/linhthu\` chuyển sang một **Linh Thú khác đang rảnh** hoặc bấm ${otherSlots} trong \`/inv\`.`,
  };
}

export async function checkActiveLoadoutExplorerLock(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !supabase) return { locked: false, activeSlot: 1 };

  const busyExp = await getUserBusyExplorationAssets(cleanId).catch(() => null);
  if (!busyExp?.isExploring) return { locked: false, activeSlot: 1 };

  const [{ data: user }, { data: activePet }] = await Promise.all([
    supabase.from('users').select('active_loadout_slot').eq('user_id', cleanId).maybeSingle(),
    supabase.from('user_pets').select('pet_id, pet_type, status').eq('user_id', cleanId).eq('is_active', true).limit(1).maybeSingle(),
  ]);

  const activeSlot = [1, 2, 3].includes(Number(user?.active_loadout_slot)) ? Number(user.active_loadout_slot) : 1;

  return evaluateLoadoutExplorerLock({
    slotIndex: activeSlot,
    pet: activePet,
    busyExp,
  });
}

export async function syncActiveLoadoutFromCurrentGear(userId, explicitSlotIndex = null) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !supabase) return null;

  const [{ data: user }, { data: activePet }, { data: equippedItems }, { data: equippedDomains }, busyExp] = await Promise.all([
    supabase.from('users').select('active_loadout_slot').eq('user_id', cleanId).maybeSingle(),
    supabase.from('user_pets').select('pet_id, pet_type, status').eq('user_id', cleanId).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('user_pet_items').select('item_id, slot, equipped_to_pet, quantity').eq('user_id', cleanId),
    supabase.from('user_domains').select('entity_kind, entity_id, quantity').eq('user_id', cleanId).eq('is_equipped', true),
    getUserBusyExplorationAssets(cleanId).catch(() => null),
  ]);

  const parsedExplicit = Number(explicitSlotIndex);
  const slotIndex = [1, 2, 3].includes(parsedExplicit)
    ? parsedExplicit
    : [1, 2, 3].includes(Number(user?.active_loadout_slot))
      ? Number(user.active_loadout_slot)
      : 1;

  const { data: existingRow } = await supabase
    .from('user_loadouts')
    .select('*')
    .eq('user_id', cleanId)
    .eq('slot_index', slotIndex)
    .maybeSingle();

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

  // Bảo toàn snapshot nếu món cũ trong Bộ này tạm trống chỉ vì đang bận /explorer
  if (busyExp?.isExploring && existingRow) {
    if (!weaponId && existingRow.weapon_id && busyExp.busyEquipIds?.has(existingRow.weapon_id)) weaponId = existingRow.weapon_id;
    if (!gemId && existingRow.gem_id && busyExp.busyEquipIds?.has(existingRow.gem_id)) gemId = existingRow.gem_id;
    if (!soulId && existingRow.soul_id && busyExp.busyEquipIds?.has(existingRow.soul_id)) soulId = existingRow.soul_id;
    if (!domainId && existingRow.domain_id && busyExp.busyDomainIds?.has(existingRow.domain_id)) domainId = existingRow.domain_id;
    if (!senseId && existingRow.sense_id && busyExp.busyDomainIds?.has(existingRow.sense_id)) senseId = existingRow.sense_id;
    if (!realmId && existingRow.realm_id && busyExp.busyDomainIds?.has(existingRow.realm_id)) realmId = existingRow.realm_id;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    user_id: cleanId,
    slot_index: slotIndex,
    pet_id: activePet?.pet_id ? String(activePet.pet_id) : (existingRow?.pet_id || null),
    pet_type: activePet?.pet_type || (existingRow?.pet_type || null),
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
      await syncActiveLoadoutFromCurrentGear(cleanId, targetSlot).catch(() => {});
      invalidateInventoryCache(cleanId);
      return getInventory(cleanId, {
        ...opts,
        bannerText: `Đang dùng sẵn **Bộ ${targetSlot}**.`,
      });
    }

    const [busyExp, targetRowRes, petsRes, itemsRes, domainsRes] = await Promise.all([
      getUserBusyExplorationAssets(cleanId).catch(() => null),
      supabase.from('user_loadouts').select('*').eq('user_id', cleanId).eq('slot_index', targetSlot).maybeSingle(),
      supabase.from('user_pets').select('*').eq('user_id', cleanId),
      supabase.from('user_pet_items').select('*').eq('user_id', cleanId),
      supabase.from('user_domains').select('*').eq('user_id', cleanId),
    ]);

    const targetRow = targetRowRes.data || null;
    const pets = petsRes.data || [];
    const ownedItems = itemsRes.data || [];
    const ownedDomains = domainsRes.data || [];

    // 1. Lưu trạng thái bộ cũ trước khi chuyển (bảo toàn món bận /explorer nếu bộ cũ đang dùng)
    await syncActiveLoadoutFromCurrentGear(cleanId, currentSlot).catch(() => {});

    const nowIso = new Date().toISOString();
    // 2. Chuyển active_loadout_slot sang targetSlot
    await supabase
      .from('users')
      .update({ active_loadout_slot: targetSlot, updated_at: nowIso })
      .eq('user_id', cleanId);

    const pickStrongestFreePet = () => pets
      .filter((p) => p.status !== 'exploring' && p.status !== 'injured' && String(p.pet_id) !== String(busyExp?.busyPetId || ''))
      .sort((a, b) => (Number(b.power_score || 0) - Number(a.power_score || 0)) || (Number(b.level || 0) - Number(a.level || 0)))[0] || null;

    let bannerText = '';

    if (targetSlot > 1 && !targetRow?.is_initialized) {
      // Lần đầu mở Bộ 2 hoặc Bộ 3: tháo hết Pháp Bảo & Lãnh Địa; nếu Pet hiện tại đang bận /explorer thì tự chuyển sang Pet rảnh mạnh nhất
      await Promise.all([
        supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId),
        supabase.from('user_domains').update({ is_equipped: false, updated_at: nowIso }).eq('user_id', cleanId).eq('is_equipped', true),
      ]);

      const curActivePet = pets.find((p) => p.is_active);
      const curBusy = curActivePet && (
        curActivePet.status === 'exploring'
        || curActivePet.status === 'injured'
        || (busyExp?.busyPetId && String(curActivePet.pet_id) === String(busyExp.busyPetId))
      );

      let petNote = 'giữ nguyên Linh Thú hiện tại';
      if (curBusy) {
        await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
        const freePet = pickStrongestFreePet();
        if (freePet) {
          await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', freePet.pet_id);
          petNote = `tự chọn Linh Thú rảnh **${freePet.pet_name}**`;
        } else {
          petNote = 'tạm trống Linh Thú (Pet đang đi `/explorer`)';
        }
      }

      await syncActiveLoadoutFromCurrentGear(cleanId, targetSlot).catch(() => {});
      bannerText = `Đã mở mới **Bộ ${targetSlot}** — ${petNote}, tháo Pháp Bảo & Lãnh Địa để bạn tự phối bộ!`;
    } else if (targetRow) {
      const notes = [];

      // Áp dụng Linh Thú đã lưu
      let activePetType = pets.find((p) => p.is_active)?.pet_type || 'hoa_thach_nham_nham';
      let matchedValidPet = null;
      if (targetRow.pet_id || targetRow.pet_type) {
        const matchedPet = pets.find((p) => (targetRow.pet_id && String(p.pet_id) === String(targetRow.pet_id)) || p.pet_type === targetRow.pet_type);
        if (matchedPet && matchedPet.status !== 'exploring' && matchedPet.status !== 'injured' && String(matchedPet.pet_id) !== String(busyExp?.busyPetId || '')) {
          matchedValidPet = matchedPet;
          await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
          await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', matchedPet.pet_id);
          activePetType = matchedPet.pet_type;
        } else if (targetRow.pet_type) {
          notes.push('Linh Thú cũ đang bận/không còn');
        }
      }

      if (!matchedValidPet) {
        const curActivePet = pets.find((p) => p.is_active);
        const curBusy = curActivePet && (
          curActivePet.status === 'exploring'
          || curActivePet.status === 'injured'
          || (busyExp?.busyPetId && String(curActivePet.pet_id) === String(busyExp.busyPetId))
        );
        if (curBusy) {
          await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
          const freePet = pickStrongestFreePet();
          if (freePet) {
            await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', freePet.pet_id);
            activePetType = freePet.pet_type;
          }
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
      if (notes.length === 0) {
        await syncActiveLoadoutFromCurrentGear(cleanId, targetSlot).catch(() => {});
      }
      bannerText = notes.length > 0
        ? `Đã chuyển sang **Bộ ${targetSlot}** *(bỏ qua món đang bận/đã phân rã: ${notes.slice(0, 3).join(', ')})*.`
        : `Đã chuyển sang **Bộ ${targetSlot}** và tự động trang bị đầy đủ!`;
    }

    invalidateInventoryCache(cleanId);
    return getInventory(cleanId, { ...opts, bannerText });
  });
}
