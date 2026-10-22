import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  usePaymentMilestonesByContractQuery,
  useBulkSavePaymentMilestonesMutation,
} from '@/hooks/queries/useMilestones';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  formatVND,
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
} from '@/utils/formatters';
import { canModifyMilestone, canAddMilestone } from '@/utils/milestoneSecurity';

export interface MilestoneModalProps {
  visible: boolean;
  onClose: () => void;
  contractId: string;
  contractCode?: string;
  sellingPrice?: number;
  contractStatus?: string;
  isReadOnly?: boolean;
  onSuccess?: () => void;
}

interface EditableMilestoneRow {
  _tempId: string;
  id?: string;
  name: string;
  percentage: number;
  amount: number;
  dueDate?: string;
  isLocked?: boolean;
}

const generateTempId = () => `milestone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  visible,
  onClose,
  contractId,
  contractCode,
  sellingPrice = 0,
  contractStatus,
  isReadOnly = false,
  onSuccess,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height && width >= 560;

  const { data: fetchedMilestones, isLoading: isFetching } = usePaymentMilestonesByContractQuery(
    visible && contractId ? contractId : undefined
  );
  const bulkSaveMutation = useBulkSavePaymentMilestonesMutation();

  const [milestones, setMilestones] = useState<EditableMilestoneRow[]>([]);
  const [activeDatePickerIndex, setActiveDatePickerIndex] = useState<number | null>(null);

  // Sync data from server query into local editable state
  useEffect(() => {
    if (visible && fetchedMilestones) {
      const rows: EditableMilestoneRow[] = (fetchedMilestones || []).map((m, idx) => ({
        _tempId: m.id || `init_${idx}_${Date.now()}`,
        id: m.id,
        name: m.name || `Đợt ${idx + 1}`,
        percentage: Number(m.percentage) || 0,
        amount: Number(m.amount) || 0,
        dueDate: m.dueDate ? m.dueDate.split('T')[0] : '',
        isLocked:
          !canModifyMilestone({
            status: m.status,
            debtStatus: (m as any).debt?.status,
          }) ||
          m.status === 'COMPLETED' ||
          (Array.isArray((m as any).payments) && (m as any).payments.length > 0) ||
          Number((m as any).paidAmount || 0) > 0,
      }));
      setMilestones(rows);
    }
  }, [visible, fetchedMilestones]);

  const price = Number(sellingPrice || 0);

  // Quy chuẩn: CHỈ làm tròn giá bán/đơn giá, tính tiền theo %
  const calculateAmountFromPercent = useCallback(
    (pct: number): number => {
      if (!price) return 0;
      return Math.round((pct / 100) * price);
    },
    [price]
  );

  const calculatePercentFromAmount = useCallback(
    (amt: number): number => {
      if (!price) return 0;
      return Math.round((amt / price) * 100);
    },
    [price]
  );

  // Thống kê tổng quan
  const totalPercentage = useMemo(
    () => milestones.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0),
    [milestones]
  );

  const totalAmount = useMemo(
    () => milestones.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [milestones]
  );

  const isPercentBalanced = Math.abs(totalPercentage - 100) <= 0.05;
  const isAmountBalanced = price > 0 ? Math.abs(totalAmount - price) <= 1000 : true;

  // Thao tác dòng
  const handleAddRow = () => {
    if (!canAddMilestone(contractStatus)) {
      Alert.alert(
        'Không thể thêm đợt',
        'Hợp đồng đã hoàn tất hoặc đã hủy, không thể thêm đợt thanh toán mới theo quy định kế toán.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const remainingPercent = Math.max(0, 100 - totalPercentage);
    const initialAmount = calculateAmountFromPercent(remainingPercent);

    setMilestones((prev) => [
      ...prev,
      {
        _tempId: generateTempId(),
        name: `Đợt ${prev.length + 1}`,
        percentage: remainingPercent,
        amount: initialAmount,
        dueDate: '',
        isLocked: false,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const target = milestones[index];
    if (target?.isLocked) {
      Alert.alert(
        'Không thể xóa',
        `Đợt thanh toán "${target.name}" đã phát sinh thanh toán hoặc đã hoàn thành, không thể xóa theo quy định kế toán.`
      );
      return;
    }

    Alert.alert(
      'Xóa đợt thanh toán',
      `Bạn có chắc chắn muốn xóa "${target?.name || `Đợt ${index + 1}`}"? Hãy nhớ cân đối lại tỷ lệ % của các đợt còn lại cho đủ 100%.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa đợt',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setMilestones((prev) => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const handleNameChange = (index: number, text: string) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: text };
      return next;
    });
  };

  const handlePercentChange = (index: number, text: string) => {
    const rawVal = text.replace(/[^0-9.]/g, '');
    const pct = parseFloat(rawVal) || 0;
    const computedAmt = calculateAmountFromPercent(pct);

    setMilestones((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        percentage: pct,
        amount: computedAmt,
      };
      return next;
    });
  };

  const handleAmountChange = (index: number, text: string) => {
    const parsedAmt = parseNumberInput(text);
    const computedPct = calculatePercentFromAmount(parsedAmt);

    setMilestones((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        amount: parsedAmt,
        percentage: computedPct,
      };
      return next;
    });
  };

  const handleDateConfirm = (ddmmyyyy: string, yyyymmdd: string) => {
    if (activeDatePickerIndex !== null) {
      setMilestones((prev) => {
        const next = [...prev];
        next[activeDatePickerIndex] = {
          ...next[activeDatePickerIndex],
          dueDate: yyyymmdd,
        };
        return next;
      });
      setActiveDatePickerIndex(null);
    }
  };

  // Submit lưu kế hoạch
  const handleSave = async () => {
    if (isReadOnly) {
      Alert.alert('Thông báo', 'Hợp đồng này đang ở chế độ chỉ đọc.');
      return;
    }

    if (milestones.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng thêm ít nhất một đợt thanh toán.');
      return;
    }

    // Kiểm tra tên đợt
    const hasEmptyName = milestones.some((m) => !m.name.trim());
    if (hasEmptyName) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ tên cho tất cả các đợt thanh toán.');
      return;
    }

    // Kiểm tra tổng %
    if (!isPercentBalanced) {
      Alert.alert(
        'Tỷ lệ chưa khớp',
        `Tổng tỷ lệ các đợt phải đạt đúng 100% (hiện tại: ${totalPercentage}%). Bạn có muốn kiểm tra lại không?`,
        [
          { text: 'Kiểm tra lại', style: 'cancel' },
          // {
          //   text: 'Vẫn lưu',
          //   onPress: () => executeSave(),
          // },
        ]
      );
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      await bulkSaveMutation.mutateAsync({
        contractId,
        milestones: milestones.map((m, idx) => ({
          id: m.id,
          name: m.name.trim(),
          percentage: Number(m.percentage) || 0,
          amount: Number(m.amount) || 0,
          dueDate: m.dueDate || undefined,
          order: idx + 1,
        })),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã lưu kế hoạch các đợt thanh toán thành công!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Thao tác thất bại', err?.message || 'Không thể lưu đợt thanh toán.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-900/65"
      >
        <View className={`flex-1 justify-end ${isLandscape ? 'pt-4' : 'pt-10'}`}>
          {/* Backdrop Dismiss touch area */}
          <TouchableOpacity
            className="absolute inset-0"
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Draggable Bottom Sheet Container */}
          <View
            className={`bg-white rounded-t-[20px] min-h-[50%] shadow-2xl ${isLandscape ? 'max-h-[94%]' : 'max-h-[88%]'}`}
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {/* Drag Handle Bar */}
            <View className="items-center pt-2.5 pb-1.5">
              <View className="w-11 h-1.5 rounded-full bg-slate-300" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3 border-b border-slate-100">
              <View className="flex-1 mr-3">
                <Text className="text-lg font-bold text-slate-900">
                  Kế Hoạch Đợt Thanh Toán
                </Text>
                {contractCode ? (
                  <Text className="text-[13px] text-slate-500 mt-0.5">
                    Hợp đồng: <Text className="font-semibold text-primary">{contractCode}</Text>
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Summary Metrics Bar */}
            <View
              className={`bg-slate-50 px-5 py-3 border-b border-slate-200 gap-2 ${isLandscape ? 'flex-row' : 'flex-col'}`}
            >
              <View className="flex-row justify-between flex-1">
                <Text className="text-[13px] text-slate-500">
                  Giá trị HĐ: <Text className="font-bold text-slate-900">{formatVND(price)}</Text>
                </Text>
                <Text className="text-[13px] text-slate-500">
                  Tổng đã chia:{' '}
                  <Text className={`font-bold ${isAmountBalanced ? 'text-emerald-600' : 'text-primary'}`}>
                    {formatVND(totalAmount)}
                  </Text>
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[13px] text-slate-500">Tiến độ tỷ lệ:</Text>
                  <View
                    className={`px-2 py-0.5 rounded-full ${isPercentBalanced ? 'bg-emerald-100' : 'bg-amber-100'}`}
                  >
                    <Text
                      className={`text-xs font-bold ${isPercentBalanced ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {totalPercentage}% / 100%
                    </Text>
                  </View>
                </View>

                {totalPercentage !== 100 ? (
                  <Text className={`text-xs font-semibold ${totalPercentage > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                    {totalPercentage > 100
                      ? `Thừa +${(totalPercentage - 100).toFixed(1)}%`
                      : `Còn thiếu ${(100 - totalPercentage).toFixed(1)}%`}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Content Body: Loading or Milestones List */}
            {isFetching ? (
              <View className="p-10 items-center justify-center">
                <ActivityIndicator size="large" color="#F38820" />
                <Text className="mt-3 text-sm text-slate-500">
                  Đang tải đợt thanh toán...
                </Text>
              </View>
            ) : (
              <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 12 }}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {milestones.length === 0 ? (
                  <View className="items-center py-8">
                    <MaterialCommunityIcons name="calendar-clock" size={48} color="#CBD5E1" />
                    <Text className="mt-2 text-sm text-slate-400">
                      Chưa có đợt thanh toán nào được thiết lập
                    </Text>
                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={handleAddRow}
                        className="mt-3 flex-row items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-50 border border-orange-200"
                      >
                        <Feather name="plus" size={16} color="#F38820" />
                        <Text className="text-[13px] font-semibold text-primary">
                          Thêm đợt đầu tiên
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : isLandscape ? (
                  /* ============================================================== */
                  /* LANDSCAPE MODE: EXPANDED TABLE VIEW NHIỀU CỘT                   */
                  /* ============================================================== */
                  <View className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <View className="flex-row bg-slate-50 py-2.5 px-3 border-b border-slate-200">
                      <Text className="w-11 font-bold text-xs text-slate-600">STT</Text>
                      <Text className="flex-2 font-bold text-xs text-slate-600">Tên đợt</Text>
                      <Text className="w-[85px] font-bold text-xs text-slate-600 text-center">
                        Tỷ lệ (%)
                      </Text>
                      <Text className="flex-2 font-bold text-xs text-slate-600 text-right">
                        Số tiền (VNĐ)
                      </Text>
                      <Text className="flex-[1.5] font-bold text-xs text-slate-600 text-center">
                        Hạn thanh toán
                      </Text>
                      {!isReadOnly && (
                        <Text className="w-11 font-bold text-xs text-slate-600 text-center">
                          Xóa
                        </Text>
                      )}
                    </View>

                    {/* Table Rows */}
                    {milestones.map((item, index) => (
                      <View
                        key={item._tempId}
                        className={`flex-row items-center py-2 px-3 ${index === milestones.length - 1 ? '' : 'border-b border-slate-100'} ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <Text className="w-11 text-[13px] text-slate-500 font-semibold">
                          #{index + 1}
                        </Text>

                        {/* Name Input */}
                        <TextInput
                          value={item.name}
                          onChangeText={(t) => handleNameChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          placeholder="Tên đợt..."
                          className={`flex-2 h-[38px] border border-slate-200 rounded-md px-2 text-[13px] text-slate-900 ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                        />

                        {/* % Input */}
                        <TextInput
                          value={String(item.percentage || '')}
                          onChangeText={(t) => handlePercentChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          keyboardType="numeric"
                          placeholder="%"
                          className={`w-20 mx-2 h-[38px] border border-slate-200 rounded-md text-center text-[13px] font-semibold text-slate-900 ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                        />

                        {/* Amount Input */}
                        <TextInput
                          value={formatNumberInput(item.amount)}
                          onChangeText={(t) => handleAmountChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          keyboardType="numeric"
                          placeholder="Số tiền..."
                          className={`flex-2 h-[38px] border border-slate-200 rounded-md px-2 text-[13px] text-right font-semibold text-primary ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                        />

                        {/* Due Date Picker Button */}
                        <TouchableOpacity
                          onPress={() => {
                            if (!isReadOnly && !item.isLocked) {
                              setActiveDatePickerIndex(index);
                            }
                          }}
                          disabled={isReadOnly || item.isLocked}
                          className={`flex-[1.5] ml-2 h-[38px] border border-slate-200 rounded-md items-center justify-center ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                        >
                          <Text className={`text-xs ${item.dueDate ? 'text-slate-900' : 'text-slate-400'}`}>
                            {item.dueDate ? formatDateToDDMMYYYY(item.dueDate) : 'Chọn ngày'}
                          </Text>
                        </TouchableOpacity>

                        {/* Delete action */}
                        {!isReadOnly && (
                          <View className="w-11 items-center">
                            {item.isLocked ? (
                              <Feather name="lock" size={16} color="#94A3B8" />
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleRemoveRow(index)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                className="p-1"
                              >
                                <Feather name="trash-2" size={16} color="#EF4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  /* ============================================================== */
                  /* PORTRAIT MODE: THẺ CARD DỌC INFO CARDS (THUMB ZONE TOUCH)      */
                  /* ============================================================== */
                  <View className="gap-3">
                    {milestones.map((item, index) => (
                      <View
                        key={item._tempId}
                        className="bg-white border border-slate-200 rounded-[14px] p-3.5 shadow-sm"
                      >
                        {/* Card Header: Stt, Tên đợt, Xóa */}
                        <View className="flex-row items-center justify-between mb-2.5">
                          <View className="flex-row items-center gap-1.5 flex-1">
                            <View className="w-6 h-6 rounded-full bg-orange-50 items-center justify-center">
                              <Text className="text-[11px] font-bold text-primary">
                                {index + 1}
                              </Text>
                            </View>

                            <TextInput
                              value={item.name}
                              onChangeText={(t) => handleNameChange(index, t)}
                              editable={!isReadOnly && !item.isLocked}
                              placeholder="Tên đợt thanh toán..."
                              className="flex-1 text-sm font-bold text-slate-900 py-0.5"
                            />
                          </View>

                          {!isReadOnly && (
                            <View>
                              {item.isLocked ? (
                                <View className="flex-row items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Feather name="lock" size={12} color="#64748B" />
                                  <Text className="text-[11px] text-slate-500">Đã thu</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleRemoveRow(index)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  className="w-8 h-8 rounded-full items-center justify-center bg-red-50"
                                >
                                  <Feather name="trash-2" size={15} color="#EF4444" />
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Card Body: Tỷ lệ % & Số tiền */}
                        <View className="flex-row gap-2.5 mb-2.5">
                          {/* % Input */}
                          <View className="w-[90px]">
                            <Text className="text-[11px] text-slate-500 mb-1">
                              Tỷ lệ (%)
                            </Text>
                            <View
                              className={`flex-row items-center border border-slate-200 rounded-lg px-2 h-[42px] ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                            >
                              <TextInput
                                value={String(item.percentage || '')}
                                onChangeText={(t) => handlePercentChange(index, t)}
                                editable={!isReadOnly && !item.isLocked}
                                keyboardType="numeric"
                                placeholder="0"
                                className="flex-1 text-sm font-bold text-slate-900 text-center"
                              />
                              <Text className="text-xs text-slate-400 font-semibold">%</Text>
                            </View>
                          </View>

                          {/* Amount Input */}
                          <View className="flex-1">
                            <Text className="text-[11px] text-slate-500 mb-1">
                              Số tiền thanh toán
                            </Text>
                            <View
                              className={`flex-row items-center border border-slate-200 rounded-lg px-2.5 h-[42px] ${item.isLocked ? 'bg-slate-100' : 'bg-white'}`}
                            >
                              <TextInput
                                value={formatNumberInput(item.amount)}
                                onChangeText={(t) => handleAmountChange(index, t)}
                                editable={!isReadOnly && !item.isLocked}
                                keyboardType="numeric"
                                placeholder="0"
                                className="flex-1 text-sm font-bold text-primary text-right"
                              />
                              <Text className="text-xs text-slate-500 ml-1.5">VNĐ</Text>
                            </View>
                          </View>
                        </View>

                        {/* Card Footer: Hạn thanh toán */}
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[11px] text-slate-500">Hạn thanh toán dự kiến:</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (!isReadOnly && !item.isLocked) {
                                setActiveDatePickerIndex(index);
                              }
                            }}
                            disabled={isReadOnly || item.isLocked}
                            className={`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 ${item.dueDate ? 'bg-blue-50' : 'bg-slate-50'}`}
                          >
                            <Feather
                              name="calendar"
                              size={13}
                              color={item.dueDate ? '#2563EB' : '#64748B'}
                            />
                            <Text
                              className={`text-xs font-semibold ${item.dueDate ? 'text-blue-800' : 'text-slate-500'}`}
                            >
                              {item.dueDate ? formatDateToDDMMYYYY(item.dueDate) : 'Chọn ngày'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* Bottom Sticky Action Bar (Thumb Zone) */}
            {!isReadOnly && (
              <View className="px-5 pt-3 border-t border-slate-100 bg-white flex-row gap-3">
                {/* Add Row Button (Ẩn khi hợp đồng đã hoàn tất/hủy) */}
                {canAddMilestone(contractStatus) && (
                  <TouchableOpacity
                    onPress={handleAddRow}
                    className="flex-1 h-12 rounded-xl border border-orange-200 bg-orange-50 items-center justify-center flex-row gap-1.5"
                  >
                    <Feather name="plus" size={18} color="#F38820" />
                    <Text className="text-sm font-bold text-primary">
                      Thêm đợt
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={bulkSaveMutation.isPending}
                  className={`flex-[1.5] h-12 rounded-xl bg-primary items-center justify-center flex-row gap-2 ${bulkSaveMutation.isPending ? 'opacity-70' : ''}`}
                >
                  {bulkSaveMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="save" size={18} color="#FFFFFF" />
                      <Text className="text-[15px] font-bold text-white">
                        Lưu kế hoạch
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* DatePicker Modal */}
      {activeDatePickerIndex !== null && (
        <DatePickerModal
          visible={activeDatePickerIndex !== null}
          initialDate={milestones[activeDatePickerIndex]?.dueDate}
          title={`Chọn hạn ${milestones[activeDatePickerIndex]?.name || ''}`}
          onConfirm={handleDateConfirm}
          onClose={() => setActiveDatePickerIndex(null)}
        />
      )}
    </Modal>
  );
};
