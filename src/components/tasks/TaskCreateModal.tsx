import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { UserSelectorModal } from '@/components/users/UserSelectorModal';
import { BrandColors } from '@/constants/colors';
import { useCreateInternalTaskMutation } from '@/hooks/queries/useTasks';
import { uploadToCloudinary, type PickedFile } from '@/services/cloudinaryService';
import type { UserProfile } from '@/services/api';
import type { Team } from '@/services/teamService';
import type { UserItem } from '@/services/userService';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { isManagementRole, isProjectManagerRole } from '@/utils/rbac';

const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
const TASK_ATTACHMENT_FOLDER = 'GETVINI/ERP/tasks';

type DateField = 'start' | 'end';
type SelectorField = 'assignee' | 'supervisor';

interface TaskCreateModalProps {
  visible: boolean;
  currentUser: UserProfile;
  teams: Team[];
  onClose: () => void;
  onCreated: (taskId: string) => void;
}

type TaskCreateSheetProps = Omit<TaskCreateModalProps, 'visible'>;

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Không rõ dung lượng';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TaskCreateSheet: React.FC<TaskCreateSheetProps> = ({
  currentUser,
  teams,
  onClose,
  onCreated,
}) => {
  const insets = useSafeAreaInsets();
  const createTaskMutation = useCreateInternalTaskMutation();
  const isProjectManagementUser =
    isManagementRole(currentUser.role) || isProjectManagerRole(currentUser.role);

  const ledTeams = useMemo(
    () => teams.filter(
      (team) => team.teamLeadId === currentUser.id || team.teamLead?.id === currentUser.id,
    ),
    [currentUser.id, teams],
  );

  const allowedAssigneeIds = useMemo(() => {
    if (isProjectManagementUser) return undefined;
    const ids = new Set<string>([currentUser.id]);
    ledTeams.forEach((team) => {
      team.members?.forEach((member) => {
        const userId = member.user?.id || member.userId;
        if (userId) ids.add(userId);
      });
    });
    return Array.from(ids);
  }, [currentUser.id, isProjectManagementUser, ledTeams]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<UserItem | null>(null);
  const [supervisor, setSupervisor] = useState<UserItem | null>(
    isProjectManagementUser ? null : { id: currentUser.id, fullName: currentUser.fullName },
  );
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [links, setLinks] = useState(['']);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [dateField, setDateField] = useState<DateField | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isSubmitting = createTaskMutation.isPending || isUploading;

  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const picked = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || `Tệp_${Date.now()}`,
        mimeType: asset.mimeType,
        size: asset.size,
      }));
      const nextFiles = [...files, ...picked];
      if (nextFiles.length > MAX_FILES) {
        Alert.alert('Giới hạn tệp', `Mỗi công việc chỉ được đính kèm tối đa ${MAX_FILES} tệp.`);
        return;
      }
      const totalSize = nextFiles.reduce((total, file) => total + (file.size || 0), 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        Alert.alert('Tệp quá lớn', 'Tổng dung lượng tệp đính kèm không được vượt quá 25 MB.');
        return;
      }
      setFiles(nextFiles);
    } catch (error: any) {
      Alert.alert('Không thể chọn tệp', error?.message || 'Vui lòng thử lại.');
    }
  };

  const updateLink = (index: number, value: string) => {
    setLinks((current) => current.map((link, linkIndex) => linkIndex === index ? value : link));
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const supervisorId = isProjectManagementUser ? supervisor?.id : currentUser.id;
    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên công việc.');
      return;
    }
    if (!assignee?.id) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn người thực hiện.');
      return;
    }
    if (!supervisorId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn người giám sát.');
      return;
    }
    if (!plannedEndDate) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn hạn chót.');
      return;
    }
    if (plannedStartDate && plannedStartDate > plannedEndDate) {
      Alert.alert('Ngày không hợp lệ', 'Ngày bắt đầu không được sau hạn chót.');
      return;
    }

    try {
      setIsUploading(files.length > 0);
      const uploadedFiles = await Promise.all(
        files.map((file) => uploadToCloudinary(file, TASK_ATTACHMENT_FOLDER)),
      );
      setIsUploading(false);

      const linkAttachments = links
        .map((link) => link.trim())
        .filter(Boolean)
        .map((url) => ({ type: 'LINK', name: url, url }));

      const task = await createTaskMutation.mutateAsync({
        name: trimmedName,
        assigneeId: assignee.id,
        supervisorId,
        description: description.trim() || undefined,
        plannedStartDate: plannedStartDate
          ? new Date(`${plannedStartDate}T00:00:00`).toISOString()
          : undefined,
        plannedEndDate: new Date(`${plannedEndDate}T23:59:59`).toISOString(),
        attachments: [...linkAttachments, ...uploadedFiles],
      });

      if (!task?.id) throw new Error('Máy chủ không trả về mã công việc mới.');
      Alert.alert('Thành công', 'Đã tạo công việc nội bộ.');
      onCreated(task.id);
    } catch (error: any) {
      setIsUploading(false);
      Alert.alert('Không thể tạo công việc', error?.message || 'Vui lòng kiểm tra dữ liệu và thử lại.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-end bg-slate-900/55"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="max-h-[94%] rounded-t-[28px] bg-white"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Feather name="plus" size={21} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-slate-900">Tạo công việc khác</Text>
              <Text className="mt-0.5 text-[11px] text-slate-500">Công việc nội bộ không thuộc dự án</Text>
            </View>
          </View>
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Feather name="x" size={19} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="px-5"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 18, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1.5">
            <Text className="text-xs font-bold text-slate-700">Tên công việc <Text className="text-red-500">*</Text></Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              placeholder="Nhập tên công việc..."
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              maxLength={255}
            />
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-700">Người giám sát <Text className="text-red-500">*</Text></Text>
            {isProjectManagementUser ? (
              <TouchableOpacity
                className="min-h-[48px] flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3"
                onPress={() => setSelectorField('supervisor')}
              >
                <Feather name="shield" size={17} color={BrandColors.primary} />
                <Text className={`ml-2 flex-1 text-sm ${supervisor ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                  {supervisor?.fullName || 'Chọn người giám sát'}
                </Text>
                <Feather name="chevron-down" size={17} color="#94A3B8" />
              </TouchableOpacity>
            ) : (
              <View className="min-h-[48px] flex-row items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3">
                <Feather name="shield" size={17} color="#059669" />
                <View className="ml-2 flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{currentUser.fullName}</Text>
                  <Text className="text-[10px] text-emerald-700">Team Lead tự động giám sát</Text>
                </View>
              </View>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-700">Người thực hiện <Text className="text-red-500">*</Text></Text>
            <TouchableOpacity
              className="min-h-[48px] flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3"
              onPress={() => setSelectorField('assignee')}
            >
              <Feather name="user" size={17} color={BrandColors.primary} />
              <Text className={`ml-2 flex-1 text-sm ${assignee ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                {assignee?.fullName || 'Chọn người thực hiện'}
              </Text>
              <Feather name="chevron-down" size={17} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-bold text-slate-700">Bắt đầu</Text>
              <TouchableOpacity
                className="min-h-[48px] flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3"
                onPress={() => setDateField('start')}
              >
                <Feather name="calendar" size={16} color="#64748B" />
                <Text className={`ml-2 flex-1 text-xs ${plannedStartDate ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                  {plannedStartDate ? formatDateToDDMMYYYY(plannedStartDate) : 'Không bắt buộc'}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-bold text-slate-700">Hạn chót <Text className="text-red-500">*</Text></Text>
              <TouchableOpacity
                className="min-h-[48px] flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3"
                onPress={() => setDateField('end')}
              >
                <Feather name="calendar" size={16} color="#64748B" />
                <Text className={`ml-2 flex-1 text-xs ${plannedEndDate ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                  {plannedEndDate ? formatDateToDDMMYYYY(plannedEndDate) : 'Chọn ngày'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-bold text-slate-700">Mô tả</Text>
            <TextInput
              className="min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900"
              placeholder="Mô tả chi tiết công việc..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700">Liên kết tham khảo</Text>
              <TouchableOpacity onPress={() => setLinks((current) => [...current, ''])}>
                <Text className="text-xs font-bold text-primary">Thêm link</Text>
              </TouchableOpacity>
            </View>
            {links.map((link, index) => (
              <View key={`link-${index}`} className="flex-row items-center gap-2">
                <View className="min-h-[48px] flex-1 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <Feather name="link" size={15} color="#64748B" />
                  <TextInput
                    className="ml-2 flex-1 text-sm text-slate-900"
                    placeholder="https://..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="url"
                    value={link}
                    onChangeText={(value) => updateLink(index, value)}
                  />
                </View>
                {links.length > 1 ? (
                  <TouchableOpacity
                    className="h-11 w-11 items-center justify-center rounded-xl bg-red-50"
                    onPress={() => setLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))}
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-700">Tệp đính kèm</Text>
                <Text className="mt-0.5 text-[10px] text-slate-400">Tối đa 5 tệp, tổng dung lượng 25 MB</Text>
              </View>
              <TouchableOpacity
                className="min-h-[44px] flex-row items-center rounded-xl bg-blue-50 px-3"
                onPress={handlePickFiles}
                disabled={files.length >= MAX_FILES}
              >
                <Feather name="paperclip" size={15} color="#2563EB" />
                <Text className="ml-1.5 text-xs font-bold text-blue-600">Chọn tệp</Text>
              </TouchableOpacity>
            </View>
            {files.map((file, index) => (
              <View key={`${file.uri}-${index}`} className="flex-row items-center rounded-xl border border-slate-100 bg-slate-50 p-3">
                <Feather name="file" size={17} color="#64748B" />
                <View className="ml-2 flex-1">
                  <Text className="text-xs font-semibold text-slate-800" numberOfLines={1}>{file.name}</Text>
                  <Text className="text-[10px] text-slate-400">{formatFileSize(file.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>
                  <Feather name="x-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="flex-row gap-3 border-t border-slate-100 px-5 pt-4">
          <TouchableOpacity
            className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text className="text-sm font-bold text-slate-600">Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`min-h-[48px] flex-[1.5] flex-row items-center justify-center rounded-xl bg-blue-600 ${isSubmitting ? 'opacity-60' : ''}`}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">
                  {isUploading ? 'Đang tải tệp...' : 'Đang tạo...'}
                </Text>
              </>
            ) : (
              <Text className="text-sm font-bold text-white">Tạo công việc</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <UserSelectorModal
        visible={selectorField !== null}
        onClose={() => setSelectorField(null)}
        title={selectorField === 'supervisor' ? 'Chọn người giám sát' : 'Chọn người thực hiện'}
        allowedUserIds={selectorField === 'assignee' ? allowedAssigneeIds : undefined}
        onSelect={(user) => {
          if (selectorField === 'supervisor') setSupervisor(user);
          if (selectorField === 'assignee') setAssignee(user);
        }}
      />

      <DatePickerModal
        visible={dateField !== null}
        title={dateField === 'start' ? 'Chọn ngày bắt đầu' : 'Chọn hạn chót'}
        initialDate={dateField === 'start' ? plannedStartDate : plannedEndDate}
        onClose={() => setDateField(null)}
        onConfirm={(_, yyyyMmDd) => {
          if (dateField === 'start') setPlannedStartDate(yyyyMmDd);
          if (dateField === 'end') setPlannedEndDate(yyyyMmDd);
          setDateField(null);
        }}
      />
    </KeyboardAvoidingView>
  );
};

export default function TaskCreateModal(props: TaskCreateModalProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible ? (
        <TaskCreateSheet
          currentUser={props.currentUser}
          teams={props.teams}
          onClose={props.onClose}
          onCreated={props.onCreated}
        />
      ) : null}
    </Modal>
  );
}
