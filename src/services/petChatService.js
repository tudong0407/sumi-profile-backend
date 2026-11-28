/**
 * src/services/petChatService.js
 * SuMi Family Ver 1.8B — Hệ Thống Trò Chuyện Tâm Tình & AI Chat với Linh Thú (/pet -> Trò Chuyện):
 * - Phàm/Linh/Tiên: Dùng kho lời thoại >2.800 câu tự nhiên (`mode: 'sample'`).
 * - Thần Thoại: 5 lượt AI/ngày -> hết lượt tự rơi về `mode: 'sample'`.
 * - Độc Nhất / Chân Thần: 10 lượt AI/ngày -> hết lượt rơi về `mode: 'sample'`.
 * - « Cửu Vĩ Hồng Hồ » / Hồng Mông Đế Nữ (Fuyumi): AI KHÔNG GIỚI HẠN lượt/ngày.
 * - Lưu trí nhớ 5 lượt đối thoại gần nhất (10 dòng) trong bảng `pet_chat_history`.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import { PET_BY_TYPE } from '../data/catalog.js';
import { em } from '../config/emojiHelper.js';
import { getVnDateKey } from './luckAndFortuneService.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import {
  computeBondTierState,
  getAiChatDailyLimitForPet,
  getPetArchetype,
  PET_BOND_INTERACT_DAILY_MAX,
  PET_BOND_INTERACT_POINTS,
  PET_BOND_INTERACT_COOLDOWN_MS,
} from '../data/v18PetBondCatalog.js';
import {
  pickPetInteractionDialogue,
  ARCHETYPE_STYLE_PROMPTS,
  UNIQUE_PET_SIGNATURE_QUOTES,
} from '../data/v18PetDialogueBank.js';
import {
  __getMemBondStore,
  isPetBondTestMode,
  getPetBondHub,
  maybeUnlockBondFrameForPet,
} from './petBondService.js';

export const PET_CHAT_HISTORY_MAX_ROWS = 10; // 5 lượt hỏi + 5 lượt đáp

function getActiveSupabase() {
  return isPetBondTestMode() ? null : (supabase || _supabase);
}

async function fetchRecentHistory(userId, petId, limit = PET_CHAT_HISTORY_MAX_ROWS) {
  const db = getActiveSupabase();
  if (!db) {
    const key = `${userId}:${petId}`;
    const arr = __getMemBondStore().chatHistory.get(key) || [];
    return arr.slice(-limit);
  }
  const { data } = await db
    .from('pet_chat_history')
    .select('id, role, content, mode, created_at')
    .eq('user_id', userId)
    .eq('pet_id', Number(petId))
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

async function appendChatTurns(userId, petId, userMessage, petReply, mode = 'sample', now = new Date()) {
  const db = getActiveSupabase();
  const cleanMsg = String(userMessage || '').trim().slice(0, 600);
  const cleanRep = String(petReply || '').trim().slice(0, 1200);
  const t1 = now.toISOString();
  const t2 = new Date(now.getTime() + 5).toISOString();

  if (!db) {
    const store = __getMemBondStore().chatHistory;
    const key = `${userId}:${petId}`;
    const arr = store.get(key) || [];
    if (cleanMsg) arr.push({ role: 'user', content: cleanMsg, mode, created_at: t1 });
    if (cleanRep) arr.push({ role: 'assistant', content: cleanRep, mode, created_at: t2 });
    store.set(key, arr.slice(-PET_CHAT_HISTORY_MAX_ROWS));
    return store.get(key);
  }

  const rows = [];
  if (cleanMsg) rows.push({ user_id: userId, pet_id: Number(petId), role: 'user', content: cleanMsg, mode, created_at: t1 });
  if (cleanRep) rows.push({ user_id: userId, pet_id: Number(petId), role: 'assistant', content: cleanRep, mode, created_at: t2 });
  if (rows.length > 0) {
    await db.from('pet_chat_history').insert(rows);
  }

  // Giữ tối đa 10 dòng mới nhất (5 cặp hỏi-đáp) cho mỗi pet
  const { data: allRows } = await db
    .from('pet_chat_history')
    .select('id')
    .eq('user_id', userId)
    .eq('pet_id', Number(petId))
    .order('created_at', { ascending: false });

  if (allRows && allRows.length > PET_CHAT_HISTORY_MAX_ROWS) {
    const deleteIds = allRows.slice(PET_CHAT_HISTORY_MAX_ROWS).map((r) => r.id);
    if (deleteIds.length > 0) {
      await db.from('pet_chat_history').delete().in('id', deleteIds);
    }
  }
  return fetchRecentHistory(userId, petId, PET_CHAT_HISTORY_MAX_ROWS);
}

export function buildPetAiSystemPrompt({ user, pet, bond }) {
  const meta = PET_BY_TYPE[pet.pet_type] || {};
  const archKey = getPetArchetype(pet.pet_type);
  const style = ARCHETYPE_STYLE_PROMPTS[archKey] || ARCHETYPE_STYLE_PROMPTS.fox;
  const sigQuotes = UNIQUE_PET_SIGNATURE_QUOTES[pet.pet_type] || [];
  const cleanOwner = pickCleanDisplayValue(user?.username) || 'Chủ nhân';
  const cleanPetName = String(pet.pet_name || meta.pet_name || pet.pet_type).replace(/[«»]/g, '').trim();
  const isFuyumiPet = pet.pet_type === 'cuu_vi_hong_ho';

  const loreBlock = isFuyumiPet
    ? 'Bạn là Hồng Mông Đế Nữ (Cửu Vĩ Hồng Hồ) — linh thú tối thượng độc quyền đồng hành vĩnh hằng cùng chủ nhân Fuyumi. Giọng điệu vừa cao quý uy nghi vừa dịu dàng thâm tình tuyệt đối với riêng chủ nhân.'
    : `Bạn là Linh Thú "${cleanPetName}" (${meta.rarity || pet.pet_rarity}, hệ ${meta.element || 'Linh Khí'}), thuộc tính cách "${style.label}": ${style.tone}`;

  const signatureHint = sigQuotes.length > 0
    ? `Câu thoại đặc trưng gợi ý phong cách: "${sigQuotes[0]}"`
    : '';

  return [
    loreBlock,
    `Chủ nhân của bạn tên là "${cleanOwner}". Hiện tại mức Thiện Cảm của bạn với chủ nhân đang ở Bậc ${bond.tier}/${bond.maxTier} ("${bond.tierLabel}" — ${bond.points}/${bond.maxPoints} điểm). Hãy thể hiện đúng mức độ thân thiết tương ứng (từ dè dặt lịch sự khi bậc thấp đến gắn bó sâu sắc tri kỷ ở bậc cao).`,
    signatureHint,
    'YÊU CẦU ĐỊNH DẠNG BẮT BUỘC:',
    '- Trả lời hoàn toàn bằng tiếng Việt tự nhiên, mượt mà, chuẩn không khí Tu Tiên SuMi Family, tối đa 2-4 câu (khoảng 35-95 từ).',
    '- Luôn mở đầu bằng một hành động/cử chỉ ngắn đặt trong cặp dấu sao `*...*` phù hợp với loài của mình, theo sau là lời nói đặt trong ngoặc kép `"..."`.',
    '- TUYỆT ĐỐI KHÔNG dùng tiếng kêu động vật sáo rỗng ("gâu gâu", "meo meo", "chíp chíp"), KHÔNG phá vỡ vai diễn, KHÔNG nhắc đến AI/prompt/system.',
    '- Không dùng emoji thừa thãi.',
  ].filter(Boolean).join('\n');
}

function formatGeminiContents(systemPrompt, history, userMessage) {
  const contents = [];
  for (const h of history || []) {
    if (!h?.content) continue;
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(h.content) }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: String(userMessage || '').trim() || 'Chủ nhân khẽ gọi tên bạn.' }],
  });
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 220,
    },
  };
}

/**
 * Chuẩn bị lượt Trò Chuyện (/pet -> Nút Trò Chuyện -> Modal nhập lời nhắn):
 * - Nếu hết AI quota hoặc Common/Rare/Epic -> trả ngay `mode: 'sample'` + lưu turn + cộng điểm interact nếu còn lượt.
 * - Nếu đủ AI quota -> trả `mode: 'ai'`, `gemini_payload` để BotGhost gọi Gemini (hoặc fallback nếu lỗi).
 */
