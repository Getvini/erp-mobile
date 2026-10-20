import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useInfinitePaymentRequestsQuery,
  usePaymentRequestsTotalDebtQuery,
} from '@/hooks/queries/usePaymentRequests';
import { PaymentRequestCard } from '@/components/payment-requests/PaymentRequestCard';
import { PaymentRequestMiniChart } from '@/components/payment-requests/PaymentRequestMiniChart';
import {
  PaymentRequestFilterModal,
  FilterValues,
} from '@/components/payment-requests/PaymentRequestFilterModal';
import { PaymentRequest } from '@/services/paymentRequestService';
import { formatVND } from '@/utils/formatters';

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING_REVIEWER', label: 'Chờ Admin Sale' },
  { key: 'PENDING_BOD', label: 'Chờ BOD' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'PAID', label: 'Đã chi' },
  { key: 'REJECTED', label: 'Từ chối' },
];

export default function PaymentRequestsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>({
    type: 'ALL',
    approvalStatus: 'ALL',
    paymentStatus: 'ALL',
    dateField: 'dueDate',
    fromDate: '',
    toDate: '',
    minAmount: '',
    maxAmount: '',
    projectId: '',
    settlementStatus: 'ALL',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  // Query filters derived from search, tab & modal filters
  const queryFilters = useMemo(() => {
    const filters: Record<string, any> = { limit: 20 };
    if (search.trim()) filters.search = search.trim();
    if (filterValues.type !== 'ALL') filters.type = filterValues.type;
    if (filterValues.settlementStatus && filterValues.settlementStatus !== 'ALL') {
      filters.settlementStatus = filterValues.settlementStatus;
    }
    if (filterValues.dateField) filters.dateField = filterValues.dateField;
    if (filterValues.fromDate) filters.fromDate = filterValues.fromDate;
    if (filterValues.toDate) filters.toDate = filterValues.toDate;
    if (filterValues.minAmount) filters.minAmount = filterValues.minAmount;
    if (filterValues.maxAmount) filters.maxAmount = filterValues.maxAmount;
    if (filterValues.projectId) filters.projectId = filterValues.projectId;
    filters.sortBy = filterValues.sortBy;
    filters.sortOrder = filterValues.sortOrder;

    if (activeTab === 'PAID') {
      filters.paymentStatus = 'PAID';
    } else if (activeTab !== 'ALL') {
      filters.approvalStatus = activeTab;
    } else {
      if (filterValues.approvalStatus !== 'ALL') filters.approvalStatus = filterValues.approvalStatus;
      if (filterValues.paymentStatus !== 'ALL') filters.paymentStatus = filterValues.paymentStatus;
    }

    return filters;
  }, [search, activeTab, filterValues]);

  // Infinite query for mobile list
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
    error,
  } = useInfinitePaymentRequestsQuery(queryFilters);

  // Total debt summary query
  const debtFilters = useMemo(() => {
    const { limit, ...rest } = queryFilters;
    return rest;
  }, [queryFilters]);
  const { data: totalDebt } = usePaymentRequestsTotalDebtQuery(debtFilters);

  // Flatten infinite pages into single item list
  const flatItems: PaymentRequest[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data || []);
  }, [data]);

  const handleTabChange = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(key);
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: PaymentRequest }) => <PaymentRequestCard item={item} />,
    []
  );

  const keyExtractor = useCallback((item: PaymentRequest) => item.id, []);

  const hasActiveFilters =
    filterValues.type !== 'ALL' ||
    filterValues.approvalStatus !== 'ALL' ||
    filterValues.paymentStatus !== 'ALL' ||
    (Boolean(filterValues.settlementStatus) && filterValues.settlementStatus !== 'ALL') ||
    Boolean(filterValues.projectId || filterValues.fromDate || filterValues.toDate || filterValues.minAmount || filterValues.maxAmount);

  const handleSelectDebtType = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFilterValues((prev) => ({
      ...prev,
      type: prev.type === type ? 'ALL' : type,
    }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="arrow-left" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
              Đề Xuất Thanh Toán
            </Text>
          </View>

          {/* Filter Modal Trigger */}
          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: hasActiveFilters ? '#FFF7ED' : '#F1F5F9',
              borderWidth: 1,
              borderColor: hasActiveFilters ? '#F38820' : '#E2E8F0',
            }}
          >
            <Feather
              name="filter"
              size={15}
              color={hasActiveFilters ? '#F38820' : '#475569'}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: hasActiveFilters ? '#F38820' : '#475569',
              }}
            >
              Lọc {hasActiveFilters ? '•' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F1F5F9',
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 40,
          }}
        >
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tiêu đề, mã phiếu, người tạo..."
            placeholderTextColor="#94A3B8"
            style={{
              flex: 1,
              fontSize: 13,
              color: '#0F172A',
              marginLeft: 8,
            }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 4 Thẻ KPI Chỉ Số Tổng Nợ (Tương Tác & Lọc Nhanh) */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        >
          {/* 1. Tổng nợ (Tất cả) */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelectDebtType('ALL')}
            style={{
              width: 130,
              backgroundColor: '#FEF3C7',
              padding: 10,
              borderRadius: 10,
              borderWidth: filterValues.type === 'ALL' ? 2 : 1,
              borderColor: filterValues.type === 'ALL' ? '#F38820' : '#FDE68A',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E' }}>Tổng nợ (Tất cả)</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#B45309', marginTop: 3 }}>
              {formatVND(totalDebt?.totalDebt || 0)}
            </Text>
            <Text style={{ fontSize: 9, color: '#A16207', marginTop: 2 }}>Đã duyệt, chưa chi</Text>
          </TouchableOpacity>

          {/* 2. Nợ theo dự án */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelectDebtType('PROJECT')}
            style={{
              width: 130,
              backgroundColor: '#EFF6FF',
              padding: 10,
              borderRadius: 10,
              borderWidth: filterValues.type === 'PROJECT' ? 2 : 1,
              borderColor: filterValues.type === 'PROJECT' ? '#2563EB' : '#BFDBFE',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E40AF' }}>Nợ theo dự án</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#1D4ED8', marginTop: 3 }}>
              {formatVND(totalDebt?.projectDebt || 0)}
            </Text>
            <Text style={{ fontSize: 9, color: '#3B82F6', marginTop: 2 }}>Thuộc loại dự án</Text>
          </TouchableOpacity>

          {/* 3. Nợ việc khác */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelectDebtType('OTHER_WORK')}
            style={{
              width: 130,
              backgroundColor: '#ECFDF5',
              padding: 10,
              borderRadius: 10,
              borderWidth: filterValues.type === 'OTHER_WORK' ? 2 : 1,
              borderColor: filterValues.type === 'OTHER_WORK' ? '#10B981' : '#A7F3D0',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#065F46' }}>Nợ việc khác</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#047857', marginTop: 3 }}>
              {formatVND(totalDebt?.otherWorkDebt || 0)}
            </Text>
            <Text style={{ fontSize: 9, color: '#059669', marginTop: 2 }}>Công việc độc lập</Text>
          </TouchableOpacity>

          {/* 4. Nợ tạm ứng (ADVANCE) */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelectDebtType('ADVANCE')}
            style={{
              width: 130,
              backgroundColor: '#FAF5FF',
              padding: 10,
              borderRadius: 10,
              borderWidth: filterValues.type === 'ADVANCE' ? 2 : 1,
              borderColor: filterValues.type === 'ADVANCE' ? '#9333EA' : '#E9D5FF',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6B21A8' }}>Nợ tạm ứng</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#7E22CE', marginTop: 3 }}>
              {formatVND(totalDebt?.advanceDebt || 0)}
            </Text>
            <Text style={{ fontSize: 9, color: '#A855F7', marginTop: 2 }}>Chờ hoàn ứng / chi</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Status Filter Tabs */}
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => handleTabChange(tab.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  backgroundColor: active ? '#F38820' : '#F1F5F9',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? '700' : '500',
                    color: active ? '#FFFFFF' : '#475569',
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Filter Chips Bar (nếu có lọc tùy biến) */}
      {hasActiveFilters && (
        <View style={{ backgroundColor: '#FFFBEB', paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>Đang lọc:</Text>
            
            {filterValues.type !== 'ALL' && (
              <TouchableOpacity
                onPress={() => setFilterValues((prev) => ({ ...prev, type: 'ALL' }))}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', gap: 4 }}
              >
                <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' }}>
                  {filterValues.type === 'ADVANCE' ? 'Tạm ứng' : filterValues.type === 'PROJECT' ? 'Dự án' : 'Việc khác'}
                </Text>
                <Feather name="x" size={12} color="#92400E" />
              </TouchableOpacity>
            )}

            {filterValues.settlementStatus && filterValues.settlementStatus !== 'ALL' && (
              <TouchableOpacity
                onPress={() => setFilterValues((prev) => ({ ...prev, settlementStatus: 'ALL' }))}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#E9D5FF', gap: 4 }}
              >
                <Text style={{ fontSize: 11, color: '#6B21A8', fontWeight: '600' }}>
                  {filterValues.settlementStatus === 'WAITING_SETTLEMENT' ? 'Chờ hoàn ứng' :
                   filterValues.settlementStatus === 'SETTLEMENT_SUBMITTED' ? 'Đã nộp quyết toán' :
                   filterValues.settlementStatus === 'SETTLED' ? 'Đã quyết toán xong' : 'Quá hạn hoàn ứng'}
                </Text>
                <Feather name="x" size={12} color="#6B21A8" />
              </TouchableOpacity>
            )}

            {filterValues.paymentStatus !== 'ALL' && activeTab === 'ALL' && (
              <TouchableOpacity
                onPress={() => setFilterValues((prev) => ({ ...prev, paymentStatus: 'ALL' }))}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD', gap: 4 }}
              >
                <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '600' }}>
                  {filterValues.paymentStatus === 'PAID' ? 'Đã chi đủ' : filterValues.paymentStatus === 'PARTIALLY_PAID' ? 'Chi 1 phần' : 'Chưa chi'}
                </Text>
                <Feather name="x" size={12} color="#0369A1" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setFilterValues({
                type: 'ALL',
                approvalStatus: 'ALL',
                paymentStatus: 'ALL',
                dateField: 'dueDate',
                fromDate: '',
                toDate: '',
                minAmount: '',
                maxAmount: '',
                projectId: '',
                settlementStatus: 'ALL',
                sortBy: 'createdAt',
                sortOrder: 'DESC',
              })}
              style={{ paddingHorizontal: 6, paddingVertical: 2 }}
            >
              <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>Xoá tất cả</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Main List Body */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#F38820" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#64748B' }}>
            Đang tải đề xuất thanh toán...
          </Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Feather name="alert-circle" size={44} color="#EF4444" />
          <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
            Không thể tải dữ liệu
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
            {(error as any)?.message || 'Vui lòng kiểm tra lại kết nối mạng.'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: '#F38820',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : flatItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <MaterialCommunityIcons name="file-document-outline" size={54} color="#CBD5E1" />
          <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#334155' }}>
            Không có đề xuất thanh toán nào
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
            {hasActiveFilters || search
              ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
              : 'Hãy bắt đầu bằng việc tạo một đề xuất thanh toán mới.'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/payment-requests/create' as any)}
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: '#F38820',
            }}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
              Tạo đề xuất mới
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={flatItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            flatItems.length > 0 ? (
              <PaymentRequestMiniChart
                requests={flatItems}
                totalDebt={totalDebt?.totalDebt}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#F38820"
              colors={['#F38820']}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#F38820" />
              </View>
            ) : null
          }
        />
      )}

      {/* Floating Action Button (FAB) in Thumb Zone */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom, 16),
          right: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/payment-requests/create' as any);
          }}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 20,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#F38820',
            shadowColor: '#F38820',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Tạo đề xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <PaymentRequestFilterModal
        visible={showFilterModal}
        initialFilters={filterValues}
        onApply={(applied) => setFilterValues(applied)}
        onClose={() => setShowFilterModal(false)}
      />
    </View>
  );
}
