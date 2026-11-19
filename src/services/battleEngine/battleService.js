import { compileCombatant } from './statsCompiler.js';
import { getElementalAdvantage } from './elementalMatrix.js';
import {
  triggerBattleStart,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
  triggerLethalInterception,
  hasHax,
} from './haxEngine.js';

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
  triggerBattleStart(attacker, defender, rng);

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

  return {
    success: true,
    winner,
    loser,
    turns,
    initialHp,
    finalHp: {
      attacker: attacker.currentHp,
      defender: defender.currentHp,
    },
    summary,
  };
}
