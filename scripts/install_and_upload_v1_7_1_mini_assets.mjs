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
async function removeBlackBgAndCropCanvas(srcPath, targetDim, paddingRatio = 0.04, isIcon = false) {
  const img = await loadImage(fs.readFileSync(srcPath));
  const w = img.width;
  const h = img.height;
  const work = createCanvas(w, h);
  const wCtx = work.getContext('2d');
  wCtx.drawImage(img, 0, 0);
  const imgData = wCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Compute maxC & chroma once
  const total = w * h;
  const maxC = new Uint8Array(total);
  const chroma = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    maxC[i] = mx;
    chroma[i] = mx - mn;
  }

  const cornerAlpha = data[3];
  if (cornerAlpha > 20) {
    const bgCut = isIcon ? 30 : 22;
    const bgChroma = isIcon ? 20 : 16;
    const visited = new Uint8Array(total);
    const isBg = new Uint8Array(total);
    const queue = new Int32Array(total);
    let qHead = 0;
    let qTail = 0;

    const enqueueOuter = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const idx = y * w + x;
      if (visited[idx]) return;
      visited[idx] = 1;
      if (maxC[idx] <= bgCut && chroma[idx] <= bgChroma) {
        isBg[idx] = 1;
        queue[qTail++] = idx;
      }
    };

    for (let x = 0; x < w; x += 1) {
      enqueueOuter(x, 0);
      enqueueOuter(x, h - 1);
    }
    for (let y = 0; y < h; y += 1) {
      enqueueOuter(0, y);
      enqueueOuter(w - 1, y);
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % w;
      const y = (idx - x) / w;
      if (x > 0) enqueueOuter(x - 1, y);
      if (x + 1 < w) enqueueOuter(x + 1, y);
      if (y > 0) enqueueOuter(x, y - 1);
      if (y + 1 < h) enqueueOuter(x, y + 1);
    }

    // Remove enclosed interior pure/near-black studio pockets (handles, swirl loops, sword gaps, dragon ears)
    const minHolePx = isIcon ? 20 : 120;
    const holeMaxC = isIcon ? 44 : 26;
    const holeChroma = isIcon ? 24 : 12;
    const pureCoreCut = isIcon ? 24 : 14;
    const holeBuf = new Int32Array(total);

    for (let i = 0; i < total; i += 1) {
      if (visited[i] || maxC[i] > holeMaxC || chroma[i] > holeChroma) continue;
      let hHead = 0;
      let hTail = 0;
      let hasPureCore = false;
      let minHx = w;
      let maxHx = 0;
      let minHy = h;
      let maxHy = 0;

      visited[i] = 1;
      holeBuf[hTail++] = i;
      while (hHead < hTail) {
        const idx = holeBuf[hHead++];
        if (maxC[idx] <= pureCoreCut) hasPureCore = true;
        const x = idx % w;
        const y = (idx - x) / w;
        if (x < minHx) minHx = x;
        if (x > maxHx) maxHx = x;
        if (y < minHy) minHy = y;
        if (y > maxHy) maxHy = y;
        const nb = [x > 0 ? idx - 1 : -1, x + 1 < w ? idx + 1 : -1, y > 0 ? idx - w : -1, y + 1 < h ? idx + w : -1];
        for (const n of nb) {
          if (n >= 0 && !visited[n] && maxC[n] <= holeMaxC && chroma[n] <= holeChroma) {
            visited[n] = 1;
            holeBuf[hTail++] = n;
          }
        }
      }

      if (hTail >= minHolePx && hasPureCore) {
        if (!isIcon && hTail < 450 && minHx > 0.35 * w && maxHx < 0.65 * w && minHy > 0.14 * h && maxHy < 0.45 * h) {
          continue;
        }
        for (let k = 0; k < hTail; k += 1) {
          isBg[holeBuf[k]] = 1;
        }
      }
    }

    // Distance field from isBg boundary up to MAX_DIST px via multi-source BFS
    const maxDist = isIcon ? 8 : 4;
    const dist = new Int16Array(total).fill(99);
    let dHead = 0;
    let dTail = 0;
    for (let i = 0; i < total; i += 1) {
      if (!isBg[i]) continue;
      dist[i] = 0;
      const x = i % w;
      const y = (i - x) / w;
      if ((x > 0 && !isBg[i - 1]) || (x + 1 < w && !isBg[i + 1]) || (y > 0 && !isBg[i - w]) || (y + 1 < h && !isBg[i + w])) {
        queue[dTail++] = i;
      }
    }
    while (dHead < dTail) {
      const idx = queue[dHead++];
      const cd = dist[idx];
      if (cd >= maxDist) continue;
      const nd = cd + 1;
      const x = idx % w;
      const y = (idx - x) / w;
      if (x > 0 && dist[idx - 1] > nd) { dist[idx - 1] = nd; queue[dTail++] = idx - 1; }
      if (x + 1 < w && dist[idx + 1] > nd) { dist[idx + 1] = nd; queue[dTail++] = idx + 1; }
      if (y > 0 && dist[idx - w] > nd) { dist[idx - w] = nd; queue[dTail++] = idx - w; }
      if (y + 1 < h && dist[idx + w] > nd) { dist[idx + w] = nd; queue[dTail++] = idx + w; }
    }

    // Soft black-matte keying + RGB un-premultiplication in boundary zone (eliminates black halo!)
    const rampMax = isIcon ? 120.0 : 72.0;
    const floorCut = isIcon ? 18.0 : 16.0;
    const slopeDecay = isIcon ? 0.10 : 0.22;

    for (let i = 0; i < total; i += 1) {
      const p = i * 4;
      if (isBg[i]) {
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
        continue;
      }
      const d = dist[i];
      if (d < 1 || d > maxDist) continue;
      const localCap = rampMax * (1.0 - (d - 1) * slopeDecay);
      const mx = maxC[i];
      if (mx >= localCap) continue;
      let aEst = Math.max(0, Math.min(1, (mx - floorCut) / Math.max(localCap - floorCut, 1.0)));
      aEst = aEst * aEst * (3.0 - 2.0 * aEst);
      if (aEst <= 0.015) {
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
      } else if (aEst < 0.99) {
        const safeA = Math.max(aEst, 0.14);
        data[p] = Math.min(255, Math.round(data[p] / safeA));
        data[p + 1] = Math.min(255, Math.round(data[p + 1] / safeA));
        data[p + 2] = Math.min(255, Math.round(data[p + 2] / safeA));
        data[p + 3] = Math.round(aEst * 255);
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
    const isIcon = asset.kind === 'external_icon';
    // 1) Hi-res transparent WebP (512 for veins -> local assets/veins/; 768 for feature icons -> Supabase CDN!)
    const webpCanvas = await removeBlackBgAndCropCanvas(asset.src, asset.webpDim, 0.03, isIcon);
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
    const emCanvas = await removeBlackBgAndCropCanvas(asset.src, 128, 0.04, isIcon);
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
