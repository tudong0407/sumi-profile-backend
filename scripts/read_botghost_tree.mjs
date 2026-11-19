import WebSocket from 'ws';
import LZString from 'lz-string';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const root = document.querySelector('#root');
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        const container = root[key];
        let curr = container;
        while (curr && !curr.memoizedProps?.store) {
          curr = curr.child;
        }
        const store = curr?.memoizedProps?.store;
        const slashCmds = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
        const profileCmd = slashCmds.find(c => c.name === 'profile');
        const rankCmd = slashCmds.find(c => c.name === 'rank');
        return {
          profileTree: profileCmd?.compressed_tree,
          rankTree: rankCmd?.compressed_tree
        };
      })()`,
      returnByValue: true
    }
  }));
});
ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    const val = res.result?.result?.value;
    if (val?.profileTree) {
      const decomp = LZString.decompressFromBase64(val.profileTree);
      console.log('--- PROFILE TREE DECOMPRESSED ---');
      console.log(decomp);
    }
    if (val?.rankTree) {
      const decompRank = LZString.decompressFromBase64(val.rankTree);
      console.log('--- RANK TREE DECOMPRESSED ---');
      console.log(decompRank);
    }
    ws.close();
  }
});
