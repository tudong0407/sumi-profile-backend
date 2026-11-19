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
  const ghTarget = tabs.find(t => t.url?.includes('github.com/new'));

  const ws = new WebSocket(ghTarget.webSocketDebuggerUrl);
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

  const btnInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create repository');
      if (!btn) return { error: 'no btn' };
      const rect = btn.getBoundingClientRect();
      const form = btn.closest('form');
      return {
        text: btn.textContent?.trim(),
        disabled: btn.disabled,
        rect: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        hasForm: !!form,
        formAction: form?.action
      };
    })()`,
    returnByValue: true
  });

  console.log('Button Info:', btnInfo.result?.value);
  const { rect, hasForm } = btnInfo.result?.value || {};

  if (rect) {
    console.log(`Dispatching real mouse click at (${rect.x}, ${rect.y})...`);
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      button: 'left',
      clickCount: 1
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      button: 'left',
      clickCount: 1
    });
  }

  // Also try requestSubmit if available
  const subRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('form');
      if (form && form.requestSubmit) {
        try {
          form.requestSubmit();
          return { requestSubmitCalled: true };
        } catch (e) {
          return { error: String(e) };
        }
      }
      return { noRequestSubmit: true };
    })()`,
    returnByValue: true
  });
  console.log('Submit result:', subRes.result?.value);

  ws.close();
}

main().catch(console.error);
