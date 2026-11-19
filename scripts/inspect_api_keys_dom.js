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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
      const mainEl = document.querySelector('main') || document.body;
      const buttons = Array.from(mainEl.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim(),
        ariaLabel: b.getAttribute('aria-label'),
        title: b.title
      }));
      const inputs = Array.from(mainEl.querySelectorAll('input')).map(i => ({
        type: i.type,
        value: i.value,
        ariaLabel: i.getAttribute('aria-label'),
        placeholder: i.placeholder
      }));
      const text = mainEl.innerText.slice(0, 3000);
      return { buttons, inputs, text };
    })()`,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
