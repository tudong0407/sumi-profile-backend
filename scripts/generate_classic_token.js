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
  const gh = tabs.find(t => t.url?.includes('github.com'));
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

  console.log('Navigating to settings/tokens/new (Classic)...');
  await send('Page.navigate', { url: 'https://github.com/settings/tokens/new' });
  await sleep(3500);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        title: document.title,
        isSudo: window.location.href.includes('/sessions/two-factor') || window.location.href.includes('/sudo') || document.body.innerText.includes('Confirm access')
      };
    })()`,
    returnByValue: true
  });

  console.log('Classic token status:', res.result?.value);

  if (!res.result?.value?.isSudo) {
    // Fill description and check 'repo'
    const fillRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const descInput = document.getElementById('oauth_access_description');
        if (descInput) {
          descInput.value = 'sumi-deploy-token';
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
          descInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const repoCheckbox = document.getElementById('oauth_token_scopes_repo') || document.querySelector('input[value="repo"]');
        if (repoCheckbox) {
          repoCheckbox.checked = true;
          repoCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return { hasDesc: !!descInput, hasRepo: !!repoCheckbox };
      })()`,
      returnByValue: true
    });
    console.log('Form fill result:', fillRes.result?.value);

    // Click "Generate token" button
    const genRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const genBtn = btns.find(b => b.textContent.includes('Generate token'));
        if (genBtn) {
          genBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log('Generate click result:', genRes.result?.value);

    await sleep(4000);

    // Read the generated token
    const tokenRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const tokenEl = document.getElementById('new-oauth-token') || document.querySelector('#oauth-token');
        return {
          token: tokenEl ? tokenEl.textContent.trim() : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Generated token result:', tokenRes.result?.value);
  }

  ws.close();
}

main().catch(console.error);
