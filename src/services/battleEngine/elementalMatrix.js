/**
 * Hệ thống tương khắc Ngũ Hành & Tứ Đại Dị Tố (PROJECT.md §Milestone M3)
 * Chu kỳ Ngũ Hành: Kim > Mộc > Thổ > Thủy > Hỏa > Kim
 * - Thuận khắc: x1.30 sát thương (+30%)
 * - Bị khắc: x0.80 sát thương (-20%)
 * - Cùng hệ / trung tính: x1.00
 *
 * Tứ Đại Dị Tố:
 * - Lôi (Thunder): Khắc cực mạnh Thủy & Kim (x1.30 sát thương). Thủy/Kim đánh Lôi bị giảm (x0.80).
 * - Ám (Dark) & Quang (Light): Tương khắc lưỡng cực, gây thêm +25% sát thương (x1.25) lẫn nhau.
 * - Hỗn Độn / Hư Không (Chaos / Void): Đứng ngoài ngũ hành, không bị khắc chế, gây x1.20 sát thương chuẩn xuyên giáp, nhận giảm 15% sát thương.
 */

export const NGU_HANH_CYCLE = {
  Kim: 'Moc',
  Moc: 'Tho',
  Tho: 'Thuy',
  Thuy: 'Hoa',
  Hoa: 'Kim',
};

/**
 * Chuẩn hóa tên hệ nguyên tố từ chuỗi tiếng Việt hoặc tiếng Anh
 * @param {string} elemStr
 * @returns {string} Chuẩn hóa: 'Kim' | 'Moc' | 'Tho' | 'Thuy' | 'Hoa' | 'Loi' | 'Am' | 'Quang' | 'HonDon'
 */
export function normalizeElement(elemStr) {
  if (!elemStr) return 'Kim';
  const str = String(elemStr).toLowerCase().trim();

  if (str.includes('hỗn độn') || str.includes('hondon') || str.includes('hon don') || str.includes('hư không') || str.includes('hu khong') || str.includes('chaos') || str.includes('void')) {
    return 'HonDon';
  }
  if (str.includes('lôi') || str.includes('loi') || str.includes('thunder') || str.includes('điện')) {
    return 'Loi';
  }
  if (str.includes('ám') || str.includes('am') || str.includes('dark') || str.includes('minh')) {
    return 'Am';
  }
  if (str.includes('quang') || str.includes('light') || str.includes('thánh')) {
    return 'Quang';
  }
  if (str.includes('hỏa') || str.includes('hoa') || str.includes('fire')) {
    return 'Hoa';
  }
  if (str.includes('thủy') || str.includes('thuy') || str.includes('băng') || str.includes('water') || str.includes('ice')) {
    return 'Thuy';
  }
  if (str.includes('thổ') || str.includes('tho') || str.includes('earth') || str.includes('nham')) {
    return 'Tho';
  }
  if (str.includes('mộc') || str.includes('moc') || str.includes('wood') || str.includes('phong')) {
    return 'Moc';
  }
  if (str.includes('kim') || str.includes('metal')) {
    return 'Kim';
  }
  return 'Kim';
}

/**
 * Tính toán hệ số tương khắc giữa 2 hệ nguyên tố
 * @param {string} attackerElem Tên hệ bên tấn công
 * @param {string} defenderElem Tên hệ bên phòng ngự
 * @returns {{ multiplier: number, elementAdvantage: string|null, isTrueDamage: boolean, defenderDamageReduction: number }}
 */
export function getElementalAdvantage(attackerElem, defenderElem) {
  const normAtk = normalizeElement(attackerElem);
  const normDef = normalizeElement(defenderElem);

  let multiplier = 1.0;
  let elementAdvantage = null;
  let isTrueDamage = false;
  let defenderDamageReduction = 0;

  // 1. Bên thủ là Hỗn Độn: Giảm 15% sát thương nhận vào từ mọi hệ
  if (normDef === 'HonDon') {
    defenderDamageReduction = 0.15;
  }

  // 2. Bên công là Hỗn Độn: Sát thương chuẩn xuyên giáp x1.20
  if (normAtk === 'HonDon') {
    multiplier = 1.20;
    isTrueDamage = true;
    elementAdvantage = 'HonDon_XuyenGiap';
    return { multiplier, elementAdvantage, isTrueDamage, defenderDamageReduction };
  }

  // 3. Hệ Lôi (Thunder)
  if (normAtk === 'Loi' && (normDef === 'Thuy' || normDef === 'Kim')) {
    multiplier = 1.30;
    elementAdvantage = `Loi_KHAC_${normDef}`;
    return { multiplier, elementAdvantage, isTrueDamage, defenderDamageReduction };
  }
  if ((normAtk === 'Thuy' || normAtk === 'Kim') && normDef === 'Loi') {
    multiplier = 0.80;
    return { multiplier, elementAdvantage: null, isTrueDamage, defenderDamageReduction };
  }

  // 4. Ám & Quang đối lập tương khắc
  if ((normAtk === 'Am' && normDef === 'Quang') || (normAtk === 'Quang' && normDef === 'Am')) {
    multiplier = 1.25;
    elementAdvantage = `${normAtk}_KHAC_${normDef}`;
    return { multiplier, elementAdvantage, isTrueDamage, defenderDamageReduction };
  }

  // 5. Chu kỳ Ngũ Hành (Kim > Mộc > Thổ > Thủy > Hỏa > Kim)
  if (NGU_HANH_CYCLE[normAtk] === normDef) {
    multiplier = 1.30;
    // Giữ nguyên chuỗi hiển thị tương thích test suite e.g. 'Kim_KHAC_Moc'
    const dispAtk = attackerElem || normAtk;
    const dispDef = defenderElem || normDef;
    elementAdvantage = `${dispAtk}_KHAC_${dispDef}`;
    return { multiplier, elementAdvantage, isTrueDamage, defenderDamageReduction };
  }

  if (NGU_HANH_CYCLE[normDef] === normAtk) {
    multiplier = 0.80;
    return { multiplier, elementAdvantage: null, isTrueDamage, defenderDamageReduction };
  }

  return { multiplier: 1.0, elementAdvantage: null, isTrueDamage: false, defenderDamageReduction };
}
