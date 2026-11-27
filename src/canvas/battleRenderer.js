/**
 * src/canvas/battleRenderer.js
 * Kết xuất Ảnh Chiến Báo Đấu Trường Linh Thú 1v1 (2000x1000 Full HD+ hoặc 1000x500 Adaptive Frame).
 * Hỗ trợ PNG & WebP tốc độ cao cùng giao diện mới không tiêu đề top, chữ VS metallic,
 * mũi tên xung khắc Ngũ Hành, 3 chỉ số ngang ATK|DEF|SPD lục giác, thanh HP hồng & icon Pet WINNER.
 */

import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  loadBadgeImage,
  drawRoundRect,
  drawAntiAliasedAvatarWithBorder,
  preloadAvatarFrameOverlay,
  drawElementalPetBorderFX,
  drawStarSparkle,
  drawHexBadge,
  drawAutoFitSingleLineText,
  drawCenteredAutoFitIconText,
  sanitizeText,
  resolveAssetPath,
  resolvePetSplashAsset,
  encodeCanvas,
  FONT_FAMILY,
} from './drawUtils.js';
import {
  FUYUMI_USER_ID,
  normalizeRarityKey,
  normalizeEnchantGrade,
  ENCHANT_GRADES,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
} from '../data/catalog.js';
import { getDomainElementCounterResult } from '../services/battleEngine/domainEngine.js';

const LOGICAL_W = 1000;
const LOGICAL_H = 500;

