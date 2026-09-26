import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Debt,
  DebtStatus,
  DEBT_STATUS_CONFIG,
  DEBT_STATUS_LABELS,
} from '@/services/debtService';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';

export interface ContractDebtCardProps {
  debt: Debt;
  onPressDetails?: (debt: Debt) => void;
  onActivate?: (debt: Debt) => void;
  canManage?: boolean;
}

export const ContractDebtCard: React.FC<ContractDebtCardProps> = ({
  debt,
  onPressDetails,
  onActivate,
  canManage = true,
}) => {
  const { totalPaid, remaining, progressPercent, isOverdue } = useMemo(() => {
    const amount = Number(debt.amount || 0);
    const paid = (debt.payments || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const rem = Math.max(0, amount - paid);
    const pct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;

    const overdue =
      rem > 0 &&
      Boolean(debt.milestone?.dueDate) &&
      new Date(debt.milestone!.dueDate!) < new Date() &&
      debt.status !== DebtStatus.LOCKED;

    return {
      totalPaid: paid,
      remaining: rem,
      progressPercent: pct,
      isOverdue: overdue,
    };
  }, [debt]);

  const isLocked = debt.status === DebtStatus.LOCKED;
  const isCompleted = debt.status === DebtStatus.COMPLETED || remaining === 0;
  const isPending = debt.status === DebtStatus.PENDING;

  const statusConfig = isOverdue
    ? DEBT_STATUS_CONFIG.OVERDUE
    : DEBT_STATUS_CONFIG[debt.status] || DEBT_STATUS_CONFIG.ACTIVE;
  const statusLabel = isOverdue
    ? 'Quá hạn'
    : DEBT_STATUS_LABELS[debt.status] || debt.status;

  const handlePressCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPressDetails?.(debt);
  };

  const handlePressActivate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onActivate?.(debt);
  };

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        isCompleted && styles.cardContainerCompleted,
        isOverdue && styles.cardContainerOverdue,
        isLocked && styles.cardContainerLocked,
      ]}
      onPress={handlePressCard}
      activeOpacity={0.8}
    >
      {/* 1. Header Card: Tên Mốc & Trạng thái Badge */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View
            style={[
              styles.iconCircle,
              isCompleted && styles.iconCircleCompleted,
              isOverdue && styles.iconCircleOverdue,
              isLocked && styles.iconCircleLocked,
            ]}
          >
            <Feather
              name={isCompleted ? 'check-circle' : isLocked ? 'lock' : 'credit-card'}
              size={15}
              color={
                isCompleted
                  ? '#16A34A'
                  : isOverdue
                  ? '#DC2626'
                  : isLocked
                  ? '#D97706'
                  : '#2563EB'
              }
            />
          </View>
          <View style={styles.titleTextCol}>
            <Text style={styles.milestoneName} numberOfLines={1}>
              {debt.milestone?.name || 'Khoản nợ hợp đồng'}
            </Text>
            {debt.contract?.contractCode && (
              <Text style={styles.contractCode} numberOfLines={1}>
                {debt.contract.contractCode}
                {debt.contract.customer?.name ? ` • ${debt.contract.customer.name}` : ''}
              </Text>
            )}
          </View>
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

      {/* 2. Body Card: Số tiền & Progress Bar */}
      <View style={styles.bodyBlock}>
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Phải thu đợt này</Text>
            <Text style={styles.totalAmountText}>{formatVND(debt.amount)}</Text>
          </View>
          <View style={styles.percentageBadge}>
            <Text style={styles.percentageText}>{progressPercent}%</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent >= 100 ? '#10B981' : '#F38820',
              },
            ]}
          />
        </View>

        {/* 2 cột Đã thu & Còn lại */}
        <View style={styles.statGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Đã thu</Text>
            <Text style={styles.statPaid}>{formatVND(totalPaid)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Còn lại</Text>
            <Text
              style={[
                styles.statRemaining,
                remaining > 0 && styles.statRemainingActive,
              ]}
            >
              {formatVND(remaining)}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Footer Card: Hạn thanh toán & Nút hành động */}
      <View style={styles.footerRow}>
        <View style={styles.dueDateCol}>
          {debt.milestone?.dueDate ? (
            <View style={styles.dueDateRow}>
              <Feather
                name="clock"
                size={12}
                color={isOverdue ? '#DC2626' : '#64748B'}
              />
              <Text
                style={[
                  styles.dueDateText,
                  isOverdue && styles.dueDateTextOverdue,
                ]}
              >
                Hạn thu: {formatDateToDDMMYYYY(debt.milestone.dueDate)}
              </Text>
            </View>
          ) : (
            <Text style={styles.dueDateMuted}>Chưa xác định hạn thu</Text>
          )}

          {debt.payments && debt.payments.length > 0 && (
            <Text style={styles.paymentsCountText}>
              Đã ghi nhận {debt.payments.length} lần thu
            </Text>
          )}
        </View>

        {/* Nút hành động */}
        <View style={styles.actionBtnGroup}>
          {isPending && canManage ? (
            <TouchableOpacity
              style={styles.activateBtn}
              onPress={handlePressActivate}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={13} color="#2563EB" />
              <Text style={styles.activateBtnText}>Kích hoạt nợ</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={handlePressCard}
              activeOpacity={0.7}
            >
              <Text style={styles.detailsBtnText}>Đối soát</Text>
              <Feather name="chevron-right" size={14} color="#EA580C" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 10,
  },
  cardContainerCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  cardContainerOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardContainerLocked: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleCompleted: {
    backgroundColor: '#DCFCE7',
  },
  iconCircleOverdue: {
    backgroundColor: '#FEE2E2',
  },
  iconCircleLocked: {
    backgroundColor: '#FEF3C7',
  },
  titleTextCol: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  contractCode: {
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
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bodyBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  totalAmountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  percentageBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  statPaid: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  statRemaining: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  statRemainingActive: {
    color: '#EA580C',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  dueDateCol: {
    flex: 1,
    gap: 2,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  dueDateTextOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  dueDateMuted: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  paymentsCountText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
});
