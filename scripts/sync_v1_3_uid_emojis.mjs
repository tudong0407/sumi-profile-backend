/**
 * scripts/sync_v1_3_uid_emojis.mjs
 * Giai đoạn 1 v1.3:
 * 1. Copy toàn bộ 242 file (237 PNG + 5 GIF) từ D:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_3_237_PNG_5_GIF
 *    vào đúng thư mục assets/ (pets/, items/, domains/, minigames/, farm/).
 * 2. Đổi tên toàn bộ 117 Discord App Emojis hiện có (su_pet_*, su_weapon_*, su_gem_*, su_soul_*, su_fox_mascot, consumables, rings)
 *    sang chính xác UID của thực thể tương ứng qua BotGhost CDP.
 * 3. Upload 237 Discord App Emojis mới của v1.3 (giữ nguyên GIF động gốc cho 5 Animated GIF; resize 128x128 cho 232 PNG).
 * 4. Cập nhật đồng bộ 100% src/config/custom_emojis.json từ danh sách live trên Discord API.
 *
 * Idempotent: an toàn khi chạy lại (tự bỏ qua emoji đã đúng tên/đã tồn tại và tự chờ retry_after khi gặp 429).
 */

import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PET_CATALOG, EQUIPMENT_CATALOG } from '../src/data/catalog.js';
import {
  V13_DOMAINS,
  V13_DIVINE_SENSES,
  V13_DIVINE_REALMS,
  V13_NEW_PETS,
  V13_NEW_EQUIPMENT,
  V13_MINIGAME_EMOJI_PROMPTS,
  V13_FARM_ASSETS,
} from '../src/data/v13ExpansionCatalog.js';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const SRC_ROOT = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_3_237_PNG_5_GIF';
const BACKEND_ASSETS = path.resolve('assets');
const OUTPUT_JSON = path.resolve('src/config/custom_emojis.json');

const MANUAL_RENAME_MAP = {
  su_fox_mascot: 'cuu_vi_hong_ho',
  su_frame_token: 'frame_unlock_token',
  su_enchant_stone: 'enchant_stone',
  su_star_stone: 'pet_star_stone',
  su_ticket_equip: 'gacha_ticket_equip',
  su_ticket_pet: 'gacha_ticket_pet',
  su_tower_reset_card: 'tower_reset_card',
  su_title_card: 'title_rename_card',
  su_ring_pham: 'ring_common',
  su_ring_linh: 'ring_rare',
  su_ring_tien: 'ring_epic',
  su_ring_thanthoai: 'ring_mythic',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildSourceFileIndex(rootDir) {
  const index = new Map();
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else {
        const ext = path.extname(ent.name).toLowerCase();
        const base = path.basename(ent.name, ext).toLowerCase();
        if (!index.has(base)) index.set(base, {});
        index.get(base)[ext] = full;
      }
    }
  }
  walk(rootDir);
  return index;
}

