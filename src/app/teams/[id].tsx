import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TeamMemberEntry } from '@/services/teamService';
import {
  useDeleteTeamMutation,
  useRemoveTeamMemberMutation,
  useTeamDetailQuery,
  useTeamMembersByTeamQuery,
} from '@/hooks/queries/useTeams';
import { useAuth } from '@/context/AuthContext';
import { canAccessTeams, isManagementRole } from '@/utils/rbac';
import { getTeamMemberRoles } from '@/utils/teamMember';
import {
  TEAM_MEMBER_ROLE_LABELS,
  canRemoveMember,
  normalizeRoles,
} from '@/utils/teamMemberRoles';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { BrandColors } from '@/constants/colors';
import { safeGoBack } from '@/utils/navigation';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';
import TeamFormModal from '@/components/teams/TeamFormModal';
import TeamMemberModal from '@/components/teams/TeamMemberModal';

/**
 * P3 — Chi tiết đội nhóm: header đội + Team Lead, danh sách thành viên (vai trò + workload),
 * thêm/gỡ thành viên, đổi Team Lead, sửa/xóa đội.
 *
 * RBAC:
 * - Xem: canAccessTeams.
 * - Sửa thành viên: ADMIN/BOD hoặc PM có membership PROJECT_MANAGER trong CHÍNH đội này.
 * - Không cho sửa chính mình; không cho đụng thành viên đang giữ PROJECT_MANAGER.
 * - Đổi Team Lead / Xóa đội: chỉ ADMIN/BOD (PUT /teams/:id/lead trả 403 với PM).
 */
