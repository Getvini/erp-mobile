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
import { useUpdateDocumentMutation } from '@/hooks/queries/useDocumentLibrary';
import { DocumentEntity } from '@/services/documentLibraryService';
import { parseTagsInput, formatTagsInput } from '@/utils/documentLibrary';

export interface DocumentEditModalProps {
  visible: boolean;
  onClose: () => void;
  document: DocumentEntity | null;
  onSuccess?: (document: DocumentEntity) => void;
}

/** Bottom sheet sửa metadata tài liệu: displayName* / description / tags. */
export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
  visible,
  onClose,
  document,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [syncedDocumentId, setSyncedDocumentId] = useState<string | null>(null);

  const updateMutation = useUpdateDocumentMutation();

  // Nạp lại form mỗi khi mở sheet cho một tài liệu khác — điều chỉnh state trong
  // lúc render thay vì useEffect (tránh set-state-in-effect).
  if (document?.id !== syncedDocumentId) {
    setSyncedDocumentId(document?.id ?? null);
    if (document) {
      setDisplayName(document.displayName || '');
      setDescription(document.description || '');
      setTagsInput(formatTagsInput(document.tags));
    }
  }

  const parsedTags = useMemo(() => parseTagsInput(tagsInput), [tagsInput]);

  const canSubmit = Boolean(displayName.trim()) && Boolean(document?.id) && !updateMutation.isPending;

  const handleSubmit = async () => {
    if (!document || !canSubmit) return;

    try {
      const updated = await updateMutation.mutateAsync({
        id: document.id,
        displayName: displayName.trim(),
        description: description.trim(),
        tags: parsedTags,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã cập nhật thông tin tài liệu.');
      onSuccess?.(updated);
      onClose();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Cập nhật thất bại', error?.message || 'Không thể cập nhật tài liệu.');
    }
  };

  if (!visible || !document) return null;

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
              <Text style={styles.headerTitle}>Sửa Thông Tin Tài Liệu</Text>
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
              <Text style={styles.label}>
                Tên hiển thị <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ví dụ: Biểu mẫu đề nghị thanh toán"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                editable={!updateMutation.isPending}
              />
              {!displayName.trim() ? (
                <Text style={styles.hintWarn}>Tên hiển thị không được để trống.</Text>
              ) : null}

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
                editable={!updateMutation.isPending}
              />

              <Text style={[styles.label, styles.labelSpaced]}>Thẻ (tags)</Text>
              <TextInput
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder="Ví dụ: biểu mẫu, kế toán, 2026"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                autoCapitalize="none"
                editable={!updateMutation.isPending}
              />
              <Text style={styles.hint}>
                Phân tách nhiều thẻ bằng dấu phẩy. Để trống để xóa toàn bộ thẻ.
              </Text>

              {parsedTags.length > 0 ? (
                <View style={styles.tagWrap}>
                  {parsedTags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.metaBox}>
                <Feather name="info" size={13} color="#64748B" />
                <Text style={styles.metaBoxText}>
                  File đính kèm và lịch sử phiên bản không thay đổi khi sửa thông tin. Dùng nút
                  &ldquo;Cập nhật file mới&rdquo; để thay nội dung tệp.
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={updateMutation.isPending}
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
                {updateMutation.isPending ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Đang lưu...</Text>
                  </>
                ) : (
                  <>
                    <Feather name="save" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Lưu thay đổi</Text>
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0F172A' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxHeight: 420 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  labelSpaced: { marginTop: 16 },
  required: { color: '#EF4444' },
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
  metaBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaBoxText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },
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
});

export default DocumentEditModal;
