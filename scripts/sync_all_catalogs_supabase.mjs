/**
 * scripts/sync_all_catalogs_supabase.mjs
 * Đồng bộ toàn bộ PET_CATALOG (91), EQUIPMENT_CATALOG (165), user_pets & user_roles lên Supabase
 * và xác minh 0 bản ghi lệch chuẩn sau khi chạy.
 */

import 'dotenv/config';
import { PET_CATALOG, PET_BY_TYPE, EQUIPMENT_CATALOG, ROLE_BY_ID } from '../src/data/catalog.js';
import { ROLE_PERKS_MAP } from '../src/services/profileService.js';
import { supabase } from '../src/config/supabase.js';

function sanitizeRolePerkForDb(raw) {
  return String(raw || '')
    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  if (!supabase) throw new Error('Supabase client not initialized');

  // 1. Sync public.pets (91)
  let petUpdated = 0;
  for (const p of PET_CATALOG) {
    const { error } = await supabase
      .from('pets')
      .update({
        pet_name: p.pet_name,
        rarity: p.rarity,
        element: p.element,
        base_atk: p.base_atk,
        base_def: p.base_def,
        base_spd: p.base_spd,
        hax_skill: p.hax_skill || null,
        hax_description: p.hax_description || '',
      })
      .eq('pet_type', p.pet_type);
    if (error) throw new Error(`Failed updating pets ${p.pet_type}: ${error.message}`);
    petUpdated += 1;
  }

  // 2. Sync public.pet_items (165)
  let itemUpdated = 0;
  for (const it of EQUIPMENT_CATALOG) {
    const { error } = await supabase
      .from('pet_items')
      .update({
        item_name: it.item_name,
        item_type: it.item_type,
        rarity: it.rarity,
        element: it.element,
        bonus_atk: it.bonus_atk || 0,
        bonus_def: it.bonus_def || 0,
        bonus_spd: it.bonus_spd || 0,
        bonus_hp: it.bonus_hp || 0,
        bonus_crit: it.bonus_crit || 0,
        hax_skill: it.hax_skill || null,
        hax_description: it.hax_description || '',
      })
      .eq('item_id', it.item_id);
    if (error) throw new Error(`Failed updating pet_items ${it.item_id}: ${error.message}`);
    itemUpdated += 1;
  }

  // 3. Sync public.user_pets
  const { data: userPets, error: upErr } = await supabase
    .from('user_pets')
    .select('pet_id, pet_type, pet_rarity, element, hax_skill, hax_description');
  if (upErr) throw new Error(`Failed reading user_pets: ${upErr.message}`);

  let userPetsUpdated = 0;
  for (const row of userPets || []) {
    const meta = PET_BY_TYPE[row.pet_type];
    if (!meta) continue;
    const targetSkill = meta.hax_skill || null;
    const targetDesc = meta.hax_description || '';
    const needsUpdate = (
      (row.hax_skill || null) !== targetSkill
      || (row.hax_description || '') !== targetDesc
      || (row.pet_rarity || '') !== meta.rarity
      || (row.element || '') !== meta.element
    );
    if (needsUpdate) {
      const { error } = await supabase
        .from('user_pets')
        .update({
          pet_rarity: meta.rarity,
          element: meta.element,
          hax_skill: targetSkill,
          hax_description: targetDesc,
        })
        .eq('pet_id', row.pet_id);
      if (error) throw new Error(`Failed updating user_pets ${row.pet_id}: ${error.message}`);
      userPetsUpdated += 1;
    }
  }

  // 4. Sync public.user_roles
  const { data: userRoles, error: urErr } = await supabase
    .from('user_roles')
    .select('id, role_id, role_name, role_perk');
  if (urErr) throw new Error(`Failed reading user_roles: ${urErr.message}`);

  let userRolesUpdated = 0;
  for (const row of userRoles || []) {
    const roleMeta = ROLE_BY_ID[row.role_id];
    const rawPerk = roleMeta?.perk || ROLE_PERKS_MAP[row.role_id];
    if (!rawPerk && !roleMeta) continue;

    const targetPerk = sanitizeRolePerkForDb(rawPerk || row.role_perk);
    const targetName = roleMeta?.name || row.role_name;
    if ((row.role_perk || '') !== targetPerk || (row.role_name || '') !== targetName) {
      const { error } = await supabase
        .from('user_roles')
        .update({
          role_name: targetName,
          role_perk: targetPerk,
        })
        .eq('id', row.id);
      if (error) throw new Error(`Failed updating user_roles ${row.id}: ${error.message}`);
      userRolesUpdated += 1;
    }
  }

  // 5. Post-sync verification
  const { data: verifyUserPets } = await supabase
    .from('user_pets')
    .select('pet_id, pet_type, pet_rarity, element, hax_skill, hax_description');
  const staleUserPets = (verifyUserPets || []).filter((r) => {
    const m = PET_BY_TYPE[r.pet_type];
    if (!m) return false;
    return (r.hax_skill || null) !== (m.hax_skill || null)
      || (r.hax_description || '') !== (m.hax_description || '')
      || (r.pet_rarity || '') !== m.rarity
      || (r.element || '') !== m.element;
  });

  const { data: verifyUserRoles } = await supabase
    .from('user_roles')
    .select('id, role_id, role_name, role_perk');
  const staleUserRoles = (verifyUserRoles || []).filter((r) => {
    const m = ROLE_BY_ID[r.role_id];
    const rawPerk = m?.perk || ROLE_PERKS_MAP[r.role_id];
    if (!rawPerk && !m) return false;
    return (r.role_perk || '') !== sanitizeRolePerkForDb(rawPerk || r.role_perk)
      || (m?.name && r.role_name !== m.name);
  });

  console.log(JSON.stringify({
    petUpdated,
    itemUpdated,
    userPetsTotal: (userPets || []).length,
    userPetsUpdated,
    staleUserPetsAfter: staleUserPets.length,
    userRolesTotal: (userRoles || []).length,
    userRolesUpdated,
    staleUserRolesAfter: staleUserRoles.length,
  }, null, 2));

  if (staleUserPets.length > 0 || staleUserRoles.length > 0) {
    throw new Error(`Post-sync verification failed: staleUserPets=${staleUserPets.length}, staleUserRoles=${staleUserRoles.length}`);
  }
}

main().catch((err) => {
  console.error('[sync_all_catalogs_supabase] FATAL:', err);
  process.exit(1);
});
