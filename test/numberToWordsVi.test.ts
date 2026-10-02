import { readMoneyToWords } from '../src/utils/numberToWordsVi';

describe('numberToWordsVi helper', () => {
  it('should return "Không đồng" for 0 or invalid input', () => {
    expect(readMoneyToWords(0)).toBe('Không đồng');
    expect(readMoneyToWords(null)).toBe('Không đồng');
    expect(readMoneyToWords(undefined)).toBe('Không đồng');
  });

  it('should format 10.000.000 correctly', () => {
    expect(readMoneyToWords(10000000)).toBe('Mười triệu đồng chẵn');
  });

  it('should format 15.500.000 correctly', () => {
    expect(readMoneyToWords(15500000)).toBe('Mười lăm triệu năm trăm nghìn đồng chẵn');
  });

  it('should format 1.250.000 correctly', () => {
    expect(readMoneyToWords(1250000)).toBe('Một triệu hai trăm năm mươi nghìn đồng chẵn');
  });
});
