import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors } from '@/constants/colors';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';
import { getTeamMemberRoles } from '@/utils/teamMember';
import { TEAM_MEMBER_ROLE_LABELS } from '@/services/teamService';
import { getWorkloadPercent } from '@/utils/workload';

export interface AssigneeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  teamMembers: Array<{
    id: string;
    role?: string;
    roles?: (string | { role?: string })[];
    user?: {
      id: string;
      fullName: string;
      email?: string;
      workload?: any;
    };
  }>;
  selectedAssigneeId: string;
  onSelect: (assigneeId: string) => void;
}

export default function AssigneeSelectorModal({
  visible,
  onClose,
  teamMembers,
  selectedAssigneeId,
  onSelect,
}: AssigneeSelectorModalProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Extract all distinct roles present in teamMembers for the filter chips
  const availableRoleFilters = useMemo(() => {
    const roleSet = new Set<string>();
    teamMembers.forEach((member) => {
      const roles = getTeamMemberRoles(member) as string[];
      roles.forEach((r) => {
        if (r && TEAM_MEMBER_ROLE_LABELS[r]) {
          roleSet.add(r);
        }
      });
    });
    return Array.from(roleSet);
  }, [teamMembers]);

  // Filtered and sorted members list
  const filteredAndSortedMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Filter
    const filtered = teamMembers.filter((member) => {
      const user = member.user;
      if (!user?.id) return false;

      const roles = (getTeamMemberRoles(member) as string[]) || [];
      const roleLabels = roles.map((r) => TEAM_MEMBER_ROLE_LABELS[r] || r).join(' ');

      // Filter by role chip
      if (selectedRoleFilter !== 'ALL') {
        if (!roles.includes(selectedRoleFilter)) {
          return false;
        }
      }

      // Filter by search query
      if (q) {
        const nameMatch = (user.fullName || '').toLowerCase().includes(q);
        const emailMatch = (user.email || '').toLowerCase().includes(q);
        const roleMatch = roleLabels.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !roleMatch) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort:
    //  - Selected user first
    //  - Workload ascending (lowest workload first)
    //  - Name alphabetical A-Z
    return [...filtered].sort((a, b) => {
      const aId = a.user?.id;
      const bId = b.user?.id;

      if (aId === selectedAssigneeId) return -1;
      if (bId === selectedAssigneeId) return 1;

      const workloadA = getWorkloadPercent(a.user?.workload);
      const workloadB = getWorkloadPercent(b.user?.workload);
      if (workloadA !== workloadB) {
        return workloadA - workloadB;
      }

      const nameA = a.user?.fullName || '';
      const nameB = b.user?.fullName || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [teamMembers, searchQuery, selectedRoleFilter, selectedAssigneeId]);

  const handleSelectMember = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(userId);
    onClose();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRoleFilter('ALL');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900/60 justify-end">
        <View
          className="bg-white rounded-t-[28px] max-h-[88%] p-5 pb-6 gap-3"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900">
                Chọn người thực hiện
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                Đội dự án ({teamMembers.length} thành viên) • Ưu tiên người ít tải
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-1.5 rounded-full bg-slate-100"
              activeOpacity={0.7}
              accessibilityLabel="Đóng bộ chọn nhân sự"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 gap-2">
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              className="flex-1 text-xs text-slate-900 p-0"
              placeholder="Tìm theo tên, email hoặc vai trò..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Feather name="x-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Role Filter Chips */}
          {availableRoleFilters.length > 0 && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedRoleFilter('ALL')}
                  activeOpacity={0.7}
                  className={`px-3 py-1.5 rounded-full border ${
                    selectedRoleFilter === 'ALL'
                      ? 'bg-primary border-primary'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selectedRoleFilter === 'ALL' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>

                {availableRoleFilters.map((roleKey) => {
                  const isSelected = selectedRoleFilter === roleKey;
                  const label = TEAM_MEMBER_ROLE_LABELS[roleKey] || roleKey;
                  return (
                    <TouchableOpacity
                      key={roleKey}
                      onPress={() => setSelectedRoleFilter(roleKey)}
                      activeOpacity={0.7}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Members List */}
          {filteredAndSortedMembers.length === 0 ? (
            <View className="py-8 items-center justify-center gap-2">
              <View className="w-12 h-12 rounded-full bg-slate-100 justify-center items-center">
                <Feather name="user-x" size={22} color="#94A3B8" />
              </View>
              <Text className="text-xs font-medium text-slate-500 text-center">
                Không tìm thấy nhân sự phù hợp với điều kiện lọc.
              </Text>
              {(searchQuery || selectedRoleFilter !== 'ALL') && (
                <TouchableOpacity
                  onPress={handleResetFilters}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-bold text-primary">
                    Xóa bộ lọc tìm kiếm
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredAndSortedMembers}
              keyExtractor={(item) => item.id || item.user?.id || ''}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              renderItem={({ item }) => {
                const uId = item.user?.id;
                if (!uId) return null;
                const isSelected = selectedAssigneeId === uId;
                const roles = getTeamMemberRoles(item) as string[];
                const roleLabel = roles
                  .map((r) => TEAM_MEMBER_ROLE_LABELS[r] || r)
                  .join(' · ');
                const initialLetter = item.user?.fullName
                  ? item.user.fullName.trim().charAt(0).toUpperCase()
                  : 'U';

                return (
                  <TouchableOpacity
                    className={`flex-row items-center gap-3 p-3 border rounded-xl ${
                      isSelected
                        ? 'border-primary bg-orange-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                    onPress={() => handleSelectMember(uId)}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View
                      className={`w-9 h-9 rounded-full justify-center items-center ${
                        isSelected ? 'bg-orange-100' : 'bg-slate-100'
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-primary' : 'text-slate-700'
                        }`}
                      >
                        {initialLetter}
                      </Text>
                    </View>

                    {/* Member Info */}
                    <View className="flex-1 justify-center min-w-0">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text
                          className={`text-[13px] font-bold ${
                            isSelected ? 'text-slate-900' : 'text-slate-800'
                          }`}
                          numberOfLines={1}
                        >
                          {item.user?.fullName}
                        </Text>
                        <WorkloadBadge workload={item.user?.workload} />
                      </View>
                      {roleLabel ? (
                        <Text
                          className="text-[11px] font-medium text-slate-500 mt-0.5"
                          numberOfLines={1}
                        >
                          {roleLabel}
                        </Text>
                      ) : null}
                    </View>

                    {/* Selection Indicator */}
                    <View className="flex-row items-center gap-1.5">
                      {isSelected ? (
                        <>
                          <Text className="text-[11px] font-bold text-primary">
                            Đang chọn
                          </Text>
                          <Feather
                            name="check-circle"
                            size={18}
                            color={BrandColors.primary}
                          />
                        </>
                      ) : (
                        <Feather name="circle" size={18} color="#CBD5E1" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
