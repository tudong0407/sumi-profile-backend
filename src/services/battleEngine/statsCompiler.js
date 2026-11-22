import { getProfileData } from '../profileService.js';
import { getUserBusyExplorationAssets } from '../explorerService.js';
import {
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  normalizeEnchantGrade,
  getEnchantMultiplier,
} from '../../data/catalog.js';
import { em, petEmoji } from '../../config/emojiHelper.js';
import { V13_PET_HAX, V13_EQUIP_HAX } from './v13HaxRegistry.js';

function resolveDomainLoadout(profile) {
  const raw = profile?.domain_loadout || profile?.domainLoadout || {};
  const d = typeof raw.domain === 'string'
    ? DOMAIN_BY_ID[raw.domain]
    : (raw.domain || (raw.domain_id ? DOMAIN_BY_ID[raw.domain_id] : null));
  const s = typeof raw.sense === 'string'
    ? DIVINE_SENSE_BY_ID[raw.sense]
    : (raw.sense || (raw.sense_id ? DIVINE_SENSE_BY_ID[raw.sense_id] : null));
  const r = typeof raw.realm === 'string'
    ? DIVINE_REALM_BY_ID[raw.realm]
    : (raw.realm || (raw.realm_id ? DIVINE_REALM_BY_ID[raw.realm_id] : null));
  return {
    domain: d || null,
    sense: s || null,
    realm: r || null,
  };
}

function enrichEquipItem(rawItem, slot) {
  if (!rawItem) return null;
  const cat = rawItem.item_id ? EQUIPMENT_BY_ID[rawItem.item_id] : null;
  const grade = normalizeEnchantGrade(rawItem.enchant_grade || 'D');
  const alreadyApplied = Boolean(rawItem.enchant_applied);
  const mult = alreadyApplied ? 1.0 : getEnchantMultiplier(grade);
  const merged = {
    ...(cat || {}),
    ...rawItem,
    slot: rawItem.slot || cat?.item_type || slot,
    rarity_key: rawItem.rarity_key || cat?.rarity_key || 'common',
    enchant_grade: grade,
    enchant_applied: true,
    hax_skill: rawItem.hax_skill ?? cat?.hax_skill ?? null,
    hax_description: rawItem.hax_description || cat?.hax_description || null,
  };
  merged.bonus_atk = Math.round((Number(merged.bonus_atk) || 0) * mult);
  merged.bonus_def = Math.round((Number(merged.bonus_def) || 0) * mult);
  merged.bonus_spd = Math.round((Number(merged.bonus_spd) || 0) * mult);
  merged.bonus_hp = Math.round((Number(merged.bonus_hp) || 0) * mult);
  return merged;
}

/**
 * Trình biên dịch chỉ số chiến đấu (Stats Compiler)
 * Hợp nhất chỉ số gốc của Pet và 3 món trang bị loadout (Vũ khí, Bảo ngọc, Linh hồn)
 */
