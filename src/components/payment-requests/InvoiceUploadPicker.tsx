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
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface UploadedFileItem {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface InvoiceUploadPickerProps {
  files: UploadedFileItem[];
  onChange: (files: UploadedFileItem[]) => void;
  maxFiles?: number;
}

export const InvoiceUploadPicker: React.FC<InvoiceUploadPickerProps> = ({
  files,
  onChange,
  maxFiles = 5,
}) => {
  const [compressing, setCompressing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // 1. Chụp ảnh từ Camera
  const handleTakeCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập Camera để chụp hóa đơn.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processAndAddImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể mở Camera. Vui lòng thử lại.');
    }
  };

  // 2. Chọn ảnh từ Thư viện
  const handlePickLibrary = async () => {
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
        await processAndAddImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể truy cập thư viện ảnh.');
    }
  };

  // 3. Chọn tệp PDF tài liệu
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const doc = res.assets[0];
        const newFile: UploadedFileItem = {
          uri: doc.uri,
          name: doc.name || `Tài liệu_${Date.now()}.pdf`,
          type: 'application/pdf',
          size: doc.size,
        };

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onChange([...files, newFile]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn tệp tài liệu.');
    }
  };

  // Quy chuẩn Master Plan: Tự động nén ảnh chụp từ 10MB xuống < 1MB qua expo-image-manipulator
  const processAndAddImage = async (originalUri: string) => {
    try {
      setCompressing(true);

      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 1920 } }],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const fileName = `Hóa_đơn_${Date.now()}.jpg`;
      const newFile: UploadedFileItem = {
        uri: manipulated.uri,
        name: fileName,
        type: 'image/jpeg',
      };

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onChange([...files, newFile]);
    } catch (err) {
      Alert.alert('Lỗi xử lý ảnh', 'Không thể nén ảnh tự động. Thử lại sau.');
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const updated = files.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
        Hóa Đơn & Chứng Từ Đính Kèm ({files.length}/{maxFiles})
      </Text>

      {/* Buttons Options */}
      {files.length < maxFiles && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {/* Camera Button */}
          <TouchableOpacity
            onPress={handleTakeCamera}
            disabled={compressing}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#FDCB9E',
              backgroundColor: '#FFF7ED',
            }}
          >
            <Feather name="camera" size={16} color="#F38820" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#F38820' }}>Chụp ảnh</Text>
          </TouchableOpacity>

          {/* Library Button */}
          <TouchableOpacity
            onPress={handlePickLibrary}
            disabled={compressing}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Feather name="image" size={16} color="#475569" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Thư viện</Text>
          </TouchableOpacity>

          {/* Document PDF Button */}
          <TouchableOpacity
            onPress={handlePickDocument}
            disabled={compressing}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <MaterialIcons name="picture-as-pdf" size={16} color="#475569" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>File PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading Indicator when compressing */}
      {compressing && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            backgroundColor: '#F8FAFC',
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <ActivityIndicator size="small" color="#F38820" />
          <Text style={{ fontSize: 12, color: '#64748B' }}>Đang tự động nén ảnh hóa đơn &lt; 1MB...</Text>
        </View>
      )}

      {/* File List */}
      {files.map((file, idx) => {
        const isPdf = file.type?.includes('pdf') || file.name?.endsWith('.pdf');
        return (
          <TouchableOpacity
            key={`${file.uri}_${idx}`}
            activeOpacity={0.85}
            onPress={() => {
              if (!isPdf) {
                setPreviewUri(file.uri);
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 8,
              backgroundColor: '#F8FAFC',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              marginBottom: 6,
            }}
          >
            {isPdf ? (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  backgroundColor: '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <MaterialIcons name="picture-as-pdf" size={20} color="#DC2626" />
              </View>
            ) : (
              <Image
                source={{ uri: file.uri }}
                style={{ width: 36, height: 36, borderRadius: 6, marginRight: 8 }}
                resizeMode="cover"
              />
            )}

            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>
                {file.name}
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                {isPdf ? 'Tệp PDF' : 'Ảnh đã nén (Bấm để xem)'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleRemoveFile(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      {/* Full-Screen Image Preview Modal */}
      {previewUri && (
        <Modal
          visible={Boolean(previewUri)}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewUri(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <TouchableOpacity
              onPress={() => setPreviewUri(null)}
              style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: previewUri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};
