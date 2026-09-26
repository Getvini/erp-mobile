import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Debt, DebtPayment } from '@/services/debtService';
import {
  useCreatePaymentMutation,
  useDeletePaymentMutation,
  useActivateDebtMutation,
} from '@/hooks/queries/useDebts';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { formatVND, formatNumber, formatDateToDDMMYYYY, formatDateToYYYYMMDD } from '@/utils/formatters';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

export interface PaymentRecordModalProps {
  visible: boolean;
  debt: Debt | null;
  contractId?: string;
  milestoneId?: string;
  milestoneName?: string;
  milestoneAmount?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentRecordModal: React.FC<PaymentRecordModalProps> = ({
  visible,
  debt,
  contractId,
  milestoneId,
  milestoneName,
  milestoneAmount,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const createPayment = useCreatePaymentMutation(contractId);
  const deletePayment = useDeletePaymentMutation(contractId);
  const activateDebt = useActivateDebtMutation(contractId);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name?: string } | null>(null);

  const totalPaid = debt?.payments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
  const debtAmount = Number(debt?.amount || milestoneAmount || 0);
  const remaining = Math.max(0, debtAmount - totalPaid);

  useEffect(() => {
    if (visible) {
      setAmount(remaining > 0 ? formatNumber(remaining) : '');
      setNote('');
      setReceiptFile(null);
      setPaymentDate(new Date());
    }
  }, [visible, debt?.id, remaining]);

  const formatAmountInput = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    return formatNumber(digits);
  };

  const parseAmount = (val: string) => Number(val.replace(/\./g, ''));

