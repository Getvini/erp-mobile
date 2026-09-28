import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  useApproveCloseRequestMutation,
  useApprovePauseRequestMutation,
  usePauseHistoryQuery,
  useRejectCloseRequestMutation,
  useRejectPauseRequestMutation,
} from '@/hooks/queries/useProjects';
import {
  CLOSE_MODE_LABELS,
  PAUSE_MODE_LABELS,
  PAUSE_REQUEST_STATUS_LABELS,
  ProjectPauseRequest,
  canApproveClose,
  canApprovePause,
  getPauseHistoryActorLabel,
} from '@/utils/projectPause';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { BrandColors } from '@/constants/colors';

/** Màu badge trạng thái (Web dùng PAUSE_REQUEST_STATUS_COLORS trong utils). */
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#FFFBEB', color: '#B45309' },
  APPROVED: { bg: '#ECFDF5', color: '#047857' },
  REJECTED: { bg: '#FEF2F2', color: '#B91C1C' },
  RESUMED: { bg: '#EFF6FF', color: '#1D4ED8' },
  CLOSED: { bg: '#F1F5F9', color: '#334155' },
};

interface PauseHistoryTabProps {
  projectId: string;
  projectName?: string;
  /** Gọi lại sau khi duyệt / từ chối để cha refresh dự án + task. */
  onChanged?: () => void;
}

/**
 * Tab "Lịch sử tạm dừng" (P1.11) — mirror `PauseHistorySection.jsx` của Web.
 * Dùng FlatList (không ScrollView) vì lịch sử có thể dài.
 */
