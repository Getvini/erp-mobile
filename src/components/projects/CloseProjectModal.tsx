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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useCloseProjectDirectMutation,
  useHoldSummaryQuery,
  useRequestCloseProjectMutation,
} from '@/hooks/queries/useProjects';
import { BrandColors } from '@/constants/colors';
import { formatVND, formatNumber } from '@/utils/formatters';

interface CloseProjectModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  /** true = BD/BOD/ADMIN đóng ngay (lý do bắt buộc); false = PM gửi đề nghị chờ duyệt. */
  isDirect: boolean;
  onSuccess: () => void;
}

/**
 * Bottom sheet Đóng dự án (P1.11) — mirror `CloseProjectModal.jsx` của Web.
 * Hiển thị `hold-summary` trước khi xác nhận để người dùng biết hậu quả.
 */
export default function CloseProjectModal({
  visible,
  onClose,
  projectId,
  projectName,
  isDirect,
  onSuccess,
}: CloseProjectModalProps) {
  const [reason, setReason] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  const closeDirectMutation = useCloseProjectDirectMutation();
  const requestCloseMutation = useRequestCloseProjectMutation();
  const isSubmitting = isDirect ? closeDirectMutation.isPending : requestCloseMutation.isPending;

  // Chỉ gọi hold-summary khi sheet đang mở.
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useHoldSummaryQuery(projectId, visible && Boolean(projectId));

  // Reset lý do khi đóng modal — điều chỉnh state trong lúc render (tránh set-state-in-effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setReason('');
  }

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (isDirect && !trimmed) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập lý do đóng dự án');
      return;
    }

    try {
      if (isDirect) {
        await closeDirectMutation.mutateAsync({ id: projectId, reason: trimmed });
        Alert.alert('Thành công', 'Đã đóng dự án.');
      } else {
        await requestCloseMutation.mutateAsync({ id: projectId, reason: trimmed || undefined });
        Alert.alert('Thành công', 'Đã gửi đề nghị đóng dự án — đang chờ BOD duyệt.');
      }
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể đóng dự án.');
    }
  };

  const debtsCount = Number(summary?.debtsToLock?.count || 0);

  const renderSummary = () => {
    if (isLoadingSummary) {
      return (
        <View className="items-center gap-2 py-6">
          <ActivityIndicator size="small" color={BrandColors.primary} />
          <Text className="text-[13px] text-slate-500">Đang tải thống kê trước khi đóng...</Text>
        </View>
      );
    }

    if (isSummaryError) {
      return (
        <View className="items-center gap-2 rounded-2xl border border-red-100 bg-red-50/60 p-4">
          <Feather name="alert-circle" size={22} color="#DC2626" />
          <Text className="text-center text-[13px] font-semibold text-red-700">
            Không tải được thống kê trước khi đóng dự án.
          </Text>
          <TouchableOpacity
            className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4"
            onPress={() => refetchSummary()}
            disabled={isFetchingSummary}
            activeOpacity={0.8}
          >
            {isFetchingSummary ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Feather name="refresh-cw" size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Thử lại</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (!summary) {
      return (
        <View className="items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Text className="text-center text-xs text-slate-500">
            Không có dữ liệu thống kê cho dự án này.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View className="flex-row gap-2">
          <View className="flex-1 items-center gap-0.5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
            <Feather name="check-circle" size={15} color="#059669" />
            <Text className="text-2xl font-black text-emerald-700">
              {formatNumber(summary?.acceptedCount || 0)}
            </Text>
            <Text className="text-[10px] font-bold uppercase text-emerald-700">Nghiệm thu</Text>
            <Text className="text-[10px] text-emerald-600">
              +{formatNumber(summary?.estimatedVinicoin || 0)} Vinicoin
            </Text>
          </View>

          <View className="flex-1 items-center gap-0.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <Feather name="minus-circle" size={15} color="#64748B" />
            <Text className="text-2xl font-black text-slate-600">
              {formatNumber(summary?.unchangedCount || 0)}
            </Text>
            <Text className="text-[10px] font-bold uppercase text-slate-600">Giữ nguyên</Text>
            <Text className="text-[10px] text-slate-400">không thưởng</Text>
          </View>

          <View className="flex-1 items-center gap-0.5 rounded-2xl border border-red-100 bg-red-50/60 p-3">
            <Feather name="x-circle" size={15} color="#DC2626" />
            <Text className="text-2xl font-black text-red-700">
              {formatNumber(summary?.cancelledCount || 0)}
            </Text>
            <Text className="text-[10px] font-bold uppercase text-red-700">Hủy</Text>
            <Text className="text-[10px] text-red-500">không thưởng</Text>
          </View>
        </View>

        {debtsCount > 0 && (
          <View className="mt-2 flex-row items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
            <Feather name="lock" size={15} color="#D97706" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs font-medium leading-4 text-amber-800">
              <Text className="font-bold">{debtsCount} khoản công nợ</Text> chưa thu sẽ bị{' '}
              <Text className="font-bold">KHÓA</Text> (tổng{' '}
              {formatVND(summary?.debtsToLock?.totalAmount || 0)}). Sau khi khóa, không thể ghi nhận
              thanh toán cho các khoản này.
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-slate-900/50">
        <View className="max-h-[88%] gap-3 rounded-t-[24px] bg-white p-5">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <View className="flex-1 flex-row items-center gap-2.5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-slate-700">
                <Feather name="archive" size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">
                  {isDirect ? 'Đóng dự án' : 'Đề nghị đóng dự án'}
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
            <Text className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Hậu quả khi đóng
            </Text>

            {renderSummary()}

            {/* Luật chốt công việc */}
            <View className="mt-2 gap-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Luật chốt công việc
              </Text>
              <Text className="text-[11px] font-medium leading-4 text-slate-600">
                • Hoàn thành (khách đã nghiệm thu) → Nghiệm thu + Vinicoin{'\n'}• Hoàn thành nội bộ →
                giữ nguyên trạng thái, không Vinicoin{'\n'}• Đang làm dở → Hủy, không Vinicoin
              </Text>
            </View>

            {/* Lý do */}
            <View className="mt-1 gap-1.5">
              <Text className="text-xs font-semibold text-slate-600">
                Lý do đóng {isDirect ? <Text className="text-danger">*</Text> : null}
              </Text>
              <TextInput
                className="min-h-[80px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                placeholder={
                  isDirect
                    ? 'Ví dụ: Khách chốt dừng hẳn dự án...'
                    : 'Ghi chú thêm (không bắt buộc)...'
                }
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
                style={{ textAlignVertical: 'top' }}
              />
              {isDirect ? (
                <Text className="text-[11px] text-slate-400">
                  Bắt buộc — vì đóng trực tiếp không qua duyệt, lý do là căn cứ duy nhất để truy vết.
                </Text>
              ) : null}
            </View>

            {/* Cảnh báo trạng thái */}
            <View
              className={`flex-row items-start gap-2 rounded-2xl border p-3.5 ${
                isDirect ? 'border-red-200 bg-red-50/70' : 'border-blue-100 bg-blue-50/60'
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
                  ? 'Hành động này KHÔNG THỂ HOÀN TÁC. Dự án sẽ chuyển sang trạng thái Đã hủy (CANCELLED). Công việc bị chốt, Vinicoin được trả, công nợ bị khóa — tất cả ngay lập tức, không cần ai duyệt.'
                  : 'Đề nghị sẽ được gửi tới BOD/ADMIN để duyệt. Dự án vẫn đang tạm dừng cho tới khi được duyệt, sau đó sẽ chuyển sang trạng thái Đã hủy (CANCELLED).'}
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
                isDirect ? 'bg-red-600' : 'bg-slate-700'
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
                    {isDirect ? 'Đóng dự án ngay' : 'Gửi đề nghị đóng'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
