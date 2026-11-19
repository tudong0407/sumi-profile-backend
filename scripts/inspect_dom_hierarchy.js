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

      let cur = h3;
      let parentHierarchy = [];
      for (let i = 0; i < 5; i++) {
        if (!cur) break;
        parentHierarchy.push({
          tag: cur.tagName,
          class: cur.className,
          childCount: cur.children?.length,
          innerHTMLSnippet: cur.innerHTML?.slice(0, 150)
        });
        cur = cur.parentElement;
      }

      // Check all clickable elements near h3
      const clickable = Array.from(document.querySelectorAll('button, [role="button"], a')).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim()?.slice(0, 50),
        class: el.className
      }));

      return {
        url: window.location.href,
        parentHierarchy,
        clickableSnippet: clickable.slice(0, 20)
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM Structure:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
