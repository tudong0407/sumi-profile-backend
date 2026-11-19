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
  const renderTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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
      // Find Free plan element
      const allEls = Array.from(document.querySelectorAll('*'));
      const freeEl = allEls.find(e => e.children.length === 0 && e.textContent.trim() === 'Free');
      const addEnvBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add from .env'));
      const deployBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Deploy web service'));

      return {
        hasFree: !!freeEl,
        freeParent: freeEl ? freeEl.closest('button, [role="radio"], div[tabindex]')?.tagName : null,
        hasAddEnv: !!addEnvBtn,
        hasDeploy: !!deployBtn
      };
    })()`,
    returnByValue: true
  });

  console.log('Inspection:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
