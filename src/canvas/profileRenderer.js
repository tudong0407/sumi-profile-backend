import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  drawRoundRect,
  truncateText,
  drawPetal,
  drawAntiAliasedAvatarWithBorder,
  sanitizeText,
  resolveAssetPath,
  FONT_FAMILY,
} from './drawUtils.js';

const RENDER_SCALE = 2;

/**
 * Render thẻ Profile Tiên Giới SuMi Family Full HD+ (2000 x 1000 px, 2x High-DPI)
 * @param {Object} data Dữ liệu hồ sơ người dùng
 * @returns {Promise<Buffer>} Buffer PNG của ảnh hồ sơ
 */
export async function renderProfileCard(data) {
  const width = 1000;
  const height = 500;
  const canvas = createCanvas(width * RENDER_SCALE, height * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Chuẩn hóa dữ liệu hồ sơ
  const profile = {
    userId: String(data.user_id || '0'),
    username: sanitizeText(data.username || 'Tu Sĩ Ẩn Danh'),
    discriminator: data.discriminator || '0',
    avatarUrl: data.avatar_url || null,
    avatarFrame: data.avatar_frame || 'default',
    backgroundUrl: data.background_url || null,
    bio: sanitizeText(data.bio || 'Một vị tu sĩ của SuMi Family'),
    customTitle: sanitizeText(data.custom_title || 'Đệ Tử Ngoại Môn'),
    realm: sanitizeText(data.realm || 'I. Luyện Khí Sơ Kỳ'),
    level: Math.max(1, Number(data.level) || 1),
    exp: Math.max(0, Number(data.exp) || 0),
    nextExp: Math.max(1, Number(data.next_level_exp) || (data.level >= 100 ? 500000 : Math.floor(100 * Math.pow(data.level || 1, 1.8)))),
    linhThach: Math.max(0, Number(data.linh_thach) || 0),
    maxSlots: Math.min(5, Math.max(1, Number(data.max_role_slots) || 1)),
    clan: data.clan || null,
    married: data.married || null,
    pet: data.pet || null,
    roles: Array.isArray(data.equipped_roles) ? data.equipped_roles : [],
  };

  const isOwner = profile.userId === '757091869183311872';

  // Tải hình nền, avatar & ảnh Linh Thú an toàn (với fallback mock asset tương ứng)
  // Ưu tiên file assets/pets/<pet_type>.png và fallback sang cuu_vi_hong_ho_transparent.png
  const petType = profile.pet?.pet_type || profile.pet?.type;
  let petAsset = null;
  if (petType) {
    if (petType === 'cuu_vi_hong_ho') {
      petAsset = 'pets/cuu_vi_hong_ho_transparent.png';
    } else {
      const candidate = `pets/${petType}.png`;
      petAsset = resolveAssetPath(candidate) ? candidate : 'pets/cuu_vi_hong_ho_transparent.png';
    }
  } else if (isOwner) {
    petAsset = 'pets/cuu_vi_hong_ho_transparent.png';
  }
  const equipWeapon = profile.pet?.equipment?.weapon;
  const equipGem = profile.pet?.equipment?.gem;
  const equipSoul = profile.pet?.equipment?.soul;

  const weaponFallback = equipWeapon?.item_id ? `items/${equipWeapon.item_id}.png` : null;
  const gemFallback = equipGem?.item_id ? `items/${equipGem.item_id}.png` : null;
  const soulFallback = equipSoul?.item_id ? `items/${equipSoul.item_id}.png` : null;

  const weaponSource = equipWeapon?.image_url || weaponFallback;
  const gemSource = equipGem?.image_url || gemFallback;
  const soulSource = equipSoul?.image_url || soulFallback;

  const [bgImage, avatarImg, petImg, weaponImg, gemImg, soulImg] = await Promise.all([
    loadImageSafe(profile.backgroundUrl, 2500, isOwner ? 'celestial_palace_pink.png' : 'default_background.png'),
    loadImageSafe(profile.avatarUrl, 2500, isOwner ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    loadImageSafe(profile.pet?.image_url, 2500, petAsset),
    weaponSource ? loadImageSafe(weaponSource, 2000, weaponFallback) : null,
    gemSource ? loadImageSafe(gemSource, 2000, gemFallback) : null,
    soulSource ? loadImageSafe(soulSource, 2000, soulFallback) : null,
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

    // Phủ lớp vignette tối để tăng độ tương phản và chiều sâu
    ctx.fillStyle = 'rgba(10, 7, 20, 0.72)';
    ctx.fillRect(0, 0, width, height);
  } else {
    // Nền Đạo Cảnh Vũ Trụ Hồ Ly Tiên Giới Procedural
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a0815');
    bgGrad.addColorStop(0.3, '#160d2b');
    bgGrad.addColorStop(0.7, '#240b2f');
    bgGrad.addColorStop(1, '#0c0717');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Cung mây tinh tú / Tinh vân hồng & tím (Celestial Nebula)
    const nebula1 = ctx.createRadialGradient(240, 130, 10, 240, 130, 360);
    nebula1.addColorStop(0, 'rgba(236, 72, 153, 0.22)');
    nebula1.addColorStop(0.6, 'rgba(147, 51, 234, 0.12)');
    nebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula1;
    ctx.fillRect(0, 0, width, height);

    const nebula2 = ctx.createRadialGradient(860, 340, 20, 860, 340, 340);
    nebula2.addColorStop(0, 'rgba(244, 63, 94, 0.20)');
    nebula2.addColorStop(0.7, 'rgba(79, 70, 229, 0.10)');
    nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, width, height);

    // Ngôi sao lấp lánh (Starlight Sparks)
    const stars = [
      { x: 120, y: 35, r: 1.5, o: 0.8 }, { x: 340, y: 65, r: 2.0, o: 0.6 },
      { x: 520, y: 30, r: 1.2, o: 0.9 }, { x: 780, y: 75, r: 2.5, o: 0.7 },
      { x: 920, y: 125, r: 1.8, o: 0.5 }, { x: 180, y: 440, r: 1.6, o: 0.7 },
      { x: 420, y: 470, r: 2.0, o: 0.6 }, { x: 880, y: 450, r: 1.4, o: 0.8 },
      { x: 670, y: 220, r: 1.3, o: 0.4 }, { x: 70, y: 280, r: 1.7, o: 0.5 },
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

    // Cánh hoa đào lượn bay (Floating Sakura Petals)
    const petals = [
      { x: 80, y: 110, s: 12, rot: 0.4, op: 0.5 },
      { x: 280, y: 25, s: 15, rot: 1.2, op: 0.6 },
      { x: 490, y: 105, s: 10, rot: -0.5, op: 0.4 },
      { x: 740, y: 40, s: 14, rot: 0.8, op: 0.5 },
      { x: 930, y: 80, s: 11, rot: -1.1, op: 0.45 },
      { x: 140, y: 360, s: 13, rot: 0.9, op: 0.55 },
      { x: 860, y: 410, s: 16, rot: 2.1, op: 0.6 },
    ];
    petals.forEach(p => drawPetal(ctx, p.x, p.y, p.s, p.rot, p.op));
  }

  // Khung viền ngoài Thẻ Profile
  ctx.save();
  drawRoundRect(ctx, 14, 14, width - 28, height - 28, 22);
  const outerBorderGrad = ctx.createLinearGradient(14, 14, width - 14, height - 14);
  outerBorderGrad.addColorStop(0, 'rgba(255, 182, 193, 0.55)');
  outerBorderGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.5)');
  outerBorderGrad.addColorStop(1, 'rgba(168, 85, 247, 0.45)');
  ctx.strokeStyle = outerBorderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ============================================================================
  // LỚP 2: AVATAR KHỬ RĂNG CƯA (4X SUPERSAMPLED) & KHUNG VIỀN PHÂN CẤP ĐỒNG TÂM
  // ============================================================================
  const avX = 50;
  const avY = 32;
  const avSize = 116;
  const avRadius = avSize / 2;
  const avCenterX = avX + avRadius;
  const avCenterY = avY + avRadius;

  drawAntiAliasedAvatarWithBorder(ctx, avatarImg, avCenterX, avCenterY, avRadius, {
    isOwner,
    level: profile.level,
    username: profile.username,
    avatarFrame: profile.avatarFrame,
    supersampleFactor: 4,
    showAura: true,
  });

  // Huy hiệu Cấp Độ (Level Badge) đặt cân đối phía đáy Avatar
  ctx.save();
  const badgeW = 76;
  const badgeH = 22;
  const badgeX = avCenterX - badgeW / 2;
  const badgeY = avY + avSize - 11;

  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
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
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(`Lv.${profile.level}`, avCenterX, badgeY + badgeH / 2);
  ctx.restore();

  // ============================================================================
  // LỚP 3: THÔNG TIN DANH TÍNH CỐT LÕI (USER IDENTITY HEADER)
  // ============================================================================
  const headerX = 195;

  // Tên Người Dùng (Discord Username)
  ctx.save();
  ctx.font = `bold 26px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
  ctx.shadowBlur = 10;
  ctx.textBaseline = 'top';
  const nameDisplay = truncateText(ctx, profile.username, 370);
  ctx.fillText(nameDisplay, headerX, 36);
  ctx.restore();

  // Danh Hiệu Tiên Chủ / Custom Title Pill
  ctx.save();
  const titleY = 74;
  const titleText = `« ${profile.customTitle} »`;
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  const titleMetrics = ctx.measureText(titleText);
  const titleW = Math.max(120, titleMetrics.width + 20);

  drawRoundRect(ctx, headerX, titleY, titleW, 25, 8);
  const titleBg = ctx.createLinearGradient(headerX, titleY, headerX + titleW, titleY + 25);
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
  ctx.fillText(titleText, headerX + titleW / 2, titleY + 13);
  ctx.restore();

  // Cảnh Giới Tu Luyện (Realm)
  ctx.save();
  const realmY = 110;
  const realmText = `Cảnh Giới: ${profile.realm}`;
  ctx.font = `13px ${FONT_FAMILY}`;
  const realmMetrics = ctx.measureText(realmText);
  const realmW = Math.max(140, realmMetrics.width + 20);

  drawRoundRect(ctx, headerX, realmY, realmW, 25, 8);
  ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(realmText, headerX + realmW / 2, realmY + 13);
  ctx.restore();

  // ============================================================================
  // LỚP 4: CỘT THÔNG TIN PHỤ BÊN PHẢI (GIA TỘC, TIÊN LỮ, LINH THẠCH)
  // ============================================================================
  const metaBoxX = 580;
  const metaBoxW = 370;
  const metaBoxH = 32;

  // Box 1: Gia Tộc (Clan)
  ctx.save();
  const clanY = 34;
  drawRoundRect(ctx, metaBoxX, clanY, metaBoxW, metaBoxH, 8);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f472b6';
  ctx.fillText('🦊 Gia Tộc:', metaBoxX + 14, clanY + metaBoxH / 2);

  ctx.fillStyle = '#ffffff';
  let clanStr = 'Chưa gia nhập bang hội';
  if (profile.clan) {
    const roleClan = profile.clan.is_leader ? 'Tộc Trưởng' : 'Tộc Viên';
    clanStr = `[${profile.clan.clan_name}] • ${roleClan} (Cấp ${profile.clan.clan_level})`;
  }
  const cleanClanStr = truncateText(ctx, clanStr, metaBoxW - 96);
  ctx.fillText(cleanClanStr, metaBoxX + 86, clanY + metaBoxH / 2);
  ctx.restore();

  // Box 2: Tiên Lữ Kết Hôn (Marriage)
  ctx.save();
  const marryY = 74;
  drawRoundRect(ctx, metaBoxX, marryY, metaBoxW, metaBoxH, 8);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#fb7185';
  ctx.fillText('💍 Tiên Lữ:', metaBoxX + 14, marryY + metaBoxH / 2);

  ctx.fillStyle = '#fed7aa';
  let marryStr = 'Độc thân tu đạo';
  if (profile.married) {
    marryStr = `Đã kết hôn cùng ${profile.married.username}`;
  }
  const cleanMarryStr = truncateText(ctx, marryStr, metaBoxW - 112);
  ctx.fillText(cleanMarryStr, metaBoxX + 88, marryY + metaBoxH / 2);
  ctx.restore();

  // Box 3: Số Dư Linh Thạch (Linh Thach Balance)
  ctx.save();
  const stoneY = 114;
  drawRoundRect(ctx, metaBoxX, stoneY, metaBoxW, metaBoxH, 8);
  const stoneBg = ctx.createLinearGradient(metaBoxX, stoneY, metaBoxX + metaBoxW, stoneY + metaBoxH);
  stoneBg.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
  stoneBg.addColorStop(1, 'rgba(30, 41, 59, 0.6)');
  ctx.fillStyle = stoneBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#38bdf8';
  ctx.fillText('💎 Linh Thạch:', metaBoxX + 14, stoneY + metaBoxH / 2);

  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillStyle = '#7dd3fc';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 6;
  const stoneStr = `${profile.linhThach.toLocaleString('vi-VN')} Viên`;
  ctx.fillText(stoneStr, metaBoxX + 108, stoneY + metaBoxH / 2);
  ctx.restore();

  // ============================================================================
  // LỚP 5: THANH TIẾN ĐỘ EXP NGHỆ THUẬT (GLOWING EXP BAR)
  // ============================================================================
  const expBarX = 50;
  const expBarY = 168;
  const expBarW = 900;
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

  // ============================================================================
  // LỚP 6: PHẦN DƯỚI (2 BẢNG THÔNG TIN: CHIẾN PET & ROLES TRANG BỊ)
  // ============================================================================
  const bottomY = 212;
  const bottomH = 242;

  // ----------------------------------------------------------------------------
  // BẢNG 6A: LINH THÚ XUẤT TRẬN (PET SYSTEM VỚI NGŨ HÀNH & KỸ NĂNG HAX)
  // ----------------------------------------------------------------------------
  const petW = 390;
  const petX = 50;

  ctx.save();
  drawRoundRect(ctx, petX, bottomY, petW, bottomH, 16);
  ctx.fillStyle = 'rgba(18, 14, 32, 0.75)';
  ctx.fill();
  const petBorder = ctx.createLinearGradient(petX, bottomY, petX + petW, bottomY + bottomH);
  petBorder.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
  petBorder.addColorStop(1, 'rgba(244, 63, 94, 0.4)');
  ctx.strokeStyle = petBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tiêu đề Pet Header (Cách lề 22px thoáng đãng)
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fdba74';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐾 LINH THÚ XUẤT TRẬN', petX + 22, bottomY + 20);

  if (profile.pet) {
    const hasPetImg = !!petImg;
    // Khung Linh Thú Chuyên Biệt (Dedicated Pet Frame)
    const petFrameW = 92;
    const petFrameH = 78;
    const petFrameX = petX + petW - 18 - petFrameW;
    const petFrameY = bottomY + 25;
    const leftTextW = petFrameX - petX - 28;

    // 1. Huy hiệu Độ hiếm (Rarity Badge) căn giữa ngay trên nóc Khung Pet
    const rarityText = profile.pet.rarity || 'Thần Thoại';
    ctx.font = `bold 9.5px ${FONT_FAMILY}`;
    const rarMetrics = ctx.measureText(rarityText);
    const rarPillW = rarMetrics.width + 14;
    const rarPillH = 18;
    const rarPillX = petFrameX + (petFrameW - rarPillW) / 2;
    const rarPillY = petFrameY - 8;

    // Vẽ Khung Viền Linh Thú (Pet Frame)
    drawRoundRect(ctx, petFrameX, petFrameY, petFrameW, petFrameH, 10);
    const petFrameBg = ctx.createRadialGradient(
      petFrameX + petFrameW / 2, petFrameY + petFrameH / 2, 4,
      petFrameX + petFrameW / 2, petFrameY + petFrameH / 2, petFrameW / 2
    );
    petFrameBg.addColorStop(0, 'rgba(244, 114, 182, 0.18)');
    petFrameBg.addColorStop(0.6, 'rgba(168, 85, 247, 0.10)');
    petFrameBg.addColorStop(1, 'rgba(15, 12, 28, 0.65)');
    ctx.fillStyle = petFrameBg;
    ctx.fill();

    // Viền khung phát sáng ngũ sắc
    const petFrameGrad = ctx.createLinearGradient(petFrameX, petFrameY, petFrameX + petFrameW, petFrameY + petFrameH);
    petFrameGrad.addColorStop(0, '#f472b6');
    petFrameGrad.addColorStop(0.5, '#fbbf24');
    petFrameGrad.addColorStop(1, '#c084fc');
    ctx.strokeStyle = petFrameGrad;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(244, 114, 182, 0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Vẽ Bé Pet Chibi tách nền ngay CHÍNH GIỮA khung
    if (hasPetImg) {
      // Giữ tỉ lệ khung hình (Aspect Ratio) chuẩn xác để pet không bị méo mó, co giãn
      const maxW = 74;
      const maxH = 64;
      const imgAspect = petImg.width / petImg.height;
      let drawW, drawH;
      if (imgAspect > (maxW / maxH)) {
        drawW = maxW;
        drawH = maxW / imgAspect;
      } else {
        drawH = maxH;
        drawW = maxH * imgAspect;
      }
      const petDrawX = petFrameX + (petFrameW - drawW) / 2;
      // Căn giữa theo trục Y trong khoảng không gian khả dụng dưới huy hiệu độ hiếm
      const petDrawY = (petFrameY + 8) + (petFrameH - 8 - drawH) / 2;

      ctx.save();
      // Đổ bóng hào quang nhẹ dưới chân Pet
      ctx.shadowColor = 'rgba(255, 182, 193, 0.45)';
      ctx.shadowBlur = 8;
      ctx.drawImage(petImg, petDrawX, petDrawY, drawW, drawH);
      ctx.restore();
    }

    // Vẽ Huy hiệu Độ hiếm trên đỉnh Khung Pet
    drawRoundRect(ctx, rarPillX, rarPillY, rarPillW, rarPillH, 5);
    ctx.fillStyle = 'rgba(24, 14, 36, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.8)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = '#f472b6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rarityText, rarPillX + rarPillW / 2, rarPillY + rarPillH / 2);
    ctx.textAlign = 'left';

    // Tên Linh Thú (Lề trái 20px)
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
    ctx.shadowBlur = 8;
    const petIcon = profile.pet.icon || '🦊';
    const petNameOnly = `${petIcon} ${profile.pet.name}`;
    const cleanPetName = truncateText(ctx, petNameOnly, leftTextW);
    ctx.fillText(cleanPetName, petX + 20, bottomY + 44);
    ctx.shadowBlur = 0;

    // Hàng 2: Pill Hệ Ngũ Hành + Pill Cấp Độ
    const elementStr = profile.pet.element ? `Hệ ${profile.pet.element}` : 'Hệ Hỗn Độn';
    ctx.font = `bold 9.5px ${FONT_FAMILY}`;
    const elemMetrics = ctx.measureText(elementStr);
    const elemPillW = elemMetrics.width + 14;
    const elemPillX = petX + 20;
    const elemPillY = bottomY + 58;

    // 1. Pill Hệ Ngũ Hành (Hồng tím)
    drawRoundRect(ctx, elemPillX, elemPillY, elemPillW, 18, 5);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fbcfe8';
    ctx.textAlign = 'center';
    ctx.fillText(elementStr, elemPillX + elemPillW / 2, elemPillY + 9);
    ctx.textAlign = 'left';

    // 2. Pill Cấp Độ (Tím lam ngọc)
    const levelStr = `Cấp ${profile.pet.level}`;
    const lvlMetrics = ctx.measureText(levelStr);
    const lvlPillW = lvlMetrics.width + 14;
    const lvlPillX = elemPillX + elemPillW + 8;
    const lvlPillY = elemPillY;

    drawRoundRect(ctx, lvlPillX, lvlPillY, lvlPillW, 18, 5);
    ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e9d5ff';
    ctx.textAlign = 'center';
    ctx.fillText(levelStr, lvlPillX + lvlPillW / 2, lvlPillY + 9);
    ctx.textAlign = 'left';

    // Kỹ năng HAX Lật Kèo (HAX Skill Badge)
    const haxName = profile.pet.hax_skill || 'Tuyệt Kỹ Phá Cách (HAX)';
    ctx.font = `bold 11px ${FONT_FAMILY}`;
    const haxDisplay = truncateText(ctx, `⚡ ${haxName}`, leftTextW);
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = 'rgba(253, 224, 71, 0.5)';
    ctx.shadowBlur = 5;
    ctx.fillText(haxDisplay, petX + 20, bottomY + 90);
    ctx.shadowBlur = 0;

    // Bảng Chiến Lực Nổi Bật (Power Score Box)
    const powerBoxX = petX + 18;
    const powerBoxW = petW - 36;
    const powerBoxY = bottomY + 106;
    const powerBoxH = 24;
    drawRoundRect(ctx, powerBoxX, powerBoxY, powerBoxW, powerBoxH, 6);
    const powerBg = ctx.createLinearGradient(powerBoxX, powerBoxY, powerBoxX + powerBoxW, powerBoxY + powerBoxH);
    powerBg.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    powerBg.addColorStop(1, 'rgba(239, 68, 68, 0.35)');
    ctx.fillStyle = powerBg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 211, 77, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `bold 12.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
    ctx.shadowBlur = 7;
    ctx.textAlign = 'center';
    const powerFormatted = (profile.pet.power || 0).toLocaleString('vi-VN');
    ctx.fillText(`⚔️ Chiến Lực: ${powerFormatted}`, powerBoxX + powerBoxW / 2, powerBoxY + powerBoxH / 2);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // Thuộc tính chi tiết (ATK / DEF / SPD)
    const statsY = bottomY + 144;
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.fillStyle = '#cbd5e1';
    const atkStr = `ATK: ${(profile.pet.atk || 0).toLocaleString('vi-VN')}`;
    const defStr = `DEF: ${(profile.pet.def || 0).toLocaleString('vi-VN')}`;
    const spdStr = `SPD: ${(profile.pet.spd || 0).toLocaleString('vi-VN')}`;
    ctx.fillText(`🗡️ ${atkStr}    🛡️ ${defStr}    ⚡ ${spdStr}`, petX + 20, statsY);

    // ========================================================================
    // 3 SLOTS TRANG BỊ LINH THÚ (Vũ Khí, Bảo Ngọc, Chiến Hồn) VỚI RARITY GLOW
    // ========================================================================
    const equipY = bottomY + 164;
    const equipH = 58;
    const equipPadX = 18;
    const availEquipW = petW - equipPadX * 2;
    const equipGap = 6;
    const slotW = Math.floor((availEquipW - equipGap * 2) / 3);

    const slotConfigs = [
      { key: 'weapon', label: '⚔️ VŨ KHÍ', defaultIcon: '⚔️' },
      { key: 'gem', label: '💎 BẢO NGỌC', defaultIcon: '💎' },
      { key: 'soul', label: '🦊 CHIẾN HỒN', defaultIcon: '🦊' },
    ];

    function getEquipColors(rarity) {
      if (!rarity) {
        return {
          borderGrad: ['rgba(100, 116, 139, 0.4)', 'rgba(148, 163, 184, 0.4)'],
          glow: 'rgba(148, 163, 184, 0.25)',
          blur: 4,
          text: '#cbd5e1',
          bg1: 'rgba(30, 41, 59, 0.4)',
          bg2: 'rgba(15, 23, 42, 0.4)',
        };
      }
      const r = String(rarity).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (r.includes('than thoai') || r.includes('mythic')) {
        return {
          borderGrad: ['#ff0055', '#ffd700'],
          glow: '#ff0055',
          blur: 8,
          text: '#ffd700',
          bg1: 'rgba(255, 0, 85, 0.22)',
          bg2: 'rgba(251, 191, 36, 0.16)',
        };
      }
      if (r.includes('tien pham') || r.includes('epic')) {
        return {
          borderGrad: ['#9333ea', '#c084fc'],
          glow: 'rgba(168, 85, 247, 0.65)',
          blur: 6,
          text: '#e9d5ff',
          bg1: 'rgba(147, 51, 234, 0.2)',
          bg2: 'rgba(192, 132, 252, 0.12)',
        };
      }
      if (r.includes('linh pham') || r.includes('rare')) {
        return {
          borderGrad: ['#2563eb', '#60a5fa'],
          glow: 'rgba(59, 130, 246, 0.55)',
          blur: 5,
          text: '#93c5fd',
          bg1: 'rgba(37, 99, 235, 0.18)',
          bg2: 'rgba(96, 165, 250, 0.1)',
        };
      }
      return {
        borderGrad: ['rgba(71, 85, 105, 0.5)', 'rgba(148, 163, 184, 0.5)'],
        glow: 'rgba(148, 163, 184, 0.2)',
        blur: 3,
        text: '#cbd5e1',
        bg1: 'rgba(51, 65, 85, 0.25)',
        bg2: 'rgba(30, 41, 59, 0.2)',
      };
    }

    const itemImgMap = {
      weapon: weaponImg,
      gem: gemImg,
      soul: soulImg,
    };

    slotConfigs.forEach((cfg, idx) => {
      const sx = petX + equipPadX + idx * (slotW + equipGap);
      const sy = equipY;
      const item = profile.pet.equipment ? profile.pet.equipment[cfg.key] : null;
      const itemImg = itemImgMap[cfg.key];

      drawRoundRect(ctx, sx, sy, slotW, equipH, 7);

      if (item) {
        const colors = getEquipColors(item.rarity);
        // Nền slot
        const sBg = ctx.createLinearGradient(sx, sy, sx + slotW, sy + equipH);
        sBg.addColorStop(0, colors.bg1);
        sBg.addColorStop(1, colors.bg2);
        ctx.fillStyle = sBg;
        ctx.fill();

        // Glow Border phát sáng theo Rarity
        ctx.save();
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = colors.blur;
        const sBorder = ctx.createLinearGradient(sx, sy, sx + slotW, sy + equipH);
        sBorder.addColorStop(0, colors.borderGrad[0]);
        sBorder.addColorStop(1, colors.borderGrad[1]);
        ctx.strokeStyle = sBorder;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();

        const statTokens = [];
        if (item.bonus_atk) statTokens.push(`+${item.bonus_atk}ATK`);
        if (item.bonus_def) statTokens.push(`+${item.bonus_def}DEF`);
        if (item.bonus_spd) statTokens.push(`+${item.bonus_spd}SPD`);
        if (item.bonus_hp) statTokens.push(`+${item.bonus_hp}HP`);
        if (item.bonus_crit) statTokens.push(`+${item.bonus_crit}%CRIT`);

        const formatFittedStats = (availW) => {
          if (statTokens.length === 0) return item.rarity || 'Thần Thoại';
          let fitted = statTokens[0];
          for (let i = 1; i < statTokens.length; i++) {
            const candidate = `${fitted} ${statTokens[i]}`;
            if (ctx.measureText(candidate).width <= availW) {
              fitted = candidate;
            } else {
              break;
            }
          }
          return fitted;
        };

        const cleanName = (item.item_name || 'Vật Phẩm').replace(/[«»]/g, '').trim();

        if (itemImg) {
          // Layout có hình ảnh trang bị: Thumbnail 34x34 bo góc bên trái
          const thumbSize = 34;
          const thumbX = sx + 4;
          const thumbY = sy + Math.floor((equipH - thumbSize) / 2);

          ctx.save();
          drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
          ctx.clip();
          ctx.drawImage(itemImg, 0, 0, itemImg.width, itemImg.height, thumbX, thumbY, thumbSize, thumbSize);
          ctx.restore();

          // Viền phát sáng bọc ngoài Thumbnail
          ctx.save();
          drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
          ctx.strokeStyle = colors.borderGrad[0];
          ctx.lineWidth = 1.2;
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.restore();

          // Thông tin trang bị ở bên phải thumbnail (tối ưu hóa độ rộng đạt ~72-74px)
          const textX = sx + thumbSize + 6;
          const maxTextW = slotW - thumbSize - 8;

          // Line 1: Header loại slot
          ctx.font = `bold 8px ${FONT_FAMILY}`;
          ctx.fillStyle = colors.text;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(cfg.label, textX, sy + 12);

          // Line 2: Tên trang bị
          ctx.font = `bold 8.5px ${FONT_FAMILY}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(truncateText(ctx, cleanName, maxTextW), textX, sy + 27);

          // Line 3: Chỉ số cộng thêm
          ctx.font = `7.5px ${FONT_FAMILY}`;
          ctx.fillStyle = colors.text;
          const statText = formatFittedStats(maxTextW);
          ctx.fillText(truncateText(ctx, statText, maxTextW), textX, sy + 43);
        } else {
          // Fallback nếu chưa tải được ảnh: Hiển thị icon và text ở giữa
          // Line 1: Header nhãn loại slot (Vũ Khí / Bảo Ngọc / Chiến Hồn)
          ctx.font = `bold 8.5px ${FONT_FAMILY}`;
          ctx.fillStyle = colors.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cfg.label, sx + slotW / 2, sy + 11);

          // Line 2: Icon & Tên trang bị
          const icon = item.icon || cfg.defaultIcon;
          ctx.font = `bold 10px ${FONT_FAMILY}`;
          ctx.fillStyle = '#ffffff';
          const displayItemName = truncateText(ctx, `${icon} ${cleanName}`, slotW - 8);
          ctx.fillText(displayItemName, sx + slotW / 2, sy + 27);

          // Line 3: Chỉ số cộng thêm / Rarity
          ctx.font = `8.5px ${FONT_FAMILY}`;
          ctx.fillStyle = colors.text;
          const statText = formatFittedStats(slotW - 6);
          ctx.fillText(truncateText(ctx, statText, slotW - 6), sx + slotW / 2, sy + 43);
        }
      } else {
        // Slot trống
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Nhãn slot
        ctx.font = `bold 8.5px ${FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.label, sx + slotW / 2, sy + 14);

        // Chữ Trống
        ctx.font = `10px ${FONT_FAMILY}`;
        ctx.fillStyle = '#475569';
        ctx.fillText('➕ Trống', sx + slotW / 2, sy + 36);
      }
    });

  } else {
    // Placeholder nếu chưa có Pet
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa triệu hồi Linh Thú đồng hành', petX + petW / 2, bottomY + 105);
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText('Dùng lệnh /pet summon hoặc gacha để ấp trứng!', petX + petW / 2, bottomY + 135);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ----------------------------------------------------------------------------
  // BẢNG 6B: ROLES QUYỀN NĂNG ĐANG TRANG BỊ (EQUIPPED ROLES - TỐI ĐA 5 SLOTS)
  // ----------------------------------------------------------------------------
  const rolesX = 460;
  const rolesW = 490;

  ctx.save();
  drawRoundRect(ctx, rolesX, bottomY, rolesW, bottomH, 16);
  ctx.fillStyle = 'rgba(18, 14, 32, 0.75)';
  ctx.fill();
  const rolesBorder = ctx.createLinearGradient(rolesX, bottomY, rolesX + rolesW, bottomY + bottomH);
  rolesBorder.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
  rolesBorder.addColorStop(1, 'rgba(59, 130, 246, 0.4)');
  ctx.strokeStyle = rolesBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tiêu đề Roles Header (Cách lề 22px)
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#c084fc';
  ctx.textBaseline = 'middle';
  ctx.fillText('✨ ROLES QUYỀN NĂNG', rolesX + 22, bottomY + 22);

  ctx.font = `11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(`Số Slot Mở Khóa: ${profile.maxSlots}/5`, rolesX + rolesW - 22, bottomY + 22);
  ctx.textAlign = 'left';

  // Hiển thị 5 Slots Role (Cách đều 22px hai bên, khe hở 10px, đệm trong thoáng đãng)
  const slotW = 217;
  const fullSlotW = 446;
  const roleSlotsLayout = [
    { slot: 1, x: rolesX + 22, y: bottomY + 38, w: slotW, h: 50 },
    { slot: 2, x: rolesX + 251, y: bottomY + 38, w: slotW, h: 50 },
    { slot: 3, x: rolesX + 22, y: bottomY + 96, w: slotW, h: 50 },
    { slot: 4, x: rolesX + 251, y: bottomY + 96, w: slotW, h: 50 },
    { slot: 5, x: rolesX + 22, y: bottomY + 154, w: fullSlotW, h: 50 },
  ];

  roleSlotsLayout.forEach(layout => {
    const isUnlocked = layout.slot <= profile.maxSlots;
    const roleItem = profile.roles.find(r => r.slot === layout.slot);

    drawRoundRect(ctx, layout.x, layout.y, layout.w, layout.h, 8);

    if (!isUnlocked) {
      // Slot bị khóa
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${layout.slot}] 🔒 Chưa mở khóa (/equip)`, layout.x + 14, layout.y + layout.h / 2);
    } else if (roleItem) {
      // Slot có trang bị Role
      const roleBg = ctx.createLinearGradient(layout.x, layout.y, layout.x + layout.w, layout.y + layout.h);
      if (roleItem.rarity === 'mythic') {
        roleBg.addColorStop(0, 'rgba(217, 70, 239, 0.35)');
        roleBg.addColorStop(1, 'rgba(244, 63, 94, 0.25)');
      } else {
        roleBg.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
        roleBg.addColorStop(1, 'rgba(147, 51, 234, 0.2)');
      }
      ctx.fillStyle = roleBg;
      ctx.fill();

      ctx.strokeStyle = roleItem.rarity === 'mythic' ? 'rgba(244, 114, 182, 0.65)' : 'rgba(96, 165, 250, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Số thứ tự Slot
      ctx.fillStyle = '#fde047';
      ctx.font = `bold 11.5px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${layout.slot}]`, layout.x + 12, layout.y + 16);

      // Tên Role (Line 1 - Căn giữa dọc thoáng đãng, lùi mép phải 16px)
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 11.5px ${FONT_FAMILY}`;
      const roleName = truncateText(ctx, roleItem.name, layout.w - 50);
      ctx.fillText(roleName, layout.x + 36, layout.y + 16);

      // Đặc Quyền Role (Line 2 - Căn giữa dọc thoáng đãng)
      ctx.fillStyle = roleItem.rarity === 'mythic' ? '#fbcfe8' : '#93c5fd';
      ctx.font = `10.5px ${FONT_FAMILY}`;
      const perkText = roleItem.perk || '✨ Quyền Năng Tiên Giới';
      const cleanPerk = truncateText(ctx, perkText, layout.w - 50);
      ctx.fillText(cleanPerk, layout.x + 36, layout.y + 35);
    } else {
      // Slot đã mở nhưng đang để trống
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${layout.slot}] ➕ Trống (/equip role)`, layout.x + 14, layout.y + layout.h / 2);
    }
  });
  ctx.restore();

  // ============================================================================
  // FOOTER CHỮ KÝ ĐẶC TRƯNG MÁY CHỦ SUMI FAMILY
  // ============================================================================
  ctx.save();
  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('🦊 SuMi Family • Trợ Lý Linh Hồ AI Nhiễm Nhiễm', width - 28, height - 16);
  ctx.restore();

  // Xuất ra PNG Buffer
  return canvas.toBuffer('image/png');
}

export default renderProfileCard;
