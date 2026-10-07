import React, { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNavBar';
import JobCard from '@/components/jobs/JobCard';
import JobFormModal from '@/components/jobs/JobFormModal';
import { BrandColors } from '@/constants/colors';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import { JOB_CATEGORY_OPTIONS, Job } from '@/services/jobService';
import { useAuthStore } from '@/stores/useAuthStore';
import { canAccessJobs, canManageJobs, isManagementRole } from '@/utils/rbac';

const ALL_CATEGORY = 'ALL';

/**
 * Danh sách HẠNG MỤC CÔNG VIỆC (Jobs) — `/jobs`.
 * Tìm kiếm & lọc category hoàn toàn client-side (GET /jobs trả mảng thô đầy đủ quan hệ).
 *
 * ⚠️ Backend KHÔNG có roleMiddleware cho jobs ⇒ client tự chặn theo chuẩn Web
 * (`JobDetailPage.jsx:37`: `canEdit = role === 'ADMIN' || role === 'BOD'`).
 */
export default function JobsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [isFormVisible, setIsFormVisible] = useState(false);

  const hasAccess = canAccessJobs(user?.role);
  const canWriteJobs = canManageJobs(user?.role) && isManagementRole(user?.role);

  const { data, isLoading, isFetching, isError, error, refetch } = useJobsQuery();

  const jobs: Job[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filteredJobs = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      const categories = Array.isArray(job.categories) ? job.categories : [];
      if (activeCategory !== ALL_CATEGORY && !categories.includes(activeCategory)) return false;
      if (!keyword) return true;
      const name = String(job.name || '').toLowerCase();
      const code = String(job.code || '').toLowerCase();
      const nickname = String(job.nickname || '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || nickname.includes(keyword);
    });
  }, [jobs, activeCategory, searchQuery]);

  const handleJobPress = useCallback(
    (job: Job) => {
      router.push(`/jobs/${job.id}` as any);
    },
    [router],
  );

  const renderJobItem = useCallback(
    ({ item }: { item: Job }) => <JobCard job={item} onPress={handleJobPress} />,
    [handleJobPress],
  );

  if (isAuthLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8FAFC]">
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
          <Text className="text-lg font-bold text-[#0F172A]">Hạng mục công việc</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-[#F1F5F9] items-center justify-center mb-4">
            <Feather name="lock" size={36} color="#94A3B8" />
          </View>
          <Text className="text-base font-bold text-[#1E293B] mb-2">Giới hạn quyền truy cập</Text>
          <Text className="text-[13px] text-[#64748B] text-center leading-[18px]">
            Phân hệ Hạng mục công việc chỉ dành cho Ban giám đốc, Trưởng phòng, Kinh doanh và Quản lý dự án.
          </Text>
        </View>
        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
        <View className="flex-1">
          <Text className="text-lg font-bold text-[#0F172A]">Hạng mục công việc</Text>
          <Text className="text-xs text-[#64748B] mt-0.5">
            Quản lý {jobs.length} hạng mục & tiêu chí đánh giá
          </Text>
        </View>

        {canWriteJobs ? (
          <TouchableOpacity
            className="flex-row items-center gap-1 bg-primary px-3 rounded-xl min-h-[48px]"
            onPress={() => setIsFormVisible(true)}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">Thêm hạng mục</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl px-3 h-12 border border-[#E2E8F0] gap-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            className="flex-1 text-sm text-[#0F172A]"
            placeholder="Tìm theo tên hoặc mã hạng mục..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category chips */}
      <View className="bg-white border-b border-[#E2E8F0] pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {[{ value: ALL_CATEGORY, label: 'Tất cả' }, ...JOB_CATEGORY_OPTIONS].map((option) => {
            const isActive = activeCategory === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                className={
                  'px-3.5 rounded-full border min-h-[36px] justify-center ' +
                  (isActive ? 'bg-[#FFF4EA] border-[#FDCB9E]' : 'bg-[#F1F5F9] border-[#E2E8F0]')
                }
                onPress={() => setActiveCategory(option.value)}
                activeOpacity={0.75}
              >
                <Text
                  className={
                    'text-[13px] ' + (isActive ? 'font-bold text-primary' : 'font-semibold text-[#64748B]')
                  }
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Body: 4 trạng thái */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3 py-16">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-sm text-[#64748B]">Đang tải danh sách hạng mục...</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-[#FEF2F2] items-center justify-center mb-4">
            <Feather name="alert-triangle" size={32} color="#EF4444" />
          </View>
          <Text className="text-base font-bold text-[#1E293B] mb-1.5">Không tải được dữ liệu</Text>
          <Text className="text-[13px] text-[#64748B] text-center leading-[18px] mb-4">
            {(error as any)?.message || 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-primary px-4 rounded-xl min-h-[48px]"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-full bg-[#F1F5F9] items-center justify-center mb-4">
                <Feather name="briefcase" size={34} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-[#1E293B] mb-1.5">
                {searchQuery || activeCategory !== ALL_CATEGORY
                  ? 'Không tìm thấy hạng mục phù hợp'
                  : 'Chưa có hạng mục công việc nào'}
              </Text>
              <Text className="text-[13px] text-[#64748B] text-center leading-[18px]">
                {searchQuery || activeCategory !== ALL_CATEGORY
                  ? 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc category khác.'
                  : 'Nhấn "Thêm hạng mục" để tạo hạng mục công việc đầu tiên.'}
              </Text>
            </View>
          }
        />
      )}

      <JobFormModal
        visible={isFormVisible}
        job={null}
        onClose={() => setIsFormVisible(false)}
        onSuccess={() => refetch()}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}
