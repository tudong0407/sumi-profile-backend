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

  console.log('Finding and clicking /profile text...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const allDivs = Array.from(document.querySelectorAll('div, span, p')).filter(el => el.textContent.trim() === '/profile');
      if (allDivs.length === 0) return 'No /profile text';
      const target = allDivs[0];
      target.click();
      return {
        clicked: true,
        tag: target.tagName,
        parent: target.parentElement?.tagName
      };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', res.result?.value);
  await sleep(1500);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button, a')).map(b => b.textContent.trim()).filter(t => t.includes('Edit') || t.includes('builder') || t.includes('Builder'));
      return {
        btns
      };
    })()`,
    returnByValue: true
  });
  console.log('Buttons visible after click:', check.result?.value);

  ws.close();
});
