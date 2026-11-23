import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AVATAR_FRAME_BY_ID } from '../data/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

export const FONT_FAMILY = '"Be Vietnam Pro", "DejaVu Sans", "Segoe UI", "Segoe UI Symbol", "Noto Color Emoji", "Segoe UI Emoji", Arial, sans-serif';

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
  const bgPath = path.join(ASSETS_DIR, 'backgrounds', basename);
  if (fs.existsSync(bgPath)) {
    return bgPath;
  }
  const framePath = path.join(ASSETS_DIR, 'frames', basename);
  if (fs.existsSync(framePath)) {
    return framePath;
  }

  return null;
}

/**
 * Vẽ ảnh nền theo chế độ cover (giữ tỷ lệ không méo hình) + lớp phủ tối dịu mắt
 */
export function drawCoverBackground(ctx, img, width, height, overlayAlpha = 0.56) {
  if (!img || !img.width || !img.height) return false;
  const imgRatio = img.width / img.height;
  const boxRatio = width / height;
  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > boxRatio) {
    drawH = height;
    drawW = height * imgRatio;
    offsetX = (width - drawW) / 2;
  } else {
    drawW = width;
    drawH = width / imgRatio;
    offsetY = (height - drawH) / 2;
  }

  ctx.save();
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  if (overlayAlpha > 0) {
    ctx.fillStyle = `rgba(10, 7, 22, ${overlayAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
  return true;
}

/**
 * Bounded LRU cache helpers & decoded image caches (safe for 512MB Render container)
 */
const BG_CACHE_MAX = 4;
const LOCAL_ASSET_CACHE_MAX = 40;
const REMOTE_IMAGE_CACHE_MAX = 40;
const REMOTE_IMAGE_TTL_MS = 15 * 60 * 1000;
const BG_MAX_DIM = { w: 1280, h: 720 };
const LOCAL_ASSET_MAX_DIM = { w: 384, h: 384 };
const REMOTE_AVATAR_MAX_DIM = { w: 256, h: 256 };

const bgImageCache = new Map();
const localAssetImageCache = new Map();
const remoteImageCache = new Map();
const inFlightLoads = new Map();

export function getImageCacheStats() {
  return {
    backgrounds: bgImageCache.size,
    localAssets: localAssetImageCache.size,
    remoteImages: remoteImageCache.size,
    inFlight: inFlightLoads.size,
    limits: {
      backgrounds: BG_CACHE_MAX,
      localAssets: LOCAL_ASSET_CACHE_MAX,
      remoteImages: REMOTE_IMAGE_CACHE_MAX,
    },
  };
}

function downscaleImageForCache(img, maxW, maxH) {
  if (!img) return null;
  const w = Number(img.width || 0);
  const h = Number(img.height || 0);
  if (w <= 0 || h <= 0 || (w <= maxW && h <= maxH)) return img;
  const ratio = Math.min(maxW / w, maxH / h);
  const nw = Math.max(1, Math.round(w * ratio));
  const nh = Math.max(1, Math.round(h * ratio));
  try {
    const c = createCanvas(nw, nh);
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(img, 0, 0, nw, nh);
    return c;
  } catch {
    return img;
  }
}

function lruGet(cache, key) {
  if (!cache.has(key)) return undefined;
  const val = cache.get(key);
  cache.delete(key);
  cache.set(key, val);
  return val;
}

function lruSet(cache, key, val, maxSize) {
  if (cache.has(key)) cache.delete(key);
  else if (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, val);
  return val;
}

function isBackgroundAssetPath(resolvedPath) {
  const norm = String(resolvedPath || '').replace(/\\/g, '/').toLowerCase();
  return norm.includes('/backgrounds/') || norm.includes('celestial_palace') || norm.includes('default_background');
}

async function loadLocalAssetCached(resolvedPath) {
  const isBg = isBackgroundAssetPath(resolvedPath);
  const cache = isBg ? bgImageCache : localAssetImageCache;
  const max = isBg ? BG_CACHE_MAX : LOCAL_ASSET_CACHE_MAX;

  const hit = lruGet(cache, resolvedPath);
  if (hit) return hit;

  const flightKey = `local:${resolvedPath}`;
  if (inFlightLoads.has(flightKey)) {
    return inFlightLoads.get(flightKey);
  }

  const p = (async () => {
    try {
      const buffer = await fs.promises.readFile(resolvedPath);
      const rawImg = await loadImage(buffer);
      const dims = isBg ? BG_MAX_DIM : LOCAL_ASSET_MAX_DIM;
      const img = downscaleImageForCache(rawImg, dims.w, dims.h);
      if (img) lruSet(cache, resolvedPath, img, max);
      return img || null;
    } catch {
      return null;
    } finally {
      inFlightLoads.delete(flightKey);
    }
  })();

  inFlightLoads.set(flightKey, p);
  return p;
}

async function loadRemoteImageCached(url, timeoutMs) {
  const cached = lruGet(remoteImageCache, url);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.img;
    }
    remoteImageCache.delete(url);
  }

  const flightKey = `remote:${url}`;
  if (inFlightLoads.has(flightKey)) {
    return inFlightLoads.get(flightKey);
  }

  const p = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const rawImg = await loadImage(Buffer.from(arrayBuffer));
        const img = downscaleImageForCache(rawImg, REMOTE_AVATAR_MAX_DIM.w, REMOTE_AVATAR_MAX_DIM.h);
        if (img) {
          lruSet(remoteImageCache, url, { img, expiresAt: Date.now() + REMOTE_IMAGE_TTL_MS }, REMOTE_IMAGE_CACHE_MAX);
          return img;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inFlightLoads.delete(flightKey);
    }
  })();

  inFlightLoads.set(flightKey, p);
  return p;
}

/**
 * Tải ảnh an toàn có bộ nhớ đệm LRU trong RAM, in-flight coalescing, timeout và fallback
 */
export async function loadImageSafe(urlOrPath, timeoutMs = 1200, fallbackAssetName = null) {
  if (urlOrPath) {
    try {
      const resolved = resolveAssetPath(urlOrPath);
      if (resolved) {
        const localImg = await loadLocalAssetCached(resolved);
        if (localImg) return localImg;
      }

      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        const remoteImg = await loadRemoteImageCached(urlOrPath, timeoutMs);
        if (remoteImg) return remoteImg;
      }
    } catch {
      // Bỏ qua lỗi và chuyển sang fallback
    }
  }

  if (fallbackAssetName) {
    const fallbackPath = resolveAssetPath(fallbackAssetName);
    if (fallbackPath) {
      const fbImg = await loadLocalAssetCached(fallbackPath);
      if (fbImg) return fbImg;
    }
  }

  return null;
}

/**
 * Kết xuất Canvas ra Buffer chuẩn PNG hoặc WebP tốc độ cao
 */
export function encodeCanvas(canvas, format = 'png', webpQuality = 85) {
  if (String(format || 'png').toLowerCase() === 'webp') {
    return canvas.toBuffer('image/webp', webpQuality);
  }
  return canvas.toBuffer('image/png');
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
const frameOverlayCache = new Map();

export async function preloadAvatarFrameOverlay(frameId) {
  const fid = String(frameId || '').trim();
  if (!fid || fid === 'default' || fid === 'celestial_fox_gold') return null;
  if (frameOverlayCache.has(fid)) return frameOverlayCache.get(fid);
  const fPath = path.join(ASSETS_DIR, 'frames', `${fid}.png`);
  if (!fs.existsSync(fPath)) {
    frameOverlayCache.set(fid, null);
    return null;
  }
  try {
    const buf = await fs.promises.readFile(fPath);
    const img = await loadImage(buf);
    if (frameOverlayCache.size >= 24) {
      const oldest = frameOverlayCache.keys().next().value;
      if (oldest) frameOverlayCache.delete(oldest);
    }
    frameOverlayCache.set(fid, img);
    return img;
  } catch {
    return null;
  }
}

export function getCachedAvatarFrameOverlaySync(frameId) {
  const fid = String(frameId || '').trim();
  if (!fid || fid === 'default' || fid === 'celestial_fox_gold') return null;
  if (frameOverlayCache.has(fid)) return frameOverlayCache.get(fid);
  const fPath = path.join(ASSETS_DIR, 'frames', `${fid}.png`);
  if (!fs.existsSync(fPath)) return null;
  // Trigger background preload if not yet loaded
  void preloadAvatarFrameOverlay(fid);
  return null;
}

export function resolveAvatarBorderTier({ isOwner = false, level = 1, avatarFrame = 'default' } = {}) {
  const frameKey = String(avatarFrame || 'default').trim();
  if (frameKey && frameKey !== 'default' && frameKey !== 'celestial_fox_gold' && AVATAR_FRAME_BY_ID[frameKey]) {
    return frameKey;
  }
  if (isOwner || frameKey === 'celestial_fox_gold') return 'owner';
  if (Number(level) >= 40) return 'high';
  return 'novice';
}

export const AVATAR_FRAME_METRICS = {
  frame_bamboo_ink: { cx: 259.5, cy: 248.0, rTuck: 192 },
  frame_plum_blossom: { cx: 260.7, cy: 252.7, rTuck: 186 },
  frame_lantern_glow: { cx: 241.8, cy: 247.2, rTuck: 179 },
  frame_obsidian_ring: { cx: 249.8, cy: 246.4, rTuck: 188 },
  frame_royal_legacy: { cx: 251.0, cy: 252.5, rTuck: 178 },
  jade_lotus: { cx: 261.5, cy: 247.7, rTuck: 171 },
  frost_crystal: { cx: 256.4, cy: 248.5, rTuck: 162 },
  frame_moon_ripple: { cx: 258.5, cy: 258.1, rTuck: 174 },
  frame_thunder_seal: { cx: 258.1, cy: 258.0, rTuck: 170 },
  frame_crimson_cloud: { cx: 251.6, cy: 249.3, rTuck: 172 },
  amethyst_celestial: { cx: 253.0, cy: 257.6, rTuck: 160 },
  crimson_phoenix: { cx: 261.5, cy: 270.7, rTuck: 161 },
  frame_star_nebula: { cx: 256.1, cy: 255.5, rTuck: 178 },
  frame_white_lotus: { cx: 252.9, cy: 251.6, rTuck: 166 },
  frame_solar_crow: { cx: 251.6, cy: 255.7, rTuck: 148 },
  frame_azure_dragon: { cx: 260.8, cy: 252.4, rTuck: 158 },
  frame_kitsune_mythic: { cx: 248.5, cy: 262.3, rTuck: 151 },
  frame_chaos_primordial: { cx: 257.2, cy: 265.7, rTuck: 158 },
  frame_emperor_dragon: { cx: 252.9, cy: 255.0, rTuck: 142 },
  frame_eternal_aurora: { cx: 244.8, cy: 243.2, rTuck: 157 },
};

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
  const isCustomFrame = Boolean(AVATAR_FRAME_BY_ID[tier] && tier !== 'default');
  const pngOverlay = isCustomFrame ? (options.frameOverlayImg || getCachedAvatarFrameOverlaySync(tier)) : null;
  const avScale = pngOverlay
    ? (Number(options.avatarRadiusScale) > 0 ? Number(options.avatarRadiusScale) : 0.90)
    : 1;
  const drawAvatarRadius = radius * avScale;
  // Tỷ lệ viền & hào quang chuẩn theo radius (r>=56 giữ s=1 cho /profile & /rank; r=24 thu nhỏ thanh mảnh cho /battle)
  const s = Math.max(0.42, Math.min(1, radius / 56));

  // 1. Hào quang đồng tâm phía sau Avatar (phân cấp rõ ràng)
  if (showAura) {
    ctx.save();
    const baseAuraOffset = tier === 'owner' ? 28 : (tier === 'high' || isCustomFrame) ? 22 : 16;
    const auraR = radius + baseAuraOffset * s;
    const auraGrad = ctx.createRadialGradient(centerX, centerY, drawAvatarRadius * 0.82, centerX, centerY, auraR);
    if (tier === 'owner') {
      auraGrad.addColorStop(0, 'rgba(244, 63, 94, 0.58)');
      auraGrad.addColorStop(0.45, 'rgba(251, 191, 36, 0.36)');
      auraGrad.addColorStop(0.78, 'rgba(236, 72, 153, 0.16)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (isCustomFrame) {
      const pal = AVATAR_FRAME_BY_ID[tier]?.palette || ['#c084fc', '#7e22ce', '#f5d0fe'];
      auraGrad.addColorStop(0, `${pal[0]}73`);
      auraGrad.addColorStop(0.55, `${pal[1]}38`);
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
  const diameter = drawAvatarRadius * 2;
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
  ctx.drawImage(ssCanvas, centerX - drawAvatarRadius, centerY - drawAvatarRadius, diameter, diameter);
  ctx.restore();

  // 3. Vẽ Hệ Vòng Viền Đồng Tâm (chung 1 tọa độ centerX, centerY — không bao giờ lệch 1px)
  ctx.save();

  // 3a. Vòng khóa mép trong (inner seam-seal) — bỏ qua khi có PNG frame overlay để không lộ viền trắng
  if (!pngOverlay) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 0.3 * s, 0, Math.PI * 2);
    ctx.strokeStyle = tier === 'owner'
      ? 'rgba(255, 241, 180, 0.75)'
      : tier === 'high'
        ? 'rgba(233, 213, 255, 0.6)'
        : 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = Math.max(0.8, 1.4 * s);
    ctx.stroke();
  }

  if (tier === 'owner') {
    // --- VIỀN ĐỘC QUYỀN TIỂU THƯ FUYUMI: CỬU VĨ HOÀNG KIM & HÀO QUANG HỒNG NGỌC ĐA TẦNG ---
    // Vòng hào quang mỏng ngoài cùng (Celestial Outer Orbit)
    const outerR = radius + 6.2 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    const orbitGrad = ctx.createLinearGradient(centerX - outerR, centerY - outerR, centerX + outerR, centerY + outerR);
    orbitGrad.addColorStop(0, 'rgba(254, 240, 138, 0.72)');
    orbitGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.65)');
    orbitGrad.addColorStop(1, 'rgba(251, 191, 36, 0.72)');
    ctx.strokeStyle = orbitGrad;
    ctx.lineWidth = Math.max(0.7, 1.1 * s);
    ctx.stroke();

    // Vòng chính Hoàng Kim - Hồng Ngọc điêu khắc
    const mainR = radius + 1.8 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const mainGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    mainGrad.addColorStop(0, '#fff7cc');
    mainGrad.addColorStop(0.28, '#fbbf24');
    mainGrad.addColorStop(0.55, '#f43f5e');
    mainGrad.addColorStop(0.8, '#f59e0b');
    mainGrad.addColorStop(1, '#fef08a');
    ctx.strokeStyle = mainGrad;
    ctx.lineWidth = Math.max(1.8, 4.0 * s);
    ctx.stroke();

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
      ctx.arc(gx, gy, g.r * s, 0, Math.PI * 2);
      ctx.fillStyle = g.core;
      ctx.fill();
      ctx.strokeStyle = g.rim;
      ctx.lineWidth = Math.max(0.7, 1.2 * s);
      ctx.stroke();
      if (g.star) {
        drawStarSparkle(ctx, gx, gy - 1.5 * s, 4.8 * s, '#ffffff', '#ffd700');
      }
    }

    // Hạt sáng tinh tú quanh quỹ đạo ngoài
    const sparkles = [-Math.PI * 0.88, -Math.PI * 0.12, Math.PI * 0.15, Math.PI * 0.85];
    for (const ang of sparkles) {
      const sx = centerX + outerR * Math.cos(ang);
      const sy = centerY + outerR * Math.sin(ang);
      drawStarSparkle(ctx, sx, sy, 3.2 * s, '#fef08a', '#f43f5e');
    }
  } else if (isCustomFrame) {
    if (pngOverlay) {
      const metrics = AVATAR_FRAME_METRICS[tier] || { cx: 256, cy: 256, rTuck: 170 };
      const srcW = pngOverlay.width || 512;
      const srcH = pngOverlay.height || 512;
      const normScale = srcW / 512;
      const k = drawAvatarRadius / (metrics.rTuck * normScale);
      const drawW = srcW * k;
      const drawH = srcH * k;
      const drawX = centerX - (metrics.cx * normScale) * k;
      const drawY = centerY - (metrics.cy * normScale) * k;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(pngOverlay, drawX, drawY, drawW, drawH);
    } else {
      const frameMeta = AVATAR_FRAME_BY_ID[tier];
      const pal = frameMeta?.palette || ['#c084fc', '#7e22ce', '#f5d0fe'];
      const isMythicFrame = frameMeta?.rarity_key === 'mythic';
      const isEpicFrame = frameMeta?.rarity_key === 'epic';

      const outerR = radius + (isMythicFrame ? 6.0 : 5.0) * s;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = `${pal[0]}99`;
      ctx.lineWidth = Math.max(0.8, (isMythicFrame ? 1.5 : 1.1) * s);
      ctx.stroke();

      const mainR = radius + 1.6 * s;
      ctx.beginPath();
      ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
      const sGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
      sGrad.addColorStop(0, pal[2] || pal[0]);
      sGrad.addColorStop(0.5, pal[0]);
      sGrad.addColorStop(1, pal[1]);
      ctx.strokeStyle = sGrad;
      ctx.lineWidth = Math.max(1.8, (isMythicFrame ? 4.2 : isEpicFrame ? 3.8 : 3.4) * s);
      ctx.stroke();

      const gemAngles = isMythicFrame
        ? [-Math.PI / 2, -Math.PI * 0.72, -Math.PI * 0.28, Math.PI, 0, Math.PI * 0.78, Math.PI * 0.22]
        : isEpicFrame
          ? [-Math.PI / 2, -Math.PI * 0.78, -Math.PI * 0.22, Math.PI, 0]
          : [-Math.PI / 2, Math.PI, 0];
      for (const ang of gemAngles) {
        const gx = centerX + mainR * Math.cos(ang);
        const gy = centerY + mainR * Math.sin(ang);
        drawStarSparkle(ctx, gx, gy, (ang === -Math.PI / 2 ? 4.4 : 2.9) * s, pal[2] || '#ffffff', pal[0]);
      }
    }
  } else if (tier === 'high') {
    // --- VIỀN CẢNH GIỚI CAO (KIM ĐAN -> ĐẠI THỪA): TỬ KIM / HUYỀN TINH ---
    const outerR = radius + 4.8 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = Math.max(0.7, 1.0 * s);
    ctx.stroke();

    const mainR = radius + 1.5 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const highGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    highGrad.addColorStop(0, '#f3e8ff');
    highGrad.addColorStop(0.35, '#a855f7');
    highGrad.addColorStop(0.7, '#fbbf24');
    highGrad.addColorStop(1, '#c084fc');
    ctx.strokeStyle = highGrad;
    ctx.lineWidth = Math.max(1.6, 3.4 * s);
    ctx.shadowColor = 'rgba(168, 85, 247, 0.72)';
    ctx.shadowBlur = 9 * s;
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
      ctx.arc(gx, gy, g.r * s, 0, Math.PI * 2);
      ctx.fillStyle = '#faf5ff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 6 * s;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  } else {
    // --- VIỀN TÂN THỦ (LUYỆN KHÍ – TRÚC CƠ): BẠCH NGỌC / THANH LAM GỌN ĐẸP SẮC NÉT ---
    const outerR = radius + 4.0 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
    ctx.lineWidth = Math.max(0.6, 0.9 * s);
    ctx.stroke();

    const mainR = radius + 1.4 * s;
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    const noviceGrad = ctx.createLinearGradient(centerX - mainR, centerY - mainR, centerX + mainR, centerY + mainR);
    noviceGrad.addColorStop(0, '#e0f2fe');
    noviceGrad.addColorStop(0.45, '#38bdf8');
    noviceGrad.addColorStop(0.85, '#2dd4bf');
    noviceGrad.addColorStop(1, '#bae6fd');
    ctx.strokeStyle = noviceGrad;
    ctx.lineWidth = Math.max(1.5, 3.0 * s);
    ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
    ctx.shadowBlur = 7 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 1 viên bạch ngọc nhỏ tinh tế tại đỉnh 12h
    const topX = centerX;
    const topY = centerY - mainR;
    ctx.beginPath();
    ctx.arc(topX, topY, 3.0 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f9ff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 5 * s;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/**
 * Tải ảnh badge/icon local trong assets/ dùng chung bộ nhớ đệm LRU trong RAM
 */
export async function loadBadgeImage(assetRelPath) {
  if (!assetRelPath) return null;
  return loadImageSafe(null, 1500, assetRelPath);
}

/**
 * Loại bỏ các emoji Unicode Windows ở đầu chuỗi để thay bằng icon PNG sắc nét trên Canvas
 */
export function stripLeadingEmojis(str) {
  if (!str) return '';
  return String(str)
    .replace(/^[\s\uFE0F\u200D\u2600-\u27BF\u{1F300}-\u{1FAFF}]+/gu, '')
    .trim();
}

/**
 * Vẽ icon PNG sắc nét kèm chuỗi text trên cùng 1 hàng (căn giữa theo trục dọc)
 */
export function drawIconText(ctx, iconImg, text, x, y, options = {}) {
  const {
    iconSize = 14,
    gap = 5,
    align = 'left',
    font = null,
    fillStyle = null,
    textOffsetY = 0.5,
  } = options;

  ctx.save();
  if (font) ctx.font = font;
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.textBaseline = 'middle';

  const cleanTxt = sanitizeText(text);
  const textW = cleanTxt ? ctx.measureText(cleanTxt).width : 0;
  const hasIcon = Boolean(iconImg && iconImg.width && iconImg.height);
  const totalW = (hasIcon ? iconSize + (cleanTxt ? gap : 0) : 0) + textW;

  let curX = x;
  if (align === 'center') curX = x - totalW / 2;
  else if (align === 'right') curX = x - totalW;

  if (hasIcon) {
    ctx.drawImage(iconImg, curX, y - iconSize / 2, iconSize, iconSize);
    curX += iconSize + gap;
  }
  if (cleanTxt) {
    ctx.textAlign = 'left';
    ctx.fillText(cleanTxt, curX, y + textOffsetY);
  }
  ctx.restore();
  return totalW;
}

/**
 * Tự động thu nhỏ cỡ chữ trên 1 dòng duy nhất để hiển thị ĐẦY ĐỦ tên trang bị,
 * tuyệt đối không cắt cụt "..." và không xuống dòng.
 */
export function drawAutoFitSingleLineText(ctx, text, x, y, maxWidth, options = {}) {
  const {
    maxFont = 10.5,
    minFont = 6.0,
    weight = 'bold',
    align = 'center',
    color = '#ffffff',
  } = options;

  const clean = sanitizeText(String(text || '')).trim();
  const makeFont = (sz) => (weight ? `${weight} ${sz}px ${FONT_FAMILY}` : `${sz}px ${FONT_FAMILY}`);
  ctx.save();
  let chosen = minFont;
  for (let size = maxFont; size >= minFont; size -= 0.25) {
    ctx.font = makeFont(size);
    if (ctx.measureText(clean).width <= maxWidth) {
      chosen = size;
      break;
    }
  }
  ctx.font = makeFont(chosen);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (ctx.measureText(clean).width > maxWidth) {
    ctx.fillText(clean, x, y, maxWidth);
  } else {
    ctx.fillText(clean, x, y);
  }
  ctx.restore();
  return chosen;
}

/**
 * Vẽ icon PNG sắc nét kèm chữ tự động thu nhỏ trên 1 dòng để không bao giờ bị cắt cụt "..."
 */
export function drawAutoFitIconText(ctx, iconImg, text, x, y, maxWidth, options = {}) {
  const {
    iconSize = 14,
    gap = 5,
    maxFont = 11,
    minFont = 6.0,
    weight = '',
    color = '#ffffff',
    textOffsetY = 0.5,
  } = options;

  const hasIcon = Boolean(iconImg && iconImg.width && iconImg.height);
  let textX = x;
  let availW = maxWidth;
  if (hasIcon) {
    ctx.drawImage(iconImg, x, y - iconSize / 2, iconSize, iconSize);
    textX = x + iconSize + gap;
    availW = Math.max(20, maxWidth - iconSize - gap);
  }
  return drawAutoFitSingleLineText(ctx, text, textX, y + textOffsetY, availW, {
    maxFont,
    minFont,
    weight,
    align: 'left',
    color,
  });
}

/**
 * Vẽ huy hiệu lục giác vát nhọn 2 đầu ngang (vàng đào kim loại) cho nhãn ATK / DEF / SPD
 */
export function drawHexBadge(ctx, x, y, w, h, label, options = {}) {
  const {
    fontSize = 9.5,
    textColor = '#14111f',
    gradColors = ['#ffe1bd', '#f4b37e', '#e5955f'],
    borderColor = 'rgba(255, 238, 214, 0.55)',
  } = options;

  const tip = Math.min(h * 0.36, w * 0.22, 7.0);
  const midY = y + h / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + tip, y);
  ctx.lineTo(x + w - tip, y);
  ctx.lineTo(x + w, midY);
  ctx.lineTo(x + w - tip, y + h);
  ctx.lineTo(x + tip, y + h);
  ctx.lineTo(x, midY);
  ctx.closePath();

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, gradColors[0]);
  grad.addColorStop(0.5, gradColors[1]);
  grad.addColorStop(1, gradColors[2]);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.85;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sanitizeText(label), x + w / 2, midY + 0.5);
  ctx.restore();
}

/**
 * Vẽ icon PNG + text tự động thu nhỏ cỡ chữ trên 1 dòng và CĂN GIỮA hoàn toàn quanh centerX
 */
export function drawCenteredAutoFitIconText(ctx, iconImg, text, centerX, centerY, maxWidth, options = {}) {
  const {
    iconSize = 18,
    gap = 6,
    maxFont = 12,
    minFont = 8.0,
    weight = 'bold',
    color = '#fbcfe8',
    textOffsetY = 0.5,
  } = options;

  const clean = sanitizeText(String(text || '')).trim();
  const hasIcon = Boolean(iconImg && iconImg.width && iconImg.height);
  const iconSpace = hasIcon ? iconSize + (clean ? gap : 0) : 0;
  const availTextW = Math.max(16, maxWidth - iconSpace);
  const makeFont = (sz) => (weight ? `${weight} ${sz}px ${FONT_FAMILY}` : `${sz}px ${FONT_FAMILY}`);

  ctx.save();
  let chosen = minFont;
  let textW = 0;
  for (let size = maxFont; size >= minFont; size -= 0.25) {
    ctx.font = makeFont(size);
    const w = ctx.measureText(clean).width;
    if (w <= availTextW) {
      chosen = size;
      textW = w;
      break;
    }
    textW = w;
  }
  ctx.font = makeFont(chosen);
  const clampedTextW = Math.min(textW, availTextW);
  const totalW = iconSpace + clampedTextW;
  let curX = centerX - totalW / 2;

  if (hasIcon) {
    ctx.drawImage(iconImg, curX, centerY - iconSize / 2, iconSize, iconSize);
    curX += iconSize + gap;
  }
  if (clean) {
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (textW > availTextW) {
      ctx.fillText(clean, curX, centerY + textOffsetY, availTextW);
    } else {
      ctx.fillText(clean, curX, centerY + textOffsetY);
    }
  }
  ctx.restore();
  return chosen;
}

/**
 * Render thẻ xem trước Viền Avatar 320x320 PNG cho /shop Quầy Viền Avatar
 */
export async function renderFramePreviewBuffer(frameId) {
  const fid = String(frameId || 'default').trim();
  const meta = AVATAR_FRAME_BY_ID[fid] || AVATAR_FRAME_BY_ID.default;
  const overlayImg = await preloadAvatarFrameOverlay(fid);

  const w = 320;
  const h = 320;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Nền tiên giới tối sang trọng
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0f0a1e');
  bg.addColorStop(0.55, '#1e1136');
  bg.addColorStop(1, '#2b1038');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Vòng trang trí mờ
  ctx.strokeStyle = 'rgba(246, 213, 122, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Avatar mẫu + Viền Avatar đang xem trước
  drawAntiAliasedAvatarWithBorder(ctx, null, w / 2, 130, 66, {
    isOwner: false,
    level: 60,
    username: 'SuMi',
    avatarFrame: fid,
    frameOverlayImg: overlayImg,
    supersampleFactor: 2,
    showAura: true,
  });

  // Tên viền & giá
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a';
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.fillText(sanitizeText(meta?.name || fid), w / 2, 248, 280);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `12px ${FONT_FAMILY}`;
  const priceTxt = meta?.price > 0 ? `${meta.price.toLocaleString('vi-VN')} Linh Thạch` : 'Mặc Định';
  ctx.fillText(priceTxt, w / 2, 274, 280);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.fillText(`/equip ma_id:${fid}`, w / 2, 296, 280);

  return canvas.toBuffer('image/png');
}
