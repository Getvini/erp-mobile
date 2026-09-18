import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { taskService, TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import ReworkTaskModal from '@/components/tasks/ReworkTaskModal';
import TaskResultModal from '@/components/tasks/TaskResultModal';
import TaskAssignModal from '@/components/projects/TaskAssignModal';
import TaskReviewModal from '@/components/tasks/TaskReviewModal';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { safeGoBack } from '@/utils/navigation';
import {
  useTaskDetailQuery,
  useTaskReviewsQuery,
  useUpdateTaskMutation,
  useApproveByCustomerMutation,
  useRequestSupportMutation,
  useRespondToSupportMutation,
  useReturnSupportMutation,
  useRequestReturnSupportMutation,
  useSendTaskReminderMutation,
  useRequestReworkMutation,
} from '@/hooks/queries/useTasks';

const formatDateTimeStr = (dateStr?: string) => {
  if (!dateStr) return 'Chưa thiết lập';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('vi-VN');
    const timeFormatted = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} - ${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

const formatDateStr = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: taskRes, isLoading: isTaskLoading, refetch: refetchTask } = useTaskDetailQuery(String(id || ''));
  const task: TaskDetail | null = taskRes || null;
  const isLoading = isTaskLoading;

  const { data: reviewsData, refetch: refetchReviews } = useTaskReviewsQuery(String(id || ''));
  const reviews = reviewsData || [];

  // Description inline edit state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  // Modal States
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Mutations
  const updateTaskMutation = useUpdateTaskMutation();
  const approveByCustomerMutation = useApproveByCustomerMutation();
  const requestSupportMutation = useRequestSupportMutation();
  const respondToSupportMutation = useRespondToSupportMutation();
  const returnSupportMutation = useReturnSupportMutation();
  const requestReturnSupportMutation = useRequestReturnSupportMutation();
  const sendTaskReminderMutation = useSendTaskReminderMutation();
  const requestReworkMutation = useRequestReworkMutation();

  const isActionLoading =
    updateTaskMutation.isPending ||
    approveByCustomerMutation.isPending ||
    requestSupportMutation.isPending ||
    respondToSupportMutation.isPending ||
    returnSupportMutation.isPending ||
    requestReturnSupportMutation.isPending ||
    sendTaskReminderMutation.isPending ||
    requestReworkMutation.isPending;

  const isUpdatingDescription = updateTaskMutation.isPending;

  const loadTask = useCallback(() => {
    refetchTask();
    refetchReviews();
  }, [refetchTask, refetchReviews]);

  useSSERefresh(['invalidate_Tasks', 'invalidate_TaskReviews'], loadTask);

  const currentUserId = user?.id;
  const teamLeadId = task?.project?.team?.teamLead?.id;
  const isProjectLead = !!currentUserId && !!teamLeadId && currentUserId === teamLeadId;
  const isManagement = ['ADMIN', 'BOD', 'PM', 'TEAM_LEAD'].includes(user?.role || '');
  const canManageProjectTask = isManagement || isProjectLead;
  const canEditDescription = canManageProjectTask;

  const handleStartEditDescription = () => {
    setEditedDescription(task?.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!task) return;
    try {
      await updateTaskMutation.mutateAsync({
        id: task.id,
        payload: {
          description: editedDescription,
          projectId: task.project?.id,
        },
      });
      Alert.alert('Thành công', 'Cập nhật mô tả thành công!');
      setIsEditingDescription(false);
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật mô tả');
    }
  };

  const handleCustomerApprove = async () => {
    if (!task) return;
    try {
      await approveByCustomerMutation.mutateAsync({
        taskId: task.id,
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', 'Khách hàng đã duyệt công việc!');
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể duyệt');
    }
  };

  const handleRequestSupport = async () => {
    if (!task) return;
    try {
      await requestSupportMutation.mutateAsync({
        taskId: task.id,
        reason: 'Yêu cầu hỗ trợ từ thành viên',
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', 'Đã gửi yêu cầu hỗ trợ!');
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể gửi yêu cầu hỗ trợ');
    }
  };

  const handleRespondSupport = async (action: 'ACCEPT' | 'REJECT') => {
    if (!task) return;
    try {
      await respondToSupportMutation.mutateAsync({
        taskId: task.id,
        action,
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', action === 'ACCEPT' ? 'Đã chấp nhận hỗ trợ' : 'Đã từ chối hỗ trợ');
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Thao tác thất bại');
    }
  };

  const handleReturnSupport = async () => {
    if (!task) return;
    try {
      await returnSupportMutation.mutateAsync({
        taskId: task.id,
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', 'Đã trả lại task cho team gốc.');
      router.back();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể trả lại task');
    }
  };

  const handleRequestReturnSupport = async () => {
    if (!task) return;
    try {
      await requestReturnSupportMutation.mutateAsync({
        taskId: task.id,
        reason: 'Yêu cầu trả lại task',
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', 'Đã gửi yêu cầu trả lại task!');
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Thao tác thất bại');
    }
  };

  const handleSendReminder = async () => {
    if (!task) return;
    try {
      await sendTaskReminderMutation.mutateAsync(task.id);
      Alert.alert('Thành công', 'Đã gửi nhắc nhở công việc!');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Gửi nhắc nhở thất bại');
    }
  };

  const handleOpenLink = (url?: string) => {
    if (!url) return;
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    Linking.openURL(target).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết này.');
    });
  };

  const getStatusBadge = (status?: string) => {
    const stKey = status || 'PENDING';
    const config = TASK_STATUS_CONFIG[stKey];
    return {
      bg: config?.bg || '#F1F5F9',
      color: config?.color || '#64748B',
      label: config?.text || stKey,
    };
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-slate-50 gap-3">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-400">Đang tải thông tin công việc...</Text>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-slate-50 gap-3 p-6">
        <Feather name="alert-circle" size={44} color="#EF4444" />
        <Text className="text-[15px] font-semibold text-slate-900">Không tìm thấy thông tin công việc</Text>
        <TouchableOpacity className="px-5 py-2.5 rounded-lg bg-primary" onPress={() => safeGoBack(router, '/tasks')}>
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusBadge(task.status);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200 gap-2">
        <TouchableOpacity
          className="w-[38px] h-[38px] rounded-xl bg-slate-100 items-center justify-center"
          onPress={() => safeGoBack(router, '/tasks')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
            {task.name}
          </Text>
          {task.code && <Text className="text-[11px] text-slate-500 font-semibold">#{task.code}</Text>}
        </View>

        <View className="px-2 py-1 rounded-md" style={{ backgroundColor: statusInfo.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Project Back Link Banner */}
        {task.project?.name && (
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-blue-50 px-3.5 py-2.5 rounded-xl border border-blue-100"
            onPress={() => router.push(`/projects/${task.project?.id}` as any)}
            activeOpacity={0.8}
          >
            <Feather name="folder" size={14} color={BrandColors.primary} />
            <Text className="flex-1 text-[13px] font-bold text-primary" numberOfLines={1}>
              Dự án: {task.project.name}
            </Text>
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Top Action Buttons Grid */}
        <View className="flex-row flex-wrap gap-2">
          {task.status === 'AWAITING_REVIEW' && canManageProjectTask && (
            <>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-2 rounded-xl"
                onPress={() => setIsReworkModalOpen(true)}
              >
                <Feather name="rotate-ccw" size={14} color="#7C3AED" />
                <Text className="text-xs font-bold text-purple-600">Yêu cầu làm lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-primary px-3 py-2 rounded-xl"
                onPress={() => setIsReviewModalOpen(true)}
              >
                <Feather name="check-circle" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Đánh giá & Duyệt</Text>
              </TouchableOpacity>
            </>
          )}

          {task.status === 'INTERNAL_COMPLETED' && canManageProjectTask && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-emerald-600 px-3 py-2 rounded-xl"
              onPress={handleCustomerApprove}
              disabled={isActionLoading}
            >
              <Feather name="check" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Khách hàng duyệt</Text>
            </TouchableOpacity>
          )}

          {['DONE', 'COMPLETED', 'INTERNAL_COMPLETED'].includes(task.status || '') &&
            canManageProjectTask && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-2 rounded-xl"
                onPress={() => setIsReworkModalOpen(true)}
              >
                <Feather name="rotate-ccw" size={14} color="#7C3AED" />
                <Text className="text-xs font-bold text-purple-600">Yêu cầu làm lại</Text>
              </TouchableOpacity>
            )}

          {['DOING', 'REWORKING', 'OVERDUE'].includes(task.status || '') &&
            (currentUserId === task.assigneeId || currentUserId === task.helperId) &&
            !task.isSupportRequested && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
                onPress={handleRequestSupport}
                disabled={isActionLoading}
              >
                <Feather name="help-circle" size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Nhờ hỗ trợ</Text>
              </TouchableOpacity>
            )}

          {/* Deprecated cross-team support buttons */}
          {/*
          {task.status === 'SUPPORT_PENDING' && currentUserId === task.supportLeadId && (
            <>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-emerald-600 px-3 py-2 rounded-xl"
                onPress={() => handleRespondSupport('ACCEPT')}
                disabled={isActionLoading}
              >
                <Feather name="check" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Đồng ý hỗ trợ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
                onPress={() => handleRespondSupport('REJECT')}
                disabled={isActionLoading}
              >
                <Feather name="x" size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Từ chối</Text>
              </TouchableOpacity>
            </>
          )}

          {['DOING', 'REWORKING', 'OVERDUE'].includes(task.status || '') &&
            currentUserId === task.helperId && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
                onPress={handleRequestReturnSupport}
                disabled={isActionLoading}
              >
                <Feather name="arrow-left" size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Hỗ trợ</Text>
              </TouchableOpacity>
            )}

          {task.isSupportAccepted &&
            currentUserId === task.supportLeadId &&
            task.isSupportReturnRequested &&
            ['DOING', 'REWORKING', 'SUPPORT_AWAITING_RETURN'].includes(task.status || '') && (
              <>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl"
                  onPress={() => setIsAssignModalOpen(true)}
                >
                  <Feather name="users" size={14} color="#D97706" />
                  <Text className="text-xs font-bold text-amber-600">Phân công lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-red-600 px-3 py-2 rounded-xl"
                  onPress={handleReturnSupport}
                  disabled={isActionLoading}
                >
                  <Feather name="arrow-left" size={14} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Trả lại</Text>
                </TouchableOpacity>
              </>
            )}
          */}

          {canManageProjectTask &&
            (task.assigneeId || task.helperId) &&
            !['COMPLETED', 'ACCEPTED', 'DONE', 'INTERNAL_COMPLETED', 'AWAITING_REVIEW'].includes(
              task.status || ''
            ) && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-blue-600 px-3 py-2 rounded-xl"
                onPress={handleSendReminder}
                disabled={isActionLoading}
              >
                <Feather name="bell" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Nhắc việc</Text>
              </TouchableOpacity>
            )}
        </View>

        {/* Description & Note Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center">
                <Feather name="file-text" size={16} color="#4F46E5" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Mô tả & Ghi chú</Text>
            </View>

            {canEditDescription && !isEditingDescription && (
              <TouchableOpacity className="flex-row items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md" onPress={handleStartEditDescription}>
                <Feather name="edit-2" size={12} color="#4F46E5" />
                <Text className="text-[11px] font-bold text-indigo-600">Chỉnh sửa</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingDescription ? (
            <View className="gap-2.5">
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] text-slate-900 min-h-[80px]"
                multiline
                numberOfLines={4}
                placeholder="Nhập mô tả chi tiết hoặc lưu ý cho người thực hiện..."
                placeholderTextColor="#94A3B8"
                value={editedDescription}
                onChangeText={setEditedDescription}
              />
              <View className="flex-row justify-end gap-2">
                <TouchableOpacity
                  className="px-3 py-1.5 rounded-lg bg-slate-100"
                  onPress={() => setIsEditingDescription(false)}
                >
                  <Text className="text-xs font-semibold text-slate-600">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-3 py-1.5 rounded-lg bg-indigo-600"
                  onPress={handleSaveDescription}
                  disabled={isUpdatingDescription}
                >
                  {isUpdatingDescription ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-bold text-white">Lưu thay đổi</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text className="text-[13px] text-slate-600 leading-5">
              {task.description || 'Không có mô tả cho công việc này.'}
            </Text>
          )}
        </View>

        {/* Evaluation Results Card */}
        {reviews.length > 0 && task.status !== 'AWAITING_REVIEW' && (
          <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center">
                  <Feather name="list" size={16} color="#2563EB" />
                </View>
                <Text className="text-[15px] font-bold text-slate-900">Kết quả đánh giá</Text>
              </View>

              <View
                className={`px-2.5 py-1 rounded-md ${
                  reviews.every((r) => r.isPassed) ? 'bg-emerald-100' : 'bg-red-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    reviews.every((r) => r.isPassed) ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {reviews.every((r) => r.isPassed) ? 'Đạt' : 'Không đạt'}
                </Text>
              </View>
            </View>

            <View className="gap-2">
              {reviews.map((r, idx) => (
                <View
                  key={r.id || idx}
                  className={`flex-row items-center gap-2 p-2.5 rounded-lg border ${
                    r.isPassed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <Feather
                    name={r.isPassed ? 'check-circle' : 'circle'}
                    size={16}
                    color={r.isPassed ? '#16A34A' : '#94A3B8'}
                  />
                  <Text className="text-[13px] font-semibold text-slate-900">
                    {r.criteria?.name || r.name || 'Tiêu chí đánh giá'}
                  </Text>
                </View>
              ))}

              {task.reviewNote ? (
                <Text className="text-xs text-slate-500 italic mt-1">Ghi chú: {task.reviewNote}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Results Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center">
                <Feather name="upload" size={16} color="#2563EB" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Kết quả</Text>
            </View>

            {['DOING', 'REJECTED', 'REWORKING', 'OVERDUE'].includes(task.status || '') &&
              task.assigneeId !== null && (
                <TouchableOpacity onPress={() => setIsResultModalOpen(true)}>
                  <Text className="text-xs font-bold text-primary">
                    {task.result ? 'Cập nhật kết quả' : 'Thêm kết quả'}
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {task.result ? (
            <View className="bg-teal-50/50 border border-teal-100 rounded-xl p-3 gap-2.5">
              <View className="flex-row items-start gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-white items-center justify-center">
                  <Feather
                    name={
                      task.result.type === 'CHECKLIST' || task.result.type === 'CONFIRMATION'
                        ? 'check-square'
                        : 'file-text'
                    }
                    size={20}
                    color={BrandColors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-slate-900">{task.result.name || 'Kết quả đã nộp'}</Text>
                  {task.result.note ? (
                    <Text className="text-[11px] text-slate-500 mt-0.5">{task.result.note}</Text>
                  ) : null}
                  {task.lastSubmittedBy?.fullName && (
                    <Text className="text-[10px] font-extrabold text-primary mt-1">
                      NGƯỜI LÀM: {task.lastSubmittedBy.fullName}
                    </Text>
                  )}
                </View>
              </View>

              {task.result.url && (
                <TouchableOpacity
                  className="self-start bg-primary px-3 py-1.5 rounded-lg"
                  onPress={() => handleOpenLink(task.result?.url)}
                >
                  <Text className="text-[11px] font-bold text-white">Xem ngay</Text>
                </TouchableOpacity>
              )}

              {task.result.type === 'CHECKLIST' &&
                task.result.checklist &&
                task.result.checklist.length > 0 && (
                  <View className="gap-1.5 pt-1.5 border-t border-teal-100">
                    {task.result.checklist.map((item, idx) => (
                      <View key={idx} className="flex-row items-start gap-2">
                        <Feather name="check-circle" size={14} color="#16A34A" />
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-slate-900">
                            {item.label || item.item}
                          </Text>
                          {item.description ? (
                            <Text className="text-[11px] text-slate-500">{item.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
            </View>
          ) : (
            <View className="py-5 items-center justify-center gap-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Feather name="file-text" size={32} color="#CBD5E1" />
              <Text className="text-xs text-slate-400">Chưa có kết quả nào được tải lên</Text>
            </View>
          )}
        </View>

        {/* Iteration History Card */}
        {task.iterations && task.iterations.length > 0 && (
          <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
                  <Feather name="rotate-ccw" size={16} color="#7C3AED" />
                </View>
                <Text className="text-[15px] font-bold text-slate-900">Lịch sử làm lại</Text>
              </View>
            </View>

            <View className="gap-2.5">
              {task.iterations
                .slice()
                .sort((a, b) => b.version - a.version)
                .map((iteration) => (
                  <View key={iteration.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 gap-2">
                    <View className="flex-row items-center gap-2">
                      <View className="bg-purple-100 px-1.5 py-0.5 rounded">
                        <Text className="text-[11px] font-extrabold text-purple-600">v{iteration.version}</Text>
                      </View>
                      <Text className="text-[11px] text-slate-500">{formatDateStr(iteration.createdAt)}</Text>
                      {iteration.submittedBy?.fullName && (
                        <Text className="text-[10px] font-bold text-primary">
                          NGƯỜI LÀM: {iteration.submittedBy.fullName}
                        </Text>
                      )}
                    </View>

                    {iteration.leadFeedback && (
                      <View className="border-l-4 border-purple-600 pl-2 gap-0.5">
                        <Text className="text-[9px] font-extrabold text-slate-400 tracking-wider">PHẢN HỒI CỦA LEAD</Text>
                        <Text className="text-xs text-slate-900 italic">"{iteration.leadFeedback}"</Text>
                      </View>
                    )}

                    {iteration.feedbackAttachments && iteration.feedbackAttachments.length > 0 && (
                      <View className="mt-2">
                        <Text className="text-[9px] font-extrabold text-slate-400 tracking-wider">TÀI LIỆU ĐÍNCH KÈM</Text>
                        <View className="flex-row flex-wrap gap-1.5 mt-1">
                          {iteration.feedbackAttachments.map((f, fIdx) => (
                            <TouchableOpacity
                              key={fIdx}
                              className="flex-row items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1"
                              onPress={() => handleOpenLink(f.url)}
                            >
                              <Feather
                                name={f.type === 'LINK' ? 'link' : 'file-text'}
                                size={12}
                                color={BrandColors.primary}
                              />
                              <Text className="text-[11px] font-semibold text-slate-600 max-w-[120px]" numberOfLines={1}>
                                {f.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Performer / Assignee Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center">
                <Feather name="user" size={16} color="#2563EB" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Nhân sự thực hiện</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
              <Text className="text-base font-bold text-white">
                {task.assignee?.fullName?.charAt(0) || 'U'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">
                {task.assignee?.fullName || task.assignee?.name || 'Chưa có người thực hiện'}
              </Text>
              <Text className="text-[11px] font-bold text-slate-400 mt-0.5">
                {task.performerType || 'INTERNAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline / Plan Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-amber-100 items-center justify-center">
                <Feather name="calendar" size={16} color="#D97706" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Kế hoạch</Text>
            </View>
          </View>

          <View className="gap-1">
            <Text className="text-[10px] font-extrabold text-slate-400 tracking-wider">DEADLINE (HẠN HOÀN THÀNH)</Text>
            <Text className="text-sm font-bold text-slate-900">{formatDateTimeStr(task.plannedEndDate || task.dueDate)}</Text>
          </View>
        </View>

        {/* Attachments Section */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
                <Feather name="paperclip" size={16} color="#7C3AED" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Tài liệu ({task.attachments?.length || 0})</Text>
            </View>
          </View>

          {task.attachments && task.attachments.length > 0 ? (
            <View className="gap-2">
              {task.attachments.map((file, idx) => (
                <TouchableOpacity
                  key={idx}
                  className="flex-row items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                  onPress={() => handleOpenLink(file.url)}
                  activeOpacity={0.7}
                >
                  <View className="w-8 h-8 rounded-lg bg-white items-center justify-center">
                    <Feather name="file-text" size={16} color="#64748B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>
                      {file.name || 'Tài liệu đính kèm'}
                    </Text>
                    {file.type ? <Text className="text-[10px] text-slate-400 font-semibold">{file.type}</Text> : null}
                  </View>
                  <Feather name="external-link" size={14} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="text-xs text-slate-400 italic text-center py-2">Không có tài liệu đính kèm</Text>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <ReworkTaskModal
        visible={isReworkModalOpen}
        onClose={() => setIsReworkModalOpen(false)}
        task={task}
        onSuccess={loadTask}
      />

      <TaskResultModal
        visible={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        task={task}
        onSuccess={loadTask}
      />

      <TaskAssignModal
        visible={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        task={task}
        project={task.project}
        teamMembers={[]}
        onSuccess={loadTask}
      />

      <TaskReviewModal
        visible={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        task={task}
        onSuccess={loadTask}
      />
    </SafeAreaView>
  );
}
