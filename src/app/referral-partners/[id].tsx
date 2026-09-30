import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useDeleteReferralPartnerMutation,
  useReferralPartnerDetailQuery,
  useReferralPartnerStatisticsQuery,
} from '@/hooks/queries/useReferralPartners';
import {
  ReferralPartnerContract,
  ReferralPartnerCustomer,
  ReferralPartnerItem,
  ReferralPartnerOpportunity,
} from '@/services/referralPartnerService';
import PartnerCommissionTab from '@/components/referral-partners/PartnerCommissionTab';
import PartnerFormModal from '@/components/referral-partners/PartnerFormModal';
import { ContactActionGroup } from '@/components/common/ContactActionGroup';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessReferralPartners, canManageReferralPartners } from '@/utils/rbac';
import { getPartnerTypeLabel } from '@/utils/partnerCommission';
import { formatDateToDDMMYYYY, formatNumber, formatVND } from '@/utils/formatters';
import { safeGoBack } from '@/utils/navigation';

type PartnerTab = 'opportunities' | 'contracts' | 'customers' | 'commission';

type PartnerRow =
  | { type: 'commission'; id: 'commission' }
  | { type: 'opportunity'; id: string; value: ReferralPartnerOpportunity }
  | { type: 'contract'; id: string; value: ReferralPartnerContract }
  | { type: 'customer'; id: string; value: ReferralPartnerCustomer };

const TABS: { key: PartnerTab; label: string }[] = [
  { key: 'opportunities', label: 'Cơ hội' },
  { key: 'contracts', label: 'Hợp đồng' },
  { key: 'customers', label: 'Khách hàng' },
  { key: 'commission', label: 'Hoa hồng' },
];

const money = (value?: number | string | null) => formatVND(value ?? 0, 'VNĐ');

const EMPTY_STATE: Record<
  Exclude<PartnerTab, 'commission'>,
  { icon: React.ComponentProps<typeof Feather>['name']; title: string }
> = {
  opportunities: { icon: 'briefcase', title: 'Chưa có cơ hội kinh doanh' },
  contracts: { icon: 'file-text', title: 'Chưa có hợp đồng' },
  customers: { icon: 'users', title: 'Chưa có khách hàng' },
};

interface PartnerRowCardProps {
  testID: string;
  title: string;
  subtitleLines: string[];
  amount?: number | string | null;
  accessibilityLabel: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  iconColor?: string;
  iconWrapperClass?: string;
  avatarText?: string;
}

