import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Team, TeamMemberEntry } from '@/services/teamService';
import {
  useAddTeamMemberMutation,
  useTeamUserDirectoryQuery,
  useUpdateTeamMemberRolesMutation,
} from '@/hooks/queries/useTeams';
import {
  ASSIGNABLE_MEMBER_ROLES,
  TEAM_MEMBER_ROLE_LABELS,
  canRemoveAccountRole,
  normalizeRoles,
  validateMemberRoles,
} from '@/utils/teamMemberRoles';
import { getTeamMemberRoles } from '@/utils/teamMember';
import { TeamUserPicker } from '@/components/teams/TeamFormModal';

const ACCOUNT_ROLE_MESSAGE = 'Đội dự án phải có ít nhất 1 nhân sự giữ vai trò Account';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  CONTENT_CREATOR: 'Sáng tạo nội dung & bài viết',
  EDITOR: 'Dựng phim & biên tập video',
  GRAPHIC_DESIGNER: 'Thiết kế banner, hình ảnh',
  CAMERAMAN: 'Quay hình & kỹ thuật hình ảnh',
  ACCOUNT: 'Quản lý & duyệt công việc nhóm',
  SCRIPTER: 'Viết kịch bản truyền thông',
  SOCIAL_MEDIA_MANAGER: 'Quản trị các trang mạng xã hội',
  SEO_SPECIALIST: 'Tối ưu hoá công cụ tìm kiếm',
};

/** Vai trò có thể gán qua endpoint member (loại PROJECT_MANAGER — backend trả 400). */
const ASSIGNABLE_ROLE_ITEMS = ASSIGNABLE_MEMBER_ROLES.map((role) => ({
  key: role,
  label: TEAM_MEMBER_ROLE_LABELS[role] || role,
  desc: ROLE_DESCRIPTIONS[role] || '',
}));

interface TeamMemberSheetProps {
  onClose: () => void;
  mode: 'add' | 'edit';
  team: Team;
  member: TeamMemberEntry | null;
  members?: TeamMemberEntry[];
  onSuccess?: () => void;
}

/**
 * Nội dung bottom sheet thêm/sửa thành viên. Component được remount mỗi lần mở
 * (xem `key` ở `TeamMemberModal`) nên state vai trò luôn khởi tạo từ `member`.
 */
