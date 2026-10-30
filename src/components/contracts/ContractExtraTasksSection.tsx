import Decimal from 'decimal.js';
import { useAuth } from '@/context/AuthContext';
import { getTaskActionState, getTaskDisplayName } from '@/utils/taskPolicy';
import { QuotationDetailModal } from '@/components/quotations/QuotationDetailModal';
import { useExtraTaskQuotationMutation } from '@/hooks/queries/useExtraTaskQuotation';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';
import { useAssessExtraTaskMutation } from '@/hooks/queries/useTasks';
import { formatNumberInput, formatVND } from '@/utils/formatters';

export interface ExtraTaskItem {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  nickname?: string;
  quotation?: { id: string };
  quotationId?: string;
  project?: any;
  pricingStatus?: 'BILLABLE' | 'NON_BILLABLE' | 'PENDING' | string;
  sellingPrice?: number;
  cost?: number;
  description?: string;
  createdAt?: string;
  assignedTo?: {
    id: string;
    fullName?: string;
  };
  assignee?: {
    id: string;
    fullName?: string;
  };
  job?: {
    id: string;
    name?: string;
    costPrice?: number;
  };
}

export interface ContractExtraTasksSectionProps {
  tasks: ExtraTaskItem[];
  projectId?: string;
  contractId?: string;
  opportunityId?: string;
  project?: any;
  onRefresh?: () => void;
}

