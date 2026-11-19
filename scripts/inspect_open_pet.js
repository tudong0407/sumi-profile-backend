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

  console.log('Clicking "Open builder" on /pet...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const openBtn = btns.find(b => b.textContent.includes('Open builder'));
      if (openBtn) {
        openBtn.click();
        return { clicked: true };
      }
      return { clicked: false, btns: btns.map(b => b.textContent.trim()).filter(Boolean).slice(0, 10) };
    })()`,
    returnByValue: true
  });

  console.log('Open builder click:', clickRes.result?.value);
  await sleep(4000);

  // Inspect CommandBuilder state for /pet
  const cbInfo = await send('Runtime.evaluate', {
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

      const st = store?.getState();
      const bld = st?.builder;

      return {
        url: window.location.href,
        hasCb: !!cb,
        isValid: cb ? cb.validateSave() : null,
        builderIndex: bld?.index,
        elementsCount: bld?.elements?.length,
        hasNoProblems: document.body.innerText.includes('No problems'),
        badgeText: Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Problem') || b.textContent.includes('problem'))?.textContent.trim()
      };
    })()`,
    returnByValue: true
  });

  console.log('CommandBuilder state for /pet:\n', JSON.stringify(cbInfo.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
