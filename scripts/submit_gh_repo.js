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
  const gh = tabs.find(t => t.url?.includes('github.com/new') || t.url?.includes('github.com'));
  const ws = new WebSocket(gh.webSocketDebuggerUrl);
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

  // Focus the input and press Enter
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('repository-name-input');
      if (input) input.focus();
    })()`
  });
  await sleep(200);

  console.log('Sending Enter key...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });

  // Also check form element
  const formCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const form = forms.find(f => f.querySelector('#repository-name-input'));
      if (form) {
        const btn = form.querySelector('button[type="submit"]') || Array.from(form.querySelectorAll('button')).find(b => b.textContent.includes('Create'));
        if (btn) btn.click();
        form.requestSubmit ? form.requestSubmit() : form.submit();
        return { submitted: true };
      }
      return { submitted: false };
    })()`,
    returnByValue: true
  });
  console.log('Form submit check:', formCheck.result?.value);

  await sleep(4000);

  const checkUrl = await send('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });
  console.log('URL after submit:', checkUrl.result?.value);
  ws.close();
}

main().catch(console.error);
