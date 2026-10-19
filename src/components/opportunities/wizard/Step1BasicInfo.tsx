import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useOpportunityFormStore } from '@/stores/useOpportunityFormStore';
import { FIELDS, formatMonthYear } from './wizardConstants';

export const Step1BasicInfo: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;

  const { formData, setNameParts, updateField } = useOpportunityFormStore();
  const { nameParts, description, field, name } = formData;

  const [isFieldModalVisible, setIsFieldModalVisible] = useState(false);

  // Jump refs between text fields
  const brandNameRef = useRef<TextInput>(null);
  const monthYearRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);

  // Combined Opportunity Name Preview
  const opportunityName = useMemo(() => {
    if (!nameParts) return name || '';
    const { customerName = '', brandName = '', monthYear = '' } = nameParts;
    return [customerName.trim(), brandName.trim(), monthYear.trim()].filter(Boolean).join('_');
  }, [nameParts, name]);

  const selectedFieldLabel = useMemo(() => {
    const found = FIELDS.find((f) => f.value === field);
    return found ? found.label : '-- Chọn lĩnh vực --';
  }, [field]);

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center mb-[16px] gap-[12px]">
        <View style={{ backgroundColor: '#EFF6FF' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
          <Text style={{ color: '#2563EB' }} className="text-[14px] font-bold">1</Text>
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-900">Thông tin cơ bản</Text>
          <Text className="text-[12px] text-slate-500 mt-[2px]">Tên cơ hội, mô tả và lĩnh vực kinh doanh</Text>
        </View>
      </View>

      {/* Tên cơ hội: 3 ô ghép chuẩn Web (customerName + brandName + MM/YY) */}
      <View className="mb-[16px]">
        <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
          Tên cơ hội <Text className="text-[#EF4444]">*</Text>
        </Text>

        {/* Preview tên cơ hội kết hợp */}
        {opportunityName.length > 0 && (
          <View className="flex-row items-center bg-blue-50 border border-blue-200 rounded-[8px] px-[10px] py-[7px] mb-[10px] gap-[6px]">
            <Feather name="tag" size={13} color="#2563EB" />
            <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-[#1D4ED8]">
              {opportunityName}
            </Text>
          </View>
        )}

        {/* Row 1: Tên khách hàng */}
        <View className="mb-[10px]">
          <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">
            Tên khách hàng <Text className="text-[#EF4444]">*</Text>
          </Text>
          <TextInput
            placeholder="VD: Công ty ABC"
            placeholderTextColor="#94A3B8"
            returnKeyType="next"
            onSubmitEditing={() => brandNameRef.current?.focus()}
            blurOnSubmit={false}
            value={nameParts?.customerName || ''}
            onChangeText={(v) => setNameParts({ customerName: v })}
            className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
          />
        </View>

        {/* Row 2: Tên Brand + MM/YY cạnh nhau */}
        <View className="flex-row items-start">
          <View style={{ flex: 1, marginRight: 8 }} className="mb-[10px]">
            <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">
              Tên Brand <Text className="text-[#EF4444]">*</Text>
            </Text>
            <TextInput
              ref={brandNameRef}
              placeholder="VD: GETVINI"
              placeholderTextColor="#94A3B8"
              returnKeyType="next"
              onSubmitEditing={() => monthYearRef.current?.focus()}
              blurOnSubmit={false}
              value={nameParts?.brandName || ''}
              onChangeText={(v) => setNameParts({ brandName: v })}
              className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
            />
          </View>

          <View style={{ width: 100 }} className="mb-[10px]">
            <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">
              Tháng/Năm <Text className="text-[#EF4444]">*</Text>
            </Text>
            <TextInput
              ref={monthYearRef}
              placeholder="mm/yy"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={5}
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              blurOnSubmit={false}
              value={nameParts?.monthYear || ''}
              onChangeText={(v) =>
                setNameParts({ monthYear: formatMonthYear(v, nameParts?.monthYear || '') })
              }
              className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
            />
          </View>
        </View>
      </View>

      {/* Mô tả chi tiết (Nằm trên Lĩnh vực) */}
      <View className="mb-[16px]">
        <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
          Mô tả <Text className="text-[#EF4444]">*</Text>
        </Text>
        <TextInput
          ref={descriptionRef}
          placeholder="Mô tả chi tiết về cơ hội..."
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={(v) => updateField('description', v)}
          multiline
          numberOfLines={4}
          maxLength={200}
          textAlignVertical="top"
          className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900 min-h-[84px]"
        />
        <View className="flex-row justify-end mt-[4px]">
          <Text
            style={{ color: description.length > 180 ? '#F97316' : '#94A3B8' }}
            className="text-[11px]"
          >
            {description.length}/200
          </Text>
        </View>
      </View>

      {/* Lĩnh vực */}
      <View className="mb-[16px]">
        <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
          Lĩnh vực <Text className="text-[#EF4444]">*</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setIsFieldModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[11px]"
        >
          <Text
            className={`text-[14px] font-medium flex-1 ${
              !field ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {selectedFieldLabel}
          </Text>
          <Feather name="chevron-down" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Field Selection Modal */}
      <Modal
        visible={isFieldModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFieldModalVisible(false)}
      >
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.45)] justify-center items-center p-[20px]">
          <View
            style={{
              width: isTablet ? 520 : Math.min(width * 0.94, 420),
              maxHeight: isLandscape ? height * 0.88 : '80%',
            }}
            className="w-full max-h-[80%] bg-white rounded-[16px] p-[16px] shadow-lg"
          >
            <View className="flex-row justify-between items-center pb-[12px] border-b border-b-slate-200">
              <Text className="text-[16px] font-bold text-slate-900">Chọn lĩnh vực kinh doanh</Text>
              <TouchableOpacity
                onPress={() => setIsFieldModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              {FIELDS.map((f) => {
                const isSelected = field === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => {
                      updateField('field', f.value);
                      setIsFieldModalVisible(false);
                    }}
                    className={`flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100 ${
                      isSelected ? 'bg-blue-50 rounded-[8px]' : ''
                    }`}
                  >
                    <Text
                      className={`text-[14px] ${
                        isSelected ? 'text-blue-600 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {f.label}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
