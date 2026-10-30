import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import ServiceSelectorModal from '@/components/catalog/ServiceSelectorModal';
import { useCreateProjectServiceAddendumMutation } from '@/hooks/queries/useProjects';
import type { ProjectDetailItem } from '@/services/projectService';
import { useAuthStore } from '@/stores/useAuthStore';
import { hasProjectAccount } from '@/utils/teamMember';
import type { SelectedCatalogItem } from '@/utils/catalogPricing';
import { formatNumberInput, formatVND, parseNumberInput } from '@/utils/formatters';
import {
  canAddProjectServices, toProjectServiceItems, validateProjectServiceAddendum,
  ProjectServiceAddendumItem,
} from '@/utils/projectServiceAddendum';

interface Row extends ProjectServiceAddendumItem {
  key: string;
  templateId?: string | null;
  norm: number;
  quantityText: string;
  priceText: string;
  packageQuantityText?: string;
}

interface Props {
  project: ProjectDetailItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddProjectServiceModal({ project, onClose, onSuccess }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const canCreate = canAddProjectServices(role, {
    status: project.status, isOnHold: Boolean((project as { isOnHold?: boolean }).isOnHold),
    hasAccount: hasProjectAccount(project),
  });
  const mutation = useCreateProjectServiceAddendumMutation();
  const busy = useRef(false);
  const [name, setName] = useState(project.name + ' - Phụ lục bổ sung dịch vụ');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  const addSelected = (selected: SelectedCatalogItem[]) => {
    const templateId = selected[0]?.servicePackageId;
    if (templateId && rows.some((row) => row.templateId === templateId)) {
      Alert.alert('Gói đã được chọn', 'Hãy chỉnh số lượng của gói đã có trong phụ lục.');
      return;
    }
    const packageKey = templateId ? 'package-' + templateId : undefined;
    const newItems = toProjectServiceItems(selected, packageKey);
    setRows((previous) => [
      ...previous,
      ...newItems.filter((item) => item.isPackageService ||
        !previous.some((row) => !row.isPackageService && row.serviceId === item.serviceId))
        .map((item) => ({
          ...item, key: (item.packageKey || 'standalone') + ':' + item.serviceId,
          templateId, norm: item.quantity,
          quantityText: formatNumberInput(item.quantity),
          priceText: formatNumberInput(item.sellingPrice),
          packageQuantityText: item.isPackageService ? '1' : undefined,
        })),
    ]);
  };

  const updatePackageQuantity = (packageKey: string, value: string) => {
    const masked = formatNumberInput(value);
    const quantity = parseNumberInput(masked);
    setRows((previous) => previous.map((row) => row.packageKey === packageKey ? {
      ...row, packageQuantity: quantity, packageQuantityText: masked,
      quantityText: formatNumberInput(row.norm * quantity),
    } : row));
  };

  const items = rows.map(({ serviceId, serviceName, cost, packageKey, packageName, packageQuantity, isPackageService, quantityText, priceText }) => ({
    serviceId, serviceName, cost, packageKey, packageName, packageQuantity, isPackageService,
    quantity: parseNumberInput(quantityText), sellingPrice: parseNumberInput(priceText),
  }));
  const total = items.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const cost = items.reduce((sum, item) => sum + item.quantity * item.cost, 0);

  const submit = async () => {
    if (!canCreate || busy.current) return;
    const payload = { name: name.trim(), description: description.trim(), items };
    const error = validateProjectServiceAddendum(payload);
    if (error) { Alert.alert('Lỗi nhập liệu', error); return; }
    busy.current = true;
    try {
      await mutation.mutateAsync({ projectId: project.id, payload });
      Alert.alert('Đã gửi yêu cầu', 'Đã gửi yêu cầu');
      onSuccess?.();
      onClose();
    } catch (error) {
      Alert.alert('Không thể gửi yêu cầu', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally { busy.current = false; }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy.current) onClose(); }}>
      <KeyboardAvoidingView className="flex-1 justify-end bg-black/50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="max-h-[90%] rounded-t-3xl bg-white">
          <View className="p-4 border-b border-slate-100">
            <Text className="text-lg font-bold text-slate-900">Thêm dịch vụ</Text>
            <Text className="text-xs text-slate-500 mt-1">Tạo phụ lục bổ sung · BD duyệt → BOD duyệt</Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!canCreate ? <Text className="text-red-600">Dự án chưa đủ điều kiện hoặc bạn không có quyền bổ sung dịch vụ.</Text> : null}
            <Text className="text-xs font-bold text-slate-600">Tên phụ lục *</Text>
            <TextInput accessibilityLabel="Tên phụ lục" className="min-h-[48px] border border-slate-200 rounded-xl p-3 text-slate-900" value={name} onChangeText={setName} editable={!mutation.isPending} />
            <Text className="text-xs font-bold text-slate-600">Mô tả</Text>
            <TextInput accessibilityLabel="Mô tả phụ lục" multiline className="min-h-[80px] border border-slate-200 rounded-xl p-3 text-slate-900" value={description} onChangeText={setDescription} editable={!mutation.isPending} />
            {rows.map((row, index) => (
              <View key={row.key} className="rounded-xl border border-slate-200 p-3 gap-2">
                {row.packageKey && !rows.slice(0, index).some((item) => item.packageKey === row.packageKey) ? (
                  <View className="gap-2 pb-2 border-b border-slate-100">
                    <Text className="font-bold text-blue-700">Gói: {row.packageName}</Text>
                    <Text className="text-xs text-slate-600">Số lượng gói</Text>
                    <TextInput accessibilityLabel={'Số lượng gói ' + row.packageName} keyboardType="number-pad" className="min-h-[48px] border border-slate-200 rounded-lg px-3 text-slate-900" value={row.packageQuantityText} editable={!mutation.isPending} onChangeText={(text) => updatePackageQuantity(row.packageKey!, text)} />
                    <TouchableOpacity disabled={mutation.isPending} onPress={() => setRows((previous) => previous.filter((item) => item.packageKey !== row.packageKey))}><Text className="text-xs text-red-600 py-2">Gỡ cả gói</Text></TouchableOpacity>
                  </View>
                ) : null}
                <Text className="font-bold text-slate-900">{row.serviceName}</Text>
                <Text className="text-xs text-slate-500">Giá vốn/đơn vị: {formatVND(row.cost)}</Text>
                <Text className="text-xs text-slate-600">{row.isPackageService ? 'Số lượng (định mức × số gói)' : 'Số lượng dịch vụ'}</Text>
                <TextInput accessibilityLabel={'Số lượng ' + row.serviceName} keyboardType="number-pad" className="min-h-[48px] border border-slate-200 rounded-lg px-3 text-slate-900" value={row.quantityText} editable={!mutation.isPending && !row.isPackageService} onChangeText={(text) => setRows((previous) => previous.map((item) => item.key === row.key ? { ...item, quantityText: formatNumberInput(text) } : item))} />
                <Text className="text-xs text-slate-600">Đơn giá bán (VNĐ)</Text>
                <TextInput accessibilityLabel={'Đơn giá ' + row.serviceName} keyboardType="number-pad" className="min-h-[48px] border border-slate-200 rounded-lg px-3 text-slate-900" value={row.priceText} editable={!mutation.isPending} onChangeText={(text) => setRows((previous) => previous.map((item) => item.key === row.key ? { ...item, priceText: formatNumberInput(text) } : item))} />
                <Text className="text-sm font-bold text-primary">Thành tiền: {formatVND(parseNumberInput(row.quantityText) * parseNumberInput(row.priceText))}</Text>
                {!row.isPackageService ? <TouchableOpacity disabled={mutation.isPending} className="min-h-[48px] justify-center" onPress={() => setRows((previous) => previous.filter((item) => item.key !== row.key))}><Text className="text-xs text-red-600">Gỡ dịch vụ</Text></TouchableOpacity> : null}
              </View>
            ))}
            <TouchableOpacity disabled={!canCreate || mutation.isPending} className="min-h-[48px] justify-center items-center border border-dashed border-primary rounded-xl" onPress={() => { setPickerKey((key) => key + 1); setPickerOpen(true); }}><Text className="font-bold text-primary">Chọn dịch vụ / gói dịch vụ</Text></TouchableOpacity>
            <View className="border-t border-slate-200 pt-3 gap-1">
              <Text className="text-xs text-slate-500">Tổng giá vốn: {formatVND(cost)}</Text>
              <Text className="font-bold text-primary">Tổng tiền: {formatVND(total)}</Text>
            </View>
          </ScrollView>
          <View className="flex-row gap-3 p-4 border-t border-slate-100">
            <TouchableOpacity disabled={mutation.isPending} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100" onPress={onClose}><Text className="font-bold text-slate-600">Hủy</Text></TouchableOpacity>
            <TouchableOpacity testID="submitProjectServices" disabled={!canCreate || mutation.isPending || !rows.length} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary" onPress={submit}>{mutation.isPending ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Gửi BD duyệt</Text>}</TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      {pickerOpen ? <ServiceSelectorModal key={pickerKey} visible title="Chọn dịch vụ bổ sung" onClose={() => setPickerOpen(false)} onConfirm={addSelected} /> : null}
    </Modal>
  );
}
