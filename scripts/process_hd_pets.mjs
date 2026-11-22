/**
 * scripts/process_hd_pets.mjs
 * Chuẩn hóa ảnh Pet HD (từ output JPG của image-generator hoặc ảnh gốc kích thước lẻ)
 * thành 512x512 RGBA PNG nền trong suốt khử viền mượt + 128x128 mini icon.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * Flood-fill tách nền đồng nhất (trắng hoặc tối) nối với 4 cạnh ảnh, kèm làm mượt rìa alpha (anti-halo).
 */
export async function convertGeneratedToTransparent512(srcPath, dest512Path, destIconPath, opts = {}) {
  const img = await loadImage(srcPath);
  const w = img.width;
  const h = img.height;
  const cv = createCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample average corner color (top-left 4x4)
  let bgR = 0, bgG = 0, bgB = 0, samples = 0;
  for (const [cx, cy] of [[0, 0], [w - 4, 0], [0, h - 4], [w - 4, h - 4]]) {
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        const i = ((cy + dy) * w + (cx + dx)) * 4;
        bgR += data[i];
        bgG += data[i + 1];
        bgB += data[i + 2];
        samples++;
      }
    }
  }
  bgR /= samples;
  bgG /= samples;
  bgB /= samples;
  const isWhiteBg = bgR > 215 && bgG > 215 && bgB > 215;

  const isBgLike = (idx, strictTol = 36) => {
    const a = data[idx + 3];
    if (a < 15) return true;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    if (isWhiteBg) {
      const dr = Math.abs(r - bgR), dg = Math.abs(g - bgG), db = Math.abs(b - bgB);
      const maxChDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      return (dr + dg + db) / 3 <= strictTol && maxChDiff <= 22 && r > 205 && g > 205 && b > 205;
    }
    const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
    return dist <= strictTol;
  };

  // BFS flood-fill from all border pixels
  const visited = new Uint8Array(w * h);
  const bgMask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBgLike(p * 4, opts.tol || 36)) {
      bgMask[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  // Soft edge feather + color decontamination for 1px/2px boundary around bgMask
  for (let p = 0; p < w * h; p++) {
    const idx = p * 4;
    if (bgMask[p]) {
      data[idx + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    let adjBg = 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && bgMask[ny * w + nx]) adjBg++;
    }
    if (adjBg > 0 && isWhiteBg) {
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 185 && chroma < 28) {
        const keep = Math.max(0, Math.min(1, (242 - lum) / 60));
        data[idx + 3] = Math.round(data[idx + 3] * keep);
        if (keep > 0.05 && keep < 0.95) {
          // De-contaminate white background spill
          data[idx] = Math.max(0, Math.min(255, Math.round((r - (1 - keep) * 255) / keep)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - keep) * 255) / keep)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - keep) * 255) / keep)));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Trim bounding box of visible pixels
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX >= minX ? (maxX - minX + 1) : w;
  const cropH = maxY >= minY ? (maxY - minY + 1) : h;
  const cropX = maxX >= minX ? minX : 0;
  const cropY = maxY >= minY ? minY : 0;

  // Render centered with ~5% padding onto crisp 512x512 RGBA
  const out512 = createCanvas(512, 512);
  const octx = out512.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  const maxSpan = 472;
  const scale = Math.min(maxSpan / cropW, maxSpan / cropH);
  const drawW = Math.round(cropW * scale);
  const drawH = Math.round(cropH * scale);
  const dx = Math.round((512 - drawW) / 2);
  const dy = Math.round((512 - drawH) / 2);
  octx.drawImage(cv, cropX, cropY, cropW, cropH, dx, dy, drawW, drawH);

  fs.mkdirSync(path.dirname(dest512Path), { recursive: true });
  fs.writeFileSync(dest512Path, out512.toBuffer('image/png'));

  if (destIconPath) {
    const out128 = createCanvas(128, 128);
    const ictx = out128.getContext('2d');
    ictx.imageSmoothingEnabled = true;
    ictx.imageSmoothingQuality = 'high';
    ictx.drawImage(out512, 0, 0, 128, 128);
    fs.mkdirSync(path.dirname(destIconPath), { recursive: true });
    fs.writeFileSync(destIconPath, out128.toBuffer('image/png'));
  }

  return { cropW, cropH, drawW, drawH, isWhiteBg };
}

