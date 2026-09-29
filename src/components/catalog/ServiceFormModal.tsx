import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { JobReference, ServiceItem, ServiceJobConfig } from '@/services/catalogService';
import {
  useCreateServiceMutation,
  useUpdateServiceMutation,
} from '@/hooks/queries/useServices';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import { BrandColors } from '@/constants/colors';
import { SERVICE_UNIT_SUGGESTIONS } from '@/utils/catalogPricing';
import { formatNumberInput, parseNumberInput, formatVND } from '@/utils/formatters';

interface ServiceFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Có giá trị ⇒ chế độ Sửa; `null`/`undefined` ⇒ chế độ Thêm mới. */
  service?: ServiceItem | null;
}

interface JobConfigRow {
  jobId: string;
  /** Chuỗi đã mask dấu chấm (real-time) — parse lại bằng parseNumberInput. */
  quantityText: string;
  isOutput: boolean;
}

function toNumberOrOne(text: string): number {
  const parsed = parseNumberInput(text);
  return parsed > 0 ? parsed : 1;
}

export default function ServiceFormModal({
  visible,
  onClose,
  onSuccess,
  service,
}: ServiceFormModalProps) {
  const isEditMode = Boolean(service?.id);
  const createServiceMutation = useCreateServiceMutation();
  const updateServiceMutation = useUpdateServiceMutation();

  // ⚠️ Component KHÔNG tự reset state bằng useEffect (tránh cascading render).
  // Màn hình cha truyền `key` mới mỗi lần mở sheet ⇒ mỗi lần mở là một instance
  // mới, state được khởi tạo trực tiếp từ prop `service`.
  const [name, setName] = useState(service?.name ?? '');
  const [code, setCode] = useState(service?.code ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [unit, setUnit] = useState(service?.unit ?? '');
  const [isAI, setIsAI] = useState(Boolean(service?.isAI));
  const [jobConfigs, setJobConfigs] = useState<JobConfigRow[]>(() =>
    (service?.serviceJobs ?? []).map((serviceJob) => ({
      jobId: serviceJob.jobId,
      quantityText: formatNumberInput(Number(serviceJob.quantity || 1)),
      isOutput: Boolean(serviceJob.isOutput),
    })),
  );
  const [jobSearch, setJobSearch] = useState('');
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: jobs = [], isLoading: isLoadingJobs } = useJobsQuery({}, { enabled: visible });

  const originalJobConfigs = useMemo<ServiceJobConfig[]>(
    () =>
      (service?.serviceJobs ?? []).map((serviceJob) => ({
        jobId: serviceJob.jobId,
        quantity: Number(serviceJob.quantity || 1),
        isOutput: Boolean(serviceJob.isOutput),
      })),
    [service],
  );

  const jobById = useMemo(() => {
    const map = new Map<string, JobReference>();
    // Ưu tiên job lồng sẵn trong serviceJobs để hiển thị đúng ngay cả khi /jobs chưa tải xong.
    (service?.serviceJobs ?? []).forEach((serviceJob) => {
      if (serviceJob.job) map.set(serviceJob.jobId, serviceJob.job);
    });
    jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [jobs, service]);

  const availableJobs = useMemo(() => {
    const selectedIds = new Set(jobConfigs.map((config) => config.jobId));
    const keyword = jobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (selectedIds.has(job.id)) return false;
      if (!keyword) return true;
      return (
        (job.name || '').toLowerCase().includes(keyword) ||
        (job.code || '').toLowerCase().includes(keyword)
      );
    });
  }, [jobConfigs, jobSearch, jobs]);

  const handleAddJob = useCallback((jobId: string) => {
    setJobConfigs((prev) =>
      prev.some((config) => config.jobId === jobId)
        ? prev
        : [...prev, { jobId, quantityText: '1', isOutput: false }],
    );
    setJobSearch('');
    setIsJobPickerOpen(false);
  }, []);

  const handleRemoveJob = useCallback((jobId: string) => {
    setJobConfigs((prev) => prev.filter((config) => config.jobId !== jobId));
  }, []);

  const handleToggleOutput = useCallback((jobId: string) => {
    setJobConfigs((prev) =>
      prev.map((config) =>
        config.jobId === jobId ? { ...config, isOutput: !config.isOutput } : config,
      ),
    );
  }, []);

  const handleQuantityChange = useCallback((jobId: string, text: string) => {
    setJobConfigs((prev) =>
      prev.map((config) =>
        config.jobId === jobId ? { ...config, quantityText: formatNumberInput(text) } : config,
      ),
    );
  }, []);

  const submit = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập tên dịch vụ.');
      return;
    }
    if (!trimmedCode) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập mã dịch vụ.');
      return;
    }

    const normalizedConfigs: ServiceJobConfig[] = jobConfigs.map((config) => ({
      jobId: config.jobId,
      quantity: toNumberOrOne(config.quantityText),
      isOutput: config.isOutput,
    }));

    setIsSubmitting(true);
    try {
      if (isEditMode && service) {
        const basicChanged =
          trimmedName !== (service.name ?? '') ||
          trimmedCode !== (service.code ?? '') ||
          description.trim() !== (service.description ?? '') ||
          unit.trim() !== (service.unit ?? '') ||
          isAI !== Boolean(service.isAI);

        const jobsChanged =
          JSON.stringify(normalizedConfigs) !== JSON.stringify(originalJobConfigs);

        if (!basicChanged && !jobsChanged) {
          onClose();
          return;
        }

        if (basicChanged) {
          await updateServiceMutation.mutateAsync({
            id: service.id,
            name: trimmedName,
            code: trimmedCode,
            description: description.trim(),
            unit: unit.trim(),
            isAI,
          });
        }

        if (jobsChanged) {
          await updateServiceMutation.mutateAsync({
            id: service.id,
            jobConfigs: normalizedConfigs,
          });
        }
      } else {
        const created = await createServiceMutation.mutateAsync({
          name: trimmedName,
          code: trimmedCode,
          description: description.trim() || undefined,
          unit: unit.trim() || undefined,
          isAI,
          jobIds: normalizedConfigs.map((config) => config.jobId),
          outputJobIds: normalizedConfigs
            .filter((config) => config.isOutput)
            .map((config) => config.jobId),
        });

        // Backend `POST /services` luôn gán quantity = 1 cho mọi hạng mục,
        // nên số lượng khác 1 phải đồng bộ lại qua nhánh jobConfigs.
        const hasCustomQuantity = normalizedConfigs.some((config) => config.quantity !== 1);
        if (created?.id && hasCustomQuantity) {
          await updateServiceMutation.mutateAsync({
            id: created.id,
            jobConfigs: normalizedConfigs,
          });
        }
      }

      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert(
        isEditMode ? 'Không thể cập nhật dịch vụ' : 'Không thể tạo dịch vụ',
        error?.message || 'Vui lòng kiểm tra dữ liệu và thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    code,
    createServiceMutation,
    description,
    isAI,
    isEditMode,
    jobConfigs,
    name,
    onClose,
    onSuccess,
    originalJobConfigs,
    service,
    unit,
    updateServiceMutation,
  ]);

  const previewCost = useMemo(
    () =>
      jobConfigs.reduce((sum, config) => {
        const job = jobById.get(config.jobId);
        return sum + Number(job?.costPrice || 0) * toNumberOrOne(config.quantityText);
      }, 0),
    [jobById, jobConfigs],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="max-h-[90%] rounded-t-3xl border-t border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-5">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-primary-light">
                <Feather name="briefcase" size={18} color={BrandColors.primary} />
              </View>
              <Text className="text-lg font-bold text-slate-900">
                {isEditMode ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}
              </Text>
            </View>
            <TouchableOpacity
              className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-3.5 px-5 pb-6"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">
                Tên dịch vụ <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                testID="serviceNameInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Sản xuất video quảng cáo 30s"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">
                Mã dịch vụ <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                testID="serviceCodeInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: DV-VIDEO-30S"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
              />
              <Text className="mt-1 text-[11px] italic text-slate-400">
                Mã dịch vụ là duy nhất (không phân biệt hoa/thường).
              </Text>
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Mô tả</Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="Mô tả ngắn về phạm vi dịch vụ"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Đơn vị</Text>
              <TextInput
                testID="serviceUnitInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Ngày, Gói, Item, Giờ"
                placeholderTextColor="#94A3B8"
                value={unit}
                onChangeText={setUnit}
              />
              <View className="mt-2 flex-row flex-wrap gap-2">
                {SERVICE_UNIT_SUGGESTIONS.map((suggestion) => {
                  const isActive = unit === suggestion;
                  return (
                    <TouchableOpacity
                      key={suggestion}
                      className={`min-h-[40px] justify-center rounded-full border px-3 ${
                        isActive ? 'border-primary bg-primary' : 'border-slate-200 bg-slate-100'
                      }`}
                      onPress={() => setUnit(suggestion)}
                      activeOpacity={0.75}
                    >
                      <Text
                        className={`text-xs ${
                          isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'
                        }`}
                      >
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5"
              onPress={() => setIsAI((prev) => !prev)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isAI }}
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
                  isAI ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                }`}
              >
                {isAI ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text className="text-sm font-semibold text-slate-700">
                Đây là dịch vụ AI
              </Text>
            </TouchableOpacity>

            {/* Bộ chọn hạng mục */}
            <View className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-xs font-bold text-slate-700">Hạng mục công việc</Text>
                <Text className="text-xs font-bold text-orange-600">{formatVND(previewCost)}</Text>
              </View>

              {jobConfigs.length === 0 ? (
                <Text className="mb-2.5 text-[11px] italic text-slate-400">
                  Chưa có hạng mục nào. Giá vốn dịch vụ sẽ do hệ thống tính từ các hạng mục.
                </Text>
              ) : (
                <View className="mb-2.5 gap-2.5">
                  {jobConfigs.map((config) => {
                    const job = jobById.get(config.jobId);
                    const quantity = toNumberOrOne(config.quantityText);
                    return (
                      <View
                        key={config.jobId}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1">
                            <Text className="text-xs font-bold text-slate-800" numberOfLines={2}>
                              {job?.name || 'Hạng mục'}
                            </Text>
                            <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                              {job?.code ? `#${job.code}` : `#${config.jobId.slice(0, 8)}`}
                              {job?.costPrice !== undefined && job?.costPrice !== null
                                ? ` • ${formatVND(job.costPrice)}`
                                : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            className="h-9 w-9 items-center justify-center rounded-lg bg-red-50"
                            onPress={() => handleRemoveJob(config.jobId)}
                            accessibilityRole="button"
                            accessibilityLabel="Gỡ hạng mục"
                          >
                            <Feather name="trash-2" size={15} color="#EF4444" />
                          </TouchableOpacity>
                        </View>

                        <View className="mt-2.5 flex-row items-center gap-2.5">
                          <View className="flex-1">
                            <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                              Số lượng
                            </Text>
                            <TextInput
                              className="h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                              keyboardType="numeric"
                              value={config.quantityText}
                              onChangeText={(text) => handleQuantityChange(config.jobId, text)}
                            />
                          </View>

                          <TouchableOpacity
                            className={`min-h-[44px] flex-row items-center gap-2 rounded-xl border px-3 ${
                              config.isOutput
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-slate-200 bg-white'
                            }`}
                            onPress={() => handleToggleOutput(config.jobId)}
                            activeOpacity={0.8}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: config.isOutput }}
                          >
                            <View
                              className={`h-5 w-5 items-center justify-center rounded border-2 ${
                                config.isOutput
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {config.isOutput ? (
                                <Feather name="check" size={12} color="#FFFFFF" />
                              ) : null}
                            </View>
                            <Text
                              className={`text-xs font-semibold ${
                                config.isOutput ? 'text-emerald-700' : 'text-slate-600'
                              }`}
                            >
                              Đầu ra
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <Text className="mt-2 text-[11px] font-semibold text-slate-500">
                          Thành tiền: {formatVND(Number(job?.costPrice || 0) * quantity)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-white"
                onPress={() => setIsJobPickerOpen((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Feather name={isJobPickerOpen ? 'chevron-up' : 'plus'} size={16} color="#F38820" />
                <Text className="text-sm font-bold text-primary">Thêm hạng mục</Text>
              </TouchableOpacity>

              {isJobPickerOpen ? (
                <View className="mt-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
                  <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 h-[44px]">
                    <Feather name="search" size={16} color="#94A3B8" />
                    <TextInput
                      className="flex-1 text-sm text-slate-900"
                      placeholder="Tìm theo tên hoặc mã công việc..."
                      placeholderTextColor="#94A3B8"
                      value={jobSearch}
                      onChangeText={setJobSearch}
                    />
                  </View>

                  {isLoadingJobs ? (
                    <View className="items-center py-4">
                      <ActivityIndicator size="small" color={BrandColors.primary} />
                    </View>
                  ) : availableJobs.length === 0 ? (
                    <Text className="py-3 text-center text-[11px] italic text-slate-400">
                      {jobs.length === 0
                        ? 'Chưa có công việc mẫu nào trong hệ thống.'
                        : 'Không còn hạng mục nào phù hợp để thêm.'}
                    </Text>
                  ) : (
                    <ScrollView className="max-h-[220px]" keyboardShouldPersistTaps="handled">
                      {availableJobs.slice(0, 40).map((job) => (
                        <TouchableOpacity
                          key={job.id}
                          className="min-h-[48px] flex-row items-center justify-between border-b border-slate-100 px-1"
                          onPress={() => handleAddJob(job.id)}
                          activeOpacity={0.75}
                        >
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-semibold text-slate-800" numberOfLines={1}>
                              {job.name || 'Hạng mục'}
                            </Text>
                            <Text className="text-[11px] text-slate-400">
                              {job.code ? `#${job.code} • ` : ''}
                              {formatVND(job.costPrice ?? 0)}
                            </Text>
                          </View>
                          <Feather name="plus-circle" size={18} color="#F38820" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="flex-row gap-3 border-t border-slate-100 px-5 py-3.5">
            <TouchableOpacity
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100 py-3.5"
              onPress={onClose}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="submitServiceButton"
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary py-3.5"
              onPress={submit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {isEditMode ? 'Lưu thay đổi' : 'Lưu dịch vụ'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
