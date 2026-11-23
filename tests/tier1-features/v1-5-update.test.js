import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { supabase } from '../../src/config/supabase.js';
import {
  FUYUMI_USER_ID,
  AVATAR_FRAMES,
  AVATAR_FRAME_BY_ID,
  SHOP_CONSUMABLES,
  DOMAIN_BY_ID,
} from '../../src/data/catalog.js';
import { V15_NEW_EMOJI_PROMPTS, V15_AVATAR_FRAME_SPECS } from '../../src/data/v15AssetsCatalog.js';
import { LATEST_VERSION, V15_DRAFT_CHANGELOG } from '../../src/data/changelogs.js';
import { WIKI_METADATA, WIKI_CATEGORIES } from '../../src/services/wikiService.js';
import { SHOP_CATEGORIES, getShopCatalog } from '../../src/services/shopService.js';
import { resolveAvatarBorderTier, renderFramePreviewBuffer } from '../../src/canvas/drawUtils.js';
import { evaluateSetBonus, DOMAIN_TO_PET_ELEMENTS } from '../../src/services/battleEngine/setBonusEngine.js';
import { simulateTeamBattle } from '../../src/services/battleEngine/teamBattleService.js';
import { simulateBattle } from '../../src/services/battleEngine/battleService.js';
import {
  MYTHIC_PITY_THRESHOLD,
  PITY_UNIQUE_CHANCE,
  PITY_ENABLED_POOLS,
  advanceMythicPityStep,
} from '../../src/services/economyService.js';
import {
  recordDailyActivityStat,
  resetMemoryDailyActivityStats,
  getVnDateKey,
} from '../../src/services/expService.js';
import {
  VALID_LEADERBOARD_TYPES,
  DAILY_ACTIVITY_REWARDS,
  getServerLeaderboard,
  settleDailyActivityLeaderboard,
  resetMemoryDailySettledKeys,
} from '../../src/services/leaderboardService.js';
import { LEVEL_ROLE_NERF_SPECS } from '../../scripts/apply_v1_5_nerf_level_roles.mjs';
import { buildV15BotGhostSpecs } from '../../scripts/deploy_v1_5_botghost.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PDF_PATH = path.resolve(BACKEND_ROOT, '..', 'handoff_docs', 'SUMI_V1_5_EMOJI_AND_FRAMES_PROMPTS.pdf');

