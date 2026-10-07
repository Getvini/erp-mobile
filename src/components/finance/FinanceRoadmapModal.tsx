import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBulkSaveMilestonesMutation } from '@/hooks/queries';
import {
  formatDateToYYYYMMDD,
  formatNumberInput,
  parseNumberInput,
  formatVND,
} from '@/utils/formatters';

export const FinanceRoadmapModal: React.FC = () => {
  const roadmapScrollViewRef = useRef<ScrollView>(null);

  const selectedContractForRoadmap = useFinanceStore((s) => s.selectedContractForRoadmap);
  const showRoadmapModal = useFinanceStore((s) => s.showRoadmapModal);
  const editableMilestones = useFinanceStore((s) => s.editableMilestones);

  const closeRoadmapModal = useFinanceStore((s) => s.closeRoadmapModal);
  const addRoadmapRow = useFinanceStore((s) => s.addRoadmapRow);
  const removeRoadmapRow = useFinanceStore((s) => s.removeRoadmapRow);
  const updateRoadmapRow = useFinanceStore((s) => s.updateRoadmapRow);
  const openDatePickerForMilestone = useFinanceStore((s) => s.openDatePickerForMilestone);

  const bulkSaveMilestonesMutation = useBulkSaveMilestonesMutation();

  const onAddRoadmapRow = () => {
    Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
    addRoadmapRow();
    setTimeout(() => {
      roadmapScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const roadmapTotalPercent =
    Math.round(
      editableMilestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0) * 100
    ) / 100;
  const contractPrice = selectedContractForRoadmap?.sellingPrice || 0;

  const onSaveRoadmap = async () => {
    if (!selectedContractForRoadmap) return;

    if (editableMilestones.length > 0) {
      for (let i = 0; i < editableMilestones.length; i++) {
        const m = editableMilestones[i];
        if (!m.dueDate || !String(m.dueDate).trim()) {
          Alert.alert(
            'Thiếu Hạn thanh toán',
            `Vui lòng chọn hoặc nhập Hạn thanh toán cho Đợt #${i + 1} (${m.name || 'Đợt thanh toán'}).`
          );
          return;
        }
      }

      if (roadmapTotalPercent !== 100) {
        Alert.alert(
          'Lỗi tổng tỷ lệ',
          `Tổng tỷ lệ các đợt phải bằng 100% (hiện tại: ${roadmapTotalPercent}%).`
        );
        return;
      }
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Heavy);
      await bulkSaveMilestonesMutation.mutateAsync({
        contractId: selectedContractForRoadmap.id,
        milestones: editableMilestones.map((m) => ({
          id: m.id,
          name: m.name,
          percentage: Number(m.percentage) || 0,
          amount: parseNumberInput(String(m.amount)),
          dueDate: formatDateToYYYYMMDD(m.dueDate),
        })),
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật kế hoạch thanh toán cho hợp đồng.');
      closeRoadmapModal();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Không thể lưu', err?.message || 'Vui lòng kiểm tra lại thông tin.');
    }
  };

  return (
    <Modal
      visible={showRoadmapModal}
      transparent
      animationType="slide"
      onRequestClose={closeRoadmapModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="bg-white rounded-t-3xl p-5 h-[85%] max-h-[85%] flex-col gap-3">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                Quản lý kế hoạch thanh toán
              </Text>
              <Text className="text-xs font-bold text-indigo-600">
                {selectedContractForRoadmap?.contractCode} • {selectedContractForRoadmap?.customerName}
              </Text>
            </View>
            <TouchableOpacity
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center min-h-[44px] min-w-[44px]"
              onPress={closeRoadmapModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Contract Banner */}
          <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex-row justify-between items-center">
            <View>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIÁ TRỊ HỢP ĐỒNG</Text>
              <Text className="text-base font-black text-slate-900">
                {formatVND(contractPrice)}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TỔNG TỶ LỆ CÁC ĐỢT</Text>
              <Text
                className={`text-base font-black ${
                  roadmapTotalPercent === 100 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {roadmapTotalPercent}% / 100%
              </Text>
            </View>
          </View>

          {/* Section Header: LỘ TRÌNH THANH TOÁN + Thêm đợt */}
          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              LỘ TRÌNH THANH TOÁN ({editableMilestones.length} đợt)
            </Text>

            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 min-h-[44px]"
              onPress={onAddRoadmapRow}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="plus" size={16} color="#4F46E5" />
              <Text className="text-xs font-extrabold text-indigo-600">Thêm đợt</Text>
            </TouchableOpacity>
          </View>

          {/* Editable Milestones Rows */}
          <ScrollView
            ref={roadmapScrollViewRef}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
          >
            {editableMilestones.length === 0 ? (
              <View className="py-8 items-center justify-center gap-3">
                <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
                  <Feather name="calendar" size={24} color="#94A3B8" />
                </View>
                <Text className="text-sm font-bold text-slate-500 text-center">
                  Chưa có đợt thanh toán nào
                </Text>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-indigo-600 px-4 py-2.5 rounded-xl min-h-[44px]"
                  onPress={onAddRoadmapRow}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Thêm đợt đầu tiên</Text>
                </TouchableOpacity>
              </View>
            ) : (
              editableMilestones.map((m, idx) => (
                <View key={`milestone-row-${idx}`} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 gap-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-extrabold text-slate-800">
                      Đợt #{idx + 1}
                    </Text>

                    <TouchableOpacity
                      className="w-8 h-8 rounded-xl bg-rose-50 items-center justify-center border border-rose-100 min-h-[32px]"
                      onPress={() => {
                        Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
                        removeRoadmapRow(idx);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View className="gap-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">TÊN ĐỢT</Text>
                    <TextInput
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                      value={String(m.name || '')}
                      onChangeText={(val) => updateRoadmapRow(idx, 'name', val)}
                      placeholder="VD: Thanh toán đợt 1 / Tạm ứng"
                    />
                  </View>

                  <View className="flex-row gap-2">
                    <View className="w-[96px] shrink-0 gap-1">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase">TỶ LỆ (%)</Text>
                      <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 min-h-[44px]">
                        <TextInput
                          className="flex-1 text-xs text-slate-900 font-bold text-center p-0"
                          keyboardType="numeric"
                          value={String(m.percentage ?? '')}
                          onChangeText={(val) => updateRoadmapRow(idx, 'percentage', val)}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text className="text-xs font-bold text-slate-500 ml-0.5">%</Text>
                      </View>
                    </View>

                    <View className="flex-1 gap-1">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase">SỐ TIỀN (VNĐ)</Text>
                      <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                        <TextInput
                          className="flex-1 text-xs text-slate-900 font-bold p-0"
                          keyboardType="numeric"
                          value={formatNumberInput(m.amount)}
                          onChangeText={(val) => updateRoadmapRow(idx, 'amount', val)}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text className="text-xs font-bold text-slate-500 ml-1">VNĐ</Text>
                      </View>
                    </View>
                  </View>

                  <View className="gap-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">
                      HẠN THANH TOÁN (DD-MM-YYYY) <Text className="text-rose-500">*</Text>
                    </Text>
                    <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px]">
                      <TouchableOpacity
                        onPress={() => openDatePickerForMilestone(idx, String(m.dueDate || ''), m.name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="mr-2.5"
                      >
                        <Feather name="calendar" size={16} color="#4F46E5" />
                      </TouchableOpacity>
                      <TextInput
                        className="flex-1 text-xs text-slate-900 font-bold p-0"
                        value={String(m.dueDate || '')}
                        onChangeText={(val) => updateRoadmapRow(idx, 'dueDate', val)}
                        placeholder="DD-MM-YYYY"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Modal Bottom Actions */}
          <View className="flex-row gap-3 pt-3 border-t border-slate-100">
            <TouchableOpacity
              className="flex-1 py-3 bg-slate-100 rounded-xl items-center justify-center min-h-[44px]"
              onPress={closeRoadmapModal}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl items-center justify-center min-h-[44px] ${
                roadmapTotalPercent === 100 ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              onPress={onSaveRoadmap}
              disabled={bulkSaveMilestonesMutation.isPending}
              activeOpacity={0.8}
            >
              {bulkSaveMilestonesMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">Lưu kế hoạch</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