/**
 * Chuẩn hóa ảnh nền trong suốt kích thước lẻ (>=384px) về 512x512 giữ nguyên tỷ lệ (no stretch) + tạo icon 128x128.
 */
export async function normalizeExistingTo512(srcPath, dest512Path, destIconPath) {
  const img = await loadImage(srcPath);
  const out512 = createCanvas(512, 512);
  const octx = out512.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  const scale = Math.min(512 / img.width, 512 / img.height);
  const dw = Math.round(img.width * scale);
  const dh = Math.round(img.height * scale);
  octx.drawImage(img, Math.round((512 - dw) / 2), Math.round((512 - dh) / 2), dw, dh);
  fs.writeFileSync(dest512Path, out512.toBuffer('image/png'));

  if (destIconPath) {
    const out128 = createCanvas(128, 128);
    const ictx = out128.getContext('2d');
    ictx.imageSmoothingEnabled = true;
    ictx.imageSmoothingQuality = 'high';
    ictx.drawImage(out512, 0, 0, 128, 128);
    fs.mkdirSync(path.dirname(destIconPath), { recursive: true });
    fs.writeFileSync(destIconPath, out128.toBuffer('image/png'));
  }
}

function lanczosKernel(x, a = 3) {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

/**
 * Lanczos-3 resampling trên premultiplied RGBA buffer (chống loang viền đen/trắng từ nền trong suốt).
 */
function lanczosResamplePremul2x(src, w, h) {
  const nw = w * 2;
  const nh = h * 2;
  const tmp = new Float32Array(nw * h * 4);
  const dst = new Float32Array(nw * nh * 4);
  const a = 3;

  // Horizontal pass -> nw x h
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < nw; x++) {
      const cx = (x + 0.5) / 2 - 0.5;
      const x0 = Math.floor(cx) - a + 1;
      const x1 = Math.floor(cx) + a;
      let r = 0, g = 0, b = 0, al = 0, wSum = 0;
      for (let sx = x0; sx <= x1; sx++) {
        const clampedX = Math.max(0, Math.min(w - 1, sx));
        const kw = lanczosKernel(cx - sx, a);
        const si = (y * w + clampedX) * 4;
        r += src[si] * kw;
        g += src[si + 1] * kw;
        b += src[si + 2] * kw;
        al += src[si + 3] * kw;
        wSum += kw;
      }
      const di = (y * nw + x) * 4;
      const inv = wSum > 0 ? 1 / wSum : 1;
      tmp[di] = r * inv;
      tmp[di + 1] = g * inv;
      tmp[di + 2] = b * inv;
      tmp[di + 3] = al * inv;
    }
  }

  // Vertical pass -> nw x nh
  for (let y = 0; y < nh; y++) {
    const cy = (y + 0.5) / 2 - 0.5;
    const y0 = Math.floor(cy) - a + 1;
    const y1 = Math.floor(cy) + a;
    for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, al = 0, wSum = 0;
      for (let sy = y0; sy <= y1; sy++) {
        const clampedY = Math.max(0, Math.min(h - 1, sy));
        const kw = lanczosKernel(cy - sy, a);
        const si = (clampedY * nw + x) * 4;
        r += tmp[si] * kw;
        g += tmp[si + 1] * kw;
        b += tmp[si + 2] * kw;
        al += tmp[si + 3] * kw;
        wSum += kw;
      }
      const di = (y * nw + x) * 4;
      const inv = wSum > 0 ? 1 / wSum : 1;
      dst[di] = r * inv;
      dst[di + 1] = g * inv;
      dst[di + 2] = b * inv;
      dst[di + 3] = al * inv;
    }
  }

  return dst;
}

