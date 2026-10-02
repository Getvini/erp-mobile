/**
 * Helper chuyển đổi số tiền (number/string) thành chữ tiếng Việt
 * Ví dụ: 10.000.000 -> "Mười triệu đồng chẵn"
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readGroup(group: number, showZeroUnits = true): string {
  const hundred = Math.floor(group / 100);
  const ten = Math.floor((group % 100) / 10);
  const unit = group % 10;
  let result = '';

  if (hundred > 0 || showZeroUnits) {
    result += `${DIGITS[hundred]} trăm `;
  }

  if (ten > 1) {
    result += `${DIGITS[ten]} mươi `;
    if (unit === 1) result += 'mốt ';
    else if (unit === 5) result += 'lăm ';
    else if (unit > 0) result += `${DIGITS[unit]} `;
  } else if (ten === 1) {
    result += 'mười ';
    if (unit === 1) result += 'một ';
    else if (unit === 5) result += 'lăm ';
    else if (unit > 0) result += `${DIGITS[unit]} `;
  } else if (ten === 0) {
    if (hundred > 0 && unit > 0) result += 'lẻ ';
    if (unit > 0) {
      if (unit === 5 && hundred > 0) result += 'lăm ';
      else result += `${DIGITS[unit]} `;
    }
  }

  return result.trim();
}

export function readMoneyToWords(amount?: number | string | null): string {
  const num = Math.round(Math.abs(Number(amount) || 0));
  if (num === 0) return 'Không đồng';

  const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  let temp = num;
  const groups: number[] = [];

  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupValue = groups[i];
    if (groupValue > 0) {
      const isFirst = i === groups.length - 1;
      const text = readGroup(groupValue, !isFirst);
      const unitText = UNITS[i] ? ` ${UNITS[i]}` : '';
      words.push(text + unitText);
    }
  }

  let result = words.join(' ').replace(/\s+/g, ' ').trim();
  if (result) {
    result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn';
  } else {
    result = 'Không đồng';
  }

  return result;
}
