import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const dcTab = tabs.find(t => t.url?.includes('discord.com/channels') && t.type === 'page');
  if (!dcTab) throw new Error('No Discord tab found');

  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 20000);
    ws.on('message', function h(d) {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { clearTimeout(t); ws.off('message', h); resolve(msg.result); }
    });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      let token = null;
      window.webpackChunkdiscord_app.push([['extract_token_' + Math.random()], {}, (req) => {
        for (const id in req.c) {
          const mod = req.c[id];
          if (mod && mod.exports) {
            const exp = mod.exports.default || mod.exports;
            if (exp && typeof exp.getToken === 'function') {
              try {
                const tok = exp.getToken();
                if (tok && typeof tok === 'string' && tok.length > 20) token = tok;
              } catch (e) {}
            }
          }
        }
      }]);
      const meRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { 'Authorization': token }
      });
      const me = await meRes.json();
      const guildRes = await fetch('https://discord.com/api/v10/guilds/1026096141273661450/roles', {
        headers: { 'Authorization': token }
      });
      const roles = await guildRes.json();
      const fuyumiRes = await fetch('https://discord.com/api/v10/guilds/1026096141273661450/members/757091869183311872', {
        headers: { 'Authorization': token }
      });
      const fuyumi = await fuyumiRes.json();
      return { me, roles, fuyumi };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  ws.close();
  const { me, roles, fuyumi } = res.result?.value || {};
  console.log('Logged in Discord user:', me?.id, me?.username, me?.global_name);
  console.log('Fuyumi member info:', JSON.stringify({
    id: fuyumi?.user?.id,
    username: fuyumi?.user?.username,
    global_name: fuyumi?.user?.global_name,
    nick: fuyumi?.nick,
    avatar: fuyumi?.user?.avatar,
    guild_avatar: fuyumi?.avatar,
    roles: fuyumi?.roles
  }, null, 2));

  roles.sort((a, b) => b.position - a.position);
  fs.writeFileSync('live_guild_roles.json', JSON.stringify(roles, null, 2), 'utf8');
  console.log('Total live roles:', roles.length);
  for (const r of roles) {
    console.log(`${String(r.position).padStart(3, ' ')} | ${r.id} | ${r.name} | perms=${r.permissions} | color=${r.color} | hoist=${r.hoist} | managed=${r.managed}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
