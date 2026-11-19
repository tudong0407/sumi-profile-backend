import { createBaseCanvas, drawBackground, drawCardBorders, drawBottomBanner } from './asset_generator_base.js';

export function renderSoul(item, outputPath) {
  const { canvas, ctx } = createBaseCanvas();
  const cx = 256;
  const cy = 215;

  // 1. Nền thần thoại & Linh trận
  drawBackground(ctx, item.rarity, item.element);

  // 2. Vẽ hình tượng Chiến Hồn đặc trưng
  ctx.save();
  switch (item.item_id) {
    case 'soul_common_1': drawSoulCommon1(ctx, cx, cy); break;
    case 'soul_common_2': drawSoulCommon2(ctx, cx, cy); break;
    case 'soul_common_3': drawSoulCommon3(ctx, cx, cy); break;
    case 'soul_common_4': drawSoulCommon4(ctx, cx, cy); break;
    case 'soul_rare_1': drawSoulRare1(ctx, cx, cy); break;
    case 'soul_rare_2': drawSoulRare2(ctx, cx, cy); break;
    case 'soul_rare_3': drawSoulRare3(ctx, cx, cy); break;
    case 'soul_rare_4': drawSoulRare4(ctx, cx, cy); break;
    case 'soul_epic_1': drawSoulEpic1(ctx, cx, cy); break;
    case 'soul_epic_2': drawSoulEpic2(ctx, cx, cy); break;
    case 'soul_epic_3': drawSoulEpic3(ctx, cx, cy); break;
    case 'soul_epic_4': drawSoulEpic4(ctx, cx, cy); break;
    case 'soul_mythic_1': drawSoulMythic1(ctx, cx, cy); break;
    case 'soul_mythic_2': drawSoulMythic2(ctx, cx, cy); break;
    case 'soul_mythic_3': drawSoulMythic3(ctx, cx, cy); break;
    default: drawFallbackSoul(ctx, cx, cy); break;
  }
  ctx.restore();

  // 3. Khung viền phẩm cấp
  drawCardBorders(ctx, item.rarity, item.element);

  // 4. Thanh nhãn tên và thuộc tính
  drawBottomBanner(ctx, item.item_name, item.rarity, item.element, 'soul');

  return canvas.toBuffer('image/png');
}

