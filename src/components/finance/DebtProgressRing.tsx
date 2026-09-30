import React from 'react';
import { View, Text } from 'react-native';
import { formatVND } from '@/utils/formatters';

interface DebtProgressRingProps {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export function DebtProgressRing({
  totalAmount,
  paidAmount,
  remainingAmount,
}: DebtProgressRingProps) {
  const percent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

  return (
    <View className="bg-surface rounded-2xl border border-border p-4 mb-4 shadow-xs">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Tiến độ thu nợ tổng thể
        </Text>
        <View className="bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
          <Text className="text-xs font-extrabold color-primary">
            Đã thu {percent}%
          </Text>
        </View>
      </View>

      {/* Progress Track Bar */}
      <View className="h-3 bg-slate-100 rounded-full overflow-hidden my-2">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${percent}%` }}
        />
      </View>

      {/* Stats Summary */}
      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-100">
        <View>
          <Text className="text-[10px] color-slate-400 font-medium">Đã thu hồi</Text>
          <Text className="text-xs font-bold color-emerald-600">{formatVND(paidAmount)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[10px] color-slate-400 font-medium">Còn nợ phải thu</Text>
          <Text className="text-xs font-bold color-primary">{formatVND(remainingAmount)}</Text>
        </View>
      </View>
    </View>
  );
}
