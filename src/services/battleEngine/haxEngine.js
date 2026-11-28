/**
 * src/services/battleEngine/haxEngine.js
 * Engine kích hoạt toàn bộ HAX & Nội Tại cho 151 Linh Thú, 264 Pháp Bảo Loadout và cộng hưởng Linh Vực (v1.3–v1.7).
 *
 * Nguyên tắc cốt lõi (Ver 1.7 Full-Integrity Upgrade):
 * - Stack Độc / Thiêu Đốt / Debuff chỉ số theo từng nguồn độc lập (sourceId) với trần an toàn — không ghi đè mất tác dụng món thứ 2.
 * - Miễn nhiễm Khống Chế tách bạch khỏi Debuff chỉ số (`soul_mythic_5` chỉ chặn Choáng/Đóng Băng/Mị Hoặc; `ccImmuneAll` chặn mọi CC nhưng không chặn giảm hồi máu/giảm giáp).
 * - Bất Tử tách bạch `immortalHits` (Cửu Vĩ Hồng Hồ — 3 đòn đầu) và `isImmortalTurns` (bảo vệ trọn N hiệp trước đòn đánh, DoT, Vực, Phản Đòn, Nổ Khiên, Ultimate).
 * - Hỗ trợ `fastMode: true` chạy cùng logic toán học 100% nhưng bỏ cấp phát chuỗi log cho benchmark 30M–100M trận.
 */

import { getCombatantV13HaxList } from './v13HaxRegistry.js';

const MAX_STACKED_POISON_PCT = 0.28;
const MAX_STACKED_BURN_PCT = 0.28;

const DEBUFF_BUCKET_CFG = {
  atk: { pctKey: 'atkDebuffPct', turnsKey: 'atkDebuffTurns', cap: 0.65 },
  def: { pctKey: 'defDebuffPct', turnsKey: 'defDebuffTurns', cap: 0.75 },
  spd: { pctKey: 'spdDebuffPct', turnsKey: 'spdDebuffTurns', cap: 0.75 },
  healRed: { pctKey: 'healReductionPct', turnsKey: 'healReductionTurns', cap: 0.85 },
  enemyDmg: { pctKey: 'enemyDmgDebuffPct', turnsKey: 'enemyDmgDebuffTurns', cap: 0.50 },
  enemyAcc: { pctKey: 'enemyAccDebuffPct', turnsKey: 'enemyAccDebuffTurns', cap: 0.45 },
};

const BASIC_CC_KINDS = new Set(['cc', 'freeze', 'stun', 'sleep']);
const SOUL_MYTHIC_5_KINDS = new Set(['cc', 'freeze', 'stun', 'sleep', 'charm']);

const DEBUFF_BUCKETS = ['atk', 'def', 'spd', 'healRed', 'enemyDmg', 'enemyAcc'];

export function hasPet(combatant, petType) {
  if (!combatant || combatant.state?.haxLockedTurns > 0) return false;
  const pt = combatant.petType;
  if (!pt) return false;
  if (pt === petType) return true;
  return !combatant._fastMode && pt.toLowerCase() === String(petType).toLowerCase();
}

export function hasItem(combatant, itemId) {
  if (!combatant || combatant.state?.haxLockedTurns > 0) return false;
  const eq = combatant.equipment;
  if (!eq) return false;
  const wId = eq.weapon?.item_id;
  if (wId === itemId) return true;
  const gId = eq.gem?.item_id;
  if (gId === itemId) return true;
  const sId = eq.soul?.item_id;
  if (sId === itemId) return true;
  if (combatant._fastMode) return false;
  const tgt = String(itemId).toLowerCase();
  return (
    (wId && wId.toLowerCase() === tgt)
    || (gId && gId.toLowerCase() === tgt)
    || (sId && sId.toLowerCase() === tgt)
  );
}

function getActiveV13List(combatant) {
  if (!combatant || combatant.state?.haxLockedTurns > 0) return [];
  return getCombatantV13HaxList(combatant);
}

function sumV13Prop(list, prop) {
  let sum = 0;
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i][prop];
    if (typeof v === 'number') sum += v;
  }
  return sum;
}

function maxV13Prop(list, prop) {
  let best = 0;
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i][prop];
    if (typeof v === 'number' && v > best) best = v;
  }
  return best;
}

function combineIndepProbV13(list, prop) {
  let missProd = 1;
  let any = false;
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i][prop];
    if (typeof v === 'number' && v > 0) {
      any = true;
      missProd *= Math.max(0, 1 - v);
    }
  }
  return any ? (1 - missProd) : 0;
}

function getDomainOwnBuffs(combatant) {
  return combatant?.domainRuntime?.own?.buffs || {};
}

function getDomainIncomingDebuffs(combatant) {
  return combatant?.domainRuntime?.incomingDebuffs || {};
}

export function getHaxProcMultiplier(combatant) {
  const ownBoost = Number(getDomainOwnBuffs(combatant).haxProcBonusPct || 0);
  const enemyFail = Number(getDomainIncomingDebuffs(combatant).haxFailPct || 0);
  return Math.max(0.25, (1 + ownBoost) * (1 - enemyFail));
}

export function isCombatantImmortal(combatant) {
  const st = combatant?.state;
  if (!st) return false;
  return (st.isImmortalTurns || 0) > 0 || (st.immortalHits || 0) > 0;
}

export function tickEndOfTurnImmortality(combatant, turnNumber = 1) {
  const st = combatant?.state;
  if (!st || (st.isImmortalTurns || 0) <= 0) return;
  const grantedAt = st.immortalGrantedTurn ?? -1;
  if (turnNumber > grantedAt) {
    st.isImmortalTurns = Math.max(0, st.isImmortalTurns - 1);
  }
}

export function getTrueDamageResistPct(combatant) {
  if (!combatant) return 0;
  const v13TrueRes = sumV13Prop(getActiveV13List(combatant), 'trueDmgResistPct');
  const domTrueRes = Number(getDomainOwnBuffs(combatant).trueDmgResistPct || 0);
  return Math.min(0.65, v13TrueRes + domTrueRes);
}

export function getEffectiveCombatSpd(combatant) {
  if (!combatant) return 0;
  const slow = Math.min(0.75, Math.max(0, Number(combatant.state?.spdDebuffPct || 0)));
  const boost = Math.max(0, Number(combatant.state?.earlySpdBonusPct || 0));
  let eff = Math.round(Number(combatant.spd || 0) * (1 - slow) * (1 + boost));
  if (hasItem(combatant, 'soul_rare_1')) eff = Math.round(eff * 1.15);
  return Math.max(1, eff);
}

function ensureDebuffBuckets(st) {
  if (!st.debuffSources) {
    st.debuffSources = { atk: {}, def: {}, spd: {}, healRed: {}, enemyDmg: {}, enemyAcc: {} };
  }
  return st.debuffSources;
}

function syncDebuffBucket(target, bucket) {
  const st = target?.state;
  const cfg = DEBUFF_BUCKET_CFG[bucket];
  if (!st || !cfg) return;
  const map = ensureDebuffBuckets(st)[bucket] || {};
  let totalPct = 0;
  let maxTurns = 0;
  for (const key of Object.keys(map)) {
    const entry = map[key];
    if (!entry || entry.turns <= 0 || entry.pct <= 0) {
      delete map[key];
      continue;
    }
    totalPct += entry.pct;
    if (entry.turns > maxTurns) maxTurns = entry.turns;
  }
  st[cfg.pctKey] = Math.min(cfg.cap, totalPct);
  st[cfg.turnsKey] = maxTurns;
  if (bucket === 'def') {
    st.defDebuffTotalPct = st[cfg.pctKey];
  }
}

export function applyDebuffSource(target, bucket, sourceId, pct, turns = 2, opts = {}) {
  const st = target?.state;
  const cfg = DEBUFF_BUCKET_CFG[bucket];
  if (!st || !cfg || pct <= 0 || turns <= 0) return false;
  const map = ensureDebuffBuckets(st)[bucket];
  const prev = map[sourceId];
  const nextPct = opts.additiveOnSame
    ? Math.min(opts.maxSame || cfg.cap, (prev?.pct || 0) + pct)
    : Math.max(prev?.pct || 0, pct);
  const nextTurns = Math.max(prev?.turns || 0, turns);
  map[sourceId] = { pct: nextPct, turns: nextTurns };
  syncDebuffBucket(target, bucket);
  return true;
}

function tickDebuffBuckets(actor) {
  const st = actor?.state;
  if (!st) return;
  const buckets = st.debuffSources;
  for (let i = 0; i < DEBUFF_BUCKETS.length; i += 1) {
    const bucket = DEBUFF_BUCKETS[i];
    const cfg = DEBUFF_BUCKET_CFG[bucket];
    if ((st[cfg.turnsKey] || 0) <= 0) continue;
    const map = buckets?.[bucket];
    let hadKeys = false;
    if (map) {
      for (const k in map) {
        hadKeys = true;
        map[k].turns -= 1;
        if (map[k].turns <= 0) delete map[k];
      }
    }
    if (hadKeys) {
      syncDebuffBucket(actor, bucket);
    } else {
      st[cfg.turnsKey] -= 1;
      if (st[cfg.turnsKey] <= 0) {
        st[cfg.turnsKey] = 0;
        st[cfg.pctKey] = 0;
        if (bucket === 'def') st.defDebuffTotalPct = 0;
      }
    }
  }
}

function syncPoisonState(target, turnNumber = 1) {
  const st = target?.state;
  if (!st) return;
  const map = st.poisonSources || {};
  const keys = Object.keys(map);
  if (keys.length === 0) return;

  let total = 0;
  let maxFiniteTurns = 0;
  let scalingRef = null;
  for (const k of keys) {
    const src = map[k];
    if (!src) { delete map[k]; continue; }
    let effPct = Number(src.pct || 0);
    if (src.scaling) {
      scalingRef = src.scaling;
      effPct = Math.min(src.scaling.max, src.scaling.base + Math.max(0, turnNumber - 1) * src.scaling.step);
      src.pct = effPct;
    }
    total += effPct;
    if (Number.isFinite(src.turns) && src.turns > maxFiniteTurns) {
      maxFiniteTurns = src.turns;
    }
  }
  const capped = Math.min(MAX_STACKED_POISON_PCT, total);
  st.poisonActive = capped > 0;
  st.poisonPct = capped;
  st.poisonTurns = maxFiniteTurns;
  st.poisonScaling = scalingRef;
}

export function applyPoisonSource(target, sourceId, { pct = 0, scaling = null, turns = null, label = '' } = {}) {
  const st = target?.state;
  if (!st || getDotResistance(target) >= 1) return false;
  const basePct = scaling ? Number(scaling.base || 0) : Number(pct || 0);
  if (basePct <= 0) return false;
  if (!st.poisonSources) st.poisonSources = {};
  const prev = st.poisonSources[sourceId];
  const mergedTurns = (turns === null || turns === undefined || prev?.turns === null)
    ? null
    : Math.max(Number(prev?.turns || 0), Number(turns));
  st.poisonSources[sourceId] = {
    pct: Math.max(Number(prev?.pct || 0), basePct),
    scaling: scaling || prev?.scaling || null,
    turns: mergedTurns,
    label: label || prev?.label || sourceId,
  };
  syncPoisonState(target, 1);
  return true;
}

function syncBurnState(target) {
  const st = target?.state;
  if (!st) return;
  const map = st.burnSources || {};
  const keys = Object.keys(map);
  if (keys.length === 0) {
    st.burnTurns = 0;
    st.burnPct = 0;
    st.burnMode = null;
    st.burnIgnoresShield = false;
    return;
  }
  let totalPct = 0;
  let maxTurns = 0;
  let allCurrent = true;
  let anyIgnoreShield = false;
  for (const k of keys) {
    const src = map[k];
    if (!src || src.turns <= 0 || src.pct <= 0) {
      delete map[k];
      continue;
    }
    totalPct += src.pct;
    if (src.turns > maxTurns) maxTurns = src.turns;
    if (src.mode !== 'current') allCurrent = false;
    if (src.ignoresShield) anyIgnoreShield = true;
  }
  st.burnTurns = maxTurns;
  st.burnPct = Math.min(MAX_STACKED_BURN_PCT, totalPct);
  st.burnMode = maxTurns > 0 ? (allCurrent ? 'current' : 'max') : null;
  st.burnIgnoresShield = anyIgnoreShield;
}

export function applyBurnSource(target, sourceId, { pct = 0, turns = 2, mode = 'max', ignoresShield = false, label = '' } = {}) {
  const st = target?.state;
  if (!st || pct <= 0 || turns <= 0 || getDotResistance(target) >= 1) return false;
  if (!st.burnSources) st.burnSources = {};
  const prev = st.burnSources[sourceId];
  st.burnSources[sourceId] = {
    pct: Math.max(Number(prev?.pct || 0), Number(pct)),
    turns: Math.max(Number(prev?.turns || 0), Number(turns)),
    mode: mode || prev?.mode || 'max',
    ignoresShield: Boolean(ignoresShield || prev?.ignoresShield),
    label: label || prev?.label || sourceId,
  };
  syncBurnState(target);
  return true;
}

