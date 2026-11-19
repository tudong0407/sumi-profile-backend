import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
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
      // Find all buttons that contain 'Open builder' or 'Build a new command' or 'Start building'
      const allBtns = Array.from(document.querySelectorAll('button'));
      const matches = allBtns.map(b => ({
        text: b.textContent.trim(),
        ariaLabel: b.getAttribute('aria-label'),
        classes: b.className
      })).filter(b => 
        b.text.includes('Open builder') || 
        b.text.includes('Build a new') || 
        b.text.includes('Start building') ||
        b.text.includes('builder') ||
        b.text.includes('Command')
      );

      // Also check any modals/dialogs
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).map(d => ({
        text: d.textContent.trim().slice(0, 200)
      }));

      return {
        matchedButtons: matches,
        dialogs
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM Details:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
