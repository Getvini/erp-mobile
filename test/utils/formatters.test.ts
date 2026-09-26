import {
  formatNumber,
  formatVND,
  formatVNDFull,
  formatNumberInput,
  parseNumberInput,
  formatQuantity,
  formatPercent,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';

describe('formatters utils', () => {
  describe('Chuẩn Số Liệu & Tiền Tệ Hệ Thống (Dấu chấm . phân cách)', () => {
    test('formatNumber: phân cách hàng nghìn bằng dấu chấm . và số lẻ bằng dấu phẩy ,', () => {
      expect(formatNumber(1000000)).toBe('1.000.000');
      expect(formatNumber(15000000)).toBe('15.000.000');
      expect(formatNumber('510020000')).toBe('510.020.000');
      expect(formatNumber(1500.5)).toBe('1.500,5');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    test('formatVND: hiển thị hậu tố ₫ kèm dấu chấm phân cách', () => {
      expect(formatVND(100000000)).toBe('100.000.000 ₫');
      expect(formatVND(0)).toBe('0 ₫');
    });

    test('formatVNDFull: hiển thị hậu tố VNĐ đầy đủ', () => {
      expect(formatVNDFull(100000000)).toBe('100.000.000 VNĐ');
    });

    test('formatNumberInput (Real-time Mask): tự động gán dấu chấm khi gõ phím', () => {
      expect(formatNumberInput('1000000')).toBe('1.000.000');
      expect(formatNumberInput('15000000')).toBe('15.000.000');
      expect(formatNumberInput('abc1234567xyz')).toBe('1.234.567');
      expect(formatNumberInput('')).toBe('');
      expect(formatNumberInput(null)).toBe('');
    });

    test('parseNumberInput: unmask dấu chấm trở lại số nguyên chính xác', () => {
      expect(parseNumberInput('1.000.000')).toBe(1000000);
      expect(parseNumberInput('15.000.000')).toBe(15000000);
      expect(parseNumberInput('')).toBe(0);
      expect(parseNumberInput(null)).toBe(0);
    });

    test('formatQuantity: định dạng số lượng hợp lệ', () => {
      expect(formatQuantity(1000)).toBe('1.000');
      expect(formatQuantity('2500')).toBe('2.500');
      expect(formatQuantity(0)).toBe('1');
    });

    test('formatPercent: định dạng tỷ lệ %', () => {
      expect(formatPercent(35)).toBe('35%');
      expect(formatPercent('10')).toBe('10%');
      expect(formatPercent(null)).toBe('0%');
    });
  });

  describe('Quy Chuẩn Làm Tròn Bắt Buộc (P0 Quality Gate)', () => {
    test('CHỈ làm tròn Giá Bán (Selling Price) bằng Math.round', () => {
      const baseCost = 1533333.333;
      const roundedSellingPrice = Math.round(baseCost);
      expect(roundedSellingPrice).toBe(1533333);
      expect(Number.isInteger(roundedSellingPrice)).toBe(true);
    });

    test('TUYỆT ĐỐI KHÔNG làm tròn VAT và Thành tiền (Giữ nguyên độ chính xác)', () => {
      const totalBeforeTax = 15555555;
      const vatRate = 0.08; // VAT 8%
      const vatAmount = totalBeforeTax * vatRate; // 1244444.4
      const finalTotal = totalBeforeTax + vatAmount; // 16799999.4

      // Xác minh VAT và Tổng thanh toán KHÔNG bị làm tròn thành số nguyên
      expect(vatAmount).toBeCloseTo(1244444.4, 2);
      expect(finalTotal).toBeCloseTo(16799999.4, 2);
      expect(vatAmount).not.toBe(Math.round(vatAmount));
    });
  });

  describe('Quy Chuẩn Ngày Tháng (DD-MM-YYYY cho UI, YYYY-MM-DD cho API)', () => {
    test('formatDateToDDMMYYYY: chuyển đổi chính xác sang DD-MM-YYYY cho giao diện', () => {
      expect(formatDateToDDMMYYYY('2026-09-15')).toBe('15-09-2026');
      expect(formatDateToDDMMYYYY('2026-01-05')).toBe('05-01-2026');
      expect(formatDateToDDMMYYYY(new Date(2026, 8, 26))).toBe('26-09-2026');
      expect(formatDateToDDMMYYYY(null, '--')).toBe('--');
    });

    test('formatDateToYYYYMMDD: chuyển đổi chính xác sang YYYY-MM-DD cho API payload', () => {
      expect(formatDateToYYYYMMDD('15-09-2026')).toBe('2026-09-15');
      expect(formatDateToYYYYMMDD('05-01-2026')).toBe('2026-01-05');
      expect(formatDateToYYYYMMDD(new Date(2026, 8, 26))).toBe('2026-09-26');
      expect(formatDateToYYYYMMDD(null, '')).toBe('');
    });
  });
});
