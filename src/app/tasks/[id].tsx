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
import { EditTaskNicknameModal } from '@/components/tasks/EditTaskNicknameModal';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import ReworkTaskModal from '@/components/tasks/ReworkTaskModal';
import TaskResultModal from '@/components/tasks/TaskResultModal';
import TaskAssignModal from '@/components/projects/TaskAssignModal';
import TaskReviewModal from '@/components/tasks/TaskReviewModal';
import TaskSubtaskSection from '@/components/tasks/TaskSubtaskSection';
import TaskLifecycleActions from '@/components/tasks/TaskLifecycleActions';
import SubtaskAllocationModal from '@/components/tasks/SubtaskAllocationModal';
import TaskResultChecksPanel from '@/components/tasks/TaskResultChecksPanel';
import SubmittedScopeSummary from '@/components/tasks/SubmittedScopeSummary';
import ConfirmedCheckErrors from '@/components/tasks/ConfirmedCheckErrors';
import { safeGoBack } from '@/utils/navigation';
import { useProjectDetailQuery, useTeamMembersQuery } from '@/hooks/queries/useProjects';
import { useTaskResultCheckQuery } from '@/hooks/queries/useTaskResultChecks';
import {
  hasTeamMemberRole,
  hasProjectAccount,
  PROJECT_ACCOUNT_REQUIRED_MESSAGE,
  resolveEffectiveTeamMembers,
} from '@/utils/teamMember';
import { canDecideTaskOutcome } from '@/utils/taskOutcomeAuthorization';
import { getTaskPolicy, getTaskDisplayName } from '@/utils/taskPolicy';
import TaskDeadlineEditor from '@/components/tasks/TaskDeadlineEditor';
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
  useSubmitResultForReviewMutation,
} from '@/hooks/queries/useTasks';

const PERFORMER_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'NỘI BỘ',
  PARTNER: 'ĐỐI TÁC',
  VENDOR: 'VENDOR',
};

