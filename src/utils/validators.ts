/**
 * Utility Validators với Regex cho React Native ERP App
 * Đảm bảo kiểm tra tính hợp lệ cho URL Link, Email, Phone, Số tiền và MST.
 */

// Regex đường dẫn URL (Hỗ trợ domain công cộng, localhost, địa chỉ IP và port ví dụ: http://localhost:5173)
export const URL_REGEX = /^https?:\/\/(localhost|([0-9]{1,3}\.){3}[0-9]{1,3}|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|[a-zA-Z0-9-]+)(:[0-9]{1,5})?(\/.*)?$/i;

// Regex Email theo chuẩn RFC 5322 đơn giản hoá
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Regex Số điện thoại Việt Nam (10 số bắt đầu bằng 03, 05, 07, 08, 09 hoặc mã quốc tế +84)
export const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

// Regex Số điện thoại nới lỏng (từ 8 đến 15 ký tự số, dấu +, dấu cách)
export const LOOSE_PHONE_REGEX = /^[0-9\+\-\s\(\)]{8,15}$/;

// Regex Số nguyên tố dương (dùng cho số lượng, định mức)
export const INTEGER_REGEX = /^[0-9]+$/;

// Regex Số thập phân / Số tiền (dùng cho đơn giá, chi phí)
export const DECIMAL_REGEX = /^[0-9]+(\.[0-9]+)?$/;

// Regex Mã số thuế Việt Nam (10 số hoặc 13 số có dạng 1234567890-123)
export const TAX_ID_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;

// Regex Tỷ lệ % (từ 0 đến 100, cho phép tối đa 2 chữ số thập phân)
export const PERCENT_REGEX = /^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/;

// Regex Mã định danh (3-30 ký tự hoa, số, gạch ngang, gạch dưới)
export const IDENTIFIER_REGEX = /^[A-Z0-9_-]{3,30}$/;

// Regex Ngày tháng nhập tay UI theo chuẩn DD-MM-YYYY
export const DATE_UI_REGEX = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

/**
 * Kiểm tra tính hợp lệ của đường dẫn URL (Link Hợp đồng, Link báo giá...)
 * Hỗ trợ các link domain, localhost, IP nội bộ, và port.
 */
export const isValidUrl = (url?: string): boolean => {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();

  // 1. Kiểm tra cấu trúc tên miền / IP / localhost bằng Regex nghiêm ngặt
  const strictUrlRegex = /^(https?:\/\/)?(localhost|([0-9]{1,3}\.){3}[0-9]{1,3}|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(:[0-9]{1,5})?(\/.*)?$/i;
  if (!strictUrlRegex.test(trimmed)) {
    return false;
  }

  // 2. Định dạng tạm thời để thử nghiệm với native new URL()
  const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  // 3. Sử dụng new URL() để đảm bảo cú pháp URL hoàn toàn hợp lệ trong JS Engine
  try {
    const parsed = new URL(formatted);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Tự động định dạng chuẩn hóa URL (giữ nguyên nếu đã có http:// hoặc https://, bổ sung https:// nếu thiếu)
 */
export const normalizeUrl = (url?: string): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  // /^https?:\/\//i khớp với CẢ http:// LẪN https://
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

/**
 * Kiểm tra tính hợp lệ của Email
 */
export const isValidEmail = (email?: string): boolean => {
  if (!email || !email.trim()) return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Kiểm tra tính hợp lệ của Số điện thoại
 */
export const isValidPhone = (phone?: string): boolean => {
  if (!phone || !phone.trim()) return false;
  const clean = phone.trim().replace(/\s+/g, '');
  return PHONE_REGEX.test(clean) || LOOSE_PHONE_REGEX.test(clean);
};

/**
 * Kiểm tra chuỗi ký tự chỉ chứa số nguyên
 */
export const isNumeric = (val?: string): boolean => {
  if (!val || !val.trim()) return false;
  return INTEGER_REGEX.test(val.trim());
};

/**
 * Kiểm tra số hợp lệ (số nguyên hoặc số thập phân)
 */
export const isValidNumber = (val?: string | number): boolean => {
  if (val === undefined || val === null || val === '') return false;
  const str = String(val).trim();
  return DECIMAL_REGEX.test(str);
};

/**
 * Kiểm tra Mã số thuế hợp lệ
 */
export const isValidTaxId = (taxId?: string): boolean => {
  if (!taxId || !taxId.trim()) return false;
  return TAX_ID_REGEX.test(taxId.trim());
};

/**
  * Kiểm tra Tỷ lệ % hợp lệ (0 đến 100, tối đa 2 chữ số thập phân)
  */
export const isValidPercent = (val?: string | number): boolean => {
  if (val === undefined || val === null || val === '') return false;
  const str = String(val).trim();
  return PERCENT_REGEX.test(str);
};

/**
  * Kiểm tra Mã định danh hợp lệ (3-30 ký tự, in hoa, số, _, -)
  */
export const isValidIdentifier = (code?: string): boolean => {
  if (!code || !code.trim()) return false;
  return IDENTIFIER_REGEX.test(code.trim());
};

/**
  * Kiểm tra Ngày tháng nhập UI định dạng DD-MM-YYYY
  */
export const isValidDateUI = (dateStr?: string): boolean => {
  if (!dateStr || !dateStr.trim()) return false;
  return DATE_UI_REGEX.test(dateStr.trim());
};
