/**
 * Helper kiểm tra ràng buộc nghiệp vụ của Opportunity đối với Job AI và điều kiện lập báo giá.
 * Đồng bộ 100% với Web (erp-UI/src/pages/Opportunities/OpportunityDetailPage/OpportunityDetailPage.jsx).
 */

export interface OpportunityJobItem {
  id?: string;
  name?: string;
  isQuotationItem?: boolean;
  isBriefVideo?: boolean;
  costAtSale?: number;
  [key: string]: any;
}

export interface OpportunityServiceItem {
  service?: {
    isAI?: boolean;
    [key: string]: any;
  } | any;
  jobs?: OpportunityJobItem[];
  [key: string]: any;
}

/**
 * Trả về danh sách các job AI chưa có giá vốn bán (costAtSale <= 0),
 * ngoại trừ các brief video.
 */
export function getIncompleteAiJobs(services?: OpportunityServiceItem[]): OpportunityJobItem[] {
  if (!Array.isArray(services)) return [];

  return services.flatMap((service) => {
    if (!service.service?.isAI) return [];

    return (service.jobs || []).filter(
      (job) => job.isQuotationItem && !job.isBriefVideo && Number(job.costAtSale || 0) <= 0
    );
  });
}

/**
 * Kiểm tra xem người dùng hiện tại có được phép lập báo giá cho cơ hội hay không.
 * Điều kiện:
 * 1. Phải có thông tin khách hàng (customer hoặc leadName).
 * 2. Chưa có bản báo giá nào ở trạng thái APPROVED hoặc QUOTE_APPROVED.
 * 3. Trạng thái cơ hội thuộc QUOTATION_DRAFTING, PENDING_QUOTE_APPROVAL,
 *    hoặc OPP_APPROVED (kèm điều kiện user là ADMIN/BOD hoặc là người tạo cơ hội).
 */
export function canCreateQuotationFromOpportunity(
  opportunity?: any | null,
  user?: any | null,
  quotations: any[] = []
): boolean {
  if (!opportunity) return false;

  const hasCustomer = !!(
    opportunity.customer ||
    opportunity.customerId ||
    opportunity.leadName
  );
  if (!hasCustomer) return false;

  const hasApprovedQuotation =
    opportunity.status === 'QUOTE_APPROVED' ||
    opportunity.status === 'CONTRACT_CREATED' ||
    quotations.some(
      (q: any) => q.status === 'APPROVED' || q.status === 'QUOTE_APPROVED'
    );
  if (hasApprovedQuotation) return false;

  const status = opportunity.status;
  if (status === 'QUOTATION_DRAFTING' || status === 'PENDING_QUOTE_APPROVAL') {
    return true;
  }

  if (status === 'OPP_APPROVED') {
    const role = (user?.role || '').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'BOD';
    const isCreator =
      opportunity.createdBy?.id === user?.id ||
      opportunity.creator?.id === user?.id;

    return isAdmin || isCreator;
  }

  return false;
}
