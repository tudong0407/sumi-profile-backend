/**
 * scripts/apply_v1_4_5_role_gradients.mjs
 * Áp dụng màu Discord Role Gradient 2 màu (`colors: { primary_color, secondary_color, tertiary_color: null }`)
 * cho 19 Role Quyền Năng cao cấp trên SuMi Family (1026096141273661450) qua BotGhost API Proxy (CDP 9222):
 * - 8 Linh Phẩm (rare): Gradient 2 sắc hài hòa nhẹ nhàng
 * - 6 Tiên Phẩm (epic): Gradient 2 màu tương phản rực rỡ
 * - 5 Thần Thoại (mythic): Gradient 2 màu Độc Tôn tối thượng
 * (KHÔNG chạm 21 Phàm Phẩm, KHÔNG chạm Level Roles, Staff Roles hay permissions/position!)
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const BOT_ID = '916469360401453067';
const GUILD_ID = '1026096141273661450';

const hexToInt = (hex) => parseInt(String(hex).replace(/^#/, ''), 16);

export const V145_ROLE_GRADIENTS = [
  // 8 Linh Phẩm (rare — 2-color gentle harmonious gradient)
  { role_id: '1573577773279219763', tier: 'rare', name: '« Song Tuyệt Kiếm Khách »', primary: '#5EB8FF', secondary: '#8CE0FF' },
  { role_id: '1573577776454434899', tier: 'rare', name: '« Huyễn Ảnh Linh Tôn »', primary: '#A78BFA', secondary: '#C4B5FD' },
  { role_id: '1573577779621138542', tier: 'rare', name: '« Lôi Vũ Hộ Pháp »', primary: '#60A5FA', secondary: '#93C5FD' },
  { role_id: '1573577782380728410', tier: 'rare', name: '« Hàn Ngọc Tiên Tử »', primary: '#38BDF8', secondary: '#7DD3FC' },
  { role_id: '1573577786218651688', tier: 'rare', name: '« Mật Các Trưởng Lão »', primary: '#818CF8', secondary: '#A5B4FC' },
  { role_id: '1573577788965781504', tier: 'rare', name: '« Kim Tiền Đạo Nhân »', primary: '#FBBF24', secondary: '#FDE68A' },
  { role_id: '1573577794091225108', tier: 'rare', name: '« Chiến Hồn Tiên Phong »', primary: '#FB7185', secondary: '#FDA4AF' },
  { role_id: '1573577796742152314', tier: 'rare', name: '« Thiên Âm Nhạc Sư »', primary: '#34D399', secondary: '#6EE7B7' },

  // 6 Tiên Phẩm (epic — 2-color vibrant contrasting gradient)
  { role_id: '1573577799539892314', tier: 'epic', name: '« Cửu Tiêu Phong Vương »', primary: '#00E5FF', secondary: '#7C3AED' },
  { role_id: '1573577805286080523', tier: 'epic', name: '« Thái Hư Chân Quân »', primary: '#2563EB', secondary: '#EC4899' },
  { role_id: '1573577808867762186', tier: 'epic', name: '« Vạn Bảo Tài Thần »', primary: '#FFD700', secondary: '#FF4D6D' },
  { role_id: '1573577811786993756', tier: 'epic', name: '« Bát Hoang Chiến Thần »', primary: '#FF2E4C', secondary: '#FFB703' },
  { role_id: '1573577814437789797', tier: 'epic', name: '« Hồng Trần Tiên Lữ »', primary: '#FF5CA8', secondary: '#38BDF8' },
  { role_id: '1573577816690401401', tier: 'epic', name: '« Tinh Hà Pháp Vương »', primary: '#9333EA', secondary: '#14B8A6' },

  // 5 Thần Thoại (mythic — 2-color signature supreme gradient)
  { role_id: '1573185998857183253', tier: 'mythic', name: '« Cửu Vĩ Tối Thượng Thần Hồ »', primary: '#FF2A85', secondary: '#FFE066' },
  { role_id: '1573186003101941830', tier: 'mythic', name: '« SuMi Đệ Nhất Khách Tôn »', primary: '#00F5D4', secondary: '#9B5DE5' },
  { role_id: '1573186007262695644', tier: 'mythic', name: '« Vạn Cổ Chí Tôn »', primary: '#FFD166', secondary: '#E63946' },
  { role_id: '1573186011478102096', tier: 'mythic', name: '« Sáng Thế Thần Quân »', primary: '#FFF3B0', secondary: '#00BBF9' },
  { role_id: '1573186015785521265', tier: 'mythic', name: '« Cửu Vĩ Yêu Hậu »', primary: '#FF006E', secondary: '#8338EC' },
];

class SimpleCdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nid = 1;
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('WS connect timeout')), 10000);
      this.ws.on('open', () => { clearTimeout(t); res(); });
      this.ws.on('error', (e) => { clearTimeout(t); rej(e); });
    });
  }
  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((res, rej) => {
      const id = this.nid++;
      const timer = setTimeout(() => {
        this.ws.off('message', handler);
        rej(new Error(`CDP call ${method} timed out`));
      }, timeoutMs);
      const handler = (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.id === id) {
            clearTimeout(timer);
            this.ws.off('message', handler);
            if (msg.error) rej(new Error(JSON.stringify(msg.error)));
            else res(msg.result);
          }
        } catch {}
      };
      this.ws.on('message', handler);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr, timeoutMs = 30000) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    }, timeoutMs);
    if (r?.exceptionDetails) {
      throw new Error('CDP Exception: ' + JSON.stringify(r.exceptionDetails));
    }
    return r?.result?.value;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function patchDiscordRoleGradient(cdp, roleCfg) {
  const pInt = hexToInt(roleCfg.primary);
  const sInt = hexToInt(roleCfg.secondary);
  const rawBody = JSON.stringify({
    color: pInt,
    colors: {
      primary_color: pInt,
      secondary_color: sInt,
      tertiary_color: null,
    },
  });

  const payload = JSON.stringify({
    bot_id: BOT_ID,
    request_options: {
      method: 'PATCH',
      url: `https://discord.com/api/v10/guilds/${GUILD_ID}/roles/${roleCfg.role_id}`,
      headers: [
        { key: 'Authorization', value: 'Bot {TOKEN_SECRET}' },
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Audit-Log-Reason', value: 'SuMi v1.4.5 2-color Role Gradients' },
      ],
      params: [],
      body: [],
      rawBody,
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceHeaders: true,
        replaceBody: true,
        bodyMode: 'raw',
        contentType: 'application/json',
        failOnError: false,
      },
    },
  });

  return cdp.eval(`(async () => {
    const r = await fetch('/api/dashboard/test_api_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const j = await r.json().catch(() => ({}));
    return {
      httpStatus: r.status,
      apiStatus: j?.api_data?.status,
      response: j?.api_data?.response,
    };
  })()`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log(`[DryRun] Verified ${V145_ROLE_GRADIENTS.length} target non-common roles:`);
    for (const r of V145_ROLE_GRADIENTS) {
      console.log(` - [${r.tier}] ${r.name} (${r.role_id}): ${r.primary} (${hexToInt(r.primary)}) -> ${r.secondary} (${hexToInt(r.secondary)})`);
    }
    return;
  }

  const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
  const bgTab = tabs.find((t) => t.type === 'page' && t.url && t.url.includes('botghost.com'));
  if (!bgTab) throw new Error('No BotGhost tab found on Edge CDP 9222');

  const cdp = new SimpleCdp(bgTab.webSocketDebuggerUrl);
  await cdp.connect();
  try {
    let okCount = 0;
    const results = [];
    for (const r of V145_ROLE_GRADIENTS) {
      const res = await patchDiscordRoleGradient(cdp, r);
      const colors = res?.response?.colors || {};
      const ok = res?.apiStatus === 200
        && colors.primary_color === hexToInt(r.primary)
        && colors.secondary_color === hexToInt(r.secondary);
      if (ok) okCount += 1;
      results.push({
        role_id: r.role_id,
        tier: r.tier,
        name: r.name,
        apiStatus: res?.apiStatus,
        colors,
        ok,
      });
      console.log(`[${ok ? 'OK' : 'FAIL'}] [${r.tier}] ${r.name} (${r.role_id}) -> HTTP ${res?.apiStatus}`, JSON.stringify(colors));
      if (!ok) {
        console.error('Detail:', JSON.stringify(res));
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    console.log(`\nCompleted 2-color gradients: ${okCount}/${V145_ROLE_GRADIENTS.length} roles updated cleanly.`);
    if (okCount !== V145_ROLE_GRADIENTS.length) {
      process.exitCode = 1;
    }
  } finally {
    cdp.close();
  }
}

main().catch((err) => {
  console.error('[apply_v1_4_5_role_gradients] FATAL:', err);
  process.exit(1);
});
