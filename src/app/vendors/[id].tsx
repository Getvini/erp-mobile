import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import VendorFormModal from '@/components/vendors/VendorFormModal';
import VendorJobModal from '@/components/vendors/VendorJobModal';
import {
  getVendorTypeLabel,
  handleVendorCall,
  handleVendorEmail,
} from '@/components/vendors/VendorCard';
import {
  useDeleteVendorMutation,
  useRemoveVendorJobMutation,
  useVendorDetailQuery,
  useVendorJobsQuery,
} from '@/hooks/queries/useVendors';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { VendorJobItem, VendorType, requiresIdCard } from '@/services/vendorService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessVendors, canManageVendors } from '@/utils/rbac';
import { formatDateToDDMMYYYY, formatVND } from '@/utils/formatters';
import { safeGoBack } from '@/utils/navigation';

type VendorTab = 'jobs' | 'idCard' | 'extra';

type VendorRow =
  | { type: 'job'; id: string; value: VendorJobItem }
  | { type: 'idCard'; id: 'idCard' }
  | { type: 'extra'; id: 'extra' };

const PLACEHOLDER = 'Chưa cập nhật';

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vendorId = typeof id === 'string' ? id : '';
  const role = useAuthStore((state) => state.user?.role);

  const hasAccess = canAccessVendors(role);
  const canManage = canManageVendors(role);

  const [activeTab, setActiveTab] = useState<VendorTab>('jobs');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<VendorJobItem | null>(null);

  const {
    data: vendor,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useVendorDetailQuery(vendorId);

  const {
    data: vendorJobs = [],
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
  } = useVendorJobsQuery(vendorId);

  const deleteVendorMutation = useDeleteVendorMutation();
  const removeVendorJobMutation = useRemoveVendorJobMutation();

  const refreshAll = useCallback(() => {
    refetch();
    refetchJobs();
  }, [refetch, refetchJobs]);

  useSSERefresh(['invalidate_Vendors', 'invalidate_Services'], refreshAll);

  const hasIdCardImages = Boolean(vendor?.idCardFront || vendor?.idCardBack);

  const tabs = useMemo(() => {
    const list: { key: VendorTab; label: string }[] = [
      { key: 'jobs', label: `Hạng mục phụ trách (${vendorJobs.length})` },
    ];
    if (hasIdCardImages) list.push({ key: 'idCard', label: 'CCCD' });
    list.push({ key: 'extra', label: 'Thông tin thêm' });
    return list;
  }, [hasIdCardImages, vendorJobs.length]);

  const rows = useMemo<VendorRow[]>(() => {
    if (activeTab === 'jobs') {
      return vendorJobs.map((job) => ({ type: 'job' as const, id: job.id, value: job }));
    }
    if (activeTab === 'idCard') return [{ type: 'idCard', id: 'idCard' }];
    return [{ type: 'extra', id: 'extra' }];
  }, [activeTab, vendorJobs]);

  const confirmDelete = useCallback(() => {
    if (!vendor || !canManage || deleteVendorMutation.isPending) return;

    Alert.alert(
      'Xóa nhà cung cấp',
      `Bạn có chắc muốn xóa “${vendor.name}”? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa nhà cung cấp',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVendorMutation.mutateAsync(vendor.id);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa nhà cung cấp.', [
                { text: 'Đóng', onPress: () => router.replace('/vendors' as any) },
              ]);
            } catch (deleteError: any) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert(
                'Không thể xóa nhà cung cấp',
                deleteError?.message || 'Vui lòng kiểm tra dữ liệu liên quan và thử lại.',
              );
            }
          },
        },
      ],
    );
  }, [canManage, deleteVendorMutation, router, vendor]);

  const confirmRemoveJob = useCallback(
    (job: VendorJobItem) => {
      if (!vendor || !canManage || removeVendorJobMutation.isPending) return;
      const jobLabel = job.job?.name || job.job?.code || 'hạng mục này';

      Alert.alert('Gỡ hạng mục', `Gỡ “${jobLabel}” khỏi nhà cung cấp?`, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gỡ hạng mục',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeVendorJobMutation.mutateAsync({ id: vendor.id, jobId: job.job?.id || job.jobId || '' });
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              refreshAll();
            } catch (removeError: any) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert('Lỗi', removeError?.message || 'Không thể gỡ hạng mục khỏi nhà cung cấp.');
            }
          },
        },
      ]);
    },
    [canManage, refreshAll, removeVendorJobMutation, vendor],
  );

  const openAssignJob = useCallback(() => {
    setEditingJob(null);
    setIsJobModalOpen(true);
  }, []);

  const openEditJob = useCallback((job: VendorJobItem) => {
    setEditingJob(job);
    setIsJobModalOpen(true);
  }, []);

  const renderInfoCard = (
    title: string,
    icon: keyof typeof Feather.glyphMap,
    fields: { label: string; value: string; action?: () => void; actionIcon?: keyof typeof Feather.glyphMap }[],
  ) => (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-lg border border-orange-100 bg-orange-50">
          <Feather name={icon} size={15} color={BrandColors.primary} />
        </View>
        <Text className="text-sm font-bold text-slate-800">{title}</Text>
      </View>

      {fields.map((field, index) => (
        <View
          key={field.label}
          className={index > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}
        >
          <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">{field.label}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm font-bold leading-5 text-slate-800" numberOfLines={2}>
              {field.value}
            </Text>
            {field.action ? (
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center rounded-xl border border-orange-100 bg-orange-50"
                onPress={field.action}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={field.label}
              >
                <Feather name={field.actionIcon ?? 'phone'} size={16} color={BrandColors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );

  const renderJobRow = (job: VendorJobItem) => (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          {job.job?.code ? (
            <Text className="text-[11px] font-bold text-slate-400">#{job.job.code}</Text>
          ) : null}
          <Text className="text-sm font-bold text-slate-900" numberOfLines={2}>
            {job.job?.name || 'Hạng mục chưa đặt tên'}
          </Text>
          <Text className="mt-1 text-sm font-extrabold text-orange-600">
            {formatVND(job.price ?? 0, 'VNĐ')}
          </Text>
          {job.note ? (
            <Text className="mt-1 text-xs leading-[18px] text-slate-500" numberOfLines={3}>
              {job.note}
            </Text>
          ) : null}
        </View>

        {canManage ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              testID={`editVendorJob-${job.id}`}
              className="h-11 w-11 items-center justify-center rounded-xl border border-orange-100 bg-orange-50"
              onPress={() => openEditJob(job)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Sửa phân công hạng mục"
            >
              <Feather name="edit-3" size={16} color={BrandColors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`removeVendorJob-${job.id}`}
              className="h-11 w-11 items-center justify-center rounded-xl border border-red-100 bg-red-50"
              onPress={() => confirmRemoveJob(job)}
              disabled={removeVendorJobMutation.isPending}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Gỡ hạng mục khỏi nhà cung cấp"
            >
              <Feather name="trash-2" size={16} color={BrandColors.error} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderIdCardTab = () => (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Text className="mb-3 text-sm font-bold text-slate-800">Ảnh CCCD/CMND</Text>
      <View className="flex-row gap-3">
        {(['idCardFront', 'idCardBack'] as const).map((side) => {
          const url = vendor?.[side];
          const label = side === 'idCardFront' ? 'Mặt trước' : 'Mặt sau';
          return (
            <View key={side} className="flex-1">
              <Text className="mb-1.5 text-[11px] font-semibold text-slate-500">{label}</Text>
              {url ? (
                <Image
                  testID={`vendorIdCard-${side}`}
                  source={{ uri: url }}
                  className="h-32 w-full rounded-xl border border-slate-200"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <Feather name="image" size={20} color="#CBD5E1" />
                  <Text className="mt-1 text-[11px] text-slate-400">Chưa có ảnh</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderExtraTab = () => (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <View>
        <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Ngày tạo</Text>
        <Text className="text-sm font-bold text-slate-800">
          {formatDateToDDMMYYYY(vendor?.createdAt, PLACEHOLDER)}
        </Text>
      </View>
      <View className="mt-3 border-t border-slate-100 pt-3">
        <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Cập nhật gần nhất</Text>
        <Text className="text-sm font-bold text-slate-800">
          {formatDateToDDMMYYYY(vendor?.updatedAt, PLACEHOLDER)}
        </Text>
      </View>
      <View className="mt-3 border-t border-slate-100 pt-3">
        <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Mã nhà cung cấp</Text>
        <Text className="text-sm font-bold text-slate-800">{vendor?.id ?? PLACEHOLDER}</Text>
      </View>
    </View>
  );

  const renderRow = useCallback(
    ({ item }: { item: VendorRow }) => {
      if (item.type === 'job') return renderJobRow(item.value);
      if (item.type === 'idCard') return renderIdCardTab();
      return renderExtraTab();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, removeVendorJobMutation.isPending, vendor],
  );

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-8" edges={['top']}>
        <View className="mb-1 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <Feather name="shield-off" size={34} color={BrandColors.error} />
        </View>
        <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
        <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
          Phân hệ Nhà cung cấp chỉ dành cho Ban Quản trị (Admin/BOD).
        </Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5"
          onPress={() => safeGoBack(router, '/')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
        <View className="h-14 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-40 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-32 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-32 rounded-2xl bg-slate-200" />
      </SafeAreaView>
    );
  }

  if (isError || !vendor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6" edges={['top']}>
        <Feather name="alert-circle" size={48} color={BrandColors.error} />
        <Text className="text-base font-bold text-slate-800">Không tải được thông tin nhà cung cấp</Text>
        <Text className="text-center text-xs text-slate-500">
          {error instanceof Error ? error.message : 'Dữ liệu không tồn tại hoặc bạn không có quyền xem.'}
        </Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5"
          onPress={() => refetch()}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="min-h-[48px] justify-center px-5"
          onPress={() => safeGoBack(router, '/vendors')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-slate-600">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const type = (vendor.type as VendorType) ?? 'BUSINESS';

  return (
    <SafeAreaView testID="vendorDetailScreen" className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/vendors')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách nhà cung cấp"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900" numberOfLines={1}>
          {vendor.name}
        </Text>
        {canManage ? (
          <TouchableOpacity
            testID="editVendorButton"
            className="h-12 w-12 items-center justify-center rounded-xl border border-orange-100 bg-orange-50"
            onPress={() => setIsEditOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa nhà cung cấp"
          >
            <Feather name="edit-3" size={18} color={BrandColors.primary} />
          </TouchableOpacity>
        ) : (
          <View className="w-12" />
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderRow}
        contentContainerStyle={{ padding: 16, paddingBottom: 36, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refreshAll}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            {/* Hồ sơ tóm tắt */}
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50">
                <Text className="text-2xl font-black text-orange-600">
                  {(vendor.name || 'N').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-center text-lg font-bold text-slate-900">{vendor.name}</Text>
              <View className="mt-2 flex-row gap-2">
                <View className="rounded-lg bg-orange-50 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-orange-700">{getVendorTypeLabel(type)}</Text>
                </View>
                <View className="rounded-lg bg-blue-50 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-blue-700">
                    {vendorJobs.length} hạng mục
                  </Text>
                </View>
              </View>
            </View>

            {/* 3 card thông tin */}
            {renderInfoCard('Thông tin chung', 'info', [
              { label: 'Tên nhà cung cấp', value: vendor.name || PLACEHOLDER },
              { label: 'Loại nhà cung cấp', value: getVendorTypeLabel(type) },
              {
                label: requiresIdCard(type) ? 'Số CCCD/CMND' : 'Mã số thuế',
                value: vendor.taxId || PLACEHOLDER,
              },
            ])}

            {renderInfoCard('Liên hệ', 'phone', [
              {
                label: 'Số điện thoại',
                value: vendor.phone || PLACEHOLDER,
                action: () => handleVendorCall(vendor.phone),
                actionIcon: 'phone',
              },
              {
                label: 'Email',
                value: vendor.email || PLACEHOLDER,
                action: () => handleVendorEmail(vendor.email),
                actionIcon: 'mail',
              },
              { label: 'Địa chỉ', value: vendor.address || PLACEHOLDER },
            ])}

            {renderInfoCard('Tài khoản ngân hàng', 'credit-card', [
              { label: 'Ngân hàng', value: vendor.bankName || PLACEHOLDER },
              { label: 'Số tài khoản', value: vendor.bankAccount || PLACEHOLDER },
            ])}

            {/* Tabs */}
            <View className="flex-row flex-wrap justify-between gap-y-2 rounded-2xl bg-slate-200 p-1.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    testID={`vendorTab-${tab.key}`}
                    className={`min-h-[48px] flex-1 items-center justify-center rounded-xl px-2 ${
                      isActive ? 'bg-white' : ''
                    }`}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.75}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      className={`text-center text-xs font-bold ${
                        isActive ? 'text-orange-600' : 'text-slate-500'
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeTab === 'jobs' && canManage ? (
              <TouchableOpacity
                testID="assignVendorJobButton"
                className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50"
                onPress={openAssignJob}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Feather name="plus-circle" size={18} color={BrandColors.primary} />
                <Text className="text-sm font-extrabold text-orange-600">Gán hạng mục</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoadingJobs ? (
            <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10">
              <ActivityIndicator color={BrandColors.primary} />
              <Text className="mt-2 text-xs text-slate-400">Đang tải hạng mục phụ trách...</Text>
            </View>
          ) : (
            <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12">
              <Feather name="briefcase" size={38} color="#CBD5E1" />
              <Text className="mt-3 text-sm font-bold text-slate-600">Chưa gán hạng mục nào</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Nhà cung cấp này chưa được phân công hạng mục phụ trách.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          canManage ? (
            <TouchableOpacity
              testID="deleteVendorButton"
              className="mt-6 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4"
              onPress={confirmDelete}
              disabled={deleteVendorMutation.isPending}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Xóa nhà cung cấp"
              accessibilityState={{ disabled: deleteVendorMutation.isPending }}
            >
              {deleteVendorMutation.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={18} color="#DC2626" />
              )}
              <Text className="text-sm font-bold text-red-700">Xóa nhà cung cấp</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <VendorFormModal
        visible={isEditOpen}
        vendor={vendor}
        onClose={() => setIsEditOpen(false)}
        onSuccess={refreshAll}
      />

      <VendorJobModal
        visible={isJobModalOpen}
        vendorId={vendor.id}
        vendorName={vendor.name}
        assignedJobIds={vendorJobs.map((job) => job.job?.id || job.jobId || '').filter(Boolean)}
        editingJob={editingJob}
        onClose={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
        }}
        onSuccess={refreshAll}
      />
    </SafeAreaView>
  );
}
