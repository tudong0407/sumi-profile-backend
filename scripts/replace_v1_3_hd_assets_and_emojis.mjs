/**
 * scripts/replace_v1_3_hd_assets_and_emojis.mjs
 * 1. Copy toàn bộ 242 file HD 512x512 (237 PNG + 5 GIF) từ:
 *    D:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_3_HD_512_237PNG_5GIF
 *    ghi đè vào đúng vị trí trong assets/ (pets/, pets/icons/, items/, domains/, minigames/, farm/).
 * 2. Chuẩn hóa dưới ngưỡng 256 KB cho Discord Emoji (160px/128px PNG + 5 GIF nén sẵn từ scratch/v13_emoji_gifs).
 * 3. Thay thế (DELETE + POST) toàn bộ 237 Discord App Emojis của v1.3 qua BotGhost CDP Proxy,
 *    ghi src/config/custom_emojis.json mới và lưu bảng ánh xạ oldId -> newId để cập nhật BotGhost flows.
 * Idempotent & hỗ trợ resume: bỏ qua emoji đã đổi ID so với snapshot trước migration.
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const SRC_ROOT = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_3_HD_512_237PNG_5GIF';
const COMPRESSED_GIF_DIR = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/v13_emoji_gifs';
const SCRATCH_DIR = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch';
const PRE_SNAPSHOT_PATH = `${SCRATCH_DIR}/custom_emojis_before_v147.json`;
const REMAP_PATH = `${SCRATCH_DIR}/emoji_id_remap_v147.json`;

const ASSETS_ROOT = path.resolve('assets');
const EMOJI_JSON_PATH = path.resolve('src/config/custom_emojis.json');

const MAX_EMOJI_BYTES = 248 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function walkFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function replaceLocalAssets() {
  const hdFiles = walkFiles(SRC_ROOT);
  const existingAssets = walkFiles(ASSETS_ROOT);
  const targetByBase = new Map();
  for (const ap of existingAssets) {
    const b = path.basename(ap);
    if (!targetByBase.has(b)) targetByBase.set(b, []);
    targetByBase.get(b).push(ap);
  }

  let copiedTargets = 0;
  const emojiByName = new Map();

  for (const srcPath of hdFiles) {
    const base = path.basename(srcPath);
    const ext = path.extname(srcPath).toLowerCase();
    const stem = path.basename(srcPath, ext);
    const targets = targetByBase.get(base) || [];
    if (targets.length === 0) {
      throw new Error(`No matching target asset path in assets/ for ${base}`);
    }
    for (const dst of targets) {
      fs.copyFileSync(srcPath, dst);
      copiedTargets += 1;
    }

    const prev = emojiByName.get(stem) || { name: stem, animated: false, pngPath: null, gifPath: null };
    if (ext === '.gif') {
      prev.animated = true;
      const compPath = path.join(COMPRESSED_GIF_DIR, base);
      prev.gifPath = fs.existsSync(compPath) ? compPath : srcPath;
    } else {
      prev.pngPath = srcPath;
    }
    emojiByName.set(stem, prev);
  }

  // Clear local pre-rendered card cache so new 512x512 images take effect immediately
  const cacheDir = path.resolve('cache', 'prerendered');
  if (fs.existsSync(cacheDir)) {
    for (const f of fs.readdirSync(cacheDir)) {
      if (f.endsWith('.webp') || f.endsWith('.png') || f === 'manifest.json') {
        try { fs.unlinkSync(path.join(cacheDir, f)); } catch {}
      }
    }
  }

  const tasks = [...emojiByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { hdCount: hdFiles.length, copiedTargets, tasks };
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
      this.ws.once('open', () => { clearTimeout(t); res(); });
      this.ws.once('error', (e) => { clearTimeout(t); rej(e); });
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
      throw new Error(`CDP Exception: ${JSON.stringify(r.exceptionDetails)}`);
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
  if (res.httpStatus !== 200 || (res.apiStatus && res.apiStatus >= 400)) {
    throw new Error(`BotGhost list emojis failed: ${JSON.stringify(res)}`);
  }
  return res.items;
}

async function callDiscordEmojiMutation(cdp, method, urlPath, bodyPairs = null) {
  const requestOptions = {
    method,
    url: `https://discord.com/api/v10${urlPath}`,
    headers: [
      { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    contentType: 'application/json',
    options: {
      contentType: 'application/json',
      replaceHeaders: true,
      ...(bodyPairs ? { bodyMode: 'form', replaceBody: true } : {}),
    },
  };
  if (bodyPairs) requestOptions.body = bodyPairs;

  const payload = JSON.stringify({ bot_id: BOT_ID, request_options: requestOptions });
  return cdp.eval(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45000),
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, apiStatus: j?.api_data?.status, response: j?.api_data?.response, message: j?.message || j?.error };
  })()`, 55000);
}

async function executeMutationWithRetry(fn, label, expectNoBody = false, confirmLookup = null) {
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    if (attempt > 1 && confirmLookup) {
      const existing = await confirmLookup().catch(() => null);
      if (existing?.id) {
        console.log(`[Recovered] ${label} already created on Discord -> ${existing.id}`);
        return existing;
      }
    }
    let res;
    try {
      res = await fn();
    } catch (err) {
      console.warn(`[Transient Error] ${label} (${attempt}/7): ${err.message}`);
      await sleep(2500 * attempt);
      continue;
    }
    if (expectNoBody && res.httpStatus === 200 && (res.apiStatus === 204 || res.apiStatus === 200 || res.apiStatus === 404)) {
      return res;
    }
    if (!expectNoBody && res.response?.id) {
      return res.response;
    }
    const retrySec = Number(res.response?.retry_after || 0);
    if (res.apiStatus === 429 || res.httpStatus === 429 || retrySec > 0) {
      const waitMs = Math.max(2000, Math.ceil((retrySec || 3.0) * 1000) + 800);
      console.warn(`[429] ${label} waiting ${waitMs}ms (${attempt}/7)...`);
      await sleep(waitMs);
      continue;
    }
    const respStr = typeof res.response === 'string' ? res.response : JSON.stringify(res.response || '');
    const isTransientProxy =
      typeof res.response === 'string' ||
      res.apiStatus == null ||
      res.httpStatus >= 500 ||
      res.apiStatus >= 500 ||
      res.httpStatus === 408 ||
      /closed the connection|reset|timeout|ECONN|socket|502|503|504/i.test(respStr);
    if (attempt < 7 && isTransientProxy) {
      console.warn(`[Transient Proxy] ${label} (${attempt}/7): ${respStr.slice(0, 120)}`);
      await sleep(2500 * attempt);
      continue;
    }
    throw new Error(`Discord emoji mutation failed for ${label}: ${JSON.stringify(res)}`);
  }
  throw new Error(`Exhausted retries for ${label}`);
}

async function encodePngUnderLimit(pngPath) {
  const img = await loadImage(pngPath);
  for (const size of [160, 128, 96, 64]) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size, size);
    const buf = canvas.toBuffer('image/png');
    if (buf.length <= MAX_EMOJI_BYTES) {
      return { dataUri: `data:image/png;base64,${buf.toString('base64')}`, bytes: buf.length, size };
    }
  }
  throw new Error(`PNG ${pngPath} exceeds ${MAX_EMOJI_BYTES} bytes even at 64px`);
}

function buildSortedEmojiMap(items) {
  const out = {};
  for (const e of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
    const anim = Boolean(e.animated);
    out[e.name] = {
      id: e.id,
      name: e.name,
      animated: anim,
      tag: anim ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
    };
  }
  return out;
}

async function main() {
  const copyOnly = process.argv.includes('--copy-only');
  const forceAll = process.argv.includes('--force');

  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  if (!fs.existsSync(PRE_SNAPSHOT_PATH) && fs.existsSync(EMOJI_JSON_PATH)) {
    fs.copyFileSync(EMOJI_JSON_PATH, PRE_SNAPSHOT_PATH);
    console.log(`[Snapshot] Saved pre-replacement emojis -> ${PRE_SNAPSHOT_PATH}`);
  }
  const preMap = fs.existsSync(PRE_SNAPSHOT_PATH)
    ? JSON.parse(fs.readFileSync(PRE_SNAPSHOT_PATH, 'utf8'))
    : {};

  console.log('[1/3] Replacing 242 HD assets across assets/...');
  const { hdCount, copiedTargets, tasks } = replaceLocalAssets();
  console.log(`[OK] Copied ${hdCount} source files -> ${copiedTargets} asset files (${tasks.length} unique Discord emojis).`);
  if (copyOnly) return;

  const tabs = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const bgTab = tabs.find((t) => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) throw new Error('BotGhost tab not found on CDP 9222');

  const cdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await cdp.connect();

  try {
    console.log('[2/3] Fetching live Discord Application Emojis via BotGhost proxy...');
    const liveItems = await listAppEmojisViaBotGhost(cdp);
    const liveByName = new Map(liveItems.map((e) => [e.name, e]));
    console.log(`[Live] Found ${liveItems.length} Discord App Emojis.`);

    const remap = fs.existsSync(REMAP_PATH)
      ? JSON.parse(fs.readFileSync(REMAP_PATH, 'utf8'))
      : {};

    const toProcess = tasks.filter((t) => {
      if (forceAll) return true;
      const curLive = liveByName.get(t.name);
      const oldPre = preMap[t.name];
      // Skip if already replaced (live ID differs from pre-replacement snapshot)
      if (curLive && oldPre && curLive.id !== oldPre.id) {
        if (!remap[oldPre.id]) {
          remap[oldPre.id] = {
            name: t.name,
            oldId: oldPre.id,
            newId: curLive.id,
            oldAnimated: Boolean(oldPre.animated),
            newAnimated: Boolean(curLive.animated),
            oldTag: oldPre.animated ? `<a:${t.name}:${oldPre.id}>` : `<:${t.name}:${oldPre.id}>`,
            newTag: curLive.animated ? `<a:${t.name}:${curLive.id}>` : `<:${t.name}:${curLive.id}>`,
          };
        }
        return false;
      }
      if (curLive && !oldPre && remap[`migrated:${t.name}`]) return false;
      return true;
    });

    console.log(`[3/3] Updating ${toProcess.length}/${tasks.length} v1.3 Discord App Emojis (< 248 KB each)...`);
    for (let i = 0; i < toProcess.length; i += 1) {
      const t = toProcess[i];
      const existing = liveByName.get(t.name);
      const oldId = preMap[t.name]?.id || existing?.id || null;

      let dataUri;
      let usedAnim = false;
      let infoStr = '';
      if (t.animated && t.gifPath) {
        const gifBuf = fs.readFileSync(t.gifPath);
        if (gifBuf.length <= MAX_EMOJI_BYTES) {
          dataUri = `data:image/gif;base64,${gifBuf.toString('base64')}`;
          usedAnim = true;
          infoStr = `${Math.round(gifBuf.length / 1024)}KB GIF`;
        }
      }
      if (!dataUri) {
        const enc = await encodePngUnderLimit(t.pngPath);
        dataUri = enc.dataUri;
        infoStr = `${Math.round(enc.bytes / 1024)}KB ${enc.size}px PNG`;
      }

      if (existing?.id) {
        await sleep(450);
        await executeMutationWithRetry(
          () => callDiscordEmojiMutation(cdp, 'DELETE', `/applications/${BOT_ID}/emojis/${existing.id}`),
          `DELETE ${t.name}:${existing.id}`,
          true,
        );
      }

      await sleep(600);
      const confirmPost = async () => {
        const items = await listAppEmojisViaBotGhost(cdp);
        return items.find((e) => e.name === t.name && e.id !== existing?.id) || null;
      };
      let created;
      try {
        created = await executeMutationWithRetry(
          () => callDiscordEmojiMutation(cdp, 'POST', `/applications/${BOT_ID}/emojis`, [
            { key: 'name', value: t.name },
            { key: 'image', value: dataUri },
          ]),
          `POST ${t.name} (${infoStr})`,
          false,
          confirmPost,
        );
      } catch (err) {
        if (usedAnim && t.pngPath) {
          console.warn(`[GIF Fallback -> PNG] ${t.name}: ${err.message}`);
          const enc = await encodePngUnderLimit(t.pngPath);
          await sleep(500);
          created = await executeMutationWithRetry(
            () => callDiscordEmojiMutation(cdp, 'POST', `/applications/${BOT_ID}/emojis`, [
              { key: 'name', value: t.name },
              { key: 'image', value: enc.dataUri },
            ]),
            `POST ${t.name} (PNG fallback)`,
            false,
            confirmPost,
          );
        } else {
          throw err;
        }
      }

      if (oldId && created.id && oldId !== created.id) {
        const oldAnim = Boolean(preMap[t.name]?.animated ?? existing?.animated);
        const newAnim = Boolean(created.animated);
        remap[oldId] = {
          name: t.name,
          oldId,
          newId: created.id,
          oldAnimated: oldAnim,
          newAnimated: newAnim,
          oldTag: oldAnim ? `<a:${t.name}:${oldId}>` : `<:${t.name}:${oldId}>`,
          newTag: newAnim ? `<a:${t.name}:${created.id}>` : `<:${t.name}:${created.id}>`,
        };
      } else {
        remap[`migrated:${t.name}`] = created.id;
      }

      if ((i + 1) % 5 === 0 || i === toProcess.length - 1 || i === 0) {
        fs.writeFileSync(REMAP_PATH, JSON.stringify(remap, null, 2), 'utf8');
        console.log(`[Progress ${i + 1}/${toProcess.length}] ${t.name} (${infoStr}) -> ${created.id} (animated=${created.animated})`);
      }
    }

    const finalLive = await listAppEmojisViaBotGhost(cdp);
    const outMap = buildSortedEmojiMap(finalLive);
    fs.writeFileSync(EMOJI_JSON_PATH, JSON.stringify(outMap, null, 2), 'utf8');
    fs.writeFileSync(REMAP_PATH, JSON.stringify(remap, null, 2), 'utf8');
    console.log(`[DONE] Synced ${Object.keys(outMap).length} live emojis -> ${EMOJI_JSON_PATH}`);
    console.log(`[Remap] Recorded ${Object.keys(remap).filter((k) => !k.startsWith('migrated:')).length} ID remaps -> ${REMAP_PATH}`);
  } finally {
    cdp.close();
  }
}

main().catch((err) => {
  console.error('[Replace v1.3 HD] FATAL:', err);
  process.exit(1);
});
