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

  console.log('1. Clicking Custom Events...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const spans = Array.from(document.querySelectorAll('.dash-sidebar span')).filter(s => s.textContent?.trim() === 'Custom Events');
      const span = spans[0];
      let curr = span;
      while (curr && curr !== document.body) {
        const k = Object.keys(curr).find(key => key.startsWith('__reactProps$'));
        if (curr[k]?.onClick) {
          curr[k].onClick();
          return { clickedEvents: true };
        }
        curr = curr.parentElement;
      }
      return { clickedEvents: false };
    })()`
  });
  await sleep(1500);

  console.log('2. Clicking Custom Commands...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const spans = Array.from(document.querySelectorAll('.dash-sidebar span')).filter(s => s.textContent?.trim() === 'Custom Commands');
      const span = spans[0];
      let curr = span;
      while (curr && curr !== document.body) {
        const k = Object.keys(curr).find(key => key.startsWith('__reactProps$'));
        if (curr[k]?.onClick) {
          curr[k].onClick();
          return { clickedCommands: true };
        }
        curr = curr.parentElement;
      }
      return { clickedCommands: false };
    })()`
  });
  await sleep(2500);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1s = Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent.trim());
      return {
        url: window.location.href,
        headings: h1s
      };
    })()`,
    returnByValue: true
  });

  console.log('After toggle:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
