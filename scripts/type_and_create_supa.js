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

  console.log('1. Focus and type Project Name: sumi-profile-backend...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input[name="projectName"]') || document.querySelector('#_r_v_-form-item');
      input.focus();
      input.select();
    })()`
  });
  await send('Input.insertText', { text: 'sumi-profile-backend' });
  await sleep(1000);

  console.log('2. Focus and type dbPass...');
  const dbPassword = 'Fuyumi@Sumi2026!Db';
  await send('Runtime.evaluate', {
    expression: `(() => {
      const pass = document.querySelector('#dbPass') || document.querySelector('input[name="dbPass"]');
      pass.focus();
      pass.select();
    })()`
  });
  await send('Input.insertText', { text: dbPassword });
  await sleep(1500);

  fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/supabase_credentials.json', JSON.stringify({
    dbPassword: dbPassword
  }, null, 2));

  console.log('3. Inspecting Create new project button state...');
  const btnCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Create new project'));
      const pass = document.querySelector('#dbPass') || document.querySelector('input[name="dbPass"]');
      const name = document.querySelector('input[name="projectName"]');
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const rect = btn.getBoundingClientRect();
      return {
        nameVal: name?.value,
        passValLength: pass?.value?.length,
        disabled: btn?.disabled,
        rect: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      };
    })()`,
    returnByValue: true
  });
  console.log('Button state:', btnCheck.result?.value);
  const { rect } = btnCheck.result?.value || {};

  console.log('4. Dispatching real click on Create new project...');
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(rect.x),
    y: Math.round(rect.y)
  });
  await sleep(150);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    button: 'left',
    clickCount: 1
  });
  await sleep(150);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    button: 'left',
    clickCount: 1
  });

  console.log('5. Monitoring navigation...');
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const urlCheck = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    console.log(`[URL Check ${i+1}] ${urlCheck.result?.value}`);
    if (urlCheck.result?.value && !urlCheck.result?.value?.includes('/new/')) {
      console.log('🎉 NAVIGATED TO PROJECT PROVISIONING:', urlCheck.result?.value);
      break;
    }
  }

  ws.close();
}

main().catch(console.error);
