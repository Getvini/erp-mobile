import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { canAccessOpportunities, isManagementRole } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import {
  opportunityService,
  OpportunityItem,
  FIELD_LABELS,
} from '@/services/opportunityService';
import {
  quotationService,
  QuotationItem,
  QuotationStatus,
} from '@/services/quotationService';
import { safeGoBack } from '@/utils/navigation';
import {
  contractService,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_STATUS_LABELS,
} from '@/services/contractService';
import { customerService } from '@/services/customerService';
import {
  CustomerInfoCard,
  CustomerAssignModal,
  CustomerAssignData,
  QuotationItemCard,
  OpportunityEvaluationTab,
  OpportunityFinancialTab,
  OpportunityTimeLocationTab,
  OpportunityQuotationsTab,
  OpportunityBottomActionBar,
} from '@/components/opportunities';
import { formatVNDFull, formatNumber } from '@/utils/formatters';
import { DocumentCard } from '@/components/common/DocumentCard';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import {
  useOpportunityDetailQuery,
  useApproveOpportunityMutation,
  useRejectOpportunityMutation,
  useResubmitOpportunityMutation,
  useUpdateOpportunityMutation,
  useAddCustomerToOpportunityMutation,
} from '@/hooks/queries/useOpportunities';
import {
  useOpportunityQuotationsQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
} from '@/hooks/queries/useQuotations';
import { useCreateContractMutation } from '@/hooks/queries/useContracts';
import { useUpdateCustomerMutation } from '@/hooks/queries/useCustomers';
import {
  getIncompleteAiJobs,
  canCreateQuotationFromOpportunity,
} from '@/utils/opportunityAiJobValidation';
import { validateQuotationRejection } from '@/utils/quotationRejectionValidation';

// Dictionary mapping for Region and Priority
const REGION_LABELS: Record<string, string> = {
  NATIONAL: 'Toàn quốc',
  NORTH: 'Miền Bắc',
  CENTRAL: 'Miền Trung',
  SOUTH: 'Miền Nam',
};

const PRIORITY_LABELS: Record<string, string> = {
  High: 'Cao',
  HIGH: 'Cao',
  Medium: 'Trung bình',
  MEDIUM: 'Trung bình',
  Low: 'Thấp',
  LOW: 'Thấp',
  URGENT: 'Khẩn cấp',
  Urgent: 'Khẩn cấp',
};

