import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Team, TeamMemberUser } from '@/services/teamService';
import {
  useChangeTeamLeadMutation,
  useCreateTeamMutation,
  useTeamUserDirectoryQuery,
  useUpdateTeamMutation,
} from '@/hooks/queries/useTeams';
import { BrandColors } from '@/constants/colors';

const NO_EXCLUDED_USERS: string[] = [];

interface TeamUserPickerProps {
  users: TeamMemberUser[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
  isLoading?: boolean;
  /** Ẩn những nhân sự đã có trong đội. */
  excludeUserIds?: string[];
  emptyMessage?: string;
}

/**
 * Bộ chọn nhân sự dùng chung cho `TeamFormModal` (chọn Team Lead) và
 * `TeamMemberModal` (chọn người thêm vào đội). Ô tìm kiếm tự reset vì component
 * được remount mỗi lần bottom sheet mở (xem `key` ở component cha).
 *
 * TODO(P3-Users): khi module Users có `src/components/users/UserSelectorModal.tsx`,
 * thay component này bằng `UserSelectorModal` chính thức.
 */
export function TeamUserPicker({
  users,
  selectedUserId,
  onSelect,
  isLoading = false,
  excludeUserIds = NO_EXCLUDED_USERS,
  emptyMessage = 'Không có nhân sự phù hợp.',
}: TeamUserPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (excludeUserIds.includes(user.id)) return false;
      if (!query) return true;
      return (
        (user.fullName || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.phoneNumber || '').includes(query)
      );
    });
  }, [users, searchQuery, excludeUserIds]);

  return (
    <View className="gap-2">
      {users.length > 5 && (
        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 min-h-[44px] gap-2">
          <Feather name="search" size={14} color="#94A3B8" />
          <TextInput
            className="flex-1 text-xs text-text-primary py-0"
            placeholder="Tìm theo tên, email hoặc SĐT..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Xoá tìm kiếm"
            >
              <Feather name="x-circle" size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <View className="py-5 items-center gap-2">
          <ActivityIndicator size="small" color={BrandColors.primary} />
          <Text className="text-xs text-text-muted">Đang tải danh sách nhân sự...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View className="py-5 items-center justify-center gap-1.5 bg-background rounded-xl">
          <Feather name="users" size={24} color="#94A3B8" />
          <Text className="text-xs text-text-secondary text-center">{emptyMessage}</Text>
        </View>
      ) : (
        <ScrollView
          className="max-h-[180px]"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1.5">
            {filteredUsers.map((user) => {
              const isSelected = selectedUserId === user.id;
              return (
                <TouchableOpacity
                  key={user.id}
                  testID={`teamUserOption-${user.id}`}
                  className={`flex-row items-center justify-between py-2 px-2.5 rounded-xl border min-h-[48px] ${
                    isSelected ? 'border-primary bg-orange-50/50' : 'border-border bg-slate-50/50'
                  }`}
                  onPress={() => onSelect(user.id)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2.5 flex-1">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        isSelected ? 'bg-primary' : 'bg-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-text-primary" numberOfLines={1}>
                        {user.fullName}
                      </Text>
                      {(user.email || user.phoneNumber) && (
                        <Text className="text-[11px] text-text-secondary" numberOfLines={1}>
                          {user.email || user.phoneNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isSelected ? (
                    <Feather name="check-circle" size={18} color={BrandColors.primary} />
                  ) : (
                    <Feather name="circle" size={16} color="#CBD5E1" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

interface TeamFormSheetProps {
  onClose: () => void;
  team: Team | null;
  leadOnly: boolean;
  onSuccess?: () => void;
}

/**
 * Nội dung bottom sheet tạo/sửa đội. Được remount mỗi lần mở (xem `key`) nên state
 * form luôn khởi tạo từ `team` mà không cần effect đồng bộ.
 */
function TeamFormSheet({ onClose, team, leadOnly, onSuccess }: TeamFormSheetProps) {
  const isEdit = Boolean(team?.id);
  const [name, setName] = useState(team?.name || '');
  const [teamLeadId, setTeamLeadId] = useState(team?.teamLeadId || team?.teamLead?.id || '');

  const { data: usersData, isLoading: loadingUsers } = useTeamUserDirectoryQuery();
  const users = usersData || [];

  const createMutation = useCreateTeamMutation();
  const updateMutation = useUpdateTeamMutation();
  const changeLeadMutation = useChangeTeamLeadMutation();
  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || changeLeadMutation.isPending;

  const selectedLead = users.find((user) => user.id === teamLeadId);

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!leadOnly && !trimmedName) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập tên đội.');
      return;
    }
    if (!teamLeadId) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn Team Lead cho đội.');
      return;
    }

    try {
      if (leadOnly && team?.id) {
        await changeLeadMutation.mutateAsync({ id: team.id, newLeadId: teamLeadId });
        Alert.alert('Thành công', 'Đã cập nhật Team Lead của đội.');
      } else if (isEdit && team?.id) {
        await updateMutation.mutateAsync({
          id: team.id,
          name: trimmedName,
          teamLeadId,
        });
        Alert.alert('Thành công', 'Đã cập nhật thông tin đội.');
      } else {
        await createMutation.mutateAsync({ name: trimmedName, teamLeadId });
        Alert.alert('Thành công', 'Đã tạo đội nhóm mới.');
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  const title = leadOnly
    ? 'Đổi Team Lead'
    : isEdit
    ? 'Cập nhật đội nhóm'
    : 'Tạo đội nhóm mới';

  return (
    <View className="bg-white rounded-t-[24px] max-h-[90%] p-4 pb-6 gap-3">
      {/* Header */}
      <View className="flex-row justify-between items-start border-b border-slate-100 pb-2.5">
        <View className="flex-1">
          <Text className="text-base font-bold text-text-primary">{title}</Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            {leadOnly
              ? 'Chọn nhân sự mới đảm nhiệm vai trò Team Lead.'
              : 'Đội nhóm gồm một Team Lead và các thành viên kiêm nhiều vai trò.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="p-1.5 rounded-full bg-slate-100 min-w-[32px] min-h-[32px] items-center justify-center"
          activeOpacity={0.7}
          accessibilityLabel="Đóng"
        >
          <Feather name="x" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {!leadOnly && (
          <View className="gap-1.5">
            <Text className="text-xs font-bold text-slate-800">
              Tên đội <Text className="text-danger">*</Text>
            </Text>
            <TextInput
              testID="teamNameInput"
              className="border border-border rounded-xl px-3 min-h-[48px] text-sm text-text-primary bg-slate-50/50"
              placeholder="Ví dụ: Đội Content Getvini"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              editable={!isSubmitting}
            />
          </View>
        )}

        <View className="gap-1.5">
          <View className="flex-row justify-between items-baseline">
            <Text className="text-xs font-bold text-slate-800">
              Team Lead <Text className="text-danger">*</Text>
            </Text>
            {selectedLead && (
              <Text className="text-[11px] font-semibold text-primary">
                Đã chọn: {selectedLead.fullName}
              </Text>
            )}
          </View>
          <Text className="text-[11px] text-text-secondary">
            {leadOnly
              ? 'Người được chọn sẽ trở thành Team Lead của đội (tự động thêm vào đội nếu chưa là thành viên).'
              : 'Bắt buộc chọn Team Lead ngay khi tạo đội.'}
          </Text>
          <TeamUserPicker
            users={users}
            selectedUserId={teamLeadId}
            onSelect={setTeamLeadId}
            isLoading={loadingUsers}
            emptyMessage="Chưa tải được danh sách nhân sự."
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="flex-row justify-end items-center gap-2.5 border-t border-slate-100 pt-3">
        <TouchableOpacity
          className="px-4 min-h-[48px] justify-center rounded-xl bg-slate-100"
          onPress={onClose}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text className="text-sm font-semibold text-slate-600">Hủy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="teamSubmitButton"
          className={`flex-row items-center gap-1.5 px-5 min-h-[48px] justify-center rounded-xl bg-primary ${
            isSubmitting ? 'opacity-50' : ''
          }`}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name={leadOnly ? 'user-check' : 'save'} size={15} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">
                {leadOnly ? 'Cập nhật Lead' : isEdit ? 'Lưu thay đổi' : 'Tạo đội'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface TeamFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Có `team` ⇒ chế độ sửa (name + Team Lead). */
  team?: Team | null;
  /** Chỉ đổi Team Lead (PUT /teams/:id/lead — chỉ ADMIN/BOD gọi được). */
  leadOnly?: boolean;
  onSuccess?: () => void;
}

/**
 * Bottom sheet tạo/sửa đội nhóm.
 * `teamLeadId` là BẮT BUỘC ở backend nên luôn bắt buộc chọn Team Lead ngay khi tạo.
 */
export default function TeamFormModal({
  visible,
  onClose,
  team = null,
  leadOnly = false,
  onSuccess,
}: TeamFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-end">
        <TeamFormSheet
          key={visible ? `team-form-${team?.id || 'new'}-${leadOnly ? 'lead' : 'full'}` : 'closed'}
          onClose={onClose}
          team={team}
          leadOnly={leadOnly}
          onSuccess={onSuccess}
        />
      </View>
    </Modal>
  );
}
