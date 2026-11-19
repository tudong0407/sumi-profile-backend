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
      const groups = Array.from(document.querySelectorAll('h1, h2, h3, h4, span, div')).map(el => el.textContent.trim()).filter(t => t.includes('Ungrouped'));
      return {
        groups: Array.from(new Set(groups)).slice(0, 10)
      };
    })()`,
    returnByValue: true
  });

  console.log('Ungrouped:', res.result?.value);
  ws.close();
});
