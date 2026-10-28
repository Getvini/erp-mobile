import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ChatMessage } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import { formatReplyPreview } from '@/utils/chatTokenHelper';

interface PinnedMessageBannerProps {
  pinnedMessages: ChatMessage[];
  onPressBanner: (latestPinned: ChatMessage) => void;
  onOpenList: () => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  pinnedMessages,
  onPressBanner,
  onOpenList,
}) => {
  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];
  const count = pinnedMessages.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.contentWrap}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.selectionAsync();
          onPressBanner(latestPinned);
        }}
      >
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="pin" size={15} color={BrandColors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            Tin nhắn đã ghim
            {count > 1 ? ` (${count})` : ''}
          </Text>
          <Text numberOfLines={1} style={styles.snippet}>
            <Text style={styles.sender}>
              {latestPinned.sender?.fullName || 'Thành viên'}:{' '}
            </Text>
            {formatReplyPreview(latestPinned)}
          </Text>
        </View>
      </TouchableOpacity>

      {count > 1 && (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => {
            Haptics.selectionAsync();
            onOpenList();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="layers" size={16} color={BrandColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contentWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  snippet: {
    fontSize: 12,
    color: '#334155',
    marginTop: 1,
  },
  sender: {
    fontWeight: '600',
    color: '#0F172A',
  },
  moreBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginLeft: 8,
  },
});
