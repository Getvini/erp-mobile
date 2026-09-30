import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomerItem } from '@/services/customerService';
import { useCustomersQuery } from '@/hooks/queries/useCustomers';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import { useAuth } from '@/context/AuthContext';
import { canAccessCustomers } from '@/utils/rbac';
import CreateCustomerModal from '@/components/customers/CreateCustomerModal';
import { safeGoBack } from '@/utils/navigation';

const SOURCE_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'INTERNAL', label: 'Nội bộ' },
  { key: 'REFERRAL_PARTNER', label: 'Đối tác giới thiệu' },
];

const CustomerCardItem = React.memo(function CustomerCardItem({
  item,
  onPress,
  onCall,
  onEmail,
}: {
  item: CustomerItem;
  onPress: (id: string) => void;
  onCall: (phone?: string) => void;
  onEmail: (email?: string) => void;
}) {
  return (
    <TouchableOpacity
      testID={`customerCard-${item.id}`}
      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
      onPress={() => onPress(item.id)}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center mb-2.5">
        <View className="w-[42px] h-[42px] rounded-xl bg-blue-50 border border-blue-100 items-center justify-center mr-3">
          <Text className="text-lg font-extrabold text-blue-500">{(item.name || 'C').charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        {item.code && <Text className="text-[11px] font-bold text-slate-400">#{item.code}</Text>}
      </View>

      {item.address ? (
        <View className="flex-row items-start gap-1.5 mb-3 bg-slate-50 p-2.5 rounded-lg">
          <Feather name="map-pin" size={13} color="#64748B" />
          <Text className="text-xs text-slate-500 leading-[18px] flex-1" numberOfLines={2}>
            {item.address}
          </Text>
        </View>
      ) : null}

      <View className="flex-row justify-between items-center border-t border-slate-100 pt-2.5">
        <View className="flex-row items-center gap-2">
          {item.phoneNumber && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 min-h-[48px]"
              onPress={() => onCall(item.phoneNumber)}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={14} color="#10B981" />
              <Text className="text-xs font-bold text-emerald-600">Gọi điện</Text>
            </TouchableOpacity>
          )}

          {item.email && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 min-h-[48px]"
              onPress={() => onEmail(item.email)}
              activeOpacity={0.7}
            >
              <Feather name="mail" size={14} color="#3B82F6" />
              <Text className="text-xs font-bold text-blue-600">Gửi mail</Text>
            </TouchableOpacity>
          )}
        </View>

        {item.contracts && item.contracts.length > 0 ? (
          <Text className="text-[11px] font-semibold text-slate-500">
            {item.contracts.length} hợp đồng
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function CustomersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAccess = canAccessCustomers(user?.role);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceTab, setActiveSourceTab] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // TanStack Query for customer list
  const { data: customers = [], isLoading, isFetching, isError, error, refetch } = useCustomersQuery({
    search: searchQuery,
    source: activeSourceTab !== 'ALL' ? activeSourceTab : undefined,
  });

  useSSERefresh('invalidate_Customers', refetch);

  const handleRefresh = () => {
    refetch();
  };

  const handleCustomerPress = useCallback((id: string) => {
    router.push(`/customers/${id}` as any);
  }, [router]);

  const handleCall = useCallback((phone?: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleEmail = useCallback((email?: string) => {
    if (!email) {
      Alert.alert('Thông báo', 'Khách hàng này chưa cập nhật email liên hệ.');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (activeSourceTab !== 'ALL') {
      const matchSource = (c as any).source === activeSourceTab;
      if (!matchSource) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.phoneNumber?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const renderCustomerCard = useCallback(({ item }: { item: CustomerItem }) => {
    return (
      <CustomerCardItem
        item={item}
        onPress={handleCustomerPress}
        onCall={handleCall}
        onEmail={handleEmail}
      />
    );
  }, [handleCustomerPress, handleCall, handleEmail]);

  const keyExtractor = useCallback((item: CustomerItem) => item.id, []);

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
            onPress={() => router.replace('/')}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Hồ sơ Khách hàng & CRM</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 justify-center items-center p-8 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-2">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="text-[13px] text-slate-500 text-center leading-5 max-w-[280px]">
            Phân hệ Khách hàng chỉ dành riêng cho Ban Quản trị (Admin/BOD) và Bộ phận Phát triển kinh doanh (BD).
          </Text>
          <TouchableOpacity
            className="mt-3 bg-primary px-5 py-3 rounded-xl min-h-[44px] justify-center"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">Hồ sơ Khách hàng & CRM</Text>
        <View className="w-12" />
      </View>

      {/* Search Input */}
      <View className="px-4 py-3 bg-white border-b border-slate-200">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 h-[48px]">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="customerSearchInput"
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Tìm theo tên công ty, SĐT, người đại diện..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Source Filter Tabs */}
        <View className="flex-row gap-2 mt-2.5">
          {SOURCE_TABS.map((tab) => {
            const isActive = activeSourceTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                className={`px-3 min-h-[44px] justify-center rounded-full border ${
                  isActive ? 'bg-primary border-primary' : 'bg-slate-100 border-slate-200'
                }`}
                onPress={() => setActiveSourceTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text
                  className={`text-xs ${
                    isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content List */}
      {isLoading && !isFetching ? (
        <View className="flex-1 px-4 pt-4 gap-3">
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-36 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được danh sách khách hàng</Text>
          <Text className="text-xs text-slate-500 text-center">
            {error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          testID="customersList"
          data={filteredCustomers}
          keyExtractor={keyExtractor}
          renderItem={renderCustomerCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="py-14 items-center justify-center gap-2.5">
              <Feather name="users" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Chưa có thông tin đối tác</Text>
              <Text className="text-[13px] text-slate-400 text-center max-w-[260px]">
                {searchQuery
                  ? 'Không tìm thấy đối tác nào phù hợp.'
                  : 'Hiện tại chưa có hồ sơ khách hàng nào trong hệ thống.'}
              </Text>
            </View>
          }
        />
      )}

      {/* <TouchableOpacity
        testID="createCustomerButton"
        className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
        onPress={() => setIsModalOpen(true)}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Thêm khách hàng mới"
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <Text className="text-sm font-extrabold text-white">Thêm khách hàng</Text>
      </TouchableOpacity> */}

      {/* Create Modal */}
      <CreateCustomerModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
