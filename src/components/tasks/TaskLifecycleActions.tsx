import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { type TaskDetail } from '@/services/taskService';
import {
  useStartTaskMutation,
  useSubmitResultForReviewMutation,
  useRequestTaskStaffingMutation,
  useRespondTaskStaffingMutation,
  useDeleteTaskMutation,
  useCustomerNotPurchaseMutation,
} from '@/hooks/queries/useTasks';
import {
  STARTABLE,
  canStartTask,
  canSubmitResult,
  getSubtaskBlockMessage,
  isParentBlockedBySubtasks,
  type ParentTaskLike,
} from '@/utils/taskLifecycle';

/**
 * ⚠️ `TaskDetail` chưa khai báo `parentTaskId`/`subtasks`/`supportRequestType`
 * (KHÔNG được sửa tầng service) ⇒ mở rộng type tại chỗ cho tầng UI.
 */
type LifecycleTask = TaskDetail &
  ParentTaskLike & {
    supportRequestType?: string;
  };

interface TaskLifecycleActionsProps {
  task: LifecycleTask | null;
  projectId?: string;
  /** Gọi sau mỗi thao tác thành công để màn cha refetch */
  onChanged: () => void;
  /** Mở modal nộp kết quả có sẵn của màn tasks/[id] (KHÔNG viết lại TaskResultModal) */
  onOpenResultModal?: () => void;
  /** Sau khi xóa thành công (mặc định fallback về onChanged) */
  onDeleted?: () => void;
}

/** Trạng thái cho phép Account/Admin gửi yêu cầu bổ sung nhân sự (mirror erp-UI TaskDelegationPanel) */
const STAFFING_REQUESTABLE_STATUSES = ['PENDING', 'NOT_STARTED', 'DOING', 'REWORKING', 'OVERDUE'];

/** Vai trò được phép "Khách không mua" (task Video AI demo) */
const NOT_PURCHASE_ROLES = ['BD', 'ADMIN_SALE', 'ADMIN', 'BOD'];

