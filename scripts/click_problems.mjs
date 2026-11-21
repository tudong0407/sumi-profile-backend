import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      // Click problems button to open problems drawer
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Problems'));
      if (btn) btn.click();
      
      // Wait a tiny bit and find problem items
      return new Promise(resolve => {
        setTimeout(() => {
          const problemTexts = Array.from(document.querySelectorAll('[class*="problem"], [role="dialog"], [class*="drawer"]'))
            .map(el => el.innerText)
            .filter(t => t && t.length > 5 && t.length < 500);
          resolve({
            problemTexts
          });
        }, 500);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
