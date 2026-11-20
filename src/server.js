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
import { simulateBattle, getCachedBattleReport } from './services/battleService.js';
import { grantChatExp, handleVoiceExp } from './services/expService.js';
import { claimDaily, convertExpToLinhThach, rollGacha } from './services/economyService.js';
import {
  getInventory,
  equipTarget,
  unequipTarget,
  setActivePet,
  upgradePet,
} from './services/inventoryService.js';
import { renderProfileCard } from './canvas/profileRenderer.js';
import { renderRankCard } from './canvas/rankRenderer.js';
import { renderBattleCard } from './canvas/battleRenderer.js';
import {
  renderElementalChart,
  renderWikiItemCard,
  renderWikiPetCard,
} from './canvas/wikiRenderer.js';
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

/**
 * Root directory info endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: '🦊 SuMi Family Profile & Canvas Backend',
    bot: 'Nhiễm Nhiễm (916469360401453067)',
    owner: 'Fuyumi (757091869183311872)',
    version: '2.0.0',
    resolution: {
      profile: '2000x1000',
      rank: '2000x410',
      battle: '2000x1000',
      wiki: '2000x1000',
    },
    endpoints: {
      health: 'GET /health',
      wiki: 'GET /api/wiki[?category=overview|realms|battle|equipment|pets|economy]',
      wiki_catalog: 'GET /api/wiki/catalog',
      wiki_chart_elements: 'GET /api/wiki/chart/elements.png',
      wiki_item: 'GET /api/wiki/item/:itemId[.png]',
      wiki_pet: 'GET /api/wiki/pet/:petType[.png]',
      battle_simulate: 'POST /api/battle/simulate',
      battle_report_png: 'GET /api/battle/report/:battleId.png',
      battle_report_stateless_png: 'GET /api/battle/report.png?attacker=...&defender=...',
      battle_render_custom: 'POST /api/battle/render',
      exp_chat: 'POST /api/exp/chat',
      exp_voice: 'POST /api/exp/voice',
      economy_daily: 'POST /api/economy/daily',
      economy_doiqua: 'POST /api/economy/doiqua',
      economy_roll: 'POST /api/economy/roll',
      inventory: 'GET /api/inv/:userId',
      equip: 'POST /api/equip',
      unequip: 'POST /api/unequip',
      pet_list: 'GET /api/pet/:userId',
      pet_active: 'POST /api/pet/active',
      pet_upgrade: 'POST /api/pet/upgrade',
      profile_png: 'GET /api/profile/:userId[.png]',
      profile_json: 'GET /api/profile/:userId?format=json',
      profile_render_custom: 'POST /api/profile/render',
      rank_png: 'GET /api/rank/:userId[.png]',
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
    uptime: process.uptime(),
    supabase_connected: !!supabase,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TRỤ CỘT 1: HỆ THỐNG /WIKI (6 CHUYÊN MỤC + CHI TIẾT TRANG BỊ / LINH THÚ + ẢNH FULL HD+)
// ============================================================================

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

app.get(['/api/wiki/chart/elements.png', '/api/wiki/chart/elements'], async (req, res) => {
  try {
    const pngBuffer = await renderElementalChart();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(pngBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất sơ đồ Ngũ Hành:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất sơ đồ Ngũ Hành', message: err.message });
  }
});

app.get('/api/wiki/item/:itemId', async (req, res) => {
  try {
    const rawParam = String(req.params.itemId || '');
    const wantPng = rawParam.toLowerCase().endsWith('.png') || req.query.format === 'png';
    const detail = await getWikiItemDetail(rawParam);

    if (!detail.success) {
      return res.status(404).json(detail);
    }

    if (wantPng) {
      const pngBuffer = await renderWikiItemCard(detail.data);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.end(pngBuffer);
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
    const wantPng = rawParam.toLowerCase().endsWith('.png') || req.query.format === 'png';
    const detail = await getWikiPetDetail(rawParam);

    if (!detail.success) {
      return res.status(404).json(detail);
    }

    if (wantPng) {
      const pngBuffer = await renderWikiPetCard(detail.data);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.end(pngBuffer);
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

// ============================================================================
// TRỤ CỘT 3: ĐẤU TRƯỜNG /BATTLE 1V1 & ẢNH CHIẾN BÁO FULL HD+ (2000x1000)
// ============================================================================

app.post('/api/battle/simulate', async (req, res) => {
  try {
    const { attackerId, defenderId, attacker, defender, options } = req.body || {};

    const actId = attackerId || req.body?.attacker_id || attacker;
    const defId = defenderId || req.body?.defender_id || defender;

    if (!actId || !defId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Thiếu thông tin người tấn công (attackerId) hoặc người phòng thủ (defenderId).',
      });
    }

    const cleanAttackerId = typeof actId === 'string' ? sanitizeUserId(actId) : actId;
    const cleanDefenderId = typeof defId === 'string' ? sanitizeUserId(defId) : defId;

    const battleResult = await simulateBattle(cleanAttackerId, cleanDefenderId, options);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(battleResult);
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

app.get('/api/battle/report.png', async (req, res) => {
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
    const battleResult = await simulateBattle(actId, defId, { maxTurns, ...(Number.isFinite(seed) ? { seed } : {}) });
    const pngBuffer = await renderBattleCard(battleResult);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(pngBuffer);
  } catch (err) {
    console.error('[Server] Lỗi kết xuất ảnh chiến báo stateless:', err);
    return res.status(500).json({ success: false, error: 'Lỗi kết xuất ảnh chiến báo', message: err.message });
  }
});

app.get('/api/battle/report/:battleId', async (req, res) => {
  try {
    const cleanId = String(req.params.battleId || '').replace(/\.png$/i, '').trim();
    const cached = getCachedBattleReport(cleanId);
    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'Battle report not found',
        message: `Không tìm thấy chiến báo '${cleanId}' hoặc chiến báo đã hết hạn.`,
      });
    }

    const pngBuffer = await renderBattleCard(cached);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.end(pngBuffer);
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
                           (format !== 'png' && req.headers.accept?.includes('application/json'));

    if (isExplicitJson) {
      return res.json({
        success: true,
        data: profileData,
      });
    }

    const pngBuffer = await renderProfileCard(profileData);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.end(pngBuffer);
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
                           (format !== 'png' && req.headers.accept?.includes('application/json'));

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

    const pngBuffer = await renderRankCard(profileData);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.end(pngBuffer);
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
app.post('/api/economy/daily', requireBackendApiKey, async (req, res) => {
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

app.post('/api/economy/doiqua', requireBackendApiKey, async (req, res) => {
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

app.post('/api/economy/roll', requireBackendApiKey, async (req, res) => {
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

app.get('/api/inv/:userId', async (req, res) => {
  try {
    const result = await getInventory(req.params.userId, {
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

app.post('/api/equip', requireBackendApiKey, async (req, res) => {
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

app.post('/api/unequip', requireBackendApiKey, async (req, res) => {
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

app.get('/api/pet/:userId', async (req, res) => {
  try {
    const inv = await getInventory(req.params.userId);
    if (!inv.success) return res.status(inv.status || 400).json(inv);
    return res.json({ success: true, user: inv.user, pets: inv.pets, summary_pets: inv.summary_pets });
  } catch (err) {
    console.error('[Server] /api/pet error:', err);
    return res.status(500).json({ success: false, error: 'PET_LIST_FAILED', message: err.message });
  }
});

app.post('/api/pet/active', requireBackendApiKey, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await setActivePet(body.userId, body.petId || body.petType);
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/pet/active error:', err);
    return res.status(500).json({ success: false, error: 'PET_ACTIVE_FAILED', message: err.message });
  }
});

app.post('/api/pet/upgrade', requireBackendApiKey, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await upgradePet(body.userId, body.petId || body.petType, body.mode || 'level');
    return res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error('[Server] /api/pet/upgrade error:', err);
    return res.status(500).json({ success: false, error: 'PET_UPGRADE_FAILED', message: err.message });
  }
});

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌸 SuMi Family Profile Backend v2.0 (Full HD+) running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 Fuyumi Profile Card (2000x1000): http://localhost:${PORT}/api/profile/757091869183311872`);
    console.log(`====================================================`);
  });
}

export default app;