/**
 * Unsharp mask đa bán kính (radius ~2px) giữ màu sắc trung thực, tăng nét chi tiết.
 */
function sharpenPremulBuffer(buf, w, h, amount = 1.35) {
  // Separable 5-tap Gaussian [1, 4, 6, 4, 1] / 16 (radius ~2px at 512px)
  const k = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  const tmp = new Float32Array(w * h * 4);
  const blurred = new Float32Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let d = -2; d <= 2; d++) {
        const sx = Math.max(0, Math.min(w - 1, x + d));
        const kw = k[d + 2];
        const si = (y * w + sx) * 4;
        r += buf[si] * kw;
        g += buf[si + 1] * kw;
        b += buf[si + 2] * kw;
        al += buf[si + 3] * kw;
      }
      const di = (y * w + x) * 4;
      tmp[di] = r; tmp[di + 1] = g; tmp[di + 2] = b; tmp[di + 3] = al;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let d = -2; d <= 2; d++) {
        const sy = Math.max(0, Math.min(h - 1, y + d));
        const kw = k[d + 2];
        const si = (sy * w + x) * 4;
        r += tmp[si] * kw;
        g += tmp[si + 1] * kw;
        b += tmp[si + 2] * kw;
        al += tmp[si + 3] * kw;
      }
      const di = (y * w + x) * 4;
      blurred[di] = r; blurred[di + 1] = g; blurred[di + 2] = b; blurred[di + 3] = al;
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h * 4; i += 4) {
    const aRaw = Math.max(0, Math.min(255, buf[i + 3] + (buf[i + 3] - blurred[i + 3]) * 0.65));
    if (aRaw < 6) {
      out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
      continue;
    }
    const alphaNorm = aRaw / 255;
    for (let c = 0; c < 3; c++) {
      const diff = buf[i + c] - blurred[i + c];
      const delta = Math.abs(diff) > 1.2 ? Math.max(-45, Math.min(45, diff * amount)) : 0;
      const sharpPremul = buf[i + c] + delta;
      out[i + c] = Math.max(0, Math.min(255, Math.round(sharpPremul / Math.max(0.06, alphaNorm))));
    }
    out[i + 3] = Math.round(aRaw);
  }
  return out;
}

export async function upscale128To512Algorithmic(srcPath, dest512Path, destIconPath) {
  const img = await loadImage(srcPath);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const raw = ctx.getImageData(0, 0, img.width, img.height).data;

  // Premultiply directly from crisp 128px source without blurring detail
  const srcPremul = new Float32Array(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height * 4; i += 4) {
    const a = raw[i + 3] / 255;
    if (a <= 0.01) continue;
    srcPremul[i] = raw[i] * a;
    srcPremul[i + 1] = raw[i + 1] * a;
    srcPremul[i + 2] = raw[i + 2] * a;
    srcPremul[i + 3] = raw[i + 3];
  }

  // Stage 1: 128 -> 256 + nhẹ contrast sharpen premul
  const p256 = lanczosResamplePremul2x(srcPremul, img.width, img.height);
  const w2 = img.width * 2;
  const h2 = img.height * 2;
  // Stage 2: 256 -> 512
  const p512 = lanczosResamplePremul2x(p256, w2, h2);
  const w4 = w2 * 2;
  const h4 = h2 * 2;

  const finalRgba = sharpenPremulBuffer(p512, w4, h4, 1.45);
  const out512 = createCanvas(w4, h4);
  const octx = out512.getContext('2d');
  const outImgData = octx.createImageData(w4, h4);
  outImgData.data.set(finalRgba);
  octx.putImageData(outImgData, 0, 0);

  fs.mkdirSync(path.dirname(dest512Path), { recursive: true });
  fs.writeFileSync(dest512Path, out512.toBuffer('image/png'));

  if (destIconPath) {
    const out128 = createCanvas(128, 128);
    const ictx = out128.getContext('2d');
    ictx.imageSmoothingEnabled = true;
    ictx.imageSmoothingQuality = 'high';
    ictx.drawImage(out512, 0, 0, 128, 128);
    fs.mkdirSync(path.dirname(destIconPath), { recursive: true });
    fs.writeFileSync(destIconPath, out128.toBuffer('image/png'));
  }
}

