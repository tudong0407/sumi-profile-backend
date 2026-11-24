/**
 * src/services/battleEngine/setBonusEngine.js
 * Hệ Thống Buff SET Ver 1.5 (2 Tầng Không Cộng Dồn — Tự Chọn Mức Mạnh Hơn):
 * - Tầng A (Full Hệ Thường):
 *   + 4/4 (Pet + 3 Pháp Bảo cùng hệ): +8% toàn chỉ số (ATK / DEF / SPD / HP)
 *   + 5/5 (+ Linh Vực khớp hệ): +12% toàn chỉ số
 * - Tầng B (Set Thần Thoại Cùng Hệ / Chủ Đề):
 *   + 2 món Thần Thoại/Tối Thượng cùng hệ: +6% toàn chỉ số
 *   + 3 món: +12% toàn chỉ số
 *   + 4 món: +18% toàn chỉ số
 *   + 5/5 món: +25% toàn chỉ số + 10% Xuyên Giáp (Def Pierce) + 1 Linh Mạch khởi đầu trận
 */

export const DOMAIN_TO_PET_ELEMENTS = {
  'Kiếm Vực': ['Kim', 'Lôi'],
  'Huyễn Vực': ['Thủy', 'Mộc'],
  'Trận Vực': ['Thổ', 'Hỏa'],
  'Minh Vực': ['Ám'],
  'Thánh Vực': ['Quang'],
  'Hỗn Độn Vực': ['Hỗn Độn'],
};

const MYTHIC_SET_PCT_BY_COUNT = {
  2: 6,
  3: 12,
  4: 18,
  5: 25,
};

function isMythicOrSupreme(rarityKey) {
  const rk = String(rarityKey || '').toLowerCase();
  return rk === 'mythic' || rk === 'supreme';
}

export function doesDomainMatchElement(domain, petElement) {
  if (!domain || !petElement) return false;
  const domElem = String(domain.element || '').trim();
  const mapped = DOMAIN_TO_PET_ELEMENTS[domElem];
  if (!Array.isArray(mapped)) return false;
  return mapped.includes(String(petElement).trim());
}

/**
 * Đánh giá Set Bonus từ Pet, 3 Pháp Bảo (weapon, gem, soul) và Linh Vực (domainLoadout.domain).
 */
export function evaluateSetBonus({ pet = null, equipment = {}, domainLoadout = {} } = {}) {
  const petElem = String(pet?.element || '').trim();
  const weapon = equipment?.weapon || null;
  const gem = equipment?.gem || null;
  const soul = equipment?.soul || null;
  const domain = domainLoadout?.domain || null;

  const gearSlots = [weapon, gem, soul];

  // --- Tầng A: Full Hệ Thường (Pet + 3 Gear cùng hệ; +1 nếu có Domain khớp hệ) ---
  let tierA = {
    active: false,
    tier: null,
    label: '',
    element: petElem || null,
    count: 0,
    maxCount: 5,
    statBonusPct: 0,
    defPiercePct: 0,
    bonusStartingLinhMach: 0,
  };

  if (petElem) {
    const all3GearMatch = gearSlots.every((g) => g && String(g.element || '').trim() === petElem);
    if (all3GearMatch) {
      const domMatch = doesDomainMatchElement(domain, petElem);
      const count = domMatch ? 5 : 4;
      const pct = domMatch ? 12 : 8;
      tierA = {
        active: true,
        tier: domMatch ? 'element_5' : 'element_4',
        label: `Full Hệ ${petElem} (${count}/5)`,
        element: petElem,
        count,
        maxCount: 5,
        statBonusPct: pct,
        defPiercePct: 0,
        bonusStartingLinhMach: 0,
      };
    }
  }

  // --- Tầng B: Set Thần Thoại (2/3/4/5 món Thần Thoại/Tối Thượng cùng hệ) ---
  const mythicPieces = [
    ...(pet && isMythicOrSupreme(pet.rarity_key) && petElem ? [{ kind: 'pet', element: petElem }] : []),
    ...gearSlots
      .filter((g) => g && isMythicOrSupreme(g.rarity_key) && g.element)
      .map((g) => ({ kind: 'gear', element: String(g.element).trim() })),
  ];
  const mythicDomain = domain && (isMythicOrSupreme(domain.rarity_key) || domain.is_exclusive_fuyumi) ? domain : null;

  const candidateElements = new Set(mythicPieces.map((p) => p.element));
  if (mythicDomain && DOMAIN_TO_PET_ELEMENTS[mythicDomain.element]) {
    for (const el of DOMAIN_TO_PET_ELEMENTS[mythicDomain.element]) {
      candidateElements.add(el);
    }
  }

  let bestMythic = null;
  for (const el of candidateElements) {
    let count = mythicPieces.filter((p) => p.element === el).length;
    if (mythicDomain && doesDomainMatchElement(mythicDomain, el)) {
      count += 1;
    }
    const cappedCount = Math.min(5, count);
    const pct = MYTHIC_SET_PCT_BY_COUNT[cappedCount] || 0;
    if (pct > 0 && (!bestMythic || pct > bestMythic.statBonusPct)) {
      bestMythic = {
        active: true,
        tier: `mythic_${cappedCount}`,
        label: `Set Thần Thoại ${el} (${cappedCount}/5)`,
        element: el,
        count: cappedCount,
        maxCount: 5,
        statBonusPct: pct,
        defPiercePct: cappedCount >= 5 ? 10 : 0,
        bonusStartingLinhMach: cappedCount >= 5 ? 1 : 0,
      };
    }
  }

  // Không cộng dồn: chọn tầng có % chỉ số cao hơn (hòa ưu tiên Set Thần Thoại vì có perk phụ)
  const chosen = bestMythic && bestMythic.statBonusPct >= tierA.statBonusPct
    ? bestMythic
    : (tierA.active ? tierA : null);

  if (!chosen) {
    return {
      active: false,
      tier: null,
      label: 'Chưa kích hoạt Set',
      element: petElem || null,
      count: 0,
      maxCount: 5,
      statBonusPct: 0,
      defPiercePct: 0,
      bonusStartingLinhMach: 0,
      badgeText: '',
    };
  }

  const extras = [];
  if (chosen.defPiercePct > 0) extras.push(`+${chosen.defPiercePct}% Xuyên DEF`);
  if (chosen.bonusStartingLinhMach > 0) extras.push(`+${chosen.bonusStartingLinhMach} Linh Mạch`);
  const extraStr = extras.length ? ` • ${extras.join(' • ')}` : '';

  return {
    ...chosen,
    badgeText: `${chosen.label}: +${chosen.statBonusPct}% Chỉ Số${extraStr}`,
  };
}