export async function compileCombatant(userOrId, role = 'attacker') {
  if (userOrId?.currentHp !== undefined && userOrId?.maxHp !== undefined && userOrId?.petName !== undefined) {
    userOrId.state = { ...createInitialCombatState(), ...(userOrId.state || {}) };
    if (userOrId.baseAtk === undefined) userOrId.baseAtk = userOrId.atk;
    if (userOrId.baseDef === undefined) userOrId.baseDef = userOrId.def;
    if (userOrId.baseSpd === undefined) userOrId.baseSpd = userOrId.spd;
    return userOrId;
  }
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

  const petType = pet.type || pet.pet_type || 'hoa_thach_nham_nham';
  const catalogPet = PET_BY_TYPE[petType] || null;
  const petName = pet.name || pet.pet_name || catalogPet?.pet_name || 'Hóa Thạch Nham Nham Thú';
  const petRarity = pet.rarity || pet.pet_rarity || catalogPet?.rarity || 'Phàm Phẩm';
  const petRarityKey = catalogPet?.rarity_key || pet.rarity_key || 'common';
  const petIcon = pet.icon || petEmoji(petType, em('su_pet_paw'));
  const element = pet.element || catalogPet?.element || 'Thổ';
  const level = Math.max(1, Number(pet.level) || 1);
  const star = Math.max(1, Number(pet.star) || 1);
  const enchantGrade = normalizeEnchantGrade(pet.enchant_grade || 'D');
  const petMult = pet.enchant_applied ? 1.0 : getEnchantMultiplier(enchantGrade);

  const equip = pet.equipment || profile?.equipment || {};
  let weapon = enrichEquipItem(equip.weapon, 'weapon');
  let gem = enrichEquipItem(equip.gem, 'gem');
  let soul = enrichEquipItem(equip.soul, 'soul');

  // Khóa tài sản đang đi khám phá (/explorer): loại trừ trang bị & Linh Vực đang xuất hành để không bị dùng song song!
  let busyExp = null;
  let strippedBusyEquip = false;
  if (/^[0-9]{15,22}$/.test(id)) {
    busyExp = await getUserBusyExplorationAssets(id);
    if (busyExp?.isExploring) {
      if (weapon && busyExp.busyEquipIds.has(weapon.item_id) && Number(weapon.quantity || 1) <= 1) {
        weapon = null;
        strippedBusyEquip = true;
      }
      if (gem && busyExp.busyEquipIds.has(gem.item_id) && Number(gem.quantity || 1) <= 1) {
        gem = null;
        strippedBusyEquip = true;
      }
      if (soul && busyExp.busyEquipIds.has(soul.item_id) && Number(soul.quantity || 1) <= 1) {
        soul = null;
        strippedBusyEquip = true;
      }
    }
  }

  let bonusAtk = 0;
  let bonusDef = 0;
  let bonusSpd = 0;
  let bonusHp = 0;
  let bonusCrit = 0;

  for (const piece of [weapon, gem, soul]) {
    if (!piece) continue;
    bonusAtk += Number(piece.bonus_atk) || 0;
    bonusDef += Number(piece.bonus_def) || 0;
    bonusSpd += Number(piece.bonus_spd) || 0;
    bonusHp += Number(piece.bonus_hp) || 0;
    bonusCrit += Number(piece.bonus_crit) || 0;
  }

  const rawBaseAtk = pet.base_atk !== undefined ? Number(pet.base_atk) : (Number(pet.atk) || (catalogPet ? catalogPet.base_atk : 200));
  const rawBaseDef = pet.base_def !== undefined ? Number(pet.base_def) : (Number(pet.def) || (catalogPet ? catalogPet.base_def : 100));
  const rawBaseSpd = pet.base_spd !== undefined ? Number(pet.base_spd) : (Number(pet.spd) || (catalogPet ? catalogPet.base_spd : 150));

  let finalAtk = Math.round(rawBaseAtk * petMult) + bonusAtk;
  let finalDef = Math.round(rawBaseDef * petMult) + bonusDef;
  let finalSpd = Math.round(rawBaseSpd * petMult) + bonusSpd;

  const couplePowerPct = Number(profile?.married?.power_bonus_pct) || 0;
  if (couplePowerPct > 0) {
    const coupleMult = 1 + (couplePowerPct / 100);
    finalAtk = Math.round(finalAtk * coupleMult);
    finalDef = Math.round(finalDef * coupleMult);
    finalSpd = Math.round(finalSpd * coupleMult);
  }

  const rolePetPowerPct = Number(profile?.role_pet_power_bonus_pct) || 0;
  if (rolePetPowerPct > 0) {
    const roleMult = 1 + (rolePetPowerPct / 100);
    finalAtk = Math.round(finalAtk * roleMult);
    finalDef = Math.round(finalDef * roleMult);
    finalSpd = Math.round(finalSpd * roleMult);
  }

  const maxHp = Math.max(500, (level * 1000) + (finalDef * 5) + bonusHp);
  const legacyPetCrit = petType === 'loi_dinh_kim_ho' ? 0.15 : petType === 'nguyet_anh_thao_tho' ? 0.08 : petType === 'tu_kim_bach_trach' ? 0.20 : 0;
  const v13PetCrit = V13_PET_HAX[petType]?.flatCritPct || 0;
  const petCritBonus = legacyPetCrit + v13PetCrit;
  const v13SoulCrit = V13_EQUIP_HAX[soul?.item_id]?.flatCritPct || 0;
  const itemCritBonus = (bonusCrit / 100) + v13SoulCrit + (soul?.item_id === 'soul_common_3' ? 0.04 : soul?.item_id === 'soul_common_5' ? 0.05 : 0);
  const critRate = Math.min(1.0, Math.max(0.05, 0.05 + itemCritBonus + petCritBonus));

  const petHaxName = pet.hax_skill || catalogPet?.hax_skill || null;
  const petHaxDesc = catalogPet?.hax_description || pet.hax_desc || pet.hax_description || null;
  const rawDomainLoadout = resolveDomainLoadout(profile);
  const domIdKey = (d) => String(d?.domain_id || d?.sense_id || d?.realm_id || d?.id || '');
  const domainLoadout = busyExp?.isExploring
    ? {
        domain: rawDomainLoadout.domain && busyExp.busyDomainIds.has(domIdKey(rawDomainLoadout.domain)) ? null : rawDomainLoadout.domain,
        sense: rawDomainLoadout.sense && busyExp.busyDomainIds.has(domIdKey(rawDomainLoadout.sense)) ? null : rawDomainLoadout.sense,
        realm: rawDomainLoadout.realm && busyExp.busyDomainIds.has(domIdKey(rawDomainLoadout.realm)) ? null : rawDomainLoadout.realm,
      }
    : rawDomainLoadout;

  const computedPower = finalAtk * 3 + finalDef * 2 + finalSpd * 2 + level * 50;
  const powerScore = Math.max(
    100,
    strippedBusyEquip ? computedPower : (Number(pet.power || pet.power_score || 0) || computedPower),
  );

  return {
    id,
    name,
    avatarUrl,
    userLevel,
    avatarFrame,
    petName,
    petType,
    petRarity,
    petRarityKey,
    petIcon,
    petHaxName,
    petHaxDesc,
    element,
    level,
    star,
    enchantGrade,
    enchant_grade: enchantGrade,
    powerScore,
    pet: {
      pet_type: petType,
      pet_name: petName,
      element,
      rarity: petRarity,
      rarity_key: petRarityKey,
      level,
      star,
      enchant_grade: enchantGrade,
      hax_skill: petHaxName,
      hax_description: petHaxDesc,
    },
    baseAtk: finalAtk,
    baseDef: finalDef,
    baseSpd: finalSpd,
    atk: finalAtk,
    def: finalDef,
    spd: finalSpd,
    critRate,
    bonusCrit,
    maxHp,
    currentHp: maxHp,
    shield: 0,
    equipment: { weapon, gem, soul },
    domainLoadout,
    domainRuntime: { own: null, incomingDebuffs: {} },
    hax: {
      pet: petHaxName || petHaxDesc || null,
      petDesc: petHaxDesc,
      weapon: weapon?.hax_skill || weapon?.hax_description || null,
      gem: gem?.hax_skill || gem?.hax_description || null,
      soul: soul?.hax_skill || soul?.hax_description || null,
    },
    state: createInitialCombatState(),
  };
}

