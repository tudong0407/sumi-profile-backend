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

  console.log('Waiting for loader to disappear...');
  for (let i = 0; i < 20; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const loader = document.querySelector('.loader-full');
        const h3s = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());
        return {
          hasLoader: !!loader,
          headingsCount: h3s.length,
          headings: h3s.slice(0, 10)
        };
      })()`,
      returnByValue: true
    });
    const val = res.result?.value;
    console.log(`[Wait ${i + 1}] hasLoader: ${val?.hasLoader}, headings: ${val?.headingsCount}`);
    if (!val?.hasLoader && val?.headingsCount > 0) {
      console.log('Page loaded successfully! Headings:', val.headings);
      break;
    }
    await sleep(1500);
  }

  ws.close();
}

main().catch(console.error);
