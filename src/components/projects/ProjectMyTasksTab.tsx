import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { apiService } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';

/**
 * Tab "Công việc của tôi" (P1.11) — mirror `TaskTable bulkAction="start"` của Web:
 * chỉ chọn được việc đang ở NOT_STARTED, đã giao cho mình, và dự án đang chạy.
 */
const STARTABLE_TASK_STATUS = 'NOT_STARTED';
const PROJECT_STARTABLE_STATUSES = ['IN_PROGRESS', 'CONFIRMED'];

interface ProjectMyTasksTabProps {
  tasks: TaskDetail[];
  isLoading?: boolean;
  /** ID người dùng hiện tại — dùng để lọc việc được phân công cho mình. */
  currentUserId?: string;
  projectStatus?: string;
  /** Gọi lại sau khi bắt đầu việc để cha refresh danh sách task/dự án. */
  onChanged?: () => void;
}

export default function ProjectMyTasksTab({
  tasks,
  isLoading = false,
  currentUserId,
  projectStatus,
  onChanged,
}: ProjectMyTasksTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return tasks.filter(
      (t) => t.assigneeId === currentUserId || (t as any).assignee?.id === currentUserId
    );
  }, [tasks, currentUserId]);

  const isProjectStartable = PROJECT_STARTABLE_STATUSES.includes(projectStatus || '');

  const isTaskStartable = useCallback(
    (task: TaskDetail): boolean =>
      isProjectStartable &&
      task.status === STARTABLE_TASK_STATUS &&
      (task.assigneeId === currentUserId || (task as any).assignee?.id === currentUserId),
    [isProjectStartable, currentUserId],
  );

  const startableTasks = useMemo(
    () => myTasks.filter(isTaskStartable),
    [myTasks, isTaskStartable],
  );

  /**
   * Bỏ chọn những việc không còn khả năng "Bắt đầu" (đổi trạng thái sau khi refresh).
   * Điều chỉnh state trong lúc render thay vì useEffect (tránh set-state-in-effect).
   */
  const startableSignature = startableTasks.map((task) => task.id).join(',');
  const [syncedSignature, setSyncedSignature] = useState(startableSignature);
  if (startableSignature !== syncedSignature) {
    setSyncedSignature(startableSignature);
    const startableIds = new Set(startableTasks.map((task) => task.id));
    setSelectedTaskIds((prev) => {
      const next = prev.filter((id) => startableIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }

  /**
   * KHÔNG có `useBulkStartTasksMutation` trong `@/hooks/queries/useTasks` và `taskService`
   * cũng chưa có `bulkStartTasks` (không được phép sửa 2 file đó), nên dùng mutation nội bộ
   * gọi đúng endpoint đang dùng ở Web: `PATCH /tasks/:id/start`.
   */
  const bulkStartMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const results = await Promise.all(taskIds.map((id) => apiService.patch(`/tasks/${id}/start`)));
      const failed = results.find((r: any) => r?.error);
      if (failed) throw new Error((failed as any).error);
      return taskIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkStart = () => {
    if (selectedTaskIds.length === 0) return;
    Alert.alert(
      'Bắt đầu công việc',
      `Bắt đầu ${selectedTaskIds.length} công việc đã chọn?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Bắt đầu',
          onPress: async () => {
            try {
              const count = await bulkStartMutation.mutateAsync(selectedTaskIds);
              Alert.alert('Thành công', `Đã bắt đầu ${count} công việc.`);
              setSelectedTaskIds([]);
              setIsSelectMode(false);
              onChanged?.();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể bắt đầu công việc.');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status?: string) => {
    const config = TASK_STATUS_CONFIG[status || 'PENDING'];
    return {
      bg: config?.bg || '#F1F5F9',
      color: config?.color || '#64748B',
      label: config?.text || status || '—',
    };
  };

  if (isLoading) {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-500">Đang tải công việc của bạn...</Text>
      </View>
    );
  }

  return (
    <View className="gap-3 p-4">
      {/* Action bar */}
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[15px] font-bold text-slate-950">
          Công việc của tôi ({myTasks.length})
        </Text>
        {startableTasks.length > 0 && (
          <TouchableOpacity
            className={`h-12 flex-row items-center gap-1.5 rounded-xl border px-3 ${
              isSelectMode ? 'border-primary bg-orange-50' : 'border-slate-200 bg-slate-50'
            }`}
            onPress={() => {
              setIsSelectMode((prev) => !prev);
              setSelectedTaskIds([]);
            }}
            activeOpacity={0.8}
          >
            <Feather
              name={isSelectMode ? 'check-square' : 'square'}
              size={14}
              color={isSelectMode ? BrandColors.primary : '#475569'}
            />
            <Text
              className={`text-xs ${
                isSelectMode ? 'font-bold text-primary' : 'font-semibold text-slate-600'
              }`}
            >
              {isSelectMode ? 'Hủy chọn' : 'Chọn nhiều'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bulk start */}
      {isSelectMode && (
        <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-3">
          <TouchableOpacity
            className="py-2 pr-2"
            onPress={() =>
              setSelectedTaskIds(
                selectedTaskIds.length === startableTasks.length
                  ? []
                  : startableTasks.map((t) => t.id)
              )
            }
            activeOpacity={0.7}
          >
            <Text className="text-[13px] font-semibold text-slate-400">
              {selectedTaskIds.length > 0 && selectedTaskIds.length === startableTasks.length
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`h-12 flex-row items-center gap-2 rounded-xl bg-primary px-4 ${
              selectedTaskIds.length === 0 || bulkStartMutation.isPending ? 'opacity-50' : ''
            }`}
            disabled={selectedTaskIds.length === 0 || bulkStartMutation.isPending}
            onPress={handleBulkStart}
            activeOpacity={0.8}
          >
            {bulkStartMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="play" size={15} color="#FFFFFF" />
                <Text className="text-[13px] font-bold text-white">
                  Bắt đầu công việc
                  {selectedTaskIds.length > 0 ? ` (${selectedTaskIds.length})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {myTasks.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="user-check" size={40} color="#CBD5E1" />
          <Text className="text-[15px] font-bold text-slate-600">
            Bạn chưa được phân công công việc nào trong dự án này
          </Text>
          <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
            Công việc được giao cho bạn sẽ hiển thị tại đây.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {myTasks.map((item) => {
            const statusInfo = getStatusBadge(item.status);
            const progress = item.progress ?? (item.status === 'DONE' ? 100 : 0);
            const canStart = isTaskStartable(item);
            const isSelected = selectedTaskIds.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                className={`gap-2 rounded-xl border bg-white p-3 ${
                  isSelected ? 'border-primary bg-orange-50' : 'border-slate-200'
                } ${isSelectMode && !canStart ? 'opacity-55' : ''}`}
                onPress={() => {
                  if (isSelectMode) {
                    if (canStart) toggleSelectTask(item.id);
                  } else {
                    router.push(`/tasks/${item.id}` as any);
                  }
                }}
                activeOpacity={0.85}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    {isSelectMode && (
                      <View className="pr-0.5">
                        <Feather
                          name={isSelected ? 'check-square' : canStart ? 'square' : 'minus-square'}
                          size={18}
                          color={isSelected ? BrandColors.primary : canStart ? '#94A3B8' : '#CBD5E1'}
                        />
                      </View>
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

                  {canStart && !isSelectMode && (
                    <View className="rounded bg-emerald-50 px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold text-emerald-600">Sẵn sàng bắt đầu</Text>
                    </View>
                  )}
                </View>

                <Text className="text-[13px] font-bold text-slate-950">{item.name}</Text>
                {item.description ? (
                  <Text className="text-xs leading-4 text-slate-500" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View className="mt-0.5 flex-row items-center gap-4">
                  <View className="flex-row items-center gap-1">
                    <Feather name="briefcase" size={12} color="#64748B" />
                    <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                      {(item as any).job?.name || 'Hạng mục hợp đồng'}
                    </Text>
                  </View>
                  {(item.dueDate || item.plannedEndDate) && (
                    <View className="flex-row items-center gap-1">
                      <Feather name="calendar" size={12} color="#64748B" />
                      <Text className="text-[11px] text-slate-500">
                        {formatDateToDDMMYYYY(item.dueDate || item.plannedEndDate, '—')}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="mt-1.5 gap-0.5 border-t border-slate-100 pt-2">
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
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
