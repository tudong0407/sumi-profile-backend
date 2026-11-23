/**
 * src/services/battleEngine/webBattleLogHtml.js
 * Trình phát Nhật Ký Trận Đấu Web tương tác theo từng hiệp (48 giờ TTL • On-Demand Render):
 * - Dùng chung cho cả /battle (1v1), Tháp Thí Luyện và /linhmach (Tổ Đội).
 * - Chỉ kích hoạt render toàn bộ khung hình các hiệp khi người dùng mở trang Web Logs (POST renderAllUrl).
 * - Hỗ trợ quay lại / tiến tới từng hiệp, tự phát, thanh máu giảm chi tiết, và CHỈ hiển thị diễn biến của đúng hiệp đang chọn.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripDiscordTagsToHtml(text) {
  let s = escapeHtml(text);
  s = s.replace(/&lt;(a?):([a-zA-Z0-9_]+):([0-9]{15,22})&gt;/g, (_, anim, name, id) => {
    const ext = anim === 'a' ? 'gif' : 'png';
    return `<img class="d-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:">`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function renderExpiredBattleLogHtml(cleanId, isTeam = false) {
  const cmdHint = isTeam ? '<code>/linhmach</code>' : '<code>/battle</code> hoặc <code>/nhiemvu</code>';
  const titleLabel = isTeam ? 'Nhật Ký Chiến Báo Linh Mạch' : 'Nhật Ký Trận Đấu';
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleLabel} Đã Hết Hạn</title>
<style>body{background:#0f0a1c;color:#f5e9ff;font-family:'Be Vietnam Pro','Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{max-width:560px;background:#1a1230;border:1px solid #ec489955;border-radius:16px;padding:28px;text-align:center;box-shadow:0 12px 40px #0008}h1{color:#f472b6;font-size:1.3rem;margin-top:0}code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:5px;color:#fde047}</style></head>
<body><div class="card"><h1>📜 ${titleLabel} Đã Quá Hạn Lưu Trữ (2 Ngày)</h1><p>Mã trận <code>${escapeHtml(cleanId)}</code> đã quá thời hạn lưu trữ tối đa 48 giờ hoặc không tồn tại.</p><p>Hãy dùng ${cmdHint} trên Discord SuMi Family để mở trận đấu mới nhé!</p></div></body></html>`;
}

function safeJsonForHtml(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function renderEquipmentRowsHtml(equipment = []) {
  if (!Array.isArray(equipment) || equipment.length === 0) return '';
  return `<div class="equip-list">${equipment.map((eq) => {
    const slotLabel = escapeHtml(eq.slotLabel || 'Pháp Bảo');
    if (!eq.name) {
      return `<div class="equip-row equip-empty"><div class="equip-head"><span class="slot-pill">${slotLabel}</span><span class="muted">Chưa trang bị</span></div></div>`;
    }
    const iconHtml = eq.iconTag ? stripDiscordTagsToHtml(eq.iconTag) + ' ' : '';
    const gradeHtml = eq.grade ? `<span class="grade-pill">Bậc ${escapeHtml(String(eq.grade).toUpperCase())}</span>` : '';
    const haxHead = eq.haxName ? `<span class="hax-tag">[${escapeHtml(eq.haxName)}]</span> ` : '';
    const haxDesc = eq.haxDesc ? escapeHtml(eq.haxDesc) : 'Cộng chỉ số nền';
    return `<div class="equip-row">
      <div class="equip-head"><span class="slot-pill">${slotLabel}</span><span class="equip-name">${iconHtml}${escapeHtml(eq.name)}</span>${gradeHtml}</div>
      <div class="equip-hax">${haxHead}${haxDesc}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderDomainCardHtml(dom) {
  if (!dom || !dom.name) {
    return `<div class="section-card domain-card"><div class="section-label">🌌 Linh Vực</div><div class="muted">Chưa khai mở Linh Vực</div></div>`;
  }
  const iconHtml = dom.iconTag ? stripDiscordTagsToHtml(dom.iconTag) + ' ' : '';
  const elIconHtml = dom.elementTag ? stripDiscordTagsToHtml(dom.elementTag) + ' ' : '';
  const subRows = [];
  if (dom.buffDesc) {
    subRows.push(`<div class="dom-sub"><span class="dom-key dom-buff">Buff:</span> ${escapeHtml(dom.buffDesc)}</div>`);
  }
  if (dom.debuffDesc) {
    subRows.push(`<div class="dom-sub"><span class="dom-key dom-debuff">Debuff:</span> ${escapeHtml(dom.debuffDesc)}</div>`);
  }
  if (dom.daoApLabel) {
    subRows.push(`<div class="dom-sub"><span class="dom-key dom-daoap">Đạo Áp:</span> ${escapeHtml(dom.daoApLabel)}</div>`);
  }
  if (dom.sense?.name) {
    const sIcon = dom.sense.iconTag ? stripDiscordTagsToHtml(dom.sense.iconTag) + ' ' : '';
    const sDesc = dom.sense.desc ? ` — <span class="sub-desc">${escapeHtml(dom.sense.desc)}</span>` : '';
    subRows.push(`<div class="dom-sub"><span class="dom-key dom-sense">Thần Thức:</span> ${sIcon}<strong>${escapeHtml(dom.sense.name)}</strong>${sDesc}</div>`);
  }
  if (dom.realm?.name) {
    const rIcon = dom.realm.iconTag ? stripDiscordTagsToHtml(dom.realm.iconTag) + ' ' : '';
    const rDesc = dom.realm.desc ? ` — <span class="sub-desc">${escapeHtml(dom.realm.desc)}</span>` : '';
    subRows.push(`<div class="dom-sub"><span class="dom-key dom-realm">Thần Cảnh:</span> ${rIcon}<strong>${escapeHtml(dom.realm.name)}</strong>${rDesc}</div>`);
  }
  return `<div class="section-card domain-card">
    <div class="section-label">🌌 Linh Vực &amp; Đạo Phối</div>
    <div class="dom-title">${iconHtml}<strong>${escapeHtml(dom.name)}</strong> <span class="dom-meta">(${elIconHtml}${escapeHtml(dom.element || '')}${dom.energyLabel ? ` • ${escapeHtml(dom.energyLabel)}` : ''})</span></div>
    ${subRows.length ? `<div class="dom-sub-list">${subRows.join('')}</div>` : ''}
  </div>`;
}

function renderUnitCardHtml(u, sideCls) {
  const petIcon = u.petIconTag ? stripDiscordTagsToHtml(u.petIconTag) + ' ' : '';
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
  const roleTag = u.roleBadge ? `<span class="role-badge">${escapeHtml(u.roleBadge)}</span>` : '';
  const fatTag = Number(u.fatiguePct || 0) > 0 ? `<span class="fatigue-pill">Mệt -${Number(u.fatiguePct)}%</span>` : '';
  const petHaxHtml = u.petHax?.name
    ? `<div class="section-card hax-card"><div class="section-label">⚡ HAX Linh Thú</div><div class="hax-body"><strong>${escapeHtml(u.petHax.name)}</strong>${u.petHax.desc ? ` — <span class="sub-desc">${escapeHtml(u.petHax.desc)}</span>` : ''}</div></div>`
    : '';
  const domainHtml = u.showDomain !== false ? renderDomainCardHtml(u.domain) : '';
  return `<div class="unit-block ${sideCls}">
    <div class="unit-head">
      <div class="unit-player">${roleTag}<strong>${escapeHtml(u.playerName || 'Tu Sĩ')}</strong>${fatTag}</div>
      <div class="unit-pet">${petIcon}<strong>${escapeHtml(u.petName || 'Linh Thú')}</strong></div>
      ${u.metaLine ? `<div class="unit-meta">${escapeHtml(u.metaLine)}</div>` : ''}
    </div>
    <div class="stat-pills">
      <div class="stat-pill"><span>ATK</span><strong>${fmt(u.stats?.atk)}</strong></div>
      <div class="stat-pill"><span>DEF</span><strong>${fmt(u.stats?.def)}</strong></div>
      <div class="stat-pill"><span>SPD</span><strong>${fmt(u.stats?.spd)}</strong></div>
      <div class="stat-pill"><span>HP</span><strong>${fmt(u.stats?.hp)}</strong></div>
    </div>
    ${petHaxHtml}
    ${domainHtml}
    ${renderEquipmentRowsHtml(u.equipment)}
  </div>`;
}

function renderStructuredRosterHtml(roster) {
  if (!roster || (!Array.isArray(roster.leftUnits) && !Array.isArray(roster.rightUnits))) return '';
  const leftUnits = Array.isArray(roster.leftUnits) ? roster.leftUnits : [];
  const rightUnits = Array.isArray(roster.rightUnits) ? roster.rightUnits : [];
  const openingEvents = Array.isArray(roster.openingEvents) ? roster.openingEvents : [];

  const openingHtml = (roster.matchupNote || openingEvents.length)
    ? `<div class="roster-opening-box">
      ${roster.matchupNote ? `<div class="matchup-line">☯️ <strong>Tương khắc:</strong> <span>${escapeHtml(roster.matchupNote)}</span></div>` : ''}
      ${openingEvents.length ? `<div class="opening-title">⚡ Khai Trận HAX &amp; Đấu Linh Vực</div><div class="opening-list">${openingEvents.map((ev) => `<div class="opening-item">${stripDiscordTagsToHtml(ev)}</div>`).join('')}</div>` : ''}
    </div>`
    : '';

  return `<div class="roster-grid-2col">
    <div class="roster-col side-a">
      <div class="roster-side-head side-a">⚔️ ${escapeHtml(roster.leftTitle || 'Phe Công')}</div>
      ${leftUnits.map((u) => renderUnitCardHtml(u, 'side-a')).join('')}
    </div>
    <div class="roster-divider" aria-hidden="true"></div>
    <div class="roster-col side-b">
      <div class="roster-side-head side-b">🛡️ ${escapeHtml(roster.rightTitle || 'Phe Thủ')}</div>
      ${rightUnits.map((u) => renderUnitCardHtml(u, 'side-b')).join('')}
    </div>
  </div>${openingHtml}`;
}

export function renderInteractiveBattleLogPage({
  battleId,
  title,
  subtitle = '',
  totalTurns = 1,
  expiresAtMs = null,
  renderAllUrl,
  turnImageTemplate,
  snapshots = [],
  rosterHtmlLines = [],
  rosterStructured = null,
  winnerSummaryHtml = '',
  themeAccent = '#ec4899',
} = {}) {
  const formattedSnaps = (snapshots || []).map((s) => ({
    ...s,
    eventsHtml: (s.events || []).map((line) => stripDiscordTagsToHtml(line)),
  }));

  const nowMs = Date.now();
  const remMs = expiresAtMs ? Math.max(0, Number(expiresAtMs) - nowMs) : 48 * 3600 * 1000;
  const remHours = Math.floor(remMs / 3600000);
  const remMins = Math.floor((remMs % 3600000) / 60000);
  const ttlText = `Lưu trữ Web: còn ${remHours}g ${remMins}p (tối đa 2 ngày)`;

  const clientState = {
    battleId,
    totalTurns: Math.max(1, Number(totalTurns) || 1),
    renderAllUrl,
    turnImageTemplate,
    snapshots: formattedSnaps,
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} • #${escapeHtml(battleId)}</title>
  <style>
    :root { color-scheme: dark; --accent: ${escapeHtml(themeAccent)}; }
    * { box-sizing: border-box; }
    body {
      background: radial-gradient(circle at top, #23133d 0%, #0b0716 75%);
      color: #f3e8ff;
      font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 18px 12px 44px;
      line-height: 1.55;
    }
    .container {
      max-width: 1020px;
      margin: 0 auto;
      background: rgba(20, 14, 38, 0.94);
      border: 1px solid rgba(236, 72, 153, 0.38);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.72);
    }
    .header-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid rgba(236, 72, 153, 0.25);
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    h1 { font-size: 1.22rem; margin: 0; color: #f9a8d4; }
    .sub-txt { font-size: 0.85rem; color: #cbd5e1; margin-top: 4px; }
    .meta-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .badge {
      background: rgba(236, 72, 153, 0.16);
      border: 1px solid rgba(244, 114, 182, 0.42);
      color: #fbcfe8;
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .ttl-badge {
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(56, 189, 248, 0.35);
      color: #bae6fd;
    }
    .render-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
      padding: 8px 14px;
      margin-bottom: 14px;
      font-size: 0.88rem;
    }
    .stage-wrap {
      position: relative;
      text-align: center;
      background: #090512;
      border-radius: 14px;
      border: 1px solid rgba(251, 191, 36, 0.32);
      overflow: hidden;
      min-height: 260px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stage-wrap img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 600px;
      object-fit: contain;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 14px 0 10px;
    }
    .btn {
      background: rgba(51, 65, 85, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.35);
      color: #f8fafc;
      padding: 8px 13px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .btn:hover:not(:disabled) {
      background: rgba(236, 72, 153, 0.32);
      border-color: rgba(244, 114, 182, 0.65);
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary {
      background: linear-gradient(135deg, #db2777, #9333ea);
      border-color: rgba(244, 114, 182, 0.7);
    }
    select.turn-select {
      background: #1e1535;
      color: #f8fafc;
      border: 1px solid rgba(236, 72, 153, 0.45);
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
    }
    .turn-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      margin-bottom: 14px;
    }
    .pill {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.25);
      color: #cbd5e1;
      border-radius: 8px;
      padding: 4px 9px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    .pill.active {
      background: rgba(236, 72, 153, 0.34);
      border-color: #f472b6;
      color: #ffffff;
    }
    .hp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .hp-card {
      background: rgba(15, 11, 28, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .hp-card.side-a { border-left: 3px solid #ec4899; }
    .hp-card.side-b { border-left: 3px solid #38bdf8; }
    .hp-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 0.88rem;
    }
    .hp-name { font-weight: 700; color: #f8fafc; }
    .hp-delta { font-size: 0.8rem; font-weight: 700; }
    .hp-delta.dmg { color: #fda4af; }
    .hp-delta.heal { color: #6ee7b7; }
    .hp-delta.zero { color: #94a3b8; }
    .bar-track {
      width: 100%;
      height: 12px;
      background: rgba(30, 41, 59, 0.9);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 5px;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #ec4899, #f472b6);
      border-radius: 999px;
      transition: width 0.22s ease;
    }
    .hp-card.side-b .bar-fill {
      background: linear-gradient(90deg, #0284c7, #38bdf8);
    }
    .hp-nums { font-size: 0.78rem; color: #cbd5e1; display: flex; justify-content: space-between; }
    .turn-log-panel {
      background: rgba(14, 10, 26, 0.88);
      border: 1px solid rgba(236, 72, 153, 0.35);
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 14px;
    }
    .turn-log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      font-weight: 700;
      color: #fde047;
    }
    .log-item {
      padding: 6px 10px;
      margin: 5px 0;
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid #ec4899;
      border-radius: 6px;
      font-size: 0.92rem;
      word-break: break-word;
    }
    .winner-box {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.38);
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 12px;
      font-size: 0.92rem;
    }
    details.roster-details {
      background: rgba(15, 23, 42, 0.58);
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 0.87rem;
    }
    details.roster-details summary { cursor: pointer; font-weight: 700; color: #f1f5f9; padding: 2px 0; }
    .roster-grid-2col {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
      gap: 18px;
      margin-top: 14px;
      align-items: start;
    }
    .roster-divider {
      background: linear-gradient(180deg, rgba(236, 72, 153, 0.5), rgba(148, 163, 184, 0.25), rgba(56, 189, 248, 0.5));
      align-self: stretch;
      min-height: 100%;
    }
    .roster-side-head {
      font-size: 0.96rem;
      font-weight: 800;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }
    .roster-side-head.side-a { color: #f9a8d4; border-bottom-color: rgba(236, 72, 153, 0.4); }
    .roster-side-head.side-b { color: #7dd3fc; border-bottom-color: rgba(56, 189, 248, 0.4); }
    .unit-block { margin-bottom: 16px; }
    .unit-block:last-child { margin-bottom: 0; }
    .unit-head { margin-bottom: 10px; }
    .unit-player { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.94rem; color: #f8fafc; margin-bottom: 3px; }
    .unit-pet { font-size: 0.95rem; color: #fde68a; margin-bottom: 2px; }
    .unit-meta { font-size: 0.8rem; color: #94a3b8; }
    .role-badge {
      background: rgba(251, 191, 36, 0.16);
      border: 1px solid rgba(251, 191, 36, 0.42);
      color: #fde68a;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
    }
    .fatigue-pill {
      background: rgba(244, 63, 94, 0.16);
      border: 1px solid rgba(244, 63, 94, 0.42);
      color: #fda4af;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
    }
    .stat-pills {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 10px;
    }
    .stat-pill {
      background: rgba(15, 11, 28, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 5px 6px;
      text-align: center;
    }
    .stat-pill span { display: block; font-size: 0.68rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.03em; }
    .stat-pill strong { display: block; font-size: 0.84rem; color: #fde047; }
    .section-card {
      background: rgba(15, 11, 28, 0.76);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 10px;
      padding: 9px 11px;
      margin-top: 10px;
    }
    .section-card.domain-card { border-color: rgba(168, 85, 247, 0.36); }
    .section-card.hax-card { border-color: rgba(236, 72, 153, 0.3); }
    .section-label {
      font-size: 0.74rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #cbd5e1;
      margin-bottom: 5px;
    }
    .hax-body { font-size: 0.85rem; color: #f8fafc; line-height: 1.5; }
    .sub-desc { color: #cbd5e1; font-weight: 400; }
    .dom-title { font-size: 0.88rem; color: #f8fafc; line-height: 1.45; }
    .dom-meta { color: #c4b5fd; font-size: 0.8rem; }
    .dom-sub-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding-top: 7px; border-top: 1px dashed rgba(148, 163, 184, 0.22); }
    .dom-sub { font-size: 0.82rem; color: #e2e8f0; line-height: 1.45; }
    .dom-key { font-weight: 700; margin-right: 4px; }
    .dom-buff { color: #6ee7b7; }
    .dom-debuff { color: #fda4af; }
    .dom-daoap { color: #fbbf24; }
    .dom-sense { color: #93c5fd; }
    .dom-realm { color: #d8b4fe; }
    .equip-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .equip-row {
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 9px;
      padding: 8px 10px;
    }
    .equip-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; }
    .equip-empty .equip-head { margin-bottom: 0; }
    .slot-pill {
      background: rgba(148, 163, 184, 0.15);
      color: #cbd5e1;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 6px;
    }
    .equip-name { font-weight: 700; color: #f8fafc; font-size: 0.86rem; }
    .grade-pill {
      background: rgba(234, 179, 8, 0.16);
      border: 1px solid rgba(234, 179, 8, 0.35);
      color: #fde047;
      font-size: 0.71rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 6px;
    }
    .equip-hax { font-size: 0.82rem; color: #cbd5e1; line-height: 1.45; }
    .hax-tag { color: #f9a8d4; font-weight: 700; }
    .muted { color: #94a3b8; font-style: italic; font-size: 0.82rem; }
    .roster-opening-box {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.24);
    }
    .matchup-line { margin-bottom: 10px; font-size: 0.88rem; color: #fde68a; }
    .opening-title { font-size: 0.84rem; font-weight: 800; color: #f9a8d4; margin-bottom: 6px; }
    .opening-list { display: flex; flex-direction: column; gap: 5px; }
    .opening-item {
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid rgba(168, 85, 247, 0.6);
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 0.83rem;
      color: #e2e8f0;
    }
    @media (max-width: 780px) {
      .roster-grid-2col { grid-template-columns: 1fr; gap: 14px; }
      .roster-divider { height: 1px; min-height: 1px; width: 100%; background: linear-gradient(90deg, rgba(236, 72, 153, 0.5), rgba(56, 189, 248, 0.5)); }
      .stat-pills { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .d-emoji { width: 1.15em; height: 1.15em; vertical-align: -0.2em; object-fit: contain; }
    code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 5px; color: #fde68a; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <h1>⚔️ ${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="sub-txt">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div class="meta-badges">
        <span class="badge">${Number(totalTurns)} Hiệp • #${escapeHtml(battleId)}</span>
        <span class="badge ttl-badge">⏳ ${escapeHtml(ttlText)}</span>
      </div>
    </div>

    <div class="render-bar">
      <span id="renderStatus">⏳ Đang kết xuất đầy đủ từng hiệp theo yêu cầu...</span>
      <button id="retryRenderBtn" class="btn" type="button" style="display:none;padding:4px 10px;font-size:0.8rem">🔄 Tải lại</button>
    </div>

    <div class="stage-wrap">
      <img id="turnCanvasImg" src="" alt="Khung hình hiệp đấu">
    </div>

    <div class="controls">
      <button id="btnFirst" class="btn" type="button">⏮ Đầu</button>
      <button id="btnPrev" class="btn" type="button">◀ Lượt Trước</button>
      <select id="turnSelect" class="turn-select"></select>
      <button id="btnPlay" class="btn btn-primary" type="button">▶ Tự Phát</button>
      <button id="btnNext" class="btn" type="button">Lượt Sau ▶</button>
      <button id="btnLast" class="btn" type="button">Cuối ⏭</button>
    </div>

    <div id="turnPills" class="turn-pills"></div>

    <div id="hpGrid" class="hp-grid"></div>

    <div class="turn-log-panel">
      <div class="turn-log-header">
        <span id="turnLogTitle">📜 Diễn Biến Hiệp</span>
        <span id="domainInfo" style="font-size:0.82rem;color:#fbcfe8"></span>
      </div>
      <div id="turnLogEvents"></div>
    </div>

    ${winnerSummaryHtml ? `<div class="winner-box">${winnerSummaryHtml}</div>` : ''}

    ${(rosterStructured || rosterHtmlLines.length) ? `
    <details class="roster-details">
      <summary>📋 Xem chỉ số, Linh Vực &amp; Trang bị đầy đủ 2 phe</summary>
      ${rosterStructured ? renderStructuredRosterHtml(rosterStructured) : `<div style="margin-top:8px">${rosterHtmlLines.map((l) => `<div>${stripDiscordTagsToHtml(l)}</div>`).join('')}</div>`}
    </details>` : ''}
  </div>

  <script>
    const DATA = ${safeJsonForHtml(clientState)};
    const snapshots = Array.isArray(DATA.snapshots) ? DATA.snapshots : [];
    const maxIdx = Math.max(0, snapshots.length - 1);
    let currentIdx = 0;
    let playTimer = null;

    const imgEl = document.getElementById('turnCanvasImg');
    const selectEl = document.getElementById('turnSelect');
    const pillsEl = document.getElementById('turnPills');
    const hpGridEl = document.getElementById('hpGrid');
    const logTitleEl = document.getElementById('turnLogTitle');
    const logEventsEl = document.getElementById('turnLogEvents');
    const domainInfoEl = document.getElementById('domainInfo');
    const statusEl = document.getElementById('renderStatus');
    const retryBtn = document.getElementById('retryRenderBtn');

    function turnUrl(turnNum) {
      return DATA.turnImageTemplate.replace('{turn}', String(turnNum));
    }

    function fmtNum(n) {
      return Number(n || 0).toLocaleString('vi-VN');
    }

    function buildTurnPicker() {
      selectEl.innerHTML = '';
      pillsEl.innerHTML = '';
      snapshots.forEach((s, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = s.turn === 0 ? 'Khai Trận (H0)' : ('Hiệp ' + s.turn + ' / ' + DATA.totalTurns + (s.isFinal ? ' • Kết Thúc' : ''));
        selectEl.appendChild(opt);

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'pill';
        pill.textContent = s.turn === 0 ? 'H0' : ('H' + s.turn);
        pill.addEventListener('click', () => { stopAutoPlay(); renderTurnView(idx); });
        pillsEl.appendChild(pill);
      });
    }

    function renderHpCards(snap) {
      const bars = Array.isArray(snap.hpBars) ? snap.hpBars : [];
      hpGridEl.innerHTML = bars.map((b) => {
        const maxHp = Math.max(1, Number(b.maxHp || 1));
        const curHp = Math.max(0, Number(b.hp || 0));
        const prevHp = b.prevHp !== undefined ? Number(b.prevHp) : curHp;
        const diff = curHp - prevHp;
        const pct = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
        const deltaCls = diff < 0 ? 'dmg' : diff > 0 ? 'heal' : 'zero';
        const deltaTxt = diff < 0 ? (fmtNum(diff) + ' HP') : diff > 0 ? ('+' + fmtNum(diff) + ' HP') : 'Không đổi';
        const shTxt = Number(b.shield || 0) > 0 ? ('Khiên: ' + fmtNum(b.shield)) : '';
        return '<div class="hp-card ' + (b.side === 'B' ? 'side-b' : 'side-a') + '">'
          + '<div class="hp-top"><span class="hp-name">' + (b.side === 'B' ? '🛡️ ' : '⚔️ ') + b.label + '</span>'
          + '<span class="hp-delta ' + deltaCls + '">' + deltaTxt + '</span></div>'
          + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>'
          + '<div class="hp-nums"><span>HP: ' + fmtNum(curHp) + ' / ' + fmtNum(maxHp) + ' (' + pct + '%)</span><span>' + shTxt + '</span></div>'
          + '</div>';
      }).join('');
    }

    function renderTurnView(idx) {
      if (!snapshots.length) return;
      currentIdx = Math.max(0, Math.min(maxIdx, idx));
      const snap = snapshots[currentIdx];

      imgEl.src = turnUrl(snap.turn);
      selectEl.value = String(currentIdx);
      Array.from(pillsEl.children).forEach((el, pIdx) => {
        el.classList.toggle('active', pIdx === currentIdx);
      });

      document.getElementById('btnFirst').disabled = currentIdx === 0;
      document.getElementById('btnPrev').disabled = currentIdx === 0;
      document.getElementById('btnNext').disabled = currentIdx === maxIdx;
      document.getElementById('btnLast').disabled = currentIdx === maxIdx;

      renderHpCards(snap);

      logTitleEl.textContent = snap.turn === 0
        ? '🚩 Khai Trận (Hiệp 0 — Trạng Thái Ban Đầu)'
        : ('⚔️ Diễn Biến Độc Lập Của Hiệp ' + snap.turn + ' / ' + DATA.totalTurns);
      domainInfoEl.textContent = snap.domainLabel || '';

      const evs = Array.isArray(snap.eventsHtml) ? snap.eventsHtml : [];
      logEventsEl.innerHTML = evs.length
        ? evs.map((h) => '<div class="log-item">' + h + '</div>').join('')
        : '<div class="log-item" style="color:#94a3b8">Hiệp này không phát sinh diễn biến thêm.</div>';
    }

    function stopAutoPlay() {
      if (playTimer) {
        clearInterval(playTimer);
        playTimer = null;
        document.getElementById('btnPlay').textContent = '▶ Tự Phát';
      }
    }

    document.getElementById('btnFirst').addEventListener('click', () => { stopAutoPlay(); renderTurnView(0); });
    document.getElementById('btnPrev').addEventListener('click', () => { stopAutoPlay(); renderTurnView(currentIdx - 1); });
    document.getElementById('btnNext').addEventListener('click', () => { stopAutoPlay(); renderTurnView(currentIdx + 1); });
    document.getElementById('btnLast').addEventListener('click', () => { stopAutoPlay(); renderTurnView(maxIdx); });
    selectEl.addEventListener('change', (e) => { stopAutoPlay(); renderTurnView(Number(e.target.value) || 0); });
    document.getElementById('btnPlay').addEventListener('click', () => {
      if (playTimer) { stopAutoPlay(); return; }
      if (currentIdx >= maxIdx) renderTurnView(0);
      document.getElementById('btnPlay').textContent = '⏸ Tạm Dừng';
      playTimer = setInterval(() => {
        if (currentIdx >= maxIdx) { stopAutoPlay(); return; }
        renderTurnView(currentIdx + 1);
      }, 1300);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { stopAutoPlay(); renderTurnView(currentIdx - 1); }
      else if (e.key === 'ArrowRight') { stopAutoPlay(); renderTurnView(currentIdx + 1); }
    });

    async function requestOnDemandRenderAll() {
      retryBtn.style.display = 'none';
      statusEl.textContent = '⏳ Người xem đã mở Web Logs — đang kết xuất toàn bộ ' + snapshots.length + ' khung hình từng hiệp...';
      try {
        const res = await fetch(DATA.renderAllUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const json = await res.json();
        if (res.ok && json.success) {
          statusEl.textContent = '✅ Đã kết xuất đầy đủ ' + (json.rendered_count || snapshots.length) + '/' + snapshots.length + ' khung hình! Hãy dùng nút bên dưới để tua từng hiệp.';
        } else {
          statusEl.textContent = '⚠️ Có khung hình chưa xong, ảnh sẽ tự render ngay khi bạn chọn hiệp.';
          retryBtn.style.display = 'inline-block';
        }
      } catch (err) {
        statusEl.textContent = '⚠️ Lỗi kết nối render toàn bộ, chuyển sang chế độ render trực tiếp theo từng lượt.';
        retryBtn.style.display = 'inline-block';
      }
    }
    retryBtn.addEventListener('click', requestOnDemandRenderAll);

    buildTurnPicker();
    renderTurnView(0);
    requestOnDemandRenderAll();
  </script>
</body>
</html>`;
}
