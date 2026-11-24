/**
 * src/canvas/questRenderer.js
 * Render Bảng Nhiệm Vụ OwO-style (Hàng Ngày / Hợp Đồng Tuần / Tháp Thí Luyện 500 Tầng) ra ảnh WebP sắc nét.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { createCanvas } from '@napi-rs/canvas';
import { FONT_FAMILY } from './drawUtils.js';

const WIDTH = 920;
const HEIGHT = 590;

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStatusBadge(ctx, x, y, done, claimed) {
  ctx.save();
  drawRoundRect(ctx, x, y, 26, 26, 7);
  if (claimed) {
    ctx.fillStyle = '#0f766e';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
  } else if (done) {
    ctx.fillStyle = '#15803d';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#475569';
  }
  ctx.lineWidth = 1.6;
  ctx.stroke();

  if (done || claimed) {
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 13);
    ctx.lineTo(x + 11.5, y + 18);
    ctx.lineTo(x + 19.5, y + 8.5);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawProgressBar(ctx, x, y, w, h, ratio, accent = '#38bdf8') {
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped > 0) {
    const fillW = Math.max(h, Math.round(w * clamped));
    drawRoundRect(ctx, x, y, fillW, h, h / 2);
    const grad = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, '#34d399');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

function truncateText(ctx, text, maxW) {
  const s = String(text || '');
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${s.slice(0, mid)}...`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo)}...`;
}

export async function renderQuestBoardWebp(questData, rawTab = 'daily') {
  const tab = ['daily', 'weekly', 'tower'].includes(String(rawTab || '').toLowerCase())
    ? String(rawTab).toLowerCase()
    : 'daily';

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Nền tối Huyền Ngọc + ánh sáng nhạt
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#090e1a');
  bg.addColorStop(0.55, '#0f172a');
  bg.addColorStop(1, '#09151d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Viền ngoài vàng kim cổ phong
  drawRoundRect(ctx, 12, 12, WIDTH - 24, HEIGHT - 24, 18);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundRect(ctx, 18, 18, WIDTH - 36, HEIGHT - 36, 14);
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header
  const username = String(questData?.username || 'Tu Sĩ').slice(0, 28);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold 25px ${FONT_FAMILY}`;
  ctx.fillText(`BẢNG NHIỆM VỤ — ${username}`, 38, 60);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `14px ${FONT_FAMILY}`;
  const subLabel = tab === 'weekly'
    ? `Hợp Đồng Tuần (${questData?.week_key || ''})  •  Làm mới sau: ${questData?.weekly_reset_in || '--'}`
    : tab === 'tower'
      ? `Tháp Thí Luyện ${questData?.tower_max_floor || 500} Tầng  •  Lượt hôm nay: ${questData?.tower_attempts_used || 0}/${questData?.tower_attempts_limit || 5}`
      : `Nhiệm Vụ Hàng Ngày (${questData?.quest_date || ''})  •  Làm mới sau: ${questData?.daily_reset_in || '--'}`;
  ctx.fillText(subLabel, 38, 86);

  // Tab Pills
  const tabs = [
    { key: 'daily', label: 'Hàng Ngày (5)' },
    { key: 'weekly', label: 'Hợp Đồng Tuần (3)' },
    { key: 'tower', label: 'Tháp 500 Tầng' },
  ];
  let tabX = 38;
  for (const t of tabs) {
    const isActive = t.key === tab;
    const pillW = 190;
    drawRoundRect(ctx, tabX, 102, pillW, 34, 9);
    ctx.fillStyle = isActive ? '#0f766e' : '#1e293b';
    ctx.fill();
    ctx.strokeStyle = isActive ? '#2dd4bf' : '#334155';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = isActive ? '#ffffff' : '#94a3b8';
    ctx.font = isActive ? `bold 14px ${FONT_FAMILY}` : `14px ${FONT_FAMILY}`;
    const tw = ctx.measureText(t.label).width;
    ctx.fillText(t.label, tabX + (pillW - tw) / 2, 124);
    tabX += pillW + 12;
  }

  // Nội dung theo tab
  const startY = 152;
  if (tab === 'daily') {
    const quests = Array.isArray(questData?.quests) ? questData.quests.slice(0, 5) : [];
    const cardH = 68;
    const gap = 10;
    quests.forEach((q, idx) => {
      const y = startY + idx * (cardH + gap);
      drawRoundRect(ctx, 36, y, WIDTH - 72, cardH, 12);
      ctx.fillStyle = q.done ? 'rgba(16, 185, 129, 0.10)' : 'rgba(30, 41, 59, 0.72)';
      ctx.fill();
      ctx.strokeStyle = q.claimed ? '#2dd4bf' : q.done ? '#4ade80' : '#334155';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      drawStatusBadge(ctx, 52, y + 21, q.done, q.claimed);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.fillText(truncateText(ctx, `${idx + 1}. ${q.name}`, 510), 92, y + 28);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `13px ${FONT_FAMILY}`;
      const statusTxt = q.claimed ? 'Đã nhận' : q.done ? 'Sẵn sàng nhận' : 'Đang tiến hành';
      ctx.fillText(`Thưởng: +${q.reward_lt} LT   •   Tiến độ: [${q.progress}/${q.target}]   •   ${statusTxt}`, 92, y + 51);

      const ratio = Number(q.target) > 0 ? Number(q.progress || 0) / Number(q.target) : 0;
      drawProgressBar(ctx, 640, y + 27, 220, 14, ratio, q.done ? '#22c55e' : '#38bdf8');
    });

    // Footer tổng kết 5/5
    drawRoundRect(ctx, 36, 540, WIDTH - 72, 28, 8);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = `bold 13px ${FONT_FAMILY}`;
    ctx.fillText('Hoàn tất 5/5: +130 LT  •  +1 Vé Pháp Bảo  •  +1 Tinh Thạch  •  +1 Đá Khắc Ấn', 52, 559);
  } else if (tab === 'weekly') {
    const contracts = Array.isArray(questData?.weekly_contracts) ? questData.weekly_contracts.slice(0, 3) : [];
    const cardH = 104;
    const gap = 14;
    contracts.forEach((c, idx) => {
      const y = startY + idx * (cardH + gap);
      drawRoundRect(ctx, 36, y, WIDTH - 72, cardH, 14);
      ctx.fillStyle = c.done ? 'rgba(16, 185, 129, 0.10)' : 'rgba(30, 41, 59, 0.72)';
      ctx.fill();
      ctx.strokeStyle = c.claimed ? '#2dd4bf' : c.done ? '#4ade80' : '#334155';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      drawStatusBadge(ctx, 54, y + 38, c.done, c.claimed);

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold 18px ${FONT_FAMILY}`;
      ctx.fillText(truncateText(ctx, `${idx + 1}. ${c.label}`, 480), 96, y + 36);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillText(`Thưởng: +${c.rewardLt} LT  •  +${c.rewardStones} Đá Khắc Ấn`, 96, y + 64);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      ctx.fillText(`Tiến độ: [${Number(c.progress || 0).toLocaleString('vi-VN')} / ${Number(c.target || 0).toLocaleString('vi-VN')}]`, 96, y + 88);

      const ratio = Number(c.target) > 0 ? Number(c.progress || 0) / Number(c.target) : 0;
      drawProgressBar(ctx, 590, y + 45, 270, 18, ratio, c.done ? '#22c55e' : '#a855f7');
    });

    drawRoundRect(ctx, 36, 515, WIDTH - 72, 46, 10);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.14)';
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillText('Mốc Hoàn Tất 3/3 Hợp Đồng Tuần:  +600 LT  •  +5 Đá Khắc Ấn  (/nhiemvu hanh_dong:claim_weekly)', 54, 543);
  } else {
    const floor = Number(questData?.tower_floor || 0);
    const maxFloor = Number(questData?.tower_max_floor || 500);
    const nextFloor = Math.min(maxFloor, floor + 1);
    const ratio = maxFloor > 0 ? floor / maxFloor : 0;

    drawRoundRect(ctx, 36, startY, WIDTH - 72, 230, 16);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.78)';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.font = `bold 23px ${FONT_FAMILY}`;
    ctx.fillText(`Tầng Hiện Tại: Tầng ${floor} / ${maxFloor}`, 64, startY + 54);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `15px ${FONT_FAMILY}`;
    ctx.fillText(`Mục tiêu kế tiếp: Tầng ${nextFloor}   •   Lượt hôm nay: ${questData?.tower_attempts_used || 0}/${questData?.tower_attempts_limit || 5}`, 64, startY + 92);
    ctx.fillText(`Thẻ Reset Tháp: ${questData?.tower_reset_cards || 0}/15   •   Đá Khắc Ấn: ${questData?.enchant_stones || 0}`, 64, startY + 124);

    drawProgressBar(ctx, 64, startY + 156, WIDTH - 128, 22, ratio, '#f59e0b');
    ctx.fillStyle = '#94a3b8';
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillText(`Tiến độ chinh phục Tháp Thí Luyện: ${(ratio * 100).toFixed(1)}%`, 64, startY + 204);

    drawRoundRect(ctx, 36, 405, WIDTH - 72, 130, 14);
    ctx.fillStyle = 'rgba(15, 118, 110, 0.14)';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillText('Hướng Dẫn Nhanh', 64, 440);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillText('• Bấm nút [Leo Tháp] hoặc /nhiemvu hanh_dong:tower để khiêu chiến tầng tiếp theo.', 64, 472);
    ctx.fillText('• Hết lượt có thể dùng /nhiemvu hanh_dong:reset (tiêu 1 Thẻ Reset) để hồi 5/5 lượt.', 64, 502);
  }

  return canvas.encode('webp', 92);
}
