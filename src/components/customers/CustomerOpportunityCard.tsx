import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  OPPORTUNITY_STATUS_CONFIG,
  OPPORTUNITY_STATUS_LABELS,
} from '@/services/opportunityService';
import { CustomerOpportunity } from '@/services/customerService';
import { formatDateToDDMMYYYY, formatVND } from '@/utils/formatters';

interface CustomerOpportunityCardProps {
  opportunity: CustomerOpportunity;
  onPress: (id: string) => void;
}

function CustomerOpportunityCard({ opportunity, onPress }: CustomerOpportunityCardProps) {
  const status = opportunity.status || 'OPEN';
  const statusConfig = OPPORTUNITY_STATUS_CONFIG[status] || {
    label: OPPORTUNITY_STATUS_LABELS[status] || status,
    color: '#475569',
    bg: '#F1F5F9',
  };

  return (
    <TouchableOpacity
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress(opportunity.id)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Xem cơ hội ${opportunity.name}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-orange-50 border border-orange-100">
          <Feather name="briefcase" size={20} color="#F38820" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-sm font-extrabold text-slate-900" numberOfLines={2}>
              {opportunity.name}
            </Text>
            <View className="rounded-lg px-2 py-1" style={{ backgroundColor: statusConfig.bg }}>
              <Text className="text-[10px] font-bold" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-[11px] font-semibold text-slate-400">
            {opportunity.opportunityCode || `#${opportunity.id.slice(0, 8)}`}
            {opportunity.createdAt ? ` • ${formatDateToDDMMYYYY(opportunity.createdAt)}` : ''}
          </Text>
          {opportunity.expectedRevenue !== undefined ? (
            <Text className="mt-3 text-sm font-extrabold text-orange-600">
              {formatVND(opportunity.expectedRevenue)}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

export default memo(CustomerOpportunityCard);
