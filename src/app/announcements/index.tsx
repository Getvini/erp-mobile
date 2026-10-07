import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORY_VALUES,
  ANNOUNCEMENT_SCOPE_LABELS,
  ANNOUNCEMENT_SCOPE_VALUES,
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_STATUS_VALUES,
  AnnouncementItem,
} from '@/services/announcementService';
import {
  useAnnouncementsQuery,
  useMarkAnnouncementReadMutation,
} from '@/hooks/queries/useAnnouncements';
import { useAuthStore } from '@/stores/useAuthStore';
import { canManageAnnouncements } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import { safeGoBack } from '@/utils/navigation';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

type FilterKey = 'category' | 'status' | 'scopeType';

const ALL_LABEL = 'Tất cả';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canManage = canManageAnnouncements(role);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [scopeType, setScopeType] = useState<string | undefined>(undefined);
  const [isFormVisible, setFormVisible] = useState(false);

  // Debounce ô tìm kiếm để không bắn request mỗi lần gõ phím.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(scopeType ? { scopeType } : {}),
    }),
    [search, category, status, scopeType],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAnnouncementsQuery(queryParams);

  const markReadMutation = useMarkAnnouncementReadMutation();

  const announcements: AnnouncementItem[] = useMemo(
    () => (data?.pages || []).flatMap((page) => page.data || []),
    [data],
  );
  const total = data?.pages?.[0]?.total ?? announcements.length;

  const handleOpen = useCallback(
    (announcement: AnnouncementItem) => {
      if (!announcement.isRead) {
        // Fire-and-forget: optimistic, không chặn điều hướng.
        markReadMutation.mutate({ id: announcement.id });
      }
      // `as any`: `.expo/types/router.d.ts` chỉ được sinh lại khi chạy `expo start`
      // (giống mọi module khác trong repo).
      router.push(`/announcements/${announcement.id}` as any);
    },
    [markReadMutation, router],
  );

  const renderAnnouncementItem = useCallback(
    ({ item }: { item: AnnouncementItem }) => (
      <AnnouncementCard announcement={item} onPress={handleOpen} />
    ),
    [handleOpen],
  );

  const toggleFilter = (key: FilterKey, value: string, current?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = current === value ? undefined : value;
    if (key === 'category') setCategory(next);
    if (key === 'status') setStatus(next);
    if (key === 'scopeType') setScopeType(next);
  };

  const resetFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSearchInput('');
    setSearch('');
    setCategory(undefined);
    setStatus(undefined);
    setScopeType(undefined);
  };

  const hasActiveFilter = Boolean(search || category || status || scopeType);

  const renderFooter = () => {
    if (announcements.length === 0) return null;

    return (
      <View className="pt-1 pb-6 items-center gap-2">
        <Text className="text-[11px] font-semibold text-slate-400">
          Hiển thị {announcements.length}/{total} thông báo
        </Text>

        {hasNextPage ? (
          <TouchableOpacity
            onPress={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-5 py-3 rounded-xl bg-white border border-primary-border min-h-[48px] items-center justify-center flex-row gap-2"
            testID="load-more-announcements"
          >
            {isFetchingNextPage ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <>
                <Feather name="chevron-down" size={15} color={BrandColors.primary} />
                <Text className="text-xs font-extrabold text-primary-dark">Tải thêm</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <Text className="text-[10px] text-slate-300 font-semibold">— Đã hết danh sách —</Text>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View className="pb-1">
      {/* Ô tìm kiếm */}
      <View className="flex-row items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 min-h-[48px]">
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          className="flex-1 text-sm text-slate-900 py-2.5"
          placeholder="Tìm theo tiêu đề hoặc nội dung..."
          placeholderTextColor="#94A3B8"
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
          testID="announcement-search-input"
        />
        {searchInput ? (
          <TouchableOpacity
            onPress={() => setSearchInput('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 3 bộ lọc chips gửi lên server */}
      <FilterChipRow
        title="Danh mục"
        values={ANNOUNCEMENT_CATEGORY_VALUES}
        labels={ANNOUNCEMENT_CATEGORY_LABELS}
        selected={category}
        onSelect={(value) => toggleFilter('category', value, category)}
      />
      <FilterChipRow
        title="Trạng thái"
        values={ANNOUNCEMENT_STATUS_VALUES}
        labels={ANNOUNCEMENT_STATUS_LABELS}
        selected={status}
        onSelect={(value) => toggleFilter('status', value, status)}
      />
      <FilterChipRow
        title="Phạm vi"
        values={ANNOUNCEMENT_SCOPE_VALUES}
        labels={ANNOUNCEMENT_SCOPE_LABELS}
        selected={scopeType}
        onSelect={(value) => toggleFilter('scopeType', value, scopeType)}
      />

      {hasActiveFilter ? (
        <TouchableOpacity
          onPress={resetFilters}
          className="self-start flex-row items-center gap-1.5 px-3 py-2 mt-1 rounded-lg bg-slate-100 border border-slate-200"
        >
          <Feather name="refresh-ccw" size={11} color="#64748B" />
          <Text className="text-[11px] font-bold text-slate-600">Xoá bộ lọc</Text>
        </TouchableOpacity>
      ) : null}

      {announcements.length > 0 ? (
        <Text className="text-[11px] font-bold text-slate-400 mt-3 uppercase">
          {total} thông báo
        </Text>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View className="py-16 items-center justify-center gap-3">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-xs font-semibold text-slate-500">Đang tải bảng tin...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View className="py-14 px-6 items-center justify-center gap-3">
          <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
            <Feather name="alert-triangle" size={24} color={BrandColors.error} />
          </View>
          <Text className="text-sm font-extrabold text-slate-800 text-center">
            Không tải được bảng tin
          </Text>
          <Text className="text-xs text-slate-500 text-center leading-5">
            {(error as Error)?.message || 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="px-5 py-3 rounded-xl bg-primary min-h-[48px] items-center justify-center mt-1"
          >
            <Text className="text-xs font-extrabold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="py-14 px-6 items-center justify-center gap-3">
        <View className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 items-center justify-center">
          <Feather name="inbox" size={24} color="#94A3B8" />
        </View>
        <Text className="text-sm font-extrabold text-slate-800 text-center">
          {hasActiveFilter ? 'Không có thông báo phù hợp' : 'Chưa có thông báo nào'}
        </Text>
        <Text className="text-xs text-slate-500 text-center leading-5">
          {hasActiveFilter
            ? 'Thử đổi từ khoá tìm kiếm hoặc bỏ bộ lọc để xem toàn bộ bảng tin.'
            : 'Khi công ty đăng thông báo mới, chúng sẽ xuất hiện tại đây.'}
        </Text>
        {hasActiveFilter ? (
          <TouchableOpacity
            onPress={resetFilters}
            className="px-5 py-3 rounded-xl bg-slate-100 border border-slate-200 min-h-[48px] items-center justify-center mt-1"
          >
            <Text className="text-xs font-extrabold text-slate-600">Xoá bộ lọc</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <View className="flex-row items-center gap-2.5 flex-1">
          <TouchableOpacity
            onPress={() => safeGoBack(router, '/')}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={18} color="#334155" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-slate-900">Bảng tin công ty</Text>
            <Text className="text-[10px] font-semibold text-slate-400">
              Thông báo nội bộ & sự kiện
            </Text>
          </View>
        </View>

        {canManage ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setFormVisible(true);
            }}
            className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-primary min-h-[44px]"
            testID="create-announcement-button"
          >
            <Feather name="plus" size={15} color="#FFFFFF" />
            <Text className="text-xs font-extrabold text-white">Soạn</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderAnnouncementItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      />

      <AnnouncementFormModal
        visible={isFormVisible}
        onClose={() => setFormVisible(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}

interface FilterChipRowProps {
  title: string;
  values: string[];
  labels: Record<string, string>;
  selected?: string;
  onSelect: (value: string) => void;
}

const FilterChipRow: React.FC<FilterChipRowProps> = ({
  title,
  values,
  labels,
  selected,
  onSelect,
}) => (
  <View className="mt-3">
    <Text className="text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
      <TouchableOpacity
        onPress={() => {
          if (selected) onSelect(selected);
        }}
        className={`px-3 py-2 rounded-xl border min-h-[38px] justify-center ${
          !selected ? 'bg-primary border-primary' : 'bg-white border-slate-200'
        }`}
      >
        <Text className={`text-[11px] font-bold ${!selected ? 'text-white' : 'text-slate-600'}`}>
          {ALL_LABEL}
        </Text>
      </TouchableOpacity>

      {values.map((value) => {
        const isActive = selected === value;
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onSelect(value)}
            className={`px-3 py-2 rounded-xl border min-h-[38px] justify-center ${
              isActive ? 'bg-primary border-primary' : 'bg-white border-slate-200'
            }`}
            testID={`filter-${title}-${value}`}
          >
            <Text className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
              {labels[value] || value}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
