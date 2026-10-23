import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { chatService, ChatRoom, ChatParticipant } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import { ChatRenameModal } from '@/components/chat/ChatRenameModal';
import { ChatAddMembersModal } from '@/components/chat/ChatAddMembersModal';
import { RoomSharedFilesTab } from '@/components/chat/RoomSharedFilesTab';
import { RoomAvatar } from '@/components/chat/RoomAvatar';

export default function ChatRoomInfoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = String(id);

  const { user: currentUser } = useAuth();
  const rooms = useChatStore((s) => s.rooms);
  const messagesMap = useChatStore((s) => s.messages);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const fetchRooms = useChatStore((s) => s.fetchRooms);

  const room = useMemo(() => {
    return rooms.find((r) => String(r.id) === roomId) || null;
  }, [rooms, roomId]);

  const messages = useMemo(() => {
    return messagesMap[roomId] || [];
  }, [messagesMap, roomId]);

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [addMembersModalVisible, setAddMembersModalVisible] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);

  // Người dùng hiện tại có phải là Quản trị viên (Admin) không
  const isCurrentUserAdmin = useMemo(() => {
    if (!room || !currentUser) return false;
    const me = room.participants.find((p) => String(p.userId) === String(currentUser.id));
    return me?.role === 'ADMIN' || !room.isGroup;
  }, [room, currentUser]);

  // Cấu hình thông báo & ghim
  const myPreference = useMemo(() => {
    if (!room || !currentUser) return { isMuted: false, isPinned: false };
    const me = room.participants.find((p) => String(p.userId) === String(currentUser.id));
    return {
      isMuted: !!me?.isMuted,
      isPinned: !!me?.isPinned,
    };
  }, [room, currentUser]);

  const getRoomName = () => {
    if (!room) return 'Cuộc trò chuyện';
    if (room.isGroup) return room.name || 'Nhóm trò chuyện';
    const other = room.participants.find((p) => String(p.userId) !== String(currentUser?.id));
    return other?.user?.fullName || room.name || 'Người dùng';
  };

  const getRoomAvatar = () => {
    if (!room) return null;
    if (room.avatarUrl) return room.avatarUrl;
    if (!room.isGroup) {
      const other = room.participants.find((p) => String(p.userId) !== String(currentUser?.id));
      return other?.user?.avatarUrl || null;
    }
    return null;
  };

  // Cập nhật Avatar nhóm
  const handlePickAvatar = async () => {
    if (!room?.isGroup) return;
    if (!isCurrentUserAdmin) {
      Alert.alert('Quyền hạn', 'Chỉ Trưởng nhóm mới có thể đổi ảnh đại diện nhóm.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để đổi ảnh nhóm.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUpdatingAvatar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const formData = new FormData();
        const filename = asset.fileName || `avatar_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        // @ts-ignore
        formData.append('file', {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        });

        const uploadRes = await chatService.uploadChatAttachment(formData);
        if (uploadRes.data?.url) {
          await chatService.updateRoom(roomId, { avatarUrl: uploadRes.data.url });
          await fetchRooms();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện nhóm.');
        } else {
          Alert.alert('Lỗi', uploadRes.error || 'Tải ảnh lên thất bại');
        }
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi ảnh đại diện');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  // Bật/tắt tắt thông báo
  const handleToggleMute = async (value: boolean) => {
    if (!room) return;
    try {
      setIsMuting(true);
      Haptics.selectionAsync();
      await chatService.updatePreferences(roomId, { isMuted: value });
      await fetchRooms();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật tùy chọn thông báo');
    } finally {
      setIsMuting(false);
    }
  };

  // Bật/tắt ghim cuộc trò chuyện
  const handleTogglePin = async (value: boolean) => {
    if (!room) return;
    try {
      setIsPinning(true);
      Haptics.selectionAsync();
      await chatService.updatePreferences(roomId, { isPinned: value });
      await fetchRooms();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật ghim');
    } finally {
      setIsPinning(false);
    }
  };

  // Xử lý thành viên (Đổi quyền / Xóa)
  const handleMemberActions = (participant: ChatParticipant) => {
    if (!room?.isGroup || !isCurrentUserAdmin) return;
    if (String(participant.userId) === String(currentUser?.id)) return; // Không tự thao tác trên mình

    const targetName = participant.user?.fullName || 'thành viên';
    const isTargetAdmin = participant.role === 'ADMIN';

    Alert.alert(
      `Quản lý: ${targetName}`,
      'Chọn hành động quản trị đối với thành viên này:',
      [
        {
          text: isTargetAdmin ? 'Gỡ quyền Trưởng nhóm' : 'Thăng làm Trưởng nhóm',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const newRole = isTargetAdmin ? 'MEMBER' : 'ADMIN';
            const res = await chatService.updateParticipantRole(roomId, String(participant.userId), newRole);
            if (res.error) {
              Alert.alert('Thất bại', res.error);
            } else {
              await fetchRooms();
              Alert.alert('Thành công', `Đã cập nhật vai trò cho ${targetName}`);
            }
          },
        },
        {
          text: 'Xoá khỏi nhóm',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Xác nhận xoá',
              `Bạn có chắc chắn muốn mời ${targetName} rời khỏi cuộc trò chuyện nhóm?`,
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xoá thành viên',
                  style: 'destructive',
                  onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    const res = await chatService.removeParticipant(roomId, String(participant.userId));
                    if (res.error) {
                      Alert.alert('Thất bại', res.error);
                    } else {
                      await fetchRooms();
                    }
                  },
                },
              ]
            );
          },
        },
        { text: 'Đóng', style: 'cancel' },
      ]
    );
  };

  // Rời khỏi nhóm
  const handleLeaveGroup = () => {
    if (!room || !currentUser) return;
    Alert.alert(
      'Rời khỏi nhóm',
      'Bạn có chắc chắn muốn rời khỏi nhóm này? Bạn sẽ không còn nhận được tin nhắn và thông báo từ nhóm nữa.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const res = await chatService.removeParticipant(roomId, String(currentUser.id));
            if (res.error) {
              Alert.alert('Thất bại', res.error);
            } else {
              await fetchRooms();
              router.replace('/chat');
            }
          },
        },
      ]
    );
  };

  if (!room) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={styles.loadingText}>Đang tải thông tin phòng chat...</Text>
      </SafeAreaView>
    );
  }

  const roomName = getRoomName();
  const avatarUrl = getRoomAvatar();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết cuộc trò chuyện</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={room.isGroup && isCurrentUserAdmin ? 0.8 : 1}
            onPress={handlePickAvatar}
          >
            <RoomAvatar
              room={room}
              selfUserId={currentUser?.id}
              size="xl"
            />

            {room.isGroup && isCurrentUserAdmin && (
              <View style={styles.cameraBadge}>
                {isUpdatingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.roomName}>{roomName}</Text>
            {room.isGroup && (
              <TouchableOpacity
                onPress={() => setRenameModalVisible(true)}
                style={styles.editNameBtn}
              >
                <Feather name="edit-2" size={16} color={BrandColors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.roomTypeMeta}>
            {room.isGroup
              ? `Nhóm • ${room.participants.length} thành viên`
              : 'Trò chuyện trực tiếp'}
          </Text>
        </View>

        {/* Quick Preferences Card */}
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingIconWrap}>
              <Feather name="bell-off" size={18} color="#64748B" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Tắt thông báo</Text>
              <Text style={styles.settingSubtitle}>Không nhận chuông hay rung khi có tin mới</Text>
            </View>
            <Switch
              value={myPreference.isMuted}
              onValueChange={handleToggleMute}
              disabled={isMuting}
              trackColor={{ false: '#E2E8F0', true: BrandColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingIconWrap}>
              <Feather name="bookmark" size={18} color="#64748B" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Ghim hội thoại</Text>
              <Text style={styles.settingSubtitle}>Luôn giữ cuộc trò chuyện này ở trên cùng</Text>
            </View>
            <Switch
              value={myPreference.isPinned}
              onValueChange={handleTogglePin}
              disabled={isPinning}
              trackColor={{ false: '#E2E8F0', true: BrandColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Members Section (Only for groups) */}
        {room.isGroup && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Thành viên nhóm ({room.participants.length})
              </Text>
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => setAddMembersModalVisible(true)}
              >
                <Feather name="user-plus" size={14} color={BrandColors.primary} />
                <Text style={styles.addMemberText}>Thêm</Text>
              </TouchableOpacity>
            </View>

            {room.participants.map((p) => {
              const pUser = p.user;
              const isOnline = onlineUsers.includes(String(p.userId));
              const isMe = String(p.userId) === String(currentUser?.id);

              return (
                <TouchableOpacity
                  key={p.id || p.userId}
                  style={styles.memberRow}
                  activeOpacity={isCurrentUserAdmin && !isMe ? 0.7 : 1}
                  onPress={() => handleMemberActions(p)}
                >
                  <View style={styles.memberAvatarWrap}>
                    {pUser?.avatarUrl ? (
                      <Image source={{ uri: pUser.avatarUrl }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberAvatarText}>
                          {(pUser?.fullName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isOnline && <View style={styles.onlineBadge} />}
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {pUser?.fullName || 'Thành viên'} {isMe && '(Bạn)'}
                    </Text>
                    <Text style={styles.memberRole}>
                      {p.role === 'ADMIN' ? 'Trưởng nhóm' : 'Thành viên'}
                    </Text>
                  </View>

                  {p.role === 'ADMIN' && (
                    <View style={styles.adminTag}>
                      <Text style={styles.adminTagText}>Admin</Text>
                    </View>
                  )}

                  {isCurrentUserAdmin && !isMe && (
                    <Feather name="more-vertical" size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Shared Files & Media Section */}
        <View style={styles.sectionHeaderStandalone}>
          <Text style={styles.sectionTitle}>Hình ảnh, Tài liệu & Liên kết</Text>
        </View>
        <RoomSharedFilesTab messages={messages} />

        {/* Danger Zone: Leave Group */}
        {room.isGroup && (
          <TouchableOpacity
            style={styles.leaveGroupBtn}
            onPress={handleLeaveGroup}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color="#EF4444" />
            <Text style={styles.leaveGroupText}>Rời khỏi nhóm trò chuyện</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename Modal */}
      <ChatRenameModal
        visible={renameModalVisible}
        room={room}
        onClose={() => setRenameModalVisible(false)}
        onSuccess={() => fetchRooms()}
      />

      {/* Add Members Modal */}
      <ChatAddMembersModal
        visible={addMembersModalVisible}
        room={room}
        onClose={() => setAddMembersModalVisible(false)}
        onUpdated={() => fetchRooms()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  roomName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  editNameBtn: {
    padding: 4,
  },
  roomTypeMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderStandalone: {
    marginVertical: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  memberAvatarWrap: {
    position: 'relative',
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  memberAvatarPlaceholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberRole: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  adminTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  adminTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  leaveGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  leaveGroupText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});
