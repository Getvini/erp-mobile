import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserProfileQuery, useLogoutMutation } from '@/hooks/queries';
import { useAuthStore } from '@/stores/useAuthStore';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import { useQueryClient } from '@tanstack/react-query';

export default function ProfileScreen() {
  const router = useRouter();
  const storeUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  // TanStack Query Hooks
  const { data: queryUser, isLoading, refetch, isRefetching } = useUserProfileQuery();
  const logoutMutation = useLogoutMutation();

  const user = queryUser || storeUser;

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng Getvini ERP?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logoutMutation.mutateAsync();
            queryClient.clear();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="items-center border-b border-slate-200 bg-white px-4 py-3.5">
        <Text className="text-[17px] font-bold text-slate-900">Hồ sơ cá nhân</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* Profile Card */}
        <View className="items-center rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-[20px] bg-primary shadow-md">
            <Text className="text-[26px] font-extrabold text-white">
              {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="mb-1.5 text-lg font-extrabold text-slate-900">{user?.fullName || user?.username || 'Người dùng'}</Text>
          <View className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-[3px]">
            <Text className="text-[11px] font-bold uppercase text-primary">{user?.role || 'PM'}</Text>
          </View>
        </View>

        {/* Contact Info Group */}
        <View className="gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="mb-0.5 text-xs font-bold uppercase tracking-[0.5px] text-slate-400">Thông tin tài khoản</Text>

          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-slate-50">
              <Feather name="user" size={16} color={BrandColors.primary} />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-[11px] text-slate-400">Tên tài khoản</Text>
              <Text className="text-sm font-semibold text-slate-900">{user?.username || '-'}</Text>
            </View>
          </View>

          {user?.email ? (
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-slate-50">
                <Feather name="mail" size={16} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-[11px] text-slate-400">Email doanh nghiệp</Text>
                <Text className="text-sm font-semibold text-slate-900">{user.email}</Text>
              </View>
            </View>
          ) : null}

          {user?.phoneNumber ? (
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-slate-50">
                <Feather name="phone" size={16} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-[11px] text-slate-400">Số điện thoại</Text>
                <Text className="text-sm font-semibold text-slate-900">{user.phoneNumber}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* System & Support Group */}
        <View className="gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="mb-0.5 text-xs font-bold uppercase tracking-[0.5px] text-slate-400">Hệ thống & Trợ giúp</Text>

          <TouchableOpacity
            className="flex-row items-center justify-between py-1"
            activeOpacity={0.7}
            onPress={() => router.push('/settings' as any)}
          >
            <View className="flex-row items-center gap-2.5">
              <Feather name="settings" size={16} color={BrandColors.primary} />
              <Text className="text-sm font-medium text-slate-700">Cài đặt hệ thống & QC</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between py-1"
            activeOpacity={0.7}
            onPress={() => Alert.alert('Thông tin phiên bản', 'Getvini ERP Mobile v1.0.0 (Build 2026)')}
          >
            <View className="flex-row items-center gap-2.5">
              <Feather name="info" size={16} color="#64748B" />
              <Text className="text-sm font-medium text-slate-700">Phiên bản ứng dụng</Text>
            </View>
            <Text className="text-xs font-semibold text-slate-400">v1.0.0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between py-1"
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert('Hỗ trợ kỹ thuật', 'Vui lòng liên hệ Quản trị viên IT nội bộ Getvini.')
            }
          >
            <View className="flex-row items-center gap-2.5">
              <Feather name="headphones" size={16} color="#64748B" />
              <Text className="text-sm font-medium text-slate-700">Hỗ trợ IT nội bộ</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity className="mt-2 flex-row items-center justify-center gap-2 rounded-[14px] border border-red-100 bg-red-50 py-3.5" onPress={handleLogout} activeOpacity={0.85}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text className="text-[15px] font-bold text-red-500">Đăng xuất tài khoản</Text>
        </TouchableOpacity>

        <Text className="mt-2 text-center text-[11px] text-slate-400">
          Getvini • Make a sustainable brand
        </Text>
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
