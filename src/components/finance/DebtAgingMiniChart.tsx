import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ContractDebtGroup } from '@/services/financeService';
import { formatVND } from '@/utils/formatters';

interface DebtAgingMiniChartProps {
  contractGroups: ContractDebtGroup[];
}

export const DebtAgingMiniChart: React.FC<DebtAgingMiniChartProps> = ({ contractGroups }) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let overdueDebt = 0;
  let dueSoonDebt = 0;
  let inTermDebt = 0;

  contractGroups.forEach((group) => {
    (group.milestones || []).forEach((m) => {
      const remaining = Number(m.remaining || 0);
      if (remaining <= 0) return;

      const due = m.dueDate ? m.dueDate.split('T')[0] : '';
      if (!due || due < todayStr) {
        overdueDebt += remaining;
      } else if (due <= sevenDaysLater) {
        dueSoonDebt += remaining;
      } else {
        inTermDebt += remaining;
      }
    });
  });

  const totalOutstanding = overdueDebt + dueSoonDebt + inTermDebt;
  const overduePercent = totalOutstanding > 0 ? Math.round((overdueDebt / totalOutstanding) * 100) : 0;
  const dueSoonPercent = totalOutstanding > 0 ? Math.round((dueSoonDebt / totalOutstanding) * 100) : 0;
  const inTermPercent = totalOutstanding > 0 ? Math.max(0, 100 - overduePercent - dueSoonPercent) : 0;

  if (totalOutstanding <= 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="clock" size={15} color="#DC2626" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
            Phân Tích Tuổi Nợ (Aging)
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
          Tổng: {formatVND(totalOutstanding)}
        </Text>
      </View>

      {/* Multi-segment Segmented Bar */}
      <View
        style={{
          height: 10,
          backgroundColor: '#F1F5F9',
          borderRadius: 5,
          flexDirection: 'row',
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {overdueDebt > 0 && (
          <View style={{ width: `${overduePercent}%`, backgroundColor: '#DC2626' }} />
        )}
        {dueSoonDebt > 0 && (
          <View style={{ width: `${dueSoonPercent}%`, backgroundColor: '#F59E0B' }} />
        )}
        {inTermDebt > 0 && (
          <View style={{ width: `${inTermPercent}%`, backgroundColor: '#10B981' }} />
        )}
      </View>

      {/* 3 Categories Grid */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Overdue */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#FEF2F2',
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#FEE2E2',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626', marginBottom: 2 }}>
            Quá hạn ({overduePercent}%)
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#991B1B' }}>
            {formatVND(overdueDebt)}
          </Text>
        </View>

        {/* Due soon */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFBEB',
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#FEF3C7',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginBottom: 2 }}>
            Sắp đến hạn ({dueSoonPercent}%)
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#92400E' }}>
            {formatVND(dueSoonDebt)}
          </Text>
        </View>

        {/* In term */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#F0FDF4',
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#DCFCE7',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A', marginBottom: 2 }}>
            Trong hạn ({inTermPercent}%)
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
            {formatVND(inTermDebt)}
          </Text>
        </View>
      </View>
    </View>
  );
};
