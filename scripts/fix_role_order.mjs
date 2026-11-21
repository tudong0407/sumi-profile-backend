import WebSocket from 'ws';
import fs from 'fs';

const GUILD_ID = '1026096141273661450';

const ORDERED_TOP_TO_BOTTOM = [
  // Pet Level Section (pos 123 -> 118)
  '1487133030261719222', // ✦ ──────・ 𓆩 Pet Level 𓆪 ・────── ✦
  '1487134136547279088', // « Omniscient Existence »
  '1487134131522506783', // « Transcendent Being »
  '1487151959457923102', // « Boundless Singularity »
  '1487134121242394875', // « Singularity Manifest »
  '1487071105486291145', // « Singularity Pet »
  // Role Quyền Năng Section (pos 117 -> 91)
  '1573185994692239460', // ✦ ──────・ 𓆩 Role Quyền Năng 𓆪 ・────── ✦
  '1573185998857183253', // « Cửu Vĩ Tối Thượng Thần Hồ »
  '1573186003101941830', // « SuMi Đệ Nhất Khách Tôn »
  '1573186007262695644', // « Vạn Cổ Chí Tôn »
  '1573186011478102096', // « Sáng Thế Thần Quân »
  '1573186015785521265', // « Cửu Vĩ Yêu Hậu »
  '1573186019858317422', // « Linh Âm Hồ Ca »
  '1573186024048173076', // « Phong Thanh Hộ Pháp »
  '1573186028196462613', // « Lôi Âm Tôn Giả »
  '1573186032289980416', // « Tịch Tĩnh Tán Nhân »
  '1573186036585201726', // « Bế Tức Chân Nhân »
  '1573186040716468316', // « Huyễn Diện Đạo Quân »
  '1573186045468614687', // « Định Danh Sứ Giả »
  '1573186049289756712', // « Thần Hành Cốt Cách »
  '1573186053500833802', // « Họa Đồ Linh Sư »
  '1573186057778888745', // « Vạn Tượng Linh Hồ »
  '1573186061860077568', // « Thần Phù Thượng Quan »
  '1573186066134073394', // « Khai Sơn Tiên Phong »
  '1573186070206742578', // « Mật Tàng Hộ Vệ »
  '1573186074153324608', // « Trấn Thư Pháp Vương »
  '1573186078402158776', // « Huyễn Âm Tiên Cô »
  '1573186082768560198', // « Cửu Châu Diễn Âm »
  '1573186087088554085', // « Linh Hồn Tu Luyện »
  '1573186091094245416', // « Tài Vận Hanh Thông »
  '1573186095120908329', // « Tiêu Dao Khách »
  '1573186099663343747', // « Trảm Phong Kiếm Khách »
  '1573186103664574524'  // « Thần Thông Thấu Thị »
];

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const dcTab = tabs.find(t => t.url?.includes('discord.com/channels') && t.type === 'page');
  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 25000);
    ws.on('message', function h(d) {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { clearTimeout(t); ws.off('message', h); resolve(msg.result); }
    });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const posPayload = ORDERED_TOP_TO_BOTTOM.map((id, idx) => ({
    id,
    position: 123 - idx // 123 down to 91
  }));

  const res = await send('Runtime.evaluate', {
    expression: `(async (payload) => {
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
      const r = await fetch('https://discord.com/api/v10/guilds/${GUILD_ID}/roles', {
        method: 'PATCH',
        headers: { 'Authorization': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const roles = await r.json();
      roles.sort((a, b) => b.position - a.position);
      return { status: r.status, roles };
    })(${JSON.stringify(posPayload)})`,
    awaitPromise: true,
    returnByValue: true
  });

  ws.close();
  const { status, roles } = res.result?.value || {};
  console.log('PATCH status:', status, 'total roles:', roles?.length);
  fs.writeFileSync('live_guild_roles.json', JSON.stringify(roles, null, 2), 'utf8');
  for (const r of roles.filter(x => x.position >= 88 && x.position <= 126)) {
    console.log(`${String(r.position).padStart(3, ' ')} | ${r.id} | ${r.name}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
