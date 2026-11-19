import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

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
  const supaTarget = tabs.find(t => t.url?.includes('supabase.com/dashboard/new'));

  const ws = new WebSocket(supaTarget.webSocketDebuggerUrl);
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

  console.log('1. Clicking "Generate a password" on Supabase...');
  const genRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Generate a password'));
      if (!btn) return { error: 'btn not found' };
      btn.click();
      return { clicked: true };
    })()`,
    returnByValue: true
  });
  console.log('Generate button click:', genRes.result?.value);

  await sleep(1500);

  const pwdInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const pass = document.querySelector('#dbPass') || document.querySelector('input[name="dbPass"]');
      const err = document.querySelector('[aria-describedby*="form-item-message"]')?.textContent?.trim();
      return {
        passValue: pass?.value,
        err
      };
    })()`,
    returnByValue: true
  });
  console.log('Password info after generate:', pwdInfo.result?.value);
  const supaPassword = pwdInfo.result?.value?.passValue;

  fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/supabase_credentials.json', JSON.stringify({
    dbPassword: supaPassword
  }, null, 2));

  console.log('2. Clicking "Create new project"...');
  const createRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create new project');
      if (!btn) return { error: 'no btn' };
      btn.click();
      return { clicked: true, disabled: btn.disabled };
    })()`,
    returnByValue: true
  });
  console.log('Create button click:', createRes.result?.value);

  console.log('3. Waiting for project provisioning redirect...');
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const check = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    const url = check.result?.value;
    console.log(`[URL Check ${i+1}] ${url}`);
    if (url && !url.includes('/new/')) {
      console.log('🎉 SUPABASE PROJECT CREATED SUCCESSFULLY! URL:', url);
      break;
    }
  }

  ws.close();
}

main().catch(console.error);
