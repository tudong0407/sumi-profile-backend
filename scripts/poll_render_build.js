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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const statusMatch = text.match(/(Building|Live|Deploy failed|Deploying|In progress)/i);
      const logLines = Array.from(document.querySelectorAll('code, pre, div.font-mono, [data-testid*="log"]'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 5 && !t.includes('New log entries'));
      return {
        url: window.location.href,
        status: statusMatch ? statusMatch[0] : 'Unknown',
        recentLogs: logLines.slice(-15)
      };
    })()`,
    returnByValue: true
  });

  console.log('Build status:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
