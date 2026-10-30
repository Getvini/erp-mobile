import { useAuthStore } from '@/stores/useAuthStore';
import { isManagementRole } from '@/utils/rbac';
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Job, JobCriteriaInput } from '@/services/jobService';
import { useSyncJobCriteriasMutation } from '@/hooks/queries/useJobs';
import JobCriteriaEditor from './JobCriteriaEditor';

interface EditJobCriteriaModalProps {
  visible: boolean;
  onClose: () => void;
  job: Job | null;
  onSuccess?: () => void;
}

export default function EditJobCriteriaModal(props: EditJobCriteriaModalProps) {
  return props.visible && props.job ? <CriteriaSheet key={props.job.id} {...props} /> : null;
}

function CriteriaSheet({
  visible,
  onClose,
  job,
  onSuccess,
}: EditJobCriteriaModalProps) {
  const canWrite = isManagementRole(useAuthStore((state) => state.user?.role));
  const [criteria, setCriteria] = useState<JobCriteriaInput[]>(() => (job?.criteria || []).map((item) => ({ id: item.id, name: item.name, description: item.description || '' })));
  const [showErrors, setShowErrors] = useState(false);

  const syncMutation = useSyncJobCriteriasMutation();
  const isSubmitting = syncMutation.isPending;



  const handleSubmit = async () => {
    if (!canWrite || !job?.id || isSubmitting) return;

    // Kiểm tra tên tiêu chí có bị để trống không
    const hasEmptyName = criteria.some((c) => !String(c.name || '').trim());
    if (hasEmptyName) {
      setShowErrors(true);
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên cho tất cả các tiêu chí trước khi lưu.');
      return;
    }

    try {
      await syncMutation.mutateAsync({
        jobId: job.id,
        criteria: criteria.map((c) => ({
          id: c.id,
          name: String(c.name).trim(),
          description: c.description ? String(c.description).trim() : '',
        })),
      });

      Alert.alert('Thành công', 'Cập nhật tiêu chí đánh giá thành công.');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      Alert.alert('Lỗi cập nhật', err?.message || 'Không thể cập nhật tiêu chí.');
    }
  };

  if (!visible || !job) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-900/50 justify-end"
      >
        <View className="bg-white rounded-t-[24px] p-5 max-h-[88%] gap-3">
          {/* Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-[17px] font-extrabold text-slate-900">
                  Cấu hình tiêu chí QC
                </Text>
                {job.code ? (
                  <View className="px-2 py-0.5 rounded bg-sky-50 border border-sky-100">
                    <Text className="text-[11px] font-bold text-sky-700">#{job.code}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                {job.name || 'Hạng mục công việc'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
              accessibilityLabel="Đóng modal"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-2 flex-row items-center gap-2">
              <Feather name="info" size={14} color="#D97706" />
              <Text className="text-[11px] text-amber-800 flex-1 leading-[16px]">
                Thiết lập các tiêu chí chuẩn để kiểm tra và nghiệm thu công việc khi bàn giao.
              </Text>
            </View>

            <JobCriteriaEditor
              criteria={criteria}
              onChange={setCriteria}
              showErrors={showErrors}
            />
          </ScrollView>

          {/* Footer Actions */}
          <View className="flex-row justify-end gap-2.5 border-t border-slate-100 pt-3">
            <TouchableOpacity
              className="px-4 py-3 rounded-xl bg-slate-100 min-h-[48px] justify-center"
              onPress={onClose}
              disabled={isSubmitting || !canWrite}
            >
              <Text className="text-sm font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-5 py-3 rounded-xl bg-primary min-h-[48px] justify-center ${
                isSubmitting ? 'opacity-60' : ''
              }`}
              onPress={handleSubmit}
              disabled={isSubmitting || !canWrite}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Lưu tiêu chí</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
