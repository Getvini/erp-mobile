import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';
import { getUserAccount, getUserRoleLabel, UserItem } from '@/services/userService';

interface UserCardProps {
  user: UserItem;
  onPress?: (user: UserItem) => void;
}

/** Màu badge theo nhóm quyền — chỉ để phân biệt trực quan trên danh sách. */
const getRoleBadgeStyle = (role?: string): { bg: string; text: string } => {
  switch (role) {
    case 'ADMIN':
    case 'BOD':
      return { bg: '#FEF2F2', text: '#B91C1C' };
    case 'ADMIN_SALE':
    case 'BD':
      return { bg: '#EFF6FF', text: '#1D4ED8' };
    case 'PM':
      return { bg: '#F5F3FF', text: '#6D28D9' };
    default:
      return { bg: '#ECFDF5', text: '#047857' };
  }
};

export const UserCard: React.FC<UserCardProps> = ({ user, onPress }) => {
  const account = getUserAccount(user);
  const role = account?.role;
  const roleStyle = getRoleBadgeStyle(role);
  const initial = (user.fullName || account?.username || 'U').charAt(0).toUpperCase();

  const handleCall = () => {
    const phone = user.phoneNumber?.trim();
    if (!phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi trên thiết bị này.');
    });
  };

  const handleEmail = () => {
    const email = account?.email?.trim();
    if (!email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng email trên thiết bị này.');
    });
  };

  return (
    <TouchableOpacity
      testID={`userCard-${user.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress?.(user)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Xem hồ sơ nhân sự ${user.fullName}`}
    >
      {/* Identity row */}
      <View className="mb-3 flex-row items-center">
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
          <Text className="text-lg font-extrabold text-orange-600">{initial}</Text>
        </View>

        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
            {user.fullName || 'Chưa cập nhật tên'}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-2">
            {account?.username ? (
              <Text className="text-[12px] font-medium text-slate-500" numberOfLines={1}>
                @{account.username}
              </Text>
            ) : null}
            {user.isLocked ? (
              <View className="rounded-md bg-red-50 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-red-600">Đã khóa</Text>
              </View>
            ) : account?.isActive === false ? (
              <View className="rounded-md bg-slate-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-slate-500">Ngừng HĐ</Text>
              </View>
            ) : null}
          </View>
        </View>

        {user.workload ? <WorkloadBadge workload={user.workload} /> : null}
      </View>

      {/* Role + phone */}
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: roleStyle.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: roleStyle.text }}>
            {getUserRoleLabel(role)}
          </Text>
        </View>

        {user.phoneNumber ? (
          <View className="flex-row items-center gap-1.5">
            <Feather name="phone" size={12} color="#94A3B8" />
            <Text className="text-[12px] font-semibold text-slate-600">{user.phoneNumber}</Text>
          </View>
        ) : null}
      </View>

      {/* Quick actions — 1 chạm gọi điện / gửi mail */}
      <View className="mt-3 flex-row items-center gap-2 border-t border-slate-100 pt-3">
        <TouchableOpacity
          testID={`userCall-${user.id}`}
          className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50"
          onPress={handleCall}
          disabled={!user.phoneNumber}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gọi điện cho ${user.fullName}`}
          accessibilityState={{ disabled: !user.phoneNumber }}
        >
          <Feather name="phone-call" size={14} color={user.phoneNumber ? '#10B981' : '#CBD5E1'} />
          <Text
            className={`text-xs font-bold ${user.phoneNumber ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            Gọi điện
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={`userEmail-${user.id}`}
          className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-50"
          onPress={handleEmail}
          disabled={!account?.email}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gửi email cho ${user.fullName}`}
          accessibilityState={{ disabled: !account?.email }}
        >
          <Feather name="mail" size={14} color={account?.email ? '#3B82F6' : '#CBD5E1'} />
          <Text className={`text-xs font-bold ${account?.email ? 'text-blue-600' : 'text-slate-400'}`}>
            Gửi mail
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default UserCard;
