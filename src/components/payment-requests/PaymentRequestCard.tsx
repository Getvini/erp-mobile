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

export interface PaymentRequestCardProps {
  item: PaymentRequest;
  onPress?: () => void;
}

export const PaymentRequestCard: React.FC<PaymentRequestCardProps> = ({ item, onPress }) => {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <Feather name="folder" size={13} color="#94A3B8" />
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
            Dự án: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.project.name}</Text>
          </Text>
        </View>
      ) : null}

      {/* Beneficiary name if any */}
      {item.beneficiaryName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <MaterialIcons name="account-balance" size={13} color="#94A3B8" />
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
            Thụ hưởng: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.beneficiaryName}</Text>
            {item.beneficiaryBank ? ` - ${item.beneficiaryBank}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Footer Info: Requester, Date, and Badges */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#F8FAFC',
        }}
      >
        {/* Requester & Date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="user" size={12} color="#94A3B8" />
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            {item.requestedBy?.fullName || 'Người dùng'} • {formatDateToDDMMYYYY(item.createdAt)}
          </Text>
        </View>

        {/* Dual Status Badges (Approval & Payment) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Approval Status Badge */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: approvalCfg.bg,
              borderWidth: 1,
              borderColor: approvalCfg.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: approvalCfg.color }}>
              {approvalCfg.text}
            </Text>
          </View>

          {/* Payment Status Badge if approved */}
          {item.approvalStatus === 'APPROVED' && item.paymentStatus !== 'NOT_APPLICABLE' && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: paymentCfg.bg,
                borderWidth: 1,
                borderColor: paymentCfg.border,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: paymentCfg.color }}>
                {paymentCfg.text}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};
