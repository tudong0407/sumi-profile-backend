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

  const envContent = [
    'PORT=3000',
    'NODE_ENV=production',
    'SUPABASE_URL=https://lfvtysacdoadtvskqgkt.supabase.co',
    'SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdnR5c2FjZG9hZHR2c2txZ2t0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTA4Nzc1NiwiZXhwIjoyMTEwNjYzNzU2fQ.an706_l9ItnKr10NjXq6i6X3jb2UP7Y7nISXX-_dH9k'
  ].join('\n');

  console.log('Filling dotenv textarea...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textarea = document.getElementById('dotenv') || document.querySelector('textarea[name="dotenv"]');
      if (textarea) {
        textarea.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(textarea, ${JSON.stringify(envContent)});
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, valLength: textarea.value.length };
      }
      return { ok: false };
    })()`
  });
  await sleep(1000);

  // Click "Add variables" button
  console.log('Clicking Add variables button...');
  const addVarClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const btns = Array.from(dialog.querySelectorAll('button'));
        const addBtn = btns.find(b => b.textContent.includes('Add variables'));
        if (addBtn) {
          addBtn.click();
          return { clicked: true, text: addBtn.textContent };
        }
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Add variables result:', addVarClick.result?.value);
  await sleep(2000);

  // Verify variables added and click "Deploy web service"
  console.log('Clicking Deploy web service button...');
  const deployClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const deployBtn = btns.find(b => b.textContent.trim() === 'Deploy web service');
      if (deployBtn) {
        const disabled = deployBtn.disabled;
        if (!disabled) {
          deployBtn.click();
          return { clicked: true, disabled };
        }
        return { clicked: false, disabled };
      }
      return { found: false };
    })()`,
    returnByValue: true
  });
  console.log('Deploy button click:', deployClick.result?.value);

  console.log('Waiting for deployment to initiate...');
  await sleep(6000);

  const checkUrl = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        text: document.body.innerText.slice(0, 1000)
      };
    })()`,
    returnByValue: true
  });

  console.log('Status after deploy click:', JSON.stringify(checkUrl.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
