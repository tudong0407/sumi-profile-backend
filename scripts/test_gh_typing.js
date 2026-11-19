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

  console.log('Reloading github.com/new to clear previous error...');
  await send('Page.reload');
  await sleep(3500);

  console.log('Focusing input and typing via CDP Input.insertText...');
  const focusRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#repository-name-input');
      if (!input) return { error: 'no input' };
      input.focus();
      return { focused: true };
    })()`,
    returnByValue: true
  });
  console.log('Focus result:', focusRes.result?.value);

  // Type via CDP insertText (acts like real keyboard input!)
  await send('Input.insertText', { text: 'sumi-profile-backend' });
  await sleep(2500);

  // Verify input value
  const verify = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#repository-name-input');
      const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Create repository'));
      const statusP = document.querySelector('[aria-live="polite"]') || document.querySelector('span[id*="RepoNameInput"]');
      return {
        val: input?.value,
        createBtnDisabled: createBtn?.disabled,
        statusText: statusP?.textContent?.trim()
      };
    })()`,
    returnByValue: true
  });

  console.log('Typing verification:', verify.result?.value);

  ws.close();
}

main().catch(console.error);
