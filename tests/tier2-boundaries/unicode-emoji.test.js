import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 2 - Unicode, Vietnamese Glyphs & Emoji Boundaries', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. Vietnamese diacritics in username and title preserve fidelity in JSON and PNG', async () => {
    const vnName = 'Nguyễn Thị Huyền Diệu 🦊';
    const vnTitle = 'Đại La Kim Tiên';

    const resJson = await testServer.fetch(
      `/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json&username=${encodeURIComponent(vnName)}&title=${encodeURIComponent(vnTitle)}`
    );
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.data.username, vnName);
    assert.equal(json.data.custom_title, vnTitle);

    const resPng = await testServer.fetch(
      `/api/profile/${FIXTURE_USERS.defaultUser.userId}?username=${encodeURIComponent(vnName)}&title=${encodeURIComponent(vnTitle)}`
    );
    assert.equal(resPng.status, 200);
    const buffer = Buffer.from(await resPng.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('2. Extremely long Vietnamese strings (100+ chars) render safely without canvas overflow', async () => {
    const veryLongName = 'Hỗn Độn Sơ Khai Vô Cực Thái Thượng Lão Quân Đại La Kim Tiên Bất Diệt Chí Tôn Cửu Vĩ Linh Hồ SuMi Family';
    const payload = {
      user_id: '9988776655',
      username: veryLongName,
      bio: 'Đây là phần tiểu sử cực kỳ dài nhằm kiểm tra thuật toán cắt chuỗi tự động của Canvas Renderer để đảm bảo không bị vỡ giao diện.',
      level: 50,
      realm: 'IV. Nguyên Anh Chân Quân',
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('3. Multi-byte Unicode emojis (🌸, 🦊, ⚔️, 🛡️, 🔥, ❄️) render cleanly without tofu', async () => {
    const emojiPayload = {
      user_id: '8877665544',
      username: '🌸 Fox Master 🦊 ⚔️ 🛡️',
      custom_title: '🔥 Băng Hỏa Đồng Tu ❄️',
      level: 80,
      realm: 'V. Hóa Thần Tiên Tôn',
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emojiPayload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('4. Discord custom emoji patterns (<:fox_cute:1027173664069795921>) in text render safely', async () => {
    const customEmojiPayload = {
      user_id: '7766554433',
      username: 'Tu Sĩ <:fox_cute:1027173664069795921> Hồ',
      bio: 'Đang tu luyện tại <:sumi_gate:1026096141273661450> Tiên Môn',
      level: 25,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customEmojiPayload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('5. Empty string or whitespace-only inputs fallback cleanly without crashing', async () => {
    const emptyPayload = {
      user_id: '6655443322',
      username: '   ',
      custom_title: '',
      level: 1,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyPayload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('6. Strings containing interior NUL (\\0) render safely without throwing Convert String to CString failed', async () => {
    const nulPayload = {
      user_id: '5544332211',
      username: 'Fuyumi\x00Hacker',
      custom_title: 'Title\x00With\x00Nul',
      bio: 'Bio\x00with\x00nul\x00bytes',
      level: 10,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nulPayload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });
});
