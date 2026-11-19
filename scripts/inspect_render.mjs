import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  let targetTab = tabs.find(t => t.url?.includes('github.com/settings/tokens') && t.type === 'page');
  if (!targetTab) {
    targetTab = tabs.find(t => t.type === 'page' && !t.url?.includes('discord') && !t.url?.includes('botghost'));
  }
  console.log('Connecting to tab:', targetTab.title, targetTab.url);
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  console.log('Navigating to Render deploys...');
  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g/deploys' });
  await new Promise(r => setTimeout(r, 6000));

  const pageInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.split('\\n').filter(Boolean).slice(0, 60)
      };
    })()`,
    returnByValue: true
  });
  console.log('Page info:', JSON.stringify(pageInfo.result?.value, null, 2));

  const buttons = await send('Runtime.evaluate', {
    expression: `(() => {
      return Array.from(document.querySelectorAll('button, a')).map(el => ({ text: el.textContent.trim(), tag: el.tagName, ariaLabel: el.getAttribute('aria-label') })).filter(t => t.text.toLowerCase().includes('deploy') || (t.ariaLabel && t.ariaLabel.toLowerCase().includes('deploy')));
    })()`,
    returnByValue: true
  });
  console.log('Deploy buttons:', buttons.result?.value);

  ws.close();
}

main().catch(console.error);
