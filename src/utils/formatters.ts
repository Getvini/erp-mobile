import Decimal from 'decimal.js';

/**
 * Chuẩn Định Dạng Số & Tiền Tệ Hệ Thống Getvini ERP Mobile
 * Tuân thủ quy định: Toàn bộ số và tiền tệ phải có dấu phân cách hàng nghìn (dấu chấm .)
 */

/**
 * Định dạng số nguyên hoặc số thực với dấu phân cách hàng nghìn theo chuẩn vi-VN (dấu .)
 * Sử dụng regex để đảm bảo 100% hoạt động chính xác trên React Native / Hermes
 * Ví dụ: 1000000 -> "1.000.000", 1500.5 -> "1.500,5"
 */
export const formatNumber = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '0';

  let num: number;
  if (typeof value === 'number') {
    if (isNaN(value)) return '0';
    num = value;
  } else {
    const cleanStr = String(value).trim();
    if (!cleanStr) return '0';

    // 1. Direct JS numeric string check (e.g., "510020000.000", "510020000", "1500.5")
    const directNum = Number(cleanStr);
    if (!isNaN(directNum)) {
      num = directNum;
    } else {
      // 2. Pre-formatted Vietnamese numeric string (e.g., "1.500.000,50" or "1.500.000")
      const parsedNum = Number(cleanStr.replace(/\./g, '').replace(/,/g, '.'));
      if (isNaN(parsedNum)) return '0';
      num = parsedNum;
    }
  }

  // Format integer part with dot (.) as thousand separator and decimal part with comma (,)
  const parts = num.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
};

/**
 * Định dạng tiền tệ VND với dấu phân cách hàng nghìn (.) và khoảng trắng không ngắt (\u00A0) trước ký hiệu "₫".
 * - Làm tròn nửa ra xa 0 (half-away-from-zero / Decimal.ROUND_HALF_UP) về số nguyên đồng (0 fraction digits).
 * - Khử triệt để dấu âm -0.
 * - Nhận chuỗi số decimal (TypeORM string) an toàn mà không ép qua Number() gây tràn số hay mất độ chính xác.
 * - Hỗ trợ giá trị vượt Number.MAX_SAFE_INTEGER.
 */
