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
import { chatService, ChatRoom } from '@/services/chatService';
import { UserItem, getUserRoleLabel } from '@/services/userService';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { BrandColors } from '@/constants/colors';

interface ChatGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (room: ChatRoom) => void;
}

export const ChatGroupModal: React.FC<ChatGroupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const { data: allUsers = [], isLoading: isLoadingUsers } = useUsersQuery();

  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lọc đồng nghiệp theo từ khóa tìm kiếm và loại bỏ chính mình
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allUsers.filter((u) => {
      if (String(u.id) === String(currentUser?.id)) return false;
      if (!q) return true;
      const name = (u.fullName || '').toLowerCase();
      const username = (u.account?.username || u.accounts?.[0]?.username || '').toLowerCase();
      const email = (u.account?.email || u.accounts?.[0]?.email || '').toLowerCase();
      return name.includes(q) || username.includes(q) || email.includes(q);
    });
  }, [allUsers, searchQuery, currentUser?.id]);

  const selectedUserIds = useMemo(() => {
    return new Set(selectedUsers.map((u) => u.id));
  }, [selectedUsers]);

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

  const handleRemoveUser = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleClose = () => {
    setGroupName('');
    setSearchQuery('');
    setSelectedUsers([]);
    onClose();
  };

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      Alert.alert('Thiếu tên nhóm', 'Vui lòng nhập tên cho nhóm chat.');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Chưa chọn thành viên', 'Vui lòng chọn ít nhất 1 thành viên để tạo nhóm.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsSubmitting(true);

      const participantIds = selectedUsers.map((u) => u.id);
      const res = await chatService.createGroupRoom(trimmedName, participantIds);

      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể tạo nhóm chat.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      handleClose();
      onSuccess(res.data);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi tạo nhóm', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="group-add" size={20} color={BrandColors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  Tạo Nhóm Trò Chuyện
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  Đã chọn {selectedUsers.length} thành viên
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

          {/* Form Content: Tên nhóm + Ô tìm kiếm */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
            {/* Tên nhóm */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                TÊN NHÓM CHAT <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Ví dụ: Team Hiện Trường Dự Án A..."
                placeholderTextColor="#94A3B8"
                style={{
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 10,
                  backgroundColor: '#F8FAFC',
                  paddingHorizontal: 12,
                  height: 42,
                  fontSize: 14,
                  color: '#0F172A',
                }}
              />
            </View>

            {/* Ô tìm kiếm đồng nghiệp */}
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
                placeholder="Tìm đồng nghiệp theo tên hoặc email..."
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

          {/* Chips đã chọn (cuộn ngang) */}
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
                        onPress={() => handleRemoveUser(u.id)}
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

          {/* Danh sách nhân sự trực tiếp với Checkbox tròn cam */}
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: '#F8FAFC',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
                DANH BẠ ĐỒNG NGHIỆP ({filteredUsers.length})
              </Text>
            </View>

            {isLoadingUsers ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={BrandColors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                  Đang tải danh sách nhân sự...
                </Text>
              </View>
            ) : filteredUsers.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Feather name="users" size={32} color="#CBD5E1" />
                <Text style={{ marginTop: 8, fontSize: 13, color: '#64748B' }}>
                  Không tìm thấy đồng nghiệp phù hợp
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
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
                        {/* Avatar & Online Dot */}
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

                        {/* Name & Role */}
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

          {/* Sticky Bottom Footer */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              backgroundColor: '#FFFFFF',
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreateGroup}
              disabled={isSubmitting || !groupName.trim() || selectedUsers.length === 0}
              activeOpacity={0.8}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor:
                  !groupName.trim() || selectedUsers.length === 0 || isSubmitting
                    ? '#CBD5E1'
                    : BrandColors.primary,
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
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                    Tạo nhóm chat ({selectedUsers.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
