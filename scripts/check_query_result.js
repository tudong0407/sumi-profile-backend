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
  const supa = tabs.find(t => t.url?.includes('supabase.com/dashboard/project/lfvtysacdoadtvskqgkt'));
  const ws = new WebSocket(supa.webSocketDebuggerUrl);
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
      const panels = Array.from(document.querySelectorAll('[role="tabpanel"], .cm-content, div'))
        .filter(el => el.textContent.includes('Success') || el.textContent.includes('rows') || el.textContent.includes('Error') || el.textContent.includes('error'))
        .map(el => el.textContent.trim().slice(0, 300));
      const notifications = Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"]'))
        .map(el => el.textContent.trim());
      return { panels: panels.slice(0, 5), notifications };
    })()`,
    returnByValue: true
  });

  console.log('Query result check:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
