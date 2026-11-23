/**
 * scripts/migrate_v1_5_balance_patch.mjs
 * Idempotent Supabase migration for the Ver 1.5 Rebalance & Compensation patch:
 *  1) Recalculate all non-Fuyumi-exclusive user_pets stats & power_score with +550% Lv.100 scaling
 *  2) Migrate legacy frame_unlock_token rows in user_inventory -> frame_royal_legacy in user_frames & delete legacy rows
 *  3) Retroactively pay Tower +15% LT differential (floors + milestones) to players with tower_floor > 0
 *  4) Retroactively pay +500 LT differential to players who already acknowledged v1.5 at 1,500 LT
 *
 * Usage:
 *   node scripts/migrate_v1_5_balance_patch.mjs --dry-run
 *   node scripts/migrate_v1_5_balance_patch.mjs --apply
 */
import fs from 'fs';
import { supabase } from '../src/config/supabase.js';
import { PET_BY_TYPE } from '../src/data/catalog.js';
import { computeScaledPetBaseStats } from '../src/services/inventoryService.js';
import { computeTowerFloorRewardLt, TOWER_MILESTONE_BONUSES } from '../src/services/questService.js';

const RECEIPT_PATH = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/v1_5_balance_compensation_receipt.json';
const OLD_TOWER_MILESTONES = {
  50: 500,
  100: 1000,
  150: 2000,
  200: 4000,
  250: 5500,
  300: 7000,
  350: 8500,
  400: 10500,
  450: 12500,
  500: 15000,
};

function computeTowerDiff(floor) {
  let diff = 0;
  for (let f = 1; f <= floor; f += 1) {
    const isBoss = f % 5 === 0;
    const oldLt = (20 + Math.floor(f * 2)) * (isBoss ? 2 : 1) + 10;
    const newLt = computeTowerFloorRewardLt(f);
    diff += (newLt - oldLt);
  }
  for (const [mStr, oldM] of Object.entries(OLD_TOWER_MILESTONES)) {
    const m = Number(mStr);
    if (floor >= m) {
      const newM = Number(TOWER_MILESTONE_BONUSES[m]?.lt || oldM);
      diff += (newM - oldM);
    }
  }
  return diff;
}

