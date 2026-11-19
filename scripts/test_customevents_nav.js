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

  // Check console messages and network
  await send('Console.enable');
  const logs = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.method === 'Console.messageAdded') logs.push(m.params.message);
  });

  console.log('Navigating to customevents...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
  await sleep(5000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3s = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());
      const loader = document.querySelector('.loader-full');
      return {
        url: window.location.href,
        hasLoader: !!loader,
        headings: h3s
      };
    })()`,
    returnByValue: true
  });

  console.log('Customevents result:', JSON.stringify(res.result?.value, null, 2));
  console.log('Console logs captured:', logs.slice(-5));
  ws.close();
}

main().catch(console.error);
