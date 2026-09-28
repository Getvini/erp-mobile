import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DocumentEntity, DocumentVersionEntity } from '@/services/documentLibraryService';
import {
  useDocumentVersionsQuery,
  useRestoreDocumentVersionMutation,
  useDocumentVersionDownloadMutation,
} from '@/hooks/queries/useDocumentLibrary';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import {
  buildRestoreConfirmationMessage,
  formatFileSize,
  getNextVersionNumber,
  getUploaderName,
} from '@/utils/documentLibrary';

export interface DocumentVersionListProps {
  document: DocumentEntity;
  /** Chỉ hiện nút "Khôi phục" khi có quyền quản lý thư viện. */
  canManage?: boolean;
  /** Gọi sau khi khôi phục thành công (để cha đóng/mở màn hình nếu cần). */
  onRestored?: (document: DocumentEntity) => void;
}

/**
 * Card "Lịch sử phiên bản".
 * Nút "Khôi phục" chỉ hiện khi `version.versionNumber !== document.currentVersion`
 * và luôn cảnh báo rõ: tạo phiên bản MỚI, không xóa lịch sử.
 */
export const DocumentVersionList: React.FC<DocumentVersionListProps> = ({
  document,
  canManage = false,
  onRestored,
}) => {
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);

  const {
    data: versions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useDocumentVersionsQuery(document.id);

  const restoreMutation = useRestoreDocumentVersionMutation();
  const versionDownloadMutation = useDocumentVersionDownloadMutation();

  const currentVersion = document.currentVersion ?? 1;

  const handleDownloadVersion = async (version: DocumentVersionEntity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusyVersionId(version.id);
    try {
      await versionDownloadMutation.mutateAsync({ id: document.id, versionId: version.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', err?.message || 'Không thể tải phiên bản này.');
    } finally {
      setBusyVersionId(null);
    }
  };

  const handleRestoreVersion = (version: DocumentVersionEntity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    Alert.alert(
      `Khôi phục phiên bản v${version.versionNumber}`,
      buildRestoreConfirmationMessage(version.versionNumber, currentVersion),
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          style: 'default',
          onPress: async () => {
            setBusyVersionId(version.id);
            try {
              const updated = await restoreMutation.mutateAsync({
                id: document.id,
                versionId: version.id,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert(
                'Đã khôi phục',
                `Đã tạo phiên bản mới v${getNextVersionNumber(currentVersion)} từ nội dung của v${version.versionNumber}.`,
              );
              onRestored?.(updated);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert('Khôi phục thất bại', err?.message || 'Không thể khôi phục phiên bản.');
            } finally {
              setBusyVersionId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerIconBox}>
          <Feather name="git-branch" size={15} color="#F38820" />
        </View>
        <Text style={styles.headerTitle}>Lịch sử phiên bản</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{versions.length}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color="#F38820" />
          <Text style={styles.stateText}>Đang tải lịch sử phiên bản...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateBox}>
          <Feather name="alert-circle" size={22} color="#EF4444" />
          <Text style={styles.stateText}>
            {(error as Error)?.message || 'Không tải được lịch sử phiên bản.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : versions.length === 0 ? (
        <View style={styles.stateBox}>
          <Feather name="clock" size={22} color="#CBD5E1" />
          <Text style={styles.stateText}>Chưa có phiên bản nào được ghi nhận.</Text>
        </View>
      ) : (
        versions.map((version, index) => {
          const isCurrent = version.versionNumber === currentVersion;
          const isBusy = busyVersionId === version.id;

          return (
            <View
              key={version.id}
              style={[styles.versionRow, index === versions.length - 1 && styles.versionRowLast]}
            >
              <View style={[styles.versionBadge, isCurrent && styles.versionBadgeCurrent]}>
                <Text style={[styles.versionBadgeText, isCurrent && styles.versionBadgeTextCurrent]}>
                  v{version.versionNumber}
                </Text>
              </View>

              <View style={styles.versionInfoCol}>
                <View style={styles.versionTitleRow}>
                  <Text style={styles.versionTitle} numberOfLines={1}>
                    {version.originalFileName || document.displayName}
                  </Text>
                  {isCurrent ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Hiện tại</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.versionMetaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="user" size={10} color="#94A3B8" />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {getUploaderName(version.uploadedBy)}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="calendar" size={10} color="#94A3B8" />
                    <Text style={styles.metaText}>{formatDateToDDMMYYYY(version.createdAt, '—')}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="hard-drive" size={10} color="#94A3B8" />
                    <Text style={styles.metaText}>{formatFileSize(version.fileSizeBytes)}</Text>
                  </View>
                </View>

                <View style={styles.versionActionsRow}>
                  <TouchableOpacity
                    style={styles.versionActionBtn}
                    onPress={() => handleDownloadVersion(version)}
                    disabled={isBusy}
                    activeOpacity={0.75}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#F38820" />
                    ) : (
                      <Feather name="download" size={13} color="#F38820" />
                    )}
                    <Text style={styles.versionActionText}>Tải về</Text>
                  </TouchableOpacity>

                  {canManage && !isCurrent ? (
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => handleRestoreVersion(version)}
                      disabled={isBusy}
                      activeOpacity={0.75}
                    >
                      <Feather name="rotate-ccw" size={13} color="#2563EB" />
                      <Text style={styles.restoreBtnText}>Khôi phục</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 22 },
  stateText: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 12 },
  retryBtn: {
    marginTop: 4,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  versionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  versionRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  versionBadge: {
    minWidth: 42,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  versionBadgeCurrent: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDCB9E' },
  versionBadgeText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  versionBadgeTextCurrent: { color: '#EA580C' },
  versionInfoCol: { flex: 1, minWidth: 0 },
  versionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  versionTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  currentPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  currentPillText: { fontSize: 9, fontWeight: '800', color: '#EA580C' },
  versionMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  metaText: { fontSize: 10, color: '#64748B', fontWeight: '500' },
  versionActionsRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  versionActionBtn: {
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
  versionActionText: { fontSize: 12, fontWeight: '700', color: '#F38820' },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  restoreBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
});

export default DocumentVersionList;