// -----------------------------------------------------------------------------
// SOUL 1: Dã Lang Chiến Hồn (Common - Am)
// -----------------------------------------------------------------------------
function drawSoulCommon1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#8b5cf6';
  ctx.shadowBlur = 22;

  // Đầu sói hoang hú trăng (Howling Wolf Silhouette)
  ctx.beginPath();
  ctx.moveTo(35, 70);
  ctx.lineTo(15, 20);
  ctx.lineTo(40, -35); // Mõm sói ngước lên
  ctx.lineTo(25, -55);
  ctx.lineTo(-5, -40);
  ctx.lineTo(-20, -75); // Tai sói 1
  ctx.lineTo(-35, -45);
  ctx.lineTo(-45, -70); // Tai sói 2
  ctx.lineTo(-55, -30);
  ctx.quadraticCurveTo(-65, 30, -35, 75);
  ctx.closePath();

  const wGrad = ctx.createLinearGradient(0, -75, 0, 75);
  wGrad.addColorStop(0, '#c4b5fd');
  wGrad.addColorStop(0.5, '#6d28d9');
  wGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = wGrad;
  ctx.fill();
  ctx.strokeStyle = '#ddd6fe';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mắt sói tím rực
  ctx.beginPath();
  ctx.ellipse(-5, -30, 4, 8, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  // Khói u hồn lượn quanh chân
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(-30 + i * 15, 80 + (i % 2) * 8, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.fill();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 2: Thanh Phong Linh Hồn (Common - Moc)
// -----------------------------------------------------------------------------
function drawSoulCommon2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 22;

  // Lốc xoáy cuồng phong xanh lục (Tornado Vortex Spirit)
  for (let i = 0; i < 6; i++) {
    const y = 80 - i * 30;
    const r = 25 + i * 12;
    ctx.beginPath();
    ctx.ellipse(0, y, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? '#34d399' : '#a7f3d0';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Lá phong / lá trúc linh hồn bay lượn
  const leaves = [
    { x: -50, y: -45, rot: 0.6 },
    { x: 55, y: -20, rot: -0.4 },
    { x: -40, y: 30, rot: 1.2 },
    { x: 45, y: 55, rot: -0.8 },
    { x: 0, y: -80, rot: 0.1 }
  ];
  leaves.forEach(l => {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6ee7b7';
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 3: Linh Hồ Ấu Hồn (Common - Quang)
// -----------------------------------------------------------------------------
function drawSoulCommon3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 22;

  // Thân hồ ly con ngồi nhỏ nhắn
  ctx.beginPath();
  ctx.arc(0, 25, 42, 0, Math.PI * 2);
  const bGrad = ctx.createRadialGradient(-10, 15, 5, 0, 25, 42);
  bGrad.addColorStop(0, '#ffffff');
  bGrad.addColorStop(0.6, '#fef08a');
  bGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = bGrad;
  ctx.fill();

  // Đầu hồ ly con
  ctx.beginPath();
  ctx.arc(0, -25, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Đôi tai hồ ly trắng viền cam
  ctx.beginPath();
  ctx.moveTo(-18, -45);
  ctx.lineTo(-32, -75);
  ctx.lineTo(-8, -55);
  ctx.closePath();
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(18, -45);
  ctx.lineTo(32, -75);
  ctx.lineTo(8, -55);
  ctx.closePath();
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  // Hai mắt đen long lanh
  ctx.beginPath();
  ctx.arc(-10, -25, 4.5, 0, Math.PI * 2);
  ctx.arc(10, -25, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  // 2 Chiếc đuôi xòe bồng bềnh sau lưng
  ctx.beginPath();
  ctx.moveTo(-25, 30);
  ctx.quadraticCurveTo(-65, 0, -50, -35);
  ctx.quadraticCurveTo(-30, -10, -20, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(25, 30);
  ctx.quadraticCurveTo(65, 0, 50, -35);
  ctx.quadraticCurveTo(30, -10, 20, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 4: Man Ngưu Thú Hồn (Common - Tho)
// -----------------------------------------------------------------------------
function drawSoulCommon4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#d97706';
  ctx.shadowBlur = 22;

  // Đầu Ngưu Thần dũng mãnh
  ctx.beginPath();
  ctx.moveTo(0, 75);
  ctx.lineTo(40, 25);
  ctx.lineTo(35, -30);
  ctx.lineTo(-35, -30);
  ctx.lineTo(-40, 25);
  ctx.closePath();
  const nGrad = ctx.createLinearGradient(0, -30, 0, 75);
  nGrad.addColorStop(0, '#fef3c7');
  nGrad.addColorStop(0.5, '#b45309');
  nGrad.addColorStop(1, '#451a03');
  ctx.fillStyle = nGrad;
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Đôi sừng ngưu quặp cong uy dũng
  ctx.beginPath();
  ctx.moveTo(-35, -25);
  ctx.quadraticCurveTo(-85, -60, -65, -95);
  ctx.quadraticCurveTo(-50, -50, -25, -28);
  ctx.closePath();
  ctx.fillStyle = '#78350f';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(35, -25);
  ctx.quadraticCurveTo(85, -60, 65, -95);
  ctx.quadraticCurveTo(50, -50, 25, -28);
  ctx.closePath();
  ctx.fillStyle = '#78350f';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.stroke();

  // Vòng khuyên mũi hoàng kim
  ctx.beginPath();
  ctx.arc(0, 55, 16, 0, Math.PI * 2);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 5: Tấn Lôi Ưng Hồn (Rare - Loi)
// -----------------------------------------------------------------------------
function drawSoulRare1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 26;

  // Đại bàng sấm sét sải rộng đôi cánh (Wingspan)
  ctx.beginPath();
  // Cánh trái
  ctx.moveTo(0, 10);
  ctx.quadraticCurveTo(-60, -20, -110, -65);
  ctx.lineTo(-85, -20);
  ctx.lineTo(-100, 15);
  ctx.lineTo(-65, 30);
  // Thân & Đầu
  ctx.lineTo(0, 65); // Đuôi
  // Cánh phải
  ctx.lineTo(65, 30);
  ctx.lineTo(100, 15);
  ctx.lineTo(85, -20);
  ctx.quadraticCurveTo(60, -20, 110, -65);
  ctx.closePath();

  const eGrad = ctx.createLinearGradient(0, -65, 0, 65);
  eGrad.addColorStop(0, '#f3e8ff');
  eGrad.addColorStop(0.4, '#a855f7');
  eGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = eGrad;
  ctx.fill();
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mỏ ưng vàng sắc nhọn
  ctx.beginPath();
  ctx.moveTo(-10, -15);
  ctx.lineTo(0, -38);
  ctx.lineTo(10, -15);
  ctx.lineTo(0, -5);
  ctx.closePath();
  ctx.fillStyle = '#fde047';
  ctx.fill();

  // Tia chớp bao quanh cánh
  [-70, 70].forEach(tx => {
    ctx.beginPath();
    ctx.moveTo(tx, -30);
    ctx.lineTo(tx + 15, -10);
    ctx.lineTo(tx - 10, 10);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 6: Minh Giới U Hồn (Rare - Am)
// -----------------------------------------------------------------------------
function drawSoulRare2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 26;

  // Áo choàng u linh trôi lơ lửng (Specter Cloak)
  ctx.beginPath();
  ctx.moveTo(0, -75);
  ctx.bezierCurveTo(45, -70, 55, -20, 50, 45);
  ctx.bezierCurveTo(30, 80, -30, 80, -50, 45);
  ctx.bezierCurveTo(-55, -20, -45, -70, 0, -75);
  ctx.closePath();

  const uGrad = ctx.createLinearGradient(0, -75, 0, 80);
  uGrad.addColorStop(0, '#164e63');
  uGrad.addColorStop(0.5, '#0e7490');
  uGrad.addColorStop(1, '#083344');
  ctx.fillStyle = uGrad;
  ctx.fill();
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mặt u ám không đáy & 2 Đốm mắt u hỏa lam
  ctx.beginPath();
  ctx.ellipse(0, -30, 24, 28, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#030712';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-8, -30, 4, 0, Math.PI * 2);
  ctx.arc(8, -30, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#67e8f9';
  ctx.fill();

  // Tua u hồn bồng bềnh dưới chân
  for (let i = 0; i < 4; i++) {
    const x = -30 + i * 20;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.quadraticCurveTo(x + 10, 75, x, 95);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 7: Cuồng Bạo Hùng Hồn (Rare - Tho)
// -----------------------------------------------------------------------------
function drawSoulRare3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ea580c';
  ctx.shadowBlur = 26;

  // Đầu gấu cuồng nộ gầm thét
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  const hGrad = ctx.createRadialGradient(-10, -10, 10, 0, 0, 60);
  hGrad.addColorStop(0, '#fdba74');
  hGrad.addColorStop(0.5, '#c2410c');
  hGrad.addColorStop(1, '#431407');
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.strokeStyle = '#fed7aa';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Đôi tai gấu tròn
  ctx.beginPath();
  ctx.arc(-45, -45, 18, 0, Math.PI * 2);
  ctx.arc(45, -45, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#9a3412';
  ctx.fill();
  ctx.strokeStyle = '#fed7aa';
  ctx.stroke();

  // Mõm gấu há to & Răng nanh dữ tợn
  ctx.beginPath();
  ctx.ellipse(0, 20, 28, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  // 4 Nanh nhọn hoắt
  [-12, -4, 4, 12].forEach(fx => {
    ctx.beginPath();
    ctx.moveTo(fx, 12);
    ctx.lineTo(fx + 2, 24);
    ctx.lineTo(fx - 2, 24);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  // Vết cào móng vuốt đỏ rực ở phía trước
  [-35, 0, 35].forEach((cx, idx) => {
    ctx.beginPath();
    ctx.moveTo(cx - 10, 60);
    ctx.lineTo(cx + 10, 95);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 8: Thải Điệp Mộng Hồn (Rare - Moc)
// -----------------------------------------------------------------------------
function drawSoulRare4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 26;

  // 4 Cánh Bướm Mộng Huyền Áo (Butterfly Wings)
  const drawWing = (angle, scaleX, scaleY, color1, color2) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(45, -80, 110, -50, 90, 0);
    ctx.bezierCurveTo(80, 40, 30, 20, 0, 0);
    ctx.closePath();
    const wGrad = ctx.createLinearGradient(0, -60, 90, 0);
    wGrad.addColorStop(0, color1);
    wGrad.addColorStop(1, color2);
    ctx.fillStyle = wGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  drawWing(-0.35, 1, 1, '#fbcfe8', '#a855f7');
  drawWing(Math.PI + 0.35, -1, 1, '#fbcfe8', '#a855f7');
  drawWing(0.5, 0.75, 0.75, '#67e8f9', '#34d399');
  drawWing(Math.PI - 0.5, -0.75, 0.75, '#67e8f9', '#34d399');

  // Thân bướm ngọc bích
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 36, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Đôi râu mộng điệp
  ctx.beginPath();
  ctx.moveTo(0, -35);
  ctx.quadraticCurveTo(-25, -65, -35, -55);
  ctx.moveTo(0, -35);
  ctx.quadraticCurveTo(25, -65, 35, -55);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 9: Thương Khung Thần Long Hồn (Epic - Quang)
// -----------------------------------------------------------------------------
function drawSoulEpic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 30;

  // Thân Thần Long uốn lượn hình chữ S uyển chuyển
  ctx.beginPath();
  ctx.moveTo(-75, 70);
  ctx.bezierCurveTo(-110, -10, -20, -70, 0, -20);
  ctx.bezierCurveTo(20, 20, 95, 60, 80, -45);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Vảy rồng hoàng kim lấp lánh
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Đầu Rồng Thần uy nghiêm trên đỉnh phải
  ctx.beginPath();
  ctx.arc(80, -55, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#ca8a04';
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Sừng rồng & Râu rồng
  ctx.beginPath();
  ctx.moveTo(85, -75);
  ctx.lineTo(105, -105);
  ctx.moveTo(70, -75);
  ctx.lineTo(60, -100);
  ctx.strokeStyle = '#fef9c3';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Viên Long Châu rực sáng trước ngực rồng
  ctx.beginPath();
  ctx.arc(-15, -15, 18, 0, Math.PI * 2);
  const pGrad = ctx.createRadialGradient(-18, -18, 3, -15, -15, 18);
  pGrad.addColorStop(0, '#ffffff');
  pGrad.addColorStop(0.4, '#fde047');
  pGrad.addColorStop(1, '#ea580c');
  ctx.fillStyle = pGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 10: Cửu U Minh Xà Hồn (Epic - Am)
// -----------------------------------------------------------------------------
function drawSoulEpic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 30;

  // Thân Xà Cửu U quấn tròn hình xoắn ốc
  ctx.beginPath();
  ctx.arc(0, 15, 65, 0.4 * Math.PI, 2.2 * Math.PI);
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 12;
  ctx.stroke();

  // Đầu rắn Hổ Mang Cửu U bành mang uy hiếp
  ctx.beginPath();
  ctx.ellipse(0, -55, 36, 42, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#065f46';
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Đôi mắt xà độc màu hoàng kim
  ctx.beginPath();
  ctx.arc(-14, -62, 5, 0, Math.PI * 2);
  ctx.arc(14, -62, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();

  // Lưỡi rắn chẻ đôi màu đỏ thắm
  ctx.beginPath();
  ctx.moveTo(0, -35);
  ctx.lineTo(0, -10);
  ctx.lineTo(-8, 5);
  ctx.moveTo(0, -10);
  ctx.lineTo(8, 5);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 11: Thánh Quang Kỳ Lân Hồn (Epic - Quang)
// -----------------------------------------------------------------------------
function drawSoulEpic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 30;

  // Đầu Kỳ Lân Thần Thú uy dũng
  ctx.beginPath();
  ctx.arc(0, 10, 52, 0, Math.PI * 2);
  const qGrad = ctx.createRadialGradient(-10, -5, 5, 0, 10, 52);
  qGrad.addColorStop(0, '#ffffff');
  qGrad.addColorStop(0.4, '#fef08a');
  qGrad.addColorStop(0.8, '#f59e0b');
  qGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = qGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Chiếc sừng ngọc Kỳ Lân duy nhất vươn thẳng lên trời
  ctx.beginPath();
  ctx.moveTo(0, -35);
  ctx.lineTo(12, -105);
  ctx.lineTo(-12, -105);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Bờm lửa Thánh Quang xòe bung quanh đầu
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI * 0.8 + (i * Math.PI * 1.6) / 7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 52, Math.sin(ang) * 52);
    ctx.lineTo(Math.cos(ang) * 85, Math.sin(ang) * 85);
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 12: Huyết Ngục Ma Lang Hồn (Epic - Hoa)
// -----------------------------------------------------------------------------
function drawSoulEpic4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 32;

  // Đầu Ma Lang Huyết Ngục hung tợn
  ctx.beginPath();
  ctx.moveTo(40, 75);
  ctx.lineTo(20, 15);
  ctx.lineTo(45, -45);
  ctx.lineTo(25, -65);
  ctx.lineTo(-5, -50);
  ctx.lineTo(-25, -85); // Sừng quỷ ma lang
  ctx.lineTo(-40, -55);
  ctx.lineTo(-55, -80);
  ctx.lineTo(-65, -35);
  ctx.quadraticCurveTo(-75, 35, -40, 80);
  ctx.closePath();

  const mlGrad = ctx.createLinearGradient(0, -85, 0, 80);
  mlGrad.addColorStop(0, '#f87171');
  mlGrad.addColorStop(0.5, '#dc2626');
  mlGrad.addColorStop(1, '#450a0a');
  ctx.fillStyle = mlGrad;
  ctx.fill();
  ctx.strokeStyle = '#fecaca';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mắt đỏ ngầu rực lửa
  ctx.beginPath();
  ctx.ellipse(-10, -35, 6, 12, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  // Khói lửa dung nham bốc lên
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(-40 + i * 16, 85, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ea580c';
    ctx.fill();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 13: « Cửu Vĩ Thiên Tiên Hồn » (Mythic - Hon Don)
// -----------------------------------------------------------------------------
function drawSoulMythic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Hào quang Cửu Vĩ Chí Tôn bừng sáng
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 40;

  // 9 Đuôi Tiên Hồ xòe rực rỡ như cầu vồng hồng hoang
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI * 0.9 + (i * Math.PI * 1.8) / 8;
    ctx.save();
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(30, -50, 0, -125);
    ctx.quadraticCurveTo(-30, -50, 0, 30);
    ctx.closePath();

    const tGrad = ctx.createLinearGradient(0, 30, 0, -125);
    tGrad.addColorStop(0, '#fbcfe8');
    tGrad.addColorStop(0.5, '#f43f5e');
    tGrad.addColorStop(1, '#ff0055');
    ctx.fillStyle = tGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // Thân và Mặt Nạ Cửu Vĩ Thiên Tiên ở trung tâm
  ctx.beginPath();
  ctx.ellipse(0, 10, 38, 48, 0, 0, Math.PI * 2);
  const fGrad = ctx.createRadialGradient(-10, 0, 5, 0, 10, 48);
  fGrad.addColorStop(0, '#ffffff');
  fGrad.addColorStop(0.5, '#fdf2f8');
  fGrad.addColorStop(1, '#f472b6');
  ctx.fillStyle = fGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Đôi tai hồ ly thiên tiên
  ctx.beginPath();
  ctx.moveTo(-20, -32);
  ctx.lineTo(-35, -70);
  ctx.lineTo(-10, -45);
  ctx.closePath();
  ctx.fillStyle = '#ff0055';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(20, -32);
  ctx.lineTo(35, -70);
  ctx.lineTo(10, -45);
  ctx.closePath();
  ctx.fillStyle = '#ff0055';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // Hoa văn Chu Sa Đỏ hoàng gia giữa trán
  ctx.beginPath();
  ctx.ellipse(0, -10, 6, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#dc2626';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 14: « Thái Sơ Thời Không Ma Thần Hồn » (Mythic - Khong Gian)
// -----------------------------------------------------------------------------
function drawSoulMythic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#818cf8';
  ctx.shadowBlur = 40;

  // Vòng Đồng Hồ Thời Gian Thiên Thể Cổ Đại (Cosmic Clock Wheel)
  ctx.beginPath();
  ctx.arc(0, 0, 95, 0, Math.PI * 2);
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 12 Vạch số La Mã Thời Không
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 82, Math.sin(ang) * 82);
    ctx.lineTo(Math.cos(ang) * 94, Math.sin(ang) * 94);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Hố Đen Thời Không Vặn Vẹo ở trung tâm
  const bhGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 60);
  bhGrad.addColorStop(0, '#000000');
  bhGrad.addColorStop(0.5, '#312e81');
  bhGrad.addColorStop(0.8, '#6366f1');
  bhGrad.addColorStop(1, '#a855f7');
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.fillStyle = bhGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Kim Đồng Hồ Thái Sơ chỉ vĩnh hằng
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -52); // Kim dài
  ctx.moveTo(0, 0);
  ctx.lineTo(38, 0); // Kim ngắn
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// SOUL 15: « Luân Hồi Bất Diệt Chiến Hồn » (Mythic - Luan Hoi)
// -----------------------------------------------------------------------------
function drawSoulMythic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 40;

  // Đại Luân Hồi Bàn (The Great Samsara Wheel of Reincarnation)
  ctx.beginPath();
  ctx.arc(0, 0, 95, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 6;
  ctx.stroke();

  // 6 Căm Bánh Xe Tượng Trưng Cho Lục Đạo Luân Hồi (6 Realms)
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang) * 95, Math.sin(ang) * 95);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Biểu tượng lục đạo trên mỗi căm bánh xe
    const sx = Math.cos(ang) * 72;
    const sy = Math.sin(ang) * 72;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  // Tượng Thần Chiến Hồn Bất Diệt ở tâm Luân Hồi Bàn
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  const sGrad = ctx.createRadialGradient(-5, -5, 5, 0, 0, 36);
  sGrad.addColorStop(0, '#ffffff');
  sGrad.addColorStop(0.4, '#f472b6');
  sGrad.addColorStop(0.8, '#a855f7');
  sGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = sGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Ngọn Lửa Nghiệp Báo Bất Diệt bùng cháy trên đỉnh
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.quadraticCurveTo(15, -65, 0, -85);
  ctx.quadraticCurveTo(-15, -65, 0, -36);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();

  ctx.restore();
}

function drawFallbackSoul(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🦊', 0, 0);
  ctx.restore();
}
