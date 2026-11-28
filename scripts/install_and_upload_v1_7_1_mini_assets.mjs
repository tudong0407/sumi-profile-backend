/**
 * scripts/install_and_upload_v1_7_1_mini_assets.mjs
 * 1. Tách nền đen (#000000) bằng edge flood-fill BFS + khử viền răng cưa (bảo toàn 100% chi tiết tối bên trong chủ thể).
 * 2. Lưu 4 Boss Linh Mạch (SS, SS+ quạt mở từ media_1795845555359_2016e8f6.jpg, SSS, SSS+) dạng WebP 512x512 trong suốt vào assets/veins/.
 * 3. Nén WebP 768x768 trong suốt cho Bộ Icon Trà Đạo / Linh Hương / Giờ Hoàng Đạo & upload lên Supabase Storage bucket công khai `sumi-static-assets`
 *    (Render-Light Static Image Rule: KHÔNG lưu/render ảnh tĩnh nặng trên Render!).
 * 4. Upload toàn bộ 8 Discord Application Emojis (128x128 PNG trong suốt) qua BotGhost CDP (9222) -> cập nhật src/config/custom_emojis.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { supabase } from '../src/config/supabase.js';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const BUCKET_NAME = 'sumi-static-assets';
const BACKEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const STAGING_DIR = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_7_1_Mini_Handoff_0G';
const SSP_OPEN_FAN_JPG = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/.user_uploaded/media_1795845555359_2016e8f6.jpg';
const OUTPUT_EMOJI_JSON = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

const ASSETS = [
  { name: 'vein_mine_ss', src: `${STAGING_DIR}/assets/veins/vein_mine_ss.png`, kind: 'vein', webpDim: 512, q: 88 },
  { name: 'vein_mine_ssp', src: SSP_OPEN_FAN_JPG, kind: 'vein', webpDim: 512, q: 88 },
  { name: 'vein_mine_sss', src: `${STAGING_DIR}/assets/veins/vein_mine_sss.png`, kind: 'vein', webpDim: 512, q: 88 },
  { name: 'vein_mine_sssp', src: `${STAGING_DIR}/assets/veins/vein_mine_sssp.png`, kind: 'vein', webpDim: 512, q: 88 },
  { name: 'tea_ceremony_pot', src: `${STAGING_DIR}/assets/shop/tea_ceremony_pot.png`, kind: 'external_icon', webpDim: 768, q: 92 },
  { name: 'tea_cup_cheers', src: `${STAGING_DIR}/assets/shop/tea_cup_cheers.png`, kind: 'external_icon', webpDim: 768, q: 92 },
  { name: 'spirit_incense_burner', src: `${STAGING_DIR}/assets/shop/spirit_incense_burner.png`, kind: 'external_icon', webpDim: 768, q: 92 },
  { name: 'auspicious_hour_bell', src: `${STAGING_DIR}/assets/shop/auspicious_hour_bell.png`, kind: 'external_icon', webpDim: 768, q: 92 },
];

/**
 * Edge flood-fill BFS removing pure/near-black exterior while preserving dark pixels inside subject,
 * plus 1px soft alpha feather on exterior boundary so glowing edges stay smooth.
 */
async function removeBlackBgAndCropCanvas(srcPath, targetDim, paddingRatio = 0.04) {
  const img = await loadImage(fs.readFileSync(srcPath));
  const w = img.width;
  const h = img.height;
  const work = createCanvas(w, h);
  const wCtx = work.getContext('2d');
  wCtx.drawImage(img, 0, 0);
  const imgData = wCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Detect if corners are already transparent
  const cornerAlpha = data[3];
  if (cornerAlpha > 20) {
    const visited = new Uint8Array(w * h);
    const isBg = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let qHead = 0;
    let qTail = 0;

    const isNearBlack = (idx) => {
      const p = idx * 4;
      return data[p] <= 18 && data[p + 1] <= 18 && data[p + 2] <= 18;
    };

    const enqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const idx = y * w + x;
      if (visited[idx]) return;
      visited[idx] = 1;
      if (isNearBlack(idx)) {
        isBg[idx] = 1;
        queue[qTail++] = idx;
      }
    };

    for (let x = 0; x < w; x += 1) {
      enqueue(x, 0);
      enqueue(x, h - 1);
    }
    for (let y = 0; y < h; y += 1) {
      enqueue(0, y);
      enqueue(w - 1, y);
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % w;
      const y = (idx - x) / w;
      if (x > 0) enqueue(x - 1, y);
      if (x + 1 < w) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y + 1 < h) enqueue(x, y + 1);
    }

    for (let i = 0; i < w * h; i += 1) {
      if (isBg[i]) {
        data[i * 4 + 3] = 0;
      }
    }

    // Soften 1px-2px anti-aliased fringe pixels bordering transparent background
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const idx = y * w + x;
        if (isBg[idx]) continue;
        const p = idx * 4;
        const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
        if (maxC >= 46) continue;
        const touchesBg = isBg[idx - 1] || isBg[idx + 1] || isBg[idx - w] || isBg[idx + w];
        if (touchesBg) {
          data[p + 3] = Math.round((maxC / 46) * 255);
        }
      }
    }
    wCtx.putImageData(imgData, 0, 0);
  }

  // Tight bounding box of non-transparent pixels
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const out = createCanvas(targetDim, targetDim);
  const oCtx = out.getContext('2d');
  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = 'high';
  const usable = targetDim * (1 - paddingRatio * 2);
  const scale = Math.min(usable / cropW, usable / cropH);
  const dw = Math.round(cropW * scale);
  const dh = Math.round(cropH * scale);
  const dx = Math.floor((targetDim - dw) / 2);
  const dy = Math.floor((targetDim - dh) / 2);
  oCtx.drawImage(work, minX, minY, cropW, cropH, dx, dy, dw, dh);
  return out;
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
  return out?.items || [];
}

