import { formatNumberInput, parseNumberInput } from '@/utils/formatters';

export const STORAGE_DRAFT_KEY = '@erp_opportunity_draft_v3';

export const FIELDS = [
  { value: '', label: '-- Chọn lĩnh vực --' },
  { value: 'CNTT', label: 'Công nghệ thông tin' },
  { value: 'XayDung', label: 'Xây dựng' },
  { value: 'SanXuat', label: 'Sản xuất' },
  { value: 'ThuongMai', label: 'Thương mại' },
  { value: 'DichVu', label: 'Dịch vụ' },
  { value: 'GiaoDuc', label: 'Giáo dục' },
  { value: 'YTe', label: 'Y tế' },
  { value: 'Khac', label: 'Khác' },
];

export const PRIORITIES = [
  { id: 'Low', label: 'Thấp', color: '#64748B' },
  { id: 'Medium', label: 'Trung bình', color: '#3B82F6' },
  { id: 'High', label: 'Cao', color: '#F97316' },
];

export const PROVINCES_LIST = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
  'Quảng Ninh',
  'Bà Rịa - Vũng Tàu',
  'Thừa Thiên Huế',
  'Bắc Ninh',
  'Hải Dương',
  'Hưng Yên',
  'Thái Nguyên',
  'Nghệ An',
  'Thanh Hóa',
  'Lâm Đồng',
  'Bình Định',
  'Kiên Giang',
  'Khác',
];

export const DEFAULT_LINK_PLACEHOLDERS = [
  'https://drive.google.com/... (Link tài liệu)',
  'https://docs.google.com/... (Link kế hoạch)',
  'https://example.com/spec.pdf (Link báo giá đối thủ)',
];

export const formatVNDInput = formatNumberInput;
export const parseVNDInput = parseNumberInput;

export const formatDateInputMask = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const validateDateString = (dateStr: string): boolean => {
  if (!dateStr || dateStr.length !== 10) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  if (y < 1970 || y > 2100) return false;
  const maxDays = new Date(y, m, 0).getDate();
  return d >= 1 && d <= maxDays;
};

export const parseDateObj = (dateStr: string): Date | null => {
  if (!validateDateString(dateStr)) return null;
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
};

export const toISODate = (ddmmyyyy: string): string | undefined => {
  if (!ddmmyyyy) return undefined;
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3 && parts[2]?.length === 4) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return ddmmyyyy;
};

export const toDisplayDate = (isoOrVn: string): string => {
  if (!isoOrVn) return '';
  if (isoOrVn.includes('-')) {
    const parts = isoOrVn.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  return isoOrVn;
};

export const calculateDurationMonths = (startStr: string, endStr: string): number => {
  const start = parseDateObj(startStr);
  const end = parseDateObj(endStr);
  if (start && end && end >= start) {
    const diffYears = end.getFullYear() - start.getFullYear();
    const diffMonths = end.getMonth() - start.getMonth();
    const totalMonths = diffYears * 12 + diffMonths;
    return totalMonths <= 0 ? 1 : totalMonths;
  }
  return 1;
};

export const formatMonthYear = (value: string, prevValue: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (prevValue.endsWith('/') && digits.length === 2 && !value.includes('/')) {
    return digits.slice(0, 1);
  }
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

export const getSuccessChanceMeta = (chance: number) => {
  const val = isNaN(chance) ? 0 : Math.max(0, Math.min(100, chance));
  if (val < 30) {
    return {
      color: '#EF4444',
      bgColor: '#FEF2F2',
      borderColor: '#FCA5A5',
      label: 'Rất thấp / Rủi ro',
    };
  }
  if (val < 50) {
    return {
      color: '#F97316',
      bgColor: '#FFF7ED',
      borderColor: '#FDBA74',
      label: 'Trung bình thấp',
    };
  }
  if (val < 70) {
    return {
      color: '#EAB308',
      bgColor: '#FEFCE8',
      borderColor: '#FDE047',
      label: 'Tiềm năng',
    };
  }
  if (val < 85) {
    return {
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#93C5FD',
      label: 'Khả quan',
    };
  }
  return {
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    label: 'Rất cao / Chắc chắn',
  };
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
