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
import { canSendAcceptance } from '@/utils/rbac';
import { isProjectClosed, isProjectOnHold } from '@/utils/acceptance';
import { useAuthStore } from '@/stores/useAuthStore';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectTabHeader } from '@/components/projects/ProjectTabHeader';

interface ProjectAcceptanceTabProps {
  acceptances: AcceptanceItem[];
  isLoading: boolean;
  projectStatus?: string;
  projectHasAccount: boolean;
  projectIsOnHold?: boolean;
  /**
   * @deprecated RBAC được tính lại bên trong bằng `canSendAcceptance(role)`.
   * Trước đây component nhận `isPmOrAdmin || isCurrentTeamLead`, khiến Account/Team Lead
   * vẫn thấy nút "Tạo nghiệm thu" — sai so với Web (ContractInfo.jsx:357).
   */
  isPmOrAdmin?: boolean;
  onOpenCreateAcceptance: () => void;
  onOpenReviewAcceptance?: (item: AcceptanceItem) => void;
}

export default function ProjectAcceptanceTab({
  acceptances,
  isLoading,
  projectStatus,
  projectHasAccount,
  projectIsOnHold,
  onOpenCreateAcceptance,
  onOpenReviewAcceptance,
}: ProjectAcceptanceTabProps) {
  const user = useAuthStore((state) => state.user);

  /**
   * Quality Gate RBAC: chỉ ADMIN/BOD/PM/ADMIN_SALE được gửi nghiệm thu.
   * Account & Team Lead chỉ được xem — mirror erp-UI ContractInfo.jsx:357.
   */
  const canCreateAcceptance = canSendAcceptance((user as any)?.role);
  const isProjectLockedForAcceptance =
    !projectHasAccount || isProjectClosed(projectStatus) || isProjectOnHold(projectStatus, projectIsOnHold);

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
          <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Feather name="lock" size={18} color="#C2410C" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-orange-800 mb-0.5">Dự án chưa được Account chấp nhận</Text>
            <Text className="text-xs text-orange-950 leading-5">
              Chưa thể tạo hoặc yêu cầu nghiệm thu mới cho tới khi PM chấp nhận dự án.
            </Text>
          </View>
        </View>
      )}

      {/* Top Action Bar chuẩn hóa */}
      <ProjectTabHeader
        icon="award"
        title="Biên bản nghiệm thu"
        subtitle={`Tổng cộng ${acceptances.length} biên bản nghiệm thu`}
        actionLabel={
          !isPendingConfirmation && canCreateAcceptance && !isProjectLockedForAcceptance
            ? 'Tạo nghiệm thu'
            : undefined
        }
        actionIcon="plus"
        onAction={onOpenCreateAcceptance}
      />

      {acceptances.length === 0 ? (
        <EmptyState
          icon="award"
          title="Chưa có biên bản nghiệm thu nào"
          description="Dự án này chưa gửi biên bản nghiệm thu. Bấm nút bên trên để tạo biên bản mới."
          actionLabel={!isPendingConfirmation && canCreateAcceptance && !isProjectLockedForAcceptance ? 'Tạo nghiệm thu' : undefined}
          actionIcon="plus"
          onAction={onOpenCreateAcceptance}
        />
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

