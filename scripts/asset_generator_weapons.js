import { createBaseCanvas, drawBackground, drawCardBorders, drawBottomBanner } from './asset_generator_base.js';

export function renderWeapon(item, outputPath) {
  const { canvas, ctx } = createBaseCanvas();
  const cx = 256;
  const cy = 215;

  // 1. Nền thần thoại & Linh trận
  drawBackground(ctx, item.rarity, item.element);

  // 2. Vẽ hình tượng Vũ Khí đặc trưng
  ctx.save();
  switch (item.item_id) {
    case 'weapon_common_1': drawWeaponCommon1(ctx, cx, cy); break;
    case 'weapon_common_2': drawWeaponCommon2(ctx, cx, cy); break;
    case 'weapon_common_3': drawWeaponCommon3(ctx, cx, cy); break;
    case 'weapon_common_4': drawWeaponCommon4(ctx, cx, cy); break;
    case 'weapon_rare_1': drawWeaponRare1(ctx, cx, cy); break;
    case 'weapon_rare_2': drawWeaponRare2(ctx, cx, cy); break;
    case 'weapon_rare_3': drawWeaponRare3(ctx, cx, cy); break;
    case 'weapon_rare_4': drawWeaponRare4(ctx, cx, cy); break;
    case 'weapon_epic_1': drawWeaponEpic1(ctx, cx, cy); break;
    case 'weapon_epic_2': drawWeaponEpic2(ctx, cx, cy); break;
    case 'weapon_epic_3': drawWeaponEpic3(ctx, cx, cy); break;
    case 'weapon_epic_4': drawWeaponEpic4(ctx, cx, cy); break;
    case 'weapon_mythic_1': drawWeaponMythic1(ctx, cx, cy); break;
    case 'weapon_mythic_2': drawWeaponMythic2(ctx, cx, cy); break;
    case 'weapon_mythic_3': drawWeaponMythic3(ctx, cx, cy); break;
    default: drawFallbackWeapon(ctx, cx, cy); break;
  }
  ctx.restore();

  // 3. Khung viền phẩm cấp
  drawCardBorders(ctx, item.rarity, item.element);

  // 4. Thanh nhãn tên và thuộc tính
  drawBottomBanner(ctx, item.item_name, item.rarity, item.element, 'weapon');

  return canvas.toBuffer('image/png');
}

