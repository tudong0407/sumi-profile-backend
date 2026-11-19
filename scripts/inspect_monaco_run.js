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

  // Let's check the Monaco editor model content and keyboard shortcuts
  const checkEditor = await send('Runtime.evaluate', {
    expression: `(() => {
      let code = '';
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        code = models.map(m => ({ uri: m.uri.toString(), length: m.getValue().length, preview: m.getValue().slice(0, 100) }));
      }
      return { code };
    })()`,
    returnByValue: true
  });

  console.log('Editor models:', JSON.stringify(checkEditor.result?.value, null, 2));

  // Let's check what action "Run" triggers in Monaco
  const runAction = await send('Runtime.evaluate', {
    expression: `(() => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      return {
        editorCount: editors.length,
        actions: editors[0] ? editors[0].getSupportedActions().map(a => a.id).filter(id => id.toLowerCase().includes('run')) : []
      };
    })()`,
    returnByValue: true
  });
  console.log('Run actions in editor:', runAction.result?.value);

  // Let's check what the Run button's props are
  const btnDetails = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.textContent.includes('Run'));
      const key = Object.keys(runBtn).find(k => k.startsWith('__reactProps$'));
      if (key) {
        const props = runBtn[key];
        return {
          propsKeys: Object.keys(props),
          onClickStr: props.onClick ? props.onClick.toString().slice(0, 200) : null
        };
      }
      return null;
    })()`,
    returnByValue: true
  });
  console.log('Run button details:', btnDetails.result?.value);

  ws.close();
}

main().catch(console.error);