describe('Tier 1 - SuMi Family Ver 1.5 Update Suite (Phase 1)', () => {
  it('1. Fix #1: Team battle integrates full haxEngine (shield, reflect, immortality) & preserves Boss initialMaxHp', () => {
    const fuyumiUnit = {
      id: FUYUMI_USER_ID,
      name: 'Fuyumi',
      userLevel: 100,
      atk: 226087,
      def: 226043,
      spd: 225830,
      maxHp: 1237215,
      critRate: 0.45,
      pet: {
        pet_type: 'cuu_vi_hong_ho',
        pet_name: 'Cửu Vĩ Hồng Hồ',
        element: 'Hỗn Độn',
        rarity: 'Tối Thượng',
        rarity_key: 'supreme',
        level: 100,
        star: 10,
      },
      equipment: {
        weapon: { item_id: 'weapon_mythic_1', item_name: '« Tru Tiên Diệt Thần Kiếm »', hax_skill: 'Tru Tiên' },
        gem: { item_id: 'gem_mythic_3', item_name: '« Thiên Hồ Hóa Thần Ngọc »', hax_skill: 'Thiên Hồ Hóa Thần' },
        soul: { item_id: 'soul_mythic_5', item_name: '« Bất Tử Phượng Hoàng Hồn »', hax_skill: 'Bất Tử' },
      },
      domainLoadout: {
        domain: DOMAIN_BY_ID.domain_fuyumi_cuu_vi_hong_mong || null,
        sense: null,
        realm: null,
      },
    };

    const bossUnit = {
      id: 'boss_vein_splus',
      name: '[BOSS S+] Hỗn Nguyên Địa Mạch Ma Tôn',
      isBoss: true,
      atk: 72000,
      def: 65000,
      spd: 54000,
      maxHp: 2600000,
      critRate: 22,
      pet: { pet_type: 'vein_splus', pet_name: 'Hỗn Nguyên Ma Tôn', element: 'Ám', level: 100, star: 10 },
      equipment: {},
      domainLoadout: { domain: DOMAIN_BY_ID.domain_mythic_5 || null, sense: null, realm: null },
    };

    const res = simulateTeamBattle([fuyumiUnit], [bossUnit], { maxTurns: 6, rng: () => 0.35 });
    assert.equal(res.teamB[0].maxHp, 2600000, 'Boss initialMaxHp must be preserved on top card');
    assert.ok(res.turnSnapshots[0].hpBars[0].shield > 0, 'Fuyumi opening shield from gem_mythic_3 must activate');
    assert.ok(res.untruncatedLogLines.some((l) => l.includes('Khai Trận HAX')), 'Opening HAX log line present');
    for (const snap of res.turnSnapshots) {
      for (const bar of snap.hpBars) {
        assert.ok(bar.hp <= bar.maxHp, `Turn ${snap.turn} HP (${bar.hp}) must never exceed maxHp (${bar.maxHp})`);
      }
    }
  });

  it('2. Feature #2: Set Bonus Engine (Full Hệ 4/4 +8%, 5/5 +12%; Mythic Set 2/3/4/5 + Def Pierce + Starting Linh Mạch, non-stacking)', () => {
    assert.deepEqual(DOMAIN_TO_PET_ELEMENTS['Kiếm Vực'], ['Kim', 'Lôi']);

    const fullElem4 = evaluateSetBonus({
      pet: { element: 'Hỏa', rarity_key: 'common' },
      equipment: {
        weapon: { element: 'Hỏa', rarity_key: 'common' },
        gem: { element: 'Hỏa', rarity_key: 'rare' },
        soul: { element: 'Hỏa', rarity_key: 'epic' },
      },
      domainLoadout: { domain: { element: 'Kiếm Vực', rarity_key: 'common' } },
    });
    assert.equal(fullElem4.statBonusPct, 8);
    assert.equal(fullElem4.tier, 'element_4');

    const fullElem5 = evaluateSetBonus({
      pet: { element: 'Kim', rarity_key: 'rare' },
      equipment: {
        weapon: { element: 'Kim', rarity_key: 'rare' },
        gem: { element: 'Kim', rarity_key: 'common' },
        soul: { element: 'Kim', rarity_key: 'epic' },
      },
      domainLoadout: { domain: { element: 'Kiếm Vực', rarity_key: 'rare' } },
    });
    assert.equal(fullElem5.statBonusPct, 12);
    assert.equal(fullElem5.tier, 'element_5');

    const mythic5 = evaluateSetBonus({
      pet: { element: 'Ám', rarity_key: 'mythic' },
      equipment: {
        weapon: { element: 'Ám', rarity_key: 'mythic' },
        gem: { element: 'Ám', rarity_key: 'mythic' },
        soul: { element: 'Ám', rarity_key: 'mythic' },
      },
      domainLoadout: { domain: { element: 'Minh Vực', rarity_key: 'mythic' } },
    });
    assert.equal(mythic5.statBonusPct, 25);
    assert.equal(mythic5.defPiercePct, 10);
    assert.equal(mythic5.bonusStartingLinhMach, 1);
    assert.equal(mythic5.tier, 'mythic_5');
  });

  it('3. Fix #4 & #5: 20 Avatar Frames, Shop frames & emoji-only backgrounds, Fuyumi can equip any frame, PNG preview', async () => {
    const paidFrames = AVATAR_FRAMES.filter((f) => f.price > 0);
    assert.equal(paidFrames.length, 20);
    assert.ok(AVATAR_FRAME_BY_ID.frame_royal_legacy);
    assert.ok(!SHOP_CONSUMABLES.some((c) => c.item_id === 'frame_unlock_token'));
    assert.ok(SHOP_CATEGORIES.includes('frames'));

    const bgCat = await getShopCatalog('backgrounds');
    assert.equal(bgCat.success, true);
    assert.ok(!bgCat.summary_text.includes('(Phàm Phẩm)'));
    assert.ok(!bgCat.summary_text.includes('(Thần Thoại)'));

    const frameCat = await getShopCatalog('frames');
    assert.equal(frameCat.success, true);
    assert.equal(frameCat.items.length, 20);

    // Fuyumi uses 'owner' on default, and chosen frame when equipped
    assert.equal(resolveAvatarBorderTier({ isOwner: true, level: 100, avatarFrame: 'default' }), 'owner');
    assert.equal(resolveAvatarBorderTier({ isOwner: true, level: 100, avatarFrame: 'frame_kitsune_mythic' }), 'frame_kitsune_mythic');

    const png = await renderFramePreviewBuffer('frame_royal_legacy');
    assert.ok(Buffer.isBuffer(png) && png.length > 500);
  });

  it('4. Feature #1: Mythic Pity 350 separate per pet/equipment/domain (not role), 98% normal / 2% unique, resets on natural Mythic', () => {
    assert.equal(MYTHIC_PITY_THRESHOLD, 350);
    assert.equal(PITY_UNIQUE_CHANCE, 0.02);
    assert.deepEqual(PITY_ENABLED_POOLS, ['pet', 'equipment', 'domain']);

    let state = { pet: 348, equipment: 10, domain: 0 };
    const step349 = advanceMythicPityStep(state, 'pet', 'common', () => 0.5);
    assert.equal(step349.pityTriggered, false);
    assert.equal(step349.nextPity.pet, 349);
    assert.equal(step349.nextPity.equipment, 10);

    // 350th roll triggers Mythic (0.5 >= 0.02 => Non-Unique)
    const step350Normal = advanceMythicPityStep(step349.nextPity, 'pet', 'common', () => 0.5);
    assert.equal(step350Normal.pityTriggered, true);
    assert.equal(step350Normal.rarityKey, 'mythic');
    assert.equal(step350Normal.wantUnique, false);
    assert.equal(step350Normal.nextPity.pet, 0);

    // 350th roll with rng < 0.02 => Unique Mythic
    const step350Unique = advanceMythicPityStep(step349.nextPity, 'pet', 'common', () => 0.01);
    assert.equal(step350Unique.pityTriggered, true);
    assert.equal(step350Unique.wantUnique, true);

    // Natural Mythic resets counter early
    const natMythic = advanceMythicPityStep({ pet: 120, equipment: 50, domain: 0 }, 'equipment', 'mythic', () => 0.5);
    assert.equal(natMythic.pityTriggered, false);
    assert.equal(natMythic.nextPity.equipment, 0);

    // Role pool does not increment pity
    const roleStep = advanceMythicPityStep({ pet: 10, equipment: 10, domain: 10 }, 'role', 'common', () => 0.5);
    assert.equal(roleStep.nextPity.pet, 10);
  });

  it('5. Feature #3: Daily Top Chat & Voice EXP tracking, hiding Fuyumi, and idempotent 500/400/300 LT settlement', async () => {
    resetMemoryDailyActivityStats();
    resetMemoryDailySettledKeys();
    assert.ok(VALID_LEADERBOARD_TYPES.includes('chat'));
    assert.ok(VALID_LEADERBOARD_TYPES.includes('voice'));
    assert.deepEqual(DAILY_ACTIVITY_REWARDS, [500, 400, 300]);

    const day = new Date('2099-12-31T12:00:00+07:00');
    const dateKey = getVnDateKey(day);
    const u1 = '999999999999999981';
    const u2 = '999999999999999982';

    const cleanupDaily = async () => {
      if (!supabase) return;
      await supabase.from('daily_activity_stats').delete().eq('date_key', dateKey);
      await supabase.from('daily_activity_settlements').delete().eq('date_key', dateKey);
      await supabase.from('users').delete().in('user_id', [u1, u2]);
    };

    await cleanupDaily();
    try {
      if (supabase) {
        await supabase.from('users').insert([
          { user_id: u1, username: 'Alpha', linh_thach: 0 },
          { user_id: u2, username: 'Beta', linh_thach: 0 },
        ]);
      }

      await recordDailyActivityStat(FUYUMI_USER_ID, { username: 'Fuyumi', chatExp: 99999, chatCount: 500, voiceExp: 99999, voiceMinutes: 500, now: day });
      await recordDailyActivityStat(u1, { username: 'Alpha', chatExp: 400, chatCount: 12, voiceExp: 200, voiceMinutes: 10, now: day });
      await recordDailyActivityStat(u2, { username: 'Beta', chatExp: 300, chatCount: 9, voiceExp: 500, voiceMinutes: 25, now: day });

      const chatLb = await getServerLeaderboard('chat', 10, { now: day, dateKey });
      assert.equal(chatLb.entries.length, 2);
      assert.equal(chatLb.entries[0].username, 'Alpha');
      assert.ok(!chatLb.entries.some((e) => e.user_id === FUYUMI_USER_ID));

      const settleDay = new Date('2100-01-01T00:05:00+07:00');
      const settled1 = await settleDailyActivityLeaderboard(settleDay, { targetDateKey: dateKey });
      assert.equal(settled1.settled, true);
      assert.equal(settled1.should_announce, true);
      assert.equal(settled1.winners.chat[0].linh_thach, 500);
      assert.equal(settled1.winners.chat[1].linh_thach, 400);
      assert.equal(settled1.winners.voice[0].username, 'Beta');
      assert.equal(settled1.winners.voice[0].linh_thach, 500);

      // Idempotent second call does not double-settle
      const settled2 = await settleDailyActivityLeaderboard(settleDay, { targetDateKey: dateKey });
      assert.equal(settled2.settled, false);
      assert.equal(settled2.already_settled, true);
    } finally {
      await cleanupDaily();
    }
  });

  it('6. Fix #10: Tower preRenderMode final_only skips intermediate frames', async () => {
    const res = await simulateBattle('757091869183311872', {
      id: 'tower_f10',
      name: 'Tháp Tầng 10',
      atk: 500,
      def: 400,
      spd: 300,
      maxHp: 5000,
      pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Thạch Thú', element: 'Thổ', level: 10, star: 2 },
      equipment: {},
    }, { mode: 'tower', preRenderMode: 'final_only', maxTurns: 10, seed: 42 });
    assert.equal(res.success, true);
    assert.ok(res.framesMeta.length >= 2);
  });

  it('7. Fix #3, #9 & Phase 2 Live: 63 Assets (43 Emojis + 20 Frames), 0 Windows Unicode, LATEST_VERSION === 1.5, no nerf in /updates', () => {
    assert.equal(LATEST_VERSION, '1.5');
    assert.equal(WIKI_METADATA.version, '1.5');
    assert.ok(String(WIKI_CATEGORIES.battle.image_url).includes('elements.webp'));

    assert.equal(V15_NEW_EMOJI_PROMPTS.length, 43);
    assert.equal(V15_AVATAR_FRAME_SPECS.length, 20);
    assert.ok(fs.existsSync(PDF_PATH), 'SUMI_V1_5_EMOJI_AND_FRAMES_PROMPTS.pdf must exist');

    const emojiMap = JSON.parse(fs.readFileSync(path.resolve('src/config/custom_emojis.json'), 'utf8'));
    for (const ep of V15_NEW_EMOJI_PROMPTS) {
      assert.ok(emojiMap[ep.uid]?.id, `Missing custom_emojis.json entry for ${ep.uid}`);
    }
    for (const fp of V15_AVATAR_FRAME_SPECS) {
      assert.ok(fs.existsSync(path.resolve('assets/frames', `${fp.frame_id}.png`)), `Missing frame PNG assets/frames/${fp.frame_id}.png`);
    }

    assert.equal(V15_DRAFT_CHANGELOG.version, '1.5');
    assert.equal(V15_DRAFT_CHANGELOG.ack_reward_lt, 2000);
    const draftJson = JSON.stringify(V15_DRAFT_CHANGELOG).toLowerCase();
    assert.ok(!draftJson.includes('nerf') && !draftJson.includes('thu hồi quyền') && !draftJson.includes('role cấp'));

    assert.equal(LEVEL_ROLE_NERF_SPECS.length, 8);
    assert.ok(!/[\p{Extended_Pictographic}]/u.test(draftJson), 'V15_DRAFT_CHANGELOG must have 0 Unicode pictographs');
  });
});
