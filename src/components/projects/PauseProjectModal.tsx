import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  usePauseProjectDirectMutation,
  useRequestPauseProjectMutation,
} from '@/hooks/queries/useProjects';
import { PAUSE_DURATION_DAYS } from '@/utils/projectPause';

interface PauseProjectModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  /** true = BOD/ADMIN tạm dừng ngay; false = PM/BD gửi yêu cầu chờ duyệt. */
  isDirect: boolean;
  onSuccess: () => void;
}

/**
 * Bottom sheet Tạm dừng dự án (P1.11) — mirror `PauseProjectModal.jsx` của Web.
 */
export default function PauseProjectModal({
  visible,
  onClose,
  projectId,
  projectName,
  isDirect,
  onSuccess,
}: PauseProjectModalProps) {
  const [reason, setReason] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  const pauseDirectMutation = usePauseProjectDirectMutation();
  const requestPauseMutation = useRequestPauseProjectMutation();
  const isSubmitting = isDirect ? pauseDirectMutation.isPending : requestPauseMutation.isPending;

  // Reset lý do khi đóng modal — điều chỉnh state trong lúc render (tránh set-state-in-effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setReason('');
  }

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập lý do tạm dừng');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isDirect) {
        await pauseDirectMutation.mutateAsync({ id: projectId, reason: trimmed });
        Alert.alert('Thành công', 'Đã tạm dừng dự án.');
      } else {
        await requestPauseMutation.mutateAsync({ id: projectId, reason: trimmed });
        Alert.alert('Thành công', 'Đã gửi yêu cầu tạm dừng — đang chờ BOD duyệt.');
      }
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạm dừng dự án.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-slate-900/50" onPress={onClose}>
        <Pressable
          className="max-h-[85%] gap-3 rounded-t-[24px] bg-white p-5"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Draggable Handle Indicator Bar */}
          <View className="items-center mb-1">
            <View className="w-12 h-1.5 rounded-full bg-slate-300" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <View className="flex-1 flex-row items-center gap-2.5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
                <Feather name="pause-circle" size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">
                  {isDirect ? 'Tạm dừng dự án' : 'Yêu cầu tạm dừng dự án'}
                </Text>
                {projectName ? (
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {projectName}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="h-12 w-12 items-center justify-center"
              disabled={isSubmitting}
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="gap-3" showsVerticalScrollIndicator={false}>
            {/* Lý do */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-slate-600">
                Lý do tạm dừng <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                className="min-h-[96px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                placeholder="Ví dụ: Khách yêu cầu dừng chờ ngân sách quý 4..."
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                editable={!isSubmitting}
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-[11px] text-slate-400">
                Lý do này được ghi vào lịch sử tạm dừng và làm căn cứ nghiệm thu sau này.
              </Text>
            </View>

            {/* Cảnh báo tự động đóng */}
            <View className="flex-row items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3.5">
              <Feather name="alert-triangle" size={16} color="#D97706" style={{ marginTop: 2 }} />
              <View className="flex-1 gap-1">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                  Khi tạm dừng
                </Text>
                <Text className="text-xs font-medium leading-4 text-amber-800">
                  • Công việc dở dang bị khóa, không nộp/sửa/phân công được.{'\n'}• Công việc đã hoàn
                  thành giữ nguyên trạng thái.{'\n'}• Dự án sẽ tự động đóng sau {PAUSE_DURATION_DAYS}{' '}
                  ngày tạm dừng nếu không làm tiếp.
                </Text>
              </View>
            </View>

            {/* Cảnh báo quyền hạn */}
            <View
              className={`flex-row items-start gap-2 rounded-2xl border p-3.5 ${
                isDirect ? 'border-red-100 bg-red-50/60' : 'border-blue-100 bg-blue-50/60'
              }`}
            >
              <Feather
                name={isDirect ? 'alert-triangle' : 'shield'}
                size={16}
                color={isDirect ? '#DC2626' : '#2563EB'}
                style={{ marginTop: 2 }}
              />
              <Text
                className={`flex-1 text-xs font-medium leading-4 ${
                  isDirect ? 'text-red-800' : 'text-blue-800'
                }`}
              >
                {isDirect
                  ? 'Bạn đang tạm dừng trực tiếp với quyền BOD/ADMIN — dự án dừng ngay, không cần ai duyệt. Toàn bộ team sẽ nhận thông báo.'
                  : 'Yêu cầu sẽ được gửi tới BOD/ADMIN để duyệt. Dự án vẫn chạy bình thường cho tới khi được duyệt.'}
              </Text>
            </View>
          </ScrollView>

          {/* Footer actions (thumb zone) */}
          <View className="flex-row gap-2.5 border-t border-slate-100 pt-3.5">
            <TouchableOpacity
              className="h-12 flex-1 items-center justify-center rounded-xl bg-slate-100"
              onPress={onClose}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-bold text-slate-500">Hủy bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`h-12 flex-[2] flex-row items-center justify-center gap-2 rounded-xl ${
                isDirect ? 'bg-amber-500' : 'bg-primary'
              } ${isSubmitting ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {isDirect ? 'Tạm dừng ngay' : 'Gửi yêu cầu tạm dừng'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
