import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { chatService, ChatRoom, ChatParticipant } from '@/services/chatService';
import { UserItem, getUserRoleLabel } from '@/services/userService';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { BrandColors } from '@/constants/colors';

interface ChatAddMembersModalProps {
  visible: boolean;
  room: ChatRoom | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ChatAddMembersModal: React.FC<ChatAddMembersModalProps> = ({
  visible,
  room,
  onClose,
  onUpdated,
}) => {
  const { user: currentUser } = useAuth();
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const { data: allUsers = [], isLoading: isLoadingUsers } = useUsersQuery();

  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ID của các thành viên đã có mặt trong phòng
  const currentParticipantIds = useMemo(() => {
    if (!room) return new Set<string>();
    return new Set(room.participants.map((p) => String(p.userId)));
  }, [room]);

  // Danh sách ứng viên có thể thêm vào nhóm (chưa có trong room)
  const availableUsersToAdd = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allUsers.filter((u) => {
      if (currentParticipantIds.has(String(u.id))) return false;
      if (!q) return true;
      const name = (u.fullName || '').toLowerCase();
      const username = (u.account?.username || u.accounts?.[0]?.username || '').toLowerCase();
      const email = (u.account?.email || u.accounts?.[0]?.email || '').toLowerCase();
      return name.includes(q) || username.includes(q) || email.includes(q);
    });
  }, [allUsers, currentParticipantIds, searchQuery]);

  const selectedUserIds = useMemo(() => {
    return new Set(selectedUsers.map((u) => u.id));
  }, [selectedUsers]);

  if (!room) return null;

  const toggleUserSelection = (userItem: UserItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === userItem.id);
      if (exists) {
        return prev.filter((u) => u.id !== userItem.id);
      } else {
        return [...prev, userItem];
      }
    });
  };

  const handleRemoveChip = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleClose = () => {
    setActiveTab('members');
    setSearchQuery('');
    setSelectedUsers([]);
    onClose();
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Chưa chọn thành viên', 'Vui lòng chọn ít nhất 1 đồng nghiệp để thêm.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsSubmitting(true);

      const userIds = selectedUsers.map((u) => u.id);
      const res = await chatService.addParticipants(room.id, userIds);

      if (res.error) {
        throw new Error(res.error || 'Không thể thêm thành viên vào nhóm.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', `Đã thêm ${selectedUsers.length} thành viên vào nhóm!`);
      setSelectedUsers([]);
      setActiveTab('members');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = (participant: ChatParticipant) => {
    const memberName = participant.user?.fullName || participant.user?.username || 'thành viên';
    Alert.alert(
      'Xóa thành viên',
      `Bạn có chắc chắn muốn xóa ${memberName} khỏi nhóm chat này?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsSubmitting(true);
              const res = await chatService.removeParticipant(room.id, participant.userId);
              if (res.error) throw new Error(res.error);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              if (onUpdated) onUpdated();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa thành viên.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: '88%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="users" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  {room.name || 'Nhóm chat'}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  {room.participants?.length || 0} thành viên
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Segment Tabs: "Thành viên" vs "Thêm người" */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: '#FFFFFF',
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('members');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: activeTab === 'members' ? '#FFF7ED' : '#F8FAFC',
                borderWidth: 1,
                borderColor: activeTab === 'members' ? '#FFEDD5' : '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: activeTab === 'members' ? BrandColors.primary : '#64748B',
                }}
              >
                Thành viên ({room.participants?.length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('add');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: activeTab === 'add' ? '#FFF7ED' : '#F8FAFC',
                borderWidth: 1,
                borderColor: activeTab === 'add' ? '#FFEDD5' : '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Feather
                name="user-plus"
                size={14}
                color={activeTab === 'add' ? BrandColors.primary : '#64748B'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: activeTab === 'add' ? BrandColors.primary : '#64748B',
                }}
              >
                Thêm đồng nghiệp
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: DANH SÁCH THÀNH VIÊN HIỆN TẠI */}
          {activeTab === 'members' && (
            <FlatList
              data={room.participants}
              keyExtractor={(item) => String(item.userId || item.id)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => {
                const isSelf = String(item.userId) === String(currentUser?.id);
                const name = item.user?.fullName || item.user?.username || 'Đồng nghiệp';
                const role = item.user?.role || 'Thành viên';
                const isOnline = onlineUsers.includes(String(item.userId));
                const avatar = item.user?.avatarUrl;

                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      {/* Avatar */}
                      <View style={{ position: 'relative' }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: '#E2E8F0',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {avatar ? (
                            <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#475569' }}>
                              {name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        {isOnline && (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: '#10B981',
                              borderWidth: 1.5,
                              borderColor: '#FFFFFF',
                            }}
                          />
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                          {name} {isSelf ? '(Bạn)' : ''}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{role}</Text>
                      </View>
                    </View>

                    {!isSelf && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(item)}
                        disabled={isSubmitting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: '#FEE2E2',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                          Xóa
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {/* TAB 2: THÊM ĐỒNG NGHIỆP TRỰC TIẾP */}
          {activeTab === 'add' && (
            <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Search Bar */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F1F5F9',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    height: 38,
                  }}
                >
                  <Feather name="search" size={16} color="#64748B" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Tìm theo tên hoặc email..."
                    placeholderTextColor="#94A3B8"
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      fontSize: 13,
                      color: '#0F172A',
                      paddingVertical: 0,
                    }}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Selected Chips */}
              {selectedUsers.length > 0 && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                    backgroundColor: '#FFFDF9',
                  }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, alignItems: 'center' }}
                  >
                    {selectedUsers.map((u) => {
                      const name = u.fullName || u.account?.username || 'Thành viên';
                      const avatar = (u as any).avatarUrl || (u as any).account?.avatarUrl;
                      return (
                        <View
                          key={u.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#FFF7ED',
                            borderRadius: 20,
                            paddingVertical: 3,
                            paddingLeft: 4,
                            paddingRight: 8,
                            borderWidth: 1,
                            borderColor: '#FFEDD5',
                            gap: 6,
                          }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: '#FDBA74',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                          >
                            {avatar ? (
                              <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                                {name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 12, fontWeight: '600', color: '#C2410C', maxWidth: 100 }}
                          >
                            {name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveChip(u.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: '#FB923C',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Feather name="x" size={10} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* List of candidates */}
              <View style={{ flex: 1 }}>
                {isLoadingUsers ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                    <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                      Đang tải danh bạ nhân sự...
                    </Text>
                  </View>
                ) : availableUsersToAdd.length === 0 ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <Feather name="user-check" size={32} color="#CBD5E1" />
                    <Text style={{ marginTop: 8, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                      {searchQuery
                        ? 'Không tìm thấy đồng nghiệp phù hợp'
                        : 'Tất cả đồng nghiệp đã có trong nhóm chat này'}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={availableUsersToAdd}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const isSelected = selectedUserIds.has(item.id);
                      const isOnline = onlineUsers.includes(String(item.id));
                      const name = item.fullName || item.account?.username || 'Đồng nghiệp';
                      const role = getUserRoleLabel(item.account?.role || item.accounts?.[0]?.role);
                      const avatar = (item as any).avatarUrl || (item as any).account?.avatarUrl;

                      return (
                        <TouchableOpacity
                          onPress={() => toggleUserSelection(item)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: isSelected ? '#FFFDF9' : '#FFFFFF',
                            borderBottomWidth: 1,
                            borderBottomColor: '#F1F5F9',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            {/* Avatar */}
                            <View style={{ position: 'relative' }}>
                              <View
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  backgroundColor: '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  borderWidth: 1,
                                  borderColor: '#E2E8F0',
                                }}
                              >
                                {avatar ? (
                                  <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#475569' }}>
                                    {name.charAt(0).toUpperCase()}
                                  </Text>
                                )}
                              </View>
                              {isOnline && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: 11,
                                    height: 11,
                                    borderRadius: 6,
                                    backgroundColor: '#10B981',
                                    borderWidth: 2,
                                    borderColor: '#FFFFFF',
                                  }}
                                />
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 14,
                                  fontWeight: isSelected ? '700' : '600',
                                  color: '#0F172A',
                                }}
                              >
                                {name}
                              </Text>
                              <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                {role}
                              </Text>
                            </View>
                          </View>

                          {/* Checkbox tròn cam Getvini */}
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: isSelected ? 0 : 2,
                              borderColor: '#CBD5E1',
                              backgroundColor: isSelected ? BrandColors.primary : '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </View>

              {/* Bottom Submit Action */}
              <View
                style={{
                  padding: 16,
                  borderTopWidth: 1,
                  borderTopColor: '#F1F5F9',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <TouchableOpacity
                  onPress={handleAddMembers}
                  disabled={isSubmitting || selectedUsers.length === 0}
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor:
                      selectedUsers.length === 0 || isSubmitting ? '#CBD5E1' : BrandColors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="user-plus" size={16} color="#FFFFFF" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                        Xác nhận thêm ({selectedUsers.length})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
