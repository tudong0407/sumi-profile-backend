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

  // Get Run button bounding box
  const btnBox = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.textContent.includes('Run'));
      if (runBtn) {
        const rect = runBtn.getBoundingClientRect();
        return {
          text: runBtn.textContent,
          disabled: runBtn.disabled,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      }
      return null;
    })()`,
    returnByValue: true
  });

  console.log('Run button pos:', btnBox.result?.value);

  if (btnBox.result?.value) {
    const { x, y } = btnBox.result.value;
    console.log(`Clicking Run at (${x}, ${y})...`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  await sleep(4000);

  // Check if query is running or result pane appeared
  const afterClick = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        bottomText: Array.from(document.querySelectorAll('button, div, span'))
          .filter(e => e.textContent.includes('Success') || e.textContent.includes('Running') || e.textContent.includes('Results') || e.textContent.includes('error'))
          .map(e => e.textContent.trim().slice(0, 100))
          .slice(0, 10)
      };
    })()`,
    returnByValue: true
  });

  console.log('After click text:', afterClick.result?.value);
  ws.close();
}

main().catch(console.error);
