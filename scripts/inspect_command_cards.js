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
      // Find all command cards in the list
      const cards = Array.from(document.querySelectorAll('div')).filter(d => {
        const text = d.textContent.trim();
        return text.startsWith('/') && d.querySelector('button');
      });

      // Let's inspect all h1..h5, strong, or specific headers
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong'))
        .map(h => h.textContent.trim())
        .filter(t => t.startsWith('/') || t.includes('profile') || t.includes('rank'));

      // Also inspect Redux keys on st.data
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
      const st = store?.getState();
      const bot = st?.data?.bot;

      return {
        headings: [...new Set(headings)],
        botKeys: Object.keys(bot || {}),
        commandsObjKeys: Object.keys(bot?.commands || {})
      };
    })()`,
    returnByValue: true
  });

  console.log('Command list info:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
