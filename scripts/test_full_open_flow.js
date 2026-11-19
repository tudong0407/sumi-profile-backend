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

  console.log('1. Checking current page...');
  const navRes = await send('Runtime.evaluate', {
    expression: `(() => {
      // If not on customevents, navigate there
      if (!window.location.href.includes('/customevents')) {
        return { needNav: true, currentUrl: window.location.href };
      }
      return { needNav: false, currentUrl: window.location.href };
    })()`,
    returnByValue: true
  });
  console.log('Current page:', navRes.result?.value);

  if (navRes.result?.value?.needNav) {
    console.log('Navigating to customevents...');
    await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
    await sleep(4000);
  }

  console.log('2. Clicking H3 of Automod Fubel v2...');
  const clickH3 = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim() === 'Automod Fubel v2');
      if (!h3) return { error: 'h3 not found' };
      h3.click();
      return { clickedH3: true };
    })()`,
    returnByValue: true
  });
  console.log('Click H3:', clickH3.result?.value);
  await sleep(1500);

  console.log('3. Finding and clicking Open builder button...');
  const clickOpen = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const openBtn = btns.find(b => b.textContent?.includes('Open builder') && b.textContent?.includes('Automod Fubel v2'));
      if (!openBtn) return { error: 'openBtn not found' };
      
      const r = openBtn.getBoundingClientRect();
      openBtn.click();
      return { clickedOpen: true, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
    })()`,
    returnByValue: true
  });
  console.log('Click Open:', clickOpen.result?.value);

  console.log('4. Waiting 4 seconds for CommandBuilder to mount...');
  await sleep(4000);

  const check = await send('Runtime.evaluate', {
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

  console.log('Final CB check:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
