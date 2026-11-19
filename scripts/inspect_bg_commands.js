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
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  if (!bg) {
    console.error('BotGhost tab not found');
    return;
  }
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

  console.log('Navigating BotGhost to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      // Find Redux store
      const root = document.getElementById('root');
      let commands = [];
      if (root) {
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        if (key && root[key]?.memoizedProps?.store) {
          const st = root[key].memoizedProps.store.getState();
          const cmdList = st?.data?.bot?.commands?.custom_commands?.commands || [];
          commands = cmdList.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            enabled: c.enabled
          }));
        }
      }

      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [data-testid*="command"]'))
        .map(h => h.textContent.trim())
        .filter(t => t.startsWith('/') || t.includes('profile') || t.includes('rank'));

      return {
        url: window.location.href,
        commands,
        headings
      };
    })()`,
    returnByValue: true
  });

  console.log('BotGhost Custom Commands info:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
