/**
 * src/data/changelogs.js
 * Nhật ký cập nhật chính thức (/update) — kiến trúc mở rộng cho v1.1 -> v1.2, v1.3...
 */

import { em } from '../config/emojiHelper.js';

export const LATEST_VERSION = '1.1';

export const CHANGELOGS = [
  {
    version: '1.1',
    title: 'ĐẠI NÂNG CẤP TU TIÊN GIỚI v1.1 — HAX & ĐẤU TRƯỜNG',
    released_at: '2026-11-21',
    color: '#ec4899',
    summary: 'Mở rộng gấp đôi kho Linh Thú & Pháp Bảo, đại tu HAX Engine, bổ sung PvE Tự Do, Thẻ Reset Tháp và bộ lệnh tra cứu nhanh.',
    sections: [
      {
        heading: `${em('su_sparkle')} Tính Năng & Cơ Chế Mới`,
        bullets: [
          '**40 Linh Thú & 65 Pháp Bảo Loadout:** Thêm 20 Linh Thú mới + 20 Pháp Bảo mới (6 Thần Thoại mới không khóa Unique cho mọi người cùng săn).',
          '**Thẻ Reset Lượt Đi Tháp (`200 LT`):** Bán trong `/shop` (giới hạn `3/ngày`, giữ tối đa `10` trong túi). Dùng qua `/nhiemvu hanh_dong:reset` để hồi `5/5` lượt Tháp.',
          '**Đấu Trường PvE Tự Do (`/battle` bỏ trống đối thủ):** Đánh không giới hạn; `25` lượt nhận thưởng/ngày (Thắng `+10 LT`, Thua `-5 LT`, PvP tối đa `15/ngày`). Tháp Thắng cộng thêm `+10 LT`, Thua `-5 LT`.',
          '**Thưởng Linh Thạch Lên Cấp (1 lần/cấp):** Vượt cấp mới nhận `+50` đến `+400 LT`/cấp + thưởng lớn tại mỗi mốc `10` cấp (chống đốt EXP `/doiqua` cày lại).',
          '**Huy Hiệu Cấp Role 4 Bậc:** Phân biệt rõ Phàm / Linh / Tiên / Thần Thoại trên `/inv`, `/shop`, `/info` và `/wiki`.',
          '**Hiển Thị Sao Linh Thú (`10★`) & Log Battle Chi Tiết:** Xem ngay số sao trên thẻ `/profile` & `/battle`, kèm log chi tiết HAX Vũ Khí/Pet.',
        ],
      },
      {
        heading: `${em('su_wiki_scroll')} Lệnh Mới & Nâng Cấp Lệnh`,
        bullets: [
          '`/info <ma_id>` — Tra cứu trực tiếp Linh Thú, Pháp Bảo, Role, Vật Phẩm, nguồn rơi & giá thu hồi.',
          '`/phapbao` — Xem toàn bộ Pháp Bảo không bị cắt dòng, kèm Dropdown lọc & sắp xếp ở hàng trên cùng.',
          '`/linhthu` — Thêm Dropdown sắp xếp theo Chiến Lực / Phẩm / Cấp / Sao ở hàng trên cùng.',
          '`/dismantle` — Phá hàng loạt Pháp Bảo qua danh sách cách dấu phẩy hoặc `all_common` / `all_rare` / `all_epic` (tự động giữ lại món đang đeo).',
          '`/update [phien_ban]` — Xem tóm tắt tính năng từng bản cập nhật.',
        ],
      },
      {
        heading: `${em('su_thunder_hax')} Cân Bằng & Sửa Lỗi Quan Trọng`,
        bullets: [
          '**Cân bằng 20 Pet cũ & sửa 5 lỗi HAX Engine:** Kích hoạt HAX cho toàn bộ 65 Pháp Bảo; sửa Bạch Kim Hổ Tử (`35%` xuyên giáp), Kim Sí Điêu Hoàng (mù đúng 2 hiệp), Tru Tiên (xuyên khiên 3 lượt), Luân Hồi Bất Diệt Chiến Hồn.',
          '**Sửa lỗi cấp Role Discord (Bug #7):** Đeo/quay Role nhận ngay Role thật trên Discord & cấp bù toàn bộ thành viên đang đeo.',
          '**Sửa lỗi treo Voice không lên EXP & tăng +20% Voice EXP (`85–135 / 5p`):** Chấm công treo Voice định kỳ mỗi 12 phút không cần thoát phòng.',
          '**Chống Lạm Dụng Gacha → Dismantle:** Món mua Shop hoàn 50% giá thực trả; món từ Gacha dùng bảng giá phân rã chuẩn chống farm vô hạn Linh Thạch.',
          'Xóa toàn bộ chữ `"Full HD+"` dư thừa trên giao diện.',
        ],
      },
    ],
  },
];

export const CHANGELOG_BY_VERSION = Object.fromEntries(CHANGELOGS.map((c) => [c.version, c]));

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
      description: `Phiên bản \`${version}\` chưa tồn tại trong nhật ký.\n• Các phiên bản hiện có: ${available}\n• Dùng \`/update\` (bỏ trống) để xem bản mới nhất **v${LATEST_VERSION}**.`,
      color: '#f43f5e',
      footer: `SuMi Family • Phiên bản mới nhất v${LATEST_VERSION}`,
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
    title: `${em('su_level_up')} ${entry.title}`,
    description,
    color: entry.color,
    footer: `SuMi Family • Nhật Ký Cập Nhật v${entry.version} (Mới nhất: v${LATEST_VERSION})`,
  };
}
