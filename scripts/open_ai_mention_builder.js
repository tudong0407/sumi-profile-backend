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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

  console.log('1. Expanding "Nhiễm Nhiễm — AI Mention" accordion...');
  const expandRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('Nhiễm Nhiễm — AI Mention'));
      if (!h3) return { error: 'H3 not found' };
      h3.click();
      return { clickedH3: true };
    })()`,
    returnByValue: true
  });

  console.log('Expand result:', expandRes.result?.value);
  await sleep(1500);

  console.log('2. Clicking "Open builder" button...');
  const openRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const openBtn = btns.find(b => b.textContent?.includes('Open builder') && b.offsetParent !== null);
      if (!openBtn) return { error: 'Open builder button not found' };
      openBtn.click();
      return { clickedOpenBuilder: true };
    })()`,
    returnByValue: true
  });

  console.log('Open builder result:', openRes.result?.value);
  await sleep(4000);

  console.log('3. Checking if CommandBuilder is mounted...');
  const cbRes = await send('Runtime.evaluate', {
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
        url: window.location.href,
        hasCb: !!cb,
        elementsCount: cb?.props?.elements?.length,
        isValid: cb?.validateSave ? cb.validateSave() : null,
        eventName: cb?.props?.event?.name || cb?.props?.command?.name
      };
    })()`,
    returnByValue: true
  });

  console.log('CB status:', JSON.stringify(cbRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
