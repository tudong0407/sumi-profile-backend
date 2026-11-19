import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const rTab = tabs.find(t => t.type === 'page' && t.url?.includes('dashboard.render.com'));
  const ws = new WebSocket(rTab.webSocketDebuggerUrl);
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

  console.log('1. Clicking Edit button...');
  const editRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const editBtn = btns.find(b => b.textContent.trim() === 'Edit');
      if (editBtn) {
        editBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Edit Click:', editRes.result?.value);
  await sleep(1500);

  // Check buttons now
  const btnsAfterEdit = await send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)`,
    returnByValue: true
  });
  console.log('Buttons after Edit:', btnsAfterEdit.result?.value);

  // Click Save Changes or Save, rebuild, and deploy
  const saveRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Save') || b.textContent.includes('rebuild'));
      if (saveBtn) {
        saveBtn.click();
        return { clicked: true, text: saveBtn.textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Save Click:', saveRes.result?.value);

  await sleep(4000);

  // Navigate to deploys to confirm new deployment started
  console.log('Checking deploys page...');
  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g/deploys' });
  await sleep(3000);

  const deploysText = await send('Runtime.evaluate', {
    expression: `document.body.innerText.split('\\n').filter(Boolean).slice(30, 70)`,
    returnByValue: true
  });
  console.log('Deploys page after save:\n' + deploysText.result?.value?.join('\n'));

  ws.close();
}

main().catch(console.error);
