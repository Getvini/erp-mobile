import React, { useState, useEffect } from 'react';
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
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  PROVINCES_LIST,
  formatDateInputMask,
  validateDateString,
  parseDateObj,
  calculateDurationMonths,
  toDisplayDate,
} from './wizardConstants';

export const Step3TimeLocation: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const isLandscape = width > height;

  const {
    formData,
    updateField,
    dateError,
    setDateError,
    toggleRegion,
  } = useOpportunityFormStore();

  const { startDate, endDate, durationMonths, selectedRegions } = formData;

  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [isRegionModalVisible, setIsRegionModalVisible] = useState(false);

  // Immediate Real-Time Date Validation & Duration Auto-Calculation
  useEffect(() => {
    if (!startDate && !endDate) {
      setDateError('');
      if (!durationMonths) updateField('durationMonths', 1);
      return;
    }

    const isStartComplete = startDate.length === 10;
    const isEndComplete = endDate.length === 10;

    const startValid = isStartComplete ? validateDateString(startDate) : false;
    const endValid = isEndComplete ? validateDateString(endDate) : false;

    if (isStartComplete && !startValid) {
      setDateError('Ngày bắt đầu không hợp lệ (DD/MM/YYYY)');
      return;
    }

    if (isEndComplete && !endValid) {
      setDateError('Ngày kết thúc không hợp lệ (DD/MM/YYYY)');
      return;
    }

    if (startValid && endValid) {
      const pStart = parseDateObj(startDate)!;
      const pEnd = parseDateObj(endDate)!;

      if (pEnd < pStart) {
        setDateError('Ngày kết thúc phải sau ngày dự kiến bắt đầu');
        updateField('durationMonths', 1);
      } else {
        setDateError('');
        const months = calculateDurationMonths(startDate, endDate);
        updateField('durationMonths', months < 1 ? 1 : months);
      }
    } else {
      setDateError('');
      if (!durationMonths) {
        updateField('durationMonths', 1);
      }
    }
  }, [startDate, endDate]);

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center mb-[16px] gap-[12px]">
        <View style={{ backgroundColor: '#EFF6FF' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
          <Text style={{ color: '#3B82F6' }} className="text-[14px] font-bold">3</Text>
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-900">Thời gian & Địa điểm</Text>
          <Text className="text-[12px] text-slate-500 mt-[2px]">Lịch trình dự kiến và phạm vi địa lý triển khai</Text>
        </View>
      </View>

      {/* Ngày bắt đầu & Ngày kết thúc */}
      <View className={`flex-row ${isSmallScreen ? 'flex-col' : ''}`}>
        <View className={`mb-[16px] ${isSmallScreen ? 'w-full mr-0 ml-0' : 'flex-1 mr-[8px]'}`}>
          <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
            Dự kiến bắt đầu <Text className="text-[#EF4444]">*</Text>
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[10px]">
            <TouchableOpacity
              onPress={() => setActiveDatePicker('start')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="calendar" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            </TouchableOpacity>
            <TextInput
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={10}
              value={startDate}
              onChangeText={(val) => updateField('startDate', formatDateInputMask(val))}
              className="flex-1 py-[10px] text-[14px] text-slate-900"
            />
          </View>
        </View>

        <View className={`mb-[16px] ${isSmallScreen ? 'w-full mr-0 ml-0' : 'flex-1 ml-[8px]'}`}>
          <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
            Dự kiến kết thúc <Text className="text-[#EF4444]">*</Text>
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[10px]">
            <TouchableOpacity
              onPress={() => setActiveDatePicker('end')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="calendar" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            </TouchableOpacity>
            <TextInput
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={10}
              value={endDate}
              onChangeText={(val) => updateField('endDate', formatDateInputMask(val))}
              className="flex-1 py-[10px] text-[14px] text-slate-900"
            />
          </View>
        </View>
      </View>

      {/* Immediate Validation Error Message */}
      {dateError ? (
        <View className="flex-row items-center gap-[6px] bg-red-50 border border-red-200 rounded-[8px] px-[10px] py-[8px] mt-[-8px] mb-[14px]">
          <Feather name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-[12px] font-semibold text-red-600 flex-1">{dateError}</Text>
        </View>
      ) : null}

      {/* Địa điểm triển khai (Multi select) */}
      <View className="mb-[16px]">
        <View className="flex-row justify-between items-center mb-[6px]">
          <Text className="text-[13px] font-semibold text-slate-700">Địa điểm triển khai</Text>
          <TouchableOpacity onPress={() => setIsRegionModalVisible(true)} className="py-[2px]">
            <Text className="text-[12px] font-semibold text-blue-600">Chọn tỉnh thành</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setIsRegionModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[11px]"
        >
          <Text
            numberOfLines={1}
            className={`text-[14px] font-medium flex-1 ${
              selectedRegions.length === 0 ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {selectedRegions.length > 0
              ? `Đã chọn: ${selectedRegions.join(', ')}`
              : 'Chọn tỉnh thành (có thể chọn nhiều)...'}
          </Text>
          <Feather name="map-pin" size={16} color="#64748B" />
        </TouchableOpacity>

        {/* Quick selected chips */}
        {selectedRegions.length > 0 && (
          <View className="flex-row flex-wrap gap-[6px] mt-[8px]">
            {selectedRegions.map((reg) => (
              <View
                key={reg}
                className="flex-row items-center bg-blue-50 border border-blue-200 rounded-[6px] px-[8px] py-[4px] gap-[6px]"
              >
                <Text className="text-[12px] text-[#1D4ED8] font-medium">{reg}</Text>
                <TouchableOpacity
                  onPress={() => toggleRegion(reg)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Feather name="x" size={12} color="#475569" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Số tháng triển khai (Tự động tính, mặc định 1, nếu <1 thì là 1, không cho sửa) */}
      <View className="mb-[16px]">
        <View className="flex-row justify-between items-center mb-[6px]">
          <Text className="text-[13px] font-semibold text-slate-700">Số tháng triển khai</Text>
        </View>
        <View className="flex-row items-center bg-slate-100 border border-slate-200 rounded-[10px] px-[12px] py-[11px]">
          <Text className="text-[14px] font-semibold text-slate-700">
            {durationMonths && durationMonths > 0 ? `${durationMonths} Tháng` : '1 Tháng'}
          </Text>
        </View>
      </View>

      {/* DatePickerModal */}
      <DatePickerModal
        visible={activeDatePicker !== null}
        title={activeDatePicker === 'start' ? 'Chọn ngày dự kiến bắt đầu' : 'Chọn ngày dự kiến kết thúc'}
        initialDate={activeDatePicker === 'start' ? startDate : endDate}
        onConfirm={(_, formattedYYYYMMDD) => {
          const selectedStr = toDisplayDate(formattedYYYYMMDD);
          if (activeDatePicker === 'start') {
            updateField('startDate', selectedStr);
          } else {
            updateField('endDate', selectedStr);
          }
          setActiveDatePicker(null);
        }}
        onClose={() => setActiveDatePicker(null)}
      />

      {/* Region Selection Modal */}
      <Modal
        visible={isRegionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRegionModalVisible(false)}
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
              <Text className="text-[16px] font-bold text-slate-900">Chọn địa điểm triển khai</Text>
              <TouchableOpacity
                onPress={() => setIsRegionModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              {PROVINCES_LIST.map((reg) => {
                const isSelected = selectedRegions.includes(reg);
                return (
                  <TouchableOpacity
                    key={reg}
                    onPress={() => toggleRegion(reg)}
                    className={`flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100 ${
                      isSelected ? 'bg-blue-50 rounded-[8px]' : ''
                    }`}
                  >
                    <Text
                      className={`text-[14px] ${
                        isSelected ? 'text-blue-600 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {reg}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="pt-[10px] border-t border-t-slate-200">
              <TouchableOpacity
                onPress={() => setIsRegionModalVisible(false)}
                className="bg-blue-600 py-[12px] rounded-[8px] items-center"
              >
                <Text className="text-[14px] font-bold text-white">Xong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
