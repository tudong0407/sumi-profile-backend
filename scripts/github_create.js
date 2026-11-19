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
  if (!ghTarget) {
    console.error('No GitHub tab found');
    return;
  }

  console.log('Connecting to GitHub tab:', ghTarget.title);
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

  const inspect = await send('Runtime.evaluate', {
    expression: `(() => {
      const repoInput = document.querySelector('input[data-testid="repository-name-input"]') || document.querySelector('#repository_name') || document.querySelector('input[name="repository[name]"]') || document.querySelector('input[aria-label="Repository name*"]') || document.querySelector('input[placeholder="name-your-new-repository"]');
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Create repository'));
      return {
        url: window.location.href,
        hasRepoInput: !!repoInput,
        repoInputId: repoInput?.id,
        submitBtnFound: !!submitBtn,
        submitBtnDisabled: submitBtn?.disabled
      };
    })()`,
    returnByValue: true
  });

  console.log('GitHub inspect:', inspect.result?.value);
  ws.close();
}

main().catch(console.error);
