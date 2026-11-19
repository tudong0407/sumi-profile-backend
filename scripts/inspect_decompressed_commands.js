import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
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
      
      const st = store ? store.getState() : null;
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const profile = slashCmds[37];
      const rank = slashCmds[38];

      return {
        profileCompressed: profile.compressed_tree,
        rankCompressed: rank.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const { profileCompressed, rankCompressed } = res.result.value;

  const profileDecompressed = JSON.parse(LZString.decompressFromBase64(profileCompressed));
  const rankDecompressed = JSON.parse(LZString.decompressFromBase64(rankCompressed));

  console.log('=== PROFILE DECOMPRESSED ELEMENTS ===');
  console.log(JSON.stringify(profileDecompressed, null, 2));

  console.log('=== RANK DECOMPRESSED ELEMENTS ===');
  console.log(JSON.stringify(rankDecompressed, null, 2));

  ws.close();
}

main().catch(console.error);
