import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORY_VALUES,
  ANNOUNCEMENT_PRIORITY_LABELS,
  ANNOUNCEMENT_PRIORITY_VALUES,
  ANNOUNCEMENT_SCOPE_LABELS,
  ANNOUNCEMENT_SCOPE_VALUES,
  AnnouncementItem,
  AnnouncementMedia,
  CreateAnnouncementPayload,
} from '@/services/announcementService';
import {
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from '@/hooks/queries/useAnnouncements';
import { useTeamsQuery } from '@/hooks/queries/useTeams';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { BrandColors } from '@/constants/colors';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { DocumentCard } from '@/components/common/DocumentCard';
import { formatDateToDDMMYYYY, formatDateToYYYYMMDD } from '@/utils/formatters';
import { USER_ROLE_OPTIONS } from '@/services/userService';

const ATTACHMENT_FOLDER = 'GETVINI/ERP/announcements';
const MEDIA_FOLDER = 'GETVINI/ERP/announcements/media';

type DateField = 'eventStartAt' | 'eventEndAt';

interface FormState {
  title: string;
  content: string;
  category: string;
  scopeType: string;
  priority: string;
  targetRoles: string[];
  targetTeamIds: string[];
  targetUserIds: string[];
  eventStartAt: string;
  eventEndAt: string;
  eventLocation: string;
  attachmentUrl: string;
  mediaUrls: AnnouncementMedia[];
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  category: 'GENERAL',
  scopeType: 'ALL',
  priority: 'NORMAL',
  targetRoles: [],
  targetTeamIds: [],
  targetUserIds: [],
  eventStartAt: '',
  eventEndAt: '',
  eventLocation: '',
  attachmentUrl: '',
  mediaUrls: [],
};

const toDateInput = (value?: string | null): string => {
  if (!value) return '';
  const iso = formatDateToYYYYMMDD(value);
  return iso || '';
};

const toIsoOrUndefined = (value: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
};

const toggleValue = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** Khởi tạo state form từ thông báo đang sửa (hoặc form rỗng khi soạn mới). */
const buildInitialForm = (announcement?: AnnouncementItem | null): FormState => {
  if (!announcement) return EMPTY_FORM;

  return {
    title: announcement.title || '',
    content: announcement.content || '',
    category: announcement.category || 'GENERAL',
    scopeType: announcement.scopeType || 'ALL',
    priority: announcement.priority || 'NORMAL',
    targetRoles: announcement.targetRoles || [],
    targetTeamIds: announcement.targetTeamIds || [],
    targetUserIds: announcement.targetUserIds || [],
    eventStartAt: toDateInput(announcement.eventStartAt),
    eventEndAt: toDateInput(announcement.eventEndAt),
    eventLocation: announcement.eventLocation || '',
    attachmentUrl: announcement.attachmentUrl || '',
    mediaUrls: announcement.mediaUrls || [],
  };
};

export interface AnnouncementFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (announcement: AnnouncementItem | null) => void;
  /** Có giá trị ⇒ chế độ chỉnh sửa (PUT /announcements/:id). */
  announcement?: AnnouncementItem | null;
}

/**
 * Bottom sheet soạn/sửa thông báo.
 * - `status: 'DRAFT'` cho "Lưu nháp", `'SENT'` cho "Gửi ngay".
 * - `targetRoles` / `targetTeamIds` / `targetUserIds` chỉ gửi tương ứng `scopeType`.
 * - Ảnh chèn vào nội dung: upload Cloudinary folder `GETVINI/ERP/announcements/media`
 *   rồi chèn `<img src="...">` vào HTML.
 *
 * Phần thân form chỉ MOUNT khi sheet đang mở ⇒ state luôn được khởi tạo mới từ props,
 * không cần đồng bộ bằng `useEffect`.
 */
export const AnnouncementFormModal: React.FC<AnnouncementFormModalProps> = ({
  visible,
  onClose,
  onSuccess,
  announcement,
}) => {
  if (!visible) return null;

  return (
    <AnnouncementFormSheet
      key={announcement?.id || 'create'}
      onClose={onClose}
      onSuccess={onSuccess}
      announcement={announcement}
    />
  );
};

interface AnnouncementFormSheetProps {
  onClose: () => void;
  onSuccess?: (announcement: AnnouncementItem | null) => void;
  announcement?: AnnouncementItem | null;
}

