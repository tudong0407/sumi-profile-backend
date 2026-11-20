/**
 * src/canvas/battleRenderer.js
 * Kết xuất Ảnh Chiến Báo Đấu Trường Linh Thú 1v1 chuẩn Full HD+ (2000 x 1000 px, 2x High-DPI).
 */

import { createCanvas } from '@napi-rs/canvas';
import {
  loadImageSafe,
  drawRoundRect,
  truncateText,
  drawAntiAliasedAvatarWithBorder,
  drawStarSparkle,
  sanitizeText,
  resolveAssetPath,
  FONT_FAMILY,
} from './drawUtils.js';
import { FUYUMI_USER_ID, normalizeRarityKey } from '../data/catalog.js';

const RENDER_SCALE = 2;
const LOGICAL_W = 1000;
const LOGICAL_H = 500;

const RARITY_ACCENTS = {
  common: { color: '#94a3b8', bg: 'rgba(51, 65, 85, 0.72)' },
  rare: { color: '#38bdf8', bg: 'rgba(29, 78, 216, 0.65)' },
  epic: { color: '#c084fc', bg: 'rgba(126, 34, 206, 0.68)' },
  mythic: { color: '#fbbf24', bg: 'rgba(190, 18, 60, 0.78)' },
  supreme: { color: '#fde047', bg: 'rgba(219, 39, 119, 0.85)' },
};

function resolvePetAsset(petType) {
  if (!petType) return 'pets/hoa_thach_nham_nham.png';
  if (petType === 'cuu_vi_hong_ho') return 'pets/cuu_vi_hong_ho_transparent.png';
  const candidate = `pets/${petType}.png`;
  return resolveAssetPath(candidate) ? candidate : 'pets/hoa_thach_nham_nham.png';
}

function getElementAdvantageBadge(matchup) {
  const a2d = matchup?.attackerToDefender;
  const d2a = matchup?.defenderToAttacker;
  if (a2d?.isTrueDamage && !d2a?.isTrueDamage) {
    return { text: 'Trái: Hỗn Độn +20% Xuyên Giáp', color: '#f472b6' };
  }
  if (d2a?.isTrueDamage && !a2d?.isTrueDamage) {
    return { text: 'Phải: Hỗn Độn +20% Xuyên Giáp', color: '#f472b6' };
  }
  if (a2d?.multiplier >= 1.25 && d2a?.multiplier >= 1.25) {
    return { text: 'Ám ↔ Quang Tương Sát (+25%)', color: '#c084fc' };
  }
  if (a2d?.multiplier > 1.0) {
    const pct = Math.round((a2d.multiplier - 1) * 100);
    return { text: `Trái Thuận Khắc (+${pct}% DMG)`, color: '#4ade80' };
  }
  if (d2a?.multiplier > 1.0) {
    const pct = Math.round((d2a.multiplier - 1) * 100);
    return { text: `Phải Thuận Khắc (+${pct}% DMG)`, color: '#38bdf8' };
  }
  return { text: 'Ngũ Hành Cân Bằng', color: '#cbd5e1' };
}

/**
 * Render Ảnh Chiến Báo 1v1 Full HD+ (2000 x 1000 px)
 * @param {object} battleResult Kết quả từ simulateBattle()
 * @returns {Promise<Buffer>} PNG Buffer
 */
export async function renderBattleCard(battleResult) {
  const canvas = createCanvas(LOGICAL_W * RENDER_SCALE, LOGICAL_H * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const atk = battleResult?.combatants?.attacker || {
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

  const def = battleResult?.combatants?.defender || {
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

  const atkWon = String(battleResult?.winner?.id) === String(atk.id);
  const turnCount = Number(battleResult?.turnCount) || (battleResult?.turns?.length ? battleResult.turns[battleResult.turns.length - 1].turn : 1);

  // Tải song song avatar, ảnh pet và 6 icon trang bị
  const loadEquipIcons = (eq) => Promise.all([
    eq?.weapon?.item_id ? loadImageSafe(`items/${eq.weapon.item_id}.png`, 2000, null) : null,
    eq?.gem?.item_id ? loadImageSafe(`items/${eq.gem.item_id}.png`, 2000, null) : null,
    eq?.soul?.item_id ? loadImageSafe(`items/${eq.soul.item_id}.png`, 2000, null) : null,
  ]);

  const [atkAv, defAv, atkPetImg, defPetImg, atkEqImgs, defEqImgs] = await Promise.all([
    loadImageSafe(atk.avatarUrl, 2500, atk.id === FUYUMI_USER_ID ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    loadImageSafe(def.avatarUrl, 2500, def.id === FUYUMI_USER_ID ? 'fuyumi_avatar.png' : 'default_avatar.png'),
    loadImageSafe(resolvePetAsset(atk.petType), 2500, 'pets/hoa_thach_nham_nham.png'),
    loadImageSafe(resolvePetAsset(def.petType), 2500, 'pets/hoa_thach_nham_nham.png'),
    loadEquipIcons(atk.equipment),
    loadEquipIcons(def.equipment),
  ]);

  // ============================================================================
  // LỚP 1: NỀN ĐẤU TRƯỜNG TIÊN GIỚI (ARENA BACKDROP)
  // ============================================================================
  const bg = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
  bg.addColorStop(0, '#0a0716');
  bg.addColorStop(0.5, '#170d2e');
  bg.addColorStop(1, '#09091a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Ánh sáng đối lập Trái (Hồng-Đỏ) & Phải (Lam-Tím)
  const leftGlow = ctx.createRadialGradient(180, 250, 20, 180, 250, 310);
  leftGlow.addColorStop(0, 'rgba(244, 63, 94, 0.24)');
  leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const rightGlow = ctx.createRadialGradient(820, 250, 20, 820, 250, 310);
  rightGlow.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Khung viền ngoài
  ctx.save();
  drawRoundRect(ctx, 12, 12, LOGICAL_W - 24, LOGICAL_H - 24, 18);
  const outerGrad = ctx.createLinearGradient(12, 12, LOGICAL_W - 12, LOGICAL_H - 12);
  outerGrad.addColorStop(0, 'rgba(244, 63, 94, 0.62)');
  outerGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.58)');
  outerGrad.addColorStop(1, 'rgba(56, 189, 248, 0.62)');
  ctx.strokeStyle = outerGrad;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  // Header đấu trường
  ctx.save();
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
  ctx.shadowBlur = 10;
  ctx.fillText(`ĐẤU TRƯỜNG LINH THÚ 1V1  •  CHIẾN BÁO ${turnCount} HIỆP`, LOGICAL_W / 2, 36);
  ctx.restore();

  // ============================================================================
  // LỚP 2: HAI KHUNG ĐẤU SĨ TRÁI (ATTACKER) & PHẢI (DEFENDER)
  // ============================================================================
  function drawFighterPanel(fighter, avImg, petImg, eqImgs, isWinner, x) {
    const y = 60;
    const w = 312;
    const h = 414;
    const isOwner = String(fighter.id) === FUYUMI_USER_ID;
    const rarityKey = normalizeRarityKey(fighter.petRarity);
    const rStyle = RARITY_ACCENTS[rarityKey] || RARITY_ACCENTS.common;

    ctx.save();
    drawRoundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = isWinner ? 'rgba(24, 17, 44, 0.86)' : 'rgba(15, 13, 28, 0.78)';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#fbbf24' : 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = isWinner ? 2.0 : 1.2;
    if (isWinner) {
      ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Header: Avatar khử răng cưa + Tên người chơi + Trạng thái Thắng/Bại
    const avCx = x + 42;
    const avCy = y + 40;
    drawAntiAliasedAvatarWithBorder(ctx, avImg, avCx, avCy, 24, {
      isOwner,
      level: fighter.userLevel || 1,
      username: fighter.name,
      avatarFrame: fighter.avatarFrame,
      supersampleFactor: 4,
      showAura: true,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncateText(ctx, fighter.name, w - 92), x + 78, y + 18);

    // Badge Thắng / Bại
    const statusText = isWinner ? 'CHIẾN THẮNG' : 'THẤT BẠI';
    ctx.font = `bold 10px ${FONT_FAMILY}`;
    const stW = ctx.measureText(statusText).width + 16;
    drawRoundRect(ctx, x + 78, y + 41, stW, 20, 6);
    ctx.fillStyle = isWinner ? 'rgba(245, 158, 11, 0.30)' : 'rgba(100, 116, 139, 0.25)';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#fbbf24' : '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = isWinner ? '#fde047' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, x + 78 + stW / 2, y + 51);

    // Khung ảnh Linh Thú lớn sắc nét
    const petBoxX = x + 16;
    const petBoxY = y + 74;
    const petBoxW = w - 32;
    const petBoxH = 148;
    drawRoundRect(ctx, petBoxX, petBoxY, petBoxW, petBoxH, 12);
    const pGrad = ctx.createRadialGradient(
      petBoxX + petBoxW / 2, petBoxY + petBoxH / 2, 10,
      petBoxX + petBoxW / 2, petBoxY + petBoxH / 2, 110
    );
    pGrad.addColorStop(0, rStyle.bg);
    pGrad.addColorStop(1, 'rgba(10, 8, 22, 0.85)');
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.strokeStyle = rStyle.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (petImg) {
      const maxW = 128;
      const maxH = 124;
      const asp = petImg.width / petImg.height;
      const dw = asp > maxW / maxH ? maxW : maxH * asp;
      const dh = asp > maxW / maxH ? maxW / asp : maxH;
      ctx.save();
      if (!isWinner) ctx.globalAlpha = 0.78;
      ctx.shadowColor = rStyle.color;
      ctx.shadowBlur = 10;
      ctx.drawImage(petImg, petBoxX + (petBoxW - dw) / 2, petBoxY + (petBoxH - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Tag Hệ + Lv ở góc trên trái & Rarity ở góc trên phải khung pet
    ctx.font = `bold 9.5px ${FONT_FAMILY}`;
    const elTag = `Hệ ${fighter.element} • Lv.${fighter.level}`;
    const elW = ctx.measureText(elTag).width + 14;
    drawRoundRect(ctx, petBoxX + 8, petBoxY + 8, elW, 19, 5);
    ctx.fillStyle = 'rgba(15, 12, 28, 0.88)';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(elTag, petBoxX + 8 + elW / 2, petBoxY + 17.5);

    const rarTag = sanitizeText(fighter.petRarity || 'Phàm Phẩm');
    const rarW = ctx.measureText(rarTag).width + 14;
    drawRoundRect(ctx, petBoxX + petBoxW - rarW - 8, petBoxY + 8, rarW, 19, 5);
    ctx.fillStyle = rStyle.bg;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rarTag, petBoxX + petBoxW - rarW - 8 + rarW / 2, petBoxY + 17.5);

    // Tên Linh Thú
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncateText(ctx, fighter.petName, w - 32), x + w / 2, y + 230);

    // Thanh HP còn lại cuối trận
    const hpX = x + 16;
    const hpY = y + 256;
    const hpW = w - 32;
    const hpH = 22;
    const maxHp = Math.max(1, Number(fighter.maxHp) || 1);
    const curHp = Math.max(0, Number(fighter.finalHp) || 0);
    const hpRatio = Math.min(1, curHp / maxHp);

    drawRoundRect(ctx, hpX, hpY, hpW, hpH, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (hpRatio > 0) {
      drawRoundRect(ctx, hpX + 1, hpY + 1, Math.max(12, (hpW - 2) * hpRatio), hpH - 2, 7);
      const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpW, hpY);
      if (hpRatio > 0.45) {
        hpGrad.addColorStop(0, '#22c55e');
        hpGrad.addColorStop(1, '#4ade80');
      } else if (hpRatio > 0.2) {
        hpGrad.addColorStop(0, '#f59e0b');
        hpGrad.addColorStop(1, '#facc15');
      } else {
        hpGrad.addColorStop(0, '#dc2626');
        hpGrad.addColorStop(1, '#f87171');
      }
      ctx.fillStyle = hpGrad;
      ctx.fill();
    }

    ctx.font = `bold 10.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(
      `HP: ${curHp.toLocaleString('vi-VN')} / ${maxHp.toLocaleString('vi-VN')} (${Math.round(hpRatio * 100)}%)`,
      hpX + hpW / 2,
      hpY + hpH / 2
    );
    ctx.shadowBlur = 0;

    // Bảng 4 chỉ số (ATK / DEF / SPD / HP)
    const statY = y + 288;
    const statW = Math.floor((w - 38) / 2);
    const statH = 26;
    const statRows = [
      { label: 'ATK', val: fighter.atk, color: '#f87171' },
      { label: 'DEF', val: fighter.def, color: '#60a5fa' },
      { label: 'SPD', val: fighter.spd, color: '#facc15' },
      { label: 'HP', val: maxHp, color: '#4ade80' },
    ];
    statRows.forEach((st, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const sx = x + 16 + col * (statW + 6);
      const sy = statY + row * (statH + 5);
      drawRoundRect(ctx, sx, sy, statW, statH, 6);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = `bold 10.5px ${FONT_FAMILY}`;
      ctx.fillStyle = st.color;
      ctx.fillText(st.label, sx + 8, sy + statH / 2);

      ctx.textAlign = 'right';
      ctx.font = `bold 11px ${FONT_FAMILY}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(Number(st.val || 0).toLocaleString('vi-VN'), sx + statW - 8, sy + statH / 2);
    });

    // 3 Ô Trang Bị Loadout (Vũ Khí • Bảo Ngọc • Chiến Hồn)
    const eqY = y + 354;
    const eqSlotW = Math.floor((w - 44) / 3);
    const eqSlotH = 46;
    const eqDefs = [
      { key: 'weapon', label: 'Vũ Khí', img: eqImgs[0] },
      { key: 'gem', label: 'Bảo Ngọc', img: eqImgs[1] },
      { key: 'soul', label: 'Chiến Hồn', img: eqImgs[2] },
    ];
    eqDefs.forEach((slot, idx) => {
      const sx = x + 16 + idx * (eqSlotW + 6);
      const item = fighter.equipment?.[slot.key] || null;
      const itemRar = item ? (RARITY_ACCENTS[normalizeRarityKey(item.rarity)] || RARITY_ACCENTS.common) : null;

      drawRoundRect(ctx, sx, eqY, eqSlotW, eqSlotH, 7);
      ctx.fillStyle = item ? 'rgba(30, 22, 54, 0.88)' : 'rgba(15, 23, 42, 0.45)';
      ctx.fill();
      ctx.strokeStyle = item ? itemRar.color : 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = item ? 1.2 : 1;
      ctx.stroke();

      if (item && slot.img) {
        ctx.save();
        drawRoundRect(ctx, sx + 5, eqY + 5, 36, 36, 5);
        ctx.clip();
        ctx.drawImage(slot.img, sx + 5, eqY + 5, 36, 36);
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.font = `bold 8.5px ${FONT_FAMILY}`;
        ctx.fillStyle = itemRar.color;
        ctx.fillText(slot.label, sx + 45, eqY + 15);
        ctx.font = `bold 8.5px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        const nm = sanitizeText(item.item_name || '').replace(/[«»]/g, '').trim();
        ctx.fillText(truncateText(ctx, nm, eqSlotW - 49), sx + 45, eqY + 31);
      } else if (item) {
        ctx.textAlign = 'center';
        ctx.font = `bold 9px ${FONT_FAMILY}`;
        ctx.fillStyle = itemRar.color;
        ctx.fillText(slot.label, sx + eqSlotW / 2, eqY + 14);
        ctx.fillStyle = '#ffffff';
        const nm = sanitizeText(item.item_name || '').replace(/[«»]/g, '').trim();
        ctx.fillText(truncateText(ctx, nm, eqSlotW - 10), sx + eqSlotW / 2, eqY + 31);
      } else {
        ctx.textAlign = 'center';
        ctx.font = `9.5px ${FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(slot.label, sx + eqSlotW / 2, eqY + 16);
        ctx.fillStyle = '#475569';
        ctx.fillText('Trống', sx + eqSlotW / 2, eqY + 32);
      }
    });

    ctx.restore();
  }

  drawFighterPanel(atk, atkAv, atkPetImg, atkEqImgs, atkWon, 26);
  drawFighterPanel(def, defAv, defPetImg, defEqImgs, !atkWon, 662);

  // ============================================================================
  // LỚP 3: CỘT GIỮA — VS, KHẮC CHẾ NGŨ HÀNH, DIỄN BIẾN & BANNER WINNER
  // ============================================================================
  const midX = 352;
  const midW = 296;
  const midCx = midX + midW / 2;

  ctx.save();
  // Biểu tượng VS nổi bật
  ctx.beginPath();
  ctx.arc(midCx, 108, 36, 0, Math.PI * 2);
  const vsGrad = ctx.createLinearGradient(midCx - 36, 72, midCx + 36, 144);
  vsGrad.addColorStop(0, '#f43f5e');
  vsGrad.addColorStop(0.5, '#f59e0b');
  vsGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = vsGrad;
  ctx.shadowColor = 'rgba(244, 63, 94, 0.72)';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `bold 24px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', midCx, 109);

  // Badge Khắc Chế Nguyên Tố
  const advBadge = getElementAdvantageBadge(battleResult?.elementMatchup);
  drawRoundRect(ctx, midX + 12, 156, midW - 24, 28, 8);
  ctx.fillStyle = 'rgba(18, 14, 34, 0.88)';
  ctx.fill();
  ctx.strokeStyle = advBadge.color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = advBadge.color;
  ctx.fillText(truncateText(ctx, advBadge.text, midW - 40), midCx, 170);

  // Hộp Diễn Biến Tiêu Biểu
  const logY = 196;
  const logH = 186;
  drawRoundRect(ctx, midX, logY, midW, logH, 14);
  ctx.fillStyle = 'rgba(16, 12, 30, 0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = `bold 11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#c084fc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('DIỄN BIẾN & TUYỆT KỸ HAX', midCx, logY + 12);

  const highlights = Array.isArray(battleResult?.highlights) && battleResult.highlights.length > 0
    ? battleResult.highlights.slice(0, 5)
    : [battleResult?.summary || 'Giao tranh quyết liệt!'];

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  highlights.forEach((line, idx) => {
    const ry = logY + 38 + idx * 28;
    drawRoundRect(ctx, midX + 10, ry, midW - 20, 23, 6);
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(30, 27, 75, 0.55)' : 'rgba(15, 23, 42, 0.48)';
    ctx.fill();
    ctx.font = `10.5px ${FONT_FAMILY}`;
    ctx.fillStyle = line.includes('Khai trận') || line.includes('CRIT') ? '#fde047' : '#e2e8f0';
    ctx.fillText(truncateText(ctx, line, midW - 34), midX + 17, ry + 11.5);
  });

  // Banner CHIẾN THẮNG (WINNER) rực rỡ ở đáy giữa
  const winY = 394;
  const winH = 80;
  drawRoundRect(ctx, midX, winY, midW, winH, 14);
  const winGrad = ctx.createLinearGradient(midX, winY, midX + midW, winY + winH);
  winGrad.addColorStop(0, 'rgba(217, 119, 6, 0.48)');
  winGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.44)');
  winGrad.addColorStop(1, 'rgba(245, 158, 11, 0.48)');
  ctx.fillStyle = winGrad;
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawStarSparkle(ctx, midX + 18, winY + 18, 5, '#fef08a', '#fbbf24');
  drawStarSparkle(ctx, midX + midW - 18, winY + 18, 5, '#fef08a', '#fbbf24');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fde047';
  ctx.fillText('NGƯỜI CHIẾN THẮNG (WINNER)', midCx, winY + 20);

  ctx.font = `bold 17px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, battleResult?.winner?.name || atk.name, midW - 24), midCx, winY + 44);

  ctx.font = `11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fbcfe8';
  ctx.fillText(truncateText(ctx, `Linh thú: ${battleResult?.winner?.pet || atk.petName}`, midW - 24), midCx, winY + 64);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

export default renderBattleCard;
