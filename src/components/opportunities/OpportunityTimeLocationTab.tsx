import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OpportunityItem } from '@/services/opportunityService';
import { formatDateToDDMMYYYY } from '@/utils/formatters';

export interface OpportunityTimeLocationTabProps {
  opportunity: OpportunityItem;
}

export const OpportunityTimeLocationTab: React.FC<OpportunityTimeLocationTabProps> = ({
  opportunity,
}) => {
  const regions = Array.isArray(opportunity.region)
    ? opportunity.region
    : typeof opportunity.region === 'string' && opportunity.region
    ? [opportunity.region]
    : [];

  const attachments = opportunity.attachments || [];

  return (
    <View style={styles.container}>
      {/* 1. Card Thời gian triển khai */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Feather name="calendar" size={16} color="#EA580C" />
          </View>
          <Text style={styles.cardTitle}>Thời gian & Tiến độ dự kiến</Text>
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Ngày bắt đầu</Text>
            <Text style={styles.dateValue}>
              {opportunity.startDate ? formatDateToDDMMYYYY(opportunity.startDate) : 'Chưa đặt'}
            </Text>
          </View>
          <Feather name="arrow-right" size={14} color="#94A3B8" style={{ marginTop: 16 }} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Ngày kết thúc</Text>
            <Text style={styles.dateValue}>
              {opportunity.endDate ? formatDateToDDMMYYYY(opportunity.endDate) : 'Chưa đặt'}
            </Text>
          </View>
        </View>

        {opportunity.durationMonths ? (
          <View style={styles.durationBadge}>
            <Feather name="clock" size={12} color="#2563EB" />
            <Text style={styles.durationText}>
              Thời lượng dự kiến: {opportunity.durationMonths} tháng
            </Text>
          </View>
        ) : null}
      </View>

      {/* 2. Card Địa điểm / Khu vực triển khai */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Feather name="map-pin" size={16} color="#16A34A" />
          </View>
          <Text style={styles.cardTitle}>Khu vực / Địa điểm</Text>
        </View>

        {regions.length > 0 ? (
          <View style={styles.regionsWrap}>
            {regions.map((reg, idx) => (
              <View key={idx} style={styles.regionChip}>
                <Feather name="check" size={11} color="#16A34A" />
                <Text style={styles.regionChipText}>{reg}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Chưa chỉ định khu vực cụ thể</Text>
        )}
      </View>

      {/* 3. Card Yêu cầu của khách hàng */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
            <Feather name="file-text" size={16} color="#9333EA" />
          </View>
          <Text style={styles.cardTitle}>Yêu cầu chi tiết từ khách hàng</Text>
        </View>

        <Text style={styles.requirementsText}>
          {opportunity.customerRequirements ||
            opportunity.description ||
            'Chưa có ghi chú yêu cầu cụ thể.'}
        </Text>
      </View>

      {/* 4. Tài liệu & Liên kết đính kèm */}
      {attachments.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Feather name="paperclip" size={16} color="#2563EB" />
            </View>
            <Text style={styles.cardTitle}>Tài liệu đính kèm ({attachments.length})</Text>
          </View>

          <View style={styles.attachmentsList}>
            {attachments.map((att, idx) => (
              <TouchableOpacity
                key={att.id || idx}
                style={styles.attachmentItem}
                onPress={() => att.url && Linking.openURL(att.url)}
                activeOpacity={0.7}
              >
                <Feather
                  name={att.type === 'LINK' ? 'link' : 'file'}
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {att.name || att.url}
                </Text>
                <Feather name="external-link" size={12} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
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
    marginBottom: 12,
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
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  regionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  requirementsText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
