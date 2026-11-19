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
  if (!supaTarget) {
    console.error('No Supabase new project tab');
    return;
  }

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

  console.log('1. Setting Project Name to sumi-profile-backend...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const nameInput = document.querySelector('input[name="projectName"]') || document.querySelector('#_r_v_-form-item');
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, 'sumi-profile-backend');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`
  });

  console.log('2. Clicking "Generate a password"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const genBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Generate a password'));
      if (genBtn) genBtn.click();
    })()`
  });

  await sleep(1500);

  const pwdRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const passInput = document.querySelector('#dbPass') || document.querySelector('input[name="dbPass"]');
      return passInput?.value;
    })()`,
    returnByValue: true
  });

  const generatedPassword = pwdRes.result?.value;
  console.log('Generated DB Password:', generatedPassword);

  // Save password securely to local temp file
  fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/supabase_credentials.json', JSON.stringify({
    dbPassword: generatedPassword
  }, null, 2));

  console.log('3. Clicking "Create new project"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create new project');
      if (createBtn) createBtn.click();
    })()`
  });

  console.log('4. Waiting for project provisioning redirect...');
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const urlCheck = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    const currUrl = urlCheck.result?.value;
    console.log(`[URL Check ${i+1}/30] ${currUrl}`);
    if (currUrl && !currUrl.includes('/new/')) {
      console.log('🎉 SUPABASE PROJECT CREATION STARTED! URL:', currUrl);
      break;
    }
  }

  ws.close();
}

main().catch(console.error);
