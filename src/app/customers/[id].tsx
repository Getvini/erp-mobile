import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomerDetailQuery } from '@/hooks/queries/useCustomers';
import { BrandColors } from '@/constants/colors';
import { CONTRACT_STATUS_CONFIG, CONTRACT_STATUS_LABELS } from '@/services/contractService';
import EditCustomerModal from '@/components/customers/EditCustomerModal';

import { safeGoBack } from '@/utils/navigation';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'info' | 'contracts'>('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: customer, isLoading, refetch, isFetching } = useCustomerDetailQuery(id as string);

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email?: string) => {
    if (!email) {
      Alert.alert('Thông báo', 'Khách hàng chưa cập nhật email liên hệ.');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  const formatCurrency = (val?: number | string) => {
    if (val === undefined || val === null) return '0 ₫';
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num) || num === 0) return '0 ₫';
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center gap-3" edges={['top']}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-sm font-semibold text-slate-500">Đang tải thông tin khách hàng...</Text>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center p-6 gap-3" edges={['top']}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không tìm thấy thông tin đối tác</Text>
        <TouchableOpacity
          className="mt-2 bg-slate-900 px-5 py-3 rounded-xl min-h-[44px] justify-center"
          onPress={() => safeGoBack(router, '/customers')}
        >
          <Text className="text-sm font-bold text-white">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const contractsList = Array.isArray(customer.contracts)
    ? customer.contracts.filter((c) => c && typeof c === 'object')
    : [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
          onPress={() => safeGoBack(router, '/customers')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-[17px] font-bold text-slate-900 flex-1 text-center px-2" numberOfLines={1}>
          {customer.name}
        </Text>
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 items-center justify-center min-w-[44px] min-h-[44px]"
          onPress={() => setIsEditModalOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="edit-3" size={18} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={BrandColors.primary} />}
      >
        {/* Profile Header Card */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm items-center">
          <View className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-3">
            <Text className="text-2xl font-black text-blue-600">{(customer.name || 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <Text className="text-lg font-bold text-slate-900 text-center mb-1">{customer.name}</Text>
          {customer.code && (
            <View className="bg-slate-100 px-2.5 py-0.5 rounded-md mb-3">
              <Text className="text-xs font-bold text-slate-600">Mã KH: #{customer.code}</Text>
            </View>
          )}

          {/* Contact & Edit Action Buttons */}
          <View className="flex-row gap-3 mt-2 w-full">
            {customer.phoneNumber && (
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 py-3 rounded-xl min-h-[44px]"
                onPress={() => handleCall(customer.phoneNumber || customer.phone)}
                activeOpacity={0.75}
              >
                <Feather name="phone" size={16} color="#10B981" />
                <Text className="text-xs font-bold text-emerald-700">Gọi điện</Text>
              </TouchableOpacity>
            )}

            {customer.email && (
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 bg-blue-50 border border-blue-200 py-3 rounded-xl min-h-[44px]"
                onPress={() => handleEmail(customer.email)}
                activeOpacity={0.75}
              >
                <Feather name="mail" size={16} color="#3B82F6" />
                <Text className="text-xs font-bold text-blue-700">Gửi Email</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl min-h-[44px] mt-3 w-full"
            onPress={() => setIsEditModalOpen(true)}
            activeOpacity={0.75}
          >
            <Feather name="edit" size={15} color="#475569" />
            <Text className="text-xs font-bold text-slate-700">Chỉnh sửa thông tin đối tác</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-slate-200 p-1 rounded-xl">
          <TouchableOpacity
            className={`flex-1 py-2.5 items-center rounded-lg min-h-[40px] justify-center ${
              activeTab === 'info' ? 'bg-white' : ''
            }`}
            style={activeTab === 'info' ? styles.activeTabShadow : undefined}
            onPress={() => setActiveTab('info')}
          >
            <Text className={`text-xs font-bold ${activeTab === 'info' ? 'text-slate-900' : 'text-slate-500'}`}>
              Thông tin chi tiết
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-2.5 items-center rounded-lg min-h-[40px] justify-center ${
              activeTab === 'contracts' ? 'bg-white' : ''
            }`}
            style={activeTab === 'contracts' ? styles.activeTabShadow : undefined}
            onPress={() => setActiveTab('contracts')}
          >
            <Text className={`text-xs font-bold ${activeTab === 'contracts' ? 'text-slate-900' : 'text-slate-500'}`}>
              Hợp đồng ({contractsList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3.5 shadow-sm">
            <View>
              <Text className="text-xs font-semibold text-slate-400 mb-1">MÃ SỐ THUẾ</Text>
              <Text className="text-sm font-bold text-slate-800">{customer.taxId || customer.taxCode || 'Chưa cập nhật'}</Text>
            </View>

            <View className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold text-slate-400 mb-1">SỐ ĐIỆN THOẠI</Text>
              <Text className="text-sm font-bold text-slate-800">{customer.phoneNumber || customer.phone || 'Chưa cập nhật'}</Text>
            </View>

            <View className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold text-slate-400 mb-1">EMAIL KHÁCH HÀNG</Text>
              <Text className="text-sm font-bold text-slate-800">{customer.email || 'Chưa cập nhật'}</Text>
            </View>

            <View className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold text-slate-400 mb-1">ĐỊA CHỈ TRỤ SỞ</Text>
              <Text className="text-sm font-medium text-slate-800 leading-5">{customer.address || 'Chưa cập nhật'}</Text>
            </View>

            {customer.website ? (
              <View className="border-t border-slate-100 pt-3">
                <Text className="text-xs font-semibold text-slate-400 mb-1">WEBSITE</Text>
                <Text className="text-sm font-semibold text-blue-600">{customer.website}</Text>
              </View>
            ) : null}

            {customer.industry ? (
              <View className="border-t border-slate-100 pt-3">
                <Text className="text-xs font-semibold text-slate-400 mb-1">NGÀNH NGHỀ / LĨNH VỰC</Text>
                <Text className="text-sm font-medium text-slate-800">{customer.industry}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            {contractsList.length > 0 ? (
              contractsList.map((contract, idx) => {
                const contractId = contract.id || contract.contractCode || `contract-${idx}`;
                const displayCode = contract.contractCode || (contract.id ? String(contract.id).slice(0, 8) : `HĐ #${idx + 1}`);

                const statusKey = contract.status || '';
                const statusConfig = CONTRACT_STATUS_CONFIG[statusKey] || {
                  text: CONTRACT_STATUS_LABELS[statusKey] || statusKey || 'Đang thực hiện',
                  color: '#1E40AF',
                  bg: '#DBEAFE',
                  border: '#BFDBFE',
                };

                return (
                  <TouchableOpacity
                    key={contractId}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm gap-2"
                    onPress={() => {
                      if (contract.id) {
                        router.push(`/contracts/${contract.id}` as any);
                      } else {
                        router.push('/contracts' as any);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
                        HĐ: #{displayCode}
                      </Text>
                      <View
                        className="px-2.5 py-0.5 rounded border"
                        style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: statusConfig.color }}>
                          {statusConfig.text}
                        </Text>
                      </View>
                    </View>

                    {contract.name ? (
                      <Text className="text-xs font-semibold text-slate-700" numberOfLines={1}>
                        {contract.name}
                      </Text>
                    ) : null}

                    <View className="border-t border-slate-100 pt-2 flex-row justify-between items-center">
                      <Text className="text-xs text-slate-500">Giá trị hợp đồng:</Text>
                      <Text className="text-sm font-extrabold text-blue-600">
                        {formatCurrency(contract.sellingPrice)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View className="bg-white rounded-2xl p-8 items-center justify-center border border-slate-200 gap-2">
                <Feather name="file-text" size={36} color="#CBD5E1" />
                <Text className="text-sm font-bold text-slate-600">Chưa có hợp đồng nào</Text>
                <Text className="text-xs text-slate-400 text-center">
                  Khách hàng này hiện chưa có phụ lục hoặc hợp đồng nào trong hệ thống.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Customer Modal */}
      <EditCustomerModal
        visible={isEditModalOpen}
        customer={customer}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={refetch}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeTabShadow: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
  },
});

