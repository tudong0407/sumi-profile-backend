/**
 * scripts/upload_v1_5_assets_and_emojis.mjs
 * Nạp trọn bộ 63 ảnh PNG Ver 1.5 (Nhịp 2):
 * - 43 Application Emojis (gacha_ticket_domain + 42 ui_*): tự động resize 128x128 PNG (<= 256KB),
 *   upload lên Discord Application Emojis qua BotGhost proxy /api/dashboard/test_api_action (Edge CDP 9222)
 *   và cập nhật src/config/custom_emojis.json (idempotent: tái sử dụng nếu emoji đã tồn tại).
 * - 20 Viền Avatar 512x512 PNG nền trong suốt: kiểm tra tồn tại và chép vào assets/frames/<frame_id>.png.
 *
 * Usage:
 *   node scripts/upload_v1_5_assets_and_emojis.mjs --dry-run
 *   node scripts/upload_v1_5_assets_and_emojis.mjs --dir "D:\Path\To\63_PNGs"
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { V15_NEW_EMOJI_PROMPTS, V15_AVATAR_FRAME_SPECS } from '../src/data/v15AssetsCatalog.js';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const BACKEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const FRAMES_DIR = path.join(BACKEND_ROOT, 'assets', 'frames');
const OUTPUT_JSON = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

function getArgVal(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return '';
}

function resolveEmojiFile(srcDir, uid) {
  const nested = path.join(srcDir, 'assets', 'emoji', `${uid}.png`);
  if (fs.existsSync(nested)) return nested;
  const flat = path.join(srcDir, `${uid}.png`);
  if (fs.existsSync(flat)) return flat;
  return null;
}

function resolveFrameFile(srcDir, frameId) {
  const nested = path.join(srcDir, 'assets', 'frames', `${frameId}.png`);
  if (fs.existsSync(nested)) return nested;
  const flat = path.join(srcDir, `${frameId}.png`);
  if (fs.existsSync(flat)) return flat;
  return null;
}

async function encodeEmoji128PngUnder256Kb(srcPath) {
  const raw = fs.readFileSync(srcPath);
  const img = await loadImage(raw);
  for (const dim of [128, 112, 96, 80]) {
    const c = createCanvas(dim, dim);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dim, dim);
    const buf = c.toBuffer('image/png');
    if (buf.length <= 256 * 1024) return buf;
  }
  return raw;
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
  const sendCdp = (method, params = {}, timeoutMs = 45000) => {
    const id = seq++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', handler);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const handler = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.off('message', handler);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };
  await sendCdp('Page.bringToFront').catch(() => {});
  const evalJs = async (expression, timeoutMs = 45000) => {
    const r = await sendCdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
    if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r?.result?.value;
  };
  return { ws, evalJs };
}

async function listExistingAppEmojis(evalJs) {
  const out = await evalJs(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
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
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, apiStatus: j?.api_data?.status, items: j?.api_data?.response?.items || [] };
  })()`);
  if (!out || out.httpStatus >= 400 || (out.apiStatus && out.apiStatus >= 400)) {
    throw new Error(`Failed listing existing application emojis: ${JSON.stringify(out)}`);
  }
  return out.items || [];
}

async function uploadOneEmojiViaProxy(evalJs, name, dataUri) {
  const payload = JSON.stringify({
    bot_id: BOT_ID,
    request_options: {
      method: 'POST',
      url: `https://discord.com/api/v10/applications/${BOT_ID}/emojis`,
      headers: [
        { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      body: [
        { key: 'name', value: name },
        { key: 'image', value: dataUri },
      ],
      contentType: 'application/json',
      options: {
        bodyMode: 'form',
        contentType: 'application/json',
        replaceHeaders: true,
        replaceBody: true,
      },
    },
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await evalJs(`(async () => {
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
        message: j?.message || j?.error || '',
      };
    })()`);

    if (res?.apiStatus === 429 || res?.httpStatus === 429) {
      const waitSec = Math.min(15, Math.max(2, Number(res?.response?.retry_after || 3)));
      console.log(`[429] Rate limited on ${name}, waiting ${waitSec}s (attempt ${attempt}/4)...`);
      await new Promise((r) => setTimeout(r, (waitSec + 0.5) * 1000));
      continue;
    }
    if (res?.httpStatus < 400 && res?.apiStatus < 400 && res?.response?.id) {
      return res.response;
    }
    if (attempt === 4) {
      throw new Error(`Upload failed for ${name}: ${JSON.stringify(res)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Upload failed for ${name} after retries`);
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const srcDir = getArgVal('--dir');

  console.log(`=== Ver 1.5 Asset Loader (${V15_NEW_EMOJI_PROMPTS.length} Emojis + ${V15_AVATAR_FRAME_SPECS.length} Frames = 63 Assets) ===`);
  if (isDryRun || !srcDir) {
    console.log(`[DRY-RUN] Manifest valid: ${V15_NEW_EMOJI_PROMPTS.length} emoji UIDs + ${V15_AVATAR_FRAME_SPECS.length} frame IDs.`);
    if (!isDryRun && !srcDir) {
      throw new Error('Missing --dir <path_to_63_pngs> (or pass --dry-run)');
    }
    return;
  }

  if (!fs.existsSync(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);

  // 1. Verify all 63 files exist before uploading anything
  const missing = [];
  const emojiFiles = new Map();
  const frameFiles = new Map();
  for (const e of V15_NEW_EMOJI_PROMPTS) {
    const p = resolveEmojiFile(srcDir, e.uid);
    if (!p) missing.push(`${e.uid}.png`);
    else emojiFiles.set(e.uid, p);
  }
  for (const f of V15_AVATAR_FRAME_SPECS) {
    const p = resolveFrameFile(srcDir, f.frame_id);
    if (!p) missing.push(`${f.frame_id}.png`);
    else frameFiles.set(f.frame_id, p);
  }
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.length} PNG files in ${srcDir}: ${missing.slice(0, 10).join(', ')}`);
  }

  // 2. Copy 20 frame PNGs -> assets/frames/
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  for (const f of V15_AVATAR_FRAME_SPECS) {
    fs.copyFileSync(frameFiles.get(f.frame_id), path.join(FRAMES_DIR, `${f.frame_id}.png`));
  }
  console.log(`[FRAMES] Verified/copied ${V15_AVATAR_FRAME_SPECS.length} PNG frames to ${FRAMES_DIR}`);

  // 3. Upload 43 emojis via BotGhost Application Emojis Proxy
  const emojiMap = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
  const { ws, evalJs } = await openCdpOnBotGhost();
  try {
    const existingItems = await listExistingAppEmojis(evalJs);
    const existingByName = new Map(existingItems.map((it) => [String(it.name), it]));
    console.log(`[EMOJI] Found ${existingItems.length} existing Application Emojis on Discord.`);

    let uploadedCount = 0;
    let reusedCount = 0;
    for (const e of V15_NEW_EMOJI_PROMPTS) {
      const existing = existingByName.get(e.uid);
      if (existing?.id) {
        emojiMap[e.uid] = {
          id: existing.id,
          name: existing.name,
          animated: Boolean(existing.animated),
          tag: existing.animated ? `<a:${existing.name}:${existing.id}>` : `<:${existing.name}:${existing.id}>`,
        };
        reusedCount += 1;
        console.log(`[EMOJI][REUSE] ${e.uid} -> ${existing.id}`);
      } else {
        const buf = await encodeEmoji128PngUnder256Kb(emojiFiles.get(e.uid));
        const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
        const created = await uploadOneEmojiViaProxy(evalJs, e.uid, dataUri);
        emojiMap[e.uid] = {
          id: created.id,
          name: created.name,
          animated: Boolean(created.animated),
          tag: created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`,
        };
        uploadedCount += 1;
        console.log(`[EMOJI][UPLOAD ${uploadedCount}] ${e.uid} (${(buf.length / 1024).toFixed(1)}KB) -> ${created.id}`);
        await new Promise((r) => setTimeout(r, 1200));
      }
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(emojiMap, null, 2), 'utf8');
    }
    console.log(`[EMOJI] Done! uploaded=${uploadedCount}, reused=${reusedCount}, total in custom_emojis.json=${Object.keys(emojiMap).length}`);
  } finally {
    ws.close();
  }
}

main().catch((err) => {
  console.error('[upload_v1_5_assets_and_emojis] FAILED:', err);
  process.exit(1);
});
