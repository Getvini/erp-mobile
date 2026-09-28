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
  useCustomerDetailQuery,
  useDeleteCustomerMutation,
} from '@/hooks/queries/useCustomers';
import { BrandColors } from '@/constants/colors';
import EditCustomerModal from '@/components/customers/EditCustomerModal';
import {
  CustomerContactsTab,
  CustomerContractCard,
  CustomerOpportunityCard,
} from '@/components/customers';
import { CustomerContract, CustomerOpportunity } from '@/services/customerService';
import { useAuth } from '@/context/AuthContext';
import { canDeleteCustomers } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

type CustomerTab = 'info' | 'contacts' | 'opportunities' | 'contracts';
type CustomerRow =
  | { type: 'info'; id: 'info' }
  | { type: 'contacts'; id: 'contacts' }
  | { type: 'opportunity'; id: string; value: CustomerOpportunity }
  | { type: 'contract'; id: string; value: CustomerContract };

const TABS: { key: CustomerTab; label: string }[] = [
  { key: 'info', label: 'Thông tin' },
  { key: 'contacts', label: 'Liên hệ' },
  { key: 'opportunities', label: 'Cơ hội' },
  { key: 'contracts', label: 'Hợp đồng' },
];

function LoadingSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
      <View className="h-14 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-48 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-24 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-40 rounded-2xl bg-slate-200" />
    </SafeAreaView>
  );
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const customerId = typeof id === 'string' ? id : '';
  const [activeTab, setActiveTab] = useState<CustomerTab>('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    data: customer,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCustomerDetailQuery(customerId);
  const deleteCustomerMutation = useDeleteCustomerMutation();
  const canDelete = canDeleteCustomers(user?.role);

  const phone = customer?.phoneNumber || customer?.phone;
  const opportunities = useMemo(
    () => (Array.isArray(customer?.opportunities) ? customer.opportunities.filter(Boolean) : []),
    [customer],
  );
  const contracts = useMemo(
    () => (Array.isArray(customer?.contracts) ? customer.contracts.filter(Boolean) : []),
    [customer],
  );

  const rows = useMemo<CustomerRow[]>(() => {
    if (activeTab === 'info') return [{ type: 'info', id: 'info' }];
    if (activeTab === 'contacts') return [{ type: 'contacts', id: 'contacts' }];
    if (activeTab === 'opportunities') {
      return opportunities.map((value) => ({ type: 'opportunity', id: value.id, value }));
    }
    return contracts.map((value) => ({ type: 'contract', id: value.id, value }));
  }, [activeTab, contracts, opportunities]);

  const handleCall = useCallback((value?: string) => {
    if (!value) {
      Alert.alert('Thông báo', 'Khách hàng chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${value}`);
  }, []);

  const handleEmail = useCallback((value?: string) => {
    if (!value) {
      Alert.alert('Thông báo', 'Khách hàng chưa cập nhật email liên hệ.');
      return;
    }
    Linking.openURL(`mailto:${value}`);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!customer || !canDelete || deleteCustomerMutation.isPending) return;

    Alert.alert(
      'Xóa khách hàng',
      `Bạn có chắc muốn xóa “${customer.name}”? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa khách hàng',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomerMutation.mutateAsync(customer.id);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa khách hàng.', [
                { text: 'Đóng', onPress: () => router.replace('/customers') },
              ]);
            } catch (deleteError: any) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert(
                'Không thể xóa khách hàng',
                deleteError?.message || 'Vui lòng kiểm tra dữ liệu liên quan và thử lại.',
              );
            }
          },
        },
      ],
    );
  }, [canDelete, customer, deleteCustomerMutation, router]);

  const renderInfo = useCallback(() => {
    if (!customer) return null;
    const fields = [
      { label: 'Mã số thuế', value: customer.taxId || customer.taxCode || 'Chưa cập nhật', separated: false },
      { label: 'Số điện thoại', value: phone || 'Chưa cập nhật', separated: true },
      { label: 'Email khách hàng', value: customer.email || 'Chưa cập nhật', separated: true },
      { label: 'Địa chỉ trụ sở', value: customer.address || 'Chưa cập nhật', separated: true },
      ...(customer.website ? [{ label: 'Website', value: customer.website, separated: true }] : []),
      ...(customer.industry ? [{ label: 'Ngành nghề / Lĩnh vực', value: customer.industry, separated: true }] : []),
    ];

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {fields.map((field) => (
          <View key={field.label} className={field.separated ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
            <Text className="mb-1 text-xs font-semibold uppercase text-slate-400">{field.label}</Text>
            <Text className="text-sm font-bold leading-5 text-slate-800">{field.value}</Text>
          </View>
        ))}
      </View>
    );
  }, [customer, phone]);

  const renderRow = useCallback(({ item }: { item: CustomerRow }) => {
    if (!customer) return null;
    if (item.type === 'info') return renderInfo();
    if (item.type === 'contacts') {
      return (
        <CustomerContactsTab
          phone={phone}
          email={customer.email}
          onCall={handleCall}
          onEmail={handleEmail}
        />
      );
    }
    if (item.type === 'opportunity') {
      return (
        <CustomerOpportunityCard
          opportunity={item.value}
          onPress={(opportunityId) => router.push(`/opportunities/${opportunityId}` as any)}
        />
      );
    }
    return (
      <CustomerContractCard
        contract={item.value}
        onPress={(contractId) => router.push(`/contracts/${contractId}` as any)}
      />
    );
  }, [customer, handleCall, handleEmail, phone, renderInfo, router]);

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !customer) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6" edges={['top']}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không tải được thông tin khách hàng</Text>
        <Text className="text-center text-xs text-slate-500">
          {error instanceof Error ? error.message : 'Dữ liệu không tồn tại hoặc bạn không có quyền xem.'}
        </Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-orange-500 px-5 py-3"
          onPress={() => refetch()}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="min-h-[48px] justify-center px-5"
          onPress={() => safeGoBack(router, '/customers')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-slate-600">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="customerDetailScreen" className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/customers')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách khách hàng"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900" numberOfLines={1}>
          {customer.name}
        </Text>
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl border border-orange-100 bg-orange-50"
          onPress={() => setIsEditModalOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa khách hàng"
        >
          <Feather name="edit-3" size={18} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderRow}
        contentContainerStyle={{ padding: 16, paddingBottom: 36, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        showsVerticalScrollIndicator={false}
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
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50">
                <Text className="text-2xl font-black text-orange-600">
                  {(customer.name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-center text-lg font-bold text-slate-900">{customer.name}</Text>
              <View className="mt-2 flex-row gap-2">
                <View className="rounded-lg bg-orange-50 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-orange-700">
                    {opportunities.length} cơ hội
                  </Text>
                </View>
                <View className="rounded-lg bg-blue-50 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-blue-700">{contracts.length} hợp đồng</Text>
                </View>
              </View>
            </View>

            <View className="flex-row flex-wrap justify-between gap-y-2 rounded-2xl bg-slate-200 p-1.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = tab.key === 'opportunities'
                  ? opportunities.length
                  : tab.key === 'contracts'
                    ? contracts.length
                    : undefined;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    testID={`customerTab-${tab.key}`}
                    className={`min-h-[48px] w-[49%] flex-row items-center justify-center rounded-xl px-2 ${
                      isActive ? 'bg-white' : ''
                    }`}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.75}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text className={`text-xs font-bold ${isActive ? 'text-orange-600' : 'text-slate-500'}`}>
                      {tab.label}{count !== undefined ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12">
            <Feather name={activeTab === 'opportunities' ? 'briefcase' : 'file-text'} size={38} color="#CBD5E1" />
            <Text className="mt-3 text-sm font-bold text-slate-600">
              {activeTab === 'opportunities' ? 'Chưa có cơ hội kinh doanh' : 'Chưa có hợp đồng'}
            </Text>
            <Text className="mt-1 text-center text-xs text-slate-400">
              Chưa ghi nhận dữ liệu liên quan cho khách hàng này.
            </Text>
          </View>
        }
        ListFooterComponent={
          activeTab === 'info' && canDelete ? (
            <TouchableOpacity
              className="mt-6 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4"
              onPress={confirmDelete}
              disabled={deleteCustomerMutation.isPending}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Xóa khách hàng"
              accessibilityState={{ disabled: deleteCustomerMutation.isPending }}
            >
              {deleteCustomerMutation.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={18} color="#DC2626" />
              )}
              <Text className="text-sm font-bold text-red-700">Xóa khách hàng</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <EditCustomerModal
        visible={isEditModalOpen}
        customer={customer}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={refetch}
      />
    </SafeAreaView>
  );
}