function drawGradeBadgeCanvas(ctx, gradeBadges, rawGrade, x, y, size = 18) {
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

const RARITY_ACCENTS = {
  common: {
    color: '#94a3b8',
    bg: 'rgba(51, 65, 85, 0.72)',
    slotBorder: ['rgba(71, 85, 105, 0.5)', 'rgba(148, 163, 184, 0.5)'],
    slotBg: ['rgba(51, 65, 85, 0.28)', 'rgba(30, 41, 59, 0.24)'],
    slotGlow: 'rgba(148, 163, 184, 0.25)',
    text: '#cbd5e1',
  },
  rare: {
    color: '#38bdf8',
    bg: 'rgba(29, 78, 216, 0.65)',
    slotBorder: ['#2563eb', '#60a5fa'],
    slotBg: ['rgba(37, 99, 235, 0.22)', 'rgba(96, 165, 250, 0.12)'],
    slotGlow: 'rgba(59, 130, 246, 0.55)',
    text: '#93c5fd',
  },
  epic: {
    color: '#c084fc',
    bg: 'rgba(126, 34, 206, 0.68)',
    slotBorder: ['#9333ea', '#c084fc'],
    slotBg: ['rgba(147, 51, 234, 0.24)', 'rgba(192, 132, 252, 0.14)'],
    slotGlow: 'rgba(168, 85, 247, 0.62)',
    text: '#e9d5ff',
  },
  mythic: {
    color: '#fbbf24',
    bg: 'rgba(190, 18, 60, 0.78)',
    slotBorder: ['#ff0055', '#ffd700'],
    slotBg: ['rgba(255, 0, 85, 0.22)', 'rgba(251, 191, 36, 0.16)'],
    slotGlow: 'rgba(255, 0, 85, 0.65)',
    text: '#ffd700',
  },
  unique_supreme: {
    color: '#fb7185',
    bg: 'rgba(225, 29, 72, 0.80)',
    slotBorder: ['#f43f5e', '#fbbf24'],
    slotBg: ['rgba(225, 29, 72, 0.24)', 'rgba(251, 191, 36, 0.16)'],
    slotGlow: 'rgba(225, 29, 72, 0.65)',
    text: '#ffe4e6',
  },
  evolved_supreme: {
    color: '#fda4af',
    bg: 'rgba(190, 18, 60, 0.88)',
    slotBorder: ['#fb7185', '#fde047'],
    slotBg: ['rgba(244, 63, 94, 0.28)', 'rgba(253, 224, 71, 0.20)'],
    slotGlow: 'rgba(251, 113, 133, 0.72)',
    text: '#fef08a',
  },
  supreme: {
    color: '#fde047',
    bg: 'rgba(219, 39, 119, 0.85)',
    slotBorder: ['#ff0055', '#ffd700'],
    slotBg: ['rgba(255, 0, 85, 0.26)', 'rgba(251, 191, 36, 0.18)'],
    slotGlow: 'rgba(255, 0, 85, 0.72)',
    text: '#fde047',
  },
};

function resolvePetAsset(petType, isEvolved = false) {
  return resolvePetSplashAsset(petType, isEvolved, 'pets/hoa_thach_nham_nham.png');
}

function resolvePetMiniIconAsset(petType) {
  if (!petType || petType === 'cuu_vi_hong_ho') return 'badges/su_fox_mascot.png';
  const candidate = `pets/icons/${petType}.png`;
  return resolveAssetPath(candidate) ? candidate : 'badges/su_fox_mascot.png';
}

function resolveElementMatchupDisplay(matchup) {
  const a2d = matchup?.attackerToDefender;
  const d2a = matchup?.defenderToAttacker;

  if (a2d?.isTrueDamage && d2a?.isTrueDamage) {
    return { dir: 'both', subText: 'Hỗn Độn Đối Đầu (+20%)', color: '#f472b6' };
  }
  if (a2d?.isTrueDamage && !d2a?.isTrueDamage) {
    return { dir: 'right', subText: '+20% Xuyên Giáp', color: '#f472b6' };
  }
  if (d2a?.isTrueDamage && !a2d?.isTrueDamage) {
    return { dir: 'left', subText: '+20% Xuyên Giáp', color: '#f472b6' };
  }
  if (a2d?.multiplier >= 1.25 && d2a?.multiplier >= 1.25) {
    return { dir: 'both', subText: 'Tương Sát (+25% DMG)', color: '#c084fc' };
  }
  if (a2d?.multiplier > 1.0) {
    const pct = Math.round((a2d.multiplier - 1) * 100);
    return { dir: 'right', subText: `+${pct}% Sát Thương`, color: '#4ade80' };
  }
  if (d2a?.multiplier > 1.0) {
    const pct = Math.round((d2a.multiplier - 1) * 100);
    return { dir: 'left', subText: `+${pct}% Sát Thương`, color: '#38bdf8' };
  }
  return { dir: 'neutral', subText: 'Ngũ Hành Cân Bằng', color: '#cbd5e1' };
}

function resolveBattleDomainLoadout(fighter, sideSummary = null) {
  const raw = fighter?.domainLoadout || fighter?.domain_loadout || {};
  const d = typeof raw.domain === 'string'
    ? DOMAIN_BY_ID[raw.domain]
    : (raw.domain || (sideSummary?.domainId ? DOMAIN_BY_ID[sideSummary.domainId] : null));
  const s = typeof raw.sense === 'string'
    ? DIVINE_SENSE_BY_ID[raw.sense]
    : (raw.sense || null);
  const r = typeof raw.realm === 'string'
    ? DIVINE_REALM_BY_ID[raw.realm]
    : (raw.realm || null);
  return { domain: d || null, sense: s || null, realm: r || null };
}

function drawCornerDomainBadge(ctx, dl, domImgs, boxX, boxY, boxW, boxH) {
  const domain = dl?.domain || null;
  const sense = dl?.sense || null;
  const realm = dl?.realm || null;
  const [dImg, sImg, rImg] = domImgs || [];

  ctx.save();
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 9);
  if (!domain) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 8px ${FONT_FAMILY}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText('LINH VỰC', boxX + boxW / 2, boxY + 19);
    ctx.font = `8.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('Chưa khai mở', boxX + boxW / 2, boxY + 36);
    ctx.restore();
    return;
  }

  const rar = RARITY_ACCENTS[normalizeRarityKey(domain.rarity || 'mythic')] || RARITY_ACCENTS.mythic;
  const bgG = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
  bgG.addColorStop(0, rar.slotBg[0]);
  bgG.addColorStop(1, rar.slotBg[1]);
  ctx.fillStyle = bgG;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = rar.slotGlow;
  ctx.shadowBlur = 0;
  const brG = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
  brG.addColorStop(0, rar.slotBorder[0]);
  brG.addColorStop(1, rar.slotBorder[1]);
  ctx.strokeStyle = brG;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();

  // Icon chính Linh Vực (42x42)
  const iconSize = 42;
  const iconX = boxX + 6;
  const iconY = boxY + 5;
  if (dImg) {
    ctx.save();
    drawRoundRect(ctx, iconX, iconY, iconSize, iconSize, 7);
    ctx.clip();
    ctx.drawImage(dImg, iconX, iconY, iconSize, iconSize);
    ctx.restore();
    ctx.save();
    drawRoundRect(ctx, iconX, iconY, iconSize, iconSize, 7);
    ctx.strokeStyle = rar.slotBorder[0];
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 2 icon tròn nhỏ Thần Thức (dưới trái, viền lam) & Thần Cảnh (dưới phải, viền đỏ hồng)
  const subSize = 18;
  const subY = iconY + iconSize - subSize + 4;
  if (sense && sImg) {
    const sx = iconX - 3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx + subSize / 2, subY + subSize / 2, subSize / 2 + 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0718';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + subSize / 2, subY + subSize / 2, subSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sImg, sx, subY, subSize, subSize);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx + subSize / 2, subY + subSize / 2, subSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.restore();
  }
  if (realm && rImg) {
    const rx = iconX + iconSize - subSize + 3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(rx + subSize / 2, subY + subSize / 2, subSize / 2 + 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0718';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx + subSize / 2, subY + subSize / 2, subSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(rImg, rx, subY, subSize, subSize);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(rx + subSize / 2, subY + subSize / 2, subSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.3;
    ctx.shadowColor = '#fb7185';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.restore();
  }

  // Nhãn LINH VỰC + Hệ Vực + Tổng Linh Mạch
  const txtX = iconX + iconSize + 7;
  const txtW = boxX + boxW - txtX - 5;
  const lmTotal = domain.base_energy >= 999 ? '∞' : (Number(domain.base_energy || 3) + Number(sense?.bonus_energy || 0));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 7.8px ${FONT_FAMILY}`;
  ctx.fillStyle = rar.text;
  ctx.fillText('LINH VỰC', txtX, boxY + 13);

  drawAutoFitSingleLineText(ctx, domain.element || 'Linh Vực', txtX, boxY + 27, txtW, {
    maxFont: 9.8,
    minFont: 7.0,
    weight: 'bold',
    align: 'left',
    color: '#ffffff',
  });

  drawAutoFitSingleLineText(ctx, `${lmTotal} Linh Mạch`, txtX, boxY + 42, txtW, {
    maxFont: 8.5,
    minFont: 6.5,
    weight: 'bold',
    align: 'left',
    color: '#fde68a',
  });
  ctx.restore();
}

