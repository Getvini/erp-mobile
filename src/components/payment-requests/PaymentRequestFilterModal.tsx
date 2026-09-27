import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  APPROVAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/services/paymentRequestService';

export interface FilterValues {
  type: string;
  approvalStatus: string;
  paymentStatus: string;
}

export interface PaymentRequestFilterModalProps {
  visible: boolean;
  initialFilters: FilterValues;
  onApply: (filters: FilterValues) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả các loại' },
  { value: 'PROJECT', label: 'Theo dự án' },
  { value: 'OTHER_WORK', label: 'Công việc khác' },
];

const APPROVAL_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái duyệt' },
  { value: 'DRAFT', label: APPROVAL_STATUS_LABELS.DRAFT },
  { value: 'PENDING_REVIEWER', label: APPROVAL_STATUS_LABELS.PENDING_REVIEWER },
  { value: 'NEED_MORE_DOCS', label: APPROVAL_STATUS_LABELS.NEED_MORE_DOCS },
  { value: 'PENDING_BOD', label: APPROVAL_STATUS_LABELS.PENDING_BOD },
  { value: 'APPROVED', label: APPROVAL_STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: APPROVAL_STATUS_LABELS.REJECTED },
  { value: 'CANCELLED', label: APPROVAL_STATUS_LABELS.CANCELLED },
];

const PAYMENT_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái chi' },
  { value: 'WAITING', label: PAYMENT_STATUS_LABELS.WAITING },
  { value: 'DUE_SOON', label: PAYMENT_STATUS_LABELS.DUE_SOON },
  { value: 'OVERDUE', label: PAYMENT_STATUS_LABELS.OVERDUE },
  { value: 'PAID', label: PAYMENT_STATUS_LABELS.PAID },
  { value: 'NOT_APPLICABLE', label: PAYMENT_STATUS_LABELS.NOT_APPLICABLE },
];

export const PaymentRequestFilterModal: React.FC<PaymentRequestFilterModalProps> = ({
  visible,
  initialFilters,
  onApply,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [selectedType, setSelectedType] = useState(initialFilters.type || 'ALL');
  const [selectedApproval, setSelectedApproval] = useState(initialFilters.approvalStatus || 'ALL');
  const [selectedPayment, setSelectedPayment] = useState(initialFilters.paymentStatus || 'ALL');

  useEffect(() => {
    if (visible) {
      setSelectedType(initialFilters.type || 'ALL');
      setSelectedApproval(initialFilters.approvalStatus || 'ALL');
      setSelectedPayment(initialFilters.paymentStatus || 'ALL');
    }
  }, [visible, initialFilters]);

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedType('ALL');
    setSelectedApproval('ALL');
    setSelectedPayment('ALL');
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onApply({
      type: selectedType,
      approvalStatus: selectedApproval,
      paymentStatus: selectedPayment,
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          justifyContent: 'flex-end',
        }}
      >
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: height * 0.85,
            paddingBottom: Math.max(insets.bottom, 16),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 20,
          }}
        >
          {/* Drag Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' }} />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>
              Bộ Lọc Đề Xuất Thanh Toán
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Filter Body */}
          <ScrollView style={{ paddingHorizontal: 20, paddingVertical: 12 }} showsVerticalScrollIndicator>
            {/* 1. Loại đề xuất */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>
                Phân Loại Đề Xuất
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TYPE_OPTIONS.map((opt) => {
                  const active = selectedType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSelectedType(opt.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: active ? '#F38820' : '#E2E8F0',
                        backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: active ? '700' : '500',
                          color: active ? '#F38820' : '#475569',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Trạng thái phê duyệt */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>
                Trạng Thái Phê Duyệt
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {APPROVAL_OPTIONS.map((opt) => {
                  const active = selectedApproval === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSelectedApproval(opt.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: active ? '#F38820' : '#E2E8F0',
                        backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: active ? '700' : '500',
                          color: active ? '#F38820' : '#475569',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Trạng thái chi tiền */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>
                Trạng Thái Thanh Toán / Chi Tiền
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = selectedPayment === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSelectedPayment(opt.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: active ? '#F38820' : '#E2E8F0',
                        backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: active ? '700' : '500',
                          color: active ? '#F38820' : '#475569',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions (Thumb Zone) */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={handleReset}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#CBD5E1',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>Đặt lại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={{
                flex: 1.5,
                height: 48,
                borderRadius: 10,
                backgroundColor: '#F38820',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Áp dụng bộ lọc</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
