import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useDeleteUserMutation,
  useUserDetailQuery,
} from '@/hooks/queries/useUsers';
import {
  getUserAccount,
  getUserRoleLabel,
  getUserStatusLabel,
  UserTaskSummary,
} from '@/services/userService';
import UserFormModal from '@/components/users/UserFormModal';
import { LaborContractSection } from '@/components/users/LaborContractSection';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessUsers, canManageUsers } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';
import { formatVND } from '@/utils/formatters';

function InfoRow({
  label,
  value,
  separated = true,
}: {
  label: string;
  value: string;
  separated?: boolean;
}) {
  return (
    <View className={separated ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
      <Text className="mb-1 text-[11px] font-semibold uppercase text-slate-400">{label}</Text>
      <Text className="text-sm font-bold leading-5 text-slate-800">{value}</Text>
    </View>
  );
}

const getTaskStatusLabel = (status?: string): string => {
  switch (status) {
    case 'TODO':
      return 'Chờ xử lý';
    case 'IN_PROGRESS':
      return 'Đang làm';
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'REWORK':
      return 'Làm lại';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status || 'Không xác định';
  }
};

function LoadingSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-4" edges={['top']}>
      <View className="h-14 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-44 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-28 rounded-2xl bg-slate-200" />
      <View className="mt-4 h-36 rounded-2xl bg-slate-200" />
    </SafeAreaView>
  );
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const viewerRole = useAuthStore((state) => state.user?.role);
  const canManage = canManageUsers(viewerRole);

  const userId = typeof id === 'string' ? id : '';
  const [isEditOpen, setIsEditOpen] = useState(false);

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useUserDetailQuery(userId);
  const deleteUserMutation = useDeleteUserMutation();

  const account = getUserAccount(user);
  const tasks: UserTaskSummary[] = useMemo(
    () => (Array.isArray(user?.tasks) ? user!.tasks!.filter(Boolean) : []),
    [user],
  );

  const handleCall = useCallback(() => {
    const phone = user?.phoneNumber?.trim();
    if (!phone) {
      Alert.alert('Thông báo', 'Nhân sự này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi trên thiết bị này.');
    });
  }, [user?.phoneNumber]);

  const handleEmail = useCallback(() => {
    const email = account?.email?.trim();
    if (!email) {
      Alert.alert('Thông báo', 'Nhân sự này chưa cập nhật email.');
      return;
    }
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng email trên thiết bị này.');
    });
  }, [account?.email]);

  const confirmDelete = useCallback(() => {
    if (!user || !canManage || deleteUserMutation.isPending) return;

    Alert.alert(
      'Xóa nhân sự',
      `Bạn có chắc muốn xóa hồ sơ “${user.fullName}”? Tài khoản đăng nhập đi kèm cũng sẽ bị xóa và thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa nhân sự',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserMutation.mutateAsync(user.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa hồ sơ nhân sự.', [
                { text: 'Đóng', onPress: () => router.replace('/users' as any) },
              ]);
            } catch (deleteError: unknown) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const message =
                deleteError instanceof Error
                  ? deleteError.message
                  : 'Vui lòng kiểm tra dữ liệu liên quan và thử lại.';
              Alert.alert('Không thể xóa nhân sự', message);
            }
          },
        },
      ],
    );
  }, [canManage, deleteUserMutation, router, user]);

  if (isLoading) return <LoadingSkeleton />;

  if (!canAccessUsers(viewerRole)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-8" edges={['top']}>
        <Feather name="shield-off" size={40} color="#EF4444" />
        <Text className="text-base font-bold text-slate-900">Không có quyền truy cập</Text>
        <TouchableOpacity
          className="mt-2 min-h-[48px] justify-center rounded-xl bg-primary px-5"
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6" edges={['top']}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không tải được hồ sơ nhân sự</Text>
        <Text className="text-center text-xs text-slate-500">
          {error instanceof Error
            ? error.message
            : 'Dữ liệu không tồn tại hoặc bạn không có quyền xem.'}
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
          onPress={() => safeGoBack(router, '/users')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-slate-600">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const initial = (user.fullName || account?.username || 'U').charAt(0).toUpperCase();
  const statusLabel = getUserStatusLabel(user);
  const isInactive = user.isLocked || account?.isActive === false;

  return (
    <SafeAreaView testID="userDetailScreen" className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header bar */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
          onPress={() => safeGoBack(router, '/users')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách nhân sự"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="flex-1 px-2 text-center text-[17px] font-bold text-slate-900" numberOfLines={1}>
          Hồ sơ nhân sự
        </Text>
        {canManage ? (
          <TouchableOpacity
            testID="editUserButton"
            className="h-12 w-12 items-center justify-center rounded-xl border border-orange-100 bg-orange-50"
            onPress={() => setIsEditOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa nhân sự"
          >
            <Feather name="edit-3" size={18} color={BrandColors.primary} />
          </TouchableOpacity>
        ) : (
          <View className="w-12" />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* Identity card */}
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50">
            <Text className="text-2xl font-black text-orange-600">{initial}</Text>
          </View>

          <Text className="text-center text-lg font-bold text-slate-900">{user.fullName}</Text>

          {account?.username ? (
            <Text className="mt-0.5 text-[12px] font-medium text-slate-500">
              @{account.username}
            </Text>
          ) : null}

          <View className="mt-2.5 flex-row flex-wrap items-center justify-center gap-2">
            <View className="rounded-lg bg-orange-50 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-orange-700">
                {getUserRoleLabel(account?.role)}
              </Text>
            </View>
            <View
              className={`rounded-lg px-2.5 py-1 ${isInactive ? 'bg-red-50' : 'bg-emerald-50'}`}
            >
              <Text
                className={`text-[11px] font-bold ${isInactive ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View className="mt-4 w-full flex-row gap-2 border-t border-slate-100 pt-4">
            <TouchableOpacity
              className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50"
              onPress={handleCall}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Gọi điện cho nhân sự"
            >
              <Feather name="phone-call" size={15} color="#10B981" />
              <Text className="text-xs font-bold text-emerald-600">Gọi điện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-50"
              onPress={handleEmail}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Gửi email cho nhân sự"
            >
              <Feather name="mail" size={15} color="#3B82F6" />
              <Text className="text-xs font-bold text-blue-600">Gửi mail</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account info card */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="mb-1 flex-row items-center gap-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
              <Feather name="user" size={15} color={BrandColors.primary} />
            </View>
            <Text className="text-sm font-bold text-slate-900">Thông tin tài khoản</Text>
          </View>

          <InfoRow label="Tên đăng nhập" value={account?.username || 'Chưa cập nhật'} />
          <InfoRow label="Email" value={account?.email || 'Chưa cập nhật'} />
          <InfoRow label="Số điện thoại" value={user.phoneNumber || 'Chưa cập nhật'} />
          <InfoRow label="Vai trò" value={getUserRoleLabel(account?.role)} />
          {typeof account?.vinicoin === 'number' ? (
            <InfoRow label="Vinicoin khả dụng" value={formatVND(account.vinicoin, 'Vinicoin')} />
          ) : null}
          {typeof account?.vinicoinTotal === 'number' ? (
            <InfoRow label="Vinicoin tích lũy" value={formatVND(account.vinicoinTotal, 'Vinicoin')} />
          ) : null}
          {typeof account?.vinicoinWithdrawn === 'number' ? (
            <InfoRow label="Vinicoin đã rút" value={formatVND(account.vinicoinWithdrawn, 'Vinicoin')} />
          ) : null}
        </View>

        {/* Labor contracts (upload Cloudinary → PATCH labor-contracts) */}
        <LaborContractSection user={user} canManage={canManage} />

        {/* Assigned tasks */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
                <Feather name="check-square" size={15} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-bold text-slate-900">Công việc phụ trách</Text>
            </View>
            <View className="rounded-full bg-slate-100 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-slate-600">{tasks.length}</Text>
            </View>
          </View>

          {tasks.length === 0 ? (
            <View className="items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
              <Feather name="inbox" size={22} color="#CBD5E1" />
              <Text className="mt-1.5 text-xs font-semibold text-slate-500">
                Chưa có công việc nào được giao
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  testID={`userTask-${task.id}`}
                  className="min-h-[48px] flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                  onPress={() => router.push(`/tasks/${task.id}` as any)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Mở công việc ${task.name || task.code || ''}`}
                >
                  <View className="mr-2 flex-1">
                    <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                      {task.name || 'Công việc chưa đặt tên'}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-2">
                      {task.code ? (
                        <Text className="text-[10px] font-bold text-slate-400">#{task.code}</Text>
                      ) : null}
                      <Text className="text-[10px] font-semibold text-slate-500">
                        {getTaskStatusLabel(task.status)}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Destructive action — chỉ ADMIN/BOD */}
        {canManage ? (
          <TouchableOpacity
            testID="deleteUserButton"
            className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4"
            onPress={confirmDelete}
            disabled={deleteUserMutation.isPending}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Xóa nhân sự"
            accessibilityState={{ disabled: deleteUserMutation.isPending }}
          >
            {deleteUserMutation.isPending ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Feather name="trash-2" size={18} color="#DC2626" />
            )}
            <Text className="text-sm font-bold text-red-700">Xóa nhân sự</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <UserFormModal
        visible={isEditOpen}
        user={user}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}
