/**
 * src/data/changelogs.js
 * Nhật ký cập nhật chính thức (/updates) — kiến trúc mở rộng cho v1.1 -> v1.2, v1.3...
 */

import { em, gradeEmoji } from '../config/emojiHelper.js';

export const LATEST_VERSION = '1.7';
export const DEFAULT_UPDATE_ACK_REWARD_LT = 800;
export const BIG_UPDATE_ACK_REWARD_LT = 3000;

/**
 * Bản cập nhật LỚN v1.7 — Quà Mở Bản:
 * +3.000 LT + 5 Xích Kim Tinh Thạch (TT) + 5 Thẻ Reset Tháp (vượt trần vẫn nhận đủ) + 300 Linh Quả + 1 Thiên Đạo Tuyệt Ấn Thạch
 * Chia 3 trang gọn, dễ đọc (Trang Trước / Trang Sau). TUYỆT ĐỐI KHÔNG đưa dữ liệu Meta lên /updates!
 */
export const V17_CHANGELOG = {
  version: '1.7',
  title: 'ĐẠI CẬP NHẬT v1.7 — TIẾN HÓA CHÂN THẦN (/TIENHOA), +260 MÓN MỚI & SHOP ĐẶC BIỆT',
  released_at: '2026-11-27',
  color: '#f43f5e',
  is_big_update: true,
  ack_reward_lt: 3000,
  ack_reward_bundle: {
    linh_thach: 3000,
    red_gold_crystals: 5,
    farm_essence: 300,
    items: [
      { item_id: 'tower_reset_card', item_category: 'consumable', quantity: 5, ignore_cap: true, label: 'Thẻ Reset Tháp' },
      { item_id: 'enchant_stone_absolute', item_category: 'consumable', quantity: 1, ignore_cap: true, label: 'Ấn Khắc Tuyệt Đối' },
    ],
  },
  ack_reward_summary: '+3.000 LT • +5 TT • +5 Thẻ Reset Tháp • +300 Linh Quả • +1 Ấn Khắc Tuyệt Đối',
  summary: 'Mở Tiến Hóa Chân Thần (/tienhoa) & 40 Ultimate, thêm +260 món mới + 9 Khung Viền, Shop Đặc Biệt Chủ Nhật (/shop_dacbiet), Gacha 0.65% & gói quà lớn v1.7!',
  pages: [
    {
      page: 1,
      subtitle: 'Trang 1/3 — Tiến Hóa Chân Thần (/tienhoa), +260 Món Mới & Quà Mở Bản 1.7',
      sections: [
        {
          heading: `${em('su_tier_toithuong')} 1. Tiến Hóa Chân Thần (/tienhoa) & 40 Skill Ultimate`,
          bullets: [
            '**Tiến Hóa 40 Pet Độc Nhất:** Đạt **`Lv.40 & 8★`** + **`1 Hồng Mông Tiến Hóa Tinh`** + Linh Thạch để tiến hóa thành **Tối Thượng Chân Thần**, đổi ảnh mới, tăng mạnh chỉ số & mở khóa **Skill Ultimate tái kích hoạt** trong `/battle` & `/linhmach` *(thất bại không mất Hồng Mông)*.',
            '**Chế Tạo Hồng Mông (Tab 2 `/tienhoa`):** Ghép từ **`3 Mảnh Tinh Hoa Hỗn Độn + 1 Đồ Thần Thoại thường`** *(Pet / Pháp Bảo / Linh Vực / Thần Thức / Thần Cảnh)* **`+ 2.500 LT`** *(xác nhận 2 bước an toàn)*.',
          ],
        },
        {
          heading: `${em('su_sparkle')} 2. Mở Rộng +260 Món Mới, 9 Khung Viền & Gói Quà v1.7`,
          bullets: [
            '**Kho Mới Siêu Lớn:** **`+60 Linh Thú`** *(30 Tối Thượng Độc Nhất & 30 Thần Thoại)*, **`+99 Pháp Bảo`**, **`+101 Lãnh Địa`** *(Linh Vực • Thần Thức • Thần Cảnh)* và **9 Khung Avatar mới** *(đã phân trang trong `/shop` & `/wiki`)*.',
            '**Quà Mở Bản v1.7 Khi Xác Nhận:** Tặng ngay **`+3.000 LT`** • **`+5 Xích Kim Tinh Thạch (TT)`** • **`+5 Thẻ Reset Tháp`** *(nhận đủ kể cả khi túi đang đầy 15 thẻ)* • **`+300 Linh Quả`** • **`+1 Ấn Khắc Tuyệt Đối`**!',
          ],
        },
      ],
    },
    {
      page: 2,
      subtitle: 'Trang 2/3 — Shop Đặc Biệt Chủ Nhật (/shop_dacbiet), Gacha 0.65% & Kinh Tế',
      sections: [
        {
          heading: `${em('su_linhthach')} 3. Shop Đặc Biệt Chủ Nhật (/shop_dacbiet)`,
          bullets: [
            '**Mở Cửa Chủ Nhật (`08:00–24:00` UTC+7):** Đổi **`750 LT = 1 Xích Kim Tinh Thạch (TT)`** *(tối thiểu `5 TT`, tối đa `200 TT/tuần`)*.',
            '**Vật Phẩm Hiếm:** Bán **Hồng Mông Tiến Hóa Tinh**, **Thẻ Chọn Thần Thoại** *(chọn 7 nhóm, ưu tiên món chưa sở hữu)*, **Mảnh Tinh Hoa Hỗn Độn**, **Bùa Tuyệt Ấn**, **Thẻ Auto Farm 24h**, **Bùa Bảo Vệ Farm/Luyện Đan** & 5 Khung Đặc Biệt.',
          ],
        },
        {
          heading: `${em('su_gacha_dice')} 4. Tăng Gacha 0.65%, Đổ Thạch & Thưởng Hằng Ngày`,
          bullets: [
            '**Gacha `/roll` `0.65%`:** Nâng tỉ lệ Thần Thoại+ lên **`0.65%`** *(tách cố định `0.0325%` Độc Nhất, Pity 350 ra `5%` Độc Nhất)*.',
            '**`/dothach` Dễ Trúng Hơn:** Giảm **`-10%`** tỉ lệ xịt đá ở cả 4 sạp & đổi tên **Hộp Thần Thoại Cực Phẩm**.',
            '**Tăng Thu Nhập Toàn Server:** `/daily` tăng lên **`55–80 LT`**; `/job` & `/nhiemvu` tăng **`+30%`** *(5/5 ngày: `170 LT`, Tuần: `450–700 LT`)*; **Tháp mốc T100/200/300/400/500** thưởng thêm **`+1 Mảnh Hỗn Độn`**!',
          ],
        },
      ],
    },
    {
      page: 3,
      subtitle: 'Trang 3/3 — Nâng Cấp /farm, /luyendan, /explorer & Tối Ưu Chiến Báo /battle',
      sections: [
        {
          heading: `${em('su_sprout')} 5. Tiện Ích /farm, /luyendan & /explorer`,
          bullets: [
            '**`/farm` & `/luyendan`:** Tưới nước / cho ăn nay rút ngắn **`-30 phút`** chín; bổ sung **Thẻ Tự Động Chăm Farm 24h**, **Bùa Bảo Vệ +2h** *(tự cứu trước khi héo/cháy)*, **Thuốc Tốc Độ (-25% giờ)** & **Bột Sản Lượng (+30% Linh Quả)**.',
            '**`/explorer` Đồng Bộ Bộ 1/2/3:** Chuyển nhanh bộ trang bị ngay trong `/explorer`; cập nhật bảng rơi đồ mới *(Bùa Tuyệt Ấn nâng cơ hội Đá Tuyệt Ấn lên `25%`, thêm tỉ lệ rơi `0.5%` Mảnh Hỗn Độn & gói nông trại)*.',
          ],
        },
        {
          heading: `${em('su_crossed_swords')} 6. Chuẩn Hóa Chiến Đấu & Chiến Báo Rõ Ràng Hơn`,
          bullets: [
            '**Log `/battle` & Web Dễ Đọc Hơn:** Tách riêng pha **`[Đầu lượt]`** *(Độc / Thiêu Đốt / Hồi Máu)* khỏi dòng tấn công để tránh nhìn nhầm, bổ sung thẻ **Skill Ultimate** trên Web Battle Log.',
            '**Sửa Triệt Để Cơ Chế HAX:** Cho phép **cộng dồn Độc / Thiêu Đốt / Debuff** từ nhiều nguồn khác nhau, sửa **Bất Tử** bảo vệ trọn hiệp, đồng bộ kháng DoT lên Thần Cảnh & miễn nhiễm khống chế không chặn nhầm giảm hồi máu.',
          ],
        },
      ],
    },
  ],
  sections: [
    {
      heading: `${em('su_tier_toithuong')} Tiến Hóa Chân Thần (/tienhoa) & +260 Món Mới`,
      bullets: [
        '**Tiến Hóa 40 Pet Độc Nhất (`/tienhoa`):** Đạt **`Lv.40 & 8★`** + **`1 Hồng Mông Tiến Hóa Tinh`** để lên **Tối Thượng Chân Thần** & mở **40 Skill Ultimate tái kích hoạt**.',
        '**+260 Món Mới & 9 Khung Viền:** **`+60 Pet`** *(30 Tối Thượng Độc Nhất & 30 Thần Thoại)*, **`+99 Pháp Bảo`**, **`+101 Lãnh Địa`**, 9 Khung mới.',
      ],
    },
    {
      heading: `${em('su_sparkle')} Shop Đặc Biệt, Kinh Tế & Quà Mở Bản v1.7`,
      bullets: [
        '**`/shop_dacbiet` (Chủ Nhật `08:00–24:00`):** Đổi `750 LT = 1 TT` *(max `200 TT/tuần`)* mua Hồng Mông, Thẻ Chọn Thần Thoại & vật phẩm hiếm.',
        '**Gacha `0.65%` & Kinh Tế:** `/dothach` `-10%` xịt, `/daily` `55–80 LT`, `/job` & `/nhiemvu` `+30%`, Tháp T100..500 `+1 Mảnh Hỗn Độn`, `/farm` tưới `-30p`.',
        '**Quà Xác Nhận v1.7:** **`+3.000 LT + 5 TT + 5 Thẻ Reset Tháp + 300 Linh Quả + 1 Ấn Khắc Tuyệt Đối`**!',
      ],
    },
  ],
};

