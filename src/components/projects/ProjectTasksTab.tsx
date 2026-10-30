import { useAuth } from '@/context/AuthContext';
import { getTaskPolicy, getTaskDisplayName } from '@/utils/taskPolicy';
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
import { EditTaskNicknameModal } from '@/components/tasks/EditTaskNicknameModal';
import { ProjectTaskCard } from '@/components/projects/ProjectTaskCard';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectTabHeader } from '@/components/projects/ProjectTabHeader';

const codeCollator = new Intl.Collator(undefined, { numeric: true });
const groupCollator = new Intl.Collator('vi');

const isExtraTaskItem = (t: TaskDetail): boolean =>
  Boolean(t.isExtraTask || (t as any).isExtra);

export const isTaskAssignable = (t: TaskDetail): boolean => {
  if (t.assigneeId || (t as any).assignee?.id) return false;
  const st = t.status || 'PENDING';
  return ['PENDING', 'REJECTED', 'AWAITING_SUPPORT'].includes(st);
};

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
        <View className="rounded-full bg-slate-200/80 px-2.5 py-0.5">
          <Text className="text-[11px] font-bold text-slate-700">{group.tasks.length} việc</Text>
        </View>
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
  project?: any;
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
  onOpenAddService: () => void;
  isProjectLead?: boolean;
  onOpenRequestStaffing?: () => void;
}

export default function ProjectTasksTab({
  project,
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
  onOpenAddService,
  isProjectLead = false,
  onOpenRequestStaffing,
}: ProjectTasksTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canAssignItem = useCallback((item: TaskDetail) => getTaskPolicy(item, user, { project, assignmentContext: 'batch' }).assign.enabled, [user, project]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [internalSelectedTaskIds, setInternalSelectedTaskIds] = useState<string[]>([]);
  const [editingNicknameTask, setEditingNicknameTask] = useState<TaskDetail | null>(null);

  const selectedTaskIds = useMemo(() => (propSelectedTaskIds ?? internalSelectedTaskIds).filter(
    (id) => tasks.some((task) => task.id === id && canAssignItem(task)),
  ), [propSelectedTaskIds, internalSelectedTaskIds, tasks, canAssignItem]);

  // Set lookup O(1) thay cho Array.includes O(N) khi render hàng loạt item
  const selectedTaskIdsSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const assignableTasks = useMemo(() => tasks.filter(canAssignItem), [tasks, canAssignItem]);
  const assignableTaskIdSet = useMemo(
    () => new Set(assignableTasks.map((t) => t.id)),
    [assignableTasks]
  );

  const toggleSelectTask = useCallback((taskId: string) => {
    const selectedTask = tasks.find(task => task.id === taskId);
    if (!selectedTask || !canAssignItem(selectedTask)) return;
    if (onToggleSelectTask) {
      onToggleSelectTask(taskId);
    } else {
      setInternalSelectedTaskIds((prev) =>
        prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
      );
    }
  }, [onToggleSelectTask, tasks, canAssignItem]);

  const toggleSelectGroup = useCallback((groupTasks: TaskDetail[]) => {
    if (onToggleSelectGroup) {
      onToggleSelectGroup(groupTasks);
      return;
    }

    const groupAssignable = groupTasks.filter(canAssignItem);
    if (groupAssignable.length === 0) return;

    const assignableIds = groupAssignable.map((t) => t.id);
    const isAllGroupSelected = assignableIds.every((id) => selectedTaskIdsSet.has(id));

    if (isAllGroupSelected) {
      setInternalSelectedTaskIds((prev) => prev.filter((id) => !assignableIds.includes(id)));
    } else {
      setInternalSelectedTaskIds((prev) => Array.from(new Set([...prev, ...assignableIds])));
    }
  }, [onToggleSelectGroup, selectedTaskIdsSet, canAssignItem]);

  const handlePressTask = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}` as any);
  }, [router]);

  const handleAssignTask = useCallback((item: TaskDetail) => {
    const state = getTaskPolicy(item, user, { project })[item.assigneeId || item.assignee?.id || (item as any).vendor ? 'reassign' : 'assign'];
    if (!state.enabled) return;
    onAssignTask?.(item);
  }, [onAssignTask, user, project]);

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
      if (canAssignItem(t)) {
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
  }, [tasks, canAssignItem]);

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
            <ProjectTaskCard
              item={task}
              project={project}
              isSelected={selectedTaskIdsSet.has(task.id)}
              canAssign={canAssignTasks && assignableTaskIdSet.has(task.id)}
              isPendingConfirmation={isPendingConfirmation}
              canManageAssignment={canManageTaskAssignment(task)}
              onToggleSelect={toggleSelectTask}
              onPress={handlePressTask}
              onAssign={handleAssignTask}
              onEditNickname={setEditingNicknameTask}
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
      project,
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
    <>
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

          {/* Top Action Bar chuẩn hóa */}
          <ProjectTabHeader
            icon="check-square"
            title="Hạng mục công việc"
            subtitle={`Tổng cộng ${tasks.length} công việc triển khai`}
            actionLabel={!isPendingConfirmation && canCreateProjectWork ? 'Thêm dịch vụ' : undefined}
            actionIcon="plus"
            onAction={onOpenAddService}
            extraAction={
              !isPendingConfirmation && isProjectLead && onOpenRequestStaffing ? (
                <TouchableOpacity
                  className="h-10 flex-row items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 active:opacity-80"
                  onPress={onOpenRequestStaffing}
                  accessibilityRole="button"
                  accessibilityLabel="Yêu cầu thêm người"
                >
                  <Feather name="user-plus" size={14} color={BrandColors.primary} />
                  <Text className="text-xs font-bold text-primary" numberOfLines={1}>
                    Thêm người
                  </Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
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
          <EmptyState
            icon="check-square"
            title="Chưa có công việc nào"
            description="Dự án này hiện chưa có công việc triển khai."
          />
        )
      }
    />
      <EditTaskNicknameModal
        visible={Boolean(editingNicknameTask)}
        task={editingNicknameTask}
        onClose={() => setEditingNicknameTask(null)}
      />
    </>
  );
}
