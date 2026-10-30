import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getTaskPolicy } from '@/utils/taskPolicy';
import { useAuth } from '@/context/AuthContext';
import { type TaskDetail } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
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
  canAddSubtask?: boolean;
  onOpenSubtaskModal?: () => void;
  canRemind?: boolean;
  onSendReminder?: () => void;
  canAssign?: boolean;
  onOpenAssignModal?: () => void;
  canRework?: boolean;
  onOpenReworkModal?: () => void;
  canReview?: boolean;
  onOpenReviewModal?: () => void;
  canCustomerApprove?: boolean;
  onCustomerApprove?: () => void;
  canRequestSupport?: boolean;
  onRequestSupport?: () => void;
  isActionLoading?: boolean;
}

/** Trạng thái cho phép Account/Admin gửi yêu cầu bổ sung nhân sự (mirror erp-UI TaskDelegationPanel) */


/** Vai trò được phép "Khách không mua" (task Video AI demo) */


export default function TaskLifecycleActions({
  task,
  projectId,
  onChanged,
  onOpenResultModal,
  onDeleted,
  canAddSubtask,
  onOpenSubtaskModal,
  canRemind,
  onSendReminder,
  canAssign,
  onOpenAssignModal,
  canRework,
  onOpenReworkModal,
  canReview,
  onOpenReviewModal,
  canCustomerApprove,
  onCustomerApprove,
  canRequestSupport,
  onRequestSupport,
  isActionLoading = false,
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


  const resolvedProjectId = projectId || task?.project?.id;
  const policy = getTaskPolicy(task, user);
  const isStartableWindow = policy.start.enabled;
  const canStart = policy.start.enabled;
  const isAssignee = policy.start.enabled;
  const isParentBlocked = isParentBlockedBySubtasks(task);
  const canUploadResult = policy.uploadResult.enabled;
  const hasSubmittedResult = Boolean(task?.result);
  const canSubmitForReview = policy.submitReview.enabled;
  const canRequestStaffing = policy.requestStaffing.enabled;
  const canRespondStaffing = (policy.resolveStaffing.enabled || policy.rejectStaffing.enabled) && task?.supportRequestType === 'STAFFING' && task?.isSupportRequested && !task?.isSupportAccepted;
  const canMarkNotPurchased = policy.customerNotPurchase.enabled;
  const canDeleteTask = policy.delete.enabled;

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
    if (!policy.start.enabled || isPending) return;
    try {
      await startTaskMutation.mutateAsync({ id: task.id, projectId: resolvedProjectId });
      Alert.alert('Thành công', 'Đã bắt đầu công việc');
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể bắt đầu công việc');
    }
  };

  const handleOpenResultModal = () => {
    if (!policy.uploadResult.enabled || isPending) return;
    if (onOpenResultModal) {
      onOpenResultModal();
      return;
    }
    Alert.alert('Thông báo', 'Vui lòng nộp kết quả tại khối "Kết quả" của công việc.');
  };

  const handleSubmitForReview = async () => {
    if (!policy.submitReview.enabled || isPending) return;
    try {
      await submitResultForReviewMutation.mutateAsync({ id: task.id, projectId: resolvedProjectId });
      Alert.alert('Thành công', 'Đã gửi kết quả để duyệt');
      onChanged();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể gửi kết quả để duyệt');
    }
  };

  const handleRequestStaffing = async () => {
    if (!policy.requestStaffing.enabled || isPending) return;
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
    if (!(action === 'RESOLVE' ? policy.resolveStaffing : policy.rejectStaffing).enabled || isPending) return;
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
    if (!policy.customerNotPurchase.enabled || isPending) return;
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
    if (!policy.delete.enabled || isPending) return;
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
    canRequestStaffing ||
    canRespondStaffing ||
    canMarkNotPurchased ||
    canDeleteTask ||
    canAddSubtask ||
    canRemind ||
    canAssign ||
    canRework ||
    canReview ||
    canCustomerApprove ||
    canRequestSupport;

  // Ẩn hoàn toàn khối thao tác khi không đủ quyền và không có cảnh báo nào
  if (!hasAnyAction && !isParentBlocked) return null;

  const buttonBase = 'flex-row items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl min-h-[40px]';
  const disabledClass = isPending || isActionLoading ? 'opacity-60' : '';
  const blockedClass = 'opacity-40';

  return (
    <>
      <View className="gap-2">
        {/* Banner khóa task cha khi còn công việc con chưa hoàn tất */}
        {isParentBlocked && (
          <View className="flex-row items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Feather name="alert-triangle" size={15} color="#D97706" />
            <Text className="flex-1 text-[11px] font-bold text-amber-700">{blockMessage}</Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, flexDirection: 'row', alignItems: 'center' }}
          className="pb-0.5"
        >
          {/* 1. Bắt đầu công việc */}
          {policy.start.enabled && (
            <TouchableOpacity
              accessibilityLabel="Bắt đầu công việc"
              className={`${buttonBase} bg-primary ${isPending ? blockedClass : ''}`}
              onPress={handleStart}
              disabled={isPending}
              activeOpacity={0.85}
              style={[isPending ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              {startTaskMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="play" size={14} color="#FFFFFF" />
              )}
              <Text className="text-xs font-bold text-white">Bắt đầu công việc</Text>
            </TouchableOpacity>
          )}

          {/* 2. Nhắc việc */}
          {canRemind && onSendReminder && (
            <TouchableOpacity
              accessibilityLabel="Nhắc việc"
              className={`${buttonBase} bg-primary ${isActionLoading ? blockedClass : ''}`}
              onPress={onSendReminder}
              disabled={isActionLoading || isPending}
              activeOpacity={0.85}
              style={[isActionLoading || isPending ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="bell" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Nhắc việc</Text>
            </TouchableOpacity>
          )}

          {/* 3. Yêu cầu thêm người */}
          {policy.requestStaffing.enabled && (
            <TouchableOpacity
              accessibilityLabel="Yêu cầu thêm người"
              className={`${buttonBase} bg-orange-50 border border-orange-200 ${disabledClass}`}
              onPress={() => {
                setNoteError(null);
                setIsStaffingModalOpen(true);
              }}
              disabled={isPending}
              activeOpacity={0.85}
              style={[isPending ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="user-plus" size={14} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-orange-700">
                {task?.supportRequestType === 'STAFFING' && task?.isSupportRequested && !task?.isSupportAccepted
                  ? 'Đang chờ PM'
                  : 'Yêu cầu thêm người'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 4. Thêm subtask */}
          {canAddSubtask && onOpenSubtaskModal && (
            <TouchableOpacity
              accessibilityLabel="Thêm subtask"
              className={`${buttonBase} bg-orange-50 border border-orange-200 ${disabledClass}`}
              onPress={onOpenSubtaskModal}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              style={[isPending || isActionLoading ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="plus" size={14} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-orange-700">Thêm subtask</Text>
            </TouchableOpacity>
          )}

          {/* 5. Phân công (chỉ khi task chưa có người thực hiện) */}
          {canAssign && onOpenAssignModal && (
            <TouchableOpacity
              accessibilityLabel="Phân công"
              className={`${buttonBase} bg-primary`}
              onPress={onOpenAssignModal}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              style={[isPending || isActionLoading ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="users" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Phân công</Text>
            </TouchableOpacity>
          )}

          {/* 6. Yêu cầu làm lại */}
          {canRework && onOpenReworkModal && (
            <TouchableOpacity
              accessibilityLabel="Yêu cầu làm lại"
              className={`${buttonBase} bg-amber-50 border border-amber-200`}
              onPress={onOpenReworkModal}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Feather name="rotate-ccw" size={14} color="#D97706" />
              <Text className="text-xs font-bold text-amber-700">Yêu cầu làm lại</Text>
            </TouchableOpacity>
          )}

          {/* 7. Đánh giá & Duyệt */}
          {canReview && onOpenReviewModal && (
            <TouchableOpacity
              accessibilityLabel="Đánh giá và duyệt"
              className={`${buttonBase} bg-primary`}
              onPress={onOpenReviewModal}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Feather name="check-circle" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Đánh giá & Duyệt</Text>
            </TouchableOpacity>
          )}

          {/* 8. Khách hàng duyệt */}
          {canCustomerApprove && onCustomerApprove && (
            <TouchableOpacity
              accessibilityLabel="Khách hàng duyệt"
              className={`${buttonBase} bg-emerald-600`}
              onPress={onCustomerApprove}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              style={[isPending || isActionLoading ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="check" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Khách hàng duyệt</Text>
            </TouchableOpacity>
          )}

          {/* 9. Nhờ hỗ trợ */}
          {canRequestSupport && onRequestSupport && (
            <TouchableOpacity
              accessibilityLabel="Nhờ hỗ trợ"
              className={`${buttonBase} bg-red-50 border border-red-200`}
              onPress={onRequestSupport}
              disabled={isPending || isActionLoading}
              activeOpacity={0.85}
              style={[isPending || isActionLoading ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              <Feather name="help-circle" size={14} color="#DC2626" />
              <Text className="text-xs font-bold text-red-600">Nhờ hỗ trợ</Text>
            </TouchableOpacity>
          )}

          {/* 10. Phản hồi điều phối nhân sự — PM được chỉ định / ADMIN / BOD */}
          {canRespondStaffing && (
            <>
              {policy.resolveStaffing.enabled && (
                <TouchableOpacity
                  accessibilityLabel="Xác nhận bổ sung nhân sự"
                  className={`${buttonBase} bg-emerald-600`}
                  onPress={() => handleRespondStaffing('RESOLVE')}
                  disabled={isPending}
                  activeOpacity={0.85}
                  style={[isPending ? { opacity: 0.5 } : undefined]}
                  accessibilityRole="button"
                >
                  {respondTaskStaffingMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                  <Text className="text-xs font-bold text-white">Xác nhận điều phối</Text>
                </TouchableOpacity>
              )}

              {policy.rejectStaffing.enabled && (
                <TouchableOpacity
                  accessibilityLabel="Từ chối yêu cầu nhân sự"
                  className={`${buttonBase} bg-red-50 border border-red-200`}
                  onPress={() => handleRespondStaffing('REJECT')}
                  disabled={isPending}
                  activeOpacity={0.85}
                  style={[isPending ? { opacity: 0.5 } : undefined]}
                  accessibilityRole="button"
                >
                  <Feather name="x" size={14} color="#DC2626" />
                  <Text className="text-xs font-bold text-red-600">Từ chối</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* 11. Khách không mua — chỉ task Video AI demo */}
          {policy.customerNotPurchase.enabled && (
            <TouchableOpacity
              accessibilityLabel="Khách hàng không mua"
              className={`${buttonBase} bg-amber-50 border border-amber-200`}
              onPress={handleCustomerNotPurchase}
              disabled={isPending}
              activeOpacity={0.85}
              style={[isPending ? { opacity: 0.5 } : undefined]}
              accessibilityRole="button"
            >
              {customerNotPurchaseMutation.isPending ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Feather name="user-x" size={14} color="#D97706" />
              )}
              <Text className="text-xs font-bold text-amber-700">Khách không mua</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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

              {policy.requestStaffing.enabled && (
                <TouchableOpacity accessibilityLabel="Yêu cầu thêm người"
                  className={`min-h-[48px] flex-[2] flex-row items-center justify-center gap-2 bg-primary py-3.5 rounded-xl ${requestTaskStaffingMutation.isPending ? 'opacity-60' : ''
                    }`}
                  onPress={handleRequestStaffing}
                  disabled={requestTaskStaffingMutation.isPending}
                  activeOpacity={0.85}
                  style={[requestTaskStaffingMutation.isPending ? { opacity: 0.5 } : undefined]} accessibilityRole="button">
                  {requestTaskStaffingMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="send" size={15} color="#FFFFFF" />
                  )}
                  <Text className="text-sm font-bold text-white">Gửi cho PM</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
