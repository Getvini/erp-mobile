import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import BottomNavBar from '@/components/BottomNavBar';
import { FocusBanner } from '@/components/dashboard/FocusBanner';
import { QuickActionGrid } from '@/components/dashboard/QuickActionGrid';
import { MonthYearPickerModal } from '@/components/dashboard/MonthYearPickerModal';
import { AdminDashboardView } from '@/components/dashboard/views/AdminDashboardView';
import { SalesDashboardView } from '@/components/dashboard/views/SalesDashboardView';
import { TeamLeadDashboardView } from '@/components/dashboard/views/TeamLeadDashboardView';
import { MemberDashboardView } from '@/components/dashboard/views/MemberDashboardView';
import { formatVND } from '@/utils/formatters';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { useUnreadNotificationCount } from '@/hooks/queries/useNotifications';
import {
  canAccessCustomers,
  isManagementRole,
  isSalesRole,
} from '@/utils/rbac';
import {
  useDashboardQuery,
  useMyTasksQuery,
  useAwaitingReviewTasksQuery,
} from '@/hooks/queries';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Month & Year state
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState<{ month: number | null; year: number | null }>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // Check RBAC for review queue
  const isLeadOrAdmin = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'BOD' ||
    user?.role === 'TEAM_LEAD' ||
    user?.role === 'PM'
  );

  // TanStack Query Hooks
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isRefetching: isDashboardRefetching,
    refetch: refetchDashboard,
  } = useDashboardQuery({
    month: selectedDate.month ?? undefined,
    year: selectedDate.year ?? undefined,
  });

  const {
    data: todayTasks = [],
    refetch: refetchMyTasks,
    isRefetching: isMyTasksRefetching,
  } = useMyTasksQuery();

  const {
    data: reviewTasks = [],
    refetch: refetchReviewTasks,
    isRefetching: isReviewRefetching,
  } = useAwaitingReviewTasksQuery(isLeadOrAdmin);

  const isRefetching = isDashboardRefetching || isMyTasksRefetching || isReviewRefetching;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  const handleRefresh = () => {
    refetchDashboard();
    refetchMyTasks();
    if (isLeadOrAdmin) {
      refetchReviewTasks();
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleNotificationPress = () => {
    router.push('/notifications' as any);
  };

  // Badge số thông báo chưa đọc trên header (đồng bộ realtime qua SSE).
  const { data: unreadNotificationCount = 0, refetch: refetchUnreadNotifications } =
    useUnreadNotificationCount(Boolean(user));
  useSSERefresh('invalidate_Notifications', refetchUnreadNotifications);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background gap-3">
        <ActivityIndicator size="large" color="#F38820" />
        <Text className="text-xs color-slate-400 font-bold tracking-widest uppercase">Khởi tạo hệ thống...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Determine role-based permissions & metrics
  const isAdminOrBod = isManagementRole(user?.role);
  const isSale = isSalesRole(user?.role);

  const adminMetrics = dashboardData?.admin;
  const saleMetrics = dashboardData?.sale;
  const teamLeadProjects = dashboardData?.teamLead || [];
  const memberMetrics = dashboardData?.member;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top Header Bar: User Profile Greeting & Actions */}
      <View className="flex-row justify-between items-center px-4 pt-2 pb-3.5 bg-surface border-b border-border">
        <View className="flex-row items-center flex-1 mr-3">
          <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center shadow-md">
            <Text className="text-white text-xl font-extrabold">
              {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs text-slate-500 font-medium">Xin chào,</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Text className="text-base font-bold text-text-primary flex-shrink" numberOfLines={1}>
                {user?.fullName || user?.username}
              </Text>
              <View className="bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-200">
                <Text className="text-[10px] font-bold text-primary uppercase">{user?.role || 'PM'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            className="w-[38px] h-[38px] rounded-xl bg-slate-100 items-center justify-center relative min-w-[48px] min-h-[48px]"
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={20} color="#475569" />
            {/* Unread badge — đồng bộ realtime qua SSE invalidate_Notifications */}
            {unreadNotificationCount > 0 ? (
              <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary items-center justify-center border-[1.5px] border-white">
                <Text className="text-[10px] font-bold text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            className="w-[38px] h-[38px] rounded-xl bg-red-50 items-center justify-center"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pt-4 pb-6"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            colors={['#F38820']}
            tintColor="#F38820"
          />
        }
      >
        {/* Quick Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-3.5 h-11 mb-4 shadow-xs">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 ml-2.5 text-sm text-text-primary"
            placeholder="Tìm kiếm dự án, nhiệm vụ..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Focus Banner (mirroring AdminFocusCard / TodayFocusCard on Web) */}
        <FocusBanner
          userName={user?.fullName || user?.username}
          pendingApprovalCount={reviewTasks.length}
          activeProjectCount={
            isAdminOrBod
              ? adminMetrics?.currentProjects?.length ?? adminMetrics?.activeProjects ?? teamLeadProjects.length ?? 0
              : isSale
              ? saleMetrics?.projects?.length ?? 0
              : teamLeadProjects.length || memberMetrics?.participatingProjects?.length || 0
          }
          totalDebt={
            isAdminOrBod
              ? adminMetrics?.totalDebt ?? 0
              : isSale
              ? saleMetrics?.totalDebt ?? 0
              : 0
          }
          averageProgress={68}
          isAdminOrBod={isAdminOrBod || isSale}
          onViewApprovals={() => router.push('/tasks' as any)}
          onViewProjects={() => router.push('/projects' as any)}
        />

        {/* Quick Actions Grid (8-Icon Shortcuts matching reference style) */}
        <QuickActionGrid
          userRole={user?.role}
          totalDebt={
            isAdminOrBod
              ? adminMetrics?.totalDebt ?? 0
              : isSale
              ? saleMetrics?.totalDebt ?? 0
              : 0
          }
        />

        {/* Section Header with Month/Year Switcher (mirroring MonthSelector on Web) */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-base font-extrabold text-text-primary tracking-tight">
            {isAdminOrBod
              ? 'Chỉ số điều hành'
              : isSale
              ? 'Chỉ số kinh doanh'
              : 'Tiến độ công việc'}
          </Text>

          <TouchableOpacity
            className="flex-row items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-xl border border-border shadow-xs"
            onPress={() => setIsPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Feather name="calendar" size={13} color="#F38820" />
            <Text className="text-xs font-bold text-text-primary">
              {selectedDate.month
                ? `Tháng ${selectedDate.month}, ${selectedDate.year}`
                : 'Tất cả'}
            </Text>
            <Feather name="chevron-down" size={13} color="#64748B" />
          </TouchableOpacity>
        </View>

        {isDashboardLoading && !isRefetching ? (
          <View className="flex-row items-center justify-center py-6 gap-2 bg-surface rounded-2xl border border-border mb-4">
            <ActivityIndicator size="small" color="#F38820" />
            <Text className="text-xs text-slate-500 font-medium">Đang đồng bộ dữ liệu Getvini...</Text>
          </View>
        ) : isAdminOrBod ? (
          <AdminDashboardView
            adminMetrics={adminMetrics}
            reviewTasks={reviewTasks}
            teamLeadProjects={teamLeadProjects}
            onTaskPress={(task) => router.push(`/tasks/${task.id}` as any)}
          />
        ) : isSale ? (
          <SalesDashboardView saleMetrics={saleMetrics} />
        ) : (user?.role === 'TEAM_LEAD' || user?.role === 'PM' || teamLeadProjects.length > 0) ? (
          <TeamLeadDashboardView
            teamLeadProjects={teamLeadProjects}
            reviewTasks={reviewTasks}
            todayTasks={todayTasks}
            onTaskPress={(task) => router.push(`/tasks/${task.id}` as any)}
          />
        ) : (
          <MemberDashboardView
            memberMetrics={memberMetrics}
            todayTasks={todayTasks}
            onTaskPress={(task) => router.push(`/tasks/${task.id}` as any)}
          />
        )}

      </ScrollView>

      {/* Month & Year Picker Modal */}
      <MonthYearPickerModal
        visible={isPickerVisible}
        selectedDate={selectedDate}
        onClose={() => setIsPickerVisible(false)}
        onSelect={(newDate) => setSelectedDate(newDate)}
      />

      {/* Bottom Nav Bar */}
      <BottomNavBar />
    </SafeAreaView>
  );
}

