import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptic from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { ContractDebtGroup } from '@/services/financeService';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import DatePickerModal from '@/components/common/DatePickerModal';
import { safeGoBack } from '@/utils/navigation';
import { useAuth } from '@/context/AuthContext';
import { canAccessFinance } from '@/utils/rbac';
import {
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
  formatNumberInput,
  parseNumberInput,
} from '@/utils/formatters';
import { useFinanceStore } from '@/stores/useFinanceStore';
import {
  useContractDebtsQuery,
  useActivateDebtMutation,
  useCreatePaymentMutation,
  useDeletePaymentMutation,
  useBulkSaveMilestonesMutation,
} from '@/hooks/queries';

const PRESET_OPTIONS: Array<{ key: 'this_month' | 'last_month' | 'this_quarter' | 'all'; label: string }> = [
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
  { key: 'this_quarter', label: 'Quý này' },
  { key: 'all', label: 'Tất cả' },
];

const DEBT_STATUS_OPTIONS: Array<{ key: 'ALL' | 'HAS_DEBT' | 'NO_DEBT'; label: string }> = [
  { key: 'ALL', label: 'Tất cả công nợ' },
  { key: 'HAS_DEBT', label: 'Còn nợ cần thu' },
  { key: 'NO_DEBT', label: 'Đã hoàn thành thu' },
];

