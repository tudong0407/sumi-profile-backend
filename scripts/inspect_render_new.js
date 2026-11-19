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
  const renderTab = tabs.find(t => t.url?.includes('render.com'));
  if (!renderTab) {
    console.error('Render tab not found');
    return;
  }
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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

  console.log('Navigating Render tab to web/new...');
  await send('Page.navigate', { url: 'https://dashboard.render.com/web/new' });
  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button, a')).map(b => ({
        text: b.textContent.trim(),
        href: b.href
      })).filter(b => b.text.length > 0);
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        placeholder: i.placeholder,
        value: i.value,
        type: i.type
      }));
      return {
        url: window.location.href,
        buttons: buttons.slice(0, 30),
        inputs
      };
    })()`,
    returnByValue: true
  });

  console.log('Render page info:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