export function cleanseCombatantDebuffs(combatant, maxCount = 1) {
  const st = combatant?.state;
  if (!st || maxCount <= 0) return [];
  const cleansed = [];
  const tryClear = (cond, label, fn) => {
    if (cleansed.length >= maxCount || !cond) return;
    fn();
    cleansed.push(label);
  };
  const buckets = st.debuffSources;
  tryClear(Boolean(st.isStunned), 'Choáng', () => { st.isStunned = false; });
  tryClear((st.blindTurns || 0) > 0, 'Mù', () => { st.blindTurns = 0; });
  tryClear(
    Boolean(st.poisonActive && (st.poisonPct > 0 || st.poisonScaling || (st.poisonSources && Object.keys(st.poisonSources).length > 0))),
    'Trúng Độc',
    () => {
      st.poisonActive = false;
      st.poisonPct = 0;
      st.poisonScaling = null;
      st.poisonTurns = 0;
      st.poisonSources = {};
    },
  );
  tryClear(
    (st.burnTurns || 0) > 0 || (st.burnSources && Object.keys(st.burnSources).length > 0),
    'Thiêu Đốt',
    () => {
      st.burnTurns = 0;
      st.burnPct = 0;
      st.burnMode = null;
      st.burnIgnoresShield = false;
      st.burnSources = {};
    },
  );
  tryClear((st.healReductionTurns || 0) > 0, 'Giảm Hồi Máu', () => {
    st.healReductionTurns = 0;
    st.healReductionPct = 0;
    if (buckets) buckets.healRed = {};
  });
  tryClear((st.atkDebuffTurns || 0) > 0, 'Giảm ATK', () => {
    st.atkDebuffTurns = 0;
    st.atkDebuffPct = 0;
    if (buckets) buckets.atk = {};
  });
  tryClear((st.defDebuffTurns || 0) > 0, 'Phá Giáp', () => {
    st.defDebuffTurns = 0;
    st.defDebuffPct = 0;
    st.defDebuffTotalPct = 0;
    if (buckets) buckets.def = {};
  });
  tryClear((st.spdDebuffTurns || 0) > 0, 'Giảm SPD', () => {
    st.spdDebuffTurns = 0;
    st.spdDebuffPct = 0;
    if (buckets) buckets.spd = {};
  });
  tryClear((st.enemyDmgDebuffTurns || 0) > 0, 'Giảm ST', () => {
    st.enemyDmgDebuffTurns = 0;
    st.enemyDmgDebuffPct = 0;
    if (buckets) buckets.enemyDmg = {};
  });
  tryClear((st.enemyAccDebuffTurns || 0) > 0, 'Giảm Chính Xác', () => {
    st.enemyAccDebuffTurns = 0;
    st.enemyAccDebuffPct = 0;
    if (buckets) buckets.enemyAcc = {};
  });

  if (cleansed.length > 0 && st.ultimate?.active) {
    st.ultimate.cleanses = (st.ultimate.cleanses || 0) + cleansed.length;
  }
  return cleansed;
}

/**
 * Kiểm tra khả năng miễn nhiễm Khống Chế / Debuff (đã tách bạch CC vs Debuff chỉ số).
 * - Fuyumi / Cửu Vĩ Hồng Hồ / Quang Minh Thánh Thú: Miễn toàn diện (CC + Debuff + DoT).
 * - soul_mythic_5 (« Tinh Tú Huyền Nữ Hồn »): Chỉ miễn Choáng/Đóng Băng/Mị Hoặc (KHÔNG chặn Giảm Hồi Máu / Phá Giáp).
 * - ccImmuneAll (`thai_cuc_thanh_quang_thu`, `soul_mythic_15`): Miễn mọi Khống Chế (CC/Mị/Mù/Chậm/Khóa/Cướp Tốc), KHÔNG chặn Debuff chỉ số hay DoT.
 * - ccImmuneBasic (`tinh_tu_thien_nga`, `soul_unique_7`): Miễn Choáng/Đóng Băng/Ngủ.
 */
export function isControlImmune(combatant, kind = 'cc') {
  if (!combatant) return false;
  if (
    hasPet(combatant, 'cuu_vi_hong_ho')
    || Boolean(combatant.domainLoadout?.domain?.is_exclusive_fuyumi)
    || String(combatant.id) === '757091869183311872'
  ) {
    return true;
  }
  if (String(combatant.petType || '').toLowerCase() === 'quang_minh_thanh_thu') return true;
  if (combatant.state?.haxLockedTurns > 0) return false;

  const eq = combatant.equipment || {};
  if (String(eq.soul?.item_id || '').toLowerCase() === 'soul_mythic_5') {
    if (SOUL_MYTHIC_5_KINDS.has(kind)) return true;
  }

  const activeV13 = getActiveV13List(combatant);
  for (let i = 0; i < activeV13.length; i += 1) {
    const e = activeV13[i];
    if (e.ccImmuneAll && kind !== 'dot' && kind !== 'debuff') return true;
    if (e.ccImmuneBasic && BASIC_CC_KINDS.has(kind)) return true;
    if (e.dotImmune && kind === 'dot') return true;
  }
  if (combatant.bossConfig?.ccImmuneAll && kind !== 'dot' && kind !== 'debuff') return true;
  if (combatant.bossConfig?.ccImmuneBasic && BASIC_CC_KINDS.has(kind)) return true;
  if ((combatant.state?.stunImmuneTurns || 0) > 0 && BASIC_CC_KINDS.has(kind)) {
    return true;
  }
  return false;
}

/**
 * Kiểm tra tỉ lệ kháng khống chế phụ (Thái Cực Bát Quái 50%, Bích Hải Triều Sinh 30%, v1.3/v1.7 Bảo Ngọc & Linh Vực)
 */
export function rollControlResist(target, rng, kind = 'cc') {
  if (isControlImmune(target, kind)) {
    return {
      resisted: true,
      source: target.petType === 'quang_minh_thanh_thu' ? 'Thánh Quang Hóa Giải' : 'Miễn Nhiễm Khống Chế',
    };
  }
  if (kind === 'debuff') {
    return { resisted: false, source: null };
  }
  if (hasItem(target, 'gem_epic_3') && rng() < 0.50) {
    return { resisted: true, source: 'Thái Cực Bát Quái Ngọc Bội (50%)' };
  }
  if ((kind === 'cc' || kind === 'slow') && hasItem(target, 'gem_rare_4') && rng() < 0.30) {
    return { resisted: true, source: 'Bích Hải Triều Sinh Châu (30%)' };
  }
  const v13Res = combineIndepProbV13(getActiveV13List(target), 'ccResistPct');
  const domRes = Number(getDomainOwnBuffs(target).controlResistPct || 0);
  const combined = Math.min(0.92, v13Res + domRes);
  if (combined > 0 && rng() < combined) {
    return { resisted: true, source: `Kháng Khống Chế (${Math.round(combined * 100)}%)` };
  }
  return { resisted: false, source: null };
}

export function getDotResistance(target) {
  if (!target) return 0;
  if (isControlImmune(target, 'dot')) return 1.0;
  if (hasPet(target, 'thanh_de_moc_long')) return 1.0;
  let resist = sumV13Prop(getActiveV13List(target), 'dotResistPct');
  if (hasItem(target, 'gem_epic_5')) resist += 0.35;
  if (hasItem(target, 'gem_common_2')) resist += 0.20;
  return Math.min(0.95, resist);
}

export function applyHeal(combatant, rawHeal) {
  if (!combatant || combatant.currentHp <= 0) return 0;
  let heal = Math.max(0, Math.floor(rawHeal));
  const stateRed = (combatant.state?.healReductionTurns > 0 && combatant.state?.healReductionPct > 0)
    ? combatant.state.healReductionPct
    : 0;
  const domRed = Number(getDomainIncomingDebuffs(combatant).healReductionPct || 0);
  const totalRed = Math.min(0.90, Math.max(stateRed, domRed) + Math.min(stateRed, domRed) * 0.35);
  if (totalRed > 0) {
    heal = Math.floor(heal * Math.max(0.10, 1 - totalRed));
  }
  const before = combatant.currentHp;
  combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + heal);
  const actual = combatant.currentHp - before;
  if (actual > 0 && combatant.state?.ultimate?.active) {
    const u = combatant.state.ultimate;
    u.healsPctAccum = (u.healsPctAccum || 0) + (actual / Math.max(1, combatant.maxHp || 1000));
    u.healEvents = (u.healEvents || 0) + 1;
  }
  return actual;
}

export function hasHax(combatant, keyword) {
  if (!combatant) return false;
  if (combatant._fastMode) return false;
  if (combatant.state?.haxLockedTurns > 0 && !String(keyword).toLowerCase().includes('quang_minh')) return false;

  const kw = String(keyword).toLowerCase().trim();
  const { hax, petType, equipment } = combatant;

  if (petType && petType.toLowerCase().includes(kw)) return true;
  if (hax?.pet && String(hax.pet).toLowerCase().includes(kw)) return true;
  if (hax?.weapon && String(hax.weapon).toLowerCase().includes(kw)) return true;
  if (hax?.gem && String(hax.gem).toLowerCase().includes(kw)) return true;
  if (hax?.soul && String(hax.soul).toLowerCase().includes(kw)) return true;
  for (const piece of [equipment?.weapon, equipment?.gem, equipment?.soul]) {
    if (!piece) continue;
    if (String(piece.item_id || '').toLowerCase().includes(kw)) return true;
    if (String(piece.item_name || '').toLowerCase().includes(kw)) return true;
    if (String(piece.hax_skill || '').toLowerCase().includes(kw)) return true;
  }
  return false;
}

export function addShield(target, amount) {
  if (!target || (target.state?.antiShieldTurns || 0) > 0) return 0;
  const domBonus = 1 + Number(getDomainOwnBuffs(target).shieldStrengthBonusPct || 0);
  const domCut = Math.max(0.25, 1 - Number(getDomainIncomingDebuffs(target).enemyShieldCapReductionPct || 0));
  const val = Math.max(0, Math.floor(amount * domBonus * domCut));
  target.shield = (target.shield || 0) + val;
  return val;
}

/**
 * Giai đoạn 1: Kích hoạt đầu trận (onBattleStart)
 */
