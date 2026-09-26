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
import { useRouter } from 'expo-router';
import { useOpportunityQuotationsQuery } from '@/hooks/queries/useQuotations';
import { QuotationDetailModal } from '@/components/quotations/QuotationDetailModal';
import { formatVND, formatDateToDDMMYYYY } from '@/utils/formatters';
import { useAuthStore } from '@/stores/useAuthStore';

export interface OpportunityQuotationsTabProps {
  opportunityId: string;
  opportunityName?: string;
  opportunityDescription?: string;
  onContractCreated?: (contractId: string) => void;
}

export const OpportunityQuotationsTab: React.FC<OpportunityQuotationsTabProps> = ({
  opportunityId,
  opportunityName,
  opportunityDescription,
  onContractCreated,
}) => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || '').toUpperCase();
  const canCreateQuotation = ['ADMIN', 'DIRECTOR', 'SALE', 'MANAGER'].includes(userRole);

  const {
    data: quotations = [],
    isLoading,
    refetch,
  } = useOpportunityQuotationsQuery(opportunityId);

  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/opportunities/quotations/create',
      params: { opportunityId },
    });
  };

  const handleOpenDetail = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuotationId(id);
  };

  const handleEditFromDetail = (quotation: any) => {
    setSelectedQuotationId(null);
    router.push({
      pathname: '/opportunities/quotations/create',
      params: {
        opportunityId,
        quotationId: quotation.id,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { text: 'Đang đợi duyệt', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
      case 'SENT':
        return { text: 'Đã gửi', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
      case 'APPROVED':
        return { text: 'Đã duyệt', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' };
      case 'REJECTED':
        return { text: 'Từ chối', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
      case 'PENDING_APPROVAL':
        return { text: 'Đang đợi duyệt', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
      default:
        return { text: 'Đang đợi duyệt', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
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
          <View style={styles.titleTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Danh sách báo giá ({quotations.length})
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
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
                    <Text style={styles.versionText}>Báo giá lần {q.version || 1}</Text>
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

                {q.description && q.status === 'REJECTED' ? (
                  <View style={styles.rejectReasonBox}>
                    <Text style={styles.rejectReasonLabel}>Lý do từ chối:</Text>
                    <Text style={styles.rejectReasonText}>{q.description}</Text>
                  </View>
                ) : null}

                <View style={styles.cardDivider} />

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.amountLabel}>Tổng giá trị báo giá có thuế:</Text>
                    <Text style={styles.amountValue}>{formatVND(q.totalWithVat)}</Text>
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


      {/* Modal Chi Tiết Báo Giá */}
      <QuotationDetailModal
        visible={Boolean(selectedQuotationId)}
        quotationId={selectedQuotationId}
        opportunityDescription={opportunityDescription}
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
    minWidth: 0,
    marginRight: 8,
  },
  titleTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    lineHeight: 15,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F38820',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexShrink: 0,
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
  rejectReasonBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 2,
  },
  rejectReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectReasonText: {
    fontSize: 11,
    color: '#DC2626',
    lineHeight: 15,
  },
});
