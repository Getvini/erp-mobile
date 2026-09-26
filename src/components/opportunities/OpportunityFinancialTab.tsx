import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { OpportunityItem } from '@/services/opportunityService';
import { formatVND } from '@/utils/formatters';

export interface OpportunityFinancialTabProps {
  opportunity: OpportunityItem;
}

export const OpportunityFinancialTab: React.FC<OpportunityFinancialTabProps> = ({
  opportunity,
}) => {
  const packages = opportunity.packages || [];
  const services = opportunity.services || [];

  return (
    <View style={styles.container}>
      {/* 1. Tổng quan ngân sách & kỳ vọng */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Feather name="pie-chart" size={16} color="#EA580C" />
          </View>
          <Text style={styles.cardTitle}>Tổng quan tài chính dự toán</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Doanh thu kỳ vọng</Text>
            <Text style={styles.statRevenue}>{formatVND(opportunity.expectedRevenue)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Ngân sách tối đa</Text>
            <Text style={styles.statBudget}>{formatVND(opportunity.budget)}</Text>
          </View>
        </View>
      </View>

      {/* 2. Gói dịch vụ đã chọn (Packages) */}
      {packages.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="package-variant" size={16} color="#2563EB" />
            </View>
            <Text style={styles.cardTitle}>Gói dịch vụ đã chọn ({packages.length})</Text>
          </View>

          <View style={styles.itemsList}>
            {packages.map((pkg, idx) => (
              <View key={pkg.id || idx} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>x{pkg.quantity}</Text>
                  </View>
                </View>

                {pkg.services && pkg.services.length > 0 && (
                  <View style={styles.subServicesList}>
                    {pkg.services.map((sub, sIdx) => (
                      <View key={sub.id || sIdx} style={styles.subServiceRow}>
                        <Feather name="corner-down-right" size={11} color="#94A3B8" />
                        <Text style={styles.subServiceName} numberOfLines={1}>
                          {sub.service?.name || 'Dịch vụ trong gói'}
                        </Text>
                        <Text style={styles.subServiceQty}>
                          x{sub.quantity} {sub.unit || ''}
                        </Text>
                        {Boolean(sub.sellingPrice) && (
                          <Text style={styles.subServicePrice}>{formatVND(sub.sellingPrice)}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. Dịch vụ đơn lẻ đã chọn (Standalone Services) */}
      {services.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Feather name="layers" size={16} color="#16A34A" />
            </View>
            <Text style={styles.cardTitle}>Dịch vụ đơn lẻ ({services.length})</Text>
          </View>

          <View style={styles.itemsList}>
            {services.map((srv, idx) => (
              <View key={srv.id || idx} style={styles.serviceItemRow}>
                <View style={styles.serviceInfoCol}>
                  <Text style={styles.serviceName}>
                    {srv.serviceName || srv.service?.name || `Dịch vụ #${idx + 1}`}
                  </Text>
                  <Text style={styles.serviceUnit}>
                    Số lượng: {srv.quantity || 1} {srv.unit || srv.service?.unit || ''}
                  </Text>
                </View>

                {Boolean(srv.sellingPrice || srv.expectedRevenue) && (
                  <Text style={styles.servicePrice}>
                    {formatVND(srv.sellingPrice || srv.expectedRevenue)}
                  </Text>
                )}
              </View>
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statRevenue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#EA580C',
    marginTop: 2,
  },
  statBudget: {
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
  itemsList: {
    gap: 8,
  },
  packageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  quantityBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quantityText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  subServicesList: {
    gap: 4,
    paddingLeft: 4,
    marginTop: 4,
  },
  subServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subServiceName: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
  },
  subServiceQty: {
    fontSize: 11,
    color: '#94A3B8',
  },
  subServicePrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  serviceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  serviceUnit: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EA580C',
  },
});
