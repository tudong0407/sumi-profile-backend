/**
 * scripts/upload_v1_7_essential_emojis.mjs
 * Upload 10 ảnh vật phẩm đặc biệt Ver 1.7 (red_gold_crystal, evo_crystal, chaos_essence_shard,
 * mythic_selector_card, abs_enchant_charm, farm_auto_card, farm_growth_med, farm_protect_card,
 * farm_yield_starch, alchemy_protect_card) thành Discord Application Emojis qua BotGhost CDP (9222)
 * và lưu vào src/config/custom_emojis.json (idempotent).
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const BACKEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SHOP_ASSETS_DIR = path.join(BACKEND_ROOT, 'assets', 'shop');
const OUTPUT_JSON = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

const ESSENTIAL_V17_EMOJIS = [
  'red_gold_crystal',
  'evo_crystal',
  'chaos_essence_shard',
  'mythic_selector_card',
  'abs_enchant_charm',
  'farm_auto_card',
  'farm_growth_med',
  'farm_protect_card',
  'farm_yield_starch',
  'alchemy_protect_card',
];

async function encodeEmoji128PngUnder256Kb(srcPath) {
  const raw = fs.readFileSync(srcPath);
  const img = await loadImage(raw);
  for (const dim of [128, 112, 96, 80]) {
    const c = createCanvas(dim, dim);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Preserve aspect ratio centered (for 512x768 collector cards)
    const scale = Math.min(dim / img.width, dim / img.height);
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const dx = Math.floor((dim - dw) / 2);
    const dy = Math.floor((dim - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
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
  const emojiMap = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
  const { ws, evalJs } = await openCdpOnBotGhost();
  try {
    const existingItems = await listExistingAppEmojis(evalJs);
    const existingByName = new Map(existingItems.map((it) => [String(it.name), it]));
    console.log(`[EMOJI] Found ${existingItems.length} existing Application Emojis on Discord.`);

    let uploaded = 0;
    let reused = 0;
    for (const name of ESSENTIAL_V17_EMOJIS) {
      const srcPath = path.join(SHOP_ASSETS_DIR, `${name}.webp`);
      if (!fs.existsSync(srcPath)) throw new Error(`Missing ${srcPath}`);
      const existing = existingByName.get(name);
      if (existing?.id) {
        emojiMap[name] = {
          id: existing.id,
          name: existing.name,
          animated: Boolean(existing.animated),
          tag: existing.animated ? `<a:${existing.name}:${existing.id}>` : `<:${existing.name}:${existing.id}>`,
        };
        reused += 1;
        console.log(`[EMOJI][REUSE] ${name} -> ${existing.id}`);
      } else {
        const buf = await encodeEmoji128PngUnder256Kb(srcPath);
        const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
        const created = await uploadOneEmojiViaProxy(evalJs, name, dataUri);
        emojiMap[name] = {
          id: created.id,
          name: created.name,
          animated: Boolean(created.animated),
          tag: created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`,
        };
        uploaded += 1;
        console.log(`[EMOJI][UPLOAD ${uploaded}] ${name} (${(buf.length / 1024).toFixed(1)}KB) -> ${created.id}`);
        await new Promise((r) => setTimeout(r, 1050));
      }
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(emojiMap, null, 2), 'utf8');
    }
    console.log(`[EMOJI] Done! uploaded=${uploaded}, reused=${reused}, total in custom_emojis.json=${Object.keys(emojiMap).length}`);
  } finally {
    ws.close();
  }
}

main().catch((err) => {
  console.error('[upload_v1_7_essential_emojis] FAILED:', err);
  process.exit(1);
});
