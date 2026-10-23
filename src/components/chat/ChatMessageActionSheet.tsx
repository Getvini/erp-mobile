import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ChatMessage } from '@/services/chatService';
import { copyTextToClipboard } from '@/utils/safeClipboard';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

interface ChatMessageActionSheetProps {
  visible: boolean;
  message: ChatMessage | null;
  isMe: boolean;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onRecall?: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onReact: (msg: ChatMessage, emoji: string) => void;
}

export const ChatMessageActionSheet: React.FC<ChatMessageActionSheetProps> = ({
  visible,
  message,
  isMe,
  onClose,
  onReply,
  onForward,
  onEdit,
  onRecall,
  onPin,
  onReact,
}) => {
  const insets = useSafeAreaInsets();

  if (!message) return null;

  const handleCopyText = async () => {
    if (!message.content) return;
    const ok = await copyTextToClipboard(message.content);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã sao chép nội dung tin nhắn.');
    } else {
      Alert.alert('Nội dung tin nhắn', message.content);
    }
    onClose();
  };

  const handleConfirmRecall = () => {
    Alert.alert(
      'Thu hồi tin nhắn',
      'Bạn có chắc chắn muốn thu hồi tin nhắn này? Tin nhắn sẽ biến mất với tất cả mọi người trong phòng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            onRecall?.(message);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingHorizontal: 16,
              }}
            >
              {/* Thanh kéo nhỏ phía trên modal */}
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#CBD5E1',
                  alignSelf: 'center',
                  marginBottom: 14,
                }}
              />

              {/* 1. Dải Emoji Thả Cảm Xúc Nhanh */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 30,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    activeOpacity={0.6}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onReact(message, emoji);
                      onClose();
                    }}
                    style={{
                      width: 42,
                      height: 42,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 21,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. Danh sách hành động tin nhắn */}
              <View style={{ gap: 4 }}>
                {/* Trả lời (Reply) */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onReply(message);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#EFF6FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="corner-up-left" size={17} color="#2563EB" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                    Trả lời tin nhắn
                  </Text>
                </TouchableOpacity>

                {/* Chuyển tiếp (Forward) */}
                {!message.isRecalled && onForward && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onForward(message);
                      onClose();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#F0FDF4',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="corner-up-right" size={17} color="#16A34A" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                      Chuyển tiếp tin nhắn
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Sao chép văn bản */}
                {Boolean(message.content) && !message.isRecalled && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCopyText}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="copy" size={17} color="#475569" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                      Sao chép văn bản
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Ghim / Bỏ ghim tin nhắn */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onPin?.(message);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFF7ED',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather
                      name={message.isPinned ? 'slash' : 'bookmark'}
                      size={17}
                      color="#EA580C"
                    />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                    {message.isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
                  </Text>
                </TouchableOpacity>

                {/* Chỉnh sửa tin nhắn (Chỉ cho tin nhắn của mình gửi) */}
                {isMe && !message.isRecalled && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onEdit?.(message);
                      onClose();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#F0FDF4',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="edit-2" size={17} color="#16A34A" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                      Chỉnh sửa tin nhắn
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Thu hồi tin nhắn (Chỉ cho tin nhắn của mình gửi) */}
                {isMe && !message.isRecalled && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleConfirmRecall}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#FEE2E2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="trash-2" size={17} color="#DC2626" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>
                      Thu hồi tin nhắn
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
