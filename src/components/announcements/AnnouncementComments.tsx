import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAddAnnouncementCommentMutation,
  useAnnouncementCommentsQuery,
  useDeleteAnnouncementCommentMutation,
} from '@/hooks/queries/useAnnouncements';
import { useAuthStore } from '@/stores/useAuthStore';
import { BrandColors } from '@/constants/colors';
import { formatDateTimeToDDMMYYYYHHMM } from '@/utils/formatters';

export interface AnnouncementCommentsProps {
  announcementId: string;
  /** Cho phép xoá mọi bình luận (manager) hay chỉ bình luận của chính mình. */
  canManage?: boolean;
}

const getInitial = (name?: string | null): string => {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

export const AnnouncementComments: React.FC<AnnouncementCommentsProps> = ({
  announcementId,
  canManage = false,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState('');

  const {
    data: comments = [],
    isLoading,
    isError,
    error,
  } = useAnnouncementCommentsQuery(announcementId);

  const addCommentMutation = useAddAnnouncementCommentMutation();
  const deleteCommentMutation = useDeleteAnnouncementCommentMutation();

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await addCommentMutation.mutateAsync({ id: announcementId, content });
      setDraft('');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', err?.message || 'Không thể gửi bình luận. Vui lòng thử lại.');
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert('Xoá bình luận', 'Bạn có chắc muốn xoá bình luận này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCommentMutation.mutateAsync({ id: announcementId, commentId });
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể xoá bình luận.');
          }
        },
      },
    ]);
  };

  return (
    <View testID="announcement-comments">
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border items-center justify-center">
          <Feather name="message-circle" size={14} color={BrandColors.primary} />
        </View>
        <Text className="text-sm font-extrabold text-slate-900">
          Bình luận {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
      </View>

      {isLoading ? (
        <View className="py-4 items-center justify-center">
          <ActivityIndicator size="small" color={BrandColors.primary} />
        </View>
      ) : isError ? (
        <Text className="text-xs text-red-500 font-semibold py-2">
          {(error as Error)?.message || 'Không tải được bình luận.'}
        </Text>
      ) : comments.length === 0 ? (
        <Text className="text-xs text-slate-400 italic py-2">
          Chưa có bình luận nào. Hãy là người đầu tiên trao đổi.
        </Text>
      ) : (
        <View className="gap-2.5">
          {comments.map((comment) => {
            const authorId = comment.author?.id;
            const canDelete = canManage || (Boolean(authorId) && authorId === currentUser?.id);

            return (
              <View
                key={comment.id}
                className="flex-row items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2.5"
              >
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Text className="text-xs font-extrabold text-white">
                    {getInitial(comment.author?.fullName)}
                  </Text>
                </View>

                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-xs font-extrabold text-slate-800 flex-1" numberOfLines={1}>
                      {comment.author?.fullName || 'Người dùng'}
                    </Text>
                    <Text className="text-[10px] text-slate-400 font-semibold">
                      {formatDateTimeToDDMMYYYYHHMM(comment.createdAt)}
                    </Text>
                  </View>

                  <Text className="text-xs text-slate-700 mt-1 leading-4">{comment.content}</Text>
                </View>

                {canDelete ? (
                  <TouchableOpacity
                    onPress={() => handleDelete(comment.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 items-center justify-center"
                    testID={`delete-comment-${comment.id}`}
                  >
                    <Feather name="trash-2" size={13} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* Ô nhập bình luận */}
      <View className="flex-row items-end gap-2 mt-3">
        <TextInput
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
          style={styles.input}
          placeholder="Viết bình luận..."
          placeholderTextColor="#94A3B8"
          value={draft}
          onChangeText={setDraft}
          multiline
          testID="comment-input"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!draft.trim() || addCommentMutation.isPending}
          activeOpacity={0.8}
          className="rounded-xl items-center justify-center min-h-[48px] min-w-[48px] px-4 bg-primary"
          style={[styles.sendButton, !draft.trim() ? styles.sendButtonDisabled : null]}
          testID="comment-send"
        >
          {addCommentMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    maxHeight: 120,
    minHeight: 48,
  },
  sendButton: {
    backgroundColor: BrandColors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default AnnouncementComments;
