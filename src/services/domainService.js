/**
 * src/services/domainService.js
 * Quản lý Kho & Trang Bị Linh Vực • Thần Thức • Thần Cảnh (/linhvuc) cho SuMi Family v1.3.
 */

import { supabase } from '../config/supabase.js';
import { getUserBusyExplorationAssets } from './explorerService.js';
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
  uiEm,
  tierEmoji,
  domainEmoji,
  domainElementEmoji,
  senseEmoji,
  realmEmojiById,
} from '../config/emojiHelper.js';
import { ensureUserInitialized } from './profileService.js';
import { normalizeEmojiAwareQuery, paginateFormattedLines, invalidateInventoryCache } from './inventoryService.js';
import { syncActiveLoadoutFromCurrentGear, checkActiveLoadoutExplorerLock, withLoadoutLock } from './loadoutService.js';
import { computeEffectiveDomainEnergy } from './battleEngine/domainEngine.js';
import { evaluateSetBonus } from './battleEngine/setBonusEngine.js';
import { trackQuestActivity } from './questService.js';

export const DOMAIN_DISMANTLE_VALUES = {
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

  const [{ data: rows, error }, { data: eqRows }] = await Promise.all([
    supabase
      .from('user_domains')
      .select('*')
      .eq('user_id', cleanId),
    supabase
      .from('v_user_equipped_items')
      .select('item_id, item_type, rarity')
      .eq('user_id', cleanId),
  ]);
  if (error) throw new Error(`Failed loading domains: ${error.message}`);

  const equippedGear = eqRows || [];
  const setBonus = evaluateSetBonus(equippedGear);

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

  const energyInfo = computeEffectiveDomainEnergy({
    domain: eqDomain,
    sense: eqSense,
    equipment: equippedGear,
    setBonus,
  });
  let totalLinhMach = energyInfo.label;
  if (energyInfo.hasDomain && !energyInfo.isInfinite && (energyInfo.extraFromEquip > 0 || energyInfo.extraFromSet > 0)) {
    const parts = [`Gốc ${energyInfo.baseEnergy}`];
    if (energyInfo.senseBonus > 0) parts.push(`Thức +${energyInfo.senseBonus}`);
    if (energyInfo.extraFromEquip > 0) parts.push(`Pháp Bảo +${energyInfo.extraFromEquip}`);
    if (energyInfo.extraFromSet > 0) parts.push(`Bộ +${energyInfo.extraFromSet}`);
    totalLinhMach = `${energyInfo.totalEnergy} Linh Mạch (${parts.join(' + ')})`;
  }

  const domains = list.filter((x) => x.entity_kind === 'domain');
  const senses = list.filter((x) => x.entity_kind === 'sense');
  const realms = list.filter((x) => x.entity_kind === 'realm');

  const formatDomainItemLine = (item) => {
    const eqTag = item.is_equipped ? ' **[Đang Dùng]**' : '';
    const qtyTag = toSupCount(item.quantity);
    let statNote = '';
    if (item.entity_kind === 'domain') {
      const lm = item.base_energy >= 999 ? '∞' : item.base_energy;
      const extras = [];
      if (item.enemy_active_debuff_pierce > 0) extras.push(`Xuyên Vực ${Math.round(item.enemy_active_debuff_pierce * 100)}%`);
      if (item.enemy_buff_suppression > 0) extras.push(`Áp Chế ${Math.round(item.enemy_buff_suppression * 100)}%`);
      if (item.dao_ap) extras.push('Có Đạo Áp');
      statNote = `${domainElementEmoji(item.element)} ${item.element} • ${lm} LM${extras.length ? ` • ${extras.join(' • ')}` : ''}`;
    } else if (item.entity_kind === 'sense') {
      const lm = item.bonus_energy >= 999 ? '∞' : item.bonus_energy;
      const parts = [`+${lm} LM`, `+${Math.round((item.buff_boost_pct || 0) * 100)}% Buff Vực`];
      if (item.clash_resist_chance > 0) parts.push(`${Math.round(item.clash_resist_chance * 100)}% Kháng Mạch`);
      statNote = parts.join(' • ');
    } else {
      statNote = item.desc || `+${Math.round((item.debuff_boost_pct || 0) * 100)}% Debuff`;
    }
    return `• ${item.icon} **${item.name}**${qtyTag} (\`${item.entity_id}\`) • ${item.tier_icon} ${item.rarity} — *${statNote}*${eqTag}`;
  };

  const viewParts = String(options.view || 'overview').toLowerCase().split(':');
  const viewRaw = viewParts[0] || 'overview';
  const view = ['overview', 'domain', 'sense', 'realm'].includes(viewRaw) ? viewRaw : 'overview';
  const requestedPage = options.page !== undefined && options.page !== '' && options.page !== null
    ? options.page
    : (viewParts[1] || 1);

  let paged;
  const bodySections = [];

  if (view === 'domain' || view === 'sense' || view === 'realm') {
    const bucket = view === 'domain' ? domains : view === 'sense' ? senses : realms;
    const kindLabel = view === 'domain' ? 'Linh Vực' : view === 'sense' ? 'Thần Thức' : 'Thần Cảnh';
    paged = paginateFormattedLines(bucket, formatDomainItemLine, { page: requestedPage, pageSize: 15, maxChars: 3050 });
    bodySections.push(
      `**Danh Sách ${kindLabel} (${bucket.length})**`,
      bucket.length === 0
        ? `• *Chưa sở hữu ${kindLabel} nào. Dùng \`/roll loai:domain\` để triệu hồi!*`
        : paged.lines.join('\n'),
    );
  } else {
    const combined = [...domains, ...senses, ...realms];
    paged = paginateFormattedLines(combined, formatDomainItemLine, { page: requestedPage, pageSize: 15, maxChars: 2950 });
    if (combined.length === 0) {
      bodySections.push(
        `**1. Linh Vực (0)**`,
        `• *Chưa sở hữu Linh Vực nào. Dùng \`/roll loai:domain\` để triệu hồi!*`,
        '',
        `**2. Thần Thức (0)**`,
        `• *Chưa sở hữu Thần Thức nào. Dùng \`/roll loai:domain\` để triệu hồi!*`,
        '',
        `**3. Thần Cảnh (0)**`,
        `• *Chưa sở hữu Thần Cảnh nào. Dùng \`/roll loai:domain\` để triệu hồi!*`,
      );
    } else {
      const domLines = [];
      const senseLines = [];
      const realmLines = [];
      for (let i = 0; i < paged.pageItems.length; i += 1) {
        const item = paged.pageItems[i];
        const line = paged.lines[i];
        if (item.entity_kind === 'domain') domLines.push(line);
        else if (item.entity_kind === 'sense') senseLines.push(line);
        else realmLines.push(line);
      }
      if (domLines.length > 0) bodySections.push(`**1. Linh Vực (${domains.length})**`, ...domLines, '');
      if (senseLines.length > 0) bodySections.push(`**2. Thần Thức (${senses.length})**`, ...senseLines, '');
      if (realmLines.length > 0) bodySections.push(`**3. Thần Cảnh (${realms.length})**`, ...realmLines, '');
      if (bodySections[bodySections.length - 1] === '') bodySections.pop();
    }
  }

  const prevPage = paged.page > 1 ? paged.page - 1 : paged.totalPages;
  const nextPage = paged.page < paged.totalPages ? paged.page + 1 : 1;

  const sections = [
    `${em('su_realm_star')} **BỘ LINH VỰC ĐANG TRANG BỊ (HIỆP 2)**`,
    `• **Linh Vực:** ${eqDomain ? `${eqDomain.icon} **${eqDomain.name}**` : '*Trống*'}`,
    `\u00A0\u00A0↳ **Thần Thức:** ${eqSense ? `${eqSense.icon} **${eqSense.name}**` : '*Trống*'}`,
    `\u00A0\u00A0↳ **Thần Cảnh:** ${eqRealm ? `${eqRealm.icon} **${eqRealm.name}**` : '*Trống*'}`,
    `• **Tổng Linh Mạch:** \`${totalLinhMach}\`${paged.totalPages > 1 ? ` • **Trang:** \`${paged.page}/${paged.totalPages}\`` : ''}`,
    '',
    ...bodySections,
  ];
  if (paged.totalPages > 1) {
    sections.push('', `• *Trang ${paged.page}/${paged.totalPages} — Bấm nút **Trang Trước / Trang Sau** bên dưới hoặc gõ \`/linhvuc tab:${view} trang:${nextPage}\` để xem tiếp!*`);
  }

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    view,
    page: paged.page,
    total_pages: paged.totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    total_linh_mach: totalLinhMach,
    equipped: { domain: eqDomain, sense: eqSense, realm: eqRealm },
    domains,
    senses,
    realms,
    counts: { domains: domains.length, senses: senses.length, realms: realms.length },
    title: `${em('su_realm_star')} LINH VỰC TIÊN GIỚI — ${user.username}${paged.totalPages > 1 ? ` (Trang ${paged.page}/${paged.totalPages})` : ''}`,
    description: sections.join('\n').slice(0, 4000),
    footer: '',
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

  return withLoadoutLock(cleanId, () => withDomainLock(cleanId, async () => {
    await ensureUserInitialized(cleanId, { username: options.username });
    const loadoutLock = await checkActiveLoadoutExplorerLock(cleanId);
    if (loadoutLock.locked) {
      return { success: false, status: 400, error: loadoutLock.error, message: loadoutLock.message };
    }
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

    const busyExp = await getUserBusyExplorationAssets(cleanId);
    if (busyExp?.isExploring && busyExp.busyDomainIds.has(resolved.meta.id) && Number(owned.quantity || 1) <= 1) {
      return {
        success: false,
        status: 400,
        error: 'DOMAIN_BUSY_EXPLORING',
        message: `${uiEm('ui_compass_dir')} **${resolved.meta.name}** hiện đang theo Linh Thú đi **Khám Phá Bản Đồ** (\`/explorer\`) nên tạm khóa! Hãy trang bị món khác đang rảnh hoặc chờ chuyến khám phá hoàn tất.`,
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

    await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
    invalidateInventoryCache(cleanId);

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
  }));
}

export async function unequipDomainEntity(userId, rawSlot = 'all') {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const slot = String(rawSlot || 'all').trim().toLowerCase();
  return withLoadoutLock(cleanId, () => withDomainLock(cleanId, async () => {
    const loadoutLock = await checkActiveLoadoutExplorerLock(cleanId);
    if (loadoutLock.locked) {
      return { success: false, status: 400, error: loadoutLock.error, message: loadoutLock.message };
    }
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
    await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
    invalidateInventoryCache(cleanId);
    const labelMap = { domain: 'Linh Vực', sense: 'Thần Thức', realm: 'Thần Cảnh', all: 'toàn bộ Linh Vực • Thần Thức • Thần Cảnh' };
    return {
      success: true,
      slot,
      message: `${em('su_realm_star')} Đã thu hồi **${labelMap[slot] || labelMap.all}** về kho dự trữ.`,
    };
  }));
}

export async function dismantleDomainEntity(userId, rawTarget) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const qRaw = String(rawTarget || '').trim();
  const qLower = qRaw.toLowerCase();
  const BATCH_MODES = new Set(['all_dup', 'all_common', 'all_rare', 'all_epic']);
  const isBatchKeyword = BATCH_MODES.has(qLower);
  const commaTokens = !isBatchKeyword && qRaw.includes(',')
    ? qRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  if (isBatchKeyword || (commaTokens && commaTokens.length > 0)) {
    return withDomainLock(cleanId, async () => {
      const { user } = await ensureUserInitialized(cleanId);
      const [{ data: rows }, busyExp] = await Promise.all([
        supabase.from('user_domains').select('*').eq('user_id', cleanId),
        getUserBusyExplorationAssets(cleanId),
      ]);

      const getMeta = (row) => (row.entity_kind === 'domain'
        ? DOMAIN_BY_ID[row.entity_id]
        : row.entity_kind === 'sense'
          ? DIVINE_SENSE_BY_ID[row.entity_id]
          : DIVINE_REALM_BY_ID[row.entity_id]);

      const isProtected = (row, meta) => {
        if (!meta) return true;
        if (meta.is_exclusive_fuyumi || meta.is_unique) return true;
        if (meta.rarity_key === 'mythic' || meta.rarity_key === 'supreme') return true;
        return false;
      };

      const targetRarity = qLower === 'all_common' ? 'common' : qLower === 'all_rare' ? 'rare' : qLower === 'all_epic' ? 'epic' : null;
      const wantedKeys = commaTokens
        ? new Set(commaTokens.map((t) => resolveDomainEntityQuery(t)?.meta?.id).filter(Boolean))
        : null;

      let totalUnits = 0;
      let totalRefund = 0;
      const ops = [];
      const nowIso = new Date().toISOString();
      const labels = [];

      for (const row of rows || []) {
        const meta = getMeta(row);
        if (isProtected(row, meta)) continue;
        const qty = Math.max(1, Number(row.quantity || 1));
        const isBusy = Boolean(busyExp?.isExploring && busyExp.busyDomainIds.has(row.entity_id));

        if (qLower === 'all_dup') {
          if (qty <= 1) continue;
          const count = qty - 1;
          const lt = count * (DOMAIN_DISMANTLE_VALUES[meta.rarity_key] || 6);
          totalUnits += count;
          totalRefund += lt;
          labels.push(`${count}× ${meta.name}`);
          ops.push(supabase.from('user_domains').update({ quantity: 1, updated_at: nowIso }).eq('id', row.id));
          continue;
        }

        if (targetRarity && meta.rarity_key !== targetRarity) continue;
        if (wantedKeys && !wantedKeys.has(row.entity_id)) continue;

        const keepOne = Boolean(row.is_equipped || isBusy);
        const count = keepOne ? (qty - 1) : qty;
        if (count <= 0) continue;

        const lt = count * (DOMAIN_DISMANTLE_VALUES[meta.rarity_key] || 6);
        totalUnits += count;
        totalRefund += lt;
        labels.push(`${count}× ${meta.name}`);
        if (keepOne) {
          ops.push(supabase.from('user_domains').update({ quantity: 1, updated_at: nowIso }).eq('id', row.id));
        } else {
          ops.push(supabase.from('user_domains').delete().eq('id', row.id));
        }
      }

      if (totalUnits === 0) {
        return {
          success: false,
          status: 400,
          error: 'NOTHING_TO_DISMANTLE',
          message: `${uiEm('ui_warn')} Không có Linh Vực / Thần Thức / Thần Cảnh hợp lệ để phân giải *(đã khóa bảo vệ món đang dùng, đang khám phá, và Thần Thoại / Độc Nhất)*.`,
        };
      }

      const nextBal = Number(user?.linh_thach || 0) + totalRefund;
      ops.push(supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId));
      ops.push(trackQuestActivity(cleanId, { craftDelta: totalUnits }));
      await Promise.all(ops);

      return {
        success: true,
        mode: isBatchKeyword ? qLower : 'batch_list',
        dismantled_count: totalUnits,
        refund_linh_thach: totalRefund,
        linh_thach: nextBal,
        message: `${em('su_realm_star')} Đã phân giải nhanh **${totalUnits}** Linh Vực/Thần Thức/Thần Cảnh (${labels.slice(0, 6).join(', ')}${labels.length > 6 ? `, +${labels.length - 6} loại khác` : ''}) → Thu hồi **+${totalRefund.toLocaleString('vi-VN')}** ${em('su_linhthach')} *(Số dư: **${nextBal.toLocaleString('vi-VN')} LT**)*.`,
      };
    });
  }

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
    const busyExp = await getUserBusyExplorationAssets(cleanId);
    if (busyExp?.isExploring && busyExp.busyDomainIds.has(resolved.meta.id) && row.quantity <= 1) {
      return { success: false, status: 400, error: 'DOMAIN_BUSY_EXPLORING', message: `${uiEm('ui_compass_dir')} **${resolved.meta.name}** đang được trang bị trong chuyến Khám Phá (\`/explorer\`) — không thể phân giải lúc này!` };
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
    ops.push(trackQuestActivity(cleanId, { craftDelta: 1 }));
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
