import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
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
import {
  PaymentRequestFilterModal,
  FilterValues,
} from '@/components/payment-requests/PaymentRequestFilterModal';
import { PaymentRequest } from '@/services/paymentRequestService';
import { formatVND } from '@/utils/formatters';

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'PAID', label: 'Đã chi' },
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
  });

  // Query filters derived from search, tab & modal filters
  const queryFilters = useMemo(() => {
    const filters: Record<string, any> = { limit: 20 };
    if (search.trim()) filters.search = search.trim();
    if (filterValues.type !== 'ALL') filters.type = filterValues.type;

    if (activeTab === 'PENDING') {
      filters.approvalStatus = 'PENDING_REVIEWER';
    } else if (activeTab === 'APPROVED') {
      filters.approvalStatus = 'APPROVED';
    } else if (activeTab === 'PAID') {
      filters.paymentStatus = 'PAID';
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
  const { data: totalDebt } = usePaymentRequestsTotalDebtQuery();

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
    filterValues.paymentStatus !== 'ALL';

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

      {/* Summary KPI Cards */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
          gap: 8,
        }}
      >
        {/* Chờ duyệt */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#FEF3C7',
            padding: 8,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#D97706',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400E' }}>Chờ duyệt</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#B45309', marginTop: 2 }}>
            {formatVND(totalDebt?.totalPendingAmount || 0)}
          </Text>
        </View>

        {/* Đã duyệt */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#DCFCE7',
            padding: 8,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#16A34A',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#166534' }}>Đã duyệt</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#15803D', marginTop: 2 }}>
            {formatVND(totalDebt?.totalApprovedAmount || 0)}
          </Text>
        </View>

        {/* Đã chi */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFF7ED',
            padding: 8,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#F38820',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#9A3412' }}>Đã thanh toán</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#EA580C', marginTop: 2 }}>
            {formatVND(totalDebt?.totalPaidAmount || 0)}
          </Text>
        </View>
      </View>

      {/* Status Filter Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          gap: 6,
        }}
      >
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
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
      </View>

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
