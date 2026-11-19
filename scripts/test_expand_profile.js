import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 20000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
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

  console.log('1. Clicking /profile H3...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3s = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.trim() === '/profile');
      if (h3s.length === 0) return { error: 'No /profile H3' };
      h3s[0].click();
      return { clickedH3: true };
    })()`,
    returnByValue: true
  });
  console.log('Click H3:', clickRes.result?.value);
  await sleep(1500);

  console.log('2. Looking for Open builder button inside /profile card...');
  const btnRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => b.textContent?.includes('builder') || b.textContent?.includes('Builder'));
      return btns.map(b => ({
        text: b.textContent.trim(),
        visible: b.offsetParent !== null
      }));
    })()`,
    returnByValue: true
  });
  console.log('Builder buttons found:', btnRes.result?.value);

  console.log('3. Clicking Open builder button...');
  const openRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => b.textContent?.includes('builder') || b.textContent?.includes('Builder'));
      if (btns.length === 0) return { error: 'No builder button' };
      btns[0].click();
      return { clickedOpenBuilder: true };
    })()`,
    returnByValue: true
  });
  console.log('Open builder result:', openRes.result?.value);
  await sleep(3500);

  console.log('4. Checking mounted CommandBuilder...');
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
        mode: cb?.props?.mode,
        index: cb?.props?.index,
        isValid: cb ? cb.validateSave() : null,
        elementsCount: cb?.props?.elements?.length
      };
    })()`,
    returnByValue: true
  });
  console.log('CB status:', cbRes.result?.value);

  ws.close();
}

main().catch(console.error);