export default function FinanceDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAccess = canAccessFinance(user?.role);
  const roadmapScrollViewRef = useRef<ScrollView>(null);
  const [proofSubmissionType, setProofSubmissionType] = useState<'file' | 'link'>('file');

  // TanStack Query Hooks for Network Data & Mutations
  const {
    data: contractGroups = [],
    isLoading: loading,
    refetch,
    isRefetching: refreshing,
  } = useContractDebtsQuery();

  const activateDebtMutation = useActivateDebtMutation();
  const createPaymentMutation = useCreatePaymentMutation();
  const deletePaymentMutation = useDeletePaymentMutation();
  const bulkSaveMilestonesMutation = useBulkSaveMilestonesMutation();

  // Zustand Store Hooks for UI & Form Draft States
  const {
    viewType,
    searchTerm,
    preset,
    debtStatusFilter,
    expandedContracts,
    // Payment Modal State
    selectedMilestone,
    showPaymentModal,
    paymentAmount,
    paymentDate,
    paymentNote,
    paymentProofFile,
    paymentProofLink,
    // Roadmap Modal State
    selectedContractForRoadmap,
    showRoadmapModal,
    editableMilestones,
    // Date Picker Modal State
    showDatePickerModal,
    datePickerTarget,
    // Store Actions
    setViewType,
    setSearchTerm,
    setPreset,
    setDebtStatusFilter,
    resetFilters,
    toggleContractExpand,
    setExpandedContracts,
    openPaymentModal,
    closePaymentModal,
    setPaymentAmount,
    setPaymentDate,
    setPaymentNote,
    setPaymentProofFile,
    setPaymentProofLink,
    openRoadmapModal,
    closeRoadmapModal,
    addRoadmapRow,
    removeRoadmapRow,
    updateRoadmapRow,
    openDatePickerForMilestone,
    openDatePickerForPayment,
    closeDatePicker,
    confirmDateSelection,
  } = useFinanceStore();

  // Automatically expand first contract group on initial data load if none expanded
  useEffect(() => {
    if (contractGroups.length > 0 && Object.keys(expandedContracts).length === 0) {
      setExpandedContracts({ [contractGroups[0].id]: true });
    }
  }, [contractGroups, expandedContracts, setExpandedContracts]);

  const handleRefresh = () => {
    Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
    refetch();
  };

  const formatVND = (amount?: number) => {
    if (amount === undefined || amount === null) return '0 ₫';
    return amount.toLocaleString('vi-VN') + ' ₫';
  };

  // Filtered Contract Groups
  const filteredContracts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return contractGroups.filter((group) => {
      if (term) {
        const matchCode = group.contractCode.toLowerCase().includes(term);
        const matchCustomer = group.customerName.toLowerCase().includes(term);
        if (!matchCode && !matchCustomer) return false;
      }

      if (debtStatusFilter === 'HAS_DEBT' && group.totalDebt <= 0) return false;
      if (debtStatusFilter === 'NO_DEBT' && group.totalDebt > 0) return false;

      return true;
    });
  }, [contractGroups, searchTerm, debtStatusFilter]);

  // Executive Stats dynamically calculated from filtered data
  const stats = useMemo(() => {
    const planned = filteredContracts.reduce(
      (sum, c) => sum + c.milestones.reduce((mSum, m) => mSum + m.amount, 0),
      0
    );
    const collected = filteredContracts.reduce((sum, c) => sum + c.totalPaid, 0);
    const pending = filteredContracts.reduce((sum, c) => sum + c.totalDebt, 0);
    const collectionRate = planned > 0 ? Math.min(100, Math.round((collected / planned) * 100)) : 0;
    const contractsCount = filteredContracts.length;

    return { planned, collected, pending, collectionRate, contractsCount };
  }, [filteredContracts]);

  // Flattened Milestones for Schedule View
  const allMilestones = useMemo(() => {
    return filteredContracts.flatMap((cg) =>
      cg.milestones.map((m) => ({
        ...m,
        contractCode: cg.contractCode,
        customerName: cg.customerName,
      }))
    );
  }, [filteredContracts]);

  const onActivateDebt = async (milestoneId: string) => {
    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      await activateDebtMutation.mutateAsync(milestoneId);
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Đã kích hoạt', 'Đã kích hoạt công nợ cho đợt thanh toán này.');
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Không thể kích hoạt', err?.message || 'Vui lòng thử lại sau.');
    }
  };

  const handlePickProofFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPaymentProofFile({
          name: asset.name,
          size: asset.size ?? undefined,
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
        });
      }
    } catch (err) {
      console.log('Lỗi chọn tệp minh chứng:', err);
      Alert.alert('Lỗi', 'Không thể chọn tệp minh chứng.');
    }
  };

  const onSavePayment = async () => {
    if (!selectedMilestone) return;
    const debtId = selectedMilestone.debt?.id || selectedMilestone.id;
    const amountNum = parseNumberInput(paymentAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập số tiền thanh toán hợp lệ.');
      return;
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Heavy);
      await createPaymentMutation.mutateAsync({
        debtId: String(debtId),
        amount: amountNum,
        paymentDate: formatDateToYYYYMMDD(paymentDate) || formatDateToYYYYMMDD(new Date()),
        note: paymentNote,
        proofFile: paymentProofFile || undefined,
        proofLink: paymentProofLink ? paymentProofLink.trim() : undefined,
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã ghi nhận giao dịch thanh toán.');
      closePaymentModal();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Không thể ghi nhận', err?.message || 'Vui lòng thử lại sau.');
    }
  };

  const onDeletePayment = (paymentId: string) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa lịch sử thanh toán này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
              await deletePaymentMutation.mutateAsync(paymentId);
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa ghi nhận thanh toán.');
              closePaymentModal();
            } catch (err: any) {
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert('Lỗi', err?.message || 'Không thể xóa ghi nhận thanh toán.');
            }
          },
        },
      ]
    );
  };

  const onAddRoadmapRow = () => {
    Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
    addRoadmapRow();
    setTimeout(() => {
      roadmapScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const roadmapTotalPercent = Math.round(
    editableMilestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0) * 100
  ) / 100;
  const contractPrice = selectedContractForRoadmap?.sellingPrice || 0;

  const onSaveRoadmap = async () => {
    if (!selectedContractForRoadmap) return;

    if (editableMilestones.length > 0) {
      for (let i = 0; i < editableMilestones.length; i++) {
        const m = editableMilestones[i];
        if (!m.dueDate || !String(m.dueDate).trim()) {
          Alert.alert(
            'Thiếu Hạn thanh toán',
            `Vui lòng chọn hoặc nhập Hạn thanh toán cho Đợt #${i + 1} (${m.name || 'Đợt thanh toán'}).`
          );
          return;
        }
      }

      if (roadmapTotalPercent !== 100) {
        Alert.alert(
          'Lỗi tổng tỷ lệ',
          `Tổng tỷ lệ các đợt phải bằng 100% (hiện tại: ${roadmapTotalPercent}%).`
        );
        return;
      }
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Heavy);
      await bulkSaveMilestonesMutation.mutateAsync({
        contractId: selectedContractForRoadmap.id,
        milestones: editableMilestones.map((m) => ({
          id: m.id,
          name: m.name,
          percentage: Number(m.percentage) || 0,
          amount: parseNumberInput(String(m.amount)),
          dueDate: formatDateToYYYYMMDD(m.dueDate),
        })),
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật lộ trình thanh toán cho hợp đồng.');
      closeRoadmapModal();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Không thể lưu lộ trình', err?.message || 'Vui lòng thử lại sau.');
    }
  };

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
            onPress={() => router.replace('/')}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Quản lý Tài chính</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 justify-center items-center p-8 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-2">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Giới hạn quyền truy cập</Text>
          <Text className="text-[13px] text-slate-500 text-center leading-5 max-w-[280px]">
            Phân hệ Tài chính chỉ dành riêng cho Ban Giám đốc (Admin/BOD) và Bộ phận Kế toán.
          </Text>
          <TouchableOpacity
            className="mt-3 bg-primary px-5 py-3 rounded-xl min-h-[44px] justify-center"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  const renderContractGroupCard = (contract: ContractDebtGroup) => {
    const isExpanded = !!expandedContracts[contract.id];
    const progressPercent =
      contract.sellingPrice > 0
        ? Math.min(100, Math.round((contract.totalPaid / contract.sellingPrice) * 100))
        : 0;
    const isContractFullyPaid = progressPercent >= 100 ;

    return (
      <View
        key={contract.id}
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-4"
      >
        {/* Accordion Header */}
        <TouchableOpacity
          className="p-4 bg-white border-b border-slate-100 gap-2"
          onPress={() => {
            Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
            toggleContractExpand(contract.id);
          }}
          activeOpacity={0.8}
        >
          {/* Row 1: Customer Name & Contract Code + Chevron */}
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-extrabold text-slate-900 flex-1 mr-1" numberOfLines={1}>
              {contract.customerName}
            </Text>

            <View className="flex-row items-center gap-1.5 shrink-0">
              <Text className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                {contract.contractCode}
              </Text>
              <Feather
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#64748B"
              />
            </View>
          </View>

          {/* Row 2: Contract Selling Price & Remaining Debt */}
          <View className="flex-row items-center justify-between pt-1 border-t border-slate-100/60">
            <View className="flex-row items-center gap-1 flex-1 mr-2">
              <Text className="text-xs text-slate-400 font-medium">Giá trị HĐ:</Text>
              <Text className="text-xs font-extrabold text-slate-800" numberOfLines={1}>
                {formatVND(contract.sellingPrice)}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 shrink-0">
              <Text className="text-xs text-slate-400 font-medium">Cần thu:</Text>
              <Text
                className={`text-xs font-extrabold ${
                  contract.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {formatVND(contract.totalDebt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Progress Bar & Manage Roadmap Action */}
        <View className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1 max-w-[160px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">TIẾN ĐỘ</Text>
            <View className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
            <Text className="text-[10px] font-bold text-emerald-700">{progressPercent}%</Text>
          </View>

          {/* Nút Quản lý / Sửa lộ trình thanh toán (Ẩn nếu hợp đồng đã 100%) */}
          {!isContractFullyPaid && (
            <TouchableOpacity
              className="flex-row items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-xs"
              onPress={() => openRoadmapModal(contract)}
              activeOpacity={0.8}
            >
              <Feather name="edit-3" size={12} color="#4F46E5" />
              <Text className="text-[11px] font-bold text-indigo-600">Sửa lộ trình</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Milestones Journey Timeline */}
        {isExpanded && (
          <View className="p-4 gap-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lộ trình thanh toán ({contract.milestones.length} đợt)
              </Text>

              {!isContractFullyPaid && (
                <TouchableOpacity
                  className="flex-row items-center gap-1 text-indigo-600"
                  onPress={() => openRoadmapModal(contract)}
                >
                  <Feather name="plus-circle" size={13} color="#4F46E5" />
                  <Text className="text-xs font-bold text-indigo-600">Thêm / Chỉnh sửa</Text>
                </TouchableOpacity>
              )}
            </View>

            {contract.milestones.map((m, idx) => {
              const isPlanned = m.status === 'PLANNED';
              const isActive = m.status === 'ACTIVE';
              const isCompleted = m.status === 'COMPLETED';
              const isOverdue =
                isActive && m.dueDate && new Date(m.dueDate) < new Date();
              const isActivating = activateDebtMutation.isPending && activateDebtMutation.variables === m.id;

              return (
                <View
                  key={m.id || idx}
                  className={`p-3.5 rounded-xl border ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-100'
                      : isActive
                      ? 'bg-blue-50/30 border-blue-100'
                      : 'bg-white border-dashed border-slate-200'
                  }`}
                >
                  {/* Milestone Name & Status */}
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <View
                        className={`w-6 h-6 rounded-md items-center justify-center ${
                          isCompleted
                            ? 'bg-emerald-600'
                            : isActive
                            ? 'bg-indigo-600'
                            : 'bg-slate-300'
                        }`}
                      >
                        {isCompleted ? (
                          <Feather name="check" size={14} color="#FFFFFF" />
                        ) : (
                          <Text className="text-[10px] font-bold text-white">
                            {idx + 1}
                          </Text>
                        )}
                      </View>

                      <Text
                        className="text-xs font-bold text-slate-800"
                        numberOfLines={1}
                      >
                        {m.name}
                      </Text>

                      {m.percentage !== undefined && m.percentage !== null && (
                        <View className="bg-slate-100 px-1.5 py-0.5 rounded">
                          <Text className="text-[10px] font-bold text-slate-600">{m.percentage}%</Text>
                        </View>
                      )}
                    </View>

                    {/* Status Badge */}
                    <View
                      className={`px-2 py-0.5 rounded-md shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-100'
                          : isActive
                          ? isOverdue
                            ? 'bg-rose-100'
                            : 'bg-indigo-100'
                          : 'bg-slate-100'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-bold uppercase ${
                          isCompleted
                            ? 'text-emerald-800'
                            : isActive
                            ? isOverdue
                              ? 'text-rose-800'
                              : 'text-indigo-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {isCompleted
                          ? 'ĐÃ THU'
                          : isActive
                          ? isOverdue
                            ? 'QUÁ HẠN'
                            : 'ĐANG THU'
                          : 'CHƯA KÍCH HOẠCH'}
                      </Text>
                    </View>
                  </View>

                  {/* Amounts & Due Date & Actions */}
                  <View className="flex-row items-center justify-between pt-2 border-t border-slate-100/60 mt-1">
                    <View className="gap-1 flex-1 mr-2">
                      <Text className="text-[10px] text-slate-400 font-semibold">
                        {m.dueDate ? `Hạn: ${formatDateToDDMMYYYY(m.dueDate)}` : 'Chưa có hạn'}
                      </Text>
                      <View className="gap-0.5">
                        <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                          Giá trị: {formatVND(m.amount)}
                        </Text>
                        {m.paidAmount > 0 ? (
                          <Text className="text-[11px] font-bold text-emerald-600" numberOfLines={1}>
                            • Đã thu: {formatVND(m.paidAmount)}
                          </Text>
                        ) : null}
                        {m.remaining > 0 && !isPlanned ? (
                          <Text className="text-[11px] font-bold text-rose-500" numberOfLines={1}>
                            • Cần thu: {formatVND(m.remaining)}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Milestone Actions */}
                    <View className="items-end shrink-0">
                      {isPlanned && (
                        <TouchableOpacity
                          className="bg-indigo-600 px-3 py-2 rounded-xl min-h-[38px] justify-center items-center shadow-xs flex-row items-center gap-1.5"
                          onPress={() => onActivateDebt(m.id)}
                          disabled={isActivating}
                          activeOpacity={0.8}
                        >
                          {isActivating ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="zap" size={13} color="#FFFFFF" />
                              <Text className="text-xs font-bold text-white">
                                Kích hoạt công nợ
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {(isActive || isCompleted) && (
                        <TouchableOpacity
                          className={`px-3 py-2 rounded-xl min-h-[38px] justify-center items-center shadow-xs flex-row items-center gap-1.5 ${
                            isCompleted ? 'bg-slate-100 border border-slate-200' : 'bg-emerald-600'
                          }`}
                          onPress={() => openPaymentModal(m)}
                          activeOpacity={0.8}
                        >
                          <Feather name="credit-card" size={13} color={isCompleted ? '#475569' : '#FFFFFF'} />
                          <Text className={`text-xs font-bold ${isCompleted ? 'text-slate-700' : 'text-white'}`}>
                            {isCompleted ? 'Lịch sử thanh toán' : 'Ghi nhận thanh toán'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header Area */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">Quản lý tài chính</Text>

        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/finance/overview' as any)}
        className="mx-4 mt-3 min-h-12 flex-row items-center rounded-2xl border border-orange-200 bg-orange-50 px-4"
        accessibilityRole="button"
        accessibilityLabel="Mở thanh toán và chứng từ dự án"
      >
        <Feather name="file-text" size={20} color="#F38820" />
        <View className="ml-3 flex-1">
          <Text className="text-sm font-extrabold text-orange-800">Thanh toán & chứng từ dự án</Text>
          <Text className="text-[11px] text-orange-700">Tổng quan · BBNT · Hóa đơn VAT</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#F38820" />
      </TouchableOpacity>

      {loading ? (
        <View className="flex-1 justify-center items-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-xs text-slate-400">
            Đang tải hợp đồng, công nợ và mốc thanh toán...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={BrandColors.primary}
            />
          }
        >
          {/* TOOLBAR BỘ LỌC */}
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4 gap-3">
            {/* 1. Thanh Tìm kiếm Mã HĐ / Khách hàng */}
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                className="flex-1 ml-2 text-sm text-slate-900 p-0"
                placeholder="Tìm mã hợp đồng, khách hàng..."
                placeholderTextColor="#94A3B8"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm ? (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Feather name="x-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 2. Bộ lọc thời gian (Presets) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = preset === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    className={`px-3 py-1.5 rounded-lg border min-h-[32px] justify-center items-center mr-1.5 ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                    onPress={() => {
                      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                      setPreset(opt.key);
                    }}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-indigo-600' : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 3. Bộ lọc trạng thái công nợ & Reset */}
            <View className="flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 flex-row">
                {DEBT_STATUS_OPTIONS.map((opt) => {
                  const isSelected = debtStatusFilter === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      className={`px-2.5 py-1 rounded-md border min-h-[28px] justify-center items-center mr-1.5 ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900'
                          : 'bg-white border-slate-200'
                      }`}
                      onPress={() => {
                        Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                        setDebtStatusFilter(opt.key);
                      }}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          isSelected ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                className="flex-row items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md min-h-[28px]"
                onPress={() => {
                  Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                  resetFilters();
                }}
              >
                <Feather name="rotate-ccw" size={12} color="#64748B" />
                <Text className="text-[11px] font-bold text-slate-600">Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Executive 4 Metric Cards */}
          <View className="gap-3 mb-4">
            <View className="flex-row gap-3">
              {/* Card 1: Dự kiến trong kỳ */}
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Dự kiến trong kỳ
                </Text>
                <Text className="text-base font-black text-slate-900" numberOfLines={1}>
                  {formatVND(stats.planned)}
                </Text>
              </View>

              {/* Card 2: Đã thu trong kỳ */}
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Đã thu trong kỳ
                  </Text>
                  <Text className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                    {stats.collectionRate}%
                  </Text>
                </View>
                <Text className="text-base font-black text-emerald-600" numberOfLines={1}>
                  {formatVND(stats.collected)}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              {/* Card 3: Còn phải thu */}
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Còn phải thu
                </Text>
                <Text className="text-base font-black text-rose-600" numberOfLines={1}>
                  {formatVND(stats.pending)}
                </Text>
              </View>

              {/* Card 4: Hợp đồng liên quan */}
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Hợp đồng liên quan
                </Text>
                <Text className="text-base font-black text-slate-800" numberOfLines={1}>
                  {stats.contractsCount} hợp đồng
                </Text>
              </View>
            </View>
          </View>

          {/* Mode Switcher Tabs */}
          <View className="flex-row bg-slate-200/60 p-1 rounded-2xl mb-4">
            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-xl items-center justify-center min-h-[40px] flex-row gap-1.5 ${
                viewType === 'list' ? 'bg-white shadow-xs' : ''
              }`}
              onPress={() => {
                Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                setViewType('list');
              }}
            >
              <Feather
                name="list"
                size={14}
                color={viewType === 'list' ? '#0F172A' : '#64748B'}
              />
              <Text
                className={`text-xs font-bold ${
                  viewType === 'list' ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                Hợp đồng ({filteredContracts.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-xl items-center justify-center min-h-[40px] flex-row gap-1.5 ${
                viewType === 'schedule' ? 'bg-white shadow-xs' : ''
              }`}
              onPress={() => {
                Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                setViewType('schedule');
              }}
            >
              <Feather
                name="calendar"
                size={14}
                color={viewType === 'schedule' ? '#0F172A' : '#64748B'}
              />
              <Text
                className={`text-xs font-bold ${
                  viewType === 'schedule' ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                Lịch trình ({allMilestones.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* View 1: List View */}
          {viewType === 'list' && (
            <View>
              {filteredContracts.length === 0 ? (
                <View className="py-10 items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 p-6">
                  <Feather name="file-text" size={36} color="#CBD5E1" />
                  <Text className="text-sm font-bold text-slate-600">
                    Không có hợp đồng nào phù hợp bộ lọc
                  </Text>
                </View>
              ) : (
                filteredContracts.map(renderContractGroupCard)
              )}
            </View>
          )}

          {/* View 2: Schedule View */}
          {viewType === 'schedule' && (
            <View className="gap-3">
              {allMilestones.length === 0 ? (
                <View className="py-10 items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 p-6">
                  <Feather name="calendar" size={36} color="#CBD5E1" />
                  <Text className="text-sm font-bold text-slate-600">
                    Không có mốc thanh toán nào phù hợp bộ lọc
                  </Text>
                </View>
              ) : (
                allMilestones.map((m, idx) => {
                  const isCompleted = m.status === 'COMPLETED';
                  const isActive = m.status === 'ACTIVE';

                  return (
                    <View
                      key={m.id || idx}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm gap-2"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs font-bold text-indigo-600 flex-1 mr-2" numberOfLines={1}>
                          {m.contractCode} • {m.customerName}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded-md shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-100'
                              : isActive
                              ? 'bg-indigo-100'
                              : 'bg-slate-100'
                          }`}
                        >
                          <Text
                            className={`text-[9px] font-bold uppercase ${
                              isCompleted
                                ? 'text-emerald-800'
                                : isActive
                                ? 'text-indigo-800'
                                : 'text-slate-500'
                            }`}
                          >
                            {isCompleted
                              ? 'ĐÃ THU'
                              : isActive
                              ? 'ĐANG THU'
                              : 'CHƯA KÍCH HOẠCH'}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-sm font-bold text-slate-900">{m.name}</Text>

                      <View className="flex-row items-center justify-between border-t border-slate-100 pt-2">
                        <Text className="text-xs text-slate-500">
                          Hạn thanh toán: {m.dueDate || 'N/A'}
                        </Text>
                        <Text className="text-sm font-black text-slate-900">
                          {formatVND(m.amount)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* 1. Modal Record & Payment History */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={closePaymentModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 h-[85%] max-h-[85%] flex-col gap-4">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <View className="flex-1 mr-2">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {selectedMilestone?.name || 'Chi tiết thanh toán'}
                </Text>
                <Text className="text-xs font-semibold text-slate-500">
                  Số tiền đợt: {formatVND(selectedMilestone?.amount)}
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                onPress={closePaymentModal}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {/* SECTION 1: GHI NHẬN THANH TOÁN MỚI (Ẩn nếu đã hoàn thành 100%) */}
              {(selectedMilestone?.status === 'COMPLETED' || ((selectedMilestone?.paidAmount || 0) >= (selectedMilestone?.amount || 0) && (selectedMilestone?.amount || 0) > 0)) ? (
                <View className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-emerald-100 justify-center items-center shrink-0">
                    <Feather name="check-circle" size={20} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-emerald-900">
                      Đợt thanh toán đã hoàn thành 100%
                    </Text>
                    <Text className="text-xs text-emerald-700 mt-0.5">
                      Đã thu đủ {formatVND(selectedMilestone?.amount)}. Bạn không cần ghi nhận thêm thanh toán nào cho đợt này.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200 gap-3">
                  <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    GHI NHẬN THANH TOÁN MỚI
                  </Text>

                  <View className="gap-1">
                    <Text className="text-xs font-bold text-slate-700 uppercase">SỐ TIỀN *</Text>
                    <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                      <TextInput
                        className="flex-1 text-sm text-slate-900 font-bold p-0"
                        keyboardType="numeric"
                        value={paymentAmount}
                        onChangeText={(val) => setPaymentAmount(formatNumberInput(val))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text className="text-xs font-bold text-slate-500 ml-1">VNĐ</Text>
                    </View>
                  </View>

                  <View className="gap-1">
                    <Text className="text-xs font-bold text-slate-700 uppercase">
                      NGÀY THANH TOÁN <Text className="text-rose-500">*</Text>
                    </Text>
                    <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                      <TouchableOpacity
                        onPress={() => openDatePickerForPayment(paymentDate)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="mr-2.5"
                      >
                        <Feather name="calendar" size={16} color="#4F46E5" />
                      </TouchableOpacity>
                      <TextInput
                        className="flex-1 text-sm text-slate-900 font-semibold p-0"
                        value={paymentDate}
                        onChangeText={setPaymentDate}
                        placeholder="DD-MM-YYYY"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>
                  </View>

                  <View className="gap-1">
                    <Text className="text-xs font-bold text-slate-700 uppercase">GHI CHÚ</Text>
                    <TextInput
                      className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 min-h-[60px]"
                      multiline
                      textAlignVertical="top"
                      value={paymentNote}
                      onChangeText={setPaymentNote}
                      placeholder="Nhập ghi chú..."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* MINH CHỨNG (UNC / BILL CHUYỂN KHOẢN) */}
                  <View className="gap-2">
                    <Text className="text-xs font-bold text-slate-700 uppercase">
                      MINH CHỨNG (UNC / BILL CHUYỂN KHOẢN)
                    </Text>

                    {/* Segmented Tab Switcher */}
                    <View className="flex-row p-1 bg-slate-100 rounded-xl gap-1">
                      <TouchableOpacity
                        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                          proofSubmissionType === 'file' ? 'bg-white shadow-xs' : ''
                        }`}
                        onPress={() => setProofSubmissionType('file')}
                      >
                        <Feather
                          name="upload"
                          size={14}
                          color={proofSubmissionType === 'file' ? '#F38820' : '#64748B'}
                        />
                        <Text
                          className={`text-xs ${
                            proofSubmissionType === 'file' ? 'font-bold text-amber-600' : 'font-semibold text-slate-500'
                          }`}
                        >
                          Tải file
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                          proofSubmissionType === 'link' ? 'bg-white shadow-xs' : ''
                        }`}
                        onPress={() => setProofSubmissionType('link')}
                      >
                        <Feather
                          name="link"
                          size={14}
                          color={proofSubmissionType === 'link' ? '#F38820' : '#64748B'}
                        />
                        <Text
                          className={`text-xs ${
                            proofSubmissionType === 'link' ? 'font-bold text-amber-600' : 'font-semibold text-slate-500'
                          }`}
                        >
                          Gửi link
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Tab Content 1: Tải file */}
                    {proofSubmissionType === 'file' && (
                      <View className="gap-2 mt-1">
                        <TouchableOpacity
                          className="border-2 border-dashed border-slate-300 rounded-2xl p-6 items-center bg-slate-50/50 gap-2"
                          onPress={handlePickProofFile}
                          activeOpacity={0.7}
                        >
                          <View className="w-12 h-12 rounded-full bg-orange-100/70 items-center justify-center">
                            <Feather name="upload-cloud" size={24} color="#F38820" />
                          </View>
                          <Text className="text-sm font-bold text-slate-900 text-center" numberOfLines={1}>
                            {paymentProofFile ? paymentProofFile.name : 'Nhấn để chọn file minh chứng'}
                          </Text>
                          <Text className="text-xs text-slate-400 text-center">
                            Chấp nhận file hình ảnh, PDF, Word, Excel...
                          </Text>
                        </TouchableOpacity>

                        {paymentProofFile && (
                          <TouchableOpacity
                            className="flex-row items-center justify-center gap-1.5 py-1"
                            onPress={() => setPaymentProofFile(null)}
                          >
                            <Feather name="trash-2" size={13} color="#EF4444" />
                            <Text className="text-xs font-bold text-rose-500">Gỡ bỏ file đã chọn</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Tab Content 2: Gửi link */}
                    {proofSubmissionType === 'link' && (
                      <View className="gap-2 mt-1">
                        <Text className="text-[10px] font-extrabold text-slate-500 tracking-wider">
                          ĐƯỜNG DẪN MINH CHỨNG *
                        </Text>
                        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                          <Feather name="link" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                          <TextInput
                            className="flex-1 py-1 text-xs text-slate-900 font-medium p-0"
                            placeholder="https://drive.google.com/..."
                            placeholderTextColor="#94A3B8"
                            value={paymentProofLink}
                            onChangeText={setPaymentProofLink}
                            autoCapitalize="none"
                            keyboardType="url"
                          />
                          {paymentProofLink ? (
                            <TouchableOpacity onPress={() => setPaymentProofLink('')}>
                              <Feather name="x-circle" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Text className="text-[11px] text-slate-400 italic">
                          * Vui lòng đảm bảo quyền truy cập link cho quản lý và kế toán.
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    className="mt-1 bg-blue-600 py-3.5 rounded-xl items-center justify-center min-h-[48px]"
                    onPress={onSavePayment}
                    disabled={createPaymentMutation.isPending}
                    activeOpacity={0.8}
                  >
                    {createPaymentMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Xác nhận thanh toán</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* SECTION 2: LỊCH SỬ THANH TOÁN */}
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    LỊCH SỬ THANH TOÁN
                  </Text>
                  <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    <Text className="text-[10px] font-bold text-indigo-700">
                      {selectedMilestone?.payments?.length || 0} Đợt
                    </Text>
                  </View>
                </View>

                {selectedMilestone?.payments && selectedMilestone.payments.length > 0 ? (
                  <View className="gap-2">
                    {selectedMilestone.payments.map((p: any, idx: number) => (
                      <View
                        key={p.id || idx}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex-row items-center justify-between gap-2"
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <View className="w-9 h-9 rounded-xl bg-emerald-50 justify-center items-center">
                            <Feather name="credit-card" size={16} color="#059669" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-black text-slate-900">
                              {formatVND(p.amount)}
                            </Text>
                            <Text className="text-xs text-slate-500 mt-0.5">
                              {p.paymentDate ? formatDateToDDMMYYYY(p.paymentDate) : p.createdAt ? formatDateToDDMMYYYY(p.createdAt) : 'Vừa xong'}
                              {p.note ? ` • ${p.note}` : ''}
                            </Text>

                            {(p.proofFile || p.proof_file || p.proofLink || p.proof_link) ? (
                              <View className="flex-row items-center gap-2 mt-1">
                                {(p.proofFile || p.proof_file) ? (
                                  <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 gap-1">
                                    <Feather name="paperclip" size={10} color="#059669" />
                                    <Text className="text-[10px] font-bold text-emerald-700" numberOfLines={1}>
                                      {(p.proofFile?.name || p.proof_file?.name || 'File đính kèm')}
                                    </Text>
                                  </View>
                                ) : null}
                                {(p.proofLink || p.proof_link) ? (
                                  <View className="flex-row items-center bg-blue-50 px-2 py-0.5 rounded border border-blue-200 gap-1">
                                    <Feather name="link" size={10} color="#2563EB" />
                                    <Text className="text-[10px] font-bold text-blue-700" numberOfLines={1}>
                                      Link minh chứng
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <TouchableOpacity
                          className="w-8 h-8 rounded-lg bg-rose-50 items-center justify-center border border-rose-100"
                          onPress={() => onDeletePayment(p.id)}
                          disabled={deletePaymentMutation.isPending}
                        >
                          {deletePaymentMutation.isPending && deletePaymentMutation.variables === p.id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Feather name="trash-2" size={15} color="#EF4444" />
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}

                    <View className="border-t border-slate-200 pt-3 mt-1 px-1 gap-2">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-slate-500 uppercase">TỔNG ĐÃ NỘP</Text>
                        <Text className="text-base font-black text-emerald-600">
                          {formatVND(selectedMilestone.paidAmount)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-slate-500 uppercase">CÒN LẠI CHƯA THU</Text>
                        <Text className={`text-base font-black ${(selectedMilestone.remaining ?? Math.max(0, (selectedMilestone.amount || 0) - (selectedMilestone.paidAmount || 0))) > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                          {formatVND(selectedMilestone.remaining ?? Math.max(0, (selectedMilestone.amount || 0) - (selectedMilestone.paidAmount || 0)))}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="bg-slate-50 border border-slate-100 rounded-xl p-4 items-center gap-2">
                    <Text className="text-xs text-slate-400 italic">Chưa có lịch sử ghi nhận thanh toán nào.</Text>
                    {selectedMilestone && (
                      <View className="flex-row justify-between items-center w-full pt-2 border-t border-slate-200/60 mt-1">
                        <Text className="text-xs font-bold text-slate-500 uppercase">CÒN LẠI CHƯA THU</Text>
                        <Text className="text-sm font-black text-rose-500">
                          {formatVND(selectedMilestone.remaining ?? selectedMilestone.amount)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Modal Quản lý kế hoạch thanh toán */}
      <Modal
        visible={showRoadmapModal}
        transparent
        animationType="slide"
        onRequestClose={closeRoadmapModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 h-[85%] max-h-[85%] flex-col gap-3">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <View className="flex-1 mr-2">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  Quản lý kế hoạch thanh toán
                </Text>
                <Text className="text-xs font-bold text-indigo-600">
                  {selectedContractForRoadmap?.contractCode} • {selectedContractForRoadmap?.customerName}
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center min-h-[44px] min-w-[44px]"
                onPress={closeRoadmapModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Contract Banner */}
            <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex-row justify-between items-center">
              <View>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIÁ TRỊ HỢP ĐỒNG</Text>
                <Text className="text-base font-black text-slate-900">
                  {formatVND(contractPrice)}
                </Text>
              </View>

              <View className="items-end">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TỔNG TỶ LỆ CÁC ĐỢT</Text>
                <Text
                  className={`text-base font-black ${
                    roadmapTotalPercent === 100 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {roadmapTotalPercent}% / 100%
                </Text>
              </View>
            </View>

            {/* Section Header: LỘ TRÌNH THANH TOÁN + Thêm đợt */}
            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                LỘ TRÌNH THANH TOÁN ({editableMilestones.length} đợt)
              </Text>

              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 min-h-[44px]"
                onPress={onAddRoadmapRow}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="plus" size={16} color="#4F46E5" />
                <Text className="text-xs font-extrabold text-indigo-600">Thêm đợt</Text>
              </TouchableOpacity>
            </View>

            {/* Editable Milestones Rows */}
            <ScrollView
              ref={roadmapScrollViewRef}
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            >
              {editableMilestones.length === 0 ? (
                <View className="py-8 items-center justify-center gap-3">
                  <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
                    <Feather name="calendar" size={24} color="#94A3B8" />
                  </View>
                  <Text className="text-sm font-bold text-slate-500 text-center">
                    Chưa có đợt thanh toán nào
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 bg-indigo-600 px-4 py-2.5 rounded-xl min-h-[44px]"
                    onPress={onAddRoadmapRow}
                  >
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white">Thêm đợt đầu tiên</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                editableMilestones.map((m, idx) => (
                  <View key={`milestone-row-${idx}`} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-extrabold text-slate-800">
                        Đợt #{idx + 1}
                      </Text>

                      <TouchableOpacity
                        className="w-8 h-8 rounded-xl bg-rose-50 items-center justify-center border border-rose-100 min-h-[32px]"
                        onPress={() => {
                          Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
                          removeRoadmapRow(idx);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-1">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase">TÊN ĐỢT</Text>
                      <TextInput
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                        value={String(m.name || '')}
                        onChangeText={(val) => updateRoadmapRow(idx, 'name', val)}
                        placeholder="VD: Thanh toán đợt 1 / Tạm ứng"
                      />
                    </View>

                    <View className="flex-row gap-2">
                      <View className="w-[96px] shrink-0 gap-1">
                        <Text className="text-[10px] font-bold text-slate-500 uppercase">TỶ LỆ (%)</Text>
                        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 min-h-[44px]">
                          <TextInput
                            className="flex-1 text-xs text-slate-900 font-bold text-center p-0"
                            keyboardType="numeric"
                            value={String(m.percentage ?? '')}
                            onChangeText={(val) => updateRoadmapRow(idx, 'percentage', val)}
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text className="text-xs font-bold text-slate-500 ml-0.5">%</Text>
                        </View>
                      </View>

                      <View className="flex-1 gap-1">
                        <Text className="text-[10px] font-bold text-slate-500 uppercase">SỐ TIỀN (VNĐ)</Text>
                        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                          <TextInput
                            className="flex-1 text-xs text-slate-900 font-bold p-0"
                            keyboardType="numeric"
                            value={formatNumberInput(m.amount)}
                            onChangeText={(val) => updateRoadmapRow(idx, 'amount', val)}
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text className="text-xs font-bold text-slate-500 ml-1">VNĐ</Text>
                        </View>
                      </View>
                    </View>

                    <View className="gap-1">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase">
                        HẠN THANH TOÁN (DD-MM-YYYY) <Text className="text-rose-500">*</Text>
                      </Text>
                      <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                        <TouchableOpacity
                          onPress={() => openDatePickerForMilestone(idx, String(m.dueDate || ''), m.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="mr-2.5"
                        >
                          <Feather name="calendar" size={16} color="#4F46E5" />
                        </TouchableOpacity>
                        <TextInput
                          className="flex-1 text-xs text-slate-900 font-bold p-0"
                          value={String(m.dueDate || '')}
                          onChangeText={(val) => updateRoadmapRow(idx, 'dueDate', val)}
                          placeholder="DD-MM-YYYY"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={10}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                className="flex-1 py-3 bg-slate-100 rounded-xl items-center justify-center min-h-[44px]"
                onPress={closeRoadmapModal}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-bold text-slate-600">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl items-center justify-center min-h-[44px] ${
                  roadmapTotalPercent === 100 ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                onPress={onSaveRoadmap}
                disabled={bulkSaveMilestonesMutation.isPending}
                activeOpacity={0.8}
              >
                {bulkSaveMilestonesMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Lưu kế hoạch</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DatePickerModal
        visible={showDatePickerModal}
        title={datePickerTarget?.title}
        initialDate={datePickerTarget?.initialDate}
        onConfirm={confirmDateSelection}
        onClose={closeDatePicker}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
