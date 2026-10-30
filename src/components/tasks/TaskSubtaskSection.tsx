import { useAuth } from '@/context/AuthContext';
import { getTaskPolicy, getTaskActionState } from '@/utils/taskPolicy';
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { TASK_STATUS_CONFIG, type TaskDetail } from '@/services/taskService';
import {
  computeParentRemainingReward,
  computeSubtaskRewards,
  validateSubtaskAllocationTotal,
  type SubtaskAllocation,
  type SubtaskReward,
} from '@/utils/subtaskReward';
import { formatVND } from '@/utils/formatters';
import { REWORK_STATUSES } from '@/utils/taskLifecycle';
import SubtaskAllocationModal, { type SubtaskAssigneeOption } from './SubtaskAllocationModal';

/**
 * ⚠️ `TaskDetail` (src/services/taskService.ts) chưa khai báo `subtasks` / `parentTaskId` /
 * `job.vinicoin`. Theo yêu cầu KHÔNG sửa tầng service nên 2 interface mở rộng dưới đây
 * khai báo tại chỗ cho tầng UI. Khi service bổ sung field, chỉ cần xoá 2 interface này.
 */
export interface TaskSubtask {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  status?: string;
  allocationPercent?: number;
  rewardVinicoin?: number;
  dueDate?: string;
  plannedEndDate?: string;
  assigneeId?: string;
  assignee?: { id?: string; fullName?: string; name?: string } | null;
}

export interface TaskWithSubtasks extends TaskDetail {
  parentTaskId?: string | null;
  subtasks?: TaskSubtask[] | null;
}

interface TaskSubtaskSectionProps {
  task: TaskWithSubtasks | null;
  projectId?: string;
  /** Account phụ trách / ADMIN / PM — được thêm & sửa công việc con */
  canManage: boolean;
  /** Thành viên dự án để chọn người thực hiện cho công việc con (có thể rỗng) */
  assigneeOptions?: SubtaskAssigneeOption[];
  onChanged?: () => void;
}

/** Quỹ thưởng của task cha (Vinicoin) — nguồn: `task.job.vinicoin` */
export const getParentBudget = (task?: TaskWithSubtasks | null): number => {
  const job = (task as any)?.job;
  return Number(job?.vinicoin ?? 0) || 0;
};

