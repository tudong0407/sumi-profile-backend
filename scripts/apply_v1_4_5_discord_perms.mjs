/**
 * scripts/apply_v1_4_5_discord_perms.mjs
 * Đồng bộ chuẩn hóa quyền 11 Discord Roles (@everyone, Đã đọc RULES✅, Nô lệ, Lv.5–Lv.100)
 * và 17 Channels / Categories trên 🦊𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (1026096141273661450) qua BotGhost API Proxy (CDP 9222).
 *
 * Bảo toàn tuyệt đối:
 * - Không chạm 40 Role Quyền Năng (kể cả 19 màu gradient 2 màu), Staff/Mod Roles hay ✦ Staff Bot Roles ✦.
 * - Không chạm TempVoice động, › MUA HÀNG ‹, › TICKET ‹, › GENERALS ‹, › PARTNER ‹, › SYSTEM ‹, › STAFF ONLY ‹, #rules, #tổng-quan.
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const GUILD_ID = '1026096141273661450';

const DEFAULT_BACKUP_PATH =
  'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\scratch\\discord_perms_backup_before_v1_4_5.json';

const PERM_BITS = {
  CREATE_INSTANT_INVITE: 0n,
  ADD_REACTIONS: 6n,
  PRIORITY_SPEAKER: 8n,
  STREAM: 9n,
  VIEW_CHANNEL: 10n,
  SEND_MESSAGES: 11n,
  SEND_TTS_MESSAGES: 12n,
  MANAGE_MESSAGES: 13n,
  EMBED_LINKS: 14n,
  ATTACH_FILES: 15n,
  READ_MESSAGE_HISTORY: 16n,
  USE_EXTERNAL_EMOJIS: 18n,
  CONNECT: 20n,
  SPEAK: 21n,
  MUTE_MEMBERS: 22n,
  DEAFEN_MEMBERS: 23n,
  MOVE_MEMBERS: 24n,
  USE_VAD: 25n,
  CHANGE_NICKNAME: 26n,
  MANAGE_NICKNAMES: 27n,
  USE_APPLICATION_COMMANDS: 31n,
  REQUEST_TO_SPEAK: 32n,
  MANAGE_THREADS: 34n,
  CREATE_PUBLIC_THREADS: 35n,
  CREATE_PRIVATE_THREADS: 36n,
  USE_EXTERNAL_STICKERS: 37n,
  SEND_MESSAGES_IN_THREADS: 38n,
  USE_EMBEDDED_ACTIVITIES: 39n,
  USE_SOUNDBOARD: 42n,
  USE_EXTERNAL_SOUNDS: 45n,
  SEND_VOICE_MESSAGES: 46n,
  SEND_POLLS: 49n,
  PIN_MESSAGES: 51n,
  BYPASS_SLOWMODE: 52n,
};

const ALL_DECODE_BITS = {
  ...PERM_BITS,
  KICK_MEMBERS: 1n,
  BAN_MEMBERS: 2n,
  ADMINISTRATOR: 3n,
  MANAGE_CHANNELS: 4n,
  MANAGE_GUILD: 5n,
  VIEW_AUDIT_LOG: 7n,
  MENTION_EVERYONE: 17n,
  MANAGE_ROLES: 28n,
  MANAGE_WEBHOOKS: 29n,
  MODERATE_MEMBERS: 40n,
};

export function bits(...names) {
  let mask = 0n;
  for (const name of names) {
    if (!(name in PERM_BITS)) throw new Error(`Unknown permission bit name: ${name}`);
    mask |= 1n << PERM_BITS[name];
  }
  return mask.toString();
}

export function decodeBits(rawPerm) {
  const mask = BigInt(rawPerm || '0');
  return Object.entries(ALL_DECODE_BITS)
    .filter(([, bit]) => (mask & (1n << bit)) !== 0n)
    .sort((a, b) => Number(a[1] - b[1]))
    .map(([name]) => name);
}

const ROLE_IDS = {
  EVERYONE: GUILD_ID,
  READ_RULES: '1467026294201127023',
  BASE_SLAVE: '1026099349689741322',
  LV5: '1038406122417176586',
  LV15: '1038405196662976562',
  LV20: '1032988544874061836',
  LV35: '1375446293119369331',
  LV45: '1375451249952161903',
  LV60: '1375446809408962620',
  LV80: '1473419954379554967',
  LV100: '1473419957655175169',
  STAFF_BOT_SEP: '1473354131732168847',
  CACH_LY: '1474776271883079681',
  BOT: '1162777123333886072',
  SINGULARITY_MANIFEST: '1487134121242394875',
  TRANSCENDENT_BEING: '1487134131522506783',
  THIEN_LINH_CAO: '1038261276817768458',
};

const SLAVE_BASE_PERMS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'READ_MESSAGE_HISTORY',
  'ADD_REACTIONS',
  'USE_APPLICATION_COMMANDS',
  'CONNECT',
  'SPEAK',
  'USE_VAD',
  'REQUEST_TO_SPEAK',
  'SEND_MESSAGES_IN_THREADS',
];

const LV5_PERMS = ['ATTACH_FILES'];
const LV15_PERMS = [...LV5_PERMS, 'EMBED_LINKS', 'CHANGE_NICKNAME', 'USE_EXTERNAL_EMOJIS'];
const LV20_PERMS = [...LV15_PERMS, 'USE_EXTERNAL_STICKERS', 'SEND_VOICE_MESSAGES'];
const LV35_PERMS = [...LV20_PERMS, 'CREATE_PUBLIC_THREADS', 'STREAM'];
const LV45_PERMS = [...LV35_PERMS, 'USE_SOUNDBOARD', 'USE_EMBEDDED_ACTIVITIES'];
const LV60_PERMS = [...LV45_PERMS, 'CREATE_PRIVATE_THREADS', 'USE_EXTERNAL_SOUNDS'];
const LV80_PERMS = [...LV60_PERMS, 'PRIORITY_SPEAKER', 'SEND_TTS_MESSAGES', 'SEND_POLLS'];
const LV100_PERMS = [
  ...LV80_PERMS,
  'MOVE_MEMBERS',
  'MUTE_MEMBERS',
  'DEAFEN_MEMBERS',
  'MANAGE_NICKNAMES',
  'MANAGE_THREADS',
  'PIN_MESSAGES',
  'BYPASS_SLOWMODE',
];

export const TARGET_ROLE_SPECS = [
  { id: ROLE_IDS.EVERYONE, label: '@everyone', perms: [] },
  { id: ROLE_IDS.READ_RULES, label: 'Đã đọc RULES✅', perms: [] },
  { id: ROLE_IDS.BASE_SLAVE, label: '⛓️ Nô lệ ⛓️', perms: SLAVE_BASE_PERMS },
  { id: ROLE_IDS.LV5, label: '« 5・U Linh Chớm Nở »', perms: LV5_PERMS },
  { id: ROLE_IDS.LV15, label: '« 15・Linh Cáo Học Giả »', perms: LV15_PERMS },
  { id: ROLE_IDS.LV20, label: '« 20・ Linh Cáo Tinh Anh »', perms: LV20_PERMS },
  { id: ROLE_IDS.LV35, label: '« 35・Yêu Hồ Nguyệt Ảnh »', perms: LV35_PERMS },
  { id: ROLE_IDS.LV45, label: '« 45・Huyễn Linh Thú »', perms: LV45_PERMS },
  { id: ROLE_IDS.LV60, label: '« 60・Thiên Hồ Viễn Cổ »', perms: LV60_PERMS },
  { id: ROLE_IDS.LV80, label: '« 80・Chi Linh Thánh Đế »', perms: LV80_PERMS },
  { id: ROLE_IDS.LV100, label: '« 100・Hỗn Độn Chúa Tể »', perms: LV100_PERMS },
].map((spec) => ({
  ...spec,
  permissions: bits(...spec.perms),
}));

const GROUP_A_IDS = [
  '1516352432681128057', // #ngó-thui
  '1516359896164073512', // #thử-zàu-bíc
  '1475115713441300590', // #verify-here
  '1499486985138606200', // #hướng-dẫn-verify
];

const SANH_CHINH_ID = '1261184903505252382';
const INFO_CHANNEL_ID = '1488554410886959267';

const GROUP_B_SOURCE_IDS = [
  '1026096142175445072', // › CHATTING ‹
  SANH_CHINH_ID,         // #sảnh-chính
  '1461322166732587018', // #anime-roblox-game
  '1527309967328149645', // #clan
];

const GROUP_C_IDS = [
  '1033227438735507488', // #bot-cmds
  '1573622402359758878', // #tu-tiên-1
  '1573665501631226017', // #tu-tiên-ga
  '1481887232468979813', // #build-đội-hình
];

const GROUP_D_VOICE_IDS = [
  '1466392416389955658', // › SCREAM ZONE ‹
  '1466392418084720650', // ➕Tạo phòng riêng
  '1469688077286113353', // 🔊 Fox |
];
const GIAO_DIEN_VC_ID = '1466392419154268326';

const GROUP_B_LEGACY_REMOVE_IDS = new Set([
  ROLE_IDS.READ_RULES,
  ROLE_IDS.SINGULARITY_MANIFEST,
  ROLE_IDS.TRANSCENDENT_BEING,
  ROLE_IDS.THIEN_LINH_CAO,
  ROLE_IDS.LV60,
  ROLE_IDS.LV5,
  ROLE_IDS.LV15,
]);

const GROUP_C_REMOVE_IDS = new Set([
  ROLE_IDS.READ_RULES,
  ROLE_IDS.LV5,
  ROLE_IDS.LV15,
]);

function upsertOverwrite(list, entry) {
  const idx = list.findIndex((x) => x.id === entry.id && Number(x.type) === Number(entry.type));
  if (idx >= 0) {
    list[idx] = { id: entry.id, type: entry.type, allow: String(entry.allow), deny: String(entry.deny) };
  } else {
    list.push({ id: entry.id, type: entry.type, allow: String(entry.allow), deny: String(entry.deny) });
  }
}

function cleanEntry(ow) {
  return {
    id: String(ow.id),
    type: Number(ow.type),
    allow: String(ow.allow || '0'),
    deny: String(ow.deny || '0'),
  };
}

export function buildGroupAOverwrites(channel) {
  const list = (channel.permission_overwrites || []).map(cleanEntry);
  const existingEv = list.find((x) => x.id === GUILD_ID && x.type === 0);
  const historyBit = 1n << PERM_BITS.READ_MESSAGE_HISTORY;
  const newAllow = ((existingEv ? BigInt(existingEv.allow) : 0n) | historyBit).toString();
  const newDeny = ((existingEv ? BigInt(existingEv.deny) : 0n) & ~historyBit).toString();
  upsertOverwrite(list, { id: GUILD_ID, type: 0, allow: newAllow, deny: newDeny });
  return list;
}

export function buildGroupBOverwrites(channel) {
  const list = (channel.permission_overwrites || [])
    .filter((ow) => !(Number(ow.type) === 0 && GROUP_B_LEGACY_REMOVE_IDS.has(String(ow.id))))
    .map(cleanEntry);
  upsertOverwrite(list, { id: GUILD_ID, type: 0, allow: '0', deny: bits('VIEW_CHANNEL') });
  upsertOverwrite(list, { id: ROLE_IDS.BASE_SLAVE, type: 0, allow: bits('VIEW_CHANNEL'), deny: '0' });
  return list;
}

export function buildGroupCOverwrites(channel) {
  const list = (channel.permission_overwrites || [])
    .filter((ow) => {
      if (Number(ow.type) === 0 && GROUP_C_REMOVE_IDS.has(String(ow.id))) return false;
      if (String(ow.allow || '0') === '0' && String(ow.deny || '0') === '0') return false;
      return true;
    })
    .map(cleanEntry);
  upsertOverwrite(list, { id: GUILD_ID, type: 0, allow: '0', deny: bits('VIEW_CHANNEL') });
  upsertOverwrite(list, {
    id: ROLE_IDS.BASE_SLAVE,
    type: 0,
    allow: bits('VIEW_CHANNEL', 'ATTACH_FILES', 'EMBED_LINKS'),
    deny: '0',
  });
  return list;
}

export function buildGroupDOverwrites(channel, { readOnlyText = false } = {}) {
  const list = (channel.permission_overwrites || []).map(cleanEntry);
  upsertOverwrite(list, { id: GUILD_ID, type: 0, allow: '0', deny: bits('VIEW_CHANNEL') });
  if (readOnlyText) {
    upsertOverwrite(list, {
      id: ROLE_IDS.BASE_SLAVE,
      type: 0,
      allow: bits('VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'),
      deny: bits('SEND_MESSAGES'),
    });
  } else {
    upsertOverwrite(list, {
      id: ROLE_IDS.BASE_SLAVE,
      type: 0,
      allow: bits('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'USE_VAD', 'SEND_MESSAGES'),
      deny: '0',
    });
  }
  return list;
}

function normalizeOwForCompare(list) {
  return [...(list || [])]
    .map((ow) => `${ow.type}:${ow.id}:${BigInt(ow.allow || '0')}:${BigInt(ow.deny || '0')}`)
    .sort()
    .join('|');
}

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
  }
  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((res, rej) => {
      const id = this.nid++;
      const timer = setTimeout(() => {
        this.ws.off('message', handler);
        rej(new Error(`CDP call ${method} timed out`));
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
  async eval(expr, timeoutMs = 25000) {
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

async function discordProxy(cdp, { method, path: apiPath, bodyObj = null, auditReason = null }) {
  const headers = [{ key: 'Authorization', value: 'Bot {TOKEN_SECRET}' }];
  if (bodyObj !== null) headers.push({ key: 'Content-Type', value: 'application/json' });
  if (auditReason) headers.push({ key: 'X-Audit-Log-Reason', value: auditReason });

  const requestOptions = {
    method,
    url: `https://discord.com/api/v10${apiPath}`,
    headers,
    params: [],
    body: [],
    options: {
      excludeEmptyFields: true,
      replaceHeaders: true,
      ...(bodyObj !== null ? { replaceBody: true, bodyMode: 'raw', contentType: 'application/json', failOnError: false } : {}),
    },
  };
  if (bodyObj !== null) {
    requestOptions.rawBody = JSON.stringify(bodyObj);
    requestOptions.contentType = 'application/json';
  }

  const payload = JSON.stringify({ bot_id: BOT_ID, request_options: requestOptions });
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await cdp.eval(`(async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort('fetch_timeout'), 20000);
        try {
          const r = await fetch('/api/dashboard/test_api_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: ${JSON.stringify(payload)}
          });
          const text = await r.text();
          let j = {};
          try { j = JSON.parse(text); } catch { return { httpStatus: r.status, nonJson: text.slice(0, 200) }; }
          return { httpStatus: r.status, apiStatus: j?.api_data?.status, response: j?.api_data?.response };
        } finally {
          clearTimeout(t);
        }
      })()`, 25000);
    } catch (err) {
      console.warn(`[Retry ${attempt + 1}/3] ${method} ${apiPath}: ${err.message}`);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
    if ((res?.apiStatus === 429 || (res?.httpStatus >= 500 && res?.httpStatus < 600)) && attempt < 2) {
      const retrySec = Number(res?.response?.retry_after || 2);
      console.warn(`[RateLimit/5xx ${attempt + 1}/3] ${method} ${apiPath}: waiting ${retrySec}s`);
      await new Promise((r) => setTimeout(r, Math.ceil((retrySec + 0.4) * 1000)));
      continue;
    }
    return res;
  }
  throw new Error(`Exceeded retries on ${method} ${apiPath}`);
}

async function ensureBotGhostAwake(cdp) {
  await cdp.send('Page.bringToFront', {});
  await new Promise((r) => setTimeout(r, 300));
  const probe = async () => cdp.eval(`(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort('probe_timeout'), 6000);
    try {
      const r = await fetch(location.pathname || '/', { cache: 'no-store', signal: ctrl.signal });
      return { ok: r.status >= 200 && r.status < 400, status: r.status, hidden: document.hidden };
    } finally {
      clearTimeout(t);
    }
  })()`, 8000);

  let p;
  try {
    p = await probe();
    console.log('[Probe]', JSON.stringify(p));
    if (p?.ok) return;
  } catch (err) {
    console.warn('[Probe stalled, reloading tab]', err.message);
  }

  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 4500));
  await cdp.send('Page.bringToFront', {});
  await new Promise((r) => setTimeout(r, 300));
  const p2 = await probe();
  console.log('[Probe after reload]', JSON.stringify(p2));
  if (!p2?.ok) {
    throw new Error(`BotGhost session unhealthy after reload: ${JSON.stringify(p2)}`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const paceMs = 380;

  const tabs = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const bgTab = tabs.find((t) => t.type === 'page' && t.url && t.url.includes('botghost.com'));
  if (!bgTab) throw new Error('No BotGhost tab found on Edge CDP 9222');
  console.log(`[CDP] Connecting to ${bgTab.url}`);

  const cdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await cdp.connect();
  try {
    await ensureBotGhostAwake(cdp);
    console.log('[1/2] Fetching live Discord roles...');
    const rolesRes = await discordProxy(cdp, { method: 'GET', path: `/guilds/${GUILD_ID}/roles` });
    console.log('[2/2] Fetching live Discord channels...');
    const channelsRes = await discordProxy(cdp, { method: 'GET', path: `/guilds/${GUILD_ID}/channels` });
    if (rolesRes?.apiStatus !== 200 || !Array.isArray(rolesRes.response)) {
      throw new Error(`Failed GET roles: ${JSON.stringify(rolesRes)}`);
    }
    if (channelsRes?.apiStatus !== 200 || !Array.isArray(channelsRes.response)) {
      throw new Error(`Failed GET channels: ${JSON.stringify(channelsRes)}`);
    }

    const roles = rolesRes.response;
    const channels = channelsRes.response;
    const roleById = Object.fromEntries(roles.map((r) => [r.id, r]));
    const chById = Object.fromEntries(channels.map((c) => [c.id, c]));

    // Ensure full backup is saved before ANY mutation
    fs.mkdirSync(path.dirname(DEFAULT_BACKUP_PATH), { recursive: true });
    fs.writeFileSync(
      DEFAULT_BACKUP_PATH,
      JSON.stringify({ capturedAt: new Date().toISOString(), guildId: GUILD_ID, roles, channels }, null, 2),
      'utf8',
    );
    console.log(`[Backup Saved] ${roles.length} roles, ${channels.length} channels -> ${DEFAULT_BACKUP_PATH}`);

    // Build role update plan
    const rolePlans = TARGET_ROLE_SPECS.map((spec) => {
      const live = roleById[spec.id];
      if (!live) throw new Error(`Missing role ${spec.id} (${spec.label})`);
      return {
        ...spec,
        currentPermissions: String(live.permissions),
        changed: String(live.permissions) !== spec.permissions,
      };
    });

    // Build 17 channel plans
    const channelPlans = [];
    for (const cid of GROUP_A_IDS) {
      const ch = chById[cid];
      if (!ch) throw new Error(`Missing Group A channel ${cid}`);
      const nextOw = buildGroupAOverwrites(ch);
      channelPlans.push({ id: cid, name: ch.name, group: 'A', nextOw, currentOw: ch.permission_overwrites || [] });
    }

    let cleanedSanhChinhOw = null;
    for (const cid of GROUP_B_SOURCE_IDS) {
      const ch = chById[cid];
      if (!ch) throw new Error(`Missing Group B channel ${cid}`);
      const nextOw = buildGroupBOverwrites(ch);
      if (cid === SANH_CHINH_ID) cleanedSanhChinhOw = nextOw.map(cleanEntry);
      channelPlans.push({ id: cid, name: ch.name, group: 'B', nextOw, currentOw: ch.permission_overwrites || [] });
    }

    const infoCh = chById[INFO_CHANNEL_ID];
    if (!infoCh || !cleanedSanhChinhOw) throw new Error(`Missing #info (${INFO_CHANNEL_ID}) or #sảnh-chính template`);
    channelPlans.push({
      id: INFO_CHANNEL_ID,
      name: infoCh.name,
      group: 'B-info-clone',
      nextOw: cleanedSanhChinhOw.map(cleanEntry),
      currentOw: infoCh.permission_overwrites || [],
    });

    for (const cid of GROUP_C_IDS) {
      const ch = chById[cid];
      if (!ch) throw new Error(`Missing Group C channel ${cid}`);
      const nextOw = buildGroupCOverwrites(ch);
      channelPlans.push({ id: cid, name: ch.name, group: 'C', nextOw, currentOw: ch.permission_overwrites || [] });
    }

    for (const cid of GROUP_D_VOICE_IDS) {
      const ch = chById[cid];
      if (!ch) throw new Error(`Missing Group D channel ${cid}`);
      const nextOw = buildGroupDOverwrites(ch, { readOnlyText: false });
      channelPlans.push({ id: cid, name: ch.name, group: 'D', nextOw, currentOw: ch.permission_overwrites || [] });
    }

    const giaoDienVc = chById[GIAO_DIEN_VC_ID];
    if (!giaoDienVc) throw new Error(`Missing #giao-diện-vc (${GIAO_DIEN_VC_ID})`);
    channelPlans.push({
      id: GIAO_DIEN_VC_ID,
      name: giaoDienVc.name,
      group: 'D-readonly',
      nextOw: buildGroupDOverwrites(giaoDienVc, { readOnlyText: true }),
      currentOw: giaoDienVc.permission_overwrites || [],
    });

    console.log(`\n=== PLAN SUMMARY (${dryRun ? 'DRY RUN' : 'LIVE APPLY'}) ===`);
    console.log(`Roles (${rolePlans.length}):`);
    for (const rp of rolePlans) {
      console.log(` - ${rp.label} (${rp.id}): ${rp.currentPermissions} -> ${rp.permissions} [${rp.perms.length} bits]`);
    }
    console.log(`Channels (${channelPlans.length}):`);
    for (const cp of channelPlans) {
      console.log(` - [${cp.group}] ${cp.name} (${cp.id}): ${cp.currentOw.length} -> ${cp.nextOw.length} overwrites`);
    }

    if (dryRun) {
      console.log('\n[DryRun] Finished inspection cleanly without writing any changes.');
      return;
    }

    // Apply 11 Roles
    let roleOk = 0;
    for (const rp of rolePlans) {
      const res = await discordProxy(cdp, {
        method: 'PATCH',
        path: `/guilds/${GUILD_ID}/roles/${rp.id}`,
        bodyObj: { permissions: rp.permissions },
        auditReason: 'SuMi v1.4.5 Discord Permissions Standardization (Roles)',
      });
      const ok = res?.apiStatus === 200 && String(res?.response?.permissions) === rp.permissions;
      if (!ok) {
        throw new Error(`Role PATCH failed for ${rp.label} (${rp.id}): ${JSON.stringify(res)}`);
      }
      roleOk += 1;
      console.log(`[Role ${roleOk}/${rolePlans.length} OK] ${rp.label} (${rp.id}) -> perms=${rp.permissions}`);
      await new Promise((r) => setTimeout(r, paceMs));
    }

    // Apply 17 Channels
    let chOk = 0;
    for (const cp of channelPlans) {
      const res = await discordProxy(cdp, {
        method: 'PATCH',
        path: `/channels/${cp.id}`,
        bodyObj: { permission_overwrites: cp.nextOw },
        auditReason: 'SuMi v1.4.5 Discord Permissions Standardization (Channels)',
      });
      const ok = res?.apiStatus === 200
        && normalizeOwForCompare(res?.response?.permission_overwrites) === normalizeOwForCompare(cp.nextOw);
      if (!ok) {
        throw new Error(`Channel PATCH failed for ${cp.name} (${cp.id}): ${JSON.stringify(res)}`);
      }
      chOk += 1;
      console.log(`[Channel ${chOk}/${channelPlans.length} OK] [${cp.group}] ${cp.name} (${cp.id}) -> ${cp.nextOw.length} overwrites`);
      await new Promise((r) => setTimeout(r, paceMs));
    }

    // Post-Apply Re-fetch Verification
    await new Promise((r) => setTimeout(r, 500));
    const verifyRolesRes = await discordProxy(cdp, { method: 'GET', path: `/guilds/${GUILD_ID}/roles` });
    const verifyChRes = await discordProxy(cdp, { method: 'GET', path: `/guilds/${GUILD_ID}/channels` });
    const vRoleById = Object.fromEntries((verifyRolesRes.response || []).map((r) => [r.id, r]));
    const vChById = Object.fromEntries((verifyChRes.response || []).map((c) => [c.id, c]));

    const mismatches = [];
    for (const rp of rolePlans) {
      const livePerms = String(vRoleById[rp.id]?.permissions);
      if (livePerms !== rp.permissions) mismatches.push(`Role ${rp.label}: expected ${rp.permissions}, got ${livePerms}`);
    }
    for (const cp of channelPlans) {
      const liveNorm = normalizeOwForCompare(vChById[cp.id]?.permission_overwrites);
      const expNorm = normalizeOwForCompare(cp.nextOw);
      if (liveNorm !== expNorm) mismatches.push(`Channel ${cp.name} (${cp.id}): overwrite mismatch`);
    }

    // Guardrail assertions: ✦ Staff Bot Roles ✦ ADMIN & 19 gradients intact & #info == #sảnh-chính
    const beforeGradients = roles.filter((r) => r.colors?.secondary_color !== null && r.colors?.secondary_color !== undefined).map((r) => r.id).sort();
    const staffSepAdmin = (BigInt(vRoleById[ROLE_IDS.STAFF_BOT_SEP]?.permissions || '0') & (1n << 3n)) !== 0n;
    const gradientRoles = (verifyRolesRes.response || []).filter((r) => r.colors?.secondary_color !== null && r.colors?.secondary_color !== undefined);
    const afterGradients = gradientRoles.map((r) => r.id).sort();
    const gradientsPreserved = JSON.stringify(beforeGradients) === JSON.stringify(afterGradients) && gradientRoles.length >= 19;
    const infoMatchesSanhChinh =
      normalizeOwForCompare(vChById[INFO_CHANNEL_ID]?.permission_overwrites) ===
      normalizeOwForCompare(vChById[SANH_CHINH_ID]?.permission_overwrites);

    console.log('\n=== POST-APPLY VERIFICATION ===');
    console.log(`Roles matched: ${rolePlans.length - mismatches.filter((m) => m.startsWith('Role')).length}/${rolePlans.length}`);
    console.log(`Channels matched: ${channelPlans.length - mismatches.filter((m) => m.startsWith('Channel')).length}/${channelPlans.length}`);
    console.log(`✦ Staff Bot Roles ✦ keeps ADMIN: ${staffSepAdmin}`);
    console.log(`2-color Gradient Roles preserved: ${gradientRoles.length} (exact match=${gradientsPreserved})`);
    console.log(`#info == #sảnh-chính exact match: ${infoMatchesSanhChinh}`);

    if (mismatches.length || !staffSepAdmin || !gradientsPreserved || !infoMatchesSanhChinh) {
      throw new Error(`Post-apply verification failed: ${JSON.stringify({ mismatches, staffSepAdmin, beforeGradients: beforeGradients.length, afterGradients: afterGradients.length, infoMatchesSanhChinh })}`);
    }

    console.log('\nALL DISCORD ROLES (11/11) & CHANNELS (17/17) STANDARDIZED & VERIFIED!');
  } finally {
    cdp.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  main().catch((err) => {
    console.error('[apply_v1_4_5_discord_perms] FATAL:', err);
    process.exit(1);
  });
}
