import { getProfileData } from '../profileService.js';
import { getUserBusyExplorationAssets } from '../explorerService.js';
import {
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  V17_PET_EVOLUTIONS,
  FUYUMI_SUPREME_EVOLUTION,
  NHIEM_NHIEM_BOT_ID,
  resolveEntityDisplayRarityKey,
  normalizeEnchantGrade,
  getEnchantMultiplier,
} from '../../data/catalog.js';
import { em, petEmoji } from '../../config/emojiHelper.js';
import { V13_PET_HAX, V13_EQUIP_HAX } from './v13HaxRegistry.js';
import { evaluateSetBonus } from './setBonusEngine.js';
import { createUltimateState } from './ultimateEngine.js';
import { computeBondTierState, computeBondBuffsForTier } from '../../data/v18PetBondCatalog.js';

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
    const isEv = Boolean(userOrId.isEvolved || userOrId.pet?.is_evolved);
    const isFuyumiFox = userOrId.petType === 'cuu_vi_hong_ho' || userOrId.pet?.pet_type === 'cuu_vi_hong_ho';
    const evoMeta = isFuyumiFox
      ? FUYUMI_SUPREME_EVOLUTION
      : (isEv && userOrId.petType ? V17_PET_EVOLUTIONS[userOrId.petType] : null);
    const ultDef = userOrId.ultimateDef || evoMeta?.ultimate || null;
    const ultActive = Boolean(ultDef && (isEv || isFuyumiFox || userOrId.ultimateActive));
    userOrId.isEvolved = isEv;
    userOrId.ultimateDef = ultDef;
    userOrId.state = {
      ...createInitialCombatState(ultDef, ultActive),
      ...(userOrId.state || {}),
      ultimate: userOrId.state?.ultimate || createUltimateState(ultDef, ultActive),
    };
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
  const isFuyumiFox = petType === 'cuu_vi_hong_ho';
  const isEvolved = Boolean(pet.is_evolved || pet.isEvolved);
  const evoEntry = isEvolved
    ? (isFuyumiFox ? FUYUMI_SUPREME_EVOLUTION : (V17_PET_EVOLUTIONS[petType] || null))
    : null;
  const effectiveUltDef = evoEntry?.ultimate
    || (isFuyumiFox ? FUYUMI_SUPREME_EVOLUTION.ultimate : null)
    || (id === NHIEM_NHIEM_BOT_ID ? V17_PET_EVOLUTIONS.thoi_khong_than_tinh_ho?.ultimate : null)
    || null;
  const ultActive = Boolean(effectiveUltDef && (isEvolved || isFuyumiFox || id === NHIEM_NHIEM_BOT_ID));
  const petName = isEvolved && evoEntry ? evoEntry.evolved_name : (pet.name || pet.pet_name || catalogPet?.pet_name || 'Hóa Thạch Nham Nham Thú');
  const petRarity = isEvolved && evoEntry && !isFuyumiFox ? 'Tối Thượng Chân Thần' : (pet.rarity || pet.pet_rarity || catalogPet?.rarity || 'Phàm Phẩm');
  const petRarityKey = resolveEntityDisplayRarityKey(catalogPet || pet, isEvolved);
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

  const needEvoScale = Boolean(isEvolved && evoEntry && !pet.evolved_at && !pet.evo_stats_applied && (pet.base_atk !== undefined || pet.atk === undefined));
  const evoAtkMult = needEvoScale ? Number(evoEntry.stat_mult?.atk || 1) : 1;
  const evoDefMult = needEvoScale ? Number(evoEntry.stat_mult?.def || 1) : 1;
  const evoSpdMult = needEvoScale ? Number(evoEntry.stat_mult?.spd || 1) : 1;

  const rawBaseAtk = Math.round((pet.base_atk !== undefined ? Number(pet.base_atk) : (Number(pet.atk) || (catalogPet ? catalogPet.base_atk : 200))) * evoAtkMult);
  const rawBaseDef = Math.round((pet.base_def !== undefined ? Number(pet.base_def) : (Number(pet.def) || (catalogPet ? catalogPet.base_def : 100))) * evoDefMult);
  const rawBaseSpd = Math.round((pet.base_spd !== undefined ? Number(pet.base_spd) : (Number(pet.spd) || (catalogPet ? catalogPet.base_spd : 150))) * evoSpdMult);

  let finalAtk = Math.round(rawBaseAtk * petMult) + bonusAtk;
  let finalDef = Math.round(rawBaseDef * petMult) + bonusDef;
  let finalSpd = Math.round(rawBaseSpd * petMult) + bonusSpd;

  const couplePowerPct = Number(profile?.married?.power_bonus_pct) || 0;
  const rolePetPowerPct = Number(profile?.role_pet_power_bonus_pct) || 0;
  const bondPetPowerPct = Number(
    profile?.pet_bond_power_bonus_pct
    ?? pet.bond_power_bonus_pct
    ?? (pet.affection_points !== undefined || pet.affection_tier !== undefined
      ? computeBondBuffsForTier(computeBondTierState(pet).tier, pet).petPowerPct
      : 0),
  ) || 0;
  const combinedPetPowerPct = couplePowerPct + rolePetPowerPct + bondPetPowerPct;
  if (combinedPetPowerPct > 0) {
    const mult = 1 + (combinedPetPowerPct / 100);
    finalAtk = Math.round(finalAtk * mult);
    finalDef = Math.round(finalDef * mult);
    finalSpd = Math.round(finalSpd * mult);
  }

  const maxHp = Math.max(500, (level * 1000) + (finalDef * 5) + bonusHp);
  const legacyPetCrit = petType === 'loi_dinh_kim_ho' ? 0.15 : petType === 'nguyet_anh_thao_tho' ? 0.08 : petType === 'tu_kim_bach_trach' ? 0.20 : 0;
  const v13PetCrit = V13_PET_HAX[petType]?.flatCritPct || 0;
  const petCritBonus = legacyPetCrit + v13PetCrit;
  const v13EquipCrit = [weapon, gem, soul].reduce(
    (sum, p) => sum + (p?.item_id ? (V13_EQUIP_HAX[p.item_id]?.flatCritPct || 0) : 0),
    0,
  );
  const itemCritBonus = (bonusCrit / 100) + v13EquipCrit + (soul?.item_id === 'soul_common_3' ? 0.04 : soul?.item_id === 'soul_common_5' ? 0.05 : 0);
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

  const setBonus = evaluateSetBonus({
    pet: { element, rarity_key: petRarityKey },
    equipment: { weapon, gem, soul },
    domainLoadout,
  });

  let finalMaxHp = maxHp;
  if (setBonus.statBonusPct > 0) {
    const setMult = 1 + (setBonus.statBonusPct / 100);
    finalAtk = Math.round(finalAtk * setMult);
    finalDef = Math.round(finalDef * setMult);
    finalSpd = Math.round(finalSpd * setMult);
    finalMaxHp = Math.round(finalMaxHp * setMult);
  }

  // Bảo vệ chống cày win lên Bot Nhiễm Nhiễm (/battle @Nhiễm Nhiễm): áp ngưỡng Hộ Pháp Thần Giới
  if (id === NHIEM_NHIEM_BOT_ID) {
    finalAtk = Math.max(finalAtk, 14500);
    finalDef = Math.max(finalDef, 12500);
    finalSpd = Math.max(finalSpd, 13000);
    finalMaxHp = Math.max(finalMaxHp, 120000);
  }

  const computedPower = finalAtk * 3 + finalDef * 2 + finalSpd * 2 + level * 50;
  const rawReportedPower = Number(
    pet.set_bonus_applied && pet.power_before_set_bonus !== undefined
      ? pet.power_before_set_bonus
      : (pet.power || pet.power_score || 0),
  );
  const effectiveReportedPower = strippedBusyEquip
    ? computedPower
    : (pet.set_bonus_applied && Number(pet.power || 0) > 0
        ? Number(pet.power)
        : (rawReportedPower > 0
            ? Math.round(rawReportedPower * (1 + (setBonus.statBonusPct || 0) / 100))
            : computedPower));
  const powerScore = Math.max(100, Math.max(computedPower, effectiveReportedPower));

  return {
    id,
    name,
    avatarUrl,
    userLevel,
    avatarFrame,
    petName,
    petType,
    isEvolved,
    petRarity,
    petRarityKey,
    ultimateDef: effectiveUltDef,
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
      is_evolved: isEvolved,
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
    maxHp: finalMaxHp,
    currentHp: finalMaxHp,
    shield: 0,
    setBonus,
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
    state: createInitialCombatState(effectiveUltDef, ultActive),
  };
}

