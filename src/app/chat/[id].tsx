import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [inputContent, setInputContent] = useState('');
  const typingTimeoutRef = useRef<any>(null);

  const rooms = useChatStore((s) => s.rooms);
  const messagesMap = useChatStore((s) => s.messages);
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const isConnected = useChatStore((s) => s.isConnected);
  const selectRoom = useChatStore((s) => s.selectRoom);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendTyping = useChatStore((s) => s.sendTyping);

  const currentRoom = useMemo(() => {
    return rooms.find((r) => String(r.id) === String(id));
  }, [rooms, id]);

  const messages = useMemo(() => {
    return id ? messagesMap[id] || [] : [];
  }, [messagesMap, id]);

  const roomTypingList = useMemo(() => {
    return id ? typingUsers[id] || [] : [];
  }, [typingUsers, id]);

  useEffect(() => {
    if (id) {
      selectRoom(id);
    }
    return () => {
      selectRoom(null);
    };
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const getRoomTitle = () => {
    if (!currentRoom) return 'Hội thoại';
    if (currentRoom.isGroup) return currentRoom.name || 'Nhóm chat';
    const other = currentRoom.participants.find((p) => p.userId !== user?.id);
    return other?.user?.fullName || other?.user?.username || currentRoom.name || 'Đồng nghiệp';
  };

  const handleInputChange = (text: string) => {
    setInputContent(text);
    if (!id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      sendTyping(id, true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(id, false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSend = async () => {
    const trimmed = inputContent.trim();
    if (!trimmed || !id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputContent('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      sendTyping(id, false);
    }

    await sendMessage(id, trimmed);
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const title = getRoomTitle();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>

          {/* Avatar Icon */}
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: currentRoom?.isGroup ? '#EFF6FF' : '#FFF7ED',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: currentRoom?.isGroup ? '#DBEAFE' : '#FFEDD5',
            }}
          >
            {currentRoom?.isGroup ? (
              <Feather name="users" size={17} color="#3B82F6" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '800', color: BrandColors.primary }}>
                {title.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
              {title}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: roomTypingList.length > 0 ? BrandColors.primary : '#64748B' }}>
              {roomTypingList.length > 0
                ? `${roomTypingList.join(', ')} đang soạn tin...`
                : isConnected
                ? 'Đang hoạt động'
                : 'Mất kết nối'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages List */}
      {loadingMessages && messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
            Đang tải tin nhắn...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <MaterialIcons name="forum" size={44} color="#CBD5E1" />
              <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '600', color: '#64748B' }}>
                Bắt đầu trò chuyện trong phòng này
              </Text>
            </View>
          }
          renderItem={({ item }: { item: ChatMessage }) => {
            const isMe = String(item.senderId) === String(user?.id);

            return (
              <View
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  marginBottom: 10,
                }}
              >
                {!isMe && currentRoom?.isGroup && (
                  <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2, marginLeft: 4 }}>
                    {item.sender?.fullName || item.sender?.username || 'Thành viên'}
                  </Text>
                )}

                <View
                  style={{
                    backgroundColor: isMe ? BrandColors.primary : '#FFFFFF',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 2 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 2,
                    borderWidth: isMe ? 0 : 1,
                    borderColor: '#E2E8F0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      color: isMe ? '#FFFFFF' : '#0F172A',
                    }}
                  >
                    {item.content}
                  </Text>

                  {/* Attachment items if any */}
                  {item.attachments && item.attachments.length > 0 && (
                    <View style={{ marginTop: 6, gap: 4 }}>
                      {item.attachments.map((att, idx) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            padding: 6,
                            borderRadius: 6,
                            backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                          }}
                        >
                          <Feather name="paperclip" size={13} color={isMe ? '#FFFFFF' : '#64748B'} />
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 12, color: isMe ? '#FFFFFF' : '#334155', flex: 1 }}
                          >
                            {att.name || 'Tệp đính kèm'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: isMe ? 'rgba(255,255,255,0.75)' : '#94A3B8',
                      }}
                    >
                      {formatMessageTime(item.createdAt)}
                    </Text>
                    {item.isOptimistic && (
                      <Feather name="clock" size={10} color={isMe ? '#FFFFFF' : '#94A3B8'} />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Bottom Input Bar */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TextInput
          value={inputContent}
          onChangeText={handleInputChange}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 100,
            backgroundColor: '#F1F5F9',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 14,
            color: '#0F172A',
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputContent.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: inputContent.trim() ? BrandColors.primary : '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather
            name="send"
            size={18}
            color={inputContent.trim() ? '#FFFFFF' : '#94A3B8'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