export default function PauseHistoryTab({
  projectId,
  projectName,
  onChanged,
}: PauseHistoryTabProps) {
  const { user } = useAuth();

  const {
    data: historyData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePauseHistoryQuery(projectId, Boolean(projectId));

  const history: ProjectPauseRequest[] = useMemo(
    () => (historyData as ProjectPauseRequest[]) || [],
    [historyData]
  );

  const approvePauseMutation = useApprovePauseRequestMutation();
  const rejectPauseMutation = useRejectPauseRequestMutation();
  const approveCloseMutation = useApproveCloseRequestMutation();
  const rejectCloseMutation = useRejectCloseRequestMutation();

  const isBusy =
    approvePauseMutation.isPending ||
    rejectPauseMutation.isPending ||
    approveCloseMutation.isPending ||
    rejectCloseMutation.isPending;

  const [rejectTarget, setRejectTarget] = useState<{ requestId: string; isClose: boolean } | null>(
    null
  );
  const [feedback, setFeedback] = useState('');

  const permissionCtx = useMemo(() => ({ role: user?.role }), [user?.role]);

  const closeRejectSheet = () => {
    if (isBusy) return;
    setRejectTarget(null);
    setFeedback('');
  };

  const handleApprove = (request: ProjectPauseRequest) => {
    const isCloseRequest = Boolean(request.closeMode);
    Alert.alert(
      isCloseRequest ? 'Duyệt đóng dự án' : 'Duyệt tạm dừng dự án',
      isCloseRequest
        ? 'Duyệt đề nghị đóng dự án? Dự án sẽ chuyển sang trạng thái Đã hủy (CANCELLED).'
        : 'Duyệt yêu cầu tạm dừng? Dự án sẽ chuyển sang trạng thái Tạm dừng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt',
          onPress: async () => {
            try {
              if (isCloseRequest) {
                await approveCloseMutation.mutateAsync({ requestId: request.id, projectId });
                Alert.alert('Thành công', 'Đã duyệt đóng dự án.');
              } else {
                await approvePauseMutation.mutateAsync({ requestId: request.id, projectId });
                Alert.alert('Thành công', 'Đã duyệt tạm dừng dự án.');
              }
              onChanged?.();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể duyệt yêu cầu.');
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const trimmed = feedback.trim();
    if (!trimmed) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      if (rejectTarget.isClose) {
        await rejectCloseMutation.mutateAsync({
          requestId: rejectTarget.requestId,
          feedback: trimmed,
          projectId,
        });
        Alert.alert('Thành công', 'Đã từ chối đề nghị đóng dự án.');
      } else {
        await rejectPauseMutation.mutateAsync({
          requestId: rejectTarget.requestId,
          feedback: trimmed,
          projectId,
        });
        Alert.alert('Thành công', 'Đã từ chối yêu cầu tạm dừng.');
      }
      setRejectTarget(null);
      setFeedback('');
      onChanged?.();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể từ chối yêu cầu.');
    }
  };

  const renderItem = ({ item }: { item: ProjectPauseRequest }) => {
    const isCloseRequest = Boolean(item.closeMode);
    const badge = STATUS_BADGE[item.status || ''] || { bg: '#F1F5F9', color: '#475569' };
    const showActions =
      item.status === 'PENDING' &&
      (isCloseRequest ? canApproveClose(permissionCtx) : canApprovePause(permissionCtx));

    return (
      <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: badge.bg }}>
              <Text className="text-[11px] font-bold" style={{ color: badge.color }}>
                {PAUSE_REQUEST_STATUS_LABELS[item.status || ''] || item.status || '—'}
              </Text>
            </View>
            <View className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-slate-600">
                {isCloseRequest ? 'Đóng dự án' : 'Tạm dừng'}
              </Text>
            </View>
            <Text className="text-[11px] text-slate-400">
              {isCloseRequest
                ? CLOSE_MODE_LABELS[item.closeMode || ''] || item.closeMode
                : PAUSE_MODE_LABELS[item.pauseMode || ''] || item.pauseMode || '—'}
            </Text>
          </View>
          <Text className="text-[11px] font-medium text-slate-400">
            {formatDateToDDMMYYYY(item.requestedAt || item.createdAt, '—')}
          </Text>
        </View>

        <View className="flex-row items-start gap-2">
          <Feather name="message-square" size={13} color="#94A3B8" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] font-medium text-slate-700">
            {item.reason || '—'}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Feather name="user" size={11} color="#94A3B8" />
            <Text className="text-[11px] text-slate-500">
              Người gửi:{' '}
              <Text className="font-bold text-slate-700">{item.requester?.fullName || '—'}</Text>
              {item.requesterRole ? (
                <Text className="text-slate-400"> ({item.requesterRole})</Text>
              ) : null}
            </Text>
          </View>

          <Text className="text-[11px] text-slate-500">
            {isCloseRequest ? 'Người đóng' : 'Người duyệt'}:{' '}
            <Text className="font-bold text-slate-700">{getPauseHistoryActorLabel(item)}</Text>
          </Text>
        </View>

        {item.status === 'CLOSED' && (
          <View className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
            <Text className="text-[11px] font-medium text-slate-600">
              Kết quả: <Text className="font-bold text-emerald-700">{item.acceptedTaskCount || 0}</Text>{' '}
              công việc nghiệm thu ·{' '}
              <Text className="font-bold text-red-600">{item.cancelledTaskCount || 0}</Text> công
              việc hủy
            </Text>
          </View>
        )}

        {item.feedback ? (
          <View className="rounded-xl border border-red-100 bg-red-50/50 p-2.5">
            <Text className="text-[11px] text-red-800">
              <Text className="font-bold">Lý do từ chối:</Text> {item.feedback}
            </Text>
          </View>
        ) : null}

        {item.resumedAt ? (
          <Text className="text-[11px] font-medium text-emerald-700">
            Đã làm tiếp lúc {formatDateToDDMMYYYY(item.resumedAt, '—')}
            {item.resumeReason ? ` — ${item.resumeReason}` : ''}
          </Text>
        ) : null}

        {showActions && (
          <View className="flex-row gap-2 border-t border-slate-100 pt-2.5">
            <TouchableOpacity
              className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 ${
                isBusy ? 'opacity-50' : ''
              }`}
              onPress={() => handleApprove(item)}
              disabled={isBusy}
              activeOpacity={0.85}
            >
              <Feather name="check" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">
                {isCloseRequest ? 'Duyệt đóng dự án' : 'Duyệt tạm dừng'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white ${
                isBusy ? 'opacity-50' : ''
              }`}
              onPress={() =>
                setRejectTarget({ requestId: item.id, isClose: isCloseRequest })
              }
              disabled={isBusy}
              activeOpacity={0.85}
            >
              <Feather name="slash" size={14} color="#DC2626" />
              <Text className="text-xs font-bold text-red-600">Từ chối</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-2.5 py-10">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-500">Đang tải lịch sử tạm dừng...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-2.5 px-6 py-10">
        <Feather name="alert-circle" size={36} color="#DC2626" />
        <Text className="text-center text-[15px] font-bold text-slate-700">
          Không tải được lịch sử tạm dừng
        </Text>
        <Text className="max-w-[280px] text-center text-[13px] text-slate-400">
          {(error as any)?.message || 'Vui lòng kiểm tra kết nối và thử lại.'}
        </Text>
        <TouchableOpacity
          className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-5"
          onPress={() => refetch()}
          activeOpacity={0.85}
        >
          <Feather name="refresh-cw" size={15} color="#FFFFFF" />
          <Text className="text-sm font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={history}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
        ListHeaderComponent={
          projectName ? (
            <View className="mb-1">
              <Text className="text-[15px] font-bold text-slate-950">Lịch sử tạm dừng</Text>
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                {projectName}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50/40 py-14">
            <Feather name="clock" size={36} color="#CBD5E1" />
            <Text className="text-[15px] font-bold text-slate-500">Chưa có lịch sử tạm dừng</Text>
            <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
              Lịch sử tạm dừng và đóng dự án sẽ hiển thị ở đây.
            </Text>
          </View>
        }
      />

      {/* Bottom sheet từ chối */}
      <Modal
        visible={Boolean(rejectTarget)}
        transparent
        animationType="slide"
        onRequestClose={closeRejectSheet}
      >
        <View className="flex-1 justify-end bg-slate-900/50">
          <View className="gap-3 rounded-t-[24px] bg-white p-5">
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <Text className="flex-1 text-base font-bold text-slate-900">
                {rejectTarget?.isClose ? 'Từ chối đề nghị đóng dự án' : 'Từ chối yêu cầu tạm dừng'}
              </Text>
              <TouchableOpacity
                onPress={closeRejectSheet}
                className="h-12 w-12 items-center justify-center"
                disabled={isBusy}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-slate-600">
                Lý do từ chối <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                className="min-h-[88px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                placeholder="Nhập lý do từ chối..."
                placeholderTextColor="#94A3B8"
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={3}
                editable={!isBusy}
                style={{ textAlignVertical: 'top' }}
                autoFocus
              />
            </View>

            <View className="flex-row gap-2.5 border-t border-slate-100 pt-3.5">
              <TouchableOpacity
                className="h-12 flex-1 items-center justify-center rounded-xl bg-slate-100"
                onPress={closeRejectSheet}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-bold text-slate-500">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`h-12 flex-[2] items-center justify-center rounded-xl bg-red-600 ${
                  isBusy ? 'opacity-60' : ''
                }`}
                onPress={handleReject}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {isBusy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
