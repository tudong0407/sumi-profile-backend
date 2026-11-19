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
      const selects = Array.from(document.querySelectorAll('select')).map(s => ({
        name: s.name,
        value: s.value,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text, selected: o.selected }))
      }));
      // Check custom dropdown buttons (radix-ui)
      const listboxes = Array.from(document.querySelectorAll('[role="combobox"], [data-state]')).map(el => ({
        role: el.getAttribute('role'),
        text: el.textContent?.trim(),
        ariaExpanded: el.getAttribute('aria-expanded')
      }));
      return {
        selects,
        listboxes: listboxes.slice(0, 10)
      };
    })()`,
    returnByValue: true
  });

  console.log('Dropdowns on Supabase:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
