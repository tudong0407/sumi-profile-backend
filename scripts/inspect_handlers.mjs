import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');

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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('/profile') && b.textContent.includes('Open builder'));
      if (!btn) return 'No btn';

      // Let's inspect React fiber on btn
      const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$'));
      let fiber = btn[key];
      let handlers = [];
      let f = fiber;
      while (f) {
        if (f.memoizedProps?.onClick) handlers.push({ type: 'onClick', tag: f.elementType?.name || f.tag });
        f = f.return;
      }
      return {
        handlers
      };
    })()`,
    returnByValue: true
  });

  console.log('Event handlers on /profile button:', res.result?.value);
  ws.close();
});
