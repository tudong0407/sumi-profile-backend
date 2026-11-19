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

  console.log('Dispatching click to Custom Commands sidebar item...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const div = Array.from(document.querySelectorAll('div')).find(d => 
        d.className.includes('cursor-pointer') && 
        d.textContent?.includes('Custom Commands') && 
        d.textContent?.includes('Create complex slash')
      );
      if (!div) return { error: 'div not found' };

      const rect = div.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Click directly
      div.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      div.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      div.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));

      return { clicked: true, x, y };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', res.result?.value);
  await sleep(2000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3s = Array.from(document.querySelectorAll('h3, h2, h1')).map(h => h.textContent.trim());
      return {
        url: window.location.href,
        headings: h3s.slice(0, 15)
      };
    })()`,
    returnByValue: true
  });

  console.log('Page after click:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
