import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  drawRoundRect,
  drawPetal,
  drawAntiAliasedAvatarWithBorder,
  preloadAvatarFrameOverlay,
  sanitizeText,
  resolveAssetPath,
  loadBadgeImage,
  stripLeadingEmojis,
  drawIconText,
  drawAutoFitSingleLineText,
  drawAutoFitIconText,
  encodeCanvas,
  FONT_FAMILY,
} from './drawUtils.js';
import {
  normalizeEnchantGrade,
  ENCHANT_GRADES,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
} from '../data/catalog.js';
import { computeEffectiveDomainEnergy } from '../services/battleEngine/domainEngine.js';

const RENDER_SCALE = 2;

function drawProfileGradeBadge(ctx, gradeBadges, rawGrade, x, y, size = 18) {
  const grade = normalizeEnchantGrade(rawGrade || 'D');
  const img = gradeBadges?.[grade] || null;
  if (img) {
    ctx.drawImage(img, x, y, size, size);
    return;
  }
  const meta = ENCHANT_GRADES[grade] || ENCHANT_GRADES.D;
  ctx.save();
  drawRoundRect(ctx, x, y, size, size, 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = meta.color;
  ctx.font = `bold ${Math.round(size * 0.62)}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, x + size / 2, y + size / 2 + 0.5);
  ctx.restore();
}

function resolveProfileDomainLoadout(raw = {}) {
  const d = typeof raw.domain === 'string'
    ? DOMAIN_BY_ID[raw.domain]
    : (raw.domain || (raw.domain_id ? DOMAIN_BY_ID[raw.domain_id] : null));
  const s = typeof raw.sense === 'string'
    ? DIVINE_SENSE_BY_ID[raw.sense]
    : (raw.sense || (raw.sense_id ? DIVINE_SENSE_BY_ID[raw.sense_id] : null));
  const r = typeof raw.realm === 'string'
    ? DIVINE_REALM_BY_ID[raw.realm]
    : (raw.realm || (raw.realm_id ? DIVINE_REALM_BY_ID[raw.realm_id] : null));
  return { domain: d || null, sense: s || null, realm: r || null };
}

function getProfileSlotColors(rarity) {
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
  if (r.includes('toi thuong') || r.includes('supreme')) {
    return {
      borderGrad: ['#ec4899', '#fbbf24'],
      glow: '#ec4899',
      blur: 9,
      text: '#fbcfe8',
      bg1: 'rgba(236, 72, 153, 0.28)',
      bg2: 'rgba(251, 191, 36, 0.18)',
    };
  }
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

/**
 * Render thẻ Profile Tiên Giới SuMi Family Full HD+ (2000 x 1000 px, 2x High-DPI)
 * @param {Object} data Dữ liệu hồ sơ người dùng
 * @param {{ format?: 'png'|'webp', webpQuality?: number }} options
 * @returns {Promise<Buffer>} Buffer PNG hoặc WebP của ảnh hồ sơ
 */
export async function renderProfileCard(data, options = {}) {
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
    nextExp: Math.max(1, Number(data.next_level_exp) || (data.level >= 100 ? 500000 : Math.floor(78 * Math.pow(data.level || 1, 1.45)))),
    linhThach: Math.max(0, Number(data.linh_thach) || 0),
    maxSlots: Math.min(5, Math.max(1, Number(data.max_role_slots) || 1)),
    clan: data.clan || null,
    married: data.married || null,
    pet: data.pet || null,
    roles: Array.isArray(data.equipped_roles) ? data.equipped_roles : [],
    domainLoadout: resolveProfileDomainLoadout(data.domain_loadout || data.domainLoadout || {}),
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

  const dl = profile.domainLoadout;
  const domainAsset = dl.domain?.domain_id ? `domains/${dl.domain.domain_id}.png` : null;
  const senseAsset = dl.sense?.sense_id ? `domains/${dl.sense.sense_id}.png` : null;
  const realmAsset = dl.realm?.realm_id ? `domains/${dl.realm.realm_id}.png` : null;

  const petIconRel = petType && petType !== 'cuu_vi_hong_ho'
    ? (resolveAssetPath(`pets/icons/${petType}.png`) ? `pets/icons/${petType}.png` : 'badges/su_fox_mascot.png')
    : 'badges/su_fox_mascot.png';

  const ringFile = (() => {
    const rId = String(data.marry_ring_id || data.married?.ring_id || '').toLowerCase();
    if (rId.includes('mythic')) return 'rings/ring_mythic.png';
    if (rId.includes('epic')) return 'rings/ring_epic.png';
    if (rId.includes('rare')) return 'rings/ring_rare.png';
    return 'rings/ring_common.png';
  })();

  const [
    bgImage, avatarImg, frameOverlayImg, petImg, weaponImg, gemImg, soulImg,
    domainImg, senseImg, realmImg,
    icoClan, icoRing, icoLinhThach, icoPaw, icoPetMini, icoFox, icoBolt, icoSwords, icoShield, icoSparkle, icoGemSlot,
    gD, gC, gB, gA, gS,
  ] = await Promise.all([
    loadImageSafe(profile.backgroundUrl, 1200, isOwner ? 'celestial_palace_pink.png' : 'default_background.png'),
    loadImageSafe(profile.avatarUrl, 1200, isOwner ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    preloadAvatarFrameOverlay(profile.avatarFrame),
    loadImageSafe(profile.pet?.image_url, 1500, petAsset),
    weaponSource ? loadImageSafe(weaponSource, 2000, weaponFallback) : null,
    gemSource ? loadImageSafe(gemSource, 2000, gemFallback) : null,
    soulSource ? loadImageSafe(soulSource, 2000, soulFallback) : null,
    domainAsset ? loadImageSafe(domainAsset, 2000, null) : null,
    senseAsset ? loadImageSafe(senseAsset, 2000, null) : null,
    realmAsset ? loadImageSafe(realmAsset, 2000, null) : null,
    loadBadgeImage('badges/su_clan_castle.png'),
    loadBadgeImage(ringFile),
    loadBadgeImage('badges/su_linhthach.png'),
    loadBadgeImage('badges/su_pet_paw.png'),
    loadBadgeImage(petIconRel),
    loadBadgeImage('badges/su_fox_mascot.png'),
    loadBadgeImage('badges/su_thunder_hax.png'),
    loadBadgeImage('badges/su_crossed_swords.png'),
    loadBadgeImage('badges/su_shield_def.png'),
    loadBadgeImage('badges/su_sparkle.png'),
    loadBadgeImage('badges/su_linhthach.png'),
    loadBadgeImage('badges/grade_d.png'),
    loadBadgeImage('badges/grade_c.png'),
    loadBadgeImage('badges/grade_b.png'),
    loadBadgeImage('badges/grade_a.png'),
    loadBadgeImage('badges/grade_s.png'),
  ]);
  const gradeBadges = { D: gD, C: gC, B: gB, A: gA, S: gS };

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
    frameOverlayImg,
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

  // Tên Người Dùng (Discord Username) - tự co chữ vừa khít vùng header trước cột Meta (metaBoxX = 515)
  ctx.save();
  ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
  ctx.shadowBlur = 10;
  drawAutoFitSingleLineText(ctx, profile.username, headerX, 49, 308, {
    maxFont: 25,
    minFont: 13,
    weight: 'bold',
    align: 'left',
    color: '#ffffff',
  });
  ctx.restore();

  // Danh Hiệu Tiên Chủ / Custom Title Pill (tự co cỡ chữ nếu quá dài để không tràn sang cột Meta)
  ctx.save();
  const titleY = 74;
  const titleText = `« ${profile.customTitle} »`;
  let titleFontSize = 13;
  for (; titleFontSize >= 8.5; titleFontSize -= 0.25) {
    ctx.font = `bold ${titleFontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(titleText).width + 20 <= 308) break;
  }
  ctx.font = `bold ${titleFontSize}px ${FONT_FAMILY}`;
  const titleMetrics = ctx.measureText(titleText);
  const titleW = Math.min(308, Math.max(120, titleMetrics.width + 20));

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
  ctx.fillText(titleText, headerX + titleW / 2, titleY + 13, titleW - 12);
  ctx.restore();

  // Cảnh Giới Tu Luyện (Realm)
  ctx.save();
  const realmY = 110;
  const realmText = `Cảnh Giới: ${profile.realm}`;
  let realmFontSize = 13;
  for (; realmFontSize >= 8.5; realmFontSize -= 0.25) {
    ctx.font = `${realmFontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(realmText).width + 20 <= 308) break;
  }
  ctx.font = `${realmFontSize}px ${FONT_FAMILY}`;
  const realmMetrics = ctx.measureText(realmText);
  const realmW = Math.min(308, Math.max(140, realmMetrics.width + 20));

  drawRoundRect(ctx, headerX, realmY, realmW, 25, 8);
  ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(realmText, headerX + realmW / 2, realmY + 13, realmW - 12);
  ctx.restore();

  // ============================================================================
  // LỚP 4: CỘT THÔNG TIN PHỤ BÊN PHẢI (GIA TỘC, TIÊN LỮ, LINH THẠCH)
  // Đẩy sang trái (metaBoxX = 515, metaBoxW = 435) để tên Gia Tộc hiển thị đầy đủ không cắt cụt
  // ============================================================================
  const metaBoxX = 515;
  const metaBoxW = 435;
  const metaBoxH = 32;

  // Box 1: Gia Tộc (Clan)
  ctx.save();
  const clanY = 34;
  drawRoundRect(ctx, metaBoxX, clanY, metaBoxW, metaBoxH, 8);
  ctx.fillStyle = 'rgba(23, 17, 43, 0.68)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const clanLabel = 'Gia Tộc: ';
  ctx.font = `bold 12.5px ${FONT_FAMILY}`;
  const clanLblW = drawIconText(ctx, icoClan, clanLabel, metaBoxX + 12, clanY + metaBoxH / 2, {
    iconSize: 16,
    gap: 6,
    font: `bold 12.5px ${FONT_FAMILY}`,
    fillStyle: '#f472b6',
  });
  const clanValX = metaBoxX + 12 + Math.ceil(clanLblW) + 3;

  let clanStr = 'Chưa gia nhập bang hội';
  if (profile.clan) {
    const roleClan = profile.clan.is_leader ? 'Tộc Trưởng' : 'Tộc Viên';
    clanStr = `[${profile.clan.clan_name}] • ${roleClan} (Cấp ${profile.clan.clan_level})`;
  }
  drawAutoFitSingleLineText(ctx, clanStr, clanValX, clanY + metaBoxH / 2 + 0.5, metaBoxX + metaBoxW - 10 - clanValX, {
    maxFont: 12.5,
    minFont: 7.0,
    weight: '',
    align: 'left',
    color: '#ffffff',
  });
  ctx.restore();

  // Box 2: Tiên Lữ Kết Hôn (Marriage)
  ctx.save();
  const marryY = 74;
  drawRoundRect(ctx, metaBoxX, marryY, metaBoxW, metaBoxH, 8);
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

  const marryLabel = 'Tiên Lữ: ';
  const marryLblW = drawIconText(ctx, icoRing, marryLabel, metaBoxX + 12, marryY + metaBoxH / 2, {
    iconSize: 16,
    gap: 6,
    font: `bold 12.5px ${FONT_FAMILY}`,
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
    maxFont: 12.5,
    minFont: 7.0,
    weight: '',
    align: 'left',
    color: '#fed7aa',
  });
  ctx.restore();

  // Box 3: Số Dư Linh Thạch (Linh Thach Balance)
  ctx.save();
  const stoneY = 114;
  drawRoundRect(ctx, metaBoxX, stoneY, metaBoxW, metaBoxH, 8);
  const stoneBg = ctx.createLinearGradient(metaBoxX, stoneY, metaBoxX + metaBoxW, stoneY + metaBoxH);
  stoneBg.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
  stoneBg.addColorStop(1, 'rgba(30, 41, 59, 0.62)');
  ctx.fillStyle = stoneBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const stoneLabel = 'Linh Thạch: ';
  const stoneLblW = drawIconText(ctx, icoLinhThach, stoneLabel, metaBoxX + 12, stoneY + metaBoxH / 2, {
    iconSize: 16,
    gap: 6,
    font: `bold 12.5px ${FONT_FAMILY}`,
    fillStyle: '#38bdf8',
  });
  const stoneValX = metaBoxX + 12 + Math.ceil(stoneLblW) + 3;

  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 6;
  const stoneStr = `${profile.linhThach.toLocaleString('vi-VN')} Viên`;
  drawAutoFitSingleLineText(ctx, stoneStr, stoneValX, stoneY + metaBoxH / 2 + 0.5, metaBoxX + metaBoxW - 10 - stoneValX, {
    maxFont: 13.5,
    minFont: 8.0,
    weight: 'bold',
    align: 'left',
    color: '#7dd3fc',
  });
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
  // Mở rộng petW lên 490px (+100px từ bảng Roles) để hiển thị trọn vẹn tên Linh Thú & Pháp Bảo
  // ----------------------------------------------------------------------------
  const petW = 490;
  const petX = 50;

  ctx.save();
  drawRoundRect(ctx, petX, bottomY, petW, bottomH, 16);
  ctx.fillStyle = 'rgba(18, 14, 32, 0.78)';
  ctx.fill();
  const petBorder = ctx.createLinearGradient(petX, bottomY, petX + petW, bottomY + bottomH);
  petBorder.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
  petBorder.addColorStop(1, 'rgba(244, 63, 94, 0.4)');
  ctx.strokeStyle = petBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tiêu đề Pet Header
  drawIconText(ctx, icoPaw, 'LINH THÚ XUẤT TRẬN', petX + 20, bottomY + 20, {
    iconSize: 15,
    gap: 6,
    font: `bold 13px ${FONT_FAMILY}`,
    fillStyle: '#fdba74',
  });

  if (profile.pet) {
    const hasPetImg = !!petImg;
    // Khung Linh Thú Chuyên Biệt
    const petFrameW = 94;
    const petFrameH = 78;
    const petFrameX = petX + petW - 18 - petFrameW;
    const petFrameY = bottomY + 23;
    const leftTextW = petFrameX - petX - 30;

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

    // Tên Linh Thú (PNG mini icon + chữ trắng phát sáng tự co cỡ chữ, không cắt cụt)
    ctx.save();
    ctx.shadowColor = 'rgba(255, 105, 180, 0.6)';
    ctx.shadowBlur = 8;
    drawAutoFitIconText(ctx, icoPetMini, profile.pet.name, petX + 20, bottomY + 44, leftTextW, {
      iconSize: 18,
      gap: 6,
      maxFont: 15,
      minFont: 9.0,
      weight: 'bold',
      color: '#ffffff',
    });
    ctx.restore();

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

    // 3. Pill Số Sao gọn (10★ — Vàng Hổ Phách)
    const petStars = Math.max(1, Number(profile.pet.star) || 1);
    const starStr = `${petStars}★`;
    const starMetrics = ctx.measureText(starStr);
    const starPillW = starMetrics.width + 12;
    const starPillX = lvlPillX + lvlPillW + 6;
    const starPillY = elemPillY;

    drawRoundRect(ctx, starPillX, starPillY, starPillW, 18, 5);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.fillText(starStr, starPillX + starPillW / 2, starPillY + 9);
    ctx.textAlign = 'left';

    // 4. Huy hiệu Phẩm Chất Khắc Ấn Pet (D -> S)
    drawProfileGradeBadge(ctx, gradeBadges, profile.pet.enchant_grade || 'D', starPillX + starPillW + 6, elemPillY - 1, 20);

    // Kỹ năng HAX Lật Kèo (HAX Skill Badge — tự co cỡ chữ, không cắt cụt)
    const haxName = profile.pet.hax_skill || 'Tuyệt Kỹ Phá Cách (HAX)';
    ctx.save();
    ctx.shadowColor = 'rgba(253, 224, 71, 0.5)';
    ctx.shadowBlur = 5;
    drawAutoFitIconText(ctx, icoBolt, haxName, petX + 20, bottomY + 90, leftTextW, {
      iconSize: 14,
      gap: 5,
      maxFont: 11,
      minFont: 7.0,
      weight: 'bold',
      color: '#fde047',
    });
    ctx.restore();

    // Bảng Chiến Lực Nổi Bật (Power Score Box)
    const powerBoxX = petX + 16;
    const powerBoxW = petW - 32;
    const powerBoxY = bottomY + 104;
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

    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
    ctx.shadowBlur = 7;
    const powerFormatted = (profile.pet.power || 0).toLocaleString('vi-VN');
    drawIconText(ctx, icoSwords, `Chiến Lực: ${powerFormatted}`, powerBoxX + powerBoxW / 2, powerBoxY + powerBoxH / 2, {
      iconSize: 15,
      gap: 6,
      align: 'center',
      font: `bold 12.5px ${FONT_FAMILY}`,
      fillStyle: '#fef08a',
    });
    ctx.restore();

    // Thuộc tính chi tiết của Linh Thú (GIỮ LẠI theo A1 — thay icon Unicode bằng PNG badge sắc nét)
    const statsY = bottomY + 141;
    const atkStr = `ATK: ${(profile.pet.atk || 0).toLocaleString('vi-VN')}`;
    const defStr = `DEF: ${(profile.pet.def || 0).toLocaleString('vi-VN')}`;
    const spdStr = `SPD: ${(profile.pet.spd || 0).toLocaleString('vi-VN')}`;
    const col1X = petX + 20;
    const col2X = petX + 172;
    const col3X = petX + 324;
    drawIconText(ctx, icoSwords, atkStr, col1X, statsY, { iconSize: 13, gap: 5, font: `bold 11px ${FONT_FAMILY}`, fillStyle: '#fca5a5' });
    drawIconText(ctx, icoShield, defStr, col2X, statsY, { iconSize: 13, gap: 5, font: `bold 11px ${FONT_FAMILY}`, fillStyle: '#93c5fd' });
    drawIconText(ctx, icoBolt, spdStr, col3X, statsY, { iconSize: 13, gap: 5, font: `bold 11px ${FONT_FAMILY}`, fillStyle: '#fde047' });

    // ========================================================================
    // 3 SLOTS TRANG BỊ LINH THÚ (Vũ Khí, Bảo Ngọc, Chiến Hồn)
    // Bỏ dòng stats +720ATK bên trong thẻ; hiển thị ĐẦY ĐỦ tên 1 dòng không cắt cụt, không xuống dòng!
    // ========================================================================
    const equipY = bottomY + 157;
    const equipH = 68;
    const equipPadX = 16;
    const availEquipW = petW - equipPadX * 2;
    const equipGap = 7;
    const slotW = Math.floor((availEquipW - equipGap * 2) / 3);

    const slotConfigs = [
      { key: 'weapon', label: 'VŨ KHÍ', badgeImg: icoSwords },
      { key: 'gem', label: 'BẢO NGỌC', badgeImg: icoGemSlot },
      { key: 'soul', label: 'CHIẾN HỒN', badgeImg: icoFox },
    ];

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
        const colors = getProfileSlotColors(item.rarity);
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

        const cleanName = (item.item_name || 'Vật Phẩm').replace(/[«»]/g, '').trim();

        if (itemImg) {
          // Layout mới thoáng & rõ: Hàng trên Thumbnail 30x30 + Nhãn Slot; Hàng dưới ĐẦY ĐỦ Tên 1 dòng (không cắt, không stats)
          const thumbSize = 30;
          const thumbX = sx + 10;
          const thumbY = sy + 7;

          ctx.save();
          drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
          ctx.clip();
          ctx.drawImage(itemImg, 0, 0, itemImg.width, itemImg.height, thumbX, thumbY, thumbSize, thumbSize);
          ctx.restore();

          ctx.save();
          drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
          ctx.strokeStyle = colors.borderGrad[0];
          ctx.lineWidth = 1.2;
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.restore();

          // Nhãn loại slot (VŨ KHÍ / BẢO NGỌC / CHIẾN HỒN) ở bên phải ảnh
          drawIconText(ctx, cfg.badgeImg, cfg.label, thumbX + thumbSize + 7, thumbY + thumbSize / 2, {
            iconSize: 12,
            gap: 4,
            font: `bold 9.5px ${FONT_FAMILY}`,
            fillStyle: colors.text,
          });
          drawProfileGradeBadge(ctx, gradeBadges, item.enchant_grade || 'D', thumbX + thumbSize - 11, thumbY + thumbSize - 11, 16);

          // Tên đầy đủ 1 dòng duy nhất, tự thu nhỏ cỡ chữ vừa khít slotW - 10 (tuyệt đối không cắt cụt, không xuống dòng)
          drawAutoFitSingleLineText(ctx, cleanName, sx + slotW / 2, sy + 52, slotW - 10, {
            maxFont: 10.5,
            minFont: 6.0,
            weight: 'bold',
            align: 'center',
            color: '#ffffff',
          });
        } else {
          // Fallback nếu không có ảnh món đồ
          drawIconText(ctx, cfg.badgeImg, cfg.label, sx + slotW / 2, sy + 18, {
            iconSize: 13,
            gap: 5,
            align: 'center',
            font: `bold 9.5px ${FONT_FAMILY}`,
            fillStyle: colors.text,
          });
          drawProfileGradeBadge(ctx, gradeBadges, item.enchant_grade || 'D', sx + slotW - 21, sy + 5, 16);
          drawAutoFitSingleLineText(ctx, cleanName, sx + slotW / 2, sy + 46, slotW - 10, {
            maxFont: 10.5,
            minFont: 6.0,
            weight: 'bold',
            align: 'center',
            color: '#ffffff',
          });
        }
      } else {
        // Slot trống (sạch bóng Unicode)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        drawIconText(ctx, cfg.badgeImg, cfg.label, sx + slotW / 2, sy + 20, {
          iconSize: 12,
          gap: 4,
          align: 'center',
          font: `bold 9.5px ${FONT_FAMILY}`,
          fillStyle: '#64748b',
        });

        ctx.font = `10.5px ${FONT_FAMILY}`;
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('— Trống —', sx + slotW / 2, sy + 48);
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
    ctx.fillText('Dùng lệnh /linhthu hoặc /roll để triệu hồi!', petX + petW / 2, bottomY + 135);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ----------------------------------------------------------------------------
  // BẢNG 6B: ROLES QUYỀN NĂNG (TRÊN) + LINH VỰC • THẦN THỨC • THẦN CẢNH (DƯỚI)
  // ----------------------------------------------------------------------------
  const rolesX = 558;
  const rolesW = 392;

  ctx.save();
  drawRoundRect(ctx, rolesX, bottomY, rolesW, bottomH, 16);
  ctx.fillStyle = 'rgba(18, 14, 32, 0.78)';
  ctx.fill();
  const rolesBorder = ctx.createLinearGradient(rolesX, bottomY, rolesX + rolesW, bottomY + bottomH);
  rolesBorder.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
  rolesBorder.addColorStop(1, 'rgba(236, 72, 153, 0.45)');
  ctx.strokeStyle = rolesBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tiêu đề Roles Header
  drawIconText(ctx, icoSparkle, 'ROLES QUYỀN NĂNG', rolesX + 14, bottomY + 17, {
    iconSize: 14,
    gap: 6,
    font: `bold 12px ${FONT_FAMILY}`,
    fillStyle: '#c084fc',
  });

  ctx.font = `10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Slot: ${profile.maxSlots}/5`, rolesX + rolesW - 14, bottomY + 17);
  ctx.textAlign = 'left';

  // 5 Slots Role gọn 32px/hàng (y = bottomY + 28..132) để dành phần đáy cho Linh Vực • Thần Thức • Thần Cảnh
  const rSlotW = 178;
  const rFullSlotW = 364;
  const rSlotH = 32;
  const roleSlotsLayout = [
    { slot: 1, x: rolesX + 14, y: bottomY + 28, w: rSlotW, h: rSlotH },
    { slot: 2, x: rolesX + 200, y: bottomY + 28, w: rSlotW, h: rSlotH },
    { slot: 3, x: rolesX + 14, y: bottomY + 64, w: rSlotW, h: rSlotH },
    { slot: 4, x: rolesX + 200, y: bottomY + 64, w: rSlotW, h: rSlotH },
    { slot: 5, x: rolesX + 14, y: bottomY + 100, w: rFullSlotW, h: rSlotH },
  ];

  roleSlotsLayout.forEach((layout) => {
    const isUnlocked = layout.slot <= profile.maxSlots;
    const roleItem = profile.roles.find((r) => r.slot === layout.slot);

    drawRoundRect(ctx, layout.x, layout.y, layout.w, layout.h, 7);

    if (!isUnlocked) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawAutoFitSingleLineText(ctx, `[${layout.slot}] Chưa mở (/equip)`, layout.x + 10, layout.y + layout.h / 2, layout.w - 18, {
        maxFont: 9.8,
        minFont: 7.0,
        weight: '',
        align: 'left',
        color: '#64748b',
      });
    } else if (roleItem) {
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

      ctx.fillStyle = '#fde047';
      ctx.font = `bold 9.5px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${layout.slot}]`, layout.x + 7, layout.y + 10.5);

      drawAutoFitSingleLineText(ctx, roleItem.name, layout.x + 24, layout.y + 10.5, layout.w - 30, {
        maxFont: 9.8,
        minFont: 6.2,
        weight: 'bold',
        align: 'left',
        color: '#ffffff',
      });

      const cleanPerkRaw = stripLeadingEmojis(roleItem.perk || 'Quyền Năng Tiên Giới');
      drawAutoFitIconText(ctx, icoSparkle, cleanPerkRaw, layout.x + 24, layout.y + 23.5, layout.w - 30, {
        iconSize: 10,
        gap: 4,
        maxFont: 8.8,
        minFont: 6.0,
        weight: '',
        color: roleItem.rarity === 'mythic' ? '#fbcfe8' : '#93c5fd',
      });
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawAutoFitSingleLineText(ctx, `[${layout.slot}] Trống (/equip role)`, layout.x + 10, layout.y + layout.h / 2, layout.w - 18, {
        maxFont: 9.8,
        minFont: 7.0,
        weight: '',
        align: 'left',
        color: '#94a3b8',
      });
    }
  });

  // Đường phân cách + Header LINH VỰC • THẦN THỨC • THẦN CẢNH
  ctx.beginPath();
  ctx.moveTo(rolesX + 14, bottomY + 136);
  ctx.lineTo(rolesX + rolesW - 14, bottomY + 136);
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const domHeaderY = bottomY + 144;
  drawIconText(ctx, icoFox, 'LINH VỰC • THẦN THỨC • THẦN CẢNH', rolesX + 14, domHeaderY, {
    iconSize: 13,
    gap: 5,
    font: `bold 11px ${FONT_FAMILY}`,
    fillStyle: '#f472b6',
  });

  if (dl.domain) {
    const energyCalc = computeEffectiveDomainEnergy({
      domain: dl.domain,
      sense: dl.sense,
      equipment: pet?.equipment || {},
      setBonus: pet?.set_bonus || null,
    });
    const lmTotal = energyCalc.isInfinite ? '∞' : energyCalc.totalEnergy;
    const domTag = `${dl.domain.element} • ${lmTotal} Mạch`;
    ctx.font = `bold 9px ${FONT_FAMILY}`;
    const dw = ctx.measureText(domTag).width + 12;
    const dx = rolesX + rolesW - 14 - dw;
    drawRoundRect(ctx, dx, domHeaderY - 8, dw, 16, 5);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fbcfe8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(domTag, dx + dw / 2, domHeaderY);
  } else {
    ctx.font = `9.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chưa khai mở', rolesX + rolesW - 14, domHeaderY);
  }

  // 3 Thẻ Linh Vực / Thần Thức / Thần Cảnh ngang hàng với 3 Pháp Bảo (sy = bottomY + 157, h = 68)
  const domEquipY = bottomY + 157;
  const domEquipH = 68;
  const domPadX = 14;
  const domGap = 7;
  const domSlotW = Math.floor((rolesW - domPadX * 2 - domGap * 2) / 3); // 116
  const domDefs = [
    {
      label: 'LINH VỰC',
      badgeImg: icoFox,
      item: dl.domain,
      img: domainImg,
      sub: dl.domain ? (dl.domain.element || 'Linh Vực') : 'Trống',
    },
    {
      label: 'THẦN THỨC',
      badgeImg: icoSparkle,
      item: dl.sense,
      img: senseImg,
      sub: dl.sense ? `+${dl.sense.bonus_energy >= 999 ? '∞' : dl.sense.bonus_energy} Linh Mạch` : 'Trống',
    },
    {
      label: 'THẦN CẢNH',
      badgeImg: icoBolt,
      item: dl.realm,
      img: realmImg,
      sub: dl.realm ? `+${Math.round((dl.realm.debuff_boost_pct || 0) * 100)}% Áp Chế` : 'Trống',
    },
  ];

  domDefs.forEach((cfg, idx) => {
    const sx = rolesX + domPadX + idx * (domSlotW + domGap);
    const sy = domEquipY;
    const item = cfg.item;

    drawRoundRect(ctx, sx, sy, domSlotW, domEquipH, 7);
    if (item) {
      const colors = getProfileSlotColors(item.rarity || 'Thần Thoại');
      const sBg = ctx.createLinearGradient(sx, sy, sx + domSlotW, sy + domEquipH);
      sBg.addColorStop(0, colors.bg1);
      sBg.addColorStop(1, colors.bg2);
      ctx.fillStyle = sBg;
      ctx.fill();

      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = colors.blur;
      const sBorder = ctx.createLinearGradient(sx, sy, sx + domSlotW, sy + domEquipH);
      sBorder.addColorStop(0, colors.borderGrad[0]);
      sBorder.addColorStop(1, colors.borderGrad[1]);
      ctx.strokeStyle = sBorder;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();

      const cleanName = sanitizeText(item.name || '').replace(/[«»]/g, '').trim();
      const thumbSize = 30;
      const thumbX = sx + 7;
      const thumbY = sy + 7;

      if (cfg.img) {
        ctx.save();
        drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
        ctx.clip();
        ctx.drawImage(cfg.img, 0, 0, cfg.img.width, cfg.img.height, thumbX, thumbY, thumbSize, thumbSize);
        ctx.restore();

        ctx.save();
        drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
        ctx.strokeStyle = colors.borderGrad[0];
        ctx.lineWidth = 1.2;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
      } else if (cfg.badgeImg) {
        drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5);
        ctx.fillStyle = 'rgba(15, 10, 28, 0.85)';
        ctx.fill();
        ctx.drawImage(cfg.badgeImg, thumbX + 6, thumbY + 6, thumbSize - 12, thumbSize - 12);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 8.5px ${FONT_FAMILY}`;
      ctx.fillStyle = colors.text;
      ctx.fillText(cfg.label, thumbX + thumbSize + 5, thumbY + 9);

      drawAutoFitSingleLineText(ctx, cfg.sub, thumbX + thumbSize + 5, thumbY + 22, domSlotW - (thumbSize + 16), {
        maxFont: 8.0,
        minFont: 6.0,
        weight: 'bold',
        align: 'left',
        color: '#e2e8f0',
      });

      drawAutoFitSingleLineText(ctx, cleanName, sx + domSlotW / 2, sy + 52, domSlotW - 8, {
        maxFont: 9.5,
        minFont: 6.0,
        weight: 'bold',
        align: 'center',
        color: '#ffffff',
      });
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawIconText(ctx, cfg.badgeImg, cfg.label, sx + domSlotW / 2, sy + 20, {
        iconSize: 11,
        gap: 4,
        align: 'center',
        font: `bold 8.8px ${FONT_FAMILY}`,
        fillStyle: '#64748b',
      });
      ctx.font = `9.5px ${FONT_FAMILY}`;
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('— Trống —', sx + domSlotW / 2, sy + 48);
    }
  });
  ctx.restore();

  // ============================================================================
  // FOOTER CHỮ KÝ ĐẶC TRƯNG MÁY CHỦ SUMI FAMILY (ICON LINH HỒ TÁCH NỀN)
  // ============================================================================
  drawIconText(ctx, icoFox, 'SuMi Family • Trợ Lý Linh Hồ AI Nhiễm Nhiễm', width - 28, height - 22, {
    iconSize: 14,
    gap: 5,
    align: 'right',
    font: `11px ${FONT_FAMILY}`,
    fillStyle: 'rgba(226, 232, 240, 0.55)',
  });

  // Xuất ra PNG hoặc WebP Buffer
  return encodeCanvas(canvas, options.format || 'png', options.webpQuality ?? 86);
}

export default renderProfileCard;
