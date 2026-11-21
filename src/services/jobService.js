/**
 * src/services/jobService.js
 * Hệ thống 6 Nghề Tu Tiên (/job):
 * - Giới hạn 6 ca/ngày (UTC+7), hồi chiêu 1 giờ/ca.
 * - Thưởng Linh Thạch + EXP, đồng thời cộng tiến độ Hợp Đồng Tuần (/nhiemvu).
 */

import { supabase } from '../config/supabase.js';
import {
  JOBS_CATALOG,
  JOB_BY_ID,
  JOB_DAILY_LIMIT,
  JOB_COOLDOWN_MS,
} from '../data/catalog.js';
import { em } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  computeRoleBuffTotals,
  getRealmByLevel,
  getMaxRoleSlotsByLevel,
} from './profileService.js';
import { computeTotalAccumulatedExp, decomposeTotalExp } from './economyService.js';
import { getVnDateKey, trackQuestActivity } from './questService.js';

const jobLocks = new Map();

async function withJobLock(userId, fn) {
  const prev = jobLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  jobLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (jobLocks.get(userId) === queued) jobLocks.delete(userId);
  }
}

function formatCooldownLeft(ms) {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins > 0) return `${mins} phút ${secs} giây`;
  return `${secs} giây`;
}

export async function getJobStatus(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const { data: qRow } = await supabase
    .from('user_quests')
    .select('job_date, jobs_today, last_job_at, last_job_id, weekly_week_key, weekly_jobs_done')
    .eq('user_id', cleanId)
    .maybeSingle();

  const todayKey = getVnDateKey(now);
  const jobsToday = qRow?.job_date === todayKey ? Number(qRow?.jobs_today || 0) : 0;
  const lastJobMs = qRow?.last_job_at ? new Date(qRow.last_job_at).getTime() : 0;
  const remainingMs = lastJobMs > 0 ? Math.max(0, JOB_COOLDOWN_MS - (now.getTime() - lastJobMs)) : 0;

  const jobListText = JOBS_CATALOG.map((j) =>
    `• ${j.icon} **${j.name}** (\`${j.job_id}\`) — \`${j.ltMin}–${j.ltMax}\` ${em('su_linhthach')} • **+${j.exp} EXP**\n  *${j.summary}*`,
  ).join('\n');

  const cooldownLine = jobsToday >= JOB_DAILY_LIMIT
    ? `• Hôm nay đã làm hết **${JOB_DAILY_LIMIT}/${JOB_DAILY_LIMIT} ca** (reset 00:00 UTC+7).`
    : remainingMs > 0
      ? `• Đang nghỉ hồi sức: còn **${formatCooldownLeft(remainingMs)}** nữa mới nhận ca tiếp.`
      : `• Sẵn sàng nhận việc! Dùng \`/job nghe:<ten_nghe>\` hoặc chọn bên dưới.`;

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    job_date: todayKey,
    jobs_today: jobsToday,
    daily_limit: JOB_DAILY_LIMIT,
    remaining_shifts: Math.max(0, JOB_DAILY_LIMIT - jobsToday),
    cooldown_remaining_ms: remainingMs,
    cooldown_remaining_text: remainingMs > 0 ? formatCooldownLeft(remainingMs) : '',
    can_work: jobsToday < JOB_DAILY_LIMIT && remainingMs === 0,
    jobs: JOBS_CATALOG,
    message: [
      `${em('su_linhthach')} **BẢNG VIỆC LÀM TIÊN GIỚI (${jobsToday}/${JOB_DAILY_LIMIT} ca hôm nay)**`,
      cooldownLine,
      '',
      jobListText,
    ].join('\n'),
  };
}

