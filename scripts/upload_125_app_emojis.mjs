import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const GIF_DIR = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/Discord_Ready_125_Emojis/01_Animated_GIF_61';
const PNG_DIR = 'D:/Files/Botghost - Nhiem Nhiem/Full AI Gen/Discord_Ready_125_Emojis/02_Static_PNG_64';
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
  async eval(expr, timeoutMs = 25000) {
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
    return { status: appRes.status, items: appData?.api_data?.response?.items || [], raw: appData };
  })()`);
  return res;
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

  const res = await cdp.eval(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, apiStatus: j?.api_data?.status, headers: j?.api_data?.headers, response: j?.api_data?.response, message: j?.message || j?.error };
  })()`, 25000);
  return res;
}

async function uploadOneViaDiscordWeb(dcCdp, name, dataUri) {
  const payload = JSON.stringify({ name, image: dataUri });
  return dcCdp.eval(`(async () => {
    if (!window.__fuyumiToken) {
      window.webpackChunkdiscord_app.push([['tok_' + Math.random()], {}, (req) => {
        for (const id in req.c) {
          const exp = req.c[id]?.exports?.default || req.c[id]?.exports;
          if (exp && typeof exp.getToken === 'function') {
            try {
              const t = exp.getToken();
              if (t && typeof t === 'string' && t.length > 20) window.__fuyumiToken = t;
            } catch {}
          }
        }
      }]);
    }
    const r = await fetch('https://discord.com/api/v10/applications/${BOT_ID}/emojis', {
      method: 'POST',
      headers: {
        'Authorization': window.__fuyumiToken,
        'Content-Type': 'application/json'
      },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return { apiStatus: r.status, response: j };
  })()`, 25000);
}

function collectFiles() {
  const list = [];
  for (const f of fs.readdirSync(GIF_DIR).sort()) {
    if (!f.endsWith('.gif')) continue;
    const name = path.basename(f, '.gif');
    const b64 = fs.readFileSync(path.join(GIF_DIR, f)).toString('base64');
    list.push({ name, animated: true, dataUri: `data:image/gif;base64,${b64}`, file: path.join(GIF_DIR, f) });
  }
  for (const f of fs.readdirSync(PNG_DIR).sort()) {
    if (!f.endsWith('.png')) continue;
    const name = path.basename(f, '.png');
    const b64 = fs.readFileSync(path.join(PNG_DIR, f)).toString('base64');
    list.push({ name, animated: false, dataUri: `data:image/png;base64,${b64}`, file: path.join(PNG_DIR, f) });
  }
  for (const item of list) {
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(item.name)) {
      throw new Error(`Invalid Discord emoji name "${item.name}" (len=${item.name.length}, must be 2..32 alphanumeric/underscore)`);
    }
  }
  return list;
}

async function main() {
  const testOne = process.argv.includes('--test-one');
  const validateNamesOnly = process.argv.includes('--check-names');
  const files = collectFiles();
  console.log(`Validated ${files.length} emoji files (61 GIF + 64 PNG). Max name length: ${Math.max(...files.map(x => x.name.length))}`);
  if (validateNamesOnly) return;

  const tabs = await getTabs();
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) throw new Error('BotGhost tab not found on CDP 9222');

  const bgCdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await bgCdp.connect();

  let dcCdp = null;
  const dcTab = tabs.find(t => t.url?.includes('discord.com/channels') && t.type === 'page');

  try {
    const existingRes = await listAppEmojisViaBotGhost(bgCdp);
    const existingItems = existingRes.items || [];
    console.log(`Current Application Emojis on ${BOT_ID}: ${existingItems.length}`);
    const byName = new Map(existingItems.map(e => [e.name, e]));

    const missing = files.filter(f => !byName.has(f.name));
    console.log(`Missing su_* emojis to upload: ${missing.length}`);

    if (missing.length > 0) {
      let useDiscordWeb = false;
      const first = missing[0];
      console.log(`Testing upload of first emoji "${first.name}" (${first.animated ? 'GIF' : 'PNG'}) via BotGhost test_api_action...`);
      const testRes = await uploadOneViaBotGhost(bgCdp, first.name, first.dataUri);
      console.log('BotGhost test upload result:', JSON.stringify({ httpStatus: testRes.httpStatus, apiStatus: testRes.apiStatus, id: testRes.response?.id, name: testRes.response?.name, msg: testRes.message, err: testRes.response?.message }));

      if (testRes.response?.id) {
        byName.set(first.name, testRes.response);
      } else {
        console.log('BotGhost POST did not succeed, testing Discord Web tab fallback...');
        if (!dcTab) throw new Error('BotGhost POST failed and Discord tab not found on CDP 9222');
        dcCdp = new SimpleCdp(dcTab.webSocketDebuggerUrl);
        await dcCdp.connect();
        const dcTest = await uploadOneViaDiscordWeb(dcCdp, first.name, first.dataUri);
        console.log('Discord Web test upload result:', JSON.stringify(dcTest));
        if (!dcTest.response?.id) {
          throw new Error('Both BotGhost and Discord Web POST failed: ' + JSON.stringify(dcTest));
        }
        byName.set(first.name, dcTest.response);
        useDiscordWeb = true;
      }

      if (testOne) {
        console.log('--test-one finished successfully!');
        return;
      }

      const rest = missing.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const item = rest[i];
        await new Promise(r => setTimeout(r, 1100));
        let uploaded = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const res = useDiscordWeb
            ? await uploadOneViaDiscordWeb(dcCdp, item.name, item.dataUri)
            : await uploadOneViaBotGhost(bgCdp, item.name, item.dataUri);

          if (res.response?.id) {
            uploaded = res.response;
            break;
          }
          const retrySec = Number(res.response?.retry_after || 0);
          if (res.apiStatus === 429 || retrySec > 0) {
            const waitMs = Math.ceil((retrySec || 2) * 1000) + 500;
            console.warn(`[429 Rate limit] Waiting ${waitMs}ms before retrying ${item.name}...`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          throw new Error(`Upload failed for ${item.name} (attempt ${attempt}): ${JSON.stringify(res)}`);
        }
        if (!uploaded) throw new Error(`Exhausted retries uploading ${item.name}`);
        byName.set(uploaded.name, uploaded);
        if ((i + 1) % 10 === 0 || i === rest.length - 1) {
          console.log(`Uploaded ${i + 2}/${missing.length}: ${uploaded.name} -> ${uploaded.id} (animated=${uploaded.animated})`);
        }
      }
    }

    // Refresh final canonical list from Discord Application Emojis API
    const finalRes = await listAppEmojisViaBotGhost(bgCdp);
    const finalItems = finalRes.items || [];
    const mapping = {};
    for (const f of files) {
      const found = finalItems.find(e => e.name === f.name) || byName.get(f.name);
      if (!found?.id) {
        throw new Error(`Missing emoji ID in final verification for ${f.name}`);
      }
      const anim = Boolean(found.animated);
      mapping[f.name] = {
        id: found.id,
        name: found.name,
        animated: anim,
        tag: anim ? `<a:${found.name}:${found.id}>` : `<:${found.name}:${found.id}>`,
      };
    }

    fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(mapping, null, 2), 'utf8');
    console.log(`Saved ${Object.keys(mapping).length} custom emojis to ${OUTPUT_JSON}`);
  } finally {
    bgCdp.close();
    if (dcCdp) dcCdp.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