async function uploadOrReplaceEmojiViaProxy(evalJs, existingId, name, dataUri) {
  if (existingId) {
    // Delete old emoji first if re-uploading cleanly (e.g. open-fan ssp)
    await evalJs(`(async () => {
      await fetch('/api/dashboard/test_api_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: '${BOT_ID}',
          request_options: {
            method: 'DELETE',
            url: 'https://discord.com/api/v10/applications/${BOT_ID}/emojis/${existingId}',
            headers: [
              { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
              { key: 'Content-Type', value: 'application/json' }
            ]
          }
        })
      });
    })()`);
    await new Promise((r) => setTimeout(r, 700));
  }

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
    };
  })()`);
  if (!res?.response?.id) {
    throw new Error(`Upload failed for ${name}: ${JSON.stringify(res)}`);
  }
  return res.response;
}

async function ensurePublicBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (error) throw new Error(`Create Supabase bucket failed: ${error.message}`);
  }
}

async function main() {
  const veinsDir = path.join(BACKEND_ROOT, 'assets', 'veins');
  await fs.promises.mkdir(veinsDir, { recursive: true });
  await ensurePublicBucket();

  const externalUrls = {};
  const emojiBuffers = {};

  for (const asset of ASSETS) {
    // 1) Hi-res transparent WebP (512 for veins -> local assets/veins/; 768 for feature icons -> Supabase CDN!)
    const webpCanvas = await removeBlackBgAndCropCanvas(asset.src, asset.webpDim, 0.03);
    const webpBuf = webpCanvas.toBuffer('image/webp', asset.q);

    if (asset.kind === 'vein') {
      const outPath = path.join(veinsDir, `${asset.name}.webp`);
      await fs.promises.writeFile(outPath, webpBuf);
      console.log(`[VEIN WEBP] ${asset.name}.webp (${(webpBuf.length / 1024).toFixed(1)} KB) -> assets/veins/`);
    } else {
      const storagePath = `v1_7_1_mini/${asset.name}.webp`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, webpBuf, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error(`Supabase Storage upload ${asset.name} failed: ${upErr.message}`);
      const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      externalUrls[asset.name] = pubData.publicUrl;
      console.log(`[SUPABASE CDN WEBP] ${asset.name}.webp (${(webpBuf.length / 1024).toFixed(1)} KB) -> ${pubData.publicUrl}`);
    }

    // 2) 128x128 transparent PNG buffer for Discord Application Emoji
    const emCanvas = await removeBlackBgAndCropCanvas(asset.src, 128, 0.04);
    emojiBuffers[asset.name] = emCanvas.toBuffer('image/png');
  }

  // 3) Upload 8 Discord Application Emojis via open BotGhost tab (Edge CDP 9222)
  const emojiMap = JSON.parse(fs.readFileSync(OUTPUT_EMOJI_JSON, 'utf8'));
  const { ws, evalJs } = await openCdpOnBotGhost();
  try {
    const existingItems = await listExistingAppEmojis(evalJs);
    const existingByName = new Map(existingItems.map((it) => [String(it.name), it]));
    for (const asset of ASSETS) {
      const prev = existingByName.get(asset.name);
      const dataUri = `data:image/png;base64,${emojiBuffers[asset.name].toString('base64')}`;
      const created = await uploadOrReplaceEmojiViaProxy(evalJs, prev?.id || null, asset.name, dataUri);
      emojiMap[asset.name] = {
        id: created.id,
        name: created.name,
        animated: Boolean(created.animated),
        tag: created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`,
      };
      console.log(`[DISCORD EMOJI] ${asset.name} -> ${emojiMap[asset.name].tag} (${(emojiBuffers[asset.name].length / 1024).toFixed(1)} KB)`);
      await new Promise((r) => setTimeout(r, 950));
    }
    fs.writeFileSync(OUTPUT_EMOJI_JSON, JSON.stringify(emojiMap, null, 2), 'utf8');
  } finally {
    ws.close();
  }

  console.log('\n[EXTERNAL CDN URLS]:', JSON.stringify(externalUrls, null, 2));
}

main().catch((err) => {
  console.error('[install_and_upload_v1_7_1_mini_assets] FAILED:', err);
  process.exit(1);
});
