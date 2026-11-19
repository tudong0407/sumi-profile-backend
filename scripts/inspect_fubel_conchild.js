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
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
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

      const events = store?.getState()?.data?.bot?.commands?.custom_events?.events || [];
      const fubelV2 = events.find(e => e.name === 'Automod Fubel v2');
      return fubelV2?.compressed_tree;
    })()`,
    returnByValue: true
  });

  const tree = JSON.parse(LZString.decompressFromBase64(res.result?.value));
  console.log('Total nodes:', tree.length);
  const types = [...new Set(tree.map(n => n.type))];
  console.log('Node types:', types);

  // Conchild nodes
  const conChildren = tree.filter(n => n.type === 'conChild' || n.type === 'conchild' || n.id?.startsWith('branch_') || n.id?.startsWith('conChild_'));
  console.log('conChild nodes found:', conChildren.length);
  conChildren.forEach(c => {
    console.log(`- ${c.id}: pattern=${c.data?.data?.value?.slice(0, 60)}...`);
  });

  ws.close();
}

main().catch(console.error);
