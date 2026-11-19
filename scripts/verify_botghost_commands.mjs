import WebSocket from 'ws';
import LZString from 'lz-string';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) {
    console.error('BotGhost tab not found');
    return;
  }
  console.log('Connecting to BotGhost tab:', bgTab.title, bgTab.url);
  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
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

  const commandsInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      const container = root[key];
      let curr = container;
      while (curr && !curr.memoizedProps?.store) {
        curr = curr.child;
      }
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      const slash = state?.data?.bot?.commands?.slash?.commands || [];
      const customCmds = state?.data?.bot?.commands?.custom_commands?.commands || [];
      const events = state?.data?.bot?.commands?.custom_events?.events || [];

      return {
        botName: state?.data?.bot?.name,
        botId: state?.data?.bot?.id,
        slashCommands: slash.map(c => ({
          name: c.name,
          description: c.description,
          enabled: c.enabled,
          hasTree: !!c.compressed_tree
        })),
        customCommands: customCmds.map(c => ({
          name: c.name,
          enabled: c.enabled
        })),
        eventsCount: events.length
      };
    })()`,
    returnByValue: true
  });
  console.log('Commands Overview:', JSON.stringify(commandsInfo.result?.value, null, 2));

  // Inspect /profile, /rank, /wiki specifically
  const detailTree = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      const container = root[key];
      let curr = container;
      while (curr && !curr.memoizedProps?.store) {
        curr = curr.child;
      }
      const store = curr?.memoizedProps?.store;
      const slash = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
      
      const prof = slash.find(c => c.name === 'profile');
      const rank = slash.find(c => c.name === 'rank');
      const wiki = slash.find(c => c.name === 'wiki');
      
      return {
        profTree: prof?.compressed_tree,
        rankTree: rank?.compressed_tree,
        wikiTree: wiki?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const { profTree, rankTree, wikiTree } = detailTree.result?.value || {};
  console.log('\n--- PROFILE COMMAND DECOMPRESSED ---');
  if (profTree) {
    const decProf = LZString.decompressFromBase64(profTree);
    console.log('Profile Tree length:', decProf.length);
    // Find URL or endpoint in profile tree
    const urls = decProf.match(/https?:\/\/[^\s"']+/g) || [];
    console.log('Profile URLs found:', Array.from(new Set(urls)));
  }

  console.log('\n--- RANK COMMAND DECOMPRESSED ---');
  if (rankTree) {
    const decRank = LZString.decompressFromBase64(rankTree);
    console.log('Rank Tree length:', decRank.length);
    const urls = decRank.match(/https?:\/\/[^\s"']+/g) || [];
    console.log('Rank URLs found:', Array.from(new Set(urls)));
  }

  console.log('\n--- WIKI COMMAND DECOMPRESSED ---');
  if (wikiTree) {
    const decWiki = LZString.decompressFromBase64(wikiTree);
    console.log('Wiki Tree length:', decWiki.length);
    const urls = decWiki.match(/https?:\/\/[^\s"']+/g) || [];
    console.log('Wiki URLs found:', Array.from(new Set(urls)));
  }

  ws.close();
}

main().catch(console.error);
