import React, { useState, useRef } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import {
  parseChatTokens,
  formatSystemMessage,
  ChatTokenSegment,
} from '@/utils/chatTokenHelper';
import { ChatMessageActionSheet } from '@/components/chat/ChatMessageActionSheet';
import { ChatMessageReactionsBadge } from '@/components/chat/ChatMessageReactionsBadge';
import { AudioMessagePlayer } from '@/components/chat/AudioMessagePlayer';

const getFileMetadata = (fileName?: string) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return { icon: 'file-text' as const, color: '#EF4444', bg: '#FEE2E2', label: 'PDF' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: 'grid' as const, color: '#10B981', bg: '#D1FAE5', label: 'EXCEL' };
    case 'doc':
    case 'docx':
      return { icon: 'file-text' as const, color: '#2563EB', bg: '#DBEAFE', label: 'WORD' };
    case 'zip':
    case 'rar':
    case '7z':
      return { icon: 'archive' as const, color: '#F59E0B', bg: '#FEF3C7', label: 'NÉN' };
    default:
      return { icon: 'file' as const, color: '#64748B', bg: '#F1F5F9', label: (ext || 'FILE').toUpperCase() };
  }
};

const resolveAvatarUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://10.0.2.2:3000';
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${cleanPath}`;
};

interface ChatMessageItemProps {
  message: ChatMessage;
  isMe: boolean;
  selfUserId?: string | null;
  formatTime: (dateStr?: string) => string;
  showSenderName?: boolean;
  showAvatar?: boolean;
  isConsecutive?: boolean;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onRecall?: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onReact?: (msg: ChatMessage, emoji: string) => void;
}

const ChatMessageItemComponent: React.FC<ChatMessageItemProps> = ({
  message,
  isMe,
  selfUserId,
  formatTime,
  showSenderName = true,
  showAvatar = true,
  isConsecutive = false,
  onReply,
  onForward,
  onEdit,
  onRecall,
  onPin,
  onReact,
}) => {
  const router = useRouter();
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasNonImageAttachment = Boolean(
    message.attachments?.some(
      (att) => !att.type?.includes('image') && !att.url?.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i)
    )
  );

  // 1. Xử lý tin nhắn hệ thống (System Messages) căn giữa phẳng, thanh lịch theo chuẩn Web ERP
  if (message.isSystem) {
    const systemText = formatSystemMessage(message, selfUserId) || message.content;
    if (!systemText) return null;

    let meta = message.systemMetadata || {};
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    const isPinAction = meta.action === 'PIN_MESSAGE';
    const isUnpinAction = meta.action === 'UNPIN_MESSAGE';

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 7, paddingHorizontal: 16, width: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '88%',
          }}
        >
          {(isPinAction || isUnpinAction) && (
            <Feather name="bookmark" size={13} color="#F38820" style={{ marginRight: 5 }} />
          )}
          <Text
            style={{
              fontSize: 12.5,
              color: '#64748B',
              fontWeight: '500',
              textAlign: 'center',
              lineHeight: 18,
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
            const taskBg = isMe ? 'rgba(255,255,255,0.2)' : '#FFF7ED';
            const taskBorder = isMe ? 'rgba(255,255,255,0.4)' : '#FED7AA';
            const taskText = isMe ? '#FFFFFF' : '#EA580C';

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
                  backgroundColor: taskBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: taskBorder,
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="check-square" size={10} color={taskText} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: taskText,
                  }}
                >
                  #{seg.display}
                </Text>
              </TouchableOpacity>
            );
          }

          if (seg.type === 'user') {
            const isMentionedSelf = Boolean(
              selfUserId && seg.id && String(seg.id) === String(selfUserId)
            );

            let tagBg = '#DBEAFE';
            let tagBorder = '#BFDBFE';
            let tagText = '#1D4ED8';
            let tagWeight: '600' | '700' = '600';

            if (isMe) {
              tagBg = 'rgba(255,255,255,0.2)';
              tagBorder = 'rgba(255,255,255,0.4)';
              tagText = '#FFFFFF';
              tagWeight = '700';
            } else if (isMentionedSelf) {
              tagBg = '#FEF3C7';
              tagBorder = '#FCD34D';
              tagText = '#92400E';
              tagWeight = '700';
            }

            const cleanUserDisplay = (seg.display || '').replace(/^@+/, '').trim();

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
                  backgroundColor: tagBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tagBorder,
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: tagWeight,
                    color: tagText,
                  }}
                >
                  @{cleanUserDisplay}
                </Text>
              </TouchableOpacity>
            );
          }

          if (seg.type === 'all') {
            const allBg = isMe ? 'rgba(255,255,255,0.2)' : '#FEE2E2';
            const allBorder = isMe ? 'rgba(255,255,255,0.4)' : '#FECACA';
            const allText = isMe ? '#FFFFFF' : '#DC2626';

            return (
              <View
                key={`all_${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: allBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: allBorder,
                  marginHorizontal: 2,
                  marginVertical: 1,
                }}
              >
                <Feather name="users" size={10} color={allText} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: allText,
                  }}
                >
                  @{seg.display || 'Tất cả'}
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
  const resolvedAvatar = resolveAvatarUrl(senderAvatar);
  const initial = (senderName || 'T').charAt(0).toUpperCase();
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);

  const swipeableRef = useRef<Swipeable>(null);

  const renderReplyAction = (side: 'left' | 'right') => {
    return (
      <View
        style={{
          width: 50,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#FFF7ED',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#FED7AA',
          }}
        >
          <Feather
            name={side === 'left' ? 'corner-up-right' : 'corner-up-left'}
            size={15}
            color={BrandColors.primary}
          />
        </View>
      </View>
    );
  };

  const handleSwipeToReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onReply?.(message);
    setTimeout(() => {
      swipeableRef.current?.close();
    }, 150);
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={35}
      rightThreshold={35}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={!isMe ? () => renderReplyAction('left') : undefined}
      renderRightActions={isMe ? () => renderReplyAction('right') : undefined}
      onSwipeableWillOpen={handleSwipeToReply}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          marginBottom: isConsecutive ? 3 : 10,
          paddingHorizontal: 12,
        }}
      >
      {/* Avatar người gửi nếu không phải mình: Tải ảnh thật hoặc fallback chữ cái đầu màu cam chuẩn Web */}
      {!isMe && (
        showAvatar ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const sId = message.senderId || message.sender?.id;
              if (sId) router.push(`/users/${sId}` as any);
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#FFEDD5',
              borderWidth: 1,
              borderColor: '#FED7AA',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              alignSelf: 'flex-end',
              marginBottom: 1,
              overflow: 'hidden',
            }}
          >
            {resolvedAvatar && !imageError ? (
              <Image
                source={{ uri: resolvedAvatar }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: '900', color: BrandColors.primary }}>
                {initial}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28, marginRight: 8 }} />
        )
      )}

      <View style={{ maxWidth: '75%', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
        {!isMe && showSenderName && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const sId = message.senderId || message.sender?.id;
              if (sId) router.push(`/users/${sId}` as any);
            }}
            style={{ marginBottom: 2, marginLeft: 2 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#94A3B8' }}>
              {senderName}
            </Text>
          </TouchableOpacity>
        )}

        {/* Message Bubble with Long-Press */}
        <TouchableOpacity
          activeOpacity={0.9}
          delayLongPress={250}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setShowActionSheet(true);
          }}
          style={{
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            borderRadius: 16,
            borderBottomRightRadius: isMe ? 3 : 16,
            borderBottomLeftRadius: !isMe ? 3 : 16,
            backgroundColor: isMe ? BrandColors.primary : '#FFFFFF',
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 6,
            borderWidth: isMe ? 0 : 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
            gap: 4,
          }}
        >
          {/* Pinned Indicator */}
          {message.isPinned && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
              <Feather name="bookmark" size={11} color={isMe ? '#FFFFFF' : '#EA580C'} />
              <Text
                style={{
                  fontSize: 10,
                  color: isMe ? 'rgba(255,255,255,0.85)' : '#EA580C',
                  fontWeight: '600',
                }}
              >
                Đã ghim
              </Text>
            </View>
          )}

          {/* Khối trích dẫn tin nhắn đang trả lời */}
          {message.replyTo && (
            <View
              style={{
                backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : '#F1F5F9',
                borderLeftWidth: 3,
                borderLeftColor: isMe ? '#FFFFFF' : BrandColors.primary,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 6,
                marginBottom: 4,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: isMe ? '#FFFFFF' : BrandColors.primary,
                }}
              >
                {message.replyTo.sender?.fullName || message.replyTo.sender?.username || 'Tin nhắn gốc'}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 11,
                  color: isMe ? 'rgba(255,255,255,0.85)' : '#475569',
                  marginTop: 1,
                }}
              >
                {message.replyTo.content || (message.replyTo.attachments?.length ? '[Tệp đính kèm]' : '...')}
              </Text>
            </View>
          )}

          {/* Text Message */}
          {Boolean(message.content) && renderFormattedContent(message.content)}

          {/* Attachments (Ảnh hiện trường hoặc tệp) */}
          {hasAttachments && !message.isRecalled && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {message.attachments!.map((att, idx) => {
                const isAudio =
                  att.type?.includes('audio') ||
                  att.url?.match(/\.(m4a|mp3|wav|aac|ogg)($|\?)/i);

                if (isAudio && att.url) {
                  return (
                    <View key={idx} style={{ marginVertical: 2 }}>
                      <AudioMessagePlayer uri={att.url} isMe={isMe} />
                    </View>
                  );
                }

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

                const fileMeta = getFileMetadata(att.name || att.url);
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (att.url) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        Linking.openURL(att.url);
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: isMe ? 'rgba(255,255,255,0.18)' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isMe ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
                      width: '100%',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: isMe ? 'rgba(255,255,255,0.95)' : fileMeta.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather
                        name={fileMeta.icon}
                        size={18}
                        color={isMe ? BrandColors.primary : fileMeta.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: isMe ? '#FFFFFF' : '#0F172A',
                          lineHeight: 18,
                        }}
                      >
                        {att.name || `Tệp đính kèm ${idx + 1}`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: isMe ? 'rgba(255,255,255,0.9)' : fileMeta.color,
                          }}
                        >
                          {fileMeta.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: isMe ? 'rgba(255,255,255,0.75)' : '#64748B',
                          }}
                        >
                          • Mở tệp
                        </Text>
                      </View>
                    </View>
                    <Feather
                      name="external-link"
                      size={14}
                      color={isMe ? 'rgba(255,255,255,0.85)' : '#94A3B8'}
                    />
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
              alignSelf: 'flex-end',
              gap: 3,
              marginTop: 2,
              marginLeft: 6,
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
        </TouchableOpacity>

        {/* Reactions Badge */}
        <ChatMessageReactionsBadge
          reactions={message.reactions}
          selfUserId={selfUserId}
          isMe={isMe}
          onPressReactEmoji={(emoji) => onReact?.(message, emoji)}
        />
      </View>

      {/* Action Sheet khi nhấn giữ tin nhắn */}
      <ChatMessageActionSheet
        visible={showActionSheet}
        message={message}
        isMe={isMe}
        onClose={() => setShowActionSheet(false)}
        onReply={(msg) => onReply?.(msg)}
        onForward={(msg) => onForward?.(msg)}
        onEdit={(msg) => onEdit?.(msg)}
        onRecall={(msg) => onRecall?.(msg)}
        onPin={(msg) => onPin?.(msg)}
        onReact={(msg, emoji) => onReact?.(msg, emoji)}
      />

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
    </Swipeable>
  );
};

