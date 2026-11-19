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

  console.log('Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  // Click on "/pet"
  const clickPet = await send('Runtime.evaluate', {
    expression: `(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const petHeader = allEls.find(e => e.children.length === 0 && e.textContent.trim() === '/pet');
      if (petHeader) {
        petHeader.click();
        return { clicked: true, tag: petHeader.tagName };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });

  console.log('Click /pet header:', clickPet.result?.value);
  await sleep(1500);

  const afterClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const petHeader = allEls.find(e => e.children.length === 0 && e.textContent.trim() === '/pet');
      const card = petHeader ? petHeader.closest('[class*="rounded"], [class*="card"], div') : null;
      const btns = card ? Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim()) : [];
      return {
        cardBtns: btns
      };
    })()`,
    returnByValue: true
  });

  console.log('Buttons inside /pet card after click:\n', JSON.stringify(afterClick.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
