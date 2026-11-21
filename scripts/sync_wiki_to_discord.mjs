import WebSocket from 'ws';
import LZString from 'lz-string';

// The /wiki command has empty id and undefined enabled - this means it's a NEW command
// that hasn't been synced to Discord's command registry yet.
// BotGhost syncs commands via the Save Bot button which triggers a Discord API call.
// We need to trigger the Save Bot action.

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${m}`)), 20000);
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

  console.log('Looking for Save Bot button...');

  // Navigate to main dashboard to find Save Bot button
  const navRes = await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/' });
  console.log('Navigating to dashboard...');
  await new Promise(r => setTimeout(r, 4000));

  // Look for the global Save Bot button
  const saveBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBot = btns.find(b => b.textContent.trim().includes('Save Bot') || b.textContent.trim().includes('Lưu bot'));
      if (saveBot) {
        saveBot.click();
        return { clicked: true, text: saveBot.textContent.trim() };
      }
      // Try any prominent save button
      const allTexts = btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 50);
      return { clicked: false, buttonTexts: allTexts.slice(0, 20) };
    })()`,
    returnByValue: true
  });
  console.log('Save button result:', saveBtn.result?.value);

  await new Promise(r => setTimeout(r, 3000));

  // Now navigate back to customcommands to trigger a re-sync
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await new Promise(r => setTimeout(r, 4000));

  // Check if /wiki now has an ID (meaning it got registered with Discord)
  const afterCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector("#root");
      const key = Object.keys(root).find(k => k.startsWith("__reactContainer$"));
      let curr = root[key];
      while (curr && !curr.memoizedProps?.store) curr = curr.child;
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      const slash = state?.data?.bot?.commands?.slash?.commands || [];
      const wiki = slash.find(c => c.name === 'wiki');
      return {
        wikiId: wiki?.id,
        wikiEnabled: wiki?.enabled,
        wikiHasTree: !!wiki?.compressed_tree,
        total: slash.length
      };
    })()`,
    returnByValue: true
  });
  console.log('After re-check:', afterCheck.result?.value);

  ws.close();
}

main().catch(console.error);
