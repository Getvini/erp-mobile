import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceFormModal from '@/components/catalog/ServiceFormModal';
import {
  useAddServiceJobMutation,
  useDeleteServiceMutation,
  useRemoveServiceJobMutation,
  useServiceDetailQuery,
  useServicesQuery,
  useUpdateServiceMutation,
} from '@/hooks/queries/useServices';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import type { JobReference, ServiceItem, ServiceJobItem } from '@/services/catalogService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessServiceCatalog, canBulkDeleteServices } from '@/utils/rbac';
import { formatVND } from '@/utils/formatters';
import { computeServiceCost } from '@/utils/catalogPricing';
import { safeGoBack } from '@/utils/navigation';
import JobFormModal from '@/components/jobs/JobFormModal';
import { validateServiceForm } from '@/utils/serviceValidation';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canAccess = canAccessServiceCatalog(role);
  // Quản lý cấu hình dịch vụ & xóa: chỉ ADMIN/BOD.
  const canManage = canBulkDeleteServices(role);

  const serviceId = typeof id === 'string' ? id : '';
  const [isEditOpen, setIsEditOpen] = useState(false);
  // `key` mới mỗi lần mở ⇒ ServiceFormModal remount và khởi tạo lại form state.
  const [editFormKey, setEditFormKey] = useState(0);
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'JOB' | 'SERVICE'>('JOB');
  const [jobSearch, setJobSearch] = useState('');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, { quantity?: string; isOutput?: boolean }>>({});

  const {
    data: service,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useServiceDetailQuery(serviceId);
  const deleteMutation = useDeleteServiceMutation();
  const updateServiceMutation = useUpdateServiceMutation();
  const addJobMutation = useAddServiceJobMutation();
  const removeJobMutation = useRemoveServiceJobMutation();

  const { data: jobs = [], isLoading: isLoadingJobs, isError: jobsError, refetch: refetchJobs } = useJobsQuery(
    {},
    { enabled: Boolean(serviceId) && canManage }
  );

  const { data: services = [], isLoading: isLoadingServices, isError: servicesError, refetch: refetchServices } = useServicesQuery(
    {},
    { enabled: Boolean(serviceId) && canManage && isJobSheetOpen && pickerTab === 'SERVICE' },
  );

  const serviceJobs = useMemo<ServiceJobItem[]>(
    () => (Array.isArray(service?.serviceJobs) ? service.serviceJobs : []),
    [service],
  );

  const draftConfigs = useMemo(() => serviceJobs.map((item) => ({
    jobId: item.jobId, quantity: Number(draft[item.jobId]?.quantity ?? item.quantity ?? 1),
    isOutput: draft[item.jobId]?.isOutput ?? Boolean(item.isOutput),
  })), [serviceJobs, draft]);
  const hasUnknownCost = serviceJobs.some((item) => item.job?.costPrice == null);
  const totalCost = useMemo(() => computeServiceCost(serviceJobs.map((item) => ({ ...item, quantity: Number(draft[item.jobId]?.quantity ?? item.quantity ?? 1) }))), [serviceJobs, draft]);
  const saveDraft = async () => {
    if (!canManage || updateServiceMutation.isPending || !service) return;
    const error = validateServiceForm({ name: service.name, unit: service.unit || 'Đơn vị', jobConfigs: draftConfigs }, false);
    if (error) { Alert.alert('Lỗi nhập liệu', error); return; }
    try {
      await updateServiceMutation.mutateAsync({ id: serviceId, jobConfigs: draftConfigs });
      setDraft({});
      Alert.alert('Thành công', 'Đã lưu cấu hình hạng mục.');
    } catch (error) { Alert.alert('Không thể lưu cấu hình', error instanceof Error ? error.message : 'Vui lòng thử lại.'); }
  };

  const availableJobs = useMemo(() => {
    const usedIds = new Set(serviceJobs.map((serviceJob) => serviceJob.jobId));
    const keyword = jobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (usedIds.has(job.id)) return false;
      if (!keyword) return true;
      return (
        (job.name || '').toLowerCase().includes(keyword) ||
        (job.code || '').toLowerCase().includes(keyword)
      );
    });
  }, [jobSearch, jobs, serviceJobs]);

  const availableServices = useMemo(() => {
    const usedIds = new Set(serviceJobs.map((sj) => String(sj.jobId)));
    const keyword = jobSearch.trim().toLowerCase();
    return services
      .filter((s) => String(s.id) !== String(serviceId))
      .map((s) => {
        const availableJobs = (s.serviceJobs ?? []).filter(
          (sj) => !usedIds.has(String(sj.jobId)),
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
  }, [jobSearch, serviceId, serviceJobs, services]);

  const handleAddJob = useCallback(
    async (job: JobReference) => {
      if (!canManage || addJobMutation.isPending) return;
      if (Object.keys(draft).length > 0) { Alert.alert('Chưa lưu cấu hình', 'Hãy lưu hoặc hoàn tác cấu hình trước khi thêm hạng mục.'); return; }
      try {
        await addJobMutation.mutateAsync({ id: serviceId, jobId: job.id });
        await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
        setJobSearch('');
        setIsJobSheetOpen(false);
      } catch (addError: any) {
        await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
        Alert.alert(
          'Không thể thêm hạng mục',
          addError?.message || 'Vui lòng kiểm tra lại và thử lại.',
        );
      }
    },
    [canManage, draft, addJobMutation, serviceId],
  );

  const handleAddJobsFromService = useCallback(
    async (sourceService: ServiceItem) => {
      if (!canManage || updateServiceMutation.isPending) return;
      if (Object.keys(draft).length > 0) { Alert.alert('Chưa lưu cấu hình', 'Hãy lưu hoặc hoàn tác cấu hình trước khi thêm hạng mục từ dịch vụ khác.'); return; }
      try {
        const existingIds = new Set(serviceJobs.map((sj) => String(sj.jobId)));
        const sourceJobs = sourceService.serviceJobs ?? [];
        const jobsToAdd = sourceJobs.filter((sj) => !existingIds.has(String(sj.jobId)));

        if (jobsToAdd.length === 0) {
          Alert.alert(
            'Thông báo',
            `Tất cả hạng mục của dịch vụ "${sourceService.name}" đã có trong dịch vụ này.`,
          );
          return;
        }

        const currentConfigs = serviceJobs.map((sj) => ({
          jobId: sj.jobId,
          quantity: Number(sj.quantity || 1),
          isOutput: Boolean(sj.isOutput),
        }));

        const sourceConfigs = jobsToAdd.map((sj) => ({
          jobId: sj.jobId,
          quantity: Number(sj.quantity || 1),
          isOutput: Boolean(sj.isOutput),
        }));

        await updateServiceMutation.mutateAsync({
          id: serviceId,
          jobConfigs: [...currentConfigs, ...sourceConfigs],
        });

        await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
        setJobSearch('');
        setIsJobSheetOpen(false);
      } catch (addError: any) {
        await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
        Alert.alert(
          'Không thể thêm hạng mục',
          addError?.message || 'Vui lòng thử lại.',
        );
      }
    },
    [canManage, draft, serviceId, serviceJobs, updateServiceMutation],
  );

  const handleRemoveJob = useCallback(
    (serviceJob: ServiceJobItem) => {
      if (!canManage || removeJobMutation.isPending) return;
      if (Object.keys(draft).length > 0) { Alert.alert('Chưa lưu cấu hình', 'Hãy lưu hoặc hoàn tác cấu hình trước khi gỡ hạng mục.'); return; }
      Alert.alert(
        'Gỡ hạng mục',
        `Bạn có chắc muốn gỡ hạng mục “${serviceJob.job?.name || serviceJob.jobId}” khỏi dịch vụ?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Gỡ',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeJobMutation.mutateAsync({ id: serviceId, jobId: serviceJob.jobId });
                await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              } catch (removeError: any) {
                await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
                Alert.alert(
                  'Không thể gỡ hạng mục',
                  removeError?.message || 'Vui lòng thử lại.',
                );
              }
            },
          },
        ],
      );
    },
    [canManage, draft, removeJobMutation, serviceId],
  );

  const handleDelete = useCallback(() => {
    if (!canManage || !service || deleteMutation.isPending) return;

    Alert.alert(
      'Xóa dịch vụ',
      `Bạn có chắc muốn xóa “${service.name}”? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa dịch vụ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(service.id);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa dịch vụ.', [
                { text: 'Đóng', onPress: () => router.replace('/services' as any) },
              ]);
            } catch (deleteError: any) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert(
                'Không thể xóa dịch vụ',
                deleteError?.message || 'Vui lòng kiểm tra dữ liệu liên quan và thử lại.',
              );
            }
          },
        },
      ],
    );
  }, [canManage, deleteMutation, router, service]);

  if (!canAccess) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-8" edges={['top']}>
        <Feather name="shield-off" size={40} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không có quyền truy cập</Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5"
          onPress={() => safeGoBack(router, '/services')}
        >
          <Text className="text-sm font-bold text-white">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
        <View className="h-14 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-44 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-64 rounded-2xl bg-slate-200" />
      </SafeAreaView>
    );
  }

  if (isError || !service) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => safeGoBack(router, '/services')}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Chi tiết dịch vụ</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="alert-circle" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được dịch vụ</Text>
          <Text className="text-center text-xs text-slate-500">
            {error instanceof Error ? error.message : 'Dịch vụ không tồn tại hoặc đã bị xóa.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/services')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900" numberOfLines={1}>
          Chi tiết dịch vụ
        </Text>

        {canManage ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              testID="editServiceButton"
              className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
              onPress={() => {
                if (!canManage) return;
              if (Object.keys(draft).length > 0) { Alert.alert('Chưa lưu cấu hình', 'Hãy lưu hoặc hoàn tác cấu hình trước khi mở biểu mẫu sửa.'); return; }
              setEditFormKey((key) => key + 1);
                setIsEditOpen(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sửa dịch vụ"
            >
              <Feather name="edit-2" size={18} color={BrandColors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="deleteServiceButton"
              className="h-12 w-12 items-center justify-center rounded-xl bg-red-50"
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Xóa dịch vụ"
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Feather name="trash-2" size={18} color="#EF4444" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="w-12" />
        )}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* Thông tin dịch vụ */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-extrabold text-slate-900">{service.name}</Text>
            {service.isAI ? (
              <View className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1">
                <Text className="text-[10px] font-bold text-violet-600">AI</Text>
              </View>
            ) : null}
          </View>

          <Text className="mt-3 text-xs font-semibold uppercase text-slate-400">Mã dịch vụ</Text>
          <Text className="text-sm font-bold text-slate-800">
            {service.code || 'Chưa cập nhật'}
          </Text>

          <View className="mt-3 border-t border-slate-100 pt-3">
            <Text className="text-xs font-semibold uppercase text-slate-400">Đơn vị</Text>
            <Text className="text-sm font-bold text-slate-800">
              {service.unit || 'Chưa cập nhật'}
            </Text>
          </View>

          <View className="mt-3 border-t border-slate-100 pt-3">
            <Text className="text-xs font-semibold uppercase text-slate-400">Mô tả</Text>
            <Text className="text-sm leading-5 text-slate-700">
              {service.description || 'Chưa cập nhật'}
            </Text>
          </View>

          <View className="mt-3 flex-row gap-3 border-t border-slate-100 pt-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-slate-400">Giá vốn (hệ thống)</Text>
              <Text className="text-sm font-extrabold text-orange-600">
                {service.costPrice == null ? 'Chưa có dữ liệu' : formatVND(service.costPrice)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-slate-400">Chi phí chung</Text>
              <Text className="text-sm font-bold text-slate-700">
                {service.overheadCost == null ? 'Chưa có dữ liệu' : formatVND(service.overheadCost)}
              </Text>
            </View>
          </View>
        </View>

        {/* Danh sách hạng mục */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-bold text-slate-900">
              Hạng mục ({serviceJobs.length})
            </Text>
            {canManage ? (
              <TouchableOpacity
                testID="addServiceJobButton"
                className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl border border-primary bg-primary-light px-3"
                onPress={() => {
                  setJobSearch('');
                  setIsJobSheetOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={15} color={BrandColors.primary} />
                <Text className="text-xs font-bold text-primary">Thêm hạng mục</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {serviceJobs.length === 0 ? (
            <View className="items-center gap-2 py-8">
              <Feather name="layers" size={30} color="#CBD5E1" />
              <Text className="text-sm font-semibold text-slate-500">
                Dịch vụ chưa có hạng mục nào
              </Text>
              <Text className="max-w-[240px] text-center text-[11px] text-slate-400">
                Giá vốn dịch vụ được hệ thống tính từ các hạng mục công việc.
              </Text>
            </View>
          ) : (
            serviceJobs.map((serviceJob, index) => {
              const quantity = Number(draft[serviceJob.jobId]?.quantity ?? serviceJob.quantity ?? 1);
              const unitCost = Number(serviceJob.job?.costPrice || 0);
              return (
                <View
                  key={`${serviceJob.jobId}-${index}`}
                  className={`flex-row items-center gap-3 py-2.5 ${
                    index === 0 ? '' : 'border-t border-slate-100'
                  }`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-bold text-slate-800">
                        {serviceJob.job?.name || 'Hạng mục'}
                      </Text>
                      {(draft[serviceJob.jobId]?.isOutput ?? serviceJob.isOutput) ? (
                        <View className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-emerald-600">Đầu ra</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {serviceJob.job?.code ? `#${serviceJob.job.code}` : `#${serviceJob.jobId.slice(0, 8)}`}
                      {` • SL: ${quantity}`}
                      {` • Đơn giá: ${serviceJob.job?.costPrice == null ? 'Chưa có dữ liệu' : formatVND(unitCost)}`}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">Đơn vị: {serviceJob.job?.unit || '—'} · Đầu ra: {(draft[serviceJob.jobId]?.isOutput ?? serviceJob.isOutput) ? 'Có' : 'Không'}</Text>
                    {canManage ? <View className="flex-row flex-wrap items-center gap-2 mt-2">
                      <Text className="text-xs text-slate-600">Số lượng</Text>
                      <TextInput accessibilityLabel={'Số lượng ' + (serviceJob.job?.name || serviceJob.jobId)} className="min-h-[48px] min-w-[64px] px-3 rounded-xl border border-slate-200 text-slate-900" keyboardType="number-pad" editable={!updateServiceMutation.isPending} value={draft[serviceJob.jobId]?.quantity ?? String(serviceJob.quantity ?? 1)} onChangeText={(quantity) => setDraft((previous) => ({ ...previous, [serviceJob.jobId]: { ...previous[serviceJob.jobId], quantity } }))} />
                      <TouchableOpacity disabled={updateServiceMutation.isPending} accessibilityRole="checkbox" accessibilityLabel={'Đầu ra ' + (serviceJob.job?.name || serviceJob.jobId)} accessibilityState={{ checked: draft[serviceJob.jobId]?.isOutput ?? Boolean(serviceJob.isOutput) }} className="min-h-[48px] justify-center px-3 rounded-xl border border-slate-200" onPress={() => setDraft((previous) => ({ ...previous, [serviceJob.jobId]: { ...previous[serviceJob.jobId], isOutput: !(previous[serviceJob.jobId]?.isOutput ?? serviceJob.isOutput) } }))}><Text className="text-xs text-slate-700">{(draft[serviceJob.jobId]?.isOutput ?? serviceJob.isOutput) ? '☑ Đầu ra' : '☐ Đầu ra'}</Text></TouchableOpacity>
                    </View> : null}
                    <Text className="mt-1 text-sm font-bold text-orange-600">
                      {serviceJob.job?.costPrice == null ? 'Chưa có dữ liệu' : formatVND(unitCost * quantity)}
                    </Text>
                  </View>

                  {canManage ? (
                    <TouchableOpacity
                      className="h-11 w-11 items-center justify-center rounded-xl bg-red-50"
                      onPress={() => handleRemoveJob(serviceJob)}
                      accessibilityRole="button"
                      accessibilityLabel={`Gỡ hạng mục ${serviceJob.job?.name || ''}`}
                    >
                      <Feather name="x-circle" size={17} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}

          {canManage && Object.keys(draft).length > 0 ? <View className="flex-row gap-3 mt-3">
            <TouchableOpacity className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-slate-100" disabled={updateServiceMutation.isPending} onPress={() => setDraft({})}><Text className="font-bold text-slate-600">Hoàn tác</Text></TouchableOpacity>
            <TouchableOpacity className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-primary" disabled={updateServiceMutation.isPending} onPress={saveDraft}>{updateServiceMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Lưu cấu hình</Text>}</TouchableOpacity>
          </View> : null}
          {serviceJobs.length > 0 ? (
            <View className="mt-3 flex-row items-center justify-between border-t border-slate-200 pt-3">
              <Text className="text-xs font-bold text-slate-600">Tổng giá vốn hạng mục</Text>
              <Text className="text-sm font-extrabold text-orange-600">{hasUnknownCost ? 'Chưa đủ dữ liệu giá vốn' : formatVND(totalCost)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom sheet chọn Job / Dịch vụ khác */}
      <Modal
        visible={isJobSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsJobSheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-3xl border-t border-slate-200 bg-white">
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-5">
              <Text className="text-lg font-bold text-slate-900">Thêm hạng mục công việc</Text>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
                onPress={() => setIsJobSheetOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {canManage ? <TouchableOpacity className="min-h-[48px] justify-center px-5" onPress={() => setIsCreateJobOpen(true)}><Text className="font-bold text-primary">Tạo hạng mục mới</Text></TouchableOpacity> : null}
            {/* Tabs chọn nguồn thêm */}
            <View className="flex-row gap-2 px-5 pt-3">
              <TouchableOpacity
                className={`min-h-[42px] flex-1 items-center justify-center rounded-xl border ${
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
                className={`min-h-[42px] flex-1 items-center justify-center rounded-xl border ${
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

            <View className="px-5 pt-3">
              <View className="h-[48px] flex-row items-center gap-2 rounded-xl bg-slate-100 px-3">
                <Feather name="search" size={18} color="#94A3B8" />
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
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {pickerTab === 'JOB' ? (
                jobsError ? (<TouchableOpacity className="min-h-[48px] justify-center" onPress={() => refetchJobs()}><Text className="text-red-600">Không tải được hạng mục. Bấm thử lại.</Text></TouchableOpacity>) : isLoadingJobs ? (
                  <View className="items-center py-8">
                    <ActivityIndicator color={BrandColors.primary} />
                  </View>
                ) : availableJobs.length === 0 ? (
                  <View className="items-center gap-2 py-8">
                    <Feather name="inbox" size={30} color="#CBD5E1" />
                    <Text className="text-xs text-slate-400">
                      {jobs.length === 0
                        ? 'Chưa có công việc mẫu nào trong hệ thống.'
                        : 'Không còn hạng mục nào phù hợp để thêm.'}
                    </Text>
                  </View>
                ) : (
                  availableJobs.slice(0, 60).map((job) => (
                    <TouchableOpacity
                      key={job.id}
                      className="min-h-[56px] flex-row items-center justify-between border-b border-slate-100 py-2"
                      onPress={() => handleAddJob(job)}
                      disabled={addJobMutation.isPending}
                      activeOpacity={0.75}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
                          {job.name || 'Hạng mục'}
                        </Text>
                        <Text className="text-[11px] text-slate-400">
                          {job.code ? `#${job.code} • ` : ''}
                          {job.costPrice == null ? 'Chưa có dữ liệu' : formatVND(job.costPrice)}
                          {job.unit ? ` • ${job.unit}` : ''}
                        </Text>
                      </View>
                      <Feather name="plus-circle" size={20} color={BrandColors.primary} />
                    </TouchableOpacity>
                  ))
                )
              ) : servicesError ? (<TouchableOpacity className="min-h-[48px] justify-center" onPress={() => refetchServices()}><Text className="text-red-600">Không tải được dịch vụ. Bấm thử lại.</Text></TouchableOpacity>) : isLoadingServices ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={BrandColors.primary} />
                </View>
              ) : availableServices.length === 0 ? (
                <View className="items-center gap-2 py-8">
                  <Feather name="inbox" size={30} color="#CBD5E1" />
                  <Text className="text-xs text-slate-400">
                    {services.length === 0
                      ? 'Chưa có dịch vụ nào khác trong hệ thống.'
                      : 'Không có dịch vụ nào có hạng mục mới để thêm.'}
                  </Text>
                </View>
              ) : (
                availableServices.slice(0, 60).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    className="min-h-[60px] flex-row items-center justify-between border-b border-slate-100 py-2.5"
                    onPress={() => handleAddJobsFromService(s)}
                    disabled={updateServiceMutation.isPending}
                    activeOpacity={0.75}
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
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
                    <View className="flex-row items-center gap-1 rounded-xl bg-orange-50 px-3 py-2">
                      <Feather name="copy" size={14} color="#F38820" />
                      <Text className="text-xs font-bold text-primary">Thêm</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
        {isCreateJobOpen ? <JobFormModal visible onClose={() => setIsCreateJobOpen(false)} onSuccess={(job) => { if (job?.id) void handleAddJob(job); }} /> : null}
      </Modal>

      <ServiceFormModal
        key={`service-edit-form-${editFormKey}`}
        visible={isEditOpen}
        service={service}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}
