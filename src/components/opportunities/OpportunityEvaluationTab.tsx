import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { OpportunityItem } from '@/services/opportunityService';
import { formatVND } from '@/utils/formatters';

export interface OpportunityEvaluationTabProps {
  opportunity: OpportunityItem;
}

export const OpportunityEvaluationTab: React.FC<OpportunityEvaluationTabProps> = ({
  opportunity,
}) => {
  const chance = Number(opportunity.successChance || 0);
  const revenue = Number(opportunity.expectedRevenue || 0);
  const budget = Number(opportunity.budget || 0);
  const priority = opportunity.priority || 'MEDIUM';

  const getPriorityConfig = (p: string) => {
    switch (p.toUpperCase()) {
      case 'URGENT':
      case 'HIGH':
        return { text: 'Cao / Khẩn cấp', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' };
      case 'LOW':
        return { text: 'Thấp', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' };
      default:
        return { text: 'Trung bình', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' };
    }
  };

  const priorityConfig = getPriorityConfig(priority);

  return (
    <View style={styles.container}>
      {/* 1. Đánh giá tiềm năng & Xác suất chốt */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="target" size={18} color="#EA580C" />
          </View>
          <Text style={styles.cardTitle}>Xác suất chốt thành công</Text>
        </View>

        <View style={styles.chanceRow}>
          <Text style={styles.chanceValue}>{chance}%</Text>
          <View style={styles.chanceBarTrack}>
            <View
              style={[
                styles.chanceBarFill,
                {
                  width: `${Math.min(100, Math.max(0, chance))}%`,
                  backgroundColor: chance >= 70 ? '#10B981' : chance >= 40 ? '#F38820' : '#EF4444',
                },
              ]}
            />
          </View>
        </View>
        <Text style={styles.chanceHint}>
          {chance >= 70
            ? 'Cơ hội rất tiềm năng, khả năng ký hợp đồng cao.'
            : chance >= 40
            ? 'Cơ hội trung bình, cần bám sát nhu cầu khách hàng.'
            : 'Xác suất thấp, cần thêm thông tin hoặc tư vấn kỹ hơn.'}
        </Text>
      </View>

      {/* 2. Độ ưu tiên & Lĩnh vực */}
      <View style={styles.gridRow}>
        <View style={[styles.card, styles.gridCol]}>
          <Text style={styles.label}>Mức độ ưu tiên</Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityConfig.bg, borderColor: priorityConfig.border },
            ]}
          >
            <Text style={[styles.priorityBadgeText, { color: priorityConfig.color }]}>
              {priorityConfig.text}
            </Text>
          </View>
        </View>

        <View style={[styles.card, styles.gridCol]}>
          <Text style={styles.label}>Lĩnh vực kinh doanh</Text>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {opportunity.field || 'Chưa phân loại'}
          </Text>
        </View>
      </View>

      {/* 3. Ngân sách & Doanh thu dự kiến */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="dollar-sign" size={16} color="#2563EB" />
          </View>
          <Text style={styles.cardTitle}>Dự toán tài chính cơ hội</Text>
        </View>

        <View style={styles.financeStatsRow}>
          <View style={styles.financeCol}>
            <Text style={styles.statLabel}>Doanh thu kỳ vọng</Text>
            <Text style={styles.revenueText}>{formatVND(revenue)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.financeCol}>
            <Text style={styles.statLabel}>Ngân sách khách hàng</Text>
            <Text style={styles.budgetText}>{formatVND(budget)}</Text>
          </View>
        </View>

        {budget > 0 && revenue > 0 && (
          <View style={styles.diffRow}>
            <Feather
              name={revenue <= budget ? 'check-circle' : 'alert-circle'}
              size={13}
              color={revenue <= budget ? '#16A34A' : '#D97706'}
            />
            <Text style={styles.diffText}>
              {revenue <= budget
                ? 'Doanh thu kỳ vọng nằm trong khung ngân sách khách hàng.'
                : `Vượt ngân sách dự kiến của khách ${formatVND(revenue - budget)}.`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  chanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chanceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    width: 60,
  },
  chanceBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chanceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  chanceHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  financeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  financeCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  revenueText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#EA580C',
    marginTop: 2,
  },
  budgetText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  diffText: {
    fontSize: 11,
    color: '#64748B',
  },
});
