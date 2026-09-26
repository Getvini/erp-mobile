import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { canAccessContracts } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import { formatVND } from '@/utils/formatters';
import {
  ContractItem,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_STATUS_LABELS,
} from '@/services/contractService';
import { useContractsQuery } from '@/hooks/queries/useContracts';
import BottomNavBar from '@/components/BottomNavBar';
import { useSSERefresh } from '@/hooks/useSSERefresh';

const CONTRACT_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Mới' },
  { key: 'PROPOSAL_UPLOADED', label: 'Đã tải lên HĐ' },
  { key: 'PROPOSAL_APPROVED', label: 'Đã duyệt HĐ' },
  { key: 'PROPOSAL_REJECTED', label: 'Bị từ chối HĐ' },
  { key: 'SIGNED', label: 'Đã ký' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

export default function ContractsScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const hasAccess = canAccessContracts(user?.role);
  const canCreate =
    user?.role === 'ADMIN' ||
    user?.role === 'BOD' ||
    user?.role === 'BD' ||
    user?.role === 'ADMIN_SALE';

  const { data: contractsRes, isLoading, isFetching, refetch } = useContractsQuery({
    search: searchQuery.trim() || undefined,
    status: activeTab !== 'ALL' ? activeTab : undefined,
    limit: 50,
  });

  const contracts: ContractItem[] = useMemo(() => {
    if (!contractsRes) return [];
    return Array.isArray((contractsRes as any).data)
      ? (contractsRes as any).data
      : Array.isArray(contractsRes)
      ? contractsRes
      : [];
  }, [contractsRes]);

  const totalCount = (contractsRes as any)?.meta?.total || contracts.length;

  useSSERefresh('invalidate_Contracts', refetch);

  const handleRefresh = () => refetch();
  const handleClearSearch = () => setSearchQuery('');

  const summaryStats = useMemo(() => {
    const totalSelling = contracts.reduce((sum, item) => sum + Number(item.sellingPrice || 0), 0);
    return { count: contracts.length, totalSelling };
  }, [contracts]);

  const renderContractCard = ({ item }: { item: ContractItem }) => {
    const statusMeta = CONTRACT_STATUS_CONFIG[item.status] || {
      text: CONTRACT_STATUS_LABELS[item.status] || item.status || 'Chưa xác định',
      color: '#475569',
      bg: '#F1F5F9',
      border: '#E2E8F0',
    };

    const code = item.contractCode || (item as any).contract_code || '—';
    const customerName = item.customer?.name || 'Khách hàng chưa cập nhật';
    const oppName = item.opportunity?.name || '';
    const sellingPrice = Number(item.totalWithVat || (item as any).totalWithVat || 0);

    return (
      <TouchableOpacity
        className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]"
        activeOpacity={0.75}
        onPress={() => router.push(`/contracts/${item.id}` as any)}
      >
        {/* Header: Code & Status */}
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center gap-1 bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
            <Feather name="file-text" size={13} color="#2563EB" />
            <Text className="text-xs font-bold text-[#2563EB]">{code}</Text>
          </View>
          <View
            className="px-2 py-0.5 rounded-md border"
            style={{ backgroundColor: statusMeta.bg, borderColor: statusMeta.border }}
          >
            <Text className="text-[11px] font-bold" style={{ color: statusMeta.color }}>
              {statusMeta.text}
            </Text>
          </View>
        </View>

        {/* Contract Title */}
        <Text className="text-[15px] font-bold text-[#0F172A] mb-2 leading-5" numberOfLines={2}>
          {item.name || 'Hợp đồng kinh tế'}
        </Text>

        {/* Customer & Opportunity Info */}
        <View className="gap-1 mb-3 pb-2.5 border-b border-[#F1F5F9]">
          <View className="flex-row items-center gap-1.5">
            <Feather name="user" size={14} color="#64748B" />
            <Text className="text-[13px] text-[#334155] font-semibold flex-1" numberOfLines={1}>
              {customerName}
            </Text>
          </View>
          {oppName ? (
            <View className="flex-row items-center gap-1.5">
              <Feather name="trending-up" size={14} color="#64748B" />
              <Text className="text-xs text-[#64748B] flex-1" numberOfLines={1}>
                Cơ hội: {oppName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer: Price & Date */}
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-[11px] text-[#64748B] mb-0.5">Giá trị hợp đồng</Text>
            <Text className="text-[15px] font-extrabold text-primary">{formatVND(sellingPrice)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-[11px] text-[#94A3B8]">
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : ''}
            </Text>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isAuthLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8FAFC]">
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
          <Text className="text-lg font-bold text-[#0F172A]">Hợp đồng kinh tế</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-[#F1F5F9] items-center justify-center mb-4">
            <Feather name="lock" size={36} color="#94A3B8" />
          </View>
          <Text className="text-base font-bold text-[#1E293B] mb-2">Giới hạn quyền truy cập</Text>
          <Text className="text-[13px] text-[#64748B] text-center leading-[18px]">
            Phân hệ Quản lý Hợp đồng chỉ dành cho Ban giám đốc, Trưởng phòng và Bộ phận Kinh doanh.
          </Text>
        </View>
        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
      {/* App Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
        <View>
          <Text className="text-lg font-bold text-[#0F172A]">Hợp đồng kinh tế</Text>
          <Text className="text-xs text-[#64748B] mt-0.5">
            Quản lý {totalCount} hợp đồng & phụ lục phát sinh
          </Text>
        </View>
        {canCreate ? (
          <TouchableOpacity
            className="flex-row items-center gap-1 bg-primary px-3 py-1.5 rounded-lg"
            onPress={() =>
              Alert.alert(
                'Tạo Hợp đồng',
                'Hợp đồng được khởi tạo từ Cơ hội kinh doanh đã phê duyệt báo giá. Bạn có muốn chuyển tới danh sách Cơ hội không?',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Đến Cơ hội', onPress: () => router.push('/opportunities' as any) },
                ]
              )
            }
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">Tạo mới</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search Input Bar */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl px-3 h-10 border border-[#E2E8F0] gap-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            className="flex-1 text-sm text-[#0F172A]"
            placeholder="Tìm theo mã hợp đồng, tên khách hàng..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Status Tabs Bar */}
      <View className="bg-white border-b border-[#E2E8F0] pb-2">
        <FlatList
          data={CONTRACT_TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerClassName="px-4 gap-2"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                className={'px-3.5 py-1.5 rounded-full border ' + (isActive ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-[#F1F5F9] border-[#E2E8F0]')}
                onPress={() => setActiveTab(item.key)}
                activeOpacity={0.75}
              >
                <Text className={'text-[13px] font-semibold ' + (isActive ? 'text-[#2563EB] font-bold' : 'text-[#64748B]')}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Financial Summary Banner */}
      <View className="flex-row items-center justify-between bg-white mx-4 mt-3 mb-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0]">
        <View className="flex-1 items-center">
          <Text className="text-[11px] text-[#64748B] mb-0.5">Số lượng hợp đồng</Text>
          <Text className="text-sm font-bold text-[#0F172A]">{summaryStats.count} hợp đồng</Text>
        </View>
        <View className="w-px h-6 bg-[#E2E8F0]" />
        <View className="flex-1 items-center">
          <Text className="text-[11px] text-[#64748B] mb-0.5">Tổng giá trị danh sách</Text>
          <Text className="text-sm font-extrabold text-primary">{formatVND(summaryStats.totalSelling)}</Text>
        </View>
      </View>

      {/* Main List Area */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3 py-16">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-sm text-[#64748B]">Đang tải danh sách hợp đồng...</Text>
        </View>
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          renderItem={renderContractCard}
          contentContainerClassName="p-4 pb-8"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-full bg-[#F1F5F9] items-center justify-center mb-4">
                <Feather name="file-text" size={36} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-[#1E293B] mb-1.5">Chưa có hợp đồng nào</Text>
              <Text className="text-[13px] text-[#64748B] text-center leading-[18px]">
                {searchQuery
                  ? `Không tìm thấy hợp đồng phù hợp với từ khóa "${searchQuery}"`
                  : 'Hiện tại chưa có dữ liệu hợp đồng cho trạng thái này.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
