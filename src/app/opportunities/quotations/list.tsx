import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  QuotationItem,
  QuotationStatus,
} from '@/services/quotationService';
import { QuotationItemCard } from '@/components/opportunities/QuotationItemCard';
import { useOpportunityDetailQuery } from '@/hooks/queries/useOpportunities';
import {
  useOpportunityQuotationsQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
} from '@/hooks/queries/useQuotations';

export default function QuotationsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ opportunityId: string; opportunityName?: string }>();
  const opportunityId = params.opportunityId;

  const { user } = useAuth();
  const isAdminOrBod = user?.role === 'ADMIN' || user?.role === 'BOD';

  const {
    data: opportunity = null,
    isLoading: isOppLoading,
    isFetching: isOppFetching,
    refetch: refetchOpp,
  } = useOpportunityDetailQuery(opportunityId as string);

  const {
    data: rawQuotations = [],
    isLoading: isQuoteLoading,
    isFetching: isQuoteFetching,
    refetch: refetchQuotes,
  } = useOpportunityQuotationsQuery(opportunityId as string);

  const quotations: QuotationItem[] = Array.isArray(rawQuotations) ? rawQuotations : [];

  const approveQuotationMutation = useApproveQuotationMutation();
  const rejectQuotationMutation = useRejectQuotationMutation();

  const isLoading = (isOppLoading || isQuoteLoading) && !opportunity;
  const isRefreshing = isOppFetching || isQuoteFetching;

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const isSubmittingReject = rejectQuotationMutation.isPending;

  const refetchAll = useCallback(() => {
    refetchOpp();
    refetchQuotes();
  }, [refetchOpp, refetchQuotes]);

  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  const handleRefresh = () => refetchAll();

  const hasCustomer = !!(
    opportunity?.customer ||
    opportunity?.customerId ||
    opportunity?.leadName
  );

  const hasApprovedQuote =
    opportunity?.status === 'QUOTE_APPROVED' ||
    opportunity?.status === 'CONTRACT_CREATED' ||
    quotations.some(
      (q) =>
        q.status === QuotationStatus.APPROVED ||
        q.status === 'APPROVED' ||
        q.status === 'QUOTE_APPROVED'
    );

  const canCreateQuotation =
    !hasApprovedQuote &&
    hasCustomer &&
    opportunity &&
    (opportunity.status === 'QUOTATION_DRAFTING' ||
      opportunity.status === 'PENDING_QUOTE_APPROVAL' ||
      (opportunity.status === 'OPP_APPROVED' &&
        (user?.role === 'ADMIN' || (opportunity.createdBy as any)?.id === user?.id)));

  const handleCreateNew = () => {
    router.push({
      pathname: '/opportunities/quotations/create',
      params: { opportunityId },
    });
  };

  const handleSelectQuotation = (quote: QuotationItem) => {
    router.push({
      pathname: '/opportunities/quotations/[quotId]',
      params: { quotId: quote.id, opportunityId },
    });
  };

  const handleApprove = async (id: string) => {
    Alert.alert('Xác nhận duyệt', 'Bạn có chắc chắn muốn duyệt báo giá này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Duyệt',
        style: 'default',
        onPress: async () => {
          try {
            await approveQuotationMutation.mutateAsync(id);
            Alert.alert('Thành công', 'Đã duyệt báo giá thành công');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi duyệt báo giá');
          }
        },
      },
    ]);
  };

  const handleOpenReject = (id: string) => {
    setSelectedQuoteId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedQuoteId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await rejectQuotationMutation.mutateAsync({
        id: selectedQuoteId,
        reason: rejectReason.trim(),
      });
      setRejectModalVisible(false);
      Alert.alert('Thành công', 'Đã từ chối báo giá');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi từ chối báo giá');
    }
  };

  const handleEditQuotation = (quote: QuotationItem) => {
    router.push({
      pathname: '/opportunities/quotations/create',
      params: { opportunityId, quotationId: quote.id },
    });
  };

  const renderQuotationItem = ({ item }: { item: QuotationItem }) => {
    const isThisItemApproved =
      item.status === QuotationStatus.APPROVED || item.status === 'APPROVED';
    const isExpired = hasApprovedQuote && !isThisItemApproved;

    return (
      <QuotationItemCard
        item={item}
        isAdminOrBod={isAdminOrBod}
        isExpired={isExpired}
        onPress={handleSelectQuotation}
        onApprove={isExpired ? undefined : handleApprove}
        onReject={isExpired ? undefined : handleOpenReject}
        onEdit={isExpired ? undefined : handleEditQuotation}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
        <TouchableOpacity
          className="p-1.5 rounded-lg bg-[#F1F5F9]"
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View className="flex-1 mx-3">
          <Text className="text-base font-bold text-[#0F172A]">Danh sách báo giá</Text>
          <Text className="text-xs text-[#64748B] mt-0.5" numberOfLines={1}>
            {params.opportunityName || opportunity?.name || 'Cơ hội kinh doanh'}
          </Text>
        </View>

        {canCreateQuotation ? (
          <TouchableOpacity
            className="flex-row items-center gap-1 bg-[#059669] px-2.5 py-1.5 rounded-lg"
            onPress={handleCreateNew}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">Tạo mới</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-sm text-[#64748B]">Đang tải danh sách báo giá...</Text>
        </View>
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={(item) => item.id}
          renderItem={renderQuotationItem}
          contentContainerClassName="p-4 pb-8"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#059669']}
            />
          }
          ListHeaderComponent={
            <View className="mb-3">
              <View className="flex-row items-center gap-1.5 self-start bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#A7F3D0]">
                <Feather name="file-text" size={14} color="#059669" />
                <Text className="text-xs font-bold text-[#065F46]">{quotations.length} bản báo giá</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-full bg-[#F1F5F9] items-center justify-center mb-4">
                <Feather name="file-text" size={36} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-[#1E293B] mb-1.5">Chưa có bản báo giá nào</Text>
              <Text className="text-[13px] text-[#64748B] text-center mb-5">
                Chưa có báo giá nào được tạo cho cơ hội này.
              </Text>
              {canCreateQuotation && (
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-[#059669] px-4.5 py-2.5 rounded-xl"
                  onPress={handleCreateNew}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Tạo báo giá đầu tiên</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Reject Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-5">
          <View className="w-full bg-white rounded-2xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-[#0F172A]">Từ chối báo giá</Text>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[13px] font-semibold text-[#334155] mb-2">Lý do từ chối (bắt buộc):</Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3 text-sm text-[#0F172A] min-h-[100px] mb-5"
              placeholder="Nhập lý do cần chỉnh sửa / từ chối..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View className="flex-row justify-end gap-2.5">
              <TouchableOpacity
                className="px-4 py-2.5 rounded-lg bg-[#F1F5F9]"
                onPress={() => setRejectModalVisible(false)}
                disabled={isSubmittingReject}
              >
                <Text className="text-sm font-semibold text-[#64748B]">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={'px-4 py-2.5 rounded-lg bg-[#DC2626] ' + (isSubmittingReject ? 'opacity-60' : '')}
                onPress={handleConfirmReject}
                disabled={isSubmittingReject}
              >
                {isSubmittingReject ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
