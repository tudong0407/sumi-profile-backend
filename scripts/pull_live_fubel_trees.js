import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';
import fs from 'fs';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const handler = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);
      const events = store?.getState()?.data?.bot?.commands?.custom_events?.events || [];
      const evV2 = events.find(e => e.name === 'Automod Fubel v2');
      const evEdit = events.find(e => e.name === 'Automod Fubel (Edit)');
      return {
        v2Tree: evV2?.compressed_tree,
        editTree: evEdit?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  ws.close();

  const { v2Tree, editTree } = res.result.value;
  console.log('Got trees from Cloud. v2 length:', v2Tree?.length, 'edit length:', editTree?.length);

  const v2Json = JSON.parse(LZString.decompressFromBase64(v2Tree));
  const editJson = JSON.parse(LZString.decompressFromBase64(editTree));

  fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_live.json', JSON.stringify(v2Json, null, 2));
  fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_live.json', JSON.stringify(editJson, null, 2));

  console.log('Saved automod_fubel_v2_live.json (', v2Json.length, 'elements )');
  console.log('Saved automod_fubel_edit_live.json (', editJson.length, 'elements )');
}

main().catch(console.error);
