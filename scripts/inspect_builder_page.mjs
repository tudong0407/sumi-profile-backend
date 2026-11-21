import WebSocket from 'ws';

// The "Build a new command" flow navigates to /dashboard/builder but the new-command setup 
// screen shows a form (not the full builder with CommandBuilder stateNode).
// The CommandBuilder stateNode (with validateSave) only mounts AFTER the initial setup form 
// is submitted (entering name + description).
// 
// We need to: 
// 1. Navigate to customcommands
// 2. Click "Start building" 
// 3. Fill name + description in the SETUP FORM
// 4. Submit the setup form (click Create or Continue)
// 5. THEN the full builder mounts with CommandBuilder stateNode
// 6. Inject elements

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) { console.error('No BotGhost tab'); return; }

  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${m}`)), 25000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  // Current state - navigate to builder (it should still be on the builder page)
  const currentUrl = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('Current URL:', currentUrl.result?.value);

  // Inspect what's on the page right now
  const pageState = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, name: i.name, placeholder: i.placeholder, type: i.type, value: i.value }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 50);
      const h1s = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim()).filter(t => t.length > 0);
      return { inputs: inputs.slice(0, 10), buttons: buttons.slice(0, 20), headings: h1s.slice(0, 10), url: window.location.href };
    })()`,
    returnByValue: true
  });
  console.log('Page state:', JSON.stringify(pageState.result?.value, null, 2));

  ws.close();
}

main().catch(console.error);
