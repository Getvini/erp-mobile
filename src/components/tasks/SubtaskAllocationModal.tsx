import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { useAddSubtaskMutation, useUpdateSubtaskMutation } from '@/hooks/queries/useTasks';
import {
  computeSubtaskRewards,
  validateAllocationPercent,
  type SubtaskAllocation,
} from '@/utils/subtaskReward';
import { formatVND } from '@/utils/formatters';

/** Dữ liệu subtask tối thiểu mà modal cần để sửa */
export interface SubtaskFormValue {
  id: string;
  name?: string;
  assigneeId?: string;
  allocationPercent?: number;
  description?: string;
}

/** Một lựa chọn người thực hiện (lấy từ thành viên dự án nếu có sẵn dữ liệu) */
export interface SubtaskAssigneeOption {
  id: string;
  fullName?: string;
  name?: string;
}

interface SubtaskAllocationModalProps {
  visible: boolean;
  onClose: () => void;
  /** ID của task CHA (POST /tasks/:id/subtasks) */
  taskId: string;
  projectId?: string;
  /** Có giá trị ⇒ chế độ sửa (PATCH /tasks/:id/subtask, `id` là ID subtask) */
  subtask?: SubtaskFormValue | null;
  /** Quỹ thưởng của task cha (Vinicoin) — thường là `task.job.vinicoin` */
  parentBudget: number;
  /** Tổng % đã phân bổ của các subtask KHÁC (không gồm subtask đang sửa) */
  allocatedPercent: number;
  /** Danh sách phân bổ của các subtask khác — dùng cho xem trước thưởng realtime */
  existingAllocations?: SubtaskAllocation[];
  /** Thành viên dự án có thể giao việc (ẩn bộ chọn nếu rỗng) */
  assigneeOptions?: SubtaskAssigneeOption[];
  onSuccess?: () => void;
}

/**
 * Chuẩn hoá chuỗi % người dùng gõ (mirror erp-UI TaskDelegationPanel.jsx:501-510):
 * chỉ giữ số + dấu phân cách thập phân ĐẦU TIÊN (chấp nhận cả "," và "."), tối đa 2 chữ số thập phân.
 */
const normalizePercentInput = (raw: string): string => {
  const cleaned = String(raw || '').replace(/[^0-9.,]/g, '');
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, '');
  const separator = cleaned[separatorIndex];
  const decimalPart = cleaned
    .slice(separatorIndex + 1)
    .replace(/[.,]/g, '')
    .slice(0, 2);
  return `${integerPart}${separator}${decimalPart}`;
};

/** "12,5" | 12.5 → 12.5 */
const parsePercentInput = (value: string | number | undefined | null): number => {
  if (typeof value === 'string') return Number(value.trim().replace(',', '.'));
  return Number(value ?? 0);
};

