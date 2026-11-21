/**
 * src/services/infoService.js
 * Hệ thống tra cứu trực tiếp theo UID hoặc tên (/info <ma_id>) cho Linh Thú, Pháp Bảo, Role, Vật Phẩm, Nhẫn, Background & Khung.
 * Bảo mật: Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho) chỉ hiển thị khi requesterId === FUYUMI_USER_ID.
 */

import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  GACHA_ROLE_CATALOG,
  LEVEL_ROLE_MILESTONES,
  SHOP_CONSUMABLES,
  MARRY_RINGS,
  BACKGROUND_CATALOG,
  AVATAR_FRAMES,
  SHOP_PET_PRICES,
  SHOP_EQUIPMENT_PRICES,
  PUBLIC_BASE_URL,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import { GACHA_DISMANTLE_VALUES, normalizeEmojiAwareQuery } from './inventoryService.js';
import {
  em,
  tierEmoji,
  roleTierEmoji,
  elementEmoji,
  petEmoji,
  itemEmoji,
  ringEmoji,
} from '../config/emojiHelper.js';

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[«»"'`<>@&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupInfo(rawQuery, { requesterId } = {}) {
  const raw = String(rawQuery || '').trim();
  if (!raw) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_QUERY',
      title: `${em('su_wiki_scroll')} THIẾU MÃ TRA CỨU`,
      description: 'Vui lòng nhập Mã UID hoặc Tên Linh Thú / Pháp Bảo / Role / Vật Phẩm cần tra cứu (ví dụ: `weapon_epic_4`, `bach_kim_ho_tu`, `tower_reset_card`, `1573577808867762186`).',
      color: '#f43f5e',
      image_url: '',
      footer: 'SuMi Family • /info <ma_id>',
    };
  }

  const cleanMention = normalizeEmojiAwareQuery(raw).replace(/^<@&(\d+)>$/, '$1').trim();
  const qLower = cleanMention.toLowerCase();
  const qNorm = normText(cleanMention);
  const isFuyumi = String(requesterId || '').trim() === FUYUMI_USER_ID;

  // 1. Exact ID matches first
  const visiblePets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi || isFuyumi);
  let matchedPet = visiblePets.find((p) => p.pet_type.toLowerCase() === qLower);
  let matchedItem = EQUIPMENT_CATALOG.find((i) => i.item_id.toLowerCase() === qLower);
  let matchedRole = GACHA_ROLE_CATALOG.find((r) => r.role_id === cleanMention);
  let matchedLvlRole = LEVEL_ROLE_MILESTONES.find((m) => m.roleId === cleanMention);
  let matchedCons = SHOP_CONSUMABLES.find((c) => c.item_id.toLowerCase() === qLower);
  let matchedRing = MARRY_RINGS.find((r) => r.item_id.toLowerCase() === qLower);
  let matchedBg = BACKGROUND_CATALOG.find((b) => b.bg_id.toLowerCase() === qLower);
  let matchedFrame = AVATAR_FRAMES.find((f) => f.frame_id.toLowerCase() === qLower || `frame_${f.frame_id}`.toLowerCase() === qLower);

  // 2. Partial name fallback
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedPet = visiblePets.find((p) => normText(p.pet_name) === qNorm)
      || visiblePets.find((p) => normText(p.pet_name).includes(qNorm) || p.pet_type.toLowerCase().includes(qLower));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedItem = EQUIPMENT_CATALOG.find((i) => normText(i.item_name) === qNorm)
      || EQUIPMENT_CATALOG.find((i) => normText(i.item_name).includes(qNorm) || i.item_id.toLowerCase().includes(qLower));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedCons = SHOP_CONSUMABLES.find((c) => normText(c.name).includes(qNorm) || c.item_id.toLowerCase().includes(qLower));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedRole = GACHA_ROLE_CATALOG.find((r) => normText(r.name).includes(qNorm));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedLvlRole = LEVEL_ROLE_MILESTONES.find((m) => normText(m.name).includes(qNorm));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedRing = MARRY_RINGS.find((r) => normText(r.name).includes(qNorm));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedBg = BACKGROUND_CATALOG.find((b) => normText(b.name).includes(qNorm) || b.bg_id.toLowerCase().includes(qLower));
  }
  if (!matchedPet && !matchedItem && !matchedRole && !matchedLvlRole && !matchedCons && !matchedRing && !matchedBg && !matchedFrame) {
    matchedFrame = AVATAR_FRAMES.find((f) => normText(f.name).includes(qNorm));
  }

  const lt = em('su_linhthach');

  if (matchedPet) {
    const p = matchedPet;
    const isShopSold = !p.is_exclusive_fuyumi && (p.rarity_key === 'common' || p.rarity_key === 'rare');
    const shopPrice = isShopSold ? (SHOP_PET_PRICES[p.rarity_key] || 300) : null;
    const shopDismantle = shopPrice ? Math.floor(shopPrice * 0.25) : null;
    const gachaDismantle = GACHA_DISMANTLE_VALUES.pet[p.rarity_key] || 5;
    const sourceText = p.is_exclusive_fuyumi
      ? 'Độc quyền Cửu Vĩ Tiên Chủ Fuyumi (Không rơi công khai)'
      : isShopSold
        ? `Cửa Hàng \`/shop\` (**${shopPrice.toLocaleString('vi-VN')} LT**) & Gacha \`/roll loai:pet\` (**${p.drop_rate}%** bậc ${p.rarity})`
        : `Độc quyền Gacha \`/roll loai:pet\` (**${p.drop_rate}%** bậc ${p.rarity})`;

    const lines = [
      `• **Mã UID:** \`${p.pet_type}\``,
      `• **Phẩm chất:** ${tierEmoji(p.rarity_key)} **${p.rarity}** • **Ngũ Hành:** ${elementEmoji(p.element)} **${p.element}**`,
      `• **Chỉ số gốc (Lv.1 • 1★):** \`ATK ${p.base_atk.toLocaleString('vi-VN')} | DEF ${p.base_def.toLocaleString('vi-VN')} | SPD ${p.base_spd.toLocaleString('vi-VN')} | HP ${p.base_hp.toLocaleString('vi-VN')} | Lực ${p.base_power.toLocaleString('vi-VN')}\``,
      `• ${em('su_thunder_hax')} **Kỹ năng HAX (${p.hax_skill}):** ${p.hax_description}`,
      `• **Nguồn sở hữu:** ${sourceText}`,
      p.is_exclusive_fuyumi
        ? '• **Phân rã (`/dismantle`):** Không thể phân rã'
        : '• **Giá thu hồi (`/dismantle`):** ' + (shopDismantle ? `Mua Shop: **${shopDismantle.toLocaleString('vi-VN')}** ${lt} (25%) • ` : '') + `Quay Gacha: **${gachaDismantle.toLocaleString('vi-VN')}** ${lt}`,
      `• *Dùng \`/linhthu hanh_dong:active linh_thu:${p.pet_type}\` để xuất trận hoặc \`/enchant loai:pet muc_tieu:${p.pet_type}\` để khắc ấn.*`,
    ];

    return {
      success: true,
      category: 'pet',
      id: p.pet_type,
      name: p.pet_name,
      title: `${petEmoji(p.pet_type, em('su_pet_paw'))} LINH THÚ: ${p.pet_name}`,
      description: lines.join('\n'),
      color: p.rarity_key === 'supreme' ? '#ec4899' : p.rarity_key === 'mythic' ? '#f59e0b' : p.rarity_key === 'epic' ? '#a855f7' : p.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8',
      image_url: p.is_exclusive_fuyumi
        ? `${PUBLIC_BASE_URL}/api/info/pet/${p.pet_type}.webp?v=1.2`
        : `${PUBLIC_BASE_URL}/api/wiki/pet/${p.pet_type}.webp?v=1.2`,
      footer: `SuMi Family • Tra cứu UID: ${p.pet_type}`,
    };
  }

  if (matchedItem) {
    const it = matchedItem;
    const isShopSold = it.rarity_key === 'common' || it.rarity_key === 'rare';
    const shopPrice = isShopSold ? (SHOP_EQUIPMENT_PRICES[it.rarity_key] || 250) : null;
    const shopDismantle = shopPrice ? Math.floor(shopPrice * 0.20) : null;
    const gachaDismantle = GACHA_DISMANTLE_VALUES.item[it.rarity_key] || 3;
    const slotLabel = it.item_type === 'weapon' ? 'Vũ Khí' : it.item_type === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn';
    const statParts = [
      it.bonus_atk ? `ATK+${it.bonus_atk}` : '',
      it.bonus_def ? `DEF+${it.bonus_def}` : '',
      it.bonus_spd ? `SPD${it.bonus_spd > 0 ? '+' : ''}${it.bonus_spd}` : '',
      it.bonus_hp ? `HP+${it.bonus_hp.toLocaleString('vi-VN')}` : '',
      it.bonus_crit ? `CRIT+${it.bonus_crit}%` : '',
    ].filter(Boolean).join(' • ');

    const sourceText = isShopSold
      ? `Cửa Hàng \`/shop\` (**${shopPrice.toLocaleString('vi-VN')} LT**) & Gacha \`/roll loai:equipment\` (**${it.drop_rate}%** bậc ${it.rarity})`
      : `Độc quyền Gacha \`/roll loai:equipment\` (**${it.drop_rate}%** bậc ${it.rarity})${it.is_unique ? ' • **ĐỘC NHẤT TOÀN SERVER (1 bản)**' : ' • *(Không khóa Unique)*'}`;

    const lines = [
      `• **Mã UID:** \`${it.item_id}\` • **Ô trang bị:** **${slotLabel}**`,
      `• **Phẩm chất:** ${tierEmoji(it.rarity_key)} **${it.rarity}** • **Hệ:** ${elementEmoji(it.element)} **${it.element}**`,
      `• ${em('su_stats_chart')} **Chỉ số cộng:** \`${statParts || 'Cơ bản'}\``,
      `• ${em('su_thunder_hax')} **HAX / Nội tại${it.hax_skill ? ` (${it.hax_skill})` : ''}:** ${it.hax_description || 'Gia tăng chỉ số cơ bản.'}`,
      `• **Nguồn sở hữu:** ${sourceText}`,
      '• **Giá thu hồi (`/dismantle`):** ' + (shopDismantle ? `Mua Shop: **${shopDismantle.toLocaleString('vi-VN')}** ${lt} (20%) • ` : '') + `Quay Gacha: **${gachaDismantle.toLocaleString('vi-VN')}** ${lt}`,
      `• *Dùng \`/equip loai:item ma_id:${it.item_id}\` để trang bị hoặc \`/enchant loai:item muc_tieu:${it.item_id}\` để khắc ấn.*`,
    ];

    return {
      success: true,
      category: 'equipment',
      id: it.item_id,
      name: it.item_name,
      title: `${itemEmoji(it.item_id, em('su_crossed_swords'))} PHÁP BẢO: ${it.item_name}`,
      description: lines.join('\n'),
      color: it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8',
      image_url: `${PUBLIC_BASE_URL}/api/wiki/item/${it.item_id}.webp?v=1.2`,
      footer: `SuMi Family • Tra cứu UID: ${it.item_id}`,
    };
  }

  if (matchedRole) {
    const r = matchedRole;
    const isShopRole = r.rarity_key === 'common';
    const gPerm = GACHA_DISMANTLE_VALUES.role.permanent[r.rarity_key] || 10;
    const gLong = GACHA_DISMANTLE_VALUES.role.timed_60d?.[r.rarity_key] || 6;
    const g30 = GACHA_DISMANTLE_VALUES.role.timed_30d[r.rarity_key] || 5;
    const g7 = GACHA_DISMANTLE_VALUES.role.timed_7d[r.rarity_key] || 3;

    const lines = [
      `• **Mã Role ID:** \`${r.role_id}\``,
      `• **Bậc Role:** ${roleTierEmoji(r.rarity_key)} **${r.rarity}**`,
      `• **Đặc quyền:** ${r.perk}`,
      isShopRole
        ? `• **Nguồn sở hữu:** Mua tại \`/shop\` (**7d:** \`${r.prices['7d']}\` | **30d:** \`${r.prices['30d']}\` | **Vĩnh Viễn:** \`${r.prices.permanent.toLocaleString('vi-VN')}\` ${lt}) hoặc quay \`/roll loai:role\` (**60.5%**)`
        : `• **Nguồn sở hữu:** Độc quyền Gacha \`/roll loai:role\` (**${r.rarity === 'Linh Phẩm' ? '25%' : r.rarity === 'Tiên Phẩm' ? '14%' : '0.5%'}**) *(thời hạn 7d/30d/60d/90d/2% Vĩnh Viễn)*`,
      isShopRole
        ? '• **Giá thu hồi (`/dismantle`):** ' + `Mua Shop hoàn **25%** giá thực trả *(7d: ${Math.floor(r.prices['7d'] * 0.25)} / Vĩnh viễn: ${Math.floor(r.prices.permanent * 0.25).toLocaleString('vi-VN')} LT)* • Quay Gacha: **${g7}/${g30}/${gLong}/${gPerm}** ${lt}`
        : '• **Giá thu hồi (`/dismantle` từ Gacha):** ' + `7d: **${g7}** ${lt} • 30d: **${g30}** ${lt} • 60–90d: **${gLong}** ${lt} • Vĩnh viễn: **${gPerm}** ${lt}`,
    ];

    return {
      success: true,
      category: 'role',
      id: r.role_id,
      name: r.name,
      title: `${roleTierEmoji(r.rarity_key)} ROLE QUYỀN NĂNG: ${r.name}`,
      description: lines.join('\n'),
      color: '#a855f7',
      image_url: '',
      footer: `SuMi Family • Role ID: ${r.role_id}`,
    };
  }

  if (matchedLvlRole) {
    const m = matchedLvlRole;
    return {
      success: true,
      category: 'level_role',
      id: m.roleId,
      name: m.name,
      title: `${em('su_level_up')} ROLE CẤP ĐỘ: ${m.name}`,
      description: [
        `• **Mã Role ID:** \`${m.roleId}\``,
        `• **Yêu cầu mở khóa:** Tự động cấp khi đạt **Cấp ${m.level}** (Chat/Voice EXP).`,
        `• **Ghi chú:** Role Cấp Độ không bán ở Shop và không dùng \`/dismantle\` (chỉ tụt cấp qua \`/doiqua\`).`,
      ].join('\n'),
      color: '#fbbf24',
      image_url: '',
      footer: `SuMi Family • Mốc Cấp ${m.level}`,
    };
  }

  if (matchedCons) {
    const c = matchedCons;
    const isTowerCard = c.item_id === 'tower_reset_card';
    const isEnchantStone = c.item_id === 'enchant_stone';
    return {
      success: true,
      category: 'consumable',
      id: c.item_id,
      name: c.name,
      title: `${c.icon} VẬT PHẨM: ${c.name}`,
      description: [
        `• **Mã UID:** \`${c.item_id}\``,
        `• **Giá bán (\`/shop\`):** **${c.price.toLocaleString('vi-VN')}** ${lt}`,
        `• **Công dụng:** ${c.description}`,
        isTowerCard
          ? `• **Giới hạn:** Mua tối đa **3 thẻ/ngày** • Tích trữ tối đa **10 thẻ** trong túi • Dùng qua \`/nhiemvu hanh_dong:reset\`.`
          : isEnchantStone
            ? `• **Giới hạn & Nguồn:** Mua tối đa **5 viên/ngày** tại \`/shop\` (túi tối đa **99 viên**), rơi thêm tại **Boss Tháp mỗi 5 tầng** & **Hợp Đồng Tuần**. Dùng qua \`/enchant\`.`
            : '• **Nguồn kiếm:** Mua tại `/shop` (hoặc thưởng `/nhiemvu` / Tháp Thí Luyện).',
      ].join('\n'),
      color: '#38bdf8',
      image_url: `${PUBLIC_BASE_URL}/assets/shop/${c.item_id}.png`,
      footer: `SuMi Family • Vật Phẩm: ${c.item_id}`,
    };
  }

  if (matchedRing) {
    const r = matchedRing;
    return {
      success: true,
      category: 'ring',
      id: r.item_id,
      name: r.name,
      title: `${ringEmoji(r.item_id)} NHẪN TIÊN LỮ: ${r.name}`,
      description: [
        `• **Mã UID:** \`${r.item_id}\` • ${tierEmoji(r.rarity_key)} **${r.rarity}**`,
        `• **Giá bán (\`/shop\`):** **${r.price.toLocaleString('vi-VN')}** ${lt}`,
        `• **Buff Đôi:** **+${r.exp_bonus_pct}% EXP** • **+${r.power_bonus_pct}% Chiến Lực**`,
        `• **Mô tả:** ${r.description}`,
      ].join('\n'),
      color: '#fb7185',
      image_url: `${PUBLIC_BASE_URL}/assets/rings/${r.item_id}.png`,
      footer: `SuMi Family • Nhẫn Cưới: ${r.item_id}`,
    };
  }

  if (matchedBg) {
    const b = matchedBg;
    return {
      success: true,
      category: 'background',
      id: b.bg_id,
      name: b.name,
      title: `${em('su_frame_token')} ẢNH NỀN: ${b.name}`,
      description: [
        `• **Mã UID:** \`${b.bg_id}\` • ${tierEmoji(b.rarity_key)} **${b.rarity}**`,
        b.price > 0 ? `• **Giá bán (\`/shop\`):** **${b.price.toLocaleString('vi-VN')}** ${lt}` : '• **Nguồn:** Mở khóa mặc định.',
        `• **Cách dùng:** \`/equip loai:background ma_id:${b.bg_id}\``,
      ].join('\n'),
      color: '#ec4899',
      image_url: `${PUBLIC_BASE_URL}/assets/${b.file}`,
      footer: `SuMi Family • Background: ${b.bg_id}`,
    };
  }

  if (matchedFrame) {
    const f = matchedFrame;
    return {
      success: true,
      category: 'frame',
      id: f.frame_id,
      name: f.name,
      title: `${em('su_frame_token')} KHUNG VIỀN: ${f.name}`,
      description: [
        `• **Mã UID:** \`${f.frame_id}\``,
        f.token_required ? `• **Yêu cầu:** Cần **Lệnh Bài Khung Viền Độc Bản** (800 LT tại \`/shop\`).` : '• **Nguồn:** Mở khóa mặc định.',
        `• **Mô tả:** ${f.description}`,
        `• **Cách dùng:** \`/equip loai:frame ma_id:${f.frame_id}\``,
      ].join('\n'),
      color: '#a855f7',
      image_url: '',
      footer: `SuMi Family • Khung Viền: ${f.frame_id}`,
    };
  }

  return {
    success: false,
    status: 404,
    error: 'INFO_NOT_FOUND',
    title: `${em('su_wiki_scroll')} Không tìm thấy dữ liệu`,
    description: `Không tìm thấy Linh Thú, Pháp Bảo, Role hay Vật Phẩm nào khớp \`${raw}\`.\n• Hãy thử nhập đúng UID trong \`/inv\`, \`/phapbao\`, \`/linhthu\` hoặc một phần tên (VD: \`Thái Cổ\`, \`weapon_epic_4\`, \`tower_reset_card\`).`,
    color: '#f43f5e',
    image_url: '',
    footer: 'SuMi Family • /info <ma_id>',
  };
}