export const formatVND = (
  value: number | string | undefined | null,
  suffix: string = '₫'
): string => {
  const space = suffix === '₫' ? '\u00A0' : ' ';
  if (value === null || value === undefined || value === '') return `0${space}${suffix}`;

  try {
    let cleanStr = typeof value === 'string' ? value.trim() : String(value);
    if (!cleanStr) return `0${space}${suffix}`;

    // Chuẩn hóa chuỗi định dạng hỗn hợp (vd: "1.500.000,50" -> "1500000.50")
    if (cleanStr.includes('.') && cleanStr.includes(',')) {
      if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      } else {
        cleanStr = cleanStr.replace(/,/g, '');
      }
    } else if (cleanStr.includes(',') && !cleanStr.includes('.')) {
      cleanStr = cleanStr.replace(',', '.');
    }

    const d = new Decimal(cleanStr);
    if (d.isNaN()) return `0${space}${suffix}`;

    // Làm tròn nguyên đồng theo chuẩn half-away-from-zero
    const rounded = d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    // Khử dấu âm -0
    if (rounded.isZero()) {
      return `0${space}${suffix}`;
    }

    const isNegative = rounded.isNegative();
    const absStr = rounded.abs().toFixed(0);
    const formattedInt = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${isNegative ? '-' : ''}${formattedInt}${space}${suffix}`;
  } catch {
    return `0${space}${suffix}`;
  }
};

/**
 * Định dạng tiền tệ với hậu tố đầy đủ "VNĐ" và dấu phân cách hàng nghìn (dấu chấm .)
 * Ví dụ: 100000000 -> "100.000.000 VNĐ"
 */
export const formatVNDFull = (value: number | string | undefined | null): string => {
  return formatVND(value, 'VNĐ');
};

/**
 * Tự động định dạng chuỗi người dùng đang gõ vào ô nhập tiền/số lượng (Real-time Mask)
 * Chỉ giữ lại các chữ số và tự động chèn dấu chấm phân cách hàng nghìn
 * Ví dụ: "1000000" -> "1.000.000"
 */
export const formatNumberInput = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '';
  const digitsOnly = String(value).replace(/\D/g, '');
  if (!digitsOnly) return '';
  const cleanDigits = digitsOnly.replace(/^0+(?=\d)/, '');
  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Chuyển chuỗi đã định dạng dấu chấm phân cách về lại số nguyên để gửi API hoặc tính toán
 * Ví dụ: "1.000.000" -> 1000000
 */
export const parseNumberInput = (formatted: string | undefined | null): number => {
  if (!formatted) return 0;
  const digitsOnly = String(formatted).replace(/\D/g, '');
  return digitsOnly ? Number(digitsOnly) : 0;
};

/**
 * Định dạng số lượng (áp dụng cho đơn hàng, hợp đồng, dịch vụ)
 * Ví dụ: 1000 -> "1.000"
 */
export const formatQuantity = (qty: number | string | undefined | null): string => {
  if (qty === null || qty === undefined || qty === '') return '1';
  const num = typeof qty === 'string' ? Number(qty.replace(/\D/g, '')) : qty;
  if (isNaN(num) || num <= 0) return '1';
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Định dạng tỷ lệ phần trăm
 * Ví dụ: 35 -> "35%"
 */
export const formatPercent = (val: number | string | undefined | null): string => {
  if (val === null || val === undefined || val === '') return '0%';
  const num = Number(val);
  if (isNaN(num)) return '0%';
  return `${num}%`;
};

/**
 * Định dạng ngày hiển thị theo chuẩn hệ thống: DD-MM-YYYY (Ví dụ: 15-09-2026)
 */
export const formatDateToDDMMYYYY = (
  dateInput: Date | string | number | undefined | null,
  fallback: string = ''
): string => {
  if (!dateInput) return fallback;

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    const str = String(dateInput).trim();
    if (!str) return fallback;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyyMatch) {
      const day = String(ddmmyyyyMatch[1]).padStart(2, '0');
      const month = String(ddmmyyyyMatch[2]).padStart(2, '0');
      const year = ddmmyyyyMatch[3];
      return `${day}-${month}-${year}`;
    }

    // Handle YYYY-MM-DD
    const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyymmddMatch) {
      const year = yyyymmddMatch[1];
      const month = String(yyyymmddMatch[2]).padStart(2, '0');
      const day = String(yyyymmddMatch[3]).padStart(2, '0');
      return `${day}-${month}-${year}`;
    }

    d = new Date(str);
  }

  if (isNaN(d.getTime())) return fallback;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Định dạng ngày giờ ISO/API sang chuẩn hiển thị Việt Nam: DD/MM/YYYY HH:mm.
 * Chuỗi có timezone (ví dụ hậu tố Z) được chuyển về múi giờ địa phương của thiết bị.
 */
export const formatDateTimeToDDMMYYYYHHMM = (
  dateInput: Date | string | number | undefined | null,
  fallback: string = ''
): string => {
  if (!dateInput) return fallback;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return fallback;

  const displayDate = formatDateToDDMMYYYY(date).replace(/-/g, '/');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${displayDate} ${hours}:${minutes}`;
};

/**
 * Chuyển ngày về định dạng API YYYY-MM-DD (Ví dụ: 2026-09-15)
 */
export const formatDateToYYYYMMDD = (
  dateInput: Date | string | number | undefined | null,
  fallback: string = ''
): string => {
  if (!dateInput) return fallback;

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    const str = String(dateInput).trim();
    if (!str) return fallback;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(str);
    }
  }

  if (isNaN(d.getTime())) return fallback;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse chuỗi ngày bất kỳ (DD-MM-YYYY, YYYY-MM-DD, ISO) thành Date object
 */
export const parseDateInput = (str?: string | null): Date => {
  if (!str) return new Date();
  const cleanStr = String(str).trim();

  // Try DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const res = new Date(year, month, day);
    if (!isNaN(res.getTime())) return res;
  }

  // Try YYYY-MM-DD
  const yyyymmddMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    const res = new Date(year, month, day);
    if (!isNaN(res.getTime())) return res;
  }

  const d = new Date(cleanStr);
  return isNaN(d.getTime()) ? new Date() : d;
};
