import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { RichTextContent } from '@/components/announcements/RichTextContent';
import { AnnouncementComments } from '@/components/announcements/AnnouncementComments';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import { DocumentCard } from '@/components/common/DocumentCard';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import {
  ANNOUNCEMENT_CATEGORY_THEMES,
  ANNOUNCEMENT_PRIORITY_THEMES,
  ANNOUNCEMENT_STATUS_THEMES,
  AnnouncementItem,
  AnnouncementMedia,
  getAnnouncementCategoryLabel,
  getAnnouncementDeleteMessage,
  getAnnouncementPriorityLabel,
  getAnnouncementScopeLabel,
  getAnnouncementStatusLabel,
} from '@/services/announcementService';
import {
  useAnnouncementDetailQuery,
  useDeleteAnnouncementMutation,
  useMarkAnnouncementReadMutation,
} from '@/hooks/queries/useAnnouncements';
import { useAuthStore } from '@/stores/useAuthStore';
import { canManageAnnouncements } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '@/utils/formatters';
import { safeGoBack } from '@/utils/navigation';
import { extractMediaFromHtml } from '@/utils/htmlText';

const RECIPIENT_DISPLAY_LIMIT = 50;
const DEFAULT_THEME = { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };

/** Bỏ thẻ media khỏi HTML để không lặp lại nội dung với khối media riêng. */
const stripMediaTags = (html?: string): string => {
  if (!html) return '';
  return String(html).replace(/<\s*(img|video)\b[^<>]*>/gi, '');
};

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const announcementId = typeof id === 'string' ? id : '';
  const router = useRouter();

  const role = useAuthStore((state) => state.user?.role);
  const canManage = canManageAnnouncements(role);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('');
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const [isFormVisible, setFormVisible] = useState(false);

  const {
    data: announcement,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAnnouncementDetailQuery(announcementId);

  const markReadMutation = useMarkAnnouncementReadMutation();
  const deleteMutation = useDeleteAnnouncementMutation();

  // Chỉ đánh dấu đã đọc MỘT lần cho mỗi thông báo khi vào màn.
  const markedReadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!announcement?.id) return;
    if (announcement.isRead) return;
    if (markedReadRef.current === announcement.id) return;

    markedReadRef.current = announcement.id;
    markReadMutation.mutate({ id: announcement.id });
    // markReadMutation là stable theo TanStack Query; chỉ chạy lại khi đổi thông báo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement?.id, announcement?.isRead]);

  const handlePreviewDocument = useCallback((url: string, fileName?: string) => {
    setPreviewUrl(url);
    setPreviewName(fileName || '');
    setPreviewVisible(true);
  }, []);

  const handleDelete = () => {
    if (!announcement) return;

    const isSent = announcement.status === 'SENT';
    Alert.alert(
      isSent ? 'Huỷ thông báo đã gửi' : 'Xoá thông báo',
      isSent
        ? 'Thông báo đã gửi sẽ KHÔNG bị xoá vĩnh viễn. Hệ thống chỉ chuyển trạng thái sang "Đã huỷ". Bạn có chắc chắn?'
        : 'Thông báo nháp sẽ bị xoá vĩnh viễn và không thể khôi phục. Bạn có chắc chắn?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: isSent ? 'Huỷ thông báo' : 'Xoá vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              const result = await deleteMutation.mutateAsync(announcement.id);
              const message = result
                ? getAnnouncementDeleteMessage(result)
                : isSent
                  ? 'Đã huỷ thông báo.'
                  : 'Đã xoá thông báo.';
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert('Hoàn tất', message, [
                { text: 'OK', onPress: () => safeGoBack(router, '/announcements') },
              ]);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert('Lỗi', err?.message || 'Không thể xoá thông báo.');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-xs font-semibold text-slate-500 mt-3">
          Đang tải thông báo...
        </Text>
      </SafeAreaView>
    );
  }

  if (isError || !announcement) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity
            onPress={() => safeGoBack(router, '/announcements')}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Feather name="arrow-left" size={18} color="#334155" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
            <Feather name="alert-triangle" size={24} color={BrandColors.error} />
          </View>
          <Text className="text-sm font-extrabold text-slate-800 text-center">
            Không xem được thông báo
          </Text>
          <Text className="text-xs text-slate-500 text-center leading-5">
            {(error as Error)?.message || 'Thông báo không tồn tại hoặc bạn không có quyền xem.'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="px-5 py-3 rounded-xl bg-primary min-h-[48px] items-center justify-center mt-1"
          >
            <Text className="text-xs font-extrabold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryTheme = ANNOUNCEMENT_CATEGORY_THEMES[announcement.category] || DEFAULT_THEME;
  const priorityTheme =
    ANNOUNCEMENT_PRIORITY_THEMES[announcement.priority || 'NORMAL'] || DEFAULT_THEME;
  const statusTheme = ANNOUNCEMENT_STATUS_THEMES[announcement.status] || DEFAULT_THEME;

  const mediaItems: AnnouncementMedia[] = (() => {
    const fromField = Array.isArray(announcement.mediaUrls) ? announcement.mediaUrls : [];
    if (fromField.length > 0) return fromField;
    return extractMediaFromHtml(announcement.content);
  })();

  const images = mediaItems.filter((item) => item.type === 'image');
  const videos = mediaItems.filter((item) => item.type === 'video');

  const hasRecipientStats =
    typeof announcement.totalRecipients === 'number' || Array.isArray(announcement.recipients);
  const totalRecipients = announcement.totalRecipients ?? announcement.recipients?.length ?? 0;
  const readCount = announcement.readCount ?? 0;
  const unreadCount =
    typeof announcement.unreadCount === 'number'
      ? announcement.unreadCount
      : Math.max(totalRecipients - readCount, 0);
  const readRate =
    typeof announcement.readRate === 'number'
      ? announcement.readRate
      : totalRecipients > 0
        ? Math.round((readCount / totalRecipients) * 100)
        : 0;

  const recipients = announcement.recipients || [];
  const visibleRecipients = recipients.slice(0, RECIPIENT_DISPLAY_LIMIT);
  const hiddenRecipientCount = recipients.length - visibleRecipients.length;

  const isSent = announcement.status === 'SENT';
  const canEdit = canManage && announcement.status !== 'SENT';

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          onPress={() => safeGoBack(router, '/announcements')}
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color="#334155" />
        </TouchableOpacity>

        <Text className="text-sm font-extrabold text-slate-900 flex-1 mx-3" numberOfLines={1}>
          Chi tiết thông báo
        </Text>

        {canManage ? (
          <View className="flex-row items-center gap-2">
            {canEdit ? (
              <TouchableOpacity
                onPress={() => setFormVisible(true)}
                className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border items-center justify-center"
                testID="edit-announcement-button"
              >
                <Feather name="edit-2" size={16} color={BrandColors.primaryDark} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 items-center justify-center"
              testID="delete-announcement-button"
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color={BrandColors.error} />
              ) : (
                <Feather name="trash-2" size={16} color="#EF4444" />
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* Tiêu đề + badges */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4">
          <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
            <View
              style={{ backgroundColor: categoryTheme.bg, borderColor: categoryTheme.border }}
              className="px-2 py-0.5 rounded-md border"
            >
              <Text style={{ color: categoryTheme.text }} className="text-[10px] font-extrabold">
                {getAnnouncementCategoryLabel(announcement.category)}
              </Text>
            </View>
            <View
              style={{ backgroundColor: priorityTheme.bg, borderColor: priorityTheme.border }}
              className="px-2 py-0.5 rounded-md border flex-row items-center gap-1"
            >
              <Feather name="flag" size={9} color={priorityTheme.text} />
              <Text style={{ color: priorityTheme.text }} className="text-[10px] font-extrabold">
                {getAnnouncementPriorityLabel(announcement.priority)}
              </Text>
            </View>
            <View
              style={{ backgroundColor: statusTheme.bg, borderColor: statusTheme.border }}
              className="px-2 py-0.5 rounded-md border"
            >
              <Text style={{ color: statusTheme.text }} className="text-[10px] font-extrabold">
                {getAnnouncementStatusLabel(announcement.status)}
              </Text>
            </View>
          </View>

          <Text className="text-lg font-extrabold text-slate-900 leading-6">
            {announcement.title}
          </Text>

          {/* Khối meta */}
          <View className="mt-3 pt-3 border-t border-slate-100 gap-1.5">
            <MetaRow
              icon="user"
              label="Người tạo"
              value={announcement.createdBy?.fullName || 'Hệ thống'}
            />
            <MetaRow
              icon="clock"
              label="Thời gian"
              value={formatDateTimeToDDMMYYYYHHMM(announcement.createdAt)}
            />
            <MetaRow
              icon="users"
              label="Phạm vi"
              value={getAnnouncementScopeLabel(announcement.scopeType)}
            />
            {announcement.eventStartAt || announcement.eventEndAt || announcement.eventLocation ? (
              <MetaRow
                icon="calendar"
                label="Sự kiện"
                value={[
                  announcement.eventStartAt
                    ? `Từ ${formatDateTimeToDDMMYYYYHHMM(announcement.eventStartAt)}`
                    : null,
                  announcement.eventEndAt
                    ? `đến ${formatDateTimeToDDMMYYYYHHMM(announcement.eventEndAt)}`
                    : null,
                  announcement.eventLocation ? `@ ${announcement.eventLocation}` : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ) : null}
          </View>
        </View>

        {/* Nội dung rich text */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
              <Feather name="file-text" size={14} color={BrandColors.primary} />
            </View>
            <Text className="text-sm font-extrabold text-slate-900">Nội dung</Text>
          </View>
          <RichTextContent html={stripMediaTags(announcement.content)} />
        </View>

        {/* Hình ảnh */}
        {images.length > 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="image" size={14} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-extrabold text-slate-900">
                Hình ảnh ({images.length})
              </Text>
            </View>
            <View className="flex-row flex-wrap -m-1">
              {images.map((media, index) => (
                <View key={`${media.url}-${index}`} className="w-1/2 p-1">
                  <Image
                    source={{ uri: media.url }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Video (mở bằng trình phát ngoài) */}
        {videos.length > 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="video" size={14} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-extrabold text-slate-900">
                Video ({videos.length})
              </Text>
            </View>
            <View className="gap-2">
              {videos.map((media, index) => (
                <TouchableOpacity
                  key={`${media.url}-${index}`}
                  onPress={() => Linking.openURL(media.url).catch(() => undefined)}
                  className="flex-row items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[48px]"
                >
                  <View className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 items-center justify-center">
                    <Feather name="play" size={15} color="#EF4444" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                      {media.name || 'Video đính kèm'}
                    </Text>
                    <Text className="text-[10px] text-primary font-bold mt-0.5">
                      Mở bằng trình phát bên ngoài
                    </Text>
                  </View>
                  <Feather name="external-link" size={14} color="#64748B" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Tệp đính kèm */}
        {announcement.attachmentUrl ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="paperclip" size={14} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-extrabold text-slate-900">Tệp đính kèm</Text>
            </View>
            <DocumentCard url={announcement.attachmentUrl} onPreview={handlePreviewDocument} />
          </View>
        ) : null}

        {/* Thống kê đọc — chỉ khi backend trả dữ liệu (manager/người tạo) */}
        {hasRecipientStats ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="bar-chart-2" size={14} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-extrabold text-slate-900">Thống kê đọc</Text>
            </View>

            <View className="flex-row gap-2">
              <StatBox label="Người nhận" value={String(totalRecipients)} tone="slate" />
              <StatBox label="Đã đọc" value={String(readCount)} tone="green" />
              <StatBox label="Chưa đọc" value={String(unreadCount)} tone="amber" />
            </View>

            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-[11px] font-bold text-slate-500">Tỷ lệ đã đọc</Text>
                <Text className="text-[11px] font-extrabold text-primary-dark">{readRate}%</Text>
              </View>
              <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <View
                  style={{ width: `${Math.min(Math.max(readRate, 0), 100)}%` }}
                  className="h-2 rounded-full bg-primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Danh sách người nhận */}
        {visibleRecipients.length > 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="user-check" size={14} color={BrandColors.primary} />
              </View>
              <Text className="text-sm font-extrabold text-slate-900">
                Người nhận ({totalRecipients})
              </Text>
            </View>

            <ScrollView style={styles.recipientList} nestedScrollEnabled>
              <View className="gap-1.5">
                {visibleRecipients.map((recipient) => (
                  <View
                    key={recipient.id}
                    className="flex-row items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <Text className="text-xs font-bold text-slate-700 flex-1" numberOfLines={1}>
                      {recipient.recipient?.fullName || 'Người dùng'}
                    </Text>
                    {recipient.isRead ? (
                      <View className="flex-row items-center gap-1">
                        <Feather name="check-circle" size={12} color={BrandColors.success} />
                        <Text className="text-[10px] font-bold text-emerald-600">
                          {recipient.readAt
                            ? formatDateToDDMMYYYY(recipient.readAt)
                            : 'Đã đọc'}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-[10px] font-bold text-slate-400">Chưa đọc</Text>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            {hiddenRecipientCount > 0 ? (
              <Text className="text-[10px] text-slate-400 font-semibold mt-2">
                … và {hiddenRecipientCount} người nhận khác (chỉ hiển thị {RECIPIENT_DISPLAY_LIMIT}{' '}
                dòng đầu).
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Bình luận */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-3 mb-6">
          <AnnouncementComments announcementId={announcement.id} canManage={canManage} />
        </View>
      </ScrollView>

      <DocumentPreviewModal
        visible={isPreviewVisible}
        url={previewUrl}
        fileName={previewName}
        onClose={() => setPreviewVisible(false)}
      />

      <AnnouncementFormModal
        visible={isFormVisible}
        announcement={announcement}
        onClose={() => setFormVisible(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MetaRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}

const MetaRow: React.FC<MetaRowProps> = ({ icon, label, value }) => (
  <View className="flex-row items-start gap-2">
    <Feather name={icon} size={12} color="#94A3B8" style={styles.metaIcon} />
    <Text className="text-[11px] font-bold text-slate-400 w-20">{label}</Text>
    <Text className="text-[11px] font-semibold text-slate-700 flex-1">{value}</Text>
  </View>
);

interface StatBoxProps {
  label: string;
  value: string;
  tone: 'slate' | 'green' | 'amber';
}

const STAT_TONES: Record<StatBoxProps['tone'], { bg: string; text: string; border: string }> = {
  slate: { bg: '#F8FAFC', text: '#334155', border: '#E2E8F0' },
  green: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  amber: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
};

const StatBox: React.FC<StatBoxProps> = ({ label, value, tone }) => {
  const theme = STAT_TONES[tone];
  return (
    <View
      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      className="flex-1 rounded-xl border px-2.5 py-2 items-center"
    >
      <Text style={{ color: theme.text }} className="text-base font-extrabold">
        {value}
      </Text>
      <Text className="text-[10px] font-bold text-slate-500 mt-0.5">{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mediaImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  recipientList: {
    maxHeight: 240,
  },
  metaIcon: {
    marginTop: 2,
  },
});
