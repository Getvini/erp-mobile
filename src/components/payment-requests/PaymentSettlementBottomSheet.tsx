import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  PaymentRequest,
  SubmitSettlementPayload,
} from '@/services/paymentRequestService';
import { useSubmitSettlementPaymentRequestMutation } from '@/hooks/queries/usePaymentRequests';
import {
  formatVND,
  formatNumberInput,
  parseNumberInput,
} from '@/utils/formatters';
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from './InvoiceUploadPicker';

interface PaymentSettlementBottomSheetProps {
  visible: boolean;
  paymentRequest: PaymentRequest | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentSettlementBottomSheet: React.FC<PaymentSettlementBottomSheetProps> = ({
  visible,
  paymentRequest,
  onClose,
  onSuccess,
}) => {
  const [actualAmountStr, setActualAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);

  const submitSettlementMutation = useSubmitSettlementPaymentRequestMutation();

  const advanceAmount = paymentRequest?.paidAmount || paymentRequest?.amount || 0;

  useEffect(() => {
    if (visible && paymentRequest) {
      const initialVal = paymentRequest.settledAmount != null
        ? String(paymentRequest.settledAmount)
        : String(advanceAmount);
      setActualAmountStr(formatNumberInput(initialVal));
      setNotes(paymentRequest.settlementNote || '');
      setAttachments([]);
    }
  }, [visible, paymentRequest, advanceAmount]);

  if (!paymentRequest) return null;

  const actualAmount = parseNumberInput(actualAmountStr) || 0;
  // diff = actual - advance: < 0 là thừa tiền nộp lại; > 0 là chi vượt cty chi bù
  const diff = actualAmount - advanceAmount;

  const handleSubmit = async () => {
    if (actualAmount <= 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập số tiền thực chi hợp lệ lớn hơn 0.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const payload: SubmitSettlementPayload = {
        id: paymentRequest.id,
        actualAmount,
        note: notes.trim() || undefined,
        settlementFiles: attachments.map((att) => ({
          url: att.uri,
          name: att.name,
          docType: 'SETTLEMENT_RECEIPT',
          fileType: att.type.includes('pdf') ? 'PDF' : 'IMAGE',
        })),
      };

      await submitSettlementMutation.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã nộp hồ sơ quyết toán hoàn ứng thành công!');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Lỗi nộp quyết toán',
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="file-document-edit-outline" size={20} color="#F38820" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  Nộp Quyết Toán Hoàn Ứng
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  Mã: {paymentRequest.code || paymentRequest.id}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
          >
            {/* Tóm tắt tiền tạm ứng */}
            <View
              style={{
                backgroundColor: '#FAF5FF',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#E9D5FF',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontSize: 11, color: '#6B21A8', fontWeight: '600' }}>
                  Số tiền đã tạm ứng
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#7E22CE', marginTop: 2 }}>
                  {formatVND(advanceAmount)}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: '#E9D5FF',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#581C87' }}>
                  TẠM ỨNG
                </Text>
              </View>
            </View>

            {/* Input Số tiền thực chi */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
                  Tổng số tiền thực tế đã chi (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setActualAmountStr(formatNumberInput(String(advanceAmount)))}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: '#F1F5F9',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569' }}>
                    Khớp tiền tạm ứng
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 12,
                  height: 46,
                }}
              >
                <TextInput
                  value={actualAmountStr}
                  onChangeText={(text) => setActualAmountStr(formatNumberInput(text))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#0F172A',
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>VNĐ</Text>
              </View>
            </View>

            {/* Hộp đối soát chênh lệch Real-time */}
            {diff !== 0 && (
              <View
                style={{
                  borderRadius: 10,
                  padding: 12,
                  backgroundColor: diff < 0 ? '#FEF3C7' : '#EFF6FF',
                  borderWidth: 1,
                  borderColor: diff < 0 ? '#FDE68A' : '#BFDBFE',
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather
                    name={diff < 0 ? 'arrow-down-left' : 'arrow-up-right'}
                    size={16}
                    color={diff < 0 ? '#D97706' : '#2563EB'}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: diff < 0 ? '#92400E' : '#1E40AF',
                    }}
                  >
                    {diff < 0
                      ? `Thừa tiền cần nộp lại: ${formatVND(Math.abs(diff))}`
                      : `Chi vượt tạm ứng, công ty chi bù: ${formatVND(diff)}`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: diff < 0 ? '#B45309' : '#1D4ED8',
                    lineHeight: 16,
                  }}
                >
                  {diff < 0
                    ? 'Bạn đã chi ít hơn tiền tạm ứng. Vui lòng nộp lại số tiền thừa vào tài khoản công ty và đính kèm biên nhận.'
                    : 'Số tiền thực tế chi vượt quá tiền tạm ứng. Công ty sẽ chi bổ sung số tiền chênh lệch này cho bạn sau khi duyệt hoàn ứng.'}
                </Text>
              </View>
            )}

            {diff === 0 && actualAmount > 0 && (
              <View
                style={{
                  borderRadius: 10,
                  padding: 10,
                  backgroundColor: '#ECFDF5',
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Feather name="check-circle" size={16} color="#059669" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#065F46' }}>
                  Số tiền thực chi khớp 100% với số tiền tạm ứng
                </Text>
              </View>
            )}

            {/* Ghi chú quyết toán */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Ghi chú quyết toán
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Diễn giải chi tiết các khoản đã chi tiêu..."
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                style={{
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  padding: 10,
                  minHeight: 64,
                  fontSize: 13,
                  color: '#0F172A',
                }}
              />
            </View>

            {/* Đính kèm hóa đơn, chứng từ hoàn ứng */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Hóa đơn / Bảng kê / Chứng từ hoàn ứng
              </Text>
              <InvoiceUploadPicker
                files={attachments}
                onChange={setAttachments}
                maxFiles={6}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              backgroundColor: '#FFFFFF',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={submitSettlementMutation.isPending}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={actualAmount <= 0 || submitSettlementMutation.isPending}
              activeOpacity={0.8}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: actualAmount <= 0 ? '#CBD5E1' : '#F38820',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {submitSettlementMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                    Nộp quyết toán ({formatVND(actualAmount)})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
