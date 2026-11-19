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
  if (!supa) {
    console.error('Supabase tab not found');
    return;
  }
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const texts = Array.from(document.querySelectorAll('code, pre, p, span, div, h2, h3, h4'))
        .map(e => e.textContent.trim())
        .filter(t => t.includes('anon') || t.includes('service_role') || t.includes('eyJ') || t.includes('API key') || t.includes('Project URL') || t.includes('secret'));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.textContent.trim(), href: a.href }));
      return { 
        url: window.location.href,
        texts: [...new Set(texts)].slice(0, 30), 
        buttons: buttons.slice(0, 30),
        apiLinks: links.filter(l => l.href.includes('api') || l.href.includes('settings'))
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
