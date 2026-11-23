/**
 * scripts/optimize_assets_to_webp.mjs
 * Chuyển đổi toàn bộ ảnh nặng trong assets/ (PNG/JPG) sang .webp nén tối ưu kèm resize chuẩn kích thước hiển thị.
 * - Backup toàn bộ file gốc sang artifact scratch/assets_png_backup/ trước khi xóa bản PNG/JPG.
 * - Bảo toàn tuyệt đối: assets/frames/*.png (20 khung), assets/minigames/*.gif (5 GIF), assets/fonts/*.ttf, explorer_world_map_v14.webp.
 * - Xóa file trùng nặng assets/maps/explorer_world_map_v14.png (sau khi backup) vì explorer_world_map_v14.webp đã tồn tại.
 */

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');
const BACKUP_DIR = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9\\scratch\\assets_png_backup';

const BG_MAX = { w: 1280, h: 720, q: 84 };
const VEIN_MAX = { w: 768, h: 768, q: 85 };
const ICON_MAX = { w: 256, h: 256, q: 86 };
const STANDARD_MAX = { w: 512, h: 512, q: 85 };

function getRule(relUnixPath) {
  const lower = relUnixPath.toLowerCase();
  if (lower.startsWith('frames/') && lower.endsWith('.png')) return null; // preserve 20 normalized PNG frames
  if (lower.startsWith('fonts/')) return null;
  if (lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.ttf')) return null;
  if (!/\.(png|jpe?g)$/i.test(lower)) return null;

  if (lower === 'maps/explorer_world_map_v14.png') {
    return { action: 'delete_duplicate' };
  }
  if (lower.startsWith('backgrounds/') || lower === 'celestial_palace_pink.png' || lower === 'default_background.png') {
    return { action: 'convert', ...BG_MAX };
  }
  if (lower.startsWith('veins/')) {
    return { action: 'convert', ...VEIN_MAX };
  }
  if (lower.startsWith('pets/icons/') || lower.startsWith('badges/')) {
    return { action: 'convert', ...ICON_MAX };
  }
  return { action: 'convert', ...STANDARD_MAX };
}

function listAllFiles(dir, rel = '') {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...listAllFiles(full, r));
    else out.push({ full, rel: r });
  }
  return out;
}

function ensureBackup(srcFull, rel) {
  const dst = path.join(BACKUP_DIR, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (!fs.existsSync(dst)) {
    fs.copyFileSync(srcFull, dst);
  }
}

async function run() {
  const allBefore = listAllFiles(ASSETS_DIR);
  const bytesBefore = allBefore.reduce((s, f) => s + fs.statSync(f.full).size, 0);

  let converted = 0;
  let deletedDuplicates = 0;
  let preserved = 0;
  let failed = [];
  let sourceConvertedBytes = 0;
  let targetWebpBytes = 0;

  for (const file of allBefore) {
    const rule = getRule(file.rel);
    if (!rule) {
      preserved += 1;
      continue;
    }

    const srcSize = fs.statSync(file.full).size;
    ensureBackup(file.full, file.rel);

    if (rule.action === 'delete_duplicate') {
      const webpSibling = file.full.replace(/\.(png|jpe?g)$/i, '.webp');
      if (fs.existsSync(webpSibling) && fs.statSync(webpSibling).size > 1024) {
        fs.unlinkSync(file.full);
        deletedDuplicates += 1;
        sourceConvertedBytes += srcSize;
        console.log(`[DELETED DUPLICATE] ${file.rel} (${(srcSize / 1048576).toFixed(2)} MB)`);
      }
      continue;
    }

    try {
      const srcBuf = fs.readFileSync(file.full);
      const img = await loadImage(srcBuf);
      const srcW = Number(img.width || 0);
      const srcH = Number(img.height || 0);
      if (srcW <= 0 || srcH <= 0) throw new Error('Invalid image dimensions');

      const scale = Math.min(1, rule.w / srcW, rule.h / srcH);
      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));

      const canvas = createCanvas(dstW, dstH);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, dstW, dstH);

      const webpBuf = canvas.toBuffer('image/webp', rule.q);
      if (!webpBuf || webpBuf.length < 100) {
        throw new Error(`Encoded WebP too small (${webpBuf?.length || 0} bytes)`);
      }

      // Verify encoded buffer decodes cleanly
      const verifyImg = await loadImage(webpBuf);
      if (!verifyImg || verifyImg.width !== dstW || verifyImg.height !== dstH) {
        throw new Error('Decoded verification mismatch');
      }

      const webpPath = file.full.replace(/\.(png|jpe?g)$/i, '.webp');
      fs.writeFileSync(webpPath, webpBuf);
      if (webpPath !== file.full && fs.existsSync(file.full)) {
        fs.unlinkSync(file.full);
      }

      converted += 1;
      sourceConvertedBytes += srcSize;
      targetWebpBytes += webpBuf.length;
    } catch (err) {
      failed.push({ file: file.rel, error: err.message });
      console.error(`[FAIL] ${file.rel}: ${err.message}`);
    }
  }

  const allAfter = listAllFiles(ASSETS_DIR);
  const bytesAfter = allAfter.reduce((s, f) => s + fs.statSync(f.full).size, 0);

  console.log('\n=== ASSET OPTIMIZATION SUMMARY ===');
  console.log(`Files before       : ${allBefore.length} (${(bytesBefore / 1048576).toFixed(2)} MB)`);
  console.log(`Files after        : ${allAfter.length} (${(bytesAfter / 1048576).toFixed(2)} MB)`);
  console.log(`Converted to WebP  : ${converted}`);
  console.log(`Deleted duplicates : ${deletedDuplicates}`);
  console.log(`Preserved intact   : ${preserved}`);
  console.log(`Converted savings  : ${(sourceConvertedBytes / 1048576).toFixed(2)} MB -> ${(targetWebpBytes / 1048576).toFixed(2)} MB`);
  console.log(`Total saved        : ${((bytesBefore - bytesAfter) / 1048576).toFixed(2)} MB (-${(((bytesBefore - bytesAfter) / bytesBefore) * 100).toFixed(1)}%)`);
  console.log(`Failures           : ${failed.length}`);
  if (failed.length > 0) {
    console.error(failed);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
