import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  AddendumServiceLine,
  ContractAddendum,
  ADDENDUM_STATUS_CONFIG,
  ADDENDUM_TYPE_LABELS,
  canBodReviewAddendum,
  canEditAddendumPrices,
  canResubmitAddendum,
  canSaleReviewAddendum,
  computeAddendumLineTotals,
  getAddendumMinimumPrice,
  getAddendumRecommendedPrice,
} from '@/services/contractAddendumService';
import {
  useBodApproveAddendumMutation,
  useBodRejectAddendumMutation,
  useResubmitAddendumMutation,
  useSaleApproveAddendumMutation,
  useSaleRejectAddendumMutation,
} from '@/hooks/queries/useContractAddendums';
import {
  formatDateToDDMMYYYY,
  formatNumberInput,
  parseNumberInput,
  formatVNDFull,
} from '@/utils/formatters';
import AddendumRejectModal from './AddendumRejectModal';

const STANDALONE = 'STANDALONE';

type PriceMode = 'recommended' | 'minimum' | 'custom';

interface GroupedService {
  key: string;
  serviceName: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  lineCost: number;
  lineVat: number;
  lineTotalWithVat: number;
  itemIndexes: number[];
}

interface GroupedPackage {
  key: string;
  packageName: string;
  quantity: number;
  /** Tổng giá bán của gói (chưa VAT). */
  sellingPrice: number;
  cost: number;
  vat: number;
  totalWithVat: number;
  services: GroupedService[];
  itemIndexes: number[];
}

const getServiceKey = (item: AddendumServiceLine, index: number): string =>
  String(item.serviceId || item.serviceName || item.name || `service-${index}`);

/**
 * Gom nhóm dòng dịch vụ của phụ lục thành "Gói" và "Dịch vụ lẻ"
 * — mirror erp-UI ContractAddendums.jsx:61-167 (buildGroupedItems).
 */
export const buildAddendumGroups = (items: AddendumServiceLine[]) => {
  const packages: Record<string, GroupedPackage> = {};
  const standaloneMap: Record<string, GroupedService> = {};

  (items || []).forEach((item, index) => {
    const quantity = Number(item.quantity || 1) || 1;
    const totals = computeAddendumLineTotals({ ...item, quantity });
    const unit = String(item.unit || '');
    const serviceName = String(item.serviceName || item.name || 'Dịch vụ');

    const packageName = item.packageName ? String(item.packageName) : '';
    const isPackageLine = Boolean(packageName) && packageName !== STANDALONE;

    if (!isPackageLine) {
      const key = getServiceKey(item, index);
      if (!standaloneMap[key]) {
        standaloneMap[key] = {
          key,
          serviceName,
          unit,
          quantity: 0,
          sellingPrice: Number(item.sellingPrice || 0),
          lineCost: 0,
          lineVat: 0,
          lineTotalWithVat: 0,
          itemIndexes: [],
        };
      }
      const group = standaloneMap[key];
      group.quantity += quantity;
      group.sellingPrice = Number(item.sellingPrice || 0);
      group.unit = group.unit || unit;
      group.lineCost += totals.lineCost;
      group.lineVat += totals.lineVat;
      group.lineTotalWithVat += totals.lineTotalWithVat;
      group.itemIndexes.push(index);
      return;
    }

    const packageKey = String(item.packageKey || packageName);
    if (!packages[packageKey]) {
      packages[packageKey] = {
        key: packageKey,
        packageName,
        quantity: 1,
        sellingPrice: 0,
        cost: 0,
        vat: 0,
        totalWithVat: 0,
        services: [],
        itemIndexes: [],
      };
    }
    const pkg = packages[packageKey];
    const childKey = getServiceKey(item, index);
    let child = pkg.services.find((s) => s.key === childKey);
    if (!child) {
      child = {
        key: childKey,
        serviceName,
        unit,
        quantity: 0,
        sellingPrice: Number(item.sellingPrice || 0),
        lineCost: 0,
        lineVat: 0,
        lineTotalWithVat: 0,
        itemIndexes: [],
      };
      pkg.services.push(child);
    }
    child.quantity += quantity;
    child.sellingPrice = Number(item.sellingPrice || 0);
    child.lineCost += totals.lineCost;
    child.lineVat += totals.lineVat;
    child.lineTotalWithVat += totals.lineTotalWithVat;
    child.itemIndexes.push(index);

    pkg.sellingPrice += totals.lineSellingPrice;
    pkg.cost += totals.lineCost;
    pkg.vat += totals.lineVat;
    pkg.totalWithVat += totals.lineTotalWithVat;
    pkg.itemIndexes.push(index);
    pkg.quantity = Math.max(
      pkg.quantity,
      Number(item.packageQuantity || quantity || 1) || 1,
    );
  });

  return {
    packages: Object.values(packages),
    standalone: Object.values(standaloneMap),
  };
};

