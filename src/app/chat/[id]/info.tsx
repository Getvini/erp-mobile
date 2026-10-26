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
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [selectedActionParticipant, setSelectedActionParticipant] = useState<ChatParticipant | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isOpeningDM, setIsOpeningDM] = useState(false);

  // Người dùng hiện tại
  const myParticipant = useMemo(() => {
    if (!room || !currentUser) return null;
    return room.participants.find((p) => String(p.userId) === String(currentUser.id));
  }, [room, currentUser]);

  const myRole = myParticipant?.role || (room?.isGroup ? 'MEMBER' : 'ADMIN');
  const isCurrentUserAdmin = myRole === 'ADMIN' || !room?.isGroup;
  const isCurrentUserDeputy = myRole === 'DEPUTY';

  // Sắp xếp danh sách thành viên: Bạn (top 1) -> Trưởng nhóm -> Phó nhóm -> Thành viên -> Alphabet A-Z
  const sortedParticipants = useMemo(() => {
    if (!room?.participants) return [];
    const meId = String(currentUser?.id);

    return [...room.participants].sort((a, b) => {
      const aIsMe = String(a.userId) === meId;
      const bIsMe = String(b.userId) === meId;
      if (aIsMe) return -1;
      if (bIsMe) return 1;

      const getRoleRank = (role?: string) => {
        if (role === 'ADMIN') return 1;
        if (role === 'DEPUTY') return 2;
        return 3;
      };

      const rankA = getRoleRank(a.role);
      const rankB = getRoleRank(b.role);
      if (rankA !== rankB) return rankA - rankB;

      const nameA = a.user?.fullName || a.user?.username || '';
      const nameB = b.user?.fullName || b.user?.username || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [room?.participants, currentUser?.id]);

  // Cấu hình thông báo & ghim
  const myPreference = useMemo(() => {
    return {
      isMuted: !!myParticipant?.isMuted,
      isPinned: !!myParticipant?.isPinned,
    };
  }, [myParticipant]);

  const getRoomName = () => {
    if (!room) return 'Cuộc trò chuyện';
    if (room.isGroup) return room.name || 'Nhóm trò chuyện';
    const other = room.participants.find((p) => String(p.userId) !== String(currentUser?.id));
    return other?.user?.fullName || room.name || 'Người dùng';
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

        const filename = asset.fileName || `avatar_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';

        const uploadRes = await chatService.uploadChatAttachment(
          {
            uri: asset.uri,
            name: filename,
            mimeType,
          },
          'GETVINI/ERP/chat/avatars'
        );
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

  // Bật/tắt thông báo
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

  // Mở tin nhắn trực tiếp với thành viên
  const handleDirectChat = async (participant: ChatParticipant) => {
    if (!participant.userId) return;
    setSelectedActionParticipant(null);
    try {
      setIsOpeningDM(true);
      Haptics.selectionAsync();
      const res = await chatService.getOrCreateDM(String(participant.userId));
      if (res.data?.id) {
        router.push(`/chat/${res.data.id}` as any);
      } else {
        Alert.alert('Lỗi', res.error || 'Không thể mở cuộc trò chuyện trực tiếp');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể kết nối trò chuyện');
    } finally {
      setIsOpeningDM(false);
    }
  };

  // Cập nhật vai trò thành viên
  const handleSetRole = (targetUserId: string, targetName: string, newRole: 'ADMIN' | 'DEPUTY' | 'MEMBER') => {
    setSelectedActionParticipant(null);
    let confirmMsg = '';
    if (newRole === 'ADMIN') {
      confirmMsg = `Bạn có chắc chắn muốn chuyển quyền Trưởng nhóm cho "${targetName}" không? Bạn sẽ trở thành Phó nhóm.`;
    } else if (newRole === 'DEPUTY') {
      confirmMsg = `Bổ nhiệm "${targetName}" làm Phó nhóm?`;
    } else {
      confirmMsg = `Hủy quyền Phó nhóm của "${targetName}"?`;
    }

    Alert.alert('Xác nhận vai trò', confirmMsg, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const res = await chatService.updateParticipantRole(roomId, targetUserId, newRole);
          if (res.error) {
            Alert.alert('Thất bại', res.error);
          } else {
            await fetchRooms();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      },
    ]);
  };

  // Xóa thành viên khỏi nhóm
  const handleRemoveMember = (targetUserId: string, targetName: string) => {
    setSelectedActionParticipant(null);
    Alert.alert(
      'Xác nhận xoá thành viên',
      `Bạn có chắc chắn muốn mời "${targetName}" rời khỏi cuộc trò chuyện nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa khỏi nhóm',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const res = await chatService.removeParticipant(roomId, targetUserId);
            if (res.error) {
              Alert.alert('Thất bại', res.error);
            } else {
              await fetchRooms();
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            <View
              style={[
                styles.settingIconWrap,
                myPreference.isPinned && { backgroundColor: '#FFF7ED' },
              ]}
            >
              <MaterialCommunityIcons
                name="pin"
                size={19}
                color={myPreference.isPinned ? '#F38820' : '#64748B'}
              />
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
            {/* Nút Thêm Thành Viên Nổi Bật Tương Tự Web */}
            <TouchableOpacity
              style={styles.addMemberBanner}
              onPress={() => setAddMembersModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.addMemberIconWrap}>
                <Feather name="user-plus" size={15} color={BrandColors.primary} />
              </View>
              <Text style={styles.addMemberBannerText}>Thêm thành viên vào nhóm</Text>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Danh sách thành viên ({sortedParticipants.length})
              </Text>
            </View>

            {/* Danh sách từng thành viên */}
            {sortedParticipants.map((p) => {
              const pUser = p.user;
              const isOnline = onlineUsers.includes(String(p.userId));
              const isMe = String(p.userId) === String(currentUser?.id);
              const targetRole = p.role || 'MEMBER';
              const memberName = pUser?.fullName || pUser?.username || 'Thành viên';
              const canManage = (isCurrentUserAdmin && !isMe) || (isCurrentUserDeputy && targetRole === 'MEMBER' && !isMe);

              return (
                <View
                  key={p.id || p.userId}
                  style={[styles.memberRow, isMe && styles.memberRowSelf]}
                >
                  {/* Avatar + Status Badge + Role Crown */}
                  <View style={styles.memberAvatarWrap}>
                    {pUser?.avatarUrl ? (
                      <Image source={{ uri: pUser.avatarUrl }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberAvatarText}>
                          {(memberName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isOnline && <View style={styles.onlineBadge} />}

                    {targetRole === 'ADMIN' && (
                      <View style={styles.roleBadgeAdmin} pointerEvents="none">
                        <Text style={styles.roleBadgeIcon}>👑</Text>
                      </View>
                    )}
                    {targetRole === 'DEPUTY' && (
                      <View style={styles.roleBadgeDeputy} pointerEvents="none">
                        <Text style={styles.roleBadgeIcon}>🛡️</Text>
                      </View>
                    )}
                  </View>

                  {/* Tên & Vai trò */}
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameLine}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {isMe ? 'Bạn' : memberName}
                      </Text>
                      {isMe && (
                        <View style={styles.selfTag}>
                          <Text style={styles.selfTagText}>Bạn</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.memberRoleSubtitle}>
                      {targetRole === 'ADMIN' ? (
                        <Text style={styles.roleTextAdmin}>Trưởng nhóm</Text>
                      ) : targetRole === 'DEPUTY' ? (
                        <Text style={styles.roleTextDeputy}>Phó nhóm</Text>
                      ) : pUser?.username ? (
                        `@${pUser.username}`
                      ) : (
                        'Thành viên'
                      )}
                    </Text>
                  </View>

                  {/* Hành động: Nút Nhắn tin + Menu 3 chấm quản lý */}
                  <View style={styles.memberActionsGroup}>
                    {!isMe && (
                      <TouchableOpacity
                        style={styles.directChatBtn}
                        onPress={() => handleDirectChat(p)}
                        activeOpacity={0.7}
                      >
                        <Feather name="message-square" size={12} color={BrandColors.primary} />
                        <Text style={styles.directChatBtnText}>Nhắn tin</Text>
                      </TouchableOpacity>
                    )}

                    {canManage && (
                      <TouchableOpacity
                        style={styles.memberActionBtn}
                        onPress={() => setSelectedActionParticipant(p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="more-vertical" size={17} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Shared Files & Media Section */}
        <View style={styles.sectionHeaderStandalone}>
          <Text style={styles.sectionTitle}>Hình ảnh, Tài liệu & Liên kết</Text>
        </View>
        <RoomSharedFilesTab messages={messages} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Sheet Modal Quản lý Thành Viên Thanh Lịch */}
      <Modal
        visible={Boolean(selectedActionParticipant)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedActionParticipant(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedActionParticipant(null)}
        >
          <View style={styles.actionSheetContent} onStartShouldSetResponder={() => true}>
            {/* Thanh bar kéo */}
            <View style={styles.sheetHandle} />

            {/* Thông tin thành viên được chọn */}
            {selectedActionParticipant && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetAvatarWrap}>
                    {selectedActionParticipant.user?.avatarUrl ? (
                      <Image
                        source={{ uri: selectedActionParticipant.user.avatarUrl }}
                        style={styles.sheetAvatar}
                      />
                    ) : (
                      <View style={[styles.sheetAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberAvatarText}>
                          {(selectedActionParticipant.user?.fullName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.sheetUserInfo}>
                    <Text style={styles.sheetUserName} numberOfLines={1}>
                      {selectedActionParticipant.user?.fullName || 'Thành viên'}
                    </Text>
                    <Text style={styles.sheetUserRole}>
                      {selectedActionParticipant.role === 'ADMIN'
                        ? '👑 Trưởng nhóm'
                        : selectedActionParticipant.role === 'DEPUTY'
                        ? '🛡️ Phó nhóm'
                        : selectedActionParticipant.user?.username
                        ? `@${selectedActionParticipant.user.username}`
                        : 'Thành viên'}{' '}
                      • Phương thức quản trị
                    </Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                {/* Các thao tác */}
                <View style={styles.sheetActionsList}>
                  {/* Nhắn tin trực tiếp */}
                  <TouchableOpacity
                    style={styles.sheetActionItem}
                    onPress={() => handleDirectChat(selectedActionParticipant)}
                  >
                    <View style={[styles.sheetActionIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Feather name="message-square" size={17} color={BrandColors.primary} />
                    </View>
                    <Text style={styles.sheetActionText}>Gửi tin nhắn trực tiếp</Text>
                    <Feather name="chevron-right" size={16} color="#CBD5E1" />
                  </TouchableOpacity>

                  {/* Bổ nhiệm / Hủy Phó nhóm (Chỉ Admin) */}
                  {isCurrentUserAdmin && selectedActionParticipant.role === 'MEMBER' && (
                    <TouchableOpacity
                      style={styles.sheetActionItem}
                      onPress={() =>
                        handleSetRole(
                          String(selectedActionParticipant.userId),
                          selectedActionParticipant.user?.fullName || 'thành viên',
                          'DEPUTY'
                        )
                      }
                    >
                      <View style={[styles.sheetActionIcon, { backgroundColor: '#F0F9FF' }]}>
                        <Feather name="shield" size={17} color="#0284C7" />
                      </View>
                      <Text style={styles.sheetActionText}>Bổ nhiệm làm Phó nhóm</Text>
                      <Feather name="chevron-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}

                  {isCurrentUserAdmin && selectedActionParticipant.role === 'DEPUTY' && (
                    <TouchableOpacity
                      style={styles.sheetActionItem}
                      onPress={() =>
                        handleSetRole(
                          String(selectedActionParticipant.userId),
                          selectedActionParticipant.user?.fullName || 'thành viên',
                          'MEMBER'
                        )
                      }
                    >
                      <View style={[styles.sheetActionIcon, { backgroundColor: '#FFF1F2' }]}>
                        <Feather name="shield-off" size={17} color="#E11D48" />
                      </View>
                      <Text style={styles.sheetActionText}>Hủy quyền Phó nhóm</Text>
                      <Feather name="chevron-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}

                  {/* Chuyển quyền Trưởng nhóm (Chỉ Admin) */}
                  {isCurrentUserAdmin && (
                    <TouchableOpacity
                      style={styles.sheetActionItem}
                      onPress={() =>
                        handleSetRole(
                          String(selectedActionParticipant.userId),
                          selectedActionParticipant.user?.fullName || 'thành viên',
                          'ADMIN'
                        )
                      }
                    >
                      <View style={[styles.sheetActionIcon, { backgroundColor: '#FEF3C7' }]}>
                        <Feather name="award" size={17} color="#D97706" />
                      </View>
                      <Text style={styles.sheetActionText}>Chuyển quyền Trưởng nhóm</Text>
                      <Feather name="chevron-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}

                  {/* Xóa khỏi nhóm */}
                  {((isCurrentUserAdmin) || (isCurrentUserDeputy && selectedActionParticipant.role === 'MEMBER')) && (
                    <TouchableOpacity
                      style={[styles.sheetActionItem, styles.sheetActionItemDestructive]}
                      onPress={() =>
                        handleRemoveMember(
                          String(selectedActionParticipant.userId),
                          selectedActionParticipant.user?.fullName || 'thành viên'
                        )
                      }
                    >
                      <View style={[styles.sheetActionIcon, { backgroundColor: '#FEF2F2' }]}>
                        <Feather name="trash-2" size={17} color="#EF4444" />
                      </View>
                      <Text style={[styles.sheetActionText, { color: '#EF4444' }]}>
                        Xóa khỏi nhóm trò chuyện
                      </Text>
                      <Feather name="chevron-right" size={16} color="#FCA5A5" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Nút Đóng */}
                <TouchableOpacity
                  style={styles.sheetCancelBtn}
                  onPress={() => setSelectedActionParticipant(null)}
                >
                  <Text style={styles.sheetCancelText}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

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
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
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
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
  addMemberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 14,
  },
  addMemberIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberBannerText: {
    fontSize: 13,
    fontWeight: '700',
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
  memberRowSelf: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  memberAvatarWrap: {
    position: 'relative',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
  },
  memberAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.primary,
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
  roleBadgeAdmin: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeDeputy: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeIcon: {
    fontSize: 10,
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  memberNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: 140,
  },
  selfTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  selfTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  memberRoleSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  roleTextAdmin: {
    color: '#D97706',
    fontWeight: '600',
  },
  roleTextDeputy: {
    color: '#0284C7',
    fontWeight: '600',
  },
  memberActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  directChatBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  memberActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },

  // Action Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
  },
  sheetAvatarWrap: {
    position: 'relative',
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  sheetUserInfo: {
    flex: 1,
  },
  sheetUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetUserRole: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  sheetActionsList: {
    marginVertical: 4,
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  sheetActionItemDestructive: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  sheetActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  sheetCancelBtn: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
