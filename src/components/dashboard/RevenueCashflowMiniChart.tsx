import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BrandColors } from '@/constants/colors';
import { formatVND } from '@/utils/formatters';

interface RevenueCashflowMiniChartProps {
  totalRevenue?: number;
  totalDebt?: number;
}

export const RevenueCashflowMiniChart: React.FC<RevenueCashflowMiniChartProps> = ({
  totalRevenue = 0,
  totalDebt = 0,
}) => {
  const router = useRouter();

  const collected = Math.max(0, totalRevenue - totalDebt);
  const collectedPercent = totalRevenue > 0 ? Math.min(100, Math.round((collected / totalRevenue) * 100)) : 0;
  const debtPercent = totalRevenue > 0 ? Math.max(0, 100 - collectedPercent) : 0;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: '#FFF7ED',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="bar-chart-2" size={16} color={BrandColors.primary} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
            Dòng Tiền Doanh Thu & Công Nợ
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/finance' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: BrandColors.primary }}>Chi tiết</Text>
          <Feather name="chevron-right" size={14} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Multi-segment Segmented Bar */}
      <View
        style={{
          height: 12,
          backgroundColor: '#F1F5F9',
          borderRadius: 6,
          flexDirection: 'row',
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {totalRevenue > 0 ? (
          <>
            <View
              style={{
                width: `${collectedPercent}%`,
                backgroundColor: '#10B981',
              }}
            />
            <View
              style={{
                width: `${debtPercent}%`,
                backgroundColor: '#F59E0B',
              }}
            />
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#E2E8F0' }} />
        )}
      </View>

      {/* Legend & Breakdown */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Collected */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
              Đã thu ({collectedPercent}%)
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>
            {formatVND(collected)}
          </Text>
        </View>

        {/* Divider */}
        <View style={{ width: 1, height: 28, backgroundColor: '#E2E8F0', marginHorizontal: 8 }} />

        {/* Debt */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
              Chưa thu ({debtPercent}%)
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
            {formatVND(totalDebt)}
          </Text>
        </View>
      </View>
    </View>
  );
};
