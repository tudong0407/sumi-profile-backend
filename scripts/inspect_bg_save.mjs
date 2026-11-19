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

  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await new Promise(r => setTimeout(r, 4000));

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const state = store?.getState();
      const bot = state?.data?.bot;
      
      // Let's check API functions on window or in modules
      return {
        hasStore: !!store,
        botId: bot?.id,
        lastSave: bot?.last_save,
        slashCount: bot?.commands?.slash?.commands?.length,
        actions: Object.keys(window).filter(k => k.includes('save') || k.includes('bot') || k.includes('cb'))
      };
    })()`,
    returnByValue: true
  });

  console.log('BotGhost store info:', res.result?.value);
  ws.close();
});
