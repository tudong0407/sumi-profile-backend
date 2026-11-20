import crypto from 'crypto';
import { compileCombatant } from './statsCompiler.js';
import { getElementalAdvantage } from './elementalMatrix.js';
import { PUBLIC_BASE_URL } from '../../data/catalog.js';
import { em, petEmoji } from '../../config/emojiHelper.js';
import {
  triggerBattleStart,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
  triggerLethalInterception,
  hasHax,
} from './haxEngine.js';

const BATTLE_CACHE_MAX = 200;
const BATTLE_CACHE_TTL_MS = 30 * 60 * 1000;
const battleReportCache = new Map();

export function cacheBattleReport(battleId, result) {
  if (!battleId || !result) return;
  if (battleReportCache.size >= BATTLE_CACHE_MAX) {
    const oldestKey = battleReportCache.keys().next().value;
    if (oldestKey) battleReportCache.delete(oldestKey);
  }
  battleReportCache.set(battleId, { result, createdAt: Date.now() });
}

export function getCachedBattleReport(battleId) {
  if (!battleId || !battleReportCache.has(battleId)) return null;
  const entry = battleReportCache.get(battleId);
  if (Date.now() - entry.createdAt > BATTLE_CACHE_TTL_MS) {
    battleReportCache.delete(battleId);
    return null;
  }
  return entry.result;
}

/**
 * Trình tạo số giả ngẫu nhiên có hỗ trợ Seed cho kiểm thử tất định (Deterministic testing)
 */
