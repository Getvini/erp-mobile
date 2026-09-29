import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import {
  getUserAccount,
  USER_ROLE_OPTIONS,
  UserItem,
} from '@/services/userService';
import { UserCard } from '@/components/users/UserCard';
import UserFormModal from '@/components/users/UserFormModal';
import BottomNavBar from '@/components/BottomNavBar';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessUsers, canManageUsers } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';

/** Backend `GET /users` không hỗ trợ page/limit ⇒ phân trang thuần client-side. */
const PAGE_SIZE = 20;

export default function UsersScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const hasAccess = canAccessUsers(role);
  const canManage = canManageUsers(role);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Lấy kèm `workload` của tháng hiện tại để hiển thị WorkloadBadge.
  const now = useMemo(() => new Date(), []);
  const {
    data: users = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useUsersQuery({ month: now.getMonth() + 1, year: now.getFullYear() });

  // Client-side search + role filter (backend không hỗ trợ `search`).
  const filteredUsers = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const account = getUserAccount(user);
      if (roleFilter !== 'ALL' && account?.role !== roleFilter) return false;
      if (!keyword) return true;
      return (
        (user.fullName || '').toLowerCase().includes(keyword) ||
        (user.phoneNumber || '').toLowerCase().includes(keyword) ||
        (account?.username || '').toLowerCase().includes(keyword)
      );
    });
  }, [roleFilter, searchQuery, users]);

  // Đổi từ khóa / bộ lọc ⇒ quay về trang đầu tiên (reset ngay trong handler,
  // không dùng useEffect để tránh cascading render).
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setVisibleCount(PAGE_SIZE);
  };

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleCount),
    [filteredUsers, visibleCount],
  );
  const hasMore = visibleCount < filteredUsers.length;

  if (!hasAccess) {
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
          <Text className="text-[17px] font-bold text-slate-900">Danh bạ nhân sự</Text>
          <View className="w-12" />
        </View>

        <View className="flex-1 items-center justify-center gap-3 p-8">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
            <Feather name="shield-off" size={34} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="max-w-[280px] text-center text-[13px] leading-5 text-slate-500">
            Phân hệ Danh bạ nhân sự chỉ dành riêng cho Ban Quản trị (Admin/BOD).
          </Text>
          <TouchableOpacity
            className="mt-3 min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => router.replace('/')}
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
    <SafeAreaView testID="usersScreen" className="flex-1 bg-slate-50" edges={['top']}>
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

        <View className="flex-1 items-center">
          <Text className="text-[17px] font-bold text-slate-900">Danh bạ nhân sự</Text>
          <Text className="text-[11px] text-slate-400">
            {filteredUsers.length}/{users.length} nhân sự
          </Text>
        </View>

        <View className="w-12" />
      </View>

      {/* Search + role filter (client-side) */}
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="h-[48px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="userSearchInput"
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo họ tên, SĐT hoặc tên đăng nhập..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pt-2.5"
        >
          {[{ value: 'ALL', label: 'Tất cả' }, ...USER_ROLE_OPTIONS].map((option) => {
            const isActive = roleFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`userRoleChip-${option.value}`}
                className={`min-h-[44px] justify-center rounded-full border px-3 ${
                  isActive ? 'border-primary bg-primary' : 'border-slate-200 bg-slate-100'
                }`}
                onPress={() => handleRoleFilterChange(option.value)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className={`text-xs ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'}`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content — 4 trạng thái */}
      {isLoading ? (
        <View className="flex-1 gap-3 px-4 pt-4">
          {[0, 1, 2, 3].map((item) => (
            <View key={item} className="h-36 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">
            Không tải được danh bạ nhân sự
          </Text>
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
          testID="usersList"
          data={visibleUsers}
          keyExtractor={(item: UserItem) => item.id}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onPress={(user) => router.push(`/users/${user.id}` as any)}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore) setVisibleCount((prev) => prev + PAGE_SIZE);
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-2.5 py-14">
              <Feather name="users" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">
                Không tìm thấy nhân sự nào
              </Text>
              <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
                {searchQuery || roleFilter !== 'ALL'
                  ? 'Thử từ khóa khác hoặc bỏ bộ lọc vai trò.'
                  : 'Hệ thống chưa có hồ sơ nhân sự nào đang hoạt động.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                testID="usersLoadMore"
                className="mt-1 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white"
                onPress={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Feather name="chevron-down" size={16} color={BrandColors.primary} />
                <Text className="text-xs font-bold text-orange-700">
                  Tải thêm ({filteredUsers.length - visibleUsers.length} nhân sự)
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Nút thêm nhân sự — ẩn hoàn toàn nếu thiếu quyền */}
      {canManage ? (
        <TouchableOpacity
          testID="createUserButton"
          className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
          onPress={() => setIsFormOpen(true)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Thêm nhân sự mới"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text className="text-sm font-extrabold text-white">Thêm nhân sự</Text>
        </TouchableOpacity>
      ) : null}

      <UserFormModal
        visible={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => refetch()}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
