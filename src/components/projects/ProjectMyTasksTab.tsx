import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getTaskPolicy } from '@/utils/taskPolicy';
import { TaskDetail } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { useBulkStartTasksMutation } from '@/hooks/queries/useTasks';
import { ProjectTaskCard } from '@/components/projects/ProjectTaskCard';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectTabHeader } from '@/components/projects/ProjectTabHeader';

/**
 * Tab "Công việc của tôi" (P1.11) — mirror `TaskTable bulkAction="start"` của Web:
 * chỉ chọn được việc đang ở NOT_STARTED, đã giao cho mình, và dự án đang chạy.
 */
interface ProjectMyTasksTabProps {
  project?: any;
  projectId: string;
  tasks: TaskDetail[];
  isLoading?: boolean;
  /** ID người dùng hiện tại — dùng để lọc việc được phân công cho mình. */
  currentUserId?: string;
  projectStatus?: string;
  projectHasAccount: boolean;
  /** Gọi lại sau khi bắt đầu việc để cha refresh danh sách task/dự án. */
  onChanged?: () => void;
}

export default function ProjectMyTasksTab({
  project,
  projectId,
  tasks,
  isLoading = false,
  currentUserId,
  onChanged,
}: ProjectMyTasksTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedTaskIds] = useState<string[]>([]);

  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return tasks.filter(
      (t) =>
        t.assigneeId === currentUserId ||
        (t as any).assignee?.id === currentUserId ||
        t.helperId === currentUserId ||
        (t as any).helper?.id === currentUserId
    );
  }, [tasks, currentUserId]);

  const isTaskStartable = useCallback(
    (task: TaskDetail): boolean =>
      getTaskPolicy(task, user, { project: project || task.project }).start.enabled,
    [user, project]
  );

  const startableTasks = useMemo(
    () => myTasks.filter(isTaskStartable),
    [myTasks, isTaskStartable]
  );

  // Lọc selection từ dữ liệu hiện tại, không cập nhật state trong render.
  const selectedTaskIds = useMemo(() => {
    const startableIds = new Set(startableTasks.map((task) => task.id));
    return selectedIds.filter((taskId) => startableIds.has(taskId));
  }, [selectedIds, startableTasks]);

  const bulkStartMutation = useBulkStartTasksMutation();

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
            if (
              bulkStartMutation.isPending ||
              selectedTaskIds.some(
                (id) => !tasks.some((task) => task.id === id && isTaskStartable(task))
              )
            )
              return;
            try {
              await bulkStartMutation.mutateAsync({ projectId, taskIds: selectedTaskIds });
              Alert.alert('Thành công', `Đã bắt đầu ${selectedTaskIds.length} công việc.`);
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
      {/* Action bar / Header đồng bộ */}
      <ProjectTabHeader
        icon="user-check"
        title="Công việc của tôi"
        subtitle={`Tổng cộng ${myTasks.length} việc được phân công`}
        extraAction={
          startableTasks.length > 0 ? (
            <TouchableOpacity
              className={`h-10 flex-row items-center gap-1.5 rounded-xl border px-3 py-2 active:opacity-80 ${
                isSelectMode ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white'
              }`}
              onPress={() => {
                setIsSelectMode((prev) => !prev);
                setSelectedTaskIds([]);
              }}
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
          ) : undefined
        }
      />

      {/* Floating / Sticky Bar khi bật chế độ chọn nhiều */}
      {isSelectMode && (
        <View className="flex-row items-center justify-between gap-2 rounded-2xl border border-orange-100 bg-orange-50/90 px-4 py-2.5">
          <TouchableOpacity
            className="py-1.5 pr-2"
            onPress={() =>
              setSelectedTaskIds(
                selectedTaskIds.length === startableTasks.length
                  ? []
                  : startableTasks.map((t) => t.id)
              )
            }
            activeOpacity={0.7}
          >
            <Text className="text-xs font-semibold text-slate-700">
              {selectedTaskIds.length > 0 && selectedTaskIds.length === startableTasks.length
                ? 'Bỏ chọn tất cả'
                : `Chọn tất cả (${startableTasks.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 ${
              selectedTaskIds.length === 0 || bulkStartMutation.isPending ? 'opacity-50' : 'active:opacity-85'
            }`}
            disabled={selectedTaskIds.length === 0 || bulkStartMutation.isPending}
            onPress={handleBulkStart}
          >
            {bulkStartMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="play" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">
                  Bắt đầu ({selectedTaskIds.length})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Danh sách Task hoặc Empty State */}
      {myTasks.length === 0 ? (
        <EmptyState
          icon="user-check"
          title="Chưa có công việc được phân công"
          description="Công việc được phân công cho bạn trong dự án này sẽ hiển thị tại đây."
        />
      ) : (
        <View className="gap-2.5">
          {myTasks.map((item) => {
            const canStart = isTaskStartable(item);
            const isSelected = selectedTaskIds.includes(item.id);

            return (
              <ProjectTaskCard
                key={item.id}
                item={item}
                project={project}
                jobName={(item as any).job?.name || 'Hạng mục hợp đồng'}
                isSelected={isSelected}
                showCheckbox={isSelectMode}
                checkboxDisabled={!canStart}
                disabled={isSelectMode && !canStart}
                onToggleSelect={() => {
                  if (canStart) toggleSelectTask(item.id);
                }}
                onPress={() => {
                  if (isSelectMode) {
                    if (canStart) toggleSelectTask(item.id);
                  } else {
                    router.push(`/tasks/${item.id}` as any);
                  }
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