export default function TaskLifecycleActions({
  task,
  projectId,
  onChanged,
  onOpenResultModal,
  onDeleted,
}: TaskLifecycleActionsProps) {
  const { user } = useAuth();
  const [isStaffingModalOpen, setIsStaffingModalOpen] = useState(false);
  const [staffingNote, setStaffingNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const startTaskMutation = useStartTaskMutation();
  const submitResultForReviewMutation = useSubmitResultForReviewMutation();
  const requestTaskStaffingMutation = useRequestTaskStaffingMutation();
  const respondTaskStaffingMutation = useRespondTaskStaffingMutation();
  const deleteTaskMutation = useDeleteTaskMutation();
  const customerNotPurchaseMutation = useCustomerNotPurchaseMutation();

  const currentUserId = user?.id;
  const role = String(user?.role || '').toUpperCase();
  const status = String(task?.status || '');
  const resolvedProjectId = projectId || task?.project?.id;

  const isAdminOverride = ['ADMIN', 'BOD'].includes(role);
  const isManagement = ['ADMIN', 'BOD', 'PM', 'TEAM_LEAD'].includes(role);
  const teamLeadId = task?.project?.team?.teamLead?.id;
  const isProjectAccount = Boolean(currentUserId && teamLeadId && currentUserId === teamLeadId);
  const isAccount = isProjectAccount || role === 'TEAM_LEAD';
  const projectManagerId = (task as any)?.project?.projectManager?.id;
  const isAssignedPM = Boolean(currentUserId && projectManagerId && currentUserId === projectManagerId);
  const canRespondStaffingRole = ['PM', 'TEAM_LEAD'].includes(role) || isAdminOverride || isAssignedPM;

  const isAssignee = Boolean(currentUserId && task?.assigneeId && currentUserId === task.assigneeId);
  const isHelper = Boolean(currentUserId && task?.helperId && currentUserId === task.helperId);
  const isAssigner = Boolean(currentUserId && task?.assignerId && currentUserId === task.assignerId);

  /** Task Video AI demo: `opportunityService.job.isBriefVideo` (fallback các biến thể payload) */
  const isVideoDemoTask = Boolean(
    (task as any)?.opportunityServiceJob?.isBriefVideo ||
      (task as any)?.opportunityServiceJob?.job?.isBriefVideo ||
      (task as any)?.job?.isBriefVideo
  );

  const isStartableWindow = STARTABLE.includes(status);
  const canStart = canStartTask(status, isAssignee);
  const isParentBlocked = isParentBlockedBySubtasks(task);
  const canUploadResult = canSubmitResult(status) && (isAssignee || isHelper || isAssigner || isManagement);
  const hasSubmittedResult = Boolean(task?.result);
  const canSubmitForReview =
    canSubmitResult(status) &&
    hasSubmittedResult &&
    (isAdminOverride ||
      isAssignee ||
      isHelper ||
      (Boolean(currentUserId) &&
        ((task as any)?.lastSubmittedById === currentUserId ||
          task?.lastSubmittedBy?.id === currentUserId))) &&
    !isParentBlocked;
  const isPendingStaffingRequest =
    task?.supportRequestType === 'STAFFING' &&
    Boolean(task?.isSupportRequested) &&
    !task?.isSupportAccepted;
  const canRequestStaffing =
    task?.performerType === 'INTERNAL' &&
    STAFFING_REQUESTABLE_STATUSES.includes(status) &&
    (isAccount || isAdminOverride) &&
    !isPendingStaffingRequest;
  const canRespondStaffing = isPendingStaffingRequest && canRespondStaffingRole;
  const canMarkNotPurchased =
    isVideoDemoTask && status === 'INTERNAL_COMPLETED' && NOT_PURCHASE_ROLES.includes(role);
  const canDeleteTask =  isAdminOverride;

  const isPending =
    startTaskMutation.isPending ||
    submitResultForReviewMutation.isPending ||
    requestTaskStaffingMutation.isPending ||
    respondTaskStaffingMutation.isPending ||
    deleteTaskMutation.isPending ||
    customerNotPurchaseMutation.isPending;

  const blockMessage = useMemo(
    () => (isParentBlocked ? getSubtaskBlockMessage('nộp kết quả', task?.subtasks) : ''),
    [isParentBlocked, task?.subtasks]
  );

  if (!task) return null;

  const handleStart = async () => {
    try {
      await startTaskMutation.mutateAsync({ id: task.id, projectId: resolvedProjectId });
      Alert.alert('Thành công', 'Đã bắt đầu công việc');
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể bắt đầu công việc');
    }
  };

  const handleOpenResultModal = () => {
    if (onOpenResultModal) {
      onOpenResultModal();
      return;
    }
    Alert.alert('Thông báo', 'Vui lòng nộp kết quả tại khối "Kết quả" của công việc.');
  };

  const handleSubmitForReview = async () => {
    try {
      await submitResultForReviewMutation.mutateAsync({ id: task.id, projectId: resolvedProjectId });
      Alert.alert('Thành công', 'Đã gửi kết quả để duyệt');
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể gửi kết quả để duyệt');
    }
  };

  const handleRequestStaffing = async () => {
    const note = staffingNote.trim();
    if (!note) {
      setNoteError('Vui lòng nhập nhu cầu nhân sự');
      return;
    }
    setNoteError(null);
    try {
      await requestTaskStaffingMutation.mutateAsync({ id: task.id, note });
      Alert.alert('Thành công', 'Đã gửi yêu cầu bổ sung nhân sự cho PM');
      setIsStaffingModalOpen(false);
      setStaffingNote('');
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể gửi yêu cầu cho PM');
    }
  };

  const handleRespondStaffing = async (action: 'RESOLVE' | 'REJECT') => {
    try {
      await respondTaskStaffingMutation.mutateAsync({ id: task.id, action });
      Alert.alert(
        'Thành công',
        action === 'RESOLVE' ? 'Đã xác nhận bổ sung nhân sự' : 'Đã từ chối yêu cầu điều phối'
      );
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể xử lý yêu cầu điều phối');
    }
  };

  const handleCustomerNotPurchase = () => {
    Alert.alert('Xác nhận', 'Đánh dấu khách hàng không mua cho công việc này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            await customerNotPurchaseMutation.mutateAsync({
              id: task.id,
              projectId: resolvedProjectId,
            });
            Alert.alert('Thành công', 'Đã đánh dấu khách hàng không mua');
            onChanged();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể đánh dấu khách hàng không mua');
          }
        },
      },
    ]);
  };

  const handleDeleteTask = () => {
    // Không thể xóa công việc khi còn công việc con (subtask)
    if ((task.subtasks || []).length > 0) {
      Alert.alert('Không thể xóa', 'Không thể xóa công việc khi còn công việc con');
      return;
    }

    Alert.alert('Xác nhận xóa', `Bạn chắc chắn muốn xóa công việc "${task.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskMutation.mutateAsync({ id: task.id, projectId: resolvedProjectId });
            Alert.alert('Thành công', 'Đã xóa công việc');
            if (onDeleted) onDeleted();
            else onChanged();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể xóa công việc');
          }
        },
      },
    ]);
  };

  const hasAnyAction =
    isStartableWindow ||
    canUploadResult ||
    canSubmitForReview ||
    canRequestStaffing ||
    canRespondStaffing ||
    canMarkNotPurchased ||
    canDeleteTask;

  // Ẩn hoàn toàn khối thao tác khi không đủ quyền và không có cảnh báo nào
  if (!hasAnyAction && !isParentBlocked) return null;

  const buttonBase = 'flex-1 flex-row items-center justify-center gap-2 px-4 h-[42px] rounded-xl';
  const disabledClass = isPending ? 'opacity-60' : '';
  const blockedClass = 'opacity-40';

  return (
    <>
      <View className="gap-2">
        {/* <View className="flex-row items-center gap-2.5">
          <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center">
            <Feather name="zap" size={16} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-slate-900">Thao tác công việc</Text>
            <Text className="text-[10px] font-semibold text-slate-400">
              Vòng đời: bắt đầu → nộp kết quả → gửi duyệt
            </Text>
          </View>
        </View> */}

        {/* Banner khóa task cha khi còn công việc con chưa hoàn tất */}
        {isParentBlocked && (
          <View className="flex-row items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Feather name="alert-triangle" size={15} color="#D97706" />
            <Text className="flex-1 text-[11px] font-bold text-amber-700">{blockMessage}</Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-2">
          {/* 1. Bắt đầu — chỉ assignee */}
          {isStartableWindow && (
            <TouchableOpacity
              className={`${buttonBase} bg-blue-600 ${canStart && !isPending ? '' : blockedClass}`}
              onPress={handleStart}
              disabled={!canStart || isPending}
              activeOpacity={0.85}
            >
              {startTaskMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="play" size={15} color="#FFFFFF" />
              )}
              <Text className="text-xs font-bold text-white">Bắt đầu</Text>
            </TouchableOpacity>
          )}

          {/* 2. Nộp kết quả — mở modal nộp kết quả có sẵn của tasks/[id].tsx */}
          {/* {canUploadResult && (
            <TouchableOpacity
              className={`${buttonBase} bg-primary ${isParentBlocked || isPending ? blockedClass : ''}`}
              onPress={handleOpenResultModal}
              disabled={isParentBlocked || isPending}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={15} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">
                {hasSubmittedResult ? 'Cập nhật kết quả' : 'Nộp kết quả'}
              </Text>
            </TouchableOpacity>
          )} */}

          {/* 3. Gửi duyệt — đã có kết quả chờ gửi */}
          {canSubmitForReview && (
            <TouchableOpacity
              className={`${buttonBase} bg-emerald-600 ${isParentBlocked || isPending ? blockedClass : ''}`}
              onPress={handleSubmitForReview}
              disabled={isParentBlocked || isPending}
              activeOpacity={0.85}
            >
              {submitResultForReviewMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={15} color="#FFFFFF" />
              )}
              <Text className="text-xs font-bold text-white">Gửi duyệt</Text>
            </TouchableOpacity>
          )}

          {/* 4. Nhờ hỗ trợ (điều phối nhân sự) — Account/Admin, note bắt buộc */}
          {canRequestStaffing && (
            <TouchableOpacity
              className={`${buttonBase} bg-orange-50 border border-orange-200 ${disabledClass}`}
              onPress={() => {
                setNoteError(null);
                setIsStaffingModalOpen(true);
              }}
              disabled={isPending}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={15} color="#C2410C" />
              <Text className="text-xs font-bold text-orange-700">Nhờ hỗ trợ nhân sự</Text>
            </TouchableOpacity>
          )}

          {/* 5. Phản hồi điều phối — PM được chỉ định / ADMIN / BOD */}
          {canRespondStaffing && (
            <>
              <TouchableOpacity
                className={`${buttonBase} bg-emerald-600`}
                onPress={() => handleRespondStaffing('RESOLVE')}
                disabled={isPending}
                activeOpacity={0.85}
              >
                {respondTaskStaffingMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="check" size={15} color="#FFFFFF" />
                )}
                <Text className="text-xs font-bold text-white">Xác nhận điều phối</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`${buttonBase} bg-red-50 border border-red-200`}
                onPress={() => handleRespondStaffing('REJECT')}
                disabled={isPending}
                activeOpacity={0.85}
              >
                <Feather name="x" size={15} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Từ chối</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 6. Khách không mua — chỉ task Video AI demo, status INTERNAL_COMPLETED, BD/ADMIN_SALE/ADMIN/BOD */}
          {canMarkNotPurchased && (
            <TouchableOpacity
              className={`${buttonBase} bg-amber-50 border border-amber-200`}
              onPress={handleCustomerNotPurchase}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {customerNotPurchaseMutation.isPending ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Feather name="user-x" size={15} color="#D97706" />
              )}
              <Text className="text-xs font-bold text-amber-700">Khách không mua</Text>
            </TouchableOpacity>
          )}

          {/* 7. Xóa công việc — Account/ADMIN */}
          {/* {canDeleteTask && (
            <TouchableOpacity
              className={`${buttonBase} bg-red-50 border border-red-200`}
              onPress={handleDeleteTask}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {deleteTaskMutation.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={15} color="#DC2626" />
              )}
              <Text className="text-xs font-bold text-red-600">Xóa công việc</Text>
            </TouchableOpacity>
          )} */}
        </View>

        {/* Lý do không thể bắt đầu */}
        {isStartableWindow && !isAssignee && (
          <View className="flex-row items-center gap-2">
            <Feather name="info" size={12} color="#94A3B8" />
            <Text className="flex-1 text-[11px] font-semibold text-slate-400">
              Chỉ người được giao công việc mới có thể bắt đầu
            </Text>
          </View>
        )}
      </View>

      {/* Bottom sheet nhập nhu cầu nhân sự */}
      <Modal
        visible={isStaffingModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStaffingModalOpen(false)}
      >
        <View className="flex-1 bg-slate-900/50 justify-end">
          <View className="bg-white rounded-t-[24px] max-h-[90%] px-5 pt-4 pb-6 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">Yêu cầu PM bổ sung nhân sự</Text>
                <Text className="text-[11px] font-semibold text-slate-500">
                  PM sẽ nhận thông báo và thêm người vào đội dự án
                </Text>
              </View>
              <TouchableOpacity
                className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
                onPress={() => setIsStaffingModalOpen(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-bold text-slate-700">
                Nhu cầu nhân sự <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-3.5 py-3 min-h-[96px] text-[13px] text-slate-900 bg-white"
                placeholder="Ví dụ: Cần thêm 01 designer và 01 editor..."
                placeholderTextColor="#94A3B8"
                value={staffingNote}
                onChangeText={(text) => {
                  setStaffingNote(text);
                  if (noteError) setNoteError(null);
                }}
                multiline
                numberOfLines={4}
                maxLength={1000}
                style={{ textAlignVertical: 'top' }}
              />
              {noteError ? (
                <Text className="text-[11px] font-semibold text-red-600">{noteError}</Text>
              ) : null}
            </View>

            <View className="flex-row gap-3 pt-1">
              <TouchableOpacity
                className="flex-1 min-h-[48px] py-3.5 rounded-xl border border-slate-200 items-center justify-center"
                onPress={() => setIsStaffingModalOpen(false)}
                disabled={requestTaskStaffingMutation.isPending}
              >
                <Text className="text-sm font-semibold text-slate-600">Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-[2] min-h-[48px] flex-row items-center justify-center gap-2 bg-primary py-3.5 rounded-xl ${
                  requestTaskStaffingMutation.isPending ? 'opacity-60' : ''
                }`}
                onPress={handleRequestStaffing}
                disabled={requestTaskStaffingMutation.isPending}
                activeOpacity={0.85}
              >
                {requestTaskStaffingMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="send" size={15} color="#FFFFFF" />
                )}
                <Text className="text-sm font-bold text-white">Gửi cho PM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
