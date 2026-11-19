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

  console.log('Clicking H3 /profile...');
  const clickH3 = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim() === '/profile');
      if (h3) {
        h3.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('clickH3:', clickH3.result?.value);
  await sleep(1500);

  console.log('Finding Open builder button for /profile...');
  const clickBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button, span')).filter(b => b.textContent.includes('Open builder'));
      if (btns.length > 0) {
        btns[0].click();
        return { clicked: true, text: btns[0].textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('clickBtn:', clickBtn.result?.value);
  await sleep(4000);

  // Check URL and cb
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
        cmdName: cb?.props?.command?.name || cb?.state?.name
      };
    })()`,
    returnByValue: true
  });
  console.log('After navigation check:', check.result?.value);

  ws.close();
});