export default function TeamDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const teamId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const { user } = useAuth();
  const hasAccess = canAccessTeams(user?.role);
  const isAdminOrBod = isManagementRole(user?.role);

  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isChangeLeadOpen, setIsChangeLeadOpen] = useState(false);
  const [memberModal, setMemberModal] = useState<{
    visible: boolean;
    mode: 'add' | 'edit';
    member: TeamMemberEntry | null;
  }>({ visible: false, mode: 'add', member: null });

  const {
    data: team,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useTeamDetailQuery(teamId);

  const period = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const {
    data: fetchedMembers = [],
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
  } = useTeamMembersByTeamQuery(teamId, period);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchMembers();
  }, [refetch, refetchMembers]);

  const members = useMemo<TeamMemberEntry[]>(() => {
    if (fetchedMembers.length > 0) return fetchedMembers;
    return Array.isArray(team?.members) ? team.members : [];
  }, [fetchedMembers, team]);

  const deleteMutation = useDeleteTeamMutation();
  const removeMemberMutation = useRemoveTeamMemberMutation();

  /** PM chỉ được quản lý thành viên khi chính họ giữ vai trò PROJECT_MANAGER trong đội này. */
  const isProjectManagerOfTeam = useMemo(() => {
    if (!user?.id) return false;
    return members.some(
      (member) =>
        (member.user?.id || member.userId) === user.id &&
        (getTeamMemberRoles(member) as string[]).includes('PROJECT_MANAGER')
    );
  }, [members, user]);

  const canManageMembers = isAdminOrBod || (user?.role === 'PM' && isProjectManagerOfTeam);

  const leadName =
    team?.teamLead?.fullName ||
    members.find((member) => member.user?.id === team?.teamLeadId)?.user?.fullName ||
    'Chưa phân công';

  const handleRemoveMember = (member: TeamMemberEntry) => {
    const guard = canRemoveMember(members, member, team?.teamLeadId);
    if (!guard.allowed) {
      Alert.alert('Không thể gỡ thành viên', guard.message || 'Thao tác không được phép.');
      return;
    }

    const name = member.user?.fullName || 'nhân sự này';
    Alert.alert('Xác nhận gỡ thành viên', `Bạn chắc chắn muốn gỡ ${name} khỏi đội?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberMutation.mutateAsync({ teamId, memberId: member.id });
            Alert.alert('Thành công', `Đã gỡ ${name} khỏi đội.`);
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi gỡ thành viên.');
          }
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      'Xóa đội nhóm',
      `Bạn chắc chắn muốn xóa đội "${team?.name || ''}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(teamId);
              Alert.alert('Thành công', 'Đã xóa đội nhóm.');
              router.replace('/teams' as any);
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi xóa đội.');
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item }: { item: TeamMemberEntry }) => {
    const memberUserId = item.user?.id || item.userId || '';
    const leadUserId = team?.teamLeadId || '';
    const isSelf = Boolean(user?.id) && memberUserId === user?.id;
    const isLead = memberUserId !== '' && memberUserId === leadUserId;
    const isProjectManager = (getTeamMemberRoles(item) as string[]).includes('PROJECT_MANAGER');
    const roles = normalizeRoles(getTeamMemberRoles(item));
    const canActOnMember = canManageMembers && !isSelf && !isProjectManager;

    return (
      <View
        testID={`teamMember-${item.id}`}
        className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm"
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-orange-50 border border-primary-border items-center justify-center mr-3">
            <Text className="text-sm font-extrabold text-primary">
              {item.user?.fullName ? item.user.fullName.charAt(0).toUpperCase() : 'M'}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                {item.user?.fullName || 'Nhân sự'}
              </Text>
              {isLead && (
                <View className="bg-primary px-1.5 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-white">TEAM LEAD</Text>
                </View>
              )}
              {isSelf && (
                <View className="bg-slate-200 px-1.5 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-slate-700">BẠN</Text>
                </View>
              )}
              <WorkloadBadge workload={item.user?.workload} />
            </View>
            {item.user?.phoneNumber ? (
              <Text className="text-[11px] text-slate-500 mt-0.5">{item.user.phoneNumber}</Text>
            ) : null}
          </View>
        </View>

        {roles.length > 0 && (
          <View className="flex-row items-center flex-wrap gap-1.5 mt-2.5">
            {roles.map((role) => (
              <View
                key={role}
                className="bg-orange-50 border border-primary-border px-2 py-0.5 rounded-lg"
              >
                <Text className="text-[11px] font-semibold text-primary">
                  {TEAM_MEMBER_ROLE_LABELS[role] || role}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Chỉ hiện nút khi đủ quyền: không sửa chính mình, không đụng PROJECT_MANAGER */}
        {canActOnMember && (
          <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <TouchableOpacity
              testID={`editMemberRoles-${item.id}`}
              className="flex-row items-center gap-1.5 px-3 min-h-[48px] justify-center rounded-xl bg-orange-50 border border-primary-border"
              onPress={() => setMemberModal({ visible: true, mode: 'edit', member: item })}
              activeOpacity={0.75}
            >
              <Feather name="edit-2" size={13} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary">Sửa vai trò</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`removeMember-${item.id}`}
              className="flex-row items-center gap-1.5 px-3 min-h-[48px] justify-center rounded-xl bg-red-50 border border-red-100"
              onPress={() => handleRemoveMember(item)}
              activeOpacity={0.75}
            >
              <Feather name="user-minus" size={13} color="#EF4444" />
              <Text className="text-xs font-bold text-red-500">Gỡ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const listHeader = (
    <View className="gap-3">
      {/* Thẻ đội */}
      <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-xl bg-orange-50 border border-primary-border items-center justify-center mr-3">
            <Feather name="users" size={22} color={BrandColors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-slate-900" numberOfLines={1}>
              {team?.name || 'Đội nhóm'}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Feather name="user-check" size={12} color="#64748B" />
              <Text className="text-xs text-slate-500 flex-1" numberOfLines={1}>
                Team Lead: {leadName}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <View className="flex-row items-center gap-1">
            <Feather name="users" size={12} color="#475569" />
            <Text className="text-[11px] font-bold text-slate-600">
              {members.length} thành viên
            </Text>
          </View>
          {team?.createdAt ? (
            <View className="flex-row items-center gap-1">
              <Feather name="calendar" size={12} color="#475569" />
              <Text className="text-[11px] font-semibold text-slate-500">
                Tạo ngày {formatDateToDDMMYYYY(team.createdAt)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Hành động chính */}
        <View className="flex-row flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {canManageMembers && (
            <TouchableOpacity
              testID="addTeamMemberButton"
              className="flex-row items-center gap-1.5 px-3.5 min-h-[48px] justify-center rounded-xl bg-primary"
              onPress={() => setMemberModal({ visible: true, mode: 'add', member: null })}
              activeOpacity={0.8}
            >
              <Feather name="user-plus" size={15} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Thêm thành viên</Text>
            </TouchableOpacity>
          )}

          {isAdminOrBod && (
            <TouchableOpacity
              testID="changeTeamLeadButton"
              className="flex-row items-center gap-1.5 px-3.5 min-h-[48px] justify-center rounded-xl bg-orange-50 border border-primary-border"
              onPress={() => setIsChangeLeadOpen(true)}
              activeOpacity={0.8}
            >
              <Feather name="user-check" size={15} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary">Đổi Team Lead</Text>
            </TouchableOpacity>
          )}

          {canManageMembers && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 px-3.5 min-h-[48px] justify-center rounded-xl bg-slate-100"
              onPress={() => setIsEditTeamOpen(true)}
              activeOpacity={0.8}
            >
              <Feather name="edit-3" size={15} color="#475569" />
              <Text className="text-xs font-bold text-slate-600">Sửa đội</Text>
            </TouchableOpacity>
          )}

          {isAdminOrBod && (
            <TouchableOpacity
              testID="deleteTeamButton"
              className="flex-row items-center gap-1.5 px-3.5 min-h-[48px] justify-center rounded-xl bg-red-50 border border-red-100"
              onPress={handleDeleteTeam}
              activeOpacity={0.8}
            >
              <Feather name="trash-2" size={15} color="#EF4444" />
              <Text className="text-xs font-bold text-red-500">Xóa đội</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-row items-center justify-between px-1">
        <Text className="text-sm font-bold text-slate-800">Thành viên đội</Text>
        {canManageMembers && !isAdminOrBod && (
          <Text className="text-[11px] font-semibold text-slate-500">Quyền: Quản lý dự án</Text>
        )}
      </View>

      {isLoadingMembers && members.length === 0 && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color={BrandColors.primary} />
        </View>
      )}
    </View>
  );

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
            onPress={() => safeGoBack(router, '/teams')}
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Chi tiết đội nhóm</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 justify-center items-center p-8 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-2">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="text-[13px] text-slate-500 text-center leading-5 max-w-[280px]">
            Bạn không có quyền xem cơ cấu đội nhóm này.
          </Text>
          <TouchableOpacity
            className="mt-3 bg-primary px-5 min-h-[48px] justify-center rounded-xl"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          testID="teamDetailBackButton"
          className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
          onPress={() => safeGoBack(router, '/teams')}
          activeOpacity={0.7}
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900 flex-1 text-center" numberOfLines={1}>
          {team?.name || 'Chi tiết đội nhóm'}
        </Text>

        <View className="w-12" />
      </View>

      {isLoading ? (
        <View className="flex-1 px-4 pt-4 gap-3">
          <View className="h-40 rounded-2xl bg-slate-200" />
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-24 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được thông tin đội</Text>
          <Text className="text-xs text-slate-500 text-center">
            {error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] justify-center rounded-xl bg-primary px-5"
            onPress={() => refetch()}
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="teamMembersList"
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="py-12 items-center justify-center gap-2.5">
              <Feather name="user-x" size={40} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">
                Đội chưa có thành viên nào
              </Text>
              <Text className="text-[13px] text-slate-400 text-center max-w-[260px]">
                {canManageMembers
                  ? 'Nhấn "Thêm thành viên" để phân bổ nhân sự và vai trò cho đội.'
                  : 'Vui lòng liên hệ Admin/BOD hoặc Quản lý dự án của đội để phân bổ nhân sự.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Sửa đội (name + Team Lead) */}
      <TeamFormModal
        visible={isEditTeamOpen}
        onClose={() => setIsEditTeamOpen(false)}
        team={team || null}
        onSuccess={handleRefresh}
      />

      {/* Đổi Team Lead (chỉ ADMIN/BOD) */}
      <TeamFormModal
        visible={isChangeLeadOpen}
        onClose={() => setIsChangeLeadOpen(false)}
        team={team || null}
        leadOnly
        onSuccess={handleRefresh}
      />

      {/* Thêm / sửa vai trò thành viên */}
      <TeamMemberModal
        visible={memberModal.visible}
        onClose={() => setMemberModal((prev) => ({ ...prev, visible: false }))}
        mode={memberModal.mode}
        team={team || { id: teamId, name: '' }}
        member={memberModal.member}
        members={members}
        onSuccess={handleRefresh}
      />
    </SafeAreaView>
  );
}
