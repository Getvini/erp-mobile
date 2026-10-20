import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { formatVND } from '@/utils/formatters';
import { BrandColors } from '@/constants/colors';

export interface ServiceBudgetBoxProps {
  budgetInfo?: any;
  isLoading?: boolean;
  amount?: number | string;
  overBudgetReason?: string;
  setOverBudgetReason?: (reason: string) => void;
  readOnly?: boolean;
  isInSection?: boolean;
}

export const ServiceBudgetBox: React.FC<ServiceBudgetBoxProps> = ({
  budgetInfo,
  isLoading = false,
  amount = 0,
  overBudgetReason = '',
  setOverBudgetReason,
  readOnly = false,
  isInSection = false,
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BrandColors.primary} />
        <Text style={styles.loadingText}>Đang kiểm tra dữ liệu ngân sách dịch vụ dự án...</Text>
      </View>
    );
  }

  if (!budgetInfo || !budgetInfo.hasService) {
    return (
      <View style={styles.container}>
        <View style={styles.noServiceCard}>
          <Feather name="help-circle" size={16} color="#94A3B8" />
          <Text style={styles.noServiceText}>
            Công việc này chưa liên kết với dịch vụ hợp đồng dự án (không kiểm soát hạn mức).
          </Text>
        </View>
        {Boolean(overBudgetReason) && (
          <View style={styles.reasonCardDanger}>
            <View style={styles.reasonHeader}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.reasonTitleDanger}>Lý do chi vượt ngân sách (Người tạo giải trình):</Text>
            </View>
            <Text style={styles.reasonContentDanger}>{overBudgetReason}</Text>
          </View>
        )}
      </View>
    );
  }

  const {
    serviceName,
    itemServiceName,
    hasItemBudget,
    itemBudget = 0,
    itemSpent = 0,
    remainingItemBudget = 0,
    hasTotalServiceBudget,
    totalServiceBudget = 0,
    totalServiceSpent = 0,
    remainingTotalServiceBudget = 0,
  } = budgetInfo;

  const numAmount = Number(amount) || 0;

  // Kiểm tra 2 tầng có giống hệt nhau không
  const isSameBudgetTier = Boolean(
    hasItemBudget &&
      hasTotalServiceBudget &&
      itemBudget === totalServiceBudget &&
      itemSpent === totalServiceSpent &&
      remainingItemBudget === remainingTotalServiceBudget
  );
  const isSingleTier = !hasTotalServiceBudget || !hasItemBudget || isSameBudgetTier;

  let level = 1;
  let statusText = '';
  let levelTone: 'safe' | 'warning' | 'danger' | 'neutral' = 'safe';

  if (!hasTotalServiceBudget && !hasItemBudget) {
    level = 0;
    levelTone = 'neutral';
    statusText = 'Dịch vụ chưa thiết lập hạn mức ngân sách trong hợp đồng (Không giới hạn).';
  } else if (hasTotalServiceBudget && remainingTotalServiceBudget <= 0) {
    level = 3;
    levelTone = 'danger';
    const overTotal = numAmount + Math.abs(remainingTotalServiceBudget);
    statusText = `VƯỢT TOÀN BỘ NGÂN SÁCH DỊCH VỤ DỰ ÁN ${formatVND(overTotal)} (Quỹ tổng dự án đã hết hoặc âm). Bắt buộc nhập lý do giải trình.`;
  } else if (hasTotalServiceBudget && remainingTotalServiceBudget > 0) {
    if (numAmount > remainingTotalServiceBudget) {
      level = 3;
      levelTone = 'danger';
      const overTotal = numAmount - remainingTotalServiceBudget;
      statusText = `VƯỢT TOÀN BỘ NGÂN SÁCH DỊCH VỤ DỰ ÁN ${formatVND(overTotal)}. Bắt buộc nhập lý do giải trình.`;
    } else if (hasItemBudget && numAmount > remainingItemBudget) {
      level = 2;
      levelTone = 'warning';
      const overItem = numAmount - remainingItemBudget;
      const leftInTotal = remainingTotalServiceBudget - numAmount;
      statusText = `Vượt hạn mức hạng mục này ${formatVND(overItem)}, nhưng tổng dự án vẫn còn dư ${formatVND(leftInTotal)} (Có thể điều chuyển bù trừ nội bộ).`;
    } else {
      level = 1;
      levelTone = 'safe';
      statusText =
        numAmount > 0
          ? 'Khoản chi nằm trong hạn mức an toàn của hạng mục và tổng dịch vụ dự án.'
          : 'Hạn mức ngân sách khả dụng an toàn.';
    }
  } else if (hasItemBudget) {
    if (numAmount > remainingItemBudget) {
      level = 2;
      levelTone = 'warning';
      statusText = `Vượt hạn mức hạng mục này ${formatVND(numAmount - remainingItemBudget)}.`;
    } else {
      level = 1;
      levelTone = 'safe';
      statusText = 'Nằm trong hạn mức hạng mục này.';
    }
  }

  const toneColor =
    levelTone === 'danger'
      ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', iconColor: '#DC2626' }
      : levelTone === 'warning'
      ? { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', iconColor: '#D97706' }
      : levelTone === 'safe'
      ? { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', iconColor: '#16A34A' }
      : { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', iconColor: '#64748B' };

  return (
    <View
      style={[
        styles.boxContainer,
        !isInSection && styles.boxCardStyle,
      ]}
    >
      {/* Header */}
      {!isInSection && (
        <View style={styles.boxHeader}>
          <View style={styles.boxHeaderTitle}>
            <MaterialIcons name="layers" size={16} color={BrandColors.primary} />
            <Text style={styles.boxHeaderTitleText}>Đối soát ngân sách dịch vụ 2 tầng</Text>
          </View>
          <Text style={styles.boxHeaderSubText} numberOfLines={1}>
            {serviceName || 'Chung'}
          </Text>
        </View>
      )}

      {/* Hiển thị bảng số liệu */}
      {isSingleTier ? (
        <View style={styles.tierCard}>
          <View style={styles.tierHeaderRow}>
            <Text style={styles.tierServiceTitle} numberOfLines={1}>
              Dịch vụ: <Text style={{ color: BrandColors.primary }}>{serviceName || itemServiceName || 'Chung'}</Text>
            </Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>
                {isSameBudgetTier
                  ? 'Toàn dự án'
                  : hasItemBudget
                  ? 'Hạng mục'
                  : 'Tổng quỹ dịch vụ'}
              </Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Hạn mức</Text>
              <Text style={styles.metricValue}>
                {formatVND(hasItemBudget ? itemBudget : totalServiceBudget)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Đã cam kết</Text>
              <Text style={styles.metricValue}>
                {formatVND(hasItemBudget ? itemSpent : totalServiceSpent)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Còn khả dụng</Text>
              {(() => {
                const rem = hasTotalServiceBudget ? remainingTotalServiceBudget : remainingItemBudget;
                return (
                  <Text
                    style={[
                      styles.metricValue,
                      { color: rem < 0 ? '#DC2626' : '#16A34A', fontWeight: '800' },
                    ]}
                  >
                    {rem < 0 ? `-${formatVND(Math.abs(rem))}` : formatVND(rem)}
                  </Text>
                );
              })()}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.multiTierContainer}>
          {/* Tầng 1 */}
          <View style={styles.multiTierCard}>
            <Text style={styles.multiTierTitle} numberOfLines={1}>
              Tầng 1: {itemServiceName || 'Hạng mục'}
            </Text>
            {hasItemBudget ? (
              <View style={styles.multiTierContent}>
                <View style={styles.multiTierRow}>
                  <Text style={styles.multiTierLabel}>Hạn mức:</Text>
                  <Text style={styles.multiTierVal}>{formatVND(itemBudget)}</Text>
                </View>
                <View style={styles.multiTierRow}>
                  <Text style={styles.multiTierLabel}>Đã chi:</Text>
                  <Text style={styles.multiTierVal}>{formatVND(itemSpent)}</Text>
                </View>
                <View style={[styles.multiTierRow, styles.multiTierDivider]}>
                  <Text style={styles.multiTierLabel}>Còn lại:</Text>
                  <Text
                    style={[
                      styles.multiTierVal,
                      { color: remainingItemBudget < 0 ? '#DC2626' : '#16A34A', fontWeight: '700' },
                    ]}
                  >
                    {remainingItemBudget < 0 ? `-${formatVND(Math.abs(remainingItemBudget))}` : formatVND(remainingItemBudget)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyTierText}>Chưa đặt hạn mức riêng</Text>
            )}
          </View>

          {/* Tầng 2 */}
          <View style={styles.multiTierCard}>
            <Text style={styles.multiTierTitle} numberOfLines={1}>
              Tầng 2: Tổng dự án
            </Text>
            {hasTotalServiceBudget ? (
              <View style={styles.multiTierContent}>
                <View style={styles.multiTierRow}>
                  <Text style={styles.multiTierLabel}>Tổng ngân sách:</Text>
                  <Text style={styles.multiTierVal}>{formatVND(totalServiceBudget)}</Text>
                </View>
                <View style={styles.multiTierRow}>
                  <Text style={styles.multiTierLabel}>Đã cam kết:</Text>
                  <Text style={styles.multiTierVal}>{formatVND(totalServiceSpent)}</Text>
                </View>
                <View style={[styles.multiTierRow, styles.multiTierDivider]}>
                  <Text style={styles.multiTierLabel}>Còn lại dự án:</Text>
                  <Text
                    style={[
                      styles.multiTierVal,
                      { color: remainingTotalServiceBudget < 0 ? '#DC2626' : '#16A34A', fontWeight: '700' },
                    ]}
                  >
                    {remainingTotalServiceBudget < 0 ? `-${formatVND(Math.abs(remainingTotalServiceBudget))}` : formatVND(remainingTotalServiceBudget)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyTierText}>Không giới hạn tổng HĐ</Text>
            )}
          </View>
        </View>
      )}

      {/* Thông báo tác động */}
      <View
        style={[
          styles.statusBanner,
          { backgroundColor: toneColor.bg, borderColor: toneColor.border },
        ]}
      >
        <Feather
          name={
            levelTone === 'danger'
              ? 'alert-triangle'
              : levelTone === 'warning'
              ? 'alert-circle'
              : levelTone === 'safe'
              ? 'check-circle'
              : 'info'
          }
          size={16}
          color={toneColor.iconColor}
          style={{ marginTop: 2 }}
        />
        <Text style={[styles.statusBannerText, { color: toneColor.text }]}>{statusText}</Text>
      </View>

      {/* Ô nhập lý do giải trình khi vượt ngân sách */}
      {readOnly ? (
        Boolean(overBudgetReason) && (
          <View style={styles.reasonCardDanger}>
            <View style={styles.reasonHeader}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.reasonTitleDanger}>Lý do chi vượt ngân sách (Người tạo giải trình):</Text>
            </View>
            <Text style={styles.reasonContentDanger}>{overBudgetReason}</Text>
          </View>
        )
      ) : (
        (level === 3 || level === 2) && (
          <View style={styles.reasonInputContainer}>
            <Text style={styles.reasonInputLabel}>
              Lý do chi vượt ngân sách{' '}
              {level === 3 ? (
                <Text style={{ color: '#DC2626', fontWeight: '800' }}>* (Bắt buộc giải trình cho BOD)</Text>
              ) : (
                <Text style={{ color: '#64748B', fontWeight: '400' }}>(Tùy chọn giải trình)</Text>
              )}
            </Text>
            <TextInput
              value={overBudgetReason}
              onChangeText={(txt) => setOverBudgetReason?.(txt)}
              placeholder="Nêu rõ lý do phát sinh chi phí vượt dự toán dịch vụ dự án..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              style={styles.reasonTextInput}
            />
          </View>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '500',
  },
  container: {
    gap: 8,
  },
  noServiceCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noServiceText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
  boxContainer: {
    gap: 10,
  },
  boxCardStyle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  boxHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxHeaderTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  boxHeaderSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    maxWidth: '40%',
  },
  tierCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierServiceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  tierBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  multiTierContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  multiTierCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 6,
  },
  multiTierTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  multiTierContent: {
    gap: 3,
  },
  multiTierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  multiTierDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 4,
    marginTop: 2,
  },
  multiTierLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  multiTierVal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyTierText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  reasonCardDanger: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    gap: 6,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonTitleDanger: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  reasonContentDanger: {
    fontSize: 12,
    color: '#7F1D1D',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    lineHeight: 16,
  },
  reasonInputContainer: {
    gap: 6,
  },
  reasonInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  reasonTextInput: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
