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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const ghTarget = tabs.find(t => t.url?.includes('github.com/new'));

  const ws = new WebSocket(ghTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 25000);
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

  console.log('1. Setting repository name: sumi-profile-backend...');
  const inputRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#repository-name-input');
      if (!input) return { error: 'input not found' };
      input.focus();
      input.value = 'sumi-profile-backend';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Also set Private radio if available
      const privRadio = document.querySelector('input[type="radio"][value="private"]') || document.querySelector('#repository_visibility_private');
      if (privRadio) privRadio.click();

      return { success: true, value: input.value };
    })()`,
    returnByValue: true
  });
  console.log('Input result:', inputRes.result?.value);

  console.log('2. Waiting for availability check...');
  await sleep(3000);

  console.log('3. Clicking Create repository button...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create repository');
      if (!btn) return { error: 'btn not found' };
      if (btn.disabled) return { disabled: true };
      btn.click();
      return { clicked: true };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result?.value);

  console.log('4. Waiting for repository creation and redirect...');
  for (let i = 0; i < 15; i++) {
    await sleep(1500);
    const urlCheck = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    console.log(`[URL Check ${i+1}] ${urlCheck.result?.value}`);
    if (urlCheck.result?.value?.includes('/sumi-profile-backend')) {
      console.log('🎉 REPOSITORY CREATED SUCCESSFULLY:', urlCheck.result?.value);
      break;
    }
  }

  ws.close();
}

main().catch(console.error);
