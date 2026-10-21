export interface CashflowStatusParams {
  planned: number;
  paid: number;
  unpaid: number;
  overdue?: number;
  prepaid?: number;
}

export interface CashflowStatusBadge {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export function getCashflowStatusBadge({
  planned,
  paid,
  unpaid,
  overdue = 0,
  prepaid = 0,
}: CashflowStatusParams): CashflowStatusBadge {
  if (planned > 0 && paid > 0 && unpaid <= 0) {
    return {
      label: 'Đã thu đủ',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    };
  }
  if (planned > 0 && paid > 0 && unpaid > 0) {
    return {
      label: 'Thu 1 phần',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    };
  }
  if (paid <= 0 && unpaid > 0) {
    return {
      label: 'Chưa thu',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
    };
  }
  if (planned <= 0 && paid > 0 && overdue > 0 && prepaid <= 0) {
    return {
      label: 'Thu nợ cũ',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    };
  }
  if (planned <= 0 && paid > 0) {
    return {
      label: 'Thu trước',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    };
  }
  return {
    label: 'Không phát sinh',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
  };
}
