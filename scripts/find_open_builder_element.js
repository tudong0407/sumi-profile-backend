import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = 123;
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) resolve(m.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'))
        .filter(el => Array.from(el.childNodes).some(c => c.nodeType === 3 && c.nodeValue.includes('Open builder')));
      return all.map(el => ({
        tag: el.tagName,
        text: el.textContent.trim(),
        className: el.className,
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className
      }));
    })()`,
    returnByValue: true
  });

  console.log('Open builder elements:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
