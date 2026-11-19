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
      const navItems = Array.from(document.querySelectorAll('nav a, nav button, [role="navigation"] *')).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim(),
        href: el.href
      })).filter(x => x.text.length > 0 && x.text.length < 50);

      const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      })).filter(x => x.href.includes('/dashboard/'));

      return {
        navItems: navItems.slice(0, 30),
        dashboardLinks: allLinks
      };
    })()`,
    returnByValue: true
  });

  console.log('Sidebar & Nav Items:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
