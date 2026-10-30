import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { getTaskPolicy, getTaskDisplayName } from '@/utils/taskPolicy';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskItem } from '@/services/dashboardService';
import { TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import { safeGoBack } from '@/utils/navigation';
import { useTasksQuery } from '@/hooks/queries/useTasks';
import { useAuth } from '@/context/AuthContext';
import { isManagementRole, isProjectManagerRole, isSalesRole } from '@/utils/rbac';
import TaskAssignModal from '@/components/projects/TaskAssignModal';

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
  | 'SUPPORT_PENDING'
  | 'SUPPORT_AWAITING_RETURN'
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
  { id: 'SUPPORT_PENDING', label: 'Chờ xác nhận hỗ trợ' },
  { id: 'SUPPORT_AWAITING_RETURN', label: 'Chờ xác nhận hoàn thành' },
  { id: 'ON_HOLD', label: 'Tạm dừng' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

const TaskCardItem = React.memo(function TaskCardItem({
  item,
  getStatusBadge,
  onPress,
  onLongPress,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: {
  item: TaskItem;
  getStatusBadge: (status: string) => { bg: string; text: string; label: string };
  onPress: (id: string) => void;
  onLongPress?: (item: TaskItem) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const badge = getStatusBadge(item.status);
  const isExtra = Boolean((item as any).isExtraTask || (item as any).isExtra);

  const handlePress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      onPress(item.id);
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(item);
    }
  };

  return (
    <TouchableOpacity
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${
        isSelected
          ? 'border-2 border-primary bg-orange-50/90'
          : isExtra
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-slate-200 bg-white'
      }`}
      style={
        isSelected
          ? {
              borderColor: BrandColors.primary,
              backgroundColor: '#FFF8EE',
              shadowColor: '#F38820',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 3,
            }
          : undefined
      }
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      activeOpacity={0.75}
    >
      {/* Sọc phát sinh bên trái */}
      {isExtra && <View className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />}

      <View className="flex-row items-start">
        {/* Checkbox tròn lớn khi ở Chế độ chọn */}
        {isSelectionMode && (
          <TouchableOpacity
            className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2"
            style={{
              borderColor: isSelected ? BrandColors.primary : '#CBD5E1',
              backgroundColor: isSelected ? BrandColors.primary : '#FFFFFF',
            }}
            onPress={() => onToggleSelect?.(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
          >
            {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
          </TouchableOpacity>
        )}

        <View className="flex-1">
          <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: badge.bg }}>
              <Text className="text-[11px] font-bold" style={{ color: badge.text }}>{badge.label}</Text>
            </View>
            {isExtra && (
              <View className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold uppercase text-amber-700">Phát sinh</Text>
              </View>
            )}
            {item.code && (
              <Text className={`ml-auto text-xs font-semibold ${isSelected ? 'text-primary font-bold' : 'text-slate-400'}`}>
                #{item.code}
              </Text>
            )}
          </View>

          <Text className="mb-2.5 text-[15px] font-bold leading-[22px] text-slate-900" numberOfLines={2}>
            {getTaskDisplayName(item)}
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
            {!isSelectionMode && <Feather name="chevron-right" size={16} color="#94A3B8" />}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function TasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; search?: string; projectId?: string; assigneeId?: string; deadline?: string; deadlineFrom?: string; deadlineTo?: string; dateType?: string; sortBy?: string; sortDir?: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StatusFilter>(STATUS_TABS.some(tab => tab.id === params.status) ? params.status as StatusFilter : 'ALL');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('MINE');
  const [searchQuery, setSearchQuery] = useState(params.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState(params.search || '');
  const [page, setPage] = useState(1);
  const PAGE_LIMIT = 50;

  // Multi-select & Bulk Assign states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery.trim()); setPage(1); setSelectedTaskIds([]); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const currentUserId = user?.id;
  const userRole = user?.role;
  const canViewAllTasks = isManagementRole(userRole) || isProjectManagerRole(userRole) || isSalesRole(userRole);


  // Lắng nghe nút Back phần cứng trên Android: nếu đang chọn nhiều, bấm Back chỉ thoát Selection Mode
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTaskIds.length > 0) {
        setSelectedTaskIds([]);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [selectedTaskIds.length]);

  const { data: tasksRes, isLoading, isFetching, isError, refetch } = useTasksQuery({
    search: debouncedSearch || undefined,
    projectId: params.projectId, deadline: params.deadline, deadlineFrom: params.deadlineFrom, deadlineTo: params.deadlineTo, dateType: params.dateType, sortBy: params.sortBy, sortDir: params.sortDir,
    status: activeTab !== 'ALL' ? activeTab : undefined,
    assigneeId: params.assigneeId || (scopeFilter === 'MINE' || !canViewAllTasks ? currentUserId : undefined),
    page: 1,
    limit: PAGE_LIMIT * page,
  });

  const tasks: TaskItem[] = useMemo(() => {
    if (!tasksRes) return [];
    if (Array.isArray(tasksRes)) return tasksRes;
    return tasksRes.data || [];
  }, [tasksRes]);

  const selectedTaskIdsSet = useMemo(() => new Set(tasks.filter(item => selectedTaskIds.includes(item.id) && getTaskPolicy(item, user).assign.enabled).map(item => item.id)), [tasks, selectedTaskIds, user]);
  const isSelectionMode = selectedTaskIdsSet.size > 0;

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
    setSelectedTaskIds([]);
    setActiveTab(status);
    setPage(1);
  };

  const handleScopeFilterChange = (scope: ScopeFilter) => {
    setSelectedTaskIds([]);
    setScopeFilter(scope);
    setPage(1);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Nếu chọn xem "Của tôi", chỉ giữ lại các task mà mình làm chính hoặc hỗ trợ
      if (scopeFilter === 'MINE' && currentUserId) {
        const isAssignee = (t as any).assigneeId === currentUserId || t.assignee?.id === currentUserId;
        const isHelper = (t as any).helperId === currentUserId || (t as any).helper?.id === currentUserId;
        const isSupportLead = (t as any).supportLeadId === currentUserId;
        if (!isAssignee && !isHelper && !isSupportLead) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, scopeFilter, currentUserId]);

  const selectableTasks = useMemo(() => filteredTasks.filter(item => getTaskPolicy(item, user).assign.enabled), [filteredTasks, user]);
  const canSelectTasks = selectableTasks.length > 0;
  const selectionProjectId = tasks.find(item => selectedTaskIdsSet.has(item.id))?.project?.id;
  // Các thao tác chọn nhiều
  const handleToggleSelectTask = useCallback((id: string) => {
    const item = tasks.find(item => item.id === id);
    const state = getTaskPolicy(item, user).assign;
    if (!state.enabled) return;
    if (selectedTaskIds.length && item?.project?.id !== selectionProjectId) { Alert.alert('Chọn công việc', 'Vui lòng chọn các công việc trong cùng một dự án.'); return; }
    Haptics.selectionAsync();
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, [tasks, user, selectedTaskIds, selectionProjectId]);

  const handleTaskLongPress = useCallback(
    (item: TaskItem) => {
      handleToggleSelectTask(item.id);
    },
    [handleToggleSelectTask]
  );

  const isAllFilteredSelected = useMemo(() => {
    return (
      selectableTasks.length > 0 &&
      selectableTasks.filter(task => task.project?.id === selectionProjectId).every((t) => selectedTaskIdsSet.has(t.id))
    );
  }, [selectableTasks, selectedTaskIdsSet, selectionProjectId]);

  const handleToggleSelectAll = useCallback(() => {
    Haptics.selectionAsync();
    const firstProject = selectionProjectId || selectableTasks[0]?.project?.id;
    const allFilteredIds = selectableTasks.filter(item => item.project?.id === firstProject).map((t) => t.id);
    const isAllSelected =
      allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedTaskIdsSet.has(id));

    if (isAllSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(allFilteredIds);
    }
  }, [selectableTasks, selectionProjectId, selectedTaskIdsSet]);

  const handleCancelSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const selectedTasksForAssign = useMemo(() => {
    return tasks.filter((t) => selectedTaskIdsSet.has(t.id) && getTaskPolicy(t, user).assign.enabled);
  }, [tasks, selectedTaskIdsSet, user]);

  const handleOpenBulkAssignModal = useCallback(() => {
    if (selectedTasksForAssign.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAssignModal(true);
  }, [selectedTasksForAssign.length]);

  const renderStatusTab = useCallback(
    ({ item }: { item: { id: StatusFilter; label: string } }) => {
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
    },
    [activeTab]
  );

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

  const renderTaskCard = useCallback(
    ({ item }: { item: TaskItem }) => {
      return (
        <TaskCardItem
          item={item}
          getStatusBadge={getStatusBadge}
          onPress={handleTaskPress}
          onLongPress={handleTaskLongPress}
          isSelectionMode={isSelectionMode}
          isSelected={selectedTaskIdsSet.has(item.id)}
          onToggleSelect={handleToggleSelectTask}
        />
      );
    },
    [
      getStatusBadge,
      handleTaskPress,
      handleTaskLongPress,
      isSelectionMode,
      selectedTaskIdsSet,
      handleToggleSelectTask,
    ]
  );

  const keyExtractor = useCallback((item: TaskItem) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header — Biến đổi sang Selection Header khi ở Chế độ chọn */}
      {isSelectionMode ? (
        <View className="flex-row items-center justify-between border-b border-orange-200 bg-orange-50/80 px-4 py-3">
          <TouchableOpacity
            className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs"
            onPress={handleCancelSelection}
            activeOpacity={0.7}
          >
            <Feather name="x" size={15} color="#475569" />
            <Text className="text-xs font-bold text-slate-700">Hủy</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-primary" />
            <Text className="text-[15px] font-bold text-slate-900">
              Đã chọn {selectedTaskIdsSet.size} việc
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-xl bg-primary px-3 py-1.5 shadow-xs"
            onPress={handleToggleSelectAll}
            activeOpacity={0.8}
          >
            <Text className="text-xs font-bold text-white">
              {isAllFilteredSelected ? 'Bỏ chọn' : 'Chọn hết'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-[10px] bg-slate-100"
            onPress={() => safeGoBack(router, '/')}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Nhiệm vụ & Tiến độ</Text>
          {canSelectTasks ? (
            <TouchableOpacity
              disabled={selectableTasks.length === 0}
              className="flex-row items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5"
              onPress={() => {
                Haptics.selectionAsync();
                if (selectableTasks.length > 0) {
                  setSelectedTaskIds([selectableTasks[0].id]);
                }
              }}
              activeOpacity={0.7}
            >
              <Feather name="check-square" size={14} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary">Chọn</Text>
            </TouchableOpacity>
          ) : (
            <View className="w-10" />
          )}
        </View>
      )}

      {/* Search Input (Tạm ẩn khi đang ở chế độ chọn để giữ màn hình gọn gàng) */}
      {!isSelectionMode && (
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
      )}

      {/* Scope Filter Switcher (Chỉ hiển thị cho Quản lý / PM / Sales khi không chọn nhiều) */}
      {canViewAllTasks && !isSelectionMode && (
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
      {!isSelectionMode && (
        <View className="border-b border-slate-200 bg-white pb-2">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={STATUS_TABS}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-2 px-4"
            renderItem={renderStatusTab}
          />
        </View>
      )}

      {/* Total Count Bar */}
      {totalTasksCount > 0 && !isSelectionMode && (
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
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-[13px] text-slate-400">Đang tải danh sách công việc...</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-4">
          <Text className="text-sm text-slate-600">Không thể tải danh sách công việc.</Text>
          <TouchableOpacity onPress={() => refetch()} className="rounded-xl bg-orange-50 px-4 py-3"><Text>Thử lại</Text></TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={filteredTasks}
          keyExtractor={keyExtractor}
          renderItem={renderTaskCard}
          contentContainerStyle={{ padding: 16, paddingBottom: isSelectionMode ? 100 : 24 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!isFetching && !isError && tasks.length < totalTasksCount) {
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

      {/* Floating Bulk Action Bar — Nằm trong Thumb Zone đáy màn hình */}
      {selectedTaskIdsSet.size > 0 && (
        <View
          className="absolute bottom-20 left-4 right-4 z-50 flex-row items-center justify-between rounded-2xl border border-orange-200 bg-white px-4 py-3"
          style={{
            shadowColor: '#F38820',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.22,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-orange-100 px-2.5 py-0.5">
              <Text className="text-xs font-black text-orange-700">{selectedTaskIdsSet.size}</Text>
            </View>
            <Text className="text-xs font-semibold text-slate-700">việc đã chọn</Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center gap-2 rounded-xl bg-primary px-4 py-2.5"
            onPress={handleOpenBulkAssignModal}
            activeOpacity={0.8}
          >
            <Feather name="users" size={15} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">
              Phân công ({selectedTaskIdsSet.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Task Assign Modal (Dùng chung cho cả Phân công hàng loạt) */}
      {showAssignModal && (
        <TaskAssignModal
          visible={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          task={selectedTasksForAssign as any}
          onSuccess={() => {
            setSelectedTaskIds([]);
            refetch();
          }}
        />
      )}

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
