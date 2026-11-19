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
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
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

  // Check what buttons exist right now
  const btns = await send('Runtime.evaluate', {
    expression: `(() => {
      return Array.from(document.querySelectorAll('button')).map((b, idx) => ({
        idx,
        text: b.textContent.trim(),
        className: b.className
      })).filter(b => b.text.includes('Build') || b.text.includes('building') || b.text.includes('Skip'));
    })()`,
    returnByValue: true
  });

  console.log('Build / building buttons:\n', JSON.stringify(btns.result?.value, null, 2));

  // If "Build a new command" exists, click it first
  const buildBtn = btns.result?.value?.find(b => b.text.includes('Build a new command'));
  if (buildBtn) {
    console.log(`Clicking button at index ${buildBtn.idx}...`);
    await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('button')[${buildBtn.idx}].click()`
    });
    await sleep(2000);
  }

  // Now check for modal buttons ("Start building" / "Skip for now")
  const modalBtns = await send('Runtime.evaluate', {
    expression: `(() => {
      return Array.from(document.querySelectorAll('button')).map((b, idx) => ({
        idx,
        text: b.textContent.trim()
      })).filter(b => b.text === 'Start building' || b.text === 'Skip for now');
    })()`,
    returnByValue: true
  });

  console.log('Modal buttons after click:\n', JSON.stringify(modalBtns.result?.value, null, 2));

  const target = modalBtns.result?.value?.find(b => b.text === 'Start building' || b.text === 'Skip for now');
  if (target) {
    console.log(`Clicking modal button: "${target.text}" at index ${target.idx}...`);
    await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('button')[${target.idx}].click()`
    });
    await sleep(3500);
  }

  // Check if CommandBuilder mounted
  const cbCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);
      return {
        hasCb: !!cb,
        url: window.location.href,
        textSnippet: document.body.innerText.slice(0, 400)
      };
    })()`,
    returnByValue: true
  });

  console.log('CommandBuilder state:\n', JSON.stringify(cbCheck.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
