import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { readMoneyToWords } from '@/utils/numberToWordsVi';
import { formatVND, formatNumberInput, parseNumberInput } from '@/utils/formatters';
import { BrandColors } from '@/constants/colors';

export interface CashVoucherInfo {
  voucherNo: string;
  bookNo: string;
  createdDate: string;
  receiverName: string;
  receiverAddress: string;
  reason: string;
  amount: number;
  amountInWords: string;
  debitAccount: string;
  creditAccount: string;
  attachmentCount: number;
}

interface CashVoucherBottomSheetProps {
  visible: boolean;
  request: any;
  initialVoucherInfo?: Partial<CashVoucherInfo> | null;
  onSave: (info: CashVoucherInfo) => void;
  onClose: () => void;
}

export const CashVoucherBottomSheet: React.FC<CashVoucherBottomSheetProps> = ({
  visible,
  request,
  initialVoucherInfo,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultAmount = Number(request?.amount || 0);

  const [voucherNo, setVoucherNo] = useState(
    initialVoucherInfo?.voucherNo || `PC-${String(Date.now()).slice(-6)}`
  );
  const [receiverName, setReceiverName] = useState(
    initialVoucherInfo?.receiverName || request?.vendor?.name || request?.requester?.fullName || ''
  );
  const [reason, setReason] = useState(initialVoucherInfo?.reason || request?.content || '');
  const [amountInput, setAmountInput] = useState(formatNumberInput(defaultAmount));
  const [debitAccount, setDebitAccount] = useState(initialVoucherInfo?.debitAccount || '627');
  const [creditAccount, setCreditAccount] = useState(initialVoucherInfo?.creditAccount || '1111');

  const numericAmount = parseNumberInput(amountInput);
  const amountInWords = readMoneyToWords(numericAmount);

  useEffect(() => {
    if (visible) {
      setVoucherNo(initialVoucherInfo?.voucherNo || `PC-${String(Date.now()).slice(-6)}`);
      setReceiverName(
        initialVoucherInfo?.receiverName || request?.vendor?.name || request?.requester?.fullName || ''
      );
      setReason(initialVoucherInfo?.reason || request?.content || '');
      setAmountInput(formatNumberInput(initialVoucherInfo?.amount ?? defaultAmount));
      setDebitAccount(initialVoucherInfo?.debitAccount || '627');
      setCreditAccount(initialVoucherInfo?.creditAccount || '1111');
    }
  }, [visible, request, initialVoucherInfo]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const num = parseNumberInput(amountInput);
    if (!receiverName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên người nhận tiền');
      return;
    }
    if (num <= 0) {
      Alert.alert('Lỗi', 'Số tiền chi phải lớn hơn 0');
      return;
    }

    const info: CashVoucherInfo = {
      voucherNo,
      bookNo: '01',
      createdDate: todayStr,
      receiverName: receiverName.trim(),
      receiverAddress: '',
      reason: reason.trim(),
      amount: num,
      amountInWords,
      debitAccount,
      creditAccount,
      attachmentCount: 1,
    };
    onSave(info);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            maxHeight: '90%',
          }}
        >
          {/* Drag Handle Indicator */}
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="receipt-text-check" size={20} color={BrandColors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                  Phiếu Chi Tiền Mặt
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>
                  Số phiếu: {voucherNo}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form Scroll Content */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
            {/* Người nhận */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Họ và tên người nhận tiền <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Nhập họ tên người nhận..."
                style={{
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#0F172A',
                }}
              />
            </View>

            {/* Lý do chi */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Lý do chi tiền
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={2}
                placeholder="Nội dung diễn giải chi tiền..."
                style={{
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#0F172A',
                  minHeight: 60,
                }}
              />
            </View>

            {/* Số tiền chi */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Số tiền thanh toán (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                value={amountInput}
                onChangeText={(val) => setAmountInput(formatNumberInput(parseNumberInput(val)))}
                keyboardType="numeric"
                style={{
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1.5,
                  borderColor: '#FDBA74',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  fontWeight: '800',
                  color: '#C2410C',
                }}
              />

              {/* Đọc tiền thành chữ */}
              <View style={{ marginTop: 6, backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                  Bằng chữ: <Text style={{ fontStyle: 'italic', color: '#0F172A' }}>{amountInWords}</Text>
                </Text>
              </View>
            </View>

            {/* Định khoản Hạch toán (TK Nợ / TK Có) */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                  TK Nợ
                </Text>
                <TextInput
                  value={debitAccount}
                  onChangeText={setDebitAccount}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#0F172A',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                  TK Có
                </Text>
                <TextInput
                  value={creditAccount}
                  onChangeText={setCreditAccount}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#0F172A',
                  }}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: BrandColors.primary,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                Lưu Phiếu Chi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
