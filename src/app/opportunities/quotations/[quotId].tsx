import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  useQuotationDetailQuery,
  useOpportunityQuotationsQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
} from '@/hooks/queries/useQuotations';
import {
  QuotationStatus,
  QuotationItem,
} from '@/services/quotationService';
import { formatVND, formatNumber } from '@/utils/formatters';
import { useSSERefresh } from '@/hooks/useSSERefresh';

export default function QuotationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ quotId: string; opportunityId?: string }>();
  const quotId = params.quotId || '';
  const opportunityId = params.opportunityId;

  const { user } = useAuth();
  const isAdminOrBod = user?.role === 'ADMIN' || user?.role === 'BOD';

  // TanStack Query for quotation detail
  const { data: quotation, isLoading, isFetching, refetch } = useQuotationDetailQuery(quotId);

  // Derived opportunityId
  const oppId = opportunityId || quotation?.opportunityId || (quotation?.opportunity as any)?.id || '';

  // TanStack Query for sibling quotations
  const { data: oppQuotesRes } = useOpportunityQuotationsQuery(oppId);

  // Mutations
  const approveMutation = useApproveQuotationMutation();
  const rejectMutation = useRejectQuotationMutation();

  // Accordion state for packages
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Expand packages by default when quotation detail loads
  useEffect(() => {
    if (quotation?.details) {
      const initialExpanded: Record<string, boolean> = {};
      quotation.details.forEach((d: any) => {
        if (d.packageName && d.packageName !== 'STANDALONE') {
          initialExpanded[d.packageName] = true;
        }
      });
      setExpandedPackages((prev) => ({ ...initialExpanded, ...prev }));
    }
  }, [quotation]);

  // Derived expired / sibling approved state
  const { hasApprovedSibling, approvedQuotationVersion } = useMemo(() => {
    const quotesList: QuotationItem[] = Array.isArray(oppQuotesRes)
      ? oppQuotesRes
      : (oppQuotesRes as any)?.data || [];
    const approvedQ = quotesList.find(
      (q) =>
        (q.status === QuotationStatus.APPROVED || q.status === 'APPROVED') &&
        q.id !== quotId
    );
    if (approvedQ) {
      return { hasApprovedSibling: true, approvedQuotationVersion: approvedQ.version };
    }
    return { hasApprovedSibling: false, approvedQuotationVersion: null };
  }, [oppQuotesRes, quotId]);

  useSSERefresh('invalidate_Quotations', refetch);

  const handleRefresh = () => {
    refetch();
  };

  const togglePackage = (pkgName: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgName]: !prev[pkgName],
    }));
  };

  // Grouping logic matching Web's QuotationDetailModal.jsx
  const { aggregatedItems, totals } = useMemo(() => {
    if (!quotation?.details || quotation.details.length === 0) {
      return {
        aggregatedItems: { packages: [], standalone: [] },
        totals: { revenue: 0, cost: 0, vat: 0, totalWithVat: 0, margin: 0 },
      };
    }

    const packages: Record<string, any> = {};
    const standalone: any[] = [];
    let runningRevenue = 0;
    let runningCost = 0;

    quotation.details.forEach((detail: any) => {
      const sellingPrice = parseFloat(String(detail.sellingPrice || 0));
      const costAtSale = parseFloat(String(detail.costAtSale || 0));
      const quantity = detail.quantity || 0;
      const itemRevenue = sellingPrice * quantity;
      const itemCost = costAtSale * quantity;
      const itemVat = itemRevenue * 0.08;

      runningRevenue += itemRevenue;
      runningCost += itemCost;

      const groupKey = detail.packageName || 'STANDALONE';

      if (groupKey === 'STANDALONE') {
        standalone.push({
          ...detail,
          revenue: itemRevenue,
          cost: itemCost,
          vat: itemVat,
          totalWithVat: itemRevenue + itemVat,
          profitMargin:
            itemRevenue > 0 ? ((itemRevenue - itemCost) / itemRevenue) * 100 : 0,
        });
        return;
      }

      if (!packages[groupKey]) {
        const pkgQty = detail.packageQuantity || 1;
        packages[groupKey] = {
          name: groupKey,
          quantity: pkgQty,
          sellingPrice: 0,
          costAtSale: 0,
          revenue: 0,
          cost: 0,
          vat: 0,
          totalWithVat: 0,
          items: [],
        };
      }

      const norm = detail.packageQuantity ? quantity / detail.packageQuantity : quantity;

      packages[groupKey].sellingPrice += sellingPrice * norm;
      packages[groupKey].costAtSale += costAtSale * norm;
      packages[groupKey].revenue += itemRevenue;
      packages[groupKey].cost += itemCost;
      packages[groupKey].vat += itemVat;
      packages[groupKey].totalWithVat += itemRevenue + itemVat;
      packages[groupKey].items.push({
        ...detail,
        norm,
        revenue: itemRevenue,
        cost: itemCost,
      });
    });

    const vat = runningRevenue * 0.08;
    const totalWithVat = runningRevenue + vat;
    const margin =
      runningRevenue > 0 ? ((runningRevenue - runningCost) / runningRevenue) * 100 : 0;

    return {
      aggregatedItems: {
        packages: Object.values(packages),
        standalone,
      },
      totals: {
        revenue: runningRevenue,
        cost: runningCost,
        vat,
        totalWithVat,
        margin,
      },
    };
  }, [quotation]);

  const formatMoney = (val?: number) => formatVND(val);

  const isThisApproved =
    quotation?.status === QuotationStatus.APPROVED || quotation?.status === 'APPROVED';

  const isExpired =
    !isThisApproved &&
    (hasApprovedSibling ||
      (quotation?.opportunity as any)?.status === 'QUOTE_APPROVED' ||
      (quotation?.opportunity as any)?.status === 'WON');

  const getStatusMeta = (status?: string) => {
    if (isExpired) {
      return { label: 'Hết hiệu lực', color: '#64748B', bg: '#F1F5F9' };
    }
    switch (status) {
      case QuotationStatus.DRAFT:
        return { label: 'Đang đợi duyệt', color: '#475569', bg: '#F1F5F9' };
      case QuotationStatus.PENDING_APPROVAL:
        return { label: 'Chờ BOD duyệt', color: '#D97706', bg: '#FEF3C7' };
      case QuotationStatus.APPROVED:
        return { label: 'Đã duyệt', color: '#059669', bg: '#D1FAE5' };
      case QuotationStatus.REJECTED:
        return { label: 'Từ chối', color: '#DC2626', bg: '#FEE2E2' };
      case 'SENT':
        return { label: 'Đã gửi', color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { label: status || '', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  const statusMeta = getStatusMeta(quotation?.status);
  const isPending =
    !isExpired &&
    (quotation?.status === QuotationStatus.DRAFT ||
      quotation?.status === QuotationStatus.PENDING_APPROVAL ||
      quotation?.status === 'DRAFT' ||
      quotation?.status === 'PENDING_APPROVAL');
  const isRejected =
    quotation?.status === QuotationStatus.REJECTED || quotation?.status === 'REJECTED';

  // Can edit ONLY if quotation is REJECTED and NOT expired, matching web behavior
  const canEdit =
    !isExpired &&
    isRejected &&
    (isAdminOrBod ||
      (quotation?.createdBy as any)?.id === user?.id ||
      (quotation?.opportunity as any)?.createdBy?.id === user?.id);

  const handleEdit = () => {
    router.push({
      pathname: '/opportunities/quotations/create',
      params: {
        opportunityId: oppId,
        quotationId: quotId,
      },
    });
  };

  const handleApprove = async () => {
    Alert.alert('Xác nhận duyệt', 'Bạn có chắc chắn muốn duyệt báo giá này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Duyệt',
        style: 'default',
        onPress: async () => {
          try {
            await approveMutation.mutateAsync(quotId);
            Alert.alert('Thành công', 'Đã duyệt báo giá và cập nhật cơ hội kinh doanh');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi duyệt báo giá');
          }
        },
      },
    ]);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: quotId, reason: rejectReason.trim() });
      setRejectModalVisible(false);
      Alert.alert('Thành công', 'Đã từ chối báo giá');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi từ chối báo giá');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity className="rounded-lg bg-slate-100 p-1.5" onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-slate-900">Chi tiết báo giá</Text>
          <View style={{ width: 40 }} />
        </View>
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-sm text-slate-500">Đang tải chi tiết báo giá...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="rounded-lg bg-slate-100 p-1.5"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View className="mx-3 flex-1">
          <Text className="text-base font-bold text-slate-900">
            Báo giá lần {quotation?.version || 1}
          </Text>
          <Text className="mt-px text-xs text-slate-500" numberOfLines={1}>
            {quotation?.opportunity?.name || 'Chi tiết báo giá'}
          </Text>
        </View>

        {canEdit ? (
          <TouchableOpacity
            className="flex-row items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5"
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <Feather name="edit-2" size={16} color="#059669" />
            <Text className="text-[13px] font-bold text-emerald-600">Sửa</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            colors={['#059669']}
          />
        }
      >
        {/* Status and Overview Card */}
        <View className="mb-3.5 rounded-[14px] border border-slate-200 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="rounded-md px-2.5 py-1" style={{ backgroundColor: statusMeta.bg }}>
              <Text className="text-xs font-bold" style={{ color: statusMeta.color }}>
                {statusMeta.label}
              </Text>
            </View>
            <Text className="text-xs text-slate-400">
              {quotation?.createdAt
                ? new Date(quotation.createdAt).toLocaleDateString('vi-VN')
                : ''}
            </Text>
          </View>

          {/* Expired Alert if another quotation is already APPROVED */}
          {isExpired && (
            <View className="mb-2 mt-2.5 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="info" size={16} color="#475569" />
                <Text className="text-[13px] font-bold text-slate-700">Báo giá đã hết hiệu lực</Text>
              </View>
              <Text className="text-xs leading-[18px] text-slate-500">
                Cơ hội kinh doanh này đã có bản báo giá{approvedQuotationVersion ? ` (Lần ${approvedQuotationVersion})` : ''} được phê duyệt. Bản báo giá này đã hết hiệu lực và đã khóa mọi thao tác sửa, phê duyệt hoặc từ chối.
              </Text>
            </View>
          )}

          {/* Rejection Reason Alert if REJECTED and NOT expired */}
          {!isExpired && isRejected && !!quotation?.description && (
            <View className="mb-3 rounded-[10px] border border-red-200 bg-red-50 p-3">
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <Text className="text-[13px] font-bold text-red-600">Lý do từ chối:</Text>
              </View>
              <Text className="text-[13px] leading-[18px] text-red-700">{quotation.description}</Text>
            </View>
          )}

          {/* Creator & Notes */}
          <View className="mb-2.5 flex-row flex-wrap gap-4">
            <View className="flex-row items-center gap-1.5">
              <Feather name="user" size={14} color="#64748B" />
              <Text className="text-xs text-slate-500">
                Tạo bởi: {quotation?.createdBy?.fullName || quotation?.createdBy?.username || 'Chưa rõ'}
              </Text>
            </View>
            {quotation?.validUntil && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="calendar" size={14} color="#64748B" />
                <Text className="text-xs text-slate-500">
                  Hạn: {new Date(quotation.validUntil).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            )}
          </View>

          {quotation?.note ? (
            <View className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <Text className="mb-0.5 text-[11px] font-bold text-slate-600">Ghi chú:</Text>
              <Text className="text-[13px] leading-[18px] text-slate-700">{quotation.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Financial Summary Card */}
        <View className="mb-3.5 rounded-[14px] border border-slate-200 bg-white p-4">
          <View className="mb-3.5 flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <Feather name="dollar-sign" size={16} color="#059669" />
            </View>
            <Text className="text-[15px] font-bold text-slate-900">Tổng hợp tài chính</Text>
          </View>

          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-slate-500">Doanh thu trước VAT:</Text>
              <Text className="text-sm font-bold text-slate-900">{formatMoney(totals.revenue)}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-slate-500">Chi phí giá vốn:</Text>
              <Text className="text-[13px] font-semibold text-slate-600">{formatMoney(totals.cost)}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-slate-500">Thuế VAT (8%):</Text>
              <Text className="text-[13px] font-semibold text-slate-600">{formatMoney(totals.vat)}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-slate-500">Biên lợi nhuận gộp:</Text>
              <View
                className={`rounded-md px-2 py-0.5 ${totals.margin >= 20 ? 'bg-green-100' : 'bg-amber-100'}`}
              >
                <Text
                  className={`text-xs font-bold ${totals.margin >= 20 ? 'text-green-700' : 'text-amber-700'}`}
                >
                  {totals.margin.toFixed(0)}%
                </Text>
              </View>
            </View>

            <View className="my-1 h-px bg-slate-200" />

            <View className="flex-row items-baseline justify-between pt-1">
              <Text className="text-sm font-bold text-slate-900">Tổng thanh toán (có VAT):</Text>
              <Text className="text-lg font-extrabold text-emerald-600">{formatMoney(totals.totalWithVat)}</Text>
            </View>
          </View>
        </View>

        {/* Package Services Section */}
        {aggregatedItems.packages.length > 0 && (
          <View className="mb-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <Feather name="package" size={16} color="#2563EB" />
              <Text className="text-sm font-bold text-slate-800">
                Gói dịch vụ ({aggregatedItems.packages.length})
              </Text>
            </View>

            {aggregatedItems.packages.map((pkg: any, idx: number) => {
              const isExpanded = !!expandedPackages[pkg.name];
              const pkgMargin =
                pkg.revenue > 0 ? ((pkg.revenue - pkg.cost) / pkg.revenue) * 100 : 0;

              return (
                <View key={pkg.name || idx} className="mb-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
                  <TouchableOpacity
                    className="flex-row items-center justify-between"
                    activeOpacity={0.7}
                    onPress={() => togglePackage(pkg.name)}
                  >
                    <View className="mr-2 flex-1">
                      <Text className="mb-0.5 text-[15px] font-bold text-slate-900">{pkg.name}</Text>
                      <Text className="text-xs text-slate-500">
                        Số lượng: <Text className="font-bold">x{formatNumber(pkg.quantity)}</Text>
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-[15px] font-extrabold text-blue-600">{formatMoney(pkg.revenue)}</Text>
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#64748B"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Package Financial Bar */}
                  <View className="mt-2 flex-row justify-between border-t border-slate-100 pt-2">
                    <Text className="text-xs text-slate-500">
                      Đơn giá gói: <Text className="font-bold text-slate-800">{formatMoney(pkg.sellingPrice)}</Text>
                    </Text>
                    <Text className="text-xs text-slate-500">
                      Biên LN: <Text className="font-bold" style={{ color: pkgMargin >= 20 ? '#059669' : '#D97706' }}>
                        {pkgMargin.toFixed(0)}%
                      </Text>
                    </Text>
                  </View>

                  {/* Expanded Items */}
                  {isExpanded && (
                    <View className="mt-2.5 rounded-lg border-t border-slate-200 bg-slate-50 p-2.5 pt-2.5">
                      <Text className="mb-2 text-[11px] font-bold uppercase text-slate-500">Chi tiết dịch vụ con:</Text>
                      {pkg.items.map((item: any, itemIdx: number) => (
                        <View key={item.id || itemIdx} className="flex-row items-center justify-between border-b border-slate-100 py-1.5">
                          <View className="flex-1">
                            <Text className="text-[13px] font-semibold text-slate-800">
                              {item.name || item.service?.name || 'Dịch vụ'}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-slate-500">
                              Định mức: {formatNumber(item.norm)} {item.service?.unit || item.unit || 'lần'} / gói | Đơn giá: {formatMoney(item.sellingPrice)}
                            </Text>
                            {Boolean(item.service?.description || item.description) && (
                              <Text className="mt-1 text-[11px] italic text-slate-500 leading-4">
                                {item.service?.description || item.description}
                              </Text>
                            )}
                          </View>
                          <Text className="ml-2 text-[13px] font-bold text-slate-700">
                            {formatMoney(item.revenue)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Standalone Services Section */}
        {aggregatedItems.standalone.length > 0 && (
          <View className="mb-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <Feather name="layers" size={16} color="#059669" />
              <Text className="text-sm font-bold text-slate-800">
                Dịch vụ lẻ ({aggregatedItems.standalone.length})
              </Text>
            </View>

            {aggregatedItems.standalone.map((item: any, idx: number) => (
              <View key={item.id || idx} className="mb-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
                <View className="mb-1.5 flex-row items-baseline justify-between">
                  <Text className="mr-2 flex-1 text-sm font-bold text-slate-900">
                    {item.name || item.service?.name || 'Dịch vụ lẻ'}
                  </Text>
                  <Text className="text-[15px] font-extrabold text-emerald-600">{formatMoney(item.revenue)}</Text>
                </View>

                {Boolean(item.service?.description || item.description) && (
                  <Text className="mb-2 text-[11px] italic text-slate-500 leading-4">
                    {item.service?.description || item.description}
                  </Text>
                )}

                <View className="flex-row items-center justify-between border-t border-slate-100 pt-1.5">
                  <Text className="text-xs text-slate-500">
                    Số lượng: <Text className="font-bold text-slate-800">{formatNumber(item.quantity)} {item.service?.unit || item.unit || 'gói'}</Text>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Đơn giá: <Text className="font-bold text-slate-800">{formatMoney(item.sellingPrice)}</Text>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Biên LN: <Text className="font-bold" style={{ color: (item.profitMargin || 0) >= 20 ? '#059669' : '#D97706' }}>
                      {(item.profitMargin || 0).toFixed(0)}%
                    </Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Brief / Mô tả cơ hội kinh doanh */}
        <View className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5">
          <View className="mb-2 flex-row items-center gap-2">
            <Feather name="briefcase" size={15} color="#2563EB" />
            <Text className="text-sm font-bold text-slate-900">Brief</Text>
          </View>
          <Text className="text-[11px] text-slate-400 italic mb-1">Mô tả</Text>
          <Text className="text-xs text-slate-600 leading-relaxed">
            {quotation?.opportunity?.description || 'Không có mô tả'}
          </Text>
        </View>

        <View className="h-[60px]" />
      </ScrollView>

      {/* Sticky Bottom Actions Bar for BOD / Admin Approval */}
      {!isExpired && isAdminOrBod && isPending && (
        <View className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-red-200 bg-red-100 py-3"
            onPress={() => {
              setRejectReason('');
              setRejectModalVisible(true);
            }}
            disabled={rejectMutation.isPending || approveMutation.isPending}
            activeOpacity={0.8}
          >
            <Feather name="x" size={18} color="#DC2626" />
            <Text className="text-sm font-bold text-red-600">Từ chối</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-[2] flex-row items-center justify-center gap-1.5 rounded-[10px] bg-emerald-600 py-3 ${
              approveMutation.isPending ? 'opacity-60' : ''
            }`}
            onPress={handleApprove}
            disabled={rejectMutation.isPending || approveMutation.isPending}
            activeOpacity={0.85}
          >
            {approveMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white">Duyệt báo giá</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Sticky Bottom Actions Bar for REJECTED -> Sửa báo giá */}
      {!isExpired && canEdit && (
        <View className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-[13px] shadow-md"
            onPress={handleEdit}
            activeOpacity={0.85}
          >
            <Feather name="edit-2" size={18} color="#FFFFFF" />
            <Text className="text-[15px] font-bold text-white">Sửa báo giá</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-5">
          <View className="w-full rounded-2xl bg-white p-5 shadow-xl">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-base font-bold text-slate-900">Từ chối báo giá</Text>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-[13px] font-semibold text-slate-700">Lý do từ chối (bắt buộc):</Text>
            <TextInput
              className="mb-5 min-h-[100px] rounded-[10px] border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
              placeholder="Nhập lý do cần chỉnh sửa / từ chối..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View className="flex-row justify-end gap-2.5">
              <TouchableOpacity
                className="rounded-lg bg-slate-100 px-4 py-2.5"
                onPress={() => setRejectModalVisible(false)}
                disabled={rejectMutation.isPending}
              >
                <Text className="text-sm font-semibold text-slate-500">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`rounded-lg bg-red-600 px-4 py-2.5 ${rejectMutation.isPending ? 'opacity-60' : ''}`}
                onPress={handleConfirmReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
