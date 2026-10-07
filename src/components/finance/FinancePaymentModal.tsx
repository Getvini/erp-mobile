import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useCreatePaymentMutation, useDeletePaymentMutation } from '@/hooks/queries';
import {
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
  formatNumberInput,
  parseNumberInput,
  formatVND,
} from '@/utils/formatters';

export const FinancePaymentModal: React.FC = () => {
  const [proofSubmissionType, setProofSubmissionType] = useState<'file' | 'link'>('file');

  const selectedMilestone = useFinanceStore((s) => s.selectedMilestone);
  const showPaymentModal = useFinanceStore((s) => s.showPaymentModal);
  const paymentAmount = useFinanceStore((s) => s.paymentAmount);
  const paymentDate = useFinanceStore((s) => s.paymentDate);
  const paymentNote = useFinanceStore((s) => s.paymentNote);
  const paymentProofFile = useFinanceStore((s) => s.paymentProofFile);
  const paymentProofLink = useFinanceStore((s) => s.paymentProofLink);

  const closePaymentModal = useFinanceStore((s) => s.closePaymentModal);
  const setPaymentAmount = useFinanceStore((s) => s.setPaymentAmount);
  const setPaymentDate = useFinanceStore((s) => s.setPaymentDate);
  const setPaymentNote = useFinanceStore((s) => s.setPaymentNote);
  const setPaymentProofFile = useFinanceStore((s) => s.setPaymentProofFile);
  const setPaymentProofLink = useFinanceStore((s) => s.setPaymentProofLink);
  const openDatePickerForPayment = useFinanceStore((s) => s.openDatePickerForPayment);

  const createPaymentMutation = useCreatePaymentMutation();
  const deletePaymentMutation = useDeletePaymentMutation();

  const handlePickProofFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPaymentProofFile({
          name: asset.name,
          size: asset.size ?? undefined,
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
        });
      }
    } catch (err) {
      console.log('Lỗi chọn tệp minh chứng:', err);
      Alert.alert('Lỗi', 'Không thể chọn tệp minh chứng.');
    }
  };

  const onSavePayment = async () => {
    if (!selectedMilestone) return;
    const debtId = selectedMilestone.debt?.id || selectedMilestone.id;
    const amountNum = parseNumberInput(paymentAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập số tiền thanh toán hợp lệ.');
      return;
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Heavy);
      await createPaymentMutation.mutateAsync({
        debtId: String(debtId),
        amount: amountNum,
        paymentDate: formatDateToYYYYMMDD(paymentDate) || formatDateToYYYYMMDD(new Date()),
        note: paymentNote,
        proofFile: paymentProofFile || undefined,
        proofLink: paymentProofLink ? paymentProofLink.trim() : undefined,
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã ghi nhận giao dịch thanh toán.');
      closePaymentModal();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Không thể ghi nhận', err?.message || 'Vui lòng thử lại sau.');
    }
  };

  const onDeletePayment = (paymentId: string) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa lịch sử thanh toán này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
              await deletePaymentMutation.mutateAsync(paymentId);
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa ghi nhận thanh toán.');
              closePaymentModal();
            } catch (err: any) {
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert('Lỗi', err?.message || 'Không thể xóa ghi nhận thanh toán.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={showPaymentModal}
      transparent
      animationType="slide"
      onRequestClose={closePaymentModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="bg-white rounded-t-3xl p-5 h-[85%] max-h-[85%] flex-col gap-4">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                {selectedMilestone?.name || 'Chi tiết thanh toán'}
              </Text>
              <Text className="text-xs font-semibold text-slate-500">
                Số tiền đợt: {formatVND(selectedMilestone?.amount)}
              </Text>
            </View>
            <TouchableOpacity
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              onPress={closePaymentModal}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {/* SECTION 1: GHI NHẬN THANH TOÁN MỚI (Ẩn nếu đã hoàn thành 100%) */}
            {(selectedMilestone?.status === 'COMPLETED' || ((selectedMilestone?.paidAmount || 0) >= (selectedMilestone?.amount || 0) && (selectedMilestone?.amount || 0) > 0)) ? (
              <View className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-emerald-100 justify-center items-center shrink-0">
                  <Feather name="check-circle" size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-emerald-900">
                    Đợt thanh toán đã hoàn thành 100%
                  </Text>
                  <Text className="text-xs text-emerald-700 mt-0.5">
                    Đã thu đủ {formatVND(selectedMilestone?.amount)}. Bạn không cần ghi nhận thêm thanh toán nào cho đợt này.
                  </Text>
                </View>
              </View>
            ) : (
              <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200 gap-3">
                <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  GHI NHẬN THANH TOÁN MỚI
                </Text>

                <View className="gap-1">
                  <Text className="text-xs font-bold text-slate-700 uppercase">SỐ TIỀN *</Text>
                  <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                    <TextInput
                      className="flex-1 text-sm text-slate-900 font-bold p-0"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={(val) => setPaymentAmount(formatNumberInput(val))}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text className="text-xs font-bold text-slate-500 ml-1">VNĐ</Text>
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-bold text-slate-700 uppercase">
                    NGÀY THANH TOÁN <Text className="text-rose-500">*</Text>
                  </Text>
                  <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                    <TouchableOpacity
                      onPress={() => openDatePickerForPayment(paymentDate)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="mr-2.5"
                    >
                      <Feather name="calendar" size={16} color="#4F46E5" />
                    </TouchableOpacity>
                    <TextInput
                      className="flex-1 text-sm text-slate-900 font-semibold p-0"
                      value={paymentDate}
                      onChangeText={setPaymentDate}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-bold text-slate-700 uppercase">GHI CHÚ</Text>
                  <TextInput
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 min-h-[64px]"
                    placeholder="VD: Chuyển khoản đợt 1, UNC số 12345..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    value={paymentNote}
                    onChangeText={setPaymentNote}
                  />
                </View>

                {/* MINH CHỨNG (UNC / BILL CHUYỂN KHOẢN) */}
                <View className="gap-2">
                  <Text className="text-xs font-bold text-slate-700 uppercase">
                    MINH CHỨNG (UNC / BILL CHUYỂN KHOẢN)
                  </Text>

                  {/* Segmented Tab Switcher */}
                  <View className="flex-row p-1 bg-slate-100 rounded-xl gap-1">
                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                        proofSubmissionType === 'file' ? 'bg-white shadow-xs' : ''
                      }`}
                      onPress={() => setProofSubmissionType('file')}
                    >
                      <Feather
                        name="upload"
                        size={14}
                        color={proofSubmissionType === 'file' ? '#F38820' : '#64748B'}
                      />
                      <Text
                        className={`text-xs ${
                          proofSubmissionType === 'file' ? 'font-bold text-amber-600' : 'font-semibold text-slate-500'
                        }`}
                      >
                        Tải file
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                        proofSubmissionType === 'link' ? 'bg-white shadow-xs' : ''
                      }`}
                      onPress={() => setProofSubmissionType('link')}
                    >
                      <Feather
                        name="link"
                        size={14}
                        color={proofSubmissionType === 'link' ? '#F38820' : '#64748B'}
                      />
                      <Text
                        className={`text-xs ${
                          proofSubmissionType === 'link' ? 'font-bold text-amber-600' : 'font-semibold text-slate-500'
                        }`}
                      >
                        Gửi link
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tab Content 1: Tải file */}
                  {proofSubmissionType === 'file' && (
                    <View className="gap-2 mt-1">
                      <TouchableOpacity
                        className="border-2 border-dashed border-slate-300 rounded-2xl p-6 items-center bg-slate-50/50 gap-2"
                        onPress={handlePickProofFile}
                        activeOpacity={0.7}
                      >
                        <View className="w-12 h-12 rounded-full bg-orange-100/70 items-center justify-center">
                          <Feather name="upload-cloud" size={24} color="#F38820" />
                        </View>
                        <Text className="text-sm font-bold text-slate-900 text-center" numberOfLines={1}>
                          {paymentProofFile ? paymentProofFile.name : 'Nhấn để chọn file minh chứng'}
                        </Text>
                        <Text className="text-xs text-slate-400 text-center">
                          Chấp nhận file hình ảnh, PDF, Word, Excel...
                        </Text>
                      </TouchableOpacity>

                      {paymentProofFile && (
                        <TouchableOpacity
                          className="flex-row items-center justify-center gap-1.5 py-1"
                          onPress={() => setPaymentProofFile(null)}
                        >
                          <Feather name="trash-2" size={13} color="#EF4444" />
                          <Text className="text-xs font-bold text-rose-500">Gỡ bỏ file đã chọn</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Tab Content 2: Gửi link */}
                  {proofSubmissionType === 'link' && (
                    <View className="gap-2 mt-1">
                      <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                        <Feather name="link" size={16} color="#64748B" className="mr-2" />
                        <TextInput
                          className="flex-1 text-sm text-slate-900 p-0 ml-1"
                          placeholder="Dán link Google Drive, OneDrive, Dropbox..."
                          placeholderTextColor="#94A3B8"
                          value={paymentProofLink}
                          onChangeText={setPaymentProofLink}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                        />
                      </View>
                      <Text className="text-[11px] text-slate-400">
                        Lưu ý: Đảm bảo quyền truy cập link ở chế độ "Bất kỳ ai có đường liên kết".
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  className="bg-primary py-3 rounded-xl items-center justify-center mt-2 min-h-[44px]"
                  onPress={onSavePayment}
                  disabled={createPaymentMutation.isPending}
                  activeOpacity={0.8}
                >
                  {createPaymentMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="text-sm font-bold text-white">Xác nhận thanh toán</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* SECTION 2: LỊCH SỬ CÁC LẦN THANH TOÁN */}
            <View className="gap-3">
              <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                LỊCH SỬ GHI NHẬN ({selectedMilestone?.payments?.length || 0})
              </Text>

              {(!selectedMilestone?.payments || selectedMilestone.payments.length === 0) ? (
                <View className="bg-slate-50 border border-slate-100 p-4 rounded-xl items-center">
                  <Text className="text-xs text-slate-400">Chưa có giao dịch thanh toán nào</Text>
                </View>
              ) : (
                <View className="gap-2">
                  {selectedMilestone.payments.map((p: any, idx: number) => (
                    <View
                      key={p.id || idx}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex-row items-center justify-between gap-2"
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-9 h-9 rounded-xl bg-emerald-50 justify-center items-center">
                          <Feather name="credit-card" size={16} color="#059669" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-black text-slate-900">
                            {formatVND(p.amount)}
                          </Text>
                          <Text className="text-xs text-slate-500 mt-0.5">
                            {p.paymentDate ? formatDateToDDMMYYYY(p.paymentDate) : p.createdAt ? formatDateToDDMMYYYY(p.createdAt) : 'Vừa xong'}
                            {p.note ? ` • ${p.note}` : ''}
                          </Text>

                          {(p.proofFile || p.proof_file || p.proofLink || p.proof_link) ? (
                            <View className="flex-row items-center gap-2 mt-1">
                              {(p.proofFile || p.proof_file) ? (
                                <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 gap-1">
                                  <Feather name="paperclip" size={10} color="#059669" />
                                  <Text className="text-[10px] font-bold text-emerald-700" numberOfLines={1}>
                                    {(p.proofFile?.name || p.proof_file?.name || 'File đính kèm')}
                                  </Text>
                                </View>
                              ) : null}
                              {(p.proofLink || p.proof_link) ? (
                                <View className="flex-row items-center bg-blue-50 px-2 py-0.5 rounded border border-blue-200 gap-1">
                                  <Feather name="link" size={10} color="#2563EB" />
                                  <Text className="text-[10px] font-bold text-blue-700" numberOfLines={1}>
                                    Link minh chứng
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <TouchableOpacity
                        className="w-8 h-8 rounded-lg bg-rose-50 items-center justify-center border border-rose-100"
                        onPress={() => onDeletePayment(p.id)}
                        disabled={deletePaymentMutation.isPending}
                      >
                        {deletePaymentMutation.isPending && deletePaymentMutation.variables === p.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View className="border-t border-slate-200 pt-3 mt-1 px-1 gap-2">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs font-bold text-slate-500 uppercase">TỔNG ĐÃ NỘP</Text>
                      <Text className="text-base font-black text-emerald-600">
                        {formatVND(selectedMilestone.paidAmount)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs font-bold text-slate-500 uppercase">CÒN LẠI CẦN THU</Text>
                      <Text className="text-base font-black text-rose-600">
                        {formatVND(
                          Math.max(0, (selectedMilestone.amount || 0) - (selectedMilestone.paidAmount || 0))
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
