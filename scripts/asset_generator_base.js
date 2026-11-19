import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

// Register Fonts
try {
  const boldFont = path.join(FONTS_DIR, 'BeVietnamPro-Bold.ttf');
  const semiBoldFont = path.join(FONTS_DIR, 'BeVietnamPro-SemiBold.ttf');
  const regularFont = path.join(FONTS_DIR, 'BeVietnamPro-Regular.ttf');

  if (fs.existsSync(boldFont)) GlobalFonts.registerFromPath(boldFont, 'Be Vietnam Pro');
  if (fs.existsSync(semiBoldFont)) GlobalFonts.registerFromPath(semiBoldFont, 'Be Vietnam Pro');
  if (fs.existsSync(regularFont)) GlobalFonts.registerFromPath(regularFont, 'Be Vietnam Pro');
} catch (e) {
  console.warn('[Font] Could not register local fonts:', e.message);
}

export const FONT_FAMILY = '"Be Vietnam Pro", sans-serif';

// Color definitions for Rarity
export const RARITY_THEMES = {
  'Pham Pham': {
    primary: '#94a3b8',
    secondary: '#475569',
    glow: 'rgba(148, 163, 184, 0.4)',
    border: '#cbd5e1',
    bannerBg: ['#1e293b', '#0f172a'],
    stars: 1,
    tag: 'PHÀM',
    tagColor: '#94a3b8'
  },
  'Linh Pham': {
    primary: '#38bdf8',
    secondary: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.55)',
    border: '#7dd3fc',
    bannerBg: ['#0c4a6e', '#082f49'],
    stars: 2,
    tag: 'LINH',
    tagColor: '#38bdf8'
  },
  'Tien Pham': {
    primary: '#c084fc',
    secondary: '#9333ea',
    glow: 'rgba(192, 132, 252, 0.65)',
    border: '#e879f9',
    bannerBg: ['#581c87', '#3b0764'],
    stars: 3,
    tag: 'TIÊN',
    tagColor: '#f472b6'
  },
  'Than Thoai': {
    primary: '#ffd700',
    secondary: '#ff0055',
    glow: 'rgba(255, 215, 0, 0.8)',
    border: '#fbbf24',
    bannerBg: ['#831843', '#450a0a'],
    stars: 5,
    tag: 'THẦN',
    tagColor: '#ffd700'
  }
};

// Color definitions for Elements
export const ELEMENT_THEMES = {
  'Kim': { color: '#f8fafc', accent: '#ffd700', aura: 'rgba(254, 240, 138, 0.35)', icon: '⚔️' },
  'Moc': { color: '#34d399', accent: '#059669', aura: 'rgba(52, 211, 153, 0.35)', icon: '🍃' },
  'Thuy': { color: '#38bdf8', accent: '#0284c7', aura: 'rgba(56, 189, 248, 0.35)', icon: '💧' },
  'Hoa': { color: '#f87171', accent: '#ea580c', aura: 'rgba(248, 113, 113, 0.4)', icon: '🔥' },
  'Tho': { color: '#fbbf24', accent: '#b45309', aura: 'rgba(251, 191, 36, 0.35)', icon: '🪨' },
  'Loi': { color: '#a855f7', accent: '#6366f1', aura: 'rgba(168, 85, 247, 0.45)', icon: '⚡' },
  'Am': { color: '#a78bfa', accent: '#4c1d95', aura: 'rgba(124, 58, 237, 0.4)', icon: '🌑' },
  'Quang': { color: '#fef08a', accent: '#f59e0b', aura: 'rgba(254, 240, 138, 0.45)', icon: '✨' },
  'Hon Don': { color: '#f43f5e', accent: '#fbbf24', aura: 'rgba(244, 63, 94, 0.45)', icon: '🌌' },
  'Khong Gian': { color: '#818cf8', accent: '#38bdf8', aura: 'rgba(129, 140, 248, 0.45)', icon: '⏳' },
  'Luan Hoi': { color: '#ec4899', accent: '#a855f7', aura: 'rgba(236, 72, 153, 0.45)', icon: '🔄' }
};

export function createBaseCanvas() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function drawRoundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Vẽ nền thần thoại huyền ảo với đài trận pháp bát quái và hạt linh khí
 */