export function triggerBattleStart(attacker, defender, rng, opts = {}) {
  const fastMode = Boolean(opts?.fastMode);
  const events = [];
  const pushEv = (ev) => { if (!fastMode) events.push(ev); };

  // 0. Khóa HAX đầu trận (Linh Miêu Hoa Tiên & v1.3/v1.7 startHaxLockTurns như Vũ Trụ Không Lo)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'linh_mieu_hoa_tien') || hasHax(actor, 'gai mộc trói chân')) {
      const res = rollControlResist(target, rng, 'lock');
      if (res.resisted) {
        if (!fastMode) pushEv({
          actor: target.id,
          action: 'immune',
          skill: `${res.source} (Kháng Khóa HAX)`,
          desc: `${target.name} hóa giải Gai Mộc Trói Chân từ ${actor.name}!`,
        });
      } else {
        target.state.haxLockedTurns = Math.max(target.state.haxLockedTurns || 0, 2);
        if (!fastMode) pushEv({
          actor: actor.id,
          action: 'hax_start',
          skill: 'Gai Mộc Trói Chân',
          desc: `${actor.name} phong ấn kỹ năng HAX của ${target.name} trong 2 hiệp đầu!`,
        });
      }
    }
    const preV13 = getActiveV13List(actor);
    for (const h of preV13) {
      if (h.startHaxLockTurns) {
        const res = rollControlResist(target, rng, 'lock');
        if (!res.resisted) {
          target.state.haxLockedTurns = Math.max(target.state.haxLockedTurns || 0, h.startHaxLockTurns);
          if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.label || h.source} (Khóa HAX ${h.startHaxLockTurns} Hiệp)` });
        }
      }
    }
  }

  // 1. « Tru Tiên Diệt Thần Kiếm »: Khóa bất tử & xuyên khiên 3 lượt đầu
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'weapon_mythic_1') || hasHax(actor, 'tru tiên')) {
      target.state.antiImmortalityTurns = 3;
      target.state.antiShieldTurns = 3;
      target.shield = 0;
      if (!fastMode) pushEv({
        actor: actor.id,
        action: 'hax_start',
        skill: '« Tru Tiên Diệt Thần Kiếm » Tuyệt Diệt Bất Tử',
        desc: `${actor.name} khai mở Tru Tiên Kiếm Trận, khóa Bất Tử & Khiên Chắn của ${target.name} trong 3 hiệp!`,
      });
    }
  }

  // 2. Các HAX tạo Khiên đầu trận (tôn trọng antiShieldTurns của Tru Tiên)
  for (const [actor] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'gem_mythic_3') || hasHax(actor, 'thiên hồ hóa thần')) {
      const gained = addShield(actor, actor.maxHp);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: '« Thiên Hồ Hóa Thần Ngọc » Thần Hồ Diễm Hộ', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasItem(actor, 'gem_mythic_5') || hasHax(actor, 'hỗn nguyên càn khôn')) {
      const gained = addShield(actor, actor.maxHp * 0.75);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: '« Hỗn Nguyên Càn Khôn Ấn » Càn Khôn Hộ Thể', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP & Chống Kết Liễu!` });
    }
    if (hasPet(actor, 'hoang_thien_ky_lan')) {
      const gained = addShield(actor, actor.maxHp * 0.65);
      if (gained > 0) {
        actor.state.shieldExplodePct = Math.min(0.40, (actor.state.shieldExplodePct || 0) + 0.20);
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Bất Động Sơn Hà (Khiên 65% + Nổ)', desc: `${actor.name} nhận khiên 65% HP (${gained.toLocaleString('vi-VN')} HP)!` });
      }
    }
    if (hasPet(actor, 'hoang_tho_thach_su')) {
      const gained = addShield(actor, actor.maxHp * 0.40);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Sơn Nhạc Bất Động (Khiên 40%)', desc: `${actor.name} nhận khiên 40% HP (${gained.toLocaleString('vi-VN')} HP)!` });
    }
    if (hasPet(actor, 'thao_moc_linh_vien') || hasHax(actor, 'đất mẹ che chở')) {
      const gained = addShield(actor, actor.maxHp * 0.25);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Đất Mẹ Che Chở (Khiên 25%)', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasPet(actor, 'nguyet_anh_thao_tho')) {
      const gained = addShield(actor, actor.maxHp * 0.10);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Ánh Trăng Dịu Êm (Khiên 10% +8% Crit)', desc: `${actor.name} nhận khiên ${gained.toLocaleString('vi-VN')} HP!` });
    }
    if (hasItem(actor, 'gem_rare_3')) {
      const gained = addShield(actor, 800);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Tử Kim Thần Thuẫn Thạch (+800 Khiên)', desc: `${actor.name} nhận khiên +800 HP!` });
    }
    if (hasItem(actor, 'gem_common_5')) {
      const gained = addShield(actor, 350);
      if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Bạch Ngọc Hộ Phù (+350 Khiên)', desc: `${actor.name} nhận khiên +350 HP!` });
    }
  }

  // 3. Cửu Thiên Lôi Đình: Cướp 40% SPD thành ATK
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasItem(actor, 'weapon_mythic_2') || hasHax(actor, 'cửu thiên lôi đình')) {
      const res = rollControlResist(target, rng, 'steal');
      if (res.resisted) {
        if (!fastMode) pushEv({ actor: target.id, action: 'immune', skill: `${res.source} (Chặn Cướp Tốc)`, desc: `${target.name} hóa giải Lôi Thần Trấn Áp!` });
      } else {
        const stolenSpd = Math.floor(target.spd * 0.40);
        target.spd = Math.max(10, target.spd - stolenSpd);
        actor.atk += stolenSpd;
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: '« Cửu Thiên Lôi Đình » Lôi Thần Trấn Áp', desc: `${actor.name} cướp ${stolenSpd} SPD của ${target.name} chuyển thành ATK!` });
      }
    }
  }

  // 4. Cửu Vĩ Hồng Hồ: Cửu Vĩ Hộ Thể (Bất tử trước 3 đòn đầu & phản 100%)
  for (const [actor] of [[attacker, defender], [defender, attacker]]) {
    if (actor.state.antiImmortalityTurns === 0 && (hasPet(actor, 'cuu_vi_hong_ho') || hasHax(actor, 'cửu vĩ hộ thể'))) {
      actor.state.immortalHits = 3;
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Cửu Vĩ Hộ Thể (Bất Tử 3 Đòn & Phản 100%)', desc: `${actor.name} kích hoạt Bất Tử trước 3 đòn đầu & phản 100% sát thương!` });
    }
  }

  // 5. Kim Sí Điêu Hoàng: Mù Lòa Thái Dương (2 hiệp đầu)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'kim_si_dieu_hoang') || hasHax(actor, 'mù lòa thái dương')) {
      const res = rollControlResist(target, rng, 'blind');
      if (res.resisted) {
        if (!fastMode) pushEv({ actor: target.id, action: 'immune', skill: `${res.source} (Miễn Mù)`, desc: `${target.name} miễn nhiễm Mù Lòa Thái Dương!` });
      } else {
        target.state.blindTurns = Math.max(target.state.blindTurns || 0, 2);
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Mù Lòa Thái Dương (2 Hiệp)', desc: `${target.name} bị làm chói mắt (55% trượt) trong 2 hiệp đầu!` });
      }
    }
  }

  // 6. Các hiệu ứng giảm chỉ số & độc đầu trận (legacy — stack theo nguồn!)
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    if (hasPet(actor, 'kim_giap_tue_lan')) {
      actor.state.damageReductionPct = Math.max(actor.state.damageReductionPct, 0.15);
      actor.state.damageReductionTurns = Math.max(actor.state.damageReductionTurns, 2);
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Giáp Sắt Kiên Cố (-15% ST 2 Hiệp)' });
    }
    if (hasItem(actor, 'soul_rare_5') && !isControlImmune(target, 'debuff')) {
      applyDebuffSource(target, 'atk', 'soul_rare_5', 0.12, 2);
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Hàn Giao Thủy Hồn (-12% ATK Địch 2 Hiệp)' });
    }
    if (hasItem(actor, 'weapon_common_6') && !isControlImmune(target, 'slow')) {
      applyDebuffSource(target, 'spd', 'weapon_common_6', 0.05, 2);
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Băng Tinh Song Chủy (-5% SPD 2 Hiệp)' });
    }
    if (hasItem(actor, 'weapon_rare_3') && !isControlImmune(target, 'slow')) {
      applyDebuffSource(target, 'spd', 'weapon_rare_3', 0.10, 2);
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Hàn Băng Thần Châm (-10% SPD 2 Hiệp)' });
    }
    if (hasItem(actor, 'soul_epic_2') && getDotResistance(target) < 1) {
      applyPoisonSource(target, 'soul_epic_2', { pct: 0.08, turns: null, label: 'Cửu U Minh Xà Hồn' });
      if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: 'Cửu U Minh Xà Hồn (Độc 8% HP/Hiệp)' });
    }
  }

  // 7. Các hiệu ứng khai trận v1.3 + v1.7
  for (const [actor, target] of [[attacker, defender], [defender, attacker]]) {
    const activeV13 = getActiveV13List(actor);
    for (const h of activeV13) {
      if (h.stunImmuneTurns) {
        actor.state.stunImmuneTurns = Math.max(actor.state.stunImmuneTurns, h.stunImmuneTurns);
      }
      if (h.blindTurns) {
        const res = rollControlResist(target, rng, 'blind');
        if (!res.resisted) {
          target.state.blindTurns = Math.max(target.state.blindTurns || 0, h.blindTurns);
          if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.label || h.source} (Mù ${h.blindTurns} Hiệp)` });
        }
      }
      if (h.earlyDmgRedTurns && h.earlyDmgRedPct) {
        actor.state.damageReductionPct = Math.max(actor.state.damageReductionPct, h.earlyDmgRedPct);
        actor.state.damageReductionTurns = Math.max(actor.state.damageReductionTurns, h.earlyDmgRedTurns);
      }
      if (h.earlySpdBonusTurns && h.earlySpdBonusPct) {
        actor.state.earlySpdBonusTurns = Math.max(actor.state.earlySpdBonusTurns, h.earlySpdBonusTurns);
        actor.state.earlySpdBonusPct = Math.min(0.60, (actor.state.earlySpdBonusPct || 0) + h.earlySpdBonusPct);
      }
      if (h.startShieldPct) {
        const gained = addShield(actor, actor.maxHp * h.startShieldPct);
        if (gained > 0) {
          if (h.shieldExplodePct) {
            actor.state.shieldExplodePct = Math.min(0.40, (actor.state.shieldExplodePct || 0) + h.shieldExplodePct);
          }
          if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.label || h.source} (Khiên ${Math.round(h.startShieldPct * 100)}%)` });
        }
      }
      if (h.startShieldFlat) {
        const gained = addShield(actor, h.startShieldFlat);
        if (gained > 0) if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.source} (+${gained} Khiên)` });
      }
      if (h.startSpdStealPct) {
        const res = rollControlResist(target, rng, 'steal');
        if (!res.resisted) {
          const stolenSpd = Math.floor(target.spd * h.startSpdStealPct);
          target.spd = Math.max(10, target.spd - stolenSpd);
          actor.atk += stolenSpd;
          if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.source} (Cướp ${stolenSpd} SPD → ATK)` });
        }
      }
      if (h.startSpdDebuffPct && !isControlImmune(target, 'slow')) {
        applyDebuffSource(target, 'spd', h.id, h.startSpdDebuffPct, 3);
      }
      if (h.startAtkDebuffPct && !isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'atk', h.id, h.startAtkDebuffPct, h.startAtkDebuffTurns || 3);
      }
      if (h.poisonPct && getDotResistance(target) < 1) {
        applyPoisonSource(target, h.id, { pct: h.poisonPct, turns: null, label: h.label || h.source });
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.source} (Độc ${Math.round(h.poisonPct * 100)}%/Hiệp)` });
      }
      if (h.poisonScaling && getDotResistance(target) < 1) {
        applyPoisonSource(target, h.id, { pct: h.poisonScaling.base, scaling: h.poisonScaling, turns: null, label: h.label || h.source });
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.label || h.source} (Kịch Độc Tích Lũy)` });
      }
      if (h.doubleTurnOnce && !actor.state.doubleTurnUsed) {
        actor.state.doubleTurnUsed = true;
        actor.state.isDoubleTurn = true;
        if (!fastMode) pushEv({ actor: actor.id, action: 'hax_start', skill: `${h.source} (2 Lượt Liên Hoàn)` });
      }
    }
  }

  return events;
}

/**
 * Giai đoạn 2: Kích hoạt đầu hiệp đấu (onTurnStart)
 */
