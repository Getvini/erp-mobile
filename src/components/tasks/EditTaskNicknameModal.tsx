import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { useUpdateTaskNicknameMutation } from '@/hooks/queries/useTasks';

interface EditTaskNicknameModalProps {
  visible: boolean;
  task: {
    id: string;
    code?: string;
    name?: string;
    nickname?: string | null;
    projectId?: string;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditTaskNicknameModal: React.FC<EditTaskNicknameModalProps> = ({
  visible,
  task,
  onClose,
  onSuccess,
}) => {
  const [nickname, setNickname] = useState('');
  const updateMutation = useUpdateTaskNicknameMutation();
  const isSubmitting = updateMutation.isPending;

  useEffect(() => {
    if (visible && task) {
      setNickname(task.nickname || '');
    }
  }, [visible, task]);

  const handleSave = async () => {
    if (!task) return;
    const trimmed = nickname.trim();
    const current = (task.nickname || '').trim();

    if (trimmed === current) {
      onClose();
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: task.id,
        nickname: trimmed || null,
        projectId: task.projectId,
      });
      Alert.alert('Thành công', 'Đã cập nhật tên gợi nhớ (nickname) cho công việc');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật tên gợi nhớ');
    }
  };

  if (!task) return null;

  const originalName = task.name || 'Công việc';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center bg-black/50 px-4"
        >
          <View className="rounded-2xl bg-white p-5 gap-4 shadow-xl">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <View className="flex-row items-center gap-2">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                  <Feather name="edit-2" size={17} color={BrandColors.primary} />
                </View>
                <View>
                  <Text className="text-base font-bold text-slate-900">Đổi tên công việc</Text>
                  {task.code ? (
                    <Text className="text-[11px] font-semibold text-slate-400">#{task.code}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8} disabled={isSubmitting}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Original name */}
            <View className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
              <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Tên gốc theo mẫu
              </Text>
              <Text className="text-xs font-bold text-slate-800 mt-0.5" numberOfLines={2}>
                {originalName}
              </Text>
            </View>

            {/* Input nickname */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">
                Tên gợi nhớ (Nickname)
              </Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900"
                placeholder="Nhập tên gọi riêng cho công việc này..."
                placeholderTextColor="#94A3B8"
                value={nickname}
                onChangeText={setNickname}
                maxLength={120}
                editable={!isSubmitting}
                autoFocus
              />
              <Text className="text-[11px] text-slate-400">
                Để trống để quay về tên gốc ban đầu.
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row gap-2.5 pt-2">
              <TouchableOpacity
                className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-100"
                onPress={onClose}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-semibold text-slate-600">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary ${
                  isSubmitting ? 'opacity-60' : ''
                }`}
                onPress={handleSave}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white">Lưu tên</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
