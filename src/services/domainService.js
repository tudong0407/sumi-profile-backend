/**
 * src/services/domainService.js
 * Quản lý Kho & Trang Bị Linh Vực • Thần Thức • Thần Cảnh (/linhvuc) cho SuMi Family v1.3.
 */

import { supabase } from '../config/supabase.js';
import {
  DOMAIN_CATALOG,
  DOMAIN_BY_ID,
  DOMAIN_ELEMENTS,
  DIVINE_SENSE_CATALOG,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_CATALOG,
  DIVINE_REALM_BY_ID,
  FUYUMI_USER_ID,
  RARITY_TIERS,
} from '../data/catalog.js';
import {
  em,
  tierEmoji,
  domainEmoji,
  senseEmoji,
  realmEmojiById,
} from '../config/emojiHelper.js';
import { ensureUserInitialized } from './profileService.js';
import { normalizeEmojiAwareQuery } from './inventoryService.js';

const DOMAIN_DISMANTLE_VALUES = {
  common: 6,
  rare: 15,
  epic: 36,
  mythic: 85,
};

const RARITY_RANK = { supreme: 5, mythic: 4, epic: 3, rare: 2, common: 1 };

function sanitizeUserId(id) {
  if (!id) return null;
  const s = String(id).trim();
  return /^[0-9]{15,22}$/.test(s) ? s : null;
}

const domainLocks = new Map();
async function withDomainLock(userId, fn) {
  const prev = domainLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((r) => { release = r; });
  domainLocks.set(userId, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (domainLocks.get(userId) === current) domainLocks.delete(userId);
  }
}

export function getDomainEntityMeta(kind, entityId) {
  if (!entityId) return null;
  if (kind === 'domain') return DOMAIN_BY_ID[entityId] || null;
  if (kind === 'sense') return DIVINE_SENSE_BY_ID[entityId] || null;
  if (kind === 'realm') return DIVINE_REALM_BY_ID[entityId] || null;
  return DOMAIN_BY_ID[entityId] || DIVINE_SENSE_BY_ID[entityId] || DIVINE_REALM_BY_ID[entityId] || null;
}

export function getDomainEntityIcon(kind, entityId) {
  if (kind === 'domain') return domainEmoji(entityId, em('su_realm_star'));
  if (kind === 'sense') return senseEmoji(entityId, em('su_sparkle'));
  if (kind === 'realm') return realmEmojiById(entityId, em('su_arena'));
  return em('su_realm_star');
}

function resolveDomainEntityQuery(rawQuery) {
  const normalized = normalizeEmojiAwareQuery(rawQuery);
  const needle = String(normalized || '').trim().toLowerCase();
  if (!needle) return null;

  if (DOMAIN_BY_ID[needle]) return { kind: 'domain', meta: DOMAIN_BY_ID[needle] };
  if (DIVINE_SENSE_BY_ID[needle]) return { kind: 'sense', meta: DIVINE_SENSE_BY_ID[needle] };
  if (DIVINE_REALM_BY_ID[needle]) return { kind: 'realm', meta: DIVINE_REALM_BY_ID[needle] };

  const clean = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[«»]/g, '').trim();
  const cNeedle = clean(rawQuery);

  for (const d of DOMAIN_CATALOG) {
    if (clean(d.name).includes(cNeedle)) return { kind: 'domain', meta: d };
  }
  for (const s of DIVINE_SENSE_CATALOG) {
    if (clean(s.name).includes(cNeedle)) return { kind: 'sense', meta: s };
  }
  for (const r of DIVINE_REALM_CATALOG) {
    if (clean(r.name).includes(cNeedle)) return { kind: 'realm', meta: r };
  }
  return null;
}

function toSupCount(n) {
  const num = Number(n) || 1;
  if (num <= 1) return '';
  const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const s = String(num).padStart(3, '0').split('').map((c) => map[c] || c).join('');
  return ` ${s}`;
}

