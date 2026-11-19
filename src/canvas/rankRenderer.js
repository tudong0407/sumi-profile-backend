import { createCanvas } from '@napi-rs/canvas';
import { loadImageSafe, drawRoundRect, truncateText, drawPetal, drawProceduralAvatar, sanitizeText } from './drawUtils.js';

const FONT_FAMILY = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';

/**
 * Render thẻ Rank Mini Tiên Giới SuMi Family (1000 x 205 px)
 * Chuyên dụng cho lệnh /rank: Hiển thị nhanh Cấp độ, EXP, Cảnh giới, Gia tộc & Linh thạch
 * @param {Object} data Dữ liệu hồ sơ người dùng
 * @returns {Promise<Buffer>} Buffer PNG của ảnh Rank Mini
 */
export async function renderRankCard(data) {
  const width = 1000;
  const height = 205;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Chuẩn hóa dữ liệu hồ sơ
  const profile = {
    userId: String(data.user_id || '0'),
    username: sanitizeText(data.username || 'Tu Sĩ Ẩn Danh'),
    discriminator: data.discriminator || '0',
    avatarUrl: data.avatar_url || null,
    backgroundUrl: data.background_url || null,
    customTitle: sanitizeText(data.custom_title || 'Đệ Tử Ngoại Môn'),
    realm: sanitizeText(data.realm || 'I. Luyện Khí Sơ Kỳ'),
    level: Math.max(1, Number(data.level) || 1),
    exp: Math.max(0, Number(data.exp) || 0),
    nextExp: Math.max(1, Number(data.next_level_exp) || (data.level >= 100 ? 500000 : Math.floor(100 * Math.pow(data.level || 1, 1.8)))),
    linhThach: Math.max(0, Number(data.linh_thach) || 0),
    clan: data.clan || null,
    married: data.married || null,
  };

  const isOwner = profile.userId === '757091869183311872';

  // Tải hình nền & avatar an toàn
  const [bgImage, avatarImg] = await Promise.all([
    loadImageSafe(profile.backgroundUrl, 2500, isOwner ? 'celestial_palace_pink.png' : 'default_background.png'),
    loadImageSafe(profile.avatarUrl, 2500, isOwner ? 'fuyumi_avatar.png' : 'default_avatar.png'),
  ]);

  // ============================================================================
  // LỚP 1: HÌNH NỀN (BACKGROUND - BẦU TRỜI TIÊN GIỚI CỬU VĨ HỒ)
  // ============================================================================
  if (bgImage) {
    const hRatio = width / bgImage.width;
    const vRatio = height / bgImage.height;
    const ratio = Math.max(hRatio, vRatio);
    const centerShiftX = (width - bgImage.width * ratio) / 2;
    const centerShiftY = (height - bgImage.height * ratio) / 2;
    ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height, centerShiftX, centerShiftY, bgImage.width * ratio, bgImage.height * ratio);

    // Phủ lớp vignette tối để tăng độ tương phản
    ctx.fillStyle = 'rgba(10, 7, 20, 0.72)';
    ctx.fillRect(0, 0, width, height);
  } else {
    // Nền Đạo Cảnh Vũ Trụ Hồ Ly Tiên Giới Procedural
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a0815');
    bgGrad.addColorStop(0.5, '#160d2b');
    bgGrad.addColorStop(1, '#0c0717');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Tinh vân hồng & tím (Celestial Nebula)
    const nebula1 = ctx.createRadialGradient(240, 90, 10, 240, 90, 260);
    nebula1.addColorStop(0, 'rgba(236, 72, 153, 0.22)');
    nebula1.addColorStop(0.6, 'rgba(147, 51, 234, 0.12)');
    nebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula1;
    ctx.fillRect(0, 0, width, height);

    const nebula2 = ctx.createRadialGradient(860, 110, 10, 860, 110, 240);
    nebula2.addColorStop(0, 'rgba(244, 63, 94, 0.20)');
    nebula2.addColorStop(0.7, 'rgba(79, 70, 229, 0.10)');
    nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, width, height);

    // Ngôi sao lấp lánh (Starlight Sparks)
    const stars = [
      { x: 120, y: 25, r: 1.5, o: 0.8 }, { x: 340, y: 45, r: 2.0, o: 0.6 },
      { x: 520, y: 20, r: 1.2, o: 0.9 }, { x: 780, y: 55, r: 2.5, o: 0.7 },
      { x: 920, y: 85, r: 1.8, o: 0.5 }, { x: 420, y: 130, r: 1.6, o: 0.6 },
    ];
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.o})`;
      ctx.shadowColor = 'rgba(255, 240, 200, 0.9)';
      ctx.shadowBlur = 6;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Cánh hoa đào lượn bay
    const petals = [
      { x: 80, y: 70, s: 12, rot: 0.4, op: 0.5 },
      { x: 280, y: 20, s: 14, rot: 1.2, op: 0.6 },
      { x: 490, y: 65, s: 10, rot: -0.5, op: 0.4 },
      { x: 740, y: 30, s: 13, rot: 0.8, op: 0.5 },
      { x: 930, y: 60, s: 11, rot: -1.1, op: 0.45 },
    ];
    petals.forEach(p => drawPetal(ctx, p.x, p.y, p.s, p.rot, p.op));
  }

  // Khung viền ngoài Thẻ Rank
  ctx.save();
  drawRoundRect(ctx, 14, 14, width - 28, height - 28, 20);
  const outerBorderGrad = ctx.createLinearGradient(14, 14, width - 14, height - 14);
  outerBorderGrad.addColorStop(0, 'rgba(255, 182, 193, 0.55)');
  outerBorderGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.5)');
  outerBorderGrad.addColorStop(1, 'rgba(168, 85, 247, 0.45)');
  ctx.strokeStyle = outerBorderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ============================================================================
  // LỚP 2: AVATAR & KHUNG VIỀN HOÀNG KIM (AVATAR & FRAME)
  // ============================================================================
  const avX = 46;
  const avY = 24;
  const avSize = 112;
  const avRadius = avSize / 2;
  const avCenterX = avX + avRadius;
  const avCenterY = avY + avRadius;

  // Hào quang tỏa sáng phía sau Avatar
  const auraGrad = ctx.createRadialGradient(avCenterX, avCenterY, avRadius - 5, avCenterX, avCenterY, avRadius + 24);
  auraGrad.addColorStop(0, 'rgba(255, 105, 180, 0.5)');
  auraGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.35)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(avCenterX, avCenterY, avRadius + 24, 0, Math.PI * 2);
  ctx.fill();

  // Cắt hình tròn vẽ Avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCenterX, avCenterY, avRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avX, avY, avSize, avSize);
  } else {
    const initial = (profile.username || 'F').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || '🦊';
    drawProceduralAvatar(ctx, avX, avY, avSize, isOwner, initial);
  }
  ctx.restore();

  // Khung Viền Hoàng Kim (Avatar Frame)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCenterX, avCenterY, avRadius + 2, 0, Math.PI * 2);
  const frameRing = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
  frameRing.addColorStop(0, '#fef08a');
  frameRing.addColorStop(0.5, '#f59e0b');
  frameRing.addColorStop(1, '#ec4899');
  ctx.strokeStyle = frameRing;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Ngọc Tiên Giới đính trên khung viền
  const jewels = [
    { angle: -Math.PI / 2, r: 5.2, color: '#ffffff', glow: '#ffd700' }, // 12 giờ
    { angle: -Math.PI * 0.75, r: 4.0, color: '#fef08a', glow: '#f59e0b' },
    { angle: -Math.PI * 0.25, r: 4.0, color: '#fef08a', glow: '#f59e0b' },
    { angle: Math.PI, r: 3.8, color: '#ffd700', glow: '#ec4899' },
    { angle: 0, r: 3.8, color: '#ffd700', glow: '#ec4899' },
  ];

  jewels.forEach(j => {
    const jx = avCenterX + (avRadius + 2) * Math.cos(j.angle);
    const jy = avCenterY + (avRadius + 2) * Math.sin(j.angle);
    ctx.beginPath();
    ctx.arc(jx, jy, j.r, 0, Math.PI * 2);
    ctx.fillStyle = j.color;
    ctx.shadowColor = j.glow;
    ctx.shadowBlur = 6;
    ctx.fill();
  });
  ctx.restore();

  // Huy hiệu Cấp Độ (Level Badge) đặt cân đối phía đáy Avatar
  ctx.save();
  const badgeW = 74;
  const badgeH = 21;
  const badgeX = avCenterX - badgeW / 2;
  const badgeY = avY + avSize - 10;

  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, '#f59e0b');
  badgeGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = badgeGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 6;
  ctx.fill();

  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 11.5px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(`Lv.${profile.level}`, avCenterX, badgeY + badgeH / 2);
  ctx.restore();

  // ============================================================================
  // LỚP 3: THÔNG TIN DANH TÍNH CỐT LÕI (USER IDENTITY HEADER)
  // ============================================================================
  const headerX = 188;

  // Tên Người Dùng (Discord Username)
  ctx.save();
  ctx.font = `bold 25px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
  ctx.shadowBlur = 9;
  ctx.textBaseline = 'top';
  const nameDisplay = truncateText(ctx, profile.username, 370);
  ctx.fillText(nameDisplay, headerX, 26);
  ctx.restore();

  // Danh Hiệu Tiên Chủ / Custom Title Pill
  ctx.save();
  const titleY = 64;
  const titleText = `« ${profile.customTitle} »`;
  ctx.font = `bold 12.5px ${FONT_FAMILY}`;
  const titleMetrics = ctx.measureText(titleText);
  const titleW = Math.max(120, titleMetrics.width + 20);

  drawRoundRect(ctx, headerX, titleY, titleW, 24, 7);
  const titleBg = ctx.createLinearGradient(headerX, titleY, headerX + titleW, titleY + 24);
  titleBg.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
  titleBg.addColorStop(1, 'rgba(168, 85, 247, 0.3)');
  ctx.fillStyle = titleBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = 'rgba(251, 191, 36, 0.5)';
  ctx.shadowBlur = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titleText, headerX + titleW / 2, titleY + 12);
  ctx.restore();

  // Cảnh Giới Tu Luyện (Realm)
  ctx.save();
  const realmY = 98;
  const realmText = `Cảnh Giới: ${profile.realm}`;
  ctx.font = `12.5px ${FONT_FAMILY}`;
  const realmMetrics = ctx.measureText(realmText);
  const realmW = Math.max(140, realmMetrics.width + 20);

  drawRoundRect(ctx, headerX, realmY, realmW, 24, 7);
  ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(realmText, headerX + realmW / 2, realmY + 12);
  ctx.restore();

  // ============================================================================
  // LỚP 4: CỘT THÔNG TIN PHỤ BÊN PHẢI (GIA TỘC, TIÊN LỮ, LINH THẠCH)
  // ============================================================================
  const metaBoxX = 580;
  const metaBoxW = 372;
  const metaBoxH = 30;

  // Box 1: Gia Tộc (Clan)
  ctx.save();
  const clanY = 26;
  drawRoundRect(ctx, metaBoxX, clanY, metaBoxW, metaBoxH, 7);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `12.5px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f472b6';
  ctx.fillText('🦊 Gia Tộc:', metaBoxX + 14, clanY + metaBoxH / 2);

  ctx.fillStyle = '#ffffff';
  let clanStr = 'Chưa gia nhập bang hội';
  if (profile.clan) {
    const roleClan = profile.clan.is_leader ? 'Tộc Trưởng' : 'Tộc Viên';
    clanStr = `[${profile.clan.clan_name}] • ${roleClan} (Cấp ${profile.clan.clan_level})`;
  }
  const cleanClanStr = truncateText(ctx, clanStr, metaBoxW - 110);
  ctx.fillText(cleanClanStr, metaBoxX + 88, clanY + metaBoxH / 2);
  ctx.restore();

  // Box 2: Tiên Lữ Kết Hôn (Marriage)
  ctx.save();
  const marryY = 62;
  drawRoundRect(ctx, metaBoxX, marryY, metaBoxW, metaBoxH, 7);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `12.5px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fb7185';
  ctx.fillText('💍 Tiên Lữ:', metaBoxX + 14, marryY + metaBoxH / 2);

  ctx.fillStyle = '#fed7aa';
  let marryStr = 'Độc thân tu đạo';
  if (profile.married) {
    marryStr = `Đã kết hôn cùng ${profile.married.username}`;
  }
  const cleanMarryStr = truncateText(ctx, marryStr, metaBoxW - 110);
  ctx.fillText(cleanMarryStr, metaBoxX + 88, marryY + metaBoxH / 2);
  ctx.restore();

  // Box 3: Số Dư Linh Thạch (Linh Thach Balance)
  ctx.save();
  const stoneY = 98;
  drawRoundRect(ctx, metaBoxX, stoneY, metaBoxW, metaBoxH, 7);
  const stoneBg = ctx.createLinearGradient(metaBoxX, stoneY, metaBoxX + metaBoxW, stoneY + metaBoxH);
  stoneBg.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
  stoneBg.addColorStop(1, 'rgba(30, 41, 59, 0.6)');
  ctx.fillStyle = stoneBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `12.5px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('💎 Linh Thạch:', metaBoxX + 14, stoneY + metaBoxH / 2);

  ctx.font = `bold 13.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#7dd3fc';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 6;
  const stoneStr = `${profile.linhThach.toLocaleString('vi-VN')} Viên`;
  ctx.fillText(stoneStr, metaBoxX + 105, stoneY + metaBoxH / 2);
  ctx.restore();

  // ============================================================================
  // LỚP 5: THANH TIẾN ĐỘ EXP NGHỆ THUẬT (GLOWING EXP BAR)
  // ============================================================================
  const expBarX = 46;
  const expBarY = 150;
  const expBarW = 908;
  const expBarH = 26;

  const currentExp = Math.max(0, profile.exp);
  const maxExp = Math.max(1, profile.nextExp);
  const expRatio = Math.min(1.0, currentExp / maxExp);
  const expPercent = (expRatio * 100).toFixed(1);

  // Nền thanh EXP
  ctx.save();
  drawRoundRect(ctx, expBarX, expBarY, expBarW, expBarH, 13);
  ctx.fillStyle = 'rgba(15, 12, 28, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Phần tô đầy EXP (Fill)
  if (expRatio > 0) {
    const fillW = Math.max(18, expBarW * expRatio);
    drawRoundRect(ctx, expBarX + 1, expBarY + 1, fillW - 2, expBarH - 2, 11);
    const expFillGrad = ctx.createLinearGradient(expBarX, expBarY, expBarX + expBarW, expBarY);
    expFillGrad.addColorStop(0, '#ec4899');
    expFillGrad.addColorStop(0.5, '#f43f5e');
    expFillGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = expFillGrad;
    ctx.shadowColor = 'rgba(244, 63, 94, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fill();
  }

  // Chữ trên thanh EXP
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 5;
  const expText = `CẤP ĐỘ ${profile.level} • ${currentExp.toLocaleString('vi-VN')} / ${maxExp.toLocaleString('vi-VN')} EXP (${expPercent}%)`;
  ctx.fillText(expText, expBarX + expBarW / 2, expBarY + expBarH / 2);
  ctx.restore();

  // Xuất ra PNG Buffer
  return canvas.toBuffer('image/png');
}

export default renderRankCard;
