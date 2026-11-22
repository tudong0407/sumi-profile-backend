import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '@napi-rs/canvas';
import { createTestServer } from '../helpers/testServer.js';
import { PET_CATALOG, DOMAIN_BY_ID } from '../../src/data/catalog.js';
import {
  BATTLE_LOG_TTL_MS,
  clearBattleLogStoreMemory,
  getCachedTurnBuffer,
  loadBattleLogRecord,
} from '../../src/services/battleEngine/battleLogStore.js';
import {
  buildAdaptiveFrames,
  simulateBattle,
  getBattleLogPayload,
} from '../../src/services/battleService.js';
import {
  simulateTeamBattle,
  getTeamBattleLogPayload,
  renderTeamBattleLogHtml,
} from '../../src/services/battleEngine/teamBattleService.js';
import { getChangelogPayload } from '../../src/data/changelogs.js';
import { getWikiData, getWikiItemDetail, getWikiPetDetail } from '../../src/services/wikiService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { getUserExpBoostSummary } from '../../src/services/expService.js';

describe('Tier 1 - v1.4.7 Battle Adaptive H1/5/10/15/20, Lazy On-Demand Web Logs (48h) & Zero Footers', () => {
  let testServer;

  before(async () => {
    clearBattleLogStoreMemory();
    testServer = await createTestServer();
  });

  after(async () => {
    clearBattleLogStoreMemory();
    if (testServer) await testServer.close();
  });

  it('1. buildAdaptiveFrames emits H1, 5, 10, 15, 20 + Final schedule and stops early on short wins', () => {
    const mkTurns = (n) => Array.from({ length: n }, (_, i) => ({
      turn: i + 1,
      attackerHp: Math.max(100, 1000 - i * 20),
      defenderHp: Math.max(0, 1000 - (i + 1) * 30),
    }));

    const f1 = buildAdaptiveFrames(mkTurns(1), 1, { attacker: 1000, defender: 1000 }, { attacker: 900, defender: 0 }, 'Win');
    assert.deepEqual(f1.map((f) => f.currentTurn), [0, 1]);

    const f7 = buildAdaptiveFrames(mkTurns(7), 7, { attacker: 1000, defender: 1000 }, { attacker: 860, defender: 0 }, 'Win');
    assert.deepEqual(f7.map((f) => f.currentTurn), [1, 5, 7]);

    const f25 = buildAdaptiveFrames(mkTurns(25), 25, { attacker: 1000, defender: 1000 }, { attacker: 500, defender: 0 }, 'Win');
    assert.deepEqual(f25.map((f) => f.currentTurn), [1, 5, 10, 15, 20, 25]);
    assert.equal(f25[0].scale, 0.72);
    assert.equal(f25[f25.length - 1].scale, 1.25);
  });

  it('2. 1v1 Battle does NOT pre-render non-milestone turn buffers, renders all turns on Web Logs POST render-all, and honors 48h TTL', async () => {
    const pA = {
      user_id: '888147000000000001',
      username: 'WebLog Công',
      level: 55,
      pet: { ...PET_CATALOG.find((p) => p.pet_type === 'thanh_truc_tien_loc'), level: 55, star: 5, enchant_grade: 'A' },
    };
    const pB = {
      user_id: '888147000000000002',
      username: 'WebLog Thủ',
      level: 55,
      pet: { ...PET_CATALOG.find((p) => p.pet_type === 'thuy_tinh_huyen_ngao'), level: 55, star: 5, enchant_grade: 'A' },
    };

    const res = await simulateBattle(pA, pB, {
      maxTurns: 18,
      preRender: true,
      awaitBackgroundTasks: true,
      skipQuestTracking: true,
      seed: 99,
    });
    assert.ok(res.turnCount >= 3, `Expected multi-turn fight, got ${res.turnCount}`);
    assert.equal(res.footer, '');
    assert.ok(Array.isArray(res.turnSnapshots) && res.turnSnapshots.length === res.turnCount + 1);

    // Must NOT have pre-rendered turn 2 before Web Logs opens!
    assert.equal(getCachedTurnBuffer(res.battleId, 'turn:2'), null);

    // Record stored with 48h TTL
    const stored = await loadBattleLogRecord({ battleId: res.battleId, battleKind: '1v1' });
    assert.ok(stored);
    assert.equal(stored.expiresAtMs - stored.createdAtMs, BATTLE_LOG_TTL_MS);

    // Open Web Logs view
    const viewRes = await testServer.fetch(`/api/battle/logs/${res.battleId}/view`);
    assert.equal(viewRes.status, 200);
    const html = await viewRes.text();
    assert.match(html, /render-all/);
    assert.match(html, /btnPrev/);
    assert.match(html, /btnNext/);
    assert.match(html, /tối đa 2 ngày|lưu tối đa 48 giờ|47g/i);

    // Trigger lazy render-all endpoint (only when web logs is opened)
    const rAllRes = await testServer.fetch(`/api/battle/logs/${res.battleId}/render-all`, { method: 'POST' });
    assert.equal(rAllRes.status, 200);
    const rAllJson = await rAllRes.json();
    assert.equal(rAllJson.success, true);
    assert.equal(rAllJson.rendered_count, res.turnCount + 1);
    assert.ok(getCachedTurnBuffer(res.battleId, 'turn:2'), 'turn:2 WebP buffer must be cached after render-all');

    // Fetch turn 2 image and validate WebP dimensions (1000*0.9 = 900x450)
    const turn2ImgRes = await testServer.fetch(`/api/battle/logs/${res.battleId}/turn/2.webp`);
    assert.equal(turn2ImgRes.status, 200);
    assert.ok(turn2ImgRes.headers.get('content-type')?.includes('image/webp'));
    const img = await loadImage(Buffer.from(await turn2ImgRes.arrayBuffer()));
    assert.equal(img.width, 900);
    assert.equal(img.height, 450);

    // Expired log (>48h) gracefully returns not-found
    const expired = await loadBattleLogRecord({
      battleId: res.battleId,
      battleKind: '1v1',
      nowMs: res.createdAtMs + BATTLE_LOG_TTL_MS + 1000,
    });
    assert.equal(expired, null);
  });

  it('3. Team Battle Web Logs (render-all + single turn WebP) & Zero Footers across all API payloads', async () => {
    const unitA = {
      id: '888147000000000011',
      name: 'Đội Trưởng',
      pet: { pet_type: 'bach_kim_ho_tu', pet_name: 'Bạch Kim Hổ Tử', element: 'Kim', level: 80, star: 7 },
      domainLoadout: { domain: DOMAIN_BY_ID.domain_mythic_1 },
      atk: 9500, def: 8200, spd: 8900, maxHp: 220000, critRate: 0.2, powerScore: 150000,
    };
    const unitB = {
      id: '888147000000000012',
      name: 'Thủ Mỏ',
      pet: { pet_type: 'thanh_de_moc_long', pet_name: 'Thanh Đế Mộc Long', element: 'Mộc', level: 80, star: 7 },
      domainLoadout: {},
      atk: 8800, def: 8500, spd: 8100, maxHp: 210000, critRate: 0.15, powerScore: 140000,
    };
    const teamRes = simulateTeamBattle([unitA], [unitB], { mode: '3v3', veinLabel: 'TEST LINH MẠCH', rng: () => 0.42 });
    assert.equal(teamRes.footer, '');
    assert.ok(teamRes.turnSnapshots.length >= 2);
    assert.equal(getCachedTurnBuffer(teamRes.battleId, 'team:turn:1'), null);

    const htmlRes = await renderTeamBattleLogHtml(teamRes.battleId);
    assert.equal(htmlRes.found, true);
    assert.match(htmlRes.html, /\/api\/vein\/battle\/.*render-all/);

    const postAll = await testServer.fetch(`/api/vein/battle/${teamRes.battleId}/render-all`, { method: 'POST' });
    assert.equal(postAll.status, 200);
    const postJson = await postAll.json();
    assert.equal(postJson.rendered_count, teamRes.turnCount + 1);

    const t1Img = await testServer.fetch(`/api/vein/battle/${teamRes.battleId}/turn/1.webp`);
    assert.equal(t1Img.status, 200);
    assert.ok(t1Img.headers.get('content-type')?.includes('image/webp'));

    const teamLog = await getTeamBattleLogPayload({ battleId: teamRes.battleId });
    const battleLogMissing = await getBattleLogPayload({ battleId: 'nonexistent999' });
    const changelog = getChangelogPayload('1.4.7');
    const itemDetail = await getWikiItemDetail('weapon_mythic_1');
    const petDetail = await getWikiPetDetail('bach_kim_ho_tu');
    const infoRes = lookupInfo('tower_reset_card');
    const expBad = await getUserExpBoostSummary('invalid');

    assert.equal(teamLog.footer, '');
    assert.equal(battleLogMissing.footer, '');
    assert.equal(changelog.footer, '');
    assert.equal(itemDetail.embed.footer, '');
    assert.equal(petDetail.embed.footer, '');
    assert.equal(infoRes.footer, '');
    assert.equal(expBad.footer, '');
    assert.ok(getWikiData('overview').success);
  });
});
