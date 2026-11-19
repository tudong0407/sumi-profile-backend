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
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let types = [];
      let currentCommand = null;
      function walk(fiber) {
        if (!fiber) return;
        if (typeof fiber.type === 'string') types.push(fiber.type);
        else if (fiber.type?.name) types.push(fiber.type.name);
        else if (fiber.type?.displayName) types.push(fiber.type.displayName);
        if (fiber.memoizedProps?.command) currentCommand = fiber.memoizedProps.command;
        walk(fiber.child);
        walk(fiber.sibling);
      }
      walk(root[key]);

      return {
        url: window.location.href,
        hasFlow: !!document.querySelector('.react-flow'),
        currentCommand: currentCommand ? { id: currentCommand.id, name: currentCommand.name } : null,
        topTypes: [...new Set(types)].slice(0, 30)
      };
    })()`,
    returnByValue: true
  });

  console.log('React tree:\n', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