// CLI mode:
// node scripts/process_hd_pets.mjs <pet_type> <source_image_path>
if (process.argv[1] && path.resolve(process.argv[1]) === __filename && process.argv[2]) {
  const mode = process.argv[2];
  if (mode === '--upscale-remaining') {
    const { PET_CATALOG } = await import('../src/data/catalog.js');
    const aiHdDone = new Set(['cuu_u_do_than_diem_lang', 'linh_ho_tieu_bach', 'thanh_lam_tieu_dieu']);
    const origDir = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/orig_pets_128';
    let upgraded = 0;
    for (const p of PET_CATALOG) {
      if (p.is_exclusive_fuyumi || aiHdDone.has(p.pet_type)) continue;
      const fp = path.join(ROOT, 'assets/pets', `${p.pet_type}.png`);
      const origFp = path.join(origDir, `${p.pet_type}.png`);
      const srcFp = fs.existsSync(origFp) ? origFp : fp;
      const icp = path.join(ROOT, 'assets/pets/icons', `${p.pet_type}.png`);
      if (!fs.existsSync(srcFp)) continue;
      const img = await loadImage(srcFp);
      if (img.width < 512 || img.height < 512) {
        if (Math.max(img.width, img.height) >= 384) {
          await normalizeExistingTo512(srcFp, fp, icp);
        } else {
          await upscale128To512Algorithmic(srcFp, fp, icp);
        }
        upgraded++;
      } else if (!fs.existsSync(icp)) {
        const out128 = createCanvas(128, 128);
        const ictx = out128.getContext('2d');
        ictx.imageSmoothingEnabled = true;
        ictx.imageSmoothingQuality = 'high';
        ictx.drawImage(img, 0, 0, 128, 128);
        fs.mkdirSync(path.dirname(icp), { recursive: true });
        fs.writeFileSync(icp, out128.toBuffer('image/png'));
      }
    }
    console.log(`Algorithmically upscaled ${upgraded} remaining <512px pets to 512x512 + 128x128 icons!`);
  } else if (mode === '--sync-icons') {
    const { PET_CATALOG } = await import('../src/data/catalog.js');
    let generated = 0;
    for (const p of PET_CATALOG) {
      if (p.is_exclusive_fuyumi) continue;
      const fp = path.join(ROOT, 'assets/pets', `${p.pet_type}.png`);
      const icp = path.join(ROOT, 'assets/pets/icons', `${p.pet_type}.png`);
      if (!fs.existsSync(fp)) continue;
      const img = await loadImage(fp);
      if (img.width < 512 || img.height < 512) {
        if (Math.max(img.width, img.height) >= 384) {
          await normalizeExistingTo512(fp, fp, icp);
          generated++;
        }
      } else if (!fs.existsSync(icp)) {
        const out128 = createCanvas(128, 128);
        const ictx = out128.getContext('2d');
        ictx.imageSmoothingEnabled = true;
        ictx.imageSmoothingQuality = 'high';
        ictx.drawImage(img, 0, 0, 128, 128);
        fs.mkdirSync(path.dirname(icp), { recursive: true });
        fs.writeFileSync(icp, out128.toBuffer('image/png'));
        generated++;
      }
    }
    console.log(`Synced non-square >=384px & missing icons: ${generated}`);
  } else {
    const petType = mode;
    const src = process.argv[3];
    const dest512 = path.join(ROOT, 'assets/pets', `${petType}.png`);
    const destIc = path.join(ROOT, 'assets/pets/icons', `${petType}.png`);
    const info = await convertGeneratedToTransparent512(src, dest512, destIc);
    console.log(`Processed ${petType} -> 512x512 + 128x128 icon:`, info);
  }
}
