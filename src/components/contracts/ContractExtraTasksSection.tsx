import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAssessExtraTaskMutation, useTaskDetailQuery } from '@/hooks/queries/useTasks';
import type { QuotationItem } from '@/services/quotationService';
import AddendumQuotationModal from './AddendumQuotationModal';
import { formatNumberInput, parseNumberInput, formatVND } from '@/utils/formatters';

export interface ExtraTaskItem {
  quotation?: QuotationItem | null;
  id: string;
  name?: string;
  title?: string;
  status?: string;
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
  onRefresh?: () => void;
}

export const ContractExtraTasksSection: React.FC<ContractExtraTasksSectionProps> = ({
  tasks,
  projectId,
  contractId,
  opportunityId,
  onRefresh,
}) => {
  const assessMutation = useAssessExtraTaskMutation();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [billableModes, setBillableModes] = useState<Record<string, boolean>>({});
  const [quotationTask, setQuotationTask] = useState<ExtraTaskItem | null>(null);
  const [createdQuotes, setCreatedQuotes] = useState<Record<string, QuotationItem>>({});

  const handlePriceChange = (taskId: string, text: string) => {
    const rawNum = parseNumberInput(text);
    setPrices((prev) => ({
      ...prev,
      [taskId]: rawNum,
    }));
  };

  const handleConfirmFreeSupport = async (task: ExtraTaskItem) => {
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

  const openQuotation = (task: ExtraTaskItem) => {
    if (!opportunityId || !projectId || !contractId) {
      Alert.alert('Thiếu liên kết', 'Hợp đồng cần liên kết cơ hội và dự án trước khi tạo báo giá phụ lục.');
      return;
    }
    setQuotationTask(task);
  };

  const handleRejectTask = (task: ExtraTaskItem) => {
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

  if (!tasks || tasks.length === 0) {
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
      {tasks.map((task) => {
        const taskName = task.name || task.title || 'Công việc phát sinh';
        const isProcessing = assessMutation.isPending && activeTaskId === task.id;
        const isBillable = billableModes[task.id] ?? (task.pricingStatus === 'BILLABLE');
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

              <TouchableOpacity
                onPress={() => handleRejectTask(task)}
                disabled={isProcessing}
                className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
                activeOpacity={0.7}
              >
                <Feather name="x" size={16} color="#EF4444" />
              </TouchableOpacity>
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
            ) : isBillable || task.quotation || createdQuotes[task.id] ? (
              <ExtraTaskQuotationAction task={task} quotation={createdQuotes[task.id] || task.quotation} opportunityId={opportunityId} onCreate={() => openQuotation(task)} />
            ) : (
              <TouchableOpacity
                onPress={() => handleConfirmFreeSupport(task)}
                className="bg-emerald-600 py-2.5 rounded-xl items-center justify-center active:opacity-80"
                activeOpacity={0.8}
              >
                <Text className="text-xs font-extrabold text-white">Xác nhận hỗ trợ miễn phí</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {quotationTask && projectId && contractId && opportunityId ? (
        <AddendumQuotationModal
          key={quotationTask.id} task={quotationTask} projectId={projectId} contractId={contractId}
          opportunityId={opportunityId} initialPrice={prices[quotationTask.id]}
          onClose={() => setQuotationTask(null)}
          onCreated={(quotation) => {
            setCreatedQuotes((previous) => ({ ...previous, [quotationTask.id]: quotation }));
            onRefresh?.();
          }}
        />
      ) : null}
    </View>
  );
};

function ExtraTaskQuotationAction({ task, quotation, opportunityId, onCreate }: {
  task: ExtraTaskItem; quotation?: QuotationItem | null; opportunityId?: string; onCreate: () => void;
}) {
  const router = useRouter();
  const query = useTaskDetailQuery(task.pricingStatus === 'BILLABLE' && !quotation ? task.id : '');
  const linked = quotation || query.data?.quotation;
  if (query.isLoading && !quotation) return <ActivityIndicator />;
  if (query.isError && !quotation) return <TouchableOpacity className="min-h-[48px] justify-center" onPress={() => query.refetch()}><Text className="text-red-600">Không kiểm tra được báo giá. Bấm thử lại.</Text></TouchableOpacity>;
  return (
    <TouchableOpacity className="min-h-[48px] bg-primary rounded-xl items-center justify-center" onPress={() => {
      if (linked?.id) router.push({ pathname: '/opportunities/quotations/[quotId]', params: { quotId: linked.id, ...(opportunityId ? { opportunityId } : {}) } });
      else onCreate();
    }}>
      <Text className="text-xs font-bold text-white">{linked?.id ? 'Xem báo giá' : 'Tạo báo giá phụ lục'}</Text>
    </TouchableOpacity>
  );
}
