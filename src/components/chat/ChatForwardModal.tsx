import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage, ChatRoom, chatService } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';

interface ChatForwardModalProps {
  visible: boolean;
  message: ChatMessage | null;
  currentRoomId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChatForwardModal: React.FC<ChatForwardModalProps> = ({
  visible,
  message,
  currentRoomId,
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const rooms = useChatStore((s) => s.rooms);
  const forwardMessage = useChatStore((s) => s.forwardMessage);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Danh sách các phòng khác phòng hiện tại
  const candidateRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rooms
      .filter((r) => String(r.id) !== String(currentRoomId))
      .filter((r) => {
        if (!q) return true;
        if (r.isGroup) {
          return (r.name || '').toLowerCase().includes(q);
        }
        const other = r.participants.find(
          (p) => String(p.userId) !== String(currentUser?.id)
        );
        const otherName = other?.user?.fullName || other?.user?.username || '';
        return otherName.toLowerCase().includes(q);
      });
  }, [rooms, currentRoomId, searchQuery, currentUser?.id]);

  const toggleSelectRoom = (roomId: string) => {
    Haptics.selectionAsync();
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (!message || selectedRoomIds.size === 0) return;
    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const targetIds = Array.from(selectedRoomIds);
      const success = await forwardMessage(currentRoomId, message.id, targetIds);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Đã chuyển tiếp tin nhắn đến ${targetIds.length} cuộc trò chuyện.`);
        setSelectedRoomIds(new Set());
        setSearchQuery('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn.');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Lỗi khi chuyển tiếp tin nhắn');
    } finally {
      setIsSending(false);
    }
  };

  const getRoomDisplayName = (r: ChatRoom) => {
    if (r.isGroup) return r.name || 'Nhóm trò chuyện';
    const other = r.participants.find(
      (p) => String(p.userId) !== String(currentUser?.id)
    );
    return other?.user?.fullName || other?.user?.username || 'Người dùng';
  };

  const getRoomAvatar = (r: ChatRoom) => {
    if (r.avatarUrl) return r.avatarUrl;
    if (!r.isGroup) {
      const other = r.participants.find(
        (p) => String(p.userId) !== String(currentUser?.id)
      );
      return other?.user?.avatarUrl || null;
    }
    return null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="corner-up-right" size={18} color={BrandColors.primary} />
            </View>
            <Text style={styles.title}>Chuyển tiếp tin nhắn</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Preview tin nhắn được chuyển tiếp */}
          {message && (
            <View style={styles.previewBox}>
              <Text style={styles.previewSender}>
                {message.sender?.fullName || 'Tin nhắn'}:
              </Text>
              <Text numberOfLines={2} style={styles.previewContent}>
                {message.content || (message.attachments?.length ? '[Tệp đính kèm]' : '...')}
              </Text>
            </View>
          )}

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm người nhận hoặc nhóm..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Candidate Rooms List */}
          <FlatList
            data={candidateRooms}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedRoomIds.has(String(item.id));
              const roomName = getRoomDisplayName(item);
              const avatar = getRoomAvatar(item);

              return (
                <TouchableOpacity
                  style={[styles.roomRow, isSelected && styles.roomRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => toggleSelectRoom(String(item.id))}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {roomName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {roomName}
                    </Text>
                    <Text style={styles.roomMeta}>
                      {item.isGroup
                        ? `Nhóm • ${item.participants.length} thành viên`
                        : 'Trực tiếp'}
                    </Text>
                  </View>

                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Feather name="check" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="users" size={36} color="#CBD5E1" />
                <Text style={styles.emptyText}>Không tìm thấy cuộc trò chuyện phù hợp</Text>
              </View>
            }
          />

          {/* Bottom Action */}
          <View style={styles.bottomBar}>
            <Text style={styles.selectedCount}>
              Đã chọn: {selectedRoomIds.size}
            </Text>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (selectedRoomIds.size === 0 || isSending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={selectedRoomIds.size === 0 || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.sendBtnInner}>
                  <Feather name="send" size={15} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>Gửi ngay</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.primary,
  },
  previewSender: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
    marginBottom: 2,
  },
  previewContent: {
    fontSize: 12,
    color: '#475569',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 180,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  roomRowSelected: {
    backgroundColor: '#FFF7ED',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  roomMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  sendBtn: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
