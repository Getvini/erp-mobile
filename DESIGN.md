---
version: 3.0.0
name: Getvini ERP Mobile
description: Thiết kế ứng dụng di động Getvini ERP. Kế thừa màu, mapping trạng thái, quy tắc tiền tệ và hành vi form từ design-tokens.shared.md; file này chỉ khai báo phần riêng của mobile (typography, kích thước, điều hướng, component).

colors:
  primary: "#F38820"
  primary-hover: "#DB7414"
  primary-pressed: "#C96A10"
  primary-action: "#F38820"
  primary-action-hover: "#DB7414"
  primary-light: "#fff8e0"
  primary-border: "#e6d5a8"
  primary-soft: "#fff0c2"
  primary-soft-hover: "#ffe295"
  primary-soft-pressed: "#ffd06a"
  primary-on-soft: "#9A3412"
  primary-soft-border: "#C2540A"
  primary-soft-border-pressed: "#A84608"
  on-primary: "#ffffff"
  surface: "#ffffff"
  background: "#fafafa"
  surface-subtle: "#ededed"
  text-primary: "#1f1f1f"
  text-secondary: "#4a4a4a"
  text-muted: "#6a6a6a"
  border: "#e5e5e5"
  border-control: "#8a8a8a"
  disabled-bg: "#e5e5e5"
  disabled-text: "#a8a8a8"
  success: "#10B981"
  success-strong: "#047857"
  success-light: "#ECFDF5"
  warning: "#F59E0B"
  warning-strong: "#B45309"
  warning-light: "#FFFBEB"
  info: "#3B82F6"
  info-strong: "#1D4ED8"
  info-light: "#EFF6FF"
  danger: "#EF4444"
  danger-strong: "#B91C1C"
  danger-light: "#FEF2F2"
  neutral-strong: "#4a4a4a"
  neutral-light: "#ededed"
  overlay: "rgba(31, 31, 31, 0.45)"

typography:
  title-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.30
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.40
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.50
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.40
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
  input-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.40
  button:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.30
  number-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.20
    fontFeature: "tnum"
  number-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.30
    fontFeature: "tnum"

rounded:
  control: 10px # Nút bấm và ô input
  card: 18px    # Thẻ danh sách, card
  overlay: 18px # Bottom sheet, modal
  full: 9999px  # Badge, Chip, Avatar
  sm: 6px
  md: 10px
  lg: 14px
  xl: 18px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px