export async function getDomainInventory(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId, {
    username: options.username,
    fallbackUsername: options.fallbackUsername,
    avatarUrl: options.avatarUrl,
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ tu sĩ.' };

  const { data: rows, error } = await supabase
    .from('user_domains')
    .select('*')
    .eq('user_id', cleanId);
  if (error) throw new Error(`Failed loading domains: ${error.message}`);

  const list = (rows || []).map((row) => {
    const meta = getDomainEntityMeta(row.entity_kind, row.entity_id);
    if (!meta) return null;
    return {
      ...row,
      ...meta,
      entity_kind: row.entity_kind,
      entity_id: row.entity_id,
      icon: getDomainEntityIcon(row.entity_kind, row.entity_id),
      tier_icon: tierEmoji(meta.rarity_key),
    };
  }).filter(Boolean).sort((a, b) => (b.is_equipped ? 1 : 0) - (a.is_equipped ? 1 : 0) || (RARITY_RANK[b.rarity_key] || 1) - (RARITY_RANK[a.rarity_key] || 1));

  const eqDomain = list.find((x) => x.entity_kind === 'domain' && x.is_equipped) || null;
  const eqSense = list.find((x) => x.entity_kind === 'sense' && x.is_equipped) || null;
  const eqRealm = list.find((x) => x.entity_kind === 'realm' && x.is_equipped) || null;

  const isInf = Boolean(eqDomain && (eqDomain.is_exclusive_fuyumi || eqDomain.base_energy >= 999));
  const totalLinhMach = eqDomain
    ? (isInf ? '∞ (Bất Hoại)' : `${Number(eqDomain.base_energy || 3) + Number(eqSense?.bonus_energy || 0)} Linh Mạch`)
    : 'Chưa khai mở';

  const domains = list.filter((x) => x.entity_kind === 'domain');
  const senses = list.filter((x) => x.entity_kind === 'sense');
  const realms = list.filter((x) => x.entity_kind === 'realm');

  const formatBucket = (arr, kindLabel) => {
    if (arr.length === 0) return `• *Chưa sở hữu ${kindLabel} nào. Dùng \`/roll loai:domain\` để triệu hồi!*`;
    const lines = [];
    for (const item of arr.slice(0, 12)) {
      const eqTag = item.is_equipped ? ' **[Đang Dùng]**' : '';
      const qtyTag = toSupCount(item.quantity);
      const statNote = item.entity_kind === 'domain'
        ? `${item.element} • ${item.base_energy >= 999 ? '∞' : item.base_energy} LM`
        : item.entity_kind === 'sense'
          ? `+${item.bonus_energy >= 999 ? '∞' : item.bonus_energy} LM`
          : `+${Math.round((item.debuff_boost_pct || 0) * 100)}% Debuff`;
      lines.push(`• ${item.icon} ${item.tier_icon} **${item.name}**${qtyTag} (\`${item.entity_id}\`) — *${statNote}*${eqTag}`);
    }
    if (arr.length > 12) lines.push(`• *... và ${arr.length - 12} ${kindLabel} khác*`);
    return lines.join('\n');
  };

  const view = String(options.view || 'overview').toLowerCase();
  const sections = [
    `${em('su_realm_star')} **BỘ LINH VỰC ĐANG TRANG BỊ (KÍCH HOẠT TỪ HIỆP 2)**`,
    `• **Linh Vực:** ${eqDomain ? `${eqDomain.icon} **${eqDomain.name}** *(${eqDomain.element})*` : '`Trống`'}`,
    `• **Thần Thức:** ${eqSense ? `${eqSense.icon} **${eqSense.name}**` : '`Trống`'}`,
    `• **Thần Cảnh:** ${eqRealm ? `${eqRealm.icon} **${eqRealm.name}**` : '`Trống`'}`,
    `• **Tổng Linh Mạch:** \`${totalLinhMach}\` • **Tương Khắc:** \`${DOMAIN_ELEMENTS.cycle.join(' → ')} → Kiếm Vực\``,
    '',
  ];

  if (view === 'domain') {
    sections.push(`**Danh Sách Linh Vực (${domains.length})**`, formatBucket(domains, 'Linh Vực'));
  } else if (view === 'sense') {
    sections.push(`**Danh Sách Thần Thức (${senses.length})**`, formatBucket(senses, 'Thần Thức'));
  } else if (view === 'realm') {
    sections.push(`**Danh Sách Thần Cảnh (${realms.length})**`, formatBucket(realms, 'Thần Cảnh'));
  } else {
    sections.push(
      `**1. Linh Vực (${domains.length})**`,
      formatBucket(domains, 'Linh Vực'),
      '',
      `**2. Thần Thức (${senses.length})**`,
      formatBucket(senses, 'Thần Thức'),
      '',
      `**3. Thần Cảnh (${realms.length})**`,
      formatBucket(realms, 'Thần Cảnh'),
    );
  }

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    total_linh_mach: totalLinhMach,
    equipped: { domain: eqDomain, sense: eqSense, realm: eqRealm },
    domains,
    senses,
    realms,
    counts: { domains: domains.length, senses: senses.length, realms: realms.length },
    title: `${em('su_realm_star')} LINH VỰC TIÊN GIỚI — ${user.username}`,
    description: sections.join('\n').slice(0, 4000),
    footer: 'SuMi Family • Dùng /linhvuc trang_bi:<mã UID hoặc emoji> để khai mở hoặc thay đổi',
  };
}

