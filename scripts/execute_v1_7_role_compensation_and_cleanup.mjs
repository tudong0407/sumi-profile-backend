/**
 * scripts/execute_v1_7_role_compensation_and_cleanup.mjs
 * Thực thi Mục 2 Ver 1.7:
 * 1. Đền bù Pet Level Roles + Báo Chúa (tier Bậc 1..6 + Extra Roles cleanup) an toàn, idempotent 100% qua v17_migration_markers
 * 2. Xuất bảng báo cáo đầy đủ toàn bộ người được đền bù & chi tiết Role Gacha / Frame #6 / Danh hiệu
 * 3. Làm sạch quyền Discord của Role « Pet Of Fuyumi » (1480926995477958728) — CHỈ tước các bit trùng Gacha Roles (giữ nguyên 38 thành viên)
 * 4. Cấp Role Discord cho các suất is_equipped = true & gửi DM thông báo cho Bậc 6 / Báo Chúa
 * 5. Xóa 10 Role trên Discord (6 Pet Level + 1 Divider Pet Level + 3 Extra Roles: Bạch Nguyệt Quang, Dạ Hồ Ma Ảnh, Thiên Hồ Hắc Dạ)
 *    GIỮ NGUYÊN « Top 1・Bạch Hồ Thánh Linh » (1473574460656193616) & Divider Extra Role (1496697237978349720)!
 *
 * Usage:
 *   node scripts/execute_v1_7_role_compensation_and_cleanup.mjs --dry-run
 *   node scripts/execute_v1_7_role_compensation_and_cleanup.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';
import { AVATAR_FRAME_BY_ID, GACHA_ROLE_CATALOG } from '../src/data/catalog.js';
import {
  ensureUserInitialized,
  getMaxRoleSlotsByLevel,
  sanitizeRolePerkForDb,
} from '../src/services/profileService.js';
import { invalidateInventoryCache } from '../src/services/inventoryService.js';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const GUILD_ID = '1026096141273661450';
const BAO_CHUA_ID = '1010756221600546946';
const FRAME_6_ID = 'frame_v17_06_crimson_raven';

const SCAN_PATH =
  'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\scratch\\live_roles_and_holders_scan.json';
const OUTPUT_JSON_PATH =
  'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\scratch\\v17_role_compensation_result.json';

export const PET_OF_FUYUMI_ROLE_ID = '1480926995477958728';
export const TOP_1_KEEP_ROLE_ID = '1473574460656193616';
export const EXTRA_DIVIDER_KEEP_ROLE_ID = '1496697237978349720';

export const ROLES_TO_DELETE = [
  // 6 Pet Level Tiers + 1 Divider
  { id: '1487136488331153589', label: 'Bậc 6: « Eternal Sovereign »', kind: 'pet_tier' },
  { id: '1487133030261719222', label: 'Divider: ✦ ──────・ 𓆩 Pet Level 𓆪 ・────── ✦', kind: 'pet_divider' },
  { id: '1487134136547279088', label: 'Bậc 5: « Omniscient Existence »', kind: 'pet_tier' },
  { id: '1487134131522506783', label: 'Bậc 4: « Transcendent Being »', kind: 'pet_tier' },
  { id: '1487151959457923102', label: 'Bậc 3: « Boundless Singularity »', kind: 'pet_tier' },
  { id: '1487134121242394875', label: 'Bậc 2: « Singularity Manifest »', kind: 'pet_tier' },
  { id: '1487071105486291145', label: 'Bậc 1: « Singularity Pet »', kind: 'pet_tier' },
  // 3 Extra Roles (giữ Top 1・Bạch Hồ Thánh Linh 1473574460656193616)
  { id: '1519352393228222555', label: 'Extra: « Bạch Nguyệt Quang »', kind: 'extra_role' },
  { id: '1473333612404539513', label: 'Extra: « Dạ Hồ Ma Ảnh »', kind: 'extra_role' },
  { id: '1473372858657804441', label: 'Extra: « Thiên Hồ Hắc Dạ »', kind: 'extra_role' },
];

const TIER_PRIORITY = [
  { roleId: '1487136488331153589', key: 'bac_6', label: 'Bậc 6 (« Eternal Sovereign »)', lt: 10000, tt: 50, roleRarity: 'mythic', grantFrame6: true, title: null },
  { roleId: '1487134136547279088', key: 'bac_5', label: 'Bậc 5 (« Omniscient Existence »)', lt: 5000, tt: 0, roleRarity: 'mythic', grantFrame6: true, title: null },
  { roleId: '1487134131522506783', key: 'bac_4', label: 'Bậc 4 (« Transcendent Being »)', lt: 3500, tt: 0, roleRarity: 'epic', grantFrame6: false, title: null },
  { roleId: '1487151959457923102', key: 'bac_3', label: 'Bậc 3 (« Boundless Singularity »)', lt: 2500, tt: 0, roleRarity: 'epic_90d', grantFrame6: false, title: null },
  { roleId: '1487134121242394875', key: 'bac_2', label: 'Bậc 2 (« Singularity Manifest »)', lt: 1500, tt: 0, roleRarity: 'rare', grantFrame6: false, title: null },
  { roleId: '1487071105486291145', key: 'bac_1', label: 'Bậc 1 (« Singularity Pet »)', lt: 1000, tt: 0, roleRarity: null, grantFrame6: false, title: 'Ngự Thú Tiên Phong' },
];

const EXTRA_ROLE_MAP = {
  '1519352393228222555': 'Bạch Nguyệt Quang',
  '1473333612404539513': 'Dạ Hồ Ma Ảnh',
  '1473372858657804441': 'Thiên Hồ Hắc Dạ',
};

async function openBotGhostCDP() {
  const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = pages.find((p) => p.url && p.url.includes('botghost.com'));
  if (!page) throw new Error('BotGhost tab not found on CDP port 9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let cid = 1;
  const evalFn = (expression, timeoutMs = 25000) =>
    new Promise((res, rej) => {
      const id = cid++;
      const timer = setTimeout(() => rej(new Error(`CDP timeout after ${timeoutMs}ms`)), timeoutMs);
      const handler = (m) => {
        const d = JSON.parse(m.data);
        if (d.id === id) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          if (d.result?.exceptionDetails) {
            rej(new Error(d.result.exceptionDetails.text || 'CDP eval exception'));
          } else {
            res(d.result?.result?.value);
          }
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  return { ws, evalFn };
}

async function discordProxy(evalFn, { method, path: apiPath, bodyObj = null, auditReason = null }) {
  const headers = [{ key: 'Authorization', value: 'Bot {TOKEN_SECRET}' }];
  if (bodyObj !== null) headers.push({ key: 'Content-Type', value: 'application/json' });
  if (auditReason) headers.push({ key: 'X-Audit-Log-Reason', value: encodeURIComponent(auditReason) });
  const requestOptions = {
    method,
    url: `https://discord.com/api/v10${apiPath}`,
    headers,
    params: [],
    body: [],
    options: {
      excludeEmptyFields: true,
      replaceHeaders: true,
      failOnError: false,
      ...(bodyObj !== null ? { replaceBody: true, bodyMode: 'raw', contentType: 'application/json' } : {}),
    },
  };
  if (bodyObj !== null) {
    requestOptions.rawBody = JSON.stringify(bodyObj);
    requestOptions.contentType = 'application/json';
  }
  const payload = JSON.stringify({ bot_id: BOT_ID, request_options: requestOptions });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await evalFn(`(async () => {
      const r = await fetch('/api/dashboard/test_api_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ${JSON.stringify(payload)}
      });
      const text = await r.text();
      let j = {};
      try { j = JSON.parse(text); } catch { return { httpStatus: r.status, nonJson: text.slice(0, 200) }; }
      return { httpStatus: r.status, apiStatus: j?.api_data?.status, response: j?.api_data?.response };
    })()`, 25000);
    if ((res?.apiStatus === 429 || (res?.httpStatus >= 500 && res?.httpStatus < 600)) && attempt < 3) {
      const waitSec = Number(res?.response?.retry_after || 2);
      await new Promise((r) => setTimeout(r, Math.ceil((waitSec + 0.5) * 1000)));
      continue;
    }
    return res;
  }
  throw new Error(`Exceeded retries for ${method} ${apiPath}`);
}

function buildPlanFromScan(scan) {
  const petTierIds = new Set(TIER_PRIORITY.map((t) => t.roleId));
  const extraIds = new Set(Object.keys(EXTRA_ROLE_MAP));
  const holderMap = new Map();
  const extraOnlyHolders = [];

  for (const h of scan.holders || []) {
    if (h.bot) continue;
    const allRoles = h.all_roles || h.matched_roles || [];
    const highestTier = TIER_PRIORITY.find((t) => allRoles.includes(t.roleId));
    const heldExtras = Object.keys(EXTRA_ROLE_MAP).filter((eid) => allRoles.includes(eid));
    if (!highestTier) {
      if (heldExtras.length > 0) extraOnlyHolders.push({ ...h, heldExtras });
      continue;
    }
    const isBaoChua = h.user_id === BAO_CHUA_ID;
    const planEntry = {
      user_id: h.user_id,
      username: h.username || '',
      global_name: h.global_name || '',
      nick: h.nick || '',
      tier_key: isBaoChua ? 'bac_5_bao_chua' : highestTier.key,
      tier_label: isBaoChua ? 'Bậc 5 Đặc Biệt (Báo Chúa)' : highestTier.label,
      held_pet_roles_count: allRoles.filter((rid) => petTierIds.has(rid)).length,
      held_extras: heldExtras.map((eid) => EXTRA_ROLE_MAP[eid]),
      kept_top1: allRoles.includes(TOP_1_KEEP_ROLE_ID),
      lt: isBaoChua ? 20000 : highestTier.lt,
      tt: isBaoChua ? 100 : highestTier.tt,
      role_rarity: highestTier.roleRarity,
      grant_frame_6: highestTier.grantFrame6,
      custom_title: highestTier.title,
      tier_rank_order: isBaoChua ? 1.5 : TIER_PRIORITY.indexOf(highestTier),
    };
    holderMap.set(h.user_id, planEntry);
  }

  const holders = [...holderMap.values()].sort((a, b) => {
    if (a.tier_rank_order !== b.tier_rank_order) return a.tier_rank_order - b.tier_rank_order;
    return a.user_id.localeCompare(b.user_id);
  });

  return { holders, extraOnlyHolders };
}

function pickGachaRoleForUser(rarityKey, existingRoleIds, roundRobinIdx) {
  if (!rarityKey) return null;
  const tierKey = rarityKey === 'epic_90d' ? 'epic' : rarityKey;
  const pool = GACHA_ROLE_CATALOG.filter((r) => r.rarity_key === tierKey);
  if (pool.length === 0) throw new Error(`No roles found in GACHA_ROLE_CATALOG for rarity "${tierKey}"`);
  const unowned = pool.filter((r) => !existingRoleIds.has(r.role_id));
  const candidates = unowned.length > 0 ? unowned : pool;
  return candidates[roundRobinIdx % candidates.length];
}

function computeCleanPetOfFuyumiPerms(rolesList) {
  const gachaIds = new Set(GACHA_ROLE_CATALOG.map((r) => r.role_id));
  let gachaUnion = 0n;
  for (const r of rolesList) {
    if (gachaIds.has(r.id)) gachaUnion |= BigInt(r.permissions || '0');
  }
  const petRole = rolesList.find((r) => r.id === PET_OF_FUYUMI_ROLE_ID);
  if (!petRole) throw new Error(`Pet Of Fuyumi role (${PET_OF_FUYUMI_ROLE_ID}) not found!`);
  const orig = BigInt(petRole.permissions || '0');
  const clean = orig & ~gachaUnion;
  if ((clean & ~orig) !== 0n) throw new Error('Safety assertion failed: clean perms add bits outside original');
  if ((clean & gachaUnion) !== 0n) throw new Error('Safety assertion failed: clean perms still overlap Gacha roles');
  return {
    orig: orig.toString(),
    clean: clean.toString(),
    gachaUnion: gachaUnion.toString(),
    strippedMask: (orig & gachaUnion).toString(),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!AVATAR_FRAME_BY_ID[FRAME_6_ID]) {
    throw new Error(`Frame #6 "${FRAME_6_ID}" not found in AVATAR_FRAME_BY_ID`);
  }
  if (!supabase) throw new Error('Supabase client unavailable');

  const scan = JSON.parse(fs.readFileSync(SCAN_PATH, 'utf8'));
  const permPlan = computeCleanPetOfFuyumiPerms(scan.roles || []);
  const { holders, extraOnlyHolders } = buildPlanFromScan(scan);
  if (extraOnlyHolders.length > 0) {
    throw new Error(`Unexpected extra-only holders found without Pet tier: ${JSON.stringify(extraOnlyHolders)}`);
  }

  const userIds = holders.map((h) => h.user_id);
  const [{ data: dbUsers }, { data: dbRoles }, { data: dbFrames }, { data: dbMarkers }] = await Promise.all([
    supabase.from('users').select('user_id, username, level, linh_thach, red_gold_crystals, avatar_frame, custom_title').in('user_id', userIds),
    supabase.from('user_roles').select('*').in('user_id', userIds),
    supabase.from('user_frames').select('user_id, frame_id').in('user_id', userIds),
    supabase.from('v17_migration_markers').select('marker_key, applied_at, note').like('marker_key', 'v17_%'),
  ]);

  const dbUserMap = new Map((dbUsers || []).map((u) => [u.user_id, u]));
  const dbRolesByUser = new Map();
  for (const r of dbRoles || []) {
    if (!dbRolesByUser.has(r.user_id)) dbRolesByUser.set(r.user_id, []);
    dbRolesByUser.get(r.user_id).push(r);
  }
  const dbFramesByUser = new Map();
  for (const f of dbFrames || []) {
    if (!dbFramesByUser.has(f.user_id)) dbFramesByUser.set(f.user_id, new Set());
    dbFramesByUser.get(f.user_id).add(f.frame_id);
  }
  const markerMap = new Map((dbMarkers || []).map((m) => [m.marker_key, m]));

  const now = new Date();
  const rrCounts = { mythic: 0, epic: 0, epic_90d: 0, rare: 0 };
  const enriched = holders.map((h) => {
    const dbU = dbUserMap.get(h.user_id) || null;
    const uRoles = dbRolesByUser.get(h.user_id) || [];
    const uFrames = dbFramesByUser.get(h.user_id) || new Set();
    const lv = Number(dbU?.level || 1);
    const maxSlots = getMaxRoleSlotsByLevel(lv);
    const activeEquipped = uRoles.filter((r) => r.is_equipped && r.equipped_slot && (r.is_permanent || !r.expires_at || new Date(r.expires_at) > now));
    const usedSlots = new Set(activeEquipped.map((r) => Number(r.equipped_slot)));
    let freeSlot = null;
    for (let s = 1; s <= maxSlots; s += 1) {
      if (!usedSlots.has(s)) { freeSlot = s; break; }
    }
    const ownedRoleSet = new Set(uRoles.map((r) => r.role_id));
    let pickedRole = null;
    if (h.role_rarity) {
      pickedRole = pickGachaRoleForUser(h.role_rarity, ownedRoleSet, rrCounts[h.role_rarity] || 0);
      rrCounts[h.role_rarity] = (rrCounts[h.role_rarity] || 0) + 1;
    }
    const alreadyDone = markerMap.has(`v17_pet_role_comp:${h.user_id}`);
    return {
      ...h,
      db_exists: Boolean(dbU),
      db_level: lv,
      db_lt_before: Number(dbU?.linh_thach || 0),
      db_tt_before: Number(dbU?.red_gold_crystals || 0),
      max_role_slots: maxSlots,
      used_slots: activeEquipped.length,
      free_slot: freeSlot,
      picked_role: pickedRole
        ? {
            role_id: pickedRole.role_id,
            name: pickedRole.name,
            rarity: pickedRole.rarity,
            is_permanent: h.role_rarity !== 'epic_90d',
            is_equipped: Boolean(freeSlot),
            equipped_slot: freeSlot,
          }
        : null,
      already_has_frame_6: uFrames.has(FRAME_6_ID),
      already_compensated: alreadyDone,
      db_applied: false,
      discord_role_added: false,
      dm_sent: false,
    };
  });

  console.log(`\n============================================================`);
  console.log(`SuMi Mục 2 Compensation & Cleanup (${apply ? 'LIVE --apply' : 'DRY RUN'})`);
  console.log(`============================================================`);
  console.log(`Holders matched: ${enriched.length} | Extra-only excluded: ${extraOnlyHolders.length}`);
  console.log(`Pet Of Fuyumi (${PET_OF_FUYUMI_ROLE_ID}) perms: ${permPlan.orig} -> ${permPlan.clean}`);
  console.log(`Roles to delete: ${ROLES_TO_DELETE.length} | KEEP: Top 1 (${TOP_1_KEEP_ROLE_ID}), Extra Divider (${EXTRA_DIVIDER_KEEP_ROLE_ID}), Pet Of Fuyumi (${PET_OF_FUYUMI_ROLE_ID})\n`);

  for (const [idx, u] of enriched.entries()) {
    const roleStr = u.picked_role
      ? `${u.picked_role.name} (${u.picked_role.is_equipped ? `Slot #${u.picked_role.equipped_slot}` : '/inv dự phòng - full slot'})`
      : u.custom_title
        ? `Danh hiệu '${u.custom_title}'`
        : '-';
    console.log(
      `${String(idx + 1).padStart(2, ' ')}. @${u.username} (${u.user_id}) | ${u.tier_label} | Lv.${u.db_level} (${u.used_slots}/${u.max_role_slots} slots) | +${u.lt} LT, +${u.tt} TT | ${roleStr}${u.grant_frame_6 ? ' + Frame #6' : ''}${u.held_extras.length ? ` | Extras=${u.held_extras.join(', ')}` : ''}${u.kept_top1 ? ' | KEEP Top 1' : ''}`
    );
  }

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    generated_at: new Date().toISOString(),
    total_holders: enriched.length,
    total_lt: enriched.reduce((s, x) => s + x.lt, 0),
    total_tt: enriched.reduce((s, x) => s + x.tt, 0),
    pet_of_fuyumi_perm_plan: permPlan,
    holders: enriched,
    deleted_roles: [],
    kept_roles_verified: [],
  };

  if (!apply) {
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n[DRY-RUN] Preview saved to ${OUTPUT_JSON_PATH}`);
    return;
  }

  // Step 1: Supabase DB compensation (100% idempotent per marker_key)
  console.log('\n[STEP 1] Applying Supabase compensation...');
  for (const u of enriched) {
    const markerKey = `v17_pet_role_comp:${u.user_id}`;
    if (u.already_compensated) {
      console.log(`  [SKIP DB] ${u.user_id} (@${u.username}) already compensated via ${markerKey}`);
      continue;
    }

    const displayName = u.nick || u.global_name || u.username || `Tu Sĩ #${u.user_id.slice(-4)}`;
    const initRes = await ensureUserInitialized(u.user_id, {
      username: displayName,
      fallbackUsername: u.username || displayName,
      avatarUrl: null,
    });
    const freshUser = initRes.user;
    if (!freshUser) throw new Error(`Failed ensureUserInitialized for ${u.user_id}`);

    const nowIso = new Date().toISOString();
    const nextLt = Number(freshUser.linh_thach || 0) + u.lt;
    const nextTt = Number(freshUser.red_gold_crystals || 0) + u.tt;
    const userUpdate = {
      linh_thach: nextLt,
      red_gold_crystals: nextTt,
      updated_at: nowIso,
      ...(u.custom_title ? { custom_title: u.custom_title } : {}),
    };
    const { error: uErr } = await supabase.from('users').update(userUpdate).eq('user_id', u.user_id);
    if (uErr) throw new Error(`Failed updating users for ${u.user_id}: ${uErr.message}`);

    if (u.grant_frame_6) {
      const { error: fErr } = await supabase.from('user_frames').upsert(
        { user_id: u.user_id, frame_id: FRAME_6_ID, purchased_at: nowIso },
        { onConflict: 'user_id,frame_id' }
      );
      if (fErr) throw new Error(`Failed granting Frame #6 for ${u.user_id}: ${fErr.message}`);
    }

    if (u.picked_role) {
      const fullRole = GACHA_ROLE_CATALOG.find((r) => r.role_id === u.picked_role.role_id);
      const { data: existingRoleRow } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', u.user_id)
        .eq('role_id', u.picked_role.role_id)
        .maybeSingle();

      const rolePayload = {
        user_id: u.user_id,
        role_id: u.picked_role.role_id,
        role_name: fullRole.name,
        role_perk: sanitizeRolePerkForDb(fullRole.perk),
        is_permanent: u.picked_role.is_permanent,
        expires_at: u.picked_role.is_permanent ? null : new Date(Date.now() + 90 * 86400000).toISOString(),
        is_equipped: existingRoleRow?.is_equipped ?? u.picked_role.is_equipped,
        equipped_slot: existingRoleRow?.equipped_slot ?? u.picked_role.equipped_slot,
        source: 'pet_role_compensation',
        paid_price: 0,
      };
      if (existingRoleRow) {
        const { error: rErr } = await supabase.from('user_roles').update(rolePayload).eq('id', existingRoleRow.id);
        if (rErr) throw new Error(`Failed updating user_roles for ${u.user_id}: ${rErr.message}`);
      } else {
        const { error: rErr } = await supabase.from('user_roles').insert(rolePayload);
        if (rErr) throw new Error(`Failed inserting user_roles for ${u.user_id}: ${rErr.message}`);
      }
    }

    const { error: mErr } = await supabase.from('v17_migration_markers').upsert(
      {
        marker_key: markerKey,
        applied_at: nowIso,
        note: JSON.stringify({
          tier: u.tier_key,
          lt: u.lt,
          tt: u.tt,
          role_id: u.picked_role?.role_id || null,
          role_slot: u.picked_role?.equipped_slot || null,
          frame_6: u.grant_frame_6,
          custom_title: u.custom_title,
        }),
      },
      { onConflict: 'marker_key' }
    );
    if (mErr) throw new Error(`Failed writing marker ${markerKey}: ${mErr.message}`);
    invalidateInventoryCache(u.user_id);
    u.db_applied = true;
    console.log(`  [DB OK] ${u.user_id} (@${u.username}): +${u.lt} LT (${freshUser.linh_thach} -> ${nextLt}), +${u.tt} TT`);
  }

  // Step 2: Discord CDP operations (safety check /pet -> grant equipped roles -> patch Pet Of Fuyumi -> DM -> delete 10 roles)
  console.log('\n[STEP 2] Connecting to BotGhost CDP for Discord cleanup & role sync...');
  const { ws, evalFn } = await openBotGhostCDP();
  try {
    // 2a. Verify /pet command in live BotGhost cloud no longer contains deleted role IDs before deleting them
    const petSafetyRaw = await evalFn(`(() => {
      const root = document.querySelector('#root');
      const rk = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
      let f = root[rk], store = null, seen = new Set();
      const walk = (n) => {
        if (!n || seen.has(n) || store) return;
        seen.add(n);
        const s1 = n.memoizedProps?.store;
        if (s1?.getState?.()?.data?.bot?.commands?.slash) store = s1;
        const s2 = n.stateNode?.store;
        if (!store && s2?.getState?.()?.data?.bot?.commands?.slash) store = s2;
        if (n.child) walk(n.child);
        if (n.sibling) walk(n.sibling);
      };
      walk(f);
      const cmd = Object.values(store?.getState()?.data?.bot?.commands?.slash?.commands || {}).find(c => c && c.name === 'pet');
      return cmd?.compressed_tree || '';
    })()`);
    const { default: LZString } = await import('lz-string');
    const petTreeStr = petSafetyRaw ? LZString.decompressFromBase64(petSafetyRaw) || '' : '';
    for (const delRole of ROLES_TO_DELETE) {
      if (petTreeStr.includes(delRole.id)) {
        throw new Error(`ABORT ROLE DELETION: BotGhost /pet still references role ${delRole.id} (${delRole.label}). Deploy /pet first!`);
      }
    }
    console.log('  [SAFETY OK] BotGhost /pet verified free of all 10 deleted role IDs.');

    // 2b. Add equipped Gacha Discord roles for compensated users with free_slot
    for (const u of enriched) {
      if (u.picked_role?.is_equipped) {
        const res = await discordProxy(evalFn, {
          method: 'PUT',
          path: `/guilds/${GUILD_ID}/members/${u.user_id}/roles/${u.picked_role.role_id}`,
          bodyObj: null,
          auditReason: 'SuMi v1.7 Pet Role Compensation',
        });
        u.discord_role_added = res.apiStatus >= 200 && res.apiStatus < 300;
        console.log(`  [DISCORD ROLE ADD] ${u.user_id} (@${u.username}) + ${u.picked_role.role_id} (${u.picked_role.name}) -> HTTP ${res.apiStatus}`);
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    // 2c. Re-fetch live roles and patch Pet Of Fuyumi permissions cleanly
    const liveRolesRes = await discordProxy(evalFn, { method: 'GET', path: `/guilds/${GUILD_ID}/roles` });
    const liveRoles = Array.isArray(liveRolesRes?.response) ? liveRolesRes.response : [];
    const livePermPlan = computeCleanPetOfFuyumiPerms(liveRoles);
    const livePetRole = liveRoles.find((r) => r.id === PET_OF_FUYUMI_ROLE_ID);
    if (String(livePetRole?.permissions) !== livePermPlan.clean) {
      const patchRes = await discordProxy(evalFn, {
        method: 'PATCH',
        path: `/guilds/${GUILD_ID}/roles/${PET_OF_FUYUMI_ROLE_ID}`,
        bodyObj: { permissions: livePermPlan.clean },
        auditReason: 'SuMi v1.7 Strip Gacha Perm Overlap from Pet Of Fuyumi',
      });
      console.log(`  [PET OF FUYUMI PATCH] ${livePetRole?.permissions} -> ${livePermPlan.clean} (HTTP ${patchRes.apiStatus})`);
      if (patchRes.apiStatus < 200 || patchRes.apiStatus >= 300) {
        throw new Error(`Failed patching Pet Of Fuyumi permissions: ${JSON.stringify(patchRes)}`);
      }
    } else {
      console.log(`  [PET OF FUYUMI OK] Already clean at ${livePermPlan.clean}`);
    }

    // 2d. Send best-effort DM to Bậc 6 holders + Báo Chúa
    const dmTargets = enriched.filter((u) => u.tier_key === 'bac_6' || u.tier_key === 'bac_5_bao_chua');
    for (const u of dmTargets) {
      try {
        const chRes = await discordProxy(evalFn, {
          method: 'POST',
          path: '/users/@me/channels',
          bodyObj: { recipient_id: u.user_id },
        });
        const dmChId = chRes?.response?.id;
        if (dmChId) {
          const dmMsg = [
            `✨ **THÔNG BÁO ĐỀN BÙ HỆ THỐNG PET ROLE — SUMI FAMILY v1.7** ✨`,
            `Gửi **${u.global_name || u.username}** (<@${u.user_id}>),`,
            `Từ phiên bản **Ver 1.7**, server chính thức đóng hệ Pet Level & Extra Roles cũ (giữ nguyên Top 1 & Pet Of Fuyumi là role cộng đồng).`,
            `Nhiễm Nhiễm đã chuyển trực tiếp gói tri ân **${u.tier_label}** vào tài khoản của bạn:`,
            `• **+${u.lt.toLocaleString('vi-VN')} Linh Thạch**`,
            u.tt > 0 ? `• **+${u.tt.toLocaleString('vi-VN')} Xích Kim Tinh Thạch (TT)**` : null,
            u.picked_role ? `• **Role Vĩnh Viễn ${u.picked_role.name}** ${u.picked_role.is_equipped ? `(Đã đeo sẵn tại Slot #${u.picked_role.equipped_slot})` : '(Đã lưu an toàn trong `/inv` — bạn có thể `/equip` tùy ý)'}` : null,
            u.grant_frame_6 ? `• **Khung Thần Thoại #6: Huyết Nha Thâm Uyên** (đã mở khóa trong \`/inv\`)` : null,
            `Cảm ơn bạn đã đồng hành cùng **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆**!`,
          ].filter(Boolean).join('\n');
          const sendRes = await discordProxy(evalFn, {
            method: 'POST',
            path: `/channels/${dmChId}/messages`,
            bodyObj: { content: dmMsg },
          });
          u.dm_sent = sendRes.apiStatus >= 200 && sendRes.apiStatus < 300;
          console.log(`  [DM] ${u.user_id} (@${u.username}) -> HTTP ${sendRes.apiStatus}`);
        }
      } catch (dmErr) {
        console.warn(`  [DM SKIP] ${u.user_id} (@${u.username}): ${dmErr.message}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    // 2e. DELETE the 10 specified roles (NEVER touch Top 1, Extra Divider, or Pet Of Fuyumi)
    console.log('\n[STEP 3] Deleting 10 obsolete Pet Level + Extra roles on Discord...');
    for (const delRole of ROLES_TO_DELETE) {
      if ([TOP_1_KEEP_ROLE_ID, EXTRA_DIVIDER_KEEP_ROLE_ID, PET_OF_FUYUMI_ROLE_ID].includes(delRole.id)) {
        throw new Error(`SAFETY ABORT: Protected role ${delRole.id} appeared in delete list!`);
      }
      const exists = liveRoles.some((r) => r.id === delRole.id);
      if (!exists) {
        console.log(`  [ALREADY GONE] ${delRole.id} (${delRole.label})`);
        report.deleted_roles.push({ ...delRole, status: 'already_absent' });
        continue;
      }
      const delRes = await discordProxy(evalFn, {
        method: 'DELETE',
        path: `/guilds/${GUILD_ID}/roles/${delRole.id}`,
        auditReason: 'SuMi v1.7 Close Pet Level & Extra Roles',
      });
      console.log(`  [DELETED] ${delRole.id} (${delRole.label}) -> HTTP ${delRes.apiStatus}`);
      if (delRes.apiStatus < 200 || delRes.apiStatus >= 300) {
        throw new Error(`Failed deleting role ${delRole.id}: ${JSON.stringify(delRes)}`);
      }
      report.deleted_roles.push({ ...delRole, status: delRes.apiStatus });
      await new Promise((r) => setTimeout(r, 450));
    }

    // 2f. Post-deletion live verification
    const postRolesRes = await discordProxy(evalFn, { method: 'GET', path: `/guilds/${GUILD_ID}/roles` });
    const postRoles = Array.isArray(postRolesRes?.response) ? postRolesRes.response : [];
    const postMap = new Map(postRoles.map((r) => [r.id, r]));
    for (const delRole of ROLES_TO_DELETE) {
      if (postMap.has(delRole.id)) {
        throw new Error(`Post-delete verify FAILED: ${delRole.id} (${delRole.label}) still exists!`);
      }
    }
    for (const keepId of [TOP_1_KEEP_ROLE_ID, EXTRA_DIVIDER_KEEP_ROLE_ID, PET_OF_FUYUMI_ROLE_ID]) {
      const kr = postMap.get(keepId);
      if (!kr) throw new Error(`Post-delete verify FAILED: kept role ${keepId} disappeared!`);
      report.kept_roles_verified.push({ id: kr.id, name: kr.name, permissions: kr.permissions, position: kr.position });
    }
    console.log('\n[VERIFY OK] All 10 roles confirmed deleted; Top 1, Extra Divider & Pet Of Fuyumi verified intact on Discord!');
  } finally {
    ws.close();
  }

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[DONE] Saved full execution report to ${OUTPUT_JSON_PATH}`);
}

main().catch((err) => {
  console.error('[execute_v1_7_role_compensation_and_cleanup] FAILED:', err);
  process.exit(1);
});