export const ContractExtraTasksSection: React.FC<ContractExtraTasksSectionProps> = ({
  tasks,
  projectId,
  contractId,
  opportunityId,
  project,
  onRefresh,
}) => {
  const assessMutation = useAssessExtraTaskMutation();
  const { user } = useAuth();
  const quotationMutation = useExtraTaskQuotationMutation();
  const [viewQuotationId, setViewQuotationId] = useState<string | null>(null);
  const [billingDraft, setBillingDraft] = useState<ExtraTaskItem | null>(null);
  const policyFor = (task: ExtraTaskItem) => getTaskActionState(task, user, 'assessExtraTask', { project: project || task.project });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [billableModes, setBillableModes] = useState<Record<string, boolean>>({});

  const handlePriceChange = (taskId: string, text: string) => {
    const rawNum = text.replace(/\D/g, '');
    setPrices((prev) => ({
      ...prev,
      [taskId]: rawNum,
    }));
  };

  const handleConfirmFreeSupport = async (task: ExtraTaskItem) => {
    if (!policyFor(task).enabled || assessMutation.isPending || quotationMutation.isPending) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActiveTaskId(task.id);
      await assessMutation.mutateAsync({
        id: task.id,
        isBillable: false,
        sellingPrice: 0,
        isRejected: false,
        projectId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', `Đã xác nhận hỗ trợ miễn phí cho công việc "${task.name || task.title || 'N/A'}".`);
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Lỗi đánh giá', err?.message || 'Không thể cập nhật công việc phát sinh.');
    } finally {
      setActiveTaskId(null);
    }
  };

  const handleConfirmBillable = async (task: ExtraTaskItem) => {
    if (!policyFor(task).enabled || assessMutation.isPending || quotationMutation.isPending) return;
    const rawPrice = prices[task.id] ?? String(task.sellingPrice || '0');
    const price = new Decimal(rawPrice || '0');
    if (!price.isFinite() || price.lte(0) || price.gt(Number.MAX_SAFE_INTEGER)) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đơn giá hợp lệ lớn hơn 0 VNĐ.');
      return;
    }
    if (!opportunityId) { Alert.alert('Thiếu thông tin', 'Hợp đồng chưa có cơ hội để tạo báo giá phụ lục.'); return; }
    setBillingDraft(task);
    setActiveTaskId(task.id);
    try {
      const quotation = await quotationMutation.mutateAsync({ taskId: task.id, opportunityId, sellingPrice: price.toNumber(), project: project || task.project });
      setBillingDraft(null);
      if (quotation?.id) setViewQuotationId(quotation.id);
      Alert.alert('Thành công', 'Đã tạo báo giá công việc phát sinh.');
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Chưa tạo được báo giá', err?.message || 'Vui lòng thử lại. Giá đang nhập được giữ nguyên.');
    } finally { setActiveTaskId(null); }
  };

  const handleRejectTask = (task: ExtraTaskItem) => {
    if (!policyFor(task).enabled || assessMutation.isPending || quotationMutation.isPending) return;
    Alert.alert(
      'Từ chối phát sinh',
      `Bạn có chắc chắn muốn từ chối thực hiện công việc phát sinh "${task.name || task.title || 'N/A'}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setActiveTaskId(task.id);
              await assessMutation.mutateAsync({
                id: task.id,
                isBillable: false,
                isRejected: true,
                projectId,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Đã từ chối', 'Đã từ chối thực hiện công việc phát sinh.');
              onRefresh?.();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể từ chối công việc phát sinh.');
            } finally {
              setActiveTaskId(null);
            }
          },
        },
      ]
    );
  };

  if ((!tasks || tasks.length === 0) && !billingDraft) {
    return (
      <View className="bg-white rounded-2xl p-6 items-center justify-center border border-slate-200 mt-3">
        <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-3">
          <Feather name="check-circle" size={24} color="#10B981" />
        </View>
        <Text className="text-sm font-bold text-slate-800 text-center">
          Không có công việc phát sinh cần đánh giá
        </Text>
        <Text className="text-xs text-slate-500 text-center mt-1">
          Tất cả yêu cầu phát sinh từ dự án đều đã được xử lý hoặc đưa vào phụ lục hợp đồng.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 mt-3">
      {(billingDraft && !tasks.some(task => task.id === billingDraft.id) ? [...tasks, billingDraft] : tasks).map((task) => {
        const taskName = getTaskDisplayName(task) || task.title || 'Công việc phát sinh';
        const policy = policyFor(task);
        const isProcessing = (assessMutation.isPending || quotationMutation.isPending) && activeTaskId === task.id;
        const isBillable = billableModes[task.id] ?? (task.pricingStatus !== 'NON_BILLABLE');
        const priceValue = prices[task.id] !== undefined ? prices[task.id] : (task.sellingPrice || '');
        const assigneeName = task.assignee?.fullName || task.assignedTo?.fullName || 'Chưa gán';

        return (
          <View
            key={task.id}
            className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/20 shadow-xs"
          >
            {/* Header: Title & Badge */}
            <View className="flex-row items-start justify-between gap-2 mb-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <View className="bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    <Text className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                      Phát sinh
                    </Text>
                  </View>
                  <Text className="text-xs text-slate-500 font-medium">#{task.id.slice(0, 8)}</Text>
                </View>
                <Text className="text-base font-bold text-slate-900 leading-5">
                  {taskName}
                </Text>
              </View>

              {policy.enabled && (
                <TouchableOpacity accessibilityLabel="Xử lý công việc phát sinh"
                  onPress={() => handleRejectTask(task)}
                  disabled={isProcessing}
                  className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
                  activeOpacity={0.7}
                  style={[isProcessing ? { opacity: 0.5 } : undefined]} accessibilityRole="button">
                  <Feather name="x" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* Description or Job Info */}
            {task.description ? (
              <Text className="text-xs text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {task.description}
              </Text>
            ) : null}

            {/* Assignee & Cost */}
            <View className="flex-row items-center justify-between py-2 border-t border-slate-100 mb-3">
              <View className="flex-row items-center gap-1.5">
                <Feather name="user" size={13} color="#64748B" />
                <Text className="text-xs text-slate-600">Thực hiện: </Text>
                <Text className="text-xs font-semibold text-slate-800">{assigneeName}</Text>
              </View>
              {task.cost ? (
                <Text className="text-xs text-slate-500">
                  Giá vốn: <Text className="font-semibold text-slate-700">{formatVND(task.cost)}</Text>
                </Text>
              ) : null}
            </View>

            {task.quotation?.id || task.quotationId ? (
              <TouchableOpacity className="rounded-xl bg-purple-50 px-4 py-3" onPress={() => setViewQuotationId(task.quotation?.id || task.quotationId || null)}>
                <Text className="font-bold text-purple-700">Xem báo giá</Text>
              </TouchableOpacity>
            ) : <>
            {/* Pricing Selection Mode */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-slate-700 mb-1.5">Hình thức xử lý:</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBillableModes((prev) => ({ ...prev, [task.id]: false }));
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border items-center justify-center ${
                    !isBillable ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-bold ${
                      !isBillable ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    Hỗ trợ miễn phí
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBillableModes((prev) => ({ ...prev, [task.id]: true }));
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border items-center justify-center ${
                    isBillable ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isBillable ? 'text-primary' : 'text-slate-600'
                    }`}
                  >
                    Tính phí phát sinh
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Billable Price Input */}
            {isBillable ? (
              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1">
                  Đơn giá bán khách hàng (VNĐ) <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center bg-white border border-slate-300 rounded-xl px-3 py-2">
                  <TextInput
                    value={formatNumberInput(priceValue)}
                    onChangeText={(t) => handlePriceChange(task.id, t)}
                    keyboardType="numeric"
                    placeholder="Nhập giá tính phí..."
                    placeholderTextColor="#94A3B8"
                    className="flex-1 text-sm font-bold text-slate-900 py-0"
                  />
                  <Text className="text-xs font-bold text-slate-400 ml-1">VNĐ</Text>
                </View>
              </View>
            ) : null}

            {/* Action Buttons */}
            {isProcessing ? (
              <View className="py-2.5 items-center justify-center flex-row gap-2">
                <ActivityIndicator size="small" color="#F38820" />
                <Text className="text-xs font-semibold text-slate-600">Đang cập nhật...</Text>
              </View>
            ) : isBillable ? (
              policy.enabled && (
                <TouchableOpacity accessibilityLabel="Xử lý công việc phát sinh"
                  onPress={() => handleConfirmBillable(task)}
                  className="bg-primary py-2.5 rounded-xl items-center justify-center active:opacity-80"
                  activeOpacity={0.8}
                  accessibilityRole="button">
                  <Text className="text-xs font-extrabold text-white">Tạo báo giá</Text>
                </TouchableOpacity>
              )
            ) : (
              policy.enabled && (
                <TouchableOpacity accessibilityLabel="Xử lý công việc phát sinh"
                  onPress={() => handleConfirmFreeSupport(task)}
                  className="bg-emerald-600 py-2.5 rounded-xl items-center justify-center active:opacity-80"
                  activeOpacity={0.8}
                  accessibilityRole="button">
                  <Text className="text-xs font-extrabold text-white">Xác nhận hỗ trợ miễn phí</Text>
                </TouchableOpacity>
              )
            )}
            </>}
          </View>
        );
      })}
      <QuotationDetailModal visible={Boolean(viewQuotationId)} quotationId={viewQuotationId} onClose={() => setViewQuotationId(null)} />
    </View>
  );
};