export function drawBackground(ctx, rarity, element) {
  const rTheme = RARITY_THEMES[rarity] || RARITY_THEMES['Pham Pham'];
  const eTheme = ELEMENT_THEMES[element] || ELEMENT_THEMES['Kim'];

  // 1. Dark Gradient Base
  const bgGrad = ctx.createRadialGradient(256, 230, 20, 256, 230, 360);
  bgGrad.addColorStop(0, '#111827');
  bgGrad.addColorStop(0.5, '#0b0f19');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Elemental Ambient Aura in Center
  const auraGrad = ctx.createRadialGradient(256, 230, 10, 256, 230, 200);
  auraGrad.addColorStop(0, eTheme.aura);
  auraGrad.addColorStop(0.5, rTheme.glow);
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(0, 0, 512, 512);

  // 3. Sacred Celestial Circle / Pedestal (Bát Quái Đồ Đằng)
  ctx.save();
  ctx.translate(256, 230);

  // Vòng ngoài cùng
  ctx.beginPath();
  ctx.arc(0, 0, 175, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Vòng răng cưa linh trận
  ctx.beginPath();
  ctx.arc(0, 0, 160, 0, Math.PI * 2);
  ctx.strokeStyle = rTheme.primary;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;

  // 8 tia Bát Quái
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 140, Math.sin(angle) * 140);
    ctx.lineTo(Math.cos(angle) * 170, Math.sin(angle) * 170);
    ctx.strokeStyle = eTheme.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Vòng hào quang bên trong
  ctx.beginPath();
  ctx.arc(0, 0, 125, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // 4. Sparkles / Floating Mana Motes
  const rngSeed = (element.charCodeAt(0) * 17 + rarity.length * 23) % 100;
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const angle = (i * 15 + rngSeed) * (Math.PI / 180);
    const dist = 50 + ((i * 37 + rngSeed) % 130);
    const sx = 256 + Math.cos(angle) * dist;
    const sy = 230 + Math.sin(angle) * dist;
    const rad = 1.0 + ((i % 4) * 0.8);
    const alpha = 0.3 + ((i % 5) * 0.14);

    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fillStyle = eTheme.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = rTheme.primary;
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Vẽ khung viền cổ phong hoàng kim / tiên hiệp bao quanh 512x512
 */
export function drawCardBorders(ctx, rarity, element) {
  const rTheme = RARITY_THEMES[rarity] || RARITY_THEMES['Pham Pham'];
  const eTheme = ELEMENT_THEMES[element] || ELEMENT_THEMES['Kim'];

  ctx.save();
  // Khung viền ngoài
  drawRoundRect(ctx, 12, 12, 488, 488, 18);
  const borderGrad = ctx.createLinearGradient(12, 12, 500, 500);
  borderGrad.addColorStop(0, rTheme.primary);
  borderGrad.addColorStop(0.5, eTheme.color);
  borderGrad.addColorStop(1, rTheme.secondary);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = rTheme.glow;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Viền phụ mỏng bên trong
  drawRoundRect(ctx, 18, 18, 476, 476, 14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 4 góc hoa văn cổ (Corner Filigree Accents)
  const cornerSize = 24;
  const corners = [
    { x: 18, y: 18, dx: 1, dy: 1 },
    { x: 494, y: 18, dx: -1, dy: 1 },
    { x: 18, y: 494, dx: 1, dy: -1 },
    { x: 494, y: 494, dx: -1, dy: -1 }
  ];

  corners.forEach(c => {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + c.dy * cornerSize);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x + c.dx * cornerSize, c.y);
    ctx.strokeStyle = rTheme.primary;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Điểm ngọc nhỏ ở góc
    ctx.beginPath();
    ctx.arc(c.x + c.dx * 7, c.y + c.dy * 7, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = eTheme.accent;
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Vẽ thanh nhãn vật phẩm dưới chân ảnh (Bottom Title & Details Banner)
 */
export function drawBottomBanner(ctx, itemName, rarity, element, itemType) {
  const rTheme = RARITY_THEMES[rarity] || RARITY_THEMES['Pham Pham'];
  const eTheme = ELEMENT_THEMES[element] || ELEMENT_THEMES['Kim'];

  const bx = 28;
  const by = 432;
  const bw = 456;
  const bh = 56;

  ctx.save();

  // 1. Nền Banner
  drawRoundRect(ctx, bx, by, bw, bh, 10);
  const bannerBg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bannerBg.addColorStop(0, rTheme.bannerBg[0]);
  bannerBg.addColorStop(1, rTheme.bannerBg[1]);
  ctx.fillStyle = bannerBg;
  ctx.fill();

  // Viền phát sáng banner
  ctx.strokeStyle = rTheme.primary;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = rTheme.glow;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 2. Pill Hệ Ngũ Hành (Bên trái)
  const pillX = bx + 12;
  const pillY = by + 12;
  const pillW = 64;
  const pillH = 32;
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.strokeStyle = eTheme.accent;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = eTheme.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${eTheme.icon} ${element}`, pillX + pillW / 2, pillY + pillH / 2);

  // 3. Tên Vật Phẩm (Ở giữa)
  const cleanName = itemName.replace(/[«»]/g, '').trim();
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.shadowColor = rTheme.glow;
  ctx.shadowBlur = 6;
  ctx.fillText(cleanName, bx + 88, by + 23);
  ctx.shadowBlur = 0;

  // 4. Rarity Stars & Tagline (Hàng dưới của tên)
  ctx.font = `11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = rTheme.tagColor;
  let starsText = '★'.repeat(rTheme.stars);
  const typeText = itemType === 'weapon' ? 'Vũ Khí' : itemType === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn';
  ctx.fillText(`${rarity} • ${typeText}  ${starsText}`, bx + 88, by + 42);

  // 5. Huy hiệu Phẩm cấp bên phải
  const sealX = bx + bw - 44;
  const sealY = by + bh / 2;
  ctx.beginPath();
  ctx.arc(sealX, sealY, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();
  ctx.strokeStyle = rTheme.primary;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = rTheme.tagColor;
  ctx.textAlign = 'center';
  ctx.fillText(rTheme.tag, sealX, sealY);

  ctx.restore();
}