components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.border}"
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.number-lg}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.border}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    minHeight: 48px
    padding: "0 {spacing.xl}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-text}"
  button-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-on-soft}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    minHeight: 48px
    padding: "0 {spacing.xl}"
    border: "1px solid {colors.primary-soft-border}"
  button-soft-pressed:
    backgroundColor: "{colors.primary-soft-pressed}"
    textColor: "{colors.primary-on-soft}"
    border: "1px solid {colors.primary-soft-border-pressed}"
  button-soft-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-text}"
    border: "1px solid {colors.disabled-bg}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    minHeight: 48px
    border: "1px solid {colors.border-control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary-action}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    minHeight: 48px
    padding: "0 {spacing.lg}"
  button-ghost-pressed:
    backgroundColor: "{colors.primary-light}"
  button-danger:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    minHeight: 48px
  button-danger-pressed:
    backgroundColor: "#991B1B"
  button-danger-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-text}"
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.input-text}"
    rounded: "{rounded.control}"
    minHeight: 48px
    padding: "0 {spacing.md}"
    border: "1px solid {colors.border-control}"
  text-input-focused:
    border: "1px solid {colors.primary-action}"
  text-input-error:
    border: "1px solid {colors.danger-strong}"
  text-input-disabled:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.disabled-text}"
    border: "1px solid {colors.border}"
  text-input-readonly:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
  helper-text:
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    padding: "4px 0 0 0"
  helper-text-error:
    textColor: "{colors.danger-strong}"
    typography: "{typography.caption}"
    padding: "4px 0 0 0"
  select-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.input-text}"
    rounded: "{rounded.md}"
    minHeight: 48px
    padding: "0 {spacing.md}"
    border: "1px solid {colors.border-control}"
  select-option-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    minHeight: 48px
    padding: "{spacing.md} {spacing.lg}"
  select-option-row-selected:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-on-soft}"
  multi-select-chip:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-on-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    minHeight: 32px
    padding: "0 {spacing.md}"
    border: "1px solid {colors.primary-border}"
    hitSlop: "top: 8, bottom: 8, left: 6, right: 6"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    minHeight: 36px
    padding: "0 {spacing.md}"
    border: "1px solid {colors.border-control}"
    hitSlop: "top: 4, bottom: 4, left: 4, right: 4" # Mở rộng vùng chạm đạt tối thiểu 44x44px theo WCAG / iOS HIG
  filter-chip-selected:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-on-soft}"
    border: "1px solid {colors.primary-border}"
  date-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.input-text}"
    rounded: "{rounded.md}"
    minHeight: 48px
    border: "1px solid {colors.border-control}"
  date-picker-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  date-cell-selected:
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    minHeight: 44px
  date-cell-in-range:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-action}"
    minHeight: 44px
  file-upload-zone:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    minHeight: 96px
    border: "2px dashed {colors.border-control}"
  file-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    minHeight: 56px
    padding: "{spacing.md}"
    border: "1px solid {colors.border}"
  confirm-dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
  timeline-item:
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    padding: "{spacing.sm} 0 {spacing.lg} {spacing.xl}"
    border: "0 0 0 2px {colors.border} solid"
  timeline-item-current:
    border: "0 0 0 2px {colors.primary-action} solid"
  stepper-step:
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    minHeight: 44px
  stepper-step-active:
    textColor: "{colors.primary-on-soft}"
    typography: "{typography.label}"
  stepper-step-done:
    textColor: "{colors.success-strong}"
  segmented-tabs:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 44px
  segmented-tabs-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
  qc-check-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    minHeight: 72px
    padding: "{spacing.lg}"
    border: "1px solid {colors.border}"
  qc-check-item-failed:
    backgroundColor: "{colors.danger-light}"
    border: "1px solid {colors.danger-strong}"
  list-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    minHeight: 64px
    border: "1px solid {colors.border}"
  bottom-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    minHeight: 64px
    border: "1px solid {colors.border}"
  bottom-nav-item-active:
    textColor: "{colors.primary-action}"
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
---

## Overview

Giao diện di động cho Getvini ERP: thao tác một tay, dùng ngoài hiện trường, thông tin quan trọng đọc nhanh và không thể hiểu nhầm.

**File này kế thừa `design-tokens.shared.md`** cho: bảng màu và quy tắc tương phản, mapping trạng thái theo domain (`status-badge-*`), hiển thị số và tiền tệ, hành vi form, xử lý realtime, truy cập. Không nhắc lại ở đây; chỉ ghi phần riêng của mobile. Quy tắc triển khai nằm ở `IMPLEMENTATION-GUIDELINES.md`.

Tóm tắt các quy tắc cứng (chi tiết ở file chung):
- Mọi số tiền và số lượng có dấu `.` hàng nghìn, dấu `,` thập phân; dùng `@/utils/formatters`; không viết tắt `Tr/Tỷ`.
- `primary` `#F38820` chỉ để nhận diện; mọi thứ tương tác dùng `primary-action`.
- Trạng thái luôn tra theo `domain.STATUS`, kèm icon và chữ.
- Không ghi đè dữ liệu đang nhập khi nhận cập nhật realtime.

## Typography

- Font **Inter**; fallback `-apple-system, system-ui, Roboto, sans-serif`. Hỗ trợ tiếng Việt có dấu đầy đủ.
- Số tiền và số lượng dùng `number-lg` hoặc `number-md` (tabular numbers) để thẳng cột.
- Input dùng `input-text` 16px để iOS không tự phóng to khi focus.
- Không dùng cỡ chữ dưới 12px. Đơn vị cỡ chữ theo cài đặt hệ thống (sp/Dynamic Type), co giãn tới 200%.
- Nhãn UI ngắn gọn; nội dung dài tự xuống dòng. Chỉ cắt bằng "…" khi có cách xem đầy đủ.

## Layout