/**
 * Bản cập nhật v1.6.1 (+1.000 LT):
 * - Ra mắt Lò Luyện Đan (/luyendan): tối đa 5 mẻ/ngày trên 2 Lò song song (Lò #2 mở tại Lv.45 hoặc 2.500 LT)
 * - Nâng cấp Lò Lv.1 -> Lv.5 (+% LT, giảm thời gian, tăng ân hạn 20p->60p, tăng tỉ lệ Thượng Phẩm/Đan Vân)
 * - 6 công thức gồm 4 bậc thường + 2 công thức Tinh Hoa dùng 20–40 Linh Quả từ /farm
 * - Quá ân hạn cháy đan thu 30 LT + nổ khóa lò 4h (Sửa nhanh 300 LT), DM nhắc khi chín & trước nổ 10p
 * Tuyệt đối KHÔNG nhắc đến thay đổi quyền Role Level, KHÔNG thông báo buff Viền/Ảnh Nền, và KHÔNG dùng emoji Unicode Windows.
 */
export const V161_CHANGELOG = {
  version: '1.6.1',
  title: 'CẬP NHẬT v1.6.1 — LÒ LUYỆN ĐAN (/LUYENDAN), FARM 8 Ô & LOADOUT /INV',
  released_at: '2026-11-25',
  color: '#ec4899',
  is_big_update: false,
  ack_reward_lt: 1500,
  summary: 'Ra mắt Lò Luyện Đan (/luyendan) UI ngang 2 Lò song song (6 mẻ/ngày), mở rộng /farm lên 8 ô (+1 Linh Điền, +1 Linh Các), giao diện /inv ngang 2×3 + 3 Loadout tự động lưu (Bộ 1/2/3), phân trang bằng nút bấm & quà xác nhận +1.500 LT!',
  sections: [
    {
      heading: `${em('su_el_hoa')} Hệ Thống Lò Luyện Đan (/luyendan — Tối Đa 6 Mẻ/Ngày)`,
      bullets: [
        '**2 Lò Song Song Ngang & 5 Cấp Lò (`Lv.1 → Lv.5`):** **Lò #1** mở sẵn; **Lò #2** tự mở miễn phí tại **`Lv.45`** *(hoặc mở sớm `2.500 LT`)*. Mỗi Lò có Dropdown chọn đan riêng; nâng cấp Lò giúp **`+6%..+25% LT`**, **giảm `5%..20%` thời gian nấu**, mở rộng **ân hạn `20p → 60p`** và tăng tỉ lệ **Thượng Phẩm (`×1.25`) / Đan Vân (`×1.50`)**!',
        '**6 Công Thức (Bậc 1–4 + 2 Công Thức Tinh Hoa `/farm`):** Vốn `14–84 LT` *(+40%)* nấu trong `48–120 phút` thu về `160–625 LT/mẻ` *(hoặc tới `675–750+ LT/mẻ` khi kết hợp `28–56 Linh Quả` từ `/farm`)* kèm EXP tu luyện; quá ân hạn cháy còn `30 LT` + nổ khóa `4 giờ` *(Sửa nhanh `300 LT`, DM nhắc chín & trước nổ 10p)*!',
      ],
    },
    {
      heading: `${em('su_sparkle')} /farm 8 Ô, /inv Ngang 3 Loadout & Quà +1.500 LT`,
      bullets: [
        '**Mở Rộng `/farm` Lên 8 Ô (`4 Linh Điền + 4 Linh Các`):** Thêm 1 ô Linh Điền & 1 ô Linh Các mới mở khóa tại `/exchange` (`300 Linh Quả/ô`) để tăng nguồn Linh Quả; giá hạt giống & trứng tăng nhẹ `+10%` (`88–825 LT`).',
        '**`/inv` Ngang 2×3 + 3 Loadout Tự Lưu (`Bộ 1 / 2 / 3`) & Quà `+1.500 LT`:** Bấm nút **`Bộ 1 / Bộ 2 / Bộ 3`** để chuyển nhanh cả **Linh Thú + 3 Pháp Bảo + Linh Vực/Thần Thức/Thần Cảnh** *(mọi `/equip`, `/pet`, `/linhvuc` tự động lưu)*. Phân trang `/linhvuc`, `/phapbao`, `/roles` bằng nút **Trang Trước / Trang Sau** & tặng ngay **`+1.500 Linh Thạch`** khi xác nhận!',
      ],
    },
  ],
};

