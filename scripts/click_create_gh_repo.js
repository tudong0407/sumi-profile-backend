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
  const gh = tabs.find(t => t.url?.includes('github.com/new') || t.url?.includes('github.com'));
  if (!gh) {
    console.error('GitHub tab not found');
    return;
  }
  const ws = new WebSocket(gh.webSocketDebuggerUrl);
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

  console.log('Finding and clicking Create repository button...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Create repository' && !b.disabled);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        btn.click();
        return { clicked: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', res.result?.value);

  if (res.result?.value?.clicked) {
    const { x, y } = res.result.value;
    // Dispatch mouse event too
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  console.log('Waiting for navigation...');
  await sleep(4000);

  const newUrl = await send('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });

  console.log('New URL:', newUrl.result?.value);
  ws.close();
}

main().catch(console.error);