// ---------------------------------------------------------------------------
// Khối hiển thị nhỏ
// ---------------------------------------------------------------------------

const Field = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <View className="flex-row items-center justify-between gap-[8px]">
    <Text className="text-[11px] text-slate-500">{label}</Text>
    <Text
      className={`text-[12px] ${strong ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}
      style={{ flexShrink: 1, textAlign: 'right' }}
    >
      {value}
    </Text>
  </View>
);

const PriceChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    className={`flex-1 min-h-[40px] items-center justify-center rounded-[8px] border ${
      active ? 'bg-[#1D4ED8] border-[#1D4ED8]' : 'bg-white border-blue-200'
    }`}
  >
    <Text
      className={`text-[10px] font-bold ${active ? 'text-white' : 'text-[#1D4ED8]'}`}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ServiceLineCard = ({
  serviceName,
  unit,
  quantity,
  sellingPrice,
  lineCost,
  lineVat,
  lineTotalWithVat,
  quantitySuffix,
  editable,
  priceMode,
  onSelectMode,
  onChangePrice,
  compact,
}: {
  serviceName: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  lineCost: number;
  lineVat: number;
  lineTotalWithVat: number;
  quantitySuffix?: string;
  editable: boolean;
  priceMode: PriceMode;
  onSelectMode: (mode: PriceMode) => void;
  onChangePrice: (value: number) => void;
  compact?: boolean;
}) => (
  <View
    className={`rounded-[10px] border p-[10px] gap-[5px] ${
      compact ? 'bg-white border-[#E0F2FE] ml-[6px]' : 'bg-slate-50 border-slate-200'
    }`}
  >
    <Text
      className={`${compact ? 'text-[12px] text-[#0C4A6E]' : 'text-[13px] text-slate-800'} font-bold`}
    >
      {serviceName}
    </Text>

    <Field
      label="Số lượng"
      value={`${quantity} ${unit}${quantitySuffix ? ` ${quantitySuffix}` : ''}`.trim()}
    />
    <Field label="Đơn giá" value={formatVNDFull(Math.round(sellingPrice))} />
    <Field label="Giá vốn" value={formatVNDFull(lineCost)} />
    <Field label="VAT (8%)" value={formatVNDFull(lineVat)} />
    <Field label="Thành tiền" value={formatVNDFull(lineTotalWithVat)} strong />

    {editable && (
      <View className="gap-[6px] mt-[4px] pt-[8px] border-t border-t-blue-100">
        <View className="flex-row gap-[6px]">
          <PriceChip
            label="Giá đề xuất"
            active={priceMode === 'recommended'}
            onPress={() => onSelectMode('recommended')}
          />
          <PriceChip
            label="Giá tối thiểu"
            active={priceMode === 'minimum'}
            onPress={() => onSelectMode('minimum')}
          />
          <PriceChip
            label="Tùy chỉnh"
            active={priceMode === 'custom'}
            onPress={() => onSelectMode('custom')}
          />
        </View>
        <View className="flex-row items-center gap-[6px]">
          <TextInput
            value={formatNumberInput(String(Math.round(sellingPrice)))}
            onChangeText={(text) => onChangePrice(parseNumberInput(text))}
            editable={priceMode === 'custom'}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94A3B8"
            className={`flex-1 min-h-[44px] rounded-[10px] border px-[10px] text-right text-[13px] font-bold ${
              priceMode === 'custom'
                ? 'border-[#1D4ED8] bg-white text-[#1D4ED8]'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
          />
          <Text className="text-[11px] font-bold text-slate-500">VNĐ</Text>
        </View>
      </View>
    )}
  </View>
);

