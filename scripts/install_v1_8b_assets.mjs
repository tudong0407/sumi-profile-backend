/**
 * scripts/install_v1_8b_assets.mjs
 * Phase 1 (Ver 1.8B):
 *   1. Xử lý làm sạch 41 Khung Avatar Chân Thần (từ nguồn d:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_8_41_Frame_BAN_DAU_NGUYEN_GOC\assets\frames):
 *      - Khử triệt để lớp spotlight / sương mù / viền sáng ở cạnh trên & 4 cạnh ảnh bằng Core-Solid Distance Field Keying (d <= 6px).
 *      - Bảo vệ vùng tâm rỗng tuyệt đối (r < rInner) theo từng góc 360 độ.
 *      - Chuẩn hóa canvas 512×512 RGBA với lề trống sạch >= 14px cả 4 cạnh (0 pixel chạm biên).
 *      - Tự động đo { cx, cy, rTuck, rUnder } lưu vào src/data/v18BondFrameMetrics.json cho drawUtils.js.
 *      - Xuất ảnh QA Contact Sheet (Before vs After trên nền Discord #1e1f22) kiểm chứng trực quan 8 khung từng dính viền sáng.
 *   2. Upload 16 Discord Application Emojis (128x128 PNG) từ d:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_8_Pet_Bond\Discord_emoji_128
 *      lên Bot Nhiễm Nhiễm qua Edge CDP (9222) và cập nhật src/config/custom_emojis.json (1026 -> 1042/2000).
 *
 * Usage:
 *   node scripts/install_v1_8b_assets.mjs [--frames-only] [--emojis-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const BACKEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SOURCE_FRAMES_DIR = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_8_41_Frame_BAN_DAU_NGUYEN_GOC/assets/frames';
const SOURCE_ICONS_ROOT = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_8_Pet_Bond/Discord_emoji_128';
const DEST_FRAMES_DIR = path.join(BACKEND_ROOT, 'assets', 'frames');
const OUTPUT_METRICS_JSON = path.join(BACKEND_ROOT, 'src', 'data', 'v18BondFrameMetrics.json');
const OUTPUT_EMOJI_JSON = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');
const QA_SHEET_PATH = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/v18b_frames_qa_contact_sheet.png';

const TOP_GLOW_SHOWCASE = [
  'frame_bond_cuu_vi_hong_ho.png',
  'frame_bond_thai_so_cuu_phuong_hoang.png',
  'frame_bond_thai_bach_thien_kiem_lan.png',
  'frame_bond_hoang_thien_ban_co_lan.png',
  'frame_bond_cuu_tieu_thanh_loan.png',
  'frame_bond_hon_don_chi_to_long.png',
  'frame_bond_thai_cuc_thanh_quang_thu.png',
  'frame_bond_hong_mong_cuu_vy_tien.png',
];

function cleanFrameAndComputeMetrics(srcImg) {
  const w = srcImg.width;
  const h = srcImg.height;
  const work = createCanvas(w, h);
  const ctx = work.getContext('2d');
  ctx.drawImage(srcImg, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const total = w * h;

  // 1. Identify solid ornament core pixels (preserves thin gold filigree & gemstones, drops spotlight haze)
  const rawSolid = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    const p = i * 4;
    const a = d[p + 3];
    if (a < 155) continue;
    const r = d[p];
    const g = d[p + 1];
    const b = d[p + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const chroma = mx - mn;
    // True painted metal/gems/petals have high opacity (>=195) or strong color saturation at a>=155
    if (a >= 195 || (a >= 165 && chroma >= 45)) {
      rawSolid[i] = 1;
    }
  }

  // 2. Keep connected components anchored to the ring body (filter tiny edge speckles)
  const visited = new Uint8Array(total);
  const solid = new Uint8Array(total);
  const compBuf = new Int32Array(total);
  const compMeta = [];
  let maxCompSize = 0;

  for (let i = 0; i < total; i += 1) {
    if (!rawSolid[i] || visited[i]) continue;
    let head = 0;
    let tail = 0;
    visited[i] = 1;
    compBuf[tail++] = i;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    while (head < tail) {
      const idx = compBuf[head++];
      const x = idx % w;
      const y = (idx - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = ny * w + nx;
          if (!visited[nIdx] && rawSolid[nIdx]) {
            visited[nIdx] = 1;
            compBuf[tail++] = nIdx;
          }
        }
      }
    }
    if (tail > maxCompSize) maxCompSize = tail;
    if (tail >= 28) {
      const copy = compBuf.slice(0, tail);
      compMeta.push({ size: tail, minX, maxX, minY, maxY, pixels: copy });
    }
  }

  // Compute centroid of primary ring components
  let sumX = 0, sumY = 0, count = 0;
  for (const c of compMeta) {
    if (c.size < Math.max(500, maxCompSize * 0.05)) continue;
    for (let k = 0; k < c.pixels.length; k += 4) {
      const idx = c.pixels[k];
      sumX += idx % w;
      sumY += (idx - (idx % w)) / w;
      count += 1;
    }
  }
  const cxSrc = count > 0 ? sumX / count : w / 2;
  const cySrc = count > 0 ? sumY / count : h / 2;

  // Accept primary ring + hanging crystal drops near ring radius, reject distant top-border bar fragments
  for (const c of compMeta) {
    const touchTopVeryEdge = c.minY <= 3 && c.size < maxCompSize * 0.3;
    if (touchTopVeryEdge) continue;
    for (let k = 0; k < c.pixels.length; k += 1) {
      solid[c.pixels[k]] = 1;
    }
  }

  // 3. Multi-source BFS distance from solid ornament contour (up to 7px)
  const MAX_HALO_DIST = 6;
  const dist = new Uint8Array(total).fill(99);
  const q = new Int32Array(total);
  let qh = 0, qt = 0;
  for (let i = 0; i < total; i += 1) {
    if (!solid[i]) continue;
    dist[i] = 0;
    const x = i % w;
    const y = (i - x) / w;
    if ((x > 0 && !solid[i - 1]) || (x + 1 < w && !solid[i + 1]) || (y > 0 && !solid[i - w]) || (y + 1 < h && !solid[i + w])) {
      q[qt++] = i;
    }
  }
  while (qh < qt) {
    const idx = q[qh++];
    const nd = dist[idx] + 1;
    if (nd > MAX_HALO_DIST) continue;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0 && dist[idx - 1] > nd) { dist[idx - 1] = nd; q[qt++] = idx - 1; }
    if (x + 1 < w && dist[idx + 1] > nd) { dist[idx + 1] = nd; q[qt++] = idx + 1; }
    if (y > 0 && dist[idx - w] > nd) { dist[idx - w] = nd; q[qt++] = idx - w; }
    if (y + 1 < h && dist[idx + w] > nd) { dist[idx + w] = nd; q[qt++] = idx + w; }
  }

  // 4. Determine clean inner radius per angle sector so the 70% avatar hole stays 100% crystal clear
  const N_SECTORS = 360;
  const rInnerBySec = new Float32Array(N_SECTORS).fill(w * 0.5);
  for (let i = 0; i < total; i += 1) {
    if (!solid[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    const dx = x - cxSrc;
    const dy = y - cySrc;
    const r = Math.hypot(dx, dy);
    if (r < w * 0.25) continue; // ignore stray speck if any
    const deg = Math.floor(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360);
    if (r < rInnerBySec[deg]) rInnerBySec[deg] = r;
  }
  // Smooth inner radii across neighboring sectors (prevents sharp radial notches)
  const rInnerSmooth = new Float32Array(N_SECTORS);
  for (let s = 0; s < N_SECTORS; s += 1) {
    let minNb = rInnerBySec[s];
    for (let o = -3; o <= 3; o += 1) {
      const nb = rInnerBySec[(s + o + N_SECTORS) % N_SECTORS];
      if (nb < minNb) minNb = nb;
    }
    rInnerSmooth[s] = minNb;
  }

  // 5. Apply alpha cleanup & tight outer bounding box calculation
  let minBx = w, maxBx = 0, minBy = h, maxBy = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const p = idx * 4;
      const origA = d[p + 3];
      if (origA === 0) continue;

      const dd = dist[idx];
      if (dd > MAX_HALO_DIST) {
        d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 0;
        continue;
      }

      const dx = x - cxSrc;
      const dy = y - cySrc;
      const r = Math.hypot(dx, dy);
      const deg = Math.floor(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360);
      if (r < rInnerSmooth[deg] - 2.5) {
        d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 0;
        continue;
      }

      let finalA = origA;
      if (dd > 0) {
        // Gentle anti-aliased falloff close to solid edge, strongly damping grey spotlight fog
        const falloff = Math.pow(1 - dd / (MAX_HALO_DIST + 1), 1.85);
        finalA = Math.round(origA * falloff);
        if (dd >= 3 && finalA < 35) finalA = 0;
      }

      // Fade any subtle residue in outermost 10px of source canvas
      const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edgeDist < 10 && !solid[idx]) {
        finalA = Math.round(finalA * (edgeDist / 10));
      }

      d[p + 3] = finalA;
      if (finalA > 10) {
        if (x < minBx) minBx = x;
        if (x > maxBx) maxBx = x;
        if (y < minBy) minBy = y;
        if (y > maxBy) maxBy = y;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 6. Render into clean 512x512 RGBA PNG centered cleanly with >= 14px empty padding on ALL 4 edges
  const OUT_DIM = 512;
  const PAD = 14; // ~2.7% extra margin around cleaned frame -> guarantees 0 edge touches!
  const out = createCanvas(OUT_DIM, OUT_DIM);
  const oCtx = out.getContext('2d');
  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = 'high';

  const cropW = Math.max(1, maxBx - minBx + 1);
  const cropH = Math.max(1, maxBy - minBy + 1);
  const scale = Math.min((OUT_DIM - PAD * 2) / cropW, (OUT_DIM - PAD * 2) / cropH);
  const drawW = Math.round(cropW * scale);
  const drawH = Math.round(cropH * scale);
  const offX = Math.round((OUT_DIM - drawW) / 2);
  const offY = Math.round((OUT_DIM - drawH) / 2);
  oCtx.drawImage(work, minBx, minBy, cropW, cropH, offX, offY, drawW, drawH);

  // 7. Measure { cx, cy, rTuck, rUnder } at 512x512 output resolution
  const outData = oCtx.getImageData(0, 0, OUT_DIM, OUT_DIM).data;
  const cx512 = Math.round(offX + (cxSrc - minBx) * scale);
  const cy512 = Math.round(offY + (cySrc - minBy) * scale);
  const innerSamples = [];
  for (let deg = 0; deg < 360; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (let r = 110; r < 245; r += 1) {
      const sx = Math.round(cx512 + cos * r);
      const sy = Math.round(cy512 + sin * r);
      if (sx < 0 || sy < 0 || sx >= OUT_DIM || sy >= OUT_DIM) break;
      if (outData[(sy * OUT_DIM + sx) * 4 + 3] >= 180) {
        innerSamples.push(r);
        break;
      }
    }
  }
  innerSamples.sort((a, b) => a - b);
  // Median inner bezel radius ~65th percentile (ignores inward pointed crown tips so avatar sits flush under main ring)
  const medianInner = innerSamples.length > 0 ? innerSamples[Math.floor(innerSamples.length * 0.55)] : 168;
  const rTuck = Math.max(145, Math.min(198, Math.round(medianInner + 2)));
  const rUnder = Math.min(220, rTuck + 16);

  // Diagnostics check on cleaned 512x512 output
  let edgePx = 0;
  let centerOpaque = 0;
  let centerTot = 0;
  for (let y = 0; y < OUT_DIM; y += 1) {
    for (let x = 0; x < OUT_DIM; x += 1) {
      const a = outData[(y * OUT_DIM + x) * 4 + 3];
      if ((y < 8 || y >= OUT_DIM - 8 || x < 8 || x >= OUT_DIM - 8) && a > 12) edgePx += 1;
      const distC = Math.hypot(x - cx512, y - cy512);
      if (distC < rTuck - 22) {
        centerTot += 1;
        if (a > 20) centerOpaque += 1;
      }
    }
  }

  return {
    canvas: out,
    metrics: { cx: cx512, cy: cy512, rTuck, rUnder },
    diagnostics: { edgePx, centerPct: +((centerOpaque / Math.max(1, centerTot)) * 100).toFixed(2) },
  };
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
      const timer = setTimeout(() => { ws.off('message', handler); reject(new Error(`CDP ${method} timeout`)); }, timeoutMs);
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
          headers: [{ key: 'Authorization', value: 'Bot {TOKEN_SECRET}' }, { key: 'Content-Type', value: 'application/json' }]
        }
      })
    });
    const j = await r.json().catch(() => ({}));
    return j?.api_data?.response?.items || [];
  })()`);
  return out || [];
}

async function uploadAppEmoji(evalJs, name, dataUri) {
  const payload = JSON.stringify({
    bot_id: BOT_ID,
    request_options: {
      method: 'POST',
      url: `https://discord.com/api/v10/applications/${BOT_ID}/emojis`,
      headers: [
        { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      body: [{ key: 'name', value: name }, { key: 'image', value: dataUri }],
      contentType: 'application/json',
      options: { bodyMode: 'form', contentType: 'application/json', replaceHeaders: true, replaceBody: true },
    },
  });
  const res = await evalJs(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, response: j?.api_data?.response };
  })()`);
  if (!res?.response?.id) throw new Error(`Upload failed for ${name}: ${JSON.stringify(res)}`);
  return res.response;
}

async function processFrames() {
  await fs.promises.mkdir(DEST_FRAMES_DIR, { recursive: true });
  const files = (await fs.promises.readdir(SOURCE_FRAMES_DIR)).filter((f) => /\.(png|webp)$/i.test(f)).sort();
  if (files.length !== 41) {
    throw new Error(`Expected 41 frames in ${SOURCE_FRAMES_DIR}, got ${files.length}`);
  }

  const metricsMap = {};
  const anomalies = [];
  const qaPairs = [];

  for (const fname of files) {
    const frameId = path.basename(fname, path.extname(fname));
    const srcImg = await loadImage(path.join(SOURCE_FRAMES_DIR, fname));
    const { canvas, metrics, diagnostics } = cleanFrameAndComputeMetrics(srcImg);
    const outPath = path.join(DEST_FRAMES_DIR, `${frameId}.png`);
    await fs.promises.writeFile(outPath, canvas.toBuffer('image/png'));
    metricsMap[frameId] = metrics;

    if (diagnostics.edgePx > 0 || diagnostics.centerPct > 0.5) {
      anomalies.push({ frameId, ...diagnostics });
    }
    if (TOP_GLOW_SHOWCASE.includes(fname)) {
      qaPairs.push({ frameId, srcImg, cleanedCanvas: canvas, metrics });
    }
  }

  await fs.promises.writeFile(OUTPUT_METRICS_JSON, JSON.stringify(metricsMap, null, 2), 'utf8');

  // Render Before vs After QA contact sheet on dark #1e1f22 Discord background
  const cellW = 280;
  const cellH = 290;
  const cols = 4; // 2 pairs per row: (Before, After) x 2
  const rows = Math.ceil(qaPairs.length / 2);
  const qa = createCanvas(cols * cellW, rows * cellH);
  const qCtx = qa.getContext('2d');
  qCtx.fillStyle = '#1e1f22';
  qCtx.fillRect(0, 0, qa.width, qa.height);

  qaPairs.forEach((item, idx) => {
    const row = Math.floor(idx / 2);
    const pairCol = (idx % 2) * 2;
    const y0 = row * cellH;
    const xBefore = pairCol * cellW;
    const xAfter = (pairCol + 1) * cellW;

    // Frame borders to clearly see top edge
    qCtx.strokeStyle = '#3f4147';
    qCtx.strokeRect(xBefore + 10, y0 + 10, 250, 250);
    qCtx.strokeRect(xAfter + 10, y0 + 10, 250, 250);

    qCtx.drawImage(item.srcImg, xBefore + 10, y0 + 10, 250, 250);

    // Draw sample circular avatar inside After frame to verify tuck alignment
    const cx = xAfter + 10 + (item.metrics.cx / 512) * 250;
    const cy = y0 + 10 + (item.metrics.cy / 512) * 250;
    const avR = (item.metrics.rTuck / 512) * 250;
    const avGrad = qCtx.createRadialGradient(cx, cy - avR * 0.2, avR * 0.1, cx, cy, avR);
    avGrad.addColorStop(0, '#f472b6');
    avGrad.addColorStop(1, '#4c1d95');
    qCtx.save();
    qCtx.beginPath();
    qCtx.arc(cx, cy, avR, 0, Math.PI * 2);
    qCtx.fillStyle = avGrad;
    qCtx.fill();
    qCtx.restore();

    qCtx.drawImage(item.cleanedCanvas, xAfter + 10, y0 + 10, 250, 250);

    qCtx.fillStyle = '#cbd5e1';
    qCtx.font = 'bold 12px "Segoe UI", Arial';
    qCtx.fillText(`TRƯỚC: ${item.frameId.replace('frame_bond_', '')}`, xBefore + 12, y0 + 278);
    qCtx.fillStyle = '#4ade80';
    qCtx.fillText(`SAU (CLEAN + AVATAR)`, xAfter + 12, y0 + 278);
  });

  await fs.promises.mkdir(path.dirname(QA_SHEET_PATH), { recursive: true });
  await fs.promises.writeFile(QA_SHEET_PATH, qa.toBuffer('image/png'));

  console.log(`[FRAMES OK] Cleaned & installed 41/41 frames -> ${DEST_FRAMES_DIR}`);
  console.log(`[METRICS OK] Saved ${Object.keys(metricsMap).length} frame metrics -> ${OUTPUT_METRICS_JSON}`);
  console.log(`[QA SHEET] Saved Before/After sheet -> ${QA_SHEET_PATH}`);
  console.log(`[ANOMALIES] count=${anomalies.length}`, JSON.stringify(anomalies));
  return { count: files.length, anomalies };
}

async function upload16Emojis() {
  const iconFiles = [];
  for (const sub of fs.readdirSync(SOURCE_ICONS_ROOT)) {
    const subDir = path.join(SOURCE_ICONS_ROOT, sub);
    if (!fs.statSync(subDir).isDirectory()) continue;
    for (const f of fs.readdirSync(subDir)) {
      if (f.endsWith('.png')) iconFiles.push({ name: path.basename(f, '.png'), fullPath: path.join(subDir, f) });
    }
  }
  console.log(`[EMOJIS] Found ${iconFiles.length} icons in ${SOURCE_ICONS_ROOT}`);

  const emojiMap = JSON.parse(await fs.promises.readFile(OUTPUT_EMOJI_JSON, 'utf8'));
  const { ws, evalJs } = await openCdpOnBotGhost();
  try {
    const existingItems = await listExistingAppEmojis(evalJs);
    const existingByName = new Map(existingItems.map((it) => [String(it.name), it]));
    let uploaded = 0;

    for (const icon of iconFiles) {
      const existing = existingByName.get(icon.name);
      if (existing?.id) {
        emojiMap[icon.name] = {
          id: existing.id,
          name: existing.name,
          animated: Boolean(existing.animated),
          tag: existing.animated ? `<a:${existing.name}:${existing.id}>` : `<:${existing.name}:${existing.id}>`,
        };
        console.log(`[EMOJI CACHED] ${icon.name} -> ${emojiMap[icon.name].tag}`);
        continue;
      }
      const buf = await fs.promises.readFile(icon.fullPath);
      const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
      const created = await uploadAppEmoji(evalJs, icon.name, dataUri);
      emojiMap[icon.name] = {
        id: created.id,
        name: created.name,
        animated: Boolean(created.animated),
        tag: created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`,
      };
      uploaded += 1;
      console.log(`[EMOJI UPLOADED] ${icon.name} -> ${emojiMap[icon.name].tag}`);
      await new Promise((r) => setTimeout(r, 850));
    }

    await fs.promises.writeFile(OUTPUT_EMOJI_JSON, JSON.stringify(emojiMap, null, 2), 'utf8');
    console.log(`[EMOJIS DONE] Uploaded=${uploaded}, Total registry keys=${Object.keys(emojiMap).length}`);
  } finally {
    ws.close();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const framesOnly = args.has('--frames-only');
  const emojisOnly = args.has('--emojis-only');

  if (!emojisOnly) await processFrames();
  if (!framesOnly) await upload16Emojis();
}

main().catch((err) => {
  console.error('[install_v1_8b_assets] FAILED:', err);
  process.exit(1);
});
