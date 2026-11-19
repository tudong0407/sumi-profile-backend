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

  console.log('Clicking card of Nhiễm Nhiễm — AI Mention...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('Nhiễm Nhiễm — AI Mention'));
      let card = h3;
      while (card && card !== document.body && !card.className.includes('cursor-pointer')) {
        card = card.parentElement;
      }
      if (card) {
        card.click();
        return { clickedCard: true };
      }
      return { clickedCard: false };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', res.result?.value);
  await sleep(1500);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim().slice(0, 50),
        visible: b.offsetParent !== null
      })).filter(b => b.visible && (b.text.includes('Open') || b.text.includes('builder') || b.text.includes('Edit')));

      return {
        matchedBtns: btns
      };
    })()`,
    returnByValue: true
  });

  console.log('Buttons after card click:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
