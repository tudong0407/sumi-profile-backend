/**
 * src/data/changelogs.js
 * Nhật ký cập nhật chính thức (/updates) — kiến trúc mở rộng cho v1.1 -> v1.2, v1.3...
 */

import { em, gradeEmoji } from '../config/emojiHelper.js';

export const LATEST_VERSION = '1.4.7';
export const DEFAULT_UPDATE_ACK_REWARD_LT = 800;
export const BIG_UPDATE_ACK_REWARD_LT = 1500;

export const CHANGELOGS = [
  {
    version: '1.4.7',
    title: 'CẬP NHẬT v1.4.7 — /AUTOSELL, THÁP 500 TẦNG, WEB LOGS & CÂN BẰNG',
    released_at: '2026-11-23',
    color: '#ec4899',
    is_big_update: false,
    ack_reward_lt: 800,
    summary: 'Ra mắt /autosell cho /roll; tăng tốc render /battle & xem lại từng hiệp trên Web Logs (48h); nâng Tháp Thí Luyện lên 500 tầng (+Linh Vực từ F70); xoay vòng Daily Quest (+10% LT), Chat EXP +15% & thưởng +800 LT khi xác nhận bản cập nhật mới.',
    sections: [
      {
        heading: `${em('su_gacha_dice', '🎲')} Lệnh Mới /autosell & Tối Ưu /battle + Web Logs`,
        bullets: [
          '**`/autosell [pham_pham] [linh_pham] [tien_pham] [giu_mon_moi]`:** Tự động bán Pháp Bảo, Linh Thú, Linh Vực & Role trùng phẩm chất ngay khi `/roll` *(tự kế thừa Khắc Ấn cao hơn trước khi bán; không bao giờ bán Thần Thoại)*.',
          '**`/battle` Nhanh Hơn & Web Logs Theo Từng Hiệp (48h):** Giảm nhẹ `-10%` chất lượng để tăng tốc render; Discord hiển thị mốc **Hiệp `1 / 5 / 10 / 15 / 20` & Kết**; bấm **Xem Nhật Ký Trận Đấu** để render từng hiệp, theo dõi tụt HP & tua lại lượt trên web *(lưu 48 giờ)*.',
        ],
      },
      {
        heading: `${em('su_tower_boss', '🗼')} Tháp 500 Tầng, Daily Quest Xoay Vòng & Chat EXP +15%`,
        bullets: [
          '**Tháp Thí Luyện 500 Tầng:** Buff nền **+10%**, random chiến lực **±12%/trận**, tăng giới hạn mua Thẻ Reset Tháp lên **5 lần/ngày** *(tối đa 15 thẻ)*; NPC bật **Linh Vực từ F70** *(+Thần Thức F150, +Thần Cảnh F250)*, tỉ lệ Thần Thoại tăng dần tới **100% từ F100+** & phân bậc Khắc Ấn `D → S`.',
          '**Nhiệm Vụ Ngày Mới (+10% LT) & Chat EXP +15%:** 2 nhiệm vụ cố định + 3 nhiệm vụ xoay vòng từ 10 hoạt động *(mốc 5/5: `+130 LT` + quà)*; Chat EXP gốc tăng lên **23–35 EXP/tin**. Xác nhận bản cập nhật mới nhận ngay **+800 LT**!',
        ],
      },
      {
        heading: `${em('su_wiki_scroll', '📖')} Gọn Hơn Cho /wiki, /updates & Gỡ Footer Thừa`,
        bullets: [
          'Rút gọn toàn bộ `/wiki` & `/updates` súc tích, đồng bộ **165 Pháp Bảo** *(3 dropdown mỗi loại)* và **90 Linh Thú** *(5 dropdown trực tiếp)*, bổ sung các lệnh còn thiếu & gỡ toàn bộ footer không cần thiết.',
        ],
      },
    ],
  },
  {
    version: '1.4.5',
    title: 'THỐNG KÊ /EXP, GRADIENT ROLE & HOÀN THIỆN HỆ THỐNG v1.4.5',
    released_at: '2026-11-22',
    color: '#ec4899',
    ack_reward_lt: 800,
    summary: 'Ra mắt /exp xem % Boost Chat/Voice, nâng cấp Gradient 2 màu cho Role cao cấp, tối giản /equip còn 1 tham số ma_id & tự phục hồi Level Role.',
    sections: [
      {
        heading: `${em('su_level_up', '📈')} Lệnh /exp, Gradient Role & /equip 1 Chạm`,
        bullets: [
          '**`/exp [user]` & Gradient Role:** Xem tổng % Boost Chat/Voice từ Level, Role, Tiên Lữ, Gia Tộc; cấp Gradient 2 màu cho Role Linh / Tiên / Thần Thoại.',
          '**`/equip <ma_id>` & Đồng Bộ Tài Sản:** Tự nhận diện Pháp Bảo, Linh Vực, Pet, Ảnh Nền, Khung, Role qua 1 mã UID/Emoji; tự cấp bù Level Roles & đồng bộ Nhật Ký Web `/linhmach`.',
        ],
      },
    ],
  },
  {
    version: '1.4',
    title: 'ĐẠO ÁP CỬU CHÂU, CHIẾM LINH MẠCH & KHÁM PHÁ v1.4',
    released_at: '2026-11-22',
    color: '#ec4899',
    ack_reward_lt: 800,
    summary: 'Mở Đạo Áp Cấp 2 cho Linh Vực Thần Thoại, Shop Ngày giảm giá 15–40%, Tổ Đội Chiếm Linh Mạch (/party, /linhmach) & Khám Phá 12 địa danh (/explorer).',
    sections: [
      {
        heading: `${em('dao_ap_crest', '⚡')} Đạo Áp, Shop Ngày, Linh Mạch & Khám Phá`,
        bullets: [
          '**Đạo Áp & Shop Ngày:** Linh Vực Thần Thoại kích hoạt Đạo Áp khi phá Vực địch (`+20%–30%` hiệu lực); Shop Ngày reset `00:00` với 10 ô giảm `15%–40%`.',
          '**`/party`, `/linhmach` & `/explorer`:** Lập tổ đội 3 người tranh mỏ Linh Mạch theo 6 khung giờ vàng; khám phá 12 địa danh (`2/3/6/12h`) săn Đá Khắc Ấn Tuyệt Đối `0.5%` & nhặt đồ rơi `60%`.',
          '**Top Tuần & Minigame UI:** Tự tổng kết Top 10 Lực Chiến `19:00` Chủ Nhật; `/slots`, `/crash`, `/blackjack`, `/giatoc` cập nhật tại chỗ.',
        ],
      },
    ],
  },
  {
    version: '1.3.1',
    title: 'HIỂN THỊ LINH VỰC & SƠ ĐỒ NGŨ VỰC v1.3.1',
    released_at: '2026-11-22',
    color: '#ec4899',
    ack_reward_lt: 800,
    summary: 'Hiển thị biểu tượng Linh Vực • Thần Thức • Thần Cảnh trên /profile & /battle, nâng cấp sơ đồ Ngũ Vực trên /wiki.',
    sections: [
      {
        heading: `${em('su_realm_star')} Giao Diện Linh Vực & Bách Khoa`,
        bullets: [
          'Hiển thị huy hiệu Linh Vực • Thần Thức • Thần Cảnh trên thẻ `/profile`, `/battle`, `/inv`, `/linhthu` và sơ đồ 5 Hệ Vực trên `/wiki`.',
        ],
      },
    ],
  },
  {
    version: '1.3',
    title: 'LÃNH ĐỊA LINH VỰC, NÔNG TRẠI & BÁCH KHOA v1.3',
    released_at: '2026-11-22',
    color: '#ec4899',
    ack_reward_lt: 800,
    summary: 'Ra mắt Linh Vực (/linhvuc), 90 Linh Thú & 165 Pháp Bảo cân bằng <=15%, Nông Trại (/farm, /exchange) và 4 Minigame Linh Thạch.',
    sections: [
      {
        heading: `${em('su_realm_star')} Linh Vực, Nông Trại & 4 Minigame`,
        bullets: [
          '**`/linhvuc` & Mở Rộng Kho:** 30 Linh Vực, 15 Thần Thức, 15 Thần Cảnh vào trận từ Hiệp 2; mở rộng lên **90 Pet** & **165 Pháp Bảo** *(chuẩn hóa Emoji UID)*.',
          '**`/farm`, `/exchange` & Minigame:** Trồng trọt/ấp trứng (`6h/12h/24h`) lấy Linh Quả đổi quà; ra mắt `/coinflip`, `/blackjack`, `/slots`, `/crash`; tăng `/job` lên `8 ca/ngày`.',
        ],
      },
    ],
  },
  {
    version: '1.2',
    title: 'KHẮC ẤN D→S & KINH TẾ TU TIÊN v1.2',
    released_at: '2026-11-22',
    color: '#a855f7',
    ack_reward_lt: 800,
    summary: 'Mở Khắc Ấn D→S (/enchant), Tháp 200 tầng, 6 Nghề /job, Hợp Đồng Tuần & cộng dồn /inv.',
    sections: [
      {
        heading: `${gradeEmoji('S')} Khắc Ấn D→S, Nghề & Cộng Dồn /inv`,
        bullets: [
          '**`/enchant` & Hợp Đồng Tuần:** Cường hóa `D → S` (`+0%..+40%`, Pity `+5%`, dùng Đá Khắc Ấn); thêm 6 Nghề `/job` & 3 Hợp Đồng Tuần.',
          '**`/inv` & Gacha `0.5%`:** Tự cộng dồn & giữ tư chất cao nhất khi `/roll` trùng; chốt tỉ lệ Thần Thoại `0.5%` và chống farm `/dismantle`.',
        ],
      },
    ],
  },
  {
    version: '1.1',
    title: 'HỆ THỐNG HAX, ĐẤU TRƯỜNG PVE & LỆNH TRA CỨU v1.1',
    released_at: '2026-11-21',
    color: '#ec4899',
    ack_reward_lt: 800,
    summary: 'Kích hoạt HAX Engine, bổ sung PvE Tự Do, Thẻ Reset Tháp, Voice EXP +20% và bộ lệnh /info, /phapbao, /linhthu.',
    sections: [
      {
        heading: `${em('su_sparkle')} HAX Engine, PvE Tự Do & Tra Cứu`,
        bullets: [
          'Kích hoạt HAX cho toàn bộ Pháp Bảo & Linh Thú; thêm PvE Tự Do (`/battle` trống), thưởng lên cấp (`+50..+400 LT`) và tăng Voice EXP (`85–135 / 5p`).',
          'Ra mắt `/info`, `/phapbao`, `/linhthu`, `/dismantle` hàng loạt & `/updates`.',
        ],
      },
    ],
  },
];

