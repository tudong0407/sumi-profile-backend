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

  console.log('Finding and clicking inner span Open builder...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const spans = Array.from(document.querySelectorAll('span')).filter(s => s.textContent.trim().startsWith('Open builder'));
      if (spans.length === 0) return 'No span found';
      spans[0].click();
      return {
        clicked: true,
        tag: spans[0].tagName,
        text: spans[0].textContent
      };
    })()`,
    returnByValue: true
  });
  console.log('Click span result:', res.result?.value);
  await sleep(4000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        title: document.title,
        textSnippet: document.body.innerText.slice(0, 300)
      };
    })()`,
    returnByValue: true
  });
  console.log('Page after clicking span:', check.result?.value);

  ws.close();
});
