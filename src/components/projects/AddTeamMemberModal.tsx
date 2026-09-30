import React, { useEffect, useState, useMemo } from 'react';
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
import { USER_ROLE } from '@/services/teamService';
import { useAvailableUsersQuery, useAddTeamMemberMutation } from '@/hooks/queries/useProjects';
import { BrandColors } from '@/constants/colors';
import { getUserRolesInTeam, getUserAccountRole } from '@/utils/teamMember';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';

export const ASSIGNABLE_ROLES = [
  { key: 'ACCOUNT', label: 'Account', desc: 'Quản lý & duyệt công việc nhóm' },
  { key: 'EDITOR', label: 'Biên tập', desc: 'Biên tập nội dung' },
  { key: 'CONTENT_CREATOR', label: 'Nội dung', desc: 'Sáng tạo nội dung & bài viết' },
  { key: 'DESIGNER', label: 'Thiết kế', desc: 'Thiết kế banner, hình ảnh' },
  { key: 'CAMERAMAN', label: 'Quay', desc: 'Quay hình & kỹ thuật hình ảnh' },
  { key: 'VIDEO_EDITOR', label: 'Dựng video', desc: 'Dựng video & hậu kỳ' },
  { key: 'SOCIAL_MEDIA_MANAGER', label: 'Quản lý MXH', desc: 'Quản trị các trang MXH' },
];

interface AddTeamMemberModalProps {
  visible: boolean;
  onClose: () => void;
  teamId: string;
  existingMemberUserIds?: string[];
  existingMembers?: any[];
  existingLeadName?: string;
  existingLeadUserId?: string;
  onSuccess: () => void;
}