function createRng(seed) {
  if (typeof seed === 'number') {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  return () => Math.random();
}

/**
 * Điều phối trận chiến Linh Thú theo lượt (Turn-based Pet Battle Simulation)
 * Hợp đồng giao diện tuân thủ tuyệt đối PROJECT.md §Pet Battle API
 *
 * @param {string|object} attackerUserOrId Người chơi/ID tấn công
 * @param {string|object} defenderUserOrId Người chơi/ID phòng thủ
 * @param {object} options Tùy chọn mô phỏng (maxTurns, seed, ...)
 * @returns {Promise<object>} Kết quả trận đấu chuẩn schema
 */
export async function simulateBattle(attackerUserOrId, defenderUserOrId, options = {}) {
  const safeOptions = options || {};
  const maxTurns = Math.max(1, Math.min(100, Number(safeOptions.maxTurns) || 30));
  const rng = createRng(safeOptions.seed);

  // 1. Biên dịch chỉ số toàn diện (Base stats + 3 món trang bị loadout)
  const attacker = await compileCombatant(attackerUserOrId, 'attacker');
  const defender = await compileCombatant(defenderUserOrId, 'defender');

  const initialHp = {
    attacker: attacker.maxHp,
    defender: defender.maxHp,
  };

  const turns = [];

  // 2. Giai đoạn 1: Kích hoạt hiệu ứng đầu trận (Khiên, cướp Tốc, Tru Tiên Trận)
  const battleStartEvents = triggerBattleStart(attacker, defender, rng) || [];

  // 3. Xác định thứ tự đánh (Initiative)
  // Ưu tiên: Lôi Quang Tốc > So sánh SPD > Attacker ưu tiên nếu bằng nhau
  let attackerFirst = true;
  const atkHasSpeedPriority = hasHax(attacker, 'loi_dinh_kim_ho') || hasHax(attacker, 'lôi quang tốc');
  const defHasSpeedPriority = hasHax(defender, 'loi_dinh_kim_ho') || hasHax(defender, 'lôi quang tốc');

  if (atkHasSpeedPriority && !defHasSpeedPriority) {
    attackerFirst = true;
  } else if (!atkHasSpeedPriority && defHasSpeedPriority) {
    attackerFirst = false;
  } else {
    attackerFirst = attacker.spd >= defender.spd;
  }

  let turnNumber = 0;

  // 4. Vòng lặp chiến đấu theo lượt
  while (attacker.currentHp > 0 && defender.currentHp > 0 && turnNumber < maxTurns) {
    turnNumber++;

    // Xác định thứ tự 2 lượt ra đòn trong hiệp này
    const order = attackerFirst
      ? [{ actor: attacker, target: defender, role: 'attacker' }, { actor: defender, target: attacker, role: 'defender' }]
      : [{ actor: defender, target: attacker, role: 'defender' }, { actor: attacker, target: defender, role: 'attacker' }];

    for (const step of order) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

      const { actor, target, role } = step;

      // 4.1. Giai đoạn 2: Đầu hiệp (Turn Start)
      const turnStartResult = triggerTurnStart(actor, target, rng);

      // Nếu bị choáng / mất lượt
      if (turnStartResult.skipTurn) {
        turns.push({
          turn: turnNumber,
          actor: role,
          action: 'skip',
          damage: 0,
          isCrit: false,
          elementAdvantage: null,
          haxTriggered: 'Mất lượt do khống chế',
          attackerHp: attacker.currentHp,
          defenderHp: defender.currentHp,
        });
        continue;
      }

      // Xác định mục tiêu thực sự (nếu bị Mị Hoặc hoặc Hỗn Loạn thì tự đánh mình)
      const actualTarget = turnStartResult.attackSelf ? actor : target;

      // 4.2. Tính toán tương khắc Ngũ Hành & Dị Tố
      const elemData = getElementalAdvantage(actor.element, actualTarget.element);

      // Sát thương cơ bản: max(50, floor((ATK * 1.5 - DEF * 0.5) * elementalMult))
      const targetDef = elemData.isTrueDamage ? 0 : actualTarget.def;
      const rawBaseDmg = Math.max(50, Math.floor(((actor.atk * 1.5) - (targetDef * 0.5)) * elemData.multiplier));

      // 4.3. Giai đoạn 3: Xuất chiêu (onAttack Phase)
      const attackPhase = triggerAttackPhase(actor, actualTarget, rawBaseDmg, rng);

      let actualDamageDealt = 0;
      const turnStartHax = turnStartResult?.events?.length > 0
        ? (typeof turnStartResult.events[0] === 'object' ? turnStartResult.events[0]?.skill : turnStartResult.events[0])
        : null;
      let haxEventName = attackPhase.haxTriggered || turnStartHax;

      if (!attackPhase.isMiss) {
        // 4.4. Giai đoạn 4: Nhận sát thương (Damage Received & Shield Absorption)
        const damageRecv = triggerDamageReceived(actualTarget, attackPhase.damage, actor, rng);
        let dmgToApply = damageRecv.finalDamage;

        // Xử lý trừ khiên trước
        if (actualTarget.shield > 0 && !actor.state.antiShieldTurns) {
          if (actualTarget.shield >= dmgToApply) {
            actualTarget.shield -= dmgToApply;
            dmgToApply = 0;
          } else {
            dmgToApply -= actualTarget.shield;
            actualTarget.shield = 0;
          }
        }

        // Trừ máu hiện tại
        actualTarget.currentHp = Math.max(0, actualTarget.currentHp - dmgToApply);
        actualDamageDealt = dmgToApply;

        // Xử lý sát thương phản hồi ngược lại
        if (damageRecv.reflectedDamage > 0) {
          actor.currentHp = Math.max(0, actor.currentHp - damageRecv.reflectedDamage);
          haxEventName = haxEventName ? `${haxEventName} + Phản Đòn` : 'Phản Đòn';
        }

        // 4.5. Giai đoạn 5: Kiểm tra tử vong & Can thiệp chí mạng (Lethal Interception)
        if (actualTarget.currentHp <= 0) {
          const lethalInterception = triggerLethalInterception(actualTarget, actor, rng);
          if (lethalInterception.survived) {
            haxEventName = lethalInterception.skill;
          }
        }
      }

      // Ghi nhận diễn biến lượt đấu
      turns.push({
        turn: turnNumber,
        actor: role,
        action: 'attack',
        damage: actualDamageDealt,
        isCrit: attackPhase.isCrit,
        elementAdvantage: elemData.elementAdvantage,
        haxTriggered: haxEventName || null,
        attackerHp: attacker.currentHp,
        defenderHp: defender.currentHp,
      });

      // Nếu có lượt phụ từ « Thái Sơ Thời Không Ma Thần Hồn », ưu tiên đánh thêm 1 đòn
      if (actor.state.isDoubleTurn) {
        actor.state.isDoubleTurn = false;
        if (actualTarget.currentHp > 0) {
          const extraRawDmg = Math.max(50, Math.floor(((actor.atk * 1.5) - (targetDef * 0.5)) * elemData.multiplier));
          const extraAttack = triggerAttackPhase(actor, actualTarget, extraRawDmg, rng);
          actualTarget.currentHp = Math.max(0, actualTarget.currentHp - extraAttack.damage);

          turns.push({
            turn: turnNumber,
            actor: role,
            action: 'attack',
            damage: extraAttack.damage,
            isCrit: extraAttack.isCrit,
            elementAdvantage: elemData.elementAdvantage,
            haxTriggered: 'Thời Không Đình Chỉ (Liên Hoàn Đòn)',
            attackerHp: attacker.currentHp,
            defenderHp: defender.currentHp,
          });
        }
      }
    }
  }

  // 5. Xác định Người chiến thắng / Kẻ thất bại
  const attackerWon = attacker.currentHp > defender.currentHp;
  const winner = attackerWon
    ? { id: attacker.id, name: attacker.name, pet: attacker.petName }
    : { id: defender.id, name: defender.name, pet: defender.petName };

  const loser = attackerWon
    ? { id: defender.id, name: defender.name, pet: defender.petName }
    : { id: attacker.id, name: attacker.name, pet: attacker.petName };

  const summary = `Trận đấu kết thúc sau ${turnNumber} hiệp. ${winner.name} cùng linh thú ${winner.pet} giành chiến thắng áp đảo!`;
  const headline = `${em('su_winner_trophy')} ${winner.name} (${winner.pet}) chiến thắng ${loser.name} (${loser.pet}) sau ${turnNumber} hiệp!`;

  const elementMatchup = {
    attackerToDefender: getElementalAdvantage(attacker.element, defender.element),
    defenderToAttacker: getElementalAdvantage(defender.element, attacker.element),
  };

  // Trích lọc tối đa 5 diễn biến tiêu biểu ngắn gọn cho Ảnh Chiến Báo Full HD+
  const shortPet = (s) => (s && s.length > 12 ? s.slice(0, 11) + '…' : s);
  const highlights = [];
  for (const ev of battleStartEvents.slice(0, 2)) {
    const actorName = shortPet(ev.actor === attacker.id ? attacker.petName : defender.petName);
    const skillShort = String(ev.skill || '').replace(/«[^»]+»\s*/g, '').trim();
    highlights.push(`Khai trận • ${actorName}: ${skillShort}`);
  }
  for (const t of turns) {
    if (highlights.length >= 5) break;
    const aName = shortPet(t.actor === 'attacker' ? attacker.petName : defender.petName);
    const dName = shortPet(t.actor === 'attacker' ? defender.petName : attacker.petName);
    if (t.action === 'skip') {
      highlights.push(`H${t.turn} • ${aName}: ${t.haxTriggered || 'Mất lượt'}`);
    } else if (t.haxTriggered || t.isCrit || t.turn === 1 || t.turn === turnNumber) {
      const critTxt = t.isCrit ? ' CRIT' : '';
      const haxTxt = t.haxTriggered ? ` (${t.haxTriggered.split('(')[0].trim()})` : '';
      highlights.push(`H${t.turn} • ${aName} → ${dName}: -${t.damage.toLocaleString('vi-VN')} HP${critTxt}${haxTxt}`);
    }
  }
  if (highlights.length === 0 && turns.length > 0) {
    const lastT = turns[turns.length - 1];
    const aName = shortPet(lastT.actor === 'attacker' ? attacker.petName : defender.petName);
    highlights.push(`H${lastT.turn} • ${aName} tung đòn kết liễu -${lastT.damage.toLocaleString('vi-VN')} HP`);
  }

  const snapshotCombatant = (c, initHp) => ({
    id: c.id,
    name: c.name,
    avatarUrl: c.avatarUrl || null,
    userLevel: c.userLevel || 1,
    avatarFrame: c.avatarFrame || 'default',
    petName: c.petName,
    petType: c.petType,
    petRarity: c.petRarity || 'Phàm Phẩm',
    petIcon: c.petIcon || petEmoji(c.petType, em('su_pet_paw')),
    element: c.element,
    level: c.level,
    star: c.star,
    atk: c.atk,
    def: c.def,
    spd: c.spd,
    maxHp: initHp,
    finalHp: c.currentHp,
    shield: c.shield || 0,
    critRate: c.critRate,
    equipment: c.equipment,
    hax: c.hax,
  });

  const battleId = crypto.randomBytes(6).toString('hex');
  const reportImagePath = `/api/battle/report/${battleId}.png`;
  const reportImageUrl = `${PUBLIC_BASE_URL}${reportImagePath}`;

  const formatEquipLine = (c) => {
    const w = c.equipment?.weapon?.item_name || 'Không có';
    const g = c.equipment?.gem?.item_name || 'Không có';
    const s = c.equipment?.soul?.item_name || 'Không có';
    return `${em('su_crossed_swords')} ${w} • ${em('su_linhthach')} ${g} • ${em('su_fox_mascot')} ${s}`;
  };
  const formatHaxLine = (c) => {
    const list = [c.hax?.pet, c.hax?.weapon, c.hax?.gem, c.hax?.soul].filter(Boolean);
    return list.length > 0 ? list.join(' • ') : 'Không có';
  };
  const turnLines = turns.slice(0, 8).map((t) => {
    const actorObj = t.actor === 'attacker' ? attacker : defender;
    const targetObj = t.actor === 'attacker' ? defender : attacker;
    if (t.action === 'skip') {
      return `• **Hiệp ${t.turn}** [${actorObj.petName}]: ${em('su_shield_def')} ${t.haxTriggered || 'Mất lượt'}`;
    }
    const critTag = t.isCrit ? ` ${em('su_crit_boom')} **BẠO KÍCH!**` : '';
    const elemTag = t.elementAdvantage ? ` *(${t.elementAdvantage})*` : '';
    const haxTag = t.haxTriggered ? `\n  -> ${em('su_thunder_hax')} *HAX: ${t.haxTriggered}*` : '';
    return `• **Hiệp ${t.turn}** — **${actorObj.petName}** (${actorObj.name}) công kích **${targetObj.petName}** gây **${t.damage.toLocaleString('vi-VN')}** sát thương!${critTag}${elemTag}${haxTag}\n  -> ${em('su_sparkle')} HP còn lại: ${attacker.petName} **${t.attackerHp.toLocaleString('vi-VN')}** | ${defender.petName} **${t.defenderHp.toLocaleString('vi-VN')}**`;
  });

  const discordReport = [
    `### ${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ NGŨ HÀNH & HAX`,
    `**1. Phe Công Kích:** **${attacker.name}** — **${attacker.petName}** *(Hệ ${attacker.element} • Cấp ${attacker.level})*`,
    `• Chỉ số: \`ATK ${attacker.atk.toLocaleString('vi-VN')} | DEF ${attacker.def.toLocaleString('vi-VN')} | SPD ${attacker.spd.toLocaleString('vi-VN')} | HP ${initialHp.attacker.toLocaleString('vi-VN')}\``,
    `• Trang bị Loadout: ${formatEquipLine(attacker)}`,
    `• Tuyệt kỹ HAX: \`${formatHaxLine(attacker)}\``,
    ``,
    `**2. Phe Phòng Thủ:** **${defender.name}** — **${defender.petName}** *(Hệ ${defender.element} • Cấp ${defender.level})*`,
    `• Chỉ số: \`ATK ${defender.atk.toLocaleString('vi-VN')} | DEF ${defender.def.toLocaleString('vi-VN')} | SPD ${defender.spd.toLocaleString('vi-VN')} | HP ${initialHp.defender.toLocaleString('vi-VN')}\``,
    `• Trang bị Loadout: ${formatEquipLine(defender)}`,
    `• Tuyệt kỹ HAX: \`${formatHaxLine(defender)}\``,
    ``,
    `### ${em('su_wiki_scroll')} DIỄN BIẾN TRẬN CHIẾN (${turnNumber} HIỆP)`,
    ...turnLines,
    ``,
    `${em('su_winner_trophy')} **KẾT QUẢ CHUNG CUỘC:** **${winner.name}** cùng linh thú **${winner.pet}** đã đánh bại **${loser.name}** (${loser.pet}) sau **${turnNumber} hiệp**!`
  ].join('\n');

  const finalResult = {
    success: true,
    battleId,
    turnCount: turnNumber,
    winnerRole: attackerWon ? 'attacker' : 'defender',
    winner,
    loser,
    turns,
    initialHp,
    finalHp: {
      attacker: attacker.currentHp,
      defender: defender.currentHp,
    },
    combatants: {
      attacker: snapshotCombatant(attacker, initialHp.attacker),
      defender: snapshotCombatant(defender, initialHp.defender),
    },
    elementMatchup,
    highlights,
    headline,
    summary,
    reportImagePath,
    reportImageUrl,
    discordReport,
  };

  cacheBattleReport(battleId, finalResult);
  return finalResult;
}
