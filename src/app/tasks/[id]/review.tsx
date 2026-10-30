import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import {
  useTaskDetailQuery,
  useTaskReviewsQuery,
  useFinalizeTaskMutation,
  useRejectTaskMutation,
} from '@/hooks/queries/useTasks';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canToggleTaskReview, getTaskReviewPermissions } from '@/utils/taskOutcomeAuthorization';

export default function TaskReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const taskQuery = useTaskDetailQuery(String(id || ''));
  const reviewsQuery = useTaskReviewsQuery(String(id || ''));
  const { data: task } = taskQuery;
  const { data: reviewsData } = reviewsQuery;
  const reviews = useMemo(() => (Array.isArray(reviewsData) ? reviewsData : []), [reviewsData]);

  const [draft, setDraft] = useState<{ taskId: string; values: Record<string, boolean> }>({ taskId: '', values: {} });
  const passedIds = reviews.filter((review) => draft.taskId === id ? draft.values[review.id] ?? review.isPassed : review.isPassed).map((review) => review.id);
  const [note, setNote] = useState('');
  const [selectedTab, setSelectedTab] = useState<{ taskId: string; tab: 'TEAM_LEAD' | 'ASSIGNER' } | null>(null);
  const actor = { id: user?.id, role: user?.role };
  const permissions = getTaskReviewPermissions(task, actor);
  const activeTab = selectedTab?.taskId === id ? selectedTab.tab : permissions.isLead ? 'TEAM_LEAD' : permissions.isAssigner ? 'ASSIGNER' : 'TEAM_LEAD';
  const busy = useRef(false);
  const loading = taskQuery.isFetching || reviewsQuery.isFetching;
  const failed = taskQuery.isError || reviewsQuery.isError;
  const ready = taskQuery.isSuccess && reviewsQuery.isSuccess && !loading && !failed;

  const finalizeTaskMutation = useFinalizeTaskMutation();
  const rejectTaskMutation = useRejectTaskMutation();

  const isFinalizing = finalizeTaskMutation.isPending;
  const isRejecting = rejectTaskMutation.isPending;

  const leadReviews = reviews.filter((r) => r.reviewerType === 'TEAM_LEAD');
  const assignerReviews = reviews.filter((r) => r.reviewerType === 'ASSIGNER');

  const isLeadPassed = leadReviews.length === 0 || leadReviews.every((r) => passedIds.includes(r.id));
  const isAssignerPassed = assignerReviews.length === 0 || assignerReviews.every((r) => passedIds.includes(r.id));
  const isAllPassed = isLeadPassed && isAssignerPassed;
  const isDualReview = leadReviews.length > 0 && assignerReviews.length > 0;

  const handleToggleReview = (reviewId: string) => {
    const review = reviews.find((item) => item.id === reviewId);
    if (!ready || busy.current || !review || !canToggleTaskReview(task, reviews, review, actor)) return;
    setDraft((previous) => ({ taskId: String(id), values: {
      ...(previous.taskId === id ? previous.values : {}), [reviewId]: !passedIds.includes(reviewId),
    } }));
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

  const handleApprove = async () => {
    if (!id || !task || !ready || !permissions.canDecide || busy.current) return;
    if (!isAllPassed && reviews.length > 0) {
      Alert.alert('Cảnh báo', 'Bạn cần tích chọn xác nhận tất cả các tiêu chí trước khi duyệt.');
      return;
    }

    busy.current = true;
    try {
      const result = await finalizeTaskMutation.mutateAsync({
        taskId: id,
        payload: {
          passedCriteriaIds: passedIds,
          reviewNote: note.trim(),
          projectId: task.project?.id,
        },
      });

      if (!result.finalized) {
        Alert.alert('Chưa hoàn tất', result.message || 'Chưa đủ điều kiện hoàn tất. Vui lòng kiểm tra lại tiêu chí.');
        return;
      }
      Alert.alert('Thành công', 'Đã duyệt hoàn thành công việc thành công!');
      router.back();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể duyệt');
    } finally { busy.current = false; }
  };

  const handleReject = async () => {
    if (!id || !task || !ready || !permissions.canDecide || busy.current) return;
    if (!note.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập ghi chú lý do từ chối công việc.');
      return;
    }

    busy.current = true;
    try {
      await rejectTaskMutation.mutateAsync({
        taskId: id,
        payload: {
          passedCriteriaIds: passedIds,
          reviewNote: note.trim(),
          projectId: task.project?.id,
        },
      });

      Alert.alert('Thành công', 'Đã từ chối kết quả công việc.');
      router.back();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể từ chối');
    } finally { busy.current = false; }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-[#F8FAFC]">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-sm text-[#64748B] font-semibold">Đang tải thông tin đánh giá...</Text>
      </SafeAreaView>
    );
  }

  if (failed || !task || !ready) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-[#F8FAFC]">
        <Feather name="alert-circle" size={44} color="#EF4444" />
        <Text className="text-[15px] text-[#0F172A] font-bold text-center">Không tải được đầy đủ công việc và tiêu chí đánh giá.</Text>
        <TouchableOpacity className="min-h-[48px] px-5 justify-center rounded-lg bg-primary" onPress={() => { taskQuery.refetch(); reviewsQuery.refetch(); }}><Text className="text-white font-bold">Thử lại</Text></TouchableOpacity>
        <TouchableOpacity className="px-5 py-2.5 rounded-lg bg-primary" onPress={() => router.back()}>
          <Text className="text-white font-bold text-sm">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentDisplayedReviews = isDualReview
    ? activeTab === 'TEAM_LEAD'
      ? leadReviews
      : assignerReviews
    : reviews;

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-[#E2E8F0]">
        <TouchableOpacity className="w-9 h-9 rounded-lg bg-[#F1F5F9] items-center justify-center" onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-extrabold text-[#0F172A]">Đánh giá & Duyệt công việc</Text>
          <Text className="text-xs text-[#64748B] mt-0.5" numberOfLines={1}>{task.name}</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Result Card */}
        <View className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-9 h-9 rounded-lg items-center justify-center bg-[#EFF6FF]">
              <Feather name="file-text" size={18} color={BrandColors.primary} />
            </View>
            <Text className="text-base font-extrabold text-[#0F172A]">Kết quả công việc</Text>
          </View>

          {task.result ? (
            <View className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 gap-2.5">
              <View className="flex-row items-center gap-2.5">
                <View className="w-10 h-10 rounded-lg items-center justify-center bg-[#EFF6FF]">
                  <Feather
                    name={task.result.type === 'LINK' ? 'link' : 'file'}
                    size={20}
                    color={BrandColors.primary}
                  />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-[#0F172A]" numberOfLines={1}>
                    {task.result.name || task.code || 'Kết quả công việc'}
                  </Text>
                  {task.result.note && <Text className="text-xs text-[#64748B] mt-0.5">{task.result.note}</Text>}
                </View>
              </View>

              {task.result.url && (
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-1.5 bg-primary py-2.5 rounded-lg"
                  onPress={() => handleOpenResultUrl(task.result?.url)}
                  activeOpacity={0.8}
                >
                  <Feather name="external-link" size={13} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Xem kết quả</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="p-4">
              <Text className="text-xs text-[#94A3B8] italic">Chưa có kết quả để đánh giá</Text>
            </View>
          )}
        </View>

        {/* Criteria Evaluation Card */}
        <View className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2.5 mb-3">
            <View className="w-9 h-9 rounded-lg items-center justify-center bg-[#ECFDF5]">
              <Feather name="check-circle" size={18} color="#10B981" />
            </View>
            <Text className="text-base font-extrabold text-[#0F172A]">Tiêu chí đánh giá</Text>
          </View>

          {loading ? (
            <View className="flex-row items-center gap-2 py-4">
              <ActivityIndicator size="small" color={BrandColors.primary} />
              <Text className="text-sm text-[#64748B]">Đang tải tiêu chí...</Text>
            </View>
          ) : (
            <>
              {isDualReview && (
                <View className="flex-row bg-[#F1F5F9] rounded-2xl p-1 mb-3">
                  <TouchableOpacity
                    className={"flex-1 py-2.5 items-center rounded-xl " + (activeTab === 'TEAM_LEAD' ? 'bg-white shadow-md' : '')}
                    onPress={() => setSelectedTab({ taskId: String(id), tab: 'TEAM_LEAD' })}
                  >
                    <Text
                      className={"text-xs font-semibold " + (activeTab === 'TEAM_LEAD' ? 'font-extrabold text-primary' : 'text-[#64748B]')}
                    >
                      Team Lead ({isLeadPassed ? 'Đã duyệt' : 'Đang đợi'})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={"flex-1 py-2.5 items-center rounded-xl " + (activeTab === 'ASSIGNER' ? 'bg-white shadow-md' : '')}
                    onPress={() => setSelectedTab({ taskId: String(id), tab: 'ASSIGNER' })}
                  >
                    <Text
                      className={"text-xs font-semibold " + (activeTab === 'ASSIGNER' ? 'font-extrabold text-primary' : 'text-[#64748B]')}
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
                        disabled={!ready || isFinalizing || isRejecting || !canToggleTaskReview(task, reviews, review, actor)}
                        accessibilityState={{ disabled: !canToggleTaskReview(task, reviews, review, actor), checked: isChecked }}
                        className={"flex-row items-center gap-3 p-3 rounded-2xl border " + (isChecked ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-[#F8FAFC] border-[#E2E8F0]')}
                        onPress={() => handleToggleReview(review.id)}
                        activeOpacity={0.7}
                      >
                        <View className={"w-5 h-5 rounded-md border-2 items-center justify-center " + (isChecked ? 'bg-primary border-primary' : 'border-[#CBD5E1]')}>
                          {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
                        </View>
                        <View className="flex-1">
                          <Text
                            className={"text-sm font-bold " + (isChecked ? 'text-[#065F46]' : 'text-[#334155]')}
                          >
                            {review.criteria?.name || 'Tiêu chí đánh giá'}
                          </Text>
                          {review.criteria?.description && (
                            <Text className="text-xs text-[#64748B] mt-0.5">
                              {review.criteria.description}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View className="p-4 items-center justify-center">
                  <Text className="text-xs text-[#94A3B8] italic">
                    Không có tiêu chí đánh giá cho loại công việc này.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Note Input */}
        <View className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2.5 mb-3">
            <View className="w-9 h-9 rounded-lg items-center justify-center bg-[#F3E8FF]">
              <Feather name="message-square" size={18} color="#8B5CF6" />
            </View>
            <Text className="text-base font-extrabold text-[#0F172A]">Ghi chú / Phản hồi</Text>
          </View>
          <TextInput
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 text-base text-[#0F172A] min-h-[90px]"
            multiline
            numberOfLines={4}
            placeholder="Nhập ghi chú hoặc lý do đánh giá/từ chối..."
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
          />
        </View>

        {!isAllPassed && reviews.length > 0 && (
          <Text className="text-xs font-bold text-[#D97706] text-center mb-4">
            * Bạn cần xác nhận tất cả các tiêu chí trước khi duyệt
          </Text>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View className="flex-row gap-3 p-4 bg-white border-t border-[#E2E8F0]">
        {!permissions.canDecide && <Text className="flex-1 text-sm text-slate-500">Bạn chỉ có quyền xem đánh giá ở trạng thái hiện tại.</Text>}
        {permissions.canDecide && <>
        <TouchableOpacity
          className={"flex-1 flex-row items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] " + (!note.trim() || isRejecting || isFinalizing ? 'opacity-50' : '')}
          onPress={handleReject}
          disabled={!note.trim() || isRejecting || isFinalizing}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Feather name="x-circle" size={16} color="#EF4444" />
              <Text className="text-sm font-bold text-red-500">Từ chối</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={"flex-[2] flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl bg-emerald-600 " + (!isAllPassed || isFinalizing || isRejecting ? "opacity-50" : "")}
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
        </>}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
