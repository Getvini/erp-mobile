import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { detectFileType, getFileMeta, getFileNameFromUrl } from '@/utils/fileDetector';

export interface DocumentCardProps {
  url?: string;
  fileName?: string;
  onPreview: (url: string, fileName?: string) => void;
  style?: any;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  url,
  fileName,
  onPreview,
  style,
}) => {
  if (!url) return null;

  const displayName = getFileNameFromUrl(url, fileName);
  const fileType = detectFileType(url, displayName);
  const meta = getFileMeta(fileType);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPreview(url, displayName);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconBox, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }]}>
        <Feather name={meta.icon as any} size={18} color={meta.color} />
      </View>

      <View style={styles.contentCol}>
        <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
          {displayName}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: meta.bgColor }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.ext}</Text>
          </View>
          <Text style={styles.actionHint}>Bấm để xem trước</Text>
        </View>
      </View>

      <View style={styles.previewBtn}>
        <Feather name="eye" size={14} color="#EA580C" />
        <Text style={styles.previewBtnText}>Xem</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionHint: {
    fontSize: 11,
    color: '#64748B',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },
});