const PRIORITY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: '#FFF1F2', text: '#E11D48', border: '#FFE4E6' },
  HIGH: { bg: '#FFF1F2', text: '#E11D48', border: '#FFE4E6' },
  Medium: { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  MEDIUM: { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  Low: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  LOW: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  URGENT: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
  Urgent: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Chưa xác định';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    data: opportunity = null,
    isLoading: isOppLoading,
    isFetching: isOppFetching,
    refetch: refetchOpp,
  } = useOpportunityDetailQuery(id as string);

  const {
    data: rawQuotations = [],
    isLoading: isQuoteLoading,
    isFetching: isQuoteFetching,
    refetch: refetchQuotes,
  } = useOpportunityQuotationsQuery(id as string);

  const quotations: QuotationItem[] = Array.isArray(rawQuotations) ? rawQuotations : [];

  const updateOpportunityMutation = useUpdateOpportunityMutation();
  const addCustomerToOpportunityMutation = useAddCustomerToOpportunityMutation();
  const approveOpportunityMutation = useApproveOpportunityMutation();
  const rejectOpportunityMutation = useRejectOpportunityMutation();
  const resubmitOpportunityMutation = useResubmitOpportunityMutation();
  const createContractMutation = useCreateContractMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();
  const approveQuotationMutation = useApproveQuotationMutation();
  const rejectQuotationMutation = useRejectQuotationMutation();

  const isApproving = approveOpportunityMutation.isPending;
  const isRejecting = rejectOpportunityMutation.isPending;
  const isResubmitting = resubmitOpportunityMutation.isPending;
  const isCreatingContract = createContractMutation.isPending;

  // Tab Segment State
  const [activeTab, setActiveTab] = useState<'EVALUATION' | 'FINANCIAL' | 'TIMELINE' | 'QUOTATIONS'>('EVALUATION');

  // Customer Assign Modal State
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Quote Reject Modal State
  const [isRejectQuoteModalVisible, setIsRejectQuoteModalVisible] = useState(false);
  const [rejectQuoteId, setRejectQuoteId] = useState<string | null>(null);
  const [rejectQuoteReason, setRejectQuoteReason] = useState('');

  // Document Preview Modal State
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const handleOpenPreview = (url: string, fileName?: string) => {
    setPreviewUrl(url);
    setPreviewFileName(fileName || '');
    setIsPreviewVisible(true);
  };

  const handlePromptCreateContract = () => {
    if (!opportunity) return;
    const defaultName = opportunity.name
      ? `Hợp đồng ${opportunity.name}`
      : `Hợp đồng ${opportunity.opportunityCode}`;

    Alert.alert(
      'Xác nhận tạo hợp đồng',
      `Hệ thống sẽ tạo hợp đồng mới dựa trên thông tin và báo giá đã duyệt của cơ hội "${opportunity.name}". Bạn có chắc chắn muốn tạo?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạo hợp đồng',
          onPress: async () => {
            try {
              const newContract = await createContractMutation.mutateAsync({
                opportunityId: id as string,
                name: defaultName,
              });

              if (newContract) {
                Alert.alert('Thành công', 'Đã tạo hợp đồng kinh tế thành công!', [
                  {
                    text: 'Xem chi tiết hợp đồng',
                    onPress: () => {
                      if (newContract?.id) {
                        router.push({
                          pathname: '/contracts/[id]',
                          params: { id: newContract.id },
                        } as any);
                      }
                    },
                  },
                  {
                    text: 'Đóng',
                    style: 'cancel',
                  },
                ]);
                refetchAll();
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi tạo hợp đồng.');
            }
          },
        },
      ]
    );
  };

  const isAdminOrBod = isManagementRole(user?.role);
  const hasAccess = canAccessOpportunities(user?.role);

  const refetchAll = useCallback(() => {
    refetchOpp();
    refetchQuotes();
  }, [refetchOpp, refetchQuotes]);

  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  const isLoading = (isOppLoading || isQuoteLoading) && !opportunity;
  const isRefreshing = isOppFetching || isQuoteFetching;

  const handleRefresh = () => {
    refetchAll();
  };

  // Save Customer Handler (From CustomerAssignModal)
  const handleSaveCustomer = async (data: CustomerAssignData) => {
    if (!id) return;
    const backendSource = data.customerType === 'REFERRAL' ? 'REFERRAL_PARTNER' : 'INTERNAL';
    const updatePayload: any = {
      customerType: data.customerType,
      source: backendSource,
    };

    if (data.customerStatus === 'EXISTING') {
      if (!data.selectedCustomerId) {
        Alert.alert('Lỗi', 'Vui lòng chọn khách hàng');
        return;
      }
      await addCustomerToOpportunityMutation.mutateAsync({
        id,
        customerId: data.selectedCustomerId,
        customerType: data.customerType,
        referralPartnerId:
          data.customerType === 'REFERRAL' ? data.selectedReferralPartnerId : null,
      });
    } else {
      updatePayload.customerId = null;
      updatePayload.leadName = data.leadName;
      updatePayload.leadPhone = data.leadPhone;
      updatePayload.leadEmail = data.leadEmail;
      updatePayload.leadTaxId = data.leadTaxId;
      updatePayload.leadAddress = data.leadAddress;
      updatePayload.referralPartnerId =
        data.customerType === 'REFERRAL' ? data.selectedReferralPartnerId : null;
      await updateOpportunityMutation.mutateAsync({ id, payload: updatePayload });
    }

    Alert.alert('Thành công', 'Thông tin khách hàng đã được lưu thành công!');
  };

  // Inline Edit Customer Handler (chuẩn Web CustomerInfo.jsx)
  const handleSaveEditCustomer = async (data: {
    name?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
  }) => {
    if (!id || !opportunity) return;

    if (opportunity.customer) {
      // KH hiện hữu: cập nhật qua TanStack Mutation
      await updateCustomerMutation.mutateAsync({
        id: opportunity.customer.id,
        payload: {
          phoneNumber: data.phone,
          email: data.email,
          taxId: data.taxId,
          address: data.address,
        } as any,
      });
      refetchAll();
    } else {
      // Lead (tiềm năng): cập nhật qua opportunityService
      await updateOpportunityMutation.mutateAsync({
        id,
        payload: {
          leadName: data.name,
          leadPhone: data.phone,
          leadEmail: data.email,
          leadTaxId: data.taxId,
          leadAddress: data.address,
        },
      });
    }

    Alert.alert('Thành công', 'Cập nhật thông tin thành công!');
  };

  // BOD Approve Opportunity Action
  const handleApproveOpportunity = () => {
    Alert.alert(
      'Phê duyệt cơ hội',
      `Bạn có chắc chắn muốn phê duyệt cơ hội "${opportunity?.name}"? Sau khi duyệt, phòng kinh doanh có thể tiến hành làm báo giá và hợp đồng.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Phê duyệt ngay',
          style: 'default',
          onPress: async () => {
            if (!id) return;
            try {
              await approveOpportunityMutation.mutateAsync(id);
              Alert.alert('Thành công', 'Cơ hội đã được phê duyệt thành công!');
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể phê duyệt cơ hội.');
            }
          },
        },
      ]
    );
  };

  const handleRejectOpportunity = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do từ chối cơ hội.');
      return;
    }
    if (!id) return;
    try {
      await rejectOpportunityMutation.mutateAsync({ id, reason });
      setIsRejectModalVisible(false);
      setRejectReason('');
      Alert.alert('Đã từ chối', 'Cơ hội đã được từ chối và danh sách đã được cập nhật.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể từ chối cơ hội.');
    }
  };

  const handleResubmitOpportunity = async () => {
    if (!id || !opportunity) return;
    Alert.alert(
      'Gửi lại cơ hội',
      'Bạn có chắc chắn muốn gửi lại cơ hội này để Ban Giám Đốc (BOD) xem xét phê duyệt?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi duyệt',
          onPress: async () => {
            try {
              await resubmitOpportunityMutation.mutateAsync(opportunity.id);
              Alert.alert('Thành công', 'Đã gửi lại cơ hội để BOD xem xét phê duyệt.');
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi gửi lại cơ hội.');
            }
          },
        },
      ]
    );
  };

  // BOD Approve Quotation Action
  const handleApproveQuotation = async (quoteId: string) => {
    Alert.alert('Duyệt báo giá', 'Xác nhận phê duyệt bản báo giá này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Duyệt',
        onPress: async () => {
          try {
            await approveQuotationMutation.mutateAsync(quoteId);
            Alert.alert('Thành công', 'Báo giá đã được phê duyệt.');
          } catch {
            Alert.alert('Lỗi', 'Không thể duyệt báo giá.');
          }
        },
      },
    ]);
  };

  // BOD Reject Quotation Action - Mở modal nhập lý do (Web Parity)
  const handleRejectQuotation = (quoteId: string) => {
    setRejectQuoteId(quoteId);
    setRejectQuoteReason('');
    setIsRejectQuoteModalVisible(true);
  };

  const handleConfirmRejectQuotation = async () => {
    if (!rejectQuoteId) return;
    const validation = validateQuotationRejection(rejectQuoteReason);
    if (!validation.isValid) {
      Alert.alert('Thiếu thông tin', validation.error);
      return;
    }

    try {
      await rejectQuotationMutation.mutateAsync({
        id: rejectQuoteId,
        reason: validation.sanitizedReason,
      });
      setIsRejectQuoteModalVisible(false);
      setRejectQuoteId(null);
      setRejectQuoteReason('');
      Alert.alert('Đã từ chối', 'Bản báo giá đã bị từ chối.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể từ chối báo giá.');
    }
  };

  const handleCreateQuotation = () => {
    if (!opportunity) return;
    const incompleteJobs = getIncompleteAiJobs(opportunity.services);
    if (incompleteJobs.length > 0) {
      const jobNames = [...new Set(incompleteJobs.map((j) => j.name || 'Hạng mục AI'))].join(', ');
      Alert.alert(
        'Cần cập nhật giá vốn',
        `Vui lòng điền đầy đủ giá vốn job AI trước khi tạo báo giá: ${jobNames}`
      );
      return;
    }

    router.push({
      pathname: '/opportunities/quotations/create',
      params: { opportunityId: opportunity.id },
    } as any);
  };

  const handleCloneOpportunity = () => {
    if (!opportunity) return;
    if (opportunity.status === 'QUOTATION_DRAFTING') {
      Alert.alert(
        'Không thể sao chép',
        'Không thể sao chép khi cơ hội đang trong giai đoạn làm báo giá.'
      );
      return;
    }

    Alert.alert(
      'Sao chép cơ hội',
      `Tạo một cơ hội kinh doanh mới tương tự dựa trên thông tin của "${opportunity.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Sao chép ngay',
          onPress: () => {
            router.push({
              pathname: '/opportunities/create',
              params: { cloneFromId: opportunity.id },
            } as any);
          },
        },
      ]
    );
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Lỗi', `Không thể mở liên kết: ${url}`);
    });
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'OPEN':
        return { text: 'Mới tạo', color: '#64748B', bg: '#F1F5F9' };
      case 'PENDING_OPP_APPROVAL':
        return { text: 'Chờ BOD duyệt', color: '#D97706', bg: '#FEF3C7' };
      case 'OPP_APPROVED':
        return { text: 'Đã duyệt cơ hội', color: '#059669', bg: '#D1FAE5' };
      case 'QUOTATION_DRAFTING':
        return { text: 'Đang làm báo giá', color: '#2563EB', bg: '#DBEAFE' };
      case 'PENDING_QUOTE_APPROVAL':
        return { text: 'Chờ duyệt báo giá', color: '#EA580C', bg: '#FFEDD5' };
      case 'QUOTE_APPROVED':
        return { text: 'Báo giá đã duyệt', color: '#0D9488', bg: '#CCFBF1' };
      case 'CONTRACT_CREATED':
        return { text: 'Đang làm hợp đồng', color: '#7C3AED', bg: '#EDE9FE' };
      case 'PROJECT_ASSIGNED':
        return { text: 'Đã giao dự án', color: '#4F46E5', bg: '#EEF2FF' };
      case 'IMPLEMENTATION':
        return { text: 'Đang triển khai', color: '#0284C7', bg: '#E0F2FE' };
      case 'COMPLETED':
        return { text: 'Hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
      default:
        return { text: status || '', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="mt-3 text-[13px] text-slate-500">Đang tải chi tiết cơ hội...</Text>
      </View>
    );
  }

  if (!opportunity) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-base font-bold text-slate-800 mb-4">Không tìm thấy cơ hội</Text>
          <TouchableOpacity className="bg-primary px-4 py-2.5 rounded-xl" onPress={() => safeGoBack(router, '/opportunities')}>
            <Text className="text-white font-bold">Quay lại danh sách</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = getStatusLabel(opportunity.status);
  const isAwaitingApproval = opportunity.status === 'PENDING_OPP_APPROVAL';
  const hasCustomer = !!(
    opportunity.customer ||
    opportunity.customerId ||
    opportunity.leadName
  );

  const draftCount = quotations.filter((q) => q.status === 'DRAFT').length;
  const showBadge = draftCount > 0;
  const hasApprovedQuotation =
    opportunity.status === 'QUOTE_APPROVED' ||
    opportunity.status === 'CONTRACT_CREATED' ||
    opportunity.status === 'CONTRACT_APPROVED' ||
    opportunity.status === 'PROJECT_ASSIGNED' ||
    opportunity.status === 'IMPLEMENTATION' ||
    opportunity.status === 'COMPLETED' ||
    quotations.some((q) => q.status === 'APPROVED' || q.status === 'QUOTE_APPROVED');

  const canCreateQuotation = canCreateQuotationFromOpportunity(
    opportunity,
    user,
    quotations
  );

  const canViewQuotations = hasCustomer && quotations.length > 0;
  const isRejected = opportunity.status === 'OPP_REJECTED';
  const canResubmit =
    isRejected &&
    (user?.role === 'ADMIN' ||
      user?.role === 'BOD' ||
      (opportunity.createdBy as any)?.id === user?.id ||
      (opportunity as any)?.creator?.id === user?.id);

  const linkedContract =
    opportunity.contracts && opportunity.contracts.length > 0
      ? opportunity.contracts[0]
      : (opportunity as any).contract || null;

  const hasContract =
    opportunity.status === 'CONTRACT_CREATED' ||
    opportunity.status === 'CONTRACT_APPROVED' ||
    opportunity.status === 'PROJECT_ASSIGNED' ||
    opportunity.status === 'IMPLEMENTATION' ||
    opportunity.status === 'COMPLETED' ||
    !!linkedContract;

  // Khi báo giá được duyệt, hệ thống backend đã tự động tạo hợp đồng.
  // Không hiển thị nút tạo hợp đồng khi đã có hợp đồng hoặc báo giá đã duyệt.
  const canCreateContract =
    opportunity.status === 'QUOTE_APPROVED' &&
    !hasContract &&
    !linkedContract &&
    !hasApprovedQuotation;
  const standaloneServices = opportunity.services?.filter((s) => !s.opportunityPackageId) || [];
  const packages = opportunity.packages || [];
  const attachments = opportunity.attachments || [];

  const priorityKey = opportunity.priority || 'Medium';
  const priorityTheme = PRIORITY_THEMES[priorityKey] || {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#E2E8F0',
  };
  const priorityLabel = PRIORITY_LABELS[priorityKey] || opportunity.priority || 'Bình thường';

  const successChance = opportunity.successChance ?? 0;
  const successColor =
    successChance >= 70 ? '#059669' : successChance >= 40 ? '#D97706' : '#DC2626';

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* 1. TOP APP BAR */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity
          className="w-[38px] h-[38px] rounded-xl bg-slate-100 justify-center items-center"
          onPress={() => safeGoBack(router, '/opportunities')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-base font-extrabold text-slate-900">{opportunity.opportunityCode || 'CƠ HỘI'}</Text>
          <Text className="text-[11px] text-slate-500">Chi tiết hồ sơ kinh doanh</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            className={`w-[38px] h-[38px] rounded-xl justify-center items-center ${
              opportunity.status === 'QUOTATION_DRAFTING'
                ? 'bg-slate-100 opacity-40'
                : 'bg-blue-50 border border-blue-200'
            }`}
            onPress={handleCloneOpportunity}
            activeOpacity={0.7}
          >
            <Feather
              name="copy"
              size={17}
              color={opportunity.status === 'QUOTATION_DRAFTING' ? '#94A3B8' : '#2563EB'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-[38px] h-[38px] rounded-xl bg-slate-100 justify-center items-center"
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={18} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="p-4 pb-10"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* REJECTION WARNING BANNER (Khi BOD từ chối cơ hội) */}
        {isRejected && (
          <View className="mb-3.5 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-xs">
            <View className="flex-row items-center gap-2 mb-1.5">
              <Feather name="alert-circle" size={18} color="#DC2626" />
              <Text className="text-sm font-bold text-red-700">Cơ hội không được duyệt</Text>
            </View>
            {opportunity.rejectionReason ? (
              <Text className="text-xs text-red-600 mb-2 leading-4">
                Lý do: {opportunity.rejectionReason}
              </Text>
            ) : null}
            <Text className="text-[11px] text-red-500 mb-3">
              Chỉnh sửa thông tin cơ hội và bấm "Gửi lại duyệt" để BOD xem xét lại.
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: '/opportunities/create',
                    params: { mode: 'edit', editId: opportunity.id },
                  } as any)
                }
                className="flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl bg-white border border-slate-300 gap-1.5"
              >
                <Feather name="edit-3" size={14} color="#334155" />
                <Text className="text-xs font-semibold text-slate-700">Chỉnh sửa</Text>
              </TouchableOpacity>
              {canResubmit && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isResubmitting}
                  onPress={handleResubmitOpportunity}
                  className="flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl bg-blue-600 gap-1.5"
                >
                  {isResubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="send" size={14} color="#FFFFFF" />
                      <Text className="text-xs font-bold text-white">Gửi lại duyệt</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 2. STATUS & PROGRESS STEPPER CARD */}
        <View className="bg-white rounded-[18px] p-4 mb-3.5 border border-slate-200 shadow-sm">
          <View className="flex-row justify-between items-center mb-2.5">
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: statusMeta.bg }}>
              <Text className="text-xs font-bold" style={{ color: statusMeta.color }}>
                {statusMeta.text}
              </Text>
            </View>

            <View
              className="px-2 py-0.5 rounded-md border"
              style={{ backgroundColor: priorityTheme.bg, borderColor: priorityTheme.border }}
            >
              <Text className="text-[11px] font-bold" style={{ color: priorityTheme.text }}>
                Ưu tiên: {priorityLabel}
              </Text>
            </View>
          </View>

          <Text className="text-lg font-extrabold text-slate-900 leading-6 mb-2">{opportunity.name}</Text>

          {opportunity.description ? (
            <Text className="text-[13px] text-slate-600 leading-5 mb-4">{opportunity.description}</Text>
          ) : null}

          {/* Stepper visual 4 bước */}
          <View className="flex-row items-center justify-between pt-3.5 border-t border-slate-100">
            <View className="items-center gap-1">
              <View className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
              <Text className="text-[10px] text-slate-500 font-semibold">Mới tạo</Text>
            </View>
            <View className="flex-1 h-0.5 bg-slate-200 mx-1 mb-3.5" />
            <View className="items-center gap-1">
              <View
                className={`w-3.5 h-3.5 rounded-full ${
                  opportunity.status !== 'OPEN' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <Text className="text-[10px] text-slate-500 font-semibold">BOD duyệt</Text>
            </View>
            <View className="flex-1 h-0.5 bg-slate-200 mx-1 mb-3.5" />
            <View className="items-center gap-1">
              <View
                className={`w-3.5 h-3.5 rounded-full ${
                  opportunity.status === 'QUOTATION_DRAFTING' ||
                  opportunity.status === 'PENDING_QUOTE_APPROVAL' ||
                  opportunity.status === 'QUOTE_APPROVED' ||
                  opportunity.status === 'CONTRACT_CREATED' ||
                  opportunity.status === 'PROJECT_ASSIGNED'
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                }`}
              />
              <Text className="text-[10px] text-slate-500 font-semibold">Báo giá</Text>
            </View>
            <View className="flex-1 h-0.5 bg-slate-200 mx-1 mb-3.5" />
            <View className="items-center gap-1">
              <View
                className={`w-3.5 h-3.5 rounded-full ${
                  opportunity.status === 'CONTRACT_CREATED' ||
                  opportunity.status === 'PROJECT_ASSIGNED'
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                }`}
              />
              <Text className="text-[10px] text-slate-500 font-semibold">Hợp đồng</Text>
            </View>
          </View>

          {/* 2.1. THANH HÀNH ĐỘNG NHANH (QUICK ACTIONS BAR) ĐỒNG BỘ TỪ WEB */}
          {hasCustomer && (canViewQuotations || canCreateQuotation || canCreateContract || hasContract) && (
            <View className="flex-row flex-wrap gap-2 mt-3.5 pt-3 border-t border-slate-100">
              {canViewQuotations && (
                <View className="relative flex-1 min-w-[125px]">
                  <TouchableOpacity
                    className="flex-row items-center justify-center gap-1.5 bg-slate-900 px-3.5 py-2 rounded-lg"
                    onPress={() => setActiveTab('QUOTATIONS')}
                    activeOpacity={0.8}
                  >
                    <Feather name="file-text" size={14} color="#FFFFFF" />
                    <Text className="text-[13px] font-bold text-white" style={{ flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">Xem báo giá</Text>
                  </TouchableOpacity>
                  {showBadge && (
                    <View className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full min-w-[20px] h-5 items-center justify-center px-1 border-2 border-white">
                      <Text className="text-[10px] font-black text-white">
                        {draftCount > 9 ? '9+' : draftCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {canCreateQuotation && (
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-emerald-600 px-3.5 py-2 rounded-lg"
                  onPress={() =>
                    router.push({
                      pathname: '/opportunities/quotations/create',
                      params: { opportunityId: id },
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Feather name="plus" size={14} color="#FFFFFF" />
                  <Text className="text-[13px] font-bold text-white" style={{ flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">Tạo báo giá</Text>
                </TouchableOpacity>
              )}

              {canCreateContract && (
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-cyan-600 px-3.5 py-2 rounded-lg"
                  onPress={handlePromptCreateContract}
                  disabled={isCreatingContract}
                  activeOpacity={0.8}
                >
                  {isCreatingContract ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="briefcase" size={14} color="#FFFFFF" />
                      <Text className="text-[13px] font-bold text-white" style={{ flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">Tạo hợp đồng</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {hasContract && (
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-1.5 bg-slate-900 px-2.5 py-2 rounded-lg flex-1 min-w-[120px]"
                  onPress={() => {
                    if (linkedContract?.id) {
                      router.push({
                        pathname: '/contracts/[id]',
                        params: { id: linkedContract.id },
                      } as any);
                    } else {
                      router.push('/contracts' as any);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="file-text" size={14} color="#FFFFFF" />
                  <Text
                    className="text-[13px] font-bold text-white"
                    style={{ flexShrink: 1 }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {linkedContract?.contractCode
                      ? `HĐ: ${linkedContract.contractCode}`
                      : 'Xem hợp đồng'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* SEGMENTED TAB SELECTOR */}
        <View className="flex-row bg-slate-200 p-1 rounded-xl mb-3.5 border border-slate-200">
          <TouchableOpacity
            className="flex-1 py-2 items-center rounded-lg"
            style={
              activeTab === 'EVALUATION'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                : undefined
            }
            onPress={() => setActiveTab('EVALUATION')}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'EVALUATION' ? 'text-primary' : 'text-slate-600'
              }`}
            >
              Đánh giá
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-2 items-center rounded-lg"
            style={
              activeTab === 'FINANCIAL'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                : undefined
            }
            onPress={() => setActiveTab('FINANCIAL')}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'FINANCIAL' ? 'text-primary' : 'text-slate-600'
              }`}
            >
              Dự toán ({packages.length + standaloneServices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-2 items-center rounded-lg"
            style={
              activeTab === 'TIMELINE'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                : undefined
            }
            onPress={() => setActiveTab('TIMELINE')}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'TIMELINE' ? 'text-primary' : 'text-slate-600'
              }`}
            >
              Tiến độ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-2 items-center rounded-lg"
            style={
              activeTab === 'QUOTATIONS'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                : undefined
            }
            onPress={() => setActiveTab('QUOTATIONS')}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'QUOTATIONS' ? 'text-primary' : 'text-slate-600'
              }`}
            >
              Báo giá ({quotations.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: ĐÁNH GIÁ & KHÁCH HÀNG */}
        {activeTab === 'EVALUATION' && (
          <View className="gap-3.5 mb-3.5">
            <CustomerInfoCard
              opportunity={opportunity}
              onAddCustomer={() => setIsCustomerModalVisible(true)}
              onSaveEdit={handleSaveEditCustomer}
            />

            <OpportunityEvaluationTab opportunity={opportunity} />

            {/* Tài liệu đính kèm */}
            {attachments.length > 0 && (
              <View className="bg-white rounded-[18px] p-4 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3.5">
                  <View className="w-7 h-7 rounded-lg justify-center items-center bg-violet-50">
                    <Feather name="paperclip" size={16} color="#7C3AED" />
                  </View>
                  <Text className="text-[15px] font-extrabold text-slate-900">Tài liệu đính kèm</Text>
                  <View className="ml-auto bg-violet-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[11px] font-bold text-violet-700">{attachments.length}</Text>
                  </View>
                </View>

                <View className="gap-2">
                  {attachments.map((att: any, idx: number) => (
                    <DocumentCard
                      key={att.id || idx}
                      url={att.url || att.fileUrl || att.link}
                      fileName={att.name || att.fileName}
                      onPreview={handleOpenPreview}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Thông tin bổ sung */}
            <View className="bg-white rounded-[18px] p-4 border border-slate-200 shadow-sm">
              <View className="flex-row items-center gap-2 mb-3.5">
                <View className="w-7 h-7 rounded-lg justify-center items-center bg-slate-100">
                  <Feather name="info" size={16} color="#64748B" />
                </View>
                <Text className="text-[15px] font-extrabold text-slate-900">Thông tin bổ sung</Text>
              </View>

              <View className="gap-2">
                <View className="flex-row justify-between py-1 border-b border-slate-50">
                  <Text className="text-xs text-slate-500">Ngày tạo</Text>
                  <Text className="text-xs font-semibold text-slate-800">{formatDate(opportunity.createdAt)}</Text>
                </View>

                <View className="flex-row justify-between py-1 border-b border-slate-50">
                  <Text className="text-xs text-slate-500">Cập nhật lần cuối</Text>
                  <Text className="text-xs font-semibold text-slate-800">{formatDate(opportunity.updatedAt)}</Text>
                </View>

                <View className="flex-row justify-between py-1 border-b border-slate-50">
                  <Text className="text-xs text-slate-500">Người tạo</Text>
                  <Text className="text-xs font-semibold text-slate-800">
                    {opportunity.createdBy?.fullName ||
                      opportunity.creator?.fullName ||
                      opportunity.createdBy?.username ||
                      'Chưa cập nhật'}
                  </Text>
                </View>

                {opportunity.referralPartner && (
                  <View className="flex-row justify-between py-1 border-b border-slate-50">
                    <Text className="text-xs text-slate-500">Đối tác giới thiệu</Text>
                    <Text className="text-xs font-semibold text-slate-800">{opportunity.referralPartner.name}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: DỰ TOÁN TÀI CHÍNH & DỊCH VỤ */}
        {activeTab === 'FINANCIAL' && (
          <View className="mb-3.5">
            <OpportunityFinancialTab opportunity={opportunity} />
          </View>
        )}

        {/* TAB 3: THỜI GIAN & ĐỊA ĐIỂM */}
        {activeTab === 'TIMELINE' && (
          <View className="mb-3.5">
            <OpportunityTimeLocationTab opportunity={opportunity} />
          </View>
        )}

        {/* TAB 4: BÁO GIÁ & ĐỀ XUẤT */}
        {activeTab === 'QUOTATIONS' && (
          <View className="mb-3.5">
            <OpportunityQuotationsTab
              opportunityId={id as string}
              opportunityName={opportunity.name}
              opportunityDescription={opportunity.description}
              opportunityStatus={opportunity.status}
              onContractCreated={(newContractId) => {
                refetchAll();
                router.push({
                  pathname: '/contracts/[id]',
                  params: { id: newContractId },
                } as any);
              }}
            />
          </View>
        )}

        {/* 11. KHỐI HỢP ĐỒNG KINH TẾ */}
        {hasContract && (
          <View className="bg-white rounded-[18px] p-4 mb-3.5 border border-slate-200 shadow-sm">
            <View className="flex-row justify-between items-center mb-3.5">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg justify-center items-center bg-teal-50">
                  <Feather name="briefcase" size={16} color="#0D9488" />
                </View>
                <Text className="text-[15px] font-extrabold text-slate-900">Hợp đồng kinh tế</Text>
              </View>
              {linkedContract && (() => {
                const statusKey = linkedContract.status || '';
                const conf = CONTRACT_STATUS_CONFIG[statusKey];
                return (
                  <View
                    className="bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md"
                    style={conf ? { backgroundColor: conf.bg, borderColor: conf.border } : undefined}
                  >
                    <Text
                      className="text-[11px] font-bold text-teal-600"
                      style={conf ? { color: conf.color } : undefined}
                    >
                      {conf?.text ||
                        CONTRACT_STATUS_LABELS[statusKey] ||
                        statusKey ||
                        'Đã tạo HĐ'}
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <View className="flex-row justify-between items-start mb-2.5">
                <View className="flex-1">
                  <Text className="text-xs font-extrabold text-cyan-600">
                    {linkedContract?.contractCode ||
                      (linkedContract as any)?.contract_code ||
                      'Hợp đồng đã tạo'}
                  </Text>
                  <Text className="text-sm font-bold text-slate-900 mt-0.5">
                    {linkedContract?.name || opportunity.name}
                  </Text>
                </View>
                {linkedContract?.totalWithVat ? (
                  <Text className="text-sm font-extrabold text-emerald-600">
                    {formatVNDFull(linkedContract.totalWithVat)}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                className="flex-row items-center justify-center gap-1.5 bg-white border border-cyan-100 py-2 rounded-lg"
                onPress={() => {
                  if (linkedContract?.id) {
                    router.push({
                      pathname: '/contracts/[id]',
                      params: { id: linkedContract.id },
                    } as any);
                  } else {
                    router.push('/contracts' as any);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text className="text-[13px] font-bold text-cyan-600">Xem chi tiết hợp đồng</Text>
                <Feather name="arrow-right" size={15} color="#0891B2" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CALLOUT BANNER: SẴN SÀNG TẠO HỢP ĐỒNG */}
        {canCreateContract && !linkedContract && (
          <View className="flex-row gap-3 bg-cyan-50 border border-cyan-100 rounded-2xl p-4">
            <View className="w-9 h-9 rounded-xl bg-cyan-100 items-center justify-center">
              <Feather name="check-circle" size={20} color="#0891B2" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-extrabold text-cyan-900 mb-1">Báo giá đã được phê duyệt!</Text>
              <Text className="text-xs text-cyan-800 leading-[18px] mb-3">
                Cơ hội kinh doanh này đã có bản báo giá được duyệt. Bạn có thể tiến hành tạo hồ sơ hợp đồng chính thức ngay.
              </Text>
              <TouchableOpacity
                className="flex-row items-center justify-center gap-1.5 bg-cyan-600 py-2.5 rounded-lg"
                onPress={handlePromptCreateContract}
                disabled={isCreatingContract}
                activeOpacity={0.85}
              >
                {isCreatingContract ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={15} color="#FFFFFF" />
                    <Text className="text-[13px] font-bold text-white">Tạo hợp đồng ngay</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="h-5" />
      </ScrollView>

      {/* 11. MODAL GÁN / CHỈNH SỬA KHÁCH HÀNG (BOTTOM SHEET) */}
      <CustomerAssignModal
        visible={isCustomerModalVisible}
        onClose={() => setIsCustomerModalVisible(false)}
        onSave={handleSaveCustomer}
        initialData={{
          customerType: opportunity.customerType,
          customerId: opportunity.customerId || opportunity.customer?.id,
          customer: opportunity.customer,
          leadName: opportunity.leadName,
          leadPhone: opportunity.leadPhone,
          leadEmail: opportunity.leadEmail,
          leadAddress: opportunity.leadAddress,
          leadTaxId: opportunity.leadTaxId,
          referralPartnerId: opportunity.referralPartnerId || opportunity.referralPartner?.id,
        }}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        visible={isPreviewVisible}
        url={previewUrl}
        fileName={previewFileName}
        onClose={() => setIsPreviewVisible(false)}
      />

      <Modal
        visible={isRejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="rounded-t-[28px] bg-white px-5 pt-3 pb-6">
            <View className="h-1 w-11 self-center rounded-full bg-slate-300 mb-4" />
            <Text className="text-lg font-extrabold text-slate-900">Từ chối cơ hội</Text>
            <Text className="text-sm text-slate-500 mt-1 mb-4">
              Lý do sẽ được lưu vào lịch sử và gửi đến người phụ trách cơ hội.
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Nhập lý do từ chối..."
              placeholderTextColor="#94A3B8"
              multiline
              autoFocus
              className="min-h-[112px] rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
              style={{ textAlignVertical: 'top' }}
              accessibilityLabel="Lý do từ chối cơ hội"
            />
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white"
                onPress={() => {
                  setIsRejectModalVisible(false);
                  setRejectReason('');
                }}
              >
                <Text className="font-bold text-slate-600">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-red-600 ${isRejecting ? 'opacity-60' : ''}`}
                onPress={handleRejectOpportunity}
                disabled={isRejecting}
              >
                {isRejecting ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="x-circle" size={18} color="#FFFFFF" />}
                <Text className="font-extrabold text-white">Xác nhận từ chối</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL TỪ CHỐI BÁO GIÁ (BẮT BUỘC LÝ DO) */}
      <Modal
        visible={isRejectQuoteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRejectQuoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="rounded-t-[28px] bg-white px-5 pt-3 pb-6">
            <View className="h-1 w-11 self-center rounded-full bg-slate-300 mb-4" />
            <Text className="text-lg font-extrabold text-slate-900">Từ chối bản báo giá</Text>
            <Text className="text-sm text-slate-500 mt-1 mb-4">
              Vui lòng nhập lý do từ chối để bộ phận phụ trách điều chỉnh lại báo giá.
            </Text>
            <TextInput
              value={rejectQuoteReason}
              onChangeText={setRejectQuoteReason}
              placeholder="Nhập lý do từ chối báo giá..."
              placeholderTextColor="#94A3B8"
              multiline
              autoFocus
              className="min-h-[112px] rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
              style={{ textAlignVertical: 'top' }}
              accessibilityLabel="Lý do từ chối báo giá"
            />
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white"
                onPress={() => {
                  setIsRejectQuoteModalVisible(false);
                  setRejectQuoteId(null);
                  setRejectQuoteReason('');
                }}
              >
                <Text className="font-bold text-slate-600">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-red-600"
                onPress={handleConfirmRejectQuotation}
              >
                <Feather name="x-circle" size={18} color="#FFFFFF" />
                <Text className="font-extrabold text-white">Xác nhận từ chối</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 12. STICKY BOTTOM BAR */}
      <OpportunityBottomActionBar
        stage={(opportunity as any)?.stage || opportunity?.status}
        isPending={isApproving || isRejecting || isResubmitting}
        canApprove={isAdminOrBod && isAwaitingApproval}
        onApprove={handleApproveOpportunity}
        onReject={() => setIsRejectModalVisible(true)}
        onResubmit={canResubmit ? handleResubmitOpportunity : undefined}
        onCreateQuotation={canCreateQuotation ? handleCreateQuotation : undefined}
      />
    </SafeAreaView>
  );
}