async function main() {
  if (!supabase) throw new Error('Supabase client not initialized');
  const apply = process.argv.includes('--apply');
  console.log(`[v1.5 Balance Migration] Mode = ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const receipt = fs.existsSync(RECEIPT_PATH)
    ? JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'))
    : { towerCompensated: {}, update500Compensated: {}, updatedAt: null };

  const [{ data: users }, { data: pets }, { data: tokRows }, { data: quests }] = await Promise.all([
    supabase.from('users').select('user_id, username, linh_thach, last_seen_update_version'),
    supabase.from('user_pets').select('pet_id, user_id, pet_type, pet_name, level, star, atk, def, spd, power_score'),
    supabase.from('user_inventory').select('user_id, item_id, quantity').eq('item_id', 'frame_unlock_token'),
    supabase.from('user_quests').select('user_id, tower_floor').gt('tower_floor', 0),
  ]);

  const userById = new Map((users || []).map((u) => [String(u.user_id), u]));

  // 1) Recalculate user_pets stats for +550% Lv.100
  const petUpdates = [];
  for (const p of pets || []) {
    if (p.pet_type === 'cuu_vi_hong_ho') continue;
    const meta = PET_BY_TYPE[p.pet_type];
    if (!meta) continue;
    const scaled = computeScaledPetBaseStats(meta, Number(p.level || 1), Number(p.star || 1));
    const nextAtk = Math.max(Number(p.atk || 0), scaled.atk);
    const nextDef = Math.max(Number(p.def || 0), scaled.def);
    const nextSpd = Math.max(Number(p.spd || 0), scaled.spd);
    const nextPower = Math.max(Number(p.power_score || 0), scaled.power_score);
    if (
      nextAtk !== Number(p.atk || 0)
      || nextDef !== Number(p.def || 0)
      || nextSpd !== Number(p.spd || 0)
      || nextPower !== Number(p.power_score || 0)
    ) {
      petUpdates.push({
        pet_id: p.pet_id,
        user_id: p.user_id,
        pet_name: p.pet_name,
        level: p.level,
        star: p.star,
        oldPower: p.power_score,
        nextAtk,
        nextDef,
        nextSpd,
        nextPower,
      });
    }
  }
  console.log(`\n[1] Pets to recalculate (+550% Lv.100): ${petUpdates.length}`);
  for (const pu of petUpdates.slice(0, 12)) {
    console.log(`  - ${pu.pet_name} (Lv.${pu.level} ${pu.star}★) user=${pu.user_id}: power ${pu.oldPower} -> ${pu.nextPower}`);
  }
  if (petUpdates.length > 12) console.log(`  ... and ${petUpdates.length - 12} more pets`);

  // 2) Legacy frame_unlock_token cleanup
  const legacyToks = tokRows || [];
  console.log(`\n[2] Legacy frame_unlock_token rows to migrate & delete: ${legacyToks.length}`);
  for (const tr of legacyToks) {
    console.log(`  - user=${tr.user_id} qty=${tr.quantity}`);
  }

  // 3) Tower +15% LT compensation
  const towerGrants = [];
  for (const q of quests || []) {
    const uid = String(q.user_id);
    if (receipt.towerCompensated[uid]) continue;
    const diff = computeTowerDiff(Number(q.tower_floor || 0));
    if (diff > 0) {
      const u = userById.get(uid);
      towerGrants.push({
        user_id: uid,
        username: u?.username || uid,
        floor: q.tower_floor,
        amount: diff,
      });
    }
  }
  console.log(`\n[3] Tower +15% LT retroactive grants: ${towerGrants.length} users, total ${towerGrants.reduce((s, x) => s + x.amount, 0)} LT`);
  for (const tg of towerGrants) {
    console.log(`  - ${tg.username} (${tg.user_id}) Floor ${tg.floor}: +${tg.amount} LT`);
  }

  // 4) Ver 1.5 +500 LT update ack differential for already-acked v1.5 users
  const updGrants = [];
  for (const u of users || []) {
    const uid = String(u.user_id);
    if (String(u.last_seen_update_version || '').trim() !== '1.5') continue;
    if (receipt.update500Compensated[uid]) continue;
    updGrants.push({
      user_id: uid,
      username: u.username,
      amount: 500,
    });
  }
  console.log(`\n[4] Ver 1.5 +500 LT update differential grants: ${updGrants.length} users`);
  for (const ug of updGrants) {
    console.log(`  - ${ug.username} (${ug.user_id}): +${ug.amount} LT`);
  }

  if (!apply) {
    console.log('\n[DRY-RUN] No DB writes performed.');
    return;
  }

  const nowIso = new Date().toISOString();

  // Apply 1) Pet updates
  for (const pu of petUpdates) {
    const { error } = await supabase
      .from('user_pets')
      .update({ atk: pu.nextAtk, def: pu.nextDef, spd: pu.nextSpd, power_score: pu.nextPower })
      .eq('pet_id', pu.pet_id);
    if (error) throw new Error(`Failed updating pet ${pu.pet_id}: ${error.message}`);
  }

  // Apply 2) frame_unlock_token cleanup
  for (const tr of legacyToks) {
    await supabase.from('user_frames').upsert({
      user_id: tr.user_id,
      frame_id: 'frame_royal_legacy',
      purchased_at: nowIso,
    }, { onConflict: 'user_id,frame_id' });
    await supabase
      .from('user_inventory')
      .delete()
      .eq('user_id', tr.user_id)
      .eq('item_id', 'frame_unlock_token');
  }

  // Combine LT grants per user atomically in receipt
  const combinedDelta = new Map();
  for (const tg of towerGrants) {
    combinedDelta.set(tg.user_id, (combinedDelta.get(tg.user_id) || 0) + tg.amount);
  }
  for (const ug of updGrants) {
    combinedDelta.set(ug.user_id, (combinedDelta.get(ug.user_id) || 0) + ug.amount);
  }

  for (const [uid, addLt] of combinedDelta.entries()) {
    const { data: freshU } = await supabase.from('users').select('linh_thach').eq('user_id', uid).maybeSingle();
    if (!freshU) continue;
    const nextBal = Number(freshU.linh_thach || 0) + addLt;
    const { error } = await supabase
      .from('users')
      .update({ linh_thach: nextBal, updated_at: nowIso })
      .eq('user_id', uid);
    if (error) throw new Error(`Failed crediting LT to ${uid}: ${error.message}`);
  }

  for (const tg of towerGrants) {
    receipt.towerCompensated[tg.user_id] = { username: tg.username, floor: tg.floor, amount: tg.amount, paidAt: nowIso };
  }
  for (const ug of updGrants) {
    receipt.update500Compensated[ug.user_id] = { username: ug.username, amount: ug.amount, paidAt: nowIso };
  }
  receipt.updatedAt = nowIso;
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2));
  console.log(`\n[APPLIED] Migration completed cleanly and receipt saved to ${RECEIPT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
