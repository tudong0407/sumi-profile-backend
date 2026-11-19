import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const renderTarget = tabs.find(t => t.url?.includes('dashboard.render.com'));
  if (!renderTarget) {
    console.log('No Render tab');
    return;
  }

  const ws = new WebSocket(renderTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const handler = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button, a')).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim(),
        href: b.href
      }));
      return {
        url: window.location.href,
        title: document.title,
        buttons: buttons.filter(b => b.text && (b.text.includes('New') || b.text.includes('Web Service') || b.text.includes('Deploy') || b.text.includes('Project')))
      };
    })()`,
    returnByValue: true
  });

  console.log('Render Dashboard:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
