import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptic from 'expo-haptics';
import { ContractDebtGroup } from '@/services/financeService';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import DatePickerModal from '@/components/common/DatePickerModal';
import { DebtProgressRing } from '@/components/finance/DebtProgressRing';
import { FinanceFilterToolbar } from '@/components/finance/FinanceFilterToolbar';
import { FinancePaymentModal } from '@/components/finance/FinancePaymentModal';
import { FinanceRoadmapModal } from '@/components/finance/FinanceRoadmapModal';
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
} from '@/hooks/queries';

const LIST_CONTENT_STYLE = { padding: 16, paddingBottom: 24 };
const financeKeyExtractor = (item: any, idx: number) => item.id || `${item.contractCode || 'item'}-${idx}`;

export default function FinanceDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAccess = canAccessFinance(user?.role);
  // TanStack Query Hooks for Network Data & Mutations
  const {
    data: contractGroups = [],
    isLoading: loading,
    refetch,
    isRefetching: refreshing,
  } = useContractDebtsQuery();

  const activateDebtMutation = useActivateDebtMutation();

  // Zustand Store Hooks for UI & Filter States - ATOMIC SELECTORS
  const viewType = useFinanceStore((s) => s.viewType);
  const searchTerm = useFinanceStore((s) => s.searchTerm);
  const preset = useFinanceStore((s) => s.preset);
  const debtStatusFilter = useFinanceStore((s) => s.debtStatusFilter);
  const expandedContracts = useFinanceStore((s) => s.expandedContracts);
  const showDatePickerModal = useFinanceStore((s) => s.showDatePickerModal);
  const datePickerTarget = useFinanceStore((s) => s.datePickerTarget);

  // Store Actions (stable references in Zustand)
  const setViewType = useFinanceStore((s) => s.setViewType);
  const toggleContractExpand = useFinanceStore((s) => s.toggleContractExpand);
  const setExpandedContracts = useFinanceStore((s) => s.setExpandedContracts);
  const openPaymentModal = useFinanceStore((s) => s.openPaymentModal);
  const openRoadmapModal = useFinanceStore((s) => s.openRoadmapModal);
  const closeDatePicker = useFinanceStore((s) => s.closeDatePicker);
  const confirmDateSelection = useFinanceStore((s) => s.confirmDateSelection);

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

  const renderFinanceItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (viewType === 'list') {
        return renderContractGroupCard(item as ContractDebtGroup);
      }
      const m = item as any;
      const isCompleted = m.status === 'COMPLETED';
      const isActive = m.status === 'ACTIVE';

      return (
        <View
          key={m.id || index}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm gap-2 mb-3"
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
    },
    [
      viewType,
      expandedContracts,
      activateDebtMutation.isPending,
      activateDebtMutation.variables,
      formatVND,
    ]
  );

  const listHeader = useMemo(
    () => (
      <View>
        {/* TOOLBAR BỘ LỌC (Memoized with Zustand atomic selectors) */}
        <FinanceFilterToolbar />

        {/* Debt Progress Ring Component */}
        <DebtProgressRing
          totalAmount={stats.planned || stats.collected + stats.pending}
          paidAmount={stats.collected}
          remainingAmount={stats.pending}
        />

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
      </View>
    ),
    [stats, viewType, setViewType, filteredContracts.length, allMilestones.length]
  );

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
        <FlashList<any>
          data={viewType === 'list' ? filteredContracts : allMilestones}
          renderItem={renderFinanceItem}
          getItemType={() => (viewType === 'list' ? 'contract_group' : 'milestone_schedule')}
          keyExtractor={financeKeyExtractor}
          contentContainerStyle={LIST_CONTENT_STYLE}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={BrandColors.primary}
            />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View className="py-10 items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 p-6 mb-4">
              <Feather name={viewType === 'list' ? 'file-text' : 'calendar'} size={36} color="#CBD5E1" />
              <Text className="text-sm font-bold text-slate-600">
                {viewType === 'list'
                  ? 'Không có hợp đồng nào phù hợp bộ lọc'
                  : 'Không có mốc thanh toán nào phù hợp bộ lọc'}
              </Text>
            </View>
          }
        />
      )}

      <FinancePaymentModal />
      <FinanceRoadmapModal />

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
