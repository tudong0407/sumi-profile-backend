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
  encodeCanvas,
  FONT_FAMILY,
} from './drawUtils.js';

const RENDER_SCALE = 2;
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

  drawCelestialBackground(ctx, 'rgba(244, 114, 182, 0.18)');

  // Header
  ctx.save();
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(244, 114, 182, 0.55)';
  ctx.shadowBlur = 10;
  ctx.fillText('VÒNG XOAY TƯƠNG KHẮC NGŨ HÀNH & CÁC HỆ ĐẶC THÙ', LOGICAL_W / 2, 28);
  ctx.shadowBlur = 0;

  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Ma trận khắc chế 9 nguyên tố Đấu Trường Linh Thú • SuMi Family', LOGICAL_W / 2, 58);
  ctx.restore();

  // ============================================================================
  // KHUNG TRÁI: VÒNG XOAY NGŨ HÀNH (KIM -> MỘC -> THỔ -> THỦY -> HỎA -> KIM)
  // ============================================================================
  const leftX = 34;
  const panelY = 86;
  const leftW = 474;
  const panelH = 376;

  ctx.save();
  drawRoundRect(ctx, leftX, panelY, leftW, panelH, 16);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('NGŨ HÀNH TƯƠNG KHẮC', leftX + leftW / 2, panelY + 14);

  // Vòng tròn tâm ngũ giác
  const centerX = leftX + leftW / 2;
  const centerY = panelY + 196;
  const orbitR = 112;
  const nodeR = 34;

  // Vòng quỹ đạo mờ
  ctx.beginPath();
  ctx.arc(centerX, centerY, orbitR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5 đỉnh theo chiều kim đồng hồ: Kim -> Mộc -> Thổ -> Thủy -> Hỏa -> Kim
  const cycle = [
    { name: 'KIM', sub: 'Metal', color: '#fbbf24', bg: '#451a03', icon: '⚔️' },
    { name: 'MỘC', sub: 'Wood', color: '#4ade80', bg: '#052e16', icon: '🌿' },
    { name: 'THỔ', sub: 'Earth', color: '#f59e0b', bg: '#431407', icon: '🪨' },
    { name: 'THỦY', sub: 'Water', color: '#38bdf8', bg: '#082f49', icon: '💧' },
    { name: 'HỎA', sub: 'Fire', color: '#f87171', bg: '#450a0a', icon: '🔥' },
  ];

  const pts = cycle.map((el, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return {
      ...el,
      angle,
      x: centerX + orbitR * Math.cos(angle),
      y: centerY + orbitR * Math.sin(angle),
    };
  });

  // Vẽ 5 mũi tên cong theo chiều kim đồng hồ
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const midAngle = a.angle + Math.PI / 5;
    const ctrlR = orbitR + 24;
    const cx = centerX + ctrlR * Math.cos(midAngle);
    const cy = centerY + ctrlR * Math.sin(midAngle);

    // Điểm đầu/cuối cách tâm hình tròn nodeR + 6px
    const startAng = Math.atan2(cy - a.y, cx - a.x);
    const endAng = Math.atan2(cy - b.y, cx - b.x);
    const sx = a.x + (nodeR + 6) * Math.cos(startAng);
    const sy = a.y + (nodeR + 6) * Math.sin(startAng);
    const ex = b.x + (nodeR + 8) * Math.cos(endAng);
    const ey = b.y + (nodeR + 8) * Math.sin(endAng);

    drawCurvedArrow(ctx, sx, sy, ex, ey, cx, cy, a.color);
  }

  // Tâm vòng xoay: +30% / -20%
  drawRoundRect(ctx, centerX - 64, centerY - 28, 128, 56, 12);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.90)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#4ade80';
  ctx.fillText('Thuận khắc: +30%', centerX, centerY - 10);
  ctx.fillStyle = '#fb7185';
  ctx.fillText('Bị khắc: -20%', centerX, centerY + 11);

  // Vẽ 5 quả cầu Ngũ Hành
  for (const p of pts) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
    const orbGrad = ctx.createRadialGradient(p.x - 8, p.y - 8, 4, p.x, p.y, nodeR);
    orbGrad.addColorStop(0, p.bg);
    orbGrad.addColorStop(1, '#090714');
    ctx.fillStyle = orbGrad;
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, p.x, p.y - 6);

    ctx.font = `10px ${FONT_FAMILY}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(p.sub.toUpperCase(), p.x, p.y + 12);
    ctx.restore();
  }

  // Thanh chú thích ngắn dưới vòng ngũ hành
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText('Kim  →  Mộc  →  Thổ  →  Thủy  →  Hỏa  →  Kim', leftX + leftW / 2, panelY + panelH - 22);
  ctx.restore();

  // ============================================================================
  // KHUNG PHẢI: TỨ ĐẠI DỊ TỐ ĐẶC THÙ (LÔI, ÁM <-> QUANG, HỖN ĐỘN / HƯ KHÔNG)
  // ============================================================================
  const rightX = 526;
  const rightW = 440;

  ctx.save();
  drawRoundRect(ctx, rightX, panelY, rightW, panelH, 16);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e879f9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('TỨ ĐẠI DỊ TỐ ĐẶC THÙ', rightX + rightW / 2, panelY + 14);

  const specials = [
    {
      title: 'HỆ LÔI (THUNDER)',
      badge: '+30% vs Thủy & Kim',
      badgeColor: '#facc15',
      border: 'rgba(250, 204, 21, 0.55)',
      bg: 'rgba(113, 63, 18, 0.25)',
      lines: [
        '• Khắc chế mạnh Hệ Thủy & Hệ Kim (+30% DMG).',
        '• Thủy / Kim đánh Lôi bị giảm -20% sát thương.',
      ],
    },
    {
      title: 'ÁM  ↔  QUANG (TƯƠNG SÁT)',
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
        '• +20% sát thương chuẩn xuyên giáp • Giảm 15% DMG nhận vào.',
      ],
    },
  ];

  const cardX = rightX + 18;
  const cardW = rightW - 36;
  const cardH = 96;
  specials.forEach((sp, idx) => {
    const cy = panelY + 48 + idx * (cardH + 12);
    drawRoundRect(ctx, cardX, cy, cardW, cardH, 12);
    ctx.fillStyle = sp.bg;
    ctx.fill();
    ctx.strokeStyle = sp.border;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Title
    ctx.font = `bold 13.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.title, cardX + 14, cy + 22);

    // Pill bên phải
    ctx.font = `bold 10.5px ${FONT_FAMILY}`;
    const bw = ctx.measureText(sp.badge).width + 18;
    const bx = cardX + cardW - bw - 12;
    drawRoundRect(ctx, bx, cy + 11, bw, 22, 6);
    ctx.fillStyle = 'rgba(15, 12, 28, 0.85)';
    ctx.fill();
    ctx.strokeStyle = sp.badgeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = sp.badgeColor;
    ctx.textAlign = 'center';
    ctx.fillText(sp.badge, bx + bw / 2, cy + 22);

    // Body lines
    ctx.textAlign = 'left';
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#e2e8f0';
    sp.lines.forEach((line, li) => {
      ctx.fillText(truncateText(ctx, line, cardW - 28), cardX + 14, cy + 50 + li * 22);
    });
  });
  ctx.restore();

  await drawFooter(ctx, 'SuMi Family • Bảng Tương Khắc Ngũ Hành & Dị Tố Full HD+');
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
    ctx.fillText('CHỦ SỞ HỮU HIỆN TẠI (ĐỘC NHẤT TOÀN SERVER • 1%)', rightX + 18, ownY + 14);

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

  const rarityStyle = RARITY_STYLES[petData.rarity_key] || RARITY_STYLES.common;
  const elemMeta = ELEMENT_COLORS[petData.element] || { color: '#94a3b8', icon: '✨' };
  const petImg = await loadImageSafe(petData.image_file || `pets/${petData.pet_type}.png`, 2500, 'pets/hoa_thach_nham_nham.png');

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
  const pills = [
    { text: petData.rarity, color: rarityStyle.primary, bg: rarityStyle.bgTint },
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

  // Hộp Kỹ Năng / Nội Tại (HAX)
  const haxY = 298;
  const haxH = 156;
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
  ctx.fillText('KỸ NĂNG / NỘI TẠI ĐẶC BIỆT (HAX)', rightX + 18, haxY + 16);

  ctx.font = `bold 17px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.fillText(truncateText(ctx, petData.hax_skill, rightW - 36), rightX + 18, haxY + 40);

  ctx.font = `13.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#e2e8f0';
  const haxLines = wrapTextLines(ctx, petData.hax_description, rightW - 36, 4);
  haxLines.forEach((line, li) => {
    ctx.fillText(line, rightX + 18, haxY + 72 + li * 22);
  });
  ctx.restore();

  await drawFooter(ctx, `SuMi Family • Bách Khoa Linh Thú (${petData.rarity} • Hệ ${petData.element})`);
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}
