import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PaymentRequest } from '@/services/paymentRequestService';
import { formatVND } from '@/utils/formatters';

interface PaymentRequestMiniChartProps {
  requests: PaymentRequest[];
  totalDebt?: number;
}

export const PaymentRequestMiniChart: React.FC<PaymentRequestMiniChartProps> = ({
  requests,
  totalDebt = 0,
}) => {
  if (!requests || requests.length === 0) return null;

  let pendingCount = 0;
  let approvedCount = 0;
  let paidCount = 0;
  let otherCount = 0;

  requests.forEach((r) => {
    if (r.paymentStatus === 'PAID') {
      paidCount++;
    } else if (r.approvalStatus === 'APPROVED') {
      approvedCount++;
    } else if (['PENDING_REVIEWER', 'PENDING_BOD'].includes(r.approvalStatus)) {
      pendingCount++;
    } else {
      otherCount++;
    }
  });

  const total = requests.length;
  const pendingPercent = Math.round((pendingCount / total) * 100);
  const approvedPercent = Math.round((approvedCount / total) * 100);
  const paidPercent = Math.round((paidCount / total) * 100);
  const otherPercent = Math.max(0, 100 - pendingPercent - approvedPercent - paidPercent);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="pie-chart" size={14} color="#F38820" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>
            Phân Bổ Trạng Thái ({total} đề xuất)
          </Text>
        </View>
        {totalDebt > 0 && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#F38820' }}>
            Tổng nợ: {formatVND(totalDebt)}
          </Text>
        )}
      </View>

      {/* Segmented Bar */}
      <View
        style={{
          height: 8,
          backgroundColor: '#F1F5F9',
          borderRadius: 4,
          flexDirection: 'row',
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        {pendingCount > 0 && (
          <View style={{ width: `${pendingPercent}%`, backgroundColor: '#F59E0B' }} />
        )}
        {approvedCount > 0 && (
          <View style={{ width: `${approvedPercent}%`, backgroundColor: '#10B981' }} />
        )}
        {paidCount > 0 && (
          <View style={{ width: `${paidPercent}%`, backgroundColor: '#3B82F6' }} />
        )}
        {otherCount > 0 && (
          <View style={{ width: `${otherPercent}%`, backgroundColor: '#94A3B8' }} />
        )}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
          <Text style={{ fontSize: 10, color: '#64748B' }}>Chờ duyệt: {pendingCount}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
          <Text style={{ fontSize: 10, color: '#64748B' }}>Đã duyệt: {approvedCount}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' }} />
          <Text style={{ fontSize: 10, color: '#64748B' }}>Đã chi: {paidCount}</Text>
        </View>
        {otherCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Khác: {otherCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
};
