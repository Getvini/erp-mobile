import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { getTaskDisplayName, getTaskPolicy } from '@/utils/taskPolicy';
import { formatDateToDDMMYYYY } from '@/utils/formatters';

const isExtraTaskItem = (t: TaskDetail): boolean =>
  Boolean(t.isExtraTask || (t as any).isExtra);

export const getTaskStatusBadge = (status?: string) => {
  const stKey = status || 'PENDING';
  const config = TASK_STATUS_CONFIG[stKey];
  return {
    bg: config?.bg || '#F1F5F9',
    color: config?.color || '#64748B',
    label: config?.text || stKey,
  };
};

export interface ProjectTaskCardProps {
  item: TaskDetail;
  project?: any;
  isSelected?: boolean;
  canAssign?: boolean;
  isPendingConfirmation?: boolean;
  canManageAssignment?: boolean;
  onToggleSelect?: (id: string) => void;
  onPress: (id: string) => void;
  onAssign?: (item: TaskDetail) => void;
  onEditNickname?: (item: TaskDetail) => void;
  /** Tùy chọn hiển thị tên công việc cha/hạng mục (VD: trong My Tasks) */
  jobName?: string;
  /** Ép hiển thị checkbox chọn (VD: trong chế độ Chọn nhiều) */
  showCheckbox?: boolean;
  /** Checkbox có bị khóa không */
  checkboxDisabled?: boolean;
  /** Disable touch style */
  disabled?: boolean;
}

export const ProjectTaskCard = React.memo(function ProjectTaskCard({
  item,
  project,
  isSelected = false,
  canAssign = false,
  isPendingConfirmation = false,
  canManageAssignment = false,
  onToggleSelect,
  onPress,
  onAssign,
  onEditNickname,
  jobName,
  showCheckbox = false,
  checkboxDisabled = false,
  disabled = false,
}: ProjectTaskCardProps) {
  const { user } = useAuth();
  const assignmentPolicy = getTaskPolicy(item, user, { project })[
    item.assigneeId || item.assignee?.id || (item as any).vendorId || (item as any).vendor ? 'reassign' : 'assign'
  ];
  const statusInfo = getTaskStatusBadge(item.status);
  const progress = item.progress ?? (item.status === 'DONE' ? 100 : 0);
  const isUnassigned = !item.assigneeId && (item.status === 'PENDING' || item.status === 'AWAITING_SUPPORT');
  const isExtra = isExtraTaskItem(item);

  const displayCheckbox = (canAssign && onToggleSelect) || showCheckbox;

  return (
    <TouchableOpacity
      className={`relative gap-2 overflow-hidden rounded-xl border p-3 ${
        isSelected
          ? 'border-2 border-primary bg-orange-50/90'
          : isExtra
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-slate-200 bg-white'
      } ${disabled ? 'opacity-55' : ''}`}
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
        if (canAssign && onToggleSelect) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onToggleSelect(item.id);
        }
      }}
      delayLongPress={350}
      activeOpacity={0.85}
    >
      {isExtra && <View className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />}
      
      {/* Header chips */}
      <View className="flex-row flex-wrap items-center gap-1.5">
        {displayCheckbox && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              if (checkboxDisabled) return;
              Haptics.selectionAsync();
              onToggleSelect?.(item.id);
            }}
            disabled={checkboxDisabled}
            className="pr-0.5"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={isSelected ? 'check-square' : checkboxDisabled ? 'minus-square' : 'square'}
              size={18}
              color={isSelected ? BrandColors.primary : checkboxDisabled ? '#CBD5E1' : '#94A3B8'}
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
        {isExtra && (
          <View className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-amber-700">Phát sinh</Text>
          </View>
        )}
      </View>

      {/* Task Name & Edit Nickname */}
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[13px] font-bold text-slate-950" numberOfLines={2}>
          {getTaskDisplayName(item)}
        </Text>
        {canManageAssignment && onEditNickname && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onEditNickname(item);
            }}
            hitSlop={8}
            className="h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
            accessibilityLabel="Đổi tên gợi nhớ công việc"
          >
            <Feather name="edit-2" size={11} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {item.description ? (
        <Text className="text-xs leading-4 text-slate-500" numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {/* Assignee / Job / Due Date */}
      <View className="mt-0.5 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {jobName ? (
          <View className="flex-row items-center gap-1">
            <Feather name="briefcase" size={12} color="#64748B" />
            <Text className="text-[11px] text-slate-500" numberOfLines={1}>
              {jobName}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <Feather name="user" size={12} color={isUnassigned ? '#D97706' : '#64748B'} />
            <Text className={`text-[11px] ${isUnassigned ? 'font-bold text-amber-600' : 'text-slate-500'}`}>
              {item.assignee?.fullName || 'Chưa phân công'}
            </Text>
          </View>
        )}
        {(item.dueDate || item.plannedEndDate) && (
          <View className="flex-row items-center gap-1">
            <Feather name="calendar" size={12} color="#64748B" />
            <Text className="text-[11px] text-slate-500">
              {formatDateToDDMMYYYY(item.dueDate || item.plannedEndDate, '—')}
            </Text>
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

        {assignmentPolicy?.enabled && onAssign && (
          <TouchableOpacity
            accessibilityLabel="Phân công công việc"
            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5"
            onPress={(event) => {
              event.stopPropagation();
              onAssign(item);
            }}
            accessibilityRole="button"
          >
            <Text className="text-xs font-bold text-orange-700">
              {item.assigneeId || item.assignee?.id || (item as any).vendor ? 'Đổi người' : 'Phân công'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default ProjectTaskCard;

