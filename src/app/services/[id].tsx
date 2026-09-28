import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceFormModal from '@/components/catalog/ServiceFormModal';
import {
  useAddServiceJobMutation,
  useDeleteServiceMutation,
  useRemoveServiceJobMutation,
  useServiceDetailQuery,
} from '@/hooks/queries/useServices';
import { apiService } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { JobReference, ServiceJobItem } from '@/services/catalogService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessServiceCatalog, canBulkDeleteServices } from '@/utils/rbac';
import { formatVND } from '@/utils/formatters';
import { computeServiceCost } from '@/utils/catalogPricing';
import { safeGoBack } from '@/utils/navigation';

/** Phòng thủ: `GET /jobs` trả mảng thô, nhưng vẫn chấp nhận `{ data: [...] }`. */
function normalizeJobList(response: unknown): JobReference[] {
  if (Array.isArray(response)) return response as JobReference[];
  if (response && typeof response === 'object') {
    const body = response as { data?: unknown };
    if (Array.isArray(body.data)) return body.data as JobReference[];
  }
  return [];
}

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
  const [jobSearch, setJobSearch] = useState('');

  const {
    data: service,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useServiceDetailQuery(serviceId);
  const deleteMutation = useDeleteServiceMutation();
  const addJobMutation = useAddServiceJobMutation();
  const removeJobMutation = useRemoveServiceJobMutation();

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: async () => {
      // TODO(P3): thay bằng hook useJobsQuery dùng chung khi module Jobs (P3) được dựng.
      const res = await apiService.get<unknown>('/jobs');
      if (res.error) {
        throw new Error(res.error);
      }
      return normalizeJobList(res.data);
    },
    enabled: Boolean(serviceId) && canManage,
  });

  const serviceJobs = useMemo<ServiceJobItem[]>(
    () => (Array.isArray(service?.serviceJobs) ? service.serviceJobs : []),
    [service],
  );

  const totalCost = useMemo(() => computeServiceCost(serviceJobs), [serviceJobs]);

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

  const handleAddJob = useCallback(
    async (job: JobReference) => {
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
    [addJobMutation, serviceId],
  );

  const handleRemoveJob = useCallback(
    (serviceJob: ServiceJobItem) => {
      if (removeJobMutation.isPending) return;
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
    [removeJobMutation, serviceId],
  );

  const handleDelete = useCallback(() => {
    if (!service || deleteMutation.isPending) return;

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
  }, [deleteMutation, router, service]);

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

      <ScrollView
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
                {formatVND(service.costPrice ?? totalCost)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-slate-400">Chi phí chung</Text>
              <Text className="text-sm font-bold text-slate-700">
                {formatVND(service.overheadCost ?? 0)}
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
              const quantity = Number(serviceJob.quantity || 0);
              const unitCost = Number(serviceJob.job?.costPrice || 0);
              return (
                <View
                  key={`${serviceJob.jobId}-${index}`}
                  className={`flex-row items-center gap-3 py-2.5 ${
                    index === 0 ? '' : 'border-t border-slate-100'
                  }`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 text-sm font-bold text-slate-800" numberOfLines={2}>
                        {serviceJob.job?.name || 'Hạng mục'}
                      </Text>
                      {serviceJob.isOutput ? (
                        <View className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                          <Text className="text-[9px] font-bold text-emerald-600">Đầu ra</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {serviceJob.job?.code ? `#${serviceJob.job.code}` : `#${serviceJob.jobId.slice(0, 8)}`}
                      {` • SL: ${quantity}`}
                      {` • Đơn giá: ${formatVND(unitCost)}`}
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-orange-600">
                      {formatVND(unitCost * quantity)}
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

          {serviceJobs.length > 0 ? (
            <View className="mt-3 flex-row items-center justify-between border-t border-slate-200 pt-3">
              <Text className="text-xs font-bold text-slate-600">Tổng giá vốn hạng mục</Text>
              <Text className="text-sm font-extrabold text-orange-600">{formatVND(totalCost)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom sheet chọn Job — TODO(P3): hợp nhất vào module Jobs khi có hook dùng chung. */}
      <Modal
        visible={isJobSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsJobSheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-3xl border-t border-slate-200 bg-white">
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-5">
              <Text className="text-lg font-bold text-slate-900">Chọn hạng mục công việc</Text>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
                onPress={() => setIsJobSheetOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="px-5 pt-3">
              <View className="h-[48px] flex-row items-center gap-2 rounded-xl bg-slate-100 px-3">
                <Feather name="search" size={18} color="#94A3B8" />
                <TextInput
                  className="flex-1 text-sm text-slate-900"
                  placeholder="Tìm theo tên hoặc mã công việc..."
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
              {isLoadingJobs ? (
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
                        {formatVND(job.costPrice ?? 0)}
                        {job.unit ? ` • ${job.unit}` : ''}
                      </Text>
                    </View>
                    <Feather name="plus-circle" size={20} color={BrandColors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
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
