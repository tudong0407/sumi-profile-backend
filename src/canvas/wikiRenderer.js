/**
 * src/canvas/wikiRenderer.js
 * Kết xuất 3 loại ảnh Full HD+ (2000 x 1000 px, 2x High-DPI) cho hệ thống /wiki:
 * 1. Sơ đồ Vòng Xoay Tương Khắc Ngũ Hành & Tứ Đại Dị Tố Đặc Thù
 * 2. Thẻ Chi Tiết Trang Bị Loadout (kèm Chủ Sở Hữu hiện tại cho 9 món Thần Thoại Độc Nhất)
 * 3. Thẻ Chi Tiết Linh Thú Tiên Giới
 */

import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  drawRoundRect,
  truncateText,
  wrapTextLines,
  drawPetal,
  drawStarSparkle,
  sanitizeText,
  loadBadgeImage,
  drawIconText,
  drawAutoFitSingleLineText,
  drawElementalPetBorderFX,
  encodeCanvas,
  FONT_FAMILY,
} from './drawUtils.js';

const RENDER_SCALE = 1.2; // 1200x600 sắc nét cho Discord Embed & giảm 64% thời gian render
const LOGICAL_W = 1000;
const LOGICAL_H = 500;

const RARITY_STYLES = {
  common: {
    label: 'PHÀM PHẨM',
    primary: '#94a3b8',
    secondary: '#cbd5e1',
    glow: 'rgba(148, 163, 184, 0.45)',
    bgTint: 'rgba(51, 65, 85, 0.35)',
    badgeBg: 'rgba(51, 65, 85, 0.85)',
  },
  rare: {
    label: 'LINH PHẨM',
    primary: '#38bdf8',
    secondary: '#60a5fa',
    glow: 'rgba(56, 189, 248, 0.55)',
    bgTint: 'rgba(30, 58, 138, 0.32)',
    badgeBg: 'rgba(29, 78, 216, 0.85)',
  },
  epic: {
    label: 'TIÊN PHẨM',
    primary: '#c084fc',
    secondary: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.62)',
    bgTint: 'rgba(88, 28, 135, 0.34)',
    badgeBg: 'rgba(126, 34, 206, 0.88)',
  },
  mythic: {
    label: 'THẦN THOẠI',
    primary: '#fbbf24',
    secondary: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.68)',
    bgTint: 'rgba(159, 18, 57, 0.30)',
    badgeBg: 'rgba(190, 18, 60, 0.90)',
  },
  unique_supreme: {
    label: 'TỐI THƯỢNG',
    primary: '#fb7185',
    secondary: '#fbbf24',
    glow: 'rgba(225, 29, 72, 0.72)',
    bgTint: 'rgba(190, 18, 60, 0.34)',
    badgeBg: 'rgba(225, 29, 72, 0.92)',
  },
  evolved_supreme: {
    label: 'TỐI THƯỢNG CHÂN THẦN',
    primary: '#fda4af',
    secondary: '#fde047',
    glow: 'rgba(244, 63, 94, 0.78)',
    bgTint: 'rgba(190, 24, 93, 0.36)',
    badgeBg: 'rgba(190, 24, 93, 0.94)',
  },
  supreme: {
    label: 'TỐI THƯỢNG THẦN THOẠI',
    primary: '#ec4899',
    secondary: '#fbbf24',
    glow: 'rgba(236, 72, 153, 0.78)',
    bgTint: 'rgba(190, 24, 93, 0.34)',
    badgeBg: 'rgba(190, 24, 93, 0.92)',
  },
};

const ELEMENT_COLORS = {
  Kim: { color: '#fbbf24', dark: '#78350f', icon: '⚔️' },
  Mộc: { color: '#4ade80', dark: '#14532d', icon: '🌿' },
  Thổ: { color: '#d97706', dark: '#451a03', icon: '🪨' },
  Thủy: { color: '#38bdf8', dark: '#0c4a6e', icon: '💧' },
  Hỏa: { color: '#f87171', dark: '#7f1d1d', icon: '🔥' },
  Lôi: { color: '#facc15', dark: '#713f12', icon: '⚡' },
  Ám: { color: '#a855f7', dark: '#3b0764', icon: '🌙' },
  Quang: { color: '#fef08a', dark: '#713f12', icon: '✨' },
  'Hỗn Độn': { color: '#f472b6', dark: '#831843', icon: '🌌' },
  'Hư Không': { color: '#c084fc', dark: '#4c1d95', icon: '🌌' },
  'Không Gian': { color: '#818cf8', dark: '#312e81', icon: '⏳' },
  'Luân Hồi': { color: '#fb7185', dark: '#881337', icon: '🔄' },
};

