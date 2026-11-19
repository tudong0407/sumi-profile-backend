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

  console.log('1. Navigating to /dashboard/customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  console.log('2. Inspecting custom commands list...');
  const listRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const cardHeaders = Array.from(document.querySelectorAll('h3, h4, span, div'))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.startsWith('/'));
      return Array.from(new Set(cardHeaders));
    })()`,
    returnByValue: true
  });
  console.log('Found slash command headings:', listRes.result?.value);

  console.log('3. Clicking /profile card...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('div, button, h3, h4, span'))
        .filter(el => el.textContent?.trim() === '/profile');
      if (cards.length === 0) return { error: 'Not found' };
      // click the outermost card or header
      cards[0].click();
      return { clicked: true, tagName: cards[0].tagName, text: cards[0].textContent };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result?.value);
  await sleep(1500);

  console.log('4. Finding Open builder button...');
  const btnRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => b.textContent?.includes('builder') || b.textContent?.includes('Builder') || b.textContent?.includes('Open'));
      return btns.map(b => ({ text: b.textContent.trim(), disabled: b.disabled }));
    })()`,
    returnByValue: true
  });
  console.log('Available buttons in card:', btnRes.result?.value);

  const clickBuilder = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => b.textContent?.includes('Open builder') || b.textContent?.includes('builder'));
      if (btns.length === 0) return { error: 'No builder button' };
      btns[0].click();
      return { clicked: true, text: btns[0].textContent.trim() };
    })()`,
    returnByValue: true
  });
  console.log('Click builder result:', clickBuilder.result?.value);
  await sleep(4000);

  console.log('5. Inspecting mounted CommandBuilder...');
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
        hasCb: !!cb,
        mode: cb?.props?.mode,
        index: cb?.props?.index,
        isValid: cb ? cb.validateSave() : null,
        elementsCount: cb?.props?.elements?.length
      };
    })()`,
    returnByValue: true
  });
  console.log('CB status after opening:', cbRes.result?.value);

  ws.close();
}

main().catch(console.error);