/**
 * Bản cập nhật v1.6 (+1.000 LT):
 * - Cải tiến /nhiemvu giao diện OwO (3 tab Ngày / Tuần / Tháp 500 tầng + Xuất Bản Ảnh WebP)
 * - 3 Lọ Luck Potion trong /shop (tính theo lượt cho /roll & /dothach)
 * - Sửa triệt để lỗi mua nhầm Viền & Ảnh Nền khi preview nhiều lần trong /shop
 * - Ra mắt Phường Đổ Thạch (/dothach) với 20 Nguyên Thạch & 105 manh mối mơ hồ
 * - Ra mắt Gieo Quẻ Đầu Ngày (/gieoque) 6 bậc Khí Vận + Cầu An Giải Hạn
 * Tuyệt đối KHÔNG nhắc đến thay đổi quyền Role Level, KHÔNG thông báo buff Viền/Ảnh Nền, và KHÔNG dùng emoji Unicode Windows.
 */
export const V16_CHANGELOG = {
  version: '1.6',
  title: 'CẬP NHẬT v1.6 — ĐỔ THẠCH, GIEO QUẺ, LUCK POTION & NHIỆM VỤ OWO',
  released_at: '2026-11-24',
  color: '#ec4899',
  is_big_update: false,
  ack_reward_lt: 1000,
  summary: 'Ra mắt Phường Đổ Thạch (/dothach, 20 Nguyên Thạch), Gieo Quẻ Đầu Ngày (/gieoque, 6 bậc Khí Vận), 3 Lọ Luck Potion trong /shop, giao diện /nhiemvu mới tinh gọn (gộp Ngày + Tuần + Tháp 500 tầng), sửa lỗi mua nhầm Viền/Nền khi preview nhiều lần & tặng +1.000 LT!',
  sections: [
    {
      heading: `${em('su_sparkle')} Phường Đổ Thạch (/dothach) & 3 Lọ Luck Potion (/shop)`,
      bullets: [
        '**Phường Đổ Thạch (`/dothach`):** Tách biệt hoàn toàn với `/roll` *(không Pity 350)*. Chọn sạp **4 phân khúc** *(Phàm / Linh / Tiên / Thần Thoại • 20 loài Nguyên Thạch)* kèm **manh mối mơ hồ** để giám định & cắt đá *(Thiết Thạch)*. Săn **Tối Thượng Cực Phẩm** để chọn **Thần Thoại không Độc Nhất** thuộc `7 nhóm` *(Linh Thú, 3 loại Pháp Bảo, Linh Vực, Thần Thức, Thần Cảnh)*!',
        '**3 Lọ Luck Potion (`/shop` • Quầy Tiêu Hao):** Mở bán **Tiểu Vận Linh Lộ** (`+20% Luck` • 40 lượt • `1.200 LT`), **Thiên Cơ Thụy Lộ** (`+40% Luck` • 60 lượt • `3.200 LT`) và **Hồng Mông Khí Vận Dịch** (`+60% Luck` • 80 lượt • `6.800 LT`). Dùng `/equip` để uống, áp dụng cho cả `/roll` & `/dothach` *(cộng dồn với `/gieoque`)*!',
        '**Sửa Triệt Để Lỗi Mua Nhầm Viền & Ảnh Nền `/shop`:** Mỗi tin nhắn xem trước trong `/shop` nay lưu mã riêng theo `message_id` — bấm **Mua Ngay** ở tin nào sẽ mua chính xác món của tin đó!',
      ],
    },
    {
      heading: `${em('su_quest_scroll')} Gieo Quẻ Đầu Ngày (/gieoque) & Cải Tiến /nhiemvu`,
      bullets: [
        '**Gieo Quẻ Ứng Nghiệm (`/gieoque`):** Mỗi ngày `1 lần` *(UTC+7)* lắc ống xăm nhận **6 bậc Khí Vận** *(Đại Hung → Đại Cát)* kèm thẻ thơ riêng, tăng/giảm nhẹ `% EXP`, `% LT` & `% Luck`. Gặp quẻ **Hung / Đại Hung** có thể bấm **Cầu An Giải Hạn (`250 LT`)** để gieo lại!',
        '**Bảng `/nhiemvu` Mới Tinh Gọn (Embed Discord):** Gộp gọn **Nhiệm Vụ Hàng Ngày & Hợp Đồng Tuần**, hiển thị rõ `▸ Thưởng` & `▸ Tiến độ` kèm bảng **Tháp 500 Tầng** & quà xác nhận **`+1.000 Linh Thạch`**!',
      ],
    },
  ],
};

