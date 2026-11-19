import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

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
  const schemaPath = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/schema.sql';
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log(`Loaded schema.sql (${sql.length} bytes)`);

  const tabs = await getJson('http://127.0.0.1:9222/json');
  const supa = tabs.find(t => t.url?.includes('supabase.com/dashboard/project/lfvtysacdoadtvskqgkt'));
  const ws = new WebSocket(supa.webSocketDebuggerUrl);
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

  // Inject SQL into Monaco editor
  const injectRes = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        if (window.monaco && window.monaco.editor) {
          const models = window.monaco.editor.getModels();
          if (models.length > 0) {
            models[0].setValue(${JSON.stringify(sql)});
            return { ok: true, method: 'monaco.editor.getModels()[0]' };
          }
        }
        return { ok: false, error: 'monaco not found on window' };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    })()`,
    returnByValue: true
  });

  console.log('Inject result:', injectRes.result?.value);

  if (!injectRes.result?.value?.ok) {
    const fallbackRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const editorDom = document.querySelector('.monaco-editor');
        if (editorDom) {
          const textarea = editorDom.querySelector('textarea');
          if (textarea) {
            textarea.focus();
            return { ok: true, focused: true };
          }
        }
        return { ok: false, error: 'no textarea' };
      })()`,
      returnByValue: true
    });
    console.log('Fallback focus:', fallbackRes.result?.value);

    console.log('Inserting text via Input.insertText...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', commands: ['selectAll'], key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
    await sleep(200);

    await send('Input.insertText', { text: sql });
    console.log('Text inserted via CDP Input.insertText');
  }

  await sleep(1500);

  // Click "Run" button
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.textContent.includes('Run'));
      if (runBtn) {
        runBtn.click();
        return { clicked: true, text: runBtn.textContent };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Run button clicked:', clickRes.result?.value);

  console.log('Waiting for query execution...');
  await sleep(6000);

  const statusRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const main = document.querySelector('main') || document.body;
      return {
        text: main.innerText.slice(0, 2000)
      };
    })()`,
    returnByValue: true
  });
  console.log('Status after run:\n', statusRes.result?.value?.text?.slice(0, 800));

  ws.close();
}

main().catch(console.error);
