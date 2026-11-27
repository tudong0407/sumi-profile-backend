/**
 * scripts/deploy_v1_7_botghost.mjs
 * Kế hoạch đồng bộ BotGhost Dashboard cho SuMi Family Ver 1.7 (Mặc định --dry-run, CHỈ đọc/kiểm kê).
 * KHÔNG tự ý deploy hoặc publish lên BotGhost khi chưa đủ asset ảnh & Tiểu thư duyệt tung bản cập nhật!
 *
 * Tuân thủ Guardrail BotGhost Builder:
 * - Không vượt quá 500 ký tự cho mỗi regex `matches_pattern`
 * - Không dùng `{m,n}`, dùng `[ ][ ]+` thay khoảng trắng trần ở đầu regex
 * - Kiểm tra `new RegExp(s.trim(), 'i')` hợp lệ 100%
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const V17_BOTGHOST_COMMANDS_SPEC = [
  {
    command: '/tienhoa',
    type: 'slash_new',
    description: 'Điện Tiến Hóa Pet Tối Thượng Chân Thần & Chế Tạo Hồng Mông Tiến Hóa Tinh (NO /hiente)',
    endpoints: [
      'GET /api/tienhoa/hub/{user.id}',
      'POST /api/tienhoa/evolve',
      'POST /api/tienhoa/craft-crystal',
    ],
    ui_tabs: ['Tab 1: Tiến Hóa Chân Thần (Lv.40 & 8★ + 1 Hồng Mông)', 'Tab 2: Chế Tạo Hồng Mông (2 bước xác nhận)'],
    custom_id_pattern: '^v17_evo_(tab|tier|evolve|craft|confirm)_[a-zA-Z0-9_]+$',
  },
  {
    command: '/shop_dacbiet',
    type: 'slash_new',
    description: 'Shop Đặc Biệt Chủ Nhật (08:00–24:00 UTC+7): Đổi 750 LT = 1 TT (max 200 TT/tuần) & Thẻ Chọn Thần Thoại',
    endpoints: [
      'GET /api/special-shop/{user.id}',
      'POST /api/special-shop/convert',
      'POST /api/special-shop/buy',
      'POST /api/special-shop/open-selector',
    ],
    custom_id_pattern: '^v17_ss_(convert|buy|selector)_[a-zA-Z0-9_]+$',
  },
  {
    command: '/explorer',
    type: 'slash_update',
    description: 'Đồng bộ Bộ 1/2/3 từ /inv & ẩn nút [Nhận Quà] khi ui_variant === exploring_locked',
    endpoints: ['POST /api/explorer/switch-loadout'],
    custom_id_pattern: '^v17_exp_slot_[123]$',
  },
  {
    command: '/shop',
    type: 'slash_update',
    description: 'Thêm nút phân trang Trang Trước / Trang Sau cho Quầy Viền Avatar (24 mẫu trả phí -> 3 trang)',
    endpoints: ['GET /api/shop/catalog?category=frames&page={page}'],
    custom_id_pattern: '^v17_shop_frames_page_[0-9]+$',
  },
  {
    command: '/wiki',
    type: 'slash_update',
    description: 'Thêm Button Sub-Hubs cho /wiki Linh Thú (40 Độc Nhất / 10 Thú Nhân) & Lãnh Địa (Vực / Thức / Cảnh)',
    endpoints: ['GET /api/wiki?category={cat}&subhub={subhub}&page={page}'],
    custom_id_pattern: '^v17_wiki_sub_(pets|domains)_[a-z]+_[0-9]+$',
  },
  {
    command: '/dothach',
    type: 'slash_update',
    description: 'Đổi nhãn Hộp Chọn Tối Thượng Cực Phẩm -> Hộp Thần Thoại Cực Phẩm',
    endpoints: ['POST /api/stone/claim-supreme'],
    custom_id_pattern: '^v16_stone_pick_[a-z]+$',
  },
];

export function validateBotGhostPatterns(specs = V17_BOTGHOST_COMMANDS_SPEC) {
  const errors = [];
  for (const s of specs) {
    const p = String(s.custom_id_pattern || '');
    if (p.length > 500) errors.push(`${s.command}: pattern exceeds 500 chars`);
    if (/\{[0-9,]+\}/.test(p)) errors.push(`${s.command}: forbidden {m,n} quantifier brace`);
    try {
      new RegExp(p.trim(), 'i');
    } catch (e) {
      errors.push(`${s.command}: invalid regex (${e.message})`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getBotGhostDeployPlan(argv = process.argv.slice(2)) {
  const validation = validateBotGhostPatterns();
  const isLiveRequested = argv.includes('--live');
  return {
    mode: isLiveRequested ? 'live-blocked-staging' : 'dry-run',
    validation,
    commands_count: V17_BOTGHOST_COMMANDS_SPEC.length,
    commands: V17_BOTGHOST_COMMANDS_SPEC,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  const plan = getBotGhostDeployPlan(process.argv.slice(2));
  console.log('[deploy_v1_7_botghost]', JSON.stringify({
    mode: plan.mode,
    valid_patterns: plan.validation.valid,
    errors: plan.validation.errors,
    commands: plan.commands.map((c) => `${c.command} (${c.type})`),
  }, null, 2));
}
