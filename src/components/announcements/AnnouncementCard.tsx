import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ANNOUNCEMENT_CATEGORY_THEMES,
  ANNOUNCEMENT_PRIORITY_THEMES,
  ANNOUNCEMENT_STATUS_THEMES,
  AnnouncementItem,
  getAnnouncementCategoryLabel,
  getAnnouncementPriorityLabel,
  getAnnouncementStatusLabel,
} from '@/services/announcementService';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { htmlToPlainText, truncatePlainText } from '@/utils/htmlText';

export interface AnnouncementCardProps {
  announcement: AnnouncementItem;
  onPress?: (announcement: AnnouncementItem) => void;
  /** Ẩn chấm "chưa đọc" (dùng trong màn chi tiết nếu cần). */
  hideUnreadDot?: boolean;
}

const DEFAULT_THEME = { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };

/** Chỉ DRAFT / CANCELLED mới hiện badge trạng thái (SENT là mặc định, không cần nhấn mạnh). */
const shouldShowStatusBadge = (status?: string): boolean =>
  status === 'DRAFT' || status === 'CANCELLED' || status === 'SCHEDULED';

export const AnnouncementCard: React.FC<AnnouncementCardProps> = React.memo(({
  announcement,
  onPress,
  hideUnreadDot = false,
}) => {
  const categoryTheme = useMemo(
    () => ANNOUNCEMENT_CATEGORY_THEMES[announcement.category] || DEFAULT_THEME,
    [announcement.category]
  );
  const priorityTheme = useMemo(
    () => ANNOUNCEMENT_PRIORITY_THEMES[announcement.priority || 'NORMAL'] || DEFAULT_THEME,
    [announcement.priority]
  );
  const statusTheme = useMemo(
    () => ANNOUNCEMENT_STATUS_THEMES[announcement.status] || DEFAULT_THEME,
    [announcement.status]
  );

  const preview = useMemo(
    () => truncatePlainText(htmlToPlainText(announcement.content), 120),
    [announcement.content]
  );
  const isUnread = hideUnreadDot ? false : !announcement.isRead;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(announcement);
  };

  const hasReadRate = typeof announcement.readRate === 'number';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={!onPress}
      testID={`announcement-card-${announcement.id}`}
      className={`bg-white rounded-2xl border p-3.5 mb-2.5 ${
        isUnread ? 'border-primary-border' : 'border-slate-200'
      }`}
    >
      {/* Badges hàng đầu */}
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

        {shouldShowStatusBadge(announcement.status) ? (
          <View
            style={{ backgroundColor: statusTheme.bg, borderColor: statusTheme.border }}
            className="px-2 py-0.5 rounded-md border"
          >
            <Text style={{ color: statusTheme.text }} className="text-[10px] font-extrabold">
              {getAnnouncementStatusLabel(announcement.status)}
            </Text>
          </View>
        ) : null}

        {isUnread ? (
          <View className="flex-row items-center gap-1 ml-auto">
            <View className="w-2 h-2 rounded-full bg-primary" />
            <Text className="text-[10px] font-extrabold text-primary">Chưa đọc</Text>
          </View>
        ) : null}
      </View>

      {/* Tiêu đề */}
      <Text
        className={`text-sm leading-5 ${isUnread ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}
        numberOfLines={2}
      >
        {announcement.title}
      </Text>

      {/* Preview nội dung */}
      {preview ? (
        <Text className="text-xs text-slate-500 mt-1 leading-4" numberOfLines={2}>
          {preview}
        </Text>
      ) : null}

      {/* Footer meta */}
      <View className="flex-row items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
          <Feather name="user" size={11} color="#94A3B8" />
          <Text className="text-[11px] text-slate-500 font-semibold flex-shrink" numberOfLines={1}>
            {announcement.createdBy?.fullName || 'Hệ thống'}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {hasReadRate ? (
            <View className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
              <Feather name="eye" size={10} color="#64748B" />
              <Text className="text-[10px] font-bold text-slate-600">
                {announcement.readRate}%
              </Text>
            </View>
          ) : null}
          <Text className="text-[11px] text-slate-400 font-semibold">
            {formatDateToDDMMYYYY(announcement.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default AnnouncementCard;
