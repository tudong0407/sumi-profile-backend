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
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.memoizedProps?.saveCommand || fiber.memoizedProps?.onSave || fiber.stateNode?.save) cb = fiber;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        cbProps: cb ? Object.keys(cb.memoizedProps || {}) : [],
        cbTag: cb?.elementType?.name || cb?.tag
      };
    })()`,
    returnByValue: true
  });

  console.log('Search cb result:', res.result?.value);
  ws.close();
});