export async function doJob(userId, rawJobId = '', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const cleanJobKey = String(rawJobId || '').trim().toLowerCase();
  const job = JOB_BY_ID[cleanJobKey];
  if (!job) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_JOB',
      message: `Nghề \`${rawJobId}\` không hợp lệ! Hãy chọn 1 trong 6 nghề: ${JOBS_CATALOG.map((j) => `\`${j.job_id}\``).join(', ')}.`,
    };
  }

  return withJobLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const { data: qRow } = await supabase
      .from('user_quests')
      .select('job_date, jobs_today, last_job_at, last_job_id')
      .eq('user_id', cleanId)
      .maybeSingle();

    const todayKey = getVnDateKey(now);
    const jobsToday = qRow?.job_date === todayKey ? Number(qRow?.jobs_today || 0) : 0;

    if (jobsToday >= JOB_DAILY_LIMIT) {
      return {
        success: false,
        status: 400,
        error: 'JOB_DAILY_LIMIT_REACHED',
        jobs_today: jobsToday,
        daily_limit: JOB_DAILY_LIMIT,
        message: `${job.icon} Bạn đã làm hết **${JOB_DAILY_LIMIT}/${JOB_DAILY_LIMIT} ca** hôm nay rồi! Hãy nghỉ ngơi và quay lại sau **00:00 UTC+7**.`,
      };
    }

    const lastJobMs = qRow?.last_job_at ? new Date(qRow.last_job_at).getTime() : 0;
    const elapsedMs = now.getTime() - lastJobMs;
    if (lastJobMs > 0 && elapsedMs < JOB_COOLDOWN_MS) {
      const remMs = JOB_COOLDOWN_MS - elapsedMs;
      return {
        success: false,
        status: 400,
        error: 'JOB_COOLDOWN',
        cooldown_remaining_ms: remMs,
        cooldown_remaining_text: formatCooldownLeft(remMs),
        jobs_today: jobsToday,
        daily_limit: JOB_DAILY_LIMIT,
        message: `${job.icon} Bạn vừa hoàn thành ca làm gần đây! Vui lòng chờ **${formatCooldownLeft(remMs)}** nữa để nhận ca tiếp *(hôm nay: ${jobsToday}/${JOB_DAILY_LIMIT})*.`,
      };
    }

    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level) || 1);
    const baseLt = job.ltMin + Math.floor(rng() * (job.ltMax - job.ltMin + 1));
    const bonusLtPct = Math.min(80, Math.round(Number(roleBuffs?.dailyLtBonusPct || 0) * 0.25));
    const rewardLt = Math.round(baseLt * (1 + bonusLtPct / 100));
    const rewardExp = Math.round(job.exp * (1 + Number(roleBuffs?.expBonusPct || 0) / 100));

    const prevBal = Number(user.linh_thach || 0);
    const nextBal = prevBal + rewardLt;

    // Tính EXP & level mới chính xác qua computeTotalAccumulatedExp + decomposeTotalExp
    const curLvl = Math.max(1, Number(user.level || 1));
    const totalExp = computeTotalAccumulatedExp(curLvl, user.exp);
    const nextProgress = decomposeTotalExp(totalExp + rewardExp);

    const nowIso = now.toISOString();
    const nextJobsToday = jobsToday + 1;

    await Promise.all([
      supabase.from('users').update({
        linh_thach: nextBal,
        exp: nextProgress.exp,
        level: nextProgress.level,
        max_role_slots: getMaxRoleSlotsByLevel(nextProgress.level),
        updated_at: nowIso,
      }).eq('user_id', cleanId),
      supabase.from('user_quests').upsert({
        user_id: cleanId,
        job_date: todayKey,
        jobs_today: nextJobsToday,
        last_job_at: nowIso,
        last_job_id: job.job_id,
        updated_at: nowIso,
      }, { onConflict: 'user_id' }),
      trackQuestActivity(cleanId, { expDelta: rewardExp, jobDelta: 1 }, now),
    ]);

    const story = job.stories[Math.floor(rng() * job.stories.length)] || job.summary;
    const lvlUpNote = nextProgress.level > curLvl
      ? `\n• ${em('su_level_up')} **ĐỘT PHÁ CẢNH GIỚI!** Lên **Lv.${nextProgress.level}** (${getRealmByLevel(nextProgress.level)})!`
      : '';

    return {
      success: true,
      job_id: job.job_id,
      job_name: job.name,
      icon: job.icon,
      reward_linh_thach: rewardLt,
      reward_exp: rewardExp,
      linh_thach: nextBal,
      linh_thach_fmt: nextBal.toLocaleString('vi-VN'),
      level: nextProgress.level,
      exp: nextProgress.exp,
      jobs_today: nextJobsToday,
      daily_limit: JOB_DAILY_LIMIT,
      message: [
        `${job.icon} **HOÀN THÀNH CA LÀM: ${job.name.toUpperCase()}!**`,
        `> *${story}*`,
        `• Tiền công: **+${rewardLt}** ${em('su_linhthach')} **Linh Thạch** • Tu vi: **+${rewardExp} EXP**${lvlUpNote}`,
        `• Số dư ví: **${nextBal.toLocaleString('vi-VN')} LT** • Ca hôm nay: \`${nextJobsToday}/${JOB_DAILY_LIMIT}\` *(Hồi chiêu 1 giờ)*`,
      ].join('\n'),
    };
  });
}
