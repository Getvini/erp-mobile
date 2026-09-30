import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { OPPORTUNITY_STATUS_LABELS } from '@/services/opportunityService';

interface OpportunityBottomActionBarProps {
  stage?: string;
  isPending?: boolean;
  canApprove?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onCreateQuotation?: () => void;
  onAdvanceStage?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  ...OPPORTUNITY_STATUS_LABELS,
  LEAD: 'Tiềm năng',
  QUALIFIED: 'Đã xác minh',
  PROPOSAL: 'Báo giá',
  NEGOTIATION: 'Thương lượng',
  WON: 'Thắng (Đã ký)',
  LOST: 'Thất bại',
  OPEN: 'Mới tạo',
  PENDING_OPP_APPROVAL: 'Đang chờ duyệt',
  OPP_REJECTED: 'Không duyệt',
  OPP_APPROVED: 'Đã duyệt',
};

const getStageDisplayLabel = (rawStage?: string): string => {
  if (!rawStage) return 'Tiềm năng';
  if (STAGE_LABELS[rawStage]) return STAGE_LABELS[rawStage];
  return rawStage;
};

export function OpportunityBottomActionBar({
  stage,
  isPending = false,
  canApprove = false,
  onApprove,
  onReject,
  onCreateQuotation,
  onAdvanceStage,
}: OpportunityBottomActionBarProps) {
  if (stage === 'WON' || stage === 'LOST' || stage === 'COMPLETED' || stage === 'CANCELLED') {
    return null;
  }

  const handlePress = (callback?: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    callback?.();
  };

  return (
    <View className="bg-surface border-t border-border px-4 py-3 shadow-lg flex-row items-center justify-between gap-3">
      {/* Stage Badge Indicator */}
      <View className="flex-1">
        <Text className="text-[10px] text-slate-500 font-medium uppercase">Trạng thái hiện tại</Text>
        <View className="flex-row items-center gap-1.5 mt-0.5">
          <View className="w-2 h-2 rounded-full bg-primary" />
          <Text className="text-xs font-bold text-text-primary" numberOfLines={1}>
            {getStageDisplayLabel(stage)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row items-center gap-2">
        {canApprove && onReject && (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isPending}
            onPress={() => handlePress(onReject)}
            className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 min-h-[44px] items-center justify-center"
          >
            <Text className="text-xs font-bold text-red-600">Từ chối</Text>
          </TouchableOpacity>
        )}

        {canApprove && onApprove && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isPending}
            onPress={() => handlePress(onApprove)}
            className="px-4 py-2.5 rounded-xl bg-primary min-h-[44px] flex-row items-center gap-1.5 shadow-xs"
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Phê duyệt</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {onCreateQuotation && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isPending}
            onPress={() => handlePress(onCreateQuotation)}
            className="px-4 py-2.5 rounded-xl bg-primary min-h-[44px] flex-row items-center gap-1.5 shadow-xs"
          >
            <Feather name="file-text" size={15} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white">Lập Báo Giá</Text>
          </TouchableOpacity>
        )}

        {onAdvanceStage && !canApprove && !onCreateQuotation && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isPending}
            onPress={() => handlePress(onAdvanceStage)}
            className="px-4 py-2.5 rounded-xl bg-primary min-h-[44px] flex-row items-center gap-1.5 shadow-xs"
          >
            <Text className="text-xs font-bold text-white">Chuyển giai đoạn</Text>
            <Feather name="arrow-right" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