export async function equipDomainEntity(userId, rawTarget, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const resolved = resolveDomainEntityQuery(rawTarget);
  if (!resolved) {
    return {
      success: false,
      status: 404,
      error: 'DOMAIN_ENTITY_NOT_FOUND',
      message: `Không tìm thấy Linh Vực, Thần Thức hay Thần Cảnh nào khớp \`${rawTarget}\`.`,
    };
  }

  return withDomainLock(cleanId, async () => {
    await ensureUserInitialized(cleanId, { username: options.username });
    const { data: owned } = await supabase
      .from('user_domains')
      .select('*')
      .eq('user_id', cleanId)
      .eq('entity_kind', resolved.kind)
      .eq('entity_id', resolved.meta.id)
      .maybeSingle();

    if (!owned) {
      return {
        success: false,
        status: 404,
        error: 'NOT_OWNED',
        message: `Bạn chưa sở hữu **${resolved.meta.name}**! Hãy triệu hồi qua \`/roll loai:domain\`.`,
      };
    }

    if (owned.is_equipped) {
      return {
        success: true,
        already_equipped: true,
        entity_kind: resolved.kind,
        entity_id: resolved.meta.id,
        message: `${getDomainEntityIcon(resolved.kind, resolved.meta.id)} **${resolved.meta.name}** hiện đang được trang bị sẵn.`,
      };
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from('user_domains')
      .update({ is_equipped: false, updated_at: nowIso })
      .eq('user_id', cleanId)
      .eq('entity_kind', resolved.kind)
      .eq('is_equipped', true);

    await supabase
      .from('user_domains')
      .update({ is_equipped: true, updated_at: nowIso })
      .eq('id', owned.id);

    const icon = getDomainEntityIcon(resolved.kind, resolved.meta.id);
    const descDetail = resolved.meta.buff_desc
      ? `• **Buff:** ${resolved.meta.buff_desc}\n• **Debuff:** ${resolved.meta.debuff_desc}`
      : `• **Hiệu ứng:** ${resolved.meta.desc}`;

    return {
      success: true,
      entity_kind: resolved.kind,
      entity_id: resolved.meta.id,
      entity_name: resolved.meta.name,
      message: `${icon} Đã trang bị thành công **${resolved.meta.name}** (${resolved.meta.rarity})!\n${descDetail}`,
    };
  });
}

export async function unequipDomainEntity(userId, rawSlot = 'all') {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const slot = String(rawSlot || 'all').trim().toLowerCase();
  return withDomainLock(cleanId, async () => {
    let q = supabase
      .from('user_domains')
      .update({ is_equipped: false, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId)
      .eq('is_equipped', true);
    if (['domain', 'sense', 'realm'].includes(slot)) {
      q = q.eq('entity_kind', slot);
    }
    const { error } = await q;
    if (error) throw new Error(`Unequip domain failed: ${error.message}`);
    const labelMap = { domain: 'Linh Vực', sense: 'Thần Thức', realm: 'Thần Cảnh', all: 'toàn bộ Linh Vực • Thần Thức • Thần Cảnh' };
    return {
      success: true,
      slot,
      message: `${em('su_realm_star')} Đã thu hồi **${labelMap[slot] || labelMap.all}** về kho dự trữ.`,
    };
  });
}

export async function dismantleDomainEntity(userId, rawTarget) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const resolved = resolveDomainEntityQuery(rawTarget);
  if (!resolved) {
    return { success: false, status: 404, error: 'NOT_FOUND', message: `Không tìm thấy mục tiêu '${rawTarget}'.` };
  }
  if (resolved.meta.is_exclusive_fuyumi) {
    return { success: false, status: 403, error: 'EXCLUSIVE_PROTECTED', message: 'Không thể phân giải bảo vật Độc Tôn!' };
  }

  return withDomainLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId);
    const { data: row } = await supabase
      .from('user_domains')
      .select('*')
      .eq('user_id', cleanId)
      .eq('entity_kind', resolved.kind)
      .eq('entity_id', resolved.meta.id)
      .maybeSingle();

    if (!row) {
      return { success: false, status: 404, error: 'NOT_OWNED', message: `Bạn chưa sở hữu **${resolved.meta.name}**.` };
    }
    if (row.is_equipped && row.quantity <= 1) {
      return { success: false, status: 400, error: 'EQUIPPED_PROTECTED', message: `Vui lòng tháo **${resolved.meta.name}** ra trước khi phân giải bản cuối cùng.` };
    }

    const dismantleCount = row.is_equipped ? (row.quantity - 1) : row.quantity;
    const perUnitLt = DOMAIN_DISMANTLE_VALUES[resolved.meta.rarity_key] || 6;
    const refundLt = dismantleCount * perUnitLt;
    const nextBal = Number(user?.linh_thach || 0) + refundLt;
    const nowIso = new Date().toISOString();

    const ops = [
      supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId),
    ];
    if (row.is_equipped) {
      ops.push(supabase.from('user_domains').update({ quantity: 1, updated_at: nowIso }).eq('id', row.id));
    } else {
      ops.push(supabase.from('user_domains').delete().eq('id', row.id));
    }
    await Promise.all(ops);

    return {
      success: true,
      entity_id: resolved.meta.id,
      entity_name: resolved.meta.name,
      dismantled_count: dismantleCount,
      refund_linh_thach: refundLt,
      linh_thach: nextBal,
      message: `${getDomainEntityIcon(resolved.kind, resolved.meta.id)} Đã phân giải **${dismantleCount}× ${resolved.meta.name}**, thu hồi **+${refundLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} (Số dư: **${nextBal.toLocaleString('vi-VN')} LT**).`,
    };
  });
}
