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
      return {
        serverSaves: window.__botghostServerSaves,
        type: typeof window.__botghostServerSaves
      };
    })()`,
    returnByValue: true
  });

  console.log('ServerSaves:', res.result?.value);
  ws.close();
});
