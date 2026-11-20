import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { sanitizeUserId } from '../../src/services/profileService.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';
import { assertPngValid } from '../helpers/pngValidator.js';

describe('Tier 2 - Discord Mention & ID Sanitization Boundaries', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. Standard Discord mention <@id> sanitizes and resolves user profile', async () => {
    const rawMention = `<@${FIXTURE_USERS.fuyumi.userId}>`;
    const clean = sanitizeUserId(rawMention);
    assert.equal(clean, FIXTURE_USERS.fuyumi.userId, 'Unit sanitization must extract snowflake');

    const res = await testServer.fetch(`/api/profile/${rawMention}?format=json`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
  });

  it('2. Nickname mention <@!id> with .png extension renders valid PNG rank card', async () => {
    const rawMentionWithExt = `<@!${FIXTURE_USERS.fuyumi.userId}>.png`;
    const clean = sanitizeUserId(rawMentionWithExt);
    assert.equal(clean, FIXTURE_USERS.fuyumi.userId, 'Must strip <@! and .png');

    const encodedPath = encodeURIComponent(`<@!${FIXTURE_USERS.fuyumi.userId}>`) + '.png';
    const res = await testServer.fetch(`/api/rank/${encodedPath}`);
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 410);
  });

  it('3. URL-encoded mention (%3C@id%3E) parses accurately via HTTP routing', async () => {
    const encodedMention = `%3C@${FIXTURE_USERS.fuyumi.userId}%3E`;
    const res = await testServer.fetch(`/api/profile/${encodedMention}?format=json`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.data.username, /Fuyumi/);
  });

  it('4. BotGhost placeholder variable {option_user} triggers query param fallback', async () => {
    // When BotGhost doesn't replace the variable, it sends literally "{option_user}"
    assert.equal(sanitizeUserId('{option_user}'), '', 'Bracket placeholder should return empty string');

    const res = await testServer.fetch(
      `/api/profile/{option_user}?user_id=${FIXTURE_USERS.fuyumi.userId}&format=json`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.data.username, /Fuyumi/);
  });

  it('5. Non-numeric inputs and special characters do not cause unhandled crashes', async () => {
    const malformedInputs = ['@everyone', '<@&1234567890>', 'tu-si-random-xyz', 'null', 'undefined'];

    for (const input of malformedInputs) {
      const clean = sanitizeUserId(input);
      assert.equal(typeof clean, 'string');

      const res = await testServer.fetch(`/api/profile/${encodeURIComponent(input)}?format=json`);
      // Server must return a valid 200 response (with default mock user) rather than a 500 error
      assert.equal(res.status, 200, `Input "${input}" should resolve without server error`);
      const json = await res.json();
      assert.ok(json.success, `Expected success for input "${input}"`);
    }
  });
});
