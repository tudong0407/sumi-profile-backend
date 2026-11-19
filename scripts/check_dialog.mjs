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

  // Check if there is any modal or dialog
  const modals = await send('Runtime.evaluate', {
    expression: `(() => {
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
      return {
        dialogText: dialog ? dialog.innerText : null,
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
      };
    })()`,
    returnByValue: true
  });
  console.log('Modals/Buttons:', JSON.stringify(modals.result?.value, null, 2));

  ws.close();
}

main().catch(console.error);