  const handlePickReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Chọn chứng từ', 'Chọn nguồn chứng từ thanh toán', [
      {
        text: 'Thư viện ảnh',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!res.canceled && res.assets?.[0]) {
            const asset = res.assets[0];
            setReceiptFile({ uri: asset.uri, name: asset.fileName || 'receipt.jpg', type: asset.mimeType || 'image/jpeg' });
          }
        },
      },
      {
        text: 'Chọn tệp PDF',
        onPress: async () => {
          const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
          if (res.assets?.[0]) {
            const asset = res.assets[0];
            setReceiptFile({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/pdf' });
          }
        },
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    const numAmount = parseAmount(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ (lớn hơn 0)');
      return;
    }
    if (numAmount > remaining) {
      Alert.alert('Lỗi', `Số tiền vượt quá số còn lại: ${formatVND(remaining)}`);
      return;
    }
    if (!paymentDate) {
      Alert.alert('Lỗi', 'Vui lòng chọn ngày thu tiền');
      return;
    }
    if (!receiptFile) {
      Alert.alert('Lỗi', 'Vui lòng tải lên ảnh hoặc tệp PDF chứng từ/hóa đơn thanh toán');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let targetDebt = debt;
      if (!targetDebt && milestoneId) {
        setIsUploading(true);
        targetDebt = await activateDebt.mutateAsync(milestoneId);
      }

      if (!targetDebt) {
        Alert.alert('Lỗi', 'Không tìm thấy hoặc không thể tạo công nợ cho đợt thanh toán này');
        return;
      }

      let attachments: { name: string; url: string; type: string }[] = [];

      if (receiptFile) {
        setIsUploading(true);
        const uploadRes = await uploadToCloudinary({
          uri: receiptFile.uri,
          name: receiptFile.name,
          mimeType: receiptFile.type,
        });
        setIsUploading(false);
        if (uploadRes?.url) {
          attachments = [{ name: receiptFile.name, url: uploadRes.url, type: receiptFile.type }];
        }
      }

      await createPayment.mutateAsync({
        debtId: targetDebt.id,
        amount: numAmount,
        paymentDate: formatDateToYYYYMMDD(paymentDate.toISOString()),
        note: note.trim() || undefined,
        attachments,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setIsUploading(false);
      Alert.alert('Lỗi', err.message || 'Không thể ghi nhận thanh toán');
    }
  };

  const handleDeletePayment = (payment: DebtPayment) => {
    Alert.alert(
      'Xóa khoản thu',
      `Xóa khoản thu ${formatVND(payment.amount)} ngày ${formatDateToDDMMYYYY(payment.paymentDate)}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingPaymentId(payment.id);
              await deletePayment.mutateAsync(payment.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSuccess?.();
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa khoản thu');
            } finally {
              setDeletingPaymentId(null);
            }
          },
        },
      ]
    );
  };

  const isSubmitting = createPayment.isPending || activateDebt.isPending || isUploading;
  const progressPct = debtAmount > 0 ? Math.min(100, Math.round((totalPaid / debtAmount) * 100)) : 0;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <Feather name="credit-card" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Ghi nhận thanh toán</Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {milestoneName || debt?.milestone?.name || 'Đợt thanh toán'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Progress card */}
              <View style={styles.progressCard}>
                <View style={styles.progressRow}>
                  <View style={styles.progressCol}>
                    <Text style={styles.progressLabel}>Tổng giá trị đợt</Text>
                    <Text style={styles.progressTotal}>{formatVND(debtAmount)}</Text>
                  </View>
                  <View style={styles.progressCol}>
                    <Text style={styles.progressLabel}>Đã thu</Text>
                    <Text style={styles.progressPaid}>{formatVND(totalPaid)}</Text>
                  </View>
                  <View style={styles.progressCol}>
                    <Text style={styles.progressLabel}>Còn lại</Text>
                    <Text style={[styles.progressRemaining, remaining === 0 && styles.progressDone]}>
                      {formatVND(remaining)}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressPct}>{progressPct}% đã thu</Text>
              </View>

              {/* Form: Số tiền */}
              {remaining > 0 && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Số tiền thu <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₫</Text>
                      <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={(v) => setAmount(formatAmountInput(v))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#CBD5E1"
                      />
                    </View>
                  </View>

                  {/* Form: Ngày thu */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Ngày thu <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.datePicker}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Feather name="calendar" size={15} color="#64748B" />
                      <Text style={styles.dateText}>{formatDateToDDMMYYYY(paymentDate.toISOString())}</Text>
                      <Feather name="chevron-down" size={15} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* Form: Ghi chú */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Ghi chú</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={note}
                      onChangeText={setNote}
                      placeholder="Ghi chú về lần thanh toán này..."
                      placeholderTextColor="#CBD5E1"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Form: Chứng từ */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Chứng từ / Hóa đơn đính kèm <Text style={styles.required}>*</Text>
                    </Text>
                    {receiptFile ? (
                      <View style={styles.fileCard}>
                        <Feather
                          name={receiptFile.type.includes('pdf') ? 'file-text' : 'image'}
                          size={18}
                          color="#2563EB"
                        />
                        <Text style={styles.fileName} numberOfLines={1}>{receiptFile.name}</Text>
                        <TouchableOpacity
                          style={styles.fileActionBtn}
                          onPress={() => setPreviewDoc({ url: receiptFile.uri, name: receiptFile.name })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="eye" size={16} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.fileActionBtn}
                          onPress={() => setReceiptFile(null)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="x-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={handlePickReceipt}
                        activeOpacity={0.7}
                      >
                        <Feather name="upload" size={16} color="#64748B" />
                        <Text style={styles.uploadText}>Đính kèm ảnh chứng từ hoặc hóa đơn PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {/* Payment history */}
              {(debt?.payments || []).length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>Lịch sử thu tiền ({debt!.payments!.length})</Text>
                  {(debt!.payments || []).map((p) => (
                    <View key={p.id} style={styles.historyItem}>
                      <View style={styles.historyLeft}>
                        <View style={styles.historyDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyAmount}>{formatVND(p.amount)}</Text>
                          <Text style={styles.historyDate}>
                            {formatDateToDDMMYYYY(p.paymentDate)}
                            {p.createdBy?.fullName ? ` · ${p.createdBy.fullName}` : ''}
                          </Text>
                          {p.note ? <Text style={styles.historyNote}>{p.note}</Text> : null}

                          {/* Danh sách chứng từ đính kèm của lần thu này */}
                          {p.attachments && p.attachments.length > 0 && (
                            <View style={styles.historyAttachments}>
                              {p.attachments.map((att, idx) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={styles.historyAttachmentChip}
                                  onPress={() => setPreviewDoc({ url: att.url, name: att.name })}
                                  activeOpacity={0.7}
                                >
                                  <Feather
                                    name={att.type?.includes('pdf') || att.url.toLowerCase().endsWith('.pdf') ? 'file-text' : 'image'}
                                    size={12}
                                    color="#2563EB"
                                  />
                                  <Text style={styles.historyAttachmentName} numberOfLines={1}>
                                    {att.name || 'Xem chứng từ'}
                                  </Text>
                                  <Feather name="eye" size={11} color="#2563EB" />
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                      {/* <TouchableOpacity
                        style={styles.deletePaymentBtn}
                        onPress={() => handleDeletePayment(p)}
                        disabled={deletingPaymentId === p.id}
                      >
                        {deletingPaymentId === p.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        )}
                      </TouchableOpacity> */}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Footer: Submit */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              {remaining > 0 && (
                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Ghi nhận thu tiền</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Date Picker */}
        <DatePickerModal
          visible={showDatePicker}
          initialDate={formatDateToYYYYMMDD(paymentDate.toISOString())}
          onConfirm={(_ddmmyyyy, yyyymmdd) => {
            setPaymentDate(new Date(yyyymmdd));
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
          title="Chọn ngày thu"
        />
      </Modal>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          visible={Boolean(previewDoc)}
          url={previewDoc.url}
          fileName={previewDoc.name}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: { flex: 0 },
  bodyContent: { padding: 16, gap: 16 },

  // Progress card
  progressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressCol: { alignItems: 'center', flex: 1 },
  progressLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  progressTotal: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  progressPaid: { fontSize: 13, fontWeight: '700', color: '#16A34A', marginTop: 2 },
  progressRemaining: { fontSize: 13, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  progressDone: { color: '#16A34A' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F38820', borderRadius: 3 },
  progressPct: { fontSize: 10, color: '#64748B', textAlign: 'center', fontWeight: '600' },

  // Form fields
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  required: { color: '#DC2626' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  currencyPrefix: { fontSize: 16, fontWeight: '800', color: '#F38820' },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: 'transparent',
  },
  textArea: {
    height: 72,
    paddingTop: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#0F172A',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dateText: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  uploadText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileName: { flex: 1, fontSize: 13, color: '#1D4ED8', fontWeight: '600' },
  fileActionBtn: {
    padding: 4,
  },

  // History
  historySection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    gap: 10,
  },
  historyTitle: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginTop: 4,
  },
  historyAmount: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  historyDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  historyNote: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' },
  historyAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  historyAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 200,
  },
  historyAttachmentName: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
    flexShrink: 1,
  },
  deletePaymentBtn: {
    padding: 6,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F38820',
  },
  submitBtnDisabled: { backgroundColor: '#FED7AA' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
