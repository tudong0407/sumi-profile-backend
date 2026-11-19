import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  let targetTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const pageInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        text: document.body.innerText.split('\\n').filter(Boolean).slice(35, 75)
      };
    })()`,
    returnByValue: true
  });
  console.log('Deploys text:\n' + pageInfo.result?.value?.text?.join('\n'));

  ws.close();
}

main().catch(console.error);