// ---------------------------------------------------------------------------
// Modal chi tiết phụ lục
// ---------------------------------------------------------------------------

export interface AddendumDetailModalProps {
  visible: boolean;
  addendum: ContractAddendum | null;
  contractId: string;
  /** Role hiện tại (đã uppercase) — dùng cho RBAC duyệt / gửi lại / sửa giá. */
  role?: string;
  onClose: () => void;
}

export default function AddendumDetailModal({
  visible,
  addendum,
  contractId,
  role,
  onClose,
}: AddendumDetailModalProps) {
  const selectedItems: AddendumServiceLine[] = useMemo(() => {
    const raw = (addendum as any)?.selectedItems ?? addendum?.services ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [addendum]);

  const [editableItems, setEditableItems] = useState<AddendumServiceLine[]>(selectedItems);
  const [priceModes, setPriceModes] = useState<Record<string, PriceMode>>({});
  const [isRejectVisible, setIsRejectVisible] = useState(false);

  const saleApproveMutation = useSaleApproveAddendumMutation();
  const saleRejectMutation = useSaleRejectAddendumMutation();
  const resubmitMutation = useResubmitAddendumMutation();
  const bodApproveMutation = useBodApproveAddendumMutation();
  const bodRejectMutation = useBodRejectAddendumMutation();

  const isMutating =
    saleApproveMutation.isPending ||
    saleRejectMutation.isPending ||
    resubmitMutation.isPending ||
    bodApproveMutation.isPending ||
    bodRejectMutation.isPending;

  /**
   * Khởi tạo danh sách dòng có thể sửa mỗi khi mở modal cho một phụ lục khác.
   * Điều chỉnh state trong lúc render thay vì useEffect (tránh set-state-in-effect).
   */
  const editSignature = visible ? `${addendum?.id ?? ''}` : '';
  const [syncedEditSignature, setSyncedEditSignature] = useState(editSignature);
  if (editSignature !== syncedEditSignature) {
    setSyncedEditSignature(editSignature);
    if (visible) {
      setEditableItems(selectedItems);
      setPriceModes({});
      setIsRejectVisible(false);
    }
  }

  const status = String(addendum?.status || '');
  const statusConfig = ADDENDUM_STATUS_CONFIG[status] || {
    text: status || 'Chưa xác định',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  };
  const typeLabel = addendum?.type ? ADDENDUM_TYPE_LABELS[String(addendum.type)] : '';

  const canSaleReview = canSaleReviewAddendum(role, status);
  const canBodReview = canBodReviewAddendum(role, status);
  const canResubmit = canResubmitAddendum(role, status);
  const canEditPrices = canEditAddendumPrices(role, status);
  const canReview = canSaleReview || canBodReview;

  const grouped = useMemo(() => buildAddendumGroups(editableItems), [editableItems]);

  const totalWithVat = useMemo(
    () =>
      editableItems.reduce(
        (sum, line) => sum + computeAddendumLineTotals(line).lineTotalWithVat,
        0,
      ),
    [editableItems],
  );

  // -------------------------------------------------------------------------
  // Cập nhật giá (giữ NGUYÊN độ dài & thứ tự serviceId của mảng selectedItems)
  // -------------------------------------------------------------------------
  const updateLinePrice = (itemIndexes: number[], value: number) => {
    setEditableItems((prev) =>
      prev.map((item, index) =>
        itemIndexes.includes(index) ? { ...item, sellingPrice: value } : item,
      ),
    );
  };

  const updatePackagePrice = (pkg: GroupedPackage, value: number) => {
    const newTotal = Number(value || 0);
    setEditableItems((prev) => {
      const indexSet = new Set(pkg.itemIndexes);
      const currentTotal = pkg.itemIndexes.reduce((sum, index) => {
        const item = prev[index];
        return sum + Number(item?.sellingPrice || 0) * Number(item?.quantity || 1);
      }, 0);
      const totalCost = pkg.itemIndexes.reduce((sum, index) => {
        const item = prev[index];
        return sum + Number(item?.cost || 0) * Number(item?.quantity || 1);
      }, 0);
      const fallbackShare =
        pkg.itemIndexes.length > 0 ? newTotal / pkg.itemIndexes.length : 0;

      return prev.map((item, index) => {
        if (!indexSet.has(index)) return item;
        const quantity = Number(item.quantity || 1) || 1;
        const currentLinePrice = Number(item.sellingPrice || 0) * quantity;
        const costLine = Number(item.cost || 0) * quantity;
        // Phân bổ lại theo tỉ lệ doanh thu, fallback theo giá vốn (ContractAddendums.jsx:424-458).
        const newLinePrice =
          currentTotal > 0
            ? currentLinePrice * (newTotal / currentTotal)
            : totalCost > 0
              ? newTotal * (costLine / totalCost)
              : fallbackShare;
        return { ...item, sellingPrice: newLinePrice / quantity };
      });
    });
  };

  const getMode = (key: string): PriceMode => priceModes[key] || 'custom';

  const selectMode = (
    key: string,
    mode: PriceMode,
    costBase: number,
    applyPrice: (value: number) => void,
  ) => {
    setPriceModes((prev) => ({ ...prev, [key]: mode }));
    if (mode === 'recommended') applyPrice(getAddendumRecommendedPrice(costBase));
    else if (mode === 'minimum') applyPrice(getAddendumMinimumPrice(costBase));
  };

  // -------------------------------------------------------------------------
  // Hành động duyệt / từ chối / gửi lại
  // -------------------------------------------------------------------------
  const closeAfterAction = (message: string) => {
    setIsRejectVisible(false);
    onClose();
    Alert.alert('Thành công', message);
  };

  const handleError = (err: any) => {
    Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi xử lý phụ lục');
  };

  const runSaleApprove = async () => {
    if (!addendum) return;
    try {
      // Sale duyệt: gửi selectedItems GIỮ NGUYÊN độ dài & thứ tự serviceId.
      await saleApproveMutation.mutateAsync({
        id: addendum.id,
        contractId,
        selectedItems: editableItems,
      });
      closeAfterAction('Đã duyệt phụ lục');
    } catch (err) {
      handleError(err);
    }
  };

  const runBodApprove = async () => {
    if (!addendum) return;
    try {
      // BOD duyệt: chỉ gửi note (backend tự sinh công việc).
      await bodApproveMutation.mutateAsync({ id: addendum.id, contractId, note: '' });
      closeAfterAction('Đã duyệt và sinh công việc');
    } catch (err) {
      handleError(err);
    }
  };

  const runResubmit = async () => {
    if (!addendum) return;
    try {
      // ⚠️ Backend resubmit chỉ đọc { selectedItems, name, description } — KHÔNG gửi note.
      await resubmitMutation.mutateAsync({
        id: addendum.id,
        contractId,
        selectedItems: editableItems,
      });
      closeAfterAction('Đã gửi lại phụ lục');
    } catch (err) {
      handleError(err);
    }
  };

  const runReject = async (note: string) => {
    if (!addendum) return;
    try {
      if (canSaleReview) {
        await saleRejectMutation.mutateAsync({ id: addendum.id, contractId, note });
      } else {
        await bodRejectMutation.mutateAsync({ id: addendum.id, contractId, note });
      }
      closeAfterAction('Đã không duyệt phụ lục');
    } catch (err) {
      handleError(err);
    }
  };

  const confirmResubmit = () =>
    Alert.alert('Xác nhận gửi lại', 'Gửi lại phụ lục này để duyệt từ bước Sale?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Gửi lại', onPress: () => void runResubmit() },
    ]);

  const confirmApprove = () =>
    Alert.alert(
      'Xác nhận duyệt',
      canSaleReview
        ? 'Duyệt phụ lục này và chuyển sang bước BOD?'
        : 'Duyệt phụ lục này và sinh công việc?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt',
          onPress: () => void (canSaleReview ? runSaleApprove() : runBodApprove()),
        },
      ],
    );

  if (!addendum) return null;

  const hasServices = grouped.packages.length > 0 || grouped.standalone.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-slate-900/50 justify-end" onPress={onClose}>
        <Pressable
          className="bg-white rounded-t-[24px] max-h-[90%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="px-[20px] pt-[10px] pb-[12px] border-b border-b-slate-100">
            <View className="items-center mb-[10px]">
              <View className="w-[44px] h-[4px] rounded-full bg-slate-300" />
            </View>

            <View className="flex-row items-start justify-between gap-[10px]">
              <View className="flex-row items-start gap-[10px]" style={{ flex: 1 }}>
                <View
                  style={{ backgroundColor: '#F3E8FF' }}
                  className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
                >
                  <Feather name="file-text" size={18} color="#9333EA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-[16px] font-extrabold text-slate-900">
                    {addendum.name || 'Phụ lục hợp đồng'}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-[6px] mt-[5px]">
                    <View
                      style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
                      className="px-[8px] py-[2px] rounded-full border"
                    >
                      <Text
                        style={{ color: statusConfig.color }}
                        className="text-[10px] font-black uppercase tracking-[0.4px]"
                      >
                        {statusConfig.text}
                      </Text>
                    </View>
                    {addendum.monthKey ? (
                      <View className="bg-slate-100 px-[8px] py-[2px] rounded-full">
                        <Text className="text-[10px] font-black text-slate-600">
                          {addendum.monthKey}
                        </Text>
                      </View>
                    ) : null}
                    {!!typeLabel && (
                      <View className="bg-[#EFF6FF] px-[8px] py-[2px] rounded-full">
                        <Text className="text-[10px] font-black text-[#1D4ED8]">{typeLabel}</Text>
                      </View>
                    )}
                  </View>
                  {!!addendum.createdAt && (
                    <View className="flex-row items-center gap-[4px] mt-[5px]">
                      <Feather name="calendar" size={12} color="#94A3B8" />
                      <Text className="text-[11px] text-slate-500">
                        {formatDateToDDMMYYYY(addendum.createdAt)}
                      </Text>
                    </View>
                  )}
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
          </View>

          {/* Body */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerClassName="p-[16px] gap-[14px]"
            showsVerticalScrollIndicator={false}
          >
            {/* Ghi chú */}
            {!!addendum.description && (
              <View className="bg-[#FAF5FF] border border-[#E9D5FF] rounded-[12px] p-[12px]">
                <Text className="text-[12px] font-bold text-slate-700 mb-[4px]">Ghi chú:</Text>
                <Text className="text-[12px] text-slate-600 leading-[17px]">
                  {addendum.description}
                </Text>
              </View>
            )}

            {/* Box đỏ: lý do Sale / BOD không duyệt */}
            {(!!addendum.saleReviewNote || !!addendum.bodReviewNote) && (
              <View className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-[12px] gap-[4px]">
                {!!addendum.saleReviewNote && (
                  <Text className="text-[12px] text-red-700 leading-[17px]">
                    <Text className="font-black">Sale: </Text>
                    {addendum.saleReviewNote}
                  </Text>
                )}
                {!!addendum.bodReviewNote && (
                  <Text className="text-[12px] text-red-700 leading-[17px]">
                    <Text className="font-black">BOD: </Text>
                    {addendum.bodReviewNote}
                  </Text>
                )}
              </View>
            )}

            {canResubmit && (
              <View className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[12px] p-[12px]">
                <Text className="text-[12px] font-semibold text-[#1E3A8A] leading-[17px]">
                  Phụ lục đã bị từ chối. PM có thể chỉnh đơn giá rồi gửi lại để duyệt từ bước Sale.
                </Text>
              </View>
            )}

            {/* Chi tiết dịch vụ — card dọc, KHÔNG bảng ngang trên mobile */}
            <View className="gap-[10px]">
              <Text className="text-[13px] font-extrabold text-slate-900">Chi tiết dịch vụ</Text>

              {!hasServices && (
                <View className="items-center justify-center gap-[6px] p-[24px] border border-dashed border-slate-200 rounded-[12px]">
                  <Feather name="layers" size={22} color="#CBD5E1" />
                  <Text className="text-[12px] italic text-slate-400">
                    Chưa có dịch vụ nào trong phụ lục.
                  </Text>
                </View>
              )}

              {/* Nhóm Gói */}
              {grouped.packages.map((pkg) => (
                <View
                  key={`pkg-${pkg.key}`}
                  className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-[12px] p-[12px] gap-[8px]"
                >
                  <View className="flex-row items-center gap-[6px]">
                    <View className="bg-[#2563EB] px-[6px] py-[2px] rounded-[5px]">
                      <Text className="text-[9px] font-black uppercase text-white">Gói</Text>
                    </View>
                    <Text className="text-[13px] font-extrabold text-[#0C4A6E]" style={{ flex: 1 }}>
                      {pkg.packageName || pkg.key}
                    </Text>
                    <View className="bg-white border border-[#BAE6FD] px-[7px] py-[2px] rounded-[6px]">
                      <Text className="text-[10px] font-black text-[#0284C7]">
                        {pkg.quantity} Gói
                      </Text>
                    </View>
                  </View>

                  <View className="gap-[3px]">
                    <Field label="Số lượng" value={`${pkg.quantity} Gói`} />
                    <Field label="Đơn giá" value={formatVNDFull(Math.round(pkg.sellingPrice))} />
                    <Field label="Giá vốn" value={formatVNDFull(pkg.cost)} />
                    <Field label="VAT (8%)" value={formatVNDFull(pkg.vat)} />
                    <Field label="Thành tiền" value={formatVNDFull(pkg.totalWithVat)} strong />
                  </View>

                  {canEditPrices && (
                    <View className="gap-[6px] pt-[8px] border-t border-t-[#BAE6FD]">
                      <View className="flex-row gap-[6px]">
                        <PriceChip
                          label="Giá đề xuất"
                          active={getMode(`pkg-${pkg.key}`) === 'recommended'}
                          onPress={() =>
                            selectMode(`pkg-${pkg.key}`, 'recommended', pkg.cost, (value) =>
                              updatePackagePrice(pkg, value),
                            )
                          }
                        />
                        <PriceChip
                          label="Giá tối thiểu"
                          active={getMode(`pkg-${pkg.key}`) === 'minimum'}
                          onPress={() =>
                            selectMode(`pkg-${pkg.key}`, 'minimum', pkg.cost, (value) =>
                              updatePackagePrice(pkg, value),
                            )
                          }
                        />
                        <PriceChip
                          label="Tùy chỉnh"
                          active={getMode(`pkg-${pkg.key}`) === 'custom'}
                          onPress={() =>
                            setPriceModes((prev) => ({ ...prev, [`pkg-${pkg.key}`]: 'custom' }))
                          }
                        />
                      </View>
                      <View className="flex-row items-center gap-[6px]">
                        <TextInput
                          value={formatNumberInput(String(Math.round(pkg.sellingPrice)))}
                          onChangeText={(text) =>
                            updatePackagePrice(pkg, parseNumberInput(text))
                          }
                          editable={getMode(`pkg-${pkg.key}`) === 'custom'}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                          className={`flex-1 min-h-[44px] rounded-[10px] border px-[10px] text-right text-[13px] font-bold ${
                            getMode(`pkg-${pkg.key}`) === 'custom'
                              ? 'border-[#1D4ED8] bg-white text-[#1D4ED8]'
                              : 'border-[#BAE6FD] bg-slate-100 text-slate-400'
                          }`}
                        />
                        <Text className="text-[11px] font-bold text-slate-500">VNĐ</Text>
                      </View>
                      <Text className="text-[10px] text-[#0284C7] leading-[14px]">
                        Sửa giá gói sẽ phân bổ lại cho các dịch vụ con theo tỉ lệ doanh thu (fallback
                        theo giá vốn).
                      </Text>
                    </View>
                  )}

                  <View className="gap-[8px] pt-[6px] border-t border-t-[#BAE6FD]">
                    <Text className="text-[10px] font-bold text-[#0284C7] uppercase tracking-[0.3px]">
                      Số lượng dưới đây là định mức cho 1 gói
                    </Text>
                    {pkg.services.map((svc) => (
                      <ServiceLineCard
                        key={`svc-${pkg.key}-${svc.key}`}
                        serviceName={svc.serviceName}
                        unit={svc.unit}
                        quantity={svc.quantity}
                        sellingPrice={svc.sellingPrice}
                        lineCost={svc.lineCost}
                        lineVat={svc.lineVat}
                        lineTotalWithVat={svc.lineTotalWithVat}
                        quantitySuffix="/ Gói"
                        editable={false}
                        priceMode="custom"
                        onSelectMode={() => undefined}
                        onChangePrice={() => undefined}
                        compact
                      />
                    ))}
                  </View>
                </View>
              ))}

              {/* Nhóm Dịch vụ lẻ */}
              {grouped.standalone.length > 0 && (
                <View className="gap-[8px]">
                  <Text className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5px]">
                    Dịch vụ lẻ
                  </Text>
                  {grouped.standalone.map((svc) => (
                    <ServiceLineCard
                      key={`standalone-${svc.key}`}
                      serviceName={svc.serviceName}
                      unit={svc.unit}
                      quantity={svc.quantity}
                      sellingPrice={svc.sellingPrice}
                      lineCost={svc.lineCost}
                      lineVat={svc.lineVat}
                      lineTotalWithVat={svc.lineTotalWithVat}
                      editable={canEditPrices}
                      priceMode={getMode(`std-${svc.key}`)}
                      onSelectMode={(mode) =>
                        selectMode(`std-${svc.key}`, mode, svc.lineCost / (svc.quantity || 1), (value) =>
                          updateLinePrice(svc.itemIndexes, value),
                        )
                      }
                      onChangePrice={(value) => updateLinePrice(svc.itemIndexes, value)}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer: tổng cộng + hành động */}
          <View className="border-t border-t-slate-100 bg-slate-50 px-[16px] pt-[12px] pb-[18px] gap-[10px]">
            <View className="flex-row items-center justify-between gap-[10px]">
              <Text className="text-[12px] font-bold text-slate-600">Tổng cộng (có VAT):</Text>
              <Text className="text-[15px] font-black text-[#B45309]" style={{ flexShrink: 1 }}>
                {formatVNDFull(totalWithVat)}
              </Text>
            </View>

            <View className="flex-row gap-[8px]">
              <TouchableOpacity
                onPress={onClose}
                disabled={isMutating}
                activeOpacity={0.8}
                className="flex-1 min-h-[48px] items-center justify-center rounded-[12px] bg-white border border-slate-200"
              >
                <Text className="text-[14px] font-bold text-slate-600">Đóng</Text>
              </TouchableOpacity>

              {canResubmit && (
                <TouchableOpacity
                  onPress={confirmResubmit}
                  disabled={isMutating}
                  activeOpacity={0.8}
                  className="flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[12px] bg-[#2563EB]"
                >
                  {isMutating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="refresh-cw" size={15} color="#FFFFFF" />
                      <Text className="text-[14px] font-bold text-white">Gửi lại</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {canReview && (
                <>
                  <TouchableOpacity
                    onPress={() => setIsRejectVisible(true)}
                    disabled={isMutating}
                    activeOpacity={0.8}
                    className="flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[12px] bg-white border border-red-200"
                  >
                    <Feather name="x-circle" size={15} color="#DC2626" />
                    <Text className="text-[14px] font-bold text-red-600">Không duyệt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmApprove}
                    disabled={isMutating}
                    activeOpacity={0.8}
                    className="flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[12px] bg-emerald-600"
                  >
                    {isMutating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={15} color="#FFFFFF" />
                        <Text className="text-[14px] font-bold text-white">Duyệt</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>

      {/* Bottom sheet nhập lý do không duyệt (lý do BẮT BUỘC) */}
      <AddendumRejectModal
        visible={isRejectVisible}
        isLoading={isMutating}
        reviewerLabel={canSaleReview ? 'Sale' : 'BOD'}
        onClose={() => setIsRejectVisible(false)}
        onSubmit={(note) => void runReject(note)}
      />
    </Modal>
  );
}
