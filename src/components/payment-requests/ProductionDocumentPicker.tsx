import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  PaymentDocType,
  PAYMENT_DOC_TYPES,
  formatDocFileName,
} from '@/utils/paymentRequestHelper';

export interface ProductionDocItem {
  id: string;
  uri: string;
  name: string;
  standardName: string;
  type: string;
  docType: PaymentDocType;
  size?: number;
  isGeneratedDoc?: boolean;
  docData?: any;
}

export interface ProductionDocumentPickerProps {
  files: ProductionDocItem[];
  onChange: (files: ProductionDocItem[]) => void;
  projectName?: string;
  requestType?: string;
  maxFilesPerCategory?: number;
  onOpenTemplateModal?: () => void;
}

interface CategoryConfig {
  key: PaymentDocType;
  title: string;
  badge: string;
  iconName: keyof typeof Feather.glyphMap;
  hint: string;
}

const CATEGORY_ICONS: Record<PaymentDocType, keyof typeof Feather.glyphMap> = {
  LABOR_CONTRACT: 'file-text',
  ACCEPTANCE_MINUTE: 'check-square',
  ADDENDUM: 'file-plus',
  VAT_INVOICE: 'dollar-sign',
  PAYMENT_REQUEST_DOC: 'paperclip',
  OTHER_INVOICE: 'file',
};

const ORDERED_CATEGORY_KEYS: PaymentDocType[] = [
  'LABOR_CONTRACT',
  'ACCEPTANCE_MINUTE',
  'ADDENDUM',
  'VAT_INVOICE',
  'PAYMENT_REQUEST_DOC',
];

const CATEGORIES: CategoryConfig[] = ORDERED_CATEGORY_KEYS.map((key, index) => {
  const docMeta = PAYMENT_DOC_TYPES[key];
  const title = key === 'PAYMENT_REQUEST_DOC'
    ? `${index + 1}. ${docMeta.title} & Hóa đơn khác`
    : `${index + 1}. ${docMeta.title}`;

  return {
    key,
    title,
    badge: '(tùy chọn)',
    iconName: CATEGORY_ICONS[key] || 'file-text',
    hint: docMeta.hint,
  };
});

