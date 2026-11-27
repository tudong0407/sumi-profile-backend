/**
 * src/canvas/teamBattleRenderer.js
 * Canvas Chiến Báo Tổ Đội (1–3 người vs BOSS hoặc 3v3) cho Chiếm Đoạt Linh Mạch v1.4:
 * - Khổ 2000 × 1150 sắc nét (hỗ trợ WebP/PNG).
 * - Thu gọn tinh tế vừa khít 3 thành viên mỗi phe (hoặc 3 người vs 1 Boss Khổng Lồ với tranh vẽ tay `assets/veins/`).
 * - Hiển thị góc Linh Vực của Đội Trưởng kèm 2 icon nhỏ Thần Thức & Thần Cảnh (chuẩn bố cục v1.3.1!).
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FONT_FAMILY,
  sanitizeText,
  resolveAssetPath,
  resolvePetSplashAsset,
  loadImageSafe,
  drawAntiAliasedAvatarWithBorder,
  preloadAvatarFrameOverlay,
  drawElementalPetBorderFX,
} from './drawUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let PET_IMAGE_MAP = {};
try {
  PET_IMAGE_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/pet_mapping.json'), 'utf8'));
} catch {
  PET_IMAGE_MAP = {};
}

const WIDTH = 2000;
const HEIGHT = 1150;

const GRADE_COLORS = {
  S: '#f59e0b',
  A: '#ec4899',
  B: '#a855f7',
  C: '#38bdf8',
  D: '#94a3b8',
};

function drawRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

async function safeLoadImage(pathOrUrl) {
  return loadImageSafe(pathOrUrl, 1500, null);
}

function drawClippedImage(ctx, img, x, y, size, radius = 14) {
  if (!img) return;
  ctx.save();
  drawRoundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  const ratio = Math.max(size / img.width, size / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  ctx.restore();
}

function truncateText(ctx, text, maxW) {
  const s = sanitizeText(text);
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 2 && ctx.measureText(`${out}…`).width > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

async function drawLeaderDomainCorner(ctx, domainInfo, x, y, w, h, accentColor, customLabel = 'LINH VỰC ĐỘI TRƯỞNG') {
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = 'rgba(20, 14, 34, 0.88)';
  ctx.fill();
  ctx.strokeStyle = domainInfo ? accentColor : 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!domainInfo) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      customLabel.includes('BOSS') ? 'Boss Không Dùng Linh Vực' : 'Đội Trưởng Chưa Mở Linh Vực',
      x + w / 2,
      y + h / 2 + 6,
    );
    ctx.restore();
    return;
  }

  const domImg = await safeLoadImage(`domains/${domainInfo.domain_id}.png`) || await safeLoadImage(`${domainInfo.domain_id}.png`);
  if (domImg) {
    drawClippedImage(ctx, domImg, x + 10, y + 10, 62, 12);
  }

  // 2 mini icon Thần Thức & Thần Cảnh ngay dưới/cạnh giống v1.3.1
  if (domainInfo.sense?.sense_id) {
    const sImg = await safeLoadImage(`domains/${domainInfo.sense.sense_id}.png`) || await safeLoadImage(`${domainInfo.sense.sense_id}.png`);
    if (sImg) {
      drawClippedImage(ctx, sImg, x + w - 68, y + h - 34, 26, 6);
    }
  }
  if (domainInfo.realm?.realm_id) {
    const rImg = await safeLoadImage(`domains/${domainInfo.realm.realm_id}.png`) || await safeLoadImage(`${domainInfo.realm.realm_id}.png`);
    if (rImg) {
      drawClippedImage(ctx, rImg, x + w - 36, y + h - 34, 26, 6);
    }
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = accentColor;
  ctx.font = `700 14px ${FONT_FAMILY}`;
  const energyTxt = domainInfo.indestructible ? '∞ Mạch' : `${domainInfo.finalEnergy}/${domainInfo.maxEnergy} Mạch`;
  const daoApTag = domainInfo.daoApUsed ? ' • ⚡ĐẠO ÁP' : '';
  ctx.fillText(`${customLabel} (${energyTxt}${daoApTag})`, x + 82, y + 28);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 19px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, domainInfo.name, w - 165), x + 82, y + 54);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 14px ${FONT_FAMILY}`;
  ctx.fillText(sanitizeText(domainInfo.element || ''), x + 82, y + 74);
  ctx.restore();
}

function getNormalizedUnitDisplay(unit) {
  const petObj = unit.pet || {};
  const petType = petObj.pet_type || unit.petType || '';
  const petName = petObj.pet_name || unit.petName || 'Linh Thú';
  const isEvolved = Boolean(unit.isEvolved || petObj.is_evolved);
  const element = petObj.element || unit.element || '';
  const level = Number(petObj.level || unit.level || 1);
  const star = Number(petObj.star || unit.star || 1);
  const grade = String(petObj.enchant_grade || unit.enchantGrade || unit.enchant_grade || 'D').toUpperCase();
  const atk = Number(unit.atk || 0);
  const def = Number(unit.def || 0);
  const spd = Number(unit.spd || 0);
  const power = Number(unit.powerScore || unit.power || 0) || (atk * 3 + def * 2 + spd * 2 + level * 50);
  return { petType, petName, isEvolved, element, level, star, grade, power };
}

async function loadPetSprite(petType, isEvolved = false) {
  if (!petType) return null;
  if (petType === 'cuu_vi_hong_ho' || isEvolved) {
    const preferred = resolvePetSplashAsset(petType, isEvolved, '');
    if (preferred) {
      const img = await safeLoadImage(preferred);
      if (img) return img;
    }
  }
  const mappedPetFile = PET_IMAGE_MAP[petType];
  return (mappedPetFile ? await safeLoadImage(mappedPetFile) : null)
    || await safeLoadImage(`pets/${petType}.png`)
    || await safeLoadImage(`pets/${petType}.webp`)
    || await safeLoadImage(`${petType}.png`);
}

function drawPetEnchantBadge(ctx, grade, rightX, bottomY, size = 24) {
  const g = String(grade || 'D').toUpperCase();
  const bx = rightX - size - 6;
  const by = bottomY - size - 6;
  ctx.save();
  ctx.fillStyle = GRADE_COLORS[g] || '#94a3b8';
  drawRoundRect(ctx, bx, by, size, size, Math.max(4, Math.floor(size / 4)));
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 ${Math.round(size * 0.62)}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(g, bx + size / 2, by + size * 0.74);
  ctx.restore();
}

async function drawFighterStrip(ctx, unit, x, y, w, h, sideColor) {
  const isKo = Number(unit.currentHp || 0) <= 0;
  const meta = getNormalizedUnitDisplay(unit);
  const isDuo = h > 320;
  const spriteBox = isDuo ? 190 : 148;

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = isKo ? 'rgba(22, 16, 30, 0.72)' : 'rgba(26, 19, 44, 0.90)';
  ctx.fill();
  ctx.strokeStyle = isKo ? 'rgba(244, 63, 94, 0.35)' : sideColor;
  ctx.lineWidth = unit.isLeader ? 2.5 : 1.5;
  ctx.stroke();

  // Pet sprite bên trái (contain để giữ nền trong suốt đẹp)
  const petImg = await loadPetSprite(meta.petType, meta.isEvolved);
  const spX = x + 16;
  const spY = y + (h - spriteBox) / 2;
  drawRoundRect(ctx, spX, spY, spriteBox, spriteBox, 16);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.9)';
  ctx.fill();
  if (meta.isEvolved || meta.petType === 'cuu_vi_hong_ho') {
    drawElementalPetBorderFX(ctx, spX, spY, spriteBox, spriteBox, 16, meta.element, {
      allowShadowBlur: false,
      lineWidth: 2.2,
    });
  }
  if (petImg) {
    ctx.save();
    drawRoundRect(ctx, spX + 4, spY + 4, spriteBox - 8, spriteBox - 8, 12);
    ctx.clip();
    if (isKo) ctx.globalAlpha = 0.4;
    const fitRatio = Math.min((spriteBox - 12) / petImg.width, (spriteBox - 12) / petImg.height);
    const dw = petImg.width * fitRatio;
    const dh = petImg.height * fitRatio;
    ctx.drawImage(petImg, spX + (spriteBox - dw) / 2, spY + (spriteBox - dh) / 2, dw, dh);
    ctx.restore();
  }
  drawPetEnchantBadge(ctx, meta.grade, spX + spriteBox, spY + spriteBox, isDuo ? 28 : 22);

  // Avatar khử răng cưa kèm Viền Avatar đồng bộ với /profile & /rank
  const [avImg, frameOverlayImg] = await Promise.all([
    safeLoadImage(unit.avatarUrl),
    preloadAvatarFrameOverlay(unit.avatarFrame),
  ]);
  const avR = isDuo ? 24 : 21;
  drawAntiAliasedAvatarWithBorder(ctx, avImg, x + 10 + avR, y + 12 + avR, avR, {
    isOwner: String(unit.id) === '757091869183311872',
    level: unit.userLevel || 1,
    username: unit.name,
    avatarFrame: unit.avatarFrame || 'default',
    frameOverlayImg,
    supersampleFactor: 2,
    showAura: true,
  });

  const tx = x + spriteBox + 34;
  const tw = w - (spriteBox + 50);
  const topPad = isDuo ? 44 : 0;

  // Tên thành viên + badge Đội Trưởng / Mệt Mỏi
  ctx.textAlign = 'left';
  ctx.fillStyle = isKo ? '#94a3b8' : '#ffffff';
  ctx.font = `700 ${isDuo ? 26 : 23}px ${FONT_FAMILY}`;
  const leaderPrefix = unit.isLeader ? '👑 ' : '';
  ctx.fillText(truncateText(ctx, `${leaderPrefix}${unit.name}`, tw - 170), tx, y + 38 + topPad);

  if (unit.fatiguePenaltyPct > 0) {
    const fLabel = `Mệt -${unit.fatiguePenaltyPct}%`;
    drawRoundRect(ctx, x + w - 140, y + 14 + topPad * 0.4, 124, 30, 8);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(fLabel, x + w - 78, y + 34 + topPad * 0.4);
    ctx.textAlign = 'left';
  }

  // Tên Pet + Hệ + Lv/Sao
  ctx.fillStyle = '#f9a8d4';
  ctx.font = `600 ${isDuo ? 20 : 18}px ${FONT_FAMILY}`;
  const petMeta = `${meta.petName}${meta.element ? ` • Hệ ${meta.element}` : ''} • Lv.${meta.level} • ${meta.star}★`;
  ctx.fillText(truncateText(ctx, petMeta, tw), tx, y + 66 + topPad);

  // Thanh HP
  const hpRatio = Math.max(0, Math.min(1, Number(unit.currentHp || 0) / Math.max(1, Number(unit.maxHp || 1))));
  const barY = y + (isDuo ? 136 : 80);
  const barH = isDuo ? 30 : 26;
  drawRoundRect(ctx, tx, barY, tw, barH, barH / 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  if (hpRatio > 0) {
    drawRoundRect(ctx, tx, barY, Math.max(18, tw * hpRatio), barH, barH / 2);
    const hpGrad = ctx.createLinearGradient(tx, barY, tx + tw, barY);
    hpGrad.addColorStop(0, '#ec4899');
    hpGrad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = hpGrad;
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${isDuo ? 16 : 15}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  const hpTxt = isKo
    ? 'ĐÃ GỤC (0 HP)'
    : `HP: ${Number(unit.currentHp).toLocaleString('vi-VN')} / ${Number(unit.maxHp).toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`;
  ctx.fillText(hpTxt, tx + tw / 2, barY + barH * 0.7);

  // Chỉ số ATK / DEF / SPD + 3 Mini Icon Pháp Bảo
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `600 ${isDuo ? 18 : 16}px ${FONT_FAMILY}`;
  ctx.fillText(
    `ATK ${Number(unit.atk).toLocaleString('vi-VN')}  •  DEF ${Number(unit.def).toLocaleString('vi-VN')}  •  SPD ${Number(unit.spd).toLocaleString('vi-VN')}`,
    tx,
    barY + barH + (isDuo ? 34 : 26),
  );

  // 3 ô Pháp Bảo thu gọn bên dưới
  const eqSlots = [unit.equipment?.weapon, unit.equipment?.gem, unit.equipment?.soul];
  let ex = tx;
  const eqSize = isDuo ? 58 : 46;
  const ey = barY + barH + (isDuo ? 54 : 38);
  for (const piece of eqSlots) {
    drawRoundRect(ctx, ex, ey, eqSize, eqSize, 10);
    ctx.fillStyle = 'rgba(15, 10, 28, 0.85)';
    ctx.fill();
    ctx.strokeStyle = piece ? (GRADE_COLORS[piece.enchant_grade || 'D'] || '#64748b') : 'rgba(148,163,184,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (piece?.item_id) {
      const iImg = await safeLoadImage(`items/${piece.item_id}.png`) || await safeLoadImage(`${piece.item_id}.png`);
      if (iImg) drawClippedImage(ctx, iImg, ex + 4, ey + 4, eqSize - 8, 7);
      const g = String(piece.enchant_grade || 'D').toUpperCase();
      const bSize = isDuo ? 20 : 18;
      ctx.fillStyle = GRADE_COLORS[g] || '#94a3b8';
      drawRoundRect(ctx, ex + eqSize - bSize, ey + eqSize - bSize, bSize, bSize, 4);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 12px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(g, ex + eqSize - bSize / 2, ey + eqSize - bSize * 0.25);
      ctx.textAlign = 'left';
    }
    ex += eqSize + 12;
  }

  // Lực chiến góc dưới phải
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fcd34d';
  ctx.font = `700 ${isDuo ? 19 : 17}px ${FONT_FAMILY}`;
  ctx.fillText(`⚡ ${meta.power.toLocaleString('vi-VN')} Lực`, x + w - 18, y + h - 20);

  ctx.restore();
}

async function drawSoloFighterPanel(ctx, unit, x, y, w, h, sideColor) {
  const isKo = Number(unit.currentHp || 0) <= 0;
  const meta = getNormalizedUnitDisplay(unit);
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = isKo ? 'rgba(22, 16, 30, 0.78)' : 'rgba(26, 18, 46, 0.92)';
  ctx.fill();
  ctx.strokeStyle = isKo ? 'rgba(244, 63, 94, 0.45)' : sideColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header người chơi: Avatar + Viền Avatar + Tên + Badge Mệt Mỏi
  const [avImg, frameOverlayImg] = await Promise.all([
    safeLoadImage(unit.avatarUrl),
    preloadAvatarFrameOverlay(unit.avatarFrame),
  ]);
  drawAntiAliasedAvatarWithBorder(ctx, avImg, x + 56, y + 50, 28, {
    isOwner: String(unit.id) === '757091869183311872',
    level: unit.userLevel || 1,
    username: unit.name,
    avatarFrame: unit.avatarFrame || 'default',
    frameOverlayImg,
    supersampleFactor: 2,
    showAura: true,
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 28px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, `👑 ${unit.name}`, w - 280), x + 98, y + 60);

  if (unit.fatiguePenaltyPct > 0) {
    drawRoundRect(ctx, x + w - 172, y + 30, 144, 34, 10);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Mệt -${unit.fatiguePenaltyPct}%`, x + w - 100, y + 53);
  }

  // Khung chân dung Pet cỡ lớn đối xứng với Grand Boss Panel
  const imgSize = 310;
  const imgX = x + (w - imgSize) / 2;
  const imgY = y + 96;
  drawRoundRect(ctx, imgX - 6, imgY - 6, imgSize + 12, imgSize + 12, 24);
  ctx.fillStyle = 'rgba(12, 8, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = sideColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (meta.isEvolved || meta.petType === 'cuu_vi_hong_ho') {
    drawElementalPetBorderFX(ctx, imgX - 6, imgY - 6, imgSize + 12, imgSize + 12, 24, meta.element, {
      allowShadowBlur: false,
      lineWidth: 2.6,
    });
  }

  const petImg = await loadPetSprite(meta.petType, meta.isEvolved);
  if (petImg) {
    ctx.save();
    drawRoundRect(ctx, imgX, imgY, imgSize, imgSize, 20);
    ctx.clip();
    if (isKo) ctx.globalAlpha = 0.45;
    const fitRatio = Math.min((imgSize - 24) / petImg.width, (imgSize - 24) / petImg.height);
    const dw = petImg.width * fitRatio;
    const dh = petImg.height * fitRatio;
    ctx.drawImage(petImg, imgX + (imgSize - dw) / 2, imgY + (imgSize - dh) / 2, dw, dh);
    ctx.restore();
  }
  drawPetEnchantBadge(ctx, meta.grade, imgX + imgSize, imgY + imgSize, 32);

  // Tên Pet + Hệ/Lv/Sao + Chiến Lực
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f9a8d4';
  ctx.font = `800 32px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, meta.petName, w - 48), x + w / 2, imgY + imgSize + 52);

  ctx.fillStyle = '#fde68a';
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillText(
    `Hệ ${meta.element || 'Hỗn Độn'}  •  Lv.${meta.level} • ${meta.star}★  •  ⚡ ${meta.power.toLocaleString('vi-VN')} Lực`,
    x + w / 2,
    imgY + imgSize + 88,
  );

  // Thanh HP cỡ lớn
  const barX = x + 38;
  const barW = w - 76;
  const barY = imgY + imgSize + 110;
  const barH = 38;
  const hpRatio = Math.max(0, Math.min(1, Number(unit.currentHp || 0) / Math.max(1, Number(unit.maxHp || 1))));
  drawRoundRect(ctx, barX, barY, barW, barH, 19);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fill();
  if (hpRatio > 0) {
    drawRoundRect(ctx, barX, barY, Math.max(24, barW * hpRatio), barH, 19);
    const g = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    g.addColorStop(0, '#ec4899');
    g.addColorStop(1, '#f43f5e');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 20px ${FONT_FAMILY}`;
  ctx.fillText(
    isKo ? 'ĐÃ GỤC (0 HP)' : `HP: ${Number(unit.currentHp).toLocaleString('vi-VN')} / ${Number(unit.maxHp).toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`,
    x + w / 2,
    barY + 26,
  );

  // ATK / DEF / SPD
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `700 21px ${FONT_FAMILY}`;
  ctx.fillText(
    `ATK ${Number(unit.atk).toLocaleString('vi-VN')}   •   DEF ${Number(unit.def).toLocaleString('vi-VN')}   •   SPD ${Number(unit.spd).toLocaleString('vi-VN')}`,
    x + w / 2,
    barY + 74,
  );

  // 3 Thẻ Pháp Bảo căn giữa phía dưới
  const eqLabels = ['VŨ KHÍ', 'BẢO NGỌC', 'CHIẾN HỒN'];
  const eqPieces = [unit.equipment?.weapon, unit.equipment?.gem, unit.equipment?.soul];
  const cardW = 226;
  const cardH = 112;
  const gap = 18;
  const rowX = x + (w - (cardW * 3 + gap * 2)) / 2;
  const rowY = y + h - cardH - 28;

  for (let idx = 0; idx < 3; idx += 1) {
    const piece = eqPieces[idx];
    const cx = rowX + idx * (cardW + gap);
    drawRoundRect(ctx, cx, rowY, cardW, cardH, 14);
    ctx.fillStyle = 'rgba(15, 10, 28, 0.88)';
    ctx.fill();
    ctx.strokeStyle = piece ? (GRADE_COLORS[piece.enchant_grade || 'D'] || '#64748b') : 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    const icoSize = 68;
    const icoX = cx + 12;
    const icoY = rowY + (cardH - icoSize) / 2;
    drawRoundRect(ctx, icoX, icoY, icoSize, icoSize, 10);
    ctx.fillStyle = 'rgba(26, 18, 44, 0.9)';
    ctx.fill();
    if (piece?.item_id) {
      const iImg = await safeLoadImage(`items/${piece.item_id}.png`) || await safeLoadImage(`${piece.item_id}.png`);
      if (iImg) drawClippedImage(ctx, iImg, icoX + 4, icoY + 4, icoSize - 8, 8);
      drawPetEnchantBadge(ctx, piece.enchant_grade, icoX + icoSize + 4, icoY + icoSize + 4, 20);
    }

    const textX = icoX + icoSize + 12;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f472b6';
    ctx.font = `700 13px ${FONT_FAMILY}`;
    ctx.fillText(eqLabels[idx], textX, rowY + 34);

    ctx.fillStyle = piece ? '#f8fafc' : '#64748b';
    ctx.font = `600 15px ${FONT_FAMILY}`;
    ctx.fillText(truncateText(ctx, piece?.item_name || 'Trống', cardW - icoSize - 32), textX, rowY + 62);
  }

  ctx.restore();
}

async function drawGrandBossPanel(ctx, boss, x, y, w, h) {
  const isKo = Number(boss.currentHp || 0) <= 0;
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = 'rgba(28, 12, 28, 0.90)';
  ctx.fill();
  ctx.strokeStyle = isKo ? 'rgba(244, 63, 94, 0.45)' : '#f59e0b';
  ctx.lineWidth = 3;
  ctx.stroke();

  const imgSize = 360;
  const imgX = x + (w - imgSize) / 2;
  const imgY = y + 36;
  const bossImg = await safeLoadImage(boss.bossImageFile || `veins/${boss.pet?.pet_type}.png`);
  drawRoundRect(ctx, imgX - 6, imgY - 6, imgSize + 12, imgSize + 12, 24);
  ctx.fillStyle = 'rgba(12, 8, 22, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (bossImg) {
    if (isKo) ctx.globalAlpha = 0.45;
    drawClippedImage(ctx, bossImg, imgX, imgY, imgSize, 20);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a';
  ctx.font = `800 32px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, boss.name, w - 40), x + w / 2, imgY + imgSize + 54);

  ctx.fillStyle = '#fda4af';
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillText(`Hệ ${boss.pet?.element || 'Ám'}  •  Chiến Lực: ${Number(boss.powerScore || 0).toLocaleString('vi-VN')}`, x + w / 2, imgY + imgSize + 92);

  // Thanh HP Boss cỡ lớn
  const barX = x + 36;
  const barW = w - 72;
  const barY = imgY + imgSize + 114;
  const barH = 38;
  const hpRatio = Math.max(0, Math.min(1, Number(boss.currentHp || 0) / Math.max(1, Number(boss.maxHp || 1))));
  drawRoundRect(ctx, barX, barY, barW, barH, 19);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fill();
  if (hpRatio > 0) {
    drawRoundRect(ctx, barX, barY, Math.max(24, barW * hpRatio), barH, 19);
    const g = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    g.addColorStop(0, '#f59e0b');
    g.addColorStop(1, '#dc2626');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 20px ${FONT_FAMILY}`;
  ctx.fillText(
    isKo ? 'BOSS ĐÃ BỊ HẠ GỤC (0 HP)' : `HP: ${Number(boss.currentHp).toLocaleString('vi-VN')} / ${Number(boss.maxHp).toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`,
    x + w / 2,
    barY + 26,
  );

  // Chỉ số Boss
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `700 21px ${FONT_FAMILY}`;
  ctx.fillText(
    `ATK ${Number(boss.atk).toLocaleString('vi-VN')}   •   DEF ${Number(boss.def).toLocaleString('vi-VN')}   •   SPD ${Number(boss.spd).toLocaleString('vi-VN')}`,
    x + w / 2,
    barY + 80,
  );
  ctx.restore();
}

export async function renderTeamBattleCard(battleResult, options = {}) {
  const format = options.format === 'png' ? 'png' : 'webp';
  const rawScale = Number(options.scale);
  const scale = Number.isFinite(rawScale) && rawScale >= 0.45 && rawScale <= 1.2 ? rawScale : 0.9;
  const webpQuality = options.webpQuality ?? 76;
  const frame = options.frame || null;
  const isFinal = frame ? frame.isFinal !== false : true;
  const canvasW = Math.round(WIDTH * scale);
  const canvasH = Math.round(HEIGHT * scale);
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Clone đội hình với HP & Linh Mạch tại đúng hiệp (nếu render theo frame trên Web Logs)
  const teamAListRaw = (battleResult.teamA || []).slice(0, 3).map((u, idx) => ({
    ...u,
    currentHp: frame?.teamAHp?.[idx] !== undefined ? Number(frame.teamAHp[idx]) : u.currentHp,
  }));
  const teamBListRaw = (battleResult.teamB || []).slice(0, 3).map((u, idx) => ({
    ...u,
    currentHp: frame?.teamBHp?.[idx] !== undefined ? Number(frame.teamBHp[idx]) : u.currentHp,
  }));
  const leaderDomA = battleResult.leaderDomainA ? {
    ...battleResult.leaderDomainA,
    finalEnergy: frame?.domainAEnergy !== undefined ? frame.domainAEnergy : battleResult.leaderDomainA.finalEnergy,
  } : null;
  const leaderDomB = battleResult.leaderDomainB ? {
    ...battleResult.leaderDomainB,
    finalEnergy: frame?.domainBEnergy !== undefined ? frame.domainBEnergy : battleResult.leaderDomainB.finalEnergy,
  } : null;

  // Nền Gradient Tu Tiên Tối Sang Trọng
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, '#0e0a1c');
  bgGrad.addColorStop(0.5, '#19102c');
  bgGrad.addColorStop(1, '#110a1f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Khung viền ngoài
  drawRoundRect(ctx, 18, 18, WIDTH - 36, HEIGHT - 36, 28);
  ctx.strokeStyle = 'rgba(244, 180, 90, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header Top Banner
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a';
  ctx.font = `800 32px ${FONT_FAMILY}`;
  ctx.fillText(sanitizeText(battleResult.veinLabel || 'TRANH ĐOẠT LINH MẠCH — CHIẾN BÁO TỔ ĐỘI'), WIDTH / 2, 68);

  const leftWon = battleResult.winnerSide === 'A';
  const colW = 790;
  const leftX = 44;
  const rightX = WIDTH - 44 - colW;
  const headerY = 92;

  // Tiêu đề mỗi phe + Góc Linh Vực Đội Trưởng
  ctx.textAlign = 'left';
  ctx.fillStyle = !isFinal ? '#f9a8d4' : (leftWon ? '#34d399' : '#fda4af');
  ctx.font = `800 24px ${FONT_FAMILY}`;
  ctx.fillText(
    `ĐỘI KHIÊU CHIẾN (${teamAListRaw.length} NGƯỜI) — ${!isFinal ? 'ĐANG GIAO CHIẾN' : (leftWon ? 'CHIẾN THẮNG' : 'THẤT BẠI')}`,
    leftX,
    headerY + 26,
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = !isFinal ? '#7dd3fc' : (!leftWon ? '#34d399' : '#fda4af');
  const isBossMode = teamBListRaw.length === 1 && teamBListRaw[0]?.isBoss;
  ctx.fillText(
    `${isBossMode ? 'BOSS TRẤN THỦ LINH MẠCH' : `ĐỘI PHÒNG THỦ (${teamBListRaw.length} NGƯỜI)`} — ${!isFinal ? 'ĐANG GIAO CHIẾN' : (!leftWon ? 'GIỮ VỮNG' : 'THẤT THỦ')}`,
    rightX + colW,
    headerY + 26,
  );

  // Hộp Linh Vực Đội Trưởng 2 bên
  await drawLeaderDomainCorner(ctx, leaderDomA, leftX, headerY + 42, colW, 88, '#ec4899', 'LINH VỰC ĐỘI TRƯỞNG');
  await drawLeaderDomainCorner(
    ctx,
    leaderDomB,
    rightX,
    headerY + 42,
    colW,
    88,
    '#f59e0b',
    isBossMode ? 'LINH VỰC BOSS TRẤN THỦ' : 'LINH VỰC ĐỘI TRƯỞNG',
  );

  // Thân chiến báo (838px cao đều 2 bên: Solo = 1 panel lớn, Duo = 2 panel vừa, Trio = 3 panel gọn)
  const stripStartY = 244;
  const stripH = 266;
  const stripGap = 20;
  const colBodyH = stripH * 3 + stripGap * 2;
  const teamAList = teamAListRaw;
  const teamBList = teamBListRaw;

  const renderSideList = async (list, sx, color) => {
    if (list.length <= 1) {
      if (list[0]) await drawSoloFighterPanel(ctx, list[0], sx, stripStartY, colW, colBodyH, color);
    } else if (list.length === 2) {
      const duoH = Math.floor((colBodyH - stripGap) / 2);
      for (let i = 0; i < 2; i += 1) {
        await drawFighterStrip(ctx, list[i], sx, stripStartY + i * (duoH + stripGap), colW, duoH, color);
      }
    } else {
      for (let i = 0; i < 3; i += 1) {
        await drawFighterStrip(ctx, list[i], sx, stripStartY + i * (stripH + stripGap), colW, stripH, color);
      }
    }
  };

  await renderSideList(teamAList, leftX, '#ec4899');
  if (isBossMode) {
    await drawGrandBossPanel(ctx, teamBList[0], rightX, stripStartY, colW, colBodyH);
  } else {
    await renderSideList(teamBList, rightX, '#38bdf8');
  }

  // Cột trung tâm VS + Trạng thái kết thúc
  const midX = WIDTH / 2;
  ctx.textAlign = 'center';
  const vsGrad = ctx.createLinearGradient(midX - 80, 420, midX + 80, 520);
  vsGrad.addColorStop(0, '#fde68a');
  vsGrad.addColorStop(1, '#f472b6');
  ctx.fillStyle = vsGrad;
  ctx.font = `900 84px ${FONT_FAMILY}`;
  ctx.fillText('VS', midX, 510);

  // Hộp kết quả giữa
  const boxW = 280;
  const boxH = 190;
  const boxX = midX - boxW / 2;
  const boxY = 560;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fillStyle = 'rgba(30, 18, 48, 0.92)';
  ctx.fill();
  ctx.strokeStyle = !isFinal ? '#ec4899' : (leftWon ? '#10b981' : '#f59e0b');
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (!isFinal) {
    ctx.fillStyle = '#fde68a';
    ctx.font = `800 20px ${FONT_FAMILY}`;
    ctx.fillText('⚔️ ĐANG GIAO CHIẾN', midX, boxY + 46);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 30px ${FONT_FAMILY}`;
    const curT = Number(frame?.turn || 0);
    ctx.fillText(curT > 0 ? `HIỆP ${curT} / ${frame?.totalTurns || battleResult.turnCount || 1}` : 'KHAI TRẬN', midX, boxY + 98);

    ctx.fillStyle = '#fbcfe8';
    ctx.font = `600 17px ${FONT_FAMILY}`;
    const modeTxt = isBossMode
      ? (teamAList.length === 1 ? 'Chế độ: Đơn Đấu vs BOSS' : `Chế độ: Tổ Đội ${teamAList.length}vBOSS`)
      : `Chế độ: Tổ Đội ${teamAList.length}v${teamBList.length}`;
    ctx.fillText(modeTxt, midX, boxY + 150);
  } else {
    ctx.fillStyle = '#fde68a';
    ctx.font = `800 20px ${FONT_FAMILY}`;
    ctx.fillText(leftWon ? '🏆 CHIẾM MỎ THÀNH CÔNG' : '🛡️ GIỮ VỮNG LINH MẠCH', midX, boxY + 46);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 22px ${FONT_FAMILY}`;
    const winnerLead = leftWon ? teamAList[0]?.name : teamBList[0]?.name;
    ctx.fillText(truncateText(ctx, winnerLead || 'Người Thắng', boxW - 24), midX, boxY + 92);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 18px ${FONT_FAMILY}`;
    ctx.fillText(`Tổng số hiệp: ${battleResult.turnCount || 1} Hiệp`, midX, boxY + 132);
    const modeTxt = isBossMode
      ? (teamAList.length === 1 ? 'Chế độ: Đơn Đấu vs BOSS' : `Chế độ: Tổ Đội ${teamAList.length}vBOSS`)
      : `Chế độ: Tổ Đội ${teamAList.length}v${teamBList.length}`;
    ctx.fillText(modeTxt, midX, boxY + 164);
  }

  return format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/webp', webpQuality);
}
