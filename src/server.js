import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfileData, sanitizeUserId, isUnresolvedBotGhostVar } from './services/profileService.js';
import {
  getWikiData,
  getWikiCatalogSummary,
  getWikiItemDetail,
  getWikiPetDetail,
} from './services/wikiService.js';
import {
  simulateBattle,
  getCachedBattleReport,
  getCachedBattleFrame,
  setCachedBattleFrame,
  getBattleFrameMeta,
  getBattleLogPayload,
  renderBattleLogHtml,
  renderBattleCardQueued,
} from './services/battleService.js';
import { grantChatExp, handleVoiceExp, processVoiceHeartbeat } from './services/expService.js';
import {
  claimDaily,
  convertExpToLinhThach,
  rollGacha,
  sendGift,
  cleanupExpiredRoles,
} from './services/economyService.js';
import { getServerLeaderboard } from './services/leaderboardService.js';
import {
  getQuestStatus,
  claimDailyQuests,
  claimWeeklyQuests,
  challengeTower,
  resetTowerAttempts,
} from './services/questService.js';
import {
  getInventory,
  getUserEquipment,
  getUserRoles,
  equipTarget,
  unequipTarget,
  dismantleTarget,
  setActivePet,
  upgradePet,
  enchantTarget,
} from './services/inventoryService.js';
import { getJobStatus, doJob } from './services/jobService.js';
import { checkUpdateGate, acknowledgeUpdate } from './services/updateGateService.js';
import { lookupInfo } from './services/infoService.js';
import { getChangelogPayload, LATEST_VERSION } from './data/changelogs.js';
import { PET_BY_TYPE } from './data/catalog.js';
import {
  getStaticElementChartBuffer,
  getStaticPetCardBuffer,
  getStaticNonUniqueItemCardBuffer,
  getCachedUniqueItemCard,
  warmStaticAssetsInBackground,
  getPrerenderStatus,
  computeDynamicDataHash,
  getOrRenderDynamicCard,
} from './services/staticAssetCacheService.js';
import {
  getShopCatalog,
  previewShopItem,
  buyShopItem,
} from './services/shopService.js';
import {
  getMarriageStatus,
  proposeMarriage,
  respondMarriage,
  upgradeMarriageRing,
  divorceMarriage,
} from './services/marryService.js';
import {
  getClanInfo,
  getClanLeaderboard,
  createClan,
  requestJoinClan,
  listJoinRequests,
  respondJoinRequest,
  leaveClan,
  kickClanMember,
  donateToClan,
  upgradeClan,
  declareClanWar,
  respondClanWar,
  getClanWarStatus,
} from './services/clanService.js';
import {
  getDomainInventory,
  equipDomainEntity,
  unequipDomainEntity,
  dismantleDomainEntity,
} from './services/domainService.js';
import {
  playCoinflip,
  playSlots,
  startBlackjack,
  blackjackAction,
  crashGame,
} from './services/minigameService.js';
import {
  getFarmStatus,
  plantFarmPlot,
  careAllPlots,
  harvestAllPlots,
  clearWiltedPlots,
  getExchangeCatalog,
  buyExchangeItem,
} from './services/farmService.js';
import { renderProfileCard } from './canvas/profileRenderer.js';
import { renderRankCard } from './canvas/rankRenderer.js';
import { renderBattleCard } from './canvas/battleRenderer.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(PROJECT_ROOT, 'assets')));

function getCleanParam(val, fallback) {
  if (val && typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed && !isUnresolvedBotGhostVar(trimmed)) return trimmed;
  }
  if (fallback && typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed && !isUnresolvedBotGhostVar(trimmed)) return trimmed;
  }
  return null;
}

/**
 * Middleware xác thực x-api-key cho các endpoint ghi dữ liệu (/api/exp/*) khi BACKEND_API_KEY được cấu hình
 */
function requireBackendApiKey(req, res, next) {
  const configuredKey = process.env.BACKEND_API_KEY;
  if (!configuredKey) return next();

  const provided = String(req.headers['x-api-key'] || req.query.api_key || '');
  const a = Buffer.from(configuredKey, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Thiếu hoặc sai khóa xác thực x-api-key.',
    });
  }
  return next();
}

function extractGateUserId(req) {
  const body = req.body || {};
  const candidates = [
    req.params?.userId,
    body.userId,
    body.attackerId,
    body.attacker_id,
    body.attacker,
    body.proposerId,
    body.responderId,
    body.leaderId,
    body.senderId,
    req.query?.userId,
    req.query?.user_id,
  ];
  for (const c of candidates) {
    const str = typeof c === 'string'
      ? c
      : (c && typeof c === 'object' ? (c.user_id || c.userId || '') : '');
    const clean = sanitizeUserId(str);
    if (clean) return clean;
  }
  return '';
}

/**
 * Cổng xác nhận cập nhật v1.2 lần đầu cho 18 lệnh gameplay (không chặn EXP, /wiki, /info, /updates, /profile, /rank, /top).
 */
async function requireUpdateAck(req, res, next) {
  try {
    const uid = extractGateUserId(req);
    if (!uid) return next();
    const gate = await checkUpdateGate(uid);
    if (gate.blocked) {
      return res.status(200).json(gate.payload);
    }
    return next();
  } catch (err) {
    console.warn('[UpdateGate] Check warning:', err.message);
    return next();
  }
}

