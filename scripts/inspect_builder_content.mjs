import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        // find text inside the main content area (excluding sidebar)
        const main = document.querySelector('.dash-content') || document.querySelector('main') || document.querySelector('#root > div > div > div > div');
        const text = main ? main.innerText : document.body.innerText;
        return {
          textLines: text.split('\\n').filter(Boolean).slice(0, 30)
        };
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
