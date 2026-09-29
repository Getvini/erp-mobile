import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServicePackageFormModal from '@/components/catalog/ServicePackageFormModal';
import {
  useDeleteServicePackageMutation,
  useServicePackageDetailQuery,
} from '@/hooks/queries/useServicePackages';
import type { ServicePackageItem } from '@/services/servicePackageService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessServiceCatalog } from '@/utils/rbac';
import { formatVND } from '@/utils/formatters';
import { computePackagePrice } from '@/utils/catalogPricing';
import { safeGoBack } from '@/utils/navigation';

export default function ServicePackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canAccess = canAccessServiceCatalog(role);

  const servicePackageId = typeof id === 'string' ? id : '';
  const [isEditOpen, setIsEditOpen] = useState(false);
  // `key` mới mỗi lần mở ⇒ ServicePackageFormModal remount và khởi tạo lại form state.
  const [editFormKey, setEditFormKey] = useState(0);

  const {
    data: servicePackage,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useServicePackageDetailQuery(servicePackageId);
  const deleteMutation = useDeleteServicePackageMutation();

  const items = useMemo<ServicePackageItem[]>(
    () => (Array.isArray(servicePackage?.items) ? servicePackage.items : []),
    [servicePackage],
  );

  // Tổng giá vốn gói = Σ (service.costPrice × defaultQuantity) — KHÔNG làm tròn.
  const totalCost = useMemo(() => computePackagePrice(items), [items]);

  const handleDelete = useCallback(() => {
    if (!servicePackage || deleteMutation.isPending) return;

    Alert.alert(
      'Xóa gói dịch vụ',
      `Bạn có chắc muốn xóa “${servicePackage.name}”? Gói sẽ được ẩn khỏi danh mục bán.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa gói',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(servicePackage.id);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã ẩn gói dịch vụ.', [
                { text: 'Đóng', onPress: () => router.replace('/service-packages' as any) },
              ]);
            } catch (deleteError: any) {
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert(
                'Không thể xóa gói dịch vụ',
                deleteError?.message || 'Vui lòng kiểm tra dữ liệu liên quan và thử lại.',
              );
            }
          },
        },
      ],
    );
  }, [deleteMutation, router, servicePackage]);

  if (!canAccess) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-8" edges={['top']}>
        <Feather name="shield-off" size={40} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không có quyền truy cập</Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5"
          onPress={() => safeGoBack(router, '/service-packages')}
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
        <View className="mt-4 h-40 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-64 rounded-2xl bg-slate-200" />
      </SafeAreaView>
    );
  }

  if (isError || !servicePackage) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => safeGoBack(router, '/service-packages')}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Chi tiết gói dịch vụ</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="alert-circle" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được gói dịch vụ</Text>
          <Text className="text-center text-xs text-slate-500">
            {error instanceof Error ? error.message : 'Gói dịch vụ không tồn tại hoặc đã bị ẩn.'}
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

  const isActive = servicePackage.isActive !== false;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/service-packages')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900" numberOfLines={1}>
          Chi tiết gói dịch vụ
        </Text>

        <View className="flex-row gap-2">
          <TouchableOpacity
            testID="editServicePackageButton"
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => {
              setEditFormKey((key) => key + 1);
              setIsEditOpen(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sửa gói dịch vụ"
          >
            <Feather name="edit-2" size={18} color={BrandColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="deleteServicePackageButton"
            className="h-12 w-12 items-center justify-center rounded-xl bg-red-50"
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Xóa gói dịch vụ"
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Feather name="trash-2" size={18} color="#EF4444" />
            )}
          </TouchableOpacity>
        </View>
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
        {/* Thông tin gói */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-extrabold text-slate-900">
              {servicePackage.name}
            </Text>
            {isActive ? (
              <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1">
                <Text className="text-[10px] font-bold text-emerald-600">Đang bán</Text>
              </View>
            ) : (
              <View className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1">
                <Text className="text-[10px] font-bold text-slate-500">Đã ẩn</Text>
              </View>
            )}
          </View>

          <View className="mt-3 border-t border-slate-100 pt-3">
            <Text className="text-xs font-semibold uppercase text-slate-400">Mô tả</Text>
            <Text className="text-sm leading-5 text-slate-700">
              {servicePackage.description || 'Chưa cập nhật'}
            </Text>
          </View>

          <View className="mt-3 flex-row gap-3 border-t border-slate-100 pt-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-slate-400">
                Giá gói (hệ thống)
              </Text>
              <Text className="text-sm font-extrabold text-orange-600">
                {formatVND(servicePackage.price ?? totalCost)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-slate-400">
                Số dịch vụ trong gói
              </Text>
              <Text className="text-sm font-bold text-slate-700">{items.length}</Text>
            </View>
          </View>
        </View>

        {/* Danh sách dịch vụ trong gói */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Text className="mb-3 text-sm font-bold text-slate-900">
            Dịch vụ trong gói ({items.length})
          </Text>

          {items.length === 0 ? (
            <View className="items-center gap-2 py-8">
              <Feather name="package" size={30} color="#CBD5E1" />
              <Text className="text-sm font-semibold text-slate-500">
                Gói chưa có dịch vụ nào
              </Text>
            </View>
          ) : (
            items.map((item, index) => {
              const lineTotal = computePackagePrice([item]);
              return (
                <View
                  key={item.id || `${item.serviceId}-${index}`}
                  className={`flex-row items-center gap-3 py-2.5 ${
                    index === 0 ? '' : 'border-t border-slate-100'
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800" numberOfLines={2}>
                      {item.service?.name || 'Dịch vụ'}
                    </Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {item.service?.code
                        ? `#${item.service.code}`
                        : `#${(item.serviceId || '').slice(0, 8)}`}
                      {` • SL mặc định: ${Number(item.defaultQuantity || 0)}`}
                      {` • Đơn giá: ${formatVND(item.service?.costPrice ?? 0)}`}
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-orange-600">
                      {formatVND(lineTotal)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          {items.length > 0 ? (
            <View className="mt-3 flex-row items-center justify-between border-t border-slate-200 pt-3">
              <Text className="text-xs font-bold text-slate-600">Tổng giá vốn gói</Text>
              <Text className="text-sm font-extrabold text-orange-600">{formatVND(totalCost)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ServicePackageFormModal
        key={`service-package-edit-form-${editFormKey}`}
        visible={isEditOpen}
        servicePackage={servicePackage}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}