function TeamMemberSheet({
  onClose,
  mode,
  team,
  member,
  members,
  onSuccess,
}: TeamMemberSheetProps) {
  const editingUserId = member?.user?.id || member?.userId || '';
  const editingName = member?.user?.fullName || 'Nhân sự';
  const memberRoles = normalizeRoles(getTeamMemberRoles(member));
  /** Vai trò hiện tại nằm ngoài danh sách gán được (ví dụ PROJECT_MANAGER) — giữ nguyên, không sửa ở đây. */
  const lockedRoles = memberRoles.filter((role) => !ASSIGNABLE_MEMBER_ROLES.includes(role));
  const teamMembers: TeamMemberEntry[] = Array.isArray(members)
    ? members
    : Array.isArray(team?.members)
    ? team.members
    : [];

  const [selectedUserId, setSelectedUserId] = useState(mode === 'add' ? '' : editingUserId);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() =>
    mode === 'add'
      ? ['CONTENT_CREATOR']
      : memberRoles.filter((role) => ASSIGNABLE_MEMBER_ROLES.includes(role))
  );

  const { data: usersData, isLoading: loadingUsers } = useTeamUserDirectoryQuery();
  const users = usersData || [];

  const addMutation = useAddTeamMemberMutation();
  const updateRolesMutation = useUpdateTeamMemberRolesMutation();
  const isSubmitting = addMutation.isPending || updateRolesMutation.isPending;

  const toggleRole = (roleKey: string) => {
    if (mode === 'edit' && roleKey === 'ACCOUNT' && selectedRoles.includes('ACCOUNT')) {
      if (!canRemoveAccountRole(teamMembers, editingUserId)) {
        Alert.alert('Không thể bỏ vai trò', ACCOUNT_ROLE_MESSAGE);
        return;
      }
    }
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((role) => role !== roleKey) : [...prev, roleKey]
    );
  };

  const handleSubmit = async () => {
    if (!team?.id) {
      Alert.alert('Lỗi', 'Không tìm thấy mã đội.');
      return;
    }

    const targetUserId = mode === 'add' ? selectedUserId : editingUserId;
    if (!targetUserId) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn nhân sự muốn thêm vào đội.');
      return;
    }

    const validation = validateMemberRoles(selectedRoles);
    if (!validation.valid) {
      Alert.alert('Cảnh báo', validation.message || 'Vai trò không hợp lệ.');
      return;
    }

    if (
      mode === 'edit' &&
      memberRoles.includes('ACCOUNT') &&
      !selectedRoles.includes('ACCOUNT') &&
      !canRemoveAccountRole(teamMembers, editingUserId)
    ) {
      Alert.alert('Không thể cập nhật', ACCOUNT_ROLE_MESSAGE);
      return;
    }

    try {
      if (mode === 'add') {
        await addMutation.mutateAsync({
          teamId: team.id,
          userId: targetUserId,
          roles: selectedRoles,
        });
        Alert.alert('Thành công', 'Đã thêm nhân sự vào đội.');
      } else {
        await updateRolesMutation.mutateAsync({
          teamId: team.id,
          userId: targetUserId,
          roles: selectedRoles,
        });
        Alert.alert('Thành công', `Đã cập nhật vai trò của ${editingName}.`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  return (
    <View className="bg-white rounded-t-[24px] max-h-[90%] p-4 pb-6 gap-3">
      {/* Header */}
      <View className="flex-row justify-between items-start border-b border-slate-100 pb-2.5">
        <View className="flex-1">
          <Text className="text-base font-bold text-text-primary">
            {mode === 'add' ? 'Thêm thành viên' : 'Cập nhật vai trò thành viên'}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
            {mode === 'add' ? team?.name || 'Đội nhóm' : `${editingName} • ${team?.name || ''}`}
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
        {mode === 'add' && (
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-800">1. Chọn nhân sự</Text>
            <TeamUserPicker
              users={users}
              selectedUserId={selectedUserId}
              onSelect={setSelectedUserId}
              isLoading={loadingUsers}
              emptyMessage="Chưa tải được danh sách nhân sự."
            />
          </View>
        )}

        <View className="gap-2">
          <View className="flex-row justify-between items-baseline">
            <Text className="text-xs font-bold text-slate-800">
              {mode === 'add' ? '2. Chọn vai trò trong đội' : 'Chọn vai trò trong đội'}
            </Text>
            <Text className="text-[11px] font-semibold text-primary">
              Đã chọn ({selectedRoles.length})
            </Text>
          </View>
          <Text className="text-[11px] text-text-secondary">
            Có thể chọn nhiều vai trò cho cùng một nhân sự.
          </Text>

          {lockedRoles.length > 0 && (
            <View className="flex-row items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <Feather name="alert-triangle" size={13} color="#B45309" />
              <Text className="text-[11px] text-amber-800 flex-1">
                Nhân sự này đang giữ vai trò không gán được qua màn hình này (
                {lockedRoles.map((role) => TEAM_MEMBER_ROLE_LABELS[role] || role).join(', ')}). Vai
                trò đó được giữ nguyên.
              </Text>
            </View>
          )}

          <View className="gap-1.5">
            {ASSIGNABLE_ROLE_ITEMS.map((roleItem) => {
              const isSelected = selectedRoles.includes(roleItem.key);
              const isAccountLocked =
                roleItem.key === 'ACCOUNT' &&
                isSelected &&
                mode === 'edit' &&
                !canRemoveAccountRole(teamMembers, editingUserId);

              return (
                <TouchableOpacity
                  key={roleItem.key}
                  testID={`teamRoleOption-${roleItem.key}`}
                  className={`p-2.5 rounded-xl border flex-row items-center justify-between min-h-[48px] ${
                    isSelected ? 'border-primary bg-orange-50/40' : 'border-border bg-slate-50/50'
                  }`}
                  onPress={() => toggleRole(roleItem.key)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-primary' : 'text-slate-800'
                        }`}
                      >
                        {roleItem.label}
                      </Text>
                      {isAccountLocked && (
                        <View className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                          <Text className="text-[10px] font-bold text-amber-800">Bắt buộc giữ</Text>
                        </View>
                      )}
                    </View>
                    {roleItem.desc ? (
                      <Text className="text-[11px] text-text-secondary mt-0.5">{roleItem.desc}</Text>
                    ) : null}
                  </View>

                  <View className="shrink-0 pl-1">
                    {isSelected ? (
                      <View className="w-5 h-5 rounded-md bg-primary items-center justify-center">
                        <Feather
                          name={isAccountLocked ? 'lock' : 'check'}
                          size={14}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : (
                      <View className="w-5 h-5 rounded-md border border-slate-300 bg-white" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
          testID="teamMemberSubmitButton"
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
              <Feather name={mode === 'add' ? 'user-plus' : 'save'} size={15} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">
                {mode === 'add' ? 'Thêm vào đội' : 'Lưu vai trò'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface TeamMemberModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  team: Team;
  member?: TeamMemberEntry | null;
  /** Danh sách thành viên hiện có (mặc định lấy từ `team.members`) để kiểm tra luật ACCOUNT. */
  members?: TeamMemberEntry[];
  onSuccess?: () => void;
}

/**
 * Bottom sheet thêm/sửa thành viên đội nhóm.
 * - `add`: chọn nhân sự + multi-select vai trò.
 * - `edit`: multi-select vai trò, chặn bỏ vai trò ACCOUNT cuối cùng của đội.
 * Luôn gửi `roles` dạng MẢNG STRING.
 */
export default function TeamMemberModal({
  visible,
  onClose,
  mode,
  team,
  member = null,
  members,
  onSuccess,
}: TeamMemberModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-end">
        <TeamMemberSheet
          key={visible ? `${mode}-${member?.id || 'new'}-${team?.id || ''}` : 'closed'}
          onClose={onClose}
          mode={mode}
          team={team}
          member={member}
          members={members}
          onSuccess={onSuccess}
        />
      </View>
    </Modal>
  );
}
