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
      const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim() === 'Automod Fubel v2');
      if (!h3) return { error: 'H3 not found' };

      // Find the clickable header
      let header = h3;
      while (header && !header.className?.includes('cursor-pointer') && header !== document.body) {
        header = header.parentElement;
      }
      if (!header) return { error: 'header not found' };

      header.click();

      return {
        clickedHeader: true,
        headerClass: header.className
      };
    })()`,
    returnByValue: true
  });

  console.log('Clicked header:', res.result?.value);

  // Wait 1.5s
  await new Promise(r => setTimeout(r, 1500));

  const res2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.includes('Open') || b.textContent?.includes('builder'));
      return btns.map(b => ({
        text: b.textContent?.trim(),
        className: b.className
      }));
    })()`,
    returnByValue: true
  });

  console.log('Buttons after clicking header:', res2.result?.value);
  ws.close();
}

main().catch(console.error);
