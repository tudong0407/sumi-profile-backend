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

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const supa = tabs.find(t => t.url?.includes('supabase.com/dashboard/project/lfvtysacdoadtvskqgkt'));
  const ws = new WebSocket(supa.webSocketDebuggerUrl);
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

  const check = await send('Runtime.evaluate', {
    expression: `(async () => {
      // Let's test calling pg-meta query endpoint with the user's cookies
      try {
        const res = await fetch('/api/platform/pg-meta/lfvtysacdoadtvskqgkt/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'SELECT 1 as num;' })
        });
        const text = await res.text();
        return { status: res.status, text };
      } catch (e) {
        return { error: e.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Query endpoint test:', check.result?.value);
  ws.close();
}

main().catch(console.error);
