import React from 'react';
import { View, Text, TextInput, useWindowDimensions } from 'react-native';
import { useOpportunityFormStore } from '@/stores/useOpportunityFormStore';
import { formatVNDInput, parseVNDInput } from './wizardConstants';

export const Step2Financial: React.FC = () => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const { formData, updateField } = useOpportunityFormStore();
  const { expectedRevenue, budget } = formData;

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center mb-[16px] gap-[12px]">
        <View style={{ backgroundColor: '#FEF3C7' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
          <Text style={{ color: '#D97706' }} className="text-[14px] font-bold">2</Text>
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-900">Thông tin tài chính</Text>
          <Text className="text-[12px] text-slate-500 mt-[2px]">Kỳ vọng doanh thu và ngân sách dự kiến</Text>
        </View>
      </View>

      {/* Doanh thu & Ngân sách */}
      <View className={`flex-row ${isSmallScreen ? 'flex-col' : ''}`}>
        <View className={`mb-[16px] ${isSmallScreen ? 'w-full mr-0 ml-0' : 'flex-1 mr-[8px]'}`}>
          <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
            Doanh thu kỳ vọng <Text className="text-[#EF4444]">*</Text>{' '}
            <Text className="text-[11px] font-normal text-slate-500">(giá muốn bán cho khách)</Text>
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[12px]">
            <TextInput
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={expectedRevenue ? formatVNDInput(expectedRevenue) : '0'}
              onChangeText={(val) => updateField('expectedRevenue', parseVNDInput(val))}
              className="flex-1 py-[10px] text-[14px] font-semibold text-slate-900"
            />
            <Text className="text-[13px] font-bold text-slate-500 ml-[4px]">VNĐ</Text>
          </View>
        </View>

        <View className={`mb-[16px] ${isSmallScreen ? 'w-full mr-0 ml-0' : 'flex-1 ml-[8px]'}`}>
          <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
            Ngân sách dự kiến <Text className="text-[#EF4444]">*</Text>{' '}
            <Text className="text-[11px] font-normal text-slate-500">(ngân sách của khách đề xuất)</Text>
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[12px]">
            <TextInput
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={budget ? formatVNDInput(budget) : '0'}
              onChangeText={(val) => updateField('budget', parseVNDInput(val))}
              className="flex-1 py-[10px] text-[14px] font-semibold text-slate-900"
            />
            <Text className="text-[13px] font-bold text-slate-500 ml-[4px]">VNĐ</Text>
          </View>
        </View>
      </View>
    </View>
  );
};
