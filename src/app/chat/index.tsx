import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { ChatRoom, chatService } from '@/services/chatService';
import { UserItem } from '@/services/userService';
import { BrandColors } from '@/constants/colors';
import { ChatGroupModal } from '@/components/chat/ChatGroupModal';
import { RoomAvatar } from '@/components/chat/RoomAvatar';
import { formatMessagePreview, formatChatTime } from '@/utils/chatTokenHelper';

type UnifiedChatListItem =
  | { type: 'header'; id: string; title: string; count: number }
  | { type: 'room'; id: string; room: ChatRoom }
  | { type: 'contact'; id: string; user: UserItem };

export default function ChatRoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);

  const rooms = useChatStore((s) => s.rooms);
  const loadingRooms = useChatStore((s) => s.loadingRooms);
  const isConnected = useChatStore((s) => s.isConnected);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const initSocket = useChatStore((s) => s.initSocket);
  const fetchRooms = useChatStore((s) => s.fetchRooms);
  const selectRoom = useChatStore((s) => s.selectRoom);

  // TanStack Query Cache nạp toàn bộ danh bạ nhân sự công ty
  const { data: allUsers = [] } = useUsersQuery();

  useEffect(() => {
    if (user?.id) {
      initSocket(user.id);
      fetchRooms();
    }
  }, [user?.id]);

  // Hợp nhất danh sách: Đoạn chat đang hoạt động + Danh bạ nhân sự A-Z
  const unifiedData = useMemo(() => {
    const term = search.trim().toLowerCase();

    // 1. Danh sách phòng chat đang hoạt động (có tin nhắn hoặc được ghim)
    const activeRooms = rooms.filter((r) => {
      // Chỉ tính là active nếu có tin nhắn hoặc được ghim (hoặc là phòng nhóm)
      const hasActivity = Boolean(r.latestMessage || r.isPinned || r.isGroup);
      if (!hasActivity) return false;

      if (!term) return true;
      const roomTitle = r.isGroup
        ? r.name
        : r.participants.find((p) => String(p.userId) !== String(user?.id))?.user?.fullName ||
          r.name;
      return roomTitle?.toLowerCase().includes(term);
    });

    // Tập hợp ID của các user đã có phòng chat 1-1 active
    const activeDirectUserIds = new Set<string>();
    rooms.forEach((r) => {
      if (!r.isGroup) {
        const otherP = r.participants.find((p) => String(p.userId) !== String(user?.id));
        if (otherP?.userId) {
          activeDirectUserIds.add(String(otherP.userId));
        }
      }
    });

    // 2. Danh bạ đồng nghiệp mới (chưa có tin nhắn trong active list)
    const newContacts = allUsers
      .filter((u: UserItem) => {
        // Loại trừ chính mình
        if (String(u.id) === String(user?.id)) return false;
        // Loại trừ nếu đã có cuộc trò chuyện active
        if (activeDirectUserIds.has(String(u.id))) return false;

        if (!term) return true;
        const name = (u.fullName || u.account?.username || '').toLowerCase();
        return name.includes(term);
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi'));

    const list: UnifiedChatListItem[] = [];

    if (activeRooms.length > 0) {
      list.push({
        type: 'header',
        id: 'header_active_rooms',
        title: 'ĐOẠN CHAT GẦN ĐÂY',
        count: activeRooms.length,
      });
      activeRooms.forEach((r) => {
        list.push({ type: 'room', id: `room_${r.id}`, room: r });
      });
    }

    if (newContacts.length > 0) {
      list.push({
        type: 'header',
        id: 'header_contacts',
        title: 'DANH BẠ ĐỒNG NGHIỆP',
        count: newContacts.length,
      });
      newContacts.forEach((u) => {
        list.push({ type: 'contact', id: `contact_${u.id}`, user: u });
      });
    }

    return list;
  }, [rooms, allUsers, search, user?.id]);

  const getRoomInfo = (room: ChatRoom) => {
    if (room.isGroup) {
      return {
        title: room.name || 'Nhóm chat',
        avatarUrl: room.avatarUrl,
        isOnline: false,
        isGroup: true,
      };
    }
    const otherParticipant = room.participants.find(
      (p) => String(p.userId || p.user?.id) !== String(user?.id)
    );
    const otherUserId = otherParticipant?.userId || otherParticipant?.user?.id;
    const isOnline = Boolean(otherUserId && onlineUsers.includes(String(otherUserId)));

    return {
      title:
        otherParticipant?.user?.fullName ||
        otherParticipant?.user?.username ||
        room.name ||
        'Đồng nghiệp',
      avatarUrl: otherParticipant?.user?.avatarUrl || room.avatarUrl,
      isOnline,
      isGroup: false,
    };
  };

  const handleRoomPress = (room: ChatRoom) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    selectRoom(room.id);
    router.push(`/chat/${room.id}` as any);
  };

  const handleStartChatWithUser = async (targetUser: UserItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Kiểm tra xem phòng 1-1 đã tồn tại trong local store chưa
    const existing = rooms.find(
      (r) =>
        !r.isGroup &&
        r.participants.some((p) => String(p.userId || p.user?.id) === String(targetUser.id))
    );

    if (existing) {
      selectRoom(existing.id);
      router.push(`/chat/${existing.id}` as any);
      return;
    }

    // Nếu chưa có, gọi REST API lấy hoặc tạo phòng DM mới
    try {
      setStartingChatUserId(targetUser.id);
      const res = await chatService.getOrCreateDM(targetUser.id);
      if (res.data?.id) {
        await fetchRooms();
        selectRoom(res.data.id);
        router.push(`/chat/${res.data.id}` as any);
      }
    } finally {
      setStartingChatUserId(null);
    }
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
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
                <Text
                  style={{
                    fontSize: 11,
                    color: isConnected ? '#10B981' : '#94A3B8',
                    fontWeight: '600',
                  }}
                >
                  {isConnected ? 'Đang trực tuyến' : 'Đang kết nối...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Create Group Button */}
          <TouchableOpacity
            onPress={() => setShowCreateGroupModal(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: '#FFF7ED',
              borderWidth: 1,
              borderColor: '#FFEDD5',
            }}
          >
            <Feather name="plus" size={16} color={BrandColors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: BrandColors.primary }}>
              Tạo nhóm
            </Text>
          </TouchableOpacity>
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
            placeholder="Tìm cuộc trò chuyện hoặc đồng nghiệp..."
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

      {/* Unified List (Active Chats + Contacts A-Z) */}
      {loadingRooms && rooms.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
            Đang tải hội thoại...
          </Text>
        </View>
      ) : (
        <FlatList
          data={unifiedData}
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
                Không tìm thấy hội thoại hoặc liên hệ nào
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
                Thử tìm với từ khóa khác hoặc tạo nhóm trò chuyện mới.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            // 1. Header phân mục
            if (item.type === 'header') {
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#94A3B8',
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1' }}>
                    {item.count}
                  </Text>
                </View>
              );
            }

            // 2. Item phòng chat đang hoạt động
            if (item.type === 'room') {
              const { room } = item;
              const { title, avatarUrl, isOnline, isGroup } = getRoomInfo(room);
              const hasUnread = Boolean(room.unread && (room.unreadCount || 0) > 0);
              const preview = formatMessagePreview(room.latestMessage, {
                isGroup,
                selfUserId: user?.id,
                allUsers,
              });

              return (
                <TouchableOpacity
                  onPress={() => handleRoomPress(room)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8FAFC',
                  }}
                >
                  {/* Avatar chuẩn Web ERP (Messenger style cho nhóm, Cam Getvini cho 1-1) */}
                  <RoomAvatar
                    room={room}
                    selfUserId={user?.id}
                    allUsers={allUsers}
                    size="lg"
                    isOnline={isOnline}
                  />

                  {/* Content */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 3,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 5 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            fontWeight: hasUnread ? '800' : '600',
                            color: '#0F172A',
                            flexShrink: 1,
                          }}
                        >
                          {title}
                        </Text>
                        {room.isPinned && (
                          <MaterialCommunityIcons name="pin" size={14} color="#F38820" />
                        )}
                      </View>

                      <Text
                        style={{
                          fontSize: 11,
                          color: hasUnread ? BrandColors.primary : '#94A3B8',
                          fontWeight: hasUnread ? '700' : '400',
                          marginLeft: 6,
                        }}
                      >
                        {formatChatTime(room.latestMessage?.createdAt || room.updatedAt)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
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
                        {preview}
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
                            {room.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            // 3. Item nhân sự mới trong danh bạ A-Z
            if (item.type === 'contact') {
              const targetUser = item.user;
              const name = targetUser.fullName || targetUser.account?.username || 'Đồng nghiệp';
              const isOnline = onlineUsers.includes(String(targetUser.id));
              const isCreating = startingChatUserId === targetUser.id;

              return (
                <TouchableOpacity
                  onPress={() => handleStartChatWithUser(targetUser)}
                  disabled={isCreating}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8FAFC',
                  }}
                >
                  {/* Avatar chuẩn Web ERP */}
                  <RoomAvatar
                    user={targetUser}
                    selfUserId={user?.id}
                    size="md"
                    isOnline={isOnline}
                  />

                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}
                    >
                      {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}
                    >
                      Chưa có tin nhắn · Bấm để trò chuyện
                    </Text>
                  </View>

                  {isCreating ? (
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                  ) : (
                    <Feather name="message-circle" size={17} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              );
            }

            return null;
          }}
        />
      )}

      {/* Modal Tạo Nhóm */}
      <ChatGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={(newRoom) => {
          fetchRooms();
          selectRoom(newRoom.id);
          router.push(`/chat/${newRoom.id}` as any);
        }}
      />
    </View>
  );
}