/**
 * Bản cập nhật v1.5.2 (+500 LT):
 * - Nâng cấp /farm tách Linh Điền & Linh Các + DM nhắc tưới / sắp héo 1h, 30p, 15p
 * - Chuẩn hóa 100% thuật ngữ chiến đấu (1 thuật ngữ = 1 hiệu ứng duy nhất)
 * - Mở rộng /wiki lên 10 chuyên mục (thêm domains 60 món & glossary 4 trang)
 * - Cân bằng EXP lên cấp +30% (78 * Level^1.45, trần 500.000 EXP)
 * Tuyệt đối KHÔNG nhắc đến thay đổi quyền Role Level, KHÔNG thông báo buff Viền/Ảnh Nền, và KHÔNG dùng emoji Unicode Windows.
 */
export const V152_CHANGELOG = {
  version: '1.5.2',
  title: 'CẬP NHẬT v1.5.2 — CHUẨN HÓA THUẬT NGỮ, /WIKI LINH VỰC & TỪ ĐIỂN, /FARM DM & CÂN BẰNG EXP',
  released_at: '2026-11-24',
  color: '#ec4899',
  is_big_update: false,
  ack_reward_lt: 500,
  summary: 'Tách riêng Linh Điền & Linh Các kèm DM nhắc tưới/sắp héo; chuẩn hóa đồng bộ toàn bộ thuật ngữ chiến đấu; mở rộng /wiki lên 10 chuyên mục (Linh Vực • Thần Thức • Thần Cảnh & Từ Điển Thuật Ngữ 4 trang); cân bằng +30% EXP lên cấp & tặng +500 LT!',
  sections: [
    {
      heading: `${em('su_wiki_scroll')} Chuẩn Hóa Thuật Ngữ & Mở Rộng /wiki (10 Chuyên Mục)`,
      bullets: [
        '**Đồng Bộ 100% Thuật Ngữ (`1 thuật ngữ = 1 hiệu ứng duy nhất`):** Hợp nhất toàn bộ mô tả trong Linh Vực, Thần Thức, Thần Cảnh, Pháp Bảo, Linh Thú và chiến báo (`Cường Hóa Buff Vực`, `Cường Hóa Debuff Vực`, `Kháng Trừ Linh Mạch Khắc Vực`, `Xuyên DEF` vs `Giảm DEF`, `Xuyên Kháng Vực`, `Bào Mòn Khiên`, `Giảm Khiên Tạo Mới`, `Cắt Trần HP`...).',
        '**`/wiki` Thêm 2 Chuyên Mục Mới (`domains` & `glossary`):** Bổ sung kho tra cứu **Linh Vực • Thần Thức • Thần Cảnh** *(đủ 60 món công khai kèm ảnh & chủ Độc Nhất)* và **Từ Điển Thuật Ngữ Chiến Đấu** *(4 trang giải thích chi tiết từng cơ chế)*.',
      ],
    },
    {
      heading: `${em('su_farm_seed')} Nâng Cấp /farm (Tách Ô & DM Nhắc Tự Động) + Cân Bằng EXP`,
      bullets: [
        '**`/farm` Tách Rành Mạch Linh Điền & Linh Các:** Phân tách 2 khu vực riêng biệt trên giao diện để dễ theo dõi khi mua thêm ô, kèm bot **Nhiễm Nhiễm** tự động **DM nhắc đúng giờ tưới** *(1 lần)* và **cảnh báo sắp héo trước 1 giờ, 30 phút, 15 phút**.',
        '**Nút Xem Nhật Ký Web Cố Định (`/battle` & `/linhmach`):** Luôn giữ nguyên phần kết quả & gắn nút **Xem Chi Tiết Trên Web** cố định ngay dưới chiến báo để bấm chuyển thẳng lên web dù trận kéo dài.',
        '**Cân Bằng Tiến Độ Tu Luyện (`+30%` EXP Lên Cấp) & Quà `+500 LT`:** Điều chỉnh công thức EXP lên cấp từ `60 × Level^1.45` sang **`78 × Level^1.45`** *(giữ nguyên trần `500.000 EXP` tại Lv.100)*. Bấm nút xác nhận bên dưới để nhận ngay **`+500 Linh Thạch`**!',
      ],
    },
  ],
};

