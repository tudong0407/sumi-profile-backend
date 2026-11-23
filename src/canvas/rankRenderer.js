import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  drawRoundRect,
  drawPetal,
  drawAntiAliasedAvatarWithBorder,
  preloadAvatarFrameOverlay,
  sanitizeText,
  loadBadgeImage,
  stripLeadingEmojis,
  drawIconText,
  drawAutoFitSingleLineText,
  encodeCanvas,
  FONT_FAMILY,
} from './drawUtils.js';

const RENDER_SCALE = 2;

/**
 * Render thẻ Rank Mini Tiên Giới SuMi Family Full HD+ (2000 x 410 px, 2x High-DPI)
 * Chuyên dụng cho lệnh /rank: Hiển thị nhanh Cấp độ, EXP, Cảnh giới, Gia tộc & Linh thạch
 * @param {Object} data Dữ liệu hồ sơ người dùng
 * @param {{ format?: 'png'|'webp', webpQuality?: number }} options
 * @returns {Promise<Buffer>} Buffer PNG hoặc WebP của ảnh Rank Mini
 */
export async function renderRankCard(data, options = {}) {
  const width = 1000;
  const height = 205;
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
    backgroundUrl: data.background_url || null,
    customTitle: sanitizeText(data.custom_title || 'Đệ Tử Ngoại Môn'),
    realm: sanitizeText(data.realm || 'I. Luyện Khí Sơ Kỳ'),
    level: Math.max(1, Number(data.level) || 1),
    exp: Math.max(0, Number(data.exp) || 0),
    nextExp: Math.max(1, Number(data.next_level_exp) || (data.level >= 100 ? 500000 : Math.floor(60 * Math.pow(data.level || 1, 1.45)))),
    linhThach: Math.max(0, Number(data.linh_thach) || 0),
    clan: data.clan || null,
    married: data.married || null,
  };

  const isOwner = profile.userId === '757091869183311872';
  const ringFile = (() => {
    const rId = String(data.marry_ring_id || data.married?.ring_id || '').toLowerCase();
    if (rId.includes('mythic')) return 'rings/ring_mythic.png';
    if (rId.includes('epic')) return 'rings/ring_epic.png';
    if (rId.includes('rare')) return 'rings/ring_rare.png';
    return 'rings/ring_common.png';
  })();

  // Tải hình nền, avatar & badge PNG tách nền an toàn
  const [bgImage, avatarImg, frameOverlayImg, icoClan, icoRing, icoLinhThach] = await Promise.all([
    loadImageSafe(profile.backgroundUrl, 1200, isOwner ? 'celestial_palace_pink.png' : 'default_background.png'),
    loadImageSafe(profile.avatarUrl, 1200, isOwner ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    preloadAvatarFrameOverlay(data.avatar_frame || 'default'),
    loadBadgeImage('badges/su_clan_castle.png'),
    loadBadgeImage(ringFile),
    loadBadgeImage('badges/su_linhthach.png'),
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
  // LỚP 2: AVATAR KHỬ RĂNG CƯA (4X SUPERSAMPLED) & KHUNG VIỀN PHÂN CẤP ĐỒNG TÂM
  // ============================================================================
  const avX = 46;
  const avY = 24;
  const avSize = 112;
  const avRadius = avSize / 2;
  const avCenterX = avX + avRadius;
  const avCenterY = avY + avRadius;

  drawAntiAliasedAvatarWithBorder(ctx, avatarImg, avCenterX, avCenterY, avRadius, {
    isOwner,
    level: profile.level,
    username: profile.username,
    avatarFrame: data.avatar_frame || 'default',
    frameOverlayImg,
    supersampleFactor: 4,
    showAura: true,
  });

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

  // Tên Người Dùng (Discord Username) — tự co chữ vừa khít vùng header trước cột Meta (metaBoxX = 515)
  ctx.save();
  ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
  ctx.shadowBlur = 9;
  drawAutoFitSingleLineText(ctx, profile.username, headerX, 39, 312, {
    maxFont: 24,
    minFont: 12,
    weight: 'bold',
    align: 'left',
    color: '#ffffff',
  });
  ctx.restore();

  // Danh Hiệu Tiên Chủ / Custom Title Pill (tự co cỡ chữ nếu quá dài)
  ctx.save();
  const titleY = 64;
  const titleText = `« ${profile.customTitle} »`;
  let titleFontSize = 12.5;
  for (; titleFontSize >= 8.5; titleFontSize -= 0.25) {
    ctx.font = `bold ${titleFontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(titleText).width + 20 <= 312) break;
  }
  ctx.font = `bold ${titleFontSize}px ${FONT_FAMILY}`;
  const titleMetrics = ctx.measureText(titleText);
  const titleW = Math.min(312, Math.max(120, titleMetrics.width + 20));

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
  ctx.fillText(titleText, headerX + titleW / 2, titleY + 12, titleW - 12);
  ctx.restore();

  // Cảnh Giới Tu Luyện (Realm)
  ctx.save();
  const realmY = 98;
  const realmText = `Cảnh Giới: ${profile.realm}`;
  let realmFontSize = 12.5;
  for (; realmFontSize >= 8.5; realmFontSize -= 0.25) {
    ctx.font = `${realmFontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(realmText).width + 20 <= 312) break;
  }
  ctx.font = `${realmFontSize}px ${FONT_FAMILY}`;
  const realmMetrics = ctx.measureText(realmText);
  const realmW = Math.min(312, Math.max(140, realmMetrics.width + 20));

  drawRoundRect(ctx, headerX, realmY, realmW, 24, 7);
  ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(realmText, headerX + realmW / 2, realmY + 12, realmW - 12);
  ctx.restore();

  // ============================================================================
  // LỚP 4: CỘT THÔNG TIN PHỤ BÊN PHẢI (GIA TỘC, TIÊN LỮ, LINH THẠCH)
  // ============================================================================
  const metaBoxX = 515;
  const metaBoxW = 437;
  const metaBoxH = 30;

  // Box 1: Gia Tộc (Clan)
  ctx.save();
  const clanY = 26;
  drawRoundRect(ctx, metaBoxX, clanY, metaBoxW, metaBoxH, 7);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.68)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const clanLblW = drawIconText(ctx, icoClan, 'Gia Tộc: ', metaBoxX + 12, clanY + metaBoxH / 2, {
    iconSize: 15,
    gap: 6,
    font: `bold 12px ${FONT_FAMILY}`,
    fillStyle: '#f472b6',
  });
  const clanValX = metaBoxX + 12 + Math.ceil(clanLblW) + 3;

  let clanStr = 'Chưa gia nhập bang hội';
  if (profile.clan) {
    const roleClan = profile.clan.is_leader ? 'Tộc Trưởng' : 'Tộc Viên';
    clanStr = `[${profile.clan.clan_name}] • ${roleClan} (Cấp ${profile.clan.clan_level})`;
  }
  drawAutoFitSingleLineText(ctx, clanStr, clanValX, clanY + metaBoxH / 2 + 0.5, metaBoxX + metaBoxW - 10 - clanValX, {
    maxFont: 12,
    minFont: 7.0,
    weight: '',
    align: 'left',
    color: '#ffffff',
  });
  ctx.restore();

  // Box 2: Tiên Lữ Kết Hôn (Marriage)
  ctx.save();
  const marryY = 62;
  drawRoundRect(ctx, metaBoxX, marryY, metaBoxW, metaBoxH, 7);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.68)';
  ctx.fill();
  const ringBorderKey = String(data.marry_ring_id || profile.married?.ring_id || '').toLowerCase();
  ctx.strokeStyle = profile.married
    ? (ringBorderKey.includes('mythic')
      ? 'rgba(251, 191, 36, 0.55)'
      : ringBorderKey.includes('epic')
        ? 'rgba(192, 132, 252, 0.5)'
        : ringBorderKey.includes('rare')
          ? 'rgba(96, 165, 250, 0.45)'
          : 'rgba(255, 255, 255, 0.25)')
    : 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = profile.married && ringBorderKey.includes('mythic') ? 1.3 : 1;
  ctx.stroke();

  const marryLblW = drawIconText(ctx, icoRing, 'Tiên Lữ: ', metaBoxX + 12, marryY + metaBoxH / 2, {
    iconSize: 15,
    gap: 6,
    font: `bold 12px ${FONT_FAMILY}`,
    fillStyle: '#fb7185',
  });
  const marryValX = metaBoxX + 12 + Math.ceil(marryLblW) + 3;

  let marryStr = 'Độc thân tu đạo';
  if (profile.married) {
    const cleanSpouse = stripLeadingEmojis(String(profile.married.username || '')).replace(/[💍]+/g, '').trim() || profile.married.username;
    let dateFmt = profile.married.date_formatted || '';
    if (!dateFmt && profile.married.date) {
      const dt = new Date(profile.married.date);
      if (!Number.isNaN(dt.getTime())) {
        const vn = new Date(dt.getTime() + 7 * 3600 * 1000);
        dateFmt = `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}/${vn.getUTCFullYear()}`;
      }
    }
    const daysNum = Number(profile.married.days);
    const daysText = Number.isFinite(daysNum) && profile.married.date
      ? ` (${daysNum} ngày)`
      : (profile.married.date ? ` (${Math.max(0, Math.floor((Date.now() - new Date(profile.married.date).getTime()) / 86400000))} ngày)` : '');
    marryStr = dateFmt ? `${cleanSpouse} • ${dateFmt}${daysText}` : `Đã kết hôn cùng ${cleanSpouse}`;
  }
  drawAutoFitSingleLineText(ctx, marryStr, marryValX, marryY + metaBoxH / 2 + 0.5, metaBoxX + metaBoxW - 10 - marryValX, {
    maxFont: 12,
    minFont: 7.0,
    weight: '',
    align: 'left',
    color: '#fed7aa',
  });
  ctx.restore();

  // Box 3: Số Dư Linh Thạch (Linh Thach Balance)
  ctx.save();
  const stoneY = 98;
  drawRoundRect(ctx, metaBoxX, stoneY, metaBoxW, metaBoxH, 7);
  const stoneBg = ctx.createLinearGradient(metaBoxX, stoneY, metaBoxX + metaBoxW, stoneY + metaBoxH);
  stoneBg.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
  stoneBg.addColorStop(1, 'rgba(30, 41, 59, 0.62)');
  ctx.fillStyle = stoneBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const stoneLblW = drawIconText(ctx, icoLinhThach, 'Linh Thạch: ', metaBoxX + 12, stoneY + metaBoxH / 2, {
    iconSize: 15,
    gap: 6,
    font: `bold 12px ${FONT_FAMILY}`,
    fillStyle: '#38bdf8',
  });
  const stoneValX = metaBoxX + 12 + Math.ceil(stoneLblW) + 3;

  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 6;
  const stoneStr = `${profile.linhThach.toLocaleString('vi-VN')} Viên`;
  drawAutoFitSingleLineText(ctx, stoneStr, stoneValX, stoneY + metaBoxH / 2 + 0.5, metaBoxX + metaBoxW - 10 - stoneValX, {
    maxFont: 13,
    minFont: 8.0,
    weight: 'bold',
    align: 'left',
    color: '#7dd3fc',
  });
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

  // Xuất ra PNG hoặc WebP Buffer
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}

export default renderRankCard;
