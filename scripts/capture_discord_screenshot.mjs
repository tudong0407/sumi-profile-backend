import WebSocket from 'ws';
import fs from 'fs';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/66E25C064912060BFD467AED8DFF06CA');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Page.captureScreenshot',
    params: {
      format: 'png'
    }
  }));
});

ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1 && res.result?.data) {
    const buf = Buffer.from(res.result.data, 'base64');
    fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/discord_live_screenshot.png', buf);
    console.log('Saved discord_live_screenshot.png (bytes:', buf.length, ')');
    ws.close();
  }
});
