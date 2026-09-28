import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReferralPartnerItem } from '@/services/referralPartnerService';
import { useReferralPartnersQuery } from '@/hooks/queries/useReferralPartners';
import PartnerCard from '@/components/referral-partners/PartnerCard';
import PartnerFormModal from '@/components/referral-partners/PartnerFormModal';
import BottomNavBar from '@/components/BottomNavBar';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessReferralPartners, canManageReferralPartners } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

export default function ReferralPartnersScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const hasAccess = canAccessReferralPartners(user?.role);
  const canManage = canManageReferralPartners(user?.role);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    data: partners = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useReferralPartnersQuery();

  // Tìm kiếm client-side theo tên / SĐT / mã số thuế (backend không hỗ trợ query params).
  const filteredPartners = useMemo(() => {
    const list = Array.isArray(partners) ? partners : [];
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return list;

    return list.filter((partner) => {
      const name = partner.name?.toLowerCase() || '';
      const phone = partner.phone?.toLowerCase() || '';
      const taxId = partner.taxId?.toLowerCase() || '';
      return name.includes(keyword) || phone.includes(keyword) || taxId.includes(keyword);
    });
  }, [partners, searchQuery]);

  const handleOpenDetail = useCallback(
    (id: string) => {
      router.push(`/referral-partners/${id}` as any);
    },
    [router],
  );

  const renderPartner = useCallback(
    ({ item }: { item: ReferralPartnerItem }) => (
      <PartnerCard partner={item} onPress={handleOpenDetail} />
    ),
    [handleOpenDetail],
  );

  const keyExtractor = useCallback((item: ReferralPartnerItem) => item.id, []);

  // Chờ hồ sơ phiên đăng nhập để tránh nhấp nháy màn hình từ chối quyền.
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
        <View className="h-14 rounded-2xl bg-slate-200" />
        <View className="mt-4 h-12 rounded-xl bg-slate-200" />
        <View className="mt-4 h-36 rounded-2xl bg-slate-200" />
        <View className="mt-3 h-36 rounded-2xl bg-slate-200" />
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={() => router.replace('/')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Quay về trang chủ"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Đối tác giới thiệu</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 p-8">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
            Phân hệ Đối tác giới thiệu chỉ dành cho Ban Quản trị (Admin/BOD) và Bộ phận Phát triển
            kinh doanh (BD/Admin Sale).
          </Text>
          <TouchableOpacity
            className="mt-3 min-h-[48px] justify-center rounded-xl bg-primary px-5 py-3"
            onPress={() => router.replace('/')}
            activeOpacity={0.82}
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
    <SafeAreaView testID="referralPartnersScreen" className="flex-1 bg-slate-50" edges={['top']}>
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

        <Text className="text-[17px] font-bold text-slate-900">Đối tác giới thiệu</Text>
        <View className="w-12" />
      </View>

      {/* Search */}
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="h-[48px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="partnerSearchInput"
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo tên, SĐT hoặc mã số thuế..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Xóa từ khóa tìm kiếm"
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 4 trạng thái: Loading / Error / Empty / Success */}
      {isLoading && !isFetching ? (
        <View className="flex-1 gap-3 px-4 pt-4">
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-36 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được danh sách đối tác</Text>
          <Text className="text-center text-xs text-slate-500">
            {error instanceof Error && error.message
              ? error.message
              : 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
            activeOpacity={0.82}
            accessibilityRole="button"
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="referralPartnersList"
          data={filteredPartners}
          keyExtractor={keyExtractor}
          renderItem={renderPartner}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
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
              <Feather name="users" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">
                {searchQuery ? 'Không tìm thấy đối tác phù hợp' : 'Chưa có đối tác giới thiệu'}
              </Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                {searchQuery
                  ? 'Thử lại với tên, số điện thoại hoặc mã số thuế khác.'
                  : 'Thêm đối tác giới thiệu đầu tiên để bắt đầu theo dõi hoa hồng CTV.'}
              </Text>
              {!searchQuery && canManage ? (
                <TouchableOpacity
                  testID="partnerEmptyCreateButton"
                  className="mt-2 min-h-[48px] flex-row items-center gap-2 rounded-xl bg-primary px-5"
                  onPress={() => setIsFormOpen(true)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Feather name="plus" size={18} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Thêm đối tác</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* CTA chỉ hiển thị khi đủ quyền quản lý */}
      {canManage ? (
        <TouchableOpacity
          testID="createPartnerButton"
          className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
          onPress={() => setIsFormOpen(true)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Thêm đối tác giới thiệu"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text className="text-sm font-extrabold text-white">Thêm đối tác</Text>
        </TouchableOpacity>
      ) : null}

      <PartnerFormModal
        visible={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={refetch}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
