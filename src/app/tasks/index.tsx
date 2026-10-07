import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskItem } from '@/services/dashboardService';
import { TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import { safeGoBack } from '@/utils/navigation';
import { useTasksQuery } from '@/hooks/queries/useTasks';
import { useAuth } from '@/context/AuthContext';
import { isManagementRole, isProjectManagerRole, isSalesRole } from '@/utils/rbac';

type StatusFilter =
  | 'ALL'
  | 'NOT_STARTED'
  | 'PENDING'
  | 'DOING'
  | 'AWAITING_REVIEW'
  | 'AWAITING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'INTERNAL_COMPLETED'
  | 'COMPLETED'
  | 'REWORKING'
  | 'REJECTED'
  | 'AWAITING_PRICING'
  | 'AWAITING_SUPPORT'
  | 'OVERDUE'
  | 'ON_HOLD'
  | 'CANCELLED';

type ScopeFilter = 'MINE' | 'ALL';

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'NOT_STARTED', label: 'Chưa thực hiện' },
  { id: 'DOING', label: 'Đang thực hiện' },
  { id: 'PENDING', label: 'Chờ phân công' },
  { id: 'AWAITING_REVIEW', label: 'Chờ duyệt' },
  { id: 'AWAITING_ACCEPTANCE', label: 'Chờ nghiệm thu' },
  { id: 'REWORKING', label: 'Đang làm lại' },
  { id: 'REJECTED', label: 'Yêu cầu làm lại' },
  { id: 'INTERNAL_COMPLETED', label: 'HT nội bộ' },
  { id: 'ACCEPTED', label: 'Đã nghiệm thu' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
  { id: 'AWAITING_PRICING', label: 'Chờ định giá' },
  { id: 'AWAITING_SUPPORT', label: 'Nhờ hỗ trợ' },
  { id: 'OVERDUE', label: 'Quá hạn' },
  { id: 'ON_HOLD', label: 'Tạm dừng' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

const TaskCardItem = React.memo(function TaskCardItem({
  item,
  getStatusBadge,
  onPress,
}: {
  item: TaskItem;
  getStatusBadge: (status: string) => { bg: string; text: string; label: string };
  onPress: (id: string) => void;
}) {
  const badge = getStatusBadge(item.status);
  const isExtra = Boolean((item as any).isExtraTask || (item as any).isExtra);
  return (
    <TouchableOpacity
      className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
        isExtra ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
      }`}
      onPress={() => onPress(item.id)}
      activeOpacity={0.75}
    >
      {/* Sọc phát sinh bên trái */}
      {isExtra && <View className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />}

      <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
        <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: badge.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: badge.text }}>{badge.label}</Text>
        </View>
        {isExtra && (
          <View className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-amber-700">Phát sinh</Text>
          </View>
        )}
        {item.code && <Text className="ml-auto text-xs font-semibold text-slate-400">#{item.code}</Text>}
      </View>

      <Text className="mb-2.5 text-[15px] font-bold leading-[22px] text-slate-900" numberOfLines={2}>
        {item.name}
      </Text>

      <View className="mb-2.5 h-px bg-slate-100" />

      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3.5">
          {item.project?.name && (
            <View className="flex-row items-center gap-[5px]">
              <Feather name="folder" size={12} color="#64748B" />
              <Text className="max-w-[160px] text-xs text-slate-500" numberOfLines={1}>
                {item.project.name}
              </Text>
            </View>
          )}
          {item.plannedEndDate && (
            <View className="flex-row items-center gap-[5px]">
              <Feather name="clock" size={12} color="#64748B" />
              <Text className="max-w-[160px] text-xs text-slate-500">
                {new Date(item.plannedEndDate).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={16} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
});

export default function TasksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('MINE');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_LIMIT = 50;

  const currentUserId = user?.id;
  const userRole = user?.role;
  const canViewAllTasks = isManagementRole(userRole) || isProjectManagerRole(userRole) || isSalesRole(userRole);

  const { data: tasksRes, isLoading, isFetching, refetch } = useTasksQuery({
    status: activeTab !== 'ALL' ? activeTab : undefined,
    assigneeId: scopeFilter === 'MINE' || !canViewAllTasks ? currentUserId : undefined,
    page: 1,
    limit: PAGE_LIMIT * page,
  });

  const tasks: TaskItem[] = useMemo(() => {
    if (!tasksRes) return [];
    if (Array.isArray(tasksRes)) return tasksRes;
    return tasksRes.data || [];
  }, [tasksRes]);

  const totalTasksCount = useMemo(() => {
    if (!tasksRes) return 0;
    if (Array.isArray(tasksRes)) return tasksRes.length;
    return tasksRes.total ?? tasks.length;
  }, [tasksRes, tasks.length]);

  const handleRefresh = () => {
    setPage(1);
    refetch();
  };

  const handleStatusTabChange = (status: StatusFilter) => {
    setActiveTab(status);
    setPage(1);
  };

  const handleScopeFilterChange = (scope: ScopeFilter) => {
    setScopeFilter(scope);
    setPage(1);
  };

  const filteredTasks = tasks.filter((t) => {
    // Nếu chọn xem "Của tôi", chỉ giữ lại các task mà mình làm chính hoặc hỗ trợ
    if (scopeFilter === 'MINE' && currentUserId) {
      const isAssignee = (t as any).assigneeId === currentUserId || t.assignee?.id === currentUserId;
      const isHelper = (t as any).helperId === currentUserId || (t as any).helper?.id === currentUserId;
      const isSupportLead = (t as any).supportLeadId === currentUserId;
      if (!isAssignee && !isHelper && !isSupportLead) {
        return false;
      }
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.project?.name?.toLowerCase().includes(q) ||
      t.assignee?.fullName?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = useCallback((status: string) => {
    const config = TASK_STATUS_CONFIG[status];
    if (config) {
      return { bg: config.bg, text: config.color, label: config.text };
    }
    return { bg: '#F1F5F9', text: '#64748B', label: status || 'Chờ xử lý' };
  }, []);

  const handleTaskPress = useCallback((id: string) => {
    router.push(`/tasks/${id}` as any);
  }, [router]);

  const renderTaskCard = useCallback(({ item }: { item: TaskItem }) => {
    return <TaskCardItem item={item} getStatusBadge={getStatusBadge} onPress={handleTaskPress} />;
  }, [getStatusBadge, handleTaskPress]);

  const keyExtractor = useCallback((item: TaskItem) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-[10px] bg-slate-100"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-[17px] font-bold text-slate-900">Nhiệm vụ & Tiến độ</Text>
        <View className="w-10" />
      </View>

      {/* Search Input */}
      <View className="bg-white px-4 pb-2 pt-3">
        <View className="h-[42px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo tên task, mã hoặc dự án..."
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

      {/* Scope Filter Switcher (Chỉ hiển thị cho Quản lý / PM / Sales) */}
      {canViewAllTasks && (
        <View className="bg-white px-4 pb-2">
          <View className="flex-row items-center bg-slate-100 p-1 rounded-xl">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                scopeFilter === 'MINE' ? 'bg-white shadow-xs' : ''
              }`}
              onPress={() => handleScopeFilterChange('MINE')}
              activeOpacity={0.8}
            >
              <Feather
                name="user"
                size={13}
                color={scopeFilter === 'MINE' ? BrandColors.primary : '#64748B'}
              />
              <Text
                className={`text-xs ${
                  scopeFilter === 'MINE' ? 'font-bold text-slate-900' : 'font-medium text-slate-500'
                }`}
              >
                Nhiệm vụ của tôi
              </Text>
              {scopeFilter === 'MINE' && (
                <View className="bg-orange-100 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-black text-orange-700">
                    {searchQuery ? filteredTasks.length : totalTasksCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                scopeFilter === 'ALL' ? 'bg-white shadow-xs' : ''
              }`}
              onPress={() => handleScopeFilterChange('ALL')}
              activeOpacity={0.8}
            >
              <Feather
                name="globe"
                size={13}
                color={scopeFilter === 'ALL' ? BrandColors.primary : '#64748B'}
              />
              <Text
                className={`text-xs ${
                  scopeFilter === 'ALL' ? 'font-bold text-slate-900' : 'font-medium text-slate-500'
                }`}
              >
                Tất cả nhiệm vụ
              </Text>
              {scopeFilter === 'ALL' && (
                <View className="bg-orange-100 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-black text-orange-700">
                    {searchQuery ? filteredTasks.length : totalTasksCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View className="border-b border-slate-200 bg-white pb-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-2 px-4"
          renderItem={({ item }) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                className={`rounded-full px-3.5 py-1.5 ${isActive ? 'bg-primary' : 'bg-slate-100'}`}
                onPress={() => handleStatusTabChange(item.id)}
                activeOpacity={0.75}
              >
                <Text className={`text-[13px] font-semibold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Total Count Bar */}
      {totalTasksCount > 0 && (
        <View className="bg-slate-50 px-4 pt-2.5 pb-0.5 flex-row items-center justify-between">
          <Text className="text-[12px] font-medium text-slate-500">
            {searchQuery
              ? `Tìm thấy ${filteredTasks.length} / ${totalTasksCount} nhiệm vụ`
              : `Tổng số: ${totalTasksCount} nhiệm vụ${
                  filteredTasks.length < totalTasksCount ? ` (Đã tải ${filteredTasks.length})` : ''
                }`}
          </Text>
        </View>
      )}

      {/* Task List */}
      {isLoading && !isFetching ? (
        <View className="flex-1 items-center justify-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-[13px] text-slate-400">Đang tải danh sách công việc...</Text>
        </View>
      ) : (
        <FlashList
          data={filteredTasks}
          keyExtractor={keyExtractor}
          renderItem={renderTaskCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!isFetching && filteredTasks.length >= PAGE_LIMIT * page) {
              setPage((prev) => prev + 1);
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && page === 1}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListFooterComponent={
            isFetching && page > 1 ? (
              <View className="py-4 items-center justify-center flex-row gap-2">
                <ActivityIndicator size="small" color={BrandColors.primary} />
                <Text className="text-xs text-slate-400 font-medium">Đang tải thêm công việc...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center gap-2.5 py-[60px]">
              <Feather name="inbox" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Không có nhiệm vụ nào</Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                {searchQuery
                  ? 'Không tìm thấy nhiệm vụ phù hợp với từ khóa.'
                  : 'Danh sách công việc cho trạng thái này hiện đang trống.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
