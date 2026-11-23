/**
 * scripts/cleanup_supabase_battle_logs_spam.mjs
 * Dọn sạch các bản ghi battle_logs đã hết hạn hoặc do chạy test sinh ra (participant_ids rỗng hoặc chứa test ID tổng hợp).
 * Bảo toàn 100% nhật ký trận đấu còn hạn của người chơi thật.
 * Usage:
 *   node scripts/cleanup_supabase_battle_logs_spam.mjs --dry-run
 *   node scripts/cleanup_supabase_battle_logs_spam.mjs --apply
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

const apply = process.argv.includes('--apply');
const SYNTHETIC_PREFIX = /^(900000|999|888|1234567890|111111)/;

function isTestSpamRow(row, nowMs) {
  const expMs = row.expires_at ? Date.parse(row.expires_at) : 0;
  if (expMs > 0 && expMs < nowMs) return 'expired';
  const parts = Array.isArray(row.participant_ids) ? row.participant_ids.map(String) : [];
  if (parts.length === 0) return 'empty_participants';
  if (parts.some((id) => SYNTHETIC_PREFIX.test(id))) return 'synthetic_test_id';
  return null;
}

async function run() {
  if (!supabase) throw new Error('Supabase client not initialized');
  const nowMs = Date.now();

  const { count: totalBefore } = await supabase.from('battle_logs').select('*', { count: 'exact', head: true });
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('battle_logs')
      .select('battle_id, battle_kind, participant_ids, expires_at')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const toDeleteIds = [];
  const reasons = { expired: 0, empty_participants: 0, synthetic_test_id: 0 };
  const preservedReal = [];

  for (const r of allRows) {
    const reason = isTestSpamRow(r, nowMs);
    if (reason) {
      toDeleteIds.push(r.battle_id);
      reasons[reason] += 1;
    } else {
      preservedReal.push(r);
    }
  }

  console.log(`Total rows scanned   : ${allRows.length} (count=${totalBefore})`);
  console.log(`Rows to delete       : ${toDeleteIds.length}`, reasons);
  console.log(`Real rows preserved  : ${preservedReal.length}`);
  if (preservedReal.length > 0) {
    const sampleUsers = new Set();
    for (const r of preservedReal.slice(0, 30)) {
      for (const pid of (r.participant_ids || [])) sampleUsers.add(pid);
    }
    console.log('Sample preserved participant IDs:', [...sampleUsers].slice(0, 12));
  }

  if (!apply) {
    console.log('\n[DRY-RUN] Re-run with --apply to delete expired & test-spam rows.');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < toDeleteIds.length; i += 200) {
    const chunk = toDeleteIds.slice(i, i + 200);
    const { error } = await supabase.from('battle_logs').delete().in('battle_id', chunk);
    if (error) throw new Error(`Delete batch failed: ${error.message}`);
    deleted += chunk.length;
  }

  const { count: totalAfter } = await supabase.from('battle_logs').select('*', { count: 'exact', head: true });
  console.log(`\n[APPLIED] Deleted ${deleted} rows. Remaining battle_logs rows: ${totalAfter}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
