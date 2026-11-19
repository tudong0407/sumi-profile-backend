import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g/env'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const rows = [];
      for (let i = 0; i < 6; i++) {
        const keyInput = document.querySelector(\`input[name="envVars.\${i}.envVarKey"]\`);
        const valInput = document.querySelector(\`textarea[name="envVars.\${i}.envVarValue"], input[name="envVars.\${i}.envVarValue"]\`);
        if (keyInput || valInput) {
          rows.push({
            i,
            key: keyInput?.value,
            hasValue: !!valInput?.value,
            valLen: valInput?.value?.length,
            valSample: valInput?.value?.slice(0, 15)
          });
        }
      }
      const btns = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        disabled: b.disabled
      })).filter(b => b.text?.includes('Save') || b.text?.includes('Deploy') || b.text?.includes('Add'));

      return { rows, btns };
    })()`,
    returnByValue: true
  });

  console.log('Env Rows & Buttons:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
