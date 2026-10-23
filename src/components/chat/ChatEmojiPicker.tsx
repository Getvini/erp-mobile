import React from 'react';
import EmojiPicker, { EmojiType, vi } from 'rn-emoji-keyboard';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';

interface ChatEmojiPickerProps {
  visible: boolean;
  onSelectEmoji: (emoji: string) => void;
  onBackspace?: () => void;
  onClose?: () => void;
}

export const ChatEmojiPicker: React.FC<ChatEmojiPickerProps> = ({
  visible,
  onSelectEmoji,
  onClose,
}) => {
  const handleEmojiSelected = (emojiObject: EmojiType) => {
    Haptics.selectionAsync().catch(() => {});
    if (emojiObject?.emoji) {
      onSelectEmoji(emojiObject.emoji);
    }
  };

  return (
    <EmojiPicker
      open={visible}
      onClose={() => onClose?.()}
      onEmojiSelected={handleEmojiSelected}
      translation={vi}
      enableSearchBar={true}
      enableRecentlyUsed={true}
      categoryPosition="bottom"
      defaultHeight="45%"
      expandedHeight="80%"
      theme={{
        backdrop: 'rgba(15, 23, 42, 0.4)',
        knob: '#CBD5E1',
        container: '#FFFFFF',
        header: '#0F172A',
        skinTonesContainer: '#F8FAFC',
        category: {
          icon: '#64748B',
          iconActive: BrandColors.primary,
          container: 'transparent',
          containerActive: '#FFF7ED',
        },
        search: {
          background: '#F1F5F9',
          text: '#0F172A',
          placeholder: '#94A3B8',
          icon: BrandColors.primary,
        },
      }}
    />
  );
};

export default ChatEmojiPicker;
