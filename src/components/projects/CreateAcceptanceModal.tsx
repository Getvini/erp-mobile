import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCreateAcceptanceMutation } from '@/hooks/queries/useAcceptances';
import { BrandColors } from '@/constants/colors';

interface CreateAcceptanceModalProps {
  visible: boolean;
  onClose: () => void;
  contract?: any;
  projectId: string;
  onSuccess: () => void;
}

const TASK_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; icon: string }
> = {
  COMPLETED: { label: 'Đã hoàn thành', bg: '#DCFCE7', color: '#166534', icon: 'check-circle' },
  DOING: { label: 'Đang làm', bg: '#DBEAFE', color: '#1E40AF', icon: 'clock' },
  AWAITING_REVIEW: { label: 'Chờ duyệt', bg: '#FEF3C7', color: '#92400E', icon: 'eye' },
  REWORKING: { label: 'Cần làm lại', bg: '#F3E8FF', color: '#6B21A8', icon: 'rotate-ccw' },
  OVERDUE: { label: 'Quá hạn', bg: '#FEE2E2', color: '#991B1B', icon: 'alert-triangle' },
  TODO: { label: 'Chưa bắt đầu', bg: '#F1F5F9', color: '#475569', icon: 'circle' },
};

export default function CreateAcceptanceModal({
  visible,
  onClose,
  contract,
  projectId,
  onSuccess,
}: CreateAcceptanceModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoToTask = (taskId: string) => {
    if (!taskId) return;
    onClose();
    router.push(`/tasks/${taskId}` as any);
  };

  const generateDefaultName = (contractCode?: string) => {
    const dateStr = new Date().toLocaleDateString('vi-VN');
    return contractCode ? `NT-${contractCode}-${dateStr}` : `NT-${dateStr}`;
  };

  useEffect(() => {
    if (visible) {
      setSelectedServiceIds([]);
      setExpandedServices({});
      setNote('');
      setName(generateDefaultName(contract?.contractCode));
    }
  }, [visible, contract?.contractCode]);

  const isValidStatus = (s: any) => s.status === 'ACTIVE' || s.status === 'ACCEPTANCE_REJECTED';

  /**
   * Điều kiện hạng mục đủ gửi nghiệm thu — mirror backend
   * (task chặn = status ∉ {COMPLETED, INTERNAL_COMPLETED, ACCEPTED, ON_HOLD, CANCELLED}).
   */
  const hasPendingResult = (s: any) => s.results?.some((r: any) => r.status === 'PENDING');
  const hasBlockingTask = (s: any) =>
    (s.tasks || []).some(
      (t: any) =>
        !['COMPLETED', 'INTERNAL_COMPLETED', 'ACCEPTED', 'ON_HOLD', 'CANCELLED'].includes(
          t.status,
        ),
    );

  const availableServices =
    contract?.services?.filter(
      (s: any) => isValidStatus(s) && hasPendingResult(s) && !hasBlockingTask(s),
    ) || [];

  const rejectedServices =
    contract?.services?.filter(
      (s: any) => isValidStatus(s) && hasPendingResult(s) && hasBlockingTask(s),
    ) || [];

  const toggleServiceSelection = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleServiceExpand = (id: string) => {
    setExpandedServices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const createAcceptanceMutation = useCreateAcceptanceMutation();

  const handleCreate = async () => {
    if (availableServices.length > 0 && selectedServiceIds.length === 0) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn ít nhất một hạng mục dịch vụ để nghiệm thu.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Payload parity 100% với Web (CreateAcceptanceModal.jsx:55-59):
      // CHỈ gửi { projectId, note, serviceIds } — backend tự sinh `name`.
      await createAcceptanceMutation.mutateAsync({
        projectId,
        note: note.trim() || undefined,
        serviceIds: selectedServiceIds,
      });

      Alert.alert('Thành công', 'Đã gửi yêu cầu nghiệm thu thành công.');
      setNote('');
      setName('');
      setSelectedServiceIds([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi tạo yêu cầu nghiệm thu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-end">
        <View className="bg-white rounded-t-[24px] p-5 gap-3.5 max-h-[90%]">
          {/* Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3">
            <View className="flex-1">
              <Text className="text-[17px] font-extrabold text-slate-900">Gửi nghiệm thu dịch vụ</Text>
              {contract?.contractCode && (
                <Text className="text-xs text-slate-500 mt-0.5">Hợp đồng: #{contract.contractCode}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5 rounded-lg bg-slate-100">
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="gap-3.5" showsVerticalScrollIndicator={false}>
            {/* Batch Name Section */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-extrabold text-slate-500 mb-2 tracking-wider">TÊN ĐỢT NGHIỆM THU</Text>
              <TextInput
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 font-bold"
                value={name}
                editable={false}
                selectTextOnFocus={false}
              />
            </View>

            {/* Service Selection Section */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-extrabold text-slate-500 mb-2 tracking-wider">HẠNG MỤC DỊCH VỤ ĐỦ ĐIỀU KIỆN</Text>

              {availableServices.length > 0 ? (
                <View className="gap-2.5">
                  {availableServices.map((service: any) => {
                    const isSelected = selectedServiceIds.includes(service.id);
                    const isExpanded = !!expandedServices[service.id];
                    const serviceName = service.service?.name || service.name || 'Hạng mục dịch vụ';
                    const serviceCode = service.code || service.service?.code || service.serviceCode;
                    
                    const parentObj =
                      service.service?.parent ||
                      service.parent ||
                      service.parentService ||
                      service.serviceGroup ||
                      service.category;
                    const parentCode =
                      service.parentCode ||
                      service.parentServiceCode ||
                      service.service?.parentCode ||
                      service.service?.parent?.code ||
                      parentObj?.code ||
                      parentObj?.serviceCode;
                    const parentName =
                      service.parentName ||
                      service.parentServiceName ||
                      service.service?.parentName ||
                      parentObj?.name ||
                      parentObj?.serviceName;

                    const tasksList = service.tasks || [];

                    return (
                      <View
                        key={service.id}
                        className={`rounded-2xl p-3 border gap-2 ${
                          isSelected ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <TouchableOpacity
                          className="flex-row items-center gap-2.5"
                          onPress={() => toggleServiceSelection(service.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            className={`w-5 h-5 rounded border-2 items-center justify-center ${
                              isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              {parentCode && (
                                <View className="bg-purple-100 px-1.5 py-0.5 rounded">
                                  <Text className="text-[11px] font-bold text-purple-700">#{parentCode}</Text>
                                </View>
                              )}
                              {serviceCode && (
                                <View className="bg-sky-100 px-1.5 py-0.5 rounded">
                                  <Text className="text-[11px] font-bold text-sky-700">#{serviceCode}</Text>
                                </View>
                              )}
                              <Text
                                className={`text-sm font-bold ${
                                  isSelected ? 'text-emerald-900' : 'text-slate-700'
                                }`}
                                numberOfLines={1}
                              >
                                {serviceName}
                              </Text>
                            </View>
                            {parentName ? (
                              <Text className="text-[11px] color-purple-800 font-medium mt-0.5">
                                Dịch vụ cha: {parentName}
                              </Text>
                            ) : null}
                            <Text className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                              ✅ Tất cả {tasksList.length}/{tasksList.length} công việc con đã hoàn thành
                            </Text>
                          </View>

                          <TouchableOpacity
                            className="p-1"
                            onPress={() => toggleServiceExpand(service.id)}
                          >
                            <Feather
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#64748B"
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Breakdown of Linked Tasks */}
                        {isExpanded && tasksList.length > 0 && (
                          <View className="mt-2 pt-2 border-t border-emerald-100 gap-1.5">
                            <Text className="text-[10px] font-extrabold text-emerald-700 tracking-wider mb-0.5">
                              CÁC CÔNG VIỆC LIÊN KẾT TRONG HẠNG MỤC:
                            </Text>
                            {tasksList.map((t: any) => {
                              const statusCfg =
                                TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG['TODO'];
                              const taskCode = t.code || t.taskCode;
                              return (
                                <TouchableOpacity
                                  key={t.id}
                                  className="flex-row items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-slate-100"
                                  onPress={() => handleGoToTask(t.id)}
                                  activeOpacity={0.7}
                                >
                                  <Feather
                                    name={statusCfg.icon as any}
                                    size={14}
                                    color={statusCfg.color}
                                  />
                                  <Text className="flex-1 text-xs text-slate-700" numberOfLines={1}>
                                    {taskCode ? (
                                      <Text className="font-bold text-sky-600">#{taskCode} </Text>
                                    ) : null}
                                    {t.name}
                                  </Text>
                                  <View
                                    className="px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: statusCfg.bg }}
                                  >
                                    <Text className="text-[10px] font-bold" style={{ color: statusCfg.color }}>
                                      {statusCfg.label}
                                    </Text>
                                  </View>
                                  <Feather name="chevron-right" size={13} color="#94A3B8" />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="flex-row items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                  <Feather name="alert-circle" size={20} color="#D97706" />
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-amber-800">Không có dịch vụ đủ điều kiện nghiệm thu</Text>
                    <Text className="text-xs text-amber-700 mt-0.5 leading-4">
                      Dịch vụ chỉ có thể nghiệm thu khi TẤT CẢ các công việc liên kết trực thuộc đã ở trạng thái Hoàn thành.
                    </Text>
                  </View>
                </View>
              )}

              {/* Disabled / Incomplete Services Section */}
              {rejectedServices.length > 0 && (
                <View className="mt-2 gap-2">
                  <Text className="text-[10px] font-extrabold text-red-500 mt-3.5 mb-2 tracking-wider">
                    HẠNG MỤC CHƯA ĐỦ ĐIỀU KIỆN (CÒN TASK CHƯA XONG) ({rejectedServices.length})
                  </Text>
                  {rejectedServices.map((service: any) => {
                    const isExpanded = !!expandedServices[service.id];
                    const serviceName = service.service?.name || service.name || 'Hạng mục dịch vụ';
                    const serviceCode = service.code || service.service?.code || service.serviceCode;

                    const parentObj =
                      service.service?.parent ||
                      service.parent ||
                      service.parentService ||
                      service.serviceGroup ||
                      service.category;
                    const parentCode =
                      service.parentCode ||
                      service.parentServiceCode ||
                      service.service?.parentCode ||
                      service.service?.parent?.code ||
                      parentObj?.code ||
                      parentObj?.serviceCode;
                    const parentName =
                      service.parentName ||
                      service.parentServiceName ||
                      service.service?.parentName ||
                      parentObj?.name ||
                      parentObj?.serviceName;

                    const tasksList = service.tasks || [];
                    const completedTasks = tasksList.filter((t: any) => t.status === 'COMPLETED');
                    const uncompletedTasks = tasksList.filter((t: any) => t.status !== 'COMPLETED');

                    return (
                      <View key={service.id} className="bg-red-50/50 border border-red-100 rounded-2xl p-3 gap-2">
                        <TouchableOpacity
                          className="flex-row items-center gap-2.5"
                          onPress={() => toggleServiceExpand(service.id)}
                          activeOpacity={0.7}
                        >
                          <View className="w-6 h-6 rounded-md bg-red-100 items-center justify-center">
                            <Feather name="lock" size={14} color="#EF4444" />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              {parentCode && (
                                <View className="bg-pink-100 px-1.5 py-0.5 rounded">
                                  <Text className="text-[11px] font-bold text-pink-800">#{parentCode}</Text>
                                </View>
                              )}
                              {serviceCode && (
                                <View className="bg-red-100 px-1.5 py-0.5 rounded">
                                  <Text className="text-[11px] font-bold text-red-700">#{serviceCode}</Text>
                                </View>
                              )}
                              <Text className="text-[13px] font-bold text-red-900" numberOfLines={1}>
                                {serviceName}
                              </Text>
                            </View>
                            {parentName ? (
                              <Text className="text-[11px] text-pink-800 font-medium mt-0.5">
                                Dịch vụ cha: {parentName}
                              </Text>
                            ) : null}
                            <Text className="text-[11px] color-red-600 font-semibold mt-0.5">
                              Còn {uncompletedTasks.length}/{tasksList.length} công việc chưa hoàn thành
                            </Text>
                          </View>

                          <TouchableOpacity
                            className="p-1"
                            onPress={() => toggleServiceExpand(service.id)}
                          >
                            <Feather
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#94A3B8"
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Breakdown showing EXACTLY which tasks are holding back acceptance */}
                        {isExpanded && tasksList.length > 0 && (
                          <View className="mt-2 pt-2 border-t border-red-200 gap-1.5">
                            <Text className="text-[10px] font-extrabold text-red-700 tracking-wider mb-0.5">
                              CẦN HOÀN THÀNH CÁC CÔNG VIỆC SAU ĐỂ ĐỦ ĐIỀU KIỆN:
                            </Text>
                            {tasksList.map((t: any) => {
                              const isDone = t.status === 'COMPLETED';
                              const statusCfg =
                                TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG['TODO'];
                              const taskCode = t.code || t.taskCode;
                              return (
                                <TouchableOpacity
                                  key={t.id}
                                  className={`flex-row items-center gap-2 rounded-lg px-2.5 py-1.5 border ${
                                    !isDone ? 'bg-red-100/60 border-red-200' : 'bg-white border-slate-100'
                                  }`}
                                  onPress={() => handleGoToTask(t.id)}
                                  activeOpacity={0.7}
                                >
                                  <Feather
                                    name={statusCfg.icon as any}
                                    size={14}
                                    color={statusCfg.color}
                                  />
                                  <Text
                                    className={`flex-1 text-xs ${
                                      !isDone ? 'font-bold text-red-900' : 'text-slate-700'
                                    }`}
                                    numberOfLines={1}
                                  >
                                    {taskCode ? (
                                      <Text className="font-bold text-sky-600">#{taskCode} </Text>
                                    ) : null}
                                    {t.name}
                                  </Text>
                                  <View
                                    className="px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: statusCfg.bg }}
                                  >
                                    <Text className="text-[10px] font-bold" style={{ color: statusCfg.color }}>
                                      {statusCfg.label}
                                    </Text>
                                  </View>
                                  <Feather name="chevron-right" size={13} color="#94A3B8" />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Note */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-extrabold text-slate-500 mb-2 tracking-wider">GHI CHÚ NGHIỆM THU</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 h-20"
                placeholder="Nhập ghi chú nghiệm thu (không bắt buộc)..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View className="flex-row justify-end items-center gap-2.5 pt-2 border-t border-slate-100">
            <TouchableOpacity className="px-4 py-2.5 rounded-xl bg-slate-100" onPress={onClose} disabled={isSubmitting}>
              <Text className="text-xs font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary ${
                isSubmitting || (availableServices.length > 0 && selectedServiceIds.length === 0)
                  ? 'opacity-50'
                  : ''
              }`}
              onPress={handleCreate}
              disabled={isSubmitting || (availableServices.length > 0 && selectedServiceIds.length === 0)}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="send" size={14} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Gửi yêu cầu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
