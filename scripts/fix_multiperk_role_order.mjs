import fs from 'node:fs';
import { MULTI_PERK_SPECS } from './create_14_multiperk_roles.mjs';

const GUILD_ID = '1026096141273661450';

const DUPLICATE_IDS_TO_DELETE = [
  '1573577771748302888',
  '1573577775036637245',
  '1573577778320904273',
  '1573577781890121789',
  '1573577785325395988',
  '1573577788969979934',
  '1573577795408498798',
  '1573577799468326964',
  '1573577808658178079',
  '1573577812181262507',
  '1573577816358789140',
  '1573577820574064650',
  '1573577824667828334',
  '1573577833236660384',
];

const KEPT_MULTI_PERK_IDS = [
  '1573577773279219763', // Song Tuyệt Kiếm Khách
  '1573577776454434899', // Huyễn Ảnh Linh Tôn
  '1573577779621138542', // Lôi Vũ Hộ Pháp
  '1573577782380728410', // Hàn Ngọc Tiên Tử
  '1573577786218651688', // Mật Các Trưởng Lão
  '1573577788965781504', // Kim Tiền Đạo Nhân
  '1573577794091225108', // Chiến Hồn Tiên Phong
  '1573577796742152314', // Thiên Âm Nhạc Sư
  '1573577799539892314', // Cửu Tiêu Phong Vương
  '1573577805286080523', // Thái Hư Chân Quân
  '1573577808867762186', // Vạn Bảo Tài Thần
  '1573577811786993756', // Bát Hoang Chiến Thần
  '1573577814437789797', // Hồng Trần Tiên Lữ
  '1573577816690401401', // Tinh Hà Pháp Vương
];

const BLOCK_TOP_TO_BOTTOM = [
  // Extra Role (5)
  '1496697237978349720',
  '1473574460656193616',
  '1519352393228222555',
  '1473333612404539513',
  '1473372858657804441',
  // Pet Level (6)
  '1487133030261719222',
  '1487134136547279088',
  '1487134131522506783',
  '1487151959457923102',
  '1487134121242394875',
  '1487071105486291145',
  // Role Quyền Năng (1 divider + 5 Supreme + 14 Multi + 21 Single = 41)
  '1573185994692239460',
  '1573185998857183253',
  '1573186003101941830',
  '1573186007262695644',
  '1573186011478102096',
  '1573186015785521265',
  ...KEPT_MULTI_PERK_IDS,
  '1573186019858317422',
  '1573186024048173076',
  '1573186028196462613',
  '1573186032289980416',
  '1573186036585201726',
  '1573186040716468316',
  '1573186045468614687',
  '1573186049289756712',
  '1573186053500833802',
  '1573186057778888745',
  '1573186061860077568',
  '1573186066134073394',
  '1573186070206742578',
  '1573186074153324608',
  '1573186078402158776',
  '1573186082768560198',
  '1573186087088554085',
  '1573186091094245416',
  '1573186095120908329',
  '1573186099663343747',
  '1573186103664574524',
  // Color Roles (14)
  '1473298013542813777',
  '1520752319552159887',
  '1520656914386653264',
  '1520656918589472788',
  '1520656921932337222',
  '1520657533163798529',
  '1520658097541087352',
  '1520657508169941053',
  '1520656899408658453',
  '1520658103547465898',
  '1520658090888925194',
  '1520658100590350417',
  '1520658106898579697',
  '1520658094307410030',
];

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const dcTab = tabs.find((t) => t.url?.includes('discord.com/channels') && t.type === 'page');
  if (!dcTab) throw new Error('No Discord tab');
  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let nid = 1;
  const call = (m, p = {}, timeoutMs = 25000) => new Promise((res, rej) => {
    const id = nid++;
    const t = setTimeout(() => rej(new Error('timeout ' + m)), timeoutMs);
    const fn = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === id) { clearTimeout(t); ws.removeEventListener('message', fn); res(d.result); }
    };
    ws.addEventListener('message', fn);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  await call('Page.bringToFront');
  await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      window.__sumiGetToken = () => {
        let token = null;
        window.webpackChunkdiscord_app.push([['sumi_fix_' + Math.random()], {}, (req) => {
          for (const id in req.c) {
            const exp = req.c[id]?.exports?.default || req.c[id]?.exports;
            if (exp && typeof exp.getToken === 'function') {
              try { const tok = exp.getToken(); if (tok && tok.length > 20) token = tok; } catch {}
            }
          }
        }]);
        return token;
      };
      window.__sumiApi = async (method, path, body = null) => {
        const token = window.__sumiGetToken();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        for (let attempt = 0; attempt < 6; attempt++) {
          const opts = { method, headers: { Authorization: token, 'Content-Type': 'application/json' } };
          if (body !== null) opts.body = JSON.stringify(body);
          const r = await fetch('https://discord.com/api/v10' + path, opts);
          if (r.status === 429) {
            const rd = await r.json().catch(() => ({}));
            await sleep(Math.ceil((rd.retry_after || 1.5) * 1000) + 250);
            continue;
          }
          return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) };
        }
        return { status: 429, data: null };
      };
      return true;
    })()`,
  });

  for (const dupId of DUPLICATE_IDS_TO_DELETE) {
    const r = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `window.__sumiApi('DELETE', '/guilds/${GUILD_ID}/roles/${dupId}')`,
    });
    console.log('Deleted dup', dupId, '-> status', r.result?.value?.status);
  }

  // Re-order contiguous block starting right above Special Roles divider (1473352137466577107)
  const ordRes = await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const pre = await window.__sumiApi('GET', '/guilds/${GUILD_ID}/roles');
      const preSorted = (pre.data || []).sort((a, b) => b.position - a.position);
      const specDiv = preSorted.find(r => r.id === '1473352137466577107');
      const startBottom = specDiv ? specDiv.position + 1 : 77;
      const block = ${JSON.stringify(BLOCK_TOP_TO_BOTTOM)};
      const posPayload = block.map((id, idx) => ({ id, position: startBottom + block.length - 1 - idx }));
      const patchRes = await window.__sumiApi('PATCH', '/guilds/${GUILD_ID}/roles', posPayload);
      const post = await window.__sumiApi('GET', '/guilds/${GUILD_ID}/roles');
      const sorted = (post.data || []).sort((a, b) => b.position - a.position);
      return { patchStatus: patchRes.status, totalRoles: sorted.length, roles: sorted.map(r => ({ position: r.position, id: r.id, name: r.name })) };
    })()`,
  }, 30000);

  const data = ordRes.result.value;
  console.log('PATCH status:', data.patchStatus, 'Total roles:', data.totalRoles);
  for (const r of data.roles.filter((x) => x.position >= 75)) {
    console.log(`${String(r.position).padStart(3)} | ${r.id} | ${r.name}`);
  }

  const out = {
    ok: data.patchStatus === 200 && data.totalRoles === 163,
    posStatus: data.patchStatus,
    totalRoles: data.totalRoles,
    createdOrUpdated: MULTI_PERK_SPECS.map((sp, i) => ({
      ...sp,
      id: KEPT_MULTI_PERK_IDS[i],
      status: 200,
    })),
    band: data.roles.filter((x) => x.position >= 75),
  };
  fs.writeFileSync('multi_perk_roles_result.json', JSON.stringify(out, null, 2), 'utf8');
  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
