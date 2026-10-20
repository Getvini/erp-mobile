import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import {
  parseChatTokens,
  formatSystemMessage,
  ChatTokenSegment,
} from '@/utils/chatTokenHelper';

interface ChatMessageItemProps {
  message: ChatMessage;
  isMe: boolean;
  selfUserId?: string | null;
  formatTime: (dateStr?: string) => string;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isMe,
  selfUserId,
  formatTime,
}) => {
  const router = useRouter();
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  // 1. Xử lý tin nhắn hệ thống (System Messages) căn giữa
  if (message.isSystem) {
    const systemText = formatSystemMessage(message, selfUserId);
    return (
      <View style={{ alignItems: 'center', marginVertical: 8, paddingHorizontal: 20 }}>
        <View
          style={{
            backgroundColor: '#F1F5F9',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            maxWidth: '90%',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: '#64748B',
              fontWeight: '500',
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {systemText}
          </Text>
        </View>
      </View>
    );
  }

  // 2. Render nội dung text với Tokens (#task, @user, @all, legacy-task)
  const renderFormattedContent = (content: string) => {
    if (!content) return null;

    if (message.isRecalled) {
      return (
        <Text
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: isMe ? 'rgba(255,255,255,0.7)' : '#94A3B8',
          }}
        >
          Tin nhắn đã bị thu hồi
        </Text>
      );
    }

    const segments: ChatTokenSegment[] = parseChatTokens(content);

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {segments.map((seg, idx) => {
          if (seg.type === 'task') {
            return (
              <TouchableOpacity
                key={`task_${idx}`}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push(`/tasks/${seg.id}` as any);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isMe ? '#EA580C' : '#FFF7ED',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isMe ? '#F97316' : '#FFEDD5',
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="check-square" size={11} color={isMe ? '#FFFFFF' : '#EA580C'} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isMe ? '#FFFFFF' : '#C2410C',
                  }}
                >
                  #{seg.display}
                </Text>
              </TouchableOpacity>
            );
          }

          if (seg.type === 'user') {
            return (
              <TouchableOpacity
                key={`user_${idx}`}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push(`/users/${seg.id}` as any);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isMe ? '#1D4ED8' : '#EFF6FF',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isMe ? '#3B82F6' : '#BFDBFE',
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="at-sign" size={11} color={isMe ? '#FFFFFF' : '#2563EB'} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isMe ? '#FFFFFF' : '#1D4ED8',
                  }}
                >
                  @{seg.display}
                </Text>
              </TouchableOpacity>
            );
          }

          if (seg.type === 'all') {
            return (
              <View
                key={`all_${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isMe ? '#6D28D9' : '#FAF5FF',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isMe ? '#8B5CF6' : '#E9D5FF',
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="users" size={11} color={isMe ? '#FFFFFF' : '#7E22CE'} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isMe ? '#FFFFFF' : '#7E22CE',
                  }}
                >
                  @{seg.display}
                </Text>
              </View>
            );
          }

          if (seg.type === 'legacy-task') {
            return (
              <View
                key={`legacy_${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isMe ? '#EA580C' : '#FFF7ED',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isMe ? '#F97316' : '#FFEDD5',
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="check-square" size={11} color={isMe ? '#FFFFFF' : '#EA580C'} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isMe ? '#FFFFFF' : '#C2410C',
                  }}
                >
                  #{seg.code}
                </Text>
              </View>
            );
          }

          return (
            <Text
              key={`text_${idx}`}
              style={{
                fontSize: 14,
                color: isMe ? '#FFFFFF' : '#0F172A',
                lineHeight: 20,
              }}
            >
              {seg.content}
            </Text>
          );
        })}
      </View>
    );
  };

  const senderName =
    message.sender?.fullName || message.sender?.username || 'Đồng nghiệp';
  const senderAvatar = message.sender?.avatarUrl;
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginBottom: 10,
        paddingHorizontal: 12,
      }}
    >
      {/* Avatar người gửi nếu không phải mình: Tải ảnh thật hoặc fallback chữ cái đầu */}
      {!isMe && (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            alignSelf: 'flex-end',
            overflow: 'hidden',
          }}
        >
          {senderAvatar ? (
            <Image
              source={{ uri: senderAvatar }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
              {senderName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      )}

      <View style={{ maxWidth: '78%' }}>
        {!isMe && (
          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2, marginLeft: 4 }}>
            {senderName}
          </Text>
        )}

        {/* Message Bubble */}
        <View
          style={{
            borderRadius: 18,
            borderBottomRightRadius: isMe ? 4 : 18,
            borderBottomLeftRadius: !isMe ? 4 : 18,
            backgroundColor: isMe ? BrandColors.primary : '#FFFFFF',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: isMe ? 0 : 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
            gap: 6,
          }}
        >
          {/* Text Message */}
          {Boolean(message.content) && renderFormattedContent(message.content)}

          {/* Attachments (Ảnh hiện trường hoặc tệp) */}
          {hasAttachments && !message.isRecalled && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {message.attachments!.map((att, idx) => {
                const isImage =
                  att.type?.includes('image') ||
                  att.url?.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i);

                if (isImage) {
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.85}
                      onPress={() => setPreviewImageUri(att.url)}
                      style={{
                        borderRadius: 10,
                        overflow: 'hidden',
                        backgroundColor: '#F1F5F9',
                      }}
                    >
                      <Image
                        source={{ uri: att.url }}
                        style={{ width: 200, height: 150, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => att.url && Linking.openURL(att.url)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isMe ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                    }}
                  >
                    <Feather
                      name="paperclip"
                      size={14}
                      color={isMe ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: isMe ? '#FFFFFF' : '#0F172A',
                      }}
                    >
                      {att.name || `Tệp đính kèm ${idx + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Time & status */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: isMe ? 'rgba(255,255,255,0.8)' : '#94A3B8',
              }}
            >
              {formatTime(message.createdAt)}
            </Text>
            {message.isOptimistic && (
              <Feather name="clock" size={10} color={isMe ? '#FFFFFF' : '#94A3B8'} />
            )}
          </View>
        </View>
      </View>

      {/* Modal Xem Ảnh Phóng To */}
      {previewImageUri && (
        <Modal
          visible={Boolean(previewImageUri)}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageUri(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TouchableOpacity
              onPress={() => setPreviewImageUri(null)}
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Image
              source={{ uri: previewImageUri }}
              style={{ width: '92%', height: '70%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};
