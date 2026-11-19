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
  const gh = tabs.find(t => t.url?.includes('github.com/new') || t.url?.includes('github.com'));
  if (!gh) {
    console.error('GitHub tab not found');
    return;
  }
  const ws = new WebSocket(gh.webSocketDebuggerUrl);
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
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        id: i.id,
        name: i.name,
        value: i.value,
        placeholder: i.placeholder,
        type: i.type,
        checked: i.checked
      }));
      const btns = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim(),
        disabled: b.disabled
      })).filter(b => b.text.includes('Create repository') || b.text.includes('repository'));
      return { url: window.location.href, inputs, btns };
    })()`,
    returnByValue: true
  });

  console.log('GitHub page state:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
