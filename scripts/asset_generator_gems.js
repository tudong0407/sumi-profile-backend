import { createBaseCanvas, drawBackground, drawCardBorders, drawBottomBanner } from './asset_generator_base.js';

export function renderGem(item, outputPath) {
  const { canvas, ctx } = createBaseCanvas();
  const cx = 256;
  const cy = 215;

  // 1. Nền thần thoại & Linh trận
  drawBackground(ctx, item.rarity, item.element);

  // 2. Vẽ hình tượng Bảo Ngọc đặc trưng
  ctx.save();
  switch (item.item_id) {
    case 'gem_common_1': drawGemCommon1(ctx, cx, cy); break;
    case 'gem_common_2': drawGemCommon2(ctx, cx, cy); break;
    case 'gem_common_3': drawGemCommon3(ctx, cx, cy); break;
    case 'gem_common_4': drawGemCommon4(ctx, cx, cy); break;
    case 'gem_rare_1': drawGemRare1(ctx, cx, cy); break;
    case 'gem_rare_2': drawGemRare2(ctx, cx, cy); break;
    case 'gem_rare_3': drawGemRare3(ctx, cx, cy); break;
    case 'gem_rare_4': drawGemRare4(ctx, cx, cy); break;
    case 'gem_epic_1': drawGemEpic1(ctx, cx, cy); break;
    case 'gem_epic_2': drawGemEpic2(ctx, cx, cy); break;
    case 'gem_epic_3': drawGemEpic3(ctx, cx, cy); break;
    case 'gem_epic_4': drawGemEpic4(ctx, cx, cy); break;
    case 'gem_mythic_1': drawGemMythic1(ctx, cx, cy); break;
    case 'gem_mythic_2': drawGemMythic2(ctx, cx, cy); break;
    case 'gem_mythic_3': drawGemMythic3(ctx, cx, cy); break;
    default: drawFallbackGem(ctx, cx, cy); break;
  }
  ctx.restore();

  // 3. Khung viền phẩm cấp
  drawCardBorders(ctx, item.rarity, item.element);

  // 4. Thanh nhãn tên và thuộc tính
  drawBottomBanner(ctx, item.item_name, item.rarity, item.element, 'gem');

  return canvas.toBuffer('image/png');
}

