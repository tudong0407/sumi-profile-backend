import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, '../assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Generate default_background.png (1000x500)
function generateDefaultBackground() {
  const w = 1000, h = 500;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0a0815');
  grad.addColorStop(0.3, '#180d2e');
  grad.addColorStop(0.7, '#2a0e36');
  grad.addColorStop(1, '#0c0717');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Nebulas
  const neb1 = ctx.createRadialGradient(250, 140, 20, 250, 140, 380);
  neb1.addColorStop(0, 'rgba(236, 72, 153, 0.28)');
  neb1.addColorStop(0.6, 'rgba(147, 51, 234, 0.15)');
  neb1.addColorStop(1, 'transparent');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, w, h);

  const neb2 = ctx.createRadialGradient(850, 350, 30, 850, 350, 360);
  neb2.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
  neb2.addColorStop(0.7, 'rgba(79, 70, 229, 0.12)');
  neb2.addColorStop(1, 'transparent');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, w, h);

  // Starlight
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    const sr = Math.random() * 1.8 + 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.7 + 0.3})`;
    ctx.fill();
  }

  fs.writeFileSync(path.join(assetsDir, 'default_background.png'), canvas.toBuffer('image/png'));
  console.log('✅ Created assets/default_background.png');
}

// 2. Generate celestial_palace_pink.png (1000x500)
function generateCelestialPalaceBackground() {
  const w = 1000, h = 500;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#13091f');
  grad.addColorStop(0.4, '#2e0f38');
  grad.addColorStop(0.8, '#4a154b');
  grad.addColorStop(1, '#1b0726');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Radiant Celestial Moon
  const moonGrad = ctx.createRadialGradient(820, 110, 10, 820, 110, 220);
  moonGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  moonGrad.addColorStop(0.4, 'rgba(244, 114, 182, 0.28)');
  moonGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(820, 110, 220, 0, Math.PI * 2);
  ctx.fill();

  // Floating sakura petals
  for (let i = 0; i < 30; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const ps = Math.random() * 12 + 6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.random() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, ps, ps * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 182, 193, 0.45)';
    ctx.fill();
    ctx.restore();
  }

  fs.writeFileSync(path.join(assetsDir, 'celestial_palace_pink.png'), canvas.toBuffer('image/png'));
  console.log('✅ Created assets/celestial_palace_pink.png');
}

// Helper: Vẽ mặt hồ ly thuần vector (không bao giờ lỗi font glyph)
function drawVectorFoxAvatar(ctx, s, bgColors, earColor, innerEarColor, markColor, initialLetter) {
  const cx = s / 2;
  const cy = s / 2;

  // Nền Gradient
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, bgColors[0]);
  grad.addColorStop(0.5, bgColors[1]);
  grad.addColorStop(1, bgColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Vòng sáng hào quang
  const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 110);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);

  // Tai Trái
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy - 10);
  ctx.lineTo(cx - 45, cy - 85);
  ctx.lineTo(cx - 15, cy - 20);
  ctx.closePath();
  ctx.fillStyle = earColor;
  ctx.fill();

  // Lòng tai trái
  ctx.beginPath();
  ctx.moveTo(cx - 68, cy - 18);
  ctx.lineTo(cx - 45, cy - 68);
  ctx.lineTo(cx - 26, cy - 24);
  ctx.closePath();
  ctx.fillStyle = innerEarColor;
  ctx.fill();

  // Tai Phải
  ctx.beginPath();
  ctx.moveTo(cx + 15, cy - 20);
  ctx.lineTo(cx + 45, cy - 85);
  ctx.lineTo(cx + 80, cy - 10);
  ctx.closePath();
  ctx.fillStyle = earColor;
  ctx.fill();

  // Lòng tai phải
  ctx.beginPath();
  ctx.moveTo(cx + 26, cy - 24);
  ctx.lineTo(cx + 45, cy - 68);
  ctx.lineTo(cx + 68, cy - 18);
  ctx.closePath();
  ctx.fillStyle = innerEarColor;
  ctx.fill();

  // Mõm hồ ly trắng (White Fox Muzzle)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy + 20);
  ctx.quadraticCurveTo(cx, cy + 90, cx + 50, cy + 20);
  ctx.quadraticCurveTo(cx, cy + 40, cx - 50, cy + 20);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();

  // Mũi hồ ly (Fox Nose)
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 50);
  ctx.lineTo(cx + 6, cy + 50);
  ctx.lineTo(cx, cy + 58);
  ctx.closePath();
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();

  // Mắt hồ ly (Fox Eyes)
  ctx.save();
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Mắt trái
  ctx.beginPath();
  ctx.arc(cx - 28, cy + 20, 12, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  // Mắt phải
  ctx.beginPath();
  ctx.arc(cx + 28, cy + 20, 12, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // Vệt ấn tiên tộc trên trán (Tiara / Pearl mark)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 7, 0, Math.PI * 2);
  ctx.fillStyle = markColor;
  ctx.shadowColor = markColor;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // Chữ cái trung tâm nếu có (Chỉ dùng chữ Latinh an toàn như 'F' hoặc 'S')
  if (initialLetter) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(initialLetter, cx, cy - 18);
    ctx.restore();
  }
}

// 3. Generate fuyumi_avatar.png (256x256)
function generateFuyumiAvatar() {
  const s = 256;
  const canvas = createCanvas(s, s);
  const ctx = canvas.getContext('2d');

  drawVectorFoxAvatar(
    ctx, s,
    ['#f43f5e', '#ec4899', '#8b5cf6'],
    '#fff1f2',
    '#fb7185',
    '#ffd700',
    'F'
  );

  fs.writeFileSync(path.join(assetsDir, 'fuyumi_avatar.png'), canvas.toBuffer('image/png'));
  console.log('✅ Created assets/fuyumi_avatar.png');
}

// 4. Generate default_avatar.png (256x256)
function generateDefaultAvatar() {
  const s = 256;
  const canvas = createCanvas(s, s);
  const ctx = canvas.getContext('2d');

  drawVectorFoxAvatar(
    ctx, s,
    ['#3b82f6', '#6366f1', '#8b5cf6'],
    '#e0e7ff',
    '#a5b4fc',
    '#67e8f9',
    'S'
  );

  fs.writeFileSync(path.join(assetsDir, 'default_avatar.png'), canvas.toBuffer('image/png'));
  console.log('✅ Created assets/default_avatar.png');
}

generateDefaultBackground();
generateCelestialPalaceBackground();
generateFuyumiAvatar();
generateDefaultAvatar();
