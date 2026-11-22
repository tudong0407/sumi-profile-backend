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
  if (!pathOrUrl) return null;
  try {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const resp = await fetch(pathOrUrl, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      return await loadImage(buf);
    }
    const local = resolveAssetPath(pathOrUrl);
    if (!local) return null;
    return await loadImage(local);
  } catch {
    return null;
  }
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

async function drawLeaderDomainCorner(ctx, domainInfo, x, y, w, h, accentColor) {
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
    ctx.fillText('Đội Trưởng Chưa Mở Linh Vực', x + w / 2, y + h / 2 + 6);
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
  ctx.fillText(`LINH VỰC ĐỘI TRƯỞNG (${energyTxt}${daoApTag})`, x + 82, y + 28);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 19px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, domainInfo.name, w - 165), x + 82, y + 54);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 14px ${FONT_FAMILY}`;
  ctx.fillText(sanitizeText(domainInfo.element || ''), x + 82, y + 74);
  ctx.restore();
}

async function drawFighterStrip(ctx, unit, x, y, w, h, sideColor) {
  const isKo = Number(unit.currentHp || 0) <= 0;
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = isKo ? 'rgba(22, 16, 30, 0.72)' : 'rgba(26, 19, 44, 0.90)';
  ctx.fill();
  ctx.strokeStyle = isKo ? 'rgba(244, 63, 94, 0.35)' : sideColor;
  ctx.lineWidth = unit.isLeader ? 2.5 : 1.5;
  ctx.stroke();

  // Pet sprite bên trái (compact 148x148, contain để giữ nền trong suốt đẹp)
  const mappedPetFile = PET_IMAGE_MAP[unit.pet?.pet_type];
  const petImg = (mappedPetFile ? await safeLoadImage(mappedPetFile) : null)
    || await safeLoadImage(`pets/${unit.pet?.pet_type}.png`)
    || await safeLoadImage(`${unit.pet?.pet_type}.png`);
  const spriteBox = 148;
  const spX = x + 14;
  const spY = y + (h - spriteBox) / 2;
  drawRoundRect(ctx, spX, spY, spriteBox, spriteBox, 16);
  ctx.fillStyle = 'rgba(15, 11, 28, 0.9)';
  ctx.fill();
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

  // Avatar nhỏ góc trên trái của sprite
  const avImg = await safeLoadImage(unit.avatarUrl);
  if (avImg) {
    drawClippedImage(ctx, avImg, x + 10, y + 12, 42, 21);
  }

  const tx = x + 178;
  const tw = w - 194;

  // Tên thành viên + badge Đội Trưởng / Mệt Mỏi
  ctx.textAlign = 'left';
  ctx.fillStyle = isKo ? '#94a3b8' : '#ffffff';
  ctx.font = `700 23px ${FONT_FAMILY}`;
  const leaderPrefix = unit.isLeader ? '👑 ' : '';
  ctx.fillText(truncateText(ctx, `${leaderPrefix}${unit.name}`, tw - 170), tx, y + 38);

  if (unit.fatiguePenaltyPct > 0) {
    const fLabel = `Mệt -${unit.fatiguePenaltyPct}%`;
    drawRoundRect(ctx, x + w - 140, y + 14, 124, 30, 8);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(fLabel, x + w - 78, y + 34);
    ctx.textAlign = 'left';
  }

  // Tên Pet + Hệ + Lv/Sao
  ctx.fillStyle = '#f9a8d4';
  ctx.font = `600 18px ${FONT_FAMILY}`;
  const petMeta = `${unit.pet?.pet_name || 'Linh Thú'} • ${unit.pet?.element || ''} • Lv.${unit.pet?.level || 1} • ${unit.pet?.star || 1}★`;
  ctx.fillText(truncateText(ctx, petMeta, tw), tx, y + 66);

  // Thanh HP
  const hpRatio = Math.max(0, Math.min(1, Number(unit.currentHp || 0) / Math.max(1, Number(unit.maxHp || 1))));
  const barY = y + 80;
  const barH = 26;
  drawRoundRect(ctx, tx, barY, tw, barH, 13);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  if (hpRatio > 0) {
    drawRoundRect(ctx, tx, barY, Math.max(18, tw * hpRatio), barH, 13);
    const hpGrad = ctx.createLinearGradient(tx, barY, tx + tw, barY);
    hpGrad.addColorStop(0, '#ec4899');
    hpGrad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = hpGrad;
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 15px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  const hpTxt = isKo
    ? 'ĐÃ GỤC (0 HP)'
    : `HP: ${Number(unit.currentHp).toLocaleString('vi-VN')} / ${Number(unit.maxHp).toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`;
  ctx.fillText(hpTxt, tx + tw / 2, barY + 18);

  // Chỉ số ATK / DEF / SPD + 3 Mini Icon Pháp Bảo
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `600 16px ${FONT_FAMILY}`;
  ctx.fillText(
    `ATK ${Number(unit.atk).toLocaleString('vi-VN')}  •  DEF ${Number(unit.def).toLocaleString('vi-VN')}  •  SPD ${Number(unit.spd).toLocaleString('vi-VN')}`,
    tx,
    y + 132,
  );

  // 3 ô Pháp Bảo thu gọn bên dưới
  const eqSlots = [unit.equipment?.weapon, unit.equipment?.gem, unit.equipment?.soul];
  let ex = tx;
  const ey = y + 144;
  for (const piece of eqSlots) {
    drawRoundRect(ctx, ex, ey, 46, 46, 9);
    ctx.fillStyle = 'rgba(15, 10, 28, 0.85)';
    ctx.fill();
    ctx.strokeStyle = piece ? (GRADE_COLORS[piece.enchant_grade || 'D'] || '#64748b') : 'rgba(148,163,184,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (piece?.item_id) {
      const iImg = await safeLoadImage(`items/${piece.item_id}.png`) || await safeLoadImage(`${piece.item_id}.png`);
      if (iImg) drawClippedImage(ctx, iImg, ex + 3, ey + 3, 40, 7);
      // Mini badge bậc Khắc Ấn góc dưới phải
      const g = String(piece.enchant_grade || 'D').toUpperCase();
      ctx.fillStyle = GRADE_COLORS[g] || '#94a3b8';
      drawRoundRect(ctx, ex + 28, ey + 28, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 12px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(g, ex + 37, ey + 41);
      ctx.textAlign = 'left';
    }
    ex += 56;
  }

  // Lực chiến góc dưới phải
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fcd34d';
  ctx.font = `700 17px ${FONT_FAMILY}`;
  ctx.fillText(`⚡ ${Number(unit.powerScore || 0).toLocaleString('vi-VN')} Lực`, x + w - 18, y + h - 18);

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
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

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
  ctx.fillStyle = leftWon ? '#34d399' : '#fda4af';
  ctx.font = `800 24px ${FONT_FAMILY}`;
  ctx.fillText(`ĐỘI KHIÊU CHIẾN (${(battleResult.teamA || []).length} NGƯỜI) — ${leftWon ? 'CHIẾN THẮNG' : 'THẤT BẠI'}`, leftX, headerY + 26);

  ctx.textAlign = 'right';
  ctx.fillStyle = !leftWon ? '#34d399' : '#fda4af';
  const isBossMode = (battleResult.teamB || []).length === 1 && battleResult.teamB[0]?.isBoss;
  ctx.fillText(
    `${isBossMode ? 'BOSS TRẤN THỦ LINH MẠCH' : `ĐỘI PHÒNG THỦ (${(battleResult.teamB || []).length} NGƯỜI)`} — ${!leftWon ? 'GIỮ VỮNG' : 'THẤT THỦ'}`,
    rightX + colW,
    headerY + 26,
  );

  // Hộp Linh Vực Đội Trưởng 2 bên
  await drawLeaderDomainCorner(ctx, battleResult.leaderDomainA, leftX, headerY + 42, colW, 88, '#ec4899');
  await drawLeaderDomainCorner(ctx, battleResult.leaderDomainB, rightX, headerY + 42, colW, 88, '#f59e0b');

  // 3 hàng chiến sĩ bên Trái
  const stripStartY = 244;
  const stripH = 266;
  const stripGap = 20;
  for (let i = 0; i < Math.min(3, (battleResult.teamA || []).length); i += 1) {
    await drawFighterStrip(ctx, battleResult.teamA[i], leftX, stripStartY + i * (stripH + stripGap), colW, stripH, '#ec4899');
  }

  // Bên Phải: Grand Boss Panel (nếu 3vBoss) HOẶC 3 hàng chiến sĩ (nếu 3v3)
  if (isBossMode) {
    await drawGrandBossPanel(ctx, battleResult.teamB[0], rightX, stripStartY, colW, stripH * 3 + stripGap * 2);
  } else {
    for (let i = 0; i < Math.min(3, (battleResult.teamB || []).length); i += 1) {
      await drawFighterStrip(ctx, battleResult.teamB[i], rightX, stripStartY + i * (stripH + stripGap), colW, stripH, '#38bdf8');
    }
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
  ctx.strokeStyle = leftWon ? '#10b981' : '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.font = `800 20px ${FONT_FAMILY}`;
  ctx.fillText(leftWon ? '🏆 CHIẾM MỎ THÀNH CÔNG' : '🛡️ GIỮ VỮNG LINH MẠCH', midX, boxY + 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 22px ${FONT_FAMILY}`;
  const winnerLead = leftWon ? battleResult.teamA?.[0]?.name : battleResult.teamB?.[0]?.name;
  ctx.fillText(truncateText(ctx, winnerLead || 'Người Thắng', boxW - 24), midX, boxY + 92);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.fillText(`Tổng số hiệp: ${battleResult.turnCount || 1} Hiệp`, midX, boxY + 132);
  ctx.fillText(isBossMode ? 'Chế độ: Tổ Đội vs BOSS' : 'Chế độ: Tổ Đội 3v3', midX, boxY + 164);

  // Footer
  ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
  ctx.font = `500 17px ${FONT_FAMILY}`;
  ctx.fillText('SuMi Family v1.4 • Chiến Báo Tổ Đội Chiếm Đoạt Linh Mạch • Trợ Lý Linh Hồ AI Nhiễm Nhiễm', WIDTH / 2, HEIGHT - 34);

  return format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/webp', 88);
}
