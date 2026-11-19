import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/66E25C064912060BFD467AED8DFF06CA');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const title = document.title;
        const url = window.location.href;
        const msgElements = Array.from(document.querySelectorAll('li[class*="messageListItem"]')).slice(-5);
        return {
          title,
          url,
          count: msgElements.length,
          texts: msgElements.map(el => el.innerText)
        };
      })()`,
      returnByValue: true
    }
  }));
});
ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    console.log(JSON.stringify(res.result?.result?.value || res, null, 2));
    ws.close();
  }
});