export function createInitialCombatState(ultimateDef = null, isEvolved = false) {
  return {
    ultimate: createUltimateState(ultimateDef, isEvolved),
    turnCount: 0,
    isImmortalTurns: 0,
    immortalHits: 0,
    immortalGrantedTurn: -1,
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
    emergencyHealUsedBySource: {},
    firstStrikeDone: false,
    pierceDefNext: false,
    enrageActive: false,
    defStacks: 0,
    defBonusApplied: 0,
    atkStacks: 0,
    atkStacksBySource: {},
    atkBonusApplied: 0,
    atkDebuffTurns: 0,
    atkDebuffPct: 0,
    defDebuffTurns: 0,
    defDebuffPct: 0,
    defDebuffTotalPct: 0,
    atkStealStacks: 0,
    atkStealStacksBySource: {},
    spdDebuffTurns: 0,
    spdDebuffPct: 0,
    healReductionTurns: 0,
    healReductionPct: 0,
    debuffSources: {
      atk: {},
      def: {},
      spd: {},
      healRed: {},
      enemyDmg: {},
      enemyAcc: {},
    },
    burnTurns: 0,
    burnPct: 0,
    burnMode: null,
    burnIgnoresShield: false,
    burnSources: {},
    poisonActive: false,
    poisonPct: 0,
    poisonTurns: 0,
    poisonSources: {},
    nextHitBonusPct: 0,
    damageReductionTurns: 0,
    damageReductionPct: 0,
    enemyDmgDebuffTurns: 0,
    enemyDmgDebuffPct: 0,
    shieldExplodePct: 0,
    shieldActiveAtkBonusApplied: false,
  };
}
