/**
 * scripts/scan_pet_level_roles.mjs
 * Script CHỈ ĐỌC (Read-Only) kiểm tra các thành viên đang giữ Role Pet Level cũ trong SuMi Family (Guild 1026096141273661450)
 * và lập danh sách dự kiến đền bù (KHÔNG tự chỉnh sửa Role hay cấp quà trước khi công bố Ver 1.7).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const SUMI_GUILD_ID = '1026096141273661450';

// Danh sách các Role Pet Level cũ (gỡ khỏi /equip ở bản công bố Ver 1.7 để chuyển sang đền bù)
export const LEGACY_PET_LEVEL_ROLE_HINTS = [
  'Pet Lv',
  'Pet Level',
  'Linh Thú Cấp',
];

export const PET_ROLE_COMPENSATION_PLAN = {
  per_tier_lt: 1500,
  commemorative_frame_id: 'frame_v17_06_crimson_raven',
  note: 'Gói đền bù dự kiến: +1.500 LT/mốc + Khung Kỷ Niệm Huyết Nha Thâm Uyên (frame_v17_06_crimson_raven)',
};

export function matchLegacyPetLevelRoles(guildRoles = []) {
  return (guildRoles || []).filter((r) => {
    const name = String(r?.name || '');
    return LEGACY_PET_LEVEL_ROLE_HINTS.some((hint) => name.toLowerCase().includes(hint.toLowerCase()));
  });
}

export function buildCompensationPreview(members = [], matchedRoles = []) {
  const roleMap = new Map(matchedRoles.map((r) => [String(r.id), r]));
  const rows = [];
  for (const m of members || []) {
    const mRoleIds = (m.roles || []).map(String).filter((rid) => roleMap.has(rid));
    if (mRoleIds.length === 0) continue;
    rows.push({
      user_id: String(m.user?.id || m.user_id || ''),
      username: m.user?.username || m.nick || 'Unknown',
      role_count: mRoleIds.length,
      role_names: mRoleIds.map((rid) => roleMap.get(rid)?.name || rid),
      estimated_lt: mRoleIds.length * PET_ROLE_COMPENSATION_PLAN.per_tier_lt,
      commemorative_frame_id: PET_ROLE_COMPENSATION_PLAN.commemorative_frame_id,
    });
  }
  return rows;
}

export async function runReadOnlyScan() {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) {
    return {
      mode: 'read-only-offline',
      guild_id: SUMI_GUILD_ID,
      message: 'Thiếu DISCORD_BOT_TOKEN — không gọi Discord API. Chỉ xuất cấu trúc kế hoạch đền bù.',
      compensation_plan: PET_ROLE_COMPENSATION_PLAN,
    };
  }

  const headers = { Authorization: `Bot ${token}` };
  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${SUMI_GUILD_ID}/roles`, { headers });
  if (!rolesRes.ok) throw new Error(`Discord roles fetch failed (${rolesRes.status})`);
  const guildRoles = await rolesRes.json();
  const matchedRoles = matchLegacyPetLevelRoles(guildRoles);

  const membersRes = await fetch(`https://discord.com/api/v10/guilds/${SUMI_GUILD_ID}/members?limit=1000`, { headers });
  if (!membersRes.ok) throw new Error(`Discord members fetch failed (${membersRes.status})`);
  const members = await membersRes.json();

  const preview = buildCompensationPreview(members, matchedRoles);
  return {
    mode: 'read-only-live-scan',
    guild_id: SUMI_GUILD_ID,
    matched_roles_count: matchedRoles.length,
    holders_count: preview.length,
    preview,
    compensation_plan: PET_ROLE_COMPENSATION_PLAN,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  runReadOnlyScan()
    .then((res) => console.log('[scan_pet_level_roles]', JSON.stringify(res, null, 2)))
    .catch((err) => {
      console.error('[scan_pet_level_roles] FAILED:', err);
      process.exit(1);
    });
}
