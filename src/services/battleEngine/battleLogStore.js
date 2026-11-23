/**
 * src/services/battleEngine/battleLogStore.js
 * Kho lưu trữ Nhật Ký Trận Đấu tương tác 2 tầng (RAM LRU + Supabase 48 giờ / 2 ngày)
 * dùng chung cho Battle 1v1, Tháp Thí Luyện và Chiến Báo Tổ Đội (/linhmach).
 * - Snapshot JSON nhẹ theo từng hiệp (không pre-render toàn bộ hiệp lúc đánh).
 * - Buffer ảnh từng hiệp chỉ render on-demand khi user mở trang Web Logs, giữ trong LRU tối đa 240 frame để an toàn RAM Render 512MB.
 */

import { supabase } from '../../config/supabase.js';

export const BATTLE_LOG_TTL_MS = 48 * 60 * 60 * 1000; // 48 giờ = 2 ngày
const MAX_RAM_RECORDS = 40;
const MAX_FRAME_BUFFERS = 60;

const recordCache = new Map(); // battleId -> { battleKind, channelId, participantIds, payload, createdAtMs, expiresAtMs }
const latestByChannel = new Map(); // channelId -> battleId
const latestByUserKind = new Map(); // `${battleKind}:${userId}` -> battleId
const frameBufferCache = new Map(); // `${battleId}:${key}` -> { buffer, createdAtMs }
let lastCleanupAtMs = 0;

export function getBattleLogStoreStats() {
  let frameBytes = 0;
  for (const v of frameBufferCache.values()) {
    frameBytes += Number(v?.buffer?.length || 0);
  }
  return {
    records: recordCache.size,
    recordLimit: MAX_RAM_RECORDS,
    frameBuffers: frameBufferCache.size,
    frameBufferLimit: MAX_FRAME_BUFFERS,
    frameBuffersMb: Number((frameBytes / (1024 * 1024)).toFixed(2)),
  };
}

