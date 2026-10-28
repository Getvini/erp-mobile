import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  PaymentRequest,
  APPROVAL_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PAYMENT_REQUEST_TYPE_LABELS,
} from '@/services/paymentRequestService';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';

export interface PaymentRequestCardProps {
  item: PaymentRequest;
  onPress?: () => void;
}

export const PaymentRequestCard: React.FC<PaymentRequestCardProps> = React.memo(({ item, onPress }) => {
  const router = useRouter();

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) {
      onPress();
    } else {
      router.push(`/payment-requests/${item.id}` as any);
    }
  };

  const approvalCfg = APPROVAL_STATUS_CONFIG[item.approvalStatus] || {
    text: item.approvalStatus,
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  };

  const paymentCfg = PAYMENT_STATUS_CONFIG[item.paymentStatus] || {
    text: item.paymentStatus,
    color: '#94A3B8',
    bg: '#F8FAFC',
    border: '#E2E8F0',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handleCardPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {/* Top Header: Code, Type, and Amount */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>
              {item.code || `PR-${item.id?.substring(0, 6)?.toUpperCase()}`}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: item.type === 'PROJECT' ? '#EFF6FF' : '#F8FAFC',
                borderWidth: 1,
                borderColor: item.type === 'PROJECT' ? '#BFDBFE' : '#E2E8F0',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: item.type === 'PROJECT' ? '#2563EB' : '#64748B',
                }}
              >
                {PAYMENT_REQUEST_TYPE_LABELS[item.type] || item.type}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: '#0F172A',
              lineHeight: 20,
            }}
          >
            {item.title}
          </Text>
        </View>

        {/* Amount */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#F38820' }}>
            {formatVND(item.amount)}
          </Text>
        </View>
      </View>

          {/* Project or Contract info if any */}
      {item.project?.name ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Feather name="folder" size={13} color="#94A3B8" />
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
            Dự án: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.project.name}</Text>
          </Text>
        </View>
      ) : null}

      {/* Beneficiary name if any */}
      {item.beneficiaryName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <MaterialIcons name="account-balance" size={13} color="#94A3B8" />
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
            Thụ hưởng: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.beneficiaryName}</Text>
            {item.beneficiaryBank ? ` - ${item.beneficiaryBank}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Tiến độ giải ngân chi từng đợt nếu có */}
      {Boolean(item.paidAmount && item.paidAmount > 0 && item.paidAmount < item.amount) && (
        <View style={{ marginBottom: 8, backgroundColor: '#FFFBEB', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '600' }}>Tiến độ giải ngân</Text>
            <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '700' }}>
              {formatVND(item.paidAmount || 0)} / {formatVND(item.amount)}
            </Text>
          </View>
          <View style={{ height: 4, backgroundColor: '#FEF3C7', borderRadius: 2, overflow: 'hidden' }}>
            <View
              style={{
                height: 4,
                backgroundColor: '#D97706',
                width: `${Math.min(100, Math.round(((item.paidAmount || 0) / item.amount) * 100))}%`,
              }}
            />
          </View>
        </View>
      )}

      {/* Footer Info: Requester, Date, and Badges */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#F8FAFC',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {/* Requester & Date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="user" size={12} color="#94A3B8" />
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            {item.requestedBy?.fullName || 'Người dùng'} • {formatDateToDDMMYYYY(item.createdAt)}
          </Text>
          {item.isOverdue && (
            <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#DC2626' }}>QUÁ HẠN</Text>
            </View>
          )}
        </View>

        {/* Dual Status Badges (Approval, Payment & Settlement) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {/* Approval Status Badge */}
          <StatusBadge domain="paymentRequest" status={item.approvalStatus} size="sm" />

          {/* Payment Status Badge if approved */}
          {item.approvalStatus === 'APPROVED' && item.paymentStatus !== 'NOT_APPLICABLE' && (
            <StatusBadge domain="paymentRequest" status={item.paymentStatus} size="sm" />
          )}

          {/* Settlement Status Badge if ADVANCE */}
          {item.type === 'ADVANCE' && item.settlementStatus && item.settlementStatus !== 'NOT_APPLICABLE' && (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: item.settlementStatus === 'SETTLED' ? '#DCFCE7' : '#F3E8FF',
                borderWidth: 1,
                borderColor: item.settlementStatus === 'SETTLED' ? '#BBF7D0' : '#E9D5FF',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: item.settlementStatus === 'SETTLED' ? '#15803D' : '#7E22CE',
                }}
              >
                {item.settlementStatus === 'SETTLED'
                  ? 'Đã hoàn ứng'
                  : item.settlementStatus === 'SETTLEMENT_SUBMITTED'
                  ? 'Chờ duyệt H.Ứ'
                  : item.settlementStatus === 'WAITING_SETTLEMENT'
                  ? 'Chờ nộp H.Ứ'
                  : 'Tạm ứng'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default PaymentRequestCard;
