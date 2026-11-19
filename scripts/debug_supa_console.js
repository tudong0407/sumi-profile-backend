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

  // Enable Log and Runtime to catch console
  await send('Log.enable');
  await send('Runtime.enable');

  const logs = [];
  ws.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  });

  // Try clicking again
  console.log('Triggering click on Create new project...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Create new project'));
      if (btn) btn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('Captured logs on Supabase:');
  logs.forEach(l => console.log(' -', l));

  // Check form state
  const formState = await send('Runtime.evaluate', {
    expression: `(() => {
      const errors = Array.from(document.querySelectorAll('p.text-red-900, .text-destructive, [aria-invalid="true"]')).map(el => el.textContent?.trim() || el.outerHTML);
      return { errors };
    })()`,
    returnByValue: true
  });
  console.log('Form errors:', formState.result?.value);

  ws.close();
}

main().catch(console.error);
