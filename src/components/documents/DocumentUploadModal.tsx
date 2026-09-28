import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import {
  useUploadDocumentMutation,
  useUploadDocumentVersionMutation,
} from '@/hooks/queries/useDocumentLibrary';
import { DocumentEntity } from '@/services/documentLibraryService';
import { formatFileSize, parseTagsInput, formatTagsInput } from '@/utils/documentLibrary';

export interface DocumentUploadModalProps {
  visible: boolean;
  onClose: () => void;
  /** `create` = tài liệu mới, `version` = cập nhật file mới cho tài liệu đã có. */
  mode: 'create' | 'version';
  /** Bắt buộc khi `mode === 'version'`. */
  documentId?: string;
  /** Tiêu đề phụ (ví dụ displayName của tài liệu đang cập nhật). */
  documentName?: string;
  /**
   * Giới hạn loại file cho DocumentPicker. Mặc định cho phép mọi loại tệp.
   * Dùng `['image/*']` khi cập nhật file ảnh.
   */
  fileTypes?: string[];
  onSuccess?: (document: DocumentEntity) => void;
}

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** Bỏ phần mở rộng để gợi ý displayName. */
const stripExtension = (fileName: string): string => {
  const base = fileName.split('/').pop() ?? fileName;
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > 0 ? base.slice(0, dotIndex) : base;
};

/**
 * Bottom sheet Tải lên tài liệu.
 * - `create`: chọn file + displayName* (tự điền từ tên file) + description + tags.
 * - `version`: chỉ chọn file (backend chỉ nhận field `file`).
 */
export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  visible,
  onClose,
  mode,
  documentId,
  documentName,
  fileTypes,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [wasVisible, setWasVisible] = useState(false);

  const uploadDocumentMutation = useUploadDocumentMutation();
  const uploadVersionMutation = useUploadDocumentVersionMutation();

  const isSubmitting = uploadDocumentMutation.isPending || uploadVersionMutation.isPending;
  const isCreateMode = mode === 'create';

  // Reset toàn bộ form mỗi lần mở sheet — điều chỉnh state trong lúc render
  // thay vì useEffect (tránh set-state-in-effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setFile(null);
      setDisplayName('');
      setDescription('');
      setTagsInput('');
      setNameTouched(false);
    }
  }

  const parsedTags = useMemo(() => parseTagsInput(tagsInput), [tagsInput]);

  const canSubmit = useMemo(() => {
    if (!file) return false;
    if (isCreateMode && !displayName.trim()) return false;
    if (!isCreateMode && !documentId) return false;
    return !isSubmitting;
  }, [file, isCreateMode, displayName, documentId, isSubmitting]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: fileTypes && fileTypes.length > 0 ? fileTypes : '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const pickedName = asset.name || `tai-lieu-${Date.now()}`;
      setFile({
        uri: asset.uri,
        name: pickedName,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });

      // Tự điền displayName từ tên file nếu người dùng chưa sửa.
      if (isCreateMode && !nameTouched) {
        setDisplayName(stripExtension(pickedName));
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn tệp. Vui lòng thử lại.');
    }
  };

  const handleRemoveFile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!file || !canSubmit) return;

    try {
      let saved: DocumentEntity;

      if (isCreateMode) {
        saved = await uploadDocumentMutation.mutateAsync({
          file: {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType,
            size: file.size,
          },
          displayName: displayName.trim(),
          description: description.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
        });
      } else {
        if (!documentId) return;
        saved = await uploadVersionMutation.mutateAsync({
          id: documentId,
          file: {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType,
            size: file.size,
          },
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Thành công',
        isCreateMode
          ? `Đã tải lên tài liệu "${saved.displayName}".`
          : `Đã cập nhật phiên bản v${saved.currentVersion} cho tài liệu.`,
      );
      onSuccess?.(saved);
      onClose();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Tải lên thất bại', error?.message || 'Không thể tải tài liệu lên. Vui lòng thử lại.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleCol}>
                <Text style={styles.headerTitle}>
                  {isCreateMode ? 'Tải Lên Tài Liệu' : 'Cập Nhật File Mới'}
                </Text>
                {!isCreateMode && documentName ? (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {documentName}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Chọn file */}
              <Text style={styles.label}>
                Tệp đính kèm <Text style={styles.required}>*</Text>
              </Text>

              {file ? (
                <View style={styles.fileRow}>
                  <View style={styles.fileIconBox}>
                    <Feather name="file-text" size={18} color="#F38820" />
                  </View>
                  <View style={styles.fileInfoCol}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {file.size ? formatFileSize(file.size) : 'Không rõ dung lượng'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleRemoveFile}
                    style={styles.removeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.pickBtn, isSubmitting && styles.btnDisabled]}
                onPress={handlePickFile}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Feather name={file ? 'refresh-cw' : 'upload'} size={16} color="#F38820" />
                <Text style={styles.pickBtnText}>
                  {file ? 'Chọn tệp khác' : 'Chọn tệp từ thiết bị'}
                </Text>
              </TouchableOpacity>

              {isCreateMode ? (
                <>
                  {/* displayName */}
                  <Text style={[styles.label, styles.labelSpaced]}>
                    Tên hiển thị <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={(text) => {
                      setNameTouched(true);
                      setDisplayName(text);
                    }}
                    placeholder="Ví dụ: Biểu mẫu đề nghị thanh toán"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={!isSubmitting}
                  />
                  {!displayName.trim() ? (
                    <Text style={styles.hintWarn}>Tên hiển thị không được để trống.</Text>
                  ) : null}

                  {/* description */}
                  <Text style={[styles.label, styles.labelSpaced]}>Mô tả</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Mô tả ngắn về tài liệu (không bắt buộc)"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.inputMultiline]}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!isSubmitting}
                  />

                  {/* tags */}
                  <Text style={[styles.label, styles.labelSpaced]}>Thẻ (tags)</Text>
                  <TextInput
                    value={tagsInput}
                    onChangeText={setTagsInput}
                    placeholder="Ví dụ: biểu mẫu, kế toán, 2026"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    autoCapitalize="none"
                    editable={!isSubmitting}
                  />
                  <Text style={styles.hint}>Phân tách nhiều thẻ bằng dấu phẩy.</Text>

                  {parsedTags.length > 0 ? (
                    <View style={styles.tagWrap}>
                      {parsedTags.map((tag) => (
                        <View key={tag} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.hint}>
                  Hệ thống sẽ tạo phiên bản mới kế tiếp và giữ nguyên toàn bộ lịch sử phiên bản cũ.
                </Text>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Đang tải lên...</Text>
                  </>
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>
                      {isCreateMode ? 'Tải lên' : 'Cập nhật phiên bản'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrapper: { width: '100%' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 20,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  headerTitleCol: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: '#64748B' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxHeight: 460 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  labelSpaced: { marginTop: 16 },
  required: { color: '#EF4444' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileInfoCol: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  fileMeta: { marginTop: 2, fontSize: 11, color: '#94A3B8' },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FDCB9E',
    backgroundColor: '#FFF7ED',
  },
  pickBtnText: { fontSize: 13, fontWeight: '700', color: '#F38820' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: { minHeight: 78 },
  hint: { marginTop: 6, fontSize: 11, color: '#94A3B8' },
  hintWarn: { marginTop: 6, fontSize: 11, color: '#DC2626', fontWeight: '600' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  tagChipText: { fontSize: 11, fontWeight: '700', color: '#EA580C' },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  submitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F38820',
  },
  submitBtnDisabled: { backgroundColor: '#FDBA74' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
});

export default DocumentUploadModal;
