import { getProfileData } from '../profileService.js';
import { em, petEmoji } from '../../config/emojiHelper.js';

/**
 * Trình biên dịch chỉ số chiến đấu (Stats Compiler)
 * Hợp nhất chỉ số gốc của Pet và 3 món trang bị loadout (Vũ khí, Bảo ngọc, Linh hồn)
 * - Vũ khí: bonus_atk, bonus_spd, bonus_crit, weapon HAX
 * - Bảo ngọc: bonus_def, bonus_spd, bonus_hp, gem HAX
 * - Linh hồn: bonus_atk, bonus_def, bonus_spd, soul HAX
 */
export async function compileCombatant(userOrId, role = 'attacker') {
  if (userOrId?.currentHp !== undefined && userOrId?.maxHp !== undefined && userOrId?.petName !== undefined) return userOrId;
  let profile = null;

  if (typeof userOrId === 'string') {
    profile = await getProfileData(userOrId);
  } else if (typeof userOrId === 'object' && userOrId !== null) {
    if (userOrId.pet && (userOrId.username || userOrId.name || userOrId.userId || userOrId.user_id)) {
      profile = userOrId;
    } else {
      const uId = userOrId.userId || userOrId.user_id || 'unknown';
      profile = await getProfileData(uId);
    }
  }

  const id = String(profile?.user_id || profile?.userId || (role === 'attacker' ? 'attacker_1' : 'defender_2'));
  const name = String(profile?.username || profile?.name || (role === 'attacker' ? 'Đấu Sĩ 1' : 'Đấu Sĩ 2'));
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl || null;
  const userLevel = Math.max(1, Number(profile?.level) || 1);
  const avatarFrame = profile?.avatar_frame || 'default';
  const pet = profile?.pet || {};

  const petName = pet.name || pet.pet_name || 'Hóa Thạch Nham Nham Thú';
  const petType = pet.type || pet.pet_type || 'hoa_thach_nham_nham';
  const petRarity = pet.rarity || pet.pet_rarity || 'Phàm Phẩm';
  const petIcon = pet.icon || petEmoji(petType, em('su_pet_paw'));
  const element = pet.element || 'Thổ';
  const level = Math.max(1, Number(pet.level) || 1);
  const star = Math.max(1, Number(pet.star) || 1);

  // Trích xuất 3 món trang bị loadout
  const equip = pet.equipment || profile?.equipment || {};
  const weapon = equip.weapon || null;
  const gem = equip.gem || null;
  const soul = equip.soul || null;

  const weaponAtk = Number(weapon?.bonus_atk) || 0;
  const weaponSpd = Number(weapon?.bonus_spd) || 0;
  const weaponCrit = Number(weapon?.bonus_crit) || 0;

  const gemDef = Number(gem?.bonus_def) || 0;
  const gemSpd = Number(gem?.bonus_spd) || 0;
  const gemHp = Number(gem?.bonus_hp) || 0;

  const soulAtk = Number(soul?.bonus_atk) || 0;
  const soulDef = Number(soul?.bonus_def) || 0;
  const soulSpd = Number(soul?.bonus_spd) || 0;

  const bonusAtk = weaponAtk + soulAtk;
  const bonusDef = gemDef + soulDef;
  const bonusSpd = weaponSpd + gemSpd + soulSpd;
  const bonusHp = gemHp;
  const bonusCrit = weaponCrit;

  let finalAtk = Number(pet.atk) || 200;
  let finalDef = Number(pet.def) || 100;
  let finalSpd = Number(pet.spd) || 150;

  if (pet.base_atk !== undefined && pet.bonus_atk !== undefined) {
    finalAtk = Number(pet.base_atk) + bonusAtk;
    finalDef = Number(pet.base_def) + bonusDef;
    finalSpd = Number(pet.base_spd) + bonusSpd;
  }

  // Buff Chiến Lực đôi từ Tiên Lữ (/marry)
  const couplePowerPct = Number(profile?.married?.power_bonus_pct) || 0;
  if (couplePowerPct > 0) {
    const coupleMult = 1 + (couplePowerPct / 100);
    finalAtk = Math.round(finalAtk * coupleMult);
    finalDef = Math.round(finalDef * coupleMult);
    finalSpd = Math.round(finalSpd * coupleMult);
  }

  // Tính HP chiến đấu chuẩn: (Level * 1000) + (FinalDef * 5) + BonusHp
  const maxHp = Math.max(500, (level * 1000) + (finalDef * 5) + bonusHp);

  // Tỷ lệ bạo kích cơ bản 5% + bonus từ vũ khí
  const critRate = Math.min(1.0, Math.max(0.05, 0.05 + (bonusCrit / 100)));

  return {
    id,
    name,
    avatarUrl,
    userLevel,
    avatarFrame,
    petName,
    petType,
    petRarity,
    petIcon,
    element,
    level,
    star,
    atk: finalAtk,
    def: finalDef,
    spd: finalSpd,
    critRate,
    bonusCrit,
    maxHp,
    currentHp: maxHp,
    shield: 0,
    equipment: { weapon, gem, soul },
    hax: {
      pet: pet.hax_skill || pet.hax_desc || null,
      weapon: weapon?.hax_skill || null,
      gem: gem?.hax_skill || null,
      soul: soul?.hax_skill || null,
    },
    state: {
      isImmortalTurns: 0,
      antiImmortalityTurns: 0,
      antiShieldTurns: 0,
      isStunned: false,
      isCharmed: false,
      isDoubleTurn: false,
      reviveUsed: false,
      cheatDeathUsed: false,
      hpSwapUsed: false,
      doubleTurnUsed: false,
      missChanceTurns: 0,
      pierceDefNext: false,
      haxLockedTurns: 0,
    },
  };
}