export async function preparePetAiChat(userId, rawUserMessage = '', opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const db = getActiveSupabase();
  let user = null;
  let pet = null;
  if (!db) {
    const store = __getMemBondStore();
    user = store.users.get(cleanId) || null;
    const pets = store.pets.get(cleanId) || [];
    pet = pets.find((p) => p.is_active) || pets[0] || null;
  } else {
    const initRes = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    user = initRes.user;
    const { data: p } = await db
      .from('user_pets')
      .select('*')
      .eq('user_id', cleanId)
      .order('is_active', { ascending: false })
      .order('pet_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    pet = p || null;
  }

  if (!user) return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' };
  if (!pet) return { success: false, status: 200, has_pet: false, error: 'NO_ACTIVE_PET', message: 'Bạn chưa có Linh Thú nào để trò chuyện!' };
  if (pet.status === 'injured') {
    return {
      success: false,
      status: 200,
      error: 'PET_INJURED',
      message: `${pet.pet_name} đang bị Trọng Thương, cần hồi sinh bằng Cửu Chuyển Hoàn Hồn Lộ trong /explorer trước!`,
    };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const todayVn = getVnDateKey(now);
  const bond = computeBondTierState(pet);
  const userMessage = String(rawUserMessage || '').trim().slice(0, 500) || 'Hôm nay thế nào rồi?';

  const aiLimit = getAiChatDailyLimitForPet(pet);
  const aiUsedToday = pet.daily_ai_chat_date === todayVn ? Number(pet.daily_ai_chat_count || 0) : 0;
  const isUnlimited = aiLimit === Infinity;
  const canAiChat = isUnlimited || aiUsedToday < aiLimit;
  const mode = canAiChat ? 'ai' : 'sample';

  const history = await fetchRecentHistory(cleanId, pet.pet_id, PET_CHAT_HISTORY_MAX_ROWS);
  const fallbackDialogue = pickPetInteractionDialogue({
    petType: pet.pet_type,
    petName: pet.pet_name,
    action: 'chat',
    tier: bond.tier,
    maxTier: bond.maxTier,
    userMessage,
    seed: opts.seed !== undefined ? opts.seed : `${cleanId}:chat:${now.getTime()}`,
  });

  if (mode === 'sample') {
    await appendChatTurns(cleanId, pet.pet_id, userMessage, fallbackDialogue.formatted, 'sample', now);
    // Cộng điểm interact nếu còn lượt & hết hồi chiêu
    const interactBonus = await maybeAwardChatInteractPoints({ db, cleanId, user, pet, now });
    const hub = await getPetBondHub(cleanId, { ...opts, now });
    const aiQuotaNote = aiLimit > 0
      ? ` *(đã dùng hết **${aiUsedToday}/${aiLimit}** lượt AI hôm nay — chuyển dùng kho thoại)*`
      : '';
    const replyBlock = [
      `${em('pet_act_chat', em('su_sparkle'))} **Bạn:** "${userMessage}"${aiQuotaNote}`,
      `> ${fallbackDialogue.formatted}`,
      interactBonus.note || '',
    ].filter(Boolean).join('\n');

    return {
      ...hub,
      mode: 'sample',
      can_ai_chat: false,
      ai_limit: aiLimit === Infinity ? 9999 : aiLimit,
      ai_used: aiUsedToday,
      ai_remaining: 0,
      user_message: userMessage,
      pet_reply: fallbackDialogue.formatted,
      fallback_reply: fallbackDialogue.formatted,
      history_count: Math.min(PET_CHAT_HISTORY_MAX_ROWS, history.length + 2),
      gained_points: interactBonus.gainedPoints,
      description: `${replyBlock}\n\n───────────────────\n\n${hub.description}`,
      message: `${replyBlock}\n\n───────────────────\n\n${hub.description}`,
    };
  }

  const systemPrompt = buildPetAiSystemPrompt({ user, pet, bond });
  const geminiPayload = formatGeminiContents(systemPrompt, history, userMessage);
  const geminiHistoryText = (history || [])
    .map((h) => `${h.role === 'assistant' ? cleanNameForHistory(pet.pet_name) : 'Chủ nhân'}: ${String(h.content || '').trim()}`)
    .join('\n') || '(Chưa có lịch sử trước đó)';

  return {
    success: true,
    status: 200,
    has_pet: true,
    mode: 'ai',
    can_ai_chat: true,
    unlimited: isUnlimited,
    ai_limit: isUnlimited ? 9999 : aiLimit,
    ai_used: aiUsedToday,
    ai_remaining: isUnlimited ? 9999 : Math.max(0, aiLimit - aiUsedToday),
    pet_id: pet.pet_id,
    pet_type: pet.pet_type,
    pet_name: pet.pet_name,
    user_message: userMessage,
    fallback_reply: fallbackDialogue.formatted,
    history_count: history.length,
    gemini_system_prompt: systemPrompt,
    gemini_history_text: geminiHistoryText,
    gemini_payload: geminiPayload,
    gemini_payload_json: JSON.stringify(geminiPayload),
    gemini_user_message: userMessage,
  };
}

function cleanNameForHistory(raw) {
  return String(raw || 'Linh Thú').replace(/[«»]/g, '').trim();
}

async function maybeAwardChatInteractPoints({ db, cleanId, user, pet, now }) {
  const todayVn = getVnDateKey(now);
  const bond = computeBondTierState(pet);
  const usedToday = pet.daily_interact_date === todayVn ? Number(pet.daily_interact_count || 0) : 0;
  const lastMs = pet.last_interacted_at ? new Date(pet.last_interacted_at).getTime() : 0;
  const onCooldown = lastMs > 0 && (now.getTime() - lastMs) < PET_BOND_INTERACT_COOLDOWN_MS;
  if (usedToday >= PET_BOND_INTERACT_DAILY_MAX || onCooldown || bond.isMaxTier) {
    return { gainedPoints: 0, note: '' };
  }

  const nextPts = Math.min(bond.maxPoints, bond.points + PET_BOND_INTERACT_POINTS);
  const gainedPoints = nextPts - bond.points;
  const nextState = computeBondTierState(pet, nextPts);
  const patch = {
    affection_points: nextPts,
    affection_tier: nextState.tier,
    daily_interact_date: todayVn,
    daily_interact_count: usedToday + 1,
    last_interacted_at: now.toISOString(),
  };

  if (!db) {
    Object.assign(pet, patch);
  } else {
    await db.from('user_pets').update(patch).eq('pet_id', pet.pet_id);
    Object.assign(pet, patch);
  }
  await maybeUnlockBondFrameForPet({ userId: cleanId, user, pet });
  return {
    gainedPoints,
    note: gainedPoints > 0 ? `*Tâm tình tương thông: **+${gainedPoints} Thiện Cảm** (${usedToday + 1}/${PET_BOND_INTERACT_DAILY_MAX})*` : '',
  };
}

/**
 * Lưu câu trả lời AI (hoặc fallback nếu Gemini gặp sự cố) + trừ lượt AI nếu usedAi === true.
 */
export async function savePetAiChatReply(userId, payload = {}, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const db = getActiveSupabase();
  let user = null;
  let pet = null;
  if (!db) {
    const store = __getMemBondStore();
    user = store.users.get(cleanId) || null;
    const pets = store.pets.get(cleanId) || [];
    pet = payload.petId
      ? (pets.find((p) => Number(p.pet_id) === Number(payload.petId)) || pets.find((p) => p.is_active) || pets[0])
      : (pets.find((p) => p.is_active) || pets[0] || null);
  } else {
    const initRes = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    user = initRes.user;
    const { data: p } = await db
      .from('user_pets')
      .select('*')
      .eq('user_id', cleanId)
      .order('is_active', { ascending: false })
      .order('pet_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    pet = p || null;
  }

  if (!user || !pet) {
    return { success: false, status: 200, error: 'NO_ACTIVE_PET', message: 'Không tìm thấy Linh Thú đang xuất trận.' };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const todayVn = getVnDateKey(now);
  const bond = computeBondTierState(pet);
  const userMessage = String(payload.userMessage || payload.user_message || '').trim().slice(0, 500) || 'Chủ nhân khẽ gọi tên bạn.';

  let rawReply = String(payload.petReply || payload.pet_reply || '').trim();
  let usedAi = Boolean(payload.usedAi ?? payload.used_ai ?? Boolean(rawReply));
  if (!rawReply || rawReply === 'undefined' || rawReply === 'null') {
    const fb = pickPetInteractionDialogue({
      petType: pet.pet_type,
      petName: pet.pet_name,
      action: 'chat',
      tier: bond.tier,
      maxTier: bond.maxTier,
      userMessage,
      seed: opts.seed !== undefined ? opts.seed : `${cleanId}:fb:${now.getTime()}`,
    });
    rawReply = fb.formatted;
    usedAi = false;
  }

  const aiLimit = getAiChatDailyLimitForPet(pet);
  let aiUsedToday = pet.daily_ai_chat_date === todayVn ? Number(pet.daily_ai_chat_count || 0) : 0;
  if (usedAi && aiLimit > 0 && aiLimit !== Infinity) {
    aiUsedToday += 1;
    const aiPatch = {
      daily_ai_chat_date: todayVn,
      daily_ai_chat_count: aiUsedToday,
    };
    if (!db) {
      Object.assign(pet, aiPatch);
    } else {
      await db.from('user_pets').update(aiPatch).eq('pet_id', pet.pet_id);
      Object.assign(pet, aiPatch);
    }
  }

  const history = await appendChatTurns(cleanId, pet.pet_id, userMessage, rawReply, usedAi ? 'ai' : 'sample', now);
  const interactBonus = await maybeAwardChatInteractPoints({ db, cleanId, user, pet, now });
  const hub = await getPetBondHub(cleanId, { ...opts, now });

  const chatIcon = em('pet_act_chat', em('su_sparkle'));
  const aiRemaining = aiLimit === Infinity ? 9999 : Math.max(0, aiLimit - aiUsedToday);
  const quotaTag = usedAi
    ? (aiLimit === Infinity ? ' *(AI Độc Quyền)*' : ` *(AI còn ${aiRemaining}/${aiLimit})*`)
    : ' *(Kho Thoại)*';
  const replyBlock = [
    `${chatIcon} **Bạn:** "${userMessage}"${quotaTag}`,
    `> ${rawReply}`,
    interactBonus.note || '',
  ].filter(Boolean).join('\n');

  return {
    ...hub,
    mode: usedAi ? 'ai' : 'sample',
    used_ai: usedAi,
    ai_limit: aiLimit === Infinity ? 9999 : aiLimit,
    ai_used: aiUsedToday,
    ai_remaining: aiRemaining,
    user_message: userMessage,
    pet_reply: rawReply,
    history_count: history.length,
    gained_points: interactBonus.gainedPoints,
    description: `${replyBlock}\n\n───────────────────\n\n${hub.description}`,
    message: `${replyBlock}\n\n───────────────────\n\n${hub.description}`,
  };
}
