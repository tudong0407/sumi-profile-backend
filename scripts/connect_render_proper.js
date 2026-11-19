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
  const renderTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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

  const repoUrl = 'https://github.com/tudong0407/sumi-profile-backend';
  console.log(`Setting public repo URL with native setter and CDP typing: ${repoUrl}`);

  // Focus and select all
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input[placeholder*="express-hello-world"]') || document.querySelector('input');
      if (input) {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`
  });
  await sleep(200);

  // Type via CDP
  await send('Input.insertText', { text: repoUrl });
  await sleep(500);

  // Check button state
  const checkBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const connectBtn = btns.find(b => b.textContent.trim() === 'Connect');
      return {
        found: !!connectBtn,
        disabled: connectBtn ? connectBtn.disabled : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Button state after typing:', checkBtn.result?.value);

  // Click Connect button
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const connectBtn = btns.find(b => b.textContent.trim() === 'Connect');
      if (connectBtn && !connectBtn.disabled) {
        connectBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Connect click:', clickRes.result?.value);

  console.log('Waiting for Render service configuration page to load...');
  await sleep(6000);

  const pageRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        id: i.id,
        name: i.name,
        placeholder: i.placeholder,
        value: i.value
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const text = document.body.innerText.slice(0, 1500);
      return {
        url: window.location.href,
        inputs: inputs.slice(0, 15),
        buttons: buttons.slice(0, 20),
        textSnippet: text
      };
    })()`,
    returnByValue: true
  });

  console.log('Page after connect:', JSON.stringify(pageRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
