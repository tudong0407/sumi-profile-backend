import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import { supabase } from '../src/config/supabase.js';
import { ROLE_BY_ID } from '../src/data/catalog.js';

const BOT_ID = '916469360401453067';
const GUILD_ID = '1026096141273661450';
const EXPLOITER_IDS = ['1311778045991850019', '1010756221600546946'];

class SimpleCdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nid = 1;
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('WS connect timeout')), 10000);
      this.ws.on('open', () => { clearTimeout(t); res(); });
      this.ws.on('error', (e) => { clearTimeout(t); rej(e); });
    });
    await this.send('Page.bringToFront').catch(() => {});
  }
  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((res, rej) => {
      const id = this.nid++;
      const timer = setTimeout(() => {
        this.ws.off('message', handler);
        rej(new Error(`CDP call ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const handler = (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.id === id) {
            clearTimeout(timer);
            this.ws.off('message', handler);
            if (msg.error) rej(new Error(JSON.stringify(msg.error)));
            else res(msg.result);
          }
        } catch {}
      };
      this.ws.on('message', handler);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr, timeoutMs = 30000) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    }, timeoutMs);
    if (r?.exceptionDetails) {
      throw new Error('CDP Exception: ' + JSON.stringify(r.exceptionDetails));
    }
    return r?.result?.value;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function discordApiViaBotGhost(cdp, method, discordPath) {
  const payload = JSON.stringify({
    bot_id: BOT_ID,
    request_options: {
      method,
      url: `https://discord.com/api/v10${discordPath}`,
      headers: [
        { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      params: [],
      body: [],
      rawBody: '',
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceHeaders: true,
        failOnError: false,
      },
    },
  });

  return cdp.eval(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return {
      httpStatus: r.status,
      apiStatus: j?.api_data?.status,
      response: j?.api_data?.response,
      message: j?.message || j?.error || null,
    };
  })()`);
}

async function main() {
  if (!supabase) throw new Error('Supabase client unavailable');
  const dryRun = process.argv.includes('--dry-run');

  const tabs = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const bgTab = tabs.find((t) => t.type === 'page' && t.url && t.url.includes('botghost.com'));
  if (!bgTab) throw new Error('No BotGhost tab found on Edge CDP 9222');

  const { data: roleRows, error } = await supabase
    .from('user_roles')
    .select('user_id, role_id, role_name, equipped_slot, is_permanent, expires_at');
  if (error) throw error;

  const nowMs = Date.now();
  const activeOwnedByUser = new Map();
  const equippedByUser = new Map();

  for (const row of roleRows || []) {
    if (String(row.user_id).startsWith('999')) continue;
    if (!ROLE_BY_ID[row.role_id]) continue;
    const isExpired = !row.is_permanent && row.expires_at && Date.parse(row.expires_at) <= nowMs;
    if (isExpired) continue;

    if (!activeOwnedByUser.has(row.user_id)) activeOwnedByUser.set(row.user_id, new Set());
    activeOwnedByUser.get(row.user_id).add(row.role_id);

    if (row.equipped_slot !== null && row.equipped_slot !== undefined) {
      if (!equippedByUser.has(row.user_id)) equippedByUser.set(row.user_id, []);
      equippedByUser.get(row.user_id).push(row.role_id);
    }
  }

  const usersToInspect = new Set([...equippedByUser.keys(), ...EXPLOITER_IDS]);
  const cdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await cdp.connect();

  const summary = {
    inspected_users: 0,
    added_roles: [],
    revoked_roles: [],
    already_synced: 0,
    not_in_guild: [],
    errors: [],
  };

  try {
    for (const uid of usersToInspect) {
      const mRes = await discordApiViaBotGhost(cdp, 'GET', `/guilds/${GUILD_ID}/members/${uid}`);
      summary.inspected_users += 1;
      if (mRes.apiStatus === 404) {
        summary.not_in_guild.push(uid);
        continue;
      }
      if (mRes.apiStatus !== 200 || !Array.isArray(mRes.response?.roles)) {
        summary.errors.push({ uid, action: 'GET_MEMBER', mRes });
        continue;
      }

      const discordRoleSet = new Set(mRes.response.roles);
      const wantedEquipped = equippedByUser.get(uid) || [];

      for (const rid of wantedEquipped) {
        if (discordRoleSet.has(rid)) {
          summary.already_synced += 1;
          continue;
        }
        if (dryRun) {
          summary.added_roles.push({ uid, rid, dryRun: true });
          continue;
        }
        const putRes = await discordApiViaBotGhost(cdp, 'PUT', `/guilds/${GUILD_ID}/members/${uid}/roles/${rid}`);
        if (putRes.apiStatus === 204 || putRes.apiStatus === 200) {
          summary.added_roles.push({ uid, rid, name: ROLE_BY_ID[rid]?.name || rid });
        } else {
          summary.errors.push({ uid, rid, action: 'PUT_ROLE', putRes });
          if (putRes.apiStatus === 403) {
            throw new Error(`HTTP 403 Missing Permissions adding role ${rid} to ${uid}: ${JSON.stringify(putRes)}`);
          }
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      // Sync exploiters: revoke any ROLE_BY_ID gacha role on Discord that is no longer owned/equipped in DB
      if (EXPLOITER_IDS.includes(uid)) {
        const ownedSet = new Set(wantedEquipped);
        for (const rid of discordRoleSet) {
          if (ROLE_BY_ID[rid] && !ownedSet.has(rid)) {
            if (dryRun) {
              summary.revoked_roles.push({ uid, rid, dryRun: true });
              continue;
            }
            const delRes = await discordApiViaBotGhost(cdp, 'DELETE', `/guilds/${GUILD_ID}/members/${uid}/roles/${rid}`);
            if (delRes.apiStatus === 204 || delRes.apiStatus === 200) {
              summary.revoked_roles.push({ uid, rid, name: ROLE_BY_ID[rid]?.name || rid });
            } else {
              summary.errors.push({ uid, rid, action: 'DELETE_ROLE', delRes });
            }
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }

      await new Promise((r) => setTimeout(r, 350));
    }
  } finally {
    cdp.close();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
