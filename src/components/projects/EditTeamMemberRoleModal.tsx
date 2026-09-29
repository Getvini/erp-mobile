import React, { useEffect, useState } from 'react';
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
import { TEAM_MEMBER_ROLE_LABELS } from '@/services/teamService';
import { useUpdateTeamMemberRolesMutation } from '@/hooks/queries/useProjects';
import { BrandColors } from '@/constants/colors';
import { getTeamMemberRoles } from '@/utils/teamMember';

interface EditTeamMemberRoleModalProps {
  visible: boolean;
  onClose: () => void;
  teamId: string;
  member: any;
  existingLeadName?: string;
  existingLeadUserId?: string;
  existingMembers?: any[];
  onSuccess: () => void;
}

const ROLES_LIST = [
  { key: 'ACCOUNT', label: 'Account', desc: 'Quản lý & duyệt công việc nhóm' },
  { key: 'EDITOR', label: 'Editor', desc: 'Dựng phim & biên tập video' },
  { key: 'CONTENT_CREATOR', label: 'Nội dung', desc: 'Sáng tạo nội dung & bài viết' },
  { key: 'GRAPHIC_DESIGNER', label: 'Thiết kế đồ họa', desc: 'Thiết kế banner, hình ảnh' },
  { key: 'CAMERAMAN', label: 'Quay phim', desc: 'Quay hình & kỹ thuật hình ảnh' },
  { key: 'SCRIPTER', label: 'Biên kịch', desc: 'Viết kịch bản truyền thông' },
  { key: 'SOCIAL_MEDIA_MANAGER', label: 'Quản lý MXH', desc: 'Quản trị các trang MXH' },
  { key: 'SEO_SPECIALIST', label: 'Chuyên viên SEO', desc: 'Tối ưu hóa công cụ tìm kiếm' },
];

/** Nhãn vai trò hiển thị — ACCOUNT là "Account" theo Web, không dùng "Account dự án"/"Lead dự án". */
const getMemberRoleLabel = (role: string): string =>
  role === 'ACCOUNT' ? 'Account' : TEAM_MEMBER_ROLE_LABELS[role] || role;