/**
 * Hotfix v1.5.1 (+1.000 LT đền bù sự cố Role Gacha & phân trang Kho Đồ).
 * Tuyệt đối KHÔNG nhắc đến thay đổi quyền Role Level & KHÔNG dùng emoji Unicode Windows.
 */
export const V151_HOTFIX_CHANGELOG = {
  version: '1.5.1',
  title: 'HOTFIX v1.5.1 — SỬA LỖI LƯU ROLE GACHA, PHÂN TRANG KHO ĐỒ & ĐỀN BÙ +1.000 LT',
  released_at: '2026-11-24',
  color: '#ec4899',
  is_big_update: false,
  ack_reward_lt: 1000,
  summary: 'Khắc phục triệt để lỗi lưu Role Quyền Năng Linh Phẩm / Tiên Phẩm khi /roll, mở rộng phân trang Trang 1/2/3 cho /roles, /phapbao, /linhvuc, /inv, cập nhật /wiki Roles & Đền bù +1.000 LT toàn server!',
  sections: [
    {
      heading: `${em('su_medal_role')} Sửa Nóng Lỗi Lưu Role Gacha & Bù Role Tiên Phẩm`,
      bullets: [
        '**Khắc Phục Lỗi Mất Role Khi `/roll loai:role`:** Sửa lỗi giới hạn độ dài khiến 13 Role **Linh Phẩm & Tiên Phẩm** *(như Bát Hoang Chiến Thần, Lôi Vũ Hộ Pháp, Huyễn Ảnh Linh Tôn...)* bị rớt khi lưu vào túi. Đã cấp bù đầy đủ Role & hoàn Linh Thạch cho các tu sĩ bị ảnh hưởng.',
        '**Đền Bù Toàn Server `+1.000 LT`:** Xác nhận bản cập nhật Hotfix v1.5.1 nhận ngay **`+1.000 Linh Thạch`**!',
      ],
    },
    {
      heading: `${em('su_wiki_scroll')} Phân Trang Kho Đồ Trang 1/2/3+ & Cập Nhật /wiki`,
      bullets: [
        '**Phân Trang Đầy Đủ (`/roles`, `/phapbao`, `/linhvuc`, `/inv`):** Bổ sung tham số `trang` và menu chuyển **Trang 1 / Trang 2 / Trang 3+** ngay trên bảng để xem trọn vẹn kho đồ dài mà không bị cắt dòng.',
        '**Minh Bạch `/wiki` & Cơ Chế Bỏ Qua Khiên:** Thêm mục `Roles Quyền Năng & Discord` trong `/wiki` và ghi chú rõ các hiệu ứng **Phản Đòn / Đốt HP / Nổ Khiên (thẳng máu, bỏ qua khiên)**.',
      ],
    },
  ],
};

