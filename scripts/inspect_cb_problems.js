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
      const probBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Problem'));
      if (probBtn) probBtn.click();

      const items = Array.from(document.querySelectorAll('[role="dialog"] *, [class*="problem"], [class*="error"]'))
        .map(e => e.textContent.trim())
        .filter(t => t.length > 5 && t.length < 200);

      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        problems: [...new Set(items)].slice(0, 5),
        cbElements: cb?.props?.elements?.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target }))
      };
    })()`,
    returnByValue: true
  });

  console.log('Problems check:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
