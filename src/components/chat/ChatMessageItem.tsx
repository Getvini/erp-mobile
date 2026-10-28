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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import {
  parseChatTokens,
  stripChatTokens,
  formatReplyPreview,
  formatSystemMessage,
  ChatTokenSegment,
} from '@/utils/chatTokenHelper';
import { ChatMessageActionSheet } from '@/components/chat/ChatMessageActionSheet';
import { ChatMessageReactionsBadge } from '@/components/chat/ChatMessageReactionsBadge';
import { AudioMessagePlayer } from '@/components/chat/AudioMessagePlayer';

import { formatBytes } from '@/utils/chatFileValidation';
import { getFileNameFromUrl } from '@/utils/fileDetector';

const getFileMetadata = (fileName?: string, fileUrl?: string) => {
  const raw = fileName || (fileUrl ? fileUrl.split('?')[0] : '');
  const match = raw.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', bg: '#EF4444' };
    case 'doc':
    case 'docx':
      return { label: 'DOC', bg: '#2563EB' };
    case 'xls':
    case 'xlsx':
      return { label: 'XLS', bg: '#10B981' };
    case 'csv':
      return { label: 'CSV', bg: '#10B981' };
    case 'ppt':
    case 'pptx':
      return { label: 'PPT', bg: '#F59E0B' };
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return { label: 'ZIP', bg: '#8B5CF6' };
    case 'txt':
    case 'log':
    case 'md':
      return { label: 'TXT', bg: '#64748B' };
    default:
      return { label: ext ? ext.slice(0, 4).toUpperCase() : 'FILE', bg: '#64748B' };
  }
};

interface ChatFileAttachmentCardProps {
  file: { name?: string; url?: string; size?: number; type?: string };
  createdAt?: string;
  isMe: boolean;
  formatTime: (date?: string) => string;
  onLongPress?: () => void;
}

