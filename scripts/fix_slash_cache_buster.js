import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function fixCommand(ws, send, cmdName, endpointPath) {
  console.log(`\n=== FIXING COMMAND /${cmdName} ===`);
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  // Click card
  console.log(`Finding card /${cmdName}...`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      const h3s = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.trim() === '/${cmdName}');
      if (h3s.length > 0) h3s[0].click();
    })()`
  });
  await sleep(1500);

  // Click Open builder
  console.log(`Opening builder for /${cmdName}...`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim() === '/${cmdName}');
      const card = h3?.closest('.rounded-xl') || h3?.parentElement?.parentElement?.parentElement;
      const spans = Array.from((card || document).querySelectorAll('span')).filter(s => s.textContent.trim() === 'Open builder');
      if (spans.length > 0) (spans[0].parentElement || spans[0]).click();
    })()`
  });
  await sleep(4000);

  // Extract cb and elements
  const updateRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      if (!cb) return { error: 'No cb found' };

      const elements = cb.props.elements || [];
      const actionBlock = elements.find(el => el.id?.startsWith('action_') || el.type === 'action');
      if (!actionBlock) return { error: 'No action block found', elementsCount: elements.length };

      const newUrl = 'https://sumi-profile-backend.onrender.com/api/${endpointPath}/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
      
      // Update action block embed
      if (actionBlock.data?.data?.message?.embeds?.[0]?.image) {
        actionBlock.data.data.message.embeds[0].image.url = newUrl;
      }
      // Also ensure outside message content and description are empty
      if (actionBlock.data?.data?.message) {
        actionBlock.data.data.message.content = '';
      }
      if (actionBlock.data?.data?.message?.embeds?.[0]) {
        actionBlock.data.data.message.embeds[0].description = '';
      }

      if (cb.props.setSelected) cb.props.setSelected(null);
      cb.props.setElements([...elements]);

      const isValid = cb.validateSave();
      let saveRes = null;
      if (isValid) {
        saveRes = await cb.save();
      }

      return {
        success: true,
        isValid,
        saveRes,
        newUrl
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log(`Result for /${cmdName}:`, updateRes.result?.value);
  await sleep(3000);
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  if (!bg) throw new Error('No BotGhost tab found');

  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error(`Timeout ${method}`)), 25000);
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

  await fixCommand(ws, send, 'profile', 'profile');
  await fixCommand(ws, send, 'rank', 'rank');

  ws.close();
  console.log('\nAll commands updated with v=2 cache buster and saved to cloud!');
}

main().catch(console.error);
