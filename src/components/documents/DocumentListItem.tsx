import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DocumentEntity } from '@/services/documentLibraryService';
import { DocumentCard } from '@/components/common/DocumentCard';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import { useDocumentDownloadMutation } from '@/hooks/queries/useDocumentLibrary';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import {
  formatFileSize,
  getDocumentCategory,
  getDocumentCategoryMeta,
  getUploaderName,
  isPreviewableInApp,
} from '@/utils/documentLibrary';

export interface DocumentListItemProps {
  document: DocumentEntity;
  /** Bấm vào card → mở màn hình chi tiết. */
  onPress?: (document: DocumentEntity) => void;
}

/**
 * Card dọc cho 1 tài liệu: icon theo category, displayName, người tải, ngày,
 * dung lượng, badge phiên bản + số lượt tải và 2 nút nhanh "Xem trước" / "Tải về".
 */
export const DocumentListItem: React.FC<DocumentListItemProps> = ({ document, onPress }) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadMutation = useDocumentDownloadMutation();

  const category = document.category || getDocumentCategory(document.fileExtension, document.mimeType);
  const meta = getDocumentCategoryMeta(category);
  const canPreview = isPreviewableInApp(document.fileExtension);
  const uploaderName = getUploaderName(document.uploadedBy);

  const handleOpenExternal = async () => {
    try {
      const downloadUrl = await downloadMutation.mutateAsync(document.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (!canPreview) {
        Alert.alert('Đã mở tài liệu', `Tệp đã được mở bằng ứng dụng bên ngoài.\n${downloadUrl}`);
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', error?.message || 'Không thể tải tài liệu.');
    }
  };

  const handleDownload = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDownloading(true);
    try {
      await handleOpenExternal();
    } finally {
      setDownloading(false);
    }
  };

  /** Không cho bấm song song khi đang lấy signed URL (mỗi lần gọi tăng downloadCount). */
  const handlePreview = () => {
    if (downloading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (canPreview) {
      setPreviewVisible(true);
      return;
    }
    handleDownload();
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => onPress?.(document)}
        disabled={!onPress}
      >
        {/* Hàng 1: icon + tên tài liệu */}
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }]}>
            <Feather name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.displayName} numberOfLines={2}>
              {document.displayName}
            </Text>
            <View style={[styles.categoryBadge, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }]}>
              <Text style={[styles.categoryBadgeText, { color: meta.color }]}>{meta.ext}</Text>
            </View>
          </View>
        </View>

        {document.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {document.description}
          </Text>
        ) : null}

        {/* Hàng 2: metadata */}
        <View style={styles.metaWrap}>
          <View style={styles.metaItem}>
            <Feather name="user" size={11} color="#94A3B8" />
            <Text style={styles.metaText} numberOfLines={1}>
              {uploaderName}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color="#94A3B8" />
            <Text style={styles.metaText}>{formatDateToDDMMYYYY(document.createdAt, '—')}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="hard-drive" size={11} color="#94A3B8" />
            <Text style={styles.metaText}>{formatFileSize(document.fileSizeBytes)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="download" size={11} color="#94A3B8" />
            <Text style={styles.metaText}>{document.downloadCount ?? 0}</Text>
          </View>
        </View>

        {/* Hàng 3: badge phiên bản + hành động nhanh */}
        <View style={styles.footerRow}>
          <View style={styles.versionBadge}>
            <Feather name="git-branch" size={11} color="#475569" />
            <Text style={styles.versionBadgeText}>v{document.currentVersion ?? 1}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handlePreview}
              disabled={downloading}
              activeOpacity={0.75}
            >
              <Feather name={canPreview ? 'eye' : 'external-link'} size={14} color="#EA580C" />
              <Text style={styles.secondaryBtnText}>Xem trước</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, downloading && styles.btnDisabled]}
              onPress={handleDownload}
              disabled={downloading}
              activeOpacity={0.8}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="download" size={14} color="#FFFFFF" />
              )}
              <Text style={styles.primaryBtnText}>Tải về</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {canPreview ? (
        <DocumentPreviewModal
          visible={previewVisible}
          url={document.fileUrl}
          fileName={document.displayName}
          onClose={() => setPreviewVisible(false)}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  displayName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  categoryBadgeText: { fontSize: 9, fontWeight: '800' },
  description: { marginTop: 8, fontSize: 12, color: '#64748B', lineHeight: 17 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '48%' },
  metaText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  versionBadgeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: '#EA580C' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F38820',
  },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
});

export default DocumentListItem;
