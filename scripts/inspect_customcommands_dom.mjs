import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const textNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, span, button, a')).map(el => ({
          tag: el.tagName,
          text: el.textContent.trim(),
          classes: el.className
        })).filter(x => x.text.includes('profile') || x.text.includes('rank') || x.text.includes('wiki') || x.text.includes('builder'));
        return textNodes;
      })()`,
      returnByValue: true
    }
  }));
});
ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    console.log(JSON.stringify(res.result?.result?.value, null, 2));
    ws.close();
  }
});
