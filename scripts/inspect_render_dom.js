import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const rTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  const ws = new WebSocket(rTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const dom = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('form');
      const textareas = Array.from(document.querySelectorAll('textarea')).map(t => ({
        name: t.name,
        val: t.value,
        outer: t.outerHTML.slice(0, 100)
      }));
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        name: i.name,
        val: i.value,
        type: i.type,
        outer: i.outerHTML.slice(0, 100)
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent,
        disabled: b.disabled
      }));
      return { textareas, inputs, buttons };
    })()`,
    returnByValue: true
  });

  console.log('DOM:', JSON.stringify(dom.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
