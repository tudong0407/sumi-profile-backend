import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestServer } from './helpers/testServer.js';
import { FIXTURE_USERS } from './helpers/fixtures.js';
import {
  resolveAssetPath,
  resolvePublicAssetPath,
  clearAssetPathCache,
  loadImageSafe,
} from '../src/canvas/drawUtils.js';
import { AVATAR_FRAMES } from '../src/data/catalog.js';

describe('Asset WebP Conversion, Animated GIF & /assets Fallback', () => {
  let testServer;

  before(async () => {
    clearAssetPathCache();
    testServer = await createTestServer();
  });

  after(async () => {
    await testServer.close();
  });

  it('1. resolveAssetPath falls back from legacy .png queries to converted .webp and decodes .gif', async () => {
    const ringResolved = resolveAssetPath('rings/ring_rare.png');
    assert.ok(ringResolved && ringResolved.endsWith('.webp'), `Expected .webp for ring_rare.png, got ${ringResolved}`);

    const petResolved = resolveAssetPath('pets/hoa_thach_nham_nham.png');
    assert.ok(petResolved && petResolved.endsWith('.webp'), `Expected .webp for starter pet, got ${petResolved}`);

    const gifImg = await loadImageSafe('minigames/card_deal.gif', 1500, null);
    assert.ok(gifImg && gifImg.width > 0 && gifImg.height > 0, 'GIF asset should decode cleanly via loadImageSafe');
  });

  it('2. resolvePublicAssetPath prefers .gif over .webp and falls back cleanly for rings/items/bgs', () => {
    const publicRing = resolvePublicAssetPath('rings/ring_rare.png');
    assert.equal(publicRing, 'rings/ring_rare.webp');

    const publicGif = resolvePublicAssetPath('minigames/card_deal.png');
    assert.equal(publicGif, 'minigames/card_deal.gif');

    // Temporary test GIF priority check inside assets/rings
    const tmpGif = path.resolve('assets/rings/_tmp_test_anim.gif');
    try {
      fs.writeFileSync(tmpGif, fs.readFileSync(path.resolve('assets/minigames/card_deal.gif')));
      clearAssetPathCache();
      assert.equal(resolvePublicAssetPath('rings/_tmp_test_anim.png'), 'rings/_tmp_test_anim.gif');
    } finally {
      if (fs.existsSync(tmpGif)) fs.unlinkSync(tmpGif);
      clearAssetPathCache();
    }
  });

  it('3. Express /assets serves .webp for legacy .png URLs with 30d Cache-Control', async () => {
    const res = await testServer.fetch('/assets/rings/ring_rare.png');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /image\/webp/i);
    assert.match(res.headers.get('cache-control') || '', /max-age=2592000/i);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  });

  it('4. Preserves all 20 PNG avatar frames, removes duplicate map PNG, and renders Fuyumi WebP profile', async () => {
    const fileFrames = AVATAR_FRAMES.filter((f) => f.frame_id !== 'default');
    assert.equal(fileFrames.length, 20);
    for (const f of fileFrames) {
      assert.ok(fs.existsSync(path.resolve('assets/frames', `${f.frame_id}.png`)), `Missing ${f.frame_id}.png`);
    }
    assert.equal(fs.existsSync(path.resolve('assets/maps/explorer_world_map_v14.png')), false, 'Duplicate map PNG must be removed');
    assert.equal(fs.existsSync(path.resolve('assets/maps/explorer_world_map_v14.webp')), true);

    const profRes = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}.webp`);
    assert.equal(profRes.status, 200);
    assert.match(profRes.headers.get('content-type') || '', /image\/webp/i);
    const buf = Buffer.from(await profRes.arrayBuffer());
    assert.ok(buf.length > 50000);
  });
});