/** Card dọc dùng chung cho 3 tab dữ liệu (cơ hội / hợp đồng / khách hàng). */
function PartnerRowCard({
  testID,
  title,
  subtitleLines,
  amount,
  accessibilityLabel,
  onPress,
  icon,
  iconColor,
  iconWrapperClass,
  avatarText,
}: PartnerRowCardProps) {
  return (
    <TouchableOpacity
      testID={testID}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl border ${iconWrapperClass || ''}`}
        >
          {avatarText ? (
            <Text className="text-base font-extrabold" style={{ color: iconColor }}>
              {avatarText}
            </Text>
          ) : (
            <Feather name={icon || 'file-text'} size={20} color={iconColor} />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-sm font-extrabold text-slate-900" numberOfLines={2}>
            {title}
          </Text>
          {subtitleLines
            .filter((line) => Boolean(line))
            .map((line, index) => (
              <Text
                key={line + index}
                className={`text-[11px] font-semibold text-slate-400 ${index === 0 ? 'mt-1' : 'mt-0.5'}`}
                numberOfLines={1}
              >
                {line}
              </Text>
            ))}
          {amount !== undefined ? (
            <Text className="mt-2 text-sm font-extrabold text-orange-600">{money(amount)}</Text>
          ) : null}
        </View>

        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

function LoadingSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
      <View className="h-14 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-36 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-20 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-40 rounded-2xl bg-slate-200" />
    </SafeAreaView>
  );
}

export default function ReferralPartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const partnerId = typeof id === 'string' ? id : '';

  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const hasAccess = canAccessReferralPartners(user?.role);
  const canManage = canManageReferralPartners(user?.role);

  const [activeTab, setActiveTab] = useState<PartnerTab>('opportunities');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const {
    data: partner,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useReferralPartnerDetailQuery(partnerId);

  const { data: statistics, isLoading: isStatisticsLoading } =
    useReferralPartnerStatisticsQuery(partnerId);

  const deleteMutation = useDeleteReferralPartnerMutation();

  const opportunities = useMemo(
    () => (Array.isArray(partner?.opportunities) ? partner!.opportunities!.filter(Boolean) : []),
    [partner],
  );
  const contracts = useMemo(
    () => (Array.isArray(partner?.contracts) ? partner!.contracts!.filter(Boolean) : []),
    [partner],
  );
  const customers = useMemo(
    () => (Array.isArray(partner?.customers) ? partner!.customers!.filter(Boolean) : []),
    [partner],
  );

  const rows = useMemo<PartnerRow[]>(() => {
    if (activeTab === 'commission') return [{ type: 'commission', id: 'commission' }];
    if (activeTab === 'opportunities') {
      return opportunities.map((value) => ({ type: 'opportunity', id: value.id, value }));
    }
    if (activeTab === 'contracts') {
      return contracts.map((value) => ({ type: 'contract', id: value.id, value }));
    }
    return customers.map((value) => ({ type: 'customer', id: value.id, value }));
  }, [activeTab, contracts, customers, opportunities]);

  const handleCall = useCallback((phone?: string | null) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Đối tác này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleEmail = useCallback((email?: string | null) => {
    if (!email) {
      Alert.alert('Thông báo', 'Đối tác này chưa cập nhật email liên hệ.');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!partner || !canManage || deleteMutation.isPending) return;

    Alert.alert(
      'Xóa đối tác',
      `Bạn có chắc muốn xóa “${partner.name}”? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa đối tác',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(partner.id);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa đối tác giới thiệu.', [
                { text: 'Đóng', onPress: () => router.replace('/referral-partners' as any) },
              ]);
            } catch (deleteError) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              // Backend trả 500 khi đối tác còn customers/opportunities/contracts.
              const detail =
                deleteError instanceof Error && deleteError.message
                  ? `\n(${deleteError.message})`
                  : '';
              Alert.alert(
                'Không thể xóa đối tác',
                `Không thể xóa: đối tác vẫn còn dữ liệu liên quan.${detail}`,
              );
            }
          },
        },
      ],
    );
  }, [canManage, deleteMutation, partner, router]);

  const renderInfoCard = useCallback(() => {
    if (!partner) return null;

    const isIndividual = partner.type === 'INDIVIDUAL';
    const fields = [
      { label: isIndividual ? 'CCCD' : 'Mã số thuế', value: partner.taxId || 'Chưa cập nhật' },
      { label: 'Email', value: partner.email || 'Chưa cập nhật' },
      { label: 'Số điện thoại', value: partner.phone || 'Chưa cập nhật' },
      { label: 'Địa chỉ', value: partner.address || 'Chưa cập nhật' },
    ];

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Feather name="info" size={15} color={BrandColors.primary} />
            <Text className="text-xs font-bold uppercase text-slate-500">Thông tin đối tác</Text>
          </View>

          {/* Ẩn hoàn toàn nếu không đủ quyền quản lý */}
          {canManage ? (
            <TouchableOpacity
              testID="editPartnerButton"
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl border border-orange-100 bg-orange-50 px-3"
              onPress={() => setIsEditOpen(true)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Sửa thông tin đối tác"
            >
              <Feather name="edit-3" size={14} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-orange-600">Sửa</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {fields.map((field, index) => (
          <View key={field.label} className={index > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
            <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
              {field.label}
            </Text>
            <Text className="text-sm font-bold leading-5 text-slate-800">{field.value}</Text>
          </View>
        ))}

        <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
          {partner.phone ? (
            <TouchableOpacity
              className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50"
              onPress={() => handleCall(partner.phone)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Gọi điện cho đối tác"
            >
              <Feather name="phone" size={15} color="#10B981" />
              <Text className="text-xs font-bold text-emerald-600">Gọi điện</Text>
            </TouchableOpacity>
          ) : null}

          {partner.email ? (
            <TouchableOpacity
              className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-50"
              onPress={() => handleEmail(partner.email)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Gửi email cho đối tác"
            >
              <Feather name="mail" size={15} color="#3B82F6" />
              <Text className="text-xs font-bold text-blue-600">Gửi mail</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, [canManage, handleCall, handleEmail, partner]);

  const renderStatCards = useCallback(() => {
    const cards = [
      {
        key: 'customers',
        label: 'Khách hàng',
        value: statistics?.totalCustomers,
        icon: 'users' as const,
        bg: '#EFF6FF',
        color: '#3B82F6',
      },
      {
        key: 'opportunities',
        label: 'Cơ hội',
        value: statistics?.totalOpportunities,
        icon: 'briefcase' as const,
        bg: '#FFF4EA',
        color: '#F38820',
      },
      {
        key: 'contracts',
        label: 'Hợp đồng',
        value: statistics?.totalContracts,
        icon: 'file-text' as const,
        bg: '#ECFDF5',
        color: '#10B981',
      },
    ];

    return (
      <View className="flex-row gap-2.5">
        {cards.map((card) => (
          <View
            key={card.key}
            testID={`partnerStat-${card.key}`}
            className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <View
              className="mb-2 h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: card.bg }}
            >
              <Feather name={card.icon} size={15} color={card.color} />
            </View>
            <Text className="text-[10px] font-semibold uppercase text-slate-400" numberOfLines={2}>
              {card.label}
            </Text>
            {isStatisticsLoading ? (
              <ActivityIndicator size="small" color={BrandColors.primary} className="mt-1" />
            ) : (
              <Text className="mt-1 text-lg font-extrabold text-slate-900">
                {card.value === undefined ? '—' : formatNumber(card.value)}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  }, [isStatisticsLoading, statistics]);

  const renderAdditionalInfo = useCallback(() => {
    if (!partner) return null;

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <View className="mb-3 flex-row items-center gap-2">
          <Feather name="clock" size={15} color="#64748B" />
          <Text className="text-xs font-bold uppercase text-slate-500">Thông tin thêm</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-slate-400">Ngày tạo</Text>
          <Text className="text-xs font-bold text-slate-700">
            {formatDateToDDMMYYYY(partner.createdAt, '—')}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-slate-400">Cập nhật gần nhất</Text>
          <Text className="text-xs font-bold text-slate-700">
            {formatDateToDDMMYYYY(partner.updatedAt, '—')}
          </Text>
        </View>
      </View>
    );
  }, [partner]);

  const renderRow = useCallback(
    ({ item }: { item: PartnerRow }) => {
      if (!partner) return null;

      if (item.type === 'commission') {
        return (
          <View className="gap-3">
            <PartnerCommissionTab
              contracts={contracts}
              statistics={statistics}
              isLoading={isStatisticsLoading}
              onPressContract={(contractId) => router.push(`/contracts/${contractId}` as any)}
            />
            {renderAdditionalInfo()}
          </View>
        );
      }

      if (item.type === 'opportunity') {
        return (
          <PartnerRowCard
            testID={`partnerOpportunity-${item.value.id}`}
            title={item.value.name}
            subtitleLines={[
              item.value.opportunityCode || `#${item.value.id}`,
              item.value.createdAt ? `Tạo ngày ${formatDateToDDMMYYYY(item.value.createdAt)}` : '',
            ]}
            amount={item.value.expectedRevenue}
            icon="briefcase"
            iconColor="#F38820"
            iconWrapperClass="border-orange-100 bg-orange-50"
            accessibilityLabel={`Xem cơ hội ${item.value.name}`}
            onPress={() => router.push(`/opportunities/${item.value.id}` as any)}
          />
        );
      }

      if (item.type === 'contract') {
        return (
          <PartnerRowCard
            testID={`partnerContract-${item.value.id}`}
            title={item.value.contractCode || `#${item.value.id}`}
            subtitleLines={[
              item.value.signedDate
                ? `Ký ngày ${formatDateToDDMMYYYY(item.value.signedDate)}`
                : 'Chưa có ngày ký',
            ]}
            amount={item.value.sellingPrice}
            icon="file-text"
            iconColor="#2563EB"
            iconWrapperClass="border-blue-100 bg-blue-50"
            accessibilityLabel={`Xem hợp đồng ${item.value.contractCode || item.value.id}`}
            onPress={() => router.push(`/contracts/${item.value.id}` as any)}
          />
        );
      }

      return (
        <PartnerRowCard
          testID={`partnerCustomer-${item.value.id}`}
          title={item.value.name}
          subtitleLines={[
            item.value.email || 'Chưa có email',
            item.value.phone || item.value.phoneNumber || 'Chưa có SĐT',
          ]}
          avatarText={(item.value.name || 'K').charAt(0).toUpperCase()}
          iconColor="#059669"
          iconWrapperClass="border-emerald-100 bg-emerald-50"
          accessibilityLabel={`Xem khách hàng ${item.value.name}`}
          onPress={() => router.push(`/customers/${item.value.id}` as any)}
        />
      );
    },
    [contracts, isStatisticsLoading, partner, renderAdditionalInfo, router, statistics],
  );

  if (authLoading) return <LoadingSkeleton />;

  if (!hasAccess) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center gap-3 bg-slate-50 p-8"
        edges={['top']}
      >
        <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <Feather name="shield-off" size={36} color="#EF4444" />
        </View>
        <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
        <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
          Phân hệ Đối tác giới thiệu chỉ dành cho Ban Quản trị (Admin/BOD) và Bộ phận Phát triển
          kinh doanh (BD/Admin Sale).
        </Text>
        <TouchableOpacity
          className="mt-3 min-h-[48px] justify-center rounded-xl bg-primary px-5 py-3"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.82}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !partner) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6"
        edges={['top']}
      >
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không tải được thông tin đối tác</Text>
        <Text className="text-center text-xs text-slate-500">
          {error instanceof Error && error.message
            ? error.message
            : 'Đối tác có thể không tồn tại hoặc bạn không có quyền xem.'}
        </Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5 py-3"
          onPress={() => refetch()}
          activeOpacity={0.82}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="min-h-[48px] justify-center px-5"
          onPress={() => safeGoBack(router, '/referral-partners')}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-slate-600">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeLabel = getPartnerTypeLabel(partner.type) || 'Chưa xác định';
  const isIndividual = partner.type === 'INDIVIDUAL';
  const tabCounts: Record<PartnerTab, number | undefined> = {
    opportunities: opportunities.length,
    contracts: contracts.length,
    customers: customers.length,
    commission: undefined,
  };
  const emptyState = activeTab === 'commission' ? null : EMPTY_STATE[activeTab];

  return (
    <SafeAreaView
      testID="referralPartnerDetailScreen"
      className="flex-1 bg-slate-50"
      edges={['top']}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/referral-partners')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách đối tác"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text
          className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900"
          numberOfLines={1}
        >
          {partner.name}
        </Text>
        <View className="w-12" />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderRow}
        contentContainerStyle={{ padding: 16, paddingBottom: 36, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            {/* Tên + badge loại */}
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50">
                <Text className="text-2xl font-black text-orange-600">
                  {(partner.name || 'Đ').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-center text-lg font-bold text-slate-900">{partner.name}</Text>
              <View
                className={`mt-2 rounded-lg border px-2.5 py-1 ${
                  isIndividual
                    ? 'border-emerald-100 bg-emerald-50'
                    : 'border-orange-100 bg-orange-50'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isIndividual ? 'text-emerald-700' : 'text-orange-700'
                  }`}
                >
                  {typeLabel}
                </Text>
              </View>
              <View className="mt-3 w-full">
                <ContactActionGroup phone={partner.phone || undefined} email={partner.email || undefined} />
              </View>
            </View>

            {renderInfoCard()}
            {renderStatCards()}

            {/* 4 tab */}
            <View className="flex-row flex-wrap justify-between gap-y-2 rounded-2xl bg-slate-200 p-1.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = tabCounts[tab.key];
                return (
                  <TouchableOpacity
                    key={tab.key}
                    testID={`partnerTab-${tab.key}`}
                    className={`min-h-[48px] w-[49%] flex-row items-center justify-center rounded-xl px-2 ${
                      isActive ? 'bg-white' : ''
                    }`}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.75}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isActive ? 'text-orange-600' : 'text-slate-500'
                      }`}
                    >
                      {tab.label}
                      {count !== undefined ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12">
            <Feather name={emptyState?.icon || 'inbox'} size={38} color="#CBD5E1" />
            <Text className="mt-3 text-sm font-bold text-slate-600">
              {emptyState?.title || 'Chưa có dữ liệu'}
            </Text>
            <Text className="mt-1 text-center text-xs text-slate-400">
              Chưa ghi nhận dữ liệu liên quan cho đối tác giới thiệu này.
            </Text>
          </View>
        }
        ListFooterComponent={
          canManage ? (
            <TouchableOpacity
              testID="deletePartnerButton"
              className="mt-6 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4"
              onPress={confirmDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="Xóa đối tác"
              accessibilityState={{ disabled: deleteMutation.isPending }}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={18} color="#DC2626" />
              )}
              <Text className="text-sm font-bold text-red-700">Xóa đối tác</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <PartnerFormModal
        visible={isEditOpen}
        partner={partner as ReferralPartnerItem}
        onClose={() => setIsEditOpen(false)}
        onSuccess={refetch}
      />
    </SafeAreaView>
  );
}
