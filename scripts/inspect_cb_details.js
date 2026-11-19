import http from 'http';
import WebSocket from 'ws';

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

      // Use lz-string from window or modules if available
      // Or find lz in webpack/vite chunk
      return {
        profile: {
          name: profile.name,
          rawTree: profile.tree ? JSON.stringify(profile.tree).slice(0, 500) : null,
          hasCompressed: !!profile.compressed_tree,
          compressedLen: profile.compressed_tree?.length
        },
        rank: {
          name: rank.name,
          rawTree: rank.tree ? JSON.stringify(rank.tree).slice(0, 500) : null,
          hasCompressed: !!rank.compressed_tree,
          compressedLen: rank.compressed_tree?.length
        }
      };
    })()`,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res, null, 2));
  ws.close();
}

main().catch(console.error);
