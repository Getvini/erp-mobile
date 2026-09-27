import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AcceptanceItem, ACCEPTANCE_STATUS_CONFIG } from '@/services/acceptanceService';
import { formatNumber } from '@/utils/formatters';

interface ProjectAcceptanceTabProps {
  acceptances: AcceptanceItem[];
  isLoading: boolean;
  projectStatus?: string;
  isPmOrAdmin?: boolean;
  onOpenCreateAcceptance: () => void;
  onOpenReviewAcceptance?: (item: AcceptanceItem) => void;
}

export default function ProjectAcceptanceTab({
  acceptances,
  isLoading,
  projectStatus,
  isPmOrAdmin = false,
  onOpenCreateAcceptance,
  onOpenReviewAcceptance,
}: ProjectAcceptanceTabProps) {
  if (isLoading) {
    return (
      <View className="py-12 items-center justify-center gap-2.5">
        <ActivityIndicator size="large" color="#F38820" />
        <Text className="text-xs text-slate-400">Đang tải lịch sử nghiệm thu...</Text>
      </View>
    );
  }

  const isPendingConfirmation = projectStatus === 'PENDING_CONFIRMATION';

  const getStatusBadge = (status: string) => {
    const config = ACCEPTANCE_STATUS_CONFIG[status];
    return {
      bg: config?.bg || '#F1F5F9',
      color: config?.color || '#64748B',
      label: config?.text || status,
    };
  };

  return (
    <View className="p-4 gap-4">
      {/* Pending Confirmation Warning Banner */}
      {isPendingConfirmation && (
        <View className="flex-row items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-2xl p-3.5">
          <Feather name="lock" size={18} color="#C2410C" />
          <View className="flex-1">
            <Text className="text-sm font-bold text-orange-800 mb-0.5">Dự án chưa được Account chấp nhận</Text>
            <Text className="text-xs text-orange-950 leading-5">
              Chưa thể tạo hoặc yêu cầu nghiệm thu mới cho tới khi PM chấp nhận dự án.
            </Text>
          </View>
        </View>
      )}

      {/* Top Action Bar */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text-primary">Biên bản nghiệm thu ({acceptances.length})</Text>
        {!isPendingConfirmation && isPmOrAdmin && (
          <TouchableOpacity
            className="flex-row items-center gap-1 bg-primary px-3 py-2 rounded-xl"
            onPress={onOpenCreateAcceptance}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white">Tạo nghiệm thu</Text>
          </TouchableOpacity>
        )}
      </View>

      {acceptances.length === 0 ? (
        <View className="py-10 items-center justify-center gap-2">
          <Feather name="clipboard" size={40} color="#CBD5E1" />
          <Text className="text-sm font-bold text-slate-600">Chưa có biên bản nghiệm thu nào</Text>
          <Text className="text-xs text-slate-400 text-center max-w-[260px]">
            Dự án này chưa gửi biên bản nghiệm thu. Bấm "Tạo nghiệm thu" để tạo yêu cầu mới.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {acceptances.map((item) => {
            const statusInfo = getStatusBadge(item.status);
            return (
              <View key={item.id} className="bg-surface rounded-2xl p-3.5 border border-border gap-2">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
                      {item.name || (item.acceptanceCode ? `#${item.acceptanceCode}` : 'Biên bản nghiệm thu')}
                    </Text>
                    {item.acceptanceCode && item.name ? (
                      <Text className="text-xs text-slate-500 mt-0.5">#{item.acceptanceCode}</Text>
                    ) : null}
                  </View>
                  <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: statusInfo.bg }}>
                    <Text className="text-[11px] font-bold" style={{ color: statusInfo.color }}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {item.amount ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-slate-500">Giá trị nghiệm thu:</Text>
                    <Text className="text-sm font-bold text-emerald-600">{formatNumber(item.amount)} đ</Text>
                  </View>
                ) : null}

                {item.note ? (
                  <Text className="text-xs text-slate-500 leading-4" numberOfLines={2}>
                    Ghi chú: {item.note}
                  </Text>
                ) : null}

                <View className="flex-row items-center justify-between border-t border-slate-100 pt-2 mt-0.5">
                  {item.creator?.fullName && (
                    <View className="flex-row items-center gap-1 flex-1">
                      <Feather name="user" size={12} color="#64748B" />
                      <Text className="text-xs text-slate-500">Người yêu cầu: {item.creator.fullName}</Text>
                    </View>
                  )}

                  {onOpenReviewAcceptance && (
                    <TouchableOpacity
                      className="flex-row items-center gap-0.5"
                      onPress={() => onOpenReviewAcceptance(item)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-xs font-bold text-primary">
                        {item.status === 'PENDING' ? 'Phê duyệt' : 'Chi tiết'}
                      </Text>
                      <Feather name="chevron-right" size={14} color="#F38820" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

