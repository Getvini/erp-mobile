import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Team, TeamMemberEntry } from '@/services/teamService';
import { TEAM_MEMBER_ROLE_LABELS } from '@/utils/teamMemberRoles';
import { getTeamMemberRoles, sortRoles } from '@/utils/teamMember';

interface TeamCardProps {
  team: Team;
  onPress: () => void;
}

/** Số chip vai trò tối đa hiển thị trên card, phần dư gộp thành "+n". */
const MAX_VISIBLE_ROLES = 3;

/**
 * Card đội nhóm trong danh sách `teams/index`:
 * tên đội, Team Lead (kèm avatar chữ cái), số thành viên và các vai trò có trong đội.
 */
export default function TeamCard({ team, onPress }: TeamCardProps) {
  const members: TeamMemberEntry[] = Array.isArray(team.members) ? team.members : [];

  const leadFromMembers = team.teamLeadId
    ? members.find((member) => member.user?.id === team.teamLeadId)?.user
    : undefined;
  const lead = team.teamLead || leadFromMembers;
  const leadName = lead?.fullName || 'Chưa phân công Team Lead';
  const leadInitial = lead?.fullName ? lead.fullName.charAt(0).toUpperCase() : '?';

  const roleKeys: string[] = [];
  members.forEach((member) => {
    (getTeamMemberRoles(member) as string[]).forEach((role) => {
      if (role && !roleKeys.includes(role)) roleKeys.push(role);
    });
  });
  const orderedRoles = sortRoles(roleKeys);
  const visibleRoles = orderedRoles.slice(0, MAX_VISIBLE_ROLES);
  const hiddenRoleCount = orderedRoles.length - visibleRoles.length;

  return (
    <TouchableOpacity
      testID={`teamCard-${team.id}`}
      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Đội ${team.name}, ${members.length} thành viên`}
    >
      {/* Header: Team Lead avatar + tên đội */}
      <View className="flex-row items-center">
        <View className="w-[42px] h-[42px] rounded-xl bg-orange-50 border border-primary-border items-center justify-center mr-3">
          <Text className="text-lg font-extrabold text-primary">{leadInitial}</Text>
        </View>

        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
            {team.name}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Feather name="user-check" size={12} color="#64748B" />
            <Text className="text-xs text-slate-500 flex-1" numberOfLines={1}>
              Team Lead: {leadName}
            </Text>
          </View>
        </View>

        <Feather name="chevron-right" size={20} color="#CBD5E1" />
      </View>

      {/* Footer: số thành viên + chips vai trò */}
      <View className="flex-row items-center flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
        <View className="flex-row items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg min-h-[32px]">
          <Feather name="users" size={12} color="#475569" />
          <Text className="text-[11px] font-bold text-slate-600">
            {members.length} thành viên
          </Text>
        </View>

        {visibleRoles.map((role) => (
          <View
            key={role}
            className="bg-orange-50 border border-primary-border px-2 py-1 rounded-lg min-h-[32px] justify-center"
          >
            <Text className="text-[11px] font-semibold text-primary">
              {TEAM_MEMBER_ROLE_LABELS[role] || role}
            </Text>
          </View>
        ))}

        {hiddenRoleCount > 0 && (
          <View className="bg-slate-100 px-2 py-1 rounded-lg min-h-[32px] justify-center">
            <Text className="text-[11px] font-bold text-slate-500">+{hiddenRoleCount}</Text>
          </View>
        )}

        {orderedRoles.length === 0 && (
          <Text className="text-[11px] text-slate-400">Chưa phân vai trò</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