const ChatFileAttachmentCard: React.FC<ChatFileAttachmentCardProps> = ({
  file,
  createdAt,
  isMe,
  formatTime,
  onLongPress,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFile = file as any;
  const fileUrl = file.url || rawFile?.fileUrl || rawFile?.path || rawFile?.uri || '';
  const rawName = file.name || rawFile?.fileName || rawFile?.originalName || rawFile?.originalname || '';
  const fileName = getFileNameFromUrl(fileUrl, rawName);
  const fileMeta = getFileMetadata(fileName, fileUrl);
  const fileSize = file.size ?? rawFile?.fileSize ?? rawFile?.bytes;
  const sizeText = fileSize ? formatBytes(fileSize) : null;
  const timeText = formatTime ? formatTime(createdAt) : '';

  const handleOpen = () => {
    if (fileUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Linking.openURL(fileUrl).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={handleOpen}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={{
        width: '100%',
        minWidth: 260,
        maxWidth: 340,
        borderRadius: 16,
        padding: 10,
        backgroundColor: isMe ? '#FFF6ED' : '#F0F2F5',
        borderWidth: 1,
        borderColor: isMe ? '#FED7AA' : '#E2E8F0',
      }}
    >
      {/* Top Row: Folded Badge + Name & Size + 2 Action Buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Folded Badge */}
        <View
          style={{
            width: 42,
            height: 46,
            borderRadius: 7,
            backgroundColor: fileMeta.bg,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Folded corner flap */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 12,
              height: 12,
              backgroundColor: 'rgba(255,255,255,0.4)',
              borderBottomLeftRadius: 6,
            }}
          />
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '900',
              color: '#FFFFFF',
              letterSpacing: 0.5,
              paddingTop: 3,
            }}
          >
            {fileMeta.label}
          </Text>
        </View>

        {/* File Name & Size */}
        <View style={{ flex: 1, minWidth: 90, paddingRight: 4, justifyContent: 'center' }}>
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{
              fontSize: 13.5,
              fontWeight: '700',
              color: '#0F172A',
              lineHeight: 18,
            }}
          >
            {fileName}
          </Text>
          {Boolean(sizeText) && (
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {sizeText}
            </Text>
          )}
        </View>

        {/* 2 Action Buttons: Folder & Download */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleOpen}
            onLongPress={onLongPress}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="folder" size={15} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleOpen}
            onLongPress={onLongPress}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="download" size={15} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Row: Timestamp */}
      {Boolean(timeText) && (
        <View style={{ marginTop: 4, paddingLeft: 2 }}>
          <Text style={{ fontSize: 10.5, color: '#94A3B8' }}>{timeText}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
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
  isNextConsecutive?: boolean;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onRecall?: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onReact?: (msg: ChatMessage, emoji: string) => void;
  onJumpToMessage?: (messageId: string) => void;
}

const ChatMessageItemComponent: React.FC<ChatMessageItemProps> = ({
  message,
  isMe,
  selfUserId,
  formatTime,
  showSenderName = true,
  showAvatar = true,
  isConsecutive = false,
  isNextConsecutive = false,
  onReply,
  onForward,
  onEdit,
  onRecall,
  onPin,
  onReact,
  onJumpToMessage,
}) => {
  const router = useRouter();
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);

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
            <MaterialCommunityIcons name="pin" size={14} color="#F38820" style={{ marginRight: 5 }} />
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

            let tagBg = '#FFF7ED';
            let tagBorder = '#FED7AA';
            let tagText = '#EA580C';
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
  const rawContent = (message.content || '').trim();
  const isPlaceholderText =
    rawContent === '[Hình ảnh]' ||
    rawContent === '[Tệp đính kèm]' ||
    rawContent === '🎤 [Tin nhắn thoại]' ||
    rawContent === '[Tin nhắn thoại]' ||
    rawContent.toLowerCase() === '[image]' ||
    rawContent.toLowerCase() === '[attachment]';
  const hasText = Boolean(rawContent && (!hasAttachments || !isPlaceholderText));
  const tokens = parseChatTokens(rawContent);
  const isImageAttachment = (a: any) =>
    Boolean(a?.type?.includes('image') || a?.url?.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i));
  const isAudioAttachment = (a: any) =>
    Boolean(
      a?.type?.includes('audio') ||
      a?.name?.startsWith('Tin nhắn thoại') ||
      a?.name?.includes('voice_') ||
      a?.url?.match(/\.(m4a|mp3|wav|aac|ogg|webm|3gp|3gpp|amr)($|\?)/i) ||
      a?.name?.match(/\.(m4a|mp3|wav|aac|ogg|webm|3gp|3gpp|amr)($|\?)/i)
    );
  const isDocAttachment = (a: any) =>
    !isImageAttachment(a) && !isAudioAttachment(a);

  // Pure images (no text, only images) -> no orange bubble wrapper needed
  const isPureImageOnly = Boolean(
    hasAttachments && !hasText && message.attachments?.every(isImageAttachment)
  );

  // Pure document attachment (PDF, Docx, Excel, Zip...) -> card has its own background/border
  const isPureDocOnly = Boolean(
    hasAttachments && !hasText && message.attachments?.every(isDocAttachment)
  );

  const isPureAudioOnly = Boolean(
    hasAttachments && !hasText && message.attachments?.every(isAudioAttachment)
  );

  const hasDocAttachment = Boolean(
    message.attachments?.some(isDocAttachment)
  );
  const hasAudioAttachment = Boolean(
    message.attachments?.some(isAudioAttachment)
  );
  const hasNonImageAttachment = Boolean(
    message.attachments?.some((a) => !isImageAttachment(a))
  );
  const isPureAttachment = hasAttachments && !hasText;

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

  const handleTriggerActionSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowActionSheet(true);
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
          marginBottom: isNextConsecutive ? 2.5 : 6,
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

      <View
        style={{
          maxWidth: hasDocAttachment ? '88%' : (hasAudioAttachment ? '82%' : '75%'),
          minWidth: hasDocAttachment ? 260 : undefined,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
        }}
      >
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

        {/* Message Bubble with Long-Press & Tap */}
        <TouchableOpacity
          activeOpacity={0.88}
          delayLongPress={250}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowTimestamp((prev) => !prev);
          }}
          onLongPress={handleTriggerActionSheet}
          style={{
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            maxWidth: isPureDocOnly ? 340 : (isPureImageOnly ? undefined : '82%'),
            borderRadius: isPureAudioOnly ? 24 : 16,
            borderBottomRightRadius: (isPureImageOnly || isPureDocOnly) ? 16 : isPureAudioOnly ? 24 : (isMe ? 3 : 16),
            borderBottomLeftRadius: (isPureImageOnly || isPureDocOnly) ? 16 : isPureAudioOnly ? 24 : (!isMe ? 3 : 16),
            backgroundColor: (isPureImageOnly || isPureDocOnly)
              ? 'transparent'
              : (isMe ? BrandColors.primary : '#F1F5F9'),
            paddingHorizontal: (isPureImageOnly || isPureDocOnly) ? 0 : (isPureAudioOnly ? 8 : 12),
            paddingTop: (isPureImageOnly || isPureDocOnly) ? 0 : (isPureAudioOnly ? 6 : 8),
            paddingBottom: (isPureImageOnly || isPureDocOnly) ? 0 : (isPureAudioOnly ? 6 : 6),
            borderWidth: (isPureImageOnly || isPureDocOnly) ? 0 : (isMe ? 0 : 1),
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: (isPureImageOnly || isPureDocOnly) ? 0 : 0.05,
            shadowRadius: (isPureImageOnly || isPureDocOnly) ? 0 : 2,
            elevation: (isPureImageOnly || isPureDocOnly) ? 0 : 1,
            gap: 4,
          }}
        >
          {/* Pinned Indicator */}
          {message.isPinned && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
              <MaterialCommunityIcons name="pin" size={12} color={isMe ? '#FFFFFF' : '#EA580C'} />
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
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const targetId = message.replyToId || message.replyTo?.id;
                if (targetId) {
                  Haptics.selectionAsync().catch(() => {});
                  onJumpToMessage?.(String(targetId));
                }
              }}
              onLongPress={handleTriggerActionSheet}
              delayLongPress={250}
              style={{
                backgroundColor: (!isPureAttachment && isMe) ? 'rgba(0,0,0,0.12)' : '#F1F5F9',
                borderLeftWidth: 3,
                borderLeftColor: (!isPureAttachment && isMe) ? '#FFFFFF' : BrandColors.primary,
                borderWidth: isPureAttachment ? 1 : 0,
                borderColor: '#E2E8F0',
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: (!isPureAttachment && isMe) ? '#FFFFFF' : BrandColors.primary,
                }}
              >
                {message.replyTo.sender?.fullName || message.replyTo.sender?.username || 'Tin nhắn gốc'}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 11,
                  color: (!isPureAttachment && isMe) ? 'rgba(255,255,255,0.85)' : '#475569',
                  marginTop: 1,
                }}
              >
                {formatReplyPreview(message.replyTo)}
              </Text>
            </TouchableOpacity>
          )}

          {/* Text Message */}
          {hasText && renderFormattedContent(message.content)}

          {/* Attachments (Ảnh hiện trường hoặc tệp) */}
          {hasAttachments && !message.isRecalled && (
            <View
              style={{
                gap: 6,
                marginTop: hasText ? 6 : 0,
                borderTopWidth: hasText && isMe ? 1 : 0,
                borderTopColor: 'rgba(255,255,255,0.25)',
                paddingTop: hasText && isMe ? 4 : 0,
              }}
            >
              {message.attachments!.map((att, idx) => {
                const isAudio =
                  att.type?.includes('audio') ||
                  att.name?.startsWith('Tin nhắn thoại') ||
                  att.name?.includes('voice_') ||
                  att.url?.match(/\.(m4a|mp3|wav|aac|ogg|webm|3gp|3gpp|amr)($|\?)/i);

                if (isAudio && att.url) {
                  return (
                    <View key={idx} style={{ marginVertical: 2 }}>
                      <AudioMessagePlayer
                        uri={att.url}
                        fileName={att.name}
                        isMe={isMe}
                        onLongPress={handleTriggerActionSheet}
                      />
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
                      onLongPress={handleTriggerActionSheet}
                      delayLongPress={250}
                      style={{
                        borderRadius: 14,
                        overflow: 'hidden',
                        backgroundColor: '#F1F5F9',
                      }}
                    >
                      <Image
                        source={{ uri: att.url }}
                        style={{ width: 220, height: 165, borderRadius: 14 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                }

                return (
                  <ChatFileAttachmentCard
                    key={idx}
                    file={att}
                    createdAt={message.createdAt}
                    isMe={isMe}
                    formatTime={formatTime}
                    onLongPress={handleTriggerActionSheet}
                  />
                );
              })}
            </View>
          )}

        </TouchableOpacity>

        {/* Messenger-style Timestamp xuất hiện khi chạm vào tin nhắn */}
        {showTimestamp && (
          <View
            style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              marginTop: 3,
              marginBottom: 3,
              paddingHorizontal: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: '#94A3B8',
                fontWeight: '500',
              }}
            >
              {formatTime ? formatTime(message.createdAt) : ''}
              {isMe && (message.isOptimistic ? ' • Đang gửi...' : ' • Đã gửi')}
            </Text>
            {isMe && message.isOptimistic && (
              <Feather name="clock" size={10} color="#94A3B8" />
            )}
          </View>
        )}

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
