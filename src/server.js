import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfileData, sanitizeUserId } from './services/profileService.js';
import { getWikiData, VALID_CATEGORIES } from './services/wikiService.js';
import { simulateBattle } from './services/battleService.js';
import { renderProfileCard } from './canvas/profileRenderer.js';
import { renderRankCard } from './canvas/rankRenderer.js';
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
    if (trimmed && !trimmed.startsWith('{')) return trimmed;
  }
  if (fallback && typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed && !trimmed.startsWith('{')) return trimmed;
  }
  return null;
}

/**
 * Root directory info endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: '🦊 SuMi Family Profile & Canvas Backend',
    bot: 'Nhiễm Nhiễm (916469360401453067)',
    owner: 'Fuyumi (757091869183311872)',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      wiki: 'GET /api/wiki[?category=beginner|pets|equipment|battle|economy]',
      battle_simulate: 'POST /api/battle/simulate',
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

/**
 * Endpoint cung cấp dữ liệu Cẩm Nang Tu Tiên SuMi Family
 * GET /api/wiki
 * Hỗ trợ query: ?category=beginner|pets|equipment|battle|economy|all (hoặc ?cat=...)
 */
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

/**
 * Endpoint mô phỏng trận chiến Linh Thú theo lượt (Pet Battle Simulation)
 * POST /api/battle/simulate
 * Payload: { attackerId: string, defenderId: string, options?: object }
 */
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

/**
 * Endpoint tạo và hiển thị ảnh hồ sơ người dùng
 * GET /api/profile/:userId
 * Hỗ trợ các định dạng:
 *   - /api/profile/:userId.png : Trả về ảnh PNG
 *   - /api/profile/:userId?format=json : Trả về dữ liệu JSON
 * Hỗ trợ tham số query ghi đè (cho BotGhost Custom Events):
 *   - ?username=... &avatar=... &title=...
 */
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
    // Thu thập tham số ghi đè từ Query String nếu có
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

    // Render Canvas thành PNG
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

/**
 * Endpoint tạo và hiển thị ảnh Rank Mini (cho lệnh /rank)
 * GET /api/rank/:userId
 * Kích thước: 1000 x 205 px
 */
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

    // Render Canvas thành PNG thẻ Rank Mini
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

/**
 * Endpoint cho phép render ảnh Rank Mini từ payload JSON tùy biến
 * POST /api/rank/render
 */
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

/**
 * Endpoint cho phép render ảnh trực tiếp từ payload JSON tùy biến
 * POST /api/profile/render
 */
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

// Khởi chạy server nếu file được chạy trực tiếp từ dòng lệnh
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌸 SuMi Family Profile Backend is running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 Fuyumi Profile Card: http://localhost:${PORT}/api/profile/757091869183311872`);
    console.log(`====================================================`);
  });
}

export default app;
