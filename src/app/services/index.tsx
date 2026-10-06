import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceCard from '@/components/catalog/ServiceCard';
import ServiceFormModal from '@/components/catalog/ServiceFormModal';
import BottomNavBar from '@/components/BottomNavBar';
import {
  useBulkDeleteServicesMutation,
  useDuplicateServiceMutation,
  useServicesQuery,
} from '@/hooks/queries/useServices';
import type { ServiceItem } from '@/services/catalogService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  canAccessServiceCatalog,
  canBulkDeleteServices,
  canCreateServices,
} from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

export default function ServicesScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canAccess = canAccessServiceCatalog(role);
  const canCreate = canCreateServices(role);
  // Nhân bản / Xóa chỉ dành cho ADMIN & BOD; quyền tạo được tách riêng để khớp Web.
  const canManage = canBulkDeleteServices(role);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  // `key` mới mỗi lần mở ⇒ ServiceFormModal remount và khởi tạo lại form state.
  const [formKey, setFormKey] = useState(0);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: services = [], isLoading, isFetching, isError, error, refetch } = useServicesQuery();
  const bulkDeleteMutation = useBulkDeleteServicesMutation();
  const duplicateMutation = useDuplicateServiceMutation();

  const sortedServices = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const filtered = keyword
      ? services.filter(
          (service) =>
            (service.name || '').toLowerCase().includes(keyword) ||
            (service.code || '').toLowerCase().includes(keyword),
        )
      : services;

    // Sort mặc định theo `code` asc; dịch vụ chưa có mã xuống cuối.
    return [...filtered].sort((a, b) => {
      const codeA = (a.code || '').trim();
      const codeB = (b.code || '').trim();
      if (!codeA && !codeB) return (a.name || '').localeCompare(b.name || '');
      if (!codeA) return 1;
      if (!codeB) return -1;
      return codeA.localeCompare(codeB, 'vi', { sensitivity: 'base' });
    });
  }, [searchQuery, services]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const handleToggleSelect = useCallback((service: ServiceItem) => {
    setSelectedIds((prev) =>
      prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id],
    );
  }, []);

  const handleLongPress = useCallback(
    (service: ServiceItem) => {
      if (!canManage) return;
      void Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      setIsSelectionMode(true);
      setSelectedIds((prev) => (prev.includes(service.id) ? prev : [...prev, service.id]));
    },
    [canManage],
  );

  const handleDuplicate = useCallback(async () => {
    if (selectedIds.length !== 1 || duplicateMutation.isPending) return;
    const source = services.find((service) => service.id === selectedIds[0]);
    if (!source) return;

    try {
      // Truyền danh sách mã hiện có để bản sao nhận mã duy nhất (`-COPY`, `-COPY2`, ...)
      // — backend chặn trùng `code` nên giữ nguyên mã gốc sẽ luôn lỗi.
      const duplicated = await duplicateMutation.mutateAsync({
        service: source,
        existingCodes: services.map((service) => service.code),
      });
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      exitSelectionMode();
      Alert.alert(
        'Thành công',
        `Đã nhân bản dịch vụ “${source.name}” thành “${duplicated?.name || `${source.name} (Copy)`}”` +
          (duplicated?.code ? ` với mã ${duplicated.code}.` : '.'),
      );
    } catch (duplicateError: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert(
        'Không thể nhân bản dịch vụ',
        duplicateError?.message || 'Vui lòng kiểm tra lại mã dịch vụ và thử lại.',
      );
    }
  }, [duplicateMutation, exitSelectionMode, selectedIds, services]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0 || bulkDeleteMutation.isPending) return;

    Alert.alert(
      'Xóa dịch vụ',
      `Bạn có chắc muốn xóa ${selectedIds.length} dịch vụ đã chọn? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await bulkDeleteMutation.mutateAsync(selectedIds);
              await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              exitSelectionMode();
              Alert.alert('Thành công', 'Đã xóa các dịch vụ đã chọn.');
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
  }, [bulkDeleteMutation, exitSelectionMode, selectedIds]);

  const renderServiceCard = useCallback(
    ({ item }: { item: ServiceItem }) => (
      <ServiceCard
        service={item}
        selectable={isSelectionMode}
        selected={selectedIds.includes(item.id)}
        onToggleSelect={handleToggleSelect}
        onPress={(service) => router.push(`/services/${service.id}` as any)}
        onLongPress={canManage ? handleLongPress : undefined}
      />
    ),
    [canManage, handleLongPress, handleToggleSelect, isSelectionMode, router, selectedIds],
  );

  if (!canAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => safeGoBack(router, '/')}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Dịch vụ niêm yết</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 p-8">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
            Phân hệ Dịch vụ niêm yết chỉ dành cho Ban Quản trị (Admin/BOD) và Bộ phận Phát triển
            kinh doanh (BD).
          </Text>
          <TouchableOpacity
            className="mt-3 min-h-[48px] justify-center rounded-xl bg-primary px-5 py-3"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => (isSelectionMode ? exitSelectionMode() : safeGoBack(router, '/'))}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isSelectionMode ? 'Thoát chọn' : 'Quay lại'}
        >
          <Feather name={isSelectionMode ? 'x' : 'arrow-left'} size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">
          {isSelectionMode ? `Đã chọn ${selectedIds.length}` : 'Dịch vụ niêm yết'}
        </Text>

        {isSelectionMode ? (
          <TouchableOpacity
            className="min-h-[44px] justify-center rounded-xl px-3"
            onPress={exitSelectionMode}
            activeOpacity={0.7}
          >
            <Text className="text-sm font-bold text-primary">Hủy</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => router.push('/service-packages' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Gói dịch vụ niêm yết"
          >
            <Feather name="package" size={19} color="#0F172A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection toolbar — chỉ ADMIN/BOD */}
      {isSelectionMode && canManage ? (
        <View className="flex-row gap-2 border-b border-slate-200 bg-white px-4 pb-3">
          <TouchableOpacity
            className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border ${
              selectedIds.length === 1 ? 'border-primary bg-primary-light' : 'border-slate-200 bg-slate-100'
            }`}
            onPress={handleDuplicate}
            disabled={selectedIds.length !== 1 || duplicateMutation.isPending}
            activeOpacity={0.8}
          >
            {duplicateMutation.isPending ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <Feather
                name="copy"
                size={16}
                color={selectedIds.length === 1 ? BrandColors.primary : '#94A3B8'}
              />
            )}
            <Text
              className={`text-sm font-bold ${
                selectedIds.length === 1 ? 'text-primary' : 'text-slate-400'
              }`}
            >
              Nhân bản
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border ${
              selectedIds.length > 0 ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-100'
            }`}
            onPress={handleBulkDelete}
            disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending}
            activeOpacity={0.8}
          >
            {bulkDeleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Feather
                name="trash-2"
                size={16}
                color={selectedIds.length > 0 ? '#EF4444' : '#94A3B8'}
              />
            )}
            <Text
              className={`text-sm font-bold ${
                selectedIds.length > 0 ? 'text-red-500' : 'text-slate-400'
              }`}
            >
              Xóa
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Search */}
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="h-[48px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="serviceSearchInput"
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo tên hoặc mã dịch vụ..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!isSelectionMode}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 4 trạng thái */}
      {isLoading ? (
        <View className="flex-1 gap-3 px-4 pt-4">
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">
            Không tải được danh mục dịch vụ
          </Text>
          <Text className="text-center text-xs text-slate-500">
            {error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="servicesList"
          data={sortedServices}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceCard}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => {
                exitSelectionMode();
                refetch();
              }}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center gap-2.5 py-14">
              <Feather name="briefcase" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">
                {searchQuery ? 'Không tìm thấy dịch vụ phù hợp' : 'Chưa có dịch vụ niêm yết'}
              </Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                {searchQuery
                  ? 'Thử lại với từ khóa khác hoặc xóa bộ lọc tìm kiếm.'
                  : 'Danh mục dịch vụ niêm yết hiện đang trống.'}
              </Text>
            </View>
          }
        />
      )}

      {canCreate && !isSelectionMode ? (
        <TouchableOpacity
          testID="createServiceButton"
          className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
          onPress={() => {
            setFormKey((key) => key + 1);
            setIsFormOpen(true);
          }}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Thêm dịch vụ mới"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text className="text-sm font-extrabold text-white">Thêm dịch vụ</Text>
        </TouchableOpacity>
      ) : null}

      <ServiceFormModal
        key={`service-form-${formKey}`}
        visible={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => refetch()}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