- Lề trái phải màn hình 16px; khoảng cách giữa các thẻ danh sách 12px.
- Vùng chạm tối thiểu **44x44px**; nút và input chuẩn có `minHeight` 48px và giãn theo nội dung/cỡ chữ. Hai vùng chạm kề nhau cách tối thiểu 8px.
- Hành động chính đặt ở nửa dưới màn hình (nút cố định đáy hoặc bottom sheet). Nút cố định đáy cách safe area và không bị bàn phím che.
- Bottom nav tối đa 5 mục; phân hệ còn lại vào "Khác".
- Chiều rộng thiết kế chuẩn 360-430px.
- **Tablet:** nội dung dạng form và chi tiết giới hạn 720px, canh giữa. Danh sách, bảng báo cáo và dashboard **không** bị giới hạn bề rộng; được phép chuyển thành lưới nhiều cột hoặc bảng cuộn ngang với cột đầu cố định.
- Bảng số liệu nhiều cột trên điện thoại: chuyển thành thẻ xếp dọc, hoặc cuộn ngang với cột nhận diện cố định; không thu nhỏ chữ dưới 12px.

## Elevation

| Cấp | Xử lý | Dùng cho |
|---|---|---|
| 0 | Phẳng, viền `border` | Card, list item (mặc định) |
| 1 | `0 1px 2px rgba(15,23,42,0.06)` | Nút cố định đáy |
| 2 | `0 -4px 16px rgba(15,23,42,0.10)` | Bottom sheet, menu nổi |

Phía sau bottom sheet và dialog dùng `overlay`.

## Components

Khai báo đầy đủ ở YAML. Quy tắc bổ sung:

### Nút
- Mỗi **khu vực hành động** có tối đa một `button-primary` (quy tắc ở mục 5 file chung). Thanh cố định đáy chỉ một nút chính.
- Đang gửi: spinner trong nút, nút khóa. Hành động xóa/hủy/từ chối dùng `button-danger` và có xác nhận nêu rõ đối tượng.

### Input và chọn giá trị
- Nhãn nằm trên ô; lỗi hiện dưới ô kèm icon và chữ.
- **Searchable select** (`select-field` + `select-option-row`): chạm mở bottom sheet toàn chiều cao, ô tìm kiếm cố định ở đầu, tìm không phân biệt dấu tiếng Việt, hiển thị trạng thái đang tải / không có kết quả, tối đa 8 dòng gợi ý đầu, "Xem thêm" khi còn.
- **Multi-select:** các giá trị đã chọn hiển thị bằng `multi-select-chip` (có nút xóa 44px vùng chạm), tối đa hiển thị 3 chip rồi "+N". Trong bottom sheet có "Chọn tất cả" khi danh sách ≤ 50 mục và nút "Xong" cố định.
- **Date picker** (`date-field` + `date-picker-sheet`): ưu tiên bộ chọn ngày của hệ điều hành; định dạng `dd/MM/yyyy`. Với khoảng ngày chọn hai đầu mút trên cùng một lịch. Ô ngày vùng chạm 44px.
- **Số tiền / số lượng:** theo mục 4 file chung (masking theo thời gian thực, bàn phím số).

### Tệp đính kèm
- `file-upload-zone`: chạm để chọn tệp hoặc chụp ảnh. Hiển thị giới hạn dung lượng và định dạng cho phép ngay trong vùng.
- Mỗi tệp một `file-item`: tên, dung lượng, thanh tiến độ (có nhãn %), nút "Thử lại" khi lỗi và "Xóa". Tải lên nhiều tệp song song; lỗi một tệp không chặn tệp khác.
- Ảnh hiện thumbnail 48px; chạm để xem toàn màn hình.

### Hộp thoại xác nhận
- `confirm-dialog`: tiêu đề nêu hành động, nội dung nêu đối tượng cụ thể (ví dụ tên và mã chứng từ). Thông thường tối đa hai nút; nút phá hủy dùng `button-danger`; nút mặc định (focus ban đầu) là nút an toàn.
- **Ngoại lệ Form Dirty Exit:** Hộp thoại thoát form có thay đổi chưa lưu có 3 lựa chọn:
  1. "Tiếp tục chỉnh sửa" (An toàn, `button-secondary`, **focus mặc định ban đầu** để chống mất dữ liệu khi bấm nhầm).
  2. "Lưu" (Primary action, `button-primary`).
  3. "Bỏ thay đổi" (Danger action, `button-danger`).