export default function SubtaskAllocationModal({
  visible,
  onClose,
  taskId,
  projectId,
  subtask,
  parentBudget,
  allocatedPercent,
  existingAllocations = [],
  assigneeOptions = [],
  onSuccess,
}: SubtaskAllocationModalProps) {
  const isEditing = Boolean(subtask?.id);

  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [percentInput, setPercentInput] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Khoá đồng bộ form — reset form mỗi lần mở modal / đổi subtask đang sửa */
  const [formKey, setFormKey] = useState('');

  const addSubtaskMutation = useAddSubtaskMutation();
  const updateSubtaskMutation = useUpdateSubtaskMutation();
  const isPending = addSubtaskMutation.isPending || updateSubtaskMutation.isPending;

  // % tối đa có thể phân bổ cho dòng này (mirror erp-UI TaskDelegationPanel.jsx:196)
  const editablePercent = Math.max(0, 100 - Number(allocatedPercent || 0));

  /**
   * Điều chỉnh state trong lúc render khi mở modal / đổi subtask (React khuyến nghị,
   * KHÔNG setState trong useEffect để tránh cascading render).
   */
  const nextFormKey = visible ? `open:${subtask?.id || 'new'}` : '';
  if (nextFormKey !== formKey) {
    setFormKey(nextFormKey);
    if (nextFormKey) {
      setName(subtask?.name || '');
      setAssigneeId(subtask?.assigneeId || '');
      setPercentInput(
        subtask?.allocationPercent != null && Number(subtask.allocationPercent) > 0
          ? String(subtask.allocationPercent)
          : ''
      );
      setDescription(subtask?.description || '');
      setError(null);
    }
  }

  /** Xem trước thưởng realtime: computeSubtaskRewards(parentBudget, [...existing, {id:'new', ...}]) */
  const previewReward = useMemo(() => {
    const parsed = parsePercentInput(percentInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    try {
      const rewards = computeSubtaskRewards(parentBudget, [
        ...existingAllocations,
        { id: 'new', allocationPercent: parsed },
      ]);
      return rewards.find((item) => item.id === 'new')?.reward ?? null;
    } catch {
      // Tổng vượt 100% ⇒ thuật toán ném RangeError, không hiển thị xem trước
      return null;
    }
  }, [parentBudget, existingAllocations, percentInput]);

  const percentPreviewError = useMemo(() => {
    if (!percentInput.trim()) return null;
    return validateAllocationPercent(percentInput, editablePercent);
  }, [percentInput, editablePercent]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên công việc con');
      return;
    }

    const percentError = validateAllocationPercent(percentInput, editablePercent);
    if (percentError) {
      setError(percentError);
      return;
    }

    const allocationPercent = parsePercentInput(percentInput);
    setError(null);

    try {
      if (isEditing && subtask?.id) {
        await updateSubtaskMutation.mutateAsync({
          id: subtask.id,
          taskId,
          projectId,
          name: trimmedName,
          assigneeId: assigneeId || undefined,
          allocationPercent,
          description: description.trim() || undefined,
        });
      } else {
        await addSubtaskMutation.mutateAsync({
          id: taskId,
          projectId,
          name: trimmedName,
          assigneeId: assigneeId || undefined,
          allocationPercent,
          description: description.trim() || undefined,
        });
      }
      Alert.alert(
        'Thành công',
        isEditing ? 'Đã cập nhật công việc con' : 'Đã thêm công việc con'
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu công việc con');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-end">
        <View className="bg-white rounded-t-[24px] max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-slate-900">
                {isEditing ? 'Chỉnh sửa công việc con' : 'Thêm công việc con'}
              </Text>
              <Text className="text-[11px] font-semibold text-slate-500">
                Phân bổ tỷ trọng % quỹ thưởng của công việc cha
              </Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, gap: 14 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tỷ trọng còn lại */}
            <View className="flex-row items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-3">
              <Feather name="pie-chart" size={15} color={BrandColors.primary} />
              <Text className="flex-1 text-[13px] font-bold text-orange-800">
                Tỷ trọng có thể phân bổ: {editablePercent}%
              </Text>
            </View>

            {/* Tên */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">
                Tên công việc con <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-3.5 py-3 min-h-[48px] text-[13px] text-slate-900 bg-white"
                placeholder="Nhập phần công việc cần thực hiện"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                maxLength={255}
              />
            </View>

            {/* Người thực hiện */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">Người thực hiện</Text>
              {assigneeOptions.length === 0 ? (
                <View className="flex-row items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                  <Feather name="info" size={14} color="#64748B" />
                  <Text className="flex-1 text-[11px] text-slate-500">
                    Chưa có dữ liệu thành viên dự án để chọn người thực hiện.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {assigneeOptions.map((member) => {
                    const isSelected = assigneeId === member.id;
                    return (
                      <TouchableOpacity
                        key={member.id}
                        className={`flex-row items-center gap-2 px-3 min-h-[48px] rounded-xl border ${
                          isSelected ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white'
                        }`}
                        onPress={() => setAssigneeId(isSelected ? '' : member.id)}
                        activeOpacity={0.8}
                      >
                        <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                          <Text className="text-[10px] font-bold text-white">
                            {(member.fullName || member.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className={`text-xs ${isSelected ? 'font-bold text-primary' : 'font-semibold text-slate-600'}`}
                        >
                          {member.fullName || member.name || member.id}
                        </Text>
                        {isSelected && <Feather name="check" size={13} color={BrandColors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* % phân bổ */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">
                % phân bổ <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-row items-center border border-slate-200 rounded-xl px-3.5 bg-white">
                <TextInput
                  className="flex-1 py-3 min-h-[48px] text-[13px] text-slate-900"
                  placeholder="Ví dụ: 25 hoặc 12,5"
                  placeholderTextColor="#94A3B8"
                  value={percentInput}
                  onChangeText={(text) => setPercentInput(normalizePercentInput(text))}
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
                <Text className="text-[13px] font-bold text-slate-400">%</Text>
              </View>

              {percentPreviewError ? (
                <Text className="text-[11px] font-semibold text-red-600">{percentPreviewError}</Text>
              ) : null}

            </View>

            {/* Mô tả */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">Mô tả</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-3.5 py-3 min-h-[80px] text-[13px] text-slate-900 bg-white"
                placeholder="Yêu cầu và kết quả cần bàn giao"
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            {error ? (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text className="flex-1 text-[11px] font-bold text-red-600">{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View className="flex-row gap-3 px-5 pb-6 pt-3 border-t border-slate-100">
            <TouchableOpacity
              className="flex-1 min-h-[48px] py-3.5 rounded-xl border border-slate-200 items-center justify-center"
              onPress={onClose}
              disabled={isPending}
            >
              <Text className="text-sm font-semibold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-[2] min-h-[48px] flex-row items-center justify-center gap-2 bg-primary py-3.5 rounded-xl ${
                isPending ? 'opacity-60' : ''
              }`}
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {isPending ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Đang lưu...</Text>
                </>
              ) : (
                <>
                  <Feather name={isEditing ? 'save' : 'plus'} size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {isEditing ? 'Lưu thay đổi' : 'Thêm công việc con'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
