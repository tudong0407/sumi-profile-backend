import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const GUILD_ID = '1026096141273661450';

const PERM = {
  ADD_REACTIONS: 1n << 6n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_SOUNDBOARD: 1n << 42n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  PIN_MESSAGES: 1n << 51n,
  BYPASS_SLOWMODE: 1n << 52n,
};

const combinePerms = (...flags) => flags.reduce((acc, f) => acc | f, 0n).toString();

export const MULTI_PERK_SPECS = [
  // 8 Role Linh Phẩm (2 chức năng)
  {
    key: 'song_tuyet_kiem_khach',
    name: '« Song Tuyệt Kiếm Khách »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0x60a5fa,
    permissions: combinePerms(PERM.BYPASS_SLOWMODE, PERM.PIN_MESSAGES),
    perk: '⚡📌 Miễn Slowmode & Ghim Tin Nhắn',
  },
  {
    key: 'huyen_anh_linh_ton',
    name: '« Huyễn Ảnh Linh Tôn »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0x818cf8,
    permissions: combinePerms(PERM.CHANGE_NICKNAME, PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS),
    perk: '🎭✨ Đổi Nickname, Emoji/Sticker Ngoại & +10% EXP',
  },
  {
    key: 'loi_vu_ho_phap',
    name: '« Lôi Vũ Hộ Pháp »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0x38bdf8,
    permissions: combinePerms(PERM.MOVE_MEMBERS, PERM.PRIORITY_SPEAKER, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🎙️📢 Di Chuyển & Ưu Tiên Nói Voice',
  },
  {
    key: 'han_ngoc_tien_tu',
    name: '« Hàn Ngọc Tiên Tử »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0x22d3ee,
    permissions: combinePerms(PERM.STREAM, PERM.USE_SOUNDBOARD, PERM.USE_EXTERNAL_SOUNDS, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '📺🔊 Stream HD, Soundboard Ngoại & +10% Daily LT',
  },
  {
    key: 'mat_cac_truong_lao',
    name: '« Mật Các Trưởng Lão »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0x2dd4bf,
    permissions: combinePerms(PERM.CREATE_PUBLIC_THREADS, PERM.CREATE_PRIVATE_THREADS, PERM.SEND_MESSAGES_IN_THREADS, PERM.READ_MESSAGE_HISTORY),
    perk: '💬👁️ Tạo Thread Kín/Mở, Đọc Kênh Ẩn & +12% EXP',
  },
  {
    key: 'kim_tien_dao_nhan',
    name: '« Kim Tiền Đạo Nhân »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0xfbbf24,
    permissions: combinePerms(PERM.ADD_REACTIONS, PERM.USE_EXTERNAL_EMOJIS),
    perk: '💎🏷️ Buff +25% Daily LT & Giảm 5% Giá Shop',
  },
  {
    key: 'chien_hon_tien_phong',
    name: '« Chiến Hồn Tiên Phong »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0xfb7185,
    permissions: combinePerms(PERM.BYPASS_SLOWMODE, PERM.ATTACH_FILES, PERM.EMBED_LINKS),
    perk: '⚔️⚡ Buff +8% Chiến Lực Pet & Miễn Slowmode',
  },
  {
    key: 'thien_am_nhac_su',
    name: '« Thiên Âm Nhạc Sư »',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    color: 0xe879f9,
    permissions: combinePerms(PERM.PRIORITY_SPEAKER, PERM.USE_SOUNDBOARD, PERM.USE_EXTERNAL_SOUNDS, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🎵📢 Ưu Tiên Voice, Âm Ngoại & +12% EXP Voice',
  },
  // 6 Role Tiên Phẩm (3–4 chức năng)
  {
    key: 'cuu_tieu_phong_vuong',
    name: '« Cửu Tiêu Phong Vương »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0xa855f7,
    permissions: combinePerms(PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.BYPASS_SLOWMODE, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🌬️🔇 Move & Mute Voice, Miễn Slowmode & +20% EXP',
  },
  {
    key: 'thai_hu_chan_quan',
    name: '« Thái Hư Chân Quân »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0xc084fc,
    permissions: combinePerms(PERM.MANAGE_NICKNAMES, PERM.CHANGE_NICKNAME, PERM.PIN_MESSAGES, PERM.CREATE_PRIVATE_THREADS, PERM.SEND_MESSAGES_IN_THREADS),
    perk: '🏷️📌 Quản Lý Nick, Ghim Tin, Thread Kín & +20% Daily LT',
  },
  {
    key: 'van_bao_tai_than',
    name: '« Vạn Bảo Tài Thần »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0xf59e0b,
    permissions: combinePerms(PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS, PERM.ATTACH_FILES, PERM.EMBED_LINKS),
    perk: '💰✨ Buff +35% Daily LT, Giảm 10% Shop/Roll & Emoji/Sticker',
  },
  {
    key: 'bat_hoang_chien_than',
    name: '« Bát Hoang Chiến Thần »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0xf43f5e,
    permissions: combinePerms(PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE, PERM.STREAM, PERM.CONNECT, PERM.SPEAK),
    perk: '🔥⚔️ Buff +15% Chiến Lực Pet, +20% EXP, Ghim & Bypass Slowmode',
  },
  {
    key: 'hong_tran_tien_lu',
    name: '« Hồng Trần Tiên Lữ »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0xec4899,
    permissions: combinePerms(PERM.STREAM, PERM.USE_SOUNDBOARD, PERM.USE_EXTERNAL_SOUNDS, PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS, PERM.CONNECT, PERM.SPEAK),
    perk: '🌸💫 Buff +25% EXP, +10% Chiến Lực Pet, Stream HD & Sound/Emoji',
  },
  {
    key: 'tinh_ha_phap_vuong',
    name: '« Tinh Hà Pháp Vương »',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    color: 0x6366f1,
    permissions: combinePerms(PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.PIN_MESSAGES, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🌌🛡️ Move/Mute/Deafen Voice, Ghim Tin & +25% EXP',
  },
];

const PET_LEVEL_AND_SUPREME_TOP = [
  '1487133030261719222', // ✦ ──────・ 𓆩 Pet Level 𓆪 ・────── ✦
  '1487134136547279088', // « Omniscient Existence »
  '1487134131522506783', // « Transcendent Being »
  '1487151959457923102', // « Boundless Singularity »
  '1487134121242394875', // « Singularity Manifest »
  '1487071105486291145', // « Singularity Pet »
  '1573185994692239460', // ✦ ──────・ 𓆩 Role Quyền Năng 𓆪 ・────── ✦
  '1573185998857183253', // « Cửu Vĩ Tối Thượng Thần Hồ »
  '1573186003101941830', // « SuMi Đệ Nhất Khách Tôn »
  '1573186007262695644', // « Vạn Cổ Chí Tôn »
  '1573186011478102096', // « Sáng Thế Thần Quân »
  '1573186015785521265', // « Cửu Vĩ Yêu Hậu »
];

const SINGLE_PERK_BOTTOM = [
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
  '1573186103664574524', // « Thần Thông Thấu Thị »
];

async function createCdp() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const dcTab = tabs.find((t) => t.url?.includes('discord.com/channels') && t.type === 'page');
  if (!dcTab) throw new Error('Không tìm thấy tab Discord trên Edge CDP 9222');

  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('WS open timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener('error', (e) => { clearTimeout(t); rej(e); }, { once: true });
  });

  let nextId = 1;
  const call = (method, params = {}, timeoutMs = 25000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error(`CDP timeout on ${method}`));
    }, timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(t);
        ws.removeEventListener('message', onMsg);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

  return { ws, call };
}

async function main() {
  const { ws, call } = await createCdp();
  try {
    await call('Page.bringToFront');
    console.log('[CDP] Connected to Discord tab.');

    // Inject lightweight in-page Discord API helper (keeps token strictly inside page memory)
    const initCheck = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        if (!window.__sumiGetToken) {
          window.__sumiGetToken = () => {
            let token = null;
            window.webpackChunkdiscord_app.push([['sumi_tok_' + Math.random()], {}, (req) => {
              for (const id in req.c) {
                const mod = req.c[id];
                const exp = mod?.exports?.default || mod?.exports;
                if (exp && typeof exp.getToken === 'function') {
                  try {
                    const tok = exp.getToken();
                    if (tok && typeof tok === 'string' && tok.length > 20) token = tok;
                  } catch {}
                }
              }
            }]);
            return token;
          };
          window.__sumiApi = async (method, path, body = null) => {
            const token = window.__sumiGetToken();
            if (!token) throw new Error('No token');
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            for (let attempt = 0; attempt < 6; attempt++) {
              const opts = {
                method,
                headers: { 'Authorization': token, 'Content-Type': 'application/json' },
              };
              if (body !== null) opts.body = JSON.stringify(body);
              const res = await fetch('https://discord.com/api/v10' + path, opts);
              if (res.status === 429) {
                const rd = await res.json().catch(() => ({}));
                await sleep(Math.ceil((rd.retry_after || 1.5) * 1000) + 250);
                continue;
              }
              const data = res.status === 204 ? null : await res.json().catch(() => null);
              return { status: res.status, data };
            }
            return { status: 429, data: null };
          };
        }
        const r = await window.__sumiApi('GET', '/guilds/${GUILD_ID}/roles');
        return {
          status: r.status,
          roles: (r.data || []).map(x => ({ id: x.id, name: x.name, position: x.position })),
        };
      })()`,
    });

    const rolesInfo = initCheck.result?.value;
    if (!rolesInfo || rolesInfo.status !== 200) {
      throw new Error(`GET roles failed: ${JSON.stringify(rolesInfo)}`);
    }

    const byName = new Map(rolesInfo.roles.map((r) => [r.name, r]));
    const existingSet = new Set(rolesInfo.roles.map((r) => r.id));
    const colorBefore = rolesInfo.roles.find((r) => r.id === '1473298013542813777');
    const colorBasePos = colorBefore ? colorBefore.position : 90;
    console.log(`[Roles] Total live roles: ${rolesInfo.roles.length}, Color divider pos: ${colorBasePos}`);

    const results = [];
    for (const sp of MULTI_PERK_SPECS) {
      const ex = byName.get(sp.name);
      const stepRes = await call('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
          ${ex
            ? `const r = await window.__sumiApi('PATCH', '/guilds/${GUILD_ID}/roles/${ex.id}', ${JSON.stringify({ name: sp.name, color: sp.color, hoist: false, permissions: sp.permissions })});
               return { action: 'updated', id: '${ex.id}', status: r.status };`
            : `const r = await window.__sumiApi('POST', '/guilds/${GUILD_ID}/roles', ${JSON.stringify({ name: sp.name, color: sp.color, hoist: false, permissions: sp.permissions, mentionable: false })});
               return { action: 'created', id: r.data?.id || null, status: r.status };`}
        })()`,
      }, 25000);

      const v = stepRes.result?.value;
      console.log(`  - ${sp.name}: ${v?.action} id=${v?.id} status=${v?.status}`);
      if (!v?.id || (v.status !== 200 && v.status !== 201)) {
        throw new Error(`Failed creating/updating role ${sp.name}: ${JSON.stringify(v)}`);
      }
      results.push({ ...sp, id: v.id, action: v.action, status: v.status });
      await new Promise((r) => setTimeout(r, 250));
    }

    const orderedIds = [
      ...PET_LEVEL_AND_SUPREME_TOP.filter((id) => existingSet.has(id)),
      ...results.map((r) => r.id),
      ...SINGLE_PERK_BOTTOM.filter((id) => existingSet.has(id)),
    ];
    const count = orderedIds.length;
    const posPayload = orderedIds.map((id, idx) => ({
      id,
      position: colorBasePos + count - idx,
    }));

    const orderRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const posRes = await window.__sumiApi('PATCH', '/guilds/${GUILD_ID}/roles', ${JSON.stringify(posPayload)});
        const fin = await window.__sumiApi('GET', '/guilds/${GUILD_ID}/roles');
        const sorted = (fin.data || []).sort((a, b) => b.position - a.position);
        return {
          posStatus: posRes.status,
          totalRoles: sorted.length,
          band: sorted
            .filter(r => r.position >= ${colorBasePos - 1} && r.position <= ${colorBasePos + count + 3})
            .map(r => ({ position: r.position, id: r.id, name: r.name })),
        };
      })()`,
    }, 25000);

    const ord = orderRes.result?.value;
    const out = {
      ok: results.length === 14 && ord?.posStatus === 200,
      posStatus: ord?.posStatus,
      totalRoles: ord?.totalRoles,
      createdOrUpdated: results,
      band: ord?.band || [],
    };
    fs.writeFileSync('multi_perk_roles_result.json', JSON.stringify(out, null, 2), 'utf8');
    console.log('Reorder status:', out.posStatus, 'totalRoles:', out.totalRoles);
    if (!out.ok) throw new Error('Role order failed');
  } finally {
    ws.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
