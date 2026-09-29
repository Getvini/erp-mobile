import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import { useUpdateUserLaborContractsMutation } from '@/hooks/queries/useUsers';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { LaborContractFile, UserItem } from '@/services/userService';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';

/** Folder Cloudinary chuẩn cho hợp đồng lao động nhân sự. */
const LABOR_CONTRACT_FOLDER = 'GETVINI/ERP/user/labor_contract';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONTRACTS = 5;

const formatFileSize = (bytes?: number): string => {
  if (!bytes || typeof bytes !== 'number' || bytes <= 0) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const getExtension = (fileName?: string): string =>
  (fileName || '').split('?')[0].split('.').pop()?.toLowerCase() || '';

const getFileIcon = (file: LaborContractFile): keyof typeof Feather.glyphMap => {
  const ext = getExtension(file.name || file.url);
  if (ext === 'pdf') return 'file-text';
  return 'image';
};

interface LaborContractSectionProps {
  user: UserItem;
  /** Chỉ ADMIN/BOD (canManageUsers) mới được tải lên / xóa hợp đồng. */
  canManage?: boolean;
}

export const LaborContractSection: React.FC<LaborContractSectionProps> = ({
  user,
  canManage = false,
}) => {
  const updateLaborContractsMutation = useUpdateUserLaborContractsMutation();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const contracts: LaborContractFile[] = Array.isArray(user.laborContract)
    ? user.laborContract.filter((item) => Boolean(item?.url))
    : [];

  const isBusy = isUploading || updateLaborContractsMutation.isPending;

  const handlePreview = (file: LaborContractFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewName(file.name);
    setPreviewUrl(file.url);
  };

  const handleDownload = (file: LaborContractFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(file.url).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết tải tệp trên thiết bị này.');
    });
  };

  const handleDelete = (file: LaborContractFile) => {
    if (!canManage || isBusy) return;
    Alert.alert(
      'Xóa hợp đồng lao động',
      `Bạn có chắc muốn xóa tệp “${file.name}”? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tệp',
          style: 'destructive',
          onPress: async () => {
            const remaining = contracts.filter((item) => item.url !== file.url);
            try {
              await updateLaborContractsMutation.mutateAsync({
                id: user.id,
                // Mảng rỗng ⇒ backend xóa sạch hợp đồng.
                laborContract: remaining,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa tệp hợp đồng lao động.');
            } catch (err: unknown) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const message = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
              Alert.alert('Không thể xóa tệp', message);
            }
          },
        },
      ],
    );
  };

  const handlePickAndUpload = async () => {
    if (!canManage || isBusy) return;

    if (contracts.length >= MAX_CONTRACTS) {
      Alert.alert(
        'Đã đạt giới hạn',
        `Mỗi nhân sự chỉ lưu tối đa ${MAX_CONTRACTS} hợp đồng lao động. Vui lòng xóa bớt trước khi thêm mới.`,
      );
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || !picked.assets || picked.assets.length === 0) return;

      const asset = picked.assets[0];
      const extension = getExtension(asset.name);

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        Alert.alert(
          'Định dạng không hợp lệ',
          'Chỉ chấp nhận tệp PDF, PNG, JPG, JPEG hoặc WEBP.',
        );
        return;
      }

      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(
          'Tệp quá dung lượng',
          `Kích thước tệp không được vượt quá 10MB (tệp của bạn: ${formatFileSize(asset.size)}).`,
        );
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      // 1) Upload Cloudinary trước (KHÔNG dùng multipart qua backend).
      const uploaded = await uploadToCloudinary(
        {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        },
        LABOR_CONTRACT_FOLDER,
        (percent) => setUploadProgress(percent),
      );

      // 2) Gửi toàn bộ mảng metadata (mảng mới = mảng cũ + tệp vừa upload).
      const metadata: LaborContractFile = {
        ...uploaded,
        name: asset.name,
        uploadedAt: new Date().toISOString(),
      };

      await updateLaborContractsMutation.mutateAsync({
        id: user.id,
        laborContract: [...contracts, metadata],
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', `Đã tải lên hợp đồng “${asset.name}”.`);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      Alert.alert('Không thể tải tệp lên', message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
            <Feather name="file-text" size={15} color={BrandColors.primary} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-sm font-bold text-slate-900">Hợp đồng lao động</Text>
              <View className="rounded-full bg-orange-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-orange-700">
                  {contracts.length}/{MAX_CONTRACTS}
                </Text>
              </View>
            </View>
            <Text className="text-[11px] text-slate-400">PDF, PNG, JPG, WEBP • tối đa 10MB/tệp</Text>
          </View>
        </View>
      </View>

      {/* Danh sách hợp đồng */}
      {contracts.length === 0 ? (
        <View className="items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5">
          <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Feather name="folder" size={17} color="#94A3B8" />
          </View>
          <Text className="text-xs font-semibold text-slate-500">
            Chưa có hợp đồng lao động nào
          </Text>
          <Text className="mt-0.5 text-center text-[11px] text-slate-400">
            {canManage
              ? 'Tải lên bản scan hợp đồng để lưu trữ trong hồ sơ nhân sự.'
              : 'Hồ sơ nhân sự này chưa được đính kèm hợp đồng lao động.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {contracts.map((file, index) => (
            <View
              key={`${file.url}-${index}`}
              className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
            >
              <View className="mr-2 flex-1 flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Feather name={getFileIcon(file)} size={15} color="#475569" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                    {file.name || 'Hợp đồng lao động'}
                  </Text>
                  <Text className="mt-0.5 text-[10px] font-medium text-slate-400">
                    {formatFileSize(file.size)}
                    {file.format ? ` • ${String(file.format).toUpperCase()}` : ''}
                    {file.uploadedAt ? ` • ${formatDateToDDMMYYYY(file.uploadedAt)}` : ''}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  testID={`laborPreview-${index}`}
                  className="min-h-[44px] flex-row items-center gap-1 rounded-lg border border-orange-100 bg-orange-50 px-2.5"
                  onPress={() => handlePreview(file)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Xem trước ${file.name}`}
                >
                  <Feather name="eye" size={13} color="#EA580C" />
                  <Text className="text-[11px] font-bold text-orange-700">Xem</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID={`laborDownload-${index}`}
                  className="h-11 w-11 items-center justify-center rounded-lg bg-slate-100"
                  onPress={() => handleDownload(file)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Tải ${file.name}`}
                >
                  <Feather name="download" size={14} color="#475569" />
                </TouchableOpacity>

                {canManage ? (
                  <TouchableOpacity
                    testID={`laborDelete-${index}`}
                    className="h-11 w-11 items-center justify-center rounded-lg bg-rose-50"
                    onPress={() => handleDelete(file)}
                    disabled={isBusy}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Xóa ${file.name}`}
                    accessibilityState={{ disabled: isBusy }}
                  >
                    <Feather name="trash-2" size={14} color="#E11D48" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Upload tiến trình */}
      {isUploading ? (
        <View className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-xs font-medium text-blue-700">Đang tải tệp lên Cloudinary...</Text>
            <Text className="text-xs font-bold text-blue-700">{uploadProgress}%</Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-blue-200">
            <View style={{ width: `${uploadProgress}%` }} className="h-full rounded-full bg-blue-600" />
          </View>
        </View>
      ) : null}

      {/* Nút cập nhật file mới — chỉ hiện khi có quyền quản lý */}
      {canManage ? (
        <TouchableOpacity
          testID="laborUploadButton"
          className={`mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-orange-50/70 ${
            isBusy ? 'opacity-60' : ''
          }`}
          onPress={handlePickAndUpload}
          disabled={isBusy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Cập nhật hợp đồng lao động mới"
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Feather name="upload-cloud" size={16} color={BrandColors.primary} />
          )}
          <Text className="text-xs font-bold text-orange-700">Cập nhật file mới</Text>
        </TouchableOpacity>
      ) : null}

      {previewUrl ? (
        <DocumentPreviewModal
          visible={Boolean(previewUrl)}
          url={previewUrl}
          fileName={previewName}
          onClose={() => setPreviewUrl(null)}
        />
      ) : null}
    </View>
  );
};

export default LaborContractSection;