function drawCelestialBackground(ctx, accentColor = 'rgba(236, 72, 153, 0.20)') {
  const bg = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
  bg.addColorStop(0, '#090714');
  bg.addColorStop(0.5, '#150d29');
  bg.addColorStop(1, '#0b0717');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Tinh vân mềm
  const n1 = ctx.createRadialGradient(220, 180, 20, 220, 180, 340);
  n1.addColorStop(0, accentColor);
  n1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = n1;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const n2 = ctx.createRadialGradient(820, 340, 20, 820, 340, 320);
  n2.addColorStop(0, 'rgba(99, 102, 241, 0.16)');
  n2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = n2;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Sao nhỏ
  const stars = [
    [60, 42, 1.4], [190, 28, 1.8], [410, 46, 1.3], [640, 32, 1.9], [890, 52, 1.6],
    [950, 180, 1.5], [84, 440, 1.7], [510, 468, 1.4], [912, 435, 1.8],
  ];
  for (const [sx, sy, sr] of stars) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
  }

  // Cánh hoa đào nhẹ
  drawPetal(ctx, 48, 86, 10, 0.5, 0.35);
  drawPetal(ctx, 945, 76, 11, -0.7, 0.35);
  drawPetal(ctx, 930, 430, 12, 1.2, 0.30);

  // Khung viền ngoài chuẩn
  ctx.save();
  drawRoundRect(ctx, 14, 14, LOGICAL_W - 28, LOGICAL_H - 28, 20);
  const borderGrad = ctx.createLinearGradient(14, 14, LOGICAL_W - 14, LOGICAL_H - 14);
  borderGrad.addColorStop(0, 'rgba(244, 114, 182, 0.55)');
  borderGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.48)');
  borderGrad.addColorStop(1, 'rgba(168, 85, 247, 0.50)');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

async function drawFooter(ctx, label = 'SuMi Family • Cẩm Nang Tu Tiên Toàn Thư') {
  const cleanLabel = String(label || '').replace(/🦊\s*/g, '').trim();
  const icoFox = await loadBadgeImage('badges/su_fox_mascot.png');
  drawIconText(ctx, icoFox, cleanLabel, LOGICAL_W - 28, LOGICAL_H - 25, {
    iconSize: 14,
    gap: 5,
    align: 'right',
    font: `11px ${FONT_FAMILY}`,
    fillStyle: 'rgba(226, 232, 240, 0.52)',
  });
}

function drawCurvedArrow(ctx, x1, y1, x2, y2, cx, cy, color = '#fbbf24') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();

  // Mũi tên ở điểm cuối (tiếp tuyến từ control point (cx, cy) -> (x2, y2))
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const headLen = 11;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 1. Render Sơ Đồ Vòng Xoay Tương Khắc Ngũ Hành & Tứ Đại Dị Tố Đặc Thù (2000 x 1000 px)
 */
