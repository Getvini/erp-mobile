import React, { useState } from 'react';
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
  ApproveSettlementPayload,
  RejectSettlementPayload,
} from '@/services/paymentRequestService';
import {
  useApproveSettlementPaymentRequestMutation,
  useRejectSettlementPaymentRequestMutation,
} from '@/hooks/queries/usePaymentRequests';
import { formatVND } from '@/utils/formatters';
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from './InvoiceUploadPicker';

interface PaymentSettlementReviewBottomSheetProps {
  visible: boolean;
  paymentRequest: PaymentRequest | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentSettlementReviewBottomSheet: React.FC<PaymentSettlementReviewBottomSheetProps> = ({
  visible,
  paymentRequest,
  onClose,
  onSuccess,
}) => {
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [additionalProofs, setAdditionalProofs] = useState<UploadedFileItem[]>([]);

  const approveMutation = useApproveSettlementPaymentRequestMutation();
  const rejectMutation = useRejectSettlementPaymentRequestMutation();

  if (!paymentRequest) return null;

  const advanceAmount = paymentRequest.paidAmount || paymentRequest.amount || 0;
  const settledAmount = paymentRequest.settledAmount ?? advanceAmount;
  // diff = settled - advance: < 0 thừa tiền nộp lại; > 0 chi vượt cty chi bù
  const diff = paymentRequest.settlementDifference != null
    ? paymentRequest.settlementDifference
    : settledAmount - advanceAmount;

  const handleApprove = async () => {
    // Nếu thừa tiền mà chưa tick xác nhận thu hồi tiền, cảnh báo
    if (diff < 0 && !refundConfirmed) {
      Alert.alert(
        'Chưa xác nhận thu hồi tiền thừa',
        `Nhân sự có khoản thừa ${formatVND(Math.abs(diff))} cần nộp lại. Bạn đã thu đủ số tiền này về quỹ/tài khoản công ty chưa?`,
        [
          { text: 'Chưa thu', style: 'cancel' },
          {
            text: 'Đã thu & Duyệt',
            onPress: () => doApprove(true),
          },
        ]
      );
      return;
    }

    doApprove(refundConfirmed);
  };

  const doApprove = async (confirmed: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const payload: ApproveSettlementPayload = {
        id: paymentRequest.id,
        refundConfirmed: confirmed,
        note: note.trim() || undefined,
        additionalPaymentProofFiles: additionalProofs.map((att) => ({
          url: att.uri,
          name: att.name,
          fileType: att.type.includes('pdf') ? 'PDF' : 'IMAGE',
        })),
      };

      await approveMutation.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã phê duyệt quyết toán hoàn ứng thành công!');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Lỗi phê duyệt quyết toán',
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
      );
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do từ chối quyết toán hoàn ứng.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const payload: RejectSettlementPayload = {
        id: paymentRequest.id,
        reason: rejectReason.trim(),
      };

      await rejectMutation.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Đã từ chối', 'Đã từ chối hồ sơ hoàn ứng và yêu cầu nộp lại.');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Lỗi từ chối quyết toán',
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
      );
    }
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

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
                  backgroundColor: isRejectMode ? '#FEF2F2' : '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={isRejectMode ? 'x-circle' : 'check-square'}
                  size={18}
                  color={isRejectMode ? '#EF4444' : '#F38820'}
                />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  {isRejectMode ? 'Từ Chối Quyết Toán Hoàn Ứng' : 'Duyệt Quyết Toán Hoàn Ứng'}
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

          {/* Body Scroll */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
          >
            {/* Thẻ Đối soát 3 chỉ số */}
            <View
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Đã tạm ứng:</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                  {formatVND(advanceAmount)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Số tiền thực chi nộp:</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284C7' }}>
                  {formatVND(settledAmount)}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
                  {diff < 0 ? 'Thừa tiền nộp hoàn quỹ:' : diff > 0 ? 'Chi vượt, cần chi bù:' : 'Chênh lệch:'}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: diff < 0 ? '#D97706' : diff > 0 ? '#2563EB' : '#059669',
                  }}
                >
                  {diff !== 0 ? formatVND(Math.abs(diff)) : '0 VNĐ (Khớp 100%)'}
                </Text>
              </View>
            </View>

            {/* Ghi chú từ người nộp hoàn ứng */}
            {Boolean(paymentRequest.settlementNote) && (
              <View
                style={{
                  backgroundColor: '#F1F5F9',
                  borderRadius: 10,
                  padding: 10,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                  Ghi chú từ nhân sự nộp hoàn ứng:
                </Text>
                <Text style={{ fontSize: 13, color: '#0F172A' }}>
                  {paymentRequest.settlementNote}
                </Text>
              </View>
            )}

            {/* Checkbox thu hồi tiền thừa (nếu diff < 0) */}
            {diff < 0 && !isRejectMode && (
              <TouchableOpacity
                onPress={() => setRefundConfirmed(!refundConfirmed)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: refundConfirmed ? '#ECFDF5' : '#FFFBEB',
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: refundConfirmed ? '#A7F3D0' : '#FDE68A',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    backgroundColor: refundConfirmed ? '#10B981' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: refundConfirmed ? '#10B981' : '#D97706',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {refundConfirmed && <Feather name="check" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: refundConfirmed ? '#065F46' : '#92400E' }}>
                    Đã thu hồi đủ tiền thừa ({formatVND(Math.abs(diff))})
                  </Text>
                  <Text style={{ fontSize: 11, color: refundConfirmed ? '#047857' : '#B45309', marginTop: 2 }}>
                    Tích chọn để xác nhận nhân sự đã nộp lại tiền thừa vào quỹ công ty.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Form Từ chối mode */}
            {isRejectMode ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444', marginBottom: 6 }}>
                  Lý do từ chối hồ sơ hoàn ứng <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  numberOfLines={4}
                  placeholder="Nhập lý do từ chối hoặc các chứng từ cần bổ sung..."
                  placeholderTextColor="#94A3B8"
                  textAlignVertical="top"
                  style={{
                    borderWidth: 1,
                    borderColor: '#FCA5A5',
                    borderRadius: 10,
                    backgroundColor: '#FEF2F2',
                    padding: 10,
                    minHeight: 80,
                    fontSize: 13,
                    color: '#0F172A',
                  }}
                />
              </View>
            ) : (
              /* Form Duyệt mode */
              <>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                    Ghi chú phê duyệt (nếu có)
                  </Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={3}
                    placeholder="Ghi chú kế toán / duyệt hoàn ứng..."
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

                {diff > 0 && (
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                      Chứng từ chi bù / UNC bổ sung (nếu có)
                    </Text>
                    <InvoiceUploadPicker
                      files={additionalProofs}
                      onChange={setAdditionalProofs}
                      maxFiles={3}
                    />
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              backgroundColor: '#FFFFFF',
            }}
          >
            {isRejectMode ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setIsRejectMode(false)}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleReject}
                  disabled={!rejectReason.trim() || isPending}
                  activeOpacity={0.8}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: !rejectReason.trim() ? '#CBD5E1' : '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  {rejectMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="x-circle" size={16} color="#FFFFFF" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                        Xác nhận từ chối
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setIsRejectMode(true)}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Từ chối</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApprove}
                  disabled={isPending}
                  activeOpacity={0.8}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: '#F38820',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  {approveMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#FFFFFF" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                        Duyệt quyết toán
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
