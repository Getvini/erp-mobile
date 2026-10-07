import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationItem } from '@/services/notificationService';
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_ORDER,
  NotificationCategory,
  countNotificationsByCategory,
  filterNotifications,
  getNotificationCategory,
  getNotificationCategoryIcon,
  resolveNotificationDeepLink,
} from '@/utils/notificationPresenter';
import { BrandColors } from '@/constants/colors';
import BottomNavBar from '@/components/BottomNavBar';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '@/hooks/queries/useNotifications';
import { formatDateTimeToDDMMYYYYHHMM } from '@/utils/formatters';
import * as Haptic from 'expo-haptics';

import { safeGoBack } from '@/utils/navigation';

type NotificationFilter = 'all' | NotificationCategory;

export default function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const {
    data: notifications = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useNotificationsQuery();

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const categoryCounts = useMemo(
    () => countNotificationsByCategory(notifications),
    [notifications],
  );
  const filtered = useMemo(
    () => filterNotifications(notifications, filter),
    [notifications, filter],
  );

  const handleRefresh = () => {
    refetch();
  };

  const handleMarkAllRead = async () => {
    Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0) return;
    try {
      await markAllReadMutation.mutateAsync(unreadIds);
    } catch {
      // Lỗi đã được rollback optimistic trong hook; im lặng để không chặn UI.
    }
  };

  const handleItemPress = async (item: NotificationItem) => {
    Haptic.selectionAsync();

    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }

    // Quality Gate 12: deep link mở đúng màn hình chi tiết.
    const deepLink = resolveNotificationDeepLink(item);
    if (deepLink) {
      router.push(deepLink as any);
    }
  };

  const formatDate = (dateStr: string) => formatDateTimeToDDMMYYYYHHMM(dateStr, dateStr);

  const renderNotifItem = ({ item }: { item: NotificationItem }) => {
    const category = getNotificationCategory(item.type, item.relatedEntityType);
    const icon = getNotificationCategoryIcon(category);
    const hasDeepLink = Boolean(resolveNotificationDeepLink(item));

    return (
      <TouchableOpacity
        className={`p-4 rounded-2xl border mb-3 flex-row items-start gap-3.5 ${
          item.isRead ? 'bg-white border-slate-200' : 'bg-blue-50/50 border-blue-200'
        }`}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.75}
      >
        <View className={`w-10 h-10 rounded-xl ${icon.bg} items-center justify-center`}>
          <Feather name={icon.name as any} size={20} color={icon.color} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className={`text-sm flex-1 mr-2 ${
                item.isRead ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
              }`}
            >
              {item.title}
            </Text>
            {!item.isRead && <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
          </View>

          <Text className="text-xs text-slate-600 leading-4 mb-2">{item.message}</Text>

          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-medium text-slate-400">
              {formatDate(item.createdAt)}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="px-1.5 py-0.5 rounded bg-slate-100">
                <Text className="text-[10px] font-bold text-slate-500">
                  {NOTIFICATION_CATEGORY_LABELS[category]}
                </Text>
              </View>
              {hasDeepLink && <Feather name="chevron-right" size={14} color="#94A3B8" />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterChip = (key: NotificationFilter, label: string, count: number) => {
    const isActive = filter === key;
    return (
      <TouchableOpacity
        key={key}
        className={`px-3.5 py-2 rounded-xl border min-h-[38px] items-center justify-center ${
          isActive ? 'bg-slate-900 border-slate-900' : 'bg-slate-100 border-slate-200'
        }`}
        onPress={() => setFilter(key)}
        activeOpacity={0.7}
      >
        <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[48px] min-h-[48px]"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">Trung tâm Thông báo</Text>

        {unreadCount > 0 ? (
          <TouchableOpacity
            className="px-2.5 py-1.5 rounded-lg bg-blue-50 min-h-[48px] justify-center"
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <Text className="text-xs font-bold text-blue-600">Đọc tất cả</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
      </View>

      {/* Filter Tabs — phân loại Công việc / Tài chính / Bảng tin */}
      <View className="bg-white border-b border-slate-200 py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {renderFilterChip('all', 'Tất cả', notifications.length)}
          {NOTIFICATION_CATEGORY_ORDER.map((category) => {
            const stats = categoryCounts.find((entry) => entry.category === category);
            return renderFilterChip(
              category,
              NOTIFICATION_CATEGORY_LABELS[category],
              stats?.total ?? 0,
            );
          })}
        </ScrollView>
      </View>

      {/* Content List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-xs text-slate-400">Đang đồng bộ thông báo...</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center gap-2.5 px-8">
          <Ionicons name="cloud-offline-outline" size={48} color="#FCA5A5" />
          <Text className="text-base font-bold text-slate-700">Không tải được thông báo</Text>
          <Text className="text-xs text-slate-400 text-center">
            {(error as Error)?.message || 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity
            className="mt-2 px-4 py-2.5 rounded-xl min-h-[48px] justify-center"
            style={{ backgroundColor: BrandColors.primary }}
            onPress={() => refetch()}
          >
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderNotifItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={handleRefresh}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="py-16 items-center justify-center gap-2.5">
              <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Không có thông báo nào</Text>
              <Text className="text-xs text-slate-400 text-center max-w-[240px]">
                {filter === 'all'
                  ? 'Hệ thống chưa ghi nhận thông báo mới.'
                  : `Chưa có thông báo thuộc nhóm ${NOTIFICATION_CATEGORY_LABELS[filter]}.`}
              </Text>
            </View>
          }
        />
      )}

      <BottomNavBar />
    </SafeAreaView>
  );
}