// -----------------------------------------------------------------------------
// WEAPON 1: Thiết Mộc Trọng Kiếm (Common - Kim)
// -----------------------------------------------------------------------------
function drawWeaponCommon1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // Aura kiếm mộc mạc
  ctx.shadowColor = 'rgba(203, 213, 225, 0.4)';
  ctx.shadowBlur = 12;

  // Lưỡi kiếm thép dày (Blade)
  const bGrad = ctx.createLinearGradient(-18, -120, 18, 40);
  bGrad.addColorStop(0, '#f1f5f9');
  bGrad.addColorStop(0.3, '#94a3b8');
  bGrad.addColorStop(0.7, '#475569');
  bGrad.addColorStop(1, '#334155');

  ctx.beginPath();
  ctx.moveTo(0, -140); // Mũi kiếm
  ctx.lineTo(20, -110);
  ctx.lineTo(18, 40);
  ctx.lineTo(-18, 40);
  ctx.lineTo(-20, -110);
  ctx.closePath();
  ctx.fillStyle = bGrad;
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Sống kiếm gỗ thiết mộc (Wood-core fuller)
  ctx.beginPath();
  ctx.moveTo(0, -125);
  ctx.lineTo(4, 35);
  ctx.lineTo(-4, 35);
  ctx.closePath();
  ctx.fillStyle = '#78350f';
  ctx.fill();

  // Chuôi & Chắn kiếm (Guard)
  ctx.beginPath();
  ctx.rect(-36, 40, 72, 12);
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cán kiếm quấn da
  ctx.beginPath();
  ctx.rect(-7, 52, 14, 55);
  ctx.fillStyle = '#451a03';
  ctx.fill();
  for (let y = 58; y < 100; y += 10) {
    ctx.beginPath();
    ctx.moveTo(-7, y);
    ctx.lineTo(7, y + 4);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Chuôi tròn (Pommel)
  ctx.beginPath();
  ctx.arc(0, 114, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 2: Thanh Trúc Linh Cung (Common - Moc)
// -----------------------------------------------------------------------------
function drawWeaponCommon2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Thân cung trúc uốn lượn (Bamboo Recurve Bow)
  ctx.shadowColor = 'rgba(52, 211, 153, 0.6)';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.arc(-20, 0, 120, -Math.PI * 0.45, Math.PI * 0.45, false);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Đốt tre (Bamboo Nodes)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 16;
  const nodes = [-0.35, -0.18, 0, 0.18, 0.35];
  nodes.forEach(ang => {
    ctx.beginPath();
    ctx.arc(-20, 0, 120, Math.PI * (ang - 0.02), Math.PI * (ang + 0.02));
    ctx.stroke();
  });

  // Dây cung linh khí (Glowing String)
  ctx.beginPath();
  const topX = -20 + Math.cos(-Math.PI * 0.45) * 120;
  const topY = Math.sin(-Math.PI * 0.45) * 120;
  const botX = -20 + Math.cos(Math.PI * 0.45) * 120;
  const botY = Math.sin(Math.PI * 0.45) * 120;
  ctx.moveTo(topX, topY);
  ctx.lineTo(40, 0); // Kéo dây
  ctx.lineTo(botX, botY);
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mũi tên linh mộc (Green Spirit Arrow)
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(-30, 0);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Đầu mũi tên hình lá trúc
  ctx.beginPath();
  ctx.moveTo(130, 0);
  ctx.lineTo(105, -10);
  ctx.lineTo(112, 0);
  ctx.lineTo(105, 10);
  ctx.closePath();
  ctx.fillStyle = '#34d399';
  ctx.fill();

  // Lông vũ mũi tên
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-45, -8);
  ctx.moveTo(-30, 0);
  ctx.lineTo(-45, 8);
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 3: Hắc Thiết Song Đao (Common - Hoa)
// -----------------------------------------------------------------------------
function drawWeaponCommon3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  function drawDao(angle, mirror) {
    ctx.save();
    ctx.rotate(angle);
    if (mirror) ctx.scale(-1, 1);

    // Lưỡi đao cong hắc thiết
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(10, -50, 35, -120); // Lưng đao
    ctx.lineTo(45, -115);
    ctx.quadraticCurveTo(22, -40, 12, 30); // Lưỡi đao
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rãnh máu rực lửa
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.quadraticCurveTo(15, -40, 30, -95);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chắn đao tròn
    ctx.beginPath();
    ctx.ellipse(5, 32, 16, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Cán đao
    ctx.beginPath();
    ctx.rect(0, 35, 10, 45);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Vòng khâu chuôi & tua rua đỏ
    ctx.beginPath();
    ctx.arc(5, 85, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(5, 92);
    ctx.quadraticCurveTo(15, 110, 8, 125);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  drawDao(-Math.PI * 0.22, false);
  drawDao(Math.PI * 0.22, true);

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 4: Toái Thạch Cự Phủ (Common - Tho)
// -----------------------------------------------------------------------------
function drawWeaponCommon4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 6);

  // Cán búa to lớn (Heavy Shaft)
  ctx.beginPath();
  ctx.rect(-8, -130, 16, 260);
  ctx.fillStyle = '#78350f';
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vòng sắt gia cố
  for (let y = -100; y <= 100; y += 40) {
    ctx.beginPath();
    ctx.rect(-10, y, 20, 8);
    ctx.fillStyle = '#475569';
    ctx.fill();
  }

  // Lưỡi rìu đá khổng lồ (Giant Granite Axe Head)
  ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(8, -80);
  ctx.lineTo(85, -110);
  ctx.quadraticCurveTo(120, -35, 85, 40);
  ctx.lineTo(8, 10);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Vết nứt toái thạch phát sáng
  ctx.beginPath();
  ctx.moveTo(8, -35);
  ctx.lineTo(40, -45);
  ctx.lineTo(65, -30);
  ctx.lineTo(95, -40);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Gai nhọn đối trọng phía sau
  ctx.beginPath();
  ctx.moveTo(-8, -55);
  ctx.lineTo(-45, -35);
  ctx.lineTo(-8, -15);
  ctx.closePath();
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 5: Tử Điện Lôi Minh Thương (Rare - Loi)
// -----------------------------------------------------------------------------
function drawWeaponRare1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // Hào quang lôi điện tím
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 18;

  // Cán thương bạch ngân
  ctx.beginPath();
  ctx.rect(-5, -130, 10, 270);
  const sGrad = ctx.createLinearGradient(-5, 0, 5, 0);
  sGrad.addColorStop(0, '#e2e8f0');
  sGrad.addColorStop(0.5, '#c084fc');
  sGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = sGrad;
  ctx.fill();

  // Đầu thương tam xoa lôi đình
  ctx.beginPath();
  ctx.moveTo(0, -170); // Mũi thương chính
  ctx.lineTo(12, -135);
  ctx.lineTo(6, -110);
  ctx.lineTo(24, -125); // Ngạnh phụ phải
  ctx.lineTo(8, -95);
  ctx.lineTo(0, -90);
  ctx.lineTo(-8, -95);
  ctx.lineTo(-24, -125); // Ngạnh phụ trái
  ctx.lineTo(-6, -110);
  ctx.lineTo(-12, -135);
  ctx.closePath();
  ctx.fillStyle = '#f3e8ff';
  ctx.fill();
  ctx.strokeStyle = '#9333ea';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tia sét lượn quanh mũi thương
  ctx.beginPath();
  ctx.moveTo(0, -170);
  ctx.lineTo(15, -150);
  ctx.lineTo(-12, -130);
  ctx.lineTo(18, -110);
  ctx.lineTo(-6, -90);
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 6: U Hỏa Nhiễm Huyết Kiếm (Rare - Hoa)
// -----------------------------------------------------------------------------
function drawWeaponRare2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // Ngọn lửa U Hỏa tím rực (Flames)
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 18;

  // Lưỡi kiếm thanh mảnh (Jian)
  ctx.beginPath();
  ctx.moveTo(0, -155);
  ctx.lineTo(13, -130);
  ctx.lineTo(9, 40);
  ctx.lineTo(-9, 40);
  ctx.lineTo(-13, -130);
  ctx.closePath();
  const kGrad = ctx.createLinearGradient(-10, 0, 10, 0);
  kGrad.addColorStop(0, '#7f1d1d');
  kGrad.addColorStop(0.5, '#f87171');
  kGrad.addColorStop(1, '#450a0a');
  ctx.fillStyle = kGrad;
  ctx.fill();
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Lửa u minh bốc lên quanh lưỡi kiếm
  for (let i = 0; i < 7; i++) {
    const fy = -140 + i * 25;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(side * 8, fy);
    ctx.quadraticCurveTo(side * 28, fy - 15, side * 12, fy - 30);
    ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Chắn kiếm hình cánh dơi / phụng hoàng
  ctx.beginPath();
  ctx.moveTo(-32, 40);
  ctx.lineTo(0, 48);
  ctx.lineTo(32, 40);
  ctx.lineTo(24, 52);
  ctx.lineTo(-24, 52);
  ctx.closePath();
  ctx.fillStyle = '#991b1b';
  ctx.fill();

  // Viên hồng ngọc huyết tinh ở tâm kiếm
  ctx.beginPath();
  ctx.arc(0, 45, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // Cán & Đốc kiếm
  ctx.beginPath();
  ctx.rect(-5, 52, 10, 50);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 107, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#991b1b';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 7: Hàn Băng Thần Châm (Rare - Thuy)
// -----------------------------------------------------------------------------
function drawWeaponRare3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 18;

  // 7 cây thần châm pha lê băng tuyết
  const needles = [
    { x: 0, y: -20, len: 140, rot: 0, thick: 5 },
    { x: -35, y: -10, len: 115, rot: -0.18, thick: 4 },
    { x: 35, y: -10, len: 115, rot: 0.18, thick: 4 },
    { x: -70, y: 5, len: 90, rot: -0.35, thick: 3 },
    { x: 70, y: 5, len: 90, rot: 0.35, thick: 3 },
    { x: -100, y: 25, len: 70, rot: -0.52, thick: 2.5 },
    { x: 100, y: 25, len: 70, rot: 0.52, thick: 2.5 }
  ];

  needles.forEach(n => {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.rot);

    ctx.beginPath();
    ctx.moveTo(0, -n.len / 2);
    ctx.lineTo(n.thick, 0);
    ctx.lineTo(1, n.len / 2);
    ctx.lineTo(-1, n.len / 2);
    ctx.lineTo(-n.thick, 0);
    ctx.closePath();

    const nGrad = ctx.createLinearGradient(0, -n.len / 2, 0, n.len / 2);
    nGrad.addColorStop(0, '#ffffff');
    nGrad.addColorStop(0.3, '#7dd3fc');
    nGrad.addColorStop(0.8, '#0284c7');
    nGrad.addColorStop(1, '#0c4a6e');

    ctx.fillStyle = nGrad;
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  });

  // Tinh thể hoa tuyết trung tâm
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang) * 45, Math.sin(ang) * 45);
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 8: Bạch Hạc Vũ Phiến (Rare - Quang)
// -----------------------------------------------------------------------------
function drawWeaponRare4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy + 20);

  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 18;

  // Nan quạt thép mở rộng (11 nan)
  const ribCount = 11;
  const startAng = -Math.PI * 0.8;
  const endAng = -Math.PI * 0.2;

  // Cánh lông hạc trắng tỏa ra
  for (let i = 0; i < ribCount; i++) {
    const t = i / (ribCount - 1);
    const ang = startAng + t * (endAng - startAng);

    ctx.save();
    ctx.rotate(ang);

    // Lông vũ bạch hạc
    ctx.beginPath();
    ctx.ellipse(0, -110, 20, 60, 0, 0, Math.PI * 2);
    const fGrad = ctx.createLinearGradient(0, -170, 0, -50);
    fGrad.addColorStop(0, '#ffffff');
    fGrad.addColorStop(0.6, '#f8fafc');
    fGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = fGrad;
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sống nan quạt hoàng kim
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -145);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  // Đinh trục quạt & Viên ngọc quang minh
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ca8a04';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tua rua bạch hạc rủ xuống
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(0, 70);
  ctx.strokeStyle = '#fef9c3';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 9: Thần Mộc Thiên Cương Trượng (Epic - Moc)
// -----------------------------------------------------------------------------
function drawWeaponEpic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 12);

  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 20;

  // Thân trượng gỗ thần cổ thụ uốn lượn
  ctx.beginPath();
  ctx.moveTo(0, 140);
  ctx.bezierCurveTo(-15, 60, 20, -40, -10, -110);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Dây leo tiên thảo quấn quanh
  ctx.beginPath();
  ctx.moveTo(0, 130);
  ctx.bezierCurveTo(15, 50, -20, -30, 10, -100);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Đỉnh trượng uốn cong ôm lấy viên ngọc
  ctx.beginPath();
  ctx.arc(0, -125, 36, 0.2 * Math.PI, 1.8 * Math.PI);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 12;
  ctx.stroke();

  // Ngọc Thiên Cương xanh biếc lơ lửng ở giữa
  ctx.beginPath();
  ctx.arc(0, -125, 20, 0, Math.PI * 2);
  const orbGrad = ctx.createRadialGradient(-5, -130, 2, 0, -125, 20);
  orbGrad.addColorStop(0, '#ffffff');
  orbGrad.addColorStop(0.3, '#6ee7b7');
  orbGrad.addColorStop(0.8, '#059669');
  orbGrad.addColorStop(1, '#064e3b');
  ctx.fillStyle = orbGrad;
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cánh hoa tiên nở bung
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(Math.cos(ang) * 42, -125 + Math.sin(ang) * 42, 12, 6, ang, 0, Math.PI * 2);
    ctx.fillStyle = '#fbcfe8';
    ctx.fill();
  }

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 10: Vạn Kiếp Huyết Ma Đao (Epic - Am)
// -----------------------------------------------------------------------------
function drawWeaponEpic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 22;

  // Lưỡi đao ma giới răng cưa hung bạo
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(25, -50);
  ctx.lineTo(45, -70); // Răng cưa 1
  ctx.lineTo(30, -85);
  ctx.lineTo(55, -115); // Răng cưa 2
  ctx.lineTo(40, -135);
  ctx.lineTo(60, -165); // Mũi đao sắc nhọn
  ctx.quadraticCurveTo(0, -100, -5, 30); // Lưng đao
  ctx.closePath();

  const dGrad = ctx.createLinearGradient(0, 30, 60, -165);
  dGrad.addColorStop(0, '#0f172a');
  dGrad.addColorStop(0.4, '#4c0519');
  dGrad.addColorStop(0.8, '#e11d48');
  dGrad.addColorStop(1, '#fda4af');
  ctx.fillStyle = dGrad;
  ctx.fill();
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Con mắt Huyết Ma ở chuôi đao
  ctx.beginPath();
  ctx.arc(10, 42, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#881337';
  ctx.fill();
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Đồng tử ma nhãn hình khe dọc
  ctx.beginPath();
  ctx.ellipse(10, 42, 3, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  // Khí độc hắc ám cuộn quanh
  ctx.beginPath();
  ctx.moveTo(40, -120);
  ctx.quadraticCurveTo(70, -100, 50, -80);
  ctx.strokeStyle = '#581c87';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Cán đao xương quỷ
  ctx.beginPath();
  ctx.rect(5, 56, 12, 50);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 11: Cực Băng Huyền Minh Cung (Epic - Thuy)
// -----------------------------------------------------------------------------
function drawWeaponEpic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 22;

  // Cánh cung pha lê băng vạn năm
  ctx.beginPath();
  ctx.arc(-25, 0, 130, -Math.PI * 0.48, Math.PI * 0.48, false);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Các chỏm băng nhọn nhô ra từ cánh cung
  const iceSpikes = [-0.4, -0.25, -0.1, 0.1, 0.25, 0.4];
  iceSpikes.forEach(ang => {
    const bx = -25 + Math.cos(ang * Math.PI) * 130;
    const by = Math.sin(ang * Math.PI) * 130;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 22, by + (ang < 0 ? 12 : -12));
    ctx.lineTo(bx - 6, by);
    ctx.closePath();
    ctx.fillStyle = '#e0f2fe';
    ctx.fill();
  });

  // Dây cung hàn băng
  const topX = -25 + Math.cos(-Math.PI * 0.48) * 130;
  const topY = Math.sin(-Math.PI * 0.48) * 130;
  const botX = -25 + Math.cos(Math.PI * 0.48) * 130;
  const botY = Math.sin(Math.PI * 0.48) * 130;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(45, 0);
  ctx.lineTo(botX, botY);
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mũi tên Huyền Minh Băng Thương
  ctx.beginPath();
  ctx.moveTo(135, 0);
  ctx.lineTo(-30, 0);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Đầu mũi tên tinh thể băng đồ sộ
  ctx.beginPath();
  ctx.moveTo(155, 0);
  ctx.lineTo(125, -16);
  ctx.lineTo(135, 0);
  ctx.lineTo(125, 16);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 12: Thái Hư Trảm Tiên Kiếm (Epic - Kim)
// -----------------------------------------------------------------------------
function drawWeaponEpic4(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 24;

  // Kiếm chính Thái Hư
  ctx.beginPath();
  ctx.moveTo(0, -165);
  ctx.lineTo(16, -135);
  ctx.lineTo(11, 35);
  ctx.lineTo(-11, 35);
  ctx.lineTo(-16, -135);
  ctx.closePath();

  const jGrad = ctx.createLinearGradient(-15, 0, 15, 0);
  jGrad.addColorStop(0, '#fef08a');
  jGrad.addColorStop(0.5, '#ffffff');
  jGrad.addColorStop(1, '#eab308');
  ctx.fillStyle = jGrad;
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Phù văn Trảm Tiên vàng kim rực sáng dọc sống kiếm
  ctx.beginPath();
  ctx.moveTo(0, -150);
  ctx.lineTo(0, 25);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4 phi kiếm hư không bay quanh
  const orbitDists = [-45, 45];
  orbitDists.forEach(dx => {
    ctx.save();
    ctx.translate(dx, -50);
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(6, 15);
    ctx.lineTo(-6, 15);
    ctx.closePath();
    ctx.fillStyle = '#fef9c3';
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.stroke();
    ctx.restore();
  });

  // Chắn kiếm hình Thái Cực
  ctx.beginPath();
  ctx.ellipse(0, 38, 30, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ca8a04';
  ctx.fill();

  // Chuôi kiếm
  ctx.beginPath();
  ctx.rect(-5, 48, 10, 55);
  ctx.fillStyle = '#713f12';
  ctx.fill();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 13: « Tru Tiên Diệt Thần Kiếm » (Mythic - Kim)
// -----------------------------------------------------------------------------
function drawWeaponMythic1(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // Hào quang Thần Thoại Kim Quang + Huyết Sắc cực đại
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 32;

  // Pháp trận Thần Diệt xoay quanh
  ctx.beginPath();
  ctx.arc(0, -40, 95, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lưỡi cự kiếm Tru Tiên oai nghiêm
  ctx.beginPath();
  ctx.moveTo(0, -175);
  ctx.lineTo(24, -140);
  ctx.lineTo(18, 45);
  ctx.lineTo(-18, 45);
  ctx.lineTo(-24, -140);
  ctx.closePath();

  const ttGrad = ctx.createLinearGradient(-24, 0, 24, 0);
  ttGrad.addColorStop(0, '#ffd700');
  ttGrad.addColorStop(0.3, '#ffffff');
  ttGrad.addColorStop(0.7, '#ff0055');
  ttGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = ttGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffe4e6';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Ấn chú Tru Tiên Thần Phù bốc cháy đỏ vàng
  ctx.beginPath();
  ctx.moveTo(0, -160);
  ctx.lineTo(0, 35);
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 4 Lá Bùa Trấn Yểm bay lượn
  const talismans = [
    { x: -55, y: -90, rot: -0.3 },
    { x: 55, y: -90, rot: 0.3 },
    { x: -50, y: 0, rot: -0.15 },
    { x: 50, y: 0, rot: 0.15 }
  ];
  talismans.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.beginPath();
    ctx.rect(-10, -18, 20, 36);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Chữ phù đỏ
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });

  // Chắn kiếm Kim Long vĩ đại
  ctx.beginPath();
  ctx.moveTo(-45, 45);
  ctx.lineTo(0, 58);
  ctx.lineTo(45, 45);
  ctx.lineTo(35, 62);
  ctx.lineTo(-35, 62);
  ctx.closePath();
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cán & Đốc kiếm Hoàng Kim
  ctx.beginPath();
  ctx.rect(-8, 62, 16, 60);
  ctx.fillStyle = '#450a0a';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 130, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 14: « Cửu Thiên Lôi Đình Cổ Thần Thương » (Mythic - Loi)
// -----------------------------------------------------------------------------
function drawWeaponMythic2(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // Hào quang sấm sét Cửu Thiên bùng nổ
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 32;

  // Thân thương Cổ Thần dát vàng tử lôi
  ctx.beginPath();
  ctx.rect(-7, -145, 14, 290);
  const stGrad = ctx.createLinearGradient(-7, 0, 7, 0);
  stGrad.addColorStop(0, '#fbbf24');
  stGrad.addColorStop(0.5, '#f3e8ff');
  stGrad.addColorStop(1, '#7e22ce');
  ctx.fillStyle = stGrad;
  ctx.fill();

  // 2 Rồng Sấm (Twin Lightning Dragons) quấn thân thương
  ctx.beginPath();
  for (let y = -140; y < 140; y += 10) {
    const x = Math.sin(y * 0.08) * 16;
    if (y === -140) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mũi thương Cổ Thần 3 lưỡi lôi kích
  ctx.beginPath();
  ctx.moveTo(0, -185); // Mũi giữa
  ctx.lineTo(16, -140);
  ctx.lineTo(8, -115);
  ctx.lineTo(36, -135); // Cánh phải
  ctx.lineTo(12, -90);
  ctx.lineTo(0, -85);
  ctx.lineTo(-12, -90);
  ctx.lineTo(-36, -135); // Cánh trái
  ctx.lineTo(-8, -115);
  ctx.lineTo(-16, -140);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#9333ea';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 3 Vòng Plasma năng lượng xoay quanh mũi thương
  [-160, -130, -100].forEach((py, idx) => {
    ctx.beginPath();
    ctx.ellipse(0, py, 26 + idx * 8, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  ctx.restore();
}

// -----------------------------------------------------------------------------
// WEAPON 15: « Hồng Mông Hỗn Độn Trượng » (Mythic - Hon Don)
// -----------------------------------------------------------------------------
function drawWeaponMythic3(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 35;

  // Thân trượng Hồng Mông Hỗn Độn đa sắc
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(0, -80);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Vòng Bát Quái Hỗn Độn trên đỉnh trượng
  ctx.beginPath();
  ctx.arc(0, -115, 52, 0, Math.PI * 2);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Các quả cầu nhật nguyệt tinh tú xoay quanh
  const satellites = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  satellites.forEach(ang => {
    const sx = Math.cos(ang) * 52;
    const sy = -115 + Math.sin(ang) * 52;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  });

  // Hạt nhân Hỗn Độn Tinh Vân đa sắc (Galaxy Nebula Core)
  const gGrad = ctx.createRadialGradient(-5, -120, 2, 0, -115, 34);
  gGrad.addColorStop(0, '#ffffff');
  gGrad.addColorStop(0.2, '#f472b6');
  gGrad.addColorStop(0.5, '#a855f7');
  gGrad.addColorStop(0.8, '#38bdf8');
  gGrad.addColorStop(1, '#0f172a');

  ctx.beginPath();
  ctx.arc(0, -115, 34, 0, Math.PI * 2);
  ctx.fillStyle = gGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dải lụa tiên thiên hỗn độn xoắn ốc
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 4; t += 0.2) {
    const r = (t / (Math.PI * 4)) * 30;
    const x = Math.cos(t) * r;
    const y = -115 + Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawFallbackWeapon(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚔️', 0, 0);
  ctx.restore();
}
