import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getProfileData, sanitizeUserId } from './services/profileService.js';
import { renderProfileCard } from './canvas/profileRenderer.js';
import { renderRankCard } from './canvas/rankRenderer.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  if (!cleanUserId || cleanUserId.startsWith('{')) {
    const fallback = req.query.fallback_id || req.query.user_id || req.query.userId || req.query.user || req.query.target;
    if (fallback) {
      cleanUserId = sanitizeUserId(fallback);
    }
  }
  const { format } = req.query;

  try {
    // Thu thập tham số ghi đè từ Query String nếu có
    const overrides = {
      username: getCleanParam(req.query.username || req.query.name, req.query.fallback_name),
      avatar_url: getCleanParam(req.query.avatar || req.query.avatar_url, req.query.fallback_avatar),
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
  if (!cleanUserId || cleanUserId.startsWith('{')) {
    const fallback = req.query.fallback_id || req.query.user_id || req.query.userId || req.query.user || req.query.target;
    if (fallback) {
      cleanUserId = sanitizeUserId(fallback);
    }
  }
  const { format } = req.query;

  try {
    const overrides = {
      username: getCleanParam(req.query.username || req.query.name, req.query.fallback_name),
      avatar_url: getCleanParam(req.query.avatar || req.query.avatar_url, req.query.fallback_avatar),
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
