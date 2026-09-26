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
  TextInput } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { isManagementRole } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import * as DocumentPicker from 'expo-document-picker';
import { uploadToCloudinary, PickedFile } from '@/services/cloudinaryService';
import {
  useContractDetailQuery,
  useApproveProposalMutation,
  useRejectProposalMutation,
  useUploadProposalMutation,
  useUploadSignedMutation } from
'@/hooks/queries/useContracts';
import {
  ContractItem,
  ContractStatus,
  MilestoneStatus,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_STATUS_LABELS } from
'@/services/contractService';
import { formatVNDFull, formatNumber } from '@/utils/formatters';
import { isValidUrl, normalizeUrl } from '@/utils/validators';
import {
  ProjectItem,
  UserPMItem,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_LABELS } from
'@/services/projectService';
import {
  usePmUsersQuery,
  useProjectByContractQuery,
  useAssignProjectMutation } from
'@/hooks/queries/useProjects';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { safeGoBack } from '@/utils/navigation';
import { MilestoneTrackerTab } from '@/components/finance/MilestoneTrackerTab';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
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

export default function ContractDetailScreen() {
  const params = useLocalSearchParams<{id: string;}>();
  const contractId = String(params.id || '');
  const router = useRouter();
  const { user } = useAuth();
  const isAdminOrBod = isManagementRole(user?.role);

  // TanStack Query for contract detail
  const { data: contractData, isLoading: isContractLoading, isFetching, refetch } = useContractDetailQuery(contractId);
  const contract: ContractItem | null = contractData || null;

  // TanStack Mutations
  const approveProposalMutation = useApproveProposalMutation();
  const rejectProposalMutation = useRejectProposalMutation();
  const uploadProposalMutation = useUploadProposalMutation();
  const uploadSignedMutation = useUploadSignedMutation();

  const actionLoading =
  approveProposalMutation.isPending ||
  rejectProposalMutation.isPending ||
  uploadProposalMutation.isPending ||
  uploadSignedMutation.isPending;

  const isLoading = isContractLoading;
  const isRefreshing = isFetching;

  // Reject Proposal Modal
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Upload Proposal Modal State (Chuẩn 100% Web ProposalManagement.jsx)
  const [isUploadProposalModalVisible, setIsUploadProposalModalVisible] = useState(false);
  const [uploadProposalMethod, setUploadProposalMethod] = useState<'FILE' | 'LINK'>('FILE');
  const [proposalFile, setProposalFile] = useState<PickedFile | null>(null);
  const [proposalLink, setProposalLink] = useState('');
  const [quotationMethod, setQuotationMethod] = useState<'NONE' | 'LINK' | 'FILE'>('NONE');
  const [quotationFile, setQuotationFile] = useState<PickedFile | null>(null);
  const [quotationLink, setQuotationLink] = useState('');

  // Upload progress & loading states
  const [isUploadingProposal, setIsUploadingProposal] = useState(false);
  const [isUploadingSigned, setIsUploadingSigned] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Project Info & PMs via TanStack Query
  const { data: pmUsersData } = usePmUsersQuery();
  const pmUsers: UserPMItem[] = isAdminOrBod ? pmUsersData || [] : [];

  const { data: projectData } = useProjectByContractQuery(contractId);
  const project: ProjectItem | null = projectData || null;

  const assignProjectMutation = useAssignProjectMutation();
  const isAssigningPm = assignProjectMutation.isPending;

  const [selectedPmId, setSelectedPmId] = useState<string>('');
  const [isPmPickerVisible, setIsPmPickerVisible] = useState(false);

  useEffect(() => {
    if (project) {
      const pmMember = project.team?.members?.find((m) => m.role === 'PROJECT_MANAGER');
      setSelectedPmId(pmMember?.user?.id || '');
    } else {
      setSelectedPmId('');
    }
  }, [project]);

  useSSERefresh('invalidate_Contracts', refetch);

  const handleRefresh = () => {
    refetch();
  };

  const handleAssignPmSubmit = async (pmId: string) => {
    if (!contract) return;
    try {
      await assignProjectMutation.mutateAsync({ contractId: contract.id, pmId: pmId || null });
      Alert.alert('Thành công', 'Phân công PM phụ trách dự án thành công!');
      setIsPmPickerVisible(false);
      refetch();
    } catch (err: any) {
      Alert.alert('Lỗi phân công', err?.message || 'Không thể phân công PM');
    }
  };

  const handleCallPhone = (phone?: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Không có số điện thoại liên hệ');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleOpenLink = (url?: string) => {
    if (!url) {
      Alert.alert('Thông báo', 'Không có đường dẫn tài liệu');
      return;
    }
    Linking.openURL(url);
  };

  const handleApproveProposal = async () => {
    if (!contract) return;
    Alert.alert(
      'Xác nhận phê duyệt',
      'Bạn có chắc chắn muốn phê duyệt Proposal của hợp đồng này?',
      [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Phê duyệt',
        onPress: async () => {
          try {
            await approveProposalMutation.mutateAsync(contract.id);
            Alert.alert('Thành công', 'Đã phê duyệt Proposal hợp đồng');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Phê duyệt thất bại');
          }
        }
      }]

    );
  };

  const handleRejectProposalSubmit = async () => {
    if (!contract) return;
    if (!rejectReason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      await rejectProposalMutation.mutateAsync({
        id: contract.id,
        reason: rejectReason.trim()
      });
      setIsRejectModalVisible(false);
      setRejectReason('');
      Alert.alert('Thành công', 'Đã từ chối Proposal hợp đồng');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Từ chối thất bại');
    }
  };

  const openProposalEditor = () => {
    setUploadProposalMethod('FILE');
    setProposalFile(null);
    setProposalLink('');
    setQuotationMethod(contract?.quotation_link ? 'LINK' : 'NONE');
    setQuotationFile(null);
    setQuotationLink(contract?.quotation_link || '');
    setIsUploadProposalModalVisible(true);
  };

  const handlePickProposalFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '*/*'],

        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const lower = asset.name.toLowerCase();
        if (
        !lower.endsWith('.docx') &&
        !lower.endsWith('.doc') &&
        !lower.endsWith('.xls') &&
        !lower.endsWith('.xlsx'))
        {
          Alert.alert(
            'Định dạng không hợp lệ',
            'Chỉ chấp nhận file .docx, .xls hoặc .xlsx cho hợp đồng'
          );
          return;
        }
        setProposalFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size
        });
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn tệp tin');
    }
  };

  const handlePickQuotationFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '*/*'],

        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const lower = asset.name.toLowerCase();
        if (!lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
          Alert.alert(
            'Định dạng không hợp lệ',
            'Chỉ chấp nhận file Excel .xls hoặc .xlsx cho báo giá'
          );
          return;
        }
        setQuotationFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size
        });
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn tệp tin');
    }
  };

  const handleSubmitProposal = async () => {
    if (!contract) return;
    if (uploadProposalMethod === 'FILE' && !proposalFile) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn file Word hoặc Excel hợp đồng');
      return;
    }
    if (uploadProposalMethod === 'LINK') {
      if (!proposalLink.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập link hợp đồng');
        return;
      }
      if (!isValidUrl(proposalLink)) {
        Alert.alert(
          'Đường dẫn không hợp lệ',
          'Đường dẫn link hợp đồng không đúng định dạng. Vui lòng kiểm tra lại (Ví dụ: https://docs.google.com/...)'
        );
        return;
      }
    }

    if (quotationMethod === 'LINK') {
      if (!quotationLink.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập link báo giá');
        return;
      }
      if (!isValidUrl(quotationLink)) {
        Alert.alert(
          'Đường dẫn không hợp lệ',
          'Đường dẫn link báo giá không đúng định dạng. Vui lòng kiểm tra lại (Ví dụ: https://docs.google.com/...)'
        );
        return;
      }
    }

    try {
      setIsUploadingProposal(true);
      setUploadProgress(0);

      let uploadedFile: any = undefined;
      if (uploadProposalMethod === 'FILE' && proposalFile) {
        uploadedFile = await uploadToCloudinary(proposalFile, 'GETVINI/ERP/proposal', (p) =>
        setUploadProgress(p)
        );
      }

      let uploadedQuotationFile: any = undefined;
      if (quotationMethod === 'FILE' && quotationFile) {
        uploadedQuotationFile = await uploadToCloudinary(
          quotationFile,
          'GETVINI/ERP/quotation',
          (p) => setUploadProgress(p)
        );
      }

      if (uploadProposalMethod === 'FILE' || quotationMethod === 'FILE') {
        setUploadProgress(100);
      }

      const qLink =
      uploadedQuotationFile?.url || (
      quotationMethod === 'LINK' ? normalizeUrl(quotationLink) : undefined);

      await uploadProposalMutation.mutateAsync({
        id: contract.id,
        payload: {
          file: uploadedFile,
          contractLink: uploadProposalMethod === 'LINK' ? normalizeUrl(proposalLink) : undefined,
          quotationLink: qLink || undefined
        }
      });

      await new Promise((r) => setTimeout(r, 350));
      Alert.alert('Thành công', 'Cập nhật hợp đồng thành công!');
      setIsUploadProposalModalVisible(false);
      refetch();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Cập nhật hợp đồng thất bại');
    } finally {
      setIsUploadingProposal(false);
      setUploadProgress(0);
    }
  };

  const handleUploadSignedFile = async () => {
    if (!contract) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', '*/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.name.toLowerCase().endsWith('.pdf')) {
          Alert.alert('Định dạng không hợp lệ', 'Chỉ chấp nhận file .pdf cho hợp đồng đã ký');
          return;
        }

        setIsUploadingSigned(true);
        setUploadProgress(0);

        const uploadedFile = await uploadToCloudinary(
          {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType || 'application/pdf',
            size: asset.size
          },
          'GETVINI/ERP/signed',
          (p) => setUploadProgress(p)
        );

        setUploadProgress(100);

        await uploadSignedMutation.mutateAsync({ id: contract.id, file: uploadedFile });
        await new Promise((r) => setTimeout(r, 350));
        Alert.alert('Thành công', 'Tải lên hợp đồng đã ký thành công!');
        refetch();
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tải lên hợp đồng đã ký');
    } finally {
      setIsUploadingSigned(false);
      setUploadProgress(0);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center p-[24px] bg-slate-50">
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </SafeAreaView>);

  }

  if (!contract) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between px-[16px] py-[12px] bg-white border-b border-b-slate-100">
          <TouchableOpacity onPress={() => safeGoBack(router, '/contracts')} className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200">
            <Feather name="arrow-left" size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text className="text-[15px] font-extrabold text-slate-900">KHÔNG TÌM THẤY HỢP ĐỒNG</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Feather name="alert-circle" size={48} color="#94A3B8" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 12 }}>
            Hợp đồng không tồn tại hoặc đã bị xóa
          </Text>
        </View>
      </SafeAreaView>);

  }

  const contractCode = contract.contractCode || (contract as any).contract_code || '—';
  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || {
    text: CONTRACT_STATUS_LABELS[contract.status] || contract.status || 'Chưa xác định',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#E2E8F0'
  };

  // Financial Calculations (100% chuẩn Web ERP FinancialInfo.jsx)
  const sellingPrice = Number(contract.sellingPrice || (contract as any).selling_price || 0);
  const costPrice = Number(contract.cost || 0);

  const rawMilestones = contract.milestones || [];
  const rawDebts = (contract as any).debts || [];

  const processedMilestones = rawMilestones.map((m) => {
    const debt = rawDebts.find((d: any) => d.milestone?.id === m.id || d.milestoneId === m.id);
    let paidAmount = 0;
    if (debt) {
      const payments = debt.payments?.map((p: any) => ({ ...p, amount: Number(p.amount || 0) })) || [];
      paidAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    } else if (m.status === 'COMPLETED') {
      paidAmount = Number(m.amount || 0);
    }

    const amount = Number(m.amount || 0);
    const remaining = Math.max(0, amount - paidAmount);
    const isActive = !!debt || m.status === 'COMPLETED' || m.status === 'ACTIVE';

    return {
      paidAmount,
      remaining,
      isActive
    };
  });

  const totalPaid = processedMilestones.reduce((sum, m) => sum + m.paidAmount, 0);
  const totalDebt = processedMilestones.reduce((sum, m) => sum + (m.isActive ? m.remaining : 0), 0);
  const progressPercent = sellingPrice > 0 ? Math.round(totalPaid / sellingPrice * 100) : 0;

  // Group services into Packages & Standalone (đồng bộ 100% cơ cấu bên Cơ hội)
  const packageServices = contract.services?.filter((s) => s.isPackageService) || [];
  const standaloneServices = contract.services?.filter((s) => !s.isPackageService) || [];

  // Group package services by packageName
  const packagesMap: Record<
    string,
    {
      name: string;
      quantity: number;
      services: Array<{
        id?: string;
        name: string;
        quantity: number;
        sellingPrice: number;
        unit: string;
      }>;
    }> =
  {};

  packageServices.forEach((item) => {
    const pkgName = item.packageName || 'Gói dịch vụ';
    if (!packagesMap[pkgName]) {
      packagesMap[pkgName] = {
        name: pkgName,
        quantity: 1,
        services: []
      };
    }
    const unitName = item.service?.unit || 'Đơn vị';
    const svcName = item.name || item.service?.name || 'Dịch vụ';
    const existing = packagesMap[pkgName].services.find((s) => s.name === svcName);
    if (existing) {
      existing.quantity += 1;
    } else {
      packagesMap[pkgName].services.push({
        id: item.id,
        name: svcName,
        quantity: 1,
        sellingPrice: Number(item.sellingPrice || 0),
        unit: unitName
      });
    }
  });

  const packagesList = Object.values(packagesMap);

  // Group standalone services
  const standaloneList: Array<{
    id?: string;
    name: string;
    quantity: number;
    sellingPrice: number;
    unit: string;
  }> = [];

  standaloneServices.forEach((item) => {
    const unitName = item.service?.unit || 'Đơn vị';
    const svcName = item.name || item.service?.name || 'Dịch vụ lẻ';
    const existing = standaloneList.find((s) => s.name === svcName);
    if (existing) {
      existing.quantity += 1;
    } else {
      standaloneList.push({
        id: item.id,
        name: svcName,
        quantity: 1,
        sellingPrice: Number(item.sellingPrice || 0),
        unit: unitName
      });
    }
  });

  const isProposalAwaiting = contract.status === ContractStatus.PROPOSAL_UPLOADED;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* 1. TOP BAR */}
      <View className="flex-row items-center justify-between px-[16px] py-[12px] bg-white border-b border-b-slate-100">
        <TouchableOpacity

          onPress={() => safeGoBack(router, '/contracts')}
          activeOpacity={0.7} className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200">
          
          <Feather name="arrow-left" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View className="flex-1 items-center mx-[8px]">
          <Text className="text-[15px] font-extrabold text-slate-900">{contractCode !== '—' ? contractCode : 'HỢP ĐỒNG'}</Text>
          <Text className="text-[11px] text-slate-500 mt-[1px]">Chi tiết hồ sơ hợp đồng kinh tế</Text>
        </View>

        <TouchableOpacity

          onPress={handleRefresh}
          activeOpacity={0.7} className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200">
          
          <Feather name="refresh-cw" size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerClassName="p-[16px] pb-[120px]"
        showsVerticalScrollIndicator={false}
        refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[BrandColors.primary]}
          tintColor={BrandColors.primary} />

        }>
        
        {/* 2. STATUS & OVERVIEW CARD */}
        <View className="bg-white rounded-[16px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row justify-between items-center mb-[10px] gap-[8px]">
            <View className="flex-row items-center gap-[8px] flex-wrap flex-1">
              {/* Badge Mã hợp đồng (Chuẩn Web ERP) */}
              <View className="bg-slate-100 px-[8px] py-[3px] rounded-[6px] border border-slate-200">
                <Text className="text-[12px] font-bold text-slate-600">{contractCode}</Text>
              </View>

              {/* Badge Trạng thái hợp đồng (Chuẩn Web ERP) */}
              <View
                style={

                { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }} className="px-[10px] py-[4px] rounded-[8px] border">

                
                <Text style={{ color: statusConfig.color }} className="text-[12px] font-bold">
                  {statusConfig.text}
                </Text>
              </View>
            </View>

            {contract.createdAt &&
            <Text className="text-[11px] text-slate-400">
                {formatDate(contract.createdAt)}
              </Text>
            }
          </View>

          <Text className="text-[18px] font-extrabold text-slate-900 leading-[24px] mb-[6px]">{contract.name}</Text>

          {contract.description ?
          <Text className="text-[13px] text-slate-600 leading-[18px] mb-[10px]">{contract.description}</Text> :
          null}

          {/* Alert if Proposal Rejected */}
          {contract.status === ContractStatus.PROPOSAL_REJECTED && contract.rejectReason ?
          <View className="flex-row gap-[8px] bg-red-50 border border-red-200 rounded-[8px] p-[10px] mb-[10px]">
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text className="text-[12px] font-bold text-red-600 mb-[2px]">Lý do từ chối Proposal:</Text>
                <Text className="text-[12px] text-[#991B1B] leading-[16px]">{contract.rejectReason}</Text>
              </View>
            </View> :
          null}

          {/* Creator & Opportunity Link */}
          <View className="flex-row justify-between items-center border-t border-t-slate-50 pt-[10px] mt-[4px]">
            <View className="flex-row items-center gap-[5px]">
              <Feather name="user" size={13} color="#64748B" />
              <Text className="text-[12px] text-slate-500">
                Người tạo: <Text className="font-bold text-slate-800">{contract.createdBy?.fullName || 'Hệ thống'}</Text>
              </Text>
            </View>

            {contract.opportunity && (
              <TouchableOpacity
                onPress={() => router.push(`/opportunities/${contract.opportunity?.id}`)}
                activeOpacity={0.7}
                className="flex-row items-center gap-[4px] bg-[#ECFEFF] px-[8px] py-[4px] rounded-[6px] border border-[#CFFAFE]"
              >
                <Feather name="external-link" size={12} color="#0891B2" />
                <Text
                  className="text-[11px] font-bold text-[#0891B2]"
                  style={{ flexShrink: 1 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Cơ hội: {contract.opportunity.opportunityCode || contract.opportunity.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2.1 THÔNG TIN HỢP ĐỒNG (CHUẨN 100% WEB ContractInfo.jsx) */}
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="file-text" size={16} color="#2563EB" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Thông tin hợp đồng</Text>
            </View>
          </View>

          <View className="gap-[8px]">
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Mã hợp đồng</Text>
              <View className="bg-slate-50 border border-slate-200 px-[10px] py-[4px] rounded-[6px]">
                <Text selectable={true} className="text-[13px] font-extrabold text-slate-900">
                  {contractCode}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Tên hợp đồng</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontWeight: '700' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                {contract.name || '—'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Ngày tạo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 5 }}>
                <Feather name="calendar" size={13} color="#64748B" />
                <Text style={{ flex: 0 }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">{formatDate(contract.createdAt)}</Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Trạng thái</Text>
              <View
                style={

                { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }} className="px-[10px] py-[4px] rounded-[8px] border">

                
                <Text style={{ color: statusConfig.color }} className="text-[12px] font-bold">
                  {statusConfig.text}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. CARD KHÁCH HÀNG (CUSTOMER INFO) */}
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="users" size={16} color="#2563EB" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Thông tin khách hàng</Text>
            </View>
          </View>

          {contract.customer ?
          <View className="gap-[8px]">
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Khách hàng / Công ty</Text>
                <Text style={{ color: '#0F172A', fontWeight: '700' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                  {contract.customer.name}
                </Text>
              </View>

              {contract.customer.taxId ?
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                  <Text className="text-[12px] text-slate-500">Mã số thuế</Text>
                  <Text className="text-[13px] font-semibold text-slate-800 flex-1 text-right">{contract.customer.taxId}</Text>
                </View> :
            null}

              {contract.customer.phone ?
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                  <Text className="text-[12px] text-slate-500">Số điện thoại</Text>
                  <TouchableOpacity

                onPress={() => handleCallPhone(contract.customer?.phone)} className="flex-row items-center gap-[4px] bg-emerald-50 px-[8px] py-[3px] rounded-[6px]">
                
                    <Feather name="phone-call" size={13} color="#059669" />
                    <Text className="text-[12px] font-bold text-emerald-600">{contract.customer.phone}</Text>
                  </TouchableOpacity>
                </View> :
            null}

              {contract.customer.email ?
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                  <Text className="text-[12px] text-slate-500">Email</Text>
                  <Text className="text-[13px] font-semibold text-slate-800 flex-1 text-right">{contract.customer.email}</Text>
                </View> :
            null}

              {contract.customer.address ?
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                  <Text className="text-[12px] text-slate-500">Địa chỉ</Text>
                  <Text style={{ flex: 1, textAlign: 'right' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                    {contract.customer.address}
                  </Text>
                </View> :
            null}
            </View> :

          <Text className="text-[12px] text-slate-400 text-center py-[12px]">Chưa có thông tin khách hàng gắn với hợp đồng</Text>
          }
        </View>

        {/* 3.1 CARD DỰ ÁN CỦA HỢP ĐỒNG (CHUẨN 100% WEB ERP ProjectInfo.jsx) */}
        {project ?
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
            <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
              <View className="flex-row items-center gap-[8px]">
                <View style={{ backgroundColor: '#EEF2FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                  <Feather name="briefcase" size={16} color="#4F46E5" />
                </View>
                <Text className="text-[14px] font-bold text-slate-800">Dự án của hợp đồng</Text>
              </View>

              <TouchableOpacity

              onPress={() => router.push(`/projects/${project.id}` as any)}
              activeOpacity={0.7} className="flex-row items-center gap-[4px] bg-blue-50 px-[10px] py-[5px] rounded-[6px] border border-blue-200">
              
                <Feather name="external-link" size={13} color="#2563EB" />
                <Text className="text-[12px] font-semibold text-blue-600">Xem dự án</Text>
              </TouchableOpacity>
            </View>

            <View className="gap-[8px]">
              {/* Tên dự án */}
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Tên dự án</Text>
                <Text
                style={

                { flex: 1, textAlign: 'right', fontWeight: '700', color: '#1E1B4B' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">

                
                  {project.name}
                </Text>
              </View>

              {/* Trạng thái dự án */}
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Trạng thái dự án</Text>
                {(() => {
                const projStatusConfig = PROJECT_STATUS_CONFIG[project.status] || {
                  text: PROJECT_STATUS_LABELS[project.status] || project.status || 'Đang thực hiện',
                  color: '#047857',
                  bg: '#ECFDF5',
                  border: '#A7F3D0'
                };
                return (
                  <View
                    style={

                    { backgroundColor: projStatusConfig.bg, borderColor: projStatusConfig.border }} className="px-[10px] py-[4px] rounded-[8px] border">

                    
                      <Text style={{ color: projStatusConfig.color }} className="text-[12px] font-bold">
                        {projStatusConfig.text}
                      </Text>
                    </View>);

              })()}
              </View>

              {/* PM Phụ trách */}
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">PM phụ trách</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 }}>
                  {(() => {
                  const pmMember = project.team?.members?.find(
                    (m) => m.role === 'PROJECT_MANAGER'
                  );
                  const hasPm = !!pmMember?.user;
                  const pmName = pmMember?.user?.fullName || 'Chưa phân công PM';
                  return (
                    <>
                        <Text
                        style={

                        { flex: 0, fontWeight: '700', color: hasPm ? '#0F172A' : '#94A3B8' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">

                        
                          {pmName}
                        </Text>

                        {isAdminOrBod && !hasPm &&
                      <TouchableOpacity

                        onPress={() => setIsPmPickerVisible(true)}
                        disabled={isAssigningPm}
                        activeOpacity={0.7} className="flex-row items-center gap-[4px] bg-blue-50 border border-[#93C5FD] px-[8px] py-[3px] rounded-[6px]">
                        
                            <Feather name="user-plus" size={12} color="#2563EB" />
                            <Text className="text-[11px] font-bold text-blue-600">Phân công</Text>
                          </TouchableOpacity>
                      }
                      </>);

                })()}
                </View>
              </View>

              {/* Lead dự án */}
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Lead dự án</Text>
                <Text style={{ fontWeight: '600' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                  {project.team?.teamLead?.fullName || 'PM chưa chọn lead'}
                </Text>
              </View>
            </View>
          </View> :
        null}

        {/* 4. TỔNG KẾT TÀI CHÍNH (CHUẨN 100% WEB ERP FinancialInfo.jsx) */}
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="dollar-sign" size={16} color="#2563EB" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Tổng kết tài chính</Text>
            </View>
          </View>

          <View className="gap-[10px]">
            {/* 1. TỔNG GIÁ TRỊ HỢP ĐỒNG */}
            <View className="bg-[#1E40AF] rounded-[12px] p-[14px] shadow-md">
              <Text className="text-[10px] font-extrabold text-[#DBEAFE] tracking-[0.8px] mb-[4px]">TỔNG GIÁ TRỊ HỢP ĐỒNG</Text>
              <Text className="text-[18px] font-black text-white">{formatVNDFull(sellingPrice)}</Text>
            </View>

            {/* 2. TỔNG VỐN */}
            <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
              <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">TỔNG VỐN</Text>
              <Text style={{ color: '#059669' }} className="text-[16px] font-extrabold mt-[2px]">
                {formatVNDFull(costPrice)}
              </Text>
            </View>

            {/* 3. ĐÃ THANH TOÁN THỰC TẾ */}
            <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
              <View className="flex-row justify-between items-center mb-[2px]">
                <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">ĐÃ THANH TOÁN THỰC TẾ</Text>
                <View style={{ backgroundColor: '#ECFDF5' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                  <Feather name="trending-up" size={13} color="#059669" />
                </View>
              </View>
              <Text style={{ color: '#059669' }} className="text-[16px] font-extrabold mt-[2px]">
                {formatVNDFull(totalPaid)}
              </Text>
              <Text className="text-[11px] text-slate-400 mt-[4px]">
                Bạn đã thu về {progressPercent}% doanh thu
              </Text>
            </View>

            {/* 4. CÔNG NỢ CHỜ THU HỒI */}
            <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
              <View className="flex-row justify-between items-center mb-[2px]">
                <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">CÔNG NỢ CHỜ THU HỒI</Text>
                <View style={{ backgroundColor: '#FEF2F2' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                  <Feather name="alert-circle" size={13} color="#DC2626" />
                </View>
              </View>
              <Text style={{ color: '#DC2626' }} className="text-[16px] font-extrabold mt-[2px]">
                {formatVNDFull(totalDebt)}
              </Text>
              <Text className="text-[11px] text-slate-400 mt-[4px]">
                Tổng nợ từ các đợt đã kích hoạt
              </Text>
            </View>
          </View>
        </View>

        {/* 5. KHỐI DỊCH VỤ & GÓI DỊCH VỤ (ĐỒNG BỘ 100% VỚI BÊN CƠ HỘI) */}
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#E0E7FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="package" size={16} color="#4F46E5" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Dịch vụ & Gói dịch vụ</Text>
            </View>
          </View>

          {/* Danh sách các gói thầu */}
          {packagesList.length > 0 &&
          <View className="gap-[12px]">
              {packagesList.map((pkg, idx) =>
            <View key={idx} className="bg-[#F0F9FF] rounded-[12px] p-[12px] border border-[#BAE6FD]">
                  <View className="flex-row items-center gap-[8px] mb-[8px]">
                    <View className="w-[24px] h-[24px] rounded-[6px] bg-[#E0F2FE] justify-center items-center">
                      <Feather name="briefcase" size={14} color="#2563EB" />
                    </View>
                    <Text className="text-[14px] font-extrabold text-[#0369A1] flex-1">
                      Gói: {pkg.name}{' '}
                      {pkg.quantity > 1 ?
                  <Text className="text-[13px] font-semibold text-[#0284C7]">x{pkg.quantity}</Text> :
                  null}
                    </Text>
                  </View>

                  {/* Định mức dịch vụ con */}
                  <View className="ml-[8px] pl-[10px] border-l-[2px] gap-[8px]">
                    <Text className="text-[10px] font-bold text-[#0284C7] uppercase tracking-[0.3px]">
                      Số lượng dưới đây là định mức cho 1 gói:
                    </Text>

                    {pkg.services.length > 0 ?
                pkg.services.map((s, sIdx) =>
                <View key={s.id || sIdx} className="flex-row justify-between items-center py-[4px] border-b border-b-[#E0F2FE]">
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text className="text-[12px] font-semibold text-slate-800">{s.name}</Text>
                            <Text className="text-[11px] text-slate-500 mt-[1px]">
                              Định mức: {s.quantity} {s.unit} / Gói
                            </Text>
                          </View>
                          <Text className="text-[12px] font-bold text-[#0369A1]">
                            {formatNumber(s.sellingPrice)} VNĐ
                          </Text>
                        </View>
                ) :

                <Text className="text-[11px] text-slate-400">Chưa có dịch vụ thành phần trong gói.</Text>
                }
                  </View>
                </View>
            )}
            </View>
          }

          {/* Danh sách Dịch vụ lẻ */}
          {standaloneList.length > 0 &&
          <View className="mt-[14px] gap-[6px]">
              <Text className="text-[12px] font-bold text-slate-500 mb-[8px] uppercase tracking-[0.5px]">Dịch vụ lẻ</Text>
              {standaloneList.map((s, idx) =>
            <View key={s.id || idx} className="flex-row justify-between items-center bg-slate-50 rounded-[10px] p-[10px] border border-slate-200 mb-[6px]">
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text className="text-[13px] font-semibold text-slate-800">{s.name}</Text>
                    <Text className="text-[11px] text-slate-500 mt-[1px]">
                      Số lượng: {s.quantity} {s.unit}
                    </Text>
                  </View>
                  <Text className="text-[13px] font-bold text-emerald-600">
                    {formatNumber(s.sellingPrice)} VNĐ
                  </Text>
                </View>
            )}
            </View>
          }

          {packagesList.length === 0 && standaloneList.length === 0 &&
          <View className="p-[24px] items-center justify-center gap-[8px]">
              <Feather name="layers" size={24} color="#CBD5E1" />
              <Text className="text-[12px] text-slate-400 text-center">Chưa có dịch vụ hoặc gói nào được chọn.</Text>
            </View>
          }
        </View>

        {/* 6. QUẢN LÝ ĐỢT THANH TOÁN (PAYMENT MILESTONES TRACKER & MODAL) */}
        <MilestoneTrackerTab
          contractId={contract.id}
          contractCode={contract.contractCode}
          sellingPrice={sellingPrice}
          onRefresh={refetch}
        />

        {/* 7. CARD QUẢN LÝ HỢP ĐỒNG (PROPOSAL & SIGNED FILES - CHUẨN 100% WEB ProposalManagement.jsx) */}
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#F3E8FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="file-text" size={16} color="#9333EA" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Quản lý hợp đồng</Text>
            </View>
          </View>

          <View className="gap-[12px]">
            {/* Box 1: Hợp đồng dự thảo (Proposal) */}
            <View className="bg-white border border-slate-200 rounded-[12px] p-[14px]">
              <View className="flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text className="text-[14px] font-bold text-slate-900">
                    Hợp đồng{' '}
                    <Text className="text-[12px] font-normal text-slate-400">(.docx, Excel hoặc link)</Text>
                  </Text>
                  <Text className="text-[12px] text-slate-500 mt-[4px]">
                    {contract.proposal_contract ? 'Đã upload' : 'Chưa có file'}
                  </Text>
                </View>

                {/* Proposal Action Buttons */}
                <View className="flex-row items-center gap-[8px]">
                  {contract.proposal_contract ?
                  <>
                      <TouchableOpacity

                      onPress={() => handleOpenLink(contract.proposal_contract)}
                      activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[12px] py-[7px] bg-slate-100 rounded-[8px] border border-slate-200">
                      
                        <Feather name="file-text" size={13} color="#334155" />
                        <Text className="text-[12px] font-semibold text-slate-700">Xem</Text>
                      </TouchableOpacity>

                      {contract.status === ContractStatus.PROPOSAL_UPLOADED && isAdminOrBod &&
                    <View className="flex-row items-center gap-[6px]">
                          <TouchableOpacity

                        onPress={handleApproveProposal}
                        disabled={actionLoading || isUploadingProposal || isUploadingSigned}
                        activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[12px] py-[7px] bg-[#16A34A] rounded-[8px]">
                        
                            <Feather name="check-circle" size={13} color="#FFFFFF" />
                            <Text className="text-[12px] font-bold text-white">Duyệt</Text>
                          </TouchableOpacity>

                          <TouchableOpacity

                        onPress={() => setIsRejectModalVisible(true)}
                        disabled={actionLoading || isUploadingProposal || isUploadingSigned}
                        activeOpacity={0.7} className="flex-row items-center gap-[4px] px-[10px] py-[7px] bg-red-50 border border-red-200 rounded-[8px]">
                        
                            <Feather name="x" size={13} color="#DC2626" />
                            <Text className="text-[12px] font-bold text-red-600">Từ chối</Text>
                          </TouchableOpacity>
                        </View>
                    }

                      {contract.status === ContractStatus.PROPOSAL_REJECTED &&
                    <TouchableOpacity

                      onPress={openProposalEditor}
                      disabled={isUploadingProposal || isUploadingSigned}
                      activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[12px] py-[7px] bg-blue-600 rounded-[8px]">
                      
                          {isUploadingProposal ?
                      <ActivityIndicator size="small" color="#FFFFFF" /> :

                      <Feather name="upload" size={13} color="#FFFFFF" />
                      }
                          <Text className="text-[12px] font-bold text-white">Upload bản mới</Text>
                        </TouchableOpacity>
                    }
                    </> :

                  <TouchableOpacity

                    onPress={openProposalEditor}
                    disabled={isUploadingProposal || isUploadingSigned}
                    activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[14px] py-[7px] bg-blue-600 rounded-[8px]">
                    
                      {isUploadingProposal ?
                    <ActivityIndicator size="small" color="#FFFFFF" /> :

                    <Feather name="upload" size={13} color="#FFFFFF" />
                    }
                      <Text className="text-[12px] font-bold text-white">Upload</Text>
                    </TouchableOpacity>
                  }
                </View>
              </View>

              {/* Quotation link if exists */}
              {contract.quotation_link ?
              <TouchableOpacity

                onPress={() => handleOpenLink(contract.quotation_link)}
                activeOpacity={0.7} className="flex-row items-center gap-[6px] mt-[10px] pt-[8px] border-t border-t-slate-100">
                
                  <Feather name="file-text" size={14} color="#2563EB" />
                  <Text className="text-[12px] font-semibold text-blue-600">Xem link báo giá</Text>
                  <Feather name="external-link" size={12} color="#2563EB" />
                </TouchableOpacity> :
              null}

              {/* Rejection callout box if PROPOSAL_REJECTED */}
              {contract.status === ContractStatus.PROPOSAL_REJECTED && (
              contract.rejectReason || (contract as any).rejectionReason) &&
              <View className="mt-[10px] p-[10px] bg-red-50 border border-red-100 rounded-[8px]">
                    <Text className="text-[10px] font-extrabold text-[#991B1B] uppercase tracking-[0.5px] mb-[4px]">LÝ DO TỪ CHỐI HIỆN TẠI:</Text>
                    <Text className="text-[12px] text-red-700 leading-[16px]">
                      {contract.rejectReason || (contract as any).rejectionReason}
                    </Text>
                  </View>
              }

              {/* Progress bar if uploading proposal */}
              {isUploadingProposal &&
              <View className="mt-[10px] pt-[8px] border-t border-t-slate-100">
                  <View className="flex-row justify-between items-center mb-[4px]">
                    <Text className="text-[11px] font-bold text-blue-600 uppercase">Đang tải lên hợp đồng...</Text>
                    <Text className="text-[11px] font-extrabold text-blue-600">{uploadProgress}%</Text>
                  </View>
                  <View className="h-[6px] bg-blue-50 rounded-[99px] overflow-hidden border border-[#DBEAFE]">
                    <View
                    style={{ width: `${uploadProgress}%` }} className="h-full bg-blue-600 rounded-[99px]" />
                  
                  </View>
                </View>
              }
            </View>

            {/* Box 2: Hợp đồng đã ký (Signed Contract) */}
            <View className="bg-white border border-slate-200 rounded-[12px] p-[14px]">
              <View className="flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text className="text-[14px] font-bold text-slate-900">
                    Hợp đồng đã ký{' '}
                    <Text className="text-[12px] font-normal text-slate-400">(.pdf)</Text>
                  </Text>
                  <Text className="text-[12px] text-slate-500 mt-[4px]">
                    {contract.signed_contract ? 'Đã upload' : 'Chưa có file'}
                  </Text>
                </View>

                <View className="flex-row items-center gap-[8px]">
                  {contract.signed_contract ?
                  <TouchableOpacity

                    onPress={() => handleOpenLink(contract.signed_contract)}
                    activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[12px] py-[7px] bg-slate-100 rounded-[8px] border border-slate-200">
                    
                      <Feather name="check-circle" size={13} color="#16A34A" />
                      <Text style={{ color: '#16A34A' }} className="text-[12px] font-semibold text-slate-700">Xem</Text>
                    </TouchableOpacity> :

                  <TouchableOpacity

                    onPress={handleUploadSignedFile}
                    disabled={isUploadingSigned || isUploadingProposal}
                    activeOpacity={0.7} className="flex-row items-center gap-[5px] px-[14px] py-[7px] bg-[#4F46E5] rounded-[8px]">
                    
                      {isUploadingSigned ?
                    <ActivityIndicator size="small" color="#FFFFFF" /> :

                    <Feather name="upload" size={13} color="#FFFFFF" />
                    }
                      <Text className="text-[12px] font-bold text-white">Upload</Text>
                    </TouchableOpacity>
                  }
                </View>
              </View>

              {/* Progress bar if uploading signed contract */}
              {isUploadingSigned &&
              <View className="mt-[10px] pt-[8px] border-t border-t-slate-100">
                  <View className="flex-row justify-between items-center mb-[4px]">
                    <Text className="text-[11px] font-bold text-blue-600 uppercase">Đang tải lên bản đã ký...</Text>
                    <Text className="text-[11px] font-extrabold text-blue-600">{uploadProgress}%</Text>
                  </View>
                  <View className="h-[6px] bg-blue-50 rounded-[99px] overflow-hidden border border-[#DBEAFE]">
                    <View
                    style={

                    { backgroundColor: '#4F46E5', width: `${uploadProgress}%` }} className="h-full bg-blue-600 rounded-[99px]" />

                  
                  </View>
                </View>
              }
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 8. BOD / ADMIN ACTION BAR CHO PROPOSAL NẾU ĐANG CHỜ DUYỆT */}
      {isAdminOrBod && isProposalAwaiting &&
      <View className="flex-row gap-[10px] p-[16px] bg-white border-t border-t-slate-200 shadow-md">
          <TouchableOpacity

          onPress={() => setIsRejectModalVisible(true)}
          disabled={actionLoading}
          activeOpacity={0.85} className="flex-1 flex-row items-center justify-center gap-[6px] bg-red-50 border border-red-200 py-[12px] rounded-[10px]">
          
            <Feather name="x-circle" size={16} color="#DC2626" />
            <Text className="text-[13px] font-bold text-red-600">Từ chối Proposal</Text>
          </TouchableOpacity>

          <TouchableOpacity

          onPress={handleApproveProposal}
          disabled={actionLoading}
          activeOpacity={0.85} className="flex-1 flex-row items-center justify-center gap-[6px] bg-emerald-600 py-[12px] rounded-[10px]">
          
            {actionLoading ?
          <ActivityIndicator size="small" color="#FFFFFF" /> :

          <>
                <Feather name="check-circle" size={16} color="#FFFFFF" />
                <Text className="text-[13px] font-bold text-white">Duyệt Proposal</Text>
              </>
          }
          </TouchableOpacity>
        </View>
      }

      {/* 9. MODAL NHẬP LÝ DO TỪ CHỐI PROPOSAL */}
      <Modal
        visible={isRejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRejectModalVisible(false)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
          <View className="bg-white rounded-[16px] w-full max-w-[400px] p-[20px] shadow-lg">
            <View className="flex-row justify-between items-center mb-[8px]">
              <Text className="text-[16px] font-extrabold text-slate-800">Từ chối Proposal</Text>
              <TouchableOpacity onPress={() => setIsRejectModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[12px] text-slate-500 leading-[16px] mb-[12px]">
              Vui lòng nêu rõ lý do từ chối để nhân viên cập nhật lại bản dự thảo hợp đồng:
            </Text>

            <TextInput

              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Nhập lý do từ chối (ví dụ: điều khoản thanh toán chưa phù hợp...)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top" className="bg-slate-50 border border-slate-300 rounded-[10px] p-[12px] text-[13px] text-slate-900 min-h-[90px] mb-[16px]" />
            

            <View className="flex-row justify-end gap-[10px]">
              <TouchableOpacity

                onPress={() => setIsRejectModalVisible(false)} className="px-[14px] py-[8px] rounded-[8px] bg-slate-100">
                
                <Text className="text-[13px] font-semibold text-slate-600">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity

                onPress={handleRejectProposalSubmit}
                disabled={actionLoading} className="px-[16px] py-[8px] rounded-[8px] bg-red-600">
                
                {actionLoading ?
                <ActivityIndicator size="small" color="#FFFFFF" /> :

                <Text className="text-[13px] font-bold text-white">Xác nhận từ chối</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 10. MODAL UPLOAD PROPOSAL (ĐỒNG BỘ 100% WEB ProposalManagement.jsx) */}
      <Modal
        visible={isUploadProposalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isUploadingProposal) setIsUploadProposalModalVisible(false);
        }}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
          <View className={["bg-white rounded-[16px] w-full max-w-[400px] p-[20px] shadow-lg", "max-w-[480px] max-h-[85%]"].filter(Boolean).join(" ")}>
            <View className="flex-row justify-between items-center mb-[8px]">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#EFF6FF' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                  <Feather name="upload-cloud" size={16} color="#2563EB" />
                </View>
                <Text className="text-[16px] font-extrabold text-slate-800">Cập nhật Proposal hợp đồng</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isUploadingProposal) setIsUploadProposalModalVisible(false);
                }}
                disabled={isUploadingProposal}>
                
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Section 1: Phương thức tải Hợp đồng */}
              <Text className="text-[13px] font-bold text-slate-700 mb-[8px]">1. Chọn hình thức upload hợp đồng</Text>
              <View className="flex-row gap-[10px] mb-[10px]">
                <TouchableOpacity




                  onPress={() => {
                    setUploadProposalMethod('FILE');
                    setProposalLink('');
                  }}
                  activeOpacity={0.7} className={["flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white", uploadProposalMethod === 'FILE' && "border-[#3B82F6] bg-blue-50"].filter(Boolean).join(" ")}>
                  
                  <Feather
                    name="upload"
                    size={16}
                    color={uploadProposalMethod === 'FILE' ? '#2563EB' : '#64748B'} />
                  
                  <Text className={["text-[12px] font-semibold text-slate-600",


                  uploadProposalMethod === 'FILE' && "text-[#1D4ED8] font-bold"].filter(Boolean).join(" ")}>

                    
                    Tải file Word/Excel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity




                  onPress={() => {
                    setUploadProposalMethod('LINK');
                    setProposalFile(null);
                  }}
                  activeOpacity={0.7} className={["flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white", uploadProposalMethod === 'LINK' && "border-[#3B82F6] bg-blue-50"].filter(Boolean).join(" ")}>
                  
                  <Feather
                    name="link-2"
                    size={16}
                    color={uploadProposalMethod === 'LINK' ? '#2563EB' : '#64748B'} />
                  
                  <Text className={["text-[12px] font-semibold text-slate-600",


                  uploadProposalMethod === 'LINK' && "text-[#1D4ED8] font-bold"].filter(Boolean).join(" ")}>

                    
                    Nhập link hợp đồng
                  </Text>
                </TouchableOpacity>
              </View>

              {uploadProposalMethod === 'FILE' &&
              <View className="mb-[8px]">
                  <Text className="text-[12px] font-medium text-slate-500 mb-[6px]">File hợp đồng (.docx, .xls, .xlsx)</Text>
                  {proposalFile ?
                <View className="flex-row items-center justify-between bg-blue-50 border border-blue-200 rounded-[8px] p-[10px]">
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text numberOfLines={1} className="text-[12px] font-bold text-[#1E40AF]">
                          {proposalFile.name}
                        </Text>
                        <Text className="text-[11px] text-[#3B82F6] mt-[2px]">
                          {proposalFile.size ?
                      `${(proposalFile.size / 1024).toFixed(1)} KB` :
                      'Đã sẵn sàng tải lên'}
                        </Text>
                      </View>
                      <TouchableOpacity

                    onPress={handlePickProposalFile}
                    disabled={isUploadingProposal} className="px-[10px] py-[5px] bg-white border border-[#93C5FD] rounded-[6px]">
                    
                        <Text className="text-[11px] font-semibold text-blue-600">Đổi file</Text>
                      </TouchableOpacity>
                    </View> :

                <TouchableOpacity

                  onPress={handlePickProposalFile}
                  disabled={isUploadingProposal}
                  activeOpacity={0.7} className="border-[1.5px] border-dashed border-[#93C5FD] bg-slate-50 rounded-[10px] p-[14px] items-center justify-center gap-[4px]">
                  
                      <Feather name="file-plus" size={20} color="#2563EB" />
                      <Text className="text-[13px] font-semibold text-blue-600">Bấm để chọn file từ thiết bị</Text>
                      <Text className="text-[11px] text-slate-400">Hỗ trợ định dạng .docx, .xls, .xlsx</Text>
                    </TouchableOpacity>
                }
                </View>
              }

              {uploadProposalMethod === 'LINK' &&
              <View className="mb-[8px]">
                  <Text className="text-[12px] font-medium text-slate-500 mb-[6px]">Link hợp đồng (Google Docs, Drive...)</Text>
                  <TextInput

                  value={proposalLink}
                  onChangeText={setProposalLink}
                  placeholder="https://docs.google.com/..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url" className="bg-white border border-slate-300 rounded-[8px] px-[12px] py-[10px] text-[13px] text-slate-900" />
                
                </View>
              }

              {/* Section 2: Báo giá (nếu có) */}
              <Text style={{ marginTop: 16 }} className="text-[13px] font-bold text-slate-700 mb-[8px]">2. Báo giá (nếu có)</Text>
              <View className="flex-row gap-[10px] mb-[10px]">
                <TouchableOpacity




                  onPress={() => {
                    setQuotationMethod(quotationMethod === 'LINK' ? 'NONE' : 'LINK');
                    setQuotationFile(null);
                  }}
                  activeOpacity={0.7} className={["flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white", quotationMethod === 'LINK' && "border-[#3B82F6] bg-blue-50"].filter(Boolean).join(" ")}>
                  
                  <Feather
                    name="link-2"
                    size={16}
                    color={quotationMethod === 'LINK' ? '#2563EB' : '#64748B'} />
                  
                  <Text className={["text-[12px] font-semibold text-slate-600",


                  quotationMethod === 'LINK' && "text-[#1D4ED8] font-bold"].filter(Boolean).join(" ")}>

                    
                    Nhập link báo giá
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity




                  onPress={() => {
                    setQuotationMethod(quotationMethod === 'FILE' ? 'NONE' : 'FILE');
                    setQuotationLink('');
                  }}
                  activeOpacity={0.7} className={["flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white", quotationMethod === 'FILE' && "border-[#3B82F6] bg-blue-50"].filter(Boolean).join(" ")}>
                  
                  <Feather
                    name="file-text"
                    size={16}
                    color={quotationMethod === 'FILE' ? '#2563EB' : '#64748B'} />
                  
                  <Text className={["text-[12px] font-semibold text-slate-600",


                  quotationMethod === 'FILE' && "text-[#1D4ED8] font-bold"].filter(Boolean).join(" ")}>

                    
                    Tải file Excel
                  </Text>
                </TouchableOpacity>
              </View>

              {quotationMethod === 'LINK' &&
              <View className="mb-[8px]">
                  <TextInput

                  value={quotationLink}
                  onChangeText={setQuotationLink}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url" className="bg-white border border-slate-300 rounded-[8px] px-[12px] py-[10px] text-[13px] text-slate-900" />
                
                </View>
              }

              {quotationMethod === 'FILE' &&
              <View className="mb-[8px]">
                  {quotationFile ?
                <View className="flex-row items-center justify-between bg-blue-50 border border-blue-200 rounded-[8px] p-[10px]">
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text numberOfLines={1} className="text-[12px] font-bold text-[#1E40AF]">
                          {quotationFile.name}
                        </Text>
                        <Text className="text-[11px] text-[#3B82F6] mt-[2px]">
                          {quotationFile.size ?
                      `${(quotationFile.size / 1024).toFixed(1)} KB` :
                      'Đã sẵn sàng tải lên'}
                        </Text>
                      </View>
                      <TouchableOpacity

                    onPress={handlePickQuotationFile}
                    disabled={isUploadingProposal} className="px-[10px] py-[5px] bg-white border border-[#93C5FD] rounded-[6px]">
                    
                        <Text className="text-[11px] font-semibold text-blue-600">Đổi file</Text>
                      </TouchableOpacity>
                    </View> :

                <TouchableOpacity

                  onPress={handlePickQuotationFile}
                  disabled={isUploadingProposal}
                  activeOpacity={0.7} className="border-[1.5px] border-dashed border-[#93C5FD] bg-slate-50 rounded-[10px] p-[14px] items-center justify-center gap-[4px]">
                  
                      <Feather name="file-plus" size={18} color="#2563EB" />
                      <Text className="text-[13px] font-semibold text-blue-600">Chọn file Excel báo giá</Text>
                      <Text className="text-[11px] text-slate-400">Chỉ chấp nhận file .xls, .xlsx</Text>
                    </TouchableOpacity>
                }
                </View>
              }

              {/* Progress bar in modal */}
              {isUploadingProposal &&
              <View style={{ marginTop: 16 }} className="mt-[10px] pt-[8px] border-t border-t-slate-100">
                  <View className="flex-row justify-between items-center mb-[4px]">
                    <Text className="text-[11px] font-bold text-blue-600 uppercase">Đang tải lên máy chủ Cloudinary...</Text>
                    <Text className="text-[11px] font-extrabold text-blue-600">{uploadProgress}%</Text>
                  </View>
                  <View className="h-[6px] bg-blue-50 rounded-[99px] overflow-hidden border border-[#DBEAFE]">
                    <View
                    style={{ width: `${uploadProgress}%` }} className="h-full bg-blue-600 rounded-[99px]" />
                  
                  </View>
                </View>
              }
            </ScrollView>

            <View style={{ marginTop: 16 }} className="flex-row justify-end gap-[10px]">
              <TouchableOpacity

                onPress={() => setIsUploadProposalModalVisible(false)}
                disabled={isUploadingProposal} className="px-[14px] py-[8px] rounded-[8px] bg-slate-100">
                
                <Text className="text-[13px] font-semibold text-slate-600">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={

                (isUploadingProposal || (
                uploadProposalMethod === 'FILE' ? !proposalFile : !proposalLink.trim())) && {
                  opacity: 0.5
                }}

                onPress={handleSubmitProposal}
                disabled={
                isUploadingProposal || (
                uploadProposalMethod === 'FILE' ? !proposalFile : !proposalLink.trim())
                } className="flex-row items-center gap-[6px] px-[16px] py-[8px] rounded-[8px] bg-blue-600">
                
                {isUploadingProposal ?
                <ActivityIndicator size="small" color="#FFFFFF" /> :

                <Feather name="check" size={16} color="#FFFFFF" />
                }
                <Text className="text-[13px] font-bold text-white">
                  {isUploadingProposal ? 'Đang lưu...' : 'Lưu'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. MODAL PHÂN CÔNG PM DỰ ÁN (CHUẨN 100% WEB ProjectInfo.jsx) */}
      <Modal
        visible={isPmPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPmPickerVisible(false)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
          <View className="bg-white rounded-[16px] w-full max-w-[400px] p-[20px] shadow-lg">
            <View className="flex-row justify-between items-center mb-[8px]">
              <Text className="text-[16px] font-extrabold text-slate-800">Phân công PM phụ trách dự án</Text>
              <TouchableOpacity onPress={() => setIsPmPickerVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[12px] text-slate-500 leading-[16px] mb-[12px]">
              Chọn Quản lý dự án (PM) để chịu trách nhiệm triển khai hợp đồng này:
            </Text>

            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {pmUsers.length > 0 ?
              pmUsers.map((pm) => {
                const isSelected = selectedPmId === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}

                    onPress={() => {
                      setSelectedPmId(pm.id);
                      handleAssignPmSubmit(pm.id);
                    }}
                    disabled={isAssigningPm}
                    activeOpacity={0.7} className={["flex-row items-center gap-[10px] p-[10px] rounded-[10px] border border-slate-200 mb-[8px] bg-white", isSelected && "border-[#3B82F6] bg-blue-50"].filter(Boolean).join(" ")}>
                    
                      <View
                      style={isSelected && { backgroundColor: '#2563EB' }} className="w-[32px] h-[32px] rounded-[16px] bg-slate-100 items-center justify-center">
                      
                        <Text
                        style={

                        isSelected && { color: '#FFFFFF' }} className="text-[13px] font-extrabold text-slate-600">

                        
                          {pm.fullName?.substring(0, 1).toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                        style={

                        isSelected && { color: '#1D4ED8', fontWeight: '700' }} className="text-[13px] font-semibold text-slate-900">

                        
                          {pm.fullName}
                        </Text>
                        {pm.email ? <Text className="text-[11px] text-slate-500">{pm.email}</Text> : null}
                      </View>
                      {isSelected ? <Feather name="check-circle" size={18} color="#2563EB" /> : null}
                    </TouchableOpacity>);

              }) :

              <Text className="text-[12px] text-slate-400 text-center py-[12px]">Không tìm thấy tài khoản PM nào</Text>
              }
            </ScrollView>

            <View style={{ marginTop: 16 }} className="flex-row justify-end gap-[10px]">
              <TouchableOpacity

                onPress={() => setIsPmPickerVisible(false)} className="px-[14px] py-[8px] rounded-[8px] bg-slate-100">
                
                <Text className="text-[13px] font-semibold text-slate-600">Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>);

}
