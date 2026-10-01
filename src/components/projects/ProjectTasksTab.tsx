import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';

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
  const isAssigned = ['DOING', 'REWORKING', 'OVERDUE', 'REJECTED'].includes(item.status || '');
  const isExtra = isExtraTaskItem(item);

  return (
    <TouchableOpacity
      className={`relative gap-2 overflow-hidden rounded-xl border p-3 ${
        isSelected
          ? 'border-primary bg-emerald-50'
          : isExtra
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-slate-200 bg-white'
      }`}
      onPress={() => onPress(item.id)}
      activeOpacity={0.85}
    >
      {isExtra && <View className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />}
      <View className="flex-row flex-wrap items-center gap-1.5">
        {/* Checkbox luôn hiện với task có thể phân công */}
        {canAssign && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggleSelect(item.id); }}
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

interface ProjectTasksTabProps {
  tasks: TaskDetail[];
  isLoading: boolean;
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
  projectStatus,
  canAssignTasks = false,
  canCreateProjectWork = false,
  canManageTaskAssignment = () => false,
  selectedTaskIds: propSelectedTaskIds,
  onToggleSelectTask,
  onToggleSelectGroup,
  onOpenUpdateTask,
  onAssignTask,
  onOpenAddExtraTask,
}: ProjectTasksTabProps) {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [internalSelectedTaskIds, setInternalSelectedTaskIds] = useState<string[]>([]);

  const selectedTaskIds = propSelectedTaskIds !== undefined ? propSelectedTaskIds : internalSelectedTaskIds;

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

  // Tự động dọn task đã được phân công khỏi internal selection
  useEffect(() => {
    if (propSelectedTaskIds === undefined) {
      setInternalSelectedTaskIds((prev) =>
        prev.filter((id) => assignableTaskIdSet.has(id))
      );
    }
  }, [assignableTaskIdSet, propSelectedTaskIds]);

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
          (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
        ),
        assignableTaskIds: groups[key].assignableTaskIds,
      }))
      .sort((a, b) => a.jobName.localeCompare(b.jobName, 'vi'));
  }, [tasks]);

  if (isLoading) {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-500">Đang tải danh sách công việc...</Text>
      </View>
    );
  }

  return (
    <View className="relative gap-3 p-4 pb-[90px]">
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

      {tasks.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="check-square" size={40} color="#CBD5E1" />
          <Text className="text-[15px] font-bold text-slate-600">Chưa có công việc nào</Text>
          <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
            Dự án này hiện chưa có công việc triển khai. Bấm "Thêm việc phát sinh" để tạo mới.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {groupedTasks.map((group) => {
            const isCollapsed = collapsedGroups[group.id];
            const hasAssignable = group.assignableTaskIds.length > 0;
            const isAllGroupSelected =
              hasAssignable && group.assignableTaskIds.every((id) => selectedTaskIdsSet.has(id));

            return (
              <View key={group.id} className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                <TouchableOpacity
                  className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-3"
                  onPress={() => toggleGroup(group.id)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 flex-row items-center gap-2">
                    <Feather
                      name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                      size={18}
                      color="#475569"
                    />
                    <Text className="flex-1 text-[13px] font-bold text-slate-800" numberOfLines={1}>
                      {group.jobName}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {canAssignTasks && hasAssignable && (
                      <TouchableOpacity
                        onPress={() => toggleSelectGroup(group.tasks)}
                        className="flex-row items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-[3px]"
                        activeOpacity={0.7}
                      >
                        <Feather
                          name={isAllGroupSelected ? 'check-square' : 'square'}
                          size={14}
                          color={BrandColors.primary}
                        />
                        <Text className="text-[11px] font-bold text-primary">Chọn nhóm</Text>
                      </TouchableOpacity>
                    )}

                    <View className="rounded-[10px] bg-slate-200 px-2 py-0.5">
                      <Text className="text-[11px] font-bold text-slate-600">{group.tasks.length} việc</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {!isCollapsed && (
                  <View className="gap-2.5 p-2.5">
                    {group.tasks.map((item) => (
                      <TaskCard
                        key={item.id}
                        item={item}
                        isSelected={selectedTaskIdsSet.has(item.id)}
                        canAssign={canAssignTasks && assignableTaskIdSet.has(item.id)}
                        isPendingConfirmation={isPendingConfirmation}
                        canManageAssignment={canManageTaskAssignment(item)}
                        onToggleSelect={toggleSelectTask}
                        onPress={handlePressTask}
                        onAssign={handleAssignTask}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