export default function EditTeamMemberRoleModal({
  visible,
  onClose,
  teamId,
  member,
  existingLeadName,
  existingLeadUserId,
  existingMembers,
  onSuccess,
}: EditTeamMemberRoleModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['EDITOR']);
  const updateRolesMutation = useUpdateTeamMemberRolesMutation();
  const isSubmitting = updateRolesMutation.isPending;

  useEffect(() => {
    if (visible && member) {
      const initialRoles = Array.isArray(member.roles)
        ? (member.roles.map((r: any) => typeof r === 'string' ? r : r?.role).filter(Boolean) as string[])
        : (getTeamMemberRoles(member) as string[]);
      setSelectedRoles(initialRoles.length > 0 ? initialRoles : [member.role || 'EDITOR']);
    }
  }, [visible, member]);

  if (!member) return null;

  const currentMemberUserId = member.user?.id || member.userId;

  // Count how many OTHER members currently hold the ACCOUNT role in this team
  const otherAccountsCount = React.useMemo(() => {
    if (!existingMembers || !Array.isArray(existingMembers)) return 1;
    return existingMembers.filter((m: any) => {
      const uId = m.user?.id || m.userId;
      if (uId === currentMemberUserId) return false;
      const roles = Array.isArray(m.roles)
        ? m.roles.map((r: any) => (typeof r === 'string' ? r : r?.role))
        : getTeamMemberRoles(m);
      return roles.includes('ACCOUNT') || (existingLeadUserId && uId === existingLeadUserId);
    }).length;
  }, [existingMembers, currentMemberUserId, existingLeadUserId]);

  const toggleRole = (roleKey: string) => {
    if (roleKey === 'ACCOUNT' && selectedRoles.includes('ACCOUNT') && otherAccountsCount === 0) {
      Alert.alert(
        'Không thể bỏ vai trò',
        'Dự án phải có ít nhất một nhân sự giữ vai trò Account. Không thể bỏ vai trò này.'
      );
      return;
    }

    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const handleSave = async () => {
    if (!teamId || !currentMemberUserId) {
      Alert.alert('Lỗi', 'Thông tin thành viên không hợp lệ.');
      return;
    }

    if (selectedRoles.length === 0) {
      Alert.alert('Cảnh báo', 'Nhân sự phải có ít nhất một vai trò trong đội dự án.');
      return;
    }

    if (otherAccountsCount === 0 && !selectedRoles.includes('ACCOUNT')) {
      Alert.alert(
        'Không thể cập nhật',
        'Dự án phải có ít nhất một nhân sự giữ vai trò Account. Vui lòng phân công nhân sự khác trước khi bỏ vai trò này.'
      );
      return;
    }

    try {
      await updateRolesMutation.mutateAsync({
        teamId,
        userId: currentMemberUserId,
        roles: selectedRoles,
      });

      Alert.alert(
        'Thành công',
        `Đã cập nhật vai trò của ${member.user?.fullName || 'nhân sự'}.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi cập nhật vai trò.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/60 justify-end">
        <View className="bg-surface rounded-t-3xl p-4 pb-6 max-h-[90%] gap-3">
          {/* Header */}
          <View className="flex-row justify-between items-start border-b border-slate-100 pb-2.5">
            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">Cập nhật vai trò thành viên</Text>
              <Text className="text-xs text-slate-500 mt-0.5">{member.user?.fullName || 'Nhân sự'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5 rounded-full bg-slate-100" activeOpacity={0.7}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Member Card Summary */}
          <View className="flex-row items-center gap-3 bg-slate-50 rounded-xl p-3 border border-border">
            <View className="w-9 h-9 rounded-full bg-primary justify-center items-center">
              <Text className="text-sm font-bold text-white">
                {member.user?.fullName ? member.user.fullName.charAt(0).toUpperCase() : 'M'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-text-primary">{member.user?.fullName || 'Thành viên'}</Text>
              <Text className="text-xs text-slate-500">
                Vai trò đang chọn:{' '}
                <Text className="font-bold text-primary">
                  {selectedRoles.map((r) => getMemberRoleLabel(r)).join(', ') || 'Chưa chọn'}
                </Text>
              </Text>
            </View>
          </View>

          {/* Role Selection */}
          <View className="flex-row justify-between items-baseline">
            <Text className="text-xs font-bold text-slate-800">
              Chọn một hoặc nhiều vai trò
            </Text>
            <Text className="text-[11px] font-semibold text-primary">
              Đã chọn ({selectedRoles.length})
            </Text>
          </View>

          <ScrollView className="max-h-[300px]" nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {ROLES_LIST.map((roleItem) => {
                const isSelected = selectedRoles.includes(roleItem.key);

                return (
                  <TouchableOpacity
                    key={roleItem.key}
                    className={`border rounded-xl p-2.5 flex-row items-center justify-between ${
                      isSelected
                        ? 'border-primary bg-orange-50/40'
                        : 'border-border bg-slate-50/50'
                    }`}
                    onPress={() => toggleRole(roleItem.key)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text
                          className={`text-xs font-bold ${
                            isSelected
                              ? 'text-primary'
                              : 'text-slate-800'
                          }`}
                        >
                          {roleItem.label}
                        </Text>
                        {roleItem.key === 'ACCOUNT' && otherAccountsCount === 0 && isSelected && (
                          <View className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                            <Text className="text-[10px] font-bold text-amber-800">Bắt buộc giữ</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[11px] text-text-secondary mt-0.5">
                        {roleItem.desc}
                      </Text>
                    </View>

                    {/* Checkbox indicator */}
                    <View className="shrink-0 pl-1">
                      {isSelected ? (
                        <View className="w-5 h-5 rounded-md bg-primary items-center justify-center">
                          <Feather name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View className="w-5 h-5 rounded-md border border-slate-300 bg-white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View className="flex-row justify-end items-center gap-2.5 border-t border-slate-100 pt-3">
            <TouchableOpacity
              className="px-4 py-2.5 rounded-xl bg-slate-100"
              onPress={onClose}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text className="text-xs font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary ${
                selectedRoles.length === 0 || isSubmitting ? 'opacity-50' : ''
              }`}
              onPress={handleSave}
              disabled={selectedRoles.length === 0 || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="save" size={15} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Lưu vai trò</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
