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
  RecordPaymentPayload,
} from '@/services/paymentRequestService';
import { useRecordPaymentRequestMutation } from '@/hooks/queries/usePaymentRequests';
import {
  formatVND,
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from './InvoiceUploadPicker';

interface PaymentDisbursementBottomSheetProps {
  visible: boolean;
  paymentRequest: PaymentRequest | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentDisbursementBottomSheet: React.FC<PaymentDisbursementBottomSheetProps> = ({
  visible,
  paymentRequest,
  onClose,
  onSuccess,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'TRANSFER' | 'CASH'>('TRANSFER');
  const [bankRef, setBankRef] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);

  const recordMutation = useRecordPaymentRequestMutation();

  const totalAmount = paymentRequest?.amount || 0;
  const alreadyPaid = paymentRequest?.paidAmount || 0;
  const remainingAmount = Math.max(0, totalAmount - alreadyPaid);

  useEffect(() => {
    if (visible && paymentRequest) {
      setAmountStr(remainingAmount > 0 ? formatNumberInput(String(remainingAmount)) : '');
      setPaymentMethod('TRANSFER');
      setBankRef('');
      setPaymentDate(new Date());
      setNotes('');
      setAttachments([]);
    }
  }, [visible, paymentRequest, remainingAmount]);

  if (!paymentRequest) return null;

  const currentEnteredAmount = parseNumberInput(amountStr) || 0;
  const isOverRemaining = currentEnteredAmount > remainingAmount;
  const isInvalidAmount = currentEnteredAmount <= 0 || isOverRemaining;

  const handleFillMax = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAmountStr(formatNumberInput(String(remainingAmount)));
  };

  const handleSubmit = async () => {
    if (isInvalidAmount) {
      Alert.alert(
        'Số tiền không hợp lệ',
        isOverRemaining
          ? `Số tiền chi không được vượt quá số còn lại (${formatVND(remainingAmount)})`
          : 'Vui lòng nhập số tiền lớn hơn 0'
      );
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const payload: RecordPaymentPayload = {
        id: paymentRequest.id,
        amount: currentEnteredAmount,
        paymentMethod,
        note: notes.trim() || undefined,
        cashVoucherInfo: paymentMethod === 'TRANSFER' && bankRef.trim()
          ? { voucherNo: bankRef.trim(), notes: `Ngày chi: ${formatDateToDDMMYYYY(paymentDate)}` }
          : undefined,
        proofFiles: attachments.map((att) => ({
          url: att.uri,
          name: att.name,
          fileType: att.type.includes('pdf') ? 'PDF' : 'IMAGE',
        })),
      };

      await recordMutation.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã ghi nhận giải ngân chi tiền thành công!');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Lỗi ghi nhận chi',
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
                <Feather name="credit-card" size={18} color="#F38820" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  Ghi Nhận Giải Ngân Chi
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

          {/* Form Scroll Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
          >
            {/* Tóm tắt số tiền */}
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
                <Text style={{ fontSize: 12, color: '#64748B' }}>Tổng tiền đề xuất:</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                  {formatVND(totalAmount)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Đã chi lũy kế:</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669' }}>
                  {formatVND(alreadyPaid)}
                </Text>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: '#E2E8F0',
                  marginVertical: 2,
                }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
                  Còn lại cần chi:
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#F38820' }}>
                  {formatVND(remainingAmount)}
                </Text>
              </View>
            </View>

            {/* Input Số tiền chi đợt này */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
                  Số tiền chi đợt này (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                {remainingAmount > 0 && (
                  <TouchableOpacity
                    onPress={handleFillMax}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: '#EFF6FF',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>
                      Chi hết còn lại
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isOverRemaining ? '#EF4444' : '#CBD5E1',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 12,
                  height: 46,
                }}
              >
                <TextInput
                  value={amountStr}
                  onChangeText={(text) => setAmountStr(formatNumberInput(text))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '700',
                    color: isOverRemaining ? '#EF4444' : '#0F172A',
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>VNĐ</Text>
              </View>

              {isOverRemaining && (
                <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
                  Số tiền chi vượt quá số còn lại ({formatVND(remainingAmount)})
                </Text>
              )}
            </View>

            {/* Phương thức thanh toán */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Hình thức chi <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setPaymentMethod('TRANSFER')}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: paymentMethod === 'TRANSFER' ? '#F38820' : '#E2E8F0',
                    backgroundColor: paymentMethod === 'TRANSFER' ? '#FFF7ED' : '#FFFFFF',
                  }}
                >
                  <MaterialCommunityIcons
                    name="bank-transfer"
                    size={18}
                    color={paymentMethod === 'TRANSFER' ? '#F38820' : '#64748B'}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: paymentMethod === 'TRANSFER' ? '700' : '500',
                      color: paymentMethod === 'TRANSFER' ? '#F38820' : '#475569',
                    }}
                  >
                    Chuyển khoản
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPaymentMethod('CASH')}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: paymentMethod === 'CASH' ? '#F38820' : '#E2E8F0',
                    backgroundColor: paymentMethod === 'CASH' ? '#FFF7ED' : '#FFFFFF',
                  }}
                >
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={18}
                    color={paymentMethod === 'CASH' ? '#F38820' : '#64748B'}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: paymentMethod === 'CASH' ? '700' : '500',
                      color: paymentMethod === 'CASH' ? '#F38820' : '#475569',
                    }}
                  >
                    Tiền mặt
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mã tham chiếu / Số UNC (nếu Chuyển khoản) */}
            {paymentMethod === 'TRANSFER' && (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                  Mã giao dịch / Số UNC
                </Text>
                <TextInput
                  value={bankRef}
                  onChangeText={setBankRef}
                  placeholder="Ví dụ: FT2410200001..."
                  placeholderTextColor="#94A3B8"
                  style={{
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                    paddingHorizontal: 12,
                    height: 42,
                    fontSize: 13,
                    color: '#0F172A',
                  }}
                />
              </View>
            )}

            {/* Ngày chi tiền */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Ngày chi <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 12,
                  height: 44,
                }}
              >
                <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '500' }}>
                  {formatDateToDDMMYYYY(paymentDate)}
                </Text>
                <Feather name="calendar" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Ghi chú */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Ghi chú thanh toán
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Nhập ghi chú cho đợt chi này (nếu có)..."
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

            {/* Đính kèm UNC / Phiếu chi */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Chứng từ UNC / Phiếu chi đính kèm
              </Text>
              <InvoiceUploadPicker
                files={attachments}
                onChange={setAttachments}
                maxFiles={3}
              />
            </View>
          </ScrollView>

          {/* Action Buttons Footer */}
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
              disabled={recordMutation.isPending}
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
              disabled={isInvalidAmount || recordMutation.isPending}
              activeOpacity={0.8}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: isInvalidAmount ? '#CBD5E1' : '#F38820',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {recordMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                    Xác nhận chi {currentEnteredAmount > 0 ? formatVND(currentEnteredAmount) : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        initialDate={formatDateToYYYYMMDD(paymentDate)}
        onConfirm={(formattedDDMMYYYY, formattedYYYYMMDD) => {
          const parts = formattedYYYYMMDD.split('-');
          if (parts.length === 3) {
            setPaymentDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
          }
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </Modal>
  );
};
