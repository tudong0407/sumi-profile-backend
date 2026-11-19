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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create repository');
      if (!btn) return { error: 'no btn' };
      const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$'));
      const fiber = btn[key];
      const form = btn.closest('form');
      const formKey = form ? Object.keys(form).find(k => k.startsWith('__reactFiber$')) : null;
      const formFiber = formKey ? form[formKey] : null;

      return {
        btnProps: fiber?.memoizedProps ? Object.keys(fiber.memoizedProps) : [],
        hasOnClick: typeof fiber?.memoizedProps?.onClick === 'function',
        formProps: formFiber?.memoizedProps ? Object.keys(formFiber.memoizedProps) : [],
        hasOnSubmit: typeof formFiber?.memoizedProps?.onSubmit === 'function'
      };
    })()`,
    returnByValue: true
  });

  console.log('React Fiber on GitHub form/button:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
