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
  const supaTarget = tabs.find(t => t.url?.includes('supabase.com/dashboard'));

  if (!supaTarget) {
    console.log('No Supabase tab found');
    return;
  }

  console.log('Found Supabase target:', supaTarget.title, supaTarget.url);

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

  const inspect = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        tag: el.tagName,
        type: el.type,
        id: el.id,
        name: el.name,
        placeholder: el.placeholder,
        value: el.value
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        disabled: b.disabled
      }));
      return {
        url: window.location.href,
        title: document.title,
        inputs,
        buttons: buttons.filter(b => b.text?.includes('Create') || b.text?.includes('Project') || b.text?.includes('Generate'))
      };
    })()`,
    returnByValue: true
  });

  console.log('Supabase inspection:', JSON.stringify(inspect.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