export async function renderElementalChart(options = {}) {
  const canvas = createCanvas(LOGICAL_W * RENDER_SCALE, LOGICAL_H * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const [
    kiemImg, huyenImg, tranImg, minhImg, thanhImg, honDonImg, senseImg, realmImg,
  ] = await Promise.all([
    loadImageSafe('domains/domain_unique_1.png', 2000, null),
    loadImageSafe('domains/domain_unique_2.png', 2000, null),
    loadImageSafe('domains/domain_unique_3.png', 2000, null),
    loadImageSafe('domains/domain_unique_4.png', 2000, null),
    loadImageSafe('domains/domain_unique_5.png', 2000, null),
    loadImageSafe('domains/domain_fuyumi_cuu_vi_hong_mong.png', 2000, null),
    loadImageSafe('domains/sense_unique_1.png', 2000, null),
    loadImageSafe('domains/realm_unique_1.png', 2000, null),
  ]);

  drawCelestialBackground(ctx, 'rgba(244, 114, 182, 0.18)');

  // Header
  ctx.save();
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(244, 114, 182, 0.55)';
  ctx.shadowBlur = 10;
  ctx.fillText('VÒNG XOAY TƯƠNG KHẮC NGŨ HÀNH LINH THÚ & NGŨ ĐẠI LINH VỰC', LOGICAL_W / 2, 26);
  ctx.shadowBlur = 0;

  ctx.font = `11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Ma trận khắc chế 9 nguyên tố Linh Thú • Vòng xoay 5 Hệ Linh Vực (Hiệp 2+) • Thần Thức & Thần Cảnh', LOGICAL_W / 2, 54);
  ctx.restore();

  function drawChartArrow(x1, y1, x2, y2, cx, cy, color = '#fbbf24') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - cy, x2 - cx);
    const headLen = 9.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const panelY = 82;
  const panelH = 380;
  const colW = 304;
  const orbitR = 96;
  const nodeR = 29;

  // ============================================================================
  // CỘT 1: VÒNG XOAY NGŨ HÀNH LINH THÚ (x = 28, w = 304)
  // ============================================================================
  const col1X = 28;
  ctx.save();
  drawRoundRect(ctx, col1X, panelY, colW, panelH, 16);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('1. NGŨ HÀNH LINH THÚ', col1X + colW / 2, panelY + 14);

  const c1X = col1X + colW / 2;
  const c1Y = panelY + 188;
  ctx.beginPath();
  ctx.arc(c1X, c1Y, orbitR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  const petCycle = [
    { name: 'KIM', sub: 'METAL', color: '#fbbf24', bg: '#451a03' },
    { name: 'MỘC', sub: 'WOOD', color: '#4ade80', bg: '#052e16' },
    { name: 'THỔ', sub: 'EARTH', color: '#f59e0b', bg: '#431407' },
    { name: 'THỦY', sub: 'WATER', color: '#38bdf8', bg: '#082f49' },
    { name: 'HỎA', sub: 'FIRE', color: '#f87171', bg: '#450a0a' },
  ].map((el, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { ...el, angle, x: c1X + orbitR * Math.cos(angle), y: c1Y + orbitR * Math.sin(angle) };
  });

  for (let i = 0; i < petCycle.length; i += 1) {
    const a = petCycle[i];
    const b = petCycle[(i + 1) % petCycle.length];
    const midAngle = a.angle + Math.PI / 5;
    const cx = c1X + (orbitR + 20) * Math.cos(midAngle);
    const cy = c1Y + (orbitR + 20) * Math.sin(midAngle);
    const sAng = Math.atan2(cy - a.y, cx - a.x);
    const eAng = Math.atan2(cy - b.y, cx - b.x);
    drawChartArrow(
      a.x + (nodeR + 5) * Math.cos(sAng),
      a.y + (nodeR + 5) * Math.sin(sAng),
      b.x + (nodeR + 7) * Math.cos(eAng),
      b.y + (nodeR + 7) * Math.sin(eAng),
      cx, cy, a.color,
    );
  }

  drawRoundRect(ctx, c1X - 52, c1Y - 23, 104, 46, 10);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 10px ${FONT_FAMILY}`;
  ctx.fillStyle = '#4ade80';
  ctx.fillText('Khắc: +30% DMG', c1X, c1Y - 8);
  ctx.fillStyle = '#fb7185';
  ctx.fillText('Bị khắc: -20%', c1X, c1Y + 9);

  for (const p of petCycle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
    const orbGrad = ctx.createRadialGradient(p.x - 6, p.y - 6, 3, p.x, p.y, nodeR);
    orbGrad.addColorStop(0, p.bg);
    orbGrad.addColorStop(1, '#090714');
    ctx.fillStyle = orbGrad;
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 13px ${FONT_FAMILY}`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, p.x, p.y - 5);

    ctx.font = `8.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(p.sub, p.x, p.y + 10);
    ctx.restore();
  }

  drawRoundRect(ctx, col1X + 14, panelY + 324, colW - 28, 42, 9);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.fillText('Kim → Mộc → Thổ → Thủy → Hỏa → Kim', c1X, panelY + 345);
  ctx.restore();

  // ============================================================================
  // CỘT 2: VÒNG XOAY NGŨ ĐẠI LINH VỰC (x = 348, w = 304) — ICON PNG TRỰC QUAN
  // ============================================================================
  const col2X = 348;
  ctx.save();
  drawRoundRect(ctx, col2X, panelY, colW, panelH, 16);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.52)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#f472b6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('2. NGŨ ĐẠI LINH VỰC (HIỆP 2+)', col2X + colW / 2, panelY + 14);

  const c2X = col2X + colW / 2;
  const c2Y = panelY + 184;
  ctx.beginPath();
  ctx.arc(c2X, c2Y, orbitR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.16)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  const domCycle = [
    { name: 'KIẾM VỰC', color: '#fbbf24', img: kiemImg },
    { name: 'HUYỄN VỰC', color: '#e879f9', img: huyenImg },
    { name: 'TRẬN VỰC', color: '#4ade80', img: tranImg },
    { name: 'MINH VỰC', color: '#818cf8', img: minhImg },
    { name: 'THÁNH VỰC', color: '#38bdf8', img: thanhImg },
  ].map((el, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { ...el, angle, x: c2X + orbitR * Math.cos(angle), y: c2Y + orbitR * Math.sin(angle) };
  });

  for (let i = 0; i < domCycle.length; i += 1) {
    const a = domCycle[i];
    const b = domCycle[(i + 1) % domCycle.length];
    const midAngle = a.angle + Math.PI / 5;
    const cx = c2X + (orbitR + 20) * Math.cos(midAngle);
    const cy = c2Y + (orbitR + 20) * Math.sin(midAngle);
    const sAng = Math.atan2(cy - a.y, cx - a.x);
    const eAng = Math.atan2(cy - b.y, cx - b.x);
    drawChartArrow(
      a.x + (nodeR + 5) * Math.cos(sAng),
      a.y + (nodeR + 5) * Math.sin(sAng),
      b.x + (nodeR + 7) * Math.cos(eAng),
      b.y + (nodeR + 7) * Math.sin(eAng),
      cx, cy, a.color,
    );
  }

  drawRoundRect(ctx, c2X - 54, c2Y - 23, 108, 46, 10);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 10px ${FONT_FAMILY}`;
  ctx.fillStyle = '#4ade80';
  ctx.fillText('Khắc: -1 Mạch', c2X, c2Y - 8);
  ctx.fillStyle = '#fb7185';
  ctx.fillText('Bị khắc: -2 Mạch', c2X, c2Y + 9);

  for (const d of domCycle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(d.x, d.y, nodeR - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#090714';
    ctx.fill();
    ctx.clip();
    if (d.img) {
      ctx.drawImage(d.img, d.x - (nodeR - 2), d.y - (nodeR - 2), (nodeR - 2) * 2, (nodeR - 2) * 2);
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(d.x, d.y, nodeR - 2, 0, Math.PI * 2);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    ctx.font = `bold 8.5px ${FONT_FAMILY}`;
    const lw = ctx.measureText(d.name).width + 10;
    drawRoundRect(ctx, d.x - lw / 2, d.y + 18, lw, 15, 5);
    ctx.fillStyle = 'rgba(12, 9, 24, 0.94)';
    ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.name, d.x, d.y + 25.5);
  }

  const b2Y = panelY + 324;
  drawRoundRect(ctx, col2X + 14, b2Y, colW - 28, 42, 9);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (honDonImg) {
    ctx.save();
    drawRoundRect(ctx, col2X + 20, b2Y + 6, 30, 30, 6);
    ctx.clip();
    ctx.drawImage(honDonImg, col2X + 20, b2Y + 6, 30, 30);
    ctx.restore();
  }
  drawAutoFitSingleLineText(ctx, 'Kiếm → Huyễn → Trận → Minh → Thánh', col2X + 56, b2Y + 14, colW - 76, {
    maxFont: 9.8, minFont: 7.5, weight: 'bold', align: 'left', color: '#fbcfe8',
  });
  drawAutoFitSingleLineText(ctx, 'Vực Thần Thoại: Xuyên Kháng 56%–60% Debuff', col2X + 56, b2Y + 29, colW - 76, {
    maxFont: 8.8, minFont: 7.0, weight: 'bold', align: 'left', color: '#fde047',
  });
  ctx.restore();

  // ============================================================================
  // CỘT 3: TỨ ĐẠI DỊ TỐ ĐẶC THÙ & THẦN THỨC / THẦN CẢNH (x = 668, w = 304)
  // ============================================================================
  const col3X = 668;
  ctx.save();
  drawRoundRect(ctx, col3X, panelY, colW, panelH, 16);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e879f9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('3. DỊ TỐ & THẦN THỨC / CẢNH', col3X + colW / 2, panelY + 14);

  const specials = [
    {
      title: 'HỆ LÔI (THUNDER)',
      badge: '+30% vs Thủy/Kim',
      badgeColor: '#facc15',
      border: 'rgba(250, 204, 21, 0.55)',
      bg: 'rgba(113, 63, 18, 0.25)',
      lines: [
        '• Khắc chế mạnh Hệ Thủy & Hệ Kim (+30% DMG).',
        '• Thủy / Kim đánh Lôi bị giảm -20% sát thương.',
      ],
    },
    {
      title: 'ÁM ↔ QUANG',
      badge: '+25% Lưỡng Cực',
      badgeColor: '#c084fc',
      border: 'rgba(192, 132, 252, 0.55)',
      bg: 'rgba(88, 28, 135, 0.26)',
      lines: [
        '• Hai hệ đối lập tương sát trực tiếp lẫn nhau.',
        '• Gây thêm +25% sát thương hai chiều (×1.25).',
      ],
    },
    {
      title: 'HỖN ĐỘN & HƯ KHÔNG',
      badge: 'Ngoài Ngũ Hành',
      badgeColor: '#f472b6',
      border: 'rgba(244, 114, 182, 0.65)',
      bg: 'rgba(157, 23, 77, 0.28)',
      lines: [
        '• Đứng ngoài vòng khắc chế — không bị hệ nào khắc.',
        '• +20% sát thương chuẩn xuyên giáp • -15% ST nhận.',
      ],
    },
  ];

  const cardX = col3X + 14;
  const cardW = colW - 28;
  const cardH = 74;
  specials.forEach((sp, idx) => {
    const cy = panelY + 42 + idx * (cardH + 8);
    drawRoundRect(ctx, cardX, cy, cardW, cardH, 10);
    ctx.fillStyle = sp.bg;
    ctx.fill();
    ctx.strokeStyle = sp.border;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `bold 11.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.title, cardX + 10, cy + 18);

    ctx.font = `bold 8.8px ${FONT_FAMILY}`;
    const bw = ctx.measureText(sp.badge).width + 12;
    const bx = cardX + cardW - bw - 8;
    drawRoundRect(ctx, bx, cy + 8, bw, 18, 5);
    ctx.fillStyle = 'rgba(15, 12, 28, 0.88)';
    ctx.fill();
    ctx.strokeStyle = sp.badgeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = sp.badgeColor;
    ctx.textAlign = 'center';
    ctx.fillText(sp.badge, bx + bw / 2, cy + 17);

    ctx.textAlign = 'left';
    ctx.font = `9.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(truncateText(ctx, sp.lines[0], cardW - 20), cardX + 10, cy + 40);
    ctx.fillText(truncateText(ctx, sp.lines[1], cardW - 20), cardX + 10, cy + 57);
  });

  // Thẻ 4: Thần Thức & Thần Cảnh kèm icon PNG
  const scY = panelY + 42 + 3 * (cardH + 8);
  const scH = 78;
  drawRoundRect(ctx, cardX, scY, cardW, scH, 10);
  ctx.fillStyle = 'rgba(30, 58, 138, 0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (senseImg) {
    ctx.save();
    drawRoundRect(ctx, cardX + 10, scY + 9, 26, 26, 5);
    ctx.clip();
    ctx.drawImage(senseImg, cardX + 10, scY + 9, 26, 26);
    ctx.restore();
  }
  if (realmImg) {
    ctx.save();
    drawRoundRect(ctx, cardX + 10, scY + 43, 26, 26, 5);
    ctx.clip();
    ctx.drawImage(realmImg, cardX + 10, scY + 43, 26, 26);
    ctx.restore();
  }

  drawAutoFitSingleLineText(ctx, 'THẦN THỨC (+1..+6 Linh Mạch)', cardX + 42, scY + 15, cardW - 50, {
    maxFont: 10.2, minFont: 8.0, weight: 'bold', align: 'left', color: '#38bdf8',
  });
  drawAutoFitSingleLineText(ctx, 'Tăng trần Linh Mạch, Buff sân nhà & Kháng khắc hệ', cardX + 42, scY + 29, cardW - 50, {
    maxFont: 9.0, minFont: 7.2, align: 'left', color: '#e2e8f0',
  });

  drawAutoFitSingleLineText(ctx, 'THẦN CẢNH (+8%..+28% Áp Chế)', cardX + 42, scY + 49, cardW - 50, {
    maxFont: 10.2, minFont: 8.0, weight: 'bold', align: 'left', color: '#fb7185',
  });
  drawAutoFitSingleLineText(ctx, 'Tăng độ sâu Debuff & cắt trần HP / Khiên / Hồi máu', cardX + 42, scY + 63, cardW - 50, {
    maxFont: 9.0, minFont: 7.2, align: 'left', color: '#e2e8f0',
  });
  ctx.restore();

  await drawFooter(ctx, 'SuMi Family • Sơ Đồ Ngũ Hành Linh Thú & Ngũ Đại Linh Vực');
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}

/**
 * 2. Render Thẻ Chi Tiết Pháp Bảo Loadout Full HD+ (2000 x 1000 px)
 */
export async function renderWikiItemCard(itemData, options = {}) {
  const canvas = createCanvas(LOGICAL_W * RENDER_SCALE, LOGICAL_H * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const rarityStyle = RARITY_STYLES[itemData.rarity_key] || RARITY_STYLES.common;
  const elemMeta = ELEMENT_COLORS[itemData.element] || { color: '#94a3b8', icon: '✨' };
  const itemImg = await loadImageSafe(itemData.asset_path || `items/${itemData.item_id}.png`, 2500, null);

  drawCelestialBackground(ctx, rarityStyle.bgTint);

  // ============================================================================
  // BÊN TRÁI: BỆ TRƯNG BÀY PHÁP BẢO (SHOWCASE PEDESTAL)
  // ============================================================================
  const leftX = 42;
  const leftY = 42;
  const leftW = 340;
  const leftH = 416;

  ctx.save();
  drawRoundRect(ctx, leftX, leftY, leftW, leftH, 18);
  const pedGrad = ctx.createLinearGradient(leftX, leftY, leftX + leftW, leftY + leftH);
  pedGrad.addColorStop(0, 'rgba(20, 15, 38, 0.88)');
  pedGrad.addColorStop(1, 'rgba(11, 8, 22, 0.92)');
  ctx.fillStyle = pedGrad;
  ctx.fill();
  ctx.strokeStyle = rarityStyle.primary;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = rarityStyle.glow;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Hào quang trung tâm bệ pháp bảo
  const artCx = leftX + leftW / 2;
  const artCy = leftY + 206;
  const artAura = ctx.createRadialGradient(artCx, artCy, 15, artCx, artCy, 138);
  artAura.addColorStop(0, rarityStyle.glow);
  artAura.addColorStop(0.6, rarityStyle.bgTint);
  artAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = artAura;
  ctx.beginPath();
  ctx.arc(artCx, artCy, 138, 0, Math.PI * 2);
  ctx.fill();

  // Nhãn Slot ở góc trên bệ
  const slotBadge = itemData.item_type === 'weapon' ? 'VŨ KHÍ' : itemData.item_type === 'gem' ? 'BẢO NGỌC' : 'CHIẾN HỒN';
  ctx.font = `bold 11.5px ${FONT_FAMILY}`;
  const sbW = ctx.measureText(slotBadge).width + 24;
  drawRoundRect(ctx, artCx - sbW / 2, leftY + 18, sbW, 26, 8);
  ctx.fillStyle = 'rgba(15, 12, 28, 0.88)';
  ctx.fill();
  ctx.strokeStyle = rarityStyle.primary;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = rarityStyle.primary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slotBadge, artCx, leftY + 31);

  // Vẽ Ảnh Minh Họa 512x512 sắc nét
  const frameSize = 236;
  const frameX = artCx - frameSize / 2;
  const frameY = artCy - frameSize / 2;
  drawRoundRect(ctx, frameX, frameY, frameSize, frameSize, 18);
  ctx.fillStyle = 'rgba(10, 7, 20, 0.65)';
  ctx.fill();
  ctx.strokeStyle = rarityStyle.secondary;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (itemImg) {
    ctx.save();
    drawRoundRect(ctx, frameX + 4, frameY + 4, frameSize - 8, frameSize - 8, 15);
    ctx.clip();
    ctx.drawImage(itemImg, frameX + 4, frameY + 4, frameSize - 8, frameSize - 8);
    ctx.restore();
  } else {
    ctx.font = `72px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemData.icon || '⚔️', artCx, artCy);
  }

  // Nhãn Phẩm Cấp & Tỉ lệ rớt ở đáy bệ
  drawRoundRect(ctx, leftX + 24, leftY + leftH - 54, leftW - 48, 34, 10);
  ctx.fillStyle = rarityStyle.badgeBg;
  ctx.fill();
  ctx.strokeStyle = '#ffffff40';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${rarityStyle.label}  •  TỈ LỆ RỚT ${itemData.drop_rate}%`, artCx, leftY + leftH - 37);

  if (itemData.is_unique) {
    drawStarSparkle(ctx, leftX + 28, leftY + 28, 7, '#fef08a', '#f43f5e');
    drawStarSparkle(ctx, leftX + leftW - 28, leftY + 28, 7, '#fef08a', '#f43f5e');
  }
  ctx.restore();

  // ============================================================================
  // BÊN PHẢI: THÔNG SỐ CHI TIẾT, HAX & CHỦ SỞ HỮU ĐỘC NHẤT
  // ============================================================================
  const rightX = 408;
  const rightW = 550;

  ctx.save();
  // Tên Pháp Bảo
  ctx.font = `bold 26px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = rarityStyle.glow;
  ctx.shadowBlur = 10;
  ctx.fillText(truncateText(ctx, itemData.item_name, rightW), rightX, 46);
  ctx.shadowBlur = 0;

  // Hàng Pill: Phẩm Cấp + Hệ Nguyên Tố + Độc Nhất
  let pillX = rightX;
  const pillY = 88;
  const pills = [
    { text: itemData.rarity, color: rarityStyle.primary, bg: rarityStyle.bgTint },
    { text: `Hệ ${itemData.element}`, color: elemMeta.color, bg: 'rgba(30, 27, 75, 0.72)' },
    { text: `Tỉ lệ rớt: ${itemData.drop_rate}%`, color: '#e2e8f0', bg: 'rgba(30, 41, 59, 0.72)' },
  ];
  if (itemData.is_unique) {
    pills.push({ text: 'Độc Nhất Server', color: '#fde047', bg: 'rgba(190, 18, 60, 0.55)' });
  }
  ctx.font = `bold 11.5px ${FONT_FAMILY}`;
  for (const p of pills) {
    const pw = ctx.measureText(p.text).width + 20;
    drawRoundRect(ctx, pillX, pillY, pw, 26, 7);
    ctx.fillStyle = p.bg;
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, pillX + pw / 2, pillY + 13);
    pillX += pw + 8;
  }

  // Bảng 5 Chỉ Số Cộng Thêm (ATK / DEF / SPD / HP / CRIT)
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('CHỈ SỐ CỘNG THÊM', rightX, 134);

  const stats = [
    { label: 'ATK', val: itemData.bonus_atk || 0, suffix: '', color: '#f87171', icon: '🗡️' },
    { label: 'DEF', val: itemData.bonus_def || 0, suffix: '', color: '#60a5fa', icon: '🛡️' },
    { label: 'SPD', val: itemData.bonus_spd || 0, suffix: '', color: '#facc15', icon: '⚡' },
    { label: 'HP', val: itemData.bonus_hp || 0, suffix: '', color: '#4ade80', icon: '❤️' },
    { label: 'CRIT', val: Number(itemData.bonus_crit) || 0, suffix: '%', color: '#f472b6', icon: '💥' },
  ];

  const tileGap = 10;
  const tileW = Math.floor((rightW - tileGap * 4) / 5);
  const tileY = 154;
  const tileH = 74;

  stats.forEach((st, i) => {
    const tx = rightX + i * (tileW + tileGap);
    const active = st.val !== 0;
    drawRoundRect(ctx, tx, tileY, tileW, tileH, 10);
    ctx.fillStyle = active ? 'rgba(23, 18, 44, 0.88)' : 'rgba(15, 23, 42, 0.45)';
    ctx.fill();
    ctx.strokeStyle = active ? st.color : 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = active ? 1.4 : 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 11px ${FONT_FAMILY}`;
    ctx.fillStyle = active ? st.color : '#64748b';
    ctx.fillText(st.label, tx + tileW / 2, tileY + 22);

    ctx.font = `bold 17px ${FONT_FAMILY}`;
    ctx.fillStyle = active ? '#ffffff' : '#475569';
    const valStr = active
      ? `${st.val > 0 ? '+' : ''}${st.val.toLocaleString('vi-VN')}${st.suffix}`
      : '—';
    ctx.fillText(valStr, tx + tileW / 2, tileY + 50);
  });

  // Hộp Kỹ Năng / Hiệu Ứng Đặc Biệt (HAX)
  const haxY = 248;
  const haxH = itemData.is_unique ? 116 : 158;
  drawRoundRect(ctx, rightX, haxY, rightW, haxH, 14);
  ctx.fillStyle = 'rgba(20, 15, 38, 0.85)';
  ctx.fill();
  ctx.strokeStyle = itemData.hax_skill ? 'rgba(251, 191, 36, 0.62)' : 'rgba(148, 163, 184, 0.32)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold 13.5px ${FONT_FAMILY}`;
  ctx.fillStyle = itemData.hax_skill ? '#fde047' : '#e2e8f0';
  const skillTitle = itemData.hax_skill
    ? `TUYỆT KỸ HAX: ${itemData.hax_skill}`
    : 'HIỆU ỨNG TRANG BỊ';
  ctx.fillText(truncateText(ctx, skillTitle, rightW - 32), rightX + 18, haxY + 16);

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e2e8f0';
  const descText = itemData.hax_description || 'Cường hóa trực tiếp chỉ số chiến đấu cho Linh Thú xuất trận.';
  const lines = wrapTextLines(ctx, descText, rightW - 36, itemData.is_unique ? 3 : 4);
  lines.forEach((line, li) => {
    ctx.fillText(line, rightX + 18, haxY + 46 + li * 22);
  });

  // Banner Chủ Sở Hữu Hiện Tại (bắt buộc cho 9 món Thần Thoại Độc Nhất)
  if (itemData.is_unique) {
    const ownY = 380;
    const ownH = 74;
    const hasOwner = !!itemData.current_owner;
    drawRoundRect(ctx, rightX, ownY, rightW, ownH, 14);
    const ownGrad = ctx.createLinearGradient(rightX, ownY, rightX + rightW, ownY + ownH);
    if (hasOwner) {
      ownGrad.addColorStop(0, 'rgba(190, 24, 93, 0.42)');
      ownGrad.addColorStop(1, 'rgba(217, 119, 6, 0.34)');
    } else {
      ownGrad.addColorStop(0, 'rgba(30, 41, 59, 0.72)');
      ownGrad.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
    }
    ctx.fillStyle = ownGrad;
    ctx.fill();
    ctx.strokeStyle = hasOwner ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.font = `bold 11.5px ${FONT_FAMILY}`;
    ctx.fillStyle = hasOwner ? '#fde047' : '#94a3b8';
    ctx.fillText('CHỦ SỞ HỮU HIỆN TẠI (ĐỘC NHẤT TOÀN SERVER • 0.5%)', rightX + 18, ownY + 14);

    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = hasOwner ? '#ffffff' : '#cbd5e1';
    const ownerDisplay = hasOwner
      ? `${itemData.current_owner.username}  (ID: ${itemData.current_owner.user_id})`
      : 'Chưa có chủ sở hữu — Đang chờ hữu duyên nhân!';
    ctx.fillText(truncateText(ctx, ownerDisplay, rightW - 36), rightX + 18, ownY + 38);
  }
  ctx.restore();

  await drawFooter(ctx, `SuMi Family • Bách Khoa Pháp Bảo (${itemData.slot_label || 'Loadout'})`);
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}

/**
 * 3. Render Thẻ Chi Tiết Linh Thú Full HD+ (2000 x 1000 px)
 */
export async function renderWikiPetCard(petData, options = {}) {
  const canvas = createCanvas(LOGICAL_W * RENDER_SCALE, LOGICAL_H * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const petIsEvolved = Boolean(petData.is_evolved || petData.current_owner?.is_evolved);
  const dispRarity = petData.display_rarity_key || (petData.is_exclusive_fuyumi ? 'supreme' : petIsEvolved ? 'evolved_supreme' : petData.is_unique ? 'unique_supreme' : petData.rarity_key);
  const rarityStyle = RARITY_STYLES[dispRarity] || RARITY_STYLES.common;
  const elemMeta = ELEMENT_COLORS[petData.element] || { color: '#94a3b8', icon: '✨' };
  const petImgPath = petIsEvolved && petData.evo_data?.evo_image_file
    ? petData.evo_data.evo_image_file
    : (petData.image_file || `pets/${petData.pet_type}.png`);
  const petImg = await loadImageSafe(petImgPath, 2500, 'pets/hoa_thach_nham_nham.png');

  drawCelestialBackground(ctx, rarityStyle.bgTint);

  // ============================================================================
  // BÊN TRÁI: KHUNG LINH THÚ LỚN (512x512 TRANSPARENT ART)
  // ============================================================================
  const leftX = 42;
  const leftY = 42;
  const leftW = 350;
  const leftH = 416;
  const cx = leftX + leftW / 2;
  const cy = leftY + 206;

  ctx.save();
  drawRoundRect(ctx, leftX, leftY, leftW, leftH, 18);
  const pedGrad = ctx.createLinearGradient(leftX, leftY, leftX + leftW, leftY + leftH);
  pedGrad.addColorStop(0, 'rgba(20, 15, 38, 0.88)');
  pedGrad.addColorStop(1, 'rgba(10, 8, 22, 0.92)');
  ctx.fillStyle = pedGrad;
  ctx.fill();
  ctx.strokeStyle = rarityStyle.primary;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = rarityStyle.glow;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (petIsEvolved || petData.pet_type === 'cuu_vi_hong_ho') {
    drawElementalPetBorderFX(ctx, leftX, leftY, leftW, leftH, 18, petData.element, {
      allowShadowBlur: false,
      lineWidth: 2.6,
    });
  }

  // Vầng hào quang nguyên tố phía sau Linh Thú
  const aura = ctx.createRadialGradient(cx, cy, 18, cx, cy, 148);
  aura.addColorStop(0, rarityStyle.glow);
  aura.addColorStop(0.55, rarityStyle.bgTint);
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 148, 0, Math.PI * 2);
  ctx.fill();

  // Ribbon trên cùng: Linh Thú Khởi Đầu hoặc Hệ Nguyên Tố
  const topTag = petData.is_starter
    ? 'LINH THÚ KHỞI ĐẦU TÂN THỦ'
    : `HỆ ${String(petData.element || 'KIM').toUpperCase()}`;

  ctx.font = `bold 11px ${FONT_FAMILY}`;
  const tw = ctx.measureText(topTag).width + 24;
  drawRoundRect(ctx, cx - tw / 2, leftY + 16, tw, 26, 8);
  ctx.fillStyle = 'rgba(15, 12, 28, 0.90)';
  ctx.fill();
  ctx.strokeStyle = petData.is_starter ? '#4ade80' : elemMeta.color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = petData.is_starter ? '#86efac' : elemMeta.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topTag, cx, leftY + 29);

  // Vẽ Ảnh Linh Thú tách nền giữ nguyên tỷ lệ khung hình
  if (petImg) {
    const maxW = 266;
    const maxH = 266;
    const aspect = petImg.width / petImg.height;
    let drawW = maxW;
    let drawH = maxH;
    if (aspect > 1) {
      drawH = maxW / aspect;
    } else {
      drawW = maxH * aspect;
    }
    ctx.save();
    ctx.shadowColor = rarityStyle.glow;
    ctx.shadowBlur = 16;
    ctx.drawImage(petImg, cx - drawW / 2, cy - drawH / 2 + 4, drawW, drawH);
    ctx.restore();
  }

  // Rarity bar ở đáy khung trái
  drawRoundRect(ctx, leftX + 24, leftY + leftH - 52, leftW - 48, 34, 10);
  ctx.fillStyle = rarityStyle.badgeBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rarityStyle.label, cx, leftY + leftH - 35);
  ctx.restore();

  // ============================================================================
  // BÊN PHẢI: TÊN, HỆ, BỘ CHỈ SỐ (ATK/DEF/SPD/HP) & NỘI TẠI HAX
  // ============================================================================
  const rightX = 418;
  const rightW = 540;

  ctx.save();
  ctx.font = `bold 27px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = rarityStyle.glow;
  ctx.shadowBlur = 10;
  ctx.fillText(truncateText(ctx, petData.pet_name, rightW), rightX, 46);
  ctx.shadowBlur = 0;

  // Pills Phẩm cấp • Hệ • Chiến lực gốc Lv.1
  let px = rightX;
  const py = 90;
  const petDropRate = petData.drop_rate ?? (petData.is_exclusive_fuyumi ? 0 : petData.rarity_key === 'mythic' ? 0.5 : petData.rarity_key === 'epic' ? 14 : petData.rarity_key === 'rare' ? 25 : 60.5);
  const pills = [
    { text: petData.is_exclusive_fuyumi ? `${petData.rarity} • Độc Nhất` : `${petData.rarity} (${petDropRate}%)`, color: rarityStyle.primary, bg: rarityStyle.bgTint },
    { text: `Hệ ${petData.element}`, color: elemMeta.color, bg: 'rgba(30, 27, 75, 0.72)' },
    { text: `Chiến lực Lv.1: ${(petData.base_power || 0).toLocaleString('vi-VN')}`, color: '#fde047', bg: 'rgba(120, 53, 15, 0.45)' },
  ];
  ctx.font = `bold 11.5px ${FONT_FAMILY}`;
  for (const p of pills) {
    const pw = ctx.measureText(p.text).width + 20;
    drawRoundRect(ctx, px, py, pw, 26, 7);
    ctx.fillStyle = p.bg;
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, px + pw / 2, py + 13);
    px += pw + 8;
  }

  // Bộ 4 Chỉ Số (ATK / DEF / SPD / HP) kèm thanh đo trực quan
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('BỘ CHỈ SỐ GỐC (CẤP 1 • 1 SAO)', rightX, 134);

  const statMax = 600;
  const hpMax = 4000;
  const statList = [
    { label: 'ATK', icon: '🗡️', val: petData.base_atk || 0, max: statMax, color: '#f87171' },
    { label: 'DEF', icon: '🛡️', val: petData.base_def || 0, max: statMax, color: '#60a5fa' },
    { label: 'SPD', icon: '⚡', val: petData.base_spd || 0, max: statMax, color: '#facc15' },
    { label: 'HP', icon: '❤️', val: petData.base_hp || 1000, max: hpMax, color: '#4ade80' },
  ];

  const colW = Math.floor((rightW - 14) / 2);
  const rowH = 56;
  statList.forEach((st, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = rightX + col * (colW + 14);
    const sy = 156 + row * (rowH + 12);

    drawRoundRect(ctx, sx, sy, colW, rowH, 10);
    ctx.fillStyle = 'rgba(20, 15, 38, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 12.5px ${FONT_FAMILY}`;
    ctx.fillStyle = st.color;
    ctx.fillText(st.label, sx + 14, sy + 20);

    ctx.textAlign = 'right';
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(st.val.toLocaleString('vi-VN'), sx + colW - 14, sy + 20);

    // Thanh tiến độ trực quan
    const barX = sx + 14;
    const barY = sy + 38;
    const barW = colW - 28;
    const barH = 8;
    drawRoundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();

    const ratio = Math.min(1, Math.max(0.06, st.val / st.max));
    drawRoundRect(ctx, barX, barY, Math.max(10, barW * ratio), barH, 4);
    ctx.fillStyle = st.color;
    ctx.fill();
  });

  // Hộp Kỹ Năng / Nội Tại (HAX) + Khung Chủ Sở Hữu (nếu là Tối Thượng Độc Nhất)
  const haxY = 298;
  const haxH = petData.is_unique ? 112 : 156;
  drawRoundRect(ctx, rightX, haxY, rightW, haxH, 14);
  ctx.fillStyle = 'rgba(20, 15, 38, 0.86)';
  ctx.fill();
  ctx.strokeStyle = rarityStyle.primary;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('KỸ NĂNG / NỘI TẠI ĐẶC BIỆT (HAX)', rightX + 18, haxY + 12);

  ctx.font = `bold 16.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.fillText(truncateText(ctx, petData.hax_skill, rightW - 36), rightX + 18, haxY + 34);

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e2e8f0';
  const haxLines = wrapTextLines(ctx, petData.hax_description, rightW - 36, petData.is_unique ? 2 : 4);
  haxLines.forEach((line, li) => {
    ctx.fillText(line, rightX + 18, haxY + 62 + li * 20);
  });

  if (petData.is_unique) {
    const ownY = haxY + haxH + 10;
    const ownH = 44;
    const hasOwner = !!petData.current_owner;
    drawRoundRect(ctx, rightX, ownY, rightW, ownH, 12);
    ctx.fillStyle = hasOwner ? 'rgba(245, 158, 11, 0.16)' : 'rgba(30, 41, 59, 0.72)';
    ctx.fill();
    ctx.strokeStyle = hasOwner ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.font = `bold 11px ${FONT_FAMILY}`;
    ctx.fillStyle = hasOwner ? '#fde047' : '#94a3b8';
    ctx.fillText('CHỦ SỞ HỮU HIỆN TẠI (ĐỘC NHẤT TOÀN SERVER)', rightX + 18, ownY + 7);
    ctx.font = `bold 13.5px ${FONT_FAMILY}`;
    ctx.fillStyle = hasOwner ? '#ffffff' : '#cbd5e1';
    const ownDisplay = hasOwner
      ? `${petData.current_owner.username}  (ID: ${petData.current_owner.user_id})`
      : 'Chưa có chủ sở hữu — Có thể quay trúng từ /roll loai:pet';
    ctx.fillText(truncateText(ctx, ownDisplay, rightW - 36), rightX + 18, ownY + 23);
  }
  ctx.restore();

  await drawFooter(ctx, `SuMi Family • Bách Khoa Linh Thú (${petData.rarity} • Hệ ${petData.element})`);
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}
