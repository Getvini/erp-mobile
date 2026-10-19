import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { ChatRoom } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';

export default function ChatRoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState('');

  const rooms = useChatStore((s) => s.rooms);
  const loadingRooms = useChatStore((s) => s.loadingRooms);
  const isConnected = useChatStore((s) => s.isConnected);
  const initSocket = useChatStore((s) => s.initSocket);
  const fetchRooms = useChatStore((s) => s.fetchRooms);
  const selectRoom = useChatStore((s) => s.selectRoom);

  useEffect(() => {
    if (user?.id) {
      initSocket(user.id);
      fetchRooms();
    }
  }, [user?.id]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.toLowerCase();
    return rooms.filter((r) => {
      const roomName = r.isGroup
        ? r.name
        : r.participants.find((p) => p.userId !== user?.id)?.user?.fullName || r.name;
      return roomName?.toLowerCase().includes(term);
    });
  }, [rooms, search, user?.id]);

  const getRoomTitle = (room: ChatRoom) => {
    if (room.isGroup) return room.name || 'Nhóm chat';
    const other = room.participants.find((p) => p.userId !== user?.id);
    return other?.user?.fullName || other?.user?.username || room.name || 'Đồng nghiệp';
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return '';
    }
  };

  const handleRoomPress = (room: ChatRoom) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    selectRoom(room.id);
    router.push(`/chat/${room.id}` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                Tin Nhắn
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: isConnected ? '#10B981' : '#94A3B8',
                  }}
                />
                <Text style={{ fontSize: 11, color: isConnected ? '#10B981' : '#94A3B8', fontWeight: '600' }}>
                  {isConnected ? 'Thời gian thực' : 'Đang kết nối...'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F1F5F9',
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 40,
          }}
        >
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm cuộc trò chuyện..."
            placeholderTextColor="#94A3B8"
            style={{
              flex: 1,
              fontSize: 13,
              color: '#0F172A',
              marginLeft: 8,
            }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Room List */}
      {loadingRooms && rooms.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
            Đang tải hội thoại...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loadingRooms}
              onRefresh={fetchRooms}
              tintColor={BrandColors.primary}
              colors={[BrandColors.primary]}
            />
          }
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <MaterialIcons name="chat-bubble-outline" size={54} color="#CBD5E1" />
              <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#334155' }}>
                Chưa có cuộc trò chuyện nào
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
                Tin nhắn trao đổi dự án và công việc sẽ xuất hiện tại đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const title = getRoomTitle(item);
            const hasUnread = Boolean(item.unread && (item.unreadCount || 0) > 0);

            return (
              <TouchableOpacity
                onPress={() => handleRoomPress(item)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: '#FFFFFF',
                  borderBottomWidth: 1,
                  borderBottomColor: '#F1F5F9',
                }}
              >
                {/* Avatar Icon */}
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: item.isGroup ? '#EFF6FF' : '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: item.isGroup ? '#DBEAFE' : '#FFEDD5',
                  }}
                >
                  {item.isGroup ? (
                    <Feather name="users" size={20} color="#3B82F6" />
                  ) : (
                    <Text style={{ fontSize: 17, fontWeight: '800', color: BrandColors.primary }}>
                      {title.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        fontWeight: hasUnread ? '800' : '600',
                        color: '#0F172A',
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {title}
                    </Text>
                    <Text style={{ fontSize: 11, color: hasUnread ? BrandColors.primary : '#94A3B8', fontWeight: hasUnread ? '700' : '400' }}>
                      {formatMessageTime(item.latestMessage?.createdAt || item.updatedAt)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        color: hasUnread ? '#0F172A' : '#64748B',
                        fontWeight: hasUnread ? '600' : '400',
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {item.latestMessage?.content || (item.latestMessage?.attachments?.length ? '[Tệp đính kèm]' : 'Bắt đầu cuộc trò chuyện')}
                    </Text>

                    {hasUnread && (
                      <View
                        style={{
                          minWidth: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: '#EF4444',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 5,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                          {item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
