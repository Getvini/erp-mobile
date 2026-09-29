import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServicePackageCard from '@/components/catalog/ServicePackageCard';
import ServicePackageFormModal from '@/components/catalog/ServicePackageFormModal';
import BottomNavBar from '@/components/BottomNavBar';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import type { ServicePackage } from '@/services/servicePackageService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessServiceCatalog } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

export default function ServicePackagesScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canAccess = canAccessServiceCatalog(role);

  const [isFormOpen, setIsFormOpen] = useState(false);
  // `key` mới mỗi lần mở ⇒ ServicePackageFormModal remount và khởi tạo lại form state.
  const [formKey, setFormKey] = useState(0);
  const { data: servicePackages = [], isLoading, isFetching, isError, error, refetch } =
    useServicePackagesQuery();

  const renderPackageCard = useCallback(
    ({ item }: { item: ServicePackage }) => (
      <ServicePackageCard
        servicePackage={item}
        onPress={(servicePackage) => router.push(`/service-packages/${servicePackage.id}` as any)}
      />
    ),
    [router],
  );

  if (!canAccess) {
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
          <Text className="text-[17px] font-bold text-slate-900">Gói dịch vụ niêm yết</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 p-8">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
            Phân hệ Gói dịch vụ niêm yết chỉ dành cho Ban Quản trị (Admin/BOD) và Bộ phận Phát triển
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
          onPress={() => safeGoBack(router, '/services')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900" numberOfLines={1}>
          Gói dịch vụ niêm yết
        </Text>

        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => router.replace('/services' as any)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Danh mục dịch vụ"
        >
          <Feather name="briefcase" size={19} color="#0F172A" />
        </TouchableOpacity>
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
            Không tải được danh sách gói dịch vụ
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
          testID="servicePackagesList"
          data={servicePackages}
          keyExtractor={(item) => item.id}
          renderItem={renderPackageCard}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center gap-2.5 py-14">
              <Feather name="package" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Chưa có gói dịch vụ nào</Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                Tạo gói dịch vụ để bán kèm nhiều dịch vụ niêm yết trong cùng một báo giá.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        testID="createServicePackageButton"
        className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
        onPress={() => {
          setFormKey((key) => key + 1);
          setIsFormOpen(true);
        }}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Thêm gói dịch vụ mới"
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <Text className="text-sm font-extrabold text-white">Thêm gói dịch vụ</Text>
      </TouchableOpacity>

      <ServicePackageFormModal
        key={`service-package-form-${formKey}`}
        visible={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => refetch()}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
