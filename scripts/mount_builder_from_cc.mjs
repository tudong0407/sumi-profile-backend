import WebSocket from 'ws';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) throw new Error('No BotGhost tab');

  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const t = setTimeout(() => { ws.close(); reject(new Error('timeout ' + m)); }, 25000);
    ws.on('message', function h(d) {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { clearTimeout(t); ws.off('message', h); resolve(msg.result); }
    });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  // Navigate via React Router or Page.navigate to /dashboard/customevents
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
  await sleep(3500);

  // Expand an event card and click "Open builder"
  const clickRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      for (let i = 0; i < 20; i++) {
        const cards = [...document.querySelectorAll('div, h3, h4, span')].filter(el => el.textContent?.trim() === 'Automod Fubel v2');
        if (cards.length > 0) {
          cards[0].click();
          await new Promise(r => setTimeout(r, 600));
          const openBtn = [...document.querySelectorAll('button')].find(b => /Open builder/i.test(b.innerText || ''));
          if (openBtn) {
            openBtn.click();
            return { clicked: true };
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return { clicked: false, url: location.href, text: document.body.innerText.slice(0, 500) };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Click Open builder:', clickRes.result?.value);
  await sleep(2500);

  const cbInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const rootEl = document.getElementById('root');
      const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
      let f = rootEl[rk], store = null, cb = null, q = [f], seen = new Set();
      while (q.length) {
        const n = q.shift();
        if (!n || seen.has(n)) continue; seen.add(n);
        if (n.memoizedProps?.store) store = n.memoizedProps.store;
        if (n.stateNode?.validateSave && n.stateNode?.buildCommand) cb = n.stateNode;
        if (n.child) q.push(n.child);
        if (n.sibling) q.push(n.sibling);
      }
      return {
        hasStore: !!store,
        hasCb: !!cb,
        url: location.href,
        buildCommandSrc: cb ? cb.buildCommand.toString() : null,
        saveBotSrc: cb && cb.saveBot ? cb.saveBot.toString() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('CB Info:', JSON.stringify(cbInfo.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
