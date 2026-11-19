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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Edit');
      if (editBtn) {
        editBtn.click();
        return 'Clicked Edit button!';
      }
      return 'No Edit button found';
    })()`,
    returnByValue: true
  });

  console.log('Edit click:', res.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  const afterEdit = await send('Runtime.evaluate', {
    expression: `(() => {
      const textareas = Array.from(document.querySelectorAll('textarea')).map(t => ({
        name: t.name,
        readonly: t.readOnly,
        val: t.value.slice(0, 30)
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        disabled: b.disabled
      })).filter(b => b.text?.includes('Save') || b.text?.includes('Cancel') || b.text?.includes('Deploy'));
      return { textareas, buttons };
    })()`,
    returnByValue: true
  });

  console.log('After Edit state:', JSON.stringify(afterEdit.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
