import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOpportunityQuotationsQuery } from '@/hooks/queries/useQuotations';
import { QuotationModal } from '@/components/quotations/QuotationModal';
import { QuotationDetailModal } from '@/components/quotations/QuotationDetailModal';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';
import { useAuthStore } from '@/stores/useAuthStore';

export interface OpportunityQuotationsTabProps {
  opportunityId: string;
  opportunityName?: string;
  onContractCreated?: (contractId: string) => void;
}

export const OpportunityQuotationsTab: React.FC<OpportunityQuotationsTabProps> = ({
  opportunityId,
  opportunityName,
  onContractCreated,
}) => {
  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || '').toUpperCase();
  const canCreateQuotation = ['ADMIN', 'DIRECTOR', 'SALE', 'MANAGER'].includes(userRole);

  const {
    data: quotations = [],
    isLoading,
    refetch,
  } = useOpportunityQuotationsQuery(opportunityId);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<any | null>(null);

  const handleOpenCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingQuotation(null);
    setCreateModalVisible(true);
  };

  const handleOpenDetail = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuotationId(id);
  };

  const handleEditFromDetail = (quotation: any) => {
    setEditingQuotation(quotation);
    setCreateModalVisible(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { text: 'Đã duyệt', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' };
      case 'PENDING_APPROVAL':
        return { text: 'Chờ duyệt', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
      case 'REJECTED':
        return { text: 'Bị từ chối', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
      default:
        return { text: 'Bản nháp', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Row & Action Button */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Feather name="file-text" size={16} color="#EA580C" />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              Danh sách báo giá ({quotations.length})
            </Text>
            <Text style={styles.headerSubtitle}>
              Quản lý các phiên bản báo giá gửi khách
            </Text>
          </View>
        </View>

        {canCreateQuotation && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleOpenCreate}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Lập báo giá</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Danh sách Quotations */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#F38820" />
          <Text style={styles.loadingText}>Đang tải danh sách báo giá...</Text>
        </View>
      ) : quotations.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="file-document-outline" size={36} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Chưa có báo giá nào cho cơ hội này</Text>
          <Text style={styles.emptyDesc}>
            Lập báo giá từ danh mục dịch vụ để gửi khách hàng và chuyển đổi thành hợp đồng sau khi duyệt.
          </Text>
          {canCreateQuotation && (
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={handleOpenCreate}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={15} color="#FFFFFF" />
              <Text style={styles.emptyCreateBtnText}>Lập báo giá đầu tiên</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {quotations.map((q: any) => {
            const badge = getStatusBadge(q.status);
            return (
              <TouchableOpacity
                key={q.id}
                style={styles.card}
                onPress={() => handleOpenDetail(q.id)}
                activeOpacity={0.75}
              >
                <View style={styles.cardTop}>
                  <View style={styles.versionCol}>
                    <Text style={styles.versionText}>Phiên bản v{q.version || 1}</Text>
                    <Text style={styles.dateText}>
                      Ngày tạo: {q.createdAt ? formatDateToDDMMYYYY(q.createdAt) : '—'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: badge.color }]}>
                      {badge.text}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.amountLabel}>Tổng giá trị báo giá:</Text>
                    <Text style={styles.amountValue}>{formatVND(q.totalAmount)}</Text>
                  </View>

                  <View style={styles.detailLinkRow}>
                    <Text style={styles.detailLinkText}>Xem chi tiết</Text>
                    <Feather name="chevron-right" size={14} color="#EA580C" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Modal Lập / Sửa Báo Giá */}
      <QuotationModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingQuotation(null);
        }}
        opportunityId={opportunityId}
        opportunityName={opportunityName}
        editQuotation={editingQuotation}
        onSuccess={() => refetch()}
      />

      {/* Modal Chi Tiết Báo Giá */}
      <QuotationDetailModal
        visible={Boolean(selectedQuotationId)}
        quotationId={selectedQuotationId}
        onClose={() => setSelectedQuotationId(null)}
        onEdit={handleEditFromDetail}
        onApprovedContract={(contractId) => {
          refetch();
          onContractCreated?.(contractId);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F38820',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  emptyDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F38820',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyCreateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  versionCol: {
    flex: 1,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#EA580C',
    marginTop: 1,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },
});
