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
  useUpdatePaymentStatusMutation,
} from '@/hooks/queries/useMilestones';
import {
  PaymentMilestone,
  PaymentMilestoneStatus,
  PAYMENT_MILESTONE_STATUS_CONFIG,
  PAYMENT_MILESTONE_STATUS_LABELS,
} from '@/services/paymentMilestoneService';
import { MilestoneModal } from './MilestoneModal';
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
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);

  const {
    data: milestones = [],
    isLoading,
    isRefetching,
    refetch,
  } = usePaymentMilestonesByContractQuery(contractId);

  const updateStatusMutation = useUpdatePaymentStatusMutation();

  // Thống kê tiến độ thu tiền
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

      const isPaid = m.status === PaymentMilestoneStatus.PAID || m.status === 'COMPLETED';
      if (isPaid) {
        totalPaidAmount += amt;
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
  }, [milestones, sellingPrice]);

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

  // Đổi trạng thái nhanh Đã thanh toán / Chưa thanh toán
  const handleToggleStatus = useCallback(
    (milestone: PaymentMilestone) => {
      if (!canManage) return;

      const isCurrentlyPaid =
        milestone.status === PaymentMilestoneStatus.PAID || milestone.status === 'COMPLETED';
      const newStatus = isCurrentlyPaid
        ? PaymentMilestoneStatus.WAITING_PAYMENT
        : PaymentMilestoneStatus.PAID;

      const actionText = isCurrentlyPaid ? 'chuyển sang Chờ thanh toán' : 'xác nhận Đã thanh toán';

      Alert.alert(
        'Cập nhật trạng thái',
        `Bạn có chắc chắn muốn ${actionText} cho "${milestone.name}"?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đồng ý',
            onPress: async () => {
              try {
                setUpdatingMilestoneId(milestone.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await updateStatusMutation.mutateAsync({
                  id: milestone.id,
                  status: newStatus,
                  paidDate: isCurrentlyPaid ? undefined : new Date().toISOString(),
                });
                refetch();
                onRefresh?.();
              } catch (err: any) {
                Alert.alert('Lỗi', err.message || 'Không thể cập nhật trạng thái đợt thanh toán');
              } finally {
                setUpdatingMilestoneId(null);
              }
            },
          },
        ]
      );
    },
    [canManage, updateStatusMutation, refetch, onRefresh]
  );

  return (
    <View style={styles.container}>
      {/* 1. Header Box & Nút thiết lập */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.headerIconWrapper}>
            <Feather name="calendar" size={16} color="#D97706" />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              Đợt thanh toán ({stats.totalCount})
            </Text>
            <Text style={styles.headerSubtitle}>
              {stats.paidCount}/{stats.totalCount} đợt đã hoàn tất
            </Text>
          </View>
        </View>

        {canManage && (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={handleOpenModal}
            activeOpacity={0.7}
          >
            <Feather name="sliders" size={14} color="#EA580C" />
            <Text style={styles.manageBtnText}>Thiết lập</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Card Tiến độ thu tiền tổng thể (Progress Bar) */}
      <View style={styles.progressCard}>
        <View style={styles.progressRowTop}>
          <View>
            <Text style={styles.progressLabel}>Tiến độ thu tiền</Text>
            <Text style={styles.progressAmountPaid}>
              {formatVND(stats.totalPaidAmount)}
              <Text style={styles.progressAmountTotal}>
                {' '}/ {formatVND(stats.totalContractAmount)}
              </Text>
            </Text>
          </View>
          <View style={styles.percentBadge}>
            <Text style={styles.percentText}>{stats.progressPercent}%</Text>
          </View>
        </View>

        {/* Thanh tiến trình Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${stats.progressPercent}%`,
                backgroundColor: stats.progressPercent >= 100 ? '#10B981' : '#F38820',
              },
            ]}
          />
        </View>

        {/* Thống kê 2 cột Còn lại & Quá hạn */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statSubLabel}>Còn lại phải thu</Text>
            <Text style={styles.statValueRemaining}>{formatVND(stats.remainingAmount)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statSubLabel}>Đợt quá hạn</Text>
            <Text
              style={[
                styles.statValueOverdue,
                stats.overdueCount > 0 ? styles.statOverdueWarning : null,
              ]}
            >
              {stats.overdueCount > 0 ? `${stats.overdueCount} đợt trễ hạn` : 'Đúng hạn'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Danh sách các đợt thanh toán (Milestones list) */}
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
          <Text style={styles.emptyTitle}>Chưa có đợt thanh toán nào</Text>
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
              <Text style={styles.emptyAddBtnText}>Thiết lập đợt thanh toán ngay</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.milestonesList}>
          {milestones.map((ms, index) => {
            const isPaid =
              ms.status === PaymentMilestoneStatus.PAID || ms.status === 'COMPLETED';
            const isUpdating = updatingMilestoneId === ms.id;
            const statusConfig =
              PAYMENT_MILESTONE_STATUS_CONFIG[ms.status] ||
              PAYMENT_MILESTONE_STATUS_CONFIG.PENDING;
            const statusLabel =
              PAYMENT_MILESTONE_STATUS_LABELS[ms.status] ||
              (isPaid ? 'Đã thanh toán' : 'Chờ thanh toán');

            // Kiểm tra cảnh báo quá hạn
            const isOverdue =
              !isPaid &&
              ms.dueDate &&
              new Date(ms.dueDate) < new Date() &&
              ms.status !== PaymentMilestoneStatus.CANCELLED;

            return (
              <View
                key={ms.id || `ms_${index}`}
                style={[
                  styles.milestoneCard,
                  isPaid && styles.milestoneCardPaid,
                  isOverdue && styles.milestoneCardOverdue,
                ]}
              >
                {/* Header card: Số thứ tự, Tên mốc, Badge trạng thái */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.indexCircle,
                        isPaid && styles.indexCirclePaid,
                        isOverdue && styles.indexCircleOverdue,
                      ]}
                    >
                      <Text
                        style={[
                          styles.indexText,
                          isPaid && styles.indexTextPaid,
                          isOverdue && styles.indexTextOverdue,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.nameBlock}>
                      <Text style={styles.milestoneName} numberOfLines={1}>
                        {ms.name}
                      </Text>
                      {ms.description ? (
                        <Text style={styles.milestoneDesc} numberOfLines={2}>
                          {ms.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isOverdue ? '#FEE2E2' : statusConfig.bg,
                        borderColor: isOverdue ? '#FECACA' : statusConfig.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isOverdue ? '#DC2626' : statusConfig.color },
                      ]}
                    >
                      {isOverdue ? 'Quá hạn' : statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Body card: Số tiền & % tỷ lệ */}
                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.amountLabel}>Số tiền đợt này:</Text>
                    <Text
                      style={[
                        styles.amountValue,
                        isPaid && styles.amountValuePaid,
                      ]}
                    >
                      {formatVND(ms.amount)}
                    </Text>
                  </View>

                  <View style={styles.percentageBadge}>
                    <Text style={styles.percentageText}>{Number(ms.percentage || 0)}%</Text>
                  </View>
                </View>

                {/* Footer card: Ngày hạn, Ngày thanh toán & Nút hành động toggle */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerDateCol}>
                    {ms.dueDate ? (
                      <View style={styles.dateRow}>
                        <Feather
                          name="clock"
                          size={12}
                          color={isOverdue ? '#DC2626' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.dateText,
                            isOverdue && styles.dateTextOverdue,
                          ]}
                        >
                          Hạn thu: {formatDateToDDMMYYYY(ms.dueDate)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.dateTextMuted}>Chưa đặt hạn thu</Text>
                    )}

                    {isPaid && ms.paidDate ? (
                      <View style={styles.paidDateRow}>
                        <Feather name="check" size={12} color="#16A34A" />
                        <Text style={styles.paidDateText}>
                          Đã thu ngày: {formatDateToDDMMYYYY(ms.paidDate)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Nút hành động nhanh Toggle trạng thái thanh toán */}
                  {canManage && (
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        isPaid ? styles.toggleBtnUnmark : styles.toggleBtnMark,
                        isUpdating && styles.toggleBtnDisabled,
                      ]}
                      onPress={() => handleToggleStatus(ms)}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color={isPaid ? '#64748B' : '#16A34A'} />
                      ) : (
                        <>
                          <Feather
                            name={isPaid ? 'rotate-ccw' : 'check-circle'}
                            size={13}
                            color={isPaid ? '#64748B' : '#16A34A'}
                          />
                          <Text
                            style={[
                              styles.toggleBtnText,
                              isPaid ? styles.toggleBtnTextUnmark : styles.toggleBtnTextMark,
                            ]}
                          >
                            {isPaid ? 'Hủy thu' : 'Đã thu'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },
  progressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  progressRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressAmountPaid: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  progressAmountTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  percentBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  statSubLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statValueRemaining: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  statValueOverdue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 1,
  },
  statOverdueWarning: {
    color: '#DC2626',
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
    backgroundColor: '#F38820',
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
    gap: 10,
  },
  milestoneCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  indexCircle: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexCirclePaid: {
    backgroundColor: '#DCFCE7',
  },
  indexCircleOverdue: {
    backgroundColor: '#FEE2E2',
  },
  indexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  indexTextPaid: {
    color: '#16A34A',
  },
  indexTextOverdue: {
    color: '#DC2626',
  },
  nameBlock: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  milestoneDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  amountValuePaid: {
    color: '#15803D',
  },
  percentageBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerDateCol: {
    flex: 1,
    gap: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  dateTextOverdue: {
    color: '#DC2626',
    fontWeight: '600',
  },
  dateTextMuted: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  paidDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  paidDateText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleBtnMark: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  toggleBtnUnmark: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  toggleBtnDisabled: {
    opacity: 0.6,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleBtnTextMark: {
    color: '#16A34A',
  },
  toggleBtnTextUnmark: {
    color: '#64748B',
  },
});
