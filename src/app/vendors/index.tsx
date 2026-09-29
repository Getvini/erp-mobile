import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavBar from '@/components/BottomNavBar';
import VendorCard from '@/components/vendors/VendorCard';
import VendorFormModal from '@/components/vendors/VendorFormModal';
import { useVendorsQuery } from '@/hooks/queries/useVendors';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { VendorItem } from '@/services/vendorService';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessVendors, canManageVendors } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

/** Số dòng nạp thêm mỗi lần cuộn tới cuối (phân trang client-side). */
const PAGE_SIZE = 15;

export default function VendorsScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);

  const hasAccess = canAccessVendors(role);
  const canManage = canManageVendors(role);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Phân trang client-side: `pages` gắn với từ khoá đang tìm ⇒ đổi từ khoá thì
  // số trang hiệu dụng tự về 1 mà không cần effect reset state.
  const [pages, setPages] = useState<{ query: string; page: number }>({ query: '', page: 1 });
  const currentPage = pages.query === searchQuery ? pages.page : 1;
  const visibleCount = currentPage * PAGE_SIZE;

  // Backend trả mảng thô & bỏ qua query param ⇒ KHÔNG truyền filter vào hook,
  // tìm kiếm được lọc client-side để tránh refetch theo từng ký tự.
  const { data: vendors = [], isLoading, isFetching, isError, error, refetch } = useVendorsQuery();

  useSSERefresh(['invalidate_Vendors', 'invalidate_Services'], refetch);

  const filteredVendors = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return vendors;
    return vendors.filter((vendor) => {
      const name = (vendor.name ?? '').toLowerCase();
      const phone = (vendor.phone ?? '').toLowerCase();
      const taxId = (vendor.taxId ?? '').toLowerCase();
      return name.includes(keyword) || phone.includes(keyword) || taxId.includes(keyword);
    });
  }, [searchQuery, vendors]);

  const visibleVendors = useMemo(
    () => filteredVendors.slice(0, visibleCount),
    [filteredVendors, visibleCount],
  );
  const hasMore = visibleCount < filteredVendors.length;

  const handleEndReached = useCallback(() => {
    if (visibleCount < filteredVendors.length) {
      setPages({ query: searchQuery, page: currentPage + 1 });
    }
  }, [currentPage, filteredVendors.length, searchQuery, visibleCount]);

  const handleOpenDetail = useCallback(
    (vendor: VendorItem) => {
      router.push(`/vendors/${vendor.id}` as any);
    },
    [router],
  );

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => safeGoBack(router, '/')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Nhà cung cấp</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 p-8">
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
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="vendorsScreen" className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">Nhà cung cấp</Text>
        <View className="w-12" />
      </View>

      {/* Ô tìm kiếm (lọc client-side theo tên / SĐT / MST) */}
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="h-[48px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="vendorSearchInput"
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo tên, SĐT hoặc mã số thuế..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="mt-2 text-[11px] font-semibold text-slate-400">
          {filteredVendors.length} nhà cung cấp
          {searchQuery.trim() ? ` phù hợp với “${searchQuery.trim()}”` : ''}
        </Text>
      </View>

      {/* 4 trạng thái: Loading / Error+Retry / Empty / Success */}
      {isLoading ? (
        <View className="flex-1 gap-3 px-4 pt-4">
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-40 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="wifi-off" size={42} color={BrandColors.error} />
          <Text className="text-base font-bold text-slate-700">Không tải được danh sách nhà cung cấp</Text>
          <Text className="text-center text-xs text-slate-500">
            {error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
            accessibilityRole="button"
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="vendorsList"
          data={visibleVendors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VendorCard vendor={item} onPress={handleOpenDetail} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center gap-2.5 py-14">
              <Feather name="truck" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Chưa có nhà cung cấp</Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                {searchQuery.trim()
                  ? 'Không tìm thấy nhà cung cấp nào phù hợp với từ khoá.'
                  : 'Danh mục nhà cung cấp đang trống. Hãy thêm mới để bắt đầu.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <View className="items-center py-4">
                <Text className="text-[11px] font-semibold text-slate-400">
                  Đang hiển thị {visibleVendors.length}/{filteredVendors.length} — cuộn để tải thêm
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* CTA chỉ hiện khi có quyền quản lý (ẩn hoàn toàn nếu thiếu quyền) */}
      {canManage ? (
        <TouchableOpacity
          testID="createVendorButton"
          className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
          onPress={() => setIsFormOpen(true)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Thêm nhà cung cấp mới"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text className="text-sm font-extrabold text-white">Thêm nhà cung cấp</Text>
        </TouchableOpacity>
      ) : null}

      <VendorFormModal
        visible={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={refetch}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
