/**
 * src/data/changelogs.js
 * Nhật ký cập nhật chính thức (/updates) — kiến trúc mở rộng cho v1.1 -> v1.2, v1.3...
 */

import { em, gradeEmoji } from '../config/emojiHelper.js';

export const LATEST_VERSION = '1.3';

export const CHANGELOGS = [
  {
    version: '1.3',
    title: 'ĐẠI CẢI TỔ LÃNH ĐỊA, NÔNG TRẠI & BÁCH KHOA V1.3',
    released_at: '2026-11-22',
    color: '#ec4899',
    summary: 'Khai mở hệ thống Linh Vực • Thần Thức • Thần Cảnh, bổ sung 50 Linh Thú & 100 Pháp Bảo cân bằng (<= 15%), Nông Trại /farm & /exchange, 4 thức chơi Linh Thạch, chuẩn hóa Emoji UID và đồng bộ toàn bộ /wiki.',
    sections: [
      {
        heading: `${em('su_realm_star')} Linh Vực • Thần Thức • Thần Cảnh (/linhvuc • /roll loai:domain)`,
        bullets: [
          '**30 Linh Vực, 15 Thần Thức & 15 Thần Cảnh** (kèm 5 Linh Vực Thần Thoại Độc Nhất Toàn Server) chính thức gia nhập đấu trường từ **Hiệp 2**.',
          '**Cơ chế Chiến Thuật Tinh Tế:** Linh Vực không cộng thẳng chỉ số cơ bản mà cường hóa **Buff xuyên giáp/HAX** phe mình và **Debuff** đối phương theo vòng tương khắc **5 Hệ (`Kiếm Vực → Huyễn Vực → Trận Vực → Minh Vực → Thánh Vực → Kiếm Vực`)**, tiêu hao `1` hoặc `2 Linh Mạch`/hiệp khi giằng co.',
          '**Thần Thức** gia tăng giới hạn Linh Mạch & hiệu lực Buff; **Thần Cảnh** cường hóa Debuff & bổ sung hiệu ứng bất lợi mới.',
        ],
      },
      {
        heading: `${em('su_crossed_swords')} Mở Rộng 50 Linh Thú & 100 Pháp Bảo Mới (Cân Bằng <= 15%)`,
        bullets: [
          'Tổng cộng **90 Linh Thú tiêu chuẩn** *(gồm 10 Thần Thoại Độc Nhất + 40 Thần Thoại Tự Do)* & **165 Pháp Bảo Loadout** *(57 Vũ Khí / 54 Bảo Ngọc / 54 Chiến Hồn, gồm 39 Độc Nhất + 56 Thần Thoại Tự Do)* với nội tại HAX đa dạng và cân bằng biên độ **tối đa 15%** giữa Độc Nhất và Thường.',
          'Chuẩn hóa **100% Emoji UID** cho toàn bộ Linh Thú, Pháp Bảo, Linh Vực, Vật Phẩm (nhận trực tiếp UID/Emoji trên `/info`, `/equip`, `/dismantle`, `/enchant`, `/linhvuc`) & khôi phục biểu tượng **Lệnh Bài Ảnh Nền** (`frame_unlock_token`) trên `/inv`.',
        ],
      },
      {
        heading: `${em('su_sprout')} Nông Trại (/farm • /exchange), Giải Trí & Kinh Tế Tu Tiên`,
        bullets: [
          '**Nông Trại Thời Gian Thực (`/farm` & `/exchange`):** Canh tác **Linh Điền** & ấp trứng **Linh Các** (`4 → 6 ô`, chu kỳ `6h/12h/24h`), chăm sóc đúng khung giờ để thu **Linh Thạch** & **Linh Quả Tiên Giới** (`farm_essence`) quy đổi Đá Khắc Ấn, Tinh Thạch, Vé Gacha, Thẻ Reset Tháp.',
          '**4 Thức Chơi Linh Thạch (`10–10.000 LT`):** Ra mắt `/coinflip` *(1:2)*, `/blackjack` *(1:2)*, `/slots` *(4 ô, tối đa 1:5)* và `/crash` *(Ngự Kiếm)* kèm hiệu ứng hoạt ảnh trực quan.',
          '**Nâng Cấp Nhiệm Vụ & Lao Động:** Giới hạn `/job` tăng lên **8 ca/ngày**; `/nhiemvu` mở rộng thành **5 Nhiệm Vụ Ngày** *(+15/+20/+25/+20/+20 LT)* + thưởng hoàn tất **5/5** hậu hĩnh hơn; đồng bộ dữ liệu `/wiki` *(Voice EXP 85–135/5p chấm công 12p)* và tri thức Bot Nhiễm Nhiễm theo văn phong trang trọng.',
        ],
      },
    ],
  },
  {
    version: '1.2',
    title: 'ĐẠI CẢI TỔ PHÁP ẤN & KINH TẾ TU TIÊN v1.2',
    released_at: '2026-11-22',
    color: '#a855f7',
    summary: 'Cường hóa Phẩm Chất D→S, Tháp 200 Tầng cân bằng, Nghề Tu Tiên (/job), Túi Đồ biểu tượng kèm số lượng, Chốt Gacha Thần Thoại 0.5% & Tăng tốc /battle.',
    sections: [
      {
        heading: `${gradeEmoji('S')} Khắc Ấn Phẩm Chất D → C → B → A → S (/enchant)`,
        bullets: [
          'Mỗi Linh Thú & Pháp Bảo mới nhận đều ngẫu nhiên phẩm chất **D (`40%`, +0%) / C (`32%`, +6%) / B (`20%`, +14%) / A (`8%`, +24%)** — **0%** rơi thẳng **S**.',
          `Dùng **Đá Khắc Ấn** ${em('enchant_stone')} (\`150 LT\` trong \`/shop\`, mua tối đa \`5/ngày\` + rơi ở **Boss Tháp mỗi 5 tầng**) qua \`/enchant\` để đột phá tới **Hạng S (+40% chỉ số gốc)**.`,
          'Cơ chế **Pity (+5%/lần xịt)** đảm bảo càng ép càng dễ lên, rớt không tụt hạng!',
        ],
      },
      {
        heading: `${em('su_tower_boss', '🗼')} Tháp Thí Luyện 200 Tầng & Hợp Đồng Tuần`,
        bullets: [
          '**Tháp nâng lên 200 Tầng (`4 × 50`):** 1–50 Phàm → 51–100 Linh → 101–150 Tiên → 151–200 Thần Thoại. Toàn bộ NPC xoay vòng đủ **40 Linh Thú**, đeo **1–3 Pháp Bảo** & **kích hoạt 100% HAX**!',
          '**Boss Tháp (mỗi 5 tầng):** Thưởng **`+1 Tinh Thạch` + `1 Đá Khắc Ấn`**; mốc 50/100/150/200 thưởng lớn tới `+5.000 LT + 25 Đá`.',
          '**6 Nghề Tu Tiên (`/job`)** (hồi `1h/ca`, tối đa `6 ca/ngày`): Quét sân, Rửa bát, Tưới cây, Giao trà sữa, Câu cá, Tuần tra nhận Linh Thạch & EXP; kèm **3 Hợp Đồng Tuần** trong `/nhiemvu` (reset Thứ Hai `00:00`).',
        ],
      },
      {
        heading: `${em('su_wiki_scroll')} Lệnh Mới, Túi Đồ /inv & Cân Bằng Kinh Tế`,
        bullets: [
          '**Túi Đồ `/inv` Biểu Tượng & Cộng Dồn Khi `/roll` Trùng:** Hiển thị `<Emoji>⁰⁰¹` thoáng mắt (đồ đang trang bị xếp đầu trước dấu **`|`**), quay trùng tự cộng số lượng (`⁰⁰¹ → ⁰⁰²`) kèm **Kế Thừa Tư Chất Cao Nhất (`max(D..S)`)**; thêm Dropdown chuyển tab và lệnh `/roles` riêng. `/info`, `/equip`, `/dismantle`, `/enchant` nhận cả Emoji!',
          '**`/updates` + Xác Nhận Lần Đầu:** Gõ `/updates` luôn mở bản mới nhất & có Dropdown chọn lại `v1.1` / `v1.2`. Lần đầu vào game sau cập nhật chỉ cần bấm Xác Nhận 1 lần.',
          '**Cân Bằng Kinh Tế:** Chốt tỷ lệ **Thần Thoại `0.5%`** đều cả **3 Gacha (Pháp Bảo / Linh Thú / Role)**. Siết giá `/dismantle` chống farm Gacha, mở rã hàng loạt (`all_common/rare/epic`, `all_dup`) cho cả **Pet, Pháp Bảo & Role**.',
          '**Tăng Tốc `/battle`:** Khắc phục triệt để lỗi treo `ĐANG TRIỆU HỒI...`, trả trận dưới `0.5s`, cooldown `5s/trận` mượt mà.',
        ],
      },
    ],
  },
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
          '`/updates` — Xem tóm tắt tính năng từng bản cập nhật qua Dropdown.',
        ],
      },
      {
        heading: `${em('su_thunder_hax')} Cân Bằng & Sửa Lỗi Quan Trọng`,
        bullets: [
          '**Cân bằng 20 Pet cũ & sửa 5 lỗi HAX Engine:** Kích hoạt HAX cho toàn bộ 65 Pháp Bảo; sửa Bạch Kim Hổ Tử (`35%` xuyên giáp), Kim Sí Điêu Hoàng (mù đúng 2 hiệp), Tru Tiên (xuyên khiên 3 lượt), Luân Hồi Bất Diệt Chiến Hồn.',
          '**Sửa lỗi cấp Role Discord (Bug #7):** Đeo/quay Role nhận ngay Role thật trên Discord & cấp bù toàn bộ thành viên đang đeo.',
          '**Sửa lỗi treo Voice không lên EXP & tăng +20% Voice EXP (`85–135 / 5p`):** Chấm công treo Voice định kỳ mỗi 12 phút không cần thoát phòng.',
          '**Chống Lạm Dụng Gacha → Dismantle:** Món mua Shop hoàn 20–25% giá thực trả; món từ Gacha dùng bảng giá phân rã chuẩn chống farm vô hạn Linh Thạch.',
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
      description: `Phiên bản \`${version}\` chưa tồn tại trong nhật ký.\n• Các phiên bản hiện có: ${available}\n• Dùng \`/updates\` để xem bản mới nhất **v${LATEST_VERSION}**.`,
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
