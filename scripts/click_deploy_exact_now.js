import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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

  // Open menu
  const menuRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const manualBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Manual Deploy'));
      if (manualBtn) manualBtn.click();
      return !!manualBtn;
    })()`,
    returnByValue: true
  });
  console.log('Opened Manual Deploy menu:', menuRes.result?.value);
  await sleep(600);

  // Click exact item
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const allElements = Array.from(document.querySelectorAll('button, [role=\"menuitem\"]'));
      const target = allElements.find(el => el.textContent.trim() === 'Clear build cache & deploy') ||
                     allElements.find(el => el.textContent.trim() === 'Deploy latest commit');
      if (target) {
        target.click();
        return { clicked: true, text: target.textContent.trim() };
      }
      return { clicked: false, available: allElements.map(e => e.textContent.trim()) };
    })()`,
    returnByValue: true
  });
  console.log('Clicked deploy item:', clickRes.result?.value);

  ws.close();
}

main().catch(console.error);
