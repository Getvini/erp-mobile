import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useExtraTaskQuotationMutation } from '@/hooks/queries/useQuotations';
import type { QuotationItem } from '@/services/quotationService';
import { formatNumberInput, formatVND, parseNumberInput } from '@/utils/formatters';
import type { ExtraTaskItem } from './ContractExtraTasksSection';

interface Props {
  task: ExtraTaskItem;
  projectId: string;
  contractId: string;
  opportunityId: string;
  initialPrice?: number;
  onClose: () => void;
  onCreated: (quotation: QuotationItem) => void;
}

export default function AddendumQuotationModal(props: Props) {
  const mutation = useExtraTaskQuotationMutation();
  const busy = useRef(false);
  const [priceMode, setPriceMode] = useState<'minimum' | 'recommended' | 'custom'>(
    (props.initialPrice || props.task.sellingPrice || 0) > 0 ? 'custom' : 'recommended',
  );
  const [priceText, setPriceText] = useState(formatNumberInput(props.initialPrice || props.task.sellingPrice || 0));
  const [note, setNote] = useState('Báo giá phụ lục cho công việc: ' + (props.task.name || props.task.title || ''));
  const [errorText, setErrorText] = useState('');
  const cost = Number(props.task.job?.costPrice ?? props.task.cost ?? 0);
  // Match AddendumQuotationModal on web, which uses markup rather than catalog margins.
  const price = priceMode === 'minimum' ? cost * 1.2 : priceMode === 'recommended' ? cost * 1.4 : parseNumberInput(priceText);

  const submit = async () => {
    if (busy.current) return;
    if (!props.opportunityId || !props.projectId || !props.contractId) {
      Alert.alert('Thiếu liên kết', 'Cần đủ dự án, hợp đồng và cơ hội trước khi định giá.'); return;
    }
    if (!Number.isFinite(price) || price <= 0) { Alert.alert('Đơn giá không hợp lệ', 'Đơn giá phải lớn hơn 0.'); return; }
    busy.current = true;
    setErrorText('');
    try {
      const quotation = await mutation.mutateAsync({
        taskId: props.task.id, projectId: props.projectId, contractId: props.contractId,
        opportunityId: props.opportunityId, sellingPrice: price, note,
      });
      props.onCreated(quotation);
      Alert.alert('Thành công', 'Đã tạo hoặc tìm thấy báo giá phụ lục. Hãy theo dõi trạng thái duyệt của báo giá.');
      props.onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Không thể tạo báo giá.');
    } finally { busy.current = false; }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy.current) props.onClose(); }}>
      <KeyboardAvoidingView className="flex-1 justify-end bg-black/50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="max-h-[90%] rounded-t-3xl bg-white">
          <View className="p-4 border-b border-slate-100"><Text className="text-lg font-bold text-slate-900">Tạo báo giá phụ lục</Text></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text className="font-bold text-slate-900">{props.task.name || props.task.title}</Text>
            <Text className="text-xs text-slate-500">Giá vốn: {formatVND(cost)}</Text>
            {(['minimum', 'recommended', 'custom'] as const).map((mode) => (
              <TouchableOpacity key={mode} disabled={mutation.isPending} accessibilityRole="radio" accessibilityState={{ checked: priceMode === mode }} className="min-h-[48px] justify-center rounded-xl border border-slate-200 px-3" onPress={() => setPriceMode(mode)}>
                <Text className={priceMode === mode ? 'font-bold text-primary' : 'text-slate-700'}>
                  {mode === 'minimum' ? 'Giá tối thiểu (+20%): ' + formatVND(cost * 1.2) : mode === 'recommended' ? 'Giá đề xuất (+40%): ' + formatVND(cost * 1.4) : 'Giá tùy chỉnh'}
                </Text>
              </TouchableOpacity>
            ))}
            {priceMode === 'custom' ? <TextInput accessibilityLabel="Đơn giá báo giá phụ lục" keyboardType="number-pad" className="min-h-[48px] rounded-xl border border-slate-200 p-3 text-slate-900" value={priceText} onChangeText={(value) => setPriceText(formatNumberInput(value))} editable={!mutation.isPending} /> : null}
            <Text className="font-bold text-primary">Giá bán: {formatVND(price)}</Text>
            <Text className="text-xs text-slate-600">Ghi chú báo giá</Text>
            <TextInput accessibilityLabel="Ghi chú báo giá phụ lục" multiline className="min-h-[80px] rounded-xl border border-slate-200 p-3 text-slate-900" value={note} onChangeText={setNote} editable={!mutation.isPending} />
            {!!errorText && <Text accessibilityRole="alert" className="text-sm text-red-600">{errorText}</Text>}
          </ScrollView>
          <View className="flex-row gap-3 p-4 border-t border-slate-100">
            <TouchableOpacity disabled={mutation.isPending} className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-slate-100" onPress={props.onClose}><Text className="font-bold text-slate-600">Đóng</Text></TouchableOpacity>
            <TouchableOpacity testID="submitExtraTaskQuotation" disabled={mutation.isPending} className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-primary" onPress={submit}>{mutation.isPending ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">{errorText ? 'Thử lại' : 'Tạo báo giá'}</Text>}</TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
