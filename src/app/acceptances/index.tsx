import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AcceptanceItem,
  ACCEPTANCE_STATUS_CONFIG,
} from '@/services/acceptanceService';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import AcceptanceReviewModal from '@/components/projects/AcceptanceReviewModal';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { useAcceptancesQuery } from '@/hooks/queries/useAcceptances';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'CANCELLED';

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ duyệt' },
  { id: 'APPROVED', label: 'Đã duyệt' },
  { id: 'REJECTED', label: 'Từ chối' },
  { id: 'PROCESSED', label: 'Đã xử lý' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

export default function AcceptancesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AcceptanceItem | null>(null);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);

  const { data: requestsRes, isLoading, isFetching, refetch } = useAcceptancesQuery({
    status: activeTab !== 'ALL' ? activeTab : undefined,
  });

  const requests: AcceptanceItem[] = useMemo(() => {
    if (!requestsRes) return [];
    return Array.isArray(requestsRes) ? requestsRes : [];
  }, [requestsRes]);

  useSSERefresh('invalidate_Acceptances', refetch);

  const handleRefresh = () => {
    refetch();
  };

  const handleOpenReview = (item: AcceptanceItem) => {
    setSelectedRequest(item);
    setIsReviewModalVisible(true);
  };

  const handleCloseReview = () => {
    setIsReviewModalVisible(false);
    setSelectedRequest(null);
  };

  const filteredRequests = requests.filter((req) => {
    if (activeTab !== 'ALL' && req.status !== activeTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = req.name?.toLowerCase().includes(q);
    const codeMatch = req.acceptanceCode?.toLowerCase().includes(q);
    const projMatch = req.project?.name?.toLowerCase().includes(q);
    const creatorMatch = req.creator?.fullName?.toLowerCase().includes(q);
    return !!(nameMatch || codeMatch || projMatch || creatorMatch);
  });

  const renderAcceptanceCard = ({ item }: { item: AcceptanceItem }) => {
    const statusCfg = ACCEPTANCE_STATUS_CONFIG[item.status] || {
      text: item.status,
      color: '#64748B',
      bg: '#F1F5F9',
    };

    return (
      <View className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] gap-2">
        {/* Card Header */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-bold text-[#0F172A]" numberOfLines={1}>
              {item.name || (item.acceptanceCode ? `#${item.acceptanceCode}` : 'Biên bản nghiệm thu')}
            </Text>
            {item.acceptanceCode && item.name ? (
              <Text className="text-[11px] text-[#64748B] mt-0.5">#{item.acceptanceCode}</Text>
            ) : null}
          </View>
          <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: statusCfg.bg }}>
            <Text className="text-[11px] font-bold" style={{ color: statusCfg.color }}>
              {statusCfg.text}
            </Text>
          </View>
        </View>

        {item.project?.name ? (
          <View className="flex-row items-center gap-1.5">
            <Feather name="folder" size={13} color="#64748B" />
            <Text className="text-xs text-[#475569] flex-1" numberOfLines={1}>
              Dự án: <Text className="font-bold text-[#0F172A]">{item.project.name}</Text>
            </Text>
          </View>
        ) : null}

        {item.creator?.fullName && (
          <View className="flex-row items-center gap-1.5">
            <Feather name="user" size={13} color="#64748B" />
            <Text className="text-xs text-[#475569] flex-1" numberOfLines={1}>
              Người gửi: {item.creator.fullName}
            </Text>
          </View>
        )}

        {item.createdAt && (
          <View className="flex-row items-center gap-1.5">
            <Feather name="clock" size={13} color="#64748B" />
            <Text className="text-xs text-[#475569]">
              Ngày tạo: {new Date(item.createdAt).toLocaleDateString('vi-VN')}
            </Text>
          </View>
        )}

        {item.note ? (
          <Text className="text-xs text-[#64748B] italic mt-0.5" numberOfLines={2}>
            Ghi chú: {item.note}
          </Text>
        ) : null}

        {/* Card Footer */}
        <View className="flex-row items-center justify-between border-t border-[#F1F5F9] pt-2 mt-1">
          <Text className="text-[11px] font-semibold text-[#64748B]">
            {item.services?.length ? `${item.services.length} hạng mục dịch vụ` : 'Hạng mục dịch vụ'}
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-1"
            onPress={() => handleOpenReview(item)}
            activeOpacity={0.75}
          >
            <Text className="text-xs font-bold text-primary">
              {item.status === 'PENDING' ? 'Phê duyệt' : 'Xem chi tiết'}
            </Text>
            <Feather name="chevron-right" size={14} color={BrandColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top']}>
      {/* Header Bar */}
      <View className="flex-row items-center px-4 py-3 gap-3 bg-white border-b border-[#F1F5F9]">
        <TouchableOpacity className="p-1.5 rounded-lg bg-[#F1F5F9]" onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-[#0F172A]">Yêu cầu nghiệm thu</Text>
          <Text className="text-[11px] text-[#64748B] mt-0.5">Quản lý và phê duyệt các đợt nghiệm thu dự án</Text>
        </View>
      </View>

      {/* Search Input */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl px-3 py-2 gap-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            className="flex-1 text-[13px] text-[#0F172A]"
            placeholder="Tìm theo tên, mã, dự án, người gửi..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row px-4 py-2 bg-white border-b border-[#F1F5F9] gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              className={'px-3 py-1.5 rounded-lg ' + (isActive ? 'bg-primary' : 'bg-[#F1F5F9]')}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <Text className={'text-xs ' + (isActive ? 'text-white font-bold' : 'text-[#64748B] font-semibold')}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-[13px] text-[#64748B]">Đang tải danh sách nghiệm thu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderAcceptanceCard}
          contentContainerClassName="p-4 pb-24 gap-3"
          contentContainerStyle={{ padding: 16, paddingBottom: 90, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6 gap-2">
              <Feather name="clipboard" size={44} color="#CBD5E1" />
              <Text className="text-[15px] font-bold text-[#334155] mt-1.5">Không có yêu cầu nghiệm thu nào</Text>
              <Text className="text-xs text-[#94A3B8] text-center leading-[18px]">
                {searchQuery
                  ? 'Không tìm thấy yêu cầu phù hợp với từ khóa.'
                  : 'Chưa có biên bản nghiệm thu nào thuộc bộ lọc này.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Acceptance Review Modal */}
      <AcceptanceReviewModal
        visible={isReviewModalVisible}
        onClose={handleCloseReview}
        request={selectedRequest}
        onSuccess={refetch}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
