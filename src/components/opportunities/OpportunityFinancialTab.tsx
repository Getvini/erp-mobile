import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { OpportunityItem, getServiceTheme } from '@/services/opportunityService';
import { formatVND } from '@/utils/formatters';
import { ServiceJobAccordion } from './ServiceJobAccordion';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import ReworkTaskModal from '@/components/tasks/ReworkTaskModal';
import { useAuth } from '@/context/AuthContext';
import { useApproveByCustomerMutation, useCustomerNotPurchaseMutation } from '@/hooks/queries/useTasks';
import { queryKeys } from '@/services/queryKeys';

export interface OpportunityFinancialTabProps {
  opportunity: OpportunityItem;
}

export const OpportunityFinancialTab: React.FC<OpportunityFinancialTabProps> = ({
  opportunity,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const packages = opportunity.packages || [];
  const services = opportunity.services || [];

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [reworkTask, setReworkTask] = useState<any | null>(null);

  const approveMutation = useApproveByCustomerMutation();
  const rejectMutation = useCustomerNotPurchaseMutation();

  const isSalesOwner =
    ['BD', 'ADMIN_SALE'].includes(user?.role || '') &&
    (user?.id === (opportunity as any).createdBy?.id || user?.id === (opportunity as any).creator?.id);
  const canHandleDemo = isSalesOwner || ['ADMIN', 'BOD'].includes(user?.role || '');

  const handleApprove = async (taskId: string) => {
    try {
      await approveMutation.mutateAsync({ taskId, projectId: opportunity.id });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(opportunity.id) });
      Alert.alert('Thành công', 'Đã ghi nhận khách hàng duyệt mua.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể ghi nhận quyết định duyệt.');
    }
  };

  const handleReject = (taskId: string) => {
    Alert.alert('Xác nhận', 'Xác nhận khách hàng không mua video AI demo này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Không mua',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectMutation.mutateAsync({ id: taskId, projectId: opportunity.id });
            queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(opportunity.id) });
            Alert.alert('Thành công', 'Đã ghi nhận khách hàng không mua.');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể ghi nhận quyết định.');
          }
        },
      },
    ]);
  };

  const handleReworkSuccess = () => {
    setReworkTask(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(opportunity.id) });
    Alert.alert('Thành công', 'Đã gửi yêu cầu làm lại video AI demo.');
  };

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
                    {pkg.services.map((sub, sIdx) => {
                      const serviceName = sub.service?.name || 'Dịch vụ trong gói';
                      const theme = getServiceTheme(serviceName);
                      return (
                        <View key={sub.id || sIdx} style={styles.subServiceItemContainer}>
                          <View style={styles.subServiceRow}>
                            <View
                              style={[
                                styles.serviceDot,
                                { backgroundColor: theme.bg, borderColor: theme.border },
                              ]}
                            >
                              <Feather name="box" size={10} color={theme.color} />
                            </View>
                            <Text style={styles.subServiceName} numberOfLines={1}>
                              {serviceName}
                            </Text>
                            <Text style={styles.subServiceQty}>
                              x{sub.quantity} {sub.unit || ''}
                            </Text>
                            {Boolean(sub.sellingPrice) && (
                              <Text style={styles.subServicePrice}>{formatVND(sub.sellingPrice)}</Text>
                            )}
                          </View>

                          <ServiceJobAccordion
                            jobs={sub.jobs}
                            mode="opportunity_view"
                            canHandleDemo={canHandleDemo}
                            onPreviewVideo={(url, name) => {
                              setPreviewUrl(url);
                              setPreviewTitle(name || serviceName);
                            }}
                            onApproveDemo={handleApprove}
                            onRejectDemo={handleReject}
                            onRequestRework={(task) => setReworkTask(task)}
                            isApprovingDemo={approveMutation.isPending}
                            isRejectingDemo={rejectMutation.isPending}
                          />
                        </View>
                      );
                    })}
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
            {services.map((srv, idx) => {
              const name = srv.serviceName || srv.service?.name || `Dịch vụ #${idx + 1}`;
              const theme = getServiceTheme(name);
              return (
                <View key={srv.id || idx} style={styles.standaloneServiceCard}>
                  <View style={styles.serviceItemRow}>
                    <View
                      style={[
                        styles.serviceIconContainer,
                        { backgroundColor: theme.bg, borderColor: theme.border },
                      ]}
                    >
                      <Feather name="layers" size={15} color={theme.color} />
                    </View>
                    <View style={styles.serviceInfoCol}>
                      <Text style={styles.serviceName}>{name}</Text>
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

                  <ServiceJobAccordion
                    jobs={srv.jobs}
                    mode="opportunity_view"
                    canHandleDemo={canHandleDemo}
                    onPreviewVideo={(url, title) => {
                      setPreviewUrl(url);
                      setPreviewTitle(title || name);
                    }}
                    onApproveDemo={handleApprove}
                    onRejectDemo={handleReject}
                    onRequestRework={(task) => setReworkTask(task)}
                    isApprovingDemo={approveMutation.isPending}
                    isRejectingDemo={rejectMutation.isPending}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Video Preview Modal */}
      {previewUrl ? (
        <DocumentPreviewModal
          visible={Boolean(previewUrl)}
          url={previewUrl}
          fileName={previewTitle}
          onClose={() => setPreviewUrl('')}
        />
      ) : null}

      {/* Rework Modal */}
      {reworkTask ? (
        <ReworkTaskModal
          visible={Boolean(reworkTask)}
          task={reworkTask}
          onClose={() => setReworkTask(null)}
          onSuccess={handleReworkSuccess}
        />
      ) : null}
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
    gap: 8,
    paddingLeft: 4,
    marginTop: 4,
  },
  subServiceItemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 8,
  },
  subServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceDot: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subServiceName: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
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
  standaloneServiceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  serviceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  serviceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
