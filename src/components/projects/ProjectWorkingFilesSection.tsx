import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Clipboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ProjectDetailItem, WorkingFileItem } from '@/services/projectService';
import { useUpdateWorkingFilesMutation } from '@/hooks/queries/useProjects';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { useAuthStore } from '@/stores/useAuthStore';
import { BrandColors } from '@/constants/colors';

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const formatFileSize = (bytes?: number) => {
  if (!bytes || typeof bytes !== 'number' || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa có';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

const getDomainFromUrl = (url: string) => {
  try {
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im);
    return match ? match[1] : '';
  } catch {
    return '';
  }
};

const getFileIconName = (file: WorkingFileItem): keyof typeof Feather.glyphMap => {
  if (file.type === 'LINK') {
    return 'link';
  }
  const nameOrUrl = (file.name || file.url || '').toLowerCase();
  if (nameOrUrl.match(/\.(xlsx|xls|csv)$/)) return 'grid';
  if (nameOrUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image';
  if (nameOrUrl.match(/\.(zip|rar|7z|tar|gz)$/)) return 'archive';
  if (nameOrUrl.match(/\.(pdf)$/)) return 'file-text';
  return 'file';
};

interface ProjectWorkingFilesSectionProps {
  project: ProjectDetailItem;
}

export const ProjectWorkingFilesSection: React.FC<ProjectWorkingFilesSectionProps> = ({ project }) => {
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || '';
  const userRole = user?.role || '';

  const updateWorkingFilesMutation = useUpdateWorkingFilesMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'LINK' | 'FILE'>('LINK');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link mode state
  const [linkRows, setLinkRows] = useState<{ name: string; url: string }[]>([
    { name: '', url: '' },
  ]);

  // File mode state
  const [singleFile, setSingleFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [singleFileName, setSingleFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const isOnHold = project.status === 'ON_HOLD' || Boolean((project as any).isOnHold);
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(project.status || '');

  const workingFiles: WorkingFileItem[] = Array.isArray(project.workingFiles)
    ? project.workingFiles
    : [];

  const canManageAll = ['BOD', 'ADMIN', 'ADMIN_SALE', 'PM'].includes(userRole);
  const isTeamLead =
    Boolean(project.team?.teamLead?.id) &&
    project.team?.teamLead?.id === currentUserId;

  const canDeleteFile = (file: WorkingFileItem) => {
    if (isOnHold || isClosed) return false;
    if (canManageAll || isTeamLead) return true;
    return Boolean(file.createdById && file.createdById === currentUserId);
  };

  const handleCopyLink = (file: WorkingFileItem) => {
    if (!file.url) return;
    try {
      Clipboard.setString(file.url);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
      Alert.alert('Thành công', 'Đã sao chép đường dẫn tài liệu');
    } catch {
      Alert.alert('Lỗi', 'Không thể sao chép link');
    }
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    const finalUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    Linking.openURL(finalUrl).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết này');
    });
  };

  const handleDeleteFile = (file: WorkingFileItem) => {
    if (isClosed) {
      Alert.alert('Thông báo', 'Dự án đã hoàn tất hoặc đã đóng, không thể xóa tài liệu.');
      return;
    }
    if (isOnHold) {
      Alert.alert('Thông báo', 'Dự án đang tạm dừng, không thể xóa tài liệu.');
      return;
    }

    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa tài liệu "${file.name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const updated = workingFiles.filter((item) => item.id !== file.id);
            try {
              await updateWorkingFilesMutation.mutateAsync({
                projectId: project.id,
                workingFiles: updated,
              });
              Alert.alert('Thành công', `Đã xóa tài liệu "${file.name}"`);
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi xóa tài liệu');
            }
          },
        },
      ]
    );
  };

  const handleOpenModal = () => {
    if (isClosed) {
      Alert.alert('Thông báo', 'Dự án đã hoàn tất hoặc đã đóng, không thể thêm tài liệu.');
      return;
    }
    if (isOnHold) {
      Alert.alert('Thông báo', 'Dự án đang tạm dừng, không thể thêm tài liệu.');
      return;
    }
    setActiveTab('LINK');
    setLinkRows([{ name: '', url: '' }]);
    setSingleFile(null);
    setSingleFileName('');
    setUploadProgress(0);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
  };

  const handleAddLinkRow = () => {
    setLinkRows((prev) => [...prev, { name: '', url: '' }]);
  };

  const handleRemoveLinkRow = (index: number) => {
    setLinkRows((prev) => {
      if (prev.length <= 1) return [{ name: '', url: '' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdateLinkRow = (index: number, field: 'name' | 'url', value: string) => {
    setLinkRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handlePickSingleFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const picked = res.assets[0];
      const extension = (picked.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        Alert.alert(
          'Định dạng không hợp lệ',
          'Chỉ chấp nhận các loại file: PDF, Word (.doc, .docx) và Excel (.xls, .xlsx, .csv)'
        );
        return;
      }

      if (picked.size && picked.size > MAX_FILE_SIZE) {
        Alert.alert(
          'File quá dung lượng',
          `Kích thước file không được vượt quá 10MB (file của bạn: ${formatFileSize(picked.size)})`
        );
        return;
      }

      setSingleFile({
        uri: picked.uri,
        name: picked.name,
        size: picked.size,
        mimeType: picked.mimeType,
      });

      if (!singleFileName.trim()) {
        setSingleFileName(picked.name);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', `Không thể chọn file: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    if (isOnHold) {
      Alert.alert('Thông báo', 'Dự án đang tạm dừng, không thể lưu tài liệu.');
      return;
    }

    const newItems: WorkingFileItem[] = [];

    if (activeTab === 'LINK') {
      for (let i = 0; i < linkRows.length; i++) {
        const row = linkRows[i];
        if (!row.name.trim()) {
          Alert.alert('Thiếu thông tin', `Dòng ${i + 1}: Vui lòng nhập tên tài liệu / link`);
          return;
        }
        if (!row.url.trim()) {
          Alert.alert('Thiếu thông tin', `Dòng ${i + 1}: Vui lòng nhập đường dẫn URL`);
          return;
        }
      }

      linkRows.forEach((row) => {
        newItems.push({
          id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: row.name.trim(),
          url: row.url.trim(),
          type: 'LINK',
          createdAt: new Date().toISOString(),
          createdById: currentUserId,
          createdByName: user?.fullName || 'Thành viên',
        });
      });
    } else {
      if (!singleFile) {
        Alert.alert('Thiếu tệp', 'Vui lòng chọn 1 tệp tin tải lên');
        return;
      }

      if (!singleFileName.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên tài liệu');
        return;
      }

      setIsSubmitting(true);
      try {
        setUploadProgress(0);
        const uploadResult = await uploadToCloudinary(
          singleFile,
          'GETVINI/ERP/projects/working-files',
          (p) => setUploadProgress(p)
        );

        newItems.push({
          id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: singleFileName.trim(),
          url: uploadResult.url,
          type: 'FILE',
          size: uploadResult.size || singleFile.size,
          createdAt: new Date().toISOString(),
          createdById: currentUserId,
          createdByName: user?.fullName || 'Thành viên',
        });
      } catch (err: any) {
        setIsSubmitting(false);
        Alert.alert('Lỗi tải tệp', err.message || 'Không thể tải file lên Cloudinary');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const merged = [...workingFiles, ...newItems];
      await updateWorkingFilesMutation.mutateAsync({
        projectId: project.id,
        workingFiles: merged,
      });

      Alert.alert(
        'Thành công',
        activeTab === 'LINK'
          ? `Đã thêm ${newItems.length} link tài liệu thành công!`
          : `Đã tải lên tài liệu "${singleFileName}" thành công!`
      );
      setIsModalOpen(false);
    } catch (err: any) {
      Alert.alert('Lỗi lưu tài liệu', err.message || 'Có lỗi xảy ra khi lưu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="bg-surface rounded-2xl border border-border p-4 shadow-sm mb-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1 mr-2">
          <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Feather name="folder" size={16} color={BrandColors.primary} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-sm font-bold text-text-primary mr-1.5">
                Tài liệu làm việc
              </Text>
              <View className="px-1.5 py-0.5 rounded-full bg-primary/15">
                <Text className="text-[10px] font-bold text-primary">
                  {workingFiles.length}
                </Text>
              </View>
            </View>
            <Text className="text-[11px] text-text-muted" numberOfLines={1}>
              Figma, Drive, docs hoặc file đính kèm
            </Text>
          </View>
        </View>

        {!isClosed && (
          <TouchableOpacity
            onPress={handleOpenModal}
            disabled={isOnHold}
            className={`flex-row items-center px-2.5 py-1.5 rounded-xl bg-primary ${
              isOnHold ? 'opacity-50' : 'active:opacity-80'
            }`}
          >
            <Feather name="plus" size={13} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white ml-1">Thêm</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* On-hold Notice */}
      {isOnHold && (
        <View className="mb-3 flex-row items-center p-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <Feather name="alert-triangle" size={14} color="#D97706" style={{ marginRight: 6 }} />
          <Text className="text-[11px] text-amber-800 font-medium flex-1">
            Dự án đang tạm dừng. Các chức năng thêm/xóa tài liệu làm việc tạm thời bị khóa.
          </Text>
        </View>
      )}

      {/* Files List or Empty State */}
      {workingFiles.length === 0 ? (
        <View className="flex-col items-center justify-center p-5 rounded-xl border border-dashed border-border bg-slate-50/50">
          <View className="w-9 h-9 rounded-xl bg-white border border-border items-center justify-center mb-2 shadow-xs">
            <Feather name="paperclip" size={18} color="#94A3B8" />
          </View>
          <Text className="text-xs font-semibold text-text-secondary text-center mb-0.5">
            Chưa có tài liệu làm việc nào
          </Text>
          <Text className="text-[11px] text-text-muted text-center max-w-[260px] mb-3">
            Dán link Figma, Drive, Docs hoặc tải 1 file để cả nhóm cùng truy cập.
          </Text>
          {!isClosed && (
            <TouchableOpacity
              onPress={handleOpenModal}
              disabled={isOnHold}
              className={`flex-row items-center px-3 py-1.5 rounded-xl bg-primary/10 ${
                isOnHold ? 'opacity-50' : 'active:opacity-80'
              }`}
            >
              <Feather name="plus" size={12} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary ml-1">
                Thêm tài liệu đầu tiên
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View className="gap-2">
          {workingFiles.map((file) => {
            const domain = file.type === 'LINK' ? getDomainFromUrl(file.url) : '';
            const iconName = getFileIconName(file);
            const canDelete = canDeleteFile(file);

            return (
              <View
                key={file.id}
                className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-white"
              >
                <TouchableOpacity
                  onPress={() => handleOpenLink(file.url)}
                  className="flex-row items-center flex-1 mr-2"
                >
                  <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-2.5">
                    <Feather
                      name={iconName}
                      size={15}
                      color={file.type === 'LINK' ? BrandColors.primary : '#475569'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-text-primary" numberOfLines={1}>
                      {file.name}
                    </Text>
                    <View className="flex-row items-center mt-0.5 flex-wrap gap-1">
                      {domain ? (
                        <Text className="text-[10px] text-primary font-medium">
                          {domain} •
                        </Text>
                      ) : null}
                      {file.size ? (
                        <Text className="text-[10px] text-text-muted font-medium">
                          {formatFileSize(file.size)} •
                        </Text>
                      ) : null}
                      <Text className="text-[10px] text-text-muted">
                        {file.createdByName || 'Thành viên'}
                      </Text>
                      <Text className="text-[10px] text-text-muted">
                        • {formatDateTime(file.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Actions */}
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={() => handleCopyLink(file)}
                    className="w-7 h-7 rounded-lg bg-slate-100 items-center justify-center active:bg-slate-200"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather
                      name={copiedId === file.id ? 'check' : 'copy'}
                      size={13}
                      color={copiedId === file.id ? '#10B981' : '#64748B'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenLink(file.url)}
                    className="w-7 h-7 rounded-lg bg-slate-100 items-center justify-center active:bg-slate-200"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="external-link" size={13} color="#64748B" />
                  </TouchableOpacity>

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() => handleDeleteFile(file)}
                      className="w-7 h-7 rounded-lg bg-rose-50 items-center justify-center active:bg-rose-100"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="trash-2" size={13} color="#E11D48" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal Thêm tài liệu làm việc */}
      <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-surface rounded-t-3xl p-4 max-h-[85%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-3">
              <View className="flex-row items-center">
                <Feather name="folder-plus" size={18} color={BrandColors.primary} style={{ marginRight: 8 }} />
                <Text className="text-base font-bold text-text-primary">
                  Thêm tài liệu làm việc
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseModal}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Method Tabs: LINK vs FILE */}
            <View className="flex-row bg-slate-100 p-1 rounded-xl mb-4">
              <TouchableOpacity
                onPress={() => setActiveTab('LINK')}
                className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${
                  activeTab === 'LINK' ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Feather
                  name="link"
                  size={14}
                  color={activeTab === 'LINK' ? BrandColors.primary : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className={`text-xs font-bold ${
                    activeTab === 'LINK' ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  Link / Đường dẫn
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('FILE')}
                className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${
                  activeTab === 'FILE' ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Feather
                  name="upload-cloud"
                  size={14}
                  color={activeTab === 'FILE' ? BrandColors.primary : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className={`text-xs font-bold ${
                    activeTab === 'FILE' ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  Tải tệp tin
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              {activeTab === 'LINK' ? (
                <View className="gap-3">
                  {linkRows.map((row, idx) => (
                    <View
                      key={idx}
                      className="p-3 rounded-xl border border-border bg-slate-50/50 gap-2 relative"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-text-secondary">
                          Link #{idx + 1}
                        </Text>
                        {linkRows.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveLinkRow(idx)}
                            className="p-1"
                          >
                            <Feather name="trash-2" size={13} color="#E11D48" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View>
                        <Text className="text-[11px] font-semibold text-text-muted mb-1">
                          Tên tài liệu / link *
                        </Text>
                        <TextInput
                          value={row.name}
                          onChangeText={(t) => handleUpdateLinkRow(idx, 'name', t)}
                          placeholder="Ví dụ: Link Figma thiết kế App"
                          placeholderTextColor="#94A3B8"
                          className="bg-white border border-border rounded-xl px-3 py-2 text-xs text-text-primary"
                        />
                      </View>

                      <View>
                        <Text className="text-[11px] font-semibold text-text-muted mb-1">
                          Đường dẫn URL *
                        </Text>
                        <TextInput
                          value={row.url}
                          onChangeText={(t) => handleUpdateLinkRow(idx, 'url', t)}
                          placeholder="https://figma.com/file/... hoặc https://drive.google.com/..."
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="none"
                          keyboardType="url"
                          className="bg-white border border-border rounded-xl px-3 py-2 text-xs text-text-primary"
                        />
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleAddLinkRow}
                    className="flex-row items-center justify-center py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 active:bg-primary/10"
                  >
                    <Feather name="plus" size={14} color={BrandColors.primary} />
                    <Text className="text-xs font-bold text-primary ml-1.5">
                      Thêm link khác
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="gap-3">
                  <View className="p-3 rounded-xl border border-border bg-slate-50/50 gap-2">
                    <Text className="text-[11px] font-semibold text-text-muted">
                      Chọn tệp tin (PDF, Word, Excel - Max 10MB) *
                    </Text>
                    <TouchableOpacity
                      onPress={handlePickSingleFile}
                      className="flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
                    >
                      <Feather name="upload-cloud" size={20} color={BrandColors.primary} />
                      <Text className="text-xs font-bold text-primary ml-2">
                        {singleFile ? 'Chọn lại file khác' : 'Chọn tệp từ máy'}
                      </Text>
                    </TouchableOpacity>

                    {singleFile && (
                      <View className="p-2.5 rounded-lg bg-white border border-border flex-row items-center justify-between mt-1">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Feather name="file-text" size={14} color={BrandColors.primary} style={{ marginRight: 6 }} />
                          <View className="flex-1">
                            <Text className="text-xs font-bold text-text-primary" numberOfLines={1}>
                              {singleFile.name}
                            </Text>
                            {singleFile.size ? (
                              <Text className="text-[10px] text-text-muted">
                                {formatFileSize(singleFile.size)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setSingleFile(null)}>
                          <Feather name="x" size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="text-[11px] font-semibold text-text-muted mb-1">
                      Tên hiển thị của tài liệu *
                    </Text>
                    <TextInput
                      value={singleFileName}
                      onChangeText={setSingleFileName}
                      placeholder="Ví dụ: Kịch bản video hoàn chỉnh.pdf"
                      placeholderTextColor="#94A3B8"
                      className="bg-white border border-border rounded-xl px-3 py-2 text-xs text-text-primary"
                    />
                  </View>

                  {isSubmitting && uploadProgress > 0 && (
                    <View className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-medium text-blue-700">
                          Đang tải tệp lên Cloudinary...
                        </Text>
                        <Text className="text-xs font-bold text-blue-700">
                          {uploadProgress}%
                        </Text>
                      </View>
                      <View className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                        <View
                          style={{ width: `${uploadProgress}%` }}
                          className="h-full bg-blue-600 rounded-full"
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Footer Buttons */}
            <View className="flex-row gap-2 pt-2 border-t border-border">
              <TouchableOpacity
                onPress={handleCloseModal}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <Text className="text-xs font-bold text-text-secondary">Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-2.5 rounded-xl bg-primary items-center justify-center ${
                  isSubmitting ? 'opacity-70' : 'active:opacity-80'
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-bold text-white">Lưu tài liệu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
