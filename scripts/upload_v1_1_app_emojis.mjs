import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const SRC_GIF_ROOT = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_1_44/SuMi_v1_1_44_GIF/assets';
const SRC_PNG_ROOT = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/SuMi_v1_1_44/SuMi_v1_1_44_PNG/assets';
const TOWER_ICON_PNG = path.resolve('assets/shop/tower_reset_card_icon.png');
const OUTPUT_JSON = path.resolve('src/config/custom_emojis.json');

async function getTabs() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  return res.json();
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
  return cdp.eval(`(async () => {
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
    return { status: appRes.status, items: appData?.api_data?.response?.items || [], raw: appData };
  })()`);
}

async function uploadOneViaBotGhost(cdp, name, dataUri) {
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

  return cdp.eval(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, apiStatus: j?.api_data?.status, headers: j?.api_data?.headers, response: j?.api_data?.response, message: j?.message || j?.error };
  })()`, 25000);
}

async function resizePngToDataUri(pngPath, size = 128) {
  const img = await loadImage(pngPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const buf = canvas.toBuffer('image/png');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function collectV11Emojis() {
  const list = [];

  for (const f of fs.readdirSync(path.join(SRC_GIF_ROOT, 'badges')).sort()) {
    if (!f.endsWith('.gif')) continue;
    const base = path.basename(f, '.gif');
    const name = `su_${base}`;
    const gifPath = path.join(SRC_GIF_ROOT, 'badges', f);
    const pngPath = path.join(SRC_PNG_ROOT, 'badges', `${base}.png`);
    const b64 = fs.readFileSync(gifPath).toString('base64');
    list.push({ name, animated: true, dataUri: `data:image/gif;base64,${b64}`, fallbackPng: pngPath });
  }

  for (const f of fs.readdirSync(path.join(SRC_GIF_ROOT, 'items')).sort()) {
    if (!f.endsWith('.gif')) continue;
    const base = path.basename(f, '.gif');
    const name = `su_${base}`;
    const gifPath = path.join(SRC_GIF_ROOT, 'items', f);
    const pngPath = path.join(SRC_PNG_ROOT, 'items', `${base}.png`);
    const b64 = fs.readFileSync(gifPath).toString('base64');
    list.push({ name, animated: true, dataUri: `data:image/gif;base64,${b64}`, fallbackPng: pngPath });
  }

  for (const f of fs.readdirSync(path.join(SRC_GIF_ROOT, 'pets')).sort()) {
    if (!f.endsWith('.gif')) continue;
    const base = path.basename(f, '.gif');
    const name = `su_pet_${base}`;
    const gifPath = path.join(SRC_GIF_ROOT, 'pets', f);
    const pngPath = path.join(SRC_PNG_ROOT, 'pets', `${base}.png`);
    const b64 = fs.readFileSync(gifPath).toString('base64');
    list.push({ name, animated: true, dataUri: `data:image/gif;base64,${b64}`, fallbackPng: pngPath });
  }

  const cardB64 = fs.readFileSync(TOWER_ICON_PNG).toString('base64');
  list.push({
    name: 'su_tower_reset_card',
    animated: false,
    dataUri: `data:image/png;base64,${cardB64}`,
    fallbackPng: TOWER_ICON_PNG,
  });

  for (const item of list) {
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(item.name)) {
      throw new Error(`Invalid Discord emoji name "${item.name}" (len=${item.name.length})`);
    }
  }
  return list;
}

async function main() {
  const files = collectV11Emojis();
  console.log(`Prepared ${files.length} v1.1 emojis (max name len=${Math.max(...files.map((x) => x.name.length))})`);

  const tabs = await getTabs();
  const bgTab = tabs.find((t) => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) throw new Error('BotGhost tab not found on CDP 9222');

  const bgCdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await bgCdp.connect();

  try {
    const existingRes = await listAppEmojisViaBotGhost(bgCdp);
    const existingItems = existingRes.items || [];
    console.log(`Current Application Emojis on Discord (${BOT_ID}): ${existingItems.length}`);
    const byName = new Map(existingItems.map((e) => [e.name, e]));

    const missing = files.filter((f) => !byName.has(f.name));
    console.log(`Missing v1.1 emojis to upload: ${missing.length}`);

    for (let i = 0; i < missing.length; i += 1) {
      const item = missing[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 1200));

      let uploaded = null;
      let currentDataUri = item.dataUri;
      let triedFallback = false;

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const res = await uploadOneViaBotGhost(bgCdp, item.name, currentDataUri);
        if (res.response?.id) {
          uploaded = res.response;
          break;
        }
        const retrySec = Number(res.response?.retry_after || 0);
        if (res.apiStatus === 429 || retrySec > 0) {
          const waitMs = Math.ceil((retrySec || 2) * 1000) + 500;
          console.warn(`[429] Waiting ${waitMs}ms for ${item.name}...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        const errMsg = JSON.stringify(res.response || res);
        if (!triedFallback && item.fallbackPng && fs.existsSync(item.fallbackPng) && (res.apiStatus === 400 || errMsg.toLowerCase().includes('size') || errMsg.toLowerCase().includes('image'))) {
          console.warn(`[Fallback PNG] ${item.name} rejected as GIF (${errMsg}); resizing ${item.fallbackPng} to 128x128 PNG...`);
          currentDataUri = await resizePngToDataUri(item.fallbackPng, 128);
          triedFallback = true;
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw new Error(`Upload failed for ${item.name} (attempt ${attempt}): ${errMsg}`);
      }
      if (!uploaded) throw new Error(`Exhausted retries uploading ${item.name}`);
      byName.set(uploaded.name, uploaded);
      console.log(`[${i + 1}/${missing.length}] Uploaded ${uploaded.name} -> ${uploaded.id} (animated=${uploaded.animated})`);
    }

    const finalRes = await listAppEmojisViaBotGhost(bgCdp);
    const finalItems = finalRes.items || [];
    for (const e of finalItems) byName.set(e.name, e);

    const existingJson = fs.existsSync(OUTPUT_JSON) ? JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8')) : {};
    for (const f of files) {
      const found = byName.get(f.name);
      if (!found?.id) {
        throw new Error(`Missing emoji ID after upload for ${f.name}`);
      }
      const anim = Boolean(found.animated);
      existingJson[f.name] = {
        id: found.id,
        name: found.name,
        animated: anim,
        tag: anim ? `<a:${found.name}:${found.id}>` : `<:${found.name}:${found.id}>`,
      };
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(existingJson, null, 2), 'utf8');
    console.log(`Merged custom_emojis.json successfully! Total entries: ${Object.keys(existingJson).length}`);
  } finally {
    bgCdp.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
