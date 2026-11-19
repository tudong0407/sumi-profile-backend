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
      const allDivs = Array.from(document.querySelectorAll('.dash-sidebar div')).filter(d => 
        d.textContent?.trim() === 'Custom Commands' || 
        (d.querySelector('span')?.textContent?.trim() === 'Custom Commands' && d.className.includes('cursor-pointer'))
      );

      return allDivs.map(d => {
        const r = d.getBoundingClientRect();
        return {
          text: d.textContent.trim().slice(0, 30),
          className: d.className,
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          centerX: r.left + r.width / 2,
          centerY: r.top + r.height / 2
        };
      });
    })()`,
    returnByValue: true
  });

  console.log('Sidebar CC items:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
