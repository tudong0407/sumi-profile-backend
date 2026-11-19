import { loadImage, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

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

/**
 * Chuẩn hóa chuỗi ký tự, thay thế các ký tự hiếm như dấu chấm katakana bằng bullet chuẩn
 */
export function sanitizeText(str) {
  if (!str) return '';
  return String(str).replace(/・/g, ' • ');
}

/**
 * Tìm đường dẫn file cục bộ hoặc asset dự phòng
 * @param {string} filePathOrName 
 * @returns {string|null}
 */
export function resolveAssetPath(filePathOrName) {
  if (!filePathOrName) return null;

  // 1. Đường dẫn tuyệt đối
  if (path.isAbsolute(filePathOrName) && fs.existsSync(filePathOrName)) {
    return filePathOrName;
  }

  // 2. Đường dẫn tương đối từ process.cwd()
  const cwdPath = path.resolve(process.cwd(), filePathOrName);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  // 3. Đường dẫn trong thư mục assets của project
  const directAssetPath = path.join(ASSETS_DIR, filePathOrName);
  if (fs.existsSync(directAssetPath)) {
    return directAssetPath;
  }
  const basename = path.basename(filePathOrName);
  const assetPath = path.join(ASSETS_DIR, basename);
  if (fs.existsSync(assetPath)) {
    return assetPath;
  }

  return null;
}

/**
 * Tải ảnh an toàn có timeout và fallback
 * @param {string} urlOrPath 
 * @param {number} timeoutMs 
 * @param {string} fallbackAssetName Tên file asset fallback trong thư mục assets/ (nếu có)
 * @returns {Promise<Image|null>}
 */
export async function loadImageSafe(urlOrPath, timeoutMs = 3000, fallbackAssetName = null) {
  if (urlOrPath) {
    try {
      // 1. Nếu là file cục bộ hoặc asset
      const resolved = resolveAssetPath(urlOrPath);
      if (resolved) {
        const buffer = fs.readFileSync(resolved);
        return await loadImage(buffer);
      }

      // 2. Nếu là URL mạng (Discord CDN, Imgur, Supabase Storage, v.v.)
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
    } catch (err) {
      // Bỏ qua lỗi và chuyển sang fallback
    }
  }

  // Fallback sang asset mặc định nếu được chỉ định
  if (fallbackAssetName) {
    const fallbackPath = resolveAssetPath(fallbackAssetName);
    if (fallbackPath) {
      try {
        const buffer = fs.readFileSync(fallbackPath);
        return await loadImage(buffer);
      } catch (err) {
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
 * Vẽ Avatar Hồ Ly Procedural thuần vector (không bao giờ bị lỗi font glyph)
 */
export function drawProceduralAvatar(ctx, x, y, size, isOwner, initialLetter) {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  // Nền gradient
  const avBg = ctx.createLinearGradient(x, y, x + size, y + size);
  if (isOwner) {
    avBg.addColorStop(0, '#f43f5e');
    avBg.addColorStop(0.5, '#ec4899');
    avBg.addColorStop(1, '#8b5cf6');
  } else {
    avBg.addColorStop(0, '#4f46e5');
    avBg.addColorStop(0.5, '#7c3aed');
    avBg.addColorStop(1, '#2563eb');
  }
  ctx.fillStyle = avBg;
  ctx.fillRect(x, y, size, size);

  // Tai hồ ly thần bí phát sáng (Fox Ears)
  ctx.save();
  ctx.fillStyle = isOwner ? 'rgba(255, 228, 230, 0.9)' : 'rgba(224, 231, 255, 0.85)';
  
  // Tai trái
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy - 6);
  ctx.lineTo(cx - 22, cy - 38);
  ctx.lineTo(cx - 6, cy - 10);
  ctx.closePath();
  ctx.fill();

  // Tai phải
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy - 10);
  ctx.lineTo(cx + 22, cy - 38);
  ctx.lineTo(cx + 36, cy - 6);
  ctx.closePath();
  ctx.fill();

  // Mõm hồ ly trắng (White muzzle)
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 10);
  ctx.quadraticCurveTo(cx, cy + 42, cx + 24, cy + 10);
  ctx.quadraticCurveTo(cx, cy + 20, cx - 24, cy + 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fill();

  // Mũi nhỏ
  ctx.beginPath();
  ctx.arc(cx, cy + 24, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();

  // Mắt hồ ly
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 14, cy + 10, 6, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 14, cy + 10, 6, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();

  // Dấu ấn tiên tộc trên trán
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = isOwner ? '#ffd700' : '#a5f3fc';
  ctx.shadowColor = isOwner ? '#ffd700' : '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}
