import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { formatReplyPreview } from '@/utils/chatTokenHelper';

interface PinnedMessagesModalProps {
  visible: boolean;
  pinnedMessages: ChatMessage[];
  onClose: () => void;
  onSelectMessage: (message: ChatMessage) => void;
  onUnpin: (message: ChatMessage) => void;
}

export const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  visible,
  pinnedMessages,
  onClose,
  onSelectMessage,
  onUnpin,
}) => {
  const handleUnpinWithConfirm = (msg: ChatMessage) => {
    Alert.alert(
      'Bỏ ghim tin nhắn',
      'Bạn có chắc muốn bỏ ghim tin nhắn này khỏi đầu phòng chat?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Bỏ ghim',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onUnpin(msg);
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="pin" size={18} color={BrandColors.primary} />
            </View>
            <Text style={styles.title}>Tin nhắn đã ghim ({pinnedMessages.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {pinnedMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="pin-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Chưa có tin nhắn nào được ghim trong phòng này</Text>
            </View>
          ) : (
            <FlatList
              data={pinnedMessages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <TouchableOpacity
                    style={styles.itemBody}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelectMessage(item);
                      onClose();
                    }}
                  >
                    <View style={styles.itemHeader}>
                      <Text style={styles.senderName}>
                        {item.sender?.fullName || 'Thành viên'}
                      </Text>
                      <Text style={styles.itemDate}>
                        {formatDateToDDMMYYYY(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.itemContent} numberOfLines={3}>
                      {formatReplyPreview(item)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.unpinBtn}
                    onPress={() => handleUnpinWithConfirm(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="slash" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
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
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemBody: {
    flex: 1,
    paddingRight: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  itemDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  unpinBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
