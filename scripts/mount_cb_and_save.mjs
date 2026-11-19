import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    const timeout = setTimeout(() => reject(new Error(`CDP Timeout on ${method}`)), 20000);
    const h = (d) => {
      const msg = JSON.parse(d);
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  console.log('Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  // Click "Build a new command" button
  console.log('Clicking "Build a new command"...');
  const clickBuild = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Build a new command'));
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Click build:', clickBuild.result?.value);
  await sleep(4000);

  // Check if cb mounted
  const checkCb = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        hasCb: !!cb,
        cbMethods: cb ? Object.keys(cb) : [],
        cbProps: cb ? Object.keys(cb.props) : []
      };
    })()`,
    returnByValue: true
  });
  console.log('checkCb:', checkCb.result?.value);

  ws.close();
}

main().catch(console.error);
