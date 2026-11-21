import WebSocket from 'ws';
import fs from 'fs';

const GUILD_ID = '1026096141273661450';
const FUYUMI_ID = '757091869183311872';

const PERM = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
  SEND_POLLS: 1n << 49n,
  USE_EXTERNAL_APPS: 1n << 50n,
  PIN_MESSAGES: 1n << 51n,
  BYPASS_SLOWMODE: 1n << 52n
};

const combinePerms = (...flags) => flags.reduce((acc, f) => acc | f, 0n).toString();

// 1. Custom roles to delete (all 20 custom member roles + the Custom-Roles divider)
const CUSTOM_ROLE_IDS_TO_DELETE = [
  '1543998700068544592', // ✦ ──────・ ✨ Custom-Roles ✨ ・──── ✦
  '1544380217223675904', // Người ngáo
  '1544382189913899120', // ca sĩ
  '1544386565273288716', // <@1035807938331291738>
  '1544386608080494752', // Người
  '1544386903787442256', // TA Global
  '1544392356156145714', // Người Yêu Mèo
  '1544400526379061399', // Người Yêu Tiền!
  '1544553221698093116', // Blue cream
  '1544688622739914782', // em út
  '1544689559286190220', // --28157--
  '1544956247483097169', // ꧁Báo Chúa꧂
  '1545091626362478712', // lonely
  '1545110406102519808', // Fate
  '1545360400038498418', // Suntory
  '1567719591063584868', // Aha
  '1545432742227873843', // Yêu Xa Mệt Lắm Ai Ơi
  '1568323508994445585', // Rudi
  '1568652579976781975', // RanZ
  '1570987037132193843', // !VAMOS!
  '1544386902348529774'  // Người Yêu Mèo
];

// 2. New Cultivation / Perk Roles to create (in top-to-bottom hierarchy order, placed between Singularity Pet and Color Roles)
const SUPREME_VOICE_CHAT_PERMS = combinePerms(
  PERM.MOVE_MEMBERS,
  PERM.MUTE_MEMBERS,
  PERM.DEAFEN_MEMBERS,
  PERM.PRIORITY_SPEAKER,
  PERM.PIN_MESSAGES,
  PERM.BYPASS_SLOWMODE,
  PERM.MANAGE_THREADS,
  PERM.CREATE_PUBLIC_THREADS,
  PERM.CREATE_PRIVATE_THREADS,
  PERM.SEND_MESSAGES_IN_THREADS,
  PERM.MANAGE_NICKNAMES,
  PERM.CHANGE_NICKNAME,
  PERM.ATTACH_FILES,
  PERM.EMBED_LINKS,
  PERM.USE_EXTERNAL_EMOJIS,
  PERM.USE_EXTERNAL_STICKERS,
  PERM.USE_SOUNDBOARD,
  PERM.USE_EXTERNAL_SOUNDS,
  PERM.STREAM,
  PERM.SEND_TTS_MESSAGES,
  PERM.READ_MESSAGE_HISTORY
);