export const ProductionDocumentPicker: React.FC<ProductionDocumentPickerProps> = ({
  files,
  onChange,
  projectName,
  requestType = 'PROJECT',
  maxFilesPerCategory = 5,
  onOpenTemplateModal,
}) => {
  const [compressing, setCompressing] = useState<string | null>(null); // docType đang upload/xử lý
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PaymentDocType | null>('LABOR_CONTRACT');

  // Chụp ảnh từ Camera cho một category cụ thể
  const handleTakeCamera = async (cat: PaymentDocType) => {
    const catFiles = files.filter((f) => f.docType === cat);
    if (catFiles.length >= maxFilesPerCategory) {
      Alert.alert('Đã đủ số lượng', `Mục này đã đạt giới hạn tối đa ${maxFilesPerCategory} file.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập Camera để chụp chứng từ.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processAndAddImage(result.assets[0].uri, cat);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở Camera. Vui lòng thử lại.');
    }
  };

  // Chọn ảnh từ Thư viện cho một category cụ thể
  const handlePickLibrary = async (cat: PaymentDocType) => {
    const catFiles = files.filter((f) => f.docType === cat);
    if (catFiles.length >= maxFilesPerCategory) {
      Alert.alert('Đã đủ số lượng', `Mục này đã đạt giới hạn tối đa ${maxFilesPerCategory} file.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền xem thư viện ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processAndAddImage(result.assets[0].uri, cat);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể truy cập thư viện ảnh.');
    }
  };

  // Chọn tệp PDF tài liệu cho một category cụ thể
  const handlePickDocument = async (cat: PaymentDocType) => {
    const catFiles = files.filter((f) => f.docType === cat);
    if (catFiles.length >= maxFilesPerCategory) {
      Alert.alert('Đã đủ số lượng', `Mục này đã đạt giới hạn tối đa ${maxFilesPerCategory} file.`);
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const doc = res.assets[0];
        const { standardName, safeUploadName } = formatDocFileName({
          fileName: doc.name || `doc_${Date.now()}.pdf`,
          docType: cat,
          projectName,
          requestType,
        });

        const newFile: ProductionDocItem = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          uri: doc.uri,
          name: safeUploadName,
          standardName,
          type: 'application/pdf',
          docType: cat,
          size: doc.size,
        };

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onChange([...files, newFile]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn tệp tài liệu.');
    }
  };

  // Nén ảnh tự động chuẩn quy định < 1MB qua expo-image-manipulator
  const processAndAddImage = async (originalUri: string, cat: PaymentDocType) => {
    try {
      setCompressing(cat);

      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 1920 } }],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const { standardName, safeUploadName } = formatDocFileName({
        fileName: `image_${Date.now()}.jpg`,
        docType: cat,
        projectName,
        requestType,
      });

      const newFile: ProductionDocItem = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        uri: manipulated.uri,
        name: safeUploadName,
        standardName,
        type: 'image/jpeg',
        docType: cat,
      };

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onChange([...files, newFile]);
    } catch {
      Alert.alert('Lỗi xử lý ảnh', 'Không thể nén ảnh tự động. Thử lại sau.');
    } finally {
      setCompressing(null);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const updated = files.filter((f) => f.id !== fileId);
    onChange(updated);
  };

  const totalFilesCount = files.length;

  return (
    <View style={{ marginTop: 12 }}>
      {/* Tiêu đề tổng quan Hồ Sơ Chứng Từ Sản Xuất */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="folder" size={16} color="#F38820" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>
            Hồ Sơ Chứng Từ Sản Xuất
          </Text>
          <Text style={{ fontSize: 11, color: '#94A3B8' }}>(tùy chọn)</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#F38820' }}>
          Đã đính kèm: {totalFilesCount} file
        </Text>
      </View>

      <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10, lineHeight: 16 }}>
        * Tự động chuẩn hóa tên file theo chuẩn Getvini (ngày tháng/dự án/mã chứng từ) khi gửi lên hệ thống.
      </Text>

      {/* Danh sách 5 danh mục chứng từ dạng Card */}
      <View style={{ gap: 8 }}>
        {CATEGORIES.map((cat) => {
          const catFiles = files.filter((f) => f.docType === cat.key);
          const isExpanded = activeCategory === cat.key;
          const isFull = catFiles.length >= maxFilesPerCategory;
          const isCatCompressing = compressing === cat.key;

          return (
            <View
              key={cat.key}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: catFiles.length > 0 ? '#FDBA74' : '#E2E8F0',
                backgroundColor: catFiles.length > 0 ? '#FFFDFB' : '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              {/* Header của từng mục chứng từ (có thể gập/mở) */}
              <TouchableOpacity
                onPress={() => setActiveCategory(isExpanded ? null : cat.key)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: isExpanded ? '#FFF7ED' : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: catFiles.length > 0 ? '#F38820' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather
                      name={cat.iconName}
                      size={14}
                      color={catFiles.length > 0 ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: catFiles.length > 0 ? '#C2410C' : '#1E293B',
                      }}
                      numberOfLines={1}
                    >
                      {cat.title}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                      {catFiles.length}/{maxFilesPerCategory} file
                    </Text>
                  </View>
                </View>

                <Feather
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              {/* Nội dung khi mở rộng: Buttons đính kèm & Danh sách file */}
              {isExpanded && (
                <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginBottom: 10 }}>
                    {cat.hint}
                  </Text>

                  {/* Nút Lập Giấy ĐNTT từ mẫu chuẩn nếu là mục PAYMENT_REQUEST_DOC */}
                  {cat.key === 'PAYMENT_REQUEST_DOC' && onOpenTemplateModal && !isFull && (
                    <TouchableOpacity
                      onPress={onOpenTemplateModal}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 38,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: '#F38820',
                        backgroundColor: '#FFF7ED',
                        marginBottom: 10,
                      }}
                    >
                      <Feather name="file-text" size={15} color="#F38820" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
                        ✨ Tạo Giấy ĐNTT từ mẫu chuẩn Getvini
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Nút hành động thêm file (Chụp ảnh / Thư viện / PDF) */}
                  {!isFull ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      {/* Chụp ảnh */}
                      <TouchableOpacity
                        onPress={() => handleTakeCamera(cat.key)}
                        disabled={isCatCompressing}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          height: 36,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#FDBA74',
                          backgroundColor: '#FFF7ED',
                        }}
                      >
                        {isCatCompressing ? (
                          <ActivityIndicator size="small" color="#F38820" />
                        ) : (
                          <>
                            <Feather name="camera" size={14} color="#F38820" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#F38820' }}>
                              Chụp
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {/* Thư viện */}
                      <TouchableOpacity
                        onPress={() => handlePickLibrary(cat.key)}
                        disabled={isCatCompressing}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          height: 36,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Feather name="image" size={14} color="#475569" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569' }}>
                          Ảnh
                        </Text>
                      </TouchableOpacity>

                      {/* Tệp PDF */}
                      <TouchableOpacity
                        onPress={() => handlePickDocument(cat.key)}
                        disabled={isCatCompressing}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          height: 36,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Feather name="file" size={14} color="#475569" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569' }}>
                          PDF
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#EA580C', fontStyle: 'italic', marginBottom: 8 }}>
                      Đã đạt giới hạn tối đa {maxFilesPerCategory} file cho mục này.
                    </Text>
                  )}

                  {/* Danh sách file đã đính kèm trong mục */}
                  {catFiles.length > 0 && (
                    <View style={{ gap: 6 }}>
                      {catFiles.map((file) => {
                        const isPdf = file.type?.includes('pdf') || file.name.endsWith('.pdf');
                        const isGenerated = file.isGeneratedDoc;

                        return (
                          <View
                            key={file.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 8,
                              borderRadius: 6,
                              backgroundColor: isGenerated ? '#FAF5FF' : '#F8FAFC',
                              borderWidth: 1,
                              borderColor: isGenerated ? '#DDD6FE' : '#E2E8F0',
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                if (isGenerated && onOpenTemplateModal) {
                                  onOpenTemplateModal();
                                } else if (!isPdf && file.uri) {
                                  setPreviewUri(file.uri);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                            >
                              {isGenerated ? (
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 4,
                                    backgroundColor: '#EDE9FE',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Feather name="file-text" size={16} color="#7C3AED" />
                                </View>
                              ) : isPdf ? (
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 4,
                                    backgroundColor: '#FEE2E2',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Feather name="file-text" size={16} color="#DC2626" />
                                </View>
                              ) : (
                                <Image
                                  source={{ uri: file.uri }}
                                  style={{ width: 32, height: 32, borderRadius: 4 }}
                                />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: isGenerated ? '#6D28D9' : '#0F172A',
                                  }}
                                  numberOfLines={1}
                                >
                                  {file.name}
                                </Text>
                                {isGenerated ? (
                                  <Text style={{ fontSize: 9, color: '#7C3AED', marginTop: 1, fontWeight: '600' }}>
                                    ✨ Mẫu chuẩn Word (Tự sinh khi gửi)
                                  </Text>
                                ) : (
                                  <Text style={{ fontSize: 9, color: '#059669', marginTop: 1 }}>
                                    ✓ Chuẩn Getvini
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {isGenerated && onOpenTemplateModal && (
                                <TouchableOpacity
                                  onPress={onOpenTemplateModal}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={{ padding: 4 }}
                                >
                                  <Feather name="edit-2" size={14} color="#7C3AED" />
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => handleRemoveFile(file.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ padding: 4 }}
                              >
                                <Feather name="trash-2" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Modal Preview ảnh phóng to */}
      <Modal visible={Boolean(previewUri)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={{ width: '100%', height: '80%', resizeMode: 'contain' }}
            />
          )}
          <TouchableOpacity
            onPress={() => setPreviewUri(null)}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>Đóng xem trước</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};
