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
  const supaTarget = tabs.find(t => t.url?.includes('supabase.com/dashboard/new'));

  const ws = new WebSocket(supaTarget.webSocketDebuggerUrl);
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
      const form = document.querySelector('form');
      const formKey = Object.keys(form).find(k => k.startsWith('__reactFiber$'));
      const fiber = form[formKey];
      return {
        formProps: Object.keys(fiber?.memoizedProps || {}),
        hasOnSubmit: typeof fiber?.memoizedProps?.onSubmit === 'function'
      };
    })()`,
    returnByValue: true
  });

  console.log('Supabase Form Fiber:', res.result?.value);

  // Now let's call fiber.memoizedProps.onSubmit()
  const submitRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('form');
      const formKey = Object.keys(form).find(k => k.startsWith('__reactFiber$'));
      const fiber = form[formKey];
      if (typeof fiber?.memoizedProps?.onSubmit === 'function') {
        try {
          fiber.memoizedProps.onSubmit({
            preventDefault: () => {},
            stopPropagation: () => {},
            target: form,
            currentTarget: form
          });
          return { triggered: true };
        } catch (e) {
          return { error: String(e) };
        }
      }
      return { noOnSubmit: true };
    })()`,
    returnByValue: true
  });

  console.log('Triggered onSubmit directly:', submitRes.result?.value);
  ws.close();
}

main().catch(console.error);