const NEW_PERK_ROLES = [
  {
    key: 'divider_perk_roles',
    name: '✦ ──────・ 𓆩 Role Quyền Năng 𓆪 ・────── ✦',
    color: 0,
    hoist: false,
    permissions: '0'
  },
  // 5 Supreme Multi-Perk Roles (Cảnh Giới VII & VI Đỉnh Cao)
  {
    key: 'cuu_vi_toi_thuong',
    name: '« Cửu Vĩ Tối Thượng Thần Hồ »',
    color: 0xf43f5e,
    hoist: true,
    permissions: SUPREME_VOICE_CHAT_PERMS,
    perk: '🛡️ Kháng Timeout & Hộ Thể'
  },
  {
    key: 'sumi_de_nhat_khach_ton',
    name: '« SuMi Đệ Nhất Khách Tôn »',
    color: 0xfbbf24,
    hoist: true,
    permissions: SUPREME_VOICE_CHAT_PERMS,
    perk: '👑 Quản Trị Voice & Chat Danh Dự'
  },
  {
    key: 'van_co_chi_ton',
    name: '« Vạn Cổ Chí Tôn »',
    color: 0xa855f7,
    hoist: true,
    permissions: combinePerms(
      PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.PRIORITY_SPEAKER,
      PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE, PERM.MANAGE_THREADS,
      PERM.CREATE_PUBLIC_THREADS, PERM.CREATE_PRIVATE_THREADS, PERM.SEND_MESSAGES_IN_THREADS,
      PERM.MANAGE_NICKNAMES, PERM.CHANGE_NICKNAME, PERM.ATTACH_FILES, PERM.EMBED_LINKS,
      PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS, PERM.STREAM
    ),
    perk: '🌌 Bá Chủ Voice & Thread'
  },
  {
    key: 'sang_the_than_quan',
    name: '« Sáng Thế Thần Quân »',
    color: 0x38bdf8,
    hoist: true,
    permissions: combinePerms(
      PERM.MOVE_MEMBERS, PERM.PRIORITY_SPEAKER, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE,
      PERM.MANAGE_NICKNAMES, PERM.CHANGE_NICKNAME, PERM.CREATE_PUBLIC_THREADS,
      PERM.CREATE_PRIVATE_THREADS, PERM.SEND_MESSAGES_IN_THREADS, PERM.ATTACH_FILES,
      PERM.EMBED_LINKS, PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS, PERM.STREAM
    ),
    perk: '✨ Sáng Thế & Buff x2.5 Linh Thạch'
  },
  {
    key: 'cuu_vi_yeu_hau',
    name: '« Cửu Vĩ Yêu Hậu »',
    color: 0xec4899,
    hoist: true,
    permissions: combinePerms(
      PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE,
      PERM.CHANGE_NICKNAME, PERM.CREATE_PUBLIC_THREADS, PERM.CREATE_PRIVATE_THREADS,
      PERM.SEND_MESSAGES_IN_THREADS, PERM.ATTACH_FILES, PERM.EMBED_LINKS,
      PERM.USE_EXTERNAL_EMOJIS, PERM.USE_EXTERNAL_STICKERS, PERM.USE_SOUNDBOARD,
      PERM.USE_EXTERNAL_SOUNDS, PERM.STREAM
    ),
    perk: '🌸 Huy Hiệu Độc Tôn & Buff +80% EXP'
  },
  // 20+1 Single-Function Perk Roles (20 Role Đơn Năng)
  {
    key: 'linh_am_ho_ca',
    name: '« Linh Âm Hồ Ca »',
    color: 0xf472b6,
    hoist: false,
    permissions: combinePerms(PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD, PERM.USE_SOUNDBOARD, PERM.USE_EXTERNAL_SOUNDS, PERM.PRIORITY_SPEAKER),
    perk: '🎵 Triệu Hồi Hát Live & Tâm Sự'
  },
  {
    key: 'phong_thanh_ho_phap',
    name: '« Phong Thanh Hộ Pháp »',
    color: 0x38bdf8,
    hoist: false,
    permissions: combinePerms(PERM.MOVE_MEMBERS, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🎙️ Quyền Di Chuyển Voice'
  },
  {
    key: 'loi_am_ton_gia',
    name: '« Lôi Âm Tôn Giả »',
    color: 0xfacc15,
    hoist: false,
    permissions: combinePerms(PERM.PRIORITY_SPEAKER, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '📢 Quyền Ưu Tiên Nói Voice'
  },
  {
    key: 'tich_tinh_tan_nhan',
    name: '« Tịch Tĩnh Tán Nhân »',
    color: 0x94a3b8,
    hoist: false,
    permissions: combinePerms(PERM.MUTE_MEMBERS, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🔇 Quyền Tắt Tiếng Voice'
  },
  {
    key: 'be_tuc_chan_nhan',
    name: '« Bế Tức Chân Nhân »',
    color: 0x64748b,
    hoist: false,
    permissions: combinePerms(PERM.DEAFEN_MEMBERS, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🎧 Quyền Tắt Tai Nghe Voice'
  },
  {
    key: 'huyen_dien_dao_quan',
    name: '« Huyễn Diện Đạo Quân »',
    color: 0xc084fc,
    hoist: false,
    permissions: combinePerms(PERM.CHANGE_NICKNAME),
    perk: '🎭 Tự Do Đổi Biệt Danh'
  },
  {
    key: 'dinh_danh_su_gia',
    name: '« Định Danh Sứ Giả »',
    color: 0xa78bfa,
    hoist: false,
    permissions: combinePerms(PERM.MANAGE_NICKNAMES, PERM.CHANGE_NICKNAME),
    perk: '🏷️ Quản Lý Biệt Danh'
  },
  {
    key: 'than_hanh_cot_cach',
    name: '« Thần Hành Cốt Cách »',
    color: 0xfb923c,
    hoist: false,
    permissions: combinePerms(PERM.BYPASS_SLOWMODE),
    perk: '⚡ Miễn Chờ Chat Chậm'
  },
  {
    key: 'hoa_do_linh_su',
    name: '« Họa Đồ Linh Sư »',
    color: 0x4ade80,
    hoist: false,
    permissions: combinePerms(PERM.ATTACH_FILES, PERM.EMBED_LINKS),
    perk: '🖼️ Đăng Ảnh Kênh Giới Hạn'
  },
  {
    key: 'van_tuong_linh_ho',
    name: '« Vạn Tượng Linh Hồ »',
    color: 0xf9a8d4,
    hoist: false,
    permissions: combinePerms(PERM.USE_EXTERNAL_EMOJIS, PERM.ADD_REACTIONS),
    perk: '✨ Dùng Emoji Ngoại Server'
  },
  {
    key: 'than_phu_thuong_quan',
    name: '« Thần Phù Thượng Quan »',
    color: 0xfbbf24,
    hoist: false,
    permissions: combinePerms(PERM.USE_EXTERNAL_STICKERS),
    perk: '🌟 Dùng Sticker Ngoại'
  },
  {
    key: 'khai_son_tien_phong',
    name: '« Khai Sơn Tiên Phong »',
    color: 0x2dd4bf,
    hoist: false,
    permissions: combinePerms(PERM.CREATE_PUBLIC_THREADS, PERM.SEND_MESSAGES_IN_THREADS),
    perk: '💬 Tạo Chủ Đề Công Khai'
  },
  {
    key: 'mat_tang_ho_ve',
    name: '« Mật Tàng Hộ Vệ »',
    color: 0x818cf8,
    hoist: false,
    permissions: combinePerms(PERM.CREATE_PRIVATE_THREADS, PERM.SEND_MESSAGES_IN_THREADS),
    perk: '🔒 Tạo Chủ Đề Kín'
  },
  {
    key: 'tran_thu_phap_vuong',
    name: '« Trấn Thư Pháp Vương »',
    color: 0xf87171,
    hoist: false,
    permissions: combinePerms(PERM.PIN_MESSAGES),
    perk: '📌 Quyền Ghim Tin Nhắn'
  },
  {
    key: 'huyen_am_tien_co',
    name: '« Huyễn Âm Tiên Cô »',
    color: 0xe879f9,
    hoist: false,
    permissions: combinePerms(PERM.USE_SOUNDBOARD, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🔊 Dùng Bảng Âm Thanh'
  },
  {
    key: 'cuu_chau_dien_am',
    name: '« Cửu Châu Diễn Âm »',
    color: 0xd946ef,
    hoist: false,
    permissions: combinePerms(PERM.USE_EXTERNAL_SOUNDS, PERM.USE_SOUNDBOARD, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '🎶 Dùng Âm Ngoại Server'
  },
  {
    key: 'linh_hon_tu_luyen',
    name: '« Linh Hồn Tu Luyện »',
    color: 0x34d399,
    hoist: false,
    permissions: '0',
    perk: '📈 Buff +15% EXP Solo'
  },
  {
    key: 'tai_van_hanh_thong',
    name: '« Tài Vận Hanh Thông »',
    color: 0xfcd34d,
    hoist: false,
    permissions: '0',
    perk: '💎 Buff +20% Linh Thạch'
  },
  {
    key: 'tieu_dao_khach',
    name: '« Tiêu Dao Khách »',
    color: 0x60a5fa,
    hoist: false,
    permissions: combinePerms(PERM.STREAM, PERM.CONNECT, PERM.SPEAK, PERM.USE_VAD),
    perk: '📺 Phát Trực Tiếp HD 1080p'
  },
  {
    key: 'tram_phong_kiem_khach',
    name: '« Trảm Phong Kiếm Khách »',
    color: 0xfb7185,
    hoist: false,
    permissions: combinePerms(PERM.SEND_TTS_MESSAGES),
    perk: '🗣️ Gửi Tin Nhắn Giọng Nói TTS'
  },
  {
    key: 'than_thong_thau_thi',
    name: '« Thần Thông Thấu Thị »',
    color: 0xa5b4fc,
    hoist: false,
    permissions: combinePerms(PERM.READ_MESSAGE_HISTORY, PERM.VIEW_CHANNEL),
    perk: '👁️ Đọc Lịch Sử Kênh Lưu Trữ'
  }
];

// 3. Existing Level Roles & Base Roles permission updates
const BASE_MEMBER_PERMS = combinePerms(
  PERM.ADD_REACTIONS,
  PERM.STREAM,
  PERM.EMBED_LINKS,
  PERM.ATTACH_FILES,
  PERM.READ_MESSAGE_HISTORY,
  PERM.USE_EXTERNAL_EMOJIS,
  PERM.SPEAK,
  PERM.USE_VAD,
  PERM.CHANGE_NICKNAME,
  PERM.USE_APPLICATION_COMMANDS,
  PERM.REQUEST_TO_SPEAK,
  PERM.CREATE_PUBLIC_THREADS,
  PERM.CREATE_PRIVATE_THREADS,
  PERM.SEND_MESSAGES_IN_THREADS,
  PERM.USE_EXTERNAL_STICKERS,
  PERM.USE_EMBEDDED_ACTIVITIES,
  PERM.USE_SOUNDBOARD,
  PERM.USE_EXTERNAL_SOUNDS,
  PERM.SEND_VOICE_MESSAGES
);

const EXISTING_ROLE_PERM_UPDATES = [
  // @everyone: include CHANGE_NICKNAME, ATTACH_FILES, EMBED_LINKS as requested by Fuyumi
  {
    id: '1026096141273661450',
    name: '@everyone',
    permissions: BASE_MEMBER_PERMS
  },
  // Đã đọc RULES✅: include CHANGE_NICKNAME, ATTACH_FILES, EMBED_LINKS
  {
    id: '1467026294201127023',
    name: 'Đã đọc RULES✅',
    permissions: combinePerms(PERM.ATTACH_FILES, PERM.EMBED_LINKS, PERM.CHANGE_NICKNAME)
  },
  // Lv.5: « 5・U Linh Chớm Nở » (Cảnh Giới I: Tự đổi Nickname + Dùng Emoji ngoài + Gửi ảnh)
  {
    id: '1038406122417176586',
    name: '« 5・U Linh Chớm Nở »',
    permissions: BASE_MEMBER_PERMS
  },
  // Lv.15: « 15・Linh Cáo Học Giả » (Cảnh Giới II: Tạo Public & Private Thread + Ghim tin nhắn + Dùng Emoji ngoài)
  {
    id: '1038405196662976562',
    name: '« 15・Linh Cáo Học Giả »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.PIN_MESSAGES)
  },
  // Lv.20: « 20・ Linh Cáo Tinh Anh » (Cảnh Giới II: Move Voice + Mute Voice + Priority Speaker)
  {
    id: '1032988544874061836',
    name: '« 20・ Linh Cáo Tinh Anh »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.PRIORITY_SPEAKER)
  },
  // Lv.35: « 35・Yêu Hồ Nguyệt Ảnh » (Cảnh Giới III: Move Voice + Mute/Deafen Voice + Ghim tin nhắn + Bypass Slowmode)
  {
    id: '1375446293119369331',
    name: '« 35・Yêu Hồ Nguyệt Ảnh »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE)
  },
  // Lv.45: « 45・Huyễn Linh Thú » (Cảnh Giới IV: Move Voice + Mute/Deafen Voice + Đổi Nickname khác + Ghim tin + Bypass Slowmode)
  {
    id: '1375451249952161903',
    name: '« 45・Huyễn Linh Thú »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.MANAGE_NICKNAMES, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE)
  },
  // Lv.60: « 60・Thiên Hồ Viễn Cổ » (Cảnh Giới V: Move Voice + Mute/Deafen Voice + Priority Speaker + Đổi Nickname khác + Ghim tin + Bypass Slowmode)
  {
    id: '1375446809408962620',
    name: '« 60・Thiên Hồ Viễn Cổ »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.PRIORITY_SPEAKER, PERM.MANAGE_NICKNAMES, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE)
  },
  // Lv.80: « 80・Chi Linh Thánh Đế » (Cảnh Giới VI: Move Voice + Mute/Deafen Voice + Priority Speaker + Quản lý Thread + Đổi Nickname khác + Ghim tin + Bypass Slowmode + TTS)
  {
    id: '1473419954379554967',
    name: '« 80・Chi Linh Thánh Đế »',
    permissions: combinePerms(BigInt(BASE_MEMBER_PERMS), PERM.MOVE_MEMBERS, PERM.MUTE_MEMBERS, PERM.DEAFEN_MEMBERS, PERM.PRIORITY_SPEAKER, PERM.MANAGE_THREADS, PERM.MANAGE_NICKNAMES, PERM.PIN_MESSAGES, PERM.BYPASS_SLOWMODE, PERM.SEND_TTS_MESSAGES)
  },
  // Lv.100: « 100・Hỗn Độn Chúa Tể » (Cảnh Giới VII: Toàn bộ quyền Voice, Thread, Pin, Bypass Slowmode, Nickname)
  {
    id: '1473419957655175169',
    name: '« 100・Hỗn Độn Chúa Tể »',
    permissions: SUPREME_VOICE_CHAT_PERMS
  }
];

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const dcTab = tabs.find(t => t.url?.includes('discord.com/channels') && t.type === 'page');
  if (!dcTab) throw new Error('No Discord tab found');

  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const t = setTimeout(() => { ws.close(); reject(new Error('CDP timeout on ' + m)); }, 120000);
    ws.on('message', function h(d) {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { clearTimeout(t); ws.off('message', h); resolve(msg.result); }
    });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  console.log('Executing role cleanup, creation, permission updates, and hierarchy arrangement on Discord...');
  const payload = {
    guildId: GUILD_ID,
    fuyumiId: FUYUMI_ID,
    deleteIds: CUSTOM_ROLE_IDS_TO_DELETE,
    newRoles: NEW_PERK_ROLES,
    permUpdates: EXISTING_ROLE_PERM_UPDATES
  };

  const browserRes = await send('Runtime.evaluate', {
    expression: `(async (cfg) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
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
      if (!token) return { ok: false, error: 'No Discord token extracted' };

      async function apiCall(method, path, body = null) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const opts = {
            method,
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            }
          };
          if (body !== null) opts.body = JSON.stringify(body);
          const res = await fetch('https://discord.com/api/v10' + path, opts);
          if (res.status === 429) {
            const retryData = await res.json().catch(() => ({}));
            const waitMs = Math.ceil((retryData.retry_after || 1.5) * 1000) + 250;
            await sleep(waitMs);
            continue;
          }
          if (res.status === 204) return { status: 204, data: null };
          const data = await res.json().catch(() => null);
          return { status: res.status, data };
        }
        return { status: 429, data: { error: 'Max retries exceeded' } };
      }

      // Fetch current roles first
      const initRolesRes = await apiCall('GET', '/guilds/' + cfg.guildId + '/roles');
      const currentRoles = initRolesRes.data || [];
      const currentById = new Map(currentRoles.map(r => [r.id, r]));
      const currentByName = new Map(currentRoles.map(r => [r.name, r]));

      // Step 1: Delete all custom roles
      const deleted = [];
      for (const delId of cfg.deleteIds) {
        if (currentById.has(delId)) {
          const r = await apiCall('DELETE', '/guilds/' + cfg.guildId + '/roles/' + delId);
          deleted.push({ id: delId, name: currentById.get(delId).name, status: r.status });
          currentById.delete(delId);
          await sleep(350);
        }
      }

      // Also check if any custom roles remain between Color Roles (1473298013542813777) and Singularity Pet (1487071105486291145)
      // that weren't in our new perk roles list
      const newRoleNames = new Set(cfg.newRoles.map(x => x.name));

      // Step 2: Create or update the new Perk Roles
      const createdRoles = [];
      for (const spec of cfg.newRoles) {
        const existing = currentByName.get(spec.name);
        if (existing && !cfg.deleteIds.includes(existing.id)) {
          const upd = await apiCall('PATCH', '/guilds/' + cfg.guildId + '/roles/' + existing.id, {
            name: spec.name,
            color: spec.color,
            hoist: spec.hoist,
            permissions: spec.permissions
          });
          createdRoles.push({ key: spec.key, name: spec.name, id: existing.id, status: upd.status, action: 'updated', perk: spec.perk || null });
          await sleep(350);
        } else {
          const cr = await apiCall('POST', '/guilds/' + cfg.guildId + '/roles', {
            name: spec.name,
            color: spec.color,
            hoist: spec.hoist,
            permissions: spec.permissions,
            mentionable: false
          });
          createdRoles.push({ key: spec.key, name: spec.name, id: cr.data?.id, status: cr.status, action: 'created', perk: spec.perk || null });
          await sleep(400);
        }
      }

      // Step 3: Update permissions on existing Level Roles & Base Roles
      const updatedExisting = [];
      for (const u of cfg.permUpdates) {
        const r = await apiCall('PATCH', '/guilds/' + cfg.guildId + '/roles/' + u.id, {
          permissions: u.permissions
        });
        updatedExisting.push({ id: u.id, name: u.name, status: r.status });
        await sleep(350);
      }

      // Step 4: Arrange role positions so the new Perk Roles sit cleanly right below Singularity Pet (1487071105486291145)
      // and right above Color Roles divider (1473298013542813777)
      const freshRolesRes = await apiCall('GET', '/guilds/' + cfg.guildId + '/roles');
      const freshRoles = freshRolesRes.data || [];
      const colorDivider = freshRoles.find(r => r.id === '1473298013542813777');
      const basePos = colorDivider ? colorDivider.position + 1 : 92;

      // In Discord PATCH /guilds/{guild.id}/roles, higher position = higher in list.
      // Our NEW_PERK_ROLES array is ordered top-to-bottom (index 0 is highest, index N-1 is lowest).
      const createdIdsTopToBottom = createdRoles.map(r => r.id).filter(Boolean);
      const posPayload = [];
      const count = createdIdsTopToBottom.length;
      for (let i = 0; i < count; i++) {
        posPayload.push({
          id: createdIdsTopToBottom[i],
          position: basePos + (count - 1 - i)
        });
      }
      const posRes = await apiCall('PATCH', '/guilds/' + cfg.guildId + '/roles', posPayload);

      // Step 5: Assign Fuyumi's 5 Equipped Roles on Discord
      const roleMapByKey = Object.fromEntries(createdRoles.map(r => [r.key, r.id]));
      const fuyumiEquipRoleIds = [
        '1473419957655175169', // Slot 1: « 100・Hỗn Độn Chúa Tể »
        roleMapByKey['cuu_vi_toi_thuong'], // Slot 2: « Cửu Vĩ Tối Thượng Thần Hồ »
        roleMapByKey['phong_thanh_ho_phap'], // Slot 3: « Phong Thanh Hộ Pháp »
        roleMapByKey['than_hanh_cot_cach'], // Slot 4: « Thần Hành Cốt Cách »
        roleMapByKey['tran_thu_phap_vuong'] // Slot 5: « Trấn Thư Pháp Vương »
      ].filter(Boolean);

      const addedToFuyumi = [];
      for (const rId of fuyumiEquipRoleIds) {
        const ar = await apiCall('PUT', '/guilds/' + cfg.guildId + '/members/' + cfg.fuyumiId + '/roles/' + rId);
        addedToFuyumi.push({ roleId: rId, status: ar.status });
        await sleep(300);
      }

      // Final snapshot of guild roles
      const finalRolesRes = await apiCall('GET', '/guilds/' + cfg.guildId + '/roles');
      const finalRoles = (finalRolesRes.data || []).sort((a, b) => b.position - a.position);

      return {
        ok: true,
        deletedCount: deleted.length,
        deleted,
        createdCount: createdRoles.length,
        createdRoles,
        updatedExisting,
        posStatus: posRes.status,
        addedToFuyumi,
        finalTotalRoles: finalRoles.length,
        finalRoles: finalRoles.map(r => ({
          position: r.position,
          id: r.id,
          name: r.name,
          permissions: r.permissions,
          color: r.color,
          hoist: r.hoist,
          managed: r.managed
        }))
      };
    })(${JSON.stringify(payload)})`,
    awaitPromise: true,
    returnByValue: true
  });

  ws.close();
  const out = browserRes.result?.value;
  fs.writeFileSync('role_migration_result.json', JSON.stringify(out, null, 2), 'utf8');
  console.log('Role Migration Summary:', JSON.stringify({
    ok: out?.ok,
    deletedCount: out?.deletedCount,
    createdCount: out?.createdCount,
    updatedExistingCount: out?.updatedExisting?.length,
    posStatus: out?.posStatus,
    addedToFuyumi: out?.addedToFuyumi,
    finalTotalRoles: out?.finalTotalRoles
  }, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
