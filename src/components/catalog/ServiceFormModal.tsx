import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  useServicesQuery,
  useUpdateServiceMutation,
} from '@/hooks/queries/useServices';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import { BrandColors } from '@/constants/colors';
import { SERVICE_UNIT_SUGGESTIONS } from '@/utils/catalogPricing';
import { formatNumberInput, parseNumberInput, formatVND } from '@/utils/formatters';
import { validateServiceForm } from '@/utils/serviceValidation';
import { ServiceCreationOperation } from '@/utils/serviceCreation';
import { useAuthStore } from '@/stores/useAuthStore';
import { isManagementRole } from '@/utils/rbac';
import JobFormModal from '@/components/jobs/JobFormModal';

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
  const canWrite = isManagementRole(useAuthStore((state) => state.user?.role));
  const creation = useRef(new ServiceCreationOperation());
  const submitting = useRef(false);
  const [hasPartialCreation, setHasPartialCreation] = useState(false);
  const [addedJobs, setAddedJobs] = useState<JobReference[]>([]);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const createServiceMutation = useCreateServiceMutation();
  const updateServiceMutation = useUpdateServiceMutation();

  const [name, setName] = useState(service?.name ?? '');
  const [code, setCode] = useState(service?.code ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [unit, setUnit] = useState(service?.unit ?? '');
  const [isAI, setIsAI] = useState(Boolean(service?.isAI));
  const [isBudget, setIsBudget] = useState(Boolean(service?.isBudget));
  const [jobConfigs, setJobConfigs] = useState<JobConfigRow[]>(() =>
    (service?.serviceJobs ?? []).map((serviceJob) => ({
      jobId: serviceJob.jobId,
      quantityText: formatNumberInput(Number(serviceJob.quantity || 1)),
      isOutput: Boolean(serviceJob.isOutput),
    })),
  );
  const [jobSearch, setJobSearch] = useState('');
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'JOB' | 'SERVICE'>('JOB');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: jobs = [], isLoading: isLoadingJobs, isError: jobsError, refetch: refetchJobs } = useJobsQuery({}, { enabled: visible });
  const { data: services = [], isLoading: isLoadingServices, isError: servicesError, refetch: refetchServices } = useServicesQuery(
    {},
    { enabled: visible && isJobPickerOpen && pickerTab === 'SERVICE' },
  );

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
    addedJobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [addedJobs, jobs, service]);

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

  const availableServices = useMemo(() => {
    const selectedIds = new Set(jobConfigs.map((c) => String(c.jobId)));
    const keyword = jobSearch.trim().toLowerCase();
    return services
      .filter((s) => !(service?.id && String(s.id) === String(service.id)))
      .map((s) => {
        const availableJobs = (s.serviceJobs ?? []).filter(
          (sj) => !selectedIds.has(String(sj.jobId)),
        );
        return { ...s, availableJobs };
      })
      .filter((s) => s.availableJobs.length > 0)
      .filter(
        (s) =>
          !keyword ||
          (s.name || '').toLowerCase().includes(keyword) ||
          (s.code || '').toLowerCase().includes(keyword),
      );
  }, [jobConfigs, jobSearch, service, services]);

  const handleAddJob = useCallback((jobId: string) => {
    setJobConfigs((prev) =>
      prev.some((config) => config.jobId === jobId)
        ? prev
        : [...prev, { jobId, quantityText: '1', isOutput: false }],
    );
    setJobSearch('');
    setIsJobPickerOpen(false);
  }, []);

  const handleAddJobsFromService = useCallback(
    (sourceService: ServiceItem) => {
      const existingJobIds = new Set(jobConfigs.map((c) => c.jobId));
      const sourceJobs = sourceService.serviceJobs ?? [];
      const jobsToAdd = sourceJobs.filter((sj) => !existingJobIds.has(sj.jobId));

      if (jobsToAdd.length === 0) {
        Alert.alert(
          'Thông báo',
          `Tất cả hạng mục của dịch vụ "${sourceService.name}" đã có trong danh sách.`,
        );
        return;
      }

      const newConfigs: JobConfigRow[] = jobsToAdd.map((sj) => ({
        jobId: sj.jobId,
        quantityText: formatNumberInput(Number(sj.quantity || 1)),
        isOutput: Boolean(sj.isOutput),
      }));

      setJobConfigs((prev) => [...prev, ...newConfigs]);
      setJobSearch('');
      setIsJobPickerOpen(false);
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
    },
    [jobConfigs],
  );

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

  const requestClose = () => {
    if (submitting.current) return;
    if (!isEditMode && creation.current.createdId) {
      Alert.alert('Dịch vụ đã được tạo', 'Cấu hình chưa hoàn tất. Bạn có thể tiếp tục lưu hoặc đóng và sửa dịch vụ đã có trong danh sách.', [
        { text: 'Tiếp tục lưu', style: 'cancel' }, { text: 'Đóng', onPress: onClose },
      ]);
    } else onClose();
  };
  const submit = useCallback(async () => {
    if (!canWrite || submitting.current) return;
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    const normalizedConfigs: ServiceJobConfig[] = jobConfigs.map((config) => ({
      jobId: config.jobId,
      quantity: parseNumberInput(config.quantityText),
      isOutput: config.isOutput,
    }));

    const validationError = validateServiceForm(
      {
        name: trimmedName,
        code: trimmedCode,
        description: description.trim(),
        unit: unit.trim(),
        isAI,
        isBudget,
        jobConfigs: normalizedConfigs,
      },
      isEditMode,
    );

    if (jobConfigs.some((config) => !jobById.has(config.jobId))) { Alert.alert('Chưa đủ dữ liệu', 'Hãy tải lại danh sách hạng mục trước khi lưu.'); return; }
    if (validationError) {
      Alert.alert('Lỗi nhập liệu', validationError);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      if (isEditMode && service) {
        const basicChanged =
          trimmedName !== (service.name ?? '') ||
          trimmedCode !== (service.code ?? '') ||
          description.trim() !== (service.description ?? '') ||
          unit.trim() !== (service.unit ?? '') ||
          isAI !== Boolean(service.isAI) ||
          isBudget !== Boolean(service.isBudget);

        const jobsChanged =
          JSON.stringify(normalizedConfigs) !== JSON.stringify(originalJobConfigs);

        if (!basicChanged && !jobsChanged) {
          onClose();
          return;
        }

        await updateServiceMutation.mutateAsync({
          id: service.id,
          ...(basicChanged ? { name: trimmedName, code: trimmedCode, description: description.trim(), unit: unit.trim(), isAI, isBudget } : {}),
          ...(jobsChanged ? { jobConfigs: normalizedConfigs } : {}),
        });
      } else {
        await creation.current.save({
          create: (payload) => createServiceMutation.mutateAsync(payload),
          update: (payload) => updateServiceMutation.mutateAsync(payload),
        }, {
          name: trimmedName, description: description.trim(), unit: unit.trim(), isAI, isBudget,
          jobIds: normalizedConfigs.map((config) => config.jobId),
          outputJobIds: normalizedConfigs.filter((config) => config.isOutput).map((config) => config.jobId),
        }, normalizedConfigs);
      }

      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      setHasPartialCreation(Boolean(creation.current.createdId));
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert(
        isEditMode ? 'Không thể cập nhật dịch vụ' : 'Không thể tạo dịch vụ',
        error?.message || 'Vui lòng kiểm tra dữ liệu và thử lại.',
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }, [
    canWrite,
    code,
    createServiceMutation,
    description,
    isAI,
    isBudget,
    isEditMode,
    jobConfigs,
    jobById,
    name,
    onClose,
    onSuccess,
    originalJobConfigs,
    service,
    unit,
    updateServiceMutation,
  ]);

  const hasUnknownJobCost = jobConfigs.some((config) => jobById.get(config.jobId)?.costPrice == null);
  const previewCost = useMemo(
    () =>
      jobConfigs.reduce((sum, config) => {
        const job = jobById.get(config.jobId);
        return sum + Number(job?.costPrice || 0) * toNumberOrOne(config.quantityText);
      }, 0),
    [jobById, jobConfigs],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={requestClose}>
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
              onPress={requestClose}
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

            {isEditMode ? <View>
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
            </View> : <Text className="text-xs text-slate-500">Mã dịch vụ được hệ thống tạo tự động.</Text>}

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Đơn vị tính *</Text>
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

            <TouchableOpacity
              testID="serviceIsBudgetCheckbox"
              className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5"
              onPress={() => setIsBudget((prev) => !prev)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isBudget }}
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
                  isBudget ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                }`}
              >
                {isBudget ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-700">
                  Cho phép nhập ngân sách
                </Text>
                <Text className="text-[11px] text-slate-400">
                  Cho phép tạo yêu cầu chi phí/ngân sách quảng cáo cho dịch vụ này
                </Text>
              </View>
            </TouchableOpacity>

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

            {/* Bộ chọn hạng mục */}
            <View className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-xs font-bold text-slate-700">Hạng mục công việc</Text>
                <Text className="text-xs font-bold text-orange-600">{hasUnknownJobCost ? 'Chưa đủ dữ liệu giá vốn' : formatVND(previewCost)}</Text>
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

                        <View className="mt-2.5 flex-row items-end gap-2.5">
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
                            className={`h-[44px] flex-row items-center gap-2 rounded-xl border px-3 ${
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
                          Đơn vị: {job?.unit || '—'} · Thành tiền: {job?.costPrice == null ? 'Chưa có dữ liệu' : formatVND(Number(job.costPrice) * quantity)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View className="flex-row justify-between gap-2 border-t border-slate-200 py-3">
                <Text className="text-xs font-bold text-slate-600">Tổng giá vốn tạm tính</Text>
                <Text className="text-sm font-bold text-primary">{hasUnknownJobCost ? 'Chưa đủ dữ liệu' : formatVND(previewCost)}</Text>
              </View>
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
                  {canWrite ? <TouchableOpacity className="min-h-[48px] justify-center px-3 mb-2 rounded-xl bg-orange-50" onPress={() => setIsCreateJobOpen(true)}><Text className="font-bold text-primary">Tạo hạng mục mới</Text></TouchableOpacity> : null}
                  {/* Tabs chọn nguồn thêm */}
                  <View className="mb-2.5 flex-row gap-2">
                    <TouchableOpacity
                      className={`min-h-[38px] flex-1 items-center justify-center rounded-lg border ${
                        pickerTab === 'JOB'
                          ? 'border-primary bg-primary'
                          : 'border-slate-200 bg-slate-100'
                      }`}
                      onPress={() => setPickerTab('JOB')}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-xs ${
                          pickerTab === 'JOB' ? 'font-bold text-white' : 'font-semibold text-slate-600'
                        }`}
                      >
                        Hạng mục mẫu
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`min-h-[38px] flex-1 items-center justify-center rounded-lg border ${
                        pickerTab === 'SERVICE'
                          ? 'border-primary bg-primary'
                          : 'border-slate-200 bg-slate-100'
                      }`}
                      onPress={() => setPickerTab('SERVICE')}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-xs ${
                          pickerTab === 'SERVICE' ? 'font-bold text-white' : 'font-semibold text-slate-600'
                        }`}
                      >
                        Từ dịch vụ khác
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 h-[44px]">
                    <Feather name="search" size={16} color="#94A3B8" />
                    <TextInput
                      className="flex-1 text-sm text-slate-900"
                      placeholder={
                        pickerTab === 'JOB'
                          ? 'Tìm theo tên hoặc mã công việc...'
                          : 'Tìm theo tên hoặc mã dịch vụ...'
                      }
                      placeholderTextColor="#94A3B8"
                      value={jobSearch}
                      onChangeText={setJobSearch}
                    />
                  </View>

                  {pickerTab === 'JOB' ? (
                    jobsError ? (<TouchableOpacity className="min-h-[48px] justify-center" onPress={() => refetchJobs()}><Text className="text-red-600">Không tải được hạng mục. Bấm thử lại.</Text></TouchableOpacity>) : isLoadingJobs ? (
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
                                {job.costPrice == null ? 'Chưa có dữ liệu' : formatVND(job.costPrice)}
                              </Text>
                            </View>
                            <Feather name="plus-circle" size={18} color="#F38820" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )
                  ) : servicesError ? (<TouchableOpacity className="min-h-[48px] justify-center" onPress={() => refetchServices()}><Text className="text-red-600">Không tải được dịch vụ. Bấm thử lại.</Text></TouchableOpacity>) : isLoadingServices ? (
                    <View className="items-center py-4">
                      <ActivityIndicator size="small" color={BrandColors.primary} />
                    </View>
                  ) : availableServices.length === 0 ? (
                    <Text className="py-3 text-center text-[11px] italic text-slate-400">
                      {services.length === 0
                        ? 'Chưa có dịch vụ nào khác trong hệ thống.'
                        : 'Không có dịch vụ nào có hạng mục mới để thêm.'}
                    </Text>
                  ) : (
                    <ScrollView className="max-h-[220px]" keyboardShouldPersistTaps="handled">
                      {availableServices.slice(0, 40).map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          className="min-h-[52px] flex-row items-center justify-between border-b border-slate-100 px-1 py-1.5"
                          onPress={() => handleAddJobsFromService(s)}
                          activeOpacity={0.75}
                        >
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                              {s.name}
                            </Text>
                            <Text className="text-[11px] text-slate-400" numberOfLines={1}>
                              {s.code ? `#${s.code} • ` : ''}
                              {s.availableJobs.length} hạng mục có thể thêm
                            </Text>
                            <Text className="text-[11px] text-slate-400" numberOfLines={2}>
                              {s.availableJobs.map((sj: any) => sj.job?.name).filter(Boolean).join(', ')}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1 rounded-lg bg-orange-50 px-2 py-1">
                            <Feather name="copy" size={13} color="#F38820" />
                            <Text className="text-[11px] font-bold text-primary">Thêm</Text>
                          </View>
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
              onPress={requestClose}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="submitServiceButton"
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary py-3.5"
              onPress={submit}
              disabled={isSubmitting || !canWrite || hasUnknownJobCost}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {hasPartialCreation && !isEditMode ? 'Thử lưu cấu hình lại' : isEditMode ? 'Lưu thay đổi' : 'Lưu dịch vụ'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      {isCreateJobOpen ? <JobFormModal visible onClose={() => setIsCreateJobOpen(false)} onSuccess={(job) => { if (job?.id) { setAddedJobs((previous) => [...previous, job]); handleAddJob(job.id); } void refetchJobs(); }} /> : null}
    </Modal>
  );
}
