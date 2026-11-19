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
      const msgs = Array.from(document.querySelectorAll('[role="alert"], [aria-live], .flash-error, .FormControl-inlineValidation'))
        .map(e => e.textContent.trim());
      const bodyText = document.body.innerText;
      return {
        alerts: msgs,
        textPreview: bodyText.slice(0, 1500)
      };
    })()`,
    returnByValue: true
  });

  console.log('GitHub page inspect:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
