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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const spans = Array.from(document.querySelectorAll('.dash-sidebar span')).filter(s => s.textContent?.trim() === 'Custom Commands');
      if (spans.length === 0) return { error: 'no span' };
      const span = spans[0];
      let curr = span;
      let targetDiv = null;
      while (curr && curr !== document.body) {
        const k = Object.keys(curr).find(key => key.startsWith('__reactProps$'));
        if (curr[k]?.onClick) {
          targetDiv = curr;
          break;
        }
        curr = curr.parentElement;
      }
      if (!targetDiv) return { error: 'no targetDiv' };

      const k = Object.keys(targetDiv).find(key => key.startsWith('__reactProps$'));
      const fn = targetDiv[k].onClick;

      return {
        tag: targetDiv.tagName,
        fnStr: fn.toString().slice(0, 500)
      };
    })()`,
    returnByValue: true
  });

  console.log('Sidebar onClick:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