const AnnouncementFormSheet: React.FC<AnnouncementFormSheetProps> = ({
  onClose,
  onSuccess,
  announcement,
}) => {
  const isEditing = Boolean(announcement?.id);

  const [form, setForm] = useState<FormState>(() => buildInitialForm(announcement));
  const [dateField, setDateField] = useState<DateField | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = useCreateAnnouncementMutation();
  const updateMutation = useUpdateAnnouncementMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Hook dùng chung của phase P3 (Teams/Users) — import TRỰC TIẾP, không qua barrel index.
  const { data: teams = [] } = useTeamsQuery();
  const { data: users = [] } = useUsersQuery();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handlePickAttachment = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const asset = res.assets[0];
      setIsUploading(true);
      const uploaded = await uploadToCloudinary(
        {
          uri: asset.uri,
          name: asset.name || `Đính kèm_${Date.now()}`,
          mimeType: asset.mimeType,
          size: asset.size,
        },
        ATTACHMENT_FOLDER,
      );

      updateField('attachmentUrl', uploaded.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Lỗi tải tệp', err?.message || 'Không thể tải tệp đính kèm lên máy chủ.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInsertImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền xem thư viện ảnh.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const asset = res.assets[0];
      setIsUploading(true);
      const uploaded = await uploadToCloudinary(
        {
          uri: asset.uri,
          name: asset.fileName || `Ảnh_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        },
        MEDIA_FOLDER,
      );

      const media: AnnouncementMedia = { url: uploaded.url, type: 'image', name: uploaded.name };
      setForm((prev) => ({
        ...prev,
        content: `${prev.content}${prev.content ? '\n' : ''}<img src="${uploaded.url}" alt="" />`,
        mediaUrls: [...prev.mediaUrls, media],
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Lỗi tải ảnh', err?.message || 'Không thể tải ảnh lên máy chủ.');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedTeamIds = useMemo(() => form.targetTeamIds, [form.targetTeamIds]);
  const selectedUserIds = useMemo(() => form.targetUserIds, [form.targetUserIds]);

  const buildPayload = (status: 'DRAFT' | 'SENT'): CreateAnnouncementPayload => {
    const payload: CreateAnnouncementPayload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      scopeType: form.scopeType,
      priority: form.priority,
      eventLocation: form.eventLocation.trim() || undefined,
      attachmentUrl: form.attachmentUrl || undefined,
      mediaUrls: form.mediaUrls.length > 0 ? form.mediaUrls : undefined,
      status,
    };

    const eventStartAt = toIsoOrUndefined(form.eventStartAt);
    const eventEndAt = toIsoOrUndefined(form.eventEndAt);
    if (eventStartAt) payload.eventStartAt = eventStartAt;
    if (eventEndAt) payload.eventEndAt = eventEndAt;

    // Chỉ gửi field đích danh tương ứng scopeType.
    if (form.scopeType === 'ROLE') payload.targetRoles = form.targetRoles;
    if (form.scopeType === 'TEAM') payload.targetTeamIds = form.targetTeamIds;
    if (form.scopeType === 'USER') payload.targetUserIds = form.targetUserIds;

    return payload;
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Vui lòng nhập tiêu đề thông báo.';
    if (!form.content.trim()) return 'Vui lòng nhập nội dung thông báo.';
    if (form.scopeType === 'ROLE' && form.targetRoles.length === 0) {
      return 'Vui lòng chọn ít nhất một vai trò nhận thông báo.';
    }
    if (form.scopeType === 'TEAM' && form.targetTeamIds.length === 0) {
      return 'Vui lòng chọn ít nhất một đội dự án nhận thông báo.';
    }
    if (form.scopeType === 'USER' && form.targetUserIds.length === 0) {
      return 'Vui lòng chọn ít nhất một người nhận thông báo.';
    }
    if (form.eventStartAt && form.eventEndAt && form.eventEndAt < form.eventStartAt) {
      return 'Ngày kết thúc không được trước ngày bắt đầu.';
    }
    return null;
  };

  const handleSubmit = async (status: 'DRAFT' | 'SENT') => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Thiếu thông tin', validationError);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const payload = buildPayload(status);

      const saved = isEditing && announcement
        ? await updateMutation.mutateAsync({ id: announcement.id, ...payload })
        : await createMutation.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Thành công',
        status === 'DRAFT'
          ? isEditing
            ? 'Đã cập nhật bản nháp.'
            : 'Đã lưu thông báo ở dạng nháp.'
          : isEditing
            ? 'Đã cập nhật và gửi thông báo.'
            : 'Đã gửi thông báo tới người nhận.',
      );
      onSuccess?.(saved);
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Lỗi', err?.message || 'Không thể lưu thông báo. Vui lòng thử lại.');
    }
  };

  const selectedDateField = dateField ? form[dateField] : undefined;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white rounded-t-3xl max-h-[92%] border-t border-slate-200">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="w-9 h-9 rounded-xl bg-primary-light border border-primary-border items-center justify-center">
                <Feather name="edit-3" size={17} color={BrandColors.primary} />
              </View>
              <Text className="text-base font-extrabold text-slate-900">
                {isEditing ? 'Chỉnh sửa thông báo' : 'Soạn thông báo'}
              </Text>
            </View>
            <TouchableOpacity
              className="w-11 h-11 rounded-xl bg-slate-100 items-center justify-center"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-5 py-4 gap-4"
            keyboardShouldPersistTaps="handled"
          >
            {/* Tiêu đề */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Tiêu đề <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Thông báo nghỉ lễ Quốc khánh 02/09"
                placeholderTextColor="#94A3B8"
                value={form.title}
                onChangeText={(value) => updateField('title', value)}
                testID="announcement-title-input"
              />
            </View>

            {/* Nội dung */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-slate-700">
                  Nội dung <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={handleInsertImage}
                  disabled={isUploading}
                  className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-light border border-primary-border"
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                  ) : (
                    <Feather name="image" size={12} color={BrandColors.primaryDark} />
                  )}
                  <Text className="text-[11px] font-extrabold text-primary-dark">Chèn ảnh</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                style={styles.contentInput}
                placeholder="Nhập nội dung thông báo..."
                placeholderTextColor="#94A3B8"
                value={form.content}
                onChangeText={(value) => updateField('content', value)}
                multiline
                textAlignVertical="top"
                testID="announcement-content-input"
              />
              <Text className="text-[10px] text-slate-400 mt-1">
                Hỗ trợ HTML cơ bản: &lt;p&gt;, &lt;br&gt;, &lt;strong&gt;, &lt;ul&gt;/&lt;li&gt;,
                &lt;blockquote&gt;, &lt;img&gt;
              </Text>
            </View>

            {/* Danh mục */}
            <FieldChipRow
              label="Danh mục"
              required
              values={ANNOUNCEMENT_CATEGORY_VALUES}
              labels={ANNOUNCEMENT_CATEGORY_LABELS}
              selected={[form.category]}
              onToggle={(value) => updateField('category', value)}
            />

            {/* Ưu tiên */}
            <FieldChipRow
              label="Ưu tiên"
              values={ANNOUNCEMENT_PRIORITY_VALUES}
              labels={ANNOUNCEMENT_PRIORITY_LABELS}
              selected={[form.priority]}
              onToggle={(value) => updateField('priority', value)}
            />

            {/* Phạm vi */}
            <FieldChipRow
              label="Phạm vi gửi"
              required
              values={ANNOUNCEMENT_SCOPE_VALUES}
              labels={ANNOUNCEMENT_SCOPE_LABELS}
              selected={[form.scopeType]}
              onToggle={(value) =>
                setForm((prev) => ({
                  ...prev,
                  scopeType: value,
                  targetRoles: [],
                  targetTeamIds: [],
                  targetUserIds: [],
                }))
              }
            />

            {form.scopeType === 'ROLE' ? (
              <FieldChipRow
                label="Vai trò nhận"
                required
                values={USER_ROLE_OPTIONS.map((option) => option.value)}
                labels={Object.fromEntries(
                  USER_ROLE_OPTIONS.map((option) => [option.value, option.label]),
                )}
                selected={form.targetRoles}
                onToggle={(value) => updateField('targetRoles', toggleValue(form.targetRoles, value))}
              />
            ) : null}

            {form.scopeType === 'TEAM' ? (
              <View>
                <Text className="text-xs font-bold text-slate-700 mb-1.5">
                  Đội dự án nhận <Text className="text-red-500">*</Text>
                </Text>
                {teams.length === 0 ? (
                  <Text className="text-[11px] text-slate-400 italic">
                    Chưa tải được danh sách đội dự án.
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-1.5">
                    {teams.map((team: any) => {
                      const isActive = selectedTeamIds.includes(team.id);
                      return (
                        <TouchableOpacity
                          key={team.id}
                          onPress={() =>
                            updateField('targetTeamIds', toggleValue(form.targetTeamIds, team.id))
                          }
                          className={`px-3 py-2 rounded-xl border min-h-[40px] justify-center ${
                            isActive
                              ? 'bg-primary border-primary'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}
                          >
                            {team.name || team.code || 'Đội dự án'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {form.scopeType === 'USER' ? (
              <View>
                <Text className="text-xs font-bold text-slate-700 mb-1.5">
                  Người nhận <Text className="text-red-500">*</Text>
                </Text>
                {users.length === 0 ? (
                  <Text className="text-[11px] text-slate-400 italic">
                    Chưa tải được danh sách nhân sự.
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-1.5">
                    {users.map((userItem) => {
                      const isActive = selectedUserIds.includes(userItem.id);
                      return (
                        <TouchableOpacity
                          key={userItem.id}
                          onPress={() =>
                            updateField('targetUserIds', toggleValue(form.targetUserIds, userItem.id))
                          }
                          className={`px-3 py-2 rounded-xl border min-h-[40px] justify-center ${
                            isActive
                              ? 'bg-primary border-primary'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}
                          >
                            {userItem.fullName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {/* Sự kiện */}
            <View className="gap-2.5">
              <Text className="text-xs font-bold text-slate-700">Sự kiện (nếu có)</Text>

              <View className="flex-row gap-2.5">
                <DateFieldButton
                  label="Bắt đầu"
                  value={form.eventStartAt}
                  onPress={() => setDateField('eventStartAt')}
                />
                <DateFieldButton
                  label="Kết thúc"
                  value={form.eventEndAt}
                  onPress={() => setDateField('eventEndAt')}
                />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-slate-600 mb-1">Diễn ra tại</Text>
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                  placeholder="VD: Hội trường tầng 5"
                  placeholderTextColor="#94A3B8"
                  value={form.eventLocation}
                  onChangeText={(value) => updateField('eventLocation', value)}
                />
              </View>
            </View>

            {/* Đính kèm */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">Tệp đính kèm</Text>
              {form.attachmentUrl ? (
                <View className="gap-2">
                  <DocumentCard
                    url={form.attachmentUrl}
                    onPreview={() => {}}
                  />
                  <TouchableOpacity
                    onPress={() => updateField('attachmentUrl', '')}
                    className="flex-row items-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100"
                  >
                    <Feather name="trash-2" size={12} color="#EF4444" />
                    <Text className="text-[11px] font-extrabold text-red-500">Gỡ tệp đính kèm</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickAttachment}
                  disabled={isUploading}
                  className="flex-row items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl py-3.5 min-h-[48px] bg-slate-50"
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                  ) : (
                    <Feather name="paperclip" size={14} color="#64748B" />
                  )}
                  <Text className="text-xs font-bold text-slate-600">
                    {isUploading ? 'Đang tải lên...' : 'Chọn tệp đính kèm'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View className="px-5 pt-3 pb-6 border-t border-slate-100 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-xl bg-slate-100 items-center justify-center min-h-[48px] border border-slate-200"
              onPress={() => handleSubmit('DRAFT')}
              disabled={isSubmitting}
              testID="announcement-save-draft"
            >
              <Text className="text-sm font-bold text-slate-700">Lưu nháp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 py-3.5 rounded-xl bg-primary items-center justify-center min-h-[48px] flex-row gap-2"
              onPress={() => handleSubmit('SENT')}
              disabled={isSubmitting}
              testID="announcement-send-now"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#FFFFFF" />
                  <Text className="text-sm font-extrabold text-white">Gửi ngay</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={dateField !== null}
        title={dateField === 'eventEndAt' ? 'Chọn ngày kết thúc' : 'Chọn ngày bắt đầu'}
        initialDate={selectedDateField}
        onConfirm={(_ddmmyyyy, yyyymmdd) => {
          if (dateField) updateField(dateField, yyyymmdd);
          setDateField(null);
        }}
        onClose={() => setDateField(null)}
      />
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldChipRowProps {
  label: string;
  values: string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
  required?: boolean;
}

const FieldChipRow: React.FC<FieldChipRowProps> = ({
  label,
  values,
  labels,
  selected,
  onToggle,
  required = false,
}) => (
  <View>
    <Text className="text-xs font-bold text-slate-700 mb-1.5">
      {label} {required ? <Text className="text-red-500">*</Text> : null}
    </Text>
    <View className="flex-row flex-wrap gap-1.5">
      {values.map((value) => {
        const isActive = selected.includes(value);
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onToggle(value)}
            className={`px-3 py-2 rounded-xl border min-h-[40px] justify-center ${
              isActive ? 'bg-primary border-primary' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>
              {labels[value] || value}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

interface DateFieldButtonProps {
  label: string;
  value: string;
  onPress: () => void;
}

const DateFieldButton: React.FC<DateFieldButtonProps> = ({ label, value, onPress }) => (
  <View className="flex-1">
    <Text className="text-[11px] font-bold text-slate-600 mb-1">{label}</Text>
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 min-h-[48px]"
    >
      <Text className={`text-xs ${value ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
        {value ? formatDateToDDMMYYYY(value) : 'Chọn ngày'}
      </Text>
      <Feather name="calendar" size={13} color="#64748B" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  contentInput: {
    minHeight: 140,
    maxHeight: 280,
  },
});

export default AnnouncementFormModal;
