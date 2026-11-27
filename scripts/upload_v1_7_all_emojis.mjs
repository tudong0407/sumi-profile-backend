/**
 * scripts/upload_v1_7_all_emojis.mjs
 * Upload toàn bộ 260 icon cơ bản mới (60 Pet, 99 Pháp Bảo, 35 Linh Vực, 33 Thần Thức, 33 Thần Cảnh)
 * + 40 icon Pet Tiến Hóa Chân Thần (*_evo.webp) = 300 Discord Application Emojis
 * qua BotGhost proxy /api/dashboard/test_api_action (Edge CDP 9222).
 * Idempotent & resumable: lưu src/config/custom_emojis.json ngay sau mỗi emoji.
 *
 * Usage:
 *   node scripts/upload_v1_7_all_emojis.mjs --dry-run
 *   node scripts/upload_v1_7_all_emojis.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  V17_PET_EVOLUTIONS,
} from '../src/data/catalog.js';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const BACKEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const ASSETS_ROOT = path.join(BACKEND_ROOT, 'assets');
const OUTPUT_JSON = path.join(BACKEND_ROOT, 'src', 'config', 'custom_emojis.json');

function resolveAssetPath(candidates) {
  for (const rel of candidates) {
    const full = path.join(ASSETS_ROOT, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function buildMissingEmojiTasks(existingJsonMap) {
  const tasks = [];
  const seen = new Set();
  const push = (name, relCandidates, kind) => {
    if (seen.has(name) || existingJsonMap[name]?.id) return;
    const srcPath = resolveAssetPath(relCandidates);
    if (!srcPath) throw new Error(`Missing local asset file for ${kind}:${name} (checked ${relCandidates.join(', ')})`);
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(name)) throw new Error(`Invalid Discord emoji name: ${name}`);
    seen.add(name);
    tasks.push({ name, srcPath, kind });
  };

  for (const p of PET_CATALOG) {
    if (p.is_exclusive_fuyumi) continue;
    push(p.pet_type, [`pets/${p.pet_type}.webp`, `pets/${p.pet_type}.png`], 'pet');
  }
  for (const [petType, evo] of Object.entries(V17_PET_EVOLUTIONS || {})) {
    const key = `${petType}_evo`;
    const rel = evo?.evo_image_file || `pets/${key}.webp`;
    push(key, [rel, `pets/${key}.webp`, `pets/${key}.png`], 'pet_evo');
  }
  for (const it of EQUIPMENT_CATALOG) {
    push(it.item_id, [`items/${it.item_id}.webp`, `items/${it.item_id}.png`], 'equip');
  }
  for (const d of DOMAIN_CATALOG) {
    if (d.is_exclusive_fuyumi) continue;
    push(d.domain_id, [`domains/${d.domain_id}.webp`, `domains/${d.domain_id}.png`], 'domain');
  }
  for (const s of DIVINE_SENSE_CATALOG) {
    if (s.is_exclusive_fuyumi) continue;
    push(s.sense_id, [`domains/${s.sense_id}.webp`, `domains/${s.sense_id}.png`], 'sense');
  }
  for (const r of DIVINE_REALM_CATALOG) {
    if (r.is_exclusive_fuyumi) continue;
    push(r.realm_id, [`domains/${r.realm_id}.webp`, `domains/${r.realm_id}.png`], 'realm');
  }

  return tasks;
}

async function encodeEmoji128PngUnder256Kb(srcPath) {
  const raw = fs.readFileSync(srcPath);
  const img = await loadImage(raw);
  for (const dim of [128, 112, 96, 80]) {
    const c = createCanvas(dim, dim);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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

  for (let attempt = 1; attempt <= 6; attempt += 1) {
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
      const waitSec = Math.min(25, Math.max(2, Number(res?.response?.retry_after || 4)));
      console.log(`[429] Rate limited on ${name}, waiting ${waitSec}s (attempt ${attempt}/6)...`);
      await new Promise((r) => setTimeout(r, (waitSec + 0.6) * 1000));
      continue;
    }
    if (res?.httpStatus < 400 && res?.apiStatus < 400 && res?.response?.id) {
      return res.response;
    }
    if (attempt === 6) {
      throw new Error(`Upload failed for ${name}: ${JSON.stringify(res)}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`Upload failed for ${name} after retries`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const emojiMap = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
  const tasks = buildMissingEmojiTasks(emojiMap);
  const byKind = {};
  for (const t of tasks) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
  console.log(`[EMOJI] Missing tasks=${tasks.length} | breakdown=${JSON.stringify(byKind)} | existing=${Object.keys(emojiMap).length}`);

  if (dryRun || tasks.length === 0) return;

  const { ws, evalJs } = await openCdpOnBotGhost();
  try {
    const existingItems = await listExistingAppEmojis(evalJs);
    const existingByName = new Map(existingItems.map((it) => [String(it.name), it]));
    console.log(`[EMOJI] Discord currently holds ${existingItems.length} Application Emojis.`);

    let uploaded = 0;
    let reused = 0;
    for (let i = 0; i < tasks.length; i += 1) {
      const t = tasks[i];
      const existing = existingByName.get(t.name);
      if (existing?.id) {
        emojiMap[t.name] = {
          id: existing.id,
          name: existing.name,
          animated: Boolean(existing.animated),
          tag: existing.animated ? `<a:${existing.name}:${existing.id}>` : `<:${existing.name}:${existing.id}>`,
        };
        reused += 1;
        if (reused <= 5 || reused % 25 === 0) {
          console.log(`[EMOJI][REUSE ${reused}] ${t.name} -> ${existing.id}`);
        }
      } else {
        const buf = await encodeEmoji128PngUnder256Kb(t.srcPath);
        const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
        const created = await uploadOneEmojiViaProxy(evalJs, t.name, dataUri);
        emojiMap[t.name] = {
          id: created.id,
          name: created.name,
          animated: Boolean(created.animated),
          tag: created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`,
        };
        uploaded += 1;
        if (uploaded <= 10 || uploaded % 15 === 0 || i === tasks.length - 1) {
          console.log(`[EMOJI][${i + 1}/${tasks.length}] uploaded=${uploaded} ${t.name} (${(buf.length / 1024).toFixed(1)}KB) -> ${created.id}`);
        }
        await new Promise((r) => setTimeout(r, 1050));
      }
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(emojiMap, null, 2), 'utf8');
    }
    console.log(`[EMOJI] Completed! uploaded=${uploaded}, reused=${reused}, total in custom_emojis.json=${Object.keys(emojiMap).length}`);
  } finally {
    ws.close();
  }
}

main().catch((err) => {
  console.error('[upload_v1_7_all_emojis] FAILED:', err);
  process.exit(1);
});
