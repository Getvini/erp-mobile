import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
  useUploadSignedMutation,
} from '@/hooks/queries/useContracts';
import {
  ContractItem,
  ContractStatus,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_STATUS_LABELS,
  isContractLocked,
} from '@/services/contractService';
import { isValidUrl, normalizeUrl } from '@/utils/validators';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import { ProjectItem, UserPMItem } from '@/services/projectService';
import {
  usePmUsersQuery,
  useProjectByContractQuery,
  useAssignProjectMutation,
} from '@/hooks/queries/useProjects';
import { safeGoBack } from '@/utils/navigation';
import { getProjectManagerUser } from '@/utils/teamMember';
import { MilestoneTrackerTab } from '@/components/finance/MilestoneTrackerTab';
import { useDebtsByContractQuery } from '@/hooks/queries/useDebts';
import { usePaymentMilestonesByContractQuery } from '@/hooks/queries/useMilestones';
import { ContractAddendumsTab } from '@/components/contracts/ContractAddendumsTab';
import { ContractAddendum } from '@/services/contractAddendumService';
import { ContractExtraTasksSection } from '@/components/contracts/ContractExtraTasksSection';
import {
  ContractOverviewSection,
  ContractFilesSection,
  ContractServicesSection,
  RejectProposalModal,
  UploadProposalModal,
  AssignPmModal,
} from '@/components/contracts/detail';

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
  const params = useLocalSearchParams<{ id: string }>();
  const contractId = String(params.id || '');
  const router = useRouter();
  const { user } = useAuth();
  const isAdminOrBod = isManagementRole(user?.role);

  // TanStack Query for contract detail
  const {
    data: contractData,
    isLoading: isContractLoading,
    isFetching,
    isError: isContractError,
    error: contractError,
    refetch,
  } = useContractDetailQuery(contractId);
  const contract: ContractItem | null = contractData || null;

  // TanStack Query for Debts & Milestones (chuẩn 100% Web FinancialInfo.jsx)
  const { data: debts = [], refetch: refetchDebts } = useDebtsByContractQuery(contractId);
  const { data: milestonesData = [], refetch: refetchMilestones } =
    usePaymentMilestonesByContractQuery(contractId);

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

  // Reject Proposal Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Document Preview Modal State
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const handleOpenPreview = (url: string, fileName?: string) => {
    setPreviewUrl(url);
    setPreviewFileName(fileName || '');
    setIsPreviewVisible(true);
  };

  // Upload Proposal Modal State
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

  const { data: projectData, refetch: refetchProject } = useProjectByContractQuery(contractId);
  const project: ProjectItem | null = projectData || (contract as any)?.project || null;

  const assignProjectMutation = useAssignProjectMutation();
  const isAssigningPm = assignProjectMutation.isPending;

  const [selectedPmId, setSelectedPmId] = useState<string>('');
  const [isPmPickerVisible, setIsPmPickerVisible] = useState(false);

  // Tab Phụ lục hợp đồng & Công việc phát sinh
  const [activeTab, setActiveTab] = useState<'MAIN' | 'ADDENDUM' | 'EXTRA'>('MAIN');

  useEffect(() => {
    if (project) {
      const pmUser = getProjectManagerUser(project);
      setSelectedPmId(pmUser?.id || '');
    } else {
      setSelectedPmId('');
    }
  }, [project]);

  const handleRefresh = () => {
    refetch();
    refetchProject();
    refetchDebts();
    refetchMilestones();
  };

  const handleAssignPmSubmit = async (pmId: string) => {
    if (!contract) return;
    try {
      await assignProjectMutation.mutateAsync({ contractId: contract.id, pmId: pmId || null });
      await Promise.all([refetch(), refetchProject()]);
      Alert.alert('Thành công', 'Phân công PM phụ trách dự án thành công!');
      setIsPmPickerVisible(false);
    } catch (err: any) {
      Alert.alert('Lỗi phân công', err?.message || 'Không thể phân công PM');
    }
  };

  const handleApproveProposal = async () => {
    if (!contract) return;
    Alert.alert('Xác nhận phê duyệt', 'Bạn có chắc chắn muốn phê duyệt Proposal của hợp đồng này?', [
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
        },
      },
    ]);
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
        reason: rejectReason.trim(),
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
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const lower = asset.name.toLowerCase();
        if (
          !lower.endsWith('.docx') &&
          !lower.endsWith('.doc') &&
          !lower.endsWith('.xls') &&
          !lower.endsWith('.xlsx')
        ) {
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
          size: asset.size,
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
          '*/*',
        ],
        copyToCacheDirectory: true,
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
          size: asset.size,
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
        uploadedQuotationFile?.url ||
        (quotationMethod === 'LINK' ? normalizeUrl(quotationLink) : undefined);

      await uploadProposalMutation.mutateAsync({
        id: contract.id,
        payload: {
          file: uploadedFile,
          contractLink: uploadProposalMethod === 'LINK' ? normalizeUrl(proposalLink) : undefined,
          quotationLink: qLink || undefined,
        },
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
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isPdf = asset.name.toLowerCase().endsWith('.pdf') || asset.mimeType === 'application/pdf';
        if (!isPdf) {
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
            size: asset.size,
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
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between px-[16px] py-[12px] bg-white border-b border-b-slate-100">
          <TouchableOpacity
            onPress={() => safeGoBack(router, '/contracts')}
            className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200"
          >
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
      </SafeAreaView>
    );
  }

  const contractCode = contract.contractCode || (contract as any).contract_code || '—';
  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || {
    text: CONTRACT_STATUS_LABELS[contract.status] || contract.status || 'Chưa xác định',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  };

  const sellingPrice = Number(contract.totalWithVat || (contract as any).totalWithVat || 0);
  const costPrice = Number(contract.cost || 0);

  const rawMilestones =
    milestonesData && milestonesData.length > 0 ? milestonesData : contract.milestones || [];
  const rawDebts = debts && debts.length > 0 ? debts : (contract as any).debts || [];

  const processedMilestones = rawMilestones.map((m: any) => {
    const debt = rawDebts.find((d: any) => d.milestone?.id === m.id || d.milestoneId === m.id);
    let paidAmount = 0;
    if (debt) {
      const payments =
        debt.payments?.map((p: any) => ({ ...p, amount: Number(p.amount || 0) })) || [];
      paidAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    } else if (m.status === 'COMPLETED' || m.status === 'PAID') {
      paidAmount = Number(m.amount || 0);
    }

    const amount = Number(m.amount || 0);
    const remaining = Math.max(0, amount - paidAmount);
    const isActive =
      !!debt || m.status === 'COMPLETED' || m.status === 'ACTIVE' || m.status === 'PAID';

    return {
      paidAmount,
      remaining,
      isActive,
    };
  });

  const totalPaid = processedMilestones.reduce((sum, m) => sum + m.paidAmount, 0);
  const totalDebt = processedMilestones.reduce(
    (sum, m) => sum + (m.isActive ? m.remaining : 0),
    0
  );
  const progressPercent = sellingPrice > 0 ? Math.round((totalPaid / sellingPrice) * 100) : 0;

  // Group services into Packages & Standalone
  const packageServices = contract.services?.filter((s) => s.isPackageService) || [];
  const standaloneServices = contract.services?.filter((s) => !s.isPackageService) || [];

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
        jobs?: any[];
      }>;
    }
  > = {};

  packageServices.forEach((item) => {
    const pkgName = item.packageName || 'Gói dịch vụ';
    if (!packagesMap[pkgName]) {
      packagesMap[pkgName] = {
        name: pkgName,
        quantity: 1,
        services: [],
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
        unit: unitName,
        jobs: (item as any).jobs || (item as any).service?.serviceJobs || [],
      });
    }
  });

  const packagesList = Object.values(packagesMap);

  const standaloneList: Array<{
    id?: string;
    name: string;
    quantity: number;
    sellingPrice: number;
    unit: string;
    jobs?: any[];
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
        unit: unitName,
        jobs: (item as any).jobs || (item as any).service?.serviceJobs || [],
      });
    }
  });

  const isProposalAwaiting = contract.status === ContractStatus.PROPOSAL_UPLOADED;
  const userRole = String(user?.role || '').toUpperCase();
  const isLocked = isContractLocked(contract.status as string);
  const addendumList: ContractAddendum[] = Array.isArray((contract as any).addendums)
    ? ((contract as any).addendums as ContractAddendum[])
    : [];
  const extraTasks: any[] =
    (project as any)?.tasks?.filter(
      (t: any) => t.status === 'AWAITING_PRICING' || t.isExtra === true
    ) || [];
  const hasTabs = addendumList.length > 0 || extraTasks.length > 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* 1. TOP BAR */}
      <View className="flex-row items-center justify-between px-[16px] py-[12px] bg-white border-b border-b-slate-100">
        <TouchableOpacity
          onPress={() => safeGoBack(router, '/contracts')}
          activeOpacity={0.7}
          className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200"
        >
          <Feather name="arrow-left" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View className="flex-1 items-center mx-[8px]">
          <Text className="text-[15px] font-extrabold text-slate-900">
            {contractCode !== '—' ? contractCode : 'HỢP ĐỒNG'}
          </Text>
          <Text className="text-[11px] text-slate-500 mt-[1px]">Chi tiết hồ sơ hợp đồng</Text>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          activeOpacity={0.7}
          className="w-[38px] h-[38px] rounded-[10px] bg-slate-50 items-center justify-center border border-slate-200"
        >
          <Feather name="refresh-cw" size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* TAB SWITCHER */}
      {hasTabs && (
        <View className="flex-row items-center gap-[8px] px-[16px] py-[10px] bg-white border-b border-b-slate-100">
          <TouchableOpacity
            onPress={() => setActiveTab('MAIN')}
            activeOpacity={0.8}
            className={`flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[10px] border ${activeTab === 'MAIN' ? 'bg-[#FFF4EA] border-[#FDCB9E]' : 'bg-white border-slate-200'
              }`}
          >
            <Feather
              name="file-text"
              size={14}
              color={activeTab === 'MAIN' ? BrandColors.primary : '#64748B'}
            />
            <Text
              className={`text-[13px] font-bold ${activeTab === 'MAIN' ? 'text-[#D97210]' : 'text-slate-500'
                }`}
            >
              Thông tin
            </Text>
          </TouchableOpacity>

          {extraTasks.length > 0 && (
            <TouchableOpacity
              onPress={() => setActiveTab('EXTRA')}
              activeOpacity={0.8}
              className={`flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[10px] border ${activeTab === 'EXTRA' ? 'bg-[#FFF4EA] border-[#FDCB9E]' : 'bg-white border-slate-200'
                }`}
            >
              <Feather
                name="alert-circle"
                size={14}
                color={activeTab === 'EXTRA' ? BrandColors.primary : '#64748B'}
              />
              <Text
                className={`text-[13px] font-bold ${activeTab === 'EXTRA' ? 'text-[#D97210]' : 'text-slate-500'
                  }`}
              >
                Phát sinh
              </Text>
              <View className="bg-amber-100 px-[6px] py-[1px] rounded-full">
                <Text className="text-[10px] font-black text-amber-800">{extraTasks.length}</Text>
              </View>
            </TouchableOpacity>
          )}

          {addendumList.length > 0 && (
            <TouchableOpacity
              onPress={() => setActiveTab('ADDENDUM')}
              activeOpacity={0.8}
              className={`flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[10px] border ${activeTab === 'ADDENDUM'
                  ? 'bg-[#FFF4EA] border-[#FDCB9E]'
                  : 'bg-white border-slate-200'
                }`}
            >
              <Feather
                name="file-plus"
                size={14}
                color={activeTab === 'ADDENDUM' ? BrandColors.primary : '#64748B'}
              />
              <Text
                className={`text-[13px] font-bold ${activeTab === 'ADDENDUM' ? 'text-[#D97210]' : 'text-slate-500'
                  }`}
              >
                Phụ lục
              </Text>
              <View className="bg-[#F3E8FF] px-[6px] py-[1px] rounded-full">
                <Text className="text-[10px] font-black text-[#7E22CE]">
                  {addendumList.length}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'ADDENDUM' && addendumList.length > 0 ? (
        <ContractAddendumsTab
          contractId={contractId}
          addendums={addendumList}
          role={userRole}
          isLoading={isContractLoading}
          isError={isContractError}
          errorMessage={(contractError as any)?.message}
          isRefreshing={isRefreshing}
          onRetry={handleRefresh}
          onRefresh={handleRefresh}
        />
      ) : activeTab === 'EXTRA' && extraTasks.length > 0 ? (
        <ScrollView
          contentContainerClassName="p-[16px] pb-[120px]"
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
          <ContractExtraTasksSection
            project={project}
            opportunityId={contract?.opportunity?.id || (contract as any)?.opportunityId}
            tasks={extraTasks}
            projectId={project?.id}
            contractId={contractId}
            onRefresh={handleRefresh}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerClassName="p-[16px] pb-[120px]"
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
          {/* Banner read-only khi hợp đồng đã ký duyệt */}
          {isLocked && (
            <View className="flex-row items-start gap-[8px] bg-[#FFF7ED] border border-[#FDCB9E] rounded-[14px] p-[12px] mb-[12px]">
              <Feather name="lock" size={16} color={BrandColors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text className="text-[13px] font-extrabold text-[#9A3412]">
                  Hợp đồng đã ký duyệt — không thể chỉnh sửa
                </Text>
                <Text className="text-[11px] text-[#C2410C] mt-[2px] leading-[15px]">
                  Mọi thao tác thêm/sửa/xóa mốc thanh toán, tải hợp đồng và xóa hợp đồng đã bị khóa.
                </Text>
              </View>
            </View>
          )}

          <View className="gap-[12px]">
            {/* 2. OVERVIEW & CUSTOMER & PROJECT */}
            <ContractOverviewSection
              contract={contract}
              project={project}
              statusConfig={statusConfig}
              isAdminOrBod={isAdminOrBod}
              isAssigningPm={isAssigningPm}
              onOpenPmPicker={() => {
                const pmUser = project ? getProjectManagerUser(project) : null;
                setSelectedPmId(pmUser?.id || '');
                setIsPmPickerVisible(true);
              }}
              formatDate={formatDate}
            />

            {/* 3. PROPOSAL & SIGNED FILES MANAGEMENT */}
            <ContractFilesSection
              contract={contract}
              isLocked={isLocked}
              isAdminOrBod={isAdminOrBod}
              actionLoading={actionLoading}
              isUploadingProposal={isUploadingProposal}
              isUploadingSigned={isUploadingSigned}
              uploadProgress={uploadProgress}
              onOpenPreview={handleOpenPreview}
              onApproveProposal={handleApproveProposal}
              onOpenRejectModal={() => setIsRejectModalVisible(true)}
              onOpenUploadProposal={openProposalEditor}
              onUploadSignedFile={handleUploadSignedFile}
            />

            {/* 4. FINANCIAL SUMMARY & SERVICES */}
            <ContractServicesSection
              sellingPrice={sellingPrice}
              costPrice={costPrice}
              totalPaid={totalPaid}
              totalDebt={totalDebt}
              progressPercent={progressPercent}
              packagesList={packagesList}
              standaloneList={standaloneList}
              isAdminOrBod={isAdminOrBod}
            />

            {/* 5. PAYMENT MILESTONES TRACKER */}
            <MilestoneTrackerTab
              contractId={contract.id}
              contractCode={contract.contractCode}
              sellingPrice={sellingPrice}
              contractStatus={contract.status}
              isReadOnly={
                ['COMPLETED', 'CANCELLED'].includes(contract.status as string) ||
                (project ? ['COMPLETED', 'CANCELLED'].includes(project.status as string) : false)
              }
              onRefresh={handleRefresh}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        visible={isPreviewVisible}
        url={previewUrl}
        fileName={previewFileName}
        onClose={() => setIsPreviewVisible(false)}
      />

      {/* BOD / ADMIN ACTION BAR CHO PROPOSAL NẾU ĐANG CHỜ DUYỆT */}
      {!isLocked && isAdminOrBod && isProposalAwaiting && (
        <View className="flex-row gap-[10px] p-[16px] bg-white border-t border-t-slate-200 shadow-md">
          <TouchableOpacity
            onPress={() => setIsRejectModalVisible(true)}
            disabled={actionLoading}
            activeOpacity={0.85}
            className="flex-1 flex-row items-center justify-center gap-[6px] bg-red-50 border border-red-200 py-[12px] rounded-[10px]"
          >
            <Feather name="x-circle" size={16} color="#DC2626" />
            <Text className="text-[13px] font-bold text-red-600">Từ chối Proposal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleApproveProposal}
            disabled={actionLoading}
            activeOpacity={0.85}
            className="flex-1 flex-row items-center justify-center gap-[6px] bg-emerald-600 py-[12px] rounded-[10px]"
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check-circle" size={16} color="#FFFFFF" />
                <Text className="text-[13px] font-bold text-white">Duyệt Proposal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL NHẬP LÝ DO TỪ CHỐI PROPOSAL */}
      <RejectProposalModal
        visible={isRejectModalVisible}
        rejectReason={rejectReason}
        actionLoading={actionLoading}
        onClose={() => setIsRejectModalVisible(false)}
        onChangeReason={setRejectReason}
        onSubmit={handleRejectProposalSubmit}
      />

      {/* MODAL UPLOAD PROPOSAL */}
      <UploadProposalModal
        visible={isUploadProposalModalVisible}
        uploadMethod={uploadProposalMethod}
        proposalFile={proposalFile}
        proposalLink={proposalLink}
        quotationMethod={quotationMethod}
        quotationFile={quotationFile}
        quotationLink={quotationLink}
        isUploading={isUploadingProposal}
        uploadProgress={uploadProgress}
        onClose={() => {
          if (!isUploadingProposal) setIsUploadProposalModalVisible(false);
        }}
        onSetUploadMethod={setUploadProposalMethod}
        onPickProposalFile={handlePickProposalFile}
        onSetProposalLink={setProposalLink}
        onSetQuotationMethod={setQuotationMethod}
        onPickQuotationFile={handlePickQuotationFile}
        onSetQuotationLink={setQuotationLink}
        onSubmit={handleSubmitProposal}
      />

      {/* MODAL PHÂN CÔNG PM DỰ ÁN */}
      <AssignPmModal
        visible={isPmPickerVisible}
        pmUsers={pmUsers}
        selectedPmId={selectedPmId}
        isAssigning={isAssigningPm}
        onClose={() => setIsPmPickerVisible(false)}
        onSelectPmId={setSelectedPmId}
        onSubmit={handleAssignPmSubmit}
      />
    </SafeAreaView>
  );
}