function trimMap(map, limit) {
  while (map.size > limit) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

export function clearBattleLogStoreMemory() {
  recordCache.clear();
  latestByChannel.clear();
  latestByUserKind.clear();
  frameBufferCache.clear();
}

export function getCachedTurnBuffer(battleId, key) {
  const fullKey = `${String(battleId || '').trim()}:${String(key)}`;
  const hit = frameBufferCache.get(fullKey);
  if (!hit) return null;
  if (Date.now() - hit.createdAtMs > BATTLE_LOG_TTL_MS) {
    frameBufferCache.delete(fullKey);
    return null;
  }
  frameBufferCache.delete(fullKey);
  frameBufferCache.set(fullKey, hit);
  return hit.buffer;
}

export function setCachedTurnBuffer(battleId, key, buffer) {
  if (!battleId || !buffer) return;
  const fullKey = `${String(battleId || '').trim()}:${String(key)}`;
  if (frameBufferCache.has(fullKey)) frameBufferCache.delete(fullKey);
  frameBufferCache.set(fullKey, { buffer, createdAtMs: Date.now() });
  trimMap(frameBufferCache, MAX_FRAME_BUFFERS);
}

export async function saveBattleLogRecord({
  battleId,
  battleKind = '1v1',
  channelId = null,
  participantIds = [],
  payload,
  nowMs = Date.now(),
} = {}) {
  const cleanId = String(battleId || '').trim();
  if (!cleanId || !payload) return null;

  const cleanParticipants = [...new Set(
    (participantIds || [])
      .map((x) => String(x || '').trim())
      .filter((x) => /^[0-9]{15,22}$/.test(x)),
  )];

  const createdAtMs = Number(payload.createdAtMs) || nowMs;
  const expiresAtMs = Number(payload.expiresAtMs) || (createdAtMs + BATTLE_LOG_TTL_MS);
  const enrichedPayload = {
    ...payload,
    createdAtMs,
    expiresAtMs,
  };

  if (recordCache.has(cleanId)) recordCache.delete(cleanId);
  recordCache.set(cleanId, {
    battleId: cleanId,
    battleKind,
    channelId: channelId ? String(channelId).trim() : null,
    participantIds: cleanParticipants,
    payload: enrichedPayload,
    createdAtMs,
    expiresAtMs,
  });
  trimMap(recordCache, MAX_RAM_RECORDS);

  if (channelId) {
    const ch = String(channelId).trim();
    latestByChannel.delete(ch);
    latestByChannel.set(ch, cleanId);
    trimMap(latestByChannel, 250);
  }
  for (const uid of cleanParticipants) {
    const uk = `${battleKind}:${uid}`;
    latestByUserKind.delete(uk);
    latestByUserKind.set(uk, cleanId);
    const anyKey = `any:${uid}`;
    latestByUserKind.delete(anyKey);
    latestByUserKind.set(anyKey, cleanId);
  }
  trimMap(latestByUserKind, 600);

  if (supabase) {
    try {
      await supabase.from('battle_logs').upsert({
        battle_id: cleanId,
        battle_kind: battleKind,
        channel_id: channelId ? String(channelId).trim() : null,
        participant_ids: cleanParticipants,
        payload: enrichedPayload,
        created_at: new Date(createdAtMs).toISOString(),
        expires_at: new Date(expiresAtMs).toISOString(),
      }, { onConflict: 'battle_id' });
    } catch (err) {
      console.warn('[BattleLogStore] Persist to Supabase failed (non-blocking):', err.message);
    }
  }

  return enrichedPayload;
}

export async function loadBattleLogRecord({
  battleId = null,
  channelId = null,
  userId = null,
  battleKind = null,
  nowMs = Date.now(),
} = {}) {
  const cleanId = battleId && !/^\{/.test(String(battleId)) ? String(battleId).trim() : null;
  const cleanChannel = channelId && !/^\{/.test(String(channelId)) ? String(channelId).trim() : null;
  const cleanUser = userId && !/^\{/.test(String(userId)) ? String(userId).trim() : null;

  const pickValidRam = (id) => {
    if (!id || !recordCache.has(id)) return null;
    const rec = recordCache.get(id);
    if (nowMs > rec.expiresAtMs) {
      recordCache.delete(id);
      return null;
    }
    if (battleKind && battleKind === 'team' && rec.battleKind !== 'team') return null;
    if (battleKind && battleKind === '1v1' && rec.battleKind === 'team') return null;
    return rec.payload;
  };

  if (cleanId) {
    const ram = pickValidRam(cleanId);
    if (ram) return ram;
  }
  if (!cleanId && cleanChannel) {
    const chBid = latestByChannel.get(cleanChannel);
    const ram = pickValidRam(chBid);
    if (ram) return ram;
  }
  if (!cleanId && cleanUser) {
    const uk = `${battleKind || 'any'}:${cleanUser}`;
    const uBid = latestByUserKind.get(uk) || latestByUserKind.get(`1v1:${cleanUser}`);
    const ram = pickValidRam(uBid);
    if (ram) return ram;
  }

  if (!supabase) return null;

  try {
    const nowIso = new Date(nowMs).toISOString();
    let query = supabase
      .from('battle_logs')
      .select('battle_id, battle_kind, channel_id, participant_ids, payload, created_at, expires_at')
      .gt('expires_at', nowIso);

    if (cleanId) {
      query = query.eq('battle_id', cleanId).limit(1);
    } else if (cleanChannel) {
      query = query.eq('channel_id', cleanChannel).order('created_at', { ascending: false }).limit(1);
    } else if (cleanUser && /^[0-9]{15,22}$/.test(cleanUser)) {
      if (battleKind === 'team') {
        query = query.eq('battle_kind', 'team');
      } else if (battleKind === '1v1') {
        query = query.in('battle_kind', ['1v1', 'tower']);
      }
      query = query.contains('participant_ids', [cleanUser]).order('created_at', { ascending: false }).limit(1);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data?.payload) return null;

    const createdAtMs = data.created_at ? Date.parse(data.created_at) : nowMs;
    const expiresAtMs = data.expires_at ? Date.parse(data.expires_at) : (createdAtMs + BATTLE_LOG_TTL_MS);
    const payload = {
      ...data.payload,
      battleId: data.payload.battleId || data.battle_id,
      createdAtMs,
      expiresAtMs,
    };

    recordCache.set(data.battle_id, {
      battleId: data.battle_id,
      battleKind: data.battle_kind,
      channelId: data.channel_id || null,
      participantIds: Array.isArray(data.participant_ids) ? data.participant_ids : [],
      payload,
      createdAtMs,
      expiresAtMs,
    });
    trimMap(recordCache, MAX_RAM_RECORDS);
    return payload;
  } catch (err) {
    console.warn('[BattleLogStore] Load from Supabase failed:', err.message);
    return null;
  }
}

export async function cleanupExpiredBattleLogs({ force = false, nowMs = Date.now() } = {}) {
  if (!force && nowMs - lastCleanupAtMs < 55 * 60 * 1000) {
    return { skipped: true };
  }
  lastCleanupAtMs = nowMs;

  for (const [bid, rec] of recordCache.entries()) {
    if (nowMs > rec.expiresAtMs) recordCache.delete(bid);
  }
  for (const [k, hit] of frameBufferCache.entries()) {
    if (nowMs - hit.createdAtMs > BATTLE_LOG_TTL_MS) frameBufferCache.delete(k);
  }

  if (!supabase) return { deleted: 0 };
  try {
    const { data, error } = await supabase
      .from('battle_logs')
      .delete()
      .lt('expires_at', new Date(nowMs).toISOString())
      .select('battle_id');
    if (error) return { deleted: 0, error: error.message };
    return { deleted: Array.isArray(data) ? data.length : 0 };
  } catch (err) {
    return { deleted: 0, error: err.message };
  }
}