const getPercent = (subtask?: TaskSubtask | null): number => {
  const value = Number(subtask?.allocationPercent || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** Hiển thị % gọn: 25 / 12,5 (không có số 0 vô nghĩa) */
const formatPercentLabel = (value: number): string => {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return `${String(rounded).replace('.', ',')}%`;
};

export default function TaskSubtaskSection({
  task,
  projectId,
  canManage,
  assigneeOptions = [],
  onChanged,
}: TaskSubtaskSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const policy = getTaskPolicy(task, user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<TaskSubtask | null>(null);

  const subtasks = useMemo(() => task?.subtasks || [], [task?.subtasks]);
  const latestEditingSubtask = editingSubtask ? subtasks.find((item: TaskSubtask) => item.id === editingSubtask.id) : undefined;
  const parentBudget = getParentBudget(task);

  const allocations: SubtaskAllocation[] = useMemo(
    () => subtasks.map((subtask) => ({ id: subtask.id, allocationPercent: getPercent(subtask) })),
    [subtasks]
  );

  const totalValidation = useMemo(() => validateSubtaskAllocationTotal(allocations), [allocations]);
  const allocatedPercent = totalValidation.totalBasisPoints / 100;

  /**
   * Thưởng chỉ tính được khi tổng phân bổ ≤ 100%
   * (`computeSubtaskRewards` ném RangeError khi vượt 100%).
   */
  const rewards: SubtaskReward[] = useMemo(() => {
    if (!totalValidation.valid) return [];
    try {
      return computeSubtaskRewards(parentBudget, allocations);
    } catch {
      return [];
    }
  }, [allocations, parentBudget, totalValidation.valid]);

  const parentRemainingReward = useMemo(() => {
    if (!totalValidation.valid) return 0;
    try {
      return computeParentRemainingReward(parentBudget, allocations);
    } catch {
      return 0;
    }
  }, [allocations, parentBudget, totalValidation.valid]);

  const remainingPercent = Math.max(0, 100 - allocatedPercent);

  const openCreateModal = () => {
    if (!policy.createSubtask.enabled) return;
    setEditingSubtask(null);
    setIsModalOpen(true);
  };

  const editPolicy = (subtask: TaskSubtask) => getTaskActionState({ ...subtask, parentTaskId: task?.id, project: task?.project }, user, 'editSubtask', { parentTask: task });
  const openEditModal = (subtask: TaskSubtask) => {
    if (!editPolicy(subtask).enabled) return;
    setEditingSubtask(subtask);
    setIsModalOpen(true);
  };

  // Chỉ render khi task đã có công việc con HOẶC người dùng có thể tạo công việc con
  if (subtasks.length === 0 && !policy.createSubtask.enabled) return null;

  /** % tối đa của dòng đang sửa = 100% - tổng % của các dòng KHÁC */
  const editingPercent = getPercent(editingSubtask);
  const otherAllocations = editingSubtask
    ? allocations.filter((item) => item.id !== editingSubtask.id)
    : allocations;
  const otherAllocatedPercent = editingSubtask
    ? Math.max(0, allocatedPercent - editingPercent)
    : allocatedPercent;

  return (
    <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
      {/* Header */}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2.5 flex-1">
          <View className="w-8 h-8 rounded-lg bg-orange-50 items-center justify-center">
            <Feather name="layers" size={16} color={BrandColors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-slate-900">
              Công việc con ({subtasks.length})
            </Text>
            <Text className="text-[10px] font-semibold text-slate-400">
              Phân bổ tỷ trọng % từ quỹ thưởng của công việc cha
            </Text>
          </View>
        </View>

        {policy.createSubtask.enabled && (
          <TouchableOpacity accessibilityLabel="Thêm công việc con"
            className="flex-row items-center gap-1.5 bg-primary px-3.5 min-h-[48px] rounded-xl"
            onPress={openCreateModal}
            activeOpacity={0.85}
            accessibilityRole="button">
            <Feather name="plus" size={15} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white">Thêm công việc con</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tổng phân bổ */}
      {policy.viewAllocation.visible && <View className="flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-1.5 bg-orange-50 border border-orange-100 px-2.5 py-1.5 rounded-lg">
          <Feather name="pie-chart" size={12} color="#C2410C" />
          <Text className="text-[11px] font-bold text-orange-700">
            Đã phân bổ {formatPercentLabel(allocatedPercent)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg">
          <Feather name="user" size={12} color="#1D4ED8" />
          <Text className="text-[11px] font-bold text-blue-700">
            Người làm task gốc {formatPercentLabel(remainingPercent)}
          </Text>
        </View>

      </View>

      }

      {/* Cảnh báo tổng vượt 100% */}
      {policy.viewAllocation.visible && !totalValidation.valid && (
        <View className="flex-row items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <Feather name="alert-triangle" size={14} color="#DC2626" />
          <Text className="flex-1 text-[11px] font-bold text-red-600">
            {totalValidation.message ||
              'Tổng tỷ lệ công việc con không được vượt quá 100%'}
          </Text>
        </View>
      )}

      {/* Danh sách công việc con */}
      {subtasks.length === 0 ? (
        <View className="py-5 items-center justify-center gap-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Feather name="layers" size={30} color="#CBD5E1" />
          <Text className="text-xs text-slate-400">Chưa có công việc con nào</Text>
        </View>
      ) : (
        <View className="gap-2">
          {subtasks.map((subtask) => {
            const statusConfig = TASK_STATUS_CONFIG[subtask.status || ''] || {
              text: subtask.status || 'Không xác định',
              color: '#64748B',
              bg: '#F1F5F9',
            };
            const reward = rewards.find((item) => item.id === subtask.id)?.reward ?? 0;
            const percent = getPercent(subtask);

            return (
              <TouchableOpacity
                key={subtask.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 gap-2"
                activeOpacity={0.7}
                onPress={() => {
                  if (subtask.id) {
                    router.push(`/tasks/${subtask.id}` as any);
                  }
                }}
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-slate-900" numberOfLines={2}>
                      {subtask.name || 'Công việc con'}
                    </Text>
                    {subtask.code ? (
                      <Text className="text-[10px] font-semibold text-slate-400">#{subtask.code}</Text>
                    ) : null}
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <View className="px-2 py-1 rounded-md" style={{ backgroundColor: statusConfig.bg }}>
                      <Text className="text-[10px] font-bold" style={{ color: statusConfig.color }}>
                        {statusConfig.text}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#94A3B8" />
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Text className="text-[10px] font-bold text-white">
                      {(subtask.assignee?.fullName || subtask.assignee?.name || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <Text className="flex-1 text-[11px] font-semibold text-slate-600" numberOfLines={1}>
                    {subtask.assignee?.fullName || subtask.assignee?.name || 'Chưa phân công'}
                  </Text>

                  {policy.viewAllocation.visible && <View className="bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md">
                    <Text className="text-[10px] font-bold text-orange-700">
                      {formatPercentLabel(percent)}
                    </Text>
                  </View>}

                  {editPolicy(subtask).enabled && (
                    <TouchableOpacity accessibilityLabel="Sửa công việc con"
                      className="w-10 h-10 rounded-xl bg-white border border-orange-200 items-center justify-center"
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openEditModal(subtask);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button">
                      <Feather name="edit-2" size={14} color={BrandColors.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {subtask.description ? (
                  <Text className="text-[11px] text-slate-500" numberOfLines={3}>
                    {subtask.description}
                  </Text>
                ) : null}

                {REWORK_STATUSES.includes(String(subtask.status || '')) ? (
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="rotate-ccw" size={11} color="#DC2626" />
                    <Text className="text-[10px] font-bold text-red-600">
                      Công việc con cần làm lại
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <SubtaskAllocationModal
        policy={editingSubtask ? (latestEditingSubtask ? editPolicy(latestEditingSubtask) : { visible: true, enabled: false, reasonCode: 'SUBTASK_MISSING', reason: 'Không tìm thấy công việc con mới nhất.' }) : policy.createSubtask}
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskId={task?.id || ''}
        projectId={projectId || task?.project?.id}
        subtask={editingSubtask}
        parentBudget={parentBudget}
        allocatedPercent={otherAllocatedPercent}
        existingAllocations={otherAllocations}
        assigneeOptions={assigneeOptions}
        onSuccess={onChanged}
      />
    </View>
  );
}
