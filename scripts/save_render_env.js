import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

  console.log('1. Setting textarea values for environment variables...');
  const setRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

      const values = [
        'production', // NODE_ENV
        '3000',       // PORT
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdnR5c2FjZG9hZHR2c2txZ2t0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTA4Nzc1NiwiZXhwIjoyMTEwNjYzNzU2fQ.an706_l9ItnKr10NjXq6i6X3jb2UP7Y7nISXX-_dH9k', // SUPABASE_KEY
        'https://lfvtysacdoadtvskqgkt.supabase.co' // SUPABASE_URL
      ];

      const report = [];
      values.forEach((val, idx) => {
        if (textareas[idx]) {
          setter.call(textareas[idx], val);
          textareas[idx].dispatchEvent(new Event('input', { bubbles: true }));
          textareas[idx].dispatchEvent(new Event('change', { bubbles: true }));
          report.push({ idx, len: val.length, sample: val.slice(0, 20) });
        }
      });

      return report;
    })()`,
    returnByValue: true
  });

  console.log('Set result:', JSON.stringify(setRes.result?.value, null, 2));
  await sleep(1500);

  console.log('2. Clicking "Save, rebuild, and deploy"...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent?.includes('Save, rebuild, and deploy') || b.textContent?.includes('Save Changes'));
      if (saveBtn) {
        saveBtn.click();
        return { clicked: true, text: saveBtn.textContent };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', JSON.stringify(clickRes.result?.value, null, 2));
  await sleep(4000);

  ws.close();
}

main().catch(console.error);