/**
 * Root directory info endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: '🦊 SuMi Family Profile & Canvas Backend',
    bot: 'Nhiễm Nhiễm (916469360401453067)',
    owner: 'Fuyumi (757091869183311872)',
    version: `2.5.0-v${LATEST_VERSION}`,
    resolution: {
      profile: '2000x1000',
      rank: '2000x410',
      battle: '2000x1000 (.png) / 1400x700 final & 800x400 mid (.webp)',
      wiki: '2000x1000',
    },
    endpoints: {
      health: 'GET /health',
      update: 'GET /api/update[/:version]',
      update_ack: 'POST /api/update/ack',
      info: 'GET /api/info/:query',
      info_pet: 'GET /api/info/pet/:petType[.webp|.png|.json]',
      wiki: 'GET /api/wiki[?category=overview|realms|battle|equipment|pets|economy]',
      wiki_catalog: 'GET /api/wiki/catalog',
      wiki_chart_elements: 'GET /api/wiki/chart/elements[.png|.webp]',
      wiki_item: 'GET /api/wiki/item/:itemId[.png|.webp]',
      wiki_pet: 'GET /api/wiki/pet/:petType[.png|.webp]',
      battle_simulate: 'POST /api/battle/simulate',
      battle_report_frame: 'GET /api/battle/report/:battleId/:frame[.webp|.png]',
      battle_logs: 'POST /api/battle/logs',
      battle_report_png: 'GET /api/battle/report/:battleId[.png|.webp]',
      battle_report_stateless_png: 'GET /api/battle/report.png?attacker=...&defender=...',
      battle_render_custom: 'POST /api/battle/render',
      exp_chat: 'POST /api/exp/chat',
      exp_voice: 'POST /api/exp/voice',
      exp_voice_heartbeat: 'POST /api/exp/voice-heartbeat',
      economy_daily: 'POST /api/economy/daily',
      economy_doiqua: 'POST /api/economy/doiqua',
      economy_roll: 'POST /api/economy/roll',
      economy_gift: 'POST /api/economy/gift',
      roles_cleanup_expired: 'POST /api/roles/cleanup-expired',
      leaderboard: 'GET /api/leaderboard[?type=level|power|wealth|marry&limit=10]',
      quest_status: 'GET /api/quest/status/:userId',
      quest_claim: 'POST /api/quest/claim',
      quest_claim_weekly: 'POST /api/quest/claim-weekly',
      quest_tower: 'POST /api/quest/tower',
      quest_tower_reset: 'POST /api/quest/tower/reset',
      job_status: 'GET /api/job/status/:userId',
      job_work: 'POST /api/job/work',
      inventory: 'GET /api/inv/:userId[?view=overview|items|pets|roles|resources]',
      equipment_list: 'GET /api/equipment/:userId[?sort=rarity_desc|rarity_asc|equipped&slot=all|weapon|gem|soul|equipped]',
      roles_list: 'GET /api/roles/:userId[?filter=all|equipped|permanent|timed&sort=rarity_desc|duration_desc]',
      equip: 'POST /api/equip',
      unequip: 'POST /api/unequip',
      dismantle: 'POST /api/dismantle',
      enchant: 'POST /api/enchant',
      pet_list: 'GET /api/pet/:userId[?sort=power_desc|rarity_desc|rarity_asc|level_desc|star_desc]',
      pet_active: 'POST /api/pet/active',
      pet_upgrade: 'POST /api/pet/upgrade',
      shop_catalog: 'GET /api/shop/catalog[?category=...&page=1]',
      shop_preview: 'POST /api/shop/preview',
      shop_buy: 'POST /api/shop/buy',
      domain_inventory: 'GET /api/domain/inventory/:userId[?view=overview|domain|sense|realm]',
      domain_equip: 'POST /api/domain/equip',
      domain_unequip: 'POST /api/domain/unequip',
      domain_dismantle: 'POST /api/domain/dismantle',
      minigame_coinflip: 'POST /api/minigame/coinflip',
      minigame_slots: 'POST /api/minigame/slots',
      minigame_blackjack: 'POST /api/minigame/blackjack',
      minigame_crash: 'POST /api/minigame/crash',
      farm_status: 'GET /api/farm/status/:userId',
      farm_plant: 'POST /api/farm/plant',
      farm_care: 'POST /api/farm/care',
      farm_harvest: 'POST /api/farm/harvest',
      farm_clear: 'POST /api/farm/clear',
      exchange_catalog: 'GET /api/exchange/catalog[?userId=...]',
      exchange_buy: 'POST /api/exchange/buy',
      marry_status: 'GET /api/marry/status/:userId',
      marry_propose: 'POST /api/marry/propose',
      marry_respond: 'POST /api/marry/respond',
      marry_upgrade_ring: 'POST /api/marry/upgrade-ring',
      marry_divorce: 'POST /api/marry/divorce',
      clan_leaderboard: 'GET /api/clan/leaderboard',
      clan_info: 'GET /api/clan/info/:userId',
      clan_create: 'POST /api/clan/create',
      clan_join: 'POST /api/clan/join',
      clan_requests: 'GET /api/clan/requests/:userId',
      clan_approve: 'POST /api/clan/approve',
      clan_leave: 'POST /api/clan/leave',
      clan_kick: 'POST /api/clan/kick',
      clan_donate: 'POST /api/clan/donate',
      clan_upgrade: 'POST /api/clan/upgrade',
      clan_war_declare: 'POST /api/clan/war/declare',
      clan_war_respond: 'POST /api/clan/war/respond',
      clan_war_status: 'GET /api/clan/war/status/:userId',
      profile_png: 'GET /api/profile/:userId[.png|.webp]',
      profile_json: 'GET /api/profile/:userId?format=json',
      profile_render_custom: 'POST /api/profile/render',
      rank_png: 'GET /api/rank/:userId[.png|.webp]',
      rank_json: 'GET /api/rank/:userId?format=json',
      rank_render_custom: 'POST /api/rank/render',
    },
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sumi-profile-backend',
    version: '1.0.0',
    update_version: LATEST_VERSION,
    prerender: getPrerenderStatus(),
    uptime: process.uptime(),
    supabase_connected: !!supabase,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TRỤ CỘT 1: HỆ THỐNG /WIKI, /INFO & /UPDATES
// ============================================================================

app.get(['/api/update', '/api/update/:version'], (req, res) => {
  const ver = getCleanParam(req.params.version || req.query.version, '');
  const result = getChangelogPayload(ver || LATEST_VERSION);
  return res.status(result.status || 200).json(result);
});

app.post('/api/update/ack', requireBackendApiKey, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await acknowledgeUpdate(body.userId || body.user_id || '');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/update/ack error:', err);
    return res.status(500).json({ success: false, error: 'UPDATE_ACK_FAILED', message: err.message });
  }
});

app.get('/api/info/pet/:petType', async (req, res) => {
  try {
    const rawParam = String(req.params.petType || '').trim();
    const lower = rawParam.toLowerCase();
    const wantJson = lower.endsWith('.json') || req.query.format === 'json';
    const wantPng = lower.endsWith('.png') || req.query.format === 'png';
    const cleanType = lower.replace(/\.(png|webp|json)$/i, '');

    if (!Object.prototype.hasOwnProperty.call(PET_BY_TYPE, cleanType)) {
      return res.status(404).json({
        success: false,
        error: 'Pet not found',
        message: `Linh Thú '${rawParam}' không tồn tại.`,
      });
    }

    const pet = PET_BY_TYPE[cleanType];
    if (wantJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).json({ success: true, data: pet });
    }

    const fmt = wantPng ? 'png' : 'webp';
    const imgBuffer = await getStaticPetCardBuffer(pet, fmt);
    res.setHeader('Content-Type', fmt === 'png' ? 'image/png' : 'image/webp');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(imgBuffer);
  } catch (err) {
    console.error('[Server] Lỗi tra cứu /api/info/pet:', err);
    return res.status(500).json({ success: false, error: 'INFO_PET_FAILED', message: err.message });
  }
});

app.get('/api/info/:query', (req, res) => {
  try {
    const q = getCleanParam(req.params.query, '');
    const requesterId = sanitizeUserId(req.query.requesterId || req.query.userId || '');
    const result = lookupInfo(q || '', { requesterId });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/info error:', err);
    return res.status(500).json({ success: false, error: 'INFO_FAILED', message: err.message });
  }
});

app.get('/api/wiki', (req, res) => {
  try {
    const rawCategory = req.query.category || req.query.cat || null;
    const wikiResult = getWikiData(rawCategory);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (!wikiResult.success) {
      return res.status(404).json(wikiResult);
    }

    return res.status(200).json(wikiResult);
  } catch (err) {
    console.error('[Server] Lỗi khi xử lý yêu cầu Wiki:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Đã xảy ra lỗi nội bộ khi truy vấn cẩm nang tu tiên.',
      details: err.message,
    });
  }
});

app.get('/api/wiki/catalog', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(getWikiCatalogSummary());
});

app.get(['/api/wiki/chart/elements.png', '/api/wiki/chart/elements.webp', '/api/wiki/chart/elements'], async (req, res) => {
  try {
    const isWebp = req.path.toLowerCase().endsWith('.webp') || req.query.format === 'webp';
    const imgBuffer = await getStaticElementChartBuffer(isWebp ? 'webp' : 'png');
    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(imgBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất sơ đồ Ngũ Hành:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất sơ đồ Ngũ Hành', message: err.message });
  }
});

app.get('/api/wiki/item/:itemId', async (req, res) => {
  try {
    const rawParam = String(req.params.itemId || '');
    const wantWebp = rawParam.toLowerCase().endsWith('.webp') || req.query.format === 'webp';
    const wantPng = rawParam.toLowerCase().endsWith('.png') || req.query.format === 'png';
    const wantImg = wantWebp || wantPng;
    const detail = await getWikiItemDetail(rawParam);

    if (!detail.success) {
      return res.status(404).json(detail);
    }

    if (wantImg) {
      const fmt = wantWebp ? 'webp' : 'png';
      const imgBuffer = detail.data?.is_unique
        ? await getCachedUniqueItemCard(detail.data, fmt)
        : await getStaticNonUniqueItemCardBuffer(detail.data, fmt);
      res.setHeader('Content-Type', wantWebp ? 'image/webp' : 'image/png');
      res.setHeader('Content-Length', imgBuffer.length);
      res.setHeader('Cache-Control', detail.data?.is_unique ? 'public, max-age=30' : 'public, max-age=3600');
      return res.end(imgBuffer);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json(detail);
  } catch (err) {
    console.error('[Server] Lỗi tra cứu Wiki Trang Bị:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

app.get('/api/wiki/pet/:petType', async (req, res) => {
  try {
    const rawParam = String(req.params.petType || '');
    const wantWebp = rawParam.toLowerCase().endsWith('.webp') || req.query.format === 'webp';
    const wantPng = rawParam.toLowerCase().endsWith('.png') || req.query.format === 'png';
    const wantImg = wantWebp || wantPng;
    const detail = await getWikiPetDetail(rawParam);

    if (!detail.success) {
      return res.status(404).json(detail);
    }

    if (wantImg) {
      const fmt = wantWebp ? 'webp' : 'png';
      const imgBuffer = await getStaticPetCardBuffer(detail.data, fmt);
      res.setHeader('Content-Type', wantWebp ? 'image/webp' : 'image/png');
      res.setHeader('Content-Length', imgBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(imgBuffer);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(detail);
  } catch (err) {
    console.error('[Server] Lỗi tra cứu Wiki Linh Thú:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

// ============================================================================
// TRỤ CỘT 2: CỘNG EXP CHAT & VOICE THỰC TẾ VÀO SUPABASE
// ============================================================================

app.post('/api/exp/chat', requireBackendApiKey, async (req, res) => {
  try {
    const result = await grantChatExp(req.body || {});
    const status = result.status || (result.success ? 200 : 400);
    return res.status(status).json(result);
  } catch (err) {
    console.error('[Server] Lỗi xử lý /api/exp/chat:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

app.post('/api/exp/voice', requireBackendApiKey, async (req, res) => {
  try {
    const result = await handleVoiceExp(req.body || {});
    const status = result.status || (result.success ? 200 : 400);
    return res.status(status).json(result);
  } catch (err) {
    console.error('[Server] Lỗi xử lý /api/exp/voice:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

app.post('/api/exp/voice-heartbeat', requireBackendApiKey, async (req, res) => {
  try {
    const result = await processVoiceHeartbeat();
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Server] Lỗi xử lý /api/exp/voice-heartbeat:', err);
    return res.status(500).json({ success: false, error: 'VOICE_HEARTBEAT_FAILED', message: err.message });
  }
});

// ============================================================================
// TRỤ CỘT 3: ĐẤU TRƯỜNG /BATTLE 1V1 & PvE TỰ DO
// ============================================================================

app.post('/api/battle/simulate', requireUpdateAck, async (req, res) => {
  try {
    const { attackerId, defenderId, attacker, defender, options } = req.body || {};

    const actId = attackerId || req.body?.attacker_id || attacker;
    const defId = defenderId || req.body?.defender_id || defender;
    const reqMode = getCleanParam(req.body?.mode, '')?.toLowerCase() || '';
    const isFreePve = reqMode === 'pve_free' || String(defId || '').trim().toLowerCase() === 'pve_free';

    if (!actId || (!defId && !isFreePve)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Thiếu thông tin người tấn công (attackerId) hoặc người phòng thủ (defenderId).',
      });
    }

    const cleanAttackerId = typeof actId === 'string' ? sanitizeUserId(actId) : actId;
    const cleanDefenderId = isFreePve
      ? 'pve_free'
      : (typeof defId === 'string' ? sanitizeUserId(defId) : defId);
    const channelId = getCleanParam(req.body?.channelId || req.body?.channel_id, null);
    const resolvedMode = isFreePve ? 'pve_free' : (reqMode || 'pvp');
    const applyRewards = req.body?.applyRewards !== undefined
      ? Boolean(req.body.applyRewards)
      : (isFreePve || reqMode === 'pvp');
    const rawEnforce = req.body?.enforceCooldown ?? options?.enforceCooldown;

    const mergedOptions = {
      ...(options && typeof options === 'object' ? options : {}),
      ...(channelId ? { channelId } : {}),
      mode: resolvedMode,
      applyRewards,
      enforceCooldown: rawEnforce !== undefined ? Boolean(rawEnforce) : true,
    };

    const battleResult = await simulateBattle(cleanAttackerId, cleanDefenderId, mergedOptions);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(battleResult.status || 200).json(battleResult);
  } catch (err) {
    console.error('[Server] Lỗi khi xử lý mô phỏng chiến đấu:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Đã xảy ra lỗi nội bộ trong quá trình mô phỏng trận chiến.',
      details: err.message,
    });
  }
});

app.get(['/api/battle/report.png', '/api/battle/report.webp'], async (req, res) => {
  try {
    const actId = sanitizeUserId(req.query.attacker || req.query.attackerId || '');
    const defId = sanitizeUserId(req.query.defender || req.query.defenderId || '');
    if (!actId || !defId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cần truyền query attacker và defender để xuất ảnh chiến báo.',
      });
    }
    const maxTurns = Number(req.query.maxTurns) || 20;
    const seed = req.query.seed !== undefined ? Number(req.query.seed) : undefined;
    const isWebp = req.path.toLowerCase().endsWith('.webp') || req.query.format === 'webp';
    const battleResult = await simulateBattle(actId, defId, { maxTurns, ...(Number.isFinite(seed) ? { seed } : {}), preRender: false });
    const imgBuffer = await renderBattleCard(battleResult, { format: isWebp ? 'webp' : 'png' });
    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(imgBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất ảnh chiến báo stateless:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất ảnh chiến báo', message: err.message });
  }
});

app.post('/api/battle/logs', async (req, res) => {
  try {
    const battleId = getCleanParam(req.body?.battleId || req.body?.battle_id, null);
    const channelId = getCleanParam(req.body?.channelId || req.body?.channel_id, null);
    const rawUser = getCleanParam(req.body?.userId || req.body?.user_id, null);
    const userId = rawUser ? sanitizeUserId(rawUser) : null;
    const payload = getBattleLogPayload({ battleId, channelId, userId });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[Server] Lỗi tra cứu nhật ký trận đấu:', err);
    return res.status(500).json({ success: false, error: 'Lỗi tra cứu nhật ký trận đấu', message: err.message });
  }
});

app.get('/api/battle/logs', async (req, res) => {
  try {
    const battleId = getCleanParam(req.query.battleId || req.query.battle_id, null);
    const channelId = getCleanParam(req.query.channelId || req.query.channel_id, null);
    const rawUser = getCleanParam(req.query.userId || req.query.user_id, null);
    const userId = rawUser ? sanitizeUserId(rawUser) : null;
    if (String(req.query.format || '').toLowerCase() === 'html' && battleId) {
      const rendered = renderBattleLogHtml(battleId);
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(rendered.html);
    }
    const payload = getBattleLogPayload({ battleId, channelId, userId });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[Server] Lỗi tra cứu nhật ký trận đấu:', err);
    return res.status(500).json({ success: false, error: 'Lỗi tra cứu nhật ký trận đấu', message: err.message });
  }
});

app.get(['/api/battle/logs/:battleId/view', '/api/battle/logs/:battleId', '/battle/logs/:battleId'], async (req, res) => {
  try {
    const battleId = String(req.params.battleId || '').trim();
    if (String(req.query.format || '').toLowerCase() === 'json') {
      const payload = getBattleLogPayload({ battleId });
      return res.status(200).json(payload);
    }
    const rendered = renderBattleLogHtml(battleId);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    return res.status(200).send(rendered.html);
  } catch (err) {
    console.error('[Server] Lỗi render HTML nhật ký trận đấu:', err);
    return res.status(500).send('Lỗi hiển thị nhật ký trận đấu.');
  }
});

app.get('/api/battle/report/:battleId/:frameSpec', async (req, res) => {
  try {
    const cleanId = String(req.params.battleId || '').trim();
    const rawSpec = String(req.params.frameSpec || '').trim().toLowerCase();
    const cached = getCachedBattleReport(cleanId);
    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'Battle report not found',
        message: `Không tìm thấy chiến báo '${cleanId}' hoặc chiến báo đã hết hạn.`,
      });
    }

    const isWebp = rawSpec.endsWith('.webp') || req.query.format === 'webp';
    const baseSpec = rawSpec.replace(/\.(png|webp)$/i, '');
    const frameIndex = baseSpec === 'final'
      ? (cached.framesMeta?.[cached.framesMeta.length - 1]?.index || 1)
      : (parseInt(baseSpec, 10) || 1);

    if (isWebp) {
      const ramBuf = getCachedBattleFrame(cleanId, frameIndex);
      if (ramBuf) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Content-Length', ramBuf.length);
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.end(ramBuf);
      }
    }

    const frameMeta = getBattleFrameMeta(cleanId, frameIndex);
    const scale = frameMeta ? frameMeta.scale : 2;
    const imgBuffer = await renderBattleCardQueued(`battle:${cleanId}:${frameIndex}:${isWebp ? 'webp' : 'png'}`, cached, {
      scale,
      format: isWebp ? 'webp' : 'png',
      webpQuality: scale <= 1 ? 80 : 84,
      frame: frameMeta,
    });
    if (isWebp) {
      setCachedBattleFrame(cleanId, frameIndex, imgBuffer);
    }

    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.end(imgBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất frame chiến báo:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất frame chiến báo', message: err.message });
  }
});

app.get('/api/battle/report/:battleId', async (req, res) => {
  try {
    const rawParam = String(req.params.battleId || '');
    const isWebp = rawParam.toLowerCase().endsWith('.webp') || req.query.format === 'webp';
    const cleanId = rawParam.replace(/\.(png|webp)$/i, '').trim();
    const cached = getCachedBattleReport(cleanId);
    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'Battle report not found',
        message: `Không tìm thấy chiến báo '${cleanId}' hoặc chiến báo đã hết hạn.`,
      });
    }

    if (isWebp && cached.framesMeta?.length) {
      const lastIdx = cached.framesMeta[cached.framesMeta.length - 1].index;
      const ramBuf = getCachedBattleFrame(cleanId, lastIdx);
      if (ramBuf) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Content-Length', ramBuf.length);
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.end(ramBuf);
      }
    }

    const imgBuffer = await renderBattleCardQueued(`battle:${cleanId}:default:${isWebp ? 'webp' : 'png'}`, cached, {
      format: isWebp ? 'webp' : 'png',
    });
    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.end(imgBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất ảnh chiến báo theo battleId:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất ảnh chiến báo', message: err.message });
  }
});

app.post('/api/battle/render', async (req, res) => {
  try {
    const pngBuffer = await renderBattleCard(req.body || {});
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    return res.end(pngBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất ảnh chiến báo tùy biến:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất ảnh chiến báo', message: err.message });
  }
});

// ============================================================================
// TRỤ CỘT 4: THẺ /PROFILE (2000x1000) & /RANK (2000x410) FULL HD+
// ============================================================================

app.get('/api/profile/:userId', async (req, res) => {
  const rawUserId = req.params.userId || req.query.user_id || req.query.userId || req.query.user || req.query.fallback_id || '';
  let cleanUserId = sanitizeUserId(rawUserId);
  const fallbackRaw = req.query.fallback_id || req.query.user_id || req.query.userId || req.query.user || req.query.target || '';
  const fallbackUserId = sanitizeUserId(fallbackRaw);
  if (!cleanUserId || cleanUserId.startsWith('{')) {
    if (fallbackUserId) {
      cleanUserId = fallbackUserId;
    }
  }
  const isFallbackUser = !fallbackUserId || !cleanUserId || cleanUserId === fallbackUserId;
  const { format } = req.query;

  try {
    const overrides = {
      username: getCleanParam(req.query.username || req.query.name, null),
      avatar_url: getCleanParam(req.query.avatar || req.query.avatar_url, null),
      fallback_name: getCleanParam(req.query.fallback_name, null),
      fallback_avatar: getCleanParam(req.query.fallback_avatar, null),
      is_fallback_user: isFallbackUser,
      custom_title: getCleanParam(req.query.title || req.query.custom_title, null),
      background_url: getCleanParam(req.query.bg || req.query.background_url, null),
    };

    const profileData = await getProfileData(cleanUserId, overrides);

    const isExplicitJson = rawUserId.toLowerCase().endsWith('.json') ||
                           format === 'json' ||
                           (format !== 'png' && format !== 'webp' && req.headers.accept?.includes('application/json'));

    if (isExplicitJson) {
      return res.json({
        success: true,
        data: profileData,
      });
    }

    const isWebp = rawUserId.toLowerCase().endsWith('.webp') || format === 'webp';
    const fmt = isWebp ? 'webp' : 'png';
    const cardHash = computeDynamicDataHash({ fmt, v: '1.2', ...profileData });
    const imgBuffer = await getOrRenderDynamicCard(
      `profile:${cleanUserId}:${fmt}`,
      cardHash,
      () => renderProfileCard(profileData, { format: fmt }),
    );

    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.end(imgBuffer);
  } catch (err) {
    console.error(`[Server] Error rendering profile for ${rawUserId}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi khi kết xuất ảnh hồ sơ',
      message: err.message,
    });
  }
});

app.get('/api/rank/:userId', async (req, res) => {
  const rawUserId = req.params.userId || req.query.user_id || req.query.userId || req.query.user || req.query.fallback_id || '';
  let cleanUserId = sanitizeUserId(rawUserId);
  const fallbackRaw = req.query.fallback_id || req.query.user_id || req.query.userId || req.query.user || req.query.target || '';
  const fallbackUserId = sanitizeUserId(fallbackRaw);
  if (!cleanUserId || cleanUserId.startsWith('{')) {
    if (fallbackUserId) {
      cleanUserId = fallbackUserId;
    }
  }
  const isFallbackUser = !fallbackUserId || !cleanUserId || cleanUserId === fallbackUserId;
  const { format } = req.query;

  try {
    const overrides = {
      username: getCleanParam(req.query.username || req.query.name, null),
      avatar_url: getCleanParam(req.query.avatar || req.query.avatar_url, null),
      fallback_name: getCleanParam(req.query.fallback_name, null),
      fallback_avatar: getCleanParam(req.query.fallback_avatar, null),
      is_fallback_user: isFallbackUser,
      custom_title: getCleanParam(req.query.title || req.query.custom_title, null),
      background_url: getCleanParam(req.query.bg || req.query.background_url, null),
    };

    const profileData = await getProfileData(cleanUserId, overrides);

    const isExplicitJson = rawUserId.toLowerCase().endsWith('.json') ||
                           format === 'json' ||
                           (format !== 'png' && format !== 'webp' && req.headers.accept?.includes('application/json'));

    if (isExplicitJson) {
      return res.json({
        success: true,
        data: {
          user_id: profileData.user_id,
          username: profileData.username,
          level: profileData.level,
          exp: profileData.exp,
          next_level_exp: profileData.next_level_exp,
          realm: profileData.realm,
          custom_title: profileData.custom_title,
          linh_thach: profileData.linh_thach,
          clan: profileData.clan,
          married: profileData.married,
        },
      });
    }

    const isWebp = rawUserId.toLowerCase().endsWith('.webp') || format === 'webp';
    const fmt = isWebp ? 'webp' : 'png';
    const cardHash = computeDynamicDataHash({
      fmt,
      v: '1.2',
      user_id: profileData.user_id,
      username: profileData.username,
      avatar_url: profileData.avatar_url,
      level: profileData.level,
      exp: profileData.exp,
      next_level_exp: profileData.next_level_exp,
      realm: profileData.realm,
      custom_title: profileData.custom_title,
      linh_thach: profileData.linh_thach,
      clan: profileData.clan,
      married: profileData.married,
      frame_id: profileData.frame_id,
      background_url: profileData.background_url,
    });
    const imgBuffer = await getOrRenderDynamicCard(
      `rank:${cleanUserId}:${fmt}`,
      cardHash,
      () => renderRankCard(profileData, { format: fmt }),
    );

    res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.end(imgBuffer);
  } catch (err) {
    console.error(`[Server] Error rendering rank for ${rawUserId}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi khi kết xuất ảnh Rank Mini',
      message: err.message,
    });
  }
});

app.post('/api/rank/render', async (req, res) => {
  try {
    const customData = req.body || {};
    const pngBuffer = await renderRankCard(customData);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    return res.end(pngBuffer);
  } catch (err) {
    console.error('[Server] Error rendering custom rank card:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi khi kết xuất ảnh Rank tùy biến',
      message: err.message,
    });
  }
});

app.post('/api/profile/render', async (req, res) => {
  try {
    const customData = req.body || {};
    const pngBuffer = await renderProfileCard(customData);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    return res.end(pngBuffer);
  } catch (err) {
    console.error('[Server] Error rendering custom profile:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi khi kết xuất ảnh tùy biến',
      message: err.message,
    });
  }
});

// ============================================================================
// PHASE 1: ECONOMY (/daily, /doiqua, /roll) & INVENTORY/LOADOUT (/inv, /equip, /unequip, /pet)
// ============================================================================
app.post('/api/economy/daily', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await claimDaily(body.userId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/economy/daily error:', err);
    return res.status(500).json({ success: false, error: 'DAILY_FAILED', message: err.message });
  }
});

app.post('/api/economy/doiqua', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await convertExpToLinhThach(body.userId, body.amountExp ?? body.amount, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/economy/doiqua error:', err);
    return res.status(500).json({ success: false, error: 'DOIQUA_FAILED', message: err.message });
  }
});

app.post('/api/economy/roll', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await rollGacha(body.userId, {
      pool: body.pool,
      count: body.count,
      useTicket: body.useTicket,
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/economy/roll error:', err);
    return res.status(500).json({ success: false, error: 'ROLL_FAILED', message: err.message });
  }
});

app.get('/api/inv/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getInventory(req.params.userId, {
      view: getCleanParam(req.query.view, 'overview') || 'overview',
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/inv error:', err);
    return res.status(500).json({ success: false, error: 'INV_FAILED', message: err.message });
  }
});

app.post('/api/equip', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await equipTarget(body.userId, {
      category: body.category,
      targetId: body.targetId,
      slot: body.slot,
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/equip error:', err);
    return res.status(500).json({ success: false, error: 'EQUIP_FAILED', message: err.message });
  }
});

app.post('/api/unequip', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await unequipTarget(body.userId, {
      category: body.category,
      targetId: body.targetId,
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/unequip error:', err);
    return res.status(500).json({ success: false, error: 'UNEQUIP_FAILED', message: err.message });
  }
});

app.post('/api/dismantle', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await dismantleTarget(body.userId, {
      category: body.category || body.loai,
      targetId: body.targetId || body.maId,
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/dismantle error:', err);
    return res.status(500).json({ success: false, error: 'DISMANTLE_FAILED', message: err.message });
  }
});

app.get('/api/equipment/:userId', requireUpdateAck, async (req, res) => {
  try {
    const filter = getCleanParam(req.query.filter, '');
    let sort = getCleanParam(req.query.sort, '') || 'rarity_desc';
    let slot = getCleanParam(req.query.slot, '') || 'all';
    if (['weapon', 'gem', 'soul', 'equipped', 'all'].includes(filter)) {
      slot = filter;
    } else if (['rarity_desc', 'rarity_asc', 'power_desc', 'slot', 'equipped'].includes(filter)) {
      sort = filter;
    }
    const result = await getUserEquipment(req.params.userId, {
      sort,
      slot,
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/equipment error:', err);
    return res.status(500).json({ success: false, error: 'EQUIPMENT_LIST_FAILED', message: err.message });
  }
});

app.get('/api/roles/:userId', requireUpdateAck, async (req, res) => {
  try {
    const filter = getCleanParam(req.query.filter, 'all') || 'all';
    const sort = getCleanParam(req.query.sort, 'rarity_desc') || 'rarity_desc';
    const result = await getUserRoles(req.params.userId, {
      filter,
      sort,
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/roles error:', err);
    return res.status(500).json({ success: false, error: 'ROLES_LIST_FAILED', message: err.message });
  }
});

app.get('/api/pet/:userId', requireUpdateAck, async (req, res) => {
  try {
    const sort = getCleanParam(req.query.sort, 'power_desc') || 'power_desc';
    const inv = await getInventory(req.params.userId, { petSort: sort });
    if (!inv.success) return res.status(inv.status || 400).json(inv);
    return res.json({
      success: true,
      sort,
      user: inv.user,
      pets: inv.pets,
      summary_pets: inv.summary_pets_detailed || inv.summary_pets,
      summary_pets_compact: inv.summary_pets,
    });
  } catch (err) {
    console.error('[Server] /api/pet error:', err);
    return res.status(500).json({ success: false, error: 'PET_LIST_FAILED', message: err.message });
  }
});

app.post('/api/pet/active', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await setActivePet(body.userId, body.petId || body.petType);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/pet/active error:', err);
    return res.status(500).json({ success: false, error: 'PET_ACTIVE_FAILED', message: err.message });
  }
});

app.post('/api/pet/upgrade', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await upgradePet(body.userId, body.petId || body.petType, body.mode || 'level');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/pet/upgrade error:', err);
    return res.status(500).json({ success: false, error: 'PET_UPGRADE_FAILED', message: err.message });
  }
});

app.post('/api/enchant', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await enchantTarget(body.userId, {
      targetType: body.targetType || body.loai || body.category || '',
      targetId: body.targetId || body.mucTieu || body.maId || '',
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/enchant error:', err);
    return res.status(500).json({ success: false, error: 'ENCHANT_FAILED', message: err.message });
  }
});

app.get('/api/job/status/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getJobStatus(req.params.userId, {
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/job/status error:', err);
    return res.status(500).json({ success: false, error: 'JOB_STATUS_FAILED', message: err.message });
  }
});

app.post('/api/job/work', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await doJob(body.userId, body.jobId || body.nghe || body.job || '', {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/job/work error:', err);
    return res.status(500).json({ success: false, error: 'JOB_WORK_FAILED', message: err.message });
  }
});

// ============================================================================
// PHASE 2: SHOP (/shop) & TIÊN LỮ (/marry, /divorce)
// ============================================================================
app.get('/api/shop/catalog', async (req, res) => {
  try {
    const result = await getShopCatalog(req.query.category || 'all', {
      userId: req.query.userId,
      page: req.query.page,
      username: getCleanParam(req.query.username),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/shop/catalog error:', err);
    return res.status(500).json({ success: false, error: 'SHOP_CATALOG_FAILED', message: err.message });
  }
});

app.post('/api/shop/preview', requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await previewShopItem(body.userId, body.category, body.itemId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/shop/preview error:', err);
    return res.status(500).json({ success: false, error: 'SHOP_PREVIEW_FAILED', message: err.message });
  }
});

app.post('/api/shop/buy', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await buyShopItem(body.userId, {
      category: body.category,
      itemId: body.itemId,
      duration: body.duration,
      quantity: body.quantity,
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/shop/buy error:', err);
    return res.status(500).json({ success: false, error: 'SHOP_BUY_FAILED', message: err.message });
  }
});

app.get('/api/marry/status/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getMarriageStatus(req.params.userId, {
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/marry/status error:', err);
    return res.status(500).json({ success: false, error: 'MARRY_STATUS_FAILED', message: err.message });
  }
});

app.post('/api/marry/propose', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await proposeMarriage(
      body.proposerId || body.userId,
      getCleanParam(body.targetId) || body.targetId,
      getCleanParam(body.ringId) || 'ring_common',
      {
        proposerName: getCleanParam(body.proposerName || body.username),
        proposerAvatar: getCleanParam(body.proposerAvatar || body.avatarUrl),
        targetName: getCleanParam(body.targetName),
        targetAvatar: getCleanParam(body.targetAvatar),
      },
    );
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/marry/propose error:', err);
    return res.status(500).json({ success: false, error: 'MARRY_PROPOSE_FAILED', message: err.message });
  }
});

app.post('/api/marry/respond', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await respondMarriage(body.responderId || body.userId, body.decision, {
      proposalId: body.proposalId,
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/marry/respond error:', err);
    return res.status(500).json({ success: false, error: 'MARRY_RESPOND_FAILED', message: err.message });
  }
});

app.post('/api/marry/upgrade-ring', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await upgradeMarriageRing(body.userId, getCleanParam(body.ringId || body.newRingId) || '');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/marry/upgrade-ring error:', err);
    return res.status(500).json({ success: false, error: 'MARRY_UPGRADE_FAILED', message: err.message });
  }
});

app.post('/api/marry/divorce', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await divorceMarriage(body.userId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/marry/divorce error:', err);
    return res.status(500).json({ success: false, error: 'MARRY_DIVORCE_FAILED', message: err.message });
  }
});

// ============================================================================
// PHASE 3: GIA TỘC (/giatoc) & CLAN WARS 24H
// ============================================================================
app.get('/api/clan/leaderboard', async (req, res) => {
  try {
    const result = await getClanLeaderboard(req.query.limit || 10);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/leaderboard error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_TOP_FAILED', message: err.message });
  }
});

app.get('/api/clan/info/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getClanInfo(req.params.userId, getCleanParam(req.query.clan), {
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/info error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_INFO_FAILED', message: err.message });
  }
});

app.post('/api/clan/create', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await createClan(body.userId, {
      clanName: getCleanParam(body.clanName),
      clanTag: getCleanParam(body.clanTag),
      description: getCleanParam(body.description),
    }, {
      username: getCleanParam(body.username),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/create error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_CREATE_FAILED', message: err.message });
  }
});

app.post('/api/clan/join', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await requestJoinClan(body.userId, getCleanParam(body.clanQuery || body.clanId || body.clanName), {
      username: getCleanParam(body.username),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/join error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_JOIN_FAILED', message: err.message });
  }
});

app.get('/api/clan/requests/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await listJoinRequests(req.params.userId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/requests error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_REQUESTS_FAILED', message: err.message });
  }
});

app.post('/api/clan/approve', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await respondJoinRequest(body.leaderId || body.userId, body.applicantId || body.targetId, body.decision || 'approve');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/approve error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_APPROVE_FAILED', message: err.message });
  }
});

app.post('/api/clan/leave', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const result = await leaveClan(req.body?.userId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/leave error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_LEAVE_FAILED', message: err.message });
  }
});

app.post('/api/clan/kick', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await kickClanMember(body.leaderId || body.userId, body.targetId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/kick error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_KICK_FAILED', message: err.message });
  }
});

app.post('/api/clan/donate', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await donateToClan(body.userId, body.amount);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/donate error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_DONATE_FAILED', message: err.message });
  }
});

app.post('/api/clan/upgrade', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const result = await upgradeClan(req.body?.userId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/upgrade error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_UPGRADE_FAILED', message: err.message });
  }
});

app.post('/api/clan/war/declare', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await declareClanWar(body.leaderId || body.userId, getCleanParam(body.targetClan || body.targetQuery), body.betAmount);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/war/declare error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_WAR_DECLARE_FAILED', message: err.message });
  }
});

app.post('/api/clan/war/respond', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await respondClanWar(body.leaderId || body.userId, body.decision || 'accept');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/war/respond error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_WAR_RESPOND_FAILED', message: err.message });
  }
});

app.get('/api/clan/war/status/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getClanWarStatus(req.params.userId);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/clan/war/status error:', err);
    return res.status(500).json({ success: false, error: 'CLAN_WAR_STATUS_FAILED', message: err.message });
  }
});

// ============================================================================
// PHASE 4+: LEADERBOARD (/top), QUESTS & TOWER (/nhiemvu), GIFT (/tangqua), ROLE CLEANUP CRON
// ============================================================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await getServerLeaderboard(req.query.type || 'level', req.query.limit || 10);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/leaderboard error:', err);
    return res.status(500).json({ success: false, error: 'LEADERBOARD_FAILED', message: err.message });
  }
});

app.get('/api/quest/status/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getQuestStatus(req.params.userId, {
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/quest/status error:', err);
    return res.status(500).json({ success: false, error: 'QUEST_STATUS_FAILED', message: err.message });
  }
});

app.post('/api/quest/claim', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await claimDailyQuests(body.userId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/quest/claim error:', err);
    return res.status(500).json({ success: false, error: 'QUEST_CLAIM_FAILED', message: err.message });
  }
});

app.post(['/api/quest/claim-weekly', '/api/quests/claim-weekly'], requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await claimWeeklyQuests(body.userId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/quest/claim-weekly error:', err);
    return res.status(500).json({ success: false, error: 'QUEST_WEEKLY_CLAIM_FAILED', message: err.message });
  }
});

app.post('/api/quest/tower', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await challengeTower(body.userId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/quest/tower error:', err);
    return res.status(500).json({ success: false, error: 'QUEST_TOWER_FAILED', message: err.message });
  }
});

app.post('/api/quest/tower/reset', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await resetTowerAttempts(body.userId, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/quest/tower/reset error:', err);
    return res.status(500).json({ success: false, error: 'QUEST_TOWER_RESET_FAILED', message: err.message });
  }
});

app.post('/api/economy/gift', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await sendGift(
      body.senderId || body.userId,
      body.receiverId || body.targetId,
      body.giftType || body.loaiQua || body.type,
      body.amount ?? body.soLuong,
      {
        senderName: getCleanParam(body.senderName || body.username),
        fallbackSenderName: getCleanParam(body.fallbackSenderName),
        senderAvatar: getCleanParam(body.senderAvatar || body.avatarUrl),
        receiverName: getCleanParam(body.receiverName || body.targetName),
        fallbackReceiverName: getCleanParam(body.fallbackReceiverName),
        receiverAvatar: getCleanParam(body.receiverAvatar),
      },
    );
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/economy/gift error:', err);
    return res.status(500).json({ success: false, error: 'GIFT_FAILED', message: err.message });
  }
});

app.post('/api/roles/cleanup-expired', requireBackendApiKey, async (req, res) => {
  try {
    const result = await cleanupExpiredRoles();
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/roles/cleanup-expired error:', err);
    return res.status(500).json({ success: false, error: 'ROLE_CLEANUP_FAILED', message: err.message });
  }
});

// ============================================================================
// V1.3 EXPANSION: LINH VỰC (/linhvuc), MINIGAMES, NÔNG TRẠI (/farm, /exchange)
// ============================================================================
app.get('/api/domain/inventory/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getDomainInventory(req.params.userId, {
      view: getCleanParam(req.query.view, 'overview') || 'overview',
      username: getCleanParam(req.query.username),
      fallbackUsername: getCleanParam(req.query.fallback_name),
      avatarUrl: getCleanParam(req.query.avatar),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/domain/inventory error:', err);
    return res.status(500).json({ success: false, error: 'DOMAIN_INV_FAILED', message: err.message });
  }
});

app.post('/api/domain/equip', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await equipDomainEntity(body.userId, getCleanParam(body.targetId, body.entityId), {
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/domain/equip error:', err);
    return res.status(500).json({ success: false, error: 'DOMAIN_EQUIP_FAILED', message: err.message });
  }
});

app.post('/api/domain/unequip', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await unequipDomainEntity(body.userId, getCleanParam(body.slot, 'all') || 'all');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/domain/unequip error:', err);
    return res.status(500).json({ success: false, error: 'DOMAIN_UNEQUIP_FAILED', message: err.message });
  }
});

app.post('/api/domain/dismantle', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await dismantleDomainEntity(body.userId, getCleanParam(body.targetId, body.entityId));
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/domain/dismantle error:', err);
    return res.status(500).json({ success: false, error: 'DOMAIN_DISMANTLE_FAILED', message: err.message });
  }
});

app.post('/api/minigame/coinflip', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await playCoinflip(body.userId, body.bet ?? body.amount, getCleanParam(body.choice, 'heads') || 'heads', {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/minigame/coinflip error:', err);
    return res.status(500).json({ success: false, error: 'COINFLIP_FAILED', message: err.message });
  }
});

app.post('/api/minigame/slots', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await playSlots(body.userId, body.bet ?? body.amount, {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/minigame/slots error:', err);
    return res.status(500).json({ success: false, error: 'SLOTS_FAILED', message: err.message });
  }
});

app.post('/api/minigame/blackjack', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const act = String(getCleanParam(body.action) || '').toLowerCase();
    const opts = {
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    };
    const result = ['hit', 'stand', 'double'].includes(act)
      ? await blackjackAction(body.userId, act, opts)
      : await startBlackjack(body.userId, body.bet ?? body.amount, opts);
    const httpStatus = Number.isInteger(result?.status) ? result.status : (result?.success ? 200 : 400);
    return res.status(httpStatus).json(result);
  } catch (err) {
    console.error('[Server] /api/minigame/blackjack error:', err);
    return res.status(500).json({ success: false, error: 'BLACKJACK_FAILED', message: err.message });
  }
});

app.post('/api/minigame/crash', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const actionOrBet = getCleanParam(body.action) ?? body.bet ?? body.amount;
    const autoCashout = body.autoCashout ?? body.multiplier ?? null;
    const result = await crashGame(body.userId, actionOrBet, autoCashout, {
      bet: body.bet ?? body.amount,
      autoCashout,
      username: getCleanParam(body.username),
      fallbackUsername: getCleanParam(body.fallbackUsername),
      avatarUrl: getCleanParam(body.avatarUrl),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/minigame/crash error:', err);
    return res.status(500).json({ success: false, error: 'CRASH_FAILED', message: err.message });
  }
});

app.get('/api/farm/status/:userId', requireUpdateAck, async (req, res) => {
  try {
    const result = await getFarmStatus(req.params.userId, {
      username: getCleanParam(req.query.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/farm/status error:', err);
    return res.status(500).json({ success: false, error: 'FARM_STATUS_FAILED', message: err.message });
  }
});

app.post('/api/farm/plant', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await plantFarmPlot(body.userId, getCleanParam(body.seedId, body.targetId), {
      slotIndex: body.slotIndex,
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/farm/plant error:', err);
    return res.status(500).json({ success: false, error: 'FARM_PLANT_FAILED', message: err.message });
  }
});

app.post('/api/farm/care', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await careAllPlots(body.userId, {
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/farm/care error:', err);
    return res.status(500).json({ success: false, error: 'FARM_CARE_FAILED', message: err.message });
  }
});

app.post('/api/farm/harvest', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await harvestAllPlots(body.userId, {
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/farm/harvest error:', err);
    return res.status(500).json({ success: false, error: 'FARM_HARVEST_FAILED', message: err.message });
  }
});

app.post('/api/farm/clear', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await clearWiltedPlots(body.userId, {
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/farm/clear error:', err);
    return res.status(500).json({ success: false, error: 'FARM_CLEAR_FAILED', message: err.message });
  }
});

app.get('/api/exchange/catalog', async (req, res) => {
  try {
    const result = await getExchangeCatalog(req.query.userId || null);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/exchange/catalog error:', err);
    return res.status(500).json({ success: false, error: 'EXCHANGE_CATALOG_FAILED', message: err.message });
  }
});

app.post('/api/exchange/buy', requireBackendApiKey, requireUpdateAck, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await buyExchangeItem(body.userId, getCleanParam(body.exchangeId, body.itemId), body.quantity ?? 1, {
      username: getCleanParam(body.username),
    });
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/exchange/buy error:', err);
    return res.status(500).json({ success: false, error: 'EXCHANGE_BUY_FAILED', message: err.message });
  }
});

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌸 SuMi Family Profile Backend v${LATEST_VERSION} (Full HD+) running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 Fuyumi Profile Card (2000x1000): http://localhost:${PORT}/api/profile/757091869183311872`);
    console.log(`====================================================`);
    setTimeout(() => {
      warmStaticAssetsInBackground().catch((err) => {
        console.warn('[StaticCache] Boot warm error:', err.message);
      });
    }, 250);
  });
}

export default app;
