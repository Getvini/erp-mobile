import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { REWORK_STATUSES } from '@/utils/taskLifecycle';

const codeCollator = new Intl.Collator(undefined, { numeric: true });
const groupCollator = new Intl.Collator('vi');

const isExtraTaskItem = (t: TaskDetail): boolean =>
  Boolean(t.isExtraTask || (t as any).isExtra);

export const isTaskAssignable = (t: TaskDetail): boolean => {
  if (t.assigneeId || (t as any).assignee?.id) return false;
  const st = t.status || 'PENDING';
  return ['PENDING', 'REJECTED', 'AWAITING_SUPPORT'].includes(st);
};

const getStatusBadge = (status?: string) => {
  const stKey = status || 'PENDING';
  const config = TASK_STATUS_CONFIG[stKey];
  return {
    bg: config?.bg || '#F1F5F9',
    color: config?.color || '#64748B',
    label: config?.text || stKey,
  };
};

interface TaskCardProps {
  item: TaskDetail;
  isSelected: boolean;
  canAssign: boolean;
  isPendingConfirmation: boolean;
  canManageAssignment: boolean;
  onToggleSelect: (id: string) => void;
  onPress: (id: string) => void;
  onAssign: (item: TaskDetail) => void;
}

/**
 * TaskCard — React.memo: chỉ re-render đúng task bị thay đổi.
 * Checkbox tick luôn hiển thị với task assignable (không cần toggle select mode).
 */
