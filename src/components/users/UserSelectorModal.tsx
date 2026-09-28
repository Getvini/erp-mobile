import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { getUserAccount, getUserRoleLabel, UserItem } from '@/services/userService';
import { BrandColors } from '@/constants/colors';

interface UserSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Chế độ đơn: gọi ngay khi người dùng bấm 1 nhân sự. Chế độ nhiều: gọi cho từng người đã chọn khi xác nhận. */
  onSelect: (user: UserItem) => void;
  /** Có truyền `selectedIds` ⇒ bật chế độ chọn NHIỀU (có checkbox + nút Xác nhận). */
  selectedIds?: string[];
  /** Lọc cứng theo role (backend hỗ trợ query `role`, đồng thời lọc lại client-side). */
  roleFilter?: string;
  title?: string;
  /** Callback tiện dụng cho chế độ chọn nhiều. */
  onConfirm?: (users: UserItem[]) => void;
}

interface UserSelectorSheetProps {
  onClose: () => void;
  onSelect: (user: UserItem) => void;
  selectedIds?: string[];
  roleFilter?: string;
  title: string;
  onConfirm?: (users: UserItem[]) => void;
}

const UserSelectorSheet: React.FC<UserSelectorSheetProps> = ({
  onClose,
  onSelect,
  selectedIds,
  roleFilter,
  title,
  onConfirm,
}) => {
  const insets = useSafeAreaInsets();
  const isMultiple = Array.isArray(selectedIds);

  // Sheet được mount mới mỗi lần mở ⇒ state khởi tạo trực tiếp, không cần useEffect.
  const [search, setSearch] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>(() => selectedIds || []);

  const { data: users = [], isLoading, isError, error, refetch } = useUsersQuery(
    roleFilter ? { role: roleFilter } : {},
  );

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && getUserAccount(user)?.role !== roleFilter) return false;
      if (!keyword) return true;
      const account = getUserAccount(user);
      return (
        (user.fullName || '').toLowerCase().includes(keyword) ||
        (user.phoneNumber || '').toLowerCase().includes(keyword) ||
        (account?.username || '').toLowerCase().includes(keyword) ||
        (account?.email || '').toLowerCase().includes(keyword)
      );
    });
  }, [roleFilter, search, users]);

  const togglePick = (user: UserItem) => {
    Haptics.selectionAsync();
    setPickedIds((prev) =>
      prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id],
    );
  };

  const handlePressItem = (user: UserItem) => {
    if (isMultiple) {
      togglePick(user);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(user);
    onClose();
  };

  const handleConfirm = () => {
    const selectedUsers = users.filter((user) => pickedIds.includes(user.id));
    if (selectedUsers.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onConfirm) {
      onConfirm(selectedUsers);
    } else {
      selectedUsers.forEach((user) => onSelect(user));
    }
    onClose();
  };

  const renderItem = ({ item }: { item: UserItem }) => {
    const account = getUserAccount(item);
    const isPicked = pickedIds.includes(item.id);
    const initial = (item.fullName || account?.username || 'U').charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        testID={`userSelectorItem-${item.id}`}
        className={`mb-2 flex-row items-center justify-between rounded-xl border p-3 ${
          isPicked ? 'border-primary bg-orange-50/60' : 'border-slate-200 bg-slate-50/60'
        }`}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.75}
        accessibilityRole={isMultiple ? 'checkbox' : 'button'}
        accessibilityState={isMultiple ? { checked: isPicked } : undefined}
        accessibilityLabel={`Chọn ${item.fullName}`}
      >
        <View className="mr-2 flex-1 flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-200">
            <Text className="text-sm font-bold text-slate-600">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
              {item.fullName || 'Chưa cập nhật tên'}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text className="text-[11px] font-bold text-orange-600">
                {getUserRoleLabel(account?.role)}
              </Text>
              {item.phoneNumber ? (
                <Text className="text-[11px] text-slate-500">• {item.phoneNumber}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {isMultiple ? (
          <Feather
            name={isPicked ? 'check-circle' : 'circle'}
            size={20}
            color={isPicked ? BrandColors.primary : '#CBD5E1'}
          />
        ) : (
          <Feather name="chevron-right" size={18} color="#CBD5E1" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 justify-end bg-slate-900/50">
      <View
        className="max-h-[90%] rounded-t-[24px] bg-white p-5"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between border-b border-slate-100 pb-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
              <Feather name="users" size={17} color={BrandColors.primary} />
            </View>
            <View>
              <Text className="text-base font-bold text-slate-900">{title}</Text>
              <Text className="text-[11px] text-slate-400">
                {isMultiple ? `Đã chọn ${pickedIds.length} nhân sự` : 'Bấm để chọn nhân sự'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách nhân sự"
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Search client-side */}
        <View className="mb-3 h-[48px] flex-row items-center rounded-xl bg-slate-100 px-3">
          <Feather name="search" size={17} color="#94A3B8" />
          <TextInput
            testID="userSelectorSearch"
            className="ml-2 flex-1 text-sm text-slate-900"
            placeholder="Tìm theo tên, SĐT hoặc tên đăng nhập..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* List */}
        {isLoading ? (
          <View className="items-center gap-2 py-8">
            <ActivityIndicator size="small" color={BrandColors.primary} />
            <Text className="text-xs text-slate-400">Đang tải danh sách nhân sự...</Text>
          </View>
        ) : isError ? (
          <View className="items-center gap-2 py-8">
            <Feather name="wifi-off" size={30} color="#EF4444" />
            <Text className="text-sm font-bold text-slate-700">
              Không tải được danh sách nhân sự
            </Text>
            <Text className="text-center text-[11px] text-slate-500">
              {error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối và thử lại.'}
            </Text>
            <TouchableOpacity
              className="mt-1 min-h-[48px] justify-center rounded-xl bg-primary px-5"
              onPress={() => refetch()}
              accessibilityRole="button"
            >
              <Text className="text-sm font-bold text-white">Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            testID="userSelectorList"
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center gap-2 py-10">
                <Feather name="user-x" size={34} color="#CBD5E1" />
                <Text className="text-sm font-bold text-slate-600">
                  Không tìm thấy nhân sự phù hợp
                </Text>
                <Text className="text-center text-[11px] text-slate-400">
                  Thử từ khóa khác hoặc bỏ bộ lọc vai trò.
                </Text>
              </View>
            }
          />
        )}

        {/* Footer */}
        {isMultiple ? (
          <View className="mt-3 flex-row gap-3 border-t border-slate-100 pt-3">
            <TouchableOpacity
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100"
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="userSelectorConfirm"
              className={`min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary ${
                pickedIds.length === 0 ? 'opacity-50' : ''
              }`}
              onPress={handleConfirm}
              disabled={pickedIds.length === 0}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: pickedIds.length === 0 }}
            >
              <Text className="text-sm font-bold text-white">
                Xác nhận ({pickedIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/**
 * Bottom sheet chọn nhân sự — dùng lại được cho mọi module khác
 * (phân công task, gán team, chọn người nhận thông báo...).
 */
export const UserSelectorModal: React.FC<UserSelectorModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedIds,
  roleFilter,
  title = 'Chọn nhân sự',
  onConfirm,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? (
      <UserSelectorSheet
        onClose={onClose}
        onSelect={onSelect}
        selectedIds={selectedIds}
        roleFilter={roleFilter}
        title={title}
        onConfirm={onConfirm}
      />
    ) : null}
  </Modal>
);

export default UserSelectorModal;
