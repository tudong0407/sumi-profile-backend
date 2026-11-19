import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

ws.on('open', async () => {
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (d) => {
      const msg = JSON.parse(d);
      if (msg.id === id) {
        ws.off('message', h);
        resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  console.log('Finding and clicking button for /profile...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('/profile') && b.textContent.includes('Open builder'));
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', res.result?.value);
  await sleep(3000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
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
        url: window.location.href,
        hasCb: !!cb,
        cmdTitle: cb?.props?.command?.name || cb?.state?.name,
        elementsCount: cb?.props?.elements?.length
      };
    })()`,
    returnByValue: true
  });
  console.log('Check cb:', check.result?.value);

  ws.close();
});