const areChatMessagePropsEqual = (
  prev: ChatMessageItemProps,
  next: ChatMessageItemProps
): boolean => {
  if (prev.isMe !== next.isMe) return false;
  if (prev.selfUserId !== next.selfUserId) return false;
  if (prev.showSenderName !== next.showSenderName) return false;
  if (prev.showAvatar !== next.showAvatar) return false;
  if (prev.isConsecutive !== next.isConsecutive) return false;
  if (prev.message === next.message) return true;

  const pm = prev.message;
  const nm = next.message;
  if (pm.id !== nm.id) return false;
  if (pm.content !== nm.content) return false;
  if (pm.isRecalled !== nm.isRecalled) return false;
  if (pm.isEdited !== nm.isEdited) return false;
  if (pm.editedAt !== nm.editedAt) return false;
  if (pm.isPinned !== nm.isPinned) return false;
  if ((pm.reactions?.length || 0) !== (nm.reactions?.length || 0)) return false;
  if (pm.reactions && nm.reactions) {
    if (JSON.stringify(pm.reactions) !== JSON.stringify(nm.reactions)) return false;
  }
  if ((pm.attachments?.length || 0) !== (nm.attachments?.length || 0)) return false;

  return true;
};

export const ChatMessageItem = React.memo(ChatMessageItemComponent, areChatMessagePropsEqual);
