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

  console.log('Triggering run action...');
  const triggerRes = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        const editor = window.monaco.editor.getEditors()[0];
        if (editor) {
          editor.focus();
          const action = editor.getAction('vs.editor.ICodeEditor:1:run-query');
          if (action) {
            action.run();
            return { ok: true, action: 'vs.editor.ICodeEditor:1:run-query' };
          }
        }

        // Also call props.onClick directly
        const btns = Array.from(document.querySelectorAll('button'));
        const runBtn = btns.find(b => b.textContent.includes('Run'));
        const key = Object.keys(runBtn).find(k => k.startsWith('__reactProps$'));
        if (key && runBtn[key].onClick) {
          runBtn[key].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
          return { ok: true, action: 'reactProps.onClick' };
        }
        return { ok: false };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    })()`,
    returnByValue: true
  });

  console.log('Trigger result:', triggerRes.result?.value);
  console.log('Waiting 8 seconds for execution...');
  await sleep(8000);

  const checkText = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        hasSuccess: text.includes('Success') || text.includes('Success. No rows returned'),
        hasError: text.includes('ERROR') || text.includes('error'),
        textSnippet: text.slice(text.indexOf('Database'), text.indexOf('Database') + 600)
      };
    })()`,
    returnByValue: true
  });

  console.log('Status after action:', JSON.stringify(checkText.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
