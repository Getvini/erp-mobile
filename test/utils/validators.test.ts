import {
  PHONE_REGEX,
  EMAIL_REGEX,
  TAX_ID_REGEX,
  INTEGER_REGEX,
  PERCENT_REGEX,
  IDENTIFIER_REGEX,
  DATE_UI_REGEX,
  isValidPhone,
  isValidEmail,
  isValidTaxId,
  isNumeric,
  isValidPercent,
  isValidIdentifier,
  isValidDateUI,
  isValidUrl,
  normalizeUrl,
} from '@/utils/validators';

describe('validators utils (7 Regex Bắt Buộc Theo Protocol)', () => {
  describe('1. Regex Số Điện Thoại Việt Nam (PHONE_REGEX)', () => {
    test('Hợp lệ với đầu số 0 và +84 kèm 9 chữ số', () => {
      expect(PHONE_REGEX.test('0987654321')).toBe(true);
      expect(PHONE_REGEX.test('0381234567')).toBe(true);
      expect(PHONE_REGEX.test('0771234567')).toBe(true);
      expect(PHONE_REGEX.test('0861234567')).toBe(true);
      expect(PHONE_REGEX.test('0521234567')).toBe(true);
      expect(PHONE_REGEX.test('+84987654321')).toBe(true);
      expect(PHONE_REGEX.test('+84381234567')).toBe(true);
    });

    test('Không hợp lệ với số sai đầu số, thiếu số, thừa số hoặc chứa chữ', () => {
      expect(PHONE_REGEX.test('0123456789')).toBe(false); // Đầu 01 không thuộc 3,5,7,8,9
      expect(PHONE_REGEX.test('098765432')).toBe(false); // Thiếu 1 số
      expect(PHONE_REGEX.test('09876543210')).toBe(false); // Thừa 1 số
      expect(PHONE_REGEX.test('0987654abc')).toBe(false); // Chứa chữ
    });

    test('Hàm isValidPhone xử lý khoảng trắng chuẩn xác', () => {
      expect(isValidPhone('098 765 4321')).toBe(true);
      expect(isValidPhone('+84 987 654 321')).toBe(true);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(undefined)).toBe(false);
    });
  });

  describe('2. Regex Email RFC (EMAIL_REGEX)', () => {
    test('Hợp lệ với các định dạng email tiêu chuẩn', () => {
      expect(EMAIL_REGEX.test('test@getvini.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name+tag@example.co.uk')).toBe(true);
      expect(EMAIL_REGEX.test('admin_01@sub.domain.vn')).toBe(true);
    });

    test('Không hợp lệ với email sai cú pháp', () => {
      expect(EMAIL_REGEX.test('invalid-email')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('@domain.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@domain')).toBe(false);
    });

    test('Hàm isValidEmail', () => {
      expect(isValidEmail('contact@getvini.vn')).toBe(true);
      expect(isValidEmail('  contact@getvini.vn  ')).toBe(true);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('3. Regex Mã Số Thuế (TAX_ID_REGEX)', () => {
    test('Hợp lệ với MST 10 số doanh nghiệp hoặc 13 số chi nhánh', () => {
      expect(TAX_ID_REGEX.test('0101234567')).toBe(true); // 10 số
      expect(TAX_ID_REGEX.test('0101234567-001')).toBe(true); // 13 số có gạch nối
      expect(TAX_ID_REGEX.test('0312345678-999')).toBe(true);
    });

    test('Không hợp lệ với MST sai độ dài hoặc sai định dạng', () => {
      expect(TAX_ID_REGEX.test('123456789')).toBe(false); // 9 số
      expect(TAX_ID_REGEX.test('12345678901')).toBe(false); // 11 số
      expect(TAX_ID_REGEX.test('1234567890001')).toBe(false); // Thiếu dấu gạch nối
      expect(TAX_ID_REGEX.test('1234567890-01')).toBe(false); // Chi nhánh chỉ 2 số
    });

    test('Hàm isValidTaxId', () => {
      expect(isValidTaxId('0102030405')).toBe(true);
      expect(isValidTaxId('')).toBe(false);
    });
  });

  describe('4. Regex Số Tiền / Số Lượng Unmasked (INTEGER_REGEX)', () => {
    test('Hợp lệ với chuỗi số nguyên dương không chứa dấu chấm hay ký tự lạ', () => {
      expect(INTEGER_REGEX.test('1000000')).toBe(true);
      expect(INTEGER_REGEX.test('0')).toBe(true);
      expect(INTEGER_REGEX.test('500000000')).toBe(true);
    });

    test('Không hợp lệ với chuỗi còn dấu chấm, dấu phẩy, số âm hoặc chữ', () => {
      expect(INTEGER_REGEX.test('1.000.000')).toBe(false);
      expect(INTEGER_REGEX.test('100,000')).toBe(false);
      expect(INTEGER_REGEX.test('-50000')).toBe(false);
      expect(INTEGER_REGEX.test('1000vnd')).toBe(false);
    });

    test('Hàm isNumeric', () => {
      expect(isNumeric('123456')).toBe(true);
      expect(isNumeric('')).toBe(false);
    });
  });

  describe('5. Regex Tỷ Lệ Phần Trăm (PERCENT_REGEX)', () => {
    test('Hợp lệ từ 0% đến 100%, cho phép tối đa 2 chữ số thập phân', () => {
      expect(PERCENT_REGEX.test('0')).toBe(true);
      expect(PERCENT_REGEX.test('100')).toBe(true);
      expect(PERCENT_REGEX.test('100.0')).toBe(true);
      expect(PERCENT_REGEX.test('100.00')).toBe(true);
      expect(PERCENT_REGEX.test('50')).toBe(true);
      expect(PERCENT_REGEX.test('8.5')).toBe(true);
      expect(PERCENT_REGEX.test('99.99')).toBe(true);
    });

    test('Không hợp lệ nếu vượt quá 100% hoặc quá 2 chữ số thập phân hoặc âm', () => {
      expect(PERCENT_REGEX.test('101')).toBe(false);
      expect(PERCENT_REGEX.test('150.5')).toBe(false);
      expect(PERCENT_REGEX.test('50.555')).toBe(false);
      expect(PERCENT_REGEX.test('-10')).toBe(false);
    });

    test('Hàm isValidPercent', () => {
      expect(isValidPercent(10)).toBe(true);
      expect(isValidPercent('8.5')).toBe(true);
      expect(isValidPercent(100)).toBe(true);
      expect(isValidPercent('105')).toBe(false);
      expect(isValidPercent('')).toBe(false);
    });
  });

  describe('6. Regex Mã Định Danh (IDENTIFIER_REGEX)', () => {
    test('Hợp lệ với 3-30 ký tự in hoa, số, gạch ngang, gạch dưới', () => {
      expect(IDENTIFIER_REGEX.test('HD_2026_001')).toBe(true);
      expect(IDENTIFIER_REGEX.test('PR-12345')).toBe(true);
      expect(IDENTIFIER_REGEX.test('ABC')).toBe(true);
      expect(IDENTIFIER_REGEX.test('CONTRACT_2026_GETVINI_0001')).toBe(true);
    });

    test('Không hợp lệ với ký tự thường, ký tự đặc biệt lạ, ngắn hơn 3 hoặc dài hơn 30 ký tự', () => {
      expect(IDENTIFIER_REGEX.test('ab')).toBe(false); // Quá ngắn (< 3)
      expect(IDENTIFIER_REGEX.test('hd_2026')).toBe(false); // Chữ thường
      expect(IDENTIFIER_REGEX.test('HD#2026')).toBe(false); // Ký tự # không hợp lệ
      expect(IDENTIFIER_REGEX.test('A'.repeat(31))).toBe(false); // Quá dài (> 30)
    });

    test('Hàm isValidIdentifier', () => {
      expect(isValidIdentifier('PR_2026_09')).toBe(true);
      expect(isValidIdentifier('pr_2026')).toBe(false);
    });
  });

  describe('7. Regex Ngày Tháng Nhập UI DD-MM-YYYY (DATE_UI_REGEX)', () => {
    test('Hợp lệ với định dạng chuẩn DD-MM-YYYY', () => {
      expect(DATE_UI_REGEX.test('26-09-2026')).toBe(true);
      expect(DATE_UI_REGEX.test('01-01-2025')).toBe(true);
      expect(DATE_UI_REGEX.test('31-12-2024')).toBe(true);
      expect(DATE_UI_REGEX.test('15-05-2023')).toBe(true);
    });

    test('Không hợp lệ nếu sai ngày (ngày > 31), sai tháng (tháng > 12), dùng gạch chéo hoặc sai năm', () => {
      expect(DATE_UI_REGEX.test('32-01-2026')).toBe(false); // Ngày 32
      expect(DATE_UI_REGEX.test('00-01-2026')).toBe(false); // Ngày 00
      expect(DATE_UI_REGEX.test('15-13-2026')).toBe(false); // Tháng 13
      expect(DATE_UI_REGEX.test('15/09/2026')).toBe(false); // Dùng gạch chéo
      expect(DATE_UI_REGEX.test('2026-09-15')).toBe(false); // Định dạng YYYY-MM-DD
    });

    test('Hàm isValidDateUI', () => {
      expect(isValidDateUI('26-09-2026')).toBe(true);
      expect(isValidDateUI('invalid')).toBe(false);
      expect(isValidDateUI('')).toBe(false);
    });
  });

  describe('URL Validator & Normalizer', () => {
    test('isValidUrl và normalizeUrl', () => {
      expect(isValidUrl('https://getvini.com')).toBe(true);
      expect(isValidUrl('http://localhost:5173')).toBe(true);
      expect(isValidUrl('getvini.com')).toBe(true);
      expect(normalizeUrl('getvini.com')).toBe('https://getvini.com');
      expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });
  });
});