export function createInitialCombatState() {
  return {
    turnCount: 0,
    isImmortalTurns: 0,
    antiImmortalityTurns: 0,
    antiShieldTurns: 0,
    haxLockedTurns: 0,
    blindTurns: 0,
    missChanceTurns: 0,
    stunImmuneTurns: 0,
    enemyAccDebuffTurns: 0,
    enemyAccDebuffPct: 0,
    earlySpdBonusTurns: 0,
    earlySpdBonusPct: 0,
    isStunned: false,
    isCharmed: false,
    isDoubleTurn: false,
    reviveUsed: false,
    reviveShieldPct: 0,
    cheatDeathUsed: false,
    hpSwapUsed: false,
    doubleTurnUsed: false,
    phaseShiftUsed: false,
    executeBlockUsed: false,
    phoenixGemHealUsed: false,
    emergencyHealUsed: false,
    firstStrikeDone: false,
    pierceDefNext: false,
    enrageActive: false,
    defStacks: 0,
    atkStacks: 0,
    atkDebuffTurns: 0,
    atkDebuffPct: 0,
    defDebuffTurns: 0,
    defDebuffPct: 0,
    defDebuffTotalPct: 0,
    atkStealStacks: 0,
    spdDebuffTurns: 0,
    spdDebuffPct: 0,
    healReductionTurns: 0,
    healReductionPct: 0,
    burnTurns: 0,
    burnPct: 0,
    burnIgnoresShield: false,
    poisonActive: false,
    poisonPct: 0,
    poisonTurns: 0,
    nextHitBonusPct: 0,
    damageReductionTurns: 0,
    damageReductionPct: 0,
    enemyDmgDebuffTurns: 0,
    enemyDmgDebuffPct: 0,
    shieldExplodePct: 0,
    shieldActiveAtkBonusApplied: false,
  };
}
