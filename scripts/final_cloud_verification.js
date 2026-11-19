import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const handler = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);
      const events = store?.getState()?.data?.bot?.commands?.custom_events?.events || [];
      const evV2 = events.find(e => e.name === 'Automod Fubel v2');
      const evEdit = events.find(e => e.name === 'Automod Fubel (Edit)');
      return {
        v2: { name: evV2?.name, enabled: evV2?.enabled, tree: evV2?.compressed_tree },
        edit: { name: evEdit?.name, enabled: evEdit?.enabled, tree: evEdit?.compressed_tree }
      };
    })()`,
    returnByValue: true
  });

  ws.close();

  const { v2, edit } = res.result.value;

  console.log('--- FINAL CLOUD VERIFICATION & LIVE PARITY CHECK ---');

  [v2, edit].forEach(ev => {
    console.log(`\nVerifying "${ev.name}" (Enabled: ${ev.enabled})...`);
    const elements = JSON.parse(LZString.decompressFromBase64(ev.tree));
    
    // Extract all regex patterns
    const patterns = {};
    for (let i = 1; i <= 11; i++) {
      const id = `conChild_fubel_${i}`;
      const node = elements.find(e => e.id === id);
      patterns[id] = new RegExp(node.data.data.comparison_value, 'i');
    }

    const testList = [
      'fuuyumiii ii  bell',
      'FuyumiBesl',
      'fuyumi besl',
      'fuyumi bezzl',
      'fuyumi bell',
      'fuuyumiii bell',
      'fuuyumi besl',
      'fubel',
      'fubesl',
      'fym besl',
      'bell fuuyumiii',
      'besl fuyumi'
    ];

    let allPassed = true;
    testList.forEach(tc => {
      let matchNode = null;
      for (const [id, re] of Object.entries(patterns)) {
        if (re.test(tc)) {
          matchNode = id;
          break;
        }
      }
      if (!matchNode) {
        console.log(`  ❌ MISSED: "${tc}"`);
        allPassed = false;
      } else {
        console.log(`  ✅ MATCHED by ${matchNode}: "${tc}"`);
      }
    });

    if (allPassed) {
      console.log(`🌟 100% PASS ALL TESTS FOR "${ev.name}"!`);
    }
  });
}

main().catch(console.error);
