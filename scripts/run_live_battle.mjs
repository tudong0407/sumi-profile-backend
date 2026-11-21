import fs from 'fs';
import WebSocket from 'ws';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const discordTab = tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
  const ws = new WebSocket(discordTab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  const send = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timer = setTimeout(() => { ws.off('message', h); reject(new Error(`Timeout ${method}`)); }, timeoutMs);
    function h(data) {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) { clearTimeout(timer); ws.off('message', h); resolve(msg.result); }
    }
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.bringToFront');

  const beforeId = (await send('Runtime.evaluate', {
    expression: `(() => {
      const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
      return msgs[msgs.length - 1]?.id || null;
    })()`,
    returnByValue: true
  })).result?.value;

  const subRes = (await send('Runtime.evaluate', {
    expression: `(() => {
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      const fk = Object.keys(slate).find(k => k.startsWith('__reactFiber'));
      let f = slate[fk];
      let sn14 = null, sn26 = null;
      let depth = 0;
      while (f && depth < 35) {
        const sn = f.stateNode;
        if (sn && typeof sn.getCommandOptionValues === 'function') sn14 = sn;
        if (sn && typeof sn.handleSendMessage === 'function') sn26 = sn;
        f = f.return;
        depth++;
      }
      if (sn14 && typeof sn14.submit === 'function') {
        sn14.submit();
        return { called: 'sn14.submit', textAfter: slate.innerText };
      }
      if (sn26 && typeof sn26.submit === 'function') {
        sn26.submit();
        return { called: 'sn26.submit', textAfter: slate.innerText };
      }
      return { called: null };
    })()`,
    returnByValue: true
  })).result?.value;
  console.log('Submit result:', subRes);

  for (let i = 0; i < 18; i++) {
    await sleep(1000);
    const st = (await send('Runtime.evaluate', {
      expression: `(() => {
        const scroller = document.querySelector('[class*="scrollerInner"]')?.parentElement;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
        const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
        const last = msgs[msgs.length - 1];
        if (!last || last.id === ${JSON.stringify(beforeId)}) return { waiting: true };
        const txt = last.innerText || '';
        return {
          id: last.id,
          text: txt.replace(/\\n+/g, ' | ').slice(0, 500),
          hasFinalBattle: txt.includes('KẾT QUẢ CHUNG CUỘC') || txt.includes('ATK')
        };
      })()`,
      returnByValue: true
    })).result?.value;
    console.log(`Poll /battle [${i + 1}]:`, st);
    if (st?.hasFinalBattle) break;
  }

  await sleep(1000);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('discord_live_battle_test.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved discord_live_battle_test.png');
  ws.close();
}

main().catch(console.error);