// -----------------------------------------------------------------------------
// GEM 1: Thanh Linh Ngọc (Common - Moc)
// -----------------------------------------------------------------------------
function drawGemCommon1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 20;

  // Giọt ngọc bích Thanh Linh thanh khiết
  ctx.beginPath();
  ctx.moveTo(0, -90);
  ctx.bezierCurveTo(70, -30, 80, 50, 0, 95);
  ctx.bezierCurveTo(-80, 50, -70, -30, 0, -90);
  ctx.closePath();

  const jGrad = ctx.createRadialGradient(-15, -10, 5, 0, 10, 85);
  jGrad.addColorStop(0, '#d1fae5');
  jGrad.addColorStop(0.3, '#34d399');
  jGrad.addColorStop(0.8, '#059669');
  jGrad.addColorStop(1, '#064e3b');
  ctx.fillStyle = jGrad;
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Vệt sáng phản chiếu ánh ngọc
  ctx.beginPath();
  ctx.ellipse(-25, -20, 14, 38, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();

  // Móc bạc quấn đầu giọt ngọc
  ctx.beginPath();
  ctx.arc(0, -95, 14, 0, Math.PI * 2);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 2: Hỏa Tinh Thạch (Common - Hoa)
// -----------------------------------------------------------------------------
function drawGemCommon2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 22;

  // Khối tinh thể lửa giác cắt góc cạnh (Faceted Fire Gem)
  ctx.beginPath();
  ctx.moveTo(0, -95);
  ctx.lineTo(75, -45);
  ctx.lineTo(85, 35);
  ctx.lineTo(0, 95);
  ctx.lineTo(-85, 35);
  ctx.lineTo(-75, -45);
  ctx.closePath();

  const fGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 90);
  fGrad.addColorStop(0, '#fef08a');
  fGrad.addColorStop(0.4, '#ea580c');
  fGrad.addColorStop(0.8, '#dc2626');
  fGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = fGrad;
  ctx.fill();
  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Các đường giác cắt bên trong (Facets)
  const facets = [
    [0, -95, 0, 0],
    [75, -45, 0, 0],
    [85, 35, 0, 0],
    [0, 95, 0, 0],
    [-85, 35, 0, 0],
    [-75, -45, 0, 0]
  ];
  facets.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Tàn lửa bay lên
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const dist = 95 + (i % 3) * 15;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 3: Hoàng Thổ Bích (Common - Tho)
// -----------------------------------------------------------------------------
function drawGemCommon3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#d97706';
  ctx.shadowBlur = 20;

  // Vòng ngọc bích cổ hình đồng xu tròn (Bi Disc)
  ctx.beginPath();
  ctx.arc(0, 0, 85, 0, Math.PI * 2);
  const bGrad = ctx.createRadialGradient(-10, -10, 15, 0, 0, 85);
  bGrad.addColorStop(0, '#fde68a');
  bGrad.addColorStop(0.5, '#d97706');
  bGrad.addColorStop(0.9, '#92400e');
  bGrad.addColorStop(1, '#451a03');
  ctx.fillStyle = bGrad;
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Lỗ tròn ở tâm ngọc bích
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0f19';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Vân mây cổ khắc trên ngọc bích
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.arc(52, 0, 14, 0, Math.PI);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 4: Lam Thủy Châu (Common - Thuy)
// -----------------------------------------------------------------------------
function drawGemCommon4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 22;

  // Quả cầu Lam Thủy tròn sáng trong vắt
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  const wGrad = ctx.createRadialGradient(-25, -25, 10, 0, 0, 78);
  wGrad.addColorStop(0, '#ffffff');
  wGrad.addColorStop(0.25, '#7dd3fc');
  wGrad.addColorStop(0.7, '#0284c7');
  wGrad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = wGrad;
  ctx.fill();
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Vòng gợn sóng nước xoay quanh
  ctx.beginPath();
  ctx.ellipse(0, 0, 98, 32, -0.3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Bong bóng nước nhỏ
  [
    { x: -55, y: -65, r: 8 },
    { x: 60, y: -45, r: 6 },
    { x: -65, y: 40, r: 10 },
    { x: 55, y: 55, r: 7 }
  ].forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
    ctx.fill();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 5: Huyền Quy Hộ Tâm Kính (Rare - Thuy)
// -----------------------------------------------------------------------------
function drawGemRare1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 22;

  // Khung gương bát giác Huyền Quy (Bronze & Jade Mirror Frame)
  ctx.beginPath();
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const ang = (i * Math.PI * 2) / sides;
    const x = Math.cos(ang) * 90;
    const y = Math.sin(ang) * 90;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mặt gương nước ngọc lam
  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  const mGrad = ctx.createRadialGradient(-15, -15, 8, 0, 0, 68);
  mGrad.addColorStop(0, '#e0f2fe');
  mGrad.addColorStop(0.3, '#38bdf8');
  mGrad.addColorStop(0.8, '#0891b2');
  mGrad.addColorStop(1, '#164e63');
  ctx.fillStyle = mGrad;
  ctx.fill();
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hoa văn mai rùa Huyền Quy ở tâm
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    const x = Math.cos(ang) * 32;
    const y = Math.sin(ang) * 32;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#cffafe';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 6: Phù Dung Lưu Ly Bảo Ngọc (Rare - Moc)
// -----------------------------------------------------------------------------
function drawGemRare2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 22;

  // 8 Cánh hoa Phù Dung chạm khắc từ lưu ly hồng ngọc
  const petalCount = 8;
  for (let i = 0; i < petalCount; i++) {
    const ang = (i * Math.PI * 2) / petalCount;
    ctx.save();
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(28, -50, 0, -85);
    ctx.quadraticCurveTo(-28, -50, 0, 0);
    ctx.closePath();

    const pGrad = ctx.createLinearGradient(0, 0, 0, -85);
    pGrad.addColorStop(0, '#fdf2f8');
    pGrad.addColorStop(0.4, '#f472b6');
    pGrad.addColorStop(1, '#db2777');
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // Nhụy hoa ngọc bích xanh mộc ở tâm
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  const cGrad = ctx.createRadialGradient(-5, -5, 3, 0, 0, 26);
  cGrad.addColorStop(0, '#ffffff');
  cGrad.addColorStop(0.3, '#6ee7b7');
  cGrad.addColorStop(1, '#059669');
  ctx.fillStyle = cGrad;
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 7: Tử Kim Thần Thuẫn Thạch (Rare - Kim)
// -----------------------------------------------------------------------------
function drawGemRare3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 24;

  // Hình khiên Tử Kim (Shield-cut Amethyst)
  ctx.beginPath();
  ctx.moveTo(0, -90);
  ctx.lineTo(75, -60);
  ctx.lineTo(65, 35);
  ctx.quadraticCurveTo(35, 75, 0, 95);
  ctx.quadraticCurveTo(-35, 75, -65, 35);
  ctx.lineTo(-75, -60);
  ctx.closePath();

  const sGrad = ctx.createRadialGradient(0, -10, 10, 0, 0, 90);
  sGrad.addColorStop(0, '#f3e8ff');
  sGrad.addColorStop(0.3, '#c084fc');
  sGrad.addColorStop(0.7, '#7e22ce');
  sGrad.addColorStop(1, '#3b0764');
  ctx.fillStyle = sGrad;
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Biểu tượng khiên thánh hộ mệnh bên trong
  ctx.beginPath();
  ctx.moveTo(0, -65);
  ctx.lineTo(45, -45);
  ctx.lineTo(40, 20);
  ctx.quadraticCurveTo(20, 50, 0, 68);
  ctx.quadraticCurveTo(-20, 50, -40, 20);
  ctx.lineTo(-45, -45);
  ctx.closePath();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 8: Bích Hải Triều Sinh Châu (Rare - Thuy)
// -----------------------------------------------------------------------------
function drawGemRare4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#0284c7';
  ctx.shadowBlur = 24;

  // Quả cầu đại dương ngọc lam
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  const oGrad = ctx.createRadialGradient(-20, -20, 10, 0, 0, 80);
  oGrad.addColorStop(0, '#e0f2fe');
  oGrad.addColorStop(0.3, '#38bdf8');
  oGrad.addColorStop(0.7, '#0284c7');
  oGrad.addColorStop(1, '#075985');
  ctx.fillStyle = oGrad;
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Cơn sóng triều dâng (Tidal Wave) cuộn tròn bên trong
  ctx.beginPath();
  ctx.moveTo(-60, 20);
  ctx.bezierCurveTo(-20, -50, 30, -50, 50, -20);
  ctx.bezierCurveTo(25, -15, 10, 10, -30, 45);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Bọt sóng ngọc bích
  for (let i = 0; i < 6; i++) {
    const x = -30 + i * 14;
    const y = -35 + Math.sin(i) * 12;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 9: Cửu Tiêu Bất Diệt Ngọc (Epic - Kim)
// -----------------------------------------------------------------------------
function drawGemEpic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 28;

  // Ngôi sao kim cương 8 cánh Bất Diệt (8-pointed Diamond Star)
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 95 : 42;
    const ang = (i * Math.PI) / 8;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const dGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 95);
  dGrad.addColorStop(0, '#ffffff');
  dGrad.addColorStop(0.25, '#fef08a');
  dGrad.addColorStop(0.65, '#eab308');
  dGrad.addColorStop(1, '#854d0e');
  ctx.fillStyle = dGrad;
  ctx.fill();
  ctx.strokeStyle = '#fef9c3';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Tia sáng xuyên không chiếu tỏa 4 hướng
  const crossRays = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  crossRays.forEach(ang => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang) * 125, Math.sin(ang) * 125);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 10: Vạn Niên Hàn Băng Châu (Epic - Thuy)
// -----------------------------------------------------------------------------
function drawGemEpic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 28;

  // Quả cầu Băng Vạn Niên
  ctx.beginPath();
  ctx.arc(0, 0, 82, 0, Math.PI * 2);
  const iGrad = ctx.createRadialGradient(-20, -20, 10, 0, 0, 82);
  iGrad.addColorStop(0, '#ffffff');
  iGrad.addColorStop(0.3, '#67e8f9');
  iGrad.addColorStop(0.7, '#0891b2');
  iGrad.addColorStop(1, '#164e63');
  ctx.fillStyle = iGrad;
  ctx.fill();
  ctx.strokeStyle = '#cffafe';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Hoa tuyết 6 cánh fractal bên trong khối băng
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    ctx.save();
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -65);
    ctx.moveTo(0, -35);
    ctx.lineTo(18, -48);
    ctx.moveTo(0, -35);
    ctx.lineTo(-18, -48);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 11: Thái Cực Bát Quái Ngọc Bội (Epic - Quang)
