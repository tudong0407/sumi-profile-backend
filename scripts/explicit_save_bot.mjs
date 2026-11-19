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
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let targetFiber = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (typeof fiber.memoizedProps?.saveBot === 'function') targetFiber = fiber;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const bot = store.getState().data.bot;
      const saveRes = await targetFiber.memoizedProps.saveBot(bot);

      // Also let's trigger flush on __botghostServerSaves if available
      if (window.__botghostServerSaves && typeof window.__botghostServerSaves.flush === 'function') {
        window.__botghostServerSaves.flush();
      }

      return {
        saveRes,
        lastSave: store.getState().data.bot.last_save
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Explicit saveBot call result:', res.result?.value);
  ws.close();
});