function copyAssetsToBackend(srcIndex) {
  const dirs = ['pets', 'items', 'domains', 'minigames', 'farm'];
  for (const d of dirs) {
    fs.mkdirSync(path.join(BACKEND_ASSETS, d), { recursive: true });
  }

  let copied = 0;
  const tasks = [];

  for (const p of V13_NEW_PETS) {
    const entry = srcIndex.get(p.pet_type);
    if (!entry?.['.png']) throw new Error(`Missing pet PNG: ${p.pet_type}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'pets', `${p.pet_type}.png`));
    copied += 1;
    tasks.push({ name: p.pet_type, animated: false, srcPath: entry['.png'] });
  }

  for (const eq of V13_NEW_EQUIPMENT) {
    const entry = srcIndex.get(eq.item_id);
    if (!entry?.['.png']) throw new Error(`Missing equip PNG: ${eq.item_id}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'items', `${eq.item_id}.png`));
    copied += 1;
    tasks.push({ name: eq.item_id, animated: false, srcPath: entry['.png'] });
  }

  for (const d of V13_DOMAINS) {
    const entry = srcIndex.get(d.domain_id);
    if (!entry?.['.png']) throw new Error(`Missing domain PNG: ${d.domain_id}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'domains', `${d.domain_id}.png`));
    copied += 1;
    tasks.push({ name: d.domain_id, animated: false, srcPath: entry['.png'] });
  }

  for (const s of V13_DIVINE_SENSES) {
    const entry = srcIndex.get(s.sense_id);
    if (!entry?.['.png']) throw new Error(`Missing sense PNG: ${s.sense_id}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'domains', `${s.sense_id}.png`));
    copied += 1;
    tasks.push({ name: s.sense_id, animated: false, srcPath: entry['.png'] });
  }

  for (const r of V13_DIVINE_REALMS) {
    const entry = srcIndex.get(r.realm_id);
    if (!entry?.['.png']) throw new Error(`Missing realm PNG: ${r.realm_id}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'domains', `${r.realm_id}.png`));
    copied += 1;
    tasks.push({ name: r.realm_id, animated: false, srcPath: entry['.png'] });
  }

  for (const mg of V13_MINIGAME_EMOJI_PROMPTS) {
    const entry = srcIndex.get(mg.uid);
    const expectGif = /Animated GIF/i.test(mg.type);
    if (entry?.['.png']) {
      fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'minigames', `${mg.uid}.png`));
      copied += 1;
    }
    if (expectGif) {
      if (!entry?.['.gif']) throw new Error(`Missing animated GIF for minigame: ${mg.uid}`);
      fs.copyFileSync(entry['.gif'], path.join(BACKEND_ASSETS, 'minigames', `${mg.uid}.gif`));
      copied += 1;
      tasks.push({ name: mg.uid, animated: true, srcPath: entry['.gif'], fallbackPng: entry['.png'] });
    } else {
      if (!entry?.['.png']) throw new Error(`Missing PNG for minigame: ${mg.uid}`);
      tasks.push({ name: mg.uid, animated: false, srcPath: entry['.png'] });
    }
  }

  for (const f of V13_FARM_ASSETS) {
    const entry = srcIndex.get(f.uid);
    if (!entry?.['.png']) throw new Error(`Missing farm PNG: ${f.uid}`);
    fs.copyFileSync(entry['.png'], path.join(BACKEND_ASSETS, 'farm', `${f.uid}.png`));
    copied += 1;
    tasks.push({ name: f.uid, animated: false, srcPath: entry['.png'] });
  }

  return { copied, tasks };
}

class SimpleCdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nid = 1;
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('WS connect timeout')), 15000);
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
  async eval(expr, timeoutMs = 45000) {
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

async function listAppEmojisViaBotGhost(cdp) {
  const res = await cdp.eval(`(async () => {
    const appRes = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: '${BOT_ID}',
        request_options: {
          method: 'GET',
          url: 'https://discord.com/api/v10/applications/${BOT_ID}/emojis',
          headers: [
            { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
            { key: 'Content-Type', value: 'application/json' }
          ]
        }
      })
    });
    const appData = await appRes.json();
    return { httpStatus: appRes.status, apiStatus: appData?.api_data?.status, items: appData?.api_data?.response?.items || [], raw: appData };
  })()`);
  if (res.httpStatus !== 200) {
    throw new Error(`BotGhost list emojis failed: HTTP ${res.httpStatus} ${JSON.stringify(res.raw)}`);
  }
  return res.items;
}

async function callDiscordEmojiMutation(cdp, method, urlPath, bodyPairs) {
  const payload = JSON.stringify({
    bot_id: BOT_ID,
    request_options: {
      method,
      url: `https://discord.com/api/v10${urlPath}`,
      headers: [
        { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      body: bodyPairs,
      contentType: 'application/json',
      options: {
        bodyMode: 'form',
        contentType: 'application/json',
        replaceHeaders: true,
        replaceBody: true,
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
    return { httpStatus: r.status, apiStatus: j?.api_data?.status, response: j?.api_data?.response, message: j?.message || j?.error };
  })()`, 30000);
}

async function resizePngToDataUri(pngPath, size = 128) {
  const img = await loadImage(pngPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const buf = canvas.toBuffer('image/png');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function executeWithRetry(fn, label) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const res = await fn();
    if (res.response?.id) return res.response;
    const retrySec = Number(res.response?.retry_after || 0);
    if (res.apiStatus === 429 || res.httpStatus === 429 || retrySec > 0) {
      const waitMs = Math.max(1500, Math.ceil((retrySec || 2.5) * 1000) + 600);
      console.warn(`[429] ${label} waiting ${waitMs}ms (attempt ${attempt}/6)...`);
      await sleep(waitMs);
      continue;
    }
    if (attempt < 3 && (res.httpStatus >= 500 || res.apiStatus >= 500)) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`Discord emoji mutation failed for ${label}: ${JSON.stringify(res)}`);
  }
  throw new Error(`Exhausted retries for ${label}`);
}

function buildRenameTargets(existingItems) {
  const petSet = new Set(PET_CATALOG.map((p) => p.pet_type));
  const eqSet = new Set(EQUIPMENT_CATALOG.map((e) => e.item_id));
  const byName = new Map(existingItems.map((e) => [e.name, e]));
  const tasks = [];

  for (const e of existingItems) {
    let targetName = null;
    if (MANUAL_RENAME_MAP[e.name]) {
      targetName = MANUAL_RENAME_MAP[e.name];
    } else if (e.name.startsWith('su_pet_') && petSet.has(e.name.slice(7))) {
      targetName = e.name.slice(7);
    } else if (e.name.startsWith('su_') && eqSet.has(e.name.slice(3))) {
      targetName = e.name.slice(3);
    }
    if (targetName && targetName !== e.name && !byName.has(targetName)) {
      tasks.push({ id: e.id, oldName: e.name, newName: targetName });
    }
  }
  return tasks;
}

async function main() {
  const copyOnly = process.argv.includes('--copy-only');
  console.log('[v1.3 Emoji Sync] Scanning source assets...');
  const srcIndex = buildSourceFileIndex(SRC_ROOT);
  const { copied, tasks: uploadTasks } = copyAssetsToBackend(srcIndex);
  console.log(`[v1.3 Emoji Sync] Copied ${copied} files into assets/. Prepared ${uploadTasks.length} new v1.3 emoji specs.`);

  if (copyOnly) return;

  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const bgTab = tabs.find((t) => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) throw new Error('BotGhost tab not found on CDP 9222');

  const cdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await cdp.connect();

  try {
    const existingItems = await listAppEmojisViaBotGhost(cdp);
    console.log(`[v1.3 Emoji Sync] Found ${existingItems.length} existing Discord App Emojis.`);

    const renameTasks = buildRenameTargets(existingItems);
    console.log(`[v1.3 Emoji Sync] Renaming ${renameTasks.length} legacy emojis to exact UIDs...`);
    for (let i = 0; i < renameTasks.length; i += 1) {
      const rt = renameTasks[i];
      if (i > 0) await sleep(550);
      const updated = await executeWithRetry(
        () => callDiscordEmojiMutation(cdp, 'PATCH', `/applications/${BOT_ID}/emojis/${rt.id}`, [
          { key: 'name', value: rt.newName },
        ]),
        `PATCH ${rt.oldName} -> ${rt.newName}`,
      );
      console.log(`[Rename ${i + 1}/${renameTasks.length}] ${rt.oldName} -> ${updated.name} (${updated.id})`);
    }

    const afterRename = renameTasks.length > 0 ? await listAppEmojisViaBotGhost(cdp) : existingItems;
    const liveNames = new Set(afterRename.map((e) => e.name));
    const missingUploads = uploadTasks.filter((t) => !liveNames.has(t.name));
    console.log(`[v1.3 Emoji Sync] Uploading ${missingUploads.length} new v1.3 emojis (${uploadTasks.length - missingUploads.length} already present)...`);

    for (let i = 0; i < missingUploads.length; i += 1) {
      const u = missingUploads[i];
      if (i > 0) await sleep(650);
      const dataUri = u.animated
        ? `data:image/gif;base64,${fs.readFileSync(u.srcPath).toString('base64')}`
        : await resizePngToDataUri(u.srcPath, 128);

      let uploaded;
      try {
        uploaded = await executeWithRetry(
          () => callDiscordEmojiMutation(cdp, 'POST', `/applications/${BOT_ID}/emojis`, [
            { key: 'name', value: u.name },
            { key: 'image', value: dataUri },
          ]),
          `POST ${u.name}`,
        );
      } catch (err) {
        if (u.animated && u.fallbackPng && fs.existsSync(u.fallbackPng)) {
          console.warn(`[Fallback PNG] ${u.name} GIF rejected (${err.message}); retrying 128x128 PNG`);
          const pngUri = await resizePngToDataUri(u.fallbackPng, 128);
          await sleep(800);
          uploaded = await executeWithRetry(
            () => callDiscordEmojiMutation(cdp, 'POST', `/applications/${BOT_ID}/emojis`, [
              { key: 'name', value: u.name },
              { key: 'image', value: pngUri },
            ]),
            `POST ${u.name} (PNG fallback)`,
          );
        } else {
          throw err;
        }
      }
      if ((i + 1) % 20 === 0 || i === missingUploads.length - 1) {
        console.log(`[Upload ${i + 1}/${missingUploads.length}] Latest: ${uploaded.name} -> ${uploaded.id} (animated=${uploaded.animated})`);
      }
    }

    const finalList = await listAppEmojisViaBotGhost(cdp);
    const outMap = {};
    const sorted = [...finalList].sort((a, b) => a.name.localeCompare(b.name));
    for (const e of sorted) {
      const anim = Boolean(e.animated);
      outMap[e.name] = {
        id: e.id,
        name: e.name,
        animated: anim,
        tag: anim ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
      };
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outMap, null, 2), 'utf8');
    console.log(`[v1.3 Emoji Sync] COMPLETE! Synced ${Object.keys(outMap).length} live Discord emojis -> ${OUTPUT_JSON}`);
  } finally {
    cdp.close();
  }
}

main().catch((err) => {
  console.error('[v1.3 Emoji Sync] ERROR:', err);
  process.exit(1);
});
