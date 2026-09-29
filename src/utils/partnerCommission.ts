/**
 * Logic thuần (pure) tính hoa hồng Đối tác giới thiệu / CTV — Phase P2.
 *
 * Đối chiếu backend thật:
 * ERP/src/modules/referral-partner/services/ReferralPartner.Service.ts:83-96
 *   totalCommission  = Σ Number(contract.partnerCommission)
 *   paidCommission   = Σ partnerCommission khi partnerCommissionStatus === 'PAID'
 *   pendingCommission = totalCommission - paidCommission
 *
 * Quy ước số học của hệ thống: KHÔNG làm tròn giá trị tiền (xem AGENTS rule #4).
 */

/** Hợp đồng tối thiểu cần cho việc tính hoa hồng (subset của Contract entity). */
export interface PartnerCommissionContractInput {
  partnerCommission?: number | string | null;
  partnerCommissionStatus?: string | null;
}

/** Kết quả tổng hợp hoa hồng theo danh sách hợp đồng. */
export interface PartnerCommissionSummary {
  total: number;
  paid: number;
  pending: number;
  cancelled: number;
}

/** Nhãn trạng thái thanh toán hoa hồng (đồng bộ enum PartnerCommissionStatus của backend). */
export const PARTNER_COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Hủy bỏ',
};

/** Nhãn loại đối tác (đồng bộ enum PartnerType của backend). */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  BUSINESS: 'Doanh nghiệp',
  INDIVIDUAL: 'Cá nhân',
};

/** Chuyển giá trị tiền (number | string | null | undefined) về number an toàn. */
const toAmount = (value?: number | string | null): number => Number(value) || 0;

/**
 * Cộng dồn hoa hồng từ danh sách hợp đồng.
 * - total: tổng hoa hồng của mọi hợp đồng
 * - paid: tổng hoa hồng của hợp đồng có trạng thái PAID
 * - pending: total - paid (khớp công thức backend)
 * - cancelled: tổng hoa hồng của hợp đồng có trạng thái CANCELLED
 * Giá trị tiền được giữ nguyên độ chính xác số học, KHÔNG làm tròn.
 */
export function sumPartnerCommission(
  contracts?: PartnerCommissionContractInput[] | null,
): PartnerCommissionSummary {
  const list = Array.isArray(contracts) ? contracts : [];

  let total = 0;
  let paid = 0;
  let cancelled = 0;

  for (const contract of list) {
    if (!contract) continue;
    const amount = toAmount(contract.partnerCommission);
    total += amount;

    if (contract.partnerCommissionStatus === 'PAID') {
      paid += amount;
    } else if (contract.partnerCommissionStatus === 'CANCELLED') {
      cancelled += amount;
    }
  }

  return { total, paid, pending: total - paid, cancelled };
}

/**
 * Nhãn tỷ lệ hoa hồng: `'{rate}%'`, giữ tối đa 2 chữ số thập phân.
 * Trả `'0%'` khi giá trị rỗng hoặc không phải số.
 */
export function getCommissionRateLabel(rate?: number | string | null): string {
  if (rate === null || rate === undefined || rate === '') return '0%';

  const num = Number(rate);
  if (!Number.isFinite(num)) return '0%';

  const trimmed = Math.round(num * 100) / 100;
  return `${trimmed}%`;
}

/**
 * Hoa hồng dự kiến = doanh thu dự kiến × tỷ lệ %.
 * Giữ nguyên số lẻ, KHÔNG làm tròn (khớp quy tắc VAT/thành tiền của hệ thống).
 */
export function computeExpectedCommission(
  expectedRevenue?: number | string | null,
  rate?: number | string | null,
): number {
  return (Number(expectedRevenue || 0) * Number(rate || 0)) / 100;
}

/**
 * Nhãn loại đối tác: BUSINESS → 'Doanh nghiệp', INDIVIDUAL → 'Cá nhân'.
 * Fallback: trả về chính chuỗi type nhận được (rỗng nếu không có type).
 */
export function getPartnerTypeLabel(type?: string | null): string {
  if (!type) return '';
  return PARTNER_TYPE_LABELS[type] || type;
}