function drawCounterArrow(ctx, cx, cy, dir, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const halfSpan = 13;
  const headLen = 5.5;
  const headHalfH = 4.0;

  if (dir === 'right') {
    ctx.beginPath();
    ctx.moveTo(cx - halfSpan, cy);
    ctx.lineTo(cx + halfSpan - 2, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + halfSpan, cy);
    ctx.lineTo(cx + halfSpan - headLen, cy - headHalfH);
    ctx.lineTo(cx + halfSpan - headLen, cy + headHalfH);
    ctx.closePath();
    ctx.fill();
  } else if (dir === 'left') {
    ctx.beginPath();
    ctx.moveTo(cx + halfSpan, cy);
    ctx.lineTo(cx - halfSpan + 2, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - halfSpan, cy);
    ctx.lineTo(cx - halfSpan + headLen, cy - headHalfH);
    ctx.lineTo(cx - halfSpan + headLen, cy + headHalfH);
    ctx.closePath();
    ctx.fill();
  } else if (dir === 'both') {
    ctx.beginPath();
    ctx.moveTo(cx - halfSpan + 2, cy);
    ctx.lineTo(cx + halfSpan - 2, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + halfSpan, cy);
    ctx.lineTo(cx + halfSpan - headLen + 1, cy - headHalfH + 0.5);
    ctx.lineTo(cx + halfSpan - headLen + 1, cy + headHalfH - 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - halfSpan, cy);
    ctx.lineTo(cx - halfSpan + headLen - 1, cy - headHalfH + 0.5);
    ctx.lineTo(cx - halfSpan + headLen - 1, cy + headHalfH - 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Render Ảnh Chiến Báo 1v1 (2000x1000 hoặc 1000x500 WebP/PNG)
 * @param {object} battleResult Kết quả từ simulateBattle()
 * @param {{ scale?: 1|2, format?: 'png'|'webp', webpQuality?: number, frame?: object|null }} options
 * @returns {Promise<Buffer>} PNG hoặc WebP Buffer
 */
export async function renderBattleCard(battleResult, options = {}) {
  const rawScale = Number(options.scale);
  const scale = Number.isFinite(rawScale) && rawScale >= 0.5 && rawScale <= 2.5 ? rawScale : 1.8;
  const canvasW = Math.round(LOGICAL_W * scale);
  const canvasH = Math.round(LOGICAL_H * scale);
  const format = options.format || 'png';
  const webpQuality = options.webpQuality ?? 75;
  const frame = options.frame || null;
  const isFinal = frame ? frame.isFinal !== false : true;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const atkRaw = battleResult?.combatants?.attacker || {
    id: battleResult?.winner?.id || '1',
    name: battleResult?.winner?.name || 'Phe Công',
    userLevel: 1,
    petName: battleResult?.winner?.pet || 'Hóa Thạch Nham Nham Thú',
    petType: 'hoa_thach_nham_nham',
    petRarity: 'Phàm Phẩm',
    element: 'Thổ',
    level: 1,
    atk: 120,
    def: 180,
    spd: 100,
    maxHp: battleResult?.initialHp?.attacker || 1900,
    finalHp: battleResult?.finalHp?.attacker ?? 0,
    equipment: {},
  };

  const defRaw = battleResult?.combatants?.defender || {
    id: battleResult?.loser?.id || '2',
    name: battleResult?.loser?.name || 'Phe Thủ',
    userLevel: 1,
    petName: battleResult?.loser?.pet || 'Hóa Thạch Nham Nham Thú',
    petType: 'hoa_thach_nham_nham',
    petRarity: 'Phàm Phẩm',
    element: 'Thổ',
    level: 1,
    atk: 120,
    def: 180,
    spd: 100,
    maxHp: battleResult?.initialHp?.defender || 1900,
    finalHp: battleResult?.finalHp?.defender ?? 0,
    equipment: {},
  };

  const atk = frame && frame.attackerHp !== undefined ? { ...atkRaw, displayHp: frame.attackerHp } : { ...atkRaw, displayHp: atkRaw.finalHp };
  const def = frame && frame.defenderHp !== undefined ? { ...defRaw, displayHp: frame.defenderHp } : { ...defRaw, displayHp: defRaw.finalHp };

  const atkDomainLoadout = resolveBattleDomainLoadout(atk, battleResult?.domainSummary?.attacker);
  const defDomainLoadout = resolveBattleDomainLoadout(def, battleResult?.domainSummary?.defender);
  atk.domainLoadout = atkDomainLoadout;
  def.domainLoadout = defDomainLoadout;

  const atkWon = battleResult?.winnerRole
    ? battleResult.winnerRole === 'attacker'
    : String(battleResult?.winner?.id) === String(atk.id);
  const winnerCombatant = atkWon ? atk : def;
  const winnerPetType = winnerCombatant.petType || 'hoa_thach_nham_nham';

  // Tải song song avatar, ảnh pet, 6 icon trang bị, 6 icon Linh Vực/Thần Thức/Thần Cảnh và mini icon Pet thắng cuộc
  const loadEquipIcons = (eq) => Promise.all([
    eq?.weapon?.item_id ? loadImageSafe(`items/${eq.weapon.item_id}.png`, 2000, null) : null,
    eq?.gem?.item_id ? loadImageSafe(`items/${eq.gem.item_id}.png`, 2000, null) : null,
    eq?.soul?.item_id ? loadImageSafe(`items/${eq.soul.item_id}.png`, 2000, null) : null,
  ]);
  const loadDomainIcons = (dl) => Promise.all([
    dl?.domain?.domain_id ? loadImageSafe(`domains/${dl.domain.domain_id}.png`, 2000, null) : null,
    dl?.sense?.sense_id ? loadImageSafe(`domains/${dl.sense.sense_id}.png`, 2000, null) : null,
    dl?.realm?.realm_id ? loadImageSafe(`domains/${dl.realm.realm_id}.png`, 2000, null) : null,
  ]);

  const [atkAv, defAv, atkFrameOverlay, defFrameOverlay, atkPetImg, defPetImg, atkEqImgs, defEqImgs, atkDomImgs, defDomImgs, winnerPetMiniIcon, gD, gC, gB, gA, gS] = await Promise.all([
    loadImageSafe(atk.avatarUrl, 1200, atk.id === FUYUMI_USER_ID ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    loadImageSafe(def.avatarUrl, 1200, def.id === FUYUMI_USER_ID ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    preloadAvatarFrameOverlay(atk.avatarFrame),
    preloadAvatarFrameOverlay(def.avatarFrame),
    loadImageSafe(resolvePetAsset(atk.petType, atk.isEvolved), 1500, 'pets/hoa_thach_nham_nham.png'),
    loadImageSafe(resolvePetAsset(def.petType, def.isEvolved), 1500, 'pets/hoa_thach_nham_nham.png'),
    loadEquipIcons(atk.equipment),
    loadEquipIcons(def.equipment),
    loadDomainIcons(atkDomainLoadout),
    loadDomainIcons(defDomainLoadout),
    loadBadgeImage(resolvePetMiniIconAsset(winnerPetType)),
    loadBadgeImage('badges/grade_d.png'),
    loadBadgeImage('badges/grade_c.png'),
    loadBadgeImage('badges/grade_b.png'),
    loadBadgeImage('badges/grade_a.png'),
    loadBadgeImage('badges/grade_s.png'),
  ]);
  const gradeBadges = { D: gD, C: gC, B: gB, A: gA, S: gS };

  // ============================================================================
  // LỚP 1: NỀN ĐẤU TRƯỜNG TIÊN GIỚI (Bỏ tiêu đề top để lấy tối đa không gian)
  // ============================================================================
  const bg = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
  bg.addColorStop(0, '#0a0716');
  bg.addColorStop(0.5, '#170d2e');
  bg.addColorStop(1, '#09091a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const leftGlow = ctx.createRadialGradient(190, 250, 20, 190, 250, 320);
  leftGlow.addColorStop(0, 'rgba(244, 63, 94, 0.24)');
  leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const rightGlow = ctx.createRadialGradient(810, 250, 20, 810, 250, 320);
  rightGlow.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Khung viền ngoài thanh lịch
  ctx.save();
  drawRoundRect(ctx, 12, 12, LOGICAL_W - 24, LOGICAL_H - 24, 18);
  const outerGrad = ctx.createLinearGradient(12, 12, LOGICAL_W - 12, LOGICAL_H - 12);
  outerGrad.addColorStop(0, 'rgba(244, 63, 94, 0.58)');
  outerGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.52)');
  outerGrad.addColorStop(1, 'rgba(56, 189, 248, 0.58)');
  ctx.strokeStyle = outerGrad;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  // ============================================================================
  // LỚP 2: HAI KHUNG ĐẤU SĨ NỚI RỘNG (w=360, h=456)
  // ============================================================================
  function drawFighterPanel(fighter, avImg, frameOverlayImg, petImg, eqImgs, domImgs, isWinner, x, side) {
    const y = 22;
    const w = 360;
    const h = 456;
    const isOwner = String(fighter.id) === FUYUMI_USER_ID;
    const rarityKey = normalizeRarityKey(fighter.petRarity);
    const rStyle = RARITY_ACCENTS[rarityKey] || RARITY_ACCENTS.common;

    ctx.save();
    drawRoundRect(ctx, x, y, w, h, 16);
    if (!isFinal) {
      ctx.fillStyle = 'rgba(18, 14, 34, 0.84)';
      ctx.fill();
      ctx.strokeStyle = side === 'left' ? 'rgba(244, 114, 182, 0.52)' : 'rgba(56, 189, 248, 0.52)';
      ctx.lineWidth = 1.4;
    } else {
      ctx.fillStyle = isWinner ? 'rgba(24, 17, 44, 0.88)' : 'rgba(15, 13, 28, 0.78)';
      ctx.fill();
      ctx.strokeStyle = isWinner ? '#fbbf24' : 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = isWinner ? 2.0 : 1.2;
      if (isWinner) {
        ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
        ctx.shadowBlur = 0;
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Header: Góc trên phải đặt Linh Vực + 2 icon nhỏ Thần Thức / Thần Cảnh
    const domBoxW = 120;
    const domBoxH = 54;
    const domBoxX = x + w - 16 - domBoxW;
    const domBoxY = y + 11;
    drawCornerDomainBadge(ctx, fighter.domainLoadout, domImgs, domBoxX, domBoxY, domBoxW, domBoxH);

    // Avatar khử răng cưa viền đồng bộ tỷ lệ mảnh + Tên người chơi + Trạng thái
    const avCx = x + 42;
    const avCy = y + 39;
    drawAntiAliasedAvatarWithBorder(ctx, avImg, avCx, avCy, 24, {
      isOwner,
      level: fighter.userLevel || 1,
      username: fighter.name,
      avatarFrame: fighter.avatarFrame,
      frameOverlayImg,
      supersampleFactor: 2,
      showAura: true,
    });

    const nameMaxW = Math.max(80, domBoxX - (x + 74) - 8);
    drawAutoFitSingleLineText(ctx, fighter.name, x + 74, y + 26, nameMaxW, {
      maxFont: 15,
      minFont: 8.5,
      weight: 'bold',
      align: 'left',
      color: '#ffffff',
    });

    // Badge Trạng thái
    const statusText = !isFinal ? 'ĐANG GIAO CHIẾN' : (isWinner ? 'CHIẾN THẮNG' : 'THẤT BẠI');
    ctx.font = `bold 9.8px ${FONT_FAMILY}`;
    const stW = Math.min(nameMaxW, ctx.measureText(statusText).width + 16);
    drawRoundRect(ctx, x + 74, y + 40, stW, 19, 6);
    if (!isFinal) {
      ctx.fillStyle = 'rgba(236, 72, 153, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.65)';
    } else {
      ctx.fillStyle = isWinner ? 'rgba(245, 158, 11, 0.30)' : 'rgba(100, 116, 139, 0.25)';
      ctx.fill();
      ctx.strokeStyle = isWinner ? '#fbbf24' : '#64748b';
    }
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = !isFinal ? '#fbcfe8' : (isWinner ? '#fde047' : '#94a3b8');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, x + 74 + stW / 2, y + 49.5);

    // Khung ảnh Linh Thú lớn sắc nét
    const petBoxX = x + 16;
    const petBoxY = y + 74;
    const petBoxW = w - 32; // 328
    const petBoxH = 166;
    drawRoundRect(ctx, petBoxX, petBoxY, petBoxW, petBoxH, 12);
    const pGrad = ctx.createRadialGradient(
      petBoxX + petBoxW / 2, petBoxY + petBoxH / 2, 10,
      petBoxX + petBoxW / 2, petBoxY + petBoxH / 2, 120
    );
    pGrad.addColorStop(0, rStyle.bg);
    pGrad.addColorStop(1, 'rgba(10, 8, 22, 0.85)');
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.strokeStyle = rStyle.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (fighter.isEvolved || fighter.petType === 'cuu_vi_hong_ho') {
      drawElementalPetBorderFX(ctx, petBoxX, petBoxY, petBoxW, petBoxH, 12, fighter.element, {
        allowShadowBlur: false,
        lineWidth: 2.2,
      });
    }

    if (petImg) {
      const maxW = 152;
      const maxH = 136;
      const asp = petImg.width / petImg.height;
      const dw = asp > maxW / maxH ? maxW : maxH * asp;
      const dh = asp > maxW / maxH ? maxW / asp : maxH;
      ctx.save();
      if (isFinal && !isWinner) ctx.globalAlpha = 0.78;
      ctx.shadowColor = rStyle.color;
      ctx.shadowBlur = 0;
      ctx.drawImage(petImg, petBoxX + (petBoxW - dw) / 2, petBoxY + 12 + (petBoxH - 12 - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Tag Hệ + Lv & Rarity trên khung Pet (giữ nguyên toàn văn 'Tối Thượng Thần Thoại' / 'Tối Thượng Chân Thần', tự co cỡ chữ nếu cần)
    let pillFont = 9.0;
    ctx.font = `bold ${pillFont}px ${FONT_FAMILY}`;
    const elTag = `Hệ ${fighter.element} • Lv.${fighter.level} • ${fighter.star || 1}★`;
    const rarTag = sanitizeText(fighter.petRarity || 'Phàm Phẩm');
    let elW = ctx.measureText(elTag).width + 12;
    let rarW = ctx.measureText(rarTag).width + 12;
    while (elW + rarW > petBoxW - 18 && pillFont > 7.4) {
      pillFont = Number((pillFont - 0.4).toFixed(1));
      ctx.font = `bold ${pillFont}px ${FONT_FAMILY}`;
      elW = ctx.measureText(elTag).width + 10;
      rarW = ctx.measureText(rarTag).width + 10;
    }

    drawRoundRect(ctx, petBoxX + 8, petBoxY + 8, elW, 20, 5);
    ctx.fillStyle = 'rgba(15, 12, 28, 0.88)';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(elTag, petBoxX + 8 + elW / 2, petBoxY + 18);

    drawRoundRect(ctx, petBoxX + petBoxW - rarW - 8, petBoxY + 8, rarW, 20, 5);
    ctx.fillStyle = rStyle.bg;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rarTag, petBoxX + petBoxW - rarW - 8 + rarW / 2, petBoxY + 18);

    // Huy hiệu Phẩm Chất Khắc Ấn Pet (góc dưới phải khung Pet)
    drawGradeBadgeCanvas(ctx, gradeBadges, fighter.enchantGrade || fighter.enchant_grade || 'D', petBoxX + petBoxW - 30, petBoxY + petBoxH - 28, 22);

    // Tên Linh Thú (tự động fit 1 dòng, không cắt cụt)
    drawAutoFitSingleLineText(ctx, fighter.petName, x + w / 2, y + 255, w - 32, {
      maxFont: 15.5,
      minFont: 10.0,
      weight: 'bold',
      align: 'center',
      color: '#ffffff',
    });

    // Thanh HP Màu Hồng (#e1528a theo mẫu Tiểu thư)
    const hpX = x + 16;
    const hpY = y + 272;
    const hpW = w - 32;
    const hpH = 24;
    const maxHp = Math.max(1, Number(fighter.maxHp) || 1);
    const curHp = Math.max(0, Number(fighter.displayHp) || 0);
    const hpRatio = Math.min(1, curHp / maxHp);

    drawRoundRect(ctx, hpX, hpY, hpW, hpH, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(225, 82, 138, 0.40)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (hpRatio > 0) {
      const fillW = Math.max(12, (hpW - 2) * hpRatio);
      ctx.save();
      drawRoundRect(ctx, hpX + 1, hpY + 1, fillW, hpH - 2, 7);
      ctx.clip();

      const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpW, hpY + hpH);
      if (hpRatio > 0.25) {
        hpGrad.addColorStop(0, '#cc3b76');
        hpGrad.addColorStop(0.5, '#e1528a');
        hpGrad.addColorStop(1, '#f06ea3');
      } else {
        hpGrad.addColorStop(0, '#9d174d');
        hpGrad.addColorStop(0.55, '#be185d');
        hpGrad.addColorStop(1, '#e1528a');
      }
      ctx.fillStyle = hpGrad;
      ctx.fillRect(hpX + 1, hpY + 1, fillW, hpH - 2);

      // Glossy top sheen nhẹ
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(hpX + 1, hpY + 1, fillW, (hpH - 2) * 0.36);
      ctx.restore();
    }

    ctx.font = `bold 11px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;
    ctx.fillText(
      `HP: ${curHp.toLocaleString('vi-VN')} / ${maxHp.toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`,
      hpX + hpW / 2,
      hpY + hpH / 2 + 0.5
    );
    ctx.shadowBlur = 0;

    // Thanh 3 chỉ số nằm ngang ATK | DEF | SPD (bỏ HP) với huy hiệu lục giác vàng đào
    const barX = x + 16;
    const barY = y + 308;
    const barW = w - 32; // 328
    const barH = 36;
    drawRoundRect(ctx, barX, barY, barW, barH, 10);
    ctx.fillStyle = 'rgba(18, 17, 34, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const colW = barW / 3;
    const stats3 = [
      { label: 'ATK', val: fighter.atk },
      { label: 'DEF', val: fighter.def },
      { label: 'SPD', val: fighter.spd },
    ];
    stats3.forEach((st, idx) => {
      const colX = barX + idx * colW;
      if (idx > 0) {
        ctx.beginPath();
        ctx.moveTo(colX, barY + 8);
        ctx.lineTo(colX, barY + barH - 8);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      drawHexBadge(ctx, colX + 6, barY + 8.5, 38, 19, st.label, { fontSize: 9.5 });

      const valStr = Number(st.val || 0).toLocaleString('vi-VN');
      drawAutoFitSingleLineText(ctx, valStr, colX + 49, barY + barH / 2 + 0.5, colW - 54, {
        maxFont: 11.5,
        minFont: 7.5,
        weight: 'bold',
        align: 'left',
        color: '#ffffff',
      });
    });

    // 3 Ô Trang Bị Loadout (Vũ Khí • Bảo Ngọc • Chiến Hồn) — Tên đầy đủ 1 dòng, KHÔNG cắt cụt
    const eqY = y + 356;
    const eqGap = 6;
    const eqSlotW = Math.floor((w - 32 - eqGap * 2) / 3); // 105
    const eqSlotH = 82;
    const eqDefs = [
      { key: 'weapon', label: 'VŨ KHÍ', img: eqImgs[0] },
      { key: 'gem', label: 'BẢO NGỌC', img: eqImgs[1] },
      { key: 'soul', label: 'CHIẾN HỒN', img: eqImgs[2] },
    ];
    eqDefs.forEach((slot, idx) => {
      const sx = x + 16 + idx * (eqSlotW + eqGap);
      const item = fighter.equipment?.[slot.key] || null;
      const itemRar = item ? (RARITY_ACCENTS[normalizeRarityKey(item.rarity)] || RARITY_ACCENTS.common) : null;

      drawRoundRect(ctx, sx, eqY, eqSlotW, eqSlotH, 8);
      if (item) {
        const sBg = ctx.createLinearGradient(sx, eqY, sx + eqSlotW, eqY + eqSlotH);
        sBg.addColorStop(0, itemRar.slotBg[0]);
        sBg.addColorStop(1, itemRar.slotBg[1]);
        ctx.fillStyle = sBg;
        ctx.fill();

        ctx.save();
        ctx.shadowColor = itemRar.slotGlow;
        ctx.shadowBlur = 5;
        const sBorder = ctx.createLinearGradient(sx, eqY, sx + eqSlotW, eqY + eqSlotH);
        sBorder.addColorStop(0, itemRar.slotBorder[0]);
        sBorder.addColorStop(1, itemRar.slotBorder[1]);
        ctx.strokeStyle = sBorder;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.restore();

        const nm = sanitizeText(item.item_name || '').replace(/[«»]/g, '').trim();
        if (slot.img) {
          ctx.save();
          drawRoundRect(ctx, sx + 8, eqY + 8, 32, 32, 6);
          ctx.clip();
          ctx.drawImage(slot.img, sx + 8, eqY + 8, 32, 32);
          ctx.restore();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `bold 8.8px ${FONT_FAMILY}`;
          ctx.fillStyle = itemRar.text;
          ctx.fillText(slot.label, sx + 45, eqY + 24);
          drawGradeBadgeCanvas(ctx, gradeBadges, item.enchant_grade || 'D', sx + 26, eqY + 26, 16);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold 9px ${FONT_FAMILY}`;
          ctx.fillStyle = itemRar.text;
          ctx.fillText(slot.label, sx + eqSlotW / 2, eqY + 22);
          drawGradeBadgeCanvas(ctx, gradeBadges, item.enchant_grade || 'D', sx + eqSlotW - 21, eqY + 5, 15);
        }

        drawAutoFitSingleLineText(ctx, nm, sx + eqSlotW / 2, eqY + 61, eqSlotW - 10, {
          maxFont: 9.5,
          minFont: 6.0,
          weight: 'bold',
          align: 'center',
          color: '#ffffff',
        });
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 9px ${FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(slot.label, sx + eqSlotW / 2, eqY + 28);
        ctx.font = `9.5px ${FONT_FAMILY}`;
        ctx.fillStyle = '#475569';
        ctx.fillText('Trống', sx + eqSlotW / 2, eqY + 54);
      }
    });

    ctx.restore();
  }

  drawFighterPanel(atk, atkAv, atkFrameOverlay, atkPetImg, atkEqImgs, atkDomImgs, atkWon, 22, 'left');
  drawFighterPanel(def, defAv, defFrameOverlay, defPetImg, defEqImgs, defDomImgs, !atkWon, 618, 'right');

  // ============================================================================
  // LỚP 3: CỘT GIỮA — CHỮ VS METALLIC, NGŨ HÀNH, ĐỐI ĐẦU LINH VỰC & WINNER
  // ============================================================================
  const midX = 392;
  const midW = 216;
  const midCx = midX + midW / 2; // 500

  ctx.save();
  // Chữ VS đẩy lên cân đối cùng khung Đối Đầu Linh Vực
  const vsCy = 104;
  const drawTaperLine = (x1, x2, fadeLeftToRight) => {
    ctx.save();
    ctx.beginPath();
    if (fadeLeftToRight) {
      ctx.moveTo(x1, vsCy);
      ctx.lineTo(x2, vsCy - 1.3);
      ctx.lineTo(x2, vsCy + 1.3);
    } else {
      ctx.moveTo(x1, vsCy - 1.3);
      ctx.lineTo(x2, vsCy);
      ctx.lineTo(x1, vsCy + 1.3);
    }
    ctx.closePath();
    const lg = ctx.createLinearGradient(x1, vsCy, x2, vsCy);
    lg.addColorStop(0, fadeLeftToRight ? 'rgba(255, 200, 150, 0)' : '#ffe5c4');
    lg.addColorStop(1, fadeLeftToRight ? '#ffe5c4' : 'rgba(255, 200, 150, 0)');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
  };
  drawTaperLine(398, 446, true);
  drawTaperLine(554, 602, false);

  ctx.font = `italic 900 50px ${FONT_FAMILY}`;
  const vsGrad = ctx.createLinearGradient(midCx - 35, vsCy - 24, midCx + 35, vsCy + 24);
  vsGrad.addColorStop(0, '#fff2da');
  vsGrad.addColorStop(0.5, '#ffc48e');
  vsGrad.addColorStop(1, '#e38d58');
  ctx.fillStyle = vsGrad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 190, 130, 0.35)';
  ctx.shadowBlur = 0;
  ctx.fillText('VS', midCx, vsCy + 1);
  ctx.shadowBlur = 0;

  // Khung 1: Hệ xung khắc Ngũ Hành Linh Thú (y = 148, h = 62)
  const adv = resolveElementMatchupDisplay(battleResult?.elementMatchup);
  const advBoxX = 396;
  const advBoxY = 148;
  const advBoxW = 208;
  const advBoxH = 62;
  drawRoundRect(ctx, advBoxX, advBoxY, advBoxW, advBoxH, 10);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.90)';
  ctx.fill();
  ctx.strokeStyle = adv.color;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  const leftElem = sanitizeText(atk.element || 'Thổ');
  const rightElem = sanitizeText(def.element || 'Thổ');
  const elemRowY = advBoxY + 22;
  drawAutoFitSingleLineText(ctx, leftElem, midCx - 24, elemRowY, 72, {
    maxFont: 11.5,
    minFont: 7.5,
    weight: 'bold',
    align: 'right',
    color: adv.dir === 'right' ? '#ffffff' : '#cbd5e1',
  });
  drawCounterArrow(ctx, midCx, elemRowY, adv.dir, adv.color);
  drawAutoFitSingleLineText(ctx, rightElem, midCx + 24, elemRowY, 72, {
    maxFont: 11.5,
    minFont: 7.5,
    weight: 'bold',
    align: 'left',
    color: adv.dir === 'left' ? '#ffffff' : '#cbd5e1',
  });

  drawAutoFitSingleLineText(ctx, adv.subText, midCx, advBoxY + 45, advBoxW - 18, {
    maxFont: 10.2,
    minFont: 7.8,
    weight: 'bold',
    align: 'center',
    color: adv.color,
  });

  // Khung 2: ĐỐI ĐẦU LINH VỰC (HIỆP 2+) tại y = 222, h = 136
  const domBoxX = 396;
  const domBoxY = 222;
  const domBoxW = 208;
  const domBoxH = 136;
  const leftDom = atkDomainLoadout.domain;
  const rightDom = defDomainLoadout.domain;
  const dSum = battleResult?.domainSummary || {};
  const dAtkSum = dSum.attacker || {};
  const dDefSum = dSum.defender || {};
  const beforeTurn2 = !isFinal && Number(frame?.currentTurn || 1) < 2;

  drawRoundRect(ctx, domBoxX, domBoxY, domBoxW, domBoxH, 11);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.92)';
  ctx.fill();
  ctx.strokeStyle = (leftDom || rightDom) ? 'rgba(236, 72, 153, 0.65)' : 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.font = `bold 9.5px ${FONT_FAMILY}`;
  ctx.fillStyle = (leftDom || rightDom) ? '#fde047' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ĐỐI ĐẦU LINH VỰC (HIỆP 2+)', midCx, domBoxY + 16);

  if (!leftDom && !rightDom) {
    ctx.font = `bold 10.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Chưa Khai Mở Linh Vực', midCx, domBoxY + 64);
    drawRoundRect(ctx, domBoxX + 14, domBoxY + 94, domBoxW - 28, 26, 6);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.fill();
    drawAutoFitSingleLineText(ctx, 'Săn Linh Vực tại /roll loai:domain', midCx, domBoxY + 107, domBoxW - 36, {
      maxFont: 8.8, minFont: 7.0, align: 'center', color: '#64748b',
    });
  } else {
    const dIconSize = 36;
    const dLeftX = domBoxX + 14;
    const dRightX = domBoxX + domBoxW - 14 - dIconSize;
    const dIconY = domBoxY + 30;

    const drawMiniCenterDomainIcon = (img, ix, borderCol) => {
      if (img) {
        ctx.save();
        drawRoundRect(ctx, ix, dIconY, dIconSize, dIconSize, 6);
        ctx.clip();
        ctx.drawImage(img, ix, dIconY, dIconSize, dIconSize);
        ctx.restore();
        drawRoundRect(ctx, ix, dIconY, dIconSize, dIconSize, 6);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        drawRoundRect(ctx, ix, dIconY, dIconSize, dIconSize, 6);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('Trống', ix + dIconSize / 2, dIconY + dIconSize / 2);
      }
    };

    drawMiniCenterDomainIcon(atkDomImgs[0], dLeftX, '#ec4899');
    drawMiniCenterDomainIcon(defDomImgs[0], dRightX, '#38bdf8');

    const counter = (leftDom && rightDom)
      ? getDomainElementCounterResult(leftDom.element, rightDom.element)
      : { aCountersB: Boolean(leftDom && !rightDom), bCountersA: Boolean(!leftDom && rightDom) };
    const domDir = counter.aCountersB ? 'right' : counter.bCountersA ? 'left' : 'neutral';
    const domArrowColor = domDir === 'right' ? '#4ade80' : domDir === 'left' ? '#38bdf8' : '#cbd5e1';

    const formatMach = (domObj, senseObj, sideSum, frameEnergy, showLive) => {
      if (!domObj) return '0';
      if (domObj.base_energy >= 999 || sideSum?.startEnergy >= 999 || frameEnergy >= 999) return '∞';
      const maxE = sideSum?.startEnergy || (Number(domObj.base_energy || 3) + Number(senseObj?.bonus_energy || 0));
      if (!showLive) return `${maxE}/${maxE}`;
      const curE = frameEnergy !== undefined && frameEnergy !== null
        ? frameEnergy
        : (sideSum?.endEnergy !== undefined ? sideSum.endEnergy : maxE);
      return `${curE}/${maxE}`;
    };
    const hasFrameDomain = frame && (frame.domainAtkEnergy !== undefined || frame.domainDefEnergy !== undefined);
    const showDomainLive = !beforeTurn2 && (isFinal || hasFrameDomain);
    const leftM = formatMach(leftDom, atkDomainLoadout.sense, dAtkSum, frame?.domainAtkEnergy, showDomainLive);
    const rightM = formatMach(rightDom, defDomainLoadout.sense, dDefSum, frame?.domainDefEnergy, showDomainLive);
    const curAtkE = frame?.domainAtkEnergy !== undefined ? frame.domainAtkEnergy : dAtkSum.endEnergy;
    const curDefE = frame?.domainDefEnergy !== undefined ? frame.domainDefEnergy : dDefSum.endEnergy;

    drawCounterArrow(ctx, midCx, dIconY + 11, beforeTurn2 ? 'neutral' : domDir, domArrowColor);
    drawAutoFitSingleLineText(ctx, `${leftM} vs ${rightM} Mạch`, midCx, dIconY + 27, 104, {
      maxFont: 9.5,
      minFont: 7.2,
      weight: 'bold',
      align: 'center',
      color: '#fbcfe8',
    });

    const domElemRowY = domBoxY + 82;
    drawAutoFitSingleLineText(ctx, leftDom?.element || 'Trống', midCx - 18, domElemRowY, 76, {
      maxFont: 9.5,
      minFont: 7.0,
      weight: 'bold',
      align: 'right',
      color: domDir === 'right' ? '#ffffff' : '#cbd5e1',
    });
    drawCounterArrow(ctx, midCx, domElemRowY, beforeTurn2 ? 'neutral' : domDir, domArrowColor);
    drawAutoFitSingleLineText(ctx, rightDom?.element || 'Trống', midCx + 18, domElemRowY, 76, {
      maxFont: 9.5,
      minFont: 7.0,
      weight: 'bold',
      align: 'left',
      color: domDir === 'left' ? '#ffffff' : '#cbd5e1',
    });

    const statusPillText = (() => {
      if (frame?.domainStatusText) return frame.domainStatusText;
      if (beforeTurn2) return 'Kích hoạt từ Hiệp 2...';
      if (leftDom && !rightDom) return 'Phe Công Đơn Phương Áp Chế';
      if (!leftDom && rightDom) return 'Phe Thủ Đơn Phương Áp Chế';
      if (leftDom.element === 'Hỗn Độn Vực' && rightDom.element !== 'Hỗn Độn Vực') return 'Xuyên Vực 100% • Khóa Debuff Địch';
      if (rightDom.element === 'Hỗn Độn Vực' && leftDom.element !== 'Hỗn Độn Vực') return 'Xuyên Vực 100% • Khóa Debuff Công';
      if (showDomainLive && curDefE === 0 && (curAtkE > 0 || leftM === '∞')) return 'Vỡ Vực Thủ • Khai Mở Toàn Debuff';
      if (showDomainLive && curAtkE === 0 && (curDefE > 0 || rightM === '∞')) return 'Vỡ Vực Công • Khai Mở Toàn Debuff';
      if (counter.aCountersB) return 'Vực Công Áp Chế (-1 vs -2 Mạch)';
      if (counter.bCountersA) return 'Vực Thủ Áp Chế (-2 vs -1 Mạch)';
      return 'Giằng Co Cân Bằng (-1 Mạch/Hiệp)';
    })();

    drawRoundRect(ctx, domBoxX + 10, domBoxY + 98, domBoxW - 20, 26, 6);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawAutoFitSingleLineText(ctx, statusPillText, midCx, domBoxY + 111, domBoxW - 28, {
      maxFont: 9.0,
      minFont: 6.8,
      weight: 'bold',
      align: 'center',
      color: '#fbcfe8',
    });
  }

  // Khung đáy giữa: ĐANG GIAO CHIẾN (mid frame) hoặc WINNER (final frame)
  const winX = 394;
  const winY = 372;
  const winW = 212;
  const winH = 106;
  drawRoundRect(ctx, winX, winY, winW, winH, 14);

  if (!isFinal) {
    const midGrad = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH);
    midGrad.addColorStop(0, 'rgba(126, 34, 206, 0.36)');
    midGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.30)');
    midGrad.addColorStop(1, 'rgba(59, 130, 246, 0.36)');
    ctx.fillStyle = midGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 11.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#fde047';
    ctx.fillText('ĐANG GIAO CHIẾN', midCx, winY + 24);

    const turnHeadline = frame?.currentTurn > 0
      ? `HIỆP ${frame.currentTurn} / ${frame.totalTurns || frame.currentTurn}`
      : 'KHAI TRẬN';
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(turnHeadline, midCx, winY + 54);

    drawAutoFitSingleLineText(ctx, frame?.turnLabel || 'Đang tung tuyệt kỹ...', midCx, winY + 82, winW - 22, {
      maxFont: 10.5,
      minFont: 8.0,
      weight: '',
      align: 'center',
      color: '#e2e8f0',
    });
  } else {
    const winGrad = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH);
    winGrad.addColorStop(0, 'rgba(217, 119, 6, 0.48)');
    winGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.44)');
    winGrad.addColorStop(1, 'rgba(245, 158, 11, 0.48)');
    ctx.fillStyle = winGrad;
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.shadowBlur = 0;

    drawStarSparkle(ctx, winX + 18, winY + 18, 5, '#fef08a', '#fbbf24');
    drawStarSparkle(ctx, winX + winW - 18, winY + 18, 5, '#fef08a', '#fbbf24');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 12.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#fde047';
    ctx.fillText('WINNER', midCx, winY + 21);

    drawAutoFitSingleLineText(ctx, battleResult?.winner?.name || atk.name, midCx, winY + 49, winW - 22, {
      maxFont: 17,
      minFont: 10.5,
      weight: 'bold',
      align: 'center',
      color: '#ffffff',
    });

    const winnerPetName = battleResult?.winner?.pet || winnerCombatant.petName;
    drawCenteredAutoFitIconText(ctx, winnerPetMiniIcon, winnerPetName, midCx, winY + 80, winW - 20, {
      iconSize: 20,
      gap: 6,
      maxFont: 12,
      minFont: 8.5,
      weight: 'bold',
      color: '#fbcfe8',
    });
  }
  ctx.restore();

  return encodeCanvas(canvas, format, webpQuality);
}

export default renderBattleCard;
