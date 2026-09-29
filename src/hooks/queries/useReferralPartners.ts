import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  referralPartnerService,
  ReferralPartnerListFilters,
  ReferralPartnerPayload,
  ReferralPartnerUpdateInput,
} from '@/services/referralPartnerService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Legacy query key đang được `useOpportunities.ts` (useReferralPartnersQuery /
 * useReferralPartnerDetailQuery) dùng cho selector đối tác trong
 * CustomerAssignModal. Giữ đồng bộ cache giữa 2 bộ hook mà không sửa file khác.
 */
const LEGACY_REFERRAL_PARTNER_KEY = ['referral-partners'] as const;

/**
 * Danh sách đối tác giới thiệu (mảng thô, không phân trang).
 * `filters` chỉ dùng cho cache key — backend không hỗ trợ query params,
 * tìm kiếm được thực hiện client-side tại màn hình.
 */
export function useReferralPartnersQuery(filters: ReferralPartnerListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.referralPartners.list(filters),
    queryFn: async () => {
      const res = await referralPartnerService.getReferralPartners();
      if (res.error) {
        throw new Error(res.error);
      }
      const data = res.data;
      return Array.isArray(data) ? data : [];
    },
  });
}

/**
 * Chi tiết 1 đối tác + 3 relations (customers / opportunities / contracts).
 * Backend trả 500 cho mọi lỗi (kể cả không tìm thấy) → UI xử lý thông báo thân thiện.
 */
export function useReferralPartnerDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.referralPartners.detail(id),
    queryFn: async () => {
      const res = await referralPartnerService.getReferralPartner(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Thống kê đối tác (8 field) dùng cho hàng 3 thẻ + tab Hoa hồng. */
export function useReferralPartnerStatisticsQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.referralPartners.statistics(id),
    queryFn: async () => {
      const res = await referralPartnerService.getReferralPartnerStatistics(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateReferralPartnerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReferralPartnerPayload) => {
      const res = await referralPartnerService.createReferralPartner(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referralPartners.all });
      queryClient.invalidateQueries({ queryKey: LEGACY_REFERRAL_PARTNER_KEY });
    },
  });
}

export function useUpdateReferralPartnerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReferralPartnerUpdateInput) => {
      const res = await referralPartnerService.updateReferralPartner(input);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referralPartners.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.referralPartners.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.referralPartners.statistics(variables.id) });
      queryClient.invalidateQueries({ queryKey: LEGACY_REFERRAL_PARTNER_KEY });
      // Tên/loại đối tác được render trong cơ hội, khách hàng và hợp đồng liên quan.
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}

export function useDeleteReferralPartnerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await referralPartnerService.deleteReferralPartner(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.referralPartners.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.referralPartners.all });
      queryClient.invalidateQueries({ queryKey: LEGACY_REFERRAL_PARTNER_KEY });
    },
  });
}
