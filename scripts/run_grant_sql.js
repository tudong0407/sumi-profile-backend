import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const supa = tabs.find(t => t.url?.includes('supabase.com/dashboard/project/lfvtysacdoadtvskqgkt'));
  const ws = new WebSocket(supa.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const sqlToRun = `
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
`;

  console.log('Setting Monaco editor value...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const model = window.monaco.editor.getModels()[0];
      model.setValue(${JSON.stringify(sqlToRun)});
    })()`
  });

  console.log('Triggering run...');
  const triggerRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.textContent?.trim().startsWith('Run'));
      if (runBtn) {
        const key = Object.keys(runBtn).find(k => k.startsWith('__reactProps$'));
        if (key && runBtn[key].onClick) {
          runBtn[key].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
          return { ok: true, method: 'reactProps.onClick' };
        }
        runBtn.click();
        return { ok: true, method: 'click' };
      }
      return { ok: false };
    })()`,
    returnByValue: true
  });
  console.log('Trigger result:', triggerRes.result?.value);

  await sleep(4000);

  // Check if confirmation modal or results appeared
  const checkRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find(b => b.textContent?.includes('Run without RLS') || b.textContent?.includes('Confirm'));
      if (confirmBtn) {
        confirmBtn.click();
        return { clickedConfirm: confirmBtn.textContent };
      }
      return { text: document.body.innerText.slice(0, 300) };
    })()`,
    returnByValue: true
  });
  console.log('Check modal:', checkRes.result?.value);

  await sleep(3000);

  ws.close();
}

main().catch(console.error);