/**
 * Bản nháp Chính Thức cho Ver 1.5 Big Update (+2.000 LT quà /updates).
 * Tuyệt đối KHÔNG nhắc đến thay đổi quyền Role Level & KHÔNG dùng emoji Unicode Windows.
 */
export const V15_DRAFT_CHANGELOG = {
  version: '1.5',
  title: 'BIG UPDATE v1.5 — CÂN BẰNG PVE, SET BUFF, PITY 350, 20 VIỀN AVATAR & TOP NGÀY',
  released_at: '2026-11-24',
  color: '#ec4899',
  is_big_update: true,
  ack_reward_lt: 2000,
  summary: 'Tăng +550% chỉ số Pet Lv.100 & Khắc Ấn D→S (+0/+8/+18/+32/+50%), cân bằng /explorer (3.5k→112k, +5% LT & Thuận Hệ Địa Hình), /linhmach (8k→135k & Dư Chấn AoE 35%), Tháp 500 tầng (+15% LT mỗi tầng & truy lĩnh), Buff SET, Pity 350, 20 Viền Avatar khít 100%, Top Chat/Voice ngày & +2.000 LT xác nhận!',
  sections: [
    {
      heading: `${em('su_sparkle')} Tính Năng Mới & Nâng Chỉ Số Toàn Diện`,
      bullets: [
        '**Tăng Trần Sức Mạnh & Khắc Ấn Mới:** Linh Thú `Lv.1 → Lv.100` tăng lên **`+550%`** *(kèm `10★` đạt **`7.85×`** chỉ số gốc)*; hệ số Khắc Ấn `/enchant` tăng thành **`D +0% • C +8% • B +18% • A +32% • S +50%`** *(đã tự động cập nhật lại chỉ số Pet toàn server)*.',
        '**Hệ Thống Buff SET (2 Tầng Không Cộng Dồn):** Full Hệ Thường `4/4` (**+8%**) • `5/5` (**+12%**); Set Thần Thoại cùng hệ `2/3/4/5` (**+6% / +12% / +18% / +25%** toàn chỉ số, mốc `5/5` thêm **+10% Xuyên Giáp** & **+1 Linh Mạch đầu trận**).',
        '**Pity Thần Thoại (`350` Lượt) & Top Chat/Voice Ngày (`00:00`):** Pity 350 tách riêng 3 bể `Linh Thú`, `Pháp Bảo`, `Linh Vực` *(98% Thường / 2% Độc Nhất)*. `/top loai:chat|voice` tự trao **500 / 400 / 300 LT** mỗi ngày tại `#bot-cmds`.',
      ],
    },
    {
      heading: `${em('explorer_world_map_v14')} Cân Bằng /explorer, /linhmach & Tháp 500 Tầng`,
      bullets: [
        '**`/explorer` Dễ Thở Hơn (+5% LT & Thuận Hệ Địa Hình):** Cân 12 Map về **`3.5k → 112k`**; tăng `+5%` LT cơ bản (**`210–315 LT/giờ × hệ số`**). Cơ chế **Thuận Hệ Địa Hình**: khi **Pet hoặc Linh Vực** mang đi khớp **Hệ của Map** *(xem trong bảng chọn Map hoặc `/wiki`)* sẽ được cộng ngay **`+6%` Tỉ Lệ Sống Sót** và **`+10%` Linh Thạch**!',
        '**`/linhmach` (`8k → 135k`) & Tháp (`1k → 125k`, +15% LT):** Boss S+ cân bằng về `135.000` *(một người `~80k` + 2 đồng đội gánh đủ thắng)*, riêng Boss `A / S / S+` tung **Dư Chấn AoE `35%`** quét cả hậu phương. Tháp 500 tầng tăng mượt & **tăng `+15%` LT mỗi tầng** *(đã cấp bù truy lĩnh cho người đã leo)*.',
      ],
    },
    {
      heading: `${em('frame_unlock_token', em('su_sparkle'))} 20 Viền Avatar, Shop/Inv Gọn Đẹp & Quà +2.000 LT`,
      bullets: [
        '**20 Viền Avatar Khít 100% & Đổi Ngay Trong `/shop`:** Mua Viền & Background trong `/shop`; ảnh nền/viền được ẩn khỏi `/inv` cho gọn, hiển thị `[Đã sở hữu]` / `[Đang trang bị]` trong `/shop` & bấm **Mua Ngay** trên đồ đã có sẽ **tự động Equip (`0 LT`)**.',
        '**Tiện Ích & Quà Đền Bù `+2.000 LT`:** `/linhthu` `muc_dich` nâng thẳng Lv/Sao, `/dismantle` & `/linhvuc` `all_dup/common/rare/epic`, HAX & Web Logs 48h `/linhmach` chuẩn hóa, đồng bộ **100% Emoji SuMi** & nâng quà `/updates` v1.5 lên **`+2.000 LT`** *(đã bù `+500 LT` cho ai đã nhận `1.500 LT`)*.',
      ],
    },
  ],
};