export default function AddTeamMemberModal({
  visible,
  onClose,
  teamId,
  existingMemberUserIds = [],
  existingMembers = [],
  existingLeadName,
  existingLeadUserId,
  onSuccess,
}: AddTeamMemberModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['EDITOR']);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: usersData, isLoading: loadingUsers } = useAvailableUsersQuery();
  const users = usersData || [];

  const addMemberMutation = useAddTeamMemberMutation();
  const isSubmitting = addMemberMutation.isPending;

  // Filter users matching Web ERP: users who don't already have ALL roles and are not PM
  const availableUsers = useMemo(() => {
    return users.filter((u) => {
      const assigned = getUserRolesInTeam(existingMembers, u.id);
      if (assigned.includes('PROJECT_MANAGER') || assigned.includes('PM')) {
        return false;
      }
      // If user already has all 8 assignable roles, exclude
      const remainingAssignable = ASSIGNABLE_ROLES.some((r) => !assigned.includes(r.key));
      return remainingAssignable;
    });
  }, [users, existingMembers]);

  // Filtered by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const q = searchQuery.toLowerCase().trim();
    return availableUsers.filter((u) => {
      const accountRole = getUserAccountRole(u);
      const roleText = (accountRole && USER_ROLE[accountRole]) || accountRole || '';
      return (
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        roleText.toLowerCase().includes(q)
      );
    });
  }, [availableUsers, searchQuery]);

  // Roles already assigned to currently selected user
  const selectedUserExistingRoles = useMemo(() => {
    if (!selectedUserId) return [];
    return getUserRolesInTeam(existingMembers, selectedUserId);
  }, [existingMembers, selectedUserId]);

  useEffect(() => {
    if (visible) {
      setSelectedUserId('');
      setSelectedRoles(['EDITOR']);
      setSearchQuery('');
    }
  }, [visible]);

  // When user is selected, ensure default selected role is not already held
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    const existing = getUserRolesInTeam(existingMembers, userId);
    // Keep currently selected roles that user does not have yet
    const validRoles = selectedRoles.filter((r) => !existing.includes(r));
    if (validRoles.length > 0) {
      setSelectedRoles(validRoles);
    } else {
      // Pick first assignable role not yet held
      const firstAvailable = ASSIGNABLE_ROLES.find(
        (r) => !existing.includes(r.key)
      );
      setSelectedRoles(firstAvailable ? [firstAvailable.key] : []);
    }
  };

  // Toggle role in multi-selection
  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const handleAdd = async () => {
    if (!selectedUserId) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn nhân sự muốn thêm vào đội.');
      return;
    }
    if (selectedRoles.length === 0) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn ít nhất một vai trò cho nhân sự.');
      return;
    }
    if (!teamId) {
      Alert.alert('Lỗi', 'Không tìm thấy mã Đội thực hiện.');
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        teamId,
        userId: selectedUserId,
        role: selectedRoles[0],
        roles: selectedRoles,
      });

      Alert.alert('Thành công', 'Đã thêm nhân sự vào đội dự án!');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi thêm nhân sự.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/60 justify-end">
        <View className="bg-surface rounded-t-3xl max-h-[92%] p-4 pb-6 gap-3">
          {/* Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-2.5">
            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">Thêm nhân sự vào đội dự án</Text>
              <Text className="text-xs text-text-secondary mt-0.5">Chọn nhân viên công ty & phân bổ vai trò chuyên môn</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5 rounded-full bg-slate-100" activeOpacity={0.7}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body Scroll */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: User Selection */}
            <View className="gap-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-bold text-slate-800">
                  1. Chọn nhân sự ({availableUsers.length})
                </Text>
                {selectedUserId ? (
                  <Text className="text-[11px] font-semibold text-primary">Đã chọn 1 nhân sự</Text>
                ) : null}
              </View>

              {/* Search input if more than 5 users */}
              {availableUsers.length > 5 && (
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 gap-2">
                  <Feather name="search" size={14} color="#94A3B8" />
                  <TextInput
                    className="flex-1 text-xs text-text-primary p-0"
                    placeholder="Tìm theo tên, email hoặc vai trò..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x-circle" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {loadingUsers ? (
                <View className="py-5 items-center gap-2">
                  <ActivityIndicator size="small" color={BrandColors.primary} />
                  <Text className="text-xs text-text-muted">Đang tải danh sách nhân sự...</Text>
                </View>
              ) : availableUsers.length === 0 ? (
                <View className="py-5 items-center justify-center gap-1.5 bg-background rounded-xl">
                  <Feather name="users" size={24} color="#94A3B8" />
                  <Text className="text-xs text-text-secondary">Tất cả nhân sự công ty đã có đủ vai trò trong dự án.</Text>
                </View>
              ) : (
                <ScrollView
                  className="max-h-[150px]"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <View className="gap-1.5">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedUserId === user.id;
                      const existingRoles = getUserRolesInTeam(existingMembers, user.id);
                      const isAlreadyInTeam = existingRoles.length > 0;

                      return (
                        <TouchableOpacity
                          key={user.id}
                          className={`flex-row items-center justify-between py-2 px-2.5 rounded-xl border ${
                            isSelected
                              ? 'border-primary bg-orange-50/50'
                              : 'border-border bg-slate-50/50'
                          }`}
                          onPress={() => handleSelectUser(user.id)}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center gap-2.5 flex-1">
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? 'bg-primary' : 'bg-slate-200'}`}>
                              <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <View className="flex-row items-center gap-1.5 flex-wrap">
                                <Text className="text-xs font-semibold text-text-primary">{user.fullName}</Text>
                                {isAlreadyInTeam && (
                                  <View className="bg-teal-50 px-1 py-0.2 rounded border border-teal-100">
                                    <Text className="text-[9px] font-bold text-teal-700">Đã trong đội</Text>
                                  </View>
                                )}
                                <WorkloadBadge workload={user.workload} />
                              </View>
                              {(() => {
                                const accountRole = getUserAccountRole(user);
                                const roleLabel =
                                  (accountRole && USER_ROLE[accountRole]) || accountRole || user.email || 'Nhân sự';
                                return (
                                  <Text className="text-[11px] text-text-secondary">
                                    {roleLabel}
                                    {isAlreadyInTeam ? ` (${existingRoles.length} vai trò)` : ''}
                                  </Text>
                                );
                              })()}
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

            {/* Step 2: Multi-Role Selection */}
            <View className="gap-2">
              <View className="flex-row justify-between items-baseline">
                <Text className="text-xs font-bold text-slate-800">
                  2. Chọn vai trò chuyên môn trong đội
                </Text>
                <Text className="text-[11px] font-semibold text-primary">
                  {selectedRoles.length > 0 ? `Đã chọn (${selectedRoles.length})` : 'Chọn 1 hoặc nhiều vai trò'}
                </Text>
              </View>

              <Text className="text-[11px] text-text-secondary">
                Bạn có thể tick chọn nhiều vai trò cùng lúc cho nhân sự này:
              </Text>

              <View className="gap-1.5">
                {ASSIGNABLE_ROLES.map((roleItem) => {
                  const isAlreadyHeld = selectedUserExistingRoles.includes(roleItem.key);
                  const isDisabled = isAlreadyHeld;
                  const isSelected = selectedRoles.includes(roleItem.key) && !isDisabled;

                  return (
                    <TouchableOpacity
                      key={roleItem.key}
                      className={`p-2.5 rounded-xl border flex-row items-center justify-between ${
                        isSelected
                          ? 'border-primary bg-orange-50/40'
                          : isDisabled
                          ? 'border-border bg-slate-100/60 opacity-60'
                          : 'border-border bg-slate-50/50'
                      }`}
                      onPress={() => {
                        if (isAlreadyHeld) {
                          Alert.alert('Thông báo', 'Nhân sự này đã được phân công vai trò này trong dự án.');
                          return;
                        }
                        toggleRole(roleItem.key);
                      }}
                      activeOpacity={isDisabled ? 0.9 : 0.7}
                    >
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text
                            className={`text-xs font-bold ${
                              isSelected
                                ? 'text-primary'
                                : isDisabled
                                ? 'text-text-muted'
                                : 'text-slate-800'
                            }`}
                          >
                            {roleItem.label}
                          </Text>

                          {isAlreadyHeld && (
                            <View className="flex-row items-center gap-[3px] bg-slate-200 px-1.5 py-0.5 rounded">
                              <Feather name="check" size={10} color="#475569" />
                              <Text className="text-[10px] font-semibold text-slate-700">Đã có vai trò này</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-[11px] text-text-secondary mt-0.5">
                          {roleItem.desc}
                        </Text>
                      </View>

                      {/* Checkbox indicator */}
                      <View className="shrink-0 pl-1">
                        {isDisabled ? (
                          <Feather name="lock" size={16} color="#94A3B8" />
                        ) : isSelected ? (
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
                !selectedUserId || selectedRoles.length === 0 || isSubmitting ? 'opacity-50' : ''
              }`}
              onPress={handleAdd}
              disabled={!selectedUserId || selectedRoles.length === 0 || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="user-plus" size={15} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">
                    Thêm vào đội {selectedRoles.length > 0 ? `(${selectedRoles.length})` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