// -----------------------------------------------------------------------------
function drawGemEpic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 28;

  // Vòng ngoài Bát Quái bằng hoàng kim
  ctx.beginPath();
  ctx.arc(0, 0, 85, 0, Math.PI * 2);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 8;
  ctx.stroke();

  // 8 Quẻ Bát Quái
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.rect(-10, -82, 20, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();
  }

  // Vòng Thái Cực Âm Dương ở trung tâm (Đường kính 140)
  const r = 70;
  // Nửa Dương (Trắng)
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Nửa Âm (Đen)
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.arc(0, -r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true);
  ctx.arc(0, r / 2, r / 2, -Math.PI / 2, Math.PI / 2, false);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  // Chấm Mắt Âm Dương
  ctx.beginPath();
  ctx.arc(0, -r / 2, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, r / 2, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 12: Phượng Hoàng Huyết Tinh (Epic - Hoa)
// -----------------------------------------------------------------------------
function drawGemEpic4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 30;

  // Viên đá giọt máu Phượng Hoàng rực lửa
  ctx.beginPath();
  ctx.moveTo(0, -95);
  ctx.bezierCurveTo(75, -30, 85, 55, 0, 95);
  ctx.bezierCurveTo(-85, 55, -75, -30, 0, -95);
  ctx.closePath();

  const rGrad = ctx.createRadialGradient(-15, -10, 5, 0, 10, 85);
  rGrad.addColorStop(0, '#fef08a');
  rGrad.addColorStop(0.3, '#f97316');
  rGrad.addColorStop(0.7, '#dc2626');
  rGrad.addColorStop(1, '#450a0a');
  ctx.fillStyle = rGrad;
  ctx.fill();
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Bóng hình Phượng Hoàng sải cánh bên trong tinh thể
  ctx.beginPath();
  // Đầu và mỏ
  ctx.moveTo(0, -45);
  ctx.lineTo(8, -52);
  ctx.lineTo(0, -40);
  // Cánh phải
  ctx.quadraticCurveTo(45, -30, 40, 5);
  ctx.lineTo(25, -5);
  // Đuôi phượng hoàng
  ctx.quadraticCurveTo(15, 45, 0, 65);
  ctx.quadraticCurveTo(-15, 45, -25, -5);
  // Cánh trái
  ctx.lineTo(-40, 5);
  ctx.quadraticCurveTo(-45, -30, 0, -40);
  ctx.closePath();
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 12;
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 13: « Bất Hủ Thần Hoàng Ngọc » (Mythic - Tho)
// -----------------------------------------------------------------------------
function drawGemMythic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Hào quang Kim Sắc Hoàng Đế Chí Tôn
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 35;

  // Đế ngọc vuông tỷ ấn (Imperial Jade Seal Base)
  ctx.beginPath();
  ctx.rect(-70, 0, 140, 75);
  const sGrad = ctx.createLinearGradient(-70, 0, 70, 75);
  sGrad.addColorStop(0, '#fef08a');
  sGrad.addColorStop(0.5, '#eab308');
  sGrad.addColorStop(1, '#854d0e');
  ctx.fillStyle = sGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rồng Vàng Bất Hủ (Coiled Golden Dragon) ngự trên ấn
  ctx.beginPath();
  ctx.arc(0, -25, 45, Math.PI, 0, false);
  ctx.lineTo(35, 0);
  ctx.lineTo(-35, 0);
  ctx.closePath();
  ctx.fillStyle = '#ca8a04';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Đầu Rồng Thần Hoàng
  ctx.beginPath();
  ctx.arc(0, -45, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();

  // Sừng rồng & Mắt ngọc
  ctx.beginPath();
  ctx.moveTo(-10, -55);
  ctx.lineTo(-20, -75);
  ctx.moveTo(10, -55);
  ctx.lineTo(20, -75);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Mắt đỏ ruby
  ctx.beginPath();
  ctx.arc(-6, -45, 3, 0, Math.PI * 2);
  ctx.arc(6, -45, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#dc2626';
  ctx.fill();

  // Phù chú "BẤT HỦ" khắc trên mặt trước đế ngọc
  ctx.beginPath();
  ctx.rect(-50, 20, 100, 35);
  ctx.strokeStyle = '#fef9c3';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 14: « Vạn Tượng Quy Nhất Châu » (Mythic - Quang)
// -----------------------------------------------------------------------------
function drawGemMythic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 35;

  // 3 Vòng Con Quay Thiên Thể (Celestial Gyroscope Rings)
  [-0.5, 0, 0.5].forEach((rot, idx) => {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 105, 38, 0, 0, Math.PI * 2);
    ctx.strokeStyle = idx === 1 ? '#ffd700' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  });

  // Quả cầu Vạn Tượng đa sắc phản chiếu thực tại
  ctx.beginPath();
  ctx.arc(0, 0, 75, 0, Math.PI * 2);
  const pGrad = ctx.createRadialGradient(-20, -20, 5, 0, 0, 75);
  pGrad.addColorStop(0, '#ffffff');
  pGrad.addColorStop(0.2, '#fde047');
  pGrad.addColorStop(0.4, '#f472b6');
  pGrad.addColorStop(0.7, '#60a5fa');
  pGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = pGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Ma trận lăng kính ánh sáng đa chiều
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 35, Math.sin(ang) * 35);
    ctx.lineTo(Math.cos(ang) * 72, Math.sin(ang) * 72);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// GEM 15: « Thiên Hồ Hóa Thần Ngọc » (Mythic - Hon Don)
// -----------------------------------------------------------------------------
function drawGemMythic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Hào quang Cửu Vĩ Thiên Hồ Hồng Hoang
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 38;

  // 9 Đuôi Hồ Ly Hoàng Kim xòe rộng như đóa hoa sen bao quanh
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI * 0.85 + (i * Math.PI * 1.7) / 8;
    ctx.save();
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(25, -60, 0, -115);
    ctx.quadraticCurveTo(-25, -60, 0, 0);
    ctx.closePath();

    const tGrad = ctx.createLinearGradient(0, 0, 0, -115);
    tGrad.addColorStop(0, '#fef08a');
    tGrad.addColorStop(0.5, '#f43f5e');
    tGrad.addColorStop(1, '#ff0055');
    ctx.fillStyle = tGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.restore();
  }

  // Đầu Hồ Ly Tiên Giới chạm từ ngọc hồng tinh tú
  ctx.beginPath();
  ctx.arc(0, 5, 45, 0, Math.PI * 2);
  const fGrad = ctx.createRadialGradient(-10, -5, 5, 0, 5, 45);
  fGrad.addColorStop(0, '#ffffff');
  fGrad.addColorStop(0.4, '#f472b6');
  fGrad.addColorStop(0.8, '#a21caf');
  fGrad.addColorStop(1, '#4a044e');
  ctx.fillStyle = fGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Đôi tai hồ ly nhọn
  ctx.beginPath();
  ctx.moveTo(-25, -20);
  ctx.lineTo(-38, -55);
  ctx.lineTo(-12, -35);
  ctx.closePath();
  ctx.fillStyle = '#ff0055';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(25, -20);
  ctx.lineTo(38, -55);
  ctx.lineTo(12, -35);
  ctx.closePath();
  ctx.fillStyle = '#ff0055';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // Ấn chu sa đỏ rực giữa trán
  ctx.beginPath();
  ctx.ellipse(0, -10, 5, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  ctx.restore();
}

function drawFallbackGem(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💎', 0, 0);
  ctx.restore();
}