export const CHANGELOGS = [
  V17_CHANGELOG,
  V161_CHANGELOG,
  V16_CHANGELOG,
  V152_CHANGELOG,
  V151_HOTFIX_CHANGELOG,
  V15_DRAFT_CHANGELOG,
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
        heading: `${em('su_gacha_dice')} Lệnh Mới /autosell & Tối Ưu /battle + Web Logs`,
        bullets: [
          '**`/autosell [pham_pham] [linh_pham] [tien_pham] [giu_mon_moi]`:** Tự động bán Pháp Bảo, Linh Thú, Linh Vực & Role trùng phẩm chất ngay khi `/roll` *(tự kế thừa Khắc Ấn cao hơn trước khi bán; không bao giờ bán Thần Thoại)*.',
          '**`/battle` Nhanh Hơn & Web Logs Theo Từng Hiệp (48h):** Giảm nhẹ `-10%` chất lượng để tăng tốc render; Discord hiển thị mốc **Hiệp `1 / 5 / 10 / 15 / 20` & Kết**; bấm **Xem Nhật Ký Trận Đấu** để render từng hiệp, theo dõi tụt HP & tua lại lượt trên web *(lưu 48 giờ)*.',
        ],
      },
      {
        heading: `${em('su_tower_boss')} Tháp 500 Tầng, Daily Quest Xoay Vòng & Chat EXP +15%`,
        bullets: [
          '**Tháp Thí Luyện 500 Tầng:** Buff nền **+10%**, random chiến lực **±12%/trận**, tăng giới hạn mua Thẻ Reset Tháp lên **5 lần/ngày** *(tối đa 15 thẻ)*; NPC bật **Linh Vực từ F70** *(+Thần Thức F150, +Thần Cảnh F250)*, tỉ lệ Thần Thoại tăng dần tới **100% từ F100+** & phân bậc Khắc Ấn `D → S`.',
          '**Nhiệm Vụ Ngày Mới (+10% LT) & Chat EXP +15%:** 2 nhiệm vụ cố định + 3 nhiệm vụ xoay vòng từ 10 hoạt động *(mốc 5/5: `+130 LT` + quà)*; Chat EXP gốc tăng lên **23–35 EXP/tin**. Xác nhận bản cập nhật mới nhận ngay **+800 LT**!',
        ],
      },
      {
        heading: `${em('su_wiki_scroll')} Gọn Hơn Cho /wiki, /updates & Gỡ Footer Thừa`,
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
        heading: `${em('su_level_up')} Lệnh /exp, Gradient Role & /equip 1 Chạm`,
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
        heading: `${em('dao_ap_crest')} Đạo Áp, Shop Ngày, Linh Mạch & Khám Phá`,
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

export function getUpdateAckBundle(version = LATEST_VERSION) {
  const entry = CHANGELOG_BY_VERSION[String(version || LATEST_VERSION).trim().toLowerCase().replace(/^v/, '')];
  const lt = getUpdateAckReward(version);
  if (entry?.ack_reward_bundle) {
    return {
      linh_thach: Number(entry.ack_reward_bundle.linh_thach ?? lt),
      red_gold_crystals: Number(entry.ack_reward_bundle.red_gold_crystals || 0),
      farm_essence: Number(entry.ack_reward_bundle.farm_essence || 0),
      items: Array.isArray(entry.ack_reward_bundle.items) ? entry.ack_reward_bundle.items : [],
      summary: entry.ack_reward_summary || `+${lt.toLocaleString('vi-VN')} LT`,
    };
  }
  return {
    linh_thach: lt,
    red_gold_crystals: 0,
    farm_essence: 0,
    items: [],
    summary: `+${lt.toLocaleString('vi-VN')} LT`,
  };
}

export function getChangelogPayload(rawVersion = '', rawPage = 1) {
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
      page: 1,
      total_pages: 1,
      prev_page: 1,
      next_page: 1,
      has_pagination: 'false',
      title: `${em('su_wiki_scroll')} Không tìm thấy phiên bản v${version}`,
      description: `Phiên bản \`${version}\` chưa tồn tại trong nhật ký.\n• Các phiên bản hiện có: ${available}\n• Dùng \`/updates\` để xem bản mới nhất **v${LATEST_VERSION}**.`,
      color: '#f43f5e',
      footer: '',
    };
  }

  const hasPages = Array.isArray(entry.pages) && entry.pages.length > 1;
  const totalPages = hasPages ? entry.pages.length : 1;
  const parsedPage = Number.parseInt(String(rawPage || 1), 10);
  const currentPage = hasPages
    ? Math.min(Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1), totalPages)
    : 1;
  const activePageObj = hasPages ? entry.pages[currentPage - 1] : null;
  const activeSections = activePageObj ? activePageObj.sections : entry.sections;

  const descriptionLines = [
    activePageObj
      ? `*Ngày phát hành: \`${entry.released_at}\` • ${activePageObj.subtitle}*`
      : `*Ngày phát hành: \`${entry.released_at}\` • ${entry.summary}*`,
    '',
    ...activeSections.flatMap((sec) => [
      `**${sec.heading}**`,
      ...sec.bullets.map((b) => `• ${b}`),
      '',
    ]),
  ];

  let description = descriptionLines.join('\n').trim();
  if (description.length > 3950) {
    description = description.slice(0, 3940) + '\n…';
  }

  const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
  const nextPage = currentPage < totalPages ? currentPage + 1 : 1;
  const bundle = getUpdateAckBundle(entry.version);

  return {
    success: true,
    version: entry.version,
    latest_version: LATEST_VERSION,
    available_versions: CHANGELOGS.map((c) => c.version),
    page: currentPage,
    total_pages: totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    has_pagination: hasPages ? 'true' : 'false',
    ack_reward_lt: bundle.linh_thach,
    ack_reward_bundle: bundle,
    ack_reward_summary: bundle.summary,
    is_big_update: Boolean(entry.is_big_update),
    title: hasPages
      ? `${em('su_level_up')} ${entry.title} (Trang ${currentPage}/${totalPages})`
      : `${em('su_level_up')} ${entry.title}`,
    description,
    color: entry.color,
    footer: '',
  };
}
