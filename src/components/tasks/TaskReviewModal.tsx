import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { TaskDetail } from '@/services/taskService';
import {
  useFinalizeTaskMutation,
  useRejectTaskMutation,
  useTaskReviewsQuery,
} from '@/hooks/queries/useTasks';
import TaskResultChecksPanel from './TaskResultChecksPanel';

interface TaskReviewModalProps {
  visible: boolean;
  onClose: () => void;
  task: TaskDetail | null;
  onSuccess: () => void;
}

export default function TaskReviewModal({
  visible,
  onClose,
  task,
  onSuccess,
}: TaskReviewModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState<'TEAM_LEAD' | 'ASSIGNER'>('TEAM_LEAD');

  const { data: reviewsData, isLoading: isLoadingReviews } = useTaskReviewsQuery(
    visible && task?.id ? task.id : ''
  );
  const reviews = useMemo(() => (Array.isArray(reviewsData) ? reviewsData : []), [reviewsData]);

  useEffect(() => {
    if (visible && reviews.length > 0) {
      const nextPassedIds = reviews.filter((r: any) => r.isPassed).map((r: any) => r.id);
      setPassedIds((prev) => {
        const isSame =
          prev.length === nextPassedIds.length &&
          prev.every((reviewId, index) => reviewId === nextPassedIds[index]);
        return isSame ? prev : nextPassedIds;
      });
    } else if (!visible) {
      setPassedIds((prev) => (prev.length === 0 ? prev : []));
      setNote('');
    }
  }, [visible, reviews]);

  const leadReviews = reviews.filter((r) => r.reviewerType === 'TEAM_LEAD');
  const assignerReviews = reviews.filter((r) => r.reviewerType === 'ASSIGNER');

  const isLeadPassed = leadReviews.length === 0 || leadReviews.every((r) => passedIds.includes(r.id));
  const isAssignerPassed = assignerReviews.length === 0 || assignerReviews.every((r) => passedIds.includes(r.id));
  const isAllPassed = isLeadPassed && isAssignerPassed;
  const isDualReview = leadReviews.length > 0 && assignerReviews.length > 0;

  const handleToggleReview = (reviewId: string) => {
    setPassedIds((prev) =>
      prev.includes(reviewId) ? prev.filter((id) => id !== reviewId) : [...prev, reviewId]
    );
  };

  const handleOpenResultUrl = (url?: string) => {
    if (!url) return;
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    Linking.openURL(target).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết kết quả.');
    });
  };

  const finalizeTaskMutation = useFinalizeTaskMutation();
  const rejectTaskMutation = useRejectTaskMutation();
  const isFinalizing = finalizeTaskMutation.isPending;
  const isRejecting = rejectTaskMutation.isPending;

  const handleFinalize = async () => {
    if (!task?.id) return;
    if (!isAllPassed && reviews.length > 0) {
      Alert.alert('Cảnh báo', 'Bạn cần tích chọn xác nhận tất cả các tiêu chí trước khi duyệt.');
      return;
    }

    try {
      await finalizeTaskMutation.mutateAsync({
        taskId: task.id,
        payload: {
          passedCriteriaIds: passedIds,
          reviewNote: note.trim(),
          projectId: task.project?.id,
        },
      });

      Alert.alert('Thành công', 'Đã duyệt hoàn thành công việc thành công!');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi duyệt công việc.');
    }
  };

  const handleApprove = handleFinalize;

  const handleReject = async () => {
    if (!task?.id) return;
    if (!note.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập ghi chú lý do từ chối công việc.');
      return;
    }

    try {
      await rejectTaskMutation.mutateAsync({
        taskId: task.id,
        payload: {
          passedCriteriaIds: passedIds,
          reviewNote: note.trim(),
          projectId: task.project?.id,
        },
      });

      Alert.alert('Thành công', 'Đã từ chối kết quả công việc.');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi từ chối công việc.');
    }
  };

  if (!task) return null;

  const currentDisplayedReviews = isDualReview
    ? activeTab === 'TEAM_LEAD'
      ? leadReviews
      : assignerReviews
    : reviews;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1" behavior="padding">
      <TouchableOpacity className="flex-1 bg-slate-900/50 justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          className="bg-surface rounded-t-3xl"
          style={{ maxHeight: Math.round((height - insets.top) * 0.92) }}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <View className="flex-1">
              <Text className="text-base font-extrabold text-text-primary">Đánh giá & Duyệt công việc</Text>
              <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                {task.name}
              </Text>
            </View>
            <TouchableOpacity className="p-1.5 rounded-lg bg-slate-100" onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Task Result Box */}
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <View className="flex-row items-center gap-2.5 mb-3">
                <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center">
                  <Feather name="file-text" size={18} color="#F38820" />
                </View>
                <Text className="text-sm font-bold text-text-primary">Kết quả công việc</Text>
              </View>

              {task.result ? (
                <View className="bg-background border border-border rounded-xl p-3 gap-2.5">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center">
                      <Feather
                        name={task.result.type === 'LINK' ? 'link' : 'file'}
                        size={20}
                        color="#F38820"
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
                        {task.result.name || task.code || 'Kết quả công việc'}
                      </Text>
                      {task.result.note && (
                        <Text className="text-xs text-slate-500 mt-0.5">{task.result.note}</Text>
                      )}
                    </View>
                  </View>

                  {task.result.url && (
                    <TouchableOpacity
                      className="flex-row items-center justify-center gap-1.5 bg-primary py-2 rounded-lg"
                      onPress={() => handleOpenResultUrl(task.result?.url)}
                      activeOpacity={0.8}
                    >
                      <Feather name="external-link" size={13} color="#FFFFFF" />
                      <Text className="text-xs font-bold text-white">Xem ngay</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View className="py-4 items-center justify-center">
                  <Text className="text-xs text-slate-400 italic">Chưa có kết quả để đánh giá</Text>
                </View>
              )}
            </View>

            {task.result?.url && (
              <View className="mb-4">
                <TaskResultChecksPanel taskId={task.id} projectId={task.project?.id} />
              </View>
            )}

            {/* Criteria Evaluation Card */}
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <View className="flex-row items-center gap-2.5 mb-3">
                <View className="w-8 h-8 rounded-lg bg-emerald-50 items-center justify-center">
                  <Feather name="check-circle" size={18} color="#10B981" />
                </View>
                <Text className="text-sm font-bold text-text-primary">Tiêu chí đánh giá</Text>
              </View>

              {isLoadingReviews ? (
                <View className="flex-row items-center justify-center gap-2 py-4">
                  <ActivityIndicator size="small" color="#F38820" />
                  <Text className="text-xs text-slate-500">Đang tải danh sách tiêu chí...</Text>
                </View>
              ) : (
                <>
                  {isDualReview && (
                    <View className="flex-row bg-slate-100 rounded-xl p-1 mb-3">
                      <TouchableOpacity
                        className={`flex-1 py-2 items-center rounded-lg ${
                          activeTab === 'TEAM_LEAD' ? 'bg-surface shadow-xs' : ''
                        }`}
                        onPress={() => setActiveTab('TEAM_LEAD')}
                      >
                        <Text
                          className={`text-xs ${
                            activeTab === 'TEAM_LEAD' ? 'font-extrabold text-primary' : 'font-semibold text-slate-500'
                          }`}
                        >
                          Team Lead ({isLeadPassed ? 'Đã duyệt' : 'Đang đợi'})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className={`flex-1 py-2 items-center rounded-lg ${
                          activeTab === 'ASSIGNER' ? 'bg-surface shadow-xs' : ''
                        }`}
                        onPress={() => setActiveTab('ASSIGNER')}
                      >
                        <Text
                          className={`text-xs ${
                            activeTab === 'ASSIGNER' ? 'font-extrabold text-primary' : 'font-semibold text-slate-500'
                          }`}
                        >
                          Người giao việc ({isAssignerPassed ? 'Đã duyệt' : 'Đang đợi'})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {currentDisplayedReviews.length > 0 ? (
                    <View className="gap-2.5">
                      {currentDisplayedReviews.map((review) => {
                        const isChecked = passedIds.includes(review.id);
                        return (
                          <TouchableOpacity
                            key={review.id}
                            className={`flex-row items-center gap-3 border rounded-xl p-3 ${
                              isChecked ? 'bg-emerald-50/60 border-emerald-200' : 'bg-background border-border'
                            }`}
                            onPress={() => handleToggleReview(review.id)}
                            activeOpacity={0.7}
                          >
                            <View
                              className={`w-[22px] h-[22px] rounded-md border-2 items-center justify-center ${
                                isChecked ? 'bg-success border-success' : 'border-slate-300'
                              }`}
                            >
                              {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
                            </View>
                            <View className="flex-1">
                              <Text
                                className={`text-sm font-bold ${
                                  isChecked ? 'text-emerald-800' : 'text-slate-700'
                                }`}
                              >
                                {review.criteria?.name || 'Tiêu chí đánh giá'}
                              </Text>
                              {review.criteria?.description && (
                                <Text className="text-xs text-slate-500 mt-0.5">
                                  {review.criteria.description}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="py-4 items-center justify-center">
                      <Text className="text-xs text-slate-400 italic">
                        Không có tiêu chí đánh giá bắt buộc cho loại công việc này.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Note Input */}
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <View className="flex-row items-center gap-2.5 mb-3">
                <View className="w-8 h-8 rounded-lg bg-purple-50 items-center justify-center">
                  <Feather name="message-square" size={18} color="#8B5CF6" />
                </View>
                <Text className="text-sm font-bold text-text-primary">Ghi chú / Phản hồi</Text>
              </View>
              <TextInput
                className="bg-background border border-border rounded-xl p-3 text-xs text-text-primary h-20 text-left"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
                placeholder="Nhập ghi chú hoặc lý do đánh giá/từ chối..."
                placeholderTextColor="#94A3B8"
                value={note}
                onChangeText={setNote}
              />
            </View>

            {!isAllPassed && reviews.length > 0 && (
              <Text className="text-xs font-bold text-amber-600 text-center mb-3">
                * Bạn cần xác nhận tất cả các tiêu chí trước khi duyệt
              </Text>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View
            className="flex-row gap-3 px-5 pt-3 border-t border-border bg-surface"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl border border-red-200 bg-red-50 ${
                !note.trim() || isRejecting || isFinalizing ? 'opacity-50' : ''
              }`}
              onPress={handleReject}
              disabled={!note.trim() || isRejecting || isFinalizing}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Feather name="x-circle" size={16} color="#EF4444" />
                  <Text className="text-sm font-bold text-danger">Từ chối</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-[2] flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl bg-success ${
                !isAllPassed || isFinalizing || isRejecting ? 'opacity-50' : ''
              }`}
              onPress={handleApprove}
              disabled={!isAllPassed || isFinalizing || isRejecting}
            >
              {isFinalizing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Duyệt hoàn thành</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
