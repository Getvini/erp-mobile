import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { getTaskDisplayName } from '@/utils/taskPolicy';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectTabHeader } from '@/components/projects/ProjectTabHeader';

interface ProjectExtraTasksTabProps {
  tasks: TaskDetail[];
  isLoading?: boolean;
  projectId?: string;
}

export default function ProjectExtraTasksTab({
  tasks,
  isLoading = false,
}: ProjectExtraTasksTabProps) {
  const router = useRouter();

  const extraTasks = useMemo(() => {
    return tasks
      .filter((t) => Boolean(t.isExtraTask || (t as any).isExtra))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
  }, [tasks]);

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
        <Text className="text-[13px] text-slate-500">Đang tải công việc phát sinh...</Text>
      </View>
    );
  }

  return (
    <View className="gap-3.5 p-4">
      {/* Header chuẩn hóa */}
      <ProjectTabHeader
        icon="alert-circle"
        title="Công việc phát sinh"
        subtitle={`Tổng cộng ${extraTasks.length} công việc ngoài hợp đồng`}
      />

      {/* Danh sách công việc hoặc Empty State */}
      {extraTasks.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="Chưa có công việc phát sinh"
          description="Dự án chưa có công việc phát sinh nào ngoài phạm vi hợp đồng."
        />
      ) : (
        <View className="gap-2.5">
          {extraTasks.map((task) => {
            const statusInfo = getStatusBadge(task.status);

            return (
              <View key={task.id} className="gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    {task.code ? (
                      <View className="rounded bg-blue-50 px-1.5 py-0.5">
                        <Text className="text-[11px] font-bold text-primary">{task.code}</Text>
                      </View>
                    ) : null}
                    <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: statusInfo.bg }}>
                      <Text className="text-[10px] font-bold" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                </View>

                <Text className="text-[13px] font-bold text-slate-950">{getTaskDisplayName(task)}</Text>
                {(task as any).job?.name ? (
                  <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                    {(task as any).job.name}
                  </Text>
                ) : null}

                <Text className="text-[11px] text-slate-500">
                  Tạo ngày: {formatDateToDDMMYYYY(task.createdAt, '—')}
                </Text>

                <TouchableOpacity
                  className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 active:opacity-80"
                  onPress={() => router.push(`/tasks/${task.id}` as any)}
                >
                  <Feather name="external-link" size={14} color="#475569" />
                  <Text className="text-xs font-bold text-slate-600">Xem công việc</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
