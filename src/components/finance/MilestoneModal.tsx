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

export interface MilestoneModalProps {
  visible: boolean;
  onClose: () => void;
  contractId: string;
  contractCode?: string;
  sellingPrice?: number;
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
        isLocked: m.status === 'PAID' || m.status === 'COMPLETED',
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMilestones((prev) => prev.filter((_, i) => i !== index));
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
          {
            text: 'Vẫn lưu',
            onPress: () => executeSave(),
          },
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
        style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingTop: isLandscape ? 16 : 40,
          }}
        >
          {/* Backdrop Dismiss touch area */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Draggable Bottom Sheet Container */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: isLandscape ? '94%' : '88%',
              minHeight: '50%',
              paddingBottom: Math.max(insets.bottom, 16),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Drag Handle Bar */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: '#CBD5E1',
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>
                  Kế Hoạch Đợt Thanh Toán
                </Text>
                {contractCode ? (
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Hợp đồng: <Text style={{ fontWeight: '600', color: '#F38820' }}>{contractCode}</Text>
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Summary Metrics Bar */}
            <View
              style={{
                flexDirection: isLandscape ? 'row' : 'column',
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  Giá trị HĐ: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{formatVND(price)}</Text>
                </Text>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  Tổng đã chia:{' '}
                  <Text
                    style={{
                      fontWeight: '700',
                      color: isAmountBalanced ? '#16A34A' : '#EA580C',
                    }}
                  >
                    {formatVND(totalAmount)}
                  </Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Tiến độ tỷ lệ:</Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      backgroundColor: isPercentBalanced ? '#DCFCE7' : '#FEF3C7',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isPercentBalanced ? '#16A34A' : '#D97706',
                      }}
                    >
                      {totalPercentage}% / 100%
                    </Text>
                  </View>
                </View>

                {totalPercentage !== 100 ? (
                  <Text style={{ fontSize: 12, color: totalPercentage > 100 ? '#DC2626' : '#D97706' }}>
                    {totalPercentage > 100
                      ? `Thừa +${(totalPercentage - 100).toFixed(1)}%`
                      : `Còn thiếu ${(100 - totalPercentage).toFixed(1)}%`}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Content Body: Loading or Milestones List */}
            {isFetching ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#F38820" />
                <Text style={{ marginTop: 12, fontSize: 14, color: '#64748B' }}>
                  Đang tải đợt thanh toán...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1, paddingHorizontal: 16 }}
                contentContainerStyle={{ paddingVertical: 12 }}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {milestones.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <MaterialCommunityIcons name="calendar-clock" size={48} color="#CBD5E1" />
                    <Text style={{ marginTop: 8, fontSize: 14, color: '#94A3B8' }}>
                      Chưa có đợt thanh toán nào được thiết lập
                    </Text>
                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={handleAddRow}
                        style={{
                          marginTop: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 8,
                          backgroundColor: '#FFF7ED',
                          borderWidth: 1,
                          borderColor: '#FDCB9E',
                        }}
                      >
                        <Feather name="plus" size={16} color="#F38820" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#F38820' }}>
                          Thêm đợt đầu tiên
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : isLandscape ? (
                  /* ============================================================== */
                  /* LANDSCAPE MODE: EXPANDED TABLE VIEW NHIỀU CỘT                   */
                  /* ============================================================== */
                  <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Table Header */}
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: '#F8FAFC',
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#E2E8F0',
                      }}
                    >
                      <Text style={{ width: 44, fontWeight: '700', fontSize: 12, color: '#475569' }}>STT</Text>
                      <Text style={{ flex: 2, fontWeight: '700', fontSize: 12, color: '#475569' }}>Tên đợt</Text>
                      <Text style={{ width: 85, fontWeight: '700', fontSize: 12, color: '#475569', textAlign: 'center' }}>
                        Tỷ lệ (%)
                      </Text>
                      <Text style={{ flex: 2, fontWeight: '700', fontSize: 12, color: '#475569', textAlign: 'right' }}>
                        Số tiền (VNĐ)
                      </Text>
                      <Text style={{ flex: 1.5, fontWeight: '700', fontSize: 12, color: '#475569', textAlign: 'center' }}>
                        Hạn thanh toán
                      </Text>
                      {!isReadOnly && (
                        <Text style={{ width: 44, fontWeight: '700', fontSize: 12, color: '#475569', textAlign: 'center' }}>
                          Xóa
                        </Text>
                      )}
                    </View>

                    {/* Table Rows */}
                    {milestones.map((item, index) => (
                      <View
                        key={item._tempId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderBottomWidth: index === milestones.length - 1 ? 0 : 1,
                          borderBottomColor: '#F1F5F9',
                          backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        }}
                      >
                        <Text style={{ width: 44, fontSize: 13, color: '#64748B', fontWeight: '600' }}>
                          #{index + 1}
                        </Text>

                        {/* Name Input */}
                        <TextInput
                          value={item.name}
                          onChangeText={(t) => handleNameChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          placeholder="Tên đợt..."
                          style={{
                            flex: 2,
                            height: 38,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            fontSize: 13,
                            color: '#0F172A',
                            backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                          }}
                        />

                        {/* % Input */}
                        <TextInput
                          value={String(item.percentage || '')}
                          onChangeText={(t) => handlePercentChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          keyboardType="numeric"
                          placeholder="%"
                          style={{
                            width: 80,
                            marginHorizontal: 8,
                            height: 38,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 6,
                            textAlign: 'center',
                            fontSize: 13,
                            fontWeight: '600',
                            color: '#0F172A',
                            backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                          }}
                        />

                        {/* Amount Input */}
                        <TextInput
                          value={formatNumberInput(item.amount)}
                          onChangeText={(t) => handleAmountChange(index, t)}
                          editable={!isReadOnly && !item.isLocked}
                          keyboardType="numeric"
                          placeholder="Số tiền..."
                          style={{
                            flex: 2,
                            height: 38,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            fontSize: 13,
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#F38820',
                            backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                          }}
                        />

                        {/* Due Date Picker Button */}
                        <TouchableOpacity
                          onPress={() => {
                            if (!isReadOnly && !item.isLocked) {
                              setActiveDatePickerIndex(index);
                            }
                          }}
                          disabled={isReadOnly || item.isLocked}
                          style={{
                            flex: 1.5,
                            marginLeft: 8,
                            height: 38,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 6,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                          }}
                        >
                          <Text style={{ fontSize: 12, color: item.dueDate ? '#0F172A' : '#94A3B8' }}>
                            {item.dueDate ? formatDateToDDMMYYYY(item.dueDate) : 'Chọn ngày'}
                          </Text>
                        </TouchableOpacity>

                        {/* Delete action */}
                        {!isReadOnly && (
                          <View style={{ width: 44, alignItems: 'center' }}>
                            {item.isLocked ? (
                              <Feather name="lock" size={16} color="#94A3B8" />
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleRemoveRow(index)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ padding: 4 }}
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
                  <View style={{ gap: 12 }}>
                    {milestones.map((item, index) => (
                      <View
                        key={item._tempId}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 14,
                          padding: 14,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 3,
                          elevation: 2,
                        }}
                      >
                        {/* Card Header: Stt, Tên đợt, Xóa */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: '#FFF7ED',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#F38820' }}>
                                {index + 1}
                              </Text>
                            </View>

                            <TextInput
                              value={item.name}
                              onChangeText={(t) => handleNameChange(index, t)}
                              editable={!isReadOnly && !item.isLocked}
                              placeholder="Tên đợt thanh toán..."
                              style={{
                                flex: 1,
                                fontSize: 14,
                                fontWeight: '700',
                                color: '#0F172A',
                                paddingVertical: 2,
                              }}
                            />
                          </View>

                          {!isReadOnly && (
                            <View>
                              {item.isLocked ? (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: '#F1F5F9',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Feather name="lock" size={12} color="#64748B" />
                                  <Text style={{ fontSize: 11, color: '#64748B' }}>Đã thu</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleRemoveRow(index)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#FEF2F2',
                                  }}
                                >
                                  <Feather name="trash-2" size={15} color="#EF4444" />
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Card Body: Tỷ lệ % & Số tiền */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                          {/* % Input */}
                          <View style={{ width: 90 }}>
                            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                              Tỷ lệ (%)
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                height: 42,
                                backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                              }}
                            >
                              <TextInput
                                value={String(item.percentage || '')}
                                onChangeText={(t) => handlePercentChange(index, t)}
                                editable={!isReadOnly && !item.isLocked}
                                keyboardType="numeric"
                                placeholder="0"
                                style={{
                                  flex: 1,
                                  fontSize: 14,
                                  fontWeight: '700',
                                  color: '#0F172A',
                                  textAlign: 'center',
                                }}
                              />
                              <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>%</Text>
                            </View>
                          </View>

                          {/* Amount Input */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                              Số tiền thanh toán
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                height: 42,
                                backgroundColor: item.isLocked ? '#F1F5F9' : '#FFFFFF',
                              }}
                            >
                              <TextInput
                                value={formatNumberInput(item.amount)}
                                onChangeText={(t) => handleAmountChange(index, t)}
                                editable={!isReadOnly && !item.isLocked}
                                keyboardType="numeric"
                                placeholder="0"
                                style={{
                                  flex: 1,
                                  fontSize: 14,
                                  fontWeight: '700',
                                  color: '#F38820',
                                  textAlign: 'right',
                                }}
                              />
                              <Text style={{ fontSize: 12, color: '#64748B', marginLeft: 6 }}>VNĐ</Text>
                            </View>
                          </View>
                        </View>

                        {/* Card Footer: Hạn thanh toán */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>Hạn thanh toán dự kiến:</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (!isReadOnly && !item.isLocked) {
                                setActiveDatePickerIndex(index);
                              }
                            }}
                            disabled={isReadOnly || item.isLocked}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              backgroundColor: item.dueDate ? '#EFF6FF' : '#F8FAFC',
                            }}
                          >
                            <Feather
                              name="calendar"
                              size={13}
                              color={item.dueDate ? '#2563EB' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: item.dueDate ? '#1E40AF' : '#64748B',
                              }}
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
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: '#F1F5F9',
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  gap: 12,
                }}
              >
                {/* Add Row Button */}
                <TouchableOpacity
                  onPress={handleAddRow}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#FDCB9E',
                    backgroundColor: '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  <Feather name="plus" size={18} color="#F38820" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#F38820' }}>
                    Thêm đợt
                  </Text>
                </TouchableOpacity>

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={bulkSaveMutation.isPending}
                  style={{
                    flex: 1.5,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: '#F38820',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    opacity: bulkSaveMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {bulkSaveMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="save" size={18} color="#FFFFFF" />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
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
