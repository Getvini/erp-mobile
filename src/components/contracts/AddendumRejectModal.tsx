import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';

export interface AddendumRejectModalProps {
  visible: boolean;
  /** Nhãn người duyệt: "Sale" | "BOD" — dùng cho nội dung mô tả. */
  reviewerLabel?: string;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

/**
 * Bottom sheet nhập LÝ DO KHÔNG DUYỆT phụ lục (bắt buộc).
 * Mirror erp-UI ContractAddendums.jsx:325-363 (RejectReasonModal).
 */
export default function AddendumRejectModal({
  visible,
  reviewerLabel = 'Sale/BOD',
  isLoading = false,
  onClose,
  onSubmit,
}: AddendumRejectModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset form khi mở modal — điều chỉnh state trong lúc render (không dùng useEffect
  // để tránh cascading render: react-hooks/set-state-in-effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setReason('');
      setError('');
    }
  }

  const handleSubmit = () => {
    const note = reason.trim();
    if (!note) {
      setError('Vui lòng nhập lý do không duyệt');
      return;
    }
    setError('');
    onSubmit(note);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-slate-900/50 justify-end">
          <View className="bg-white rounded-t-[24px] p-5 gap-3.5 max-h-[90%]">
            {/* Handle bar */}
            <View className="items-center -mt-[6px] mb-[2px]">
              <View className="w-[44px] h-[4px] rounded-full bg-slate-200" />
            </View>

            <View className="flex-row items-start justify-between gap-[10px]">
              <View className="flex-row items-start gap-[10px]" style={{ flex: 1 }}>
                <View
                  style={{ backgroundColor: BrandColors.errorLight }}
                  className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
                >
                  <Feather name="x-circle" size={18} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-[16px] font-extrabold text-slate-900">Lý do không duyệt</Text>
                  <Text className="text-[12px] text-slate-500 mt-[3px] leading-[16px]">
                    {reviewerLabel} cần nhập lý do để người tạo phụ lục xử lý lại.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="w-[36px] h-[36px] rounded-[10px] bg-slate-100 items-center justify-center"
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (error) setError('');
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Nhập lý do không duyệt..."
              placeholderTextColor="#94A3B8"
              className={`min-h-[110px] rounded-[12px] border px-[12px] py-[10px] text-[13px] text-slate-800 ${
                error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
              }`}
            />

            {!!error && (
              <View className="flex-row items-center gap-[5px]">
                <Feather name="alert-circle" size={13} color="#DC2626" />
                <Text className="text-[12px] font-semibold text-red-600">{error}</Text>
              </View>
            )}

            <View className="flex-row gap-[10px] mt-[2px]">
              <TouchableOpacity
                onPress={onClose}
                disabled={isLoading}
                activeOpacity={0.8}
                className="flex-1 min-h-[48px] items-center justify-center rounded-[12px] bg-slate-100 border border-slate-200"
              >
                <Text className="text-[14px] font-bold text-slate-600">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
                className="flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[12px] bg-red-600"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="x-circle" size={15} color="#FFFFFF" />
                    <Text className="text-[14px] font-bold text-white">Không duyệt</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
