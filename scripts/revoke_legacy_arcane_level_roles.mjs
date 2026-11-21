import dotenv from 'dotenv';
import fs from 'node:fs';
import { LEVEL_ROLE_MILESTONES } from '../src/data/catalog.js';
import { supabase } from '../src/config/supabase.js';

dotenv.config();

const GUILD_ID = '1026096141273661450';
const FUYUMI_ID = '757091869183311872';
const NO_LE_ROLE_ID = '1026099349689741322'; // ⛓️ Nô lệ ⛓️ (Basic Role - MUST PRESERVE)

const LEVEL_ROLE_BY_ID = new Map(LEVEL_ROLE_MILESTONES.map((m) => [m.roleId, m]));
const LEVEL_ROLE_IDS = [...LEVEL_ROLE_BY_ID.keys()];
if (LEVEL_ROLE_BY_ID.has(NO_LE_ROLE_ID)) {
  throw new Error('Safety guard triggered: Nô lệ role ID must never be in LEVEL_ROLE_MILESTONES!');
}
if (LEVEL_ROLE_BY_ID.size !== 8) {
  throw new Error(`Expected exactly 8 level roles, found ${LEVEL_ROLE_BY_ID.size}`);
}

async function createCdp() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const dcTab = tabs.find((t) => t.url?.includes('discord.com/channels') && t.type === 'page');
  if (!dcTab) throw new Error('Không tìm thấy tab Discord trên Edge CDP 9222');

  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('WS open timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener('error', (e) => { clearTimeout(t); rej(e); }, { once: true });
  });

  let nextId = 1;
  const call = (method, params = {}, timeoutMs = 25000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error(`CDP timeout on ${method}`));
    }, timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(t);
        ws.removeEventListener('message', onMsg);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

  return { ws, call };
}

