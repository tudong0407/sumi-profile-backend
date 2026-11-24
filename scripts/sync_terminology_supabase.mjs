/**
 * scripts/sync_terminology_supabase.mjs
 * Đồng bộ hax_description đã chuẩn hóa từ PET_CATALOG & EQUIPMENT_CATALOG lên public.pets & public.pet_items.
 */

import 'dotenv/config';
import { PET_CATALOG, EQUIPMENT_CATALOG } from '../src/data/catalog.js';
import { supabase } from '../src/config/supabase.js';

async function main() {
  if (!supabase) throw new Error('Supabase client not initialized');

  let petUpdated = 0;
  for (const p of PET_CATALOG) {
    const { error } = await supabase
      .from('pets')
      .update({ hax_description: p.hax_description || '' })
      .eq('pet_type', p.pet_type);
    if (error) throw new Error(`Failed updating pet ${p.pet_type}: ${error.message}`);
    petUpdated += 1;
  }

  let itemUpdated = 0;
  for (const it of EQUIPMENT_CATALOG) {
    const { error } = await supabase
      .from('pet_items')
      .update({ hax_description: it.hax_description || '' })
      .eq('item_id', it.item_id);
    if (error) throw new Error(`Failed updating item ${it.item_id}: ${error.message}`);
    itemUpdated += 1;
  }

  console.log(`[sync_terminology_supabase] Synced ${petUpdated} pets & ${itemUpdated} items cleanly!`);
}

main().catch((err) => {
  console.error('[sync_terminology_supabase] FATAL:', err);
  process.exit(1);
});
