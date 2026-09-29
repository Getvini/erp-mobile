import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canManageDocumentLibrary } from '@/utils/rbac';
import {
  useDocumentDetailQuery,
  useDocumentDownloadMutation,
  useDeleteDocumentMutation,
} from '@/hooks/queries/useDocumentLibrary';
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal';
import { DocumentEditModal } from '@/components/documents/DocumentEditModal';
import { DocumentVersionList } from '@/components/documents/DocumentVersionList';
import { DocumentCard } from '@/components/common/DocumentCard';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import {
  formatFileSize,
  getDocumentCategory,
  getDocumentCategoryLabel,
  getDocumentCategoryMeta,
  getUploaderName,
  isPreviewableInApp,
} from '@/utils/documentLibrary';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((state) => state.user);
  const canManage = canManageDocumentLibrary(user?.role);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [uploadVersionVisible, setUploadVersionVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const {
    data: document,
    isLoading,
    isError,
    error,
    refetch,
  } = useDocumentDetailQuery(id);

  const downloadMutation = useDocumentDownloadMutation();
  const deleteMutation = useDeleteDocumentMutation();

  const category = useMemo(
    () => document?.category || getDocumentCategory(document?.fileExtension, document?.mimeType),
    [document],
  );
  const meta = getDocumentCategoryMeta(category);
  const isImage = category === 'image';
  const canPreview = isPreviewableInApp(document?.fileExtension);

  const handleDownload = async () => {
    if (!document) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDownloading(true);
    try {
      await downloadMutation.mutateAsync(document.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', err?.message || 'Không thể tải tài liệu.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    if (!document) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (canPreview) {
      setPreviewVisible(true);
      return;
    }
    handleDownload();
  };

  const handleDelete = () => {
    if (!document) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    Alert.alert(
      'Xóa tài liệu',
      `Bạn có chắc muốn xóa "${document.displayName}"? Thao tác này xóa vĩnh viễn tệp trên Cloudinary và toàn bộ ${document.currentVersion ?? 1} phiên bản. Không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(document.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert('Đã xóa', 'Tài liệu đã được xóa khỏi thư viện.');
              router.back();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert('Xóa thất bại', err?.message || 'Không thể xóa tài liệu.');
            }
          },
        },
      ],
    );
  };

  const handlePreviewFromCard = useCallback(() => {
    setPreviewVisible(true);
  }, []);

  // ---------- Loading ----------
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={styles.centerStateText}>Đang tải tài liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Error ----------
  if (isError || !document) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.simpleHeader}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.simpleHeaderTitle}>Chi tiết tài liệu</Text>
          <View style={styles.iconBtnPlaceholder} />
        </View>
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={46} color="#FCA5A5" />
          <Text style={styles.centerStateTitle}>Không tải được tài liệu</Text>
          <Text style={styles.centerStateText}>
            {(error as Error)?.message || 'Tài liệu có thể đã bị xóa hoặc bạn không có quyền truy cập.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const uploaderName = getUploaderName(document.uploadedBy);
  const tags = Array.isArray(document.tags) ? document.tags.filter(Boolean) : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.simpleHeader}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.simpleHeaderTitle} numberOfLines={1}>
          Chi tiết tài liệu
        </Text>
        {canManage ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setEditVisible(true)} activeOpacity={0.75}>
            <Feather name="edit-2" size={18} color="#475569" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview lớn */}
        <View style={styles.previewCard}>
          <View style={[styles.previewHeader, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }]}>
            <View style={[styles.previewIconBox, { backgroundColor: '#FFFFFF' }]}>
              <Feather name={meta.icon as any} size={22} color={meta.color} />
            </View>
            <View style={styles.previewHeaderTextCol}>
              <Text style={styles.previewHeaderTitle} numberOfLines={2}>
                {document.displayName}
              </Text>
              <Text style={[styles.previewHeaderSub, { color: meta.color }]}>
                {getDocumentCategoryLabel(category)} • v{document.currentVersion ?? 1}
              </Text>
            </View>
          </View>

          {isImage && document.fileUrl ? (
            <Image
              source={{ uri: document.fileUrl }}
              style={styles.previewImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Feather name={meta.icon as any} size={46} color={meta.color} />
              <Text style={styles.previewPlaceholderExt}>{meta.ext}</Text>
              <Text style={styles.previewPlaceholderHint}>
                {canPreview
                  ? 'Bấm "Xem trước" để mở trình xem tài liệu trong ứng dụng.'
                  : 'Định dạng này cần mở bằng ứng dụng bên ngoài.'}
              </Text>
            </View>
          )}

          {/* Actions chính */}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={handlePreview}
              disabled={downloading}
              activeOpacity={0.8}
            >
              <Feather name={canPreview ? 'eye' : 'external-link'} size={16} color={BrandColors.primary} />
              <Text style={styles.secondaryActionText}>
                {canPreview ? 'Xem trước' : 'Mở file'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionBtn, downloading && styles.btnDisabled]}
              onPress={handleDownload}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="download" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.primaryActionText}>Tải về</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Thông tin tài liệu */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Thông tin tài liệu</Text>

          {document.description ? (
            <Text style={styles.description}>{document.description}</Text>
          ) : (
            <Text style={styles.descriptionEmpty}>Chưa có mô tả cho tài liệu này.</Text>
          )}

          {tags.length > 0 ? (
            <View style={styles.tagWrap}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Feather name="tag" size={10} color="#EA580C" />
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Feather name="hard-drive" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Dung lượng</Text>
              <Text style={styles.infoValue}>{formatFileSize(document.fileSizeBytes)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="file" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Định dạng</Text>
              <Text style={styles.infoValue}>
                {document.fileExtension ? `.${document.fileExtension}` : meta.ext}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Ngày tải</Text>
              <Text style={styles.infoValue}>{formatDateToDDMMYYYY(document.createdAt, '—')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="user" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Người tải</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {uploaderName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="download" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Lượt tải</Text>
              <Text style={styles.infoValue}>{document.downloadCount ?? 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="git-branch" size={14} color="#94A3B8" />
              <Text style={styles.infoLabel}>Phiên bản</Text>
              <Text style={styles.infoValue}>v{document.currentVersion ?? 1}</Text>
            </View>
          </View>

          {/* Thẻ tài liệu dùng chung (DocumentCard) */}
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionLabel}>Tệp đính kèm</Text>
            <DocumentCard
              url={document.fileUrl}
              fileName={document.originalFileName || document.displayName}
              onPreview={handlePreviewFromCard}
            />
          </View>
        </View>

        {/* Lịch sử phiên bản */}
        <DocumentVersionList document={document} canManage={canManage} />

        {/* Hành động quản lý */}
        {canManage ? (
          <View style={styles.manageCard}>
            <Text style={styles.sectionTitle}>Quản lý tài liệu</Text>

            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => setUploadVersionVisible(true)}
              activeOpacity={0.85}
            >
              <Feather name="upload-cloud" size={17} color={BrandColors.primary} />
              <View style={styles.manageBtnTextCol}>
                <Text style={styles.manageBtnTitle}>Cập nhật file mới</Text>
                <Text style={styles.manageBtnSub}>
                  Tạo phiên bản v{(document.currentVersion ?? 1) + 1} và giữ nguyên lịch sử
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => setEditVisible(true)}
              activeOpacity={0.85}
            >
              <Feather name="edit-2" size={17} color="#2563EB" />
              <View style={styles.manageBtnTextCol}>
                <Text style={styles.manageBtnTitle}>Sửa thông tin</Text>
                <Text style={styles.manageBtnSub}>Tên hiển thị, mô tả và thẻ phân loại</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.manageBtn, styles.manageBtnDanger]}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.85}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={17} color="#DC2626" />
              )}
              <View style={styles.manageBtnTextCol}>
                <Text style={[styles.manageBtnTitle, styles.manageBtnTitleDanger]}>Xóa tài liệu</Text>
                <Text style={styles.manageBtnSub}>
                  Xóa vĩnh viễn tệp và toàn bộ phiên bản
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {canPreview ? (
        <DocumentPreviewModal
          visible={previewVisible}
          url={document.fileUrl}
          fileName={document.displayName}
          onClose={() => setPreviewVisible(false)}
        />
      ) : null}

      <DocumentUploadModal
        visible={uploadVersionVisible}
        onClose={() => setUploadVersionVisible(false)}
        mode="version"
        documentId={document.id}
        documentName={document.displayName}
        fileTypes={isImage ? ['image/*'] : undefined}
      />

      <DocumentEditModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        document={document}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  simpleHeaderTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0F172A' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlaceholder: { width: 42, height: 42 },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28 },
  centerStateTitle: { fontSize: 15, fontWeight: '700', color: '#334155', textAlign: 'center' },
  centerStateText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  scrollContent: { padding: 16, gap: 14 },

  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderBottomWidth: 1,
  },
  previewIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewHeaderTextCol: { flex: 1, minWidth: 0 },
  previewHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  previewHeaderSub: { marginTop: 3, fontSize: 11, fontWeight: '700' },
  previewImage: { width: '100%', height: 240, backgroundColor: '#0F172A' },
  previewPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 30 },
  previewPlaceholderExt: { fontSize: 12, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  previewPlaceholderHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 16,
  },
  previewActions: { flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDCB9E',
  },
  secondaryActionText: { fontSize: 14, fontWeight: '700', color: BrandColors.primary },
  primaryActionBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
  },
  primaryActionText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  description: { marginTop: 9, fontSize: 13, color: '#475569', lineHeight: 19 },
  descriptionEmpty: { marginTop: 9, fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  tagChipText: { fontSize: 11, fontWeight: '700', color: '#EA580C' },
  infoGrid: { marginTop: 14, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', width: 88 },
  infoValue: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '700' },
  cardSection: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cardSectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8 },

  manageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
    gap: 10,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  manageBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  manageBtnTextCol: { flex: 1, minWidth: 0 },
  manageBtnTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  manageBtnTitleDanger: { color: '#DC2626' },
  manageBtnSub: { marginTop: 2, fontSize: 11, color: '#94A3B8' },
});