export const CHANGELOG_BY_VERSION = Object.fromEntries(CHANGELOGS.map((c) => [c.version, c]));

export function getUpdateAckReward(version = LATEST_VERSION) {
  const entry = CHANGELOG_BY_VERSION[String(version || LATEST_VERSION).trim().toLowerCase().replace(/^v/, '')];
  if (entry && Number.isFinite(Number(entry.ack_reward_lt))) {
    return Math.max(0, Math.round(Number(entry.ack_reward_lt)));
  }
  return entry?.is_big_update ? BIG_UPDATE_ACK_REWARD_LT : DEFAULT_UPDATE_ACK_REWARD_LT;
}

export function getChangelogPayload(rawVersion = '') {
  const cleaned = String(rawVersion || '').trim().toLowerCase().replace(/^v/, '');
  const version = cleaned || LATEST_VERSION;
  const entry = CHANGELOG_BY_VERSION[version];

  if (!entry) {
    const available = CHANGELOGS.map((c) => `\`v${c.version}\``).join(', ');
    return {
      success: false,
      status: 404,
      error: 'VERSION_NOT_FOUND',
      version,
      latest_version: LATEST_VERSION,
      available_versions: CHANGELOGS.map((c) => c.version),
      title: `${em('su_wiki_scroll')} Không tìm thấy phiên bản v${version}`,
      description: `Phiên bản \`${version}\` chưa tồn tại trong nhật ký.\n• Các phiên bản hiện có: ${available}\n• Dùng \`/updates\` để xem bản mới nhất **v${LATEST_VERSION}**.`,
      color: '#f43f5e',
      footer: '',
    };
  }

  const descriptionLines = [
    `*Ngày phát hành: \`${entry.released_at}\` • ${entry.summary}*`,
    '',
    ...entry.sections.flatMap((sec) => [
      `**${sec.heading}**`,
      ...sec.bullets.map((b) => `• ${b}`),
      '',
    ]),
  ];

  let description = descriptionLines.join('\n').trim();
  if (description.length > 3950) {
    description = description.slice(0, 3940) + '\n…';
  }

  return {
    success: true,
    version: entry.version,
    latest_version: LATEST_VERSION,
    available_versions: CHANGELOGS.map((c) => c.version),
    ack_reward_lt: getUpdateAckReward(entry.version),
    is_big_update: Boolean(entry.is_big_update),
    title: `${em('su_level_up')} ${entry.title}`,
    description,
    color: entry.color,
    footer: '',
  };
}
