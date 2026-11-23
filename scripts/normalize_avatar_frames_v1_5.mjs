/**
 * scripts/normalize_avatar_frames_v1_5.mjs
 * Backs up raw 512x512 avatar frames to brain scratch/frames_backup_raw/,
 * then normalizes each frame so its structural ring is centered at (256, 256)
 * with a circular inner opening around R_TARGET = 166px (zero bottom-left bulge/oval gap),
 * while preserving exterior details and inward ornaments smoothly.
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const FRAMES_DIR = path.join(PROJECT_ROOT, 'assets', 'frames');
const BACKUP_DIR = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/frames_backup_raw';
const TARGET_SIZE = 512;
const CENTER = 256;
const TARGET_INNER_R = 166;

function sampleBilinear(srcData, w, h, x, y) {
  if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const idx = (iy * w + ix) * 4;
    // Clamp edge to transparent if outside canvas
    if (x < -0.5 || x > w - 0.5 || y < -0.5 || y > h - 0.5) return [0, 0, 0, 0];
    return [srcData[idx], srcData[idx + 1], srcData[idx + 2], srcData[idx + 3]];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + (x0 + 1)) * 4;
  const i01 = ((y0 + 1) * w + x0) * 4;
  const i11 = ((y0 + 1) * w + (x0 + 1)) * 4;

  // Premultiplied alpha bilinear interpolation prevents dark fringes
  const out = [0, 0, 0, 0];
  const a00 = srcData[i00 + 3] / 255;
  const a10 = srcData[i10 + 3] / 255;
  const a01 = srcData[i01 + 3] / 255;
  const a11 = srcData[i11 + 3] / 255;
  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  const alpha = w00 * a00 + w10 * a10 + w01 * a01 + w11 * a11;
  out[3] = Math.round(alpha * 255);
  if (alpha > 1e-4) {
    for (let c = 0; c < 3; c += 1) {
      const premul = w00 * srcData[i00 + c] * a00
        + w10 * srcData[i10 + c] * a10
        + w01 * srcData[i01 + c] * a01
        + w11 * srcData[i11 + c] * a11;
      out[c] = Math.min(255, Math.max(0, Math.round(premul / alpha)));
    }
  }
  return out;
}

function findHoleCentroid(data, w, h) {
  const visited = new Uint8Array(w * h);
  const q = [Math.floor(h / 2) * w + Math.floor(w / 2)];
  visited[q[0]] = 1;
  let sumX = 0;
  let sumY = 0;
  let cnt = 0;
  while (q.length) {
    const idx = q.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    sumX += x;
    sumY += y;
    cnt += 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nidx = ny * w + nx;
        if (!visited[nidx] && data[nidx * 4 + 3] < 190) {
          visited[nidx] = 1;
          q.push(nidx);
        }
      }
    }
  }
  if (cnt < 100) return { cx: CENTER, cy: CENTER };
  return { cx: sumX / cnt, cy: sumY / cnt };
}

function measureStructuralInnerCurve(data, w, h, cx, cy) {
  // For each of 360 degrees, find inner edge radius of main continuous opaque ring.
  // To avoid inward crown/flame protrusions (like Kitsune top gem or floating wisps),
  // scan inward-to-outward and pick the start of the thickest solid band in r=[105..215].
  const rawR = new Float64Array(360);
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Find runs of opaque pixels (alpha >= 200)
    const runs = [];
    let inRun = false;
    let start = 0;
    for (let r = 80; r <= 235; r += 1) {
      const x = Math.round(cx + r * cos);
      const y = Math.round(cy + r * sin);
      const alpha = (x >= 0 && x < w && y >= 0 && y < h) ? data[(y * w + x) * 4 + 3] : 0;
      if (alpha >= 200) {
        if (!inRun) {
          inRun = true;
          start = r;
        }
      } else if (inRun) {
        runs.push({ start, end: r - 1, len: r - start });
        inRun = false;
      }
    }
    if (inRun) runs.push({ start, end: 235, len: 235 - start + 1 });

    // Pick first substantial run (thickness >= 6px) located in structural band (start >= 115 && start <= 205), or fallback
    const structural = runs.find((run) => run.start >= 115 && run.start <= 205 && run.len >= 6)
      || runs.find((run) => run.start >= 100 && run.len >= 5)
      || runs[0];
    rawR[a] = structural ? structural.start : TARGET_INNER_R;
  }

  // Filter inward spikes using local 80th-percentile smoothing (window +-15 deg), then circular Gaussian smooth
  const filtered = new Float64Array(360);
  for (let a = 0; a < 360; a += 1) {
    const win = [];
    for (let d = -14; d <= 14; d += 1) {
      win.push(rawR[(a + d + 360) % 360]);
    }
    win.sort((u, v) => u - v);
    // Upper quartile ignores inward ornaments (small r) while capturing true ring rim
    filtered[a] = win[Math.floor(win.length * 0.72)];
  }

  const smooth = new Float64Array(360);
  for (let a = 0; a < 360; a += 1) {
    let acc = 0;
    let wsum = 0;
    for (let d = -18; d <= 18; d += 1) {
      const wt = Math.exp(-(d * d) / (2 * 7 * 7));
      acc += filtered[(a + d + 360) % 360] * wt;
      wsum += wt;
    }
    smooth[a] = acc / wsum;
  }
  return smooth;
}

async function normalizeFrameFile(fileName) {
  const srcPath = path.join(BACKUP_DIR, fileName);
  const dstPath = path.join(FRAMES_DIR, fileName);
  const img = await loadImage(srcPath);

  const srcCanvas = createCanvas(TARGET_SIZE, TARGET_SIZE);
  const sCtx = srcCanvas.getContext('2d');
  sCtx.drawImage(img, 0, 0, TARGET_SIZE, TARGET_SIZE);
  const srcImgData = sCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const srcData = srcImgData.data;

  // Estimate centroid from central transparent opening
  const { cx, cy } = findHoleCentroid(srcData, TARGET_SIZE, TARGET_SIZE);
  const smoothInnerR = measureStructuralInnerCurve(srcData, TARGET_SIZE, TARGET_SIZE, cx, cy);

  // Measure mean inner R and max deviation from circle
  let sumR = 0;
  let minR = 999;
  let maxR = 0;
  for (let a = 0; a < 360; a += 1) {
    const val = smoothInnerR[a];
    sumR += val;
    if (val < minR) minR = val;
    if (val > maxR) maxR = val;
  }
  const avgR = sumR / 360;

  // Inverse radial warp: for each output pixel (x, y) centered at (CENTER, CENTER),
  // map radius rOut -> rSrc so TARGET_INNER_R maps cleanly onto smoothInnerR[theta],
  // fading the radial correction smoothly toward rOut=0 and rOut=252 so outer frame canvas stays inside bounds.
  const outCanvas = createCanvas(TARGET_SIZE, TARGET_SIZE);
  const oCtx = outCanvas.getContext('2d');
  const outImgData = oCtx.createImageData(TARGET_SIZE, TARGET_SIZE);
  const outData = outImgData.data;

  // Keep overall scale close to original if avgR is already near TARGET_INNER_R, or normalize uniformly to TARGET_INNER_R = 166
  const blendShift = (TARGET_INNER_R - avgR);

  for (let y = 0; y < TARGET_SIZE; y += 1) {
    for (let x = 0; x < TARGET_SIZE; x += 1) {
      const dx = x - CENTER;
      const dy = y - CENTER;
      const rOut = Math.hypot(dx, dy);
      if (rOut < 0.5) {
        const idx = (y * TARGET_SIZE + x) * 4;
        outData[idx] = 0;
        outData[idx + 1] = 0;
        outData[idx + 2] = 0;
        outData[idx + 3] = 0;
        continue;
      }

      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      const a0 = Math.floor(deg) % 360;
      const a1 = (a0 + 1) % 360;
      const frac = deg - Math.floor(deg);
      const rRingSrc = smoothInnerR[a0] * (1 - frac) + smoothInnerR[a1] * frac;

      // Desired shift at the ring: we want output rOut = TARGET_INNER_R to sample source at rSrc = rRingSrc
      // Smooth envelope over rOut in [0 .. 255] peaking at TARGET_INNER_R (and keeping r=254 pinned near canvas edge)
      let envelope;
      if (rOut <= TARGET_INNER_R) {
        envelope = rOut / TARGET_INNER_R;
      } else {
        const t = Math.min(1, (rOut - TARGET_INNER_R) / (254 - TARGET_INNER_R));
        // Smoothstep fade to 0 at edge so outer ornaments never get clipped off canvas
        envelope = 1 - (t * t * (3 - 2 * t));
      }

      const rSrc = Math.max(0, rOut + (rRingSrc - TARGET_INNER_R) * envelope);
      const ux = dx / rOut;
      const uy = dy / rOut;
      const sx = cx + ux * rSrc;
      const sy = cy + uy * rSrc;

      const [r, g, b, a] = sampleBilinear(srcData, TARGET_SIZE, TARGET_SIZE, sx, sy);
      const oIdx = (y * TARGET_SIZE + x) * 4;
      outData[oIdx] = r;
      outData[oIdx + 1] = g;
      outData[oIdx + 2] = b;
      outData[oIdx + 3] = a;
    }
  }

  oCtx.putImageData(outImgData, 0, 0);
  const buf = outCanvas.toBuffer('image/png');
  await fs.promises.writeFile(dstPath, buf);
  return {
    file: fileName,
    origCenter: `${cx.toFixed(1)},${cy.toFixed(1)}`,
    origInnerRange: `${minR.toFixed(0)}..${maxR.toFixed(0)} (avg ${avgR.toFixed(1)})`,
    shiftDelta: `${blendShift >= 0 ? '+' : ''}${blendShift.toFixed(1)}`,
  };
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    const bak = path.join(BACKUP_DIR, f);
    if (!fs.existsSync(bak)) {
      fs.copyFileSync(path.join(FRAMES_DIR, f), bak);
    }
  }
  console.log(`Backed up ${files.length} raw frames to ${BACKUP_DIR}`);
  for (const f of files) {
    const info = await normalizeFrameFile(f);
    console.log(info.file.padEnd(30), 'origCenter:', info.origCenter.padEnd(11), 'origR:', info.origInnerRange.padEnd(19), 'to TARGET_R=166');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
