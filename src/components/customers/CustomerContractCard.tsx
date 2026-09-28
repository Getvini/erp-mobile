import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CustomerContract } from '@/services/customerService';
import { CONTRACT_STATUS_CONFIG, CONTRACT_STATUS_LABELS } from '@/services/contractService';
import { formatDateToDDMMYYYY, formatVND } from '@/utils/formatters';

interface CustomerContractCardProps {
  contract: CustomerContract;
  onPress: (id: string) => void;
}

function CustomerContractCard({ contract, onPress }: CustomerContractCardProps) {
  const status = contract.status || '';
  const statusConfig = CONTRACT_STATUS_CONFIG[status] || {
    text: CONTRACT_STATUS_LABELS[status] || status || 'Đang thực hiện',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  };

  return (
    <TouchableOpacity
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress(contract.id)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Xem hợp đồng ${contract.name || contract.contractCode || ''}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
          <Feather name="file-text" size={20} color="#2563EB" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-sm font-extrabold text-slate-900" numberOfLines={2}>
              {contract.name || contract.contractCode || 'Hợp đồng chưa đặt tên'}
            </Text>
            <View
              className="rounded-lg border px-2 py-1"
              style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
            >
              <Text className="text-[10px] font-bold" style={{ color: statusConfig.color }}>
                {statusConfig.text}
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-[11px] font-semibold text-slate-400">
            {contract.contractCode || `#${contract.id.slice(0, 8)}`}
            {contract.createdAt ? ` • ${formatDateToDDMMYYYY(contract.createdAt)}` : ''}
          </Text>
          <Text className="mt-3 text-sm font-extrabold text-orange-600">
            {formatVND(contract.totalWithVat ?? contract.sellingPrice ?? 0)}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

export default memo(CustomerContractCard);
