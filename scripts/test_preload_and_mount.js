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

  console.log('Preloading /dashboard/builder bundle...');
  const preloadRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let bH = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.pageFor) bH = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const r = bH.pageFor('/dashboard/builder');
      try {
        await r.preload();
        return { preloaded: true, isLoaded: r.isLoaded() };
      } catch (e) {
        return { error: e.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Preload result:', JSON.stringify(preloadRes.result?.value, null, 2));

  console.log('Now triggering bH.navigated({ pathname: "/dashboard/builder" })...');
  const navRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let bH = null;
      let history = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.pageFor) bH = fiber.stateNode;
        if (fiber.memoizedProps?.history) history = fiber.memoizedProps.history;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      history.push('/dashboard/builder');
      bH.navigated(history.location);
      return { pushed: true };
    })()`,
    returnByValue: true
  });

  console.log('Navigated result:', navRes.result?.value);
  await sleep(3000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        url: window.location.href,
        hasCb: !!cb,
        elementsCount: cb?.props?.elements?.length,
        hasReactFlow: !!document.querySelector('.react-flow')
      };
    })()`,
    returnByValue: true
  });

  console.log('After preload & navigated check:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
