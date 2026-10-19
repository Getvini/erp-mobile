import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useOpportunityFormStore, AttachedFile } from '@/stores/useOpportunityFormStore';
import { BrandColors } from '@/constants/colors';
import { DEFAULT_LINK_PLACEHOLDERS, formatFileSize } from './wizardConstants';

export const Step6RequirementsAttachments: React.FC = () => {
  const {
    formData,
    addLink,
    removeLink,
    updateLink,
    addAttachedFiles,
    removeAttachedFile,
  } = useOpportunityFormStore();

  const { links, attachedFiles } = formData;

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (attachedFiles.length + result.assets.length > 5) {
          Alert.alert('Giới hạn', 'Bạn chỉ có thể đính kèm tối đa 5 tệp tin.');
          return;
        }

        const newFiles: AttachedFile[] = result.assets.map((asset) => ({
          name: asset.name,
          size: asset.size,
          uri: asset.uri,
          mimeType: asset.mimeType,
        }));
        addAttachedFiles(newFiles);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn tệp.');
    }
  };

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center mb-[16px] gap-[12px]">
        <View style={{ backgroundColor: '#EDE9FE' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
          <Text style={{ color: '#7C3AED' }} className="text-[14px] font-bold">5</Text>
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-900">Yêu cầu & Tài liệu</Text>
          <Text className="text-[12px] text-slate-500 mt-[2px]">Tài liệu mô tả yêu cầu khách hàng & tệp đính kèm</Text>
        </View>
      </View>

      {/* Link tài liệu tham khảo */}
      <View className="flex-row justify-between items-center mb-[10px]">
        <Text className="text-[13px] font-bold text-slate-800">Link tài liệu tham khảo</Text>
        <TouchableOpacity
          onPress={() => addLink()}
          activeOpacity={0.7}
          className="flex-row items-center px-[8px] py-[5px] rounded-[6px] bg-blue-50 gap-[4px]"
        >
          <Feather name="plus" size={14} color={BrandColors.primary} />
          <Text className="text-[12px] font-semibold text-blue-600">Thêm link</Text>
        </TouchableOpacity>
      </View>

      {links.map((linkVal, idx) => {
        const placeholder =
          DEFAULT_LINK_PLACEHOLDERS[idx % DEFAULT_LINK_PLACEHOLDERS.length];
        return (
          <View key={idx} className="flex-row items-center mb-[8px]">
            <Feather name="link-2" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1 }}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              value={linkVal}
              onChangeText={(t) => updateLink(idx, t)}
              autoCapitalize="none"
              className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
            />
            {links.length > 1 && (
              <TouchableOpacity onPress={() => removeLink(idx)} className="ml-[8px] p-[6px]">
                <Feather name="x" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Tệp đính kèm */}
      <View style={{ marginTop: 18 }} className="flex-row justify-between items-center mb-[10px]">
        <Text className="text-[13px] font-bold text-slate-800">
          Tệp đính kèm ({attachedFiles.length}/5)
        </Text>
        <TouchableOpacity
          onPress={handlePickDocument}
          activeOpacity={0.8}
          className="flex-row items-center px-[10px] py-[6px] rounded-[6px] bg-blue-600 gap-[6px]"
        >
          <Feather name="paperclip" size={14} color="#FFFFFF" />
          <Text className="text-[12px] font-semibold text-white">Chọn tệp từ máy</Text>
        </TouchableOpacity>
      </View>

      {attachedFiles.length > 0 ? (
        <View className="gap-[6px] mt-[6px]">
          {attachedFiles.map((file, idx) => (
            <View
              key={idx}
              className="flex-row items-center bg-slate-50 rounded-[8px] p-[10px] border border-slate-200 gap-[10px]"
            >
              <View className="w-[32px] h-[32px] rounded-[6px] bg-blue-50 justify-center items-center">
                <Feather name="file" size={16} color={BrandColors.primary} />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[13px] font-semibold text-slate-900">
                  {file.name}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-[2px]">
                  {formatFileSize(file.size)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeAttachedFile(idx)}
                activeOpacity={0.7}
                className="p-[6px]"
              >
                <Feather name="trash-2" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          onPress={handlePickDocument}
          activeOpacity={0.7}
          className="border-[1.5px] border-dashed border-slate-300 rounded-[10px] p-[20px] items-center bg-slate-50 mt-[6px]"
        >
          <Feather name="upload-cloud" size={24} color="#94A3B8" />
          <Text className="text-[13px] font-semibold text-slate-600 mt-[8px]">
            Kéo thả file hoặc click để chọn
          </Text>
          <Text className="text-[11px] text-slate-400 text-center mt-[4px] leading-[15px]">
            Tối đa 5 file, tổng dung lượng 25MB{'\n'}PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
