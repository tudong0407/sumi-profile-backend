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

  console.log('Navigating to project overview...');
  await send('Page.navigate', { url: 'https://supabase.com/dashboard/project/lfvtysacdoadtvskqgkt' });
  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        url: window.location.href,
        hasProvisioning: text.includes('Setting up project') || text.includes('Restoring') || text.includes('Provisioning'),
        textSnippet: text.slice(0, 1500)
      };
    })()`,
    returnByValue: true
  });

  console.log('Project overview status:\n', res.result?.value);
  ws.close();
}

main().catch(console.error);
