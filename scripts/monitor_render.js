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
      // Find public URL link (.onrender.com)
      const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('.onrender.com'));
      const text = document.body.innerText;
      
      // Look for status badges
      const statusBadge = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent.trim() === 'Live' || el.textContent.trim() === 'Building...' || el.textContent.trim() === 'Deploy failed')
        .map(el => el.textContent.trim())[0];

      // Extract log lines
      const logLines = Array.from(document.querySelectorAll('code, pre, div[data-testid*="log"], div.font-mono'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 5 && !t.includes('New log entries'));

      return {
        publicUrls: [...new Set(links)],
        status: statusBadge || 'Unknown',
        recentLogs: logLines.slice(-10)
      };
    })()`,
    returnByValue: true
  });

  console.log('Render deploy monitor:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
