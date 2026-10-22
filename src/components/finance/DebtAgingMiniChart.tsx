import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ContractDebtGroup } from '@/services/financeService';
import { formatVND } from '@/utils/formatters';

interface DebtAgingMiniChartProps {
  contractGroups: ContractDebtGroup[];
}

export const DebtAgingMiniChart: React.FC<DebtAgingMiniChartProps> = ({ contractGroups }) => {
  const { totalOutstanding, overdueDebt, dueSoonDebt, inTermDebt, overduePercent, dueSoonPercent, inTermPercent } =
    useMemo(() => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let overdue = 0;
      let dueSoon = 0;
      let inTerm = 0;

      contractGroups.forEach((group) => {
        (group.milestones || []).forEach((m) => {
          const remaining = Number(m.remaining || 0);
          if (remaining <= 0) return;

          const due = m.dueDate ? m.dueDate.split('T')[0] : '';
          if (!due || due < todayStr) {
            overdue += remaining;
          } else if (due <= sevenDaysLater) {
            dueSoon += remaining;
          } else {
            inTerm += remaining;
          }
        });
      });

      const total = overdue + dueSoon + inTerm;
      const overduePct = total > 0 ? Math.round((overdue / total) * 100) : 0;
      const dueSoonPct = total > 0 ? Math.round((dueSoon / total) * 100) : 0;
      const inTermPct = total > 0 ? Math.max(0, 100 - overduePct - dueSoonPct) : 0;

      return {
        totalOutstanding: total,
        overdueDebt: overdue,
        dueSoonDebt: dueSoon,
        inTermDebt: inTerm,
        overduePercent: overduePct,
        dueSoonPercent: dueSoonPct,
        inTermPercent: inTermPct,
      };
    }, [contractGroups]);

  if (totalOutstanding <= 0) {
    return null;
  }

  return (
    <View className="bg-white rounded-2xl p-4 mb-3.5 border border-slate-200 shadow-sm">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-1.5">
          <Feather name="clock" size={15} color="#DC2626" />
          <Text className="text-[13px] font-bold text-slate-800">
            Theo Dõi Hạn Thanh Toán
          </Text>
        </View>
        <Text className="text-xs font-bold text-slate-900">
          Tổng: {formatVND(totalOutstanding)}
        </Text>
      </View>

      {/* Multi-segment Segmented Bar */}
      <View className="h-2.5 bg-slate-100 rounded-full flex-row overflow-hidden mb-3">
        {overdueDebt > 0 && (
          <View className="bg-red-600" style={{ width: `${overduePercent}%` }} />
        )}
        {dueSoonDebt > 0 && (
          <View className="bg-amber-500" style={{ width: `${dueSoonPercent}%` }} />
        )}
        {inTermDebt > 0 && (
          <View className="bg-emerald-500" style={{ width: `${inTermPercent}%` }} />
        )}
      </View>

      {/* 3 Categories Grid */}
      <View className="flex-row gap-2">
        {/* Overdue */}
        <View className="flex-1 bg-red-50 p-2 rounded-lg border border-red-100">
          <Text className="text-[10px] font-bold text-red-600 mb-0.5">
            Quá hạn ({overduePercent}%)
          </Text>
          <Text numberOfLines={1} className="text-xs font-extrabold text-red-800">
            {formatVND(overdueDebt)}
          </Text>
        </View>

        {/* Due soon */}
        <View className="flex-1 bg-amber-50 p-2 rounded-lg border border-amber-100">
          <Text className="text-[10px] font-bold text-amber-600 mb-0.5">
            Sắp đến hạn ({dueSoonPercent}%)
          </Text>
          <Text numberOfLines={1} className="text-xs font-extrabold text-amber-800">
            {formatVND(dueSoonDebt)}
          </Text>
        </View>

        {/* In term */}
        <View className="flex-1 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
          <Text className="text-[10px] font-bold text-emerald-600 mb-0.5">
            Trong hạn ({inTermPercent}%)
          </Text>
          <Text numberOfLines={1} className="text-xs font-extrabold text-emerald-800">
            {formatVND(inTermDebt)}
          </Text>
        </View>
      </View>
    </View>
  );
};
