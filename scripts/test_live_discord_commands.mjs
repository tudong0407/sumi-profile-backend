import fs from 'fs';
import WebSocket from 'ws';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const discordTab = tabs.find(t => t.url?.includes('discord.com/channels/1026096141273661450/1466390891399876668') && t.type === 'page')
    || tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
  if (!discordTab) throw new Error('No Discord tab found on port 9222');

  const ws = new WebSocket(discordTab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('WS connect timeout')), 10000);
    ws.once('open', () => { clearTimeout(t); res(); });
    ws.once('error', rej);
  });

  const send = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timer);
        ws.off('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    }
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.bringToFront');
  await sleep(400);

  // Clean up stray debug messages ("/l/battle", "a") in #staff-only if present
  const cleanupRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      let token = null;
      window.webpackChunkdiscord_app.push([['clean_stray_' + Math.random()], {}, (req) => {
        for (const id in req.c) {
          const mod = req.c[id];
          const exp = mod?.exports?.default || mod?.exports;
          if (exp && typeof exp.getToken === 'function') {
            try {
              const tok = exp.getToken();
              if (tok && typeof tok === 'string' && tok.length > 20) token = tok;
            } catch {}
          }
        }
      }]);
      if (!token) return { cleaned: 0, reason: 'no token' };
      const r = await fetch('https://discord.com/api/v9/channels/1466390891399876668/messages?limit=25', {
        headers: { 'Authorization': token }
      });
      if (!r.ok) return { cleaned: 0, status: r.status };
      const msgs = await r.json();
      let cleaned = 0;
      for (const m of msgs) {
        if (m.author?.id === '757091869183311872' && (m.content === '/l/battle' || m.content === 'a')) {
          await fetch('https://discord.com/api/v9/channels/1466390891399876668/messages/' + m.id, {
            method: 'DELETE',
            headers: { 'Authorization': token }
          });
          cleaned++;
          await new Promise(res => setTimeout(res, 400));
        }
      }
      return { cleaned };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Stray messages cleanup:', cleanupRes.result?.value);

  async function focusAndClearInput() {
    const boxRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
        if (!slate) return null;
        const r = slate.getBoundingClientRect();
        return { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2) };
      })()`,
      returnByValue: true
    });
    const box = boxRes.result?.value;
    if (!box) throw new Error('Slate editor not found');

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(150);

    for (let i = 0; i < 20; i++) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await sleep(25);
    }
    await sleep(150);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(150);
  }

  async function submitCurrentSlashCommand(optionText = null) {
    if (optionText) {
      await send('Input.insertText', { text: optionText });
      await sleep(500);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await sleep(300);
    }
    const subRes = await send('Runtime.evaluate', {
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
    });
    return subRes.result?.value;
  }

  async function triggerSlashCmd(cmdName, optionText = null) {
    await focusAndClearInput();
    await send('Input.insertText', { text: '/' + cmdName });
    await sleep(1200);

    const optRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const popout = document.querySelector('[class*="autocomplete"]');
        if (!popout) return { hasPopout: false };
        const items = [...popout.querySelectorAll('[role="option"], [class*="clickable"]')];
        const target = items.find(el => {
          const t = el.innerText || '';
          return t.includes('/${cmdName}') && t.includes('Nhiễm Nhiễm');
        }) || items.find(el => (el.innerText || '').includes('Nhiễm Nhiễm'));
        if (target) {
          const r = target.getBoundingClientRect();
          return {
            hasPopout: true,
            found: true,
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2),
            text: target.innerText.replace(/\\n+/g, ' | ')
          };
        }
        return {
          hasPopout: true,
          found: false,
          popoutText: popout.innerText.replace(/\\n+/g, ' | ').slice(0, 400)
        };
      })()`,
      returnByValue: true
    });
    console.log(`Autocomplete for /${cmdName}:`, optRes.result?.value);

    if (!optRes.result?.value?.found) {
      return { sent: false, info: optRes.result?.value };
    }

    const { x, y } = optRes.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(500);

    const sub = await submitCurrentSlashCommand(optionText);
    console.log(`Submitted /${cmdName}:`, sub);
    return { sent: true, sub };
  }

  async function getLastMsgId() {
    return (await send('Runtime.evaluate', {
      expression: `(() => {
        const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
        return msgs[msgs.length - 1]?.id || null;
      })()`,
      returnByValue: true
    })).result?.value;
  }

  // 1. Test /profile
  const beforeProfileId = await getLastMsgId();
  console.log('1. Sending /profile...');
  await triggerSlashCmd('profile');

  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const st = (await send('Runtime.evaluate', {
      expression: `(() => {
        const scroller = document.querySelector('[class*="scrollerInner"]')?.parentElement;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
        const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
        const last = msgs[msgs.length - 1];
        if (!last || last.id === ${JSON.stringify(beforeProfileId)}) return { waiting: true };
        const img = [...last.querySelectorAll('img')].find(i => (i.src || '').includes('api/profile') || i.naturalWidth > 200);
        return {
          id: last.id,
          text: (last.innerText || '').replace(/\\n+/g, ' | ').slice(0, 260),
          hasImg: !!img,
          imgLoaded: img ? (img.complete && img.naturalWidth > 100) : false,
          imgWidth: img ? img.naturalWidth : 0
        };
      })()`,
      returnByValue: true
    })).result?.value;
    console.log(`Poll /profile [${i + 1}]:`, st);
    if (st?.imgLoaded) break;
  }
  await focusAndClearInput();
  await sleep(800);
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('discord_live_profile_test.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved discord_live_profile_test.png');

  // 2. Test /battle
  const beforeBattleId = await getLastMsgId();
  console.log('2. Sending /battle...');
  const bTrig = await triggerSlashCmd('battle');
  if (bTrig.sent) {
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const st = (await send('Runtime.evaluate', {
        expression: `(() => {
          const scroller = document.querySelector('[class*="scrollerInner"]')?.parentElement;
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
          const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
          const last = msgs[msgs.length - 1];
          if (!last || last.id === ${JSON.stringify(beforeBattleId)}) return { waiting: true };
          const txt = last.innerText || '';
          return {
            id: last.id,
            text: txt.replace(/\\n+/g, ' | ').slice(0, 400),
            hasFinalBattle: txt.includes('KẾT QUẢ CHUNG CUỘC') || txt.includes('ATK')
          };
        })()`,
        returnByValue: true
      })).result?.value;
      console.log(`Poll /battle [${i + 1}]:`, st);
      if (st?.hasFinalBattle) break;
    }
    await focusAndClearInput();
    await sleep(800);
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discord_live_battle_test.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved discord_live_battle_test.png');
  }

  // 3. Test /rank
  const beforeRankId = await getLastMsgId();
  console.log('3. Sending /rank...');
  const rTrig = await triggerSlashCmd('rank');
  if (rTrig.sent) {
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const st = (await send('Runtime.evaluate', {
        expression: `(() => {
          const scroller = document.querySelector('[class*="scrollerInner"]')?.parentElement;
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
          const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
          const last = msgs[msgs.length - 1];
          if (!last || last.id === ${JSON.stringify(beforeRankId)}) return { waiting: true };
          const img = [...last.querySelectorAll('img')].find(i => (i.src || '').includes('api/rank') || i.naturalWidth > 200);
          return {
            id: last.id,
            text: (last.innerText || '').replace(/\\n+/g, ' | ').slice(0, 260),
            hasImg: !!img,
            imgLoaded: img ? (img.complete && img.naturalWidth > 100) : false,
            imgWidth: img ? img.naturalWidth : 0
          };
        })()`,
        returnByValue: true
      })).result?.value;
      console.log(`Poll /rank [${i + 1}]:`, st);
      if (st?.imgLoaded) break;
    }
  }

  // 4. Test /wiki with chuyen_muc: equipment
  const beforeWikiId = await getLastMsgId();
  console.log('4. Sending /wiki chuyen_muc:equipment...');
  const wTrig = await triggerSlashCmd('wiki', 'equipment');
  if (wTrig.sent) {
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const st = (await send('Runtime.evaluate', {
        expression: `(() => {
          const scroller = document.querySelector('[class*="scrollerInner"]')?.parentElement;
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
          const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')];
          const last = msgs[msgs.length - 1];
          if (!last || last.id === ${JSON.stringify(beforeWikiId)}) return { waiting: true };
          const txt = last.innerText || '';
          return {
            id: last.id,
            text: txt.replace(/\\n+/g, ' | ').slice(0, 400),
            hasWiki: txt.includes('45 Món Trang Bị Loadout') || txt.includes('CẨM NANG TU TIÊN')
          };
        })()`,
        returnByValue: true
      })).result?.value;
      console.log(`Poll /wiki [${i + 1}]:`, st);
      if (st?.hasWiki) break;
    }
  }

  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });
