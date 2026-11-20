import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

export const FONT_FAMILY = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';

// Đăng ký font tiếng Việt chuẩn cho Linux container & môi trường Render
try {
  const regularFont = path.join(FONTS_DIR, 'BeVietnamPro-Regular.ttf');
  const semiBoldFont = path.join(FONTS_DIR, 'BeVietnamPro-SemiBold.ttf');
  const boldFont = path.join(FONTS_DIR, 'BeVietnamPro-Bold.ttf');

  if (fs.existsSync(regularFont)) {
    GlobalFonts.registerFromPath(regularFont, 'Be Vietnam Pro');
  }
  if (fs.existsSync(semiBoldFont)) {
    GlobalFonts.registerFromPath(semiBoldFont, 'Be Vietnam Pro');
  }
  if (fs.existsSync(boldFont)) {
    GlobalFonts.registerFromPath(boldFont, 'Be Vietnam Pro');
  }
} catch (err) {
  console.warn('[Canvas] Không thể đăng ký Be Vietnam Pro font:', err.message);
}

// Nạp toàn bộ font hệ thống (system emojis và fallback glyphs) cho Linux container & môi trường Render
try {
  GlobalFonts.loadSystemFonts();
} catch (err) {
  console.warn('[Canvas] Không thể nạp system fonts:', err.message);
}

/**
 * Chuẩn hóa chuỗi ký tự, loại bỏ NUL byte (\0) và thay dấu chấm katakana bằng bullet chuẩn
 */
export function sanitizeText(str) {
  if (!str) return '';
  return String(str).replace(/\0/g, '').replace(/・/g, ' • ');
}

/**
 * Tìm đường dẫn file cục bộ hoặc asset dự phòng
 */
export function resolveAssetPath(filePathOrName) {
  if (!filePathOrName) return null;

  if (path.isAbsolute(filePathOrName) && fs.existsSync(filePathOrName)) {
    return filePathOrName;
  }

  const cwdPath = path.resolve(process.cwd(), filePathOrName);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  const directAssetPath = path.join(ASSETS_DIR, filePathOrName);
  if (fs.existsSync(directAssetPath)) {
    return directAssetPath;
  }
  const basename = path.basename(filePathOrName);
  const assetPath = path.join(ASSETS_DIR, basename);
  if (fs.existsSync(assetPath)) {
    return assetPath;
  }

  const itemPath = path.join(ASSETS_DIR, 'items', basename);
  if (fs.existsSync(itemPath)) {
    return itemPath;
  }
  const petPath = path.join(ASSETS_DIR, 'pets', basename);
  if (fs.existsSync(petPath)) {
    return petPath;
  }

  return null;
}

/**
 * Tải ảnh an toàn có timeout và fallback
 */
export async function loadImageSafe(urlOrPath, timeoutMs = 3000, fallbackAssetName = null) {
  if (urlOrPath) {
    try {
      const resolved = resolveAssetPath(urlOrPath);
      if (resolved) {
        const buffer = fs.readFileSync(resolved);
        return await loadImage(buffer);
      }

      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(urlOrPath, { signal: controller.signal });
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return await loadImage(Buffer.from(arrayBuffer));
          }
        } finally {
          clearTimeout(timer);
        }
      }
    } catch {
      // Bỏ qua lỗi và chuyển sang fallback
    }
  }

  if (fallbackAssetName) {
    const fallbackPath = resolveAssetPath(fallbackAssetName);
    if (fallbackPath) {
      try {
        const buffer = fs.readFileSync(fallbackPath);
        return await loadImage(buffer);
      } catch {
        // Fallback procedural
      }
    }
  }

  return null;
}

/**
 * Vẽ hình chữ nhật bo góc
 */
export function drawRoundRect(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Rút gọn chuỗi nếu vượt quá độ dài
 */
export function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  const clean = sanitizeText(text);
  if (ctx.measureText(clean).width <= maxWidth) return clean;

  let truncated = clean;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/**
 * Tự động xuống dòng chuỗi văn bản theo chiều rộng tối đa
 */
export function wrapTextLines(ctx, text, maxWidth, maxLines = 4) {
  const clean = sanitizeText(text || '').trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth);
        return lines;
      }
      current = word;
    }
  }
  if (current) {
    if (lines.length < maxLines) {
      lines.push(truncateText(ctx, current, maxWidth));
    } else {
      lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1] + ' ' + current, maxWidth);
    }
  }
  return lines;
}

/**
 * Vẽ cánh hoa đào bay lãng mạn procedural
 */
export function drawPetal(ctx, x, y, size, rotation, opacity = 0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-size / 2, -size / 2, -size / 2, -size, 0, -size * 1.3);
  ctx.bezierCurveTo(size / 2, -size, size / 2, -size / 2, 0, 0);
  ctx.fillStyle = `rgba(255, 182, 193, ${opacity})`;
  ctx.shadowColor = 'rgba(255, 105, 180, 0.4)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
}

/**
 * Vẽ ngôi sao 4 cánh tinh tú phát sáng
 */
export function drawStarSparkle(ctx, cx, cy, outerR, color = '#fff7cc', glowColor = '#fbbf24') {
  const innerR = outerR * 0.28;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}

/**
 * Vẽ Avatar Hồ Ly Procedural thuần vector (tự động scale mượt theo mọi kích thước)
 */
export function drawProceduralAvatar(ctx, x, y, size, isOwner, initialLetter) {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;
  const s = size / 116;

  const avBg = ctx.createLinearGradient(x, y, x + size, y + size);
  if (isOwner) {
    avBg.addColorStop(0, '#f43f5e');
    avBg.addColorStop(0.5, '#ec4899');
    avBg.addColorStop(1, '#8b5cf6');
  } else {
    avBg.addColorStop(0, '#0f172a');
    avBg.addColorStop(0.5, '#1e3a8a');
    avBg.addColorStop(1, '#0d9488');
  }
  ctx.fillStyle = avBg;
  ctx.fillRect(x, y, size, size);

  ctx.save();
  ctx.fillStyle = isOwner ? 'rgba(255, 228, 230, 0.92)' : 'rgba(224, 242, 254, 0.88)';

  // Tai trái
  ctx.beginPath();
  ctx.moveTo(cx - 36 * s, cy - 6 * s);
  ctx.lineTo(cx - 22 * s, cy - 38 * s);
  ctx.lineTo(cx - 6 * s, cy - 10 * s);
  ctx.closePath();
  ctx.fill();

  // Tai phải
  ctx.beginPath();
  ctx.moveTo(cx + 6 * s, cy - 10 * s);
  ctx.lineTo(cx + 22 * s, cy - 38 * s);
  ctx.lineTo(cx + 36 * s, cy - 6 * s);
  ctx.closePath();
  ctx.fill();

  // Mõm hồ ly trắng
  ctx.beginPath();
  ctx.moveTo(cx - 24 * s, cy + 10 * s);
  ctx.quadraticCurveTo(cx, cy + 42 * s, cx + 24 * s, cy + 10 * s);
  ctx.quadraticCurveTo(cx, cy + 20 * s, cx - 24 * s, cy + 10 * s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();

  // Mũi nhỏ
  ctx.beginPath();
  ctx.arc(cx, cy + 24 * s, 3 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();

  // Mắt hồ ly
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = Math.max(1.5, 1.8 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 14 * s, cy + 10 * s, 6 * s, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 14 * s, cy + 10 * s, 6 * s, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();

  // Dấu ấn tiên tộc trên trán
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = isOwner ? '#ffd700' : '#a5f3fc';
  ctx.shadowColor = isOwner ? '#ffd700' : '#38bdf8';
  ctx.shadowBlur = 6 * s;
  ctx.fill();
  ctx.restore();
}

/**
 * Xác định phân cấp viền Avatar theo Cảnh Giới & Đặc Quyền
 * - owner: Tiểu thư Fuyumi (757091869183311872) — Cửu Vĩ Hoàng Kim & Hào Quang Hồng Ngọc Đa Tầng
 * - high: Lv.40+ (Kim Đan -> Đại Thừa) — Tử Kim / Huyền Tinh
 * - novice: Lv.1–39 (Luyện Khí – Trúc Cơ) — Bạch Ngọc / Thanh Lam sắc nét
 */
export function resolveAvatarBorderTier({ isOwner = false, level = 1, avatarFrame = 'default' } = {}) {
  if (isOwner || avatarFrame === 'celestial_fox_gold') return 'owner';
  if (Number(level) >= 40) return 'high';
  return 'novice';
}

/**
 * Vẽ Avatar tròn khử răng cưa bằng Supersampling 4x + Radial Feather Mask và Khung Viền đồng tâm tuyệt đối.
 * Khắc phục triệt để lỗi răng cưa, mờ nét và lệch tâm giữa avatar & khung viền.
 */
export function drawAntiAliasedAvatarWithBorder(ctx, avatarImg, centerX, centerY, radius, options = {}) {
  const {
    isOwner = false,
    level = 1,
    username = 'Tu Sĩ',
    avatarFrame = 'default',
    supersampleFactor = 4,
    showAura = true,
  } = options;

  const tier = resolveAvatarBorderTier({ isOwner, level, avatarFrame });

  // 1. Hào quang đồng tâm phía sau Avatar (phân cấp rõ ràng)
  if (showAura) {
    ctx.save();
    const auraR = tier === 'owner' ? radius + 28 : tier === 'high' ? radius + 22 : radius + 16;
    const auraGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.82, centerX, centerY, auraR);
    if (tier === 'owner') {
      auraGrad.addColorStop(0, 'rgba(244, 63, 94, 0.58)');
      auraGrad.addColorStop(0.45, 'rgba(251, 191, 36, 0.36)');
      auraGrad.addColorStop(0.78, 'rgba(236, 72, 153, 0.16)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (tier === 'high') {
      auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.44)');
      auraGrad.addColorStop(0.55, 'rgba(251, 191, 36, 0.22)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
      auraGrad.addColorStop(0.6, 'rgba(45, 212, 191, 0.14)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Render Avatar trên Offscreen Canvas 4x Supersampling + Radial Feather Mask (khử răng cưa tuyệt đối)
  const diameter = radius * 2;
  const ssSize = Math.max(64, Math.round(diameter * supersampleFactor));
  const ssRadius = ssSize / 2;
  const ssCanvas = createCanvas(ssSize, ssSize);
  const ssCtx = ssCanvas.getContext('2d');
  ssCtx.imageSmoothingEnabled = true;
  ssCtx.imageSmoothingQuality = 'high';

  if (avatarImg && avatarImg.width > 0 && avatarImg.height > 0) {
    // Center-crop giữ nguyên tỷ lệ khung hình (object-fit: cover)
    const srcMin = Math.min(avatarImg.width, avatarImg.height);
    const sx = (avatarImg.width - srcMin) / 2;
    const sy = (avatarImg.height - srcMin) / 2;
    ssCtx.drawImage(avatarImg, sx, sy, srcMin, srcMin, 0, 0, ssSize, ssSize);
  } else {
    const initial = sanitizeText(username).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || 'F';
    drawProceduralAvatar(ssCtx, 0, 0, ssSize, isOwner, initial);
  }

  // Cắt mặt nạ tròn bằng destination-in kèm feather mượt 0.75px tương đương ở biên
  ssCtx.globalCompositeOperation = 'destination-in';
  const featherPx = Math.max(1.5, supersampleFactor * 0.75);
  const maskGrad = ssCtx.createRadialGradient(
    ssRadius, ssRadius, Math.max(0, ssRadius - featherPx),
    ssRadius, ssRadius, ssRadius
  );
  maskGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  maskGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ssCtx.fillStyle = maskGrad;
  ssCtx.beginPath();
  ssCtx.arc(ssRadius, ssRadius, ssRadius, 0, Math.PI * 2);
  ssCtx.fill();

  // Hạ mẫu mượt xuống canvas chính tại đúng tâm (centerX, centerY)
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ssCanvas, centerX - radius, centerY - radius, diameter, diameter);
  ctx.restore();

  // 3. Vẽ Hệ Vòng Viền Đồng Tâm (chung 1 tọa độ centerX, centerY — không bao giờ lệch 1px)
  ctx.save();

  // 3a. Vòng khóa mép trong (inner seam-seal) đè nhẹ 0.4px lên rìa avatar để tuyệt đối không lộ viền đen/răng cưa
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = tier === 'owner'
    ? 'rgba(255, 241, 180, 0.75)'
    : tier === 'high'
      ? 'rgba(233, 213, 255, 0.6)'
      : 'rgba(224, 242, 254, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  if (tier === 'owner') {
    // --- VIỀN ĐỘC QUYỀN TIỂU THƯ FUYUMI: CỬU VĨ HOÀNG KIM & HÀO QUANG HỒNG NGỌC ĐA TẦNG ---
    // Vòng hào quang mỏng ngoài cùng (Celestial Outer Orbit)
    const outerR = radius + 6.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    const orbitGrad = ctx.createLinearGradient(centerX - outerR, centerY - outerR, centerX + outerR, centerY + outerR);
    orbitGrad.addColorStop(0, 'rgba(254, 240, 138, 0.72)');
    orbitGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.65)');
    orbitGrad.addColorStop(1, 'rgba(251, 191, 36, 0.72)');
    ctx.strokeStyle = orbitGrad;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Vòng chính Hoàng Kim - Hồng Ngọc điêu khắc
    const mainR = radius + 1.8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const mainGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    mainGrad.addColorStop(0, '#fff7cc');
    mainGrad.addColorStop(0.28, '#fbbf24');
    mainGrad.addColorStop(0.55, '#f43f5e');
    mainGrad.addColorStop(0.8, '#f59e0b');
    mainGrad.addColorStop(1, '#fef08a');
    ctx.strokeStyle = mainGrad;
    ctx.lineWidth = 4.0;
    ctx.shadowColor = 'rgba(244, 63, 94, 0.78)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 7 Ngọc Châu Hồng Ngọc & Hoàng Kim đối xứng vòm trên & hai bên (chừa 6h cho Level Badge)
    const crownGems = [
      { angle: -Math.PI / 2, r: 5.4, core: '#ffffff', rim: '#f43f5e', glow: '#ffd700', star: true },
      { angle: -Math.PI * 0.63, r: 2.8, core: '#fef08a', rim: '#fbbf24', glow: '#fbbf24' },
      { angle: -Math.PI * 0.37, r: 2.8, core: '#fef08a', rim: '#fbbf24', glow: '#fbbf24' },
      { angle: -Math.PI * 0.78, r: 4.1, core: '#ffe4e6', rim: '#ec4899', glow: '#f43f5e' },
      { angle: -Math.PI * 0.22, r: 4.1, core: '#ffe4e6', rim: '#ec4899', glow: '#f43f5e' },
      { angle: Math.PI, r: 3.6, core: '#fef08a', rim: '#f59e0b', glow: '#ec4899' },
      { angle: 0, r: 3.6, core: '#fef08a', rim: '#f59e0b', glow: '#ec4899' },
    ];
    for (const g of crownGems) {
      const gx = centerX + mainR * Math.cos(g.angle);
      const gy = centerY + mainR * Math.sin(g.angle);
      ctx.beginPath();
      ctx.arc(gx, gy, g.r, 0, Math.PI * 2);
      ctx.fillStyle = g.core;
      ctx.shadowColor = g.glow;
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = g.rim;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (g.star) {
        drawStarSparkle(ctx, gx, gy - 1.5, 4.8, '#ffffff', '#ffd700');
      }
    }

    // Hạt sáng tinh tú quanh quỹ đạo ngoài
    const sparkles = [-Math.PI * 0.88, -Math.PI * 0.12, Math.PI * 0.15, Math.PI * 0.85];
    for (const ang of sparkles) {
      const sx = centerX + outerR * Math.cos(ang);
      const sy = centerY + outerR * Math.sin(ang);
      drawStarSparkle(ctx, sx, sy, 3.2, '#fef08a', '#f43f5e');
    }
  } else if (tier === 'high') {
    // --- VIỀN CẢNH GIỚI CAO (KIM ĐAN -> ĐẠI THỪA): TỬ KIM / HUYỀN TINH ---
    const outerR = radius + 4.8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    const mainR = radius + 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const highGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    highGrad.addColorStop(0, '#f3e8ff');
    highGrad.addColorStop(0.35, '#a855f7');
    highGrad.addColorStop(0.7, '#fbbf24');
    highGrad.addColorStop(1, '#c084fc');
    ctx.strokeStyle = highGrad;
    ctx.lineWidth = 3.4;
    ctx.shadowColor = 'rgba(168, 85, 247, 0.72)';
    ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3 điểm tinh tú nhẹ trên vòm
    const highGems = [
      { angle: -Math.PI / 2, r: 4.0 },
      { angle: -Math.PI * 0.75, r: 2.8 },
      { angle: -Math.PI * 0.25, r: 2.8 },
    ];
    for (const g of highGems) {
      const gx = centerX + mainR * Math.cos(g.angle);
      const gy = centerY + mainR * Math.sin(g.angle);
      ctx.beginPath();
      ctx.arc(gx, gy, g.r, 0, Math.PI * 2);
      ctx.fillStyle = '#faf5ff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  } else {
    // --- VIỀN TÂN THỦ (LUYỆN KHÍ – TRÚC CƠ): BẠCH NGỌC / THANH LAM GỌN ĐẸP SẮC NÉT ---
    const outerR = radius + 4.0;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    const mainR = radius + 1.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const noviceGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    noviceGrad.addColorStop(0, '#e0f2fe');
    noviceGrad.addColorStop(0.45, '#38bdf8');
    noviceGrad.addColorStop(0.85, '#2dd4bf');
    noviceGrad.addColorStop(1, '#bae6fd');
    ctx.strokeStyle = noviceGrad;
    ctx.lineWidth = 3.0;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
    ctx.shadowBlur = 7;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 1 viên bạch ngọc nhỏ tinh tế tại đỉnh 12h
    const topX = centerX;
    const topY = centerY - mainR;
    ctx.beginPath();
    ctx.arc(topX, topY, 3.0, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f9ff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