export function triggerTurnStart(actor, target, rng, turnNumber = 1, opts = {}) {
  const fastMode = Boolean(opts?.fastMode);
  const result = {
    skipTurn: false,
    attackSelf: false,
    events: [],
  };
  const pushEv = (ev) => { if (!fastMode) result.events.push(ev); };

  actor.state.turnCount += 1;

  // Giảm bộ đếm thời hạn khi bước vào hiệp
  if (actor.state.antiImmortalityTurns > 0) actor.state.antiImmortalityTurns -= 1;
  if (actor.state.antiShieldTurns > 0) actor.state.antiShieldTurns -= 1;
  if (actor.state.haxLockedTurns > 0) actor.state.haxLockedTurns -= 1;
  if (actor.state.damageReductionTurns > 0) {
    actor.state.damageReductionTurns -= 1;
    if (actor.state.damageReductionTurns === 0) actor.state.damageReductionPct = 0;
  }
  tickDebuffBuckets(actor);
  if (actor.state.stunImmuneTurns > 0) actor.state.stunImmuneTurns -= 1;
  if (actor.state.earlySpdBonusTurns > 0) {
    actor.state.earlySpdBonusTurns -= 1;
    if (actor.state.earlySpdBonusTurns === 0) actor.state.earlySpdBonusPct = 0;
  }

  const activeV13 = getActiveV13List(actor);

  // Cleanse mỗi hiệp / theo chu kỳ (cộng dồn số lượng hóa giải khi đeo nhiều nguồn)
  let totalCleanseCount = 0;
  if (hasPet(actor, 'bach_ngoc_thien_nga')) totalCleanseCount += 1;
  if (hasItem(actor, 'soul_epic_3')) totalCleanseCount += 1;
  for (const e of activeV13) {
    if (e.turnCleanse) totalCleanseCount += Number(e.turnCleanse) || 1;
    else if (e.cleanseTurn2 && turnNumber === 2) totalCleanseCount += 1;
    else if (e.turnCleanseInterval && turnNumber % e.turnCleanseInterval === 0) totalCleanseCount += 1;
  }
  if (totalCleanseCount > 0) {
    const cleansed = cleanseCombatantDebuffs(actor, totalCleanseCount);
    if (cleansed.length > 0) {
      if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `Hóa Giải (${cleansed.join(' + ')})` });
    }
  }

  // Độc & Thiêu Đốt trên actor (tôn trọng Bất Tử + cộng dồn mọi nguồn độc lập + trừ lượt chính xác!)
  const actorImmortal = isCombatantImmortal(actor);
  const dotRes = getDotResistance(actor);

  // 2a. Độc (Poison)
  const pMap = actor.state.poisonSources || {};
  const pKeys = Object.keys(pMap);
  if (pKeys.length > 0) {
    syncPoisonState(actor, turnNumber);
    if (actor.state.poisonPct > 0 && dotRes < 1) {
      if (actorImmortal) {
        if (!fastMode) pushEv({ actor: actor.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm Độc' });
      } else {
        const dmg = Math.max(1, Math.floor(actor.maxHp * actor.state.poisonPct * (1 - dotRes)));
        actor.currentHp = Math.max(1, actor.currentHp - dmg);
        if (actor.state.ultimate?.active) actor.state.ultimate.dmgTaken += dmg;
        if (target?.state?.ultimate?.active) target.state.ultimate.dmgDealt += dmg;
        const pctDisp = Math.round(actor.state.poisonPct * 100);
        const stackTag = pKeys.length > 1 ? ` ${pKeys.length} nguồn=${pctDisp}%` : '';
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Trúng Độc${stackTag} (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
    }
    // Giảm lượt các nguồn Độc có thời hạn (ví dụ Ultimate Độc 2 hiệp)
    let anyExpired = false;
    for (const k of pKeys) {
      if (pMap[k] && Number.isFinite(pMap[k].turns)) {
        pMap[k].turns -= 1;
        if (pMap[k].turns <= 0) {
          delete pMap[k];
          anyExpired = true;
        }
      }
    }
    if (anyExpired) {
      if (Object.keys(pMap).length === 0) {
        actor.state.poisonActive = false;
        actor.state.poisonPct = 0;
        actor.state.poisonTurns = 0;
        actor.state.poisonScaling = null;
      } else {
        syncPoisonState(actor, turnNumber);
      }
    }
  } else if (actor.state.poisonActive && (actor.state.poisonPct > 0 || actor.state.poisonScaling)) {
    // Fallback tương thích ngược cho test gán tay state.poisonPct
    if (dotRes < 1) {
      if (actorImmortal) {
        if (!fastMode) pushEv({ actor: actor.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm Độc' });
      } else {
        if (actor.state.poisonScaling) {
          const sc = actor.state.poisonScaling;
          actor.state.poisonPct = Math.min(sc.max, sc.base + (turnNumber - 1) * sc.step);
        }
        const dmg = Math.floor(actor.maxHp * actor.state.poisonPct * (1 - dotRes));
        actor.currentHp = Math.max(1, actor.currentHp - dmg);
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Trúng Độc (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
    }
  }

  // 2b. Thiêu Đốt (Burn)
  const bMap = actor.state.burnSources || {};
  const bKeys = Object.keys(bMap);
  if (bKeys.length > 0) {
    if (dotRes < 1) {
      if (actorImmortal) {
        if (!fastMode) pushEv({ actor: actor.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm Thiêu Đốt' });
      } else {
        let totalBurnDmg = 0;
        for (const k of bKeys) {
          const src = bMap[k];
          if (!src || src.turns <= 0 || src.pct <= 0) continue;
          const baseHp = src.mode === 'current' ? actor.currentHp : actor.maxHp;
          totalBurnDmg += Math.floor(baseHp * src.pct * (1 - dotRes));
        }
        const maxBurnCapDmg = Math.max(1, Math.floor(actor.maxHp * MAX_STACKED_BURN_PCT * (1 - dotRes)));
        const dmg = Math.max(1, Math.min(maxBurnCapDmg, totalBurnDmg));
        actor.currentHp = Math.max(1, actor.currentHp - dmg);
        if (actor.state.ultimate?.active) actor.state.ultimate.dmgTaken += dmg;
        if (target?.state?.ultimate?.active) {
          target.state.ultimate.dmgDealt += dmg;
          target.state.ultimate.burnTicksApplied = (target.state.ultimate.burnTicksApplied || 0) + 1;
        }
        const stackTag = bKeys.length > 1 ? ` ${bKeys.length} nguồn` : '';
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Thiêu Đốt${stackTag} (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
    }
    for (const k of bKeys) {
      if (bMap[k]) {
        bMap[k].turns -= 1;
        if (bMap[k].turns <= 0) delete bMap[k];
      }
    }
    syncBurnState(actor);
  } else if (actor.state.burnTurns > 0 && actor.state.burnPct > 0) {
    // Fallback tương thích ngược
    actor.state.burnTurns -= 1;
    if (dotRes < 1) {
      if (actorImmortal) {
        if (!fastMode) pushEv({ actor: actor.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm Thiêu Đốt' });
      } else {
        const burnBaseHp = actor.state.burnMode === 'current' ? actor.currentHp : actor.maxHp;
        const dmg = Math.max(1, Math.floor(burnBaseHp * actor.state.burnPct * (1 - dotRes)));
        actor.currentHp = Math.max(1, actor.currentHp - dmg);
        if (target?.state?.ultimate?.active) {
          target.state.ultimate.burnTicksApplied = (target.state.ultimate.burnTicksApplied || 0) + 1;
        }
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Thiêu Đốt (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
    }
    if (actor.state.burnTurns <= 0) {
      actor.state.burnPct = 0;
      actor.state.burnMode = null;
      actor.state.burnIgnoresShield = false;
    }
  }

  // Kiểm tra khống chế (Choáng / Đóng Băng / Hóa Đá)
  if (actor.state.isStunned) {
    if (isControlImmune(actor, 'cc')) {
      actor.state.isStunned = false;
      if (!fastMode) pushEv({ actor: actor.id, action: 'immune', skill: 'Miễn Khống Chế' });
    } else {
      actor.state.isStunned = false;
      result.skipTurn = true;
      if (!fastMode) pushEv({ actor: actor.id, action: 'turn_skip', skill: 'Bị Khống Chế (Mất Lượt)' });
      return result;
    }
  }

  const targetNameTag = fastMode ? '' : ` → ${target.petName || target.name}`;

  // Hải Dương Tiên Ngư: Thanh Tẩy Linh Triều ở hiệp 1 và mỗi 3 hiệp
  if (hasPet(actor, 'hai_duong_tien_ngu') && (turnNumber === 1 || (turnNumber - 1) % 3 === 0)) {
    const cleared = [];
    if (target.shield > 0) {
      target.shield = 0;
      cleared.push('Khiên');
    }
    if (target.state.atkStacks > 0) {
      target.state.atkStacks -= 1;
      const step = Math.round((target.baseAtk || target.atk) * 0.06);
      target.atk = Math.max(50, target.atk - step);
      target.state.atkBonusApplied = Math.max(0, (target.state.atkBonusApplied || 0) - step);
      cleared.push('1 Buff ATK');
    } else if (target.state.defStacks > 0) {
      target.state.defStacks -= 1;
      const step = Math.round((target.baseDef || target.def) * 0.05);
      target.def = Math.max(50, target.def - step);
      target.state.defBonusApplied = Math.max(0, (target.state.defBonusApplied || 0) - step);
      cleared.push('1 Buff DEF');
    } else if (target.state.damageReductionTurns > 0) {
      target.state.damageReductionTurns = 0;
      target.state.damageReductionPct = 0;
      cleared.push('Buff Giảm ST');
    }
    if (cleared.length > 0) {
      if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `Thanh Tẩy Linh Triều${targetNameTag} (Xóa ${cleared.join(' + ')})` });
    }
  }

  // Strip Buff / Siphon HP / Steal Shield / Periodic Shield định kỳ v1.3–v1.7
  const targetImmortal = isCombatantImmortal(target);
  for (const h of activeV13) {
    if (h.turnShieldInterval && h.turnShieldPct && (turnNumber % h.turnShieldInterval === 0)) {
      const gained = addShield(actor, actor.maxHp * h.turnShieldPct);
      if (gained > 0) {
        if (!fastMode) pushEv({ actor: actor.id, action: 'shield', skill: `${h.label || h.source} (+${gained.toLocaleString('vi-VN')} Khiên)` });
      }
    }
    if (h.stripEnemyBuffInterval && (turnNumber % h.stripEnemyBuffInterval === 0)) {
      if (target.state.atkStacks > 0) {
        target.state.atkStacks -= 1;
        const step = Math.round((target.baseAtk || target.atk) * 0.06);
        target.atk = Math.max(50, target.atk - step);
        target.state.atkBonusApplied = Math.max(0, (target.state.atkBonusApplied || 0) - step);
        if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `${h.source}${targetNameTag} (Xóa Buff ATK)` });
      } else if (target.state.defStacks > 0) {
        target.state.defStacks -= 1;
        const step = Math.round((target.baseDef || target.def) * 0.05);
        target.def = Math.max(50, target.def - step);
        target.state.defBonusApplied = Math.max(0, (target.state.defBonusApplied || 0) - step);
        if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `${h.source}${targetNameTag} (Xóa Buff DEF)` });
      } else if (target.state.damageReductionTurns > 0) {
        target.state.damageReductionTurns = 0;
        target.state.damageReductionPct = 0;
        if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `${h.source}${targetNameTag} (Xóa Giảm ST)` });
      } else if (target.state.earlySpdBonusTurns > 0) {
        target.state.earlySpdBonusTurns = 0;
        target.state.earlySpdBonusPct = 0;
        if (!fastMode) pushEv({ actor: actor.id, action: 'cleanse', skill: `${h.source}${targetNameTag} (Xóa Buff SPD)` });
      }
    }
    if (h.siphonEvery3TurnsPct && (turnNumber === 1 || (turnNumber - 1) % 3 === 0)) {
      if (!targetImmortal) {
        const drained = Math.max(1, Math.floor(target.currentHp * h.siphonEvery3TurnsPct));
        target.currentHp = Math.max(1, target.currentHp - drained);
        const healed = applyHeal(actor, drained);
        if (h.atkDebuffPct && !isControlImmune(target, 'debuff')) {
          applyDebuffSource(target, 'atk', h.id, h.atkDebuffPct, h.atkDebuffTurns || 2);
        }
        if (!fastMode) pushEv({ actor: actor.id, action: 'siphon', skill: `${h.label || h.source}${targetNameTag} (Hút +${healed.toLocaleString('vi-VN')} HP thẳng máu, bỏ qua khiên)` });
      }
    }
    if (h.stealShieldEvery2TurnsPct && (turnNumber % 2 === 0) && target.shield > 0) {
      const stolen = Math.floor(target.shield * h.stealShieldEvery2TurnsPct);
      if (stolen > 0) {
        target.shield = Math.max(0, target.shield - stolen);
        addShield(actor, stolen);
        if (!fastMode) pushEv({ actor: actor.id, action: 'shield_steal', skill: `${h.label || h.source}${targetNameTag} (Cướp ${stolen.toLocaleString('vi-VN')} Khiên)` });
      }
    }
  }

  // Hồi phục HP mỗi hiệp (Pet + Gem + Soul — cộng dồn mọi nguồn)
  let totalHealPct = 0;
  const healSources = fastMode ? null : [];
  for (const h of activeV13) {
    if (typeof h.turnHealPct === 'number' && h.turnHealPct > 0) {
      totalHealPct += h.turnHealPct;
      if (healSources) healSources.push(`${h.label || h.source} ${Math.round(h.turnHealPct * 100)}%`);
    }
  }
  if (hasPet(actor, 'thanh_truc_tien_loc')) { totalHealPct += 0.08; if (healSources) healSources.push('Linh Mộc 8%'); }
  if (hasPet(actor, 'thanh_long_au_xa')) {
    totalHealPct += 0.10;
    if (healSources) healSources.push('Trường Thanh 10%');
    if (actor.state.defStacks < 4) {
      actor.state.defStacks += 1;
      const deltaDef = Math.round((actor.baseDef || actor.def) * 0.05);
      actor.def += deltaDef;
      actor.state.defBonusApplied = (actor.state.defBonusApplied || 0) + deltaDef;
    }
  }
  if (hasPet(actor, 'bach_ngoc_thien_nga')) { totalHealPct += 0.06; if (healSources) healSources.push('Thiên Nga 6%'); }
  if (hasPet(actor, 'thanh_de_moc_long')) {
    totalHealPct += 0.14;
    if (healSources) healSources.push('Thái Cổ 14%');
    if (!actor.state.atkStacksBySource) actor.state.atkStacksBySource = {};
    const curS = actor.state.atkStacksBySource.thanh_de_moc_long || 0;
    if (curS < 5) {
      actor.state.atkStacksBySource.thanh_de_moc_long = curS + 1;
      actor.state.atkStacks += 1;
      const deltaAtk = Math.round((actor.baseAtk || actor.atk) * 0.08);
      actor.atk += deltaAtk;
      actor.state.atkBonusApplied = (actor.state.atkBonusApplied || 0) + deltaAtk;
    }
  }
  if (hasItem(actor, 'gem_epic_5')) { totalHealPct += 0.09; if (healSources) healSources.push('Trường Sinh 9%'); }
  else if (hasItem(actor, 'gem_rare_2')) { totalHealPct += 0.05; if (healSources) healSources.push('Phù Dung 5%'); }
  else if (hasItem(actor, 'gem_common_1')) { totalHealPct += 0.03; if (healSources) healSources.push('Thanh Linh 3%'); }
  else if (hasItem(actor, 'gem_common_4')) { totalHealPct += 0.02; if (healSources) healSources.push('Lam Thủy 2%'); }
  if (hasItem(actor, 'soul_mythic_5')) { totalHealPct += 0.10; if (healSources) healSources.push('Tinh Quang 10%'); }

  if (totalHealPct > 0) {
    const healed = applyHeal(actor, actor.maxHp * Math.min(0.35, totalHealPct));
    if (healed > 0 && !fastMode) {
      result.events.push({ actor: actor.id, action: 'heal', skill: `Hồi +${healed.toLocaleString('vi-VN')} HP (${healSources.join(' + ')})` });
    }
  }

  // Cộng dồn ATK theo từng nguồn độc lập (không tranh chấp biến atkStacks giữa Pet và Chiến Hồn!)
  if (!actor.state.atkStacksBySource) actor.state.atkStacksBySource = {};
  if (hasItem(actor, 'soul_epic_1')) {
    const cur = actor.state.atkStacksBySource.soul_epic_1 || 0;
    if (cur < 5) {
      actor.state.atkStacksBySource.soul_epic_1 = cur + 1;
      actor.state.atkStacks += 1;
      const delta = Math.round((actor.baseAtk || actor.atk) * 0.05);
      actor.atk += delta;
      actor.state.atkBonusApplied = (actor.state.atkBonusApplied || 0) + delta;
      if (!fastMode) pushEv({ actor: actor.id, action: 'buff', skill: `Tích Lũy +5% ATK (${cur + 1}/5)` });
    }
  }
  for (const h of activeV13) {
    const maxSt = h.atkStackMax || 5;
    if (h.atkStackPct) {
      const cur = actor.state.atkStacksBySource[h.id] || 0;
      if (cur < maxSt) {
        actor.state.atkStacksBySource[h.id] = cur + 1;
        actor.state.atkStacks += 1;
        const delta = Math.round((actor.baseAtk || actor.atk) * h.atkStackPct);
        actor.atk += delta;
        actor.state.atkBonusApplied = (actor.state.atkBonusApplied || 0) + delta;
        if (!fastMode) pushEv({ actor: actor.id, action: 'buff', skill: `Tích Lũy +${Math.round(h.atkStackPct * 100)}% ATK (${cur + 1}/${maxSt})` });
      }
    }
  }

  // DoT từ Pet kích hoạt thẳng lên target (Xích Xà Hỏa Long 7%, Thái Dương Kim Ô 10% — tôn trọng Bất Tử + Kháng DoT)
  if (!targetImmortal) {
    const targetDotRes = getDotResistance(target);
    if (targetDotRes < 1) {
      if (hasPet(actor, 'xich_xa_hoa_long')) {
        const dmg = Math.max(1, Math.floor(target.maxHp * 0.07 * (1 - targetDotRes)));
        target.currentHp = Math.max(1, target.currentHp - dmg);
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Hỏa Độc Huyết${targetNameTag} (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
      if (hasPet(actor, 'thai_duong_kim_o')) {
        const dmg = Math.max(1, Math.floor(target.maxHp * 0.10 * (1 - targetDotRes)));
        target.currentHp = Math.max(1, target.currentHp - dmg);
        if (!fastMode) pushEv({ actor: actor.id, action: 'dot', skill: `Chân Hỏa Phần Thiên${targetNameTag} (-${dmg.toLocaleString('vi-VN')} HP, bỏ qua khiên)` });
      }
    }
  }

  // Mị Hoặc / Hỗn Loạn (soul_mythic_1 40%, tinh_khong_da_thao 35% & cộng gộp độc lập v1.3/v1.7 charmPct)
  const targetHaxProc = getHaxProcMultiplier(target);
  if (hasItem(target, 'soul_mythic_1')) {
    const charmChance = Math.min(0.60, 0.40 * targetHaxProc);
    if (rng() < charmChance) {
      const res = rollControlResist(actor, rng, 'charm');
      if (!res.resisted) {
        result.attackSelf = true;
        if (!fastMode) pushEv({ actor: actor.id, action: 'charm', skill: 'Mị Hoặc Chúng Sinh (Tự Đánh Bản Thân)' });
        return result;
      }
      if (!actorImmortal) {
        const backlashDmg = Math.max(1, Math.floor(actor.maxHp * 0.10));
        actor.currentHp = Math.max(1, actor.currentHp - backlashDmg);
        if (!isControlImmune(actor, 'debuff')) {
          applyDebuffSource(actor, 'atk', 'soul_mythic_1_backlash', 0.20, 2);
        }
        if (!fastMode) pushEv({
          actor: actor.id,
          action: 'charm_backlash',
          skill: `Mị Hoặc Phản Phệ (Kháng Mị → -${backlashDmg.toLocaleString('vi-VN')} HP thẳng máu, bỏ qua khiên & -20% ATK 2 hiệp)`,
        });
      }
    }
  }

  if (hasPet(target, 'tinh_khong_da_thao')) {
    const res = rollControlResist(actor, rng, 'charm');
    if (!res.resisted && rng() < Math.min(0.55, 0.35 * targetHaxProc)) {
      result.attackSelf = true;
      if (!fastMode) pushEv({ actor: actor.id, action: 'confusion', skill: 'Hư Không Hỗn Loạn (Tự Đánh Bản Thân)' });
      return result;
    }
  }

  const targetV13 = getActiveV13List(target);
  const v13Charm = combineIndepProbV13(targetV13, 'charmPct');
  if (v13Charm > 0) {
    const res = rollControlResist(actor, rng, 'charm');
    if (!res.resisted && rng() < Math.min(0.60, v13Charm * targetHaxProc)) {
      result.attackSelf = true;
      if (!fastMode) pushEv({ actor: actor.id, action: 'charm', skill: 'Mị Ảnh Huyễn Hoặc (Tự Đánh Bản Thân)' });
      return result;
    }
  }

  // « Thái Sơ Thời Không Ma Thần Hồn » (soul_mythic_2): Thời Không Đình Chỉ (đi 2 lượt 1 lần/trận)
  if (!actor.state.doubleTurnUsed && hasItem(actor, 'soul_mythic_2')) {
    actor.state.doubleTurnUsed = true;
    actor.state.isDoubleTurn = true;
    if (!fastMode) pushEv({ actor: actor.id, action: 'double_turn', skill: 'Thời Không Đình Chỉ (2 Lượt Liên Hoàn)' });
  }

  return result;
}

/**
 * Giai đoạn 3: Tính toán ra đòn (onAttack)
 */
export function triggerAttackPhase(actor, target, baseDamage, rng, elemData = { multiplier: 1, isTrueDamage: false }, opts = {}) {
  const fastMode = Boolean(opts?.fastMode);
  const haxNotes = fastMode ? null : [];
  const pushNote = (s) => { if (haxNotes) haxNotes.push(s); };

  const actorV13 = getActiveV13List(actor);
  const targetV13 = getActiveV13List(target);
  const actorDomOwn = getDomainOwnBuffs(actor);
  const actorDomInDeb = getDomainIncomingDebuffs(actor);
  const targetDomOwn = getDomainOwnBuffs(target);
  const targetDomInDeb = getDomainIncomingDebuffs(target);
  const actorHaxProc = getHaxProcMultiplier(actor);
  const domHaxDmgBonus = Number(actorDomOwn.haxDamageBonusPct || 0);

  // 1. Kiểm tra Mù Lòa Thái Dương & Giảm Chính Xác
  if (actor.state.blindTurns > 0) {
    actor.state.blindTurns -= 1;
    if (!isControlImmune(actor, 'blind') && rng() < 0.55) {
      return {
        damage: 0,
        isCrit: false,
        isMiss: true,
        isDodged: false,
        shieldPiercePct: 0,
        lifestealPct: 0,
        onHitMaxHpHealPct: 0,
        applyOnHitEffects: null,
        instantExecute: false,
        haxTriggered: fastMode ? null : 'Mù Lòa Thái Dương (Đánh Trượt)',
      };
    }
  }

  const accPenalty = (actor.state.enemyAccDebuffPct || 0)
    + Number(actorDomInDeb.accuracyDownPct || 0)
    - sumV13Prop(actorV13, 'flatAccuracyBonus');
  if (accPenalty > 0 && !isControlImmune(actor, 'blind') && rng() < Math.min(0.45, accPenalty)) {
    return {
      damage: 0,
      isCrit: false,
      isMiss: true,
      isDodged: false,
      shieldPiercePct: 0,
      lifestealPct: 0,
      onHitMaxHpHealPct: 0,
      applyOnHitEffects: null,
      instantExecute: false,
      haxTriggered: fastMode ? null : 'Nhiễu Loạn Chính Xác (Đánh Trượt)',
    };
  }

  const isCrit = rng() < Math.min(1, actor.critRate || 0.05);

  // 2. Tính tổng Né Tránh của target
  let dodgeChance = sumV13Prop(targetV13, 'dodgePct') + Number(targetDomOwn.dodgeBonusPct || 0);
  if (hasPet(target, 'thai_am_ngoc_tho')) dodgeChance += 0.30;
  if (hasPet(target, 'phong_vu_tieu_tuoc')) dodgeChance += 0.12;
  if (hasItem(target, 'soul_epic_5')) dodgeChance += 0.25;
  if (hasItem(target, 'weapon_rare_4')) dodgeChance += 0.10;
  if (hasItem(target, 'soul_common_2')) dodgeChance += 0.05;
  dodgeChance = Math.min(0.65, dodgeChance);

  const critDodgeIgnore = isCrit ? maxV13Prop(actorV13, 'critDodgeIgnorePct') : 0;
  if (critDodgeIgnore > 0) dodgeChance *= Math.max(0.2, 1 - critDodgeIgnore);

  if (dodgeChance > 0 && rng() < dodgeChance) {
    // Chọn nguồn phản công khi né MẠNH NHẤT (không để weapon 70% ghi đè legacy 80% hay Pet 90%!)
    let bestCounter = null;
    if (hasPet(target, 'thai_am_ngoc_tho')) {
      bestCounter = { ratio: 0.80, pierce: 0, label: 'Nguyệt Hoa Phản Công (80% ATK)' };
    }
    for (const e of targetV13) {
      if (e.dodgeCounterAtkRatio > 0) {
        const better = !bestCounter
          || e.dodgeCounterAtkRatio > bestCounter.ratio
          || (e.dodgeCounterAtkRatio === bestCounter.ratio && (e.dodgeCounterDefPierce || 0) > bestCounter.pierce);
        if (better) {
          bestCounter = {
            ratio: e.dodgeCounterAtkRatio,
            pierce: e.dodgeCounterDefPierce || 0,
            label: e.dodgeCounterLabel || e.label || e.source,
          };
        }
      }
    }
    if (hasItem(target, 'soul_epic_5')) target.state.nextHitBonusPct += 15;
    const triggerCounter = Boolean(bestCounter);
    return {
      damage: 0,
      isCrit: false,
      isMiss: true,
      isDodged: true,
      triggerCounter,
      counterAtkRatio: bestCounter?.ratio || 0,
      counterDefPierce: bestCounter?.pierce || 0,
      counterLabel: bestCounter?.label || null,
      shieldPiercePct: 0,
      lifestealPct: 0,
      onHitMaxHpHealPct: 0,
      applyOnHitEffects: null,
      instantExecute: false,
      haxTriggered: fastMode
        ? null
        : (bestCounter ? `${bestCounter.label} (Né & Phản Công)` : 'Thân Pháp Né Đòn'),
    };
  }

  // 3. Áp dụng debuff ATK/DEF & Xuyên Giáp tích hợp từ Pet + Vũ Khí + Linh Vực
  const effectiveAtk = Math.max(50, Math.round(actor.atk * (1 - Math.min(0.65, actor.state.atkDebuffPct || 0))));
  const totalDefRed = Math.min(0.75, (target.state.defDebuffPct || 0) + Number(targetDomInDeb.defReductionPct || 0));
  const baseDefTarget = elemData.isTrueDamage ? 0 : Math.max(0, Math.round(target.def * (1 - totalDefRed)));

  const v13DefPierce = sumV13Prop(actorV13, 'defPiercePct');
  let defPiercePct = v13DefPierce
    + Number(actorDomOwn.defPiercePct || 0)
    + (Number(actor?.setBonus?.defPiercePct || 0) / 100);
  if (v13DefPierce > 0) {
    if (!fastMode) pushNote(`Xuyên ${Math.round(Math.min(0.90, v13DefPierce) * 100)}% DEF`);
  }
  if (hasPet(actor, 'thai_duong_kim_o')) { defPiercePct += 0.65; if (!fastMode) pushNote('Xuyên 65% DEF'); }
  else if (hasPet(actor, 'hoa_diem_ho')) { defPiercePct += 0.50; if (!fastMode) pushNote('Thiêu Hồn Xuyên 50% DEF'); }
  else if (hasPet(actor, 'bach_kim_ho_tu')) { defPiercePct += 0.35; if (!fastMode) pushNote('Phá Giáp Trảm Xuyên 35% DEF'); }

  if (hasItem(actor, 'weapon_mythic_4')) { defPiercePct += 0.55; if (!fastMode) pushNote('Phần Thiên Xuyên 55% DEF'); }
  else if (hasItem(actor, 'weapon_epic_4')) { defPiercePct += 0.30; if (!fastMode) pushNote('Trảm Tiên Xuyên 30% DEF'); }
  else if (hasItem(actor, 'weapon_rare_6')) { defPiercePct += 0.18; if (!fastMode) pushNote('Trảm Mã Xuyên 18% DEF'); }
  else if (hasItem(actor, 'weapon_common_4')) { defPiercePct += 0.10; }

  if (isCrit && hasPet(actor, 'tu_kim_bach_trach')) {
    defPiercePct += 0.45;
    if (!fastMode) pushNote('Thiên Cơ Crit Xuyên 45% DEF');
  }
  if (isCrit) {
    defPiercePct += sumV13Prop(actorV13, 'critDefPiercePct');
  }
  defPiercePct = Math.min(0.90, defPiercePct);

  const effectiveTargetDef = Math.floor(baseDefTarget * (1 - defPiercePct));
  let damage = Math.max(50, Math.floor(((effectiveAtk * 1.5) - (effectiveTargetDef * 0.5)) * (elemData.multiplier || 1)));

  // 4. Buff sát thương có điều kiện (cũ + v1.3 + v1.7)
  if (!actor.state.firstStrikeDone && hasItem(actor, 'weapon_common_5')) {
    damage = Math.floor(damage * 1.15);
    if (!fastMode) pushNote('Đòn Đầu +15% ST');
  }
  if (!actor.state.firstStrikeDone && hasItem(actor, 'soul_rare_1')) {
    damage = Math.floor(damage * 1.15);
    if (!fastMode) pushNote('Tấn Lôi Tiên Phát +15% ST');
  }
  actor.state.firstStrikeDone = true;

  const effActorSpd = getEffectiveCombatSpd(actor);
  const effTargetSpd = getEffectiveCombatSpd(target);
  if (hasItem(actor, 'weapon_common_2') && effActorSpd > effTargetSpd) damage = Math.floor(damage * 1.08);
  if (hasItem(actor, 'soul_common_1') && effActorSpd >= effTargetSpd) damage = Math.floor(damage * 1.06);
  if (hasItem(actor, 'weapon_common_3') && rng() < 0.15) {
    damage += Math.floor(effectiveAtk * 0.25);
    if (!fastMode) pushNote('Song Đao Liên Kích');
  }
  if (actor.state.nextHitBonusPct > 0) {
    damage = Math.floor(damage * (1 + actor.state.nextHitBonusPct / 100));
    if (!fastMode) pushNote(`Phản Kích +${actor.state.nextHitBonusPct}% ST`);
    actor.state.nextHitBonusPct = 0;
  }

  const targetTrueRes = getTrueDamageResistPct(target);
  for (const h of actorV13) {
    if (h.shieldActiveAtkBonusPct && actor.shield > 0) {
      damage = Math.floor(damage * (1 + h.shieldActiveAtkBonusPct));
    }
    if (h.domainActiveDmgBonusPct && actor.domainRuntime?.own?.active) {
      damage = Math.floor(damage * (1 + h.domainActiveDmgBonusPct));
    }
    if (h.antiShieldDmgBonusPct && target.shield > 0) {
      damage = Math.floor(damage * (1 + h.antiShieldDmgBonusPct));
      if (!fastMode) pushNote(`Phá Khiên +${Math.round(h.antiShieldDmgBonusPct * 100)}% ST`);
    }
    if (h.highHpThreshold && h.highHpBonusDmgPct && target.currentHp > target.maxHp * h.highHpThreshold) {
      damage = Math.floor(damage * (1 + h.highHpBonusDmgPct));
    }
    if (h.lowHpThreshold && h.lowHpBonusDmgPct && actor.currentHp < actor.maxHp * h.lowHpThreshold) {
      damage = Math.floor(damage * (1 + h.lowHpBonusDmgPct));
    }
    if (h.bonusTrueAtkPct) {
      damage += Math.floor(effectiveAtk * h.bonusTrueAtkPct * (1 + domHaxDmgBonus) * (1 - targetTrueRes));
    }
  }

  if (hasPet(actor, 'viem_nguc_khuyen') && actor.currentHp < actor.maxHp * 0.35) {
    damage = Math.floor(damage * 1.75);
    if (!fastMode) pushNote('Cuồng Nộ ×1.75');
  }
  if (hasPet(actor, 'huyet_nguyet_linh_dieu') && target.currentHp < target.maxHp * 0.50) {
    damage = Math.floor(damage * 1.30);
    if (!fastMode) pushNote('Huyết Ấn +30% ST');
  }
  if (hasItem(actor, 'soul_rare_3') && actor.currentHp < actor.maxHp * 0.50) {
    damage = Math.floor(damage * 1.20);
    if (!fastMode) pushNote('Cuồng Bạo +20% ST');
  }
  if (hasPet(actor, 'man_da_la_linh_thu')) {
    const drain = Math.floor(target.currentHp * 0.15);
    damage += drain;
    const healed = applyHeal(actor, drain);
    if (!fastMode) pushNote(`Ký Sinh (+${healed.toLocaleString('vi-VN')} HP)`);
  }

  if (actor.state.enemyDmgDebuffTurns > 0 && actor.state.enemyDmgDebuffPct > 0) {
    damage = Math.floor(damage * (1 - actor.state.enemyDmgDebuffPct));
  }

  let critLifestealBonus = 0;
  if (isCrit) {
    const critMultiplier = hasItem(actor, 'weapon_epic_2') ? 2.2 : 1.5;
    const targetCritRed = (hasPet(target, 'han_bang_ky_lan') ? 0.45 : 0)
      + (hasItem(target, 'gem_rare_1') ? 0.10 : 0)
      + sumV13Prop(targetV13, 'critDmgRedPct')
      + Number(targetDomOwn.critResistPct || 0);
    const critVuln = Number(targetDomInDeb.critTakenBonusPct || 0);
    const extraCritMult = Math.max(0.10, (critMultiplier - 1) * Math.max(0.25, 1 - Math.min(0.75, targetCritRed)) + critVuln);
    damage = Math.floor(damage * (1 + extraCritMult));

    const critTrueAtk = sumV13Prop(actorV13, 'critBonusTrueAtkPct');
    if (critTrueAtk > 0) {
      damage += Math.floor(effectiveAtk * critTrueAtk * (1 + domHaxDmgBonus) * (1 - targetTrueRes));
    }
    critLifestealBonus = sumV13Prop(actorV13, 'critLifestealPct');
  }

  // 5. Xuyên khiên & Phá khiên (FIX: kiểm tra target.state.antiShieldTurns cho Tru Tiên!)
  let shieldPiercePct = sumV13Prop(actorV13, 'shieldPiercePct') + Number(actorDomOwn.shieldPiercePct || 0);
  if (isCrit) shieldPiercePct += sumV13Prop(actorV13, 'critShieldPiercePct');
  const truTienActive = (target.state?.antiShieldTurns || 0) > 0 && hasItem(actor, 'weapon_mythic_1');
  if (truTienActive) {
    shieldPiercePct = 1.0;
    if (!fastMode) pushNote('Tru Tiên Xuyên 100% Khiên');
  } else if (hasItem(actor, 'weapon_epic_5')) {
    shieldPiercePct += 0.25;
  }
  shieldPiercePct = Math.min(1.0, shieldPiercePct);
  const shieldDamageMult = Math.max(1.0, maxV13Prop(actorV13, 'shieldDamageMult') || 1.0);
  if (target.shield > 0) {
    if (shieldDamageMult > 1.0) if (!fastMode) pushNote(`Phá Khiên ×${shieldDamageMult}`);
    if (shieldPiercePct > 0 && !truTienActive) {
      if (!fastMode) pushNote(`Xuyên ${Math.round(shieldPiercePct * 100)}% Khiên`);
    }
  }

  // 6. Hiệu ứng On-Hit lên mục tiêu (chỉ áp dụng nếu đòn không bị chặn bởi Bất Tử / Nghịch Đảo)
  const applyOnHitEffects = () => {
    const appliedNotes = fastMode ? null : [];
    const pushOnHit = (s) => { if (appliedNotes) appliedNotes.push(s); };
    let appliedBurnThisHit = false;
    let appliedStunThisHit = false;

    if (hasPet(actor, 'dia_long_nham_vuong')) {
      if (target.shield > 0) {
        target.shield = Math.floor(target.shield * 0.50);
        if (!fastMode) pushOnHit('Địa Chấn Phá 50% Khiên');
      }
      if (!isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'def', 'dia_long_nham_vuong', 0.20, 2);
      }
    }

    if (hasPet(actor, 'bang_tuyet_ho') || hasItem(actor, 'weapon_epic_3')) {
      if (rng() < Math.min(0.45, 0.25 * actorHaxProc)) {
        const res = rollControlResist(target, rng, 'freeze');
        if (!res.resisted) { target.state.isStunned = true; appliedStunThisHit = true; if (!fastMode) pushOnHit('Đóng Băng'); }
      }
    }
    if (hasPet(actor, 'tu_dien_linh_ung') || hasItem(actor, 'weapon_epic_5')) {
      if (rng() < Math.min(0.45, 0.25 * actorHaxProc)) {
        const res = rollControlResist(target, rng, 'stun');
        if (!res.resisted) { target.state.isStunned = true; appliedStunThisHit = true; if (!fastMode) pushOnHit('Choáng'); }
      }
    }
    if (hasItem(actor, 'weapon_rare_1') && rng() < 0.15 * actorHaxProc) {
      const res = rollControlResist(target, rng, 'stun');
      if (!res.resisted) { target.state.isStunned = true; appliedStunThisHit = true; if (!fastMode) pushOnHit('Tê Liệt 15%'); }
    }
    if (hasItem(actor, 'soul_rare_4') && rng() < 0.15 * actorHaxProc) {
      const res = rollControlResist(target, rng, 'sleep');
      if (!res.resisted) { target.state.isStunned = true; appliedStunThisHit = true; if (!fastMode) pushOnHit('Ru Ngủ 15%'); }
    }
    if (hasPet(actor, 'hoa_linh_tieu_ho')) {
      if (applyBurnSource(target, 'hoa_linh_tieu_ho', { pct: 0.04, turns: 2, mode: 'max', label: 'Đốm Lửa' })) {
        appliedBurnThisHit = true;
        if (!fastMode) pushOnHit('Đốm Lửa Đốt 4%');
      }
    }
    if (hasItem(actor, 'weapon_rare_2')) {
      if (applyBurnSource(target, 'weapon_rare_2', { pct: 0.05, turns: 2, mode: 'max', label: 'Hỏa Kiếm' })) {
        appliedBurnThisHit = true;
      }
    }
    if (hasItem(actor, 'weapon_mythic_4')) {
      if (applyBurnSource(target, 'weapon_mythic_4', { pct: 0.08, turns: 2, mode: 'max', label: 'Phần Thiên' })) {
        appliedBurnThisHit = true;
        if (!fastMode) pushOnHit('Phần Thiên Đốt 8%');
      }
    }
    if (hasPet(actor, 'minh_gioi_u_ho') && !isControlImmune(target, 'debuff')) {
      applyDebuffSource(target, 'healRed', 'minh_gioi_u_ho', 0.40, 3);
    }
    if (hasItem(actor, 'weapon_epic_6') && !isControlImmune(target, 'debuff')) {
      applyDebuffSource(target, 'enemyDmg', 'weapon_epic_6', 0.18, 2);
    }

    for (const h of actorV13) {
      if (h.ccProc) {
        const effectiveChance = Math.min(0.55, h.ccProc.chance * actorHaxProc);
        if (rng() < effectiveChance) {
          const res = rollControlResist(target, rng, h.ccProc.kind || 'cc');
          if (!res.resisted) {
            target.state.isStunned = true;
            appliedStunThisHit = true;
            if (!fastMode) pushOnHit(h.ccProc.skill);
          }
        }
      }
      if (h.burnOnHitPct) {
        const bChance = h.burnChance ?? 1.0;
        if (rng() < bChance) {
          const burnVal = Math.min(0.14, h.burnOnHitPct * (1 + domHaxDmgBonus));
          if (applyBurnSource(target, h.id, {
            pct: burnVal,
            turns: 2,
            mode: h.burnMode || 'max',
            ignoresShield: Boolean(h.burnIgnoresShield),
            label: h.label || h.source,
          })) {
            appliedBurnThisHit = true;
          }
        }
      }
      if (h.defDebuffPct && !isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'def', h.id, h.defDebuffPct, h.defDebuffTurns || 2);
      }
      if (h.defDebuffPerHitPct && !isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'def', `${h.id}_stack`, h.defDebuffPerHitPct, 3, {
          additiveOnSame: true,
          maxSame: h.defDebuffMaxTotal || 0.48,
        });
      }
      if (h.stealAtkPerHitPct) {
        if (!actor.state.atkStealStacksBySource) actor.state.atkStealStacksBySource = {};
        const curSt = actor.state.atkStealStacksBySource[h.id] || 0;
        if (curSt < (h.stealAtkMaxStacks || 3)) {
          actor.state.atkStealStacksBySource[h.id] = curSt + 1;
          actor.state.atkStealStacks = (actor.state.atkStealStacks || 0) + 1;
          const stolen = Math.floor(target.atk * h.stealAtkPerHitPct);
          target.atk = Math.max(50, target.atk - stolen);
          actor.atk += stolen;
          if (!fastMode) pushOnHit(`Đoạt +${stolen} ATK`);
        }
      }
      if (h.hitEnemyDmgDebuffPct && !isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'enemyDmg', h.id, h.hitEnemyDmgDebuffPct, h.hitEnemyDmgDebuffTurns || 2);
      }
      if (h.enemyAccDebuffPct && !isControlImmune(target, 'blind')) {
        applyDebuffSource(target, 'enemyAcc', h.id, h.enemyAccDebuffPct, h.enemyAccDebuffTurns || 2);
      }
      if (h.enemyHealRedPct && !isControlImmune(target, 'debuff')) {
        applyDebuffSource(target, 'healRed', h.id, h.enemyHealRedPct, 3);
      }
    }

    if (appliedBurnThisHit && actor.state?.ultimate?.active) {
      actor.state.ultimate.burnTicksApplied = (actor.state.ultimate.burnTicksApplied || 0) + 1;
    }
    if (appliedStunThisHit && actor.state?.ultimate?.active) {
      actor.state.ultimate.stunsApplied = (actor.state.ultimate.stunsApplied || 0) + 1;
    }

    return appliedNotes || [];
  };

  if (!opts.deferOnHitEffects && !isCombatantImmortal(target)) {
    const immediateNotes = applyOnHitEffects();
    if (haxNotes && immediateNotes.length > 0) haxNotes.push(...immediateNotes);
  }

  // 7. Lifesteal % & Hồi HP theo đòn đánh
  let lifestealPct = sumV13Prop(actorV13, 'lifestealPct') + critLifestealBonus + Number(actorDomOwn.lifestealPct || 0);
  if (hasPet(actor, 'u_linh_tieu_mieu') || hasPet(actor, 'u_minh_tieu_mieu')) lifestealPct += 0.12;
  if (hasPet(actor, 'minh_gioi_u_ho')) lifestealPct += 0.22;
  if (hasItem(actor, 'weapon_epic_1')) lifestealPct += 0.15;
  if (hasItem(actor, 'weapon_mythic_5')) lifestealPct += 0.25;
  if (hasItem(actor, 'soul_rare_2')) lifestealPct += 0.10;
  if (hasItem(actor, 'soul_epic_4')) lifestealPct += 0.25;

  const onHitMaxHpHealPct = (hasItem(actor, 'weapon_rare_5') ? 0.05 : 0) + sumV13Prop(actorV13, 'onHitMaxHpHealPct');

  // 8. Kết Liễu Tức Thì (Execute — roll ĐỘC LẬP từng nguồn, không nuốt món thứ 2 bằng else-if!)
  let instantExecute = false;
  if (hasPet(actor, 'u_minh_lang_vuong') && target.currentHp < target.maxHp * 0.25 && rng() < 0.45 * actorHaxProc) {
    instantExecute = true;
  }
  if (!instantExecute && hasItem(actor, 'weapon_mythic_5') && target.currentHp < target.maxHp * 0.20 && rng() < 0.40 * actorHaxProc) {
    instantExecute = true;
  }
  if (!instantExecute) {
    for (const h of actorV13) {
      if (h.executeHpPct && h.executeChance && target.currentHp < target.maxHp * h.executeHpPct && rng() < Math.min(0.65, h.executeChance * actorHaxProc)) {
        instantExecute = true;
        break;
      }
    }
  }

  if (instantExecute) {
    const hasV13Block = targetV13.some((e) => e.executeBlock);
    if (!target.state.executeBlockUsed && (hasItem(target, 'gem_mythic_5') || hasItem(target, 'soul_epic_6') || hasV13Block)) {
      target.state.executeBlockUsed = true;
      instantExecute = false;
      if (!fastMode) pushNote('Bị Chặn Kết Liễu Tức Thì');
    } else {
      damage = target.currentHp + (target.shield || 0);
      if (!fastMode) pushNote('Kết Liễu Tức Thì');
    }
  }

  return {
    damage: Math.max(50, Math.floor(damage)),
    isCrit,
    isMiss: false,
    isDodged: false,
    shieldPiercePct,
    shieldDamageMult,
    bonusTrueOnShieldBreakPct: sumV13Prop(actorV13, 'bonusTrueOnShieldBreakPct'),
    ignoreEnemyDmgRedPct: sumV13Prop(actorV13, 'ignoreEnemyDmgRedPct'),
    isTrueDamage: Boolean(elemData.isTrueDamage),
    lifestealPct: Math.min(0.65, lifestealPct),
    onHitMaxHpHealPct,
    applyOnHitEffects: opts.deferOnHitEffects ? applyOnHitEffects : null,
    instantExecute,
    haxTriggered: haxNotes && haxNotes.length > 0 ? haxNotes.join(' + ') : null,
  };
}

/**
 * Giai đoạn 4: Kích hoạt khi nhận sát thương (onDamageReceived)
 */
export function triggerDamageReceived(target, incomingDamage, attacker, rng, dmgOpts = {}) {
  const fastMode = Boolean(dmgOpts?.fastMode);
  let finalDamage = incomingDamage;
  let reflectedDamage = 0;
  const events = [];
  const pushEv = (ev) => { if (!fastMode) events.push(ev); };
  const isSelfHit = Boolean(attacker?.id && target?.id && String(attacker.id) === String(target.id));

  const targetV13 = getActiveV13List(target);
  const attackerDomOwn = getDomainOwnBuffs(attacker);

  // 1. « Hồng Mông Hỗn Độn Trượng »: 35% đổi dmg thành hồi máu + phản 100%
  if (!isSelfHit && hasItem(target, 'weapon_mythic_3') && !hasPet(attacker, 'cuu_vi_hong_ho') && rng() < 0.35) {
    const healed = applyHeal(target, finalDamage);
    reflectedDamage = Math.floor(finalDamage * Math.max(0.20, 1 - Number(attackerDomOwn.reflectResistPct || 0)));
    if (!fastMode) pushEv({ actor: target.id, action: 'absorb_reflect', skill: `Hỗn Độn Nghịch Đảo (+${healed.toLocaleString('vi-VN')} HP & Phản 100%)` });
    return { finalDamage: 0, reflectedDamage, events, nullified: true };
  }

  // 2a. Cửu Vĩ Hộ Thể: Bất tử theo SỐ ĐÒN (3 đòn đầu) & phản 100%
  if ((target.state.immortalHits || 0) > 0) {
    target.state.immortalHits -= 1;
    if (hasPet(target, 'cuu_vi_hong_ho') && !isSelfHit) {
      reflectedDamage += finalDamage;
      if (!fastMode) pushEv({ actor: target.id, action: 'reflect', skill: 'Cửu Vĩ Hộ Thể (Bất Tử & Phản 100%)' });
    } else {
      if (!fastMode) pushEv({ actor: target.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm ST' });
    }
    return { finalDamage: 0, reflectedDamage, events, nullified: true };
  }

  // 2b. Kim Thân Bất Tử THEO HIỆP (tinh_van_cuu_loc 1h, gem_mythic_1 2h, gem_mythic_21 1h, gem_unique_8 2h)
  //     KHÔNG giảm theo từng hit — duy trì xuyên suốt hết hiệp (giảm cuối hiệp bằng tickEndOfTurnImmortality)!
  if ((target.state.isImmortalTurns || 0) > 0) {
    if (hasPet(target, 'cuu_vi_hong_ho') && !isSelfHit) {
      reflectedDamage += finalDamage;
      if (!fastMode) pushEv({ actor: target.id, action: 'reflect', skill: 'Cửu Vĩ Hộ Thể (Bất Tử & Phản 100%)' });
    } else {
      if (!fastMode) pushEv({ actor: target.id, action: 'immune', skill: 'Kim Thân Miễn Nhiễm ST' });
    }
    return { finalDamage: 0, reflectedDamage, events, nullified: true };
  }

  // 3. Giảm sát thương nhận vào
  const ignoreDmgRed = Math.min(0.40, Number(dmgOpts.ignoreEnemyDmgRedPct || 0));
  let totalReduction = 0;
  const applyRed = (pct) => {
    const eff = Math.max(0, pct * (1 - ignoreDmgRed));
    totalReduction = 1 - (1 - totalReduction) * (1 - eff);
  };

  if (target.shield > 0 && hasItem(target, 'gem_mythic_3')) applyRed(0.50);
  if (target.shield > 0 && hasPet(target, 'hoang_tho_thach_su')) applyRed(0.20);
  if (target.shield > 0) {
    for (const h of targetV13) {
      if (h.shieldActiveDmgRedPct) applyRed(h.shieldActiveDmgRedPct);
    }
  }
  if (target.state.damageReductionTurns > 0 && target.state.damageReductionPct > 0) applyRed(target.state.damageReductionPct);
  if (hasItem(target, 'gem_mythic_4')) applyRed(0.30);
  else if (hasItem(target, 'gem_epic_1')) applyRed(0.25);
  else if (hasItem(target, 'gem_common_3')) applyRed(0.06);
  if (hasPet(target, 'huyen_vu_linh_quy')) applyRed(0.25);
  if (hasPet(target, 'han_bang_ky_lan')) applyRed(0.15);
  if (hasItem(target, 'soul_common_4')) applyRed(0.05);
  for (const h of targetV13) {
    if (h.dmgRedPct) applyRed(h.dmgRedPct);
  }
  if (target.element && (target.element.includes('Hỗn Độn') || target.element.includes('Hư Không'))) applyRed(0.15);
  if (dmgOpts.isTrueDamage) {
    const trueRes = getTrueDamageResistPct(target);
    if (trueRes > 0) applyRed(trueRes);
  }

  finalDamage = Math.max(0, Math.floor(finalDamage * Math.max(0.15, 1 - totalReduction)));

  // Hấp thụ % sát thương thành Khiên (cộng dồn nhiều nguồn, trần 60%)
  const absorbShieldPct = Math.min(0.60, sumV13Prop(targetV13, 'absorbDmgAsShieldPct'));
  if (absorbShieldPct > 0 && finalDamage > 0) {
    const gainedShield = addShield(target, finalDamage * absorbShieldPct);
    if (gainedShield > 0) {
      if (!fastMode) pushEv({ actor: target.id, action: 'shield_absorb', skill: `Hấp Thụ Khiên +${gainedShield.toLocaleString('vi-VN')}` });
    }
  }

  if (isSelfHit) {
    return { finalDamage, reflectedDamage: 0, events, nullified: false };
  }

  // 4. Phản đòn (cộng dồn đồng nhất & chặn trần tổng 85%)
  let reflectPctTotal = 0;
  const reflectLabels = fastMode ? null : [];
  if (hasItem(target, 'gem_mythic_2')) { reflectPctTotal += 0.75; if (reflectLabels) reflectLabels.push('Kính Hoa 75%'); }
  if (hasItem(target, 'gem_epic_2')) { reflectPctTotal += 0.30; if (reflectLabels) reflectLabels.push('Hàn Băng 30%'); }
  if (hasPet(target, 'huyen_vu_linh_quy')) { reflectPctTotal += 0.35; if (reflectLabels) reflectLabels.push('Huyền Vũ 35%'); }
  else if (hasPet(target, 'thiet_giap_xich_giac')) { reflectPctTotal += 0.30; if (reflectLabels) reflectLabels.push('Phản Chấn 30%'); }
  else if (hasPet(target, 'thuy_tinh_huyen_ngao')) { reflectPctTotal += 0.25; if (reflectLabels) reflectLabels.push('Nghịch Lưu 25%'); }
  const v13Reflect = sumV13Prop(targetV13, 'reflectPct');
  if (v13Reflect > 0) {
    reflectPctTotal += v13Reflect;
    if (reflectLabels) reflectLabels.push(`${Math.round(v13Reflect * 100)}%`);
  }
  if (Number(target.bossConfig?.reflectPct || 0) > 0) {
    const bossRef = Number(target.bossConfig.reflectPct);
    reflectPctTotal += bossRef;
    if (reflectLabels) reflectLabels.push(`Hộ Thể ${Math.round(bossRef * 100)}%`);
  }
  if (reflectPctTotal > 0) {
    const cappedReflectPct = Math.min(0.85, reflectPctTotal);
    const rawReflect = Math.floor(finalDamage * cappedReflectPct);
    const atkReflectRes = Number(attackerDomOwn.reflectResistPct || 0);
    reflectedDamage = Math.floor(rawReflect * Math.max(0.20, 1 - atkReflectRes));
    if (!fastMode) {
      events.push({ actor: target.id, action: 'reflect', skill: `Phản Đòn (${reflectLabels.join(' + ')})` });
    }
  }

  // 5. Hiệu ứng khống chế / đốt / giảm ATK khi bị tấn công
  if (hasPet(target, 'hoa_thach_nham_nham') && rng() < 0.20) {
    const res = rollControlResist(attacker, rng, 'cc');
    if (!res.resisted) {
      attacker.state.isStunned = true;
      if (!fastMode) pushEv({ actor: target.id, action: 'petrify', skill: 'Hóa Đá (20%)' });
    }
  }
  if (hasItem(target, 'gem_mythic_4') && rng() < 0.25) {
    const res = rollControlResist(attacker, rng, 'freeze');
    if (!res.resisted) {
      attacker.state.isStunned = true;
      if (!fastMode) pushEv({ actor: target.id, action: 'freeze', skill: 'Hàn Băng Tuyệt Vực (Đóng Băng 25%)' });
    }
  }
  if (hasItem(target, 'gem_rare_5') && rng() < 0.15) {
    const res = rollControlResist(attacker, rng, 'slow');
    if (!res.resisted) {
      applyDebuffSource(attacker, 'spd', 'gem_rare_5', 0.15, 2);
      if (!fastMode) pushEv({ actor: target.id, action: 'slow', skill: 'Lôi Linh Phản Giật (-15% SPD)' });
    }
  }

  for (const h of targetV13) {
    if (h.reflectBurnPct && getDotResistance(attacker) < 1) {
      applyBurnSource(attacker, `${h.id}_reflect`, { pct: h.reflectBurnPct, turns: 2, mode: 'max', label: h.label || h.source });
    }
    if (h.reflectAtkDebuffPct && !isControlImmune(attacker, 'debuff')) {
      applyDebuffSource(attacker, 'atk', `${h.id}_reflect`, h.reflectAtkDebuffPct, 2);
    }
    if (h.reflectStunChance && rng() < h.reflectStunChance) {
      const res = rollControlResist(attacker, rng, 'stun');
      if (!res.resisted) {
        attacker.state.isStunned = true;
        if (!fastMode) pushEv({ actor: target.id, action: 'stun', skill: 'Phản Giật Choáng' });
      }
    }
    if (h.reflectFreezeChance && rng() < h.reflectFreezeChance) {
      const res = rollControlResist(attacker, rng, 'freeze');
      if (!res.resisted) {
        attacker.state.isStunned = true;
        if (!fastMode) pushEv({ actor: target.id, action: 'freeze', skill: 'Phản Đóng Băng' });
      }
    }
  }

  return { finalDamage, reflectedDamage, events, nullified: false };
}

/**
 * Giai đoạn 4b: Kích hoạt NGAY SAU KHI nhận sát thương khi vẫn còn sống
 */
export function triggerPostDamage(target, attacker, opts = {}) {
  const fastMode = Boolean(opts?.fastMode);
  const events = [];
  const pushEv = (ev) => { if (!fastMode) events.push(ev); };
  if (!target || target.currentHp <= 0) return events;

  const hpRatio = target.currentHp / target.maxHp;

  // « Luân Hồi Bất Diệt Chiến Hồn » (soul_mythic_3): chỉ đổi máu khi đối thủ có % HP cao hơn!
  if (!target.state.hpSwapUsed && hpRatio < 0.20 && hasItem(target, 'soul_mythic_3')) {
    const targetPct = target.currentHp / target.maxHp;
    const attackerPct = attacker.currentHp / Math.max(1, attacker.maxHp);
    if (attackerPct > targetPct) {
      target.state.hpSwapUsed = true;
      target.currentHp = Math.max(1, Math.floor(target.maxHp * attackerPct));
      attacker.currentHp = Math.max(1, Math.floor(attacker.maxHp * targetPct));
      if (!fastMode) pushEv({
        actor: target.id,
        action: 'hp_swap',
        skill: `Sinh Mệnh Nghịch Chuyển (Đổi ${Math.round(targetPct * 100)}% <-> ${Math.round(attackerPct * 100)}% HP)`,
      });
    }
  }

  // Nguyệt Thần Bạch Vĩ Hồ
  if (!target.state.phaseShiftUsed && (target.currentHp / target.maxHp) < 0.35 && hasPet(target, 'nguyet_than_cuu_vy_bach')) {
    target.state.phaseShiftUsed = true;
    cleanseCombatantDebuffs(target, 99);
    const healed = applyHeal(target, target.maxHp * 0.30);
    target.state.isDoubleTurn = true;
    if (!fastMode) pushEv({
      actor: target.id,
      action: 'phase_shift',
      skill: `Thời Không Hoán Ảnh (Giải + Hồi ${healed.toLocaleString('vi-VN')} HP + 1 Lượt)`,
    });
  }

  // Phượng Hoàng Huyết Tinh (gem_epic_4)
  if (!target.state.phoenixGemHealUsed && (target.currentHp / target.maxHp) < 0.30 && hasItem(target, 'gem_epic_4')) {
    target.state.phoenixGemHealUsed = true;
    const healed = applyHeal(target, target.maxHp * 0.35);
    if (!fastMode) pushEv({
      actor: target.id,
      action: 'heal',
      skill: `Phượng Hoàng Huyết Tinh (+${healed.toLocaleString('vi-VN')} HP)`,
    });
  }

  // U Minh Hắc Diệu Thạch (gem_epic_6)
  if (!target.state.enrageActive && ((target.currentHp + (target.shield || 0)) < target.maxHp * 0.50) && hasItem(target, 'gem_epic_6')) {
    target.state.enrageActive = true;
    target.atk = Math.round(target.atk * 1.20);
    if (!fastMode) pushEv({
      actor: target.id,
      action: 'buff',
      skill: 'U Minh Hắc Diệu (+20% ATK Hết Trận)',
    });
  }

  const targetV13 = getActiveV13List(target);
  if (!target.state.emergencyHealUsedBySource) target.state.emergencyHealUsedBySource = {};
  for (const h of targetV13) {
    if (!target.state.hpSwapUsed && h.hpSwapThreshold && (target.currentHp / target.maxHp) < h.hpSwapThreshold) {
      const targetPct = target.currentHp / target.maxHp;
      const attackerPct = attacker.currentHp / Math.max(1, attacker.maxHp);
      if (attackerPct > targetPct) {
        target.state.hpSwapUsed = true;
        target.currentHp = Math.max(1, Math.floor(target.maxHp * attackerPct));
        attacker.currentHp = Math.max(1, Math.floor(attacker.maxHp * targetPct));
        if (!fastMode) pushEv({
          actor: target.id,
          action: 'hp_swap',
          skill: `Thái Ất Đảo Nghịch (Đổi ${Math.round(targetPct * 100)}% <-> ${Math.round(attackerPct * 100)}% HP)`,
        });
      }
    }
    if (!target.state.phaseShiftUsed && h.phaseShift && (target.currentHp / target.maxHp) < h.phaseShift.hpRatio) {
      target.state.phaseShiftUsed = true;
      cleanseCombatantDebuffs(target, 99);
      const healed = applyHeal(target, target.maxHp * h.phaseShift.healPct);
      if (h.phaseShift.doubleTurn) target.state.isDoubleTurn = true;
      if (!fastMode) pushEv({
        actor: target.id,
        action: 'phase_shift',
        skill: `${h.phaseShift.label} (Hồi ${healed.toLocaleString('vi-VN')} HP + 1 Lượt)`,
      });
    }
    if (h.emergencyHealPct && !target.state.emergencyHealUsedBySource[h.id] && (target.currentHp / target.maxHp) < (h.emergencyThreshold || 0.40)) {
      target.state.emergencyHealUsedBySource[h.id] = true;
      target.state.emergencyHealUsed = true;
      const healed = applyHeal(target, target.maxHp * h.emergencyHealPct);
      if (h.emergencyDefBonusPct) target.def = Math.round(target.def * (1 + h.emergencyDefBonusPct));
      if (!fastMode) pushEv({
        actor: target.id,
        action: 'heal',
        skill: `${h.label || h.source} (+${healed.toLocaleString('vi-VN')} HP${h.emergencyDefBonusPct ? ` & +${Math.round(h.emergencyDefBonusPct * 100)}% DEF` : ''})`,
      });
    }
  }

  return events;
}

/**
 * Giai đoạn 5: Kích hoạt khi chịu đòn chí mạng (onLethalDamage, currentHp <= 0)
 */
export function triggerLethalInterception(target, attacker, rng, turnNumber = 1) {
  const markReviveMetric = () => {
    if (target?.state?.ultimate?.active) {
      target.state.ultimate.reviveTriggered = true;
    }
  };

  // 1. « Bất Hủ Thần Hoàng Ngọc »: Kim Thân Hộ Mệnh (Giữ 1 HP & miễn nhiễm 2 hiệp)
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0 && hasItem(target, 'gem_mythic_1')) {
    target.state.cheatDeathUsed = true;
    target.currentHp = 1;
    target.state.isImmortalTurns = Math.max(target.state.isImmortalTurns || 0, 2);
    target.state.immortalGrantedTurn = turnNumber;
    markReviveMetric();
    return {
      survived: true,
      skill: '« Bất Hủ Thần Hoàng Ngọc » Kim Thân Hộ Mệnh',
      desc: `${target.name} kích hoạt Kim Thân Hộ Mệnh giữ 1 HP & Bất Tử 2 hiệp!`,
    };
  }

  // 2. Bất Tử Chu Tước Hồn (soul_epic_6): Chặn đòn chí tử 1 lần/trận giữ 20% HP
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0 && hasItem(target, 'soul_epic_6')) {
    target.state.cheatDeathUsed = true;
    target.currentHp = Math.max(1, Math.floor(target.maxHp * 0.20));
    markReviveMetric();
    return {
      survived: true,
      skill: 'Bất Tử Chu Tước Hồn (Giữ 20% HP)',
      desc: `${target.name} chặn đòn chí tử giữ lại ${target.currentHp.toLocaleString('vi-VN')} HP!`,
    };
  }

  // 3. v1.3 / v1.7 Cheat-Death (Miễn Tử / Bất Tử Lôi Thạch / Huyền Vũ Ấn)
  const targetV13 = getActiveV13List(target);
  if (!target.state.cheatDeathUsed && target.state.antiImmortalityTurns === 0) {
    for (const h of targetV13) {
      if (h.cheatDeathMinHp1ImmortalTurns) {
        target.state.cheatDeathUsed = true;
        target.currentHp = 1;
        target.state.isImmortalTurns = Math.max(target.state.isImmortalTurns || 0, h.cheatDeathMinHp1ImmortalTurns);
        target.state.immortalGrantedTurn = turnNumber;
        markReviveMetric();
        return {
          survived: true,
          skill: `${h.source} (Giữ 1 HP & Miễn ST ${h.cheatDeathMinHp1ImmortalTurns} Hiệp)`,
          desc: `${target.name} chặn đòn chí tử giữ 1 HP!`,
        };
      }
      if (h.cheatDeathHpPct) {
        target.state.cheatDeathUsed = true;
        target.currentHp = Math.max(1, Math.floor(target.maxHp * h.cheatDeathHpPct));
        if (h.cheatDeathImmortalTurns) {
          target.state.isImmortalTurns = Math.max(target.state.isImmortalTurns || 0, h.cheatDeathImmortalTurns);
          target.state.immortalGrantedTurn = turnNumber;
        }
        markReviveMetric();
        return {
          survived: true,
          skill: `${h.label || h.source} (Giữ ${Math.round(h.cheatDeathHpPct * 100)}% HP${h.cheatDeathImmortalTurns ? ` & Bất Tử ${h.cheatDeathImmortalTurns} Hiệp` : ''})`,
          desc: `${target.name} chặn đòn chí tử giữ lại ${target.currentHp.toLocaleString('vi-VN')} HP!`,
        };
      }
    }
  }

  // 4. Chu Tước Ấu Điểu & v1.3/v1.7 Phượng Hoàng / Chu Tước Tái Sinh
  if (!target.state.reviveUsed && target.state.antiImmortalityTurns === 0 && hasPet(target, 'chu_tuoc_au_dieu')) {
    target.state.reviveUsed = true;
    target.currentHp = Math.max(1, Math.floor(target.maxHp * 0.55));
    markReviveMetric();
    return {
      survived: true,
      skill: 'Niết Bàn Tái Sinh (Hồi Sinh 55% HP)',
      desc: `${target.name} bốc cháy ngọn lửa Chu Tước, hồi sinh 55% HP (${target.currentHp.toLocaleString('vi-VN')} HP)!`,
    };
  }
  if (!target.state.reviveUsed && target.state.antiImmortalityTurns === 0) {
    for (const h of targetV13) {
      if (h.reviveHpPct) {
        target.state.reviveUsed = true;
        target.currentHp = Math.max(1, Math.floor(target.maxHp * h.reviveHpPct));
        if (h.reviveShieldPct) addShield(target, target.maxHp * h.reviveShieldPct);
        markReviveMetric();
        return {
          survived: true,
          skill: `${h.label || h.source} (Hồi Sinh ${Math.round(h.reviveHpPct * 100)}% HP)`,
          desc: `${target.name} tái sinh với ${target.currentHp.toLocaleString('vi-VN')} HP!`,
        };
      }
    }
  }

  return { survived: false, skill: null, desc: null };
}
