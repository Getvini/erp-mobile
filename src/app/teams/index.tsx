import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Team } from '@/services/teamService';
import { useTeamsQuery } from '@/hooks/queries/useTeams';
import { useAuth } from '@/context/AuthContext';
import { canAccessTeams, isManagementRole } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import { safeGoBack } from '@/utils/navigation';
import TeamCard from '@/components/teams/TeamCard';
import TeamFormModal from '@/components/teams/TeamFormModal';
import BottomNavBar from '@/components/BottomNavBar';

/**
 * P3 — Danh sách đội nhóm (Cơ cấu đội nhóm).
 * Backend GET /teams trả MẢNG THÔ, không phân trang ⇒ tìm kiếm & lọc hoàn toàn client-side.
 */
export default function TeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAccess = canAccessTeams(user?.role);
  /** Nút "Tạo đội" chỉ dành cho ADMIN/BOD (backend yêu cầu teamLeadId hợp lệ). */
  const canCreateTeam = isManagementRole(user?.role);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    data: teams = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useTeamsQuery();

  const filteredTeams = useMemo<Team[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => {
      const leadFromMembers = team.teamLeadId
        ? team.members?.find((member) => member.user?.id === team.teamLeadId)?.user
        : undefined;
      const leadName = team.teamLead?.fullName || leadFromMembers?.fullName || '';
      return (
        (team.name || '').toLowerCase().includes(query) ||
        leadName.toLowerCase().includes(query)
      );
    });
  }, [teams, searchQuery]);

  const handleOpenDetail = useCallback(
    (teamId: string) => {
      router.push(`/teams/${teamId}` as any);
    },
    [router]
  );

  const renderTeam = ({ item }: { item: Team }) => (
    <TeamCard team={item} onPress={() => handleOpenDetail(item.id)} />
  );

  // ---------------------------------------------------------------------------
  // Không có quyền truy cập module
  // ---------------------------------------------------------------------------
  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
            onPress={() => safeGoBack(router, '/')}
            accessibilityLabel="Quay lại"
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-slate-900">Cơ cấu đội nhóm</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 justify-center items-center p-8 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-2">
            <Feather name="shield-off" size={36} color="#EF4444" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</Text>
          <Text className="text-[13px] text-slate-500 text-center leading-5 max-w-[280px]">
            Phân hệ Cơ cấu đội nhóm chỉ dành cho Ban quản trị (Admin/BOD), Bộ phận kinh doanh và
            Quản lý dự án.
          </Text>
          <TouchableOpacity
            className="mt-3 bg-primary px-5 min-h-[48px] justify-center rounded-xl"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-white">Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          testID="teamsBackButton"
          className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-[17px] font-bold text-slate-900">Cơ cấu đội nhóm</Text>
          <Text className="text-[11px] text-slate-500">{teams.length} đội nhóm</Text>
        </View>

        <View className="w-12" />
      </View>

      {/* Tìm kiếm client-side theo tên đội / tên Team Lead */}
      <View className="px-4 py-3 bg-white border-b border-slate-200">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 h-[48px]">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            testID="teamSearchInput"
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Tìm theo tên đội hoặc Team Lead..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Xoá tìm kiếm"
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 4 trạng thái: Loading / Error / Empty / Success */}
      {isLoading && !isFetching ? (
        <View className="flex-1 px-4 pt-4 gap-3">
          {[0, 1, 2].map((item) => (
            <View key={item} className="h-32 rounded-2xl bg-slate-200" />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Feather name="wifi-off" size={42} color="#EF4444" />
          <Text className="text-base font-bold text-slate-700">Không tải được danh sách đội nhóm</Text>
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
          testID="teamsList"
          data={filteredTeams}
          keyExtractor={(item) => item.id}
          renderItem={renderTeam}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="py-14 items-center justify-center gap-2.5">
              <Feather name="users" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">
                {searchQuery ? 'Không tìm thấy đội nhóm phù hợp' : 'Chưa có đội nhóm nào'}
              </Text>
              <Text className="text-[13px] text-slate-400 text-center max-w-[260px]">
                {searchQuery
                  ? 'Thử tìm bằng tên đội hoặc tên Team Lead khác.'
                  : canCreateTeam
                  ? 'Nhấn "Tạo đội" để thiết lập đội nhóm đầu tiên.'
                  : 'Vui lòng liên hệ Admin/BOD để thiết lập đội nhóm.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Tạo đội — chỉ ADMIN/BOD */}
      {canCreateTeam && (
        <TouchableOpacity
          testID="createTeamButton"
          className="absolute bottom-[84px] right-4 min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 shadow-lg"
          onPress={() => setIsCreateOpen(true)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Tạo đội nhóm mới"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text className="text-sm font-extrabold text-white">Tạo đội</Text>
        </TouchableOpacity>
      )}

      <TeamFormModal
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refetch}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
