import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  usePaymentMilestonesByContractQuery,
} from '@/hooks/queries/useMilestones';
import { useDebtsByContractQuery } from '@/hooks/queries/useDebts';
import {
  PaymentMilestone,
  PaymentMilestoneStatus,
  PAYMENT_MILESTONE_STATUS_CONFIG,
  PAYMENT_MILESTONE_STATUS_LABELS,
} from '@/services/paymentMilestoneService';
import { Debt } from '@/services/debtService';
import { MilestoneModal } from './MilestoneModal';
import { PaymentRecordModal } from './PaymentRecordModal';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';
import { useAuthStore } from '@/stores/useAuthStore';

export interface MilestoneTrackerTabProps {
  contractId: string;
  contractCode?: string;
  sellingPrice?: number;
  isReadOnly?: boolean;
  onRefresh?: () => void;
}

export const MilestoneTrackerTab: React.FC<MilestoneTrackerTabProps> = ({
  contractId,
  contractCode,
  sellingPrice = 0,
  isReadOnly = false,
  onRefresh,
}) => {
  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || '').toUpperCase();

  // Kiểm tra quyền quản trị / kế toán / quản lý
  const canManage = useMemo(() => {
    if (isReadOnly) return false;
    return ['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'LEADER'].includes(userRole);
  }, [isReadOnly, userRole]);

  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalMilestone, setPaymentModalMilestone] = useState<PaymentMilestone | null>(null);

  const { data: debts = [], refetch: refetchDebts } = useDebtsByContractQuery(contractId);

  const {
    data: milestones = [],
    isLoading,
    isRefetching,
    refetch,
  } = usePaymentMilestonesByContractQuery(contractId);

  // Thống kê tiến độ thu tiền (chuẩn hóa 100% với Web FinancialInfo.jsx)
  const stats = useMemo(() => {
    const totalContractAmount = Number(sellingPrice || 0);
    let totalPlanAmount = 0;
    let totalPaidAmount = 0;
    let paidCount = 0;
    let overdueCount = 0;

    const now = new Date();

    milestones.forEach((m) => {
      const amt = Number(m.amount || 0);
      totalPlanAmount += amt;

      const debt = debts.find((d) => d.milestoneId === m.id || d.milestone?.id === m.id);
      let milestonePaid = 0;
      if (debt) {
        const payments = debt.payments?.map((p) => Number(p.amount || 0)) || [];
        milestonePaid = payments.reduce((sum, p) => sum + p, 0);
      } else if (m.status === PaymentMilestoneStatus.PAID || m.status === 'COMPLETED') {
        milestonePaid = amt;
      }

      totalPaidAmount += milestonePaid;

      const isCompleted = (debt && milestonePaid >= amt) || m.status === PaymentMilestoneStatus.PAID || m.status === 'COMPLETED';
      if (isCompleted) {
        paidCount += 1;
      } else if (m.dueDate) {
        const due = new Date(m.dueDate);
        if (due < now && m.status !== PaymentMilestoneStatus.CANCELLED) {
          overdueCount += 1;
        }
      }
    });

    const targetAmount = totalContractAmount > 0 ? totalContractAmount : totalPlanAmount;
    const progressPercent =
      targetAmount > 0 ? Math.min(100, Math.round((totalPaidAmount / targetAmount) * 100)) : 0;
    const remainingAmount = Math.max(0, targetAmount - totalPaidAmount);

    return {
      totalContractAmount: targetAmount,
      totalPaidAmount,
      remainingAmount,
      progressPercent,
      totalCount: milestones.length,
      paidCount,
      overdueCount,
    };
  }, [milestones, debts, sellingPrice]);

  const handleOpenModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleModalSuccess = useCallback(() => {
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  // Mở modal ghi nhận thanh toán
  const handleOpenPaymentModal = useCallback(
    (milestone: PaymentMilestone) => {
      if (!canManage) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPaymentModalMilestone(milestone);
    },
    [canManage]
  );


  return (
    <View style={styles.container}>
      {/* 1. Header Lộ trình Thanh Toán */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.headerIconWrapper}>
            <Feather name="calendar" size={15} color="#F38820" />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Lộ trình Thanh Toán
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Theo dõi tiến độ từ lập kế hoạch đến khi thanh toán đủ
            </Text>
          </View>
        </View>

        {canManage && (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={handleOpenModal}
            activeOpacity={0.7}
          >
            <Feather name="sliders" size={13} color="#F38820" />
            <Text style={styles.manageBtnText}>Quản lý lộ trình</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Danh sách các đợt thanh toán (Milestones list) */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#F38820" />
          <Text style={styles.loadingText}>Đang tải danh sách đợt thanh toán...</Text>
        </View>
      ) : milestones.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="calendar-clock" size={32} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>Chưa có lộ trình thanh toán</Text>
          <Text style={styles.emptyDesc}>
            Phân bổ giá trị hợp đồng thành từng đợt để theo dõi dòng tiền và xuất biên bản nghiệm thu.
          </Text>
          {canManage && (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={handleOpenModal}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={16} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Tạo lộ trình ngay</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.milestonesList}>
          {milestones.map((ms, index) => {
            const debt = debts.find((d) => d.milestoneId === ms.id || d.milestone?.id === ms.id);
            let paidAmount = 0;
            if (debt) {
              const payments = debt.payments?.map((p) => Number(p.amount || 0)) || [];
              paidAmount = payments.reduce((sum, p) => sum + p, 0);
            } else if (ms.status === PaymentMilestoneStatus.PAID || ms.status === 'COMPLETED') {
              paidAmount = Number(ms.amount || 0);
            }
            const msAmount = Number(ms.amount || 0);
            const remaining = Math.max(0, msAmount - paidAmount);
            const isCompleted = (debt && paidAmount >= msAmount) || ms.status === PaymentMilestoneStatus.PAID || ms.status === 'COMPLETED';
            const isPaid = isCompleted;
            const progress = msAmount > 0 ? Math.min(100, Math.round((paidAmount / msAmount) * 100)) : 0;

            const isOverdue =
              !isPaid &&
              ms.dueDate &&
              new Date(ms.dueDate) < new Date() &&
              ms.status !== PaymentMilestoneStatus.CANCELLED;

            const statusConfig = isCompleted
              ? { bg: '#DCFCE7', border: '#BBF7D0', color: '#16A34A' }
              : debt
              ? { bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB' }
              : (PAYMENT_MILESTONE_STATUS_CONFIG[ms.status] || PAYMENT_MILESTONE_STATUS_CONFIG.PENDING);
            const statusLabel = isCompleted
              ? 'Đã hoàn tất'
              : debt
              ? 'Đang thu nợ'
              : (PAYMENT_MILESTONE_STATUS_LABELS[ms.status] || 'Đang chờ');

            return (
              <View
                key={ms.id || `ms_${index}`}
                style={[
                  styles.milestoneCard,
                  isPaid && styles.milestoneCardPaid,
                  isOverdue && styles.milestoneCardOverdue,
                ]}
              >
                {/* Header card: Tên đợt, Badge trạng thái & Sub-meta */}
                <View style={styles.cardHeader}>
                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={styles.milestoneName} numberOfLines={1}>
                        {ms.name.toUpperCase()}
                      </Text>
                      {isOverdue ? (
                        <View style={[styles.statusBadge, styles.statusBadgeOverdue]}>
                          <Text style={styles.statusBadgeTextOverdue}>Quá hạn nộp</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: statusConfig.bg,
                              borderColor: statusConfig.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: statusConfig.color },
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Sub-meta: Hạn thanh toán • Giá trị đợt */}
                    <View style={styles.subMetaRow}>
                      <Feather
                        name="clock"
                        size={11}
                        color={isOverdue ? '#DC2626' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.subMetaText,
                          isOverdue && styles.subMetaTextOverdue,
                        ]}
                      >
                        Hạn: {ms.dueDate ? formatDateToDDMMYYYY(ms.dueDate) : 'Chưa đặt hạn'}
                      </Text>
                      <Text style={styles.subMetaDot}>•</Text>
                      <Text style={styles.subMetaValue}>
                        Giá trị: {formatVND(msAmount)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Body card: ĐÃ THU, CÒN NỢ & Nút thao tác [ -> ] */}
                <View style={styles.cardFinanceRow}>
                  <View style={styles.financeColsGroup}>
                    <View style={styles.financeCol}>
                      <Text style={styles.financeLabel}>ĐÃ THU</Text>
                      <Text style={[styles.financeValue, styles.financeValuePaid]}>
                        {formatVND(paidAmount)}
                      </Text>
                    </View>
                    <View style={styles.financeDivider} />
                    <View style={styles.financeCol}>
                      <Text style={styles.financeLabel}>CÒN NỢ</Text>
                      <Text
                        style={[
                          styles.financeValue,
                          remaining > 0 ? styles.financeValueDebt : styles.financeValuePaid,
                        ]}
                      >
                        {formatVND(remaining)}
                      </Text>
                    </View>
                  </View>

                  {/* Nút mũi tên mở modal thanh toán / chi tiết */}
                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionCircleBtn}
                      onPress={() => handleOpenPaymentModal(ms)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="arrow-right" size={16} color="#4F46E5" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tiến độ thu tiền đợt này (luôn hiển thị cho mọi đợt) */}
                <View style={styles.milestoneProgressWrapper}>
                  <View style={styles.milestoneProgressHeader}>
                    <Text style={styles.milestoneProgressLabel}>
                      TIẾN ĐỘ THU TIỀN ĐỢT NÀY
                    </Text>
                    <Text
                      style={[
                        styles.milestoneProgressPct,
                        isCompleted ? styles.pctSuccess : styles.pctActive,
                      ]}
                    >
                      {progress}%
                    </Text>
                  </View>
                  <View style={styles.milestoneProgressTrack}>
                    <View
                      style={[
                        styles.milestoneProgressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: isCompleted ? '#16A34A' : '#4F46E5',
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 4. Bottom Sheet Modal Chỉnh sửa / Phân bổ đợt thanh toán */}
      <MilestoneModal
        visible={modalVisible}
        onClose={handleCloseModal}
        contractId={contractId}
        contractCode={contractCode}
        sellingPrice={sellingPrice}
        isReadOnly={!canManage}
        onSuccess={handleModalSuccess}
      />

      {/* 5. Modal ghi nhận thanh toán (DebtDetailsModal equivalent) */}
      {paymentModalMilestone && (
        <PaymentRecordModal
          visible={Boolean(paymentModalMilestone)}
          debt={debts.find((d) => d.milestoneId === paymentModalMilestone.id || d.milestone?.id === paymentModalMilestone.id) || null}
          contractId={contractId}
          milestoneId={paymentModalMilestone.id}
          milestoneName={paymentModalMilestone.name}
          milestoneAmount={Number(paymentModalMilestone.amount)}
          onClose={() => setPaymentModalMilestone(null)}
          onSuccess={() => {
            refetch();
            refetchDebts();
            onRefresh?.();
            setPaymentModalMilestone(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 8,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexShrink: 0,
  },
  manageBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  milestonesList: {
    gap: 12,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  milestoneCardPaid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  milestoneCardOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardHeader: {
    marginBottom: 8,
  },
  nameBlock: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statusBadgeTextOverdue: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  subMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  subMetaTextOverdue: {
    color: '#DC2626',
    fontWeight: '600',
  },
  subMetaDot: {
    fontSize: 11,
    color: '#CBD5E1',
    marginHorizontal: 2,
  },
  subMetaValue: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  cardFinanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  financeColsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  financeCol: {
    gap: 2,
  },
  financeDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  financeLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  financeValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  financeValuePaid: {
    color: '#16A34A',
  },
  financeValueDebt: {
    color: '#DC2626',
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  milestoneProgressWrapper: {
    marginTop: 2,
    gap: 4,
  },
  milestoneProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  milestoneProgressLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  milestoneProgressPct: {
    fontSize: 10,
    fontWeight: '800',
  },
  pctSuccess: {
    color: '#16A34A',
  },
  pctActive: {
    color: '#4F46E5',
  },
  milestoneProgressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
