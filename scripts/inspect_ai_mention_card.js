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
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
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
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('Nhiễm Nhiễm — AI Mention'));
      if (!h3) return { error: 'h3 not found' };

      // Find card container
      let card = h3;
      while (card && card !== document.body && !card.className.includes('rounded')) {
        card = card.parentElement;
      }

      const cardBtns = card ? Array.from(card.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim(),
        visible: b.offsetParent !== null
      })) : [];

      return {
        h3Text: h3.textContent.trim(),
        cardTag: card?.tagName,
        cardClass: card?.className,
        cardBtns
      };
    })()`,
    returnByValue: true
  });

  console.log('AI Mention card:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
