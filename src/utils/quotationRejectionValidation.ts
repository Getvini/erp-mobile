/**
 * Helper kiểm tra lý do từ chối báo giá.
 * Đồng bộ với erp-UI/src/pages/Opportunities/OpportunityDetailPage/QuotationDetailModal.jsx.
 */

export interface QuotationRejectionResult {
  isValid: boolean;
  error?: string;
  sanitizedReason?: string;
}

export function validateQuotationRejection(reason?: string | null): QuotationRejectionResult {
  const sanitized = (reason || '').trim();

  if (!sanitized) {
    return {
      isValid: false,
      error: 'Vui lòng nhập lý do từ chối',
    };
  }

  if (sanitized.length < 3) {
    return {
      isValid: false,
      error: 'Lý do từ chối phải có ít nhất 3 ký tự',
    };
  }

  return {
    isValid: true,
    sanitizedReason: sanitized,
  };
}
