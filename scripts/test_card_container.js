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
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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
      const eventName = 'Automod Fubel v2';
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim() === eventName);
      if (!h3) return { error: 'H3 not found' };

      // Find card root container
      let card = h3;
      while (card && !card.className?.includes('rounded-') && card !== document.body) {
        card = card.parentElement;
      }

      // Check if open builder button already visible inside card or below it
      let openBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open builder'));
      
      let openedAccordion = false;
      if (!openBtn) {
        h3.click();
        openedAccordion = true;
      }

      return {
        cardFound: !!card,
        openedAccordion,
        openBtnFoundImmediately: !!openBtn
      };
    })()`,
    returnByValue: true
  });

  console.log('Result:', res.result?.value);
  ws.close();
}

main().catch(console.error);