async function fetchAllSupabaseUserLevels() {
  if (!supabase) throw new Error('Supabase client not initialized');
  const map = new Map();
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, level')
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Supabase query error: ${error.message}`);
    for (const row of data || []) {
      map.set(String(row.user_id), Number(row.level) || 1);
    }
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return map;
}

async function fetchMembersHoldingLevelRoles(call) {
  const memberMap = new Map();
  let after = null;
  let totalReported = 0;

  while (true) {
    const bodyPayload = {
      limit: 100,
      and_query: { role_ids: { or_query: LEVEL_ROLE_IDS } },
      ...(after ? { after } : {}),
    };

    const pageRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const r = await window.__sumiApiV9('POST', '/guilds/${GUILD_ID}/members-search', ${JSON.stringify(bodyPayload)});
        if (r.status !== 200) return { status: r.status, error: r.data, members: [] };
        return {
          status: 200,
          total_result_count: r.data?.total_result_count || 0,
          members: (r.data?.members || []).map(entry => {
            const m = entry.member || entry;
            return {
              id: m.user?.id,
              username: m.user?.global_name || m.user?.username || m.nick || '',
              bot: Boolean(m.user?.bot),
              roles: m.roles || [],
              joined_at: m.joined_at || null,
            };
          }),
        };
      })()`,
    }, 25000);

    const pv = pageRes?.result?.value;
    if (!pv || pv.status !== 200) {
      throw new Error(`members-search failed: ${JSON.stringify(pv)}`);
    }
    totalReported = pv.total_result_count || totalReported;

    for (const m of pv.members) {
      if (m.id) memberMap.set(m.id, m);
    }

    if (pv.members.length < 100) break;
    const last = pv.members[pv.members.length - 1];
    if (!last?.id || !last?.joined_at) break;
    after = {
      guild_joined_at: new Date(last.joined_at).getTime(),
      user_id: last.id,
    };
    await new Promise((r) => setTimeout(r, 250));
  }

  return { members: [...memberMap.values()], totalReported };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== REVOKE LEGACY ARCANE LEVEL ROLES (dryRun=${dryRun}) ===`);

  const dbLevels = await fetchAllSupabaseUserLevels();
  console.log(`[Supabase] Loaded ${dbLevels.size} user levels.`);

  const { ws, call } = await createCdp();
  try {
    await call('Page.bringToFront');
    await new Promise((r) => setTimeout(r, 400));

    const initRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        if (!window.__sumiGetToken) {
          window.__sumiGetToken = () => {
            let token = null;
            window.webpackChunkdiscord_app.push([['sumi_rev_' + Math.random()], {}, (req) => {
              for (const id in req.c) {
                const mod = req.c[id];
                const exp = mod?.exports?.default || mod?.exports;
                if (exp && typeof exp.getToken === 'function') {
                  try {
                    const tok = exp.getToken();
                    if (tok && typeof tok === 'string' && tok.length > 20) token = tok;
                  } catch {}
                }
              }
            }]);
            return token;
          };
        }
        const makeApi = (base) => async (method, path, body = null) => {
          const token = window.__sumiGetToken();
          if (!token) throw new Error('No token');
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          for (let attempt = 0; attempt < 8; attempt++) {
            const opts = {
              method,
              headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            };
            if (body !== null) opts.body = JSON.stringify(body);
            const res = await fetch(base + path, opts);
            if (res.status === 429) {
              const rd = await res.json().catch(() => ({}));
              await sleep(Math.ceil((rd.retry_after || 1.5) * 1000) + 300);
              continue;
            }
            const data = res.status === 204 ? null : await res.json().catch(() => null);
            return { status: res.status, data };
          }
          return { status: 429, data: null };
        };
        window.__sumiApiV9 = makeApi('https://discord.com/api/v9');
        window.__sumiApiV10 = makeApi('https://discord.com/api/v10');
        return Boolean(window.__sumiGetToken());
      })()`,
    });
    if (!initRes?.result?.value) throw new Error('Failed to inject Discord API token helper');

    const { members: initialMembers, totalReported } = await fetchMembersHoldingLevelRoles(call);
    console.log(`[Discord] members-search returned ${initialMembers.length} unique members (reported ${totalReported}) holding level roles.`);

    // If a boundary member was skipped due to equal joined_at timestamp, run second pass excluding nothing in live mode
    let allMembers = initialMembers;
    if (!dryRun && initialMembers.length < totalReported) {
      // Also query each of the 8 level roles individually to guarantee 100% coverage!
      const extraMap = new Map(allMembers.map((m) => [m.id, m]));
      for (const rid of LEVEL_ROLE_IDS) {
        const oneRoleRes = await call('Runtime.evaluate', {
          awaitPromise: true,
          returnByValue: true,
          expression: `(async () => {
            const r = await window.__sumiApiV9('POST', '/guilds/${GUILD_ID}/members-search', ${JSON.stringify({ limit: 100, and_query: { role_ids: { or_query: [rid] } } })});
            return {
              status: r.status,
              members: (r.data?.members || []).map(entry => {
                const m = entry.member || entry;
                return {
                  id: m.user?.id,
                  username: m.user?.global_name || m.user?.username || m.nick || '',
                  bot: Boolean(m.user?.bot),
                  roles: m.roles || [],
                  joined_at: m.joined_at || null,
                };
              }),
            };
          })()`,
        }, 25000);
        for (const m of oneRoleRes?.result?.value?.members || []) {
          if (m.id) extraMap.set(m.id, m);
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      allMembers = [...extraMap.values()];
      console.log(`[Discord] Extended role union covered ${allMembers.length} unique members.`);
    }

    let humansChecked = 0;
    let botsSkipped = 0;
    let skippedFuyumi = false;
    let noLePreserved = 0;
    let rolesKeptEarned = 0;
    let totalRolesPlanned = 0;
    let totalRolesRevoked = 0;
    const higherRole403 = [];
    const failures = [];
    const affectedUsers = [];

    for (const m of allMembers) {
      if (!m.id) continue;
      if (m.bot) {
        botsSkipped += 1;
        continue;
      }
      humansChecked += 1;
      if (m.roles.includes(NO_LE_ROLE_ID)) noLePreserved += 1;
      if (m.id === FUYUMI_ID) {
        skippedFuyumi = true;
        continue;
      }

      const dbLevel = dbLevels.get(m.id) ?? 1;
      const toRemove = [];
      const toKeep = [];
      for (const rid of m.roles) {
        const milestone = LEVEL_ROLE_BY_ID.get(rid);
        if (!milestone) continue;
        if (milestone.level > dbLevel) {
          toRemove.push(milestone);
        } else {
          toKeep.push(milestone);
        }
      }
      rolesKeptEarned += toKeep.length;
      if (toRemove.length === 0) continue;

      totalRolesPlanned += toRemove.length;
      const userRecord = {
        user_id: m.id,
        username: m.username,
        db_level: dbLevel,
        revoked: toRemove.map((r) => ({ level: r.level, role_id: r.roleId, name: r.name })),
        kept: toKeep.map((r) => ({ level: r.level, role_id: r.roleId, name: r.name })),
      };

      if (!dryRun) {
        for (const roleItem of toRemove) {
          const delRes = await call('Runtime.evaluate', {
            awaitPromise: true,
            returnByValue: true,
            expression: `(async () => {
              const r = await window.__sumiApiV10('DELETE', '/guilds/${GUILD_ID}/members/${m.id}/roles/${roleItem.roleId}');
              return { status: r.status, data: r.data };
            })()`,
          }, 25000);
          const dv = delRes?.result?.value;
          if (dv && (dv.status === 204 || dv.status === 200)) {
            totalRolesRevoked += 1;
          } else if (dv?.status === 403) {
            higherRole403.push({ user_id: m.id, username: m.username, role_id: roleItem.roleId, status: 403 });
          } else {
            failures.push({ user_id: m.id, role_id: roleItem.roleId, status: dv?.status, data: dv?.data });
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      affectedUsers.push(userRecord);
    }

    let postRevokeRemainingTotal = totalReported;
    if (!dryRun) {
      const afterCheck = await fetchMembersHoldingLevelRoles(call);
      postRevokeRemainingTotal = afterCheck.totalReported;
    }

    const summary = {
      dryRun,
      timestamp: new Date().toISOString(),
      guildId: GUILD_ID,
      reportedMembersWithLevelRolesBefore: totalReported,
      uniqueMembersFetched: allMembers.length,
      humansChecked,
      botsSkipped,
      skippedFuyumi,
      noLeRolePreservedCount: noLePreserved,
      rolesKeptEarnedCount: rolesKeptEarned,
      membersAffectedCount: affectedUsers.length,
      totalLevelRolesPlannedRevoke: totalRolesPlanned,
      totalLevelRolesActuallyRevoked: dryRun ? 0 : totalRolesRevoked,
      higherRole403Count: higherRole403.length,
      higherRole403,
      postRevokeRemainingTotal,
      failuresCount: failures.length,
      failures: failures.slice(0, 20),
      affectedSample: affectedUsers.slice(0, 40),
    };

    fs.writeFileSync('revoke_arcane_roles_result.json', JSON.stringify(summary, null, 2), 'utf8');
    console.log('SUMMARY:', JSON.stringify({ ...summary, affectedSample: `(${summary.affectedSample.length} samples)` }, null, 2));
    if (failures.length > 0) {
      throw new Error(`Revocation finished with ${failures.length} non-403 failures`);
    }
  } finally {
    ws.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
