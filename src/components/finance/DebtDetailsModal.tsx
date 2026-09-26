import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Debt,
  DebtPayment,
  DEBT_STATUS_CONFIG,
  DEBT_STATUS_LABELS,
} from '@/services/debtService';
import {
  useCreateDebtPaymentMutation,
  useDeleteDebtPaymentMutation,
  useUnlockDebtMutation,
  useDebtDetailQuery,
} from '@/hooks/queries/useDebts';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from '@/components/payment-requests/InvoiceUploadPicker';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import {
  formatVND,
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';
import { useAuthStore } from '@/stores/useAuthStore';

export interface DebtDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  debt: Debt | null;
  onSuccess?: () => void;
}

export const DebtDetailsModal: React.FC<DebtDetailsModalProps> = ({
  visible,
  onClose,
  debt: initialDebt,
  onSuccess,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height && width >= 560;

  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || '').toUpperCase();
  const isAdminOrBod = ['ADMIN', 'DIRECTOR', 'BOD'].includes(userRole);
  const canManagePayment = ['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'].includes(userRole);

  // Fetch updated debt detail
  const { data: fetchedDebt } = useDebtDetailQuery(
    visible && initialDebt?.id ? initialDebt.id : undefined
  );
  const debt = fetchedDebt || initialDebt;

  const createPaymentMutation = useCreateDebtPaymentMutation();
  const deletePaymentMutation = useDeleteDebtPaymentMutation();
  const unlockDebtMutation = useUnlockDebtMutation();

  // Form states
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [paymentNote, setPaymentNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unlock debt state
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Tab xem lịch sử vs Form thu tiền (đối với màn portrait)
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'CREATE_PAYMENT'>('PAYMENTS');

  // Tính toán số tiền đã thu & còn lại
  const { totalPaid, remaining, progressPercent } = useMemo(() => {
    if (!debt) return { totalPaid: 0, remaining: 0, progressPercent: 0 };
    const debtAmount = Number(debt.amount || 0);
    const paid = (debt.payments || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const rem = Math.max(0, debtAmount - paid);
    const pct = debtAmount > 0 ? Math.min(100, Math.round((paid / debtAmount) * 100)) : 0;
    return { totalPaid: paid, remaining: rem, progressPercent: pct };
  }, [debt]);

  // Khởi tạo số tiền gợi ý khi mở modal
  useEffect(() => {
    if (visible && debt) {
      const debtAmount = Number(debt.amount || 0);
      const paid = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      const rem = Math.max(0, debtAmount - paid);
      setPaymentAmountInput(rem > 0 ? formatNumberInput(rem) : '');
      setPaymentDate(formatDateToYYYYMMDD(new Date()));
      setPaymentNote('');
      setAttachedFiles([]);
      setShowUnlockForm(false);
      setUnlockReason('');
      setActiveTab(rem > 0 && debt.status !== 'LOCKED' ? 'CREATE_PAYMENT' : 'PAYMENTS');
    }
  }, [visible, debt?.id]);

  const isLocked = debt?.status === 'LOCKED';
  const statusConfig = debt
    ? DEBT_STATUS_CONFIG[debt.status] || DEBT_STATUS_CONFIG.ACTIVE
    : DEBT_STATUS_CONFIG.ACTIVE;
  const statusLabel = debt
    ? DEBT_STATUS_LABELS[debt.status] || debt.status
    : '';

  // Xử lý ghi nhận thanh toán
  const handleCreatePayment = async () => {
    if (!debt) return;
    const rawAmount = parseNumberInput(paymentAmountInput);

    if (rawAmount <= 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập số tiền thanh toán lớn hơn 0.');
      return;
    }

    if (rawAmount > remaining) {
      Alert.alert(
        'Vượt quá số nợ',
        `Số tiền thanh toán (${formatVND(rawAmount)}) không được vượt quá số tiền còn lại (${formatVND(remaining)}).`
      );
      return;
    }

    if (!paymentDate) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ngày thanh toán.');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Upload file chứng từ lên Cloudinary nếu có
      const uploadedAttachments: Array<{
        name: string;
        url: string;
        type?: string;
        size?: number;
        publicId?: string;
      }> = [];

      for (const file of attachedFiles) {
        try {
          const res = await uploadToCloudinary(
            {
              uri: file.uri,
              name: file.name,
              mimeType: file.type,
              size: file.size,
            },
            'GETVINI/ERP/debts/proofs'
          );
          uploadedAttachments.push({
            name: file.name,
            url: res.url,
            type: file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
            size: file.size,
            publicId: res.publicId,
          });
        } catch (uploadErr: any) {
          Alert.alert('Lỗi upload', `Không thể tải lên file "${file.name}": ${uploadErr.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      await createPaymentMutation.mutateAsync({
        debtId: debt.id,
        amount: rawAmount,
        paymentDate,
        note: paymentNote.trim() || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã ghi nhận thanh toán công nợ thành công!');

      setPaymentNote('');
      setAttachedFiles([]);
      setActiveTab('PAYMENTS');
      onSuccess?.();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể ghi nhận thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý xóa khoản thanh toán
  const handleDeletePayment = (payment: DebtPayment) => {
    if (!debt || !canManagePayment) return;

    Alert.alert(
      'Xóa khoản thanh toán',
      `Bạn có chắc chắn muốn xóa khoản thanh toán ${formatVND(payment.amount)} ngày ${formatDateToDDMMYYYY(payment.paymentDate)}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await deletePaymentMutation.mutateAsync({
                paymentId: payment.id,
                debtId: debt.id,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa khoản thanh toán!');
              onSuccess?.();
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa khoản thanh toán');
            }
          },
        },
      ]
    );
  };

  // Xử lý mở khóa công nợ (BOD/ADMIN)
  const handleUnlockDebt = async () => {
    if (!debt) return;
    if (!unlockReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do mở khóa công nợ.');
      return;
    }

    try {
      setIsUnlocking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await unlockDebtMutation.mutateAsync({
        id: debt.id,
        reason: unlockReason.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã mở khóa công nợ thành công!');
      setShowUnlockForm(false);
      setUnlockReason('');
      onSuccess?.();
    } catch (err: any) {
      Alert.alert('Lỗi mở khóa', err.message || 'Không thể mở khóa công nợ');
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!visible || !debt) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            isLandscape && styles.sheetContainerLandscape,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Handle bar vuốt đóng */}
          <View style={styles.dragHandleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Feather name="credit-card" size={18} color="#EA580C" />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {debt.milestone?.name || 'Chi tiết công nợ'}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {debt.contract?.contractCode ? `HĐ: ${debt.contract.contractCode}` : 'Đối soát công nợ'}
                  {debt.contract?.customer?.name ? ` • ${debt.contract.customer.name}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Nội dung Modal (ScrollView) */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Banner cảnh báo nếu công nợ bị KHÓA */}
            {isLocked && (
              <View style={styles.lockBanner}>
                <View style={styles.lockBannerHeader}>
                  <Feather name="lock" size={16} color="#D97706" />
                  <Text style={styles.lockBannerTitle}>
                    Công nợ đã bị KHÓA do dự án đã đóng
                  </Text>
                </View>
                <Text style={styles.lockBannerDesc}>
                  Khoản nợ này hiện tại không thể thu tiền hoặc xóa.
                  {debt.lockReason ? ` Lý do: ${debt.lockReason}.` : ''}
                </Text>

                {isAdminOrBod && !showUnlockForm && (
                  <TouchableOpacity
                    style={styles.openUnlockBtn}
                    onPress={() => setShowUnlockForm(true)}
                    activeOpacity={0.8}
                  >
                    <Feather name="unlock" size={14} color="#B45309" />
                    <Text style={styles.openUnlockBtnText}>Mở khóa công nợ (BOD/Admin)</Text>
                  </TouchableOpacity>
                )}

                {/* Form mở khóa */}
                {isAdminOrBod && showUnlockForm && (
                  <View style={styles.unlockFormBox}>
                    <Text style={styles.unlockFormLabel}>
                      Lý do mở khóa <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.unlockInput}
                      placeholder="Nhập lý do cần thu lại khoản nợ này..."
                      placeholderTextColor="#94A3B8"
                      value={unlockReason}
                      onChangeText={setUnlockReason}
                      multiline
                    />
                    <View style={styles.unlockBtnRow}>
                      <TouchableOpacity
                        style={styles.cancelUnlockBtn}
                        onPress={() => {
                          setShowUnlockForm(false);
                          setUnlockReason('');
                        }}
                      >
                        <Text style={styles.cancelUnlockText}>Hủy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.confirmUnlockBtn}
                        onPress={handleUnlockDebt}
                        disabled={isUnlocking}
                      >
                        {isUnlocking ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.confirmUnlockText}>Xác nhận mở khóa</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 2. Card Thống kê Nợ & Tiến độ */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRowTop}>
                <View>
                  <Text style={styles.summaryLabel}>Tổng phải thu đợt này</Text>
                  <Text style={styles.summaryTotalAmount}>{formatVND(debt.amount)}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent >= 100 ? '#10B981' : '#F38820',
                    },
                  ]}
                />
              </View>

              <View style={styles.summaryRowBottom}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.statSubText}>Đã thu ({progressPercent}%)</Text>
                  <Text style={styles.statPaidText}>{formatVND(totalPaid)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStatItem}>
                  <Text style={styles.statSubText}>Còn lại</Text>
                  <Text style={styles.statRemainingText}>{formatVND(remaining)}</Text>
                </View>
              </View>
            </View>

            {/* 3. Phân chia Layout (Landscape 2 cột / Portrait Tab) */}
            {isLandscape ? (
              <View style={styles.landscapeGrid}>
                {/* Cột trái: Lịch sử thanh toán */}
                <View style={styles.landscapeCol}>
                  <Text style={styles.sectionHeaderTitle}>Lịch sử các đợt thanh toán</Text>
                  {renderPaymentsList(debt.payments || [], handleDeletePayment, canManagePayment)}
                </View>

                {/* Cột phải: Form thu tiền */}
                <View style={styles.landscapeCol}>
                  <Text style={styles.sectionHeaderTitle}>Ghi nhận thanh toán mới</Text>
                  {isLocked ? (
                    <Text style={styles.disabledFormText}>
                      Khoản nợ đang bị khóa. Mở khóa để tiếp tục ghi nhận thanh toán.
                    </Text>
                  ) : remaining <= 0 ? (
                    <View style={styles.allPaidBox}>
                      <Feather name="check-circle" size={32} color="#16A34A" />
                      <Text style={styles.allPaidText}>Đợt này đã được thanh toán đủ 100%</Text>
                    </View>
                  ) : (
                    renderCreatePaymentForm()
                  )}
                </View>
              </View>
            ) : (
              <View>
                {/* Tabs chuyển đổi giữa Lịch sử thanh toán & Form thu tiền */}
                <View style={styles.tabsRow}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      activeTab === 'PAYMENTS' && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveTab('PAYMENTS')}
                  >
                    <Feather
                      name="list"
                      size={14}
                      color={activeTab === 'PAYMENTS' ? '#EA580C' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        activeTab === 'PAYMENTS' && styles.tabBtnTextActive,
                      ]}
                    >
                      Lịch sử thu ({debt.payments?.length || 0})
                    </Text>
                  </TouchableOpacity>

                  {!isLocked && remaining > 0 && canManagePayment && (
                    <TouchableOpacity
                      style={[
                        styles.tabBtn,
                        activeTab === 'CREATE_PAYMENT' && styles.tabBtnActive,
                      ]}
                      onPress={() => setActiveTab('CREATE_PAYMENT')}
                    >
                      <Feather
                        name="plus-circle"
                        size={14}
                        color={activeTab === 'CREATE_PAYMENT' ? '#EA580C' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.tabBtnText,
                          activeTab === 'CREATE_PAYMENT' && styles.tabBtnTextActive,
                        ]}
                      >
                        Ghi nhận thu tiền
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Nội dung Tab */}
                {activeTab === 'PAYMENTS' ? (
                  renderPaymentsList(debt.payments || [], handleDeletePayment, canManagePayment)
                ) : (
                  renderCreatePaymentForm()
                )}
              </View>
            )}
          </ScrollView>
        </View>

        {/* DatePickerModal chọn ngày thanh toán */}
        <DatePickerModal
          visible={isDatePickerVisible}
          initialDate={paymentDate}
          onClose={() => setIsDatePickerVisible(false)}
          onConfirm={(_ddmmyyyy: string, yyyymmdd: string) => setPaymentDate(yyyymmdd)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render danh sách các khoản thanh toán đã ghi nhận
  function renderPaymentsList(
    payments: DebtPayment[],
    onDelete: (p: DebtPayment) => void,
    canDelete: boolean
  ) {
    if (payments.length === 0) {
      return (
        <View style={styles.emptyPaymentsBox}>
          <MaterialCommunityIcons name="cash-remove" size={36} color="#CBD5E1" />
          <Text style={styles.emptyPaymentsTitle}>Chưa có khoản thu nào</Text>
          <Text style={styles.emptyPaymentsDesc}>
            Các lần thanh toán từng phần hoặc toàn bộ sẽ xuất hiện tại đây kèm chứng từ đính kèm.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.paymentsList}>
        {payments.map((p, idx) => (
          <View key={p.id || idx} style={styles.paymentItemCard}>
            <View style={styles.paymentCardHeader}>
              <View style={styles.paymentHeaderLeft}>
                <View style={styles.paymentIndexBadge}>
                  <Text style={styles.paymentIndexText}>#{idx + 1}</Text>
                </View>
                <View>
                  <Text style={styles.paymentAmount}>{formatVND(p.amount)}</Text>
                  <Text style={styles.paymentDate}>
                    Ngày thu: {formatDateToDDMMYYYY(p.paymentDate)}
                  </Text>
                </View>
              </View>

              {canDelete && (
                <TouchableOpacity
                  style={styles.deletePaymentBtn}
                  onPress={() => onDelete(p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            {p.note ? <Text style={styles.paymentNote}>{p.note}</Text> : null}

            {/* Chứng từ đính kèm */}
            {p.attachments && p.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                <Text style={styles.attachmentLabel}>Chứng từ kèm theo:</Text>
                <View style={styles.attachmentsList}>
                  {p.attachments.map((att, aIdx) => (
                    <TouchableOpacity
                      key={att.url || aIdx}
                      style={styles.attachmentChip}
                      onPress={() => Linking.openURL(att.url)}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={att.type === 'PDF' ? 'file-text' : 'image'}
                        size={12}
                        color="#2563EB"
                      />
                      <Text style={styles.attachmentChipText} numberOfLines={1}>
                        {att.name || `Chứng từ ${aIdx + 1}`}
                      </Text>
                      <Feather name="external-link" size={10} color="#94A3B8" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {p.createdBy?.fullName && (
              <Text style={styles.paymentCreator}>
                Người thu: {p.createdBy.fullName}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  }

  // Render Form ghi nhận thanh toán mới
  function renderCreatePaymentForm() {
    return (
      <View style={styles.formContainer}>
        {/* Số tiền thanh toán */}
        <View style={styles.formGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>
              Số tiền thanh toán <Text style={styles.requiredStar}>*</Text>
            </Text>
            {remaining > 0 && (
              <TouchableOpacity
                onPress={() => setPaymentAmountInput(formatNumberInput(remaining))}
              >
                <Text style={styles.fillRemainingLink}>Thu hết ({formatVND(remaining)})</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.inputIconWrapper}>
            <Text style={styles.currencyPrefix}>VNĐ</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              value={paymentAmountInput}
              onChangeText={(text) => {
                const num = parseNumberInput(text);
                setPaymentAmountInput(num > 0 ? formatNumberInput(num) : '');
              }}
            />
          </View>
        </View>

        {/* Ngày thanh toán */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>
            Ngày thanh toán <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setIsDatePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Feather name="calendar" size={16} color="#64748B" />
            <Text style={styles.datePickerText}>
              {paymentDate ? formatDateToDDMMYYYY(paymentDate) : 'Chọn ngày thu'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ghi chú */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Ghi chú đợt thu</Text>
          <TextInput
            style={[styles.textInput, styles.textAreaInput]}
            placeholder="Ví dụ: Chuyển khoản Techcombank đợt 1..."
            placeholderTextColor="#94A3B8"
            value={paymentNote}
            onChangeText={setPaymentNote}
            multiline
          />
        </View>

        {/* Đính kèm chứng từ (ảnh/PDF qua InvoiceUploadPicker) */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Chứng từ / Giấy nộp tiền / Ủy nhiệm chi</Text>
          <InvoiceUploadPicker
            files={attachedFiles}
            onChange={setAttachedFiles}
            maxFiles={3}
          />
        </View>

        {/* Nút Submit ghi nhận thanh toán */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleCreatePayment}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Xác nhận ghi nhận thu tiền</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
  },
  sheetContainerLandscape: {
    maxHeight: '94%',
    minHeight: '85%',
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  headerRow: {
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
    marginRight: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  lockBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  lockBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  lockBannerDesc: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
  openUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  openUnlockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  unlockFormBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  unlockFormLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  requiredStar: {
    color: '#EF4444',
  },
  unlockInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  unlockBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelUnlockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelUnlockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmUnlockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#D97706',
  },
  confirmUnlockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  summaryStatItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  statSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  statPaidText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 1,
  },
  statRemainingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EA580C',
    marginTop: 1,
  },
  landscapeGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  landscapeCol: {
    flex: 1,
    gap: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  disabledFormText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },
  allPaidBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allPaidText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    fontWeight: '800',
    color: '#EA580C',
  },
  emptyPaymentsBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyPaymentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptyPaymentsDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  paymentsList: {
    gap: 10,
  },
  paymentItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  paymentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  paymentDate: {
    fontSize: 11,
    color: '#64748B',
  },
  deletePaymentBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  paymentNote: {
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  attachmentsContainer: {
    gap: 4,
  },
  attachmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  attachmentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '100%',
  },
  attachmentChipText: {
    fontSize: 11,
    color: '#1E40AF',
    maxWidth: 180,
  },
  paymentCreator: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  formGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fillRemainingLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  inputIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
  },
  currencyPrefix: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontWeight: 'normal',
    backgroundColor: '#F8FAFC',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  datePickerText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F38820',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