### Tiến trình và lịch sử
- **Stepper** (`stepper-step`, `-active`, `-done`): tối đa 5 bước hiển thị ngang; nhiều hơn thì hiển thị "Bước 2/7" và danh sách. Mỗi bước có chữ và biểu tượng, không chỉ màu.
- **Timeline** (`timeline-item`): sắp xếp mới nhất ở trên, mỗi mục gồm hành động, người thực hiện, thời điểm `dd/MM/yyyy HH:mm`. Mục hiện tại dùng `timeline-item-current`. Tải thêm khi cuộn.

### Tab
- `segmented-tabs` cho 2-4 mục cùng cấp trong một màn hình; nhiều hơn thì dùng chip cuộn ngang. Mục đang chọn phân biệt bằng nền và viền, không chỉ màu chữ.

### Nghiệm thu và QC
- `qc-check-item`: mỗi hạng mục kiểm tra có tiêu đề, tiêu chí đạt, ba lựa chọn "Đạt / Không đạt / Không áp dụng" (nút 44px), ô ghi chú và đính kèm ảnh.
- Chọn "Không đạt" thì bắt buộc nhập ghi chú; thẻ chuyển sang `qc-check-item-failed`, kèm icon.
- Màn hình nghiệm thu có thanh tổng hợp cố định: số hạng mục đạt/không đạt/chưa kiểm. Không cho gửi nghiệm thu khi còn hạng mục chưa kiểm.
- Trạng thái nghiệm thu hiển thị bằng `status-badge-*` theo domain `TASK` (`TASK.AWAITING_ACCEPTANCE`, `TASK.ACCEPTED`) hoặc quy trình duyệt biên bản nghiệm thu.
- Xác nhận chữ ký hoặc xác nhận cuối dùng `confirm-dialog`, nêu rõ tác động.

### Danh sách và điều hướng
- **List item:** tiêu đề tối đa 2 dòng, badge trạng thái ở góc phải trên, số tiền canh phải bằng `number-md`.
- **Phân trang:** mobile dùng cuộn vô hạn với chỉ báo tải và nút "Tải thêm" khi lỗi; kèm tổng số bản ghi nếu có. Danh sách có hành động hàng loạt dùng nút "Tải thêm" thay vì cuộn vô hạn để giữ vị trí chọn.
- **Bottom nav:** mục chọn dùng `primary-action` cho icon và nhãn, kèm vạch hoặc nền nhấn; mục còn lại `text-muted`.
- **Chip lọc (`filter-chip`):** chiều cao hiển thị 36px, cuộn ngang, không xuống dòng; bắt buộc khai báo `hitSlop: { top: 4, bottom: 4, left: 4, right: 4 }` để vùng chạm thực tế luôn đạt chuẩn tối thiểu 44×44px.

### Bottom sheet
- Có thanh kéo. Đóng bằng vuốt xuống, nút Đóng, hoặc chạm nền mờ **chỉ khi nội dung không có thay đổi chưa lưu**. Nếu dirty: hiện `confirm-dialog` (Lưu / Bỏ thay đổi / Tiếp tục chỉnh sửa - focus ban đầu vào "Tiếp tục chỉnh sửa") cho mọi cách đóng, kể cả cử chỉ vuốt.
- Nội dung dài cuộn bên trong; nút hành động chính cố định cuối sheet.

## Trạng thái màn hình (bắt buộc)

- **Loading:** skeleton theo hình dạng nội dung.
- **Empty:** icon, một câu giải thích, một hành động gợi ý. Lọc không ra kết quả thì có "Xóa bộ lọc".
- **Error:** thông báo tiếng Việt dễ hiểu và "Thử lại"; không hiển thị mã lỗi kỹ thuật.
- **Pull-to-refresh** cho mọi danh sách và dashboard.
- **Offline:** banner "Không có kết nối"; giữ dữ liệu đã tải; khóa hành động cần mạng kèm lý do; form đang nhập được giữ nguyên.
- **Realtime / xung đột:** theo mục 6 file chung (`inline-banner-*`, nút "N mục mới", `confirm-dialog` xung đột).
- **Quyền hạn:** hành động không có quyền thì ẩn hoặc khóa kèm lý do.

## Do's and Don'ts

