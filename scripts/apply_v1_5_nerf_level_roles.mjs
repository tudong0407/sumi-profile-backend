/**
 * scripts/apply_v1_5_nerf_level_roles.mjs
 * Nerf âm thầm quyền Discord của 8 Role Cấp Độ (Lv.5 -> Lv.100) để khuyến khích /roll loai:role:
 * - Giữ nguyên 100% buff trong game (% EXP / LT / Pet).
 * - Mỗi mốc chỉ mở thêm tối đa 1 quyền cơ bản (kế thừa các quyền cơ bản bên dưới), thu hồi toàn bộ quyền VIP/Mod.
 * - Tuyệt đối KHÔNG chạm 40 Role Quyền Năng, Staff/Mod (pos >= 137), @everyone, hay Nô lệ.
 * - KHÔNG ghi vào /updates.
 *
 * Usage:
 *   node scripts/apply_v1_5_nerf_level_roles.mjs           (mặc định --dry-run)
 *   node scripts/apply_v1_5_nerf_level_roles.mjs --apply   (backup JSON trước rồi PATCH qua Edge CDP 9222)
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const GUILD_ID = '1026096141273661450';

const DEFAULT_BACKUP_PATH =
  'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\scratch\\discord_level_roles_backup_before_v1_5.json';

const PERM_BITS = {
  ATTACH_FILES: 15n,
  USE_EXTERNAL_EMOJIS: 18n,
  EMBED_LINKS: 14n,
  STREAM: 9n,
  USE_EXTERNAL_STICKERS: 37n,
  SEND_VOICE_MESSAGES: 46n,
  USE_SOUNDBOARD: 42n,
  USE_EXTERNAL_SOUNDS: 45n,
};

export function bits(...names) {
  let mask = 0n;
  for (const name of names) {
    if (!(name in PERM_BITS)) throw new Error(`Unknown permission bit name: ${name}`);
    mask |= 1n << PERM_BITS[name];
  }
  return mask.toString();
}

const LV5_PERMS = ['ATTACH_FILES'];
const LV15_PERMS = [...LV5_PERMS, 'USE_EXTERNAL_EMOJIS'];
const LV20_PERMS = [...LV15_PERMS, 'EMBED_LINKS'];
const LV35_PERMS = [...LV20_PERMS, 'STREAM'];
const LV45_PERMS = [...LV35_PERMS, 'USE_EXTERNAL_STICKERS'];
const LV60_PERMS = [...LV45_PERMS, 'SEND_VOICE_MESSAGES'];
const LV80_PERMS = [...LV60_PERMS, 'USE_SOUNDBOARD'];
const LV100_PERMS = [...LV80_PERMS, 'USE_EXTERNAL_SOUNDS'];

export const LEVEL_ROLE_NERF_SPECS = [
  { id: '1038406122417176586', level: 5, label: '« 5・U Linh Chớm Nở »', addedPerm: 'ATTACH_FILES', perms: LV5_PERMS },
  { id: '1038405196662976562', level: 15, label: '« 15・Linh Cáo Học Giả »', addedPerm: 'USE_EXTERNAL_EMOJIS', perms: LV15_PERMS },
  { id: '1032988544874061836', level: 20, label: '« 20・ Linh Cáo Tinh Anh »', addedPerm: 'EMBED_LINKS', perms: LV20_PERMS },
  { id: '1375446293119369331', level: 35, label: '« 35・Yêu Hồ Nguyệt Ảnh »', addedPerm: 'STREAM', perms: LV35_PERMS },
  { id: '1375451249952161903', level: 45, label: '« 45・Huyễn Linh Thú »', addedPerm: 'USE_EXTERNAL_STICKERS', perms: LV45_PERMS },
  { id: '1375446809408962620', level: 60, label: '« 60・Thiên Hồ Viễn Cổ »', addedPerm: 'SEND_VOICE_MESSAGES', perms: LV60_PERMS },
  { id: '1473419954379554967', level: 80, label: '« 80・Chi Linh Thánh Đế »', addedPerm: 'USE_SOUNDBOARD', perms: LV80_PERMS },
  { id: '1473419957655175169', level: 100, label: '« 100・Hỗn Độn Chúa Tể »', addedPerm: 'USE_EXTERNAL_SOUNDS', perms: LV100_PERMS },
].map((spec) => ({
  ...spec,
  permissions: bits(...spec.perms),
}));

// Bảo toàn tuyệt đối Staff/Mod (>= 137) & Role Quyền Năng
const FORBIDDEN_ROLE_IDS = new Set([
  GUILD_ID,
  '1487172968105640069',
  '1468649836856344689',
  '1519354498412314785',
  '1521913861660344320',
  '1027173664069795921',
  '1026099349689741322',
]);

for (const s of LEVEL_ROLE_NERF_SPECS) {
  if (FORBIDDEN_ROLE_IDS.has(s.id)) {
    throw new Error(`Safety violation: forbidden role ${s.id} in LEVEL_ROLE_NERF_SPECS`);
  }
}

async function openCdpOnBotGhost() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const tab = tabs.find((t) => String(t.url || '').includes('botghost.com/dashboard'))
    || tabs.find((t) => String(t.url || '').includes('botghost.com'));
  if (!tab?.webSocketDebuggerUrl) {
    throw new Error('Could not find open BotGhost tab on Edge CDP 9222.');
  }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('CDP WS timeout')), 10000);
    ws.on('open', () => { clearTimeout(t); resolve(); });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });
  let seq = 1;
  const evalJs = async (expression) => {
    const id = seq++;
    return new Promise((resolve, reject) => {
      const handler = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result?.result?.value);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  };
  return { ws, evalJs };
}

function sendCdp(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1e6) + 10000;
    const h = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log('=== Ver 1.5 Silent Level Role Nerf (8 Roles: Lv.5 -> Lv.100) ===');
  for (const s of LEVEL_ROLE_NERF_SPECS) {
    console.log(`- Lv.${String(s.level).padStart(3)} (${s.id}) ${s.label} | +${s.addedPerm} | perms=${s.perms.length} | mask=${s.permissions}`);
  }

  if (!isApply) {
    console.log('\n[DRY-RUN] Verified 8 Level Role specs & safety guards. Pass --apply in Phase 2 to execute.');
    return;
  }

  const { ws, evalJs } = await openCdpOnBotGhost();
  await sendCdp(ws, 'Page.bringToFront');

  const discordProxy = async (method, apiPath, bodyObj = null) => {
    const headers = [{ key: 'Authorization', value: 'Bot {TOKEN_SECRET}' }];
    if (bodyObj !== null) headers.push({ key: 'Content-Type', value: 'application/json' });
    const reqOpts = {
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
      reqOpts.rawBody = JSON.stringify(bodyObj);
      reqOpts.contentType = 'application/json';
    }
    const payload = JSON.stringify({ bot_id: BOT_ID, request_options: reqOpts });
    const res = await evalJs(`(async () => {
      const r = await fetch('/api/dashboard/test_api_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ${JSON.stringify(payload)}
      });
      const j = await r.json().catch(() => ({}));
      return { httpStatus: r.status, apiStatus: j?.api_data?.status, response: j?.api_data?.response };
    })()`);
    return res;
  };

  try {
    const rolesRes = await discordProxy('GET', `/guilds/${GUILD_ID}/roles`);
    const allRoles = rolesRes?.response;
    if (!Array.isArray(allRoles)) {
      throw new Error(`Failed to fetch guild roles via BotGhost proxy: ${JSON.stringify(rolesRes)}`);
    }
    const byId = new Map(allRoles.map((r) => [String(r.id), r]));

    fs.mkdirSync(path.dirname(DEFAULT_BACKUP_PATH), { recursive: true });
    const backup = LEVEL_ROLE_NERF_SPECS.map((s) => ({
      ...s,
      before: byId.get(s.id) || null,
    }));
    fs.writeFileSync(DEFAULT_BACKUP_PATH, JSON.stringify({ created_at: new Date().toISOString(), roles: backup }, null, 2), 'utf8');
    console.log(`[APPLY] Saved backup to ${DEFAULT_BACKUP_PATH}`);

    for (const s of LEVEL_ROLE_NERF_SPECS) {
      const existing = byId.get(s.id);
      if (!existing) throw new Error(`Role not found in guild: ${s.id}`);
      if (Number(existing.position) >= 137) {
        throw new Error(`Safety abort: role ${s.id} has position ${existing.position} >= 137`);
      }
      const patchOut = await discordProxy('PATCH', `/guilds/${GUILD_ID}/roles/${s.id}`, { permissions: s.permissions });
      console.log(`[PATCH] Lv.${s.level} (${s.id}): http=${patchOut?.httpStatus} api=${patchOut?.apiStatus}`);
      if (!patchOut || patchOut.httpStatus >= 400 || patchOut.apiStatus >= 400) {
        throw new Error(`PATCH failed for ${s.id}: ${JSON.stringify(patchOut)}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    console.log('[APPLY] Completed silent nerf of all 8 Level Roles!');
  } finally {
    ws.close();
  }
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]).replace(/\\/g, '/'));
if (isDirectRun || process.argv[1]?.includes('apply_v1_5_nerf_level_roles.mjs')) {
  main().catch((err) => {
    console.error('[apply_v1_5_nerf_level_roles] FAILED:', err);
    process.exit(1);
  });
}
