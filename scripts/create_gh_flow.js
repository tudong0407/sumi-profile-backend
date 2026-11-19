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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const ghTarget = tabs.find(t => t.url?.includes('github.com/new'));

  const ws = new WebSocket(ghTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 25000);
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

  // Enable network to see what happens
  await send('Network.enable');
  ws.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Network.responseReceived') {
      const resp = msg.params.response;
      if (resp.url.includes('repositories') || resp.url.includes('graphql')) {
        console.log(`[Network Response] ${resp.status} ${resp.url}`);
      }
    }
  });

  console.log('1. Reloading page cleanly...');
  await send('Page.reload');
  await sleep(4000);

  console.log('2. Typing sumi-profile-backend...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#repository-name-input');
      input.focus();
    })()`
  });
  await send('Input.insertText', { text: 'sumi-profile-backend' });
  await sleep(3000);

  console.log('3. Scrolling Create repository button into view...');
  const btnPos = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create repository');
      if (!btn) return { error: 'no btn' };
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const rect = btn.getBoundingClientRect();
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        disabled: btn.disabled
      };
    })()`,
    returnByValue: true
  });
  console.log('Button position:', btnPos.result?.value);
  const { x, y } = btnPos.result?.value || {};

  if (x && y) {
    console.log(`4. Clicking mouse at (${x}, ${y})...`);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y)
    });
    await sleep(200);
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
    await sleep(100);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
  }

  console.log('5. Monitoring navigation...');
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const urlCheck = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    console.log(`[Check ${i+1}] ${urlCheck.result?.value}`);
    if (urlCheck.result?.value && !urlCheck.result?.value?.includes('/new')) {
      console.log('🎉 NAVIGATED TO:', urlCheck.result?.value);
      break;
    }
  }

  ws.close();
}

main().catch(console.error);