### Do
- Dùng bộ `primary-soft*` cho nút chính; dùng `primary-action` cho tab/bottom nav active và vòng focus.
- Giữ vùng chạm ≥ 44px (bắt buộc dùng `hitSlop` cho control nhỏ hơn 44px như `filter-chip` 36px) và `minHeight` thay cho chiều cao cố định.
- Hỏi xác nhận khi đóng sheet/màn hình có thay đổi chưa lưu (focus mặc định vào "Tiếp tục chỉnh sửa").
- Tra mapping trạng thái theo domain; dùng `-strong` cho chữ trên nền màu.
- Xử lý đủ Loading, Empty, Error, Pull-to-refresh, Offline.
- Thống nhất thuật ngữ chuẩn: "Đề nghị thanh toán".

### Don't
- Không hiển thị số trần như `50000000`.
- Không dùng `primary` `#F38820` cho chữ, viền input, focus ring trên nền trắng.
- Không dùng chữ trắng (`on-primary`) trên nền `primary` hoặc `primary-soft*`.
- Không đặt `button-primary` ở từng hàng của danh sách lặp lại.
- Không đặt hai nút chính trong cùng một khu vực hành động.
- Không đóng bottom sheet đang dirty chỉ bằng chạm nền mờ.
- Không dùng chiều cao cố định cho nút, input, hàng danh sách.
- Không dùng cỡ chữ dưới 12px.

## Accessibility (riêng mobile)

- Thứ tự focus của trình đọc màn hình theo thứ tự trực quan; hộp thoại và bottom sheet khóa focus bên trong và trả focus khi đóng.
- Nút chỉ có icon có accessibility label tiếng Việt.
- Kiểm thử với VoiceOver/TalkBack và cỡ chữ hệ thống lớn nhất ở màn hình nhập liệu và nghiệm thu.
- Hỗ trợ giảm chuyển động qua hệ thống: Kiểm tra `AccessibilityInfo.isReduceMotionEnabled()` hoặc sử dụng hook `useReducedMotion()` của `react-native-reanimated` để vô hiệu hóa animation chuyển cảnh.
- Các quy tắc màu và tương phản ở mục 2 file chung.

## Quyết định Thiết kế Đã Chốt

- **[Đã hoàn thành]** Toàn bộ mapping trạng thái của 7 domain nghiệp vụ (`TASK`, `QUOTATION`, `CONTRACT`, `OPPORTUNITY`, `PAYMENT_REQUEST`, `DEBT`, `PROJECT`) đã được đối chiếu chuẩn 100% với Backend TypeORM Entities và cập nhật tại Mục 3 trong `docs/design-tokens.shared.md`.
- **[Đã chốt chính thức]** Nút chính (CTA): **Cam nhạt** gồm nền `primary-soft` `#FFEDD5`, chữ `primary-on-soft` `#9A3412` (6,38:1), viền `primary-soft-border` `#C2540A` (4,60:1 so với nền trắng). Hover `#FED7AA` (5,40:1); pressed `#FDCB9E` (4,95:1), viền pressed `#A84608` (5,92:1). Lý do: nút cam đặc quá nặng và nổi trên giao diện sáng. Thay thế quyết định cũ (cam đậm `#A35A14` chữ trắng, 5,21:1).
- **[Đã chốt chính thức]** Bộ icon chuẩn hóa toàn hệ thống: **Lucide Icons** (`lucide-react-native`). Quy chuẩn strokeWidth: 2 (mặc định); kích thước chuẩn: 16px (inline), 20px (button/input), 24px (bottom nav/header).
- **[Đã chốt chính thức]** Thông số Animation mobile: 150ms (chạm/active, micro-interactions), 250ms (bottom sheet, screen transition), easing `ease-out`, bắt buộc tôn trọng giảm chuyển động (`AccessibilityInfo.isReduceMotionEnabled()`).
- **[Đã chốt chính thức]** Quy chuẩn Form Dirty Exit Dialog: Gồm 3 lựa chọn với nút mặc định (Initial Focus) là "Tiếp tục chỉnh sửa".
- **[Đã chốt chính thức]** Thống nhất thuật ngữ toàn hệ thống: Sử dụng "Đề nghị thanh toán".

## Known Gaps

- Chưa có mẫu biểu đồ, màn hình ký xác nhận bằng tay, và quét mã vạch/QR.
- Chưa chốt font chính thức nếu thương hiệu dùng font riêng thay Inter.