const formatDateTimeStr = (dateStr?: string, fallback = 'Chưa thiết lập') => {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
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

  const { data: resultCheck } = useTaskResultCheckQuery(String(id || ''));
  const confirmedSpellErrors = useMemo(
    () => (resultCheck?.finalizedAt ? (resultCheck.reviewedSpellErrors || []).filter((e) => e.confirmed !== false) : []),
    [resultCheck]
  );
  const confirmedQcMismatches = useMemo(
    () => (resultCheck?.finalizedAt ? (resultCheck.reviewedQcMismatches || []).filter((m) => m.confirmed !== false) : []),
    [resultCheck]
  );

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

  const isActionLoading =
    updateTaskMutation.isPending ||
    approveByCustomerMutation.isPending ||
    requestSupportMutation.isPending ||
    respondToSupportMutation.isPending ||
    returnSupportMutation.isPending ||
    requestReturnSupportMutation.isPending ||
    sendTaskReminderMutation.isPending;

  const isUpdatingDescription = updateTaskMutation.isPending;

  const loadTask = useCallback(() => {
    refetchTask();
    refetchReviews();
  }, [refetchTask, refetchReviews]);

  // Thành viên dự án để chọn người thực hiện cho công việc con
  const { data: projectData } = useProjectDetailQuery(task?.project?.id || '');
  const taskProject = projectData || task?.project;
  const { data: teamMembersData } = useTeamMembersQuery(taskProject?.team?.id);
  const effectiveTeamMembers = resolveEffectiveTeamMembers(
    teamMembersData,
    (taskProject?.team as any)?.members,
  );
  const currentUserId = user?.id;
  const projectHasAccount = !task?.project?.id || hasProjectAccount(taskProject, effectiveTeamMembers);
  const policyTask = task ? { ...task, project: taskProject ? { ...taskProject, team: { ...taskProject.team, members: effectiveTeamMembers } } : undefined } : null;
  const policy = getTaskPolicy(policyTask, user, { assignmentContext: 'detail' });
  const canEditDescription = policy.editDescription.enabled;
  const canManageSubtasks = policy.createSubtask.enabled;

  const subtaskAssigneeOptions = useMemo(
    () =>
      effectiveTeamMembers
        .filter((member: any) => member?.user?.id && !hasTeamMemberRole(member, 'PROJECT_MANAGER'))
        .map((member: any) => ({
          id: member.user.id as string,
          fullName: (member.user.fullName || member.user.name) as string | undefined,
        })),
    [effectiveTeamMembers]
  );

  /**
   * ⚠️ `TaskDetail` chưa khai báo `subtasks` (theo yêu cầu KHÔNG sửa tầng service)
   * ⇒ đọc qua ép kiểu tại chỗ cho tầng UI.
   */
  const subtaskCount = Array.isArray((task as any)?.subtasks)
    ? ((task as any).subtasks as any[]).length
    : 0;
  // Quyền quản lý công việc con: Account phụ trách (team lead) / ADMIN / PM

  // Tab đang xem: Tổng quan | Công việc con | QC & Kết quả
  const [activeTab, setActiveTab] = useState<'overview' | 'subtasks' | 'qc'>('overview');
  const [showEditNickname, setShowEditNickname] = useState(false);
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);

  const isTaskAssigned = Boolean(
    task?.assigneeId ||
    task?.assignee?.id ||
    (task as any)?.vendorId ||
    (task as any)?.vendor ||
    task?.performerType === 'VENDOR'
  );
  const isProjectOnHold = taskProject?.status === 'ON_HOLD' || Boolean((taskProject as any)?.isOnHold);
  const canAddSubtask = !isProjectOnHold &&
    policy.createSubtask.enabled &&
    !(task as any)?.parentTaskId &&
    subtaskCount === 0;

  const submitResultForReviewMutation = useSubmitResultForReviewMutation();
  const handleSubmitResultForReview = async () => {
    if (!task || isActionLoading || submitResultForReviewMutation.isPending) return;
    try {
      await submitResultForReviewMutation.mutateAsync({
        id: task.id,
        projectId: task.project?.id,
      });
      Alert.alert('Thành công', 'Đã gửi duyệt kết quả');
      loadTask();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi gửi duyệt kết quả');
    }
  };

  const handleStartEditDescription = () => {
    if (!policy.editDescription.enabled) return;
    setEditedDescription(task?.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!task || !policy.editDescription.enabled || isActionLoading) return;
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
    if (!task || !policy.customerApprove.enabled || isActionLoading) return;
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
    if (!task || !policy.requestSupport.enabled || isActionLoading) return;
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
    if (!task || !policy.remind.enabled || isActionLoading) return;
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
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
              {getTaskDisplayName(task)}
            </Text>
            {policy.assign.enabled && (
              <TouchableOpacity
                onPress={() => setShowEditNickname(true)}
                hitSlop={8}
                className="h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
                accessibilityLabel="Đổi tên công việc"
              >
                <Feather name="edit-2" size={12} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            {task.code && <Text className="text-[11px] text-slate-500 font-semibold">#{task.code}</Text>}
            {(task.isExtra || task.isExtraTask) && (
              <View className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold uppercase text-amber-700">Phát sinh</Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-2.5 py-1 rounded-lg border border-amber-200/80" style={{ backgroundColor: statusInfo.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Tab bar: Tổng quan | Công việc con | QC & Kết quả */}
      <View className="flex-row bg-white border-b border-slate-200 px-2">
        {(
          [
            { key: 'overview', label: 'Tổng quan', badge: 0 },
            { key: 'subtasks', label: 'Công việc con', badge: subtaskCount },
            { key: 'qc', label: 'QC & Kết quả', badge: 0 },
          ] as { key: 'overview' | 'subtasks' | 'qc'; label: string; badge: number }[]
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              className={`flex-1 min-h-[48px] flex-row items-center justify-center gap-1.5 border-b-2 ${
                isActive ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text
                className={`text-xs ${isActive ? 'font-bold text-primary' : 'font-semibold text-slate-500'}`}
              >
                {tab.label}
              </Text>
              {tab.badge > 0 && (
                <View className="px-1.5 py-0.5 rounded-full bg-orange-100">
                  <Text className="text-[10px] font-bold text-orange-700">{tab.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <>
        {/* Project Back Link Banner */}
        {task.project?.name && (
          <TouchableOpacity
            className="flex-row items-center gap-2.5 bg-orange-50/70 px-3.5 py-2.5 rounded-xl border border-orange-200/80"
            onPress={() => router.push(`/projects/${task.project?.id}` as any)}
            activeOpacity={0.8}
          >
            <View className="w-6 h-6 rounded-md bg-white items-center justify-center shadow-xs">
              <Feather name="folder" size={13} color={BrandColors.primary} />
            </View>
            <Text className="flex-1 text-[13px] font-bold text-orange-950" numberOfLines={1}>
              Dự án: {task.project.name}
            </Text>
            <Feather name="chevron-right" size={15} color="#C2410C" />
          </TouchableOpacity>
        )}

        {/* Vòng đời công việc: Bắt đầu / Nộp kết quả / Gửi duyệt / Nhờ hỗ trợ / Khách không mua / Xóa */}
        {!projectHasAccount && (
          <View className="flex-row items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5">
            <Feather name="alert-circle" size={16} color="#D97706" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs font-semibold leading-5 text-amber-900">{PROJECT_ACCOUNT_REQUIRED_MESSAGE}</Text>
          </View>
        )}
        {<TaskLifecycleActions
          task={policyTask}
          projectId={task.project?.id}
          onChanged={loadTask}
          onOpenResultModal={() => { if (policy.uploadResult.enabled) setIsResultModalOpen(true); }}
          onDeleted={() => safeGoBack(router, '/tasks')}
          canAddSubtask={canAddSubtask}
          onOpenSubtaskModal={() => setIsSubtaskModalOpen(true)}
          canRemind={policy.remind.enabled}
          onSendReminder={handleSendReminder}
          canAssign={policy.assign.enabled && !isTaskAssigned}
          onOpenAssignModal={() => setIsAssignModalOpen(true)}
          canRework={policy.rework.enabled}
          onOpenReworkModal={() => setIsReworkModalOpen(true)}
          canReview={task.status === 'AWAITING_REVIEW' && policy.review.enabled}
          onOpenReviewModal={() => setIsReviewModalOpen(true)}
          canCustomerApprove={task.status === 'INTERNAL_COMPLETED' && policy.customerApprove.enabled}
          onCustomerApprove={handleCustomerApprove}
          canRequestSupport={policy.requestSupport.enabled}
          onRequestSupport={handleRequestSupport}
          isActionLoading={isActionLoading}
        />}
                {/* Description & Note Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-orange-50 items-center justify-center">
                <Feather name="file-text" size={16} color={BrandColors.primary} />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Mô tả & Ghi chú</Text>
            </View>

            {canEditDescription && !isEditingDescription && (
              <TouchableOpacity accessibilityLabel="Sửa mô tả" className="flex-row items-center gap-1 bg-orange-50 border border-orange-200/80 px-2.5 py-1 rounded-lg" onPress={handleStartEditDescription} accessibilityRole="button">
                <Feather name="edit-2" size={12} color={BrandColors.primary} />
                <Text className="text-[11px] font-bold text-primary">Chỉnh sửa</Text>
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
                {policy.editDescription.enabled && (
                  <TouchableOpacity accessibilityLabel="Sửa mô tả"
                    className="px-3.5 py-1.5 rounded-lg bg-primary"
                    onPress={handleSaveDescription}
                    disabled={isUpdatingDescription}
                    style={[isUpdatingDescription ? { opacity: 0.5 } : undefined]} accessibilityRole="button">
                    {isUpdatingDescription ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="text-xs font-bold text-white">Lưu thay đổi</Text>
                    )}
                  </TouchableOpacity>
                )}
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
              <View className="w-8 h-8 rounded-lg bg-orange-50 items-center justify-center">
                <Feather name="upload" size={16} color={BrandColors.primary} />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Kết quả</Text>
            </View>

            {policy.uploadResult.enabled && (
              <TouchableOpacity accessibilityLabel="Nộp kết quả" onPress={() => setIsResultModalOpen(true)} accessibilityRole="button">
                <Text className="text-xs font-bold text-primary">
                  {task.result ? 'Cập nhật kết quả' : 'Thêm kết quả'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {task.result ? (
            <View className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 gap-2.5">
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
                    <Text className="text-[10px] font-extrabold text-emerald-700 mt-1">
                      NGƯỜI LÀM: {task.lastSubmittedBy.fullName}
                    </Text>
                  )}
                </View>
              </View>

              {task.result.url && (
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    className="self-start bg-primary px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                    onPress={() => handleOpenLink(task.result?.url)}
                  >
                    <Feather name="external-link" size={12} color="#FFFFFF" />
                    <Text className="text-[11px] font-bold text-white">Xem ngay</Text>
                  </TouchableOpacity>
                  {policy.submitReview.enabled && (
                    <TouchableOpacity
                      className="self-start bg-emerald-600 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                      onPress={handleSubmitResultForReview}
                      disabled={isActionLoading || submitResultForReviewMutation.isPending}
                    >
                      <Feather name="send" size={12} color="#FFFFFF" />
                      <Text className="text-[11px] font-bold text-white">Gửi duyệt</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

        {task.result ? <SubmittedScopeSummary result={task.result} /> : null}

        {confirmedSpellErrors.length > 0 || confirmedQcMismatches.length > 0 ? (
          <View className="bg-white rounded-2xl p-4 border border-slate-200">
            <ConfirmedCheckErrors
              variant="section"
              title="Lỗi đã chốt ở kết quả đã nộp"
              collapsible
              finalizedAt={resultCheck?.finalizedAt}
              spellErrors={confirmedSpellErrors}
              qcMismatches={confirmedQcMismatches}
            />
          </View>
        ) : null}

        {/* Iteration History Card */}
        {task.iterations && task.iterations.length > 0 && (
          <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-lg bg-amber-50 items-center justify-center">
                  <Feather name="rotate-ccw" size={16} color="#D97706" />
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
                      <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                        <Text className="text-[11px] font-extrabold text-amber-800">v{iteration.version}</Text>
                      </View>
                      <Text className="text-[11px] text-slate-500">{formatDateStr(iteration.createdAt)}</Text>
                      {iteration.submittedBy?.fullName && (
                        <Text className="text-[10px] font-bold text-primary">
                          NGƯỜI LÀM: {iteration.submittedBy.fullName}
                        </Text>
                      )}
                    </View>

                    {iteration.leadFeedback && (
                      <View className="border-l-4 border-amber-500 pl-2 gap-0.5">
                        <Text className="text-[9px] font-extrabold text-slate-400 tracking-wider">PHẢN HỒI CỦA LEAD</Text>
                        <Text className="text-xs text-slate-900 italic">{`"${iteration.leadFeedback}"`}</Text>
                      </View>
                    )}

                    <ConfirmedCheckErrors
                      spellErrors={iteration.confirmedSpellErrors}
                      qcMismatches={iteration.confirmedQcMismatches}
                    />

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
              <View className="w-8 h-8 rounded-lg bg-orange-50 items-center justify-center">
                <Feather name="user" size={16} color={BrandColors.primary} />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Nhân sự thực hiện</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-primary items-center justify-center shadow-sm">
              <Text className="text-base font-bold text-white">
                {task.assignee?.fullName?.charAt(0) || 'U'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">
                {task.assignee?.fullName || task.assignee?.name || 'Chưa có người thực hiện'}
              </Text>
              <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {PERFORMER_TYPE_LABELS[task.performerType || ''] || task.performerType || 'NỘI BỘ'}
              </Text>
            </View>
          </View>
        </View>

        {/* Assigner Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center">
                <Feather name="user-check" size={16} color="#475569" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Nhân sự phân công</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-slate-700 items-center justify-center shadow-sm">
              <Text className="text-base font-bold text-white">
                {task.assigner?.fullName?.charAt(0) || (
                  <Feather name="user-plus" size={18} color="#FFFFFF" />
                )}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">
                {task.assigner?.fullName || task.assigner?.name || 'Chưa có thông tin'}
              </Text>
              <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Người giao việc
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline / Plan Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-amber-50 items-center justify-center">
                <Feather name="calendar" size={16} color="#D97706" />
              </View>
              <Text className="text-[15px] font-bold text-slate-900">Kế hoạch</Text>
            </View>
          </View>

          <View className="flex-row items-start justify-between gap-3 pt-1">
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                DEADLINE
              </Text>
              <Text className="text-sm font-bold text-slate-800">
                {formatDateTimeStr(task.plannedEndDate || task.dueDate)}
              </Text>
              <TaskDeadlineEditor task={policyTask} onChanged={loadTask} />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                NGÀY BẮT ĐẦU CÔNG VIỆC
              </Text>
              <Text className="text-sm font-bold text-slate-800">
                {formatDateTimeStr(task.plannedStartDate, 'Chưa có thông tin')}
              </Text>
            </View>
          </View>
        </View>

        {/* Attachments Section */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center">
                <Feather name="paperclip" size={16} color="#475569" />
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
          </>
        )}

        {/* ===== Tab: Công việc con ===== */}
        {activeTab === 'subtasks' && (
          <>
            <TaskSubtaskSection
              task={policyTask}
              projectId={task.project?.id}
              canManage={canManageSubtasks}
              assigneeOptions={subtaskAssigneeOptions}
              onChanged={loadTask}
            />

            {/* Trạng thái rỗng khi không có công việc con và không đủ quyền quản lý */}
            {subtaskCount === 0 && !canManageSubtasks && (
              <View className="bg-white rounded-2xl p-6 border border-slate-200 items-center gap-2">
                <Feather name="layers" size={32} color="#CBD5E1" />
                <Text className="text-xs text-slate-400">
                  Công việc này chưa được chia thành công việc con
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'qc' && projectHasAccount && <TaskResultChecksPanel taskId={task.id} projectId={task.project?.id} />}
      </ScrollView>

      {/* Modals */}
      <ReworkTaskModal
        key={`${task.id}:${isReworkModalOpen ? 'open' : 'closed'}`}
        visible={isReworkModalOpen && projectHasAccount}
        onClose={() => setIsReworkModalOpen(false)}
        task={policyTask}
        onSuccess={loadTask}
      />

      <TaskResultModal
        visible={isResultModalOpen && projectHasAccount}
        onClose={() => setIsResultModalOpen(false)}
        task={policyTask}
        onSuccess={loadTask}
      />

      <TaskAssignModal
        visible={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        task={policyTask}
        assignmentContext="detail"
        project={policyTask?.project}
        teamMembers={effectiveTeamMembers as any}
        onSuccess={loadTask}
      />

            <SubtaskAllocationModal
        visible={isSubtaskModalOpen}
        onClose={() => setIsSubtaskModalOpen(false)}
        taskId={task?.id || ''}
        projectId={task?.project?.id}
        assigneeOptions={subtaskAssigneeOptions}
        parentBudget={Number((task as any)?.job?.vinicoin || 0)}
        allocatedPercent={0}
        onSuccess={() => {
          setIsSubtaskModalOpen(false);
          loadTask();
        }}
        policy={policy.createSubtask}
      />
      <TaskReviewModal
        visible={isReviewModalOpen && projectHasAccount}
        onClose={() => setIsReviewModalOpen(false)}
        task={policyTask}
        onSuccess={loadTask}
      />
      <EditTaskNicknameModal
        visible={showEditNickname}
        task={task ? { id: task.id, code: task.code, name: task.name, nickname: (task as any).nickname, projectId: task.projectId } : null}
        onClose={() => setShowEditNickname(false)}
      />
    </SafeAreaView>
  );
}