const TaskCard = React.memo(function TaskCard({
  item,
  isSelected,
  canAssign,
  isPendingConfirmation,
  canManageAssignment,
  onToggleSelect,
  onPress,
  onAssign,
}: TaskCardProps) {
  const statusInfo = getStatusBadge(item.status);
  const progress = item.progress ?? (item.status === 'DONE' ? 100 : 0);
  const isUnassigned = !item.assigneeId && (item.status === 'PENDING' || item.status === 'AWAITING_SUPPORT');
  const isAssigned = ['DOING', 'OVERDUE', ...REWORK_STATUSES].includes(item.status || '');
  const isExtra = isExtraTaskItem(item);

  return (
    <TouchableOpacity
      className={`relative gap-2 overflow-hidden rounded-xl border p-3 ${
        isSelected
          ? 'border-2 border-primary bg-orange-50/90'
          : isExtra
            ? 'border-amber-200 bg-amber-50/60'
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
      onPress={() => onPress(item.id)}
      onLongPress={() => {
        if (canAssign) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onToggleSelect(item.id);
        }
      }}
      delayLongPress={350}
      activeOpacity={0.85}
    >
      {isExtra && <View className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />}
      <View className="flex-row flex-wrap items-center gap-1.5">
        {/* Checkbox luôn hiện với task có thể phân công */}
        {canAssign && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.selectionAsync();
              onToggleSelect(item.id);
            }}
            className="pr-0.5"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={isSelected ? 'check-square' : 'square'}
              size={18}
              color={isSelected ? BrandColors.primary : '#CBD5E1'}
            />
          </TouchableOpacity>
        )}
        {item.code ? (
          <View className="rounded bg-blue-50 px-1.5 py-0.5">
            <Text className="text-[11px] font-bold text-primary">{item.code}</Text>
          </View>
        ) : null}
        <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: statusInfo.bg }}>
          <Text className="text-[10px] font-bold" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {isExtra && (
          <View className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-amber-700">Phát sinh</Text>
          </View>
        )}
      </View>

      <Text className="text-[13px] font-bold text-slate-950">{item.nickname ?? item.name}</Text>
      {item.description ? (
        <Text className="text-xs leading-4 text-slate-500" numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {/* Assignee & Due Date */}
      <View className="mt-0.5 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1">
          <Feather name="user" size={12} color={isUnassigned ? '#D97706' : '#64748B'} />
          <Text className={`text-[11px] ${isUnassigned ? 'font-bold text-amber-600' : 'text-slate-500'}`}>
            {item.assignee?.fullName || 'Chưa phân công'}
          </Text>
        </View>
        {item.dueDate && (
          <View className="flex-row items-center gap-1">
            <Feather name="calendar" size={12} color="#64748B" />
            <Text className="text-[11px] text-slate-500">{item.dueDate}</Text>
          </View>
        )}
      </View>

      {/* Progress Bar & Actions */}
      <View className="mt-1.5 flex-row items-center justify-between gap-2.5 border-t border-slate-100 pt-2">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] text-slate-400">Tiến độ</Text>
            <Text className="text-[10px] font-bold text-slate-600">{progress}%</Text>
          </View>
          <View className="h-1 overflow-hidden rounded-sm bg-slate-100">
            <View
              className="h-full rounded-sm bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </View>
        </View>

        {!isPendingConfirmation && canManageAssignment && (
          isUnassigned ? (
            <TouchableOpacity
              className="flex-row items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5"
              onPress={() => onAssign(item)}
              activeOpacity={0.7}
            >
              <Feather name="user-plus" size={13} color="#FFFFFF" />
              <Text className="text-[11px] font-bold text-white">Phân công</Text>
            </TouchableOpacity>
          ) : isAssigned ? (
            <TouchableOpacity
              className="flex-row items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5"
              onPress={() => onAssign(item)}
              activeOpacity={0.7}
            >
              <Feather name="user-check" size={13} color="#D97706" />
              <Text className="text-[11px] font-bold text-amber-600">Đổi người</Text>
            </TouchableOpacity>
          ) : null
        )}
      </View>
    </TouchableOpacity>
  );
});

interface GroupHeaderRowProps {
  group: { id: string; jobName: string; tasks: TaskDetail[]; assignableTaskIds: string[] };
  isCollapsed: boolean;
  canAssignTasks: boolean;
  isAllGroupSelected: boolean;
  onToggleGroup: (groupId: string) => void;
  onToggleSelectGroup: (groupTasks: TaskDetail[]) => void;
}

const GroupHeaderRow = React.memo(function GroupHeaderRow({
  group,
  isCollapsed,
  canAssignTasks,
  isAllGroupSelected,
  onToggleGroup,
  onToggleSelectGroup,
}: GroupHeaderRowProps) {
  return (
    <View className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <TouchableOpacity
        className="min-h-12 flex-row items-center gap-2 px-3.5 py-3"
        onPress={() => onToggleGroup(group.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
      >
        <Feather name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={18} color="#475569" />
        <Text className="flex-1 text-[13px] font-bold text-slate-800" numberOfLines={1}>{group.jobName}</Text>
        <Text className="text-xs text-slate-600">{group.tasks.length} việc</Text>
      </TouchableOpacity>
      {canAssignTasks && group.assignableTaskIds.length > 0 && (
        <TouchableOpacity
          onPress={() => onToggleSelectGroup(group.tasks)}
          className={`min-h-11 flex-row items-center gap-2 border-t px-3.5 py-2 ${
            isAllGroupSelected ? 'bg-orange-50/70 border-orange-200' : 'border-slate-200'
          }`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isAllGroupSelected }}
        >
          <Feather name={isAllGroupSelected ? 'check-square' : 'square'} size={16} color={BrandColors.primary} />
          <Text className="text-xs font-bold text-primary">
            {isAllGroupSelected ? 'Bỏ chọn nhóm' : 'Chọn nhóm'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

interface ProjectTasksTabProps {
  tasks: TaskDetail[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  projectStatus?: string;
  canAssignTasks?: boolean;
  canCreateProjectWork?: boolean;
  canManageTaskAssignment?: (task: TaskDetail) => boolean;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (taskId: string) => void;
  onToggleSelectGroup?: (groupTasks: TaskDetail[]) => void;
  onOpenUpdateTask?: (task: TaskDetail) => void;
  onAssignTask?: (task: TaskDetail | TaskDetail[]) => void;
  onOpenAddExtraTask: () => void;
}

export default function ProjectTasksTab({
  tasks,
  isLoading,
  isRefreshing = false,
  onRefresh,
  projectStatus,
  canAssignTasks = false,
  canCreateProjectWork = false,
  canManageTaskAssignment = () => false,
  selectedTaskIds: propSelectedTaskIds,
  onToggleSelectTask,
  onToggleSelectGroup,
  onAssignTask,
  onOpenAddExtraTask,
}: ProjectTasksTabProps) {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [internalSelectedTaskIds, setInternalSelectedTaskIds] = useState<string[]>([]);

  const selectedTaskIds = useMemo(() => propSelectedTaskIds ?? internalSelectedTaskIds.filter(
    (id) => tasks.some((task) => task.id === id && isTaskAssignable(task)),
  ), [propSelectedTaskIds, internalSelectedTaskIds, tasks]);

  // Set lookup O(1) thay cho Array.includes O(N) khi render hàng loạt item
  const selectedTaskIdsSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const assignableTasks = useMemo(() => tasks.filter(isTaskAssignable), [tasks]);
  const assignableTaskIdSet = useMemo(
    () => new Set(assignableTasks.map((t) => t.id)),
    [assignableTasks]
  );

  const toggleSelectTask = useCallback((taskId: string) => {
    if (onToggleSelectTask) {
      onToggleSelectTask(taskId);
    } else {
      setInternalSelectedTaskIds((prev) =>
        prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
      );
    }
  }, [onToggleSelectTask]);

  const toggleSelectGroup = useCallback((groupTasks: TaskDetail[]) => {
    if (onToggleSelectGroup) {
      onToggleSelectGroup(groupTasks);
      return;
    }

    const groupAssignable = groupTasks.filter(isTaskAssignable);
    if (groupAssignable.length === 0) return;

    const assignableIds = groupAssignable.map((t) => t.id);
    const isAllGroupSelected = assignableIds.every((id) => selectedTaskIdsSet.has(id));

    if (isAllGroupSelected) {
      setInternalSelectedTaskIds((prev) => prev.filter((id) => !assignableIds.includes(id)));
    } else {
      setInternalSelectedTaskIds((prev) => Array.from(new Set([...prev, ...assignableIds])));
    }
  }, [onToggleSelectGroup, selectedTaskIdsSet]);

  const handlePressTask = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}` as any);
  }, [router]);

  const handleAssignTask = useCallback((item: TaskDetail) => {
    onAssignTask?.(item);
  }, [onAssignTask]);

  const isPendingConfirmation = projectStatus === 'PENDING_CONFIRMATION';

  // Gom nhóm task và tính sẵn assignableTaskIds để tránh filter lặp lại trong render
  const groupedTasks = useMemo(() => {
    const groups: Record<
      string,
      { jobName: string; tasks: TaskDetail[]; assignableTaskIds: string[] }
    > = {};

    tasks.forEach((t) => {
      const job = (t as any).job;
      const isExtra = isExtraTaskItem(t);

      const jobId = job?.id || (t as any).jobId || (isExtra ? `extra_${t.id}` : 'contract_default');
      const jobName = job?.name || (isExtra ? t.name : 'Hạng mục hợp đồng');

      if (!groups[jobId]) {
        groups[jobId] = { jobName, tasks: [], assignableTaskIds: [] };
      }
      groups[jobId].tasks.push(t);
      if (isTaskAssignable(t)) {
        groups[jobId].assignableTaskIds.push(t.id);
      }
    });

    return Object.keys(groups)
      .map((key) => ({
        id: key,
        jobName: groups[key].jobName,
        tasks: groups[key].tasks.sort((a, b) =>
          codeCollator.compare(a.code || '', b.code || '')
        ),
        assignableTaskIds: groups[key].assignableTaskIds,
      }))
      .sort((a, b) => groupCollator.compare(a.jobName, b.jobName));
  }, [tasks]);

  // Tách từng task thành một row: nhóm lớn cũng chỉ dựng các thẻ trong vùng nhìn.
  const rows = useMemo(() => groupedTasks.flatMap((group) => [
    { key: 'group:' + group.id, group, task: null as TaskDetail | null },
    ...(collapsedGroups[group.id] ? [] : group.tasks.map((task) => ({
      key: 'task:' + task.id, group, task: task as TaskDetail | null,
    }))),
  ]), [groupedTasks, collapsedGroups]);

  const renderRow = useCallback(
    ({ item: row }: { item: (typeof rows)[number] }) => {
      const { group, task } = row;
      if (task) {
        return (
          <View className="mb-2.5">
            <TaskCard
              item={task}
              isSelected={selectedTaskIdsSet.has(task.id)}
              canAssign={canAssignTasks && assignableTaskIdSet.has(task.id)}
              isPendingConfirmation={isPendingConfirmation}
              canManageAssignment={canManageTaskAssignment(task)}
              onToggleSelect={toggleSelectTask}
              onPress={handlePressTask}
              onAssign={handleAssignTask}
            />
          </View>
        );
      }
      const isAllGroupSelected =
        group.assignableTaskIds.length > 0 &&
        group.assignableTaskIds.every((id) => selectedTaskIdsSet.has(id));
      return (
        <GroupHeaderRow
          group={group}
          isCollapsed={Boolean(collapsedGroups[group.id])}
          canAssignTasks={canAssignTasks}
          isAllGroupSelected={isAllGroupSelected}
          onToggleGroup={toggleGroup}
          onToggleSelectGroup={toggleSelectGroup}
        />
      );
    },
    [
      selectedTaskIdsSet,
      canAssignTasks,
      assignableTaskIdSet,
      isPendingConfirmation,
      canManageTaskAssignment,
      toggleSelectTask,
      handlePressTask,
      handleAssignTask,
      collapsedGroups,
      toggleGroup,
      toggleSelectGroup,
    ],
  );

  const keyExtractor = useCallback((row: (typeof rows)[number]) => row.key, []);
  const getItemType = useCallback((row: (typeof rows)[number]) => (row.task ? 'task' : 'group'), []);

  return (
    <FlashList
      data={isLoading ? [] : rows}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      getItemType={getItemType}
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[BrandColors.primary]}
          tintColor={BrandColors.primary}
        />
      }
      ListHeaderComponent={
        <View className="gap-3 pb-3">
          {/* Pending Confirmation Warning Banner */}
          {isPendingConfirmation && (
            <View className="flex-row items-start gap-2.5 rounded-xl border border-orange-100 bg-orange-50 p-3">
              <Feather name="lock" size={18} color="#C2410C" />
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-orange-700">Dự án chưa được Account chấp nhận</Text>
                <Text className="mt-0.5 text-[11px] leading-4 text-orange-800">
                  Tất cả các tính năng phân công, tạo việc phát sinh và cập nhật tiến độ đều bị tạm khóa cho đến khi Lead chấp nhận dự án.
                </Text>
              </View>
            </View>
          )}

          {/* Top Action Bar */}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-950" numberOfLines={1}>
                Hạng mục công việc
              </Text>
              <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={1}>
                Tổng cộng {tasks.length}
              </Text>
            </View>

            {!isPendingConfirmation && canCreateProjectWork && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 rounded-xl bg-primary px-3 py-2"
                onPress={onOpenAddExtraTask}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={15} color="#FFFFFF" />
                <Text className="text-[12px] font-bold text-white" numberOfLines={1}>
                  Thêm việc
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3" accessibilityLabel="Đang tải danh sách công việc">
            <Text className="text-sm text-slate-500">Đang tải danh sách công việc...</Text>
            {[0, 1, 2].map((key) => (
              <View key={key} className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <View className="h-4 w-24 rounded bg-slate-100" />
                <View className="h-4 w-3/4 rounded bg-slate-100" />
                <View className="h-3 w-1/2 rounded bg-slate-100" />
                <View className="h-2 rounded bg-slate-100" />
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center gap-2 py-10">
            <Feather name="check-square" size={40} color="#CBD5E1" />
            <Text className="text-[15px] font-bold text-slate-600">Chưa có công việc nào</Text>
            <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
              Dự án này hiện chưa có công việc triển khai.
            </Text>
          </View>
        )
      }
    />
  );
}
