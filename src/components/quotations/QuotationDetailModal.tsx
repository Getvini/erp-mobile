import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useQuotationDetailQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
} from '@/hooks/queries/useQuotations';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';
import { useAuthStore } from '@/stores/useAuthStore';

export interface QuotationDetailModalProps {
  visible: boolean;
  quotationId: string | null;
  onClose: () => void;
  onEdit?: (quotation: any) => void;
  onApprovedContract?: (contractId: string) => void;
}

export const QuotationDetailModal: React.FC<QuotationDetailModalProps> = ({
  visible,
  quotationId,
  onClose,
  onEdit,
  onApprovedContract,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height && width >= 560;

  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || '').toUpperCase();
  const canApprove = ['ADMIN', 'DIRECTOR', 'BOD'].includes(userRole);

  const { data: quotation, isLoading } = useQuotationDetailQuery(
    visible && quotationId ? quotationId : ''
  );

  const approveMutation = useApproveQuotationMutation();
  const rejectMutation = useRejectQuotationMutation();

  const [isRejectingMode, setIsRejectingMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Group items by Package / Standalone
  const { packageGroups, standaloneItems, subtotal, vatTotal, finalTotal } = useMemo(() => {
    if (!quotation?.details) {
      return { packageGroups: [], standaloneItems: [], subtotal: 0, vatTotal: 0, finalTotal: 0 };
    }

    const groups: Record<string, any[]> = {};
    const standalone: any[] = [];
    let sub = 0;

    quotation.details.forEach((d: any) => {
      const price = Math.round(Number(d.sellingPrice || 0));
      const qty = Number(d.quantity || 1);
      const lineTotal = price * qty;
      sub += lineTotal;

      if (d.packageName && d.packageName !== 'STANDALONE') {
        if (!groups[d.packageName]) groups[d.packageName] = [];
        groups[d.packageName].push({ ...d, lineTotal });
      } else {
        standalone.push({ ...d, lineTotal });
      }
    });

    const vat = sub * 0.08;
    const total = sub + vat;

    return {
      packageGroups: Object.entries(groups).map(([name, items]) => ({ name, items })),
      standaloneItems: standalone,
      subtotal: sub,
      vatTotal: vat,
      finalTotal: total,
    };
  }, [quotation]);

  const status = quotation?.status || 'DRAFT';
  const isApproved = status === 'APPROVED';
  const isPending = status === 'PENDING_APPROVAL';

  // Duyệt báo giá -> chuyển đổi thành Hợp đồng
  const handleApprove = () => {
    if (!quotationId) return;

    Alert.alert(
      'Phê duyệt Báo giá',
      'Bạn có chắc chắn muốn phê duyệt Báo giá này? Sau khi duyệt, hệ thống sẽ tự động khởi tạo Hợp đồng tương ứng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Phê duyệt',
          onPress: async () => {
            try {
              setIsSubmittingAction(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const res: any = await approveMutation.mutateAsync(quotationId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              const contractId = res?.contractId || res?.contract?.id;
              Alert.alert(
                'Thành công',
                contractId
                  ? 'Đã duyệt báo giá và tự động tạo Hợp đồng thành công!'
                  : 'Đã duyệt báo giá thành công!'
              );
              onClose();
              if (contractId) onApprovedContract?.(contractId);
            } catch (err: any) {
              Alert.alert('Lỗi phê duyệt', err.message || 'Không thể duyệt báo giá');
            } finally {
              setIsSubmittingAction(false);
            }
          },
        },
      ]
    );
  };

  // Từ chối báo giá
  const handleReject = async () => {
    if (!quotationId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do từ chối báo giá.');
      return;
    }

    try {
      setIsSubmittingAction(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await rejectMutation.mutateAsync({ id: quotationId, reason: rejectReason.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      Alert.alert('Đã từ chối', 'Đã chuyển trạng thái báo giá sang Từ chối.');
      setIsRejectingMode(false);
      setRejectReason('');
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi từ chối', err.message || 'Không thể từ chối báo giá');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            isLandscape && styles.sheetLandscape,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.dragBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Feather name="file-text" size={18} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  Báo giá phiên bản v{quotation?.version || 1}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {quotation?.opportunity?.name || 'Chi tiết báo giá'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View
                style={[
                  styles.statusBadge,
                  isApproved
                    ? styles.statusApproved
                    : isPending
                    ? styles.statusPending
                    : styles.statusDraft,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isApproved
                      ? styles.statusTextApproved
                      : isPending
                      ? styles.statusTextPending
                      : styles.statusTextDraft,
                  ]}
                >
                  {isApproved
                    ? 'Đã duyệt'
                    : isPending
                    ? 'Chờ duyệt'
                    : status === 'REJECTED'
                    ? 'Bị từ chối'
                    : 'Bản nháp'}
                </Text>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#F38820" />
              <Text style={styles.loadingText}>Đang tải chi tiết báo giá...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Form từ chối nếu bật mode */}
              {isRejectingMode && (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectLabel}>
                    Lý do từ chối báo giá <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="Nhập lý do chi tiết..."
                    placeholderTextColor="#94A3B8"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                  />
                  <View style={styles.rejectBtnRow}>
                    <TouchableOpacity
                      style={styles.cancelRejectBtn}
                      onPress={() => {
                        setIsRejectingMode(false);
                        setRejectReason('');
                      }}
                    >
                      <Text style={styles.cancelRejectText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmRejectBtn}
                      onPress={handleReject}
                      disabled={isSubmittingAction}
                    >
                      {isSubmittingAction ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.confirmRejectText}>Xác nhận từ chối</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 1. Gói dịch vụ */}
              {packageGroups.map((pkg, pIdx) => (
                <View key={pIdx} style={styles.sectionCard}>
                  <View style={styles.pkgHeader}>
                    <MaterialCommunityIcons name="package-variant" size={16} color="#2563EB" />
                    <Text style={styles.pkgTitle}>{pkg.name}</Text>
                  </View>

                  <View style={styles.itemsTable}>
                    {pkg.items.map((it: any, itIdx: number) => (
                      <View key={it.id || itIdx} style={styles.tableRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>
                            {it.service?.name || it.name || 'Dịch vụ'}
                          </Text>
                          <Text style={styles.rowQty}>
                            SL: {it.quantity} {it.unit || ''} • Đơn giá:{' '}
                            {formatVND(it.sellingPrice)}
                          </Text>
                        </View>
                        <Text style={styles.rowPrice}>{formatVND(it.lineTotal)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* 2. Dịch vụ đơn lẻ */}
              {standaloneItems.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.pkgHeader}>
                    <Feather name="layers" size={16} color="#16A34A" />
                    <Text style={styles.pkgTitle}>Dịch vụ đơn lẻ</Text>
                  </View>

                  <View style={styles.itemsTable}>
                    {standaloneItems.map((it: any, itIdx: number) => (
                      <View key={it.id || itIdx} style={styles.tableRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>
                            {it.service?.name || it.name || 'Dịch vụ'}
                          </Text>
                          <Text style={styles.rowQty}>
                            SL: {it.quantity} {it.unit || ''} • Đơn giá:{' '}
                            {formatVND(it.sellingPrice)}
                          </Text>
                        </View>
                        <Text style={styles.rowPrice}>{formatVND(it.lineTotal)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 3. Bảng tổng kết số tiền */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Tổng tạm tính:</Text>
                  <Text style={styles.summaryVal}>{formatVND(subtotal)}</Text>
                </View>
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Thuế VAT (8%):</Text>
                  <Text style={styles.summaryVal}>{formatVND(vatTotal)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>TỔNG TIỀN THANH TOÁN:</Text>
                  <Text style={styles.totalVal}>{formatVND(finalTotal)}</Text>
                </View>
              </View>

              {/* Ghi chú */}
              {quotation?.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Ghi chú:</Text>
                  <Text style={styles.noteContent}>{quotation.note}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Action Bar Footer */}
          {!isLoading && (
            <View style={styles.footerBar}>
              {!isApproved && onEdit && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    onClose();
                    onEdit(quotation);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={15} color="#475569" />
                  <Text style={styles.editBtnText}>Sửa</Text>
                </TouchableOpacity>
              )}

              {canApprove && !isApproved && !isRejectingMode && (
                <TouchableOpacity
                  style={styles.rejectActionBtn}
                  onPress={() => setIsRejectingMode(true)}
                  activeOpacity={0.7}
                >
                  <Feather name="x-circle" size={15} color="#DC2626" />
                  <Text style={styles.rejectActionBtnText}>Từ chối</Text>
                </TouchableOpacity>
              )}

              {canApprove && !isApproved && (
                <TouchableOpacity
                  style={[styles.approveBtn, isSubmittingAction && styles.btnDisabled]}
                  onPress={handleApprove}
                  disabled={isSubmittingAction}
                  activeOpacity={0.8}
                >
                  {isSubmittingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.approveBtnText}>Duyệt & Tạo Hợp Đồng</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '65%',
  },
  sheetLandscape: {
    maxHeight: '96%',
    minHeight: '88%',
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
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
    marginRight: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDraft: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextDraft: {
    color: '#64748B',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextApproved: {
    color: '#16A34A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  rejectBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  rejectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    minHeight: 50,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  rejectBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelRejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelRejectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  confirmRejectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  pkgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pkgTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  itemsTable: {
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowQty: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rowPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EA580C',
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  noteContent: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  rejectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 11,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
