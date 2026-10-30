import React, { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
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
  formatNumber,
  formatNumberInput,
  parseNumberInput,
  formatVNDFull,
} from '@/utils/formatters';
import { getServiceTheme } from '@/services/opportunityService';
import { ServiceJobAccordion } from '@/components/opportunities/ServiceJobAccordion';
import AddendumRejectModal from '@/components/contracts/AddendumRejectModal';
import { catalogService } from '@/services/catalogService';
import { queryKeys } from '@/services/queryKeys';
import {
  getMinimumSellingPrice,
  getRecommendedSellingPrice,
  getProfitMargin,
} from '@/utils/catalogPricing';

const STANDALONE = 'STANDALONE';

// ---------------------------------------------------------------------------
// Helpers tính toán tài chính & Định dạng dùng chung
// ---------------------------------------------------------------------------

export const calculateProfitMargin = (sellingPrice: number, costPrice: number, budget = 0) =>
  getProfitMargin(sellingPrice, Number(costPrice || 0) + Number(budget || 0));

export const getPricingValues = (costPrice: number, budget = 0) => {
  const totalCost = Number(costPrice || 0) + Number(budget || 0);
  return {
    minPrice: getMinimumSellingPrice(totalCost),
    recommendedPrice: getRecommendedSellingPrice(totalCost),
  };
};

const getMarginBadgeStyle = (margin: number) => {
  if (margin >= 40) {
    return {
      bg: '#ECFDF5',
      border: '#A7F3D0',
      text: '#047857',
    };
  }
  if (margin >= 20) {
    return {
      bg: '#FFF7ED',
      border: '#FDCB9E',
      text: '#D97010',
    };
  }
  return {
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#B91C1C',
  };
};

// ---------------------------------------------------------------------------
// Kiểu dữ liệu gom nhóm
// ---------------------------------------------------------------------------

export interface GroupedService {
  key: string;
  serviceName: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  lineCost: number;
  lineVat: number;
  lineTotalWithVat: number;
  itemIndexes: number[];
  norm?: number;
  jobs?: any[];
  budget?: number;
  rawCost?: number;
}

export interface GroupedPackage {
  key: string;
  packageName: string;
  quantity: number;
  sellingPrice: number;
  cost: number;
  rawCostPrice: number;
  budget: number;
  minPrice: number;
  recommendedPrice: number;
  vat: number;
  totalWithVat: number;
  services: GroupedService[];
  itemIndexes: number[];
}

const getServiceKey = (item: AddendumServiceLine, index: number): string =>
  String(item.serviceId || item.serviceName || item.name || `service-${index}`);

/**
 * Gom nhóm dòng dịch vụ của phụ lục thành "Gói" và "Dịch vụ lẻ"
 */
export const buildAddendumGroups = (items: AddendumServiceLine[]) => {
  const packages: Record<string, GroupedPackage> = {};
  const standaloneMap: Record<string, GroupedService> = {};

  (items || []).forEach((item, index) => {
    const quantity = Number(item.quantity || 1) || 1;
    const totals = computeAddendumLineTotals({ ...item, quantity });
    const unit = String(item.unit || '');
    const serviceName = String(item.serviceName || item.name || 'Dịch vụ');
    const cost = Number(item.cost || item.costPrice || 0);
    const budget = Number(item.budget || 0);
    const jobs = item.jobs || [];

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
          rawCost: 0,
          budget: 0,
          lineVat: 0,
          lineTotalWithVat: 0,
          itemIndexes: [],
          jobs,
        };
      }
      const group = standaloneMap[key];
      group.quantity += quantity;
      group.sellingPrice = Number(item.sellingPrice || 0);
      group.unit = group.unit || unit;
      group.lineCost += totals.lineCost;
      group.rawCost = (group.rawCost || 0) + cost * quantity;
      group.budget = (group.budget || 0) + budget * quantity;
      group.lineVat += totals.lineVat;
      group.lineTotalWithVat += totals.lineTotalWithVat;
      group.itemIndexes.push(index);
      if (!group.jobs || group.jobs.length === 0) {
        group.jobs = jobs;
      }
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
        rawCostPrice: 0,
        budget: 0,
        minPrice: 0,
        recommendedPrice: 0,
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
        rawCost: 0,
        budget: 0,
        lineVat: 0,
        lineTotalWithVat: 0,
        itemIndexes: [],
        norm: Number(item.norm || (item.packageQuantity ? quantity / item.packageQuantity : 1)) || 1,
        jobs,
      };
      pkg.services.push(child);
    }
    child.quantity += quantity;
    child.sellingPrice = Number(item.sellingPrice || 0);
    child.lineCost += totals.lineCost;
    child.rawCost = (child.rawCost || 0) + cost * quantity;
    child.budget = (child.budget || 0) + budget * quantity;
    child.lineVat += totals.lineVat;
    child.lineTotalWithVat += totals.lineTotalWithVat;
    child.itemIndexes.push(index);
    if (!child.jobs || child.jobs.length === 0) {
      child.jobs = jobs;
    }

    pkg.sellingPrice += totals.lineSellingPrice;
    pkg.cost += totals.lineCost;
    pkg.rawCostPrice += cost * quantity;
    pkg.budget += budget * quantity;
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
// Modal chi tiết & sửa giá phụ lục
// ---------------------------------------------------------------------------

export interface AddendumDetailModalProps {
  visible: boolean;
  addendum: ContractAddendum | null;
  contractId: string;
  role?: string;
  onClose: () => void;
  onDirty: () => void;
  hasConflict: boolean;
  onReload: () => void;
}

export default function AddendumDetailModal({
  visible,
  addendum,
  contractId,
  role,
  onClose,
  onDirty,
  hasConflict,
  onReload,
}: AddendumDetailModalProps) {
  const selectedItems: AddendumServiceLine[] = useMemo(() => {
    const raw = (addendum as any)?.selectedItems ?? addendum?.services ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [addendum]);
  const serviceIds = useMemo(
    () => [...new Set(selectedItems.map((item) => item.serviceId).filter((id): id is string => Boolean(id)))],
    [selectedItems],
  );
  const serviceQueries = useQueries({
    queries: serviceIds.map((id) => ({
      queryKey: queryKeys.services.detail(id),
      queryFn: async () => {
        const result = await catalogService.getService(id);
        if (result.error || !result.data) throw new Error(result.error || 'Không tìm thấy dịch vụ');
        return result.data;
      },
      enabled: visible,
    })),
  });
  const canEditBudget = (item: AddendumServiceLine | undefined) => {
    if (!item?.serviceId) return false;
    const index = serviceIds.indexOf(item.serviceId);
    const query = serviceQueries[index];
    return Boolean(query && !query.isFetching && !query.isError && query.data?.isBudget === true);
  };

  const [editableItems, setEditableItems] = useState<AddendumServiceLine[]>(selectedItems);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
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

  // Khởi tạo danh sách dòng có thể sửa mỗi khi mở modal
  const editSignature = visible ? `${addendum?.id ?? ''}` : '';
  const [syncedEditSignature, setSyncedEditSignature] = useState('');
  if (editSignature !== syncedEditSignature) {
    setSyncedEditSignature(editSignature);
    if (visible) {
      setEditableItems(
        selectedItems.map((item) => {
          const costPrice = Number(item.cost || item.costPrice || 0);
          const budget = Number(item.budget || 0);
          const pricing = getPricingValues(costPrice, budget);
          const quantity = Number(item.quantity || 1) || 1;
          const packageQuantity = Number(item.packageQuantity || 1) || 1;
          const norm = Number(item.norm || (item.packageName && item.packageName !== STANDALONE ? quantity / packageQuantity : 1)) || 1;
          const sellingPrice = Number(item.sellingPrice || 0);
          return {
            ...item,
            quantity,
            packageQuantity,
            norm,
            costPrice,
            budget,
            minPrice: item.minPrice || pricing.minPrice,
            recommendedPrice: item.recommendedPrice || pricing.recommendedPrice,
            customPrice: sellingPrice,
            selectedPrice: sellingPrice,
            sellingPrice,
            profitMargin: calculateProfitMargin(sellingPrice, costPrice, budget),
          };
        }),
      );
      setExpandedPackages({});
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

  const isRejected = status === 'SALE_REJECTED' || status === 'BOD_REJECTED';
  const isDraft = status === 'DRAFT' || !status;
  const isPendingSale = status === 'PENDING_SALE';

  const canSaleReview = canSaleReviewAddendum(role, status);
  const canBodReview = canBodReviewAddendum(role, status);
  const canReview = canSaleReview || canBodReview;

  // Cho phép sửa giá & ngân sách khi: Phụ lục bị từ chối, là Nháp, đang chờ Sale duyệt, hoặc RBAC cho phép
  const canEditPrices = isRejected || isDraft || isPendingSale || canEditAddendumPrices(role, status);

  // Cho phép gửi lại khi phụ lục bị từ chối hoặc DRAFT hoặc canResubmitAddendum
  const canResubmit = isRejected || isDraft || canResubmitAddendum(role, status);

  // Gom nhóm hiển thị Gói & Dịch vụ lẻ
  const displayGroups = useMemo(() => {
    const packages: Record<string, {
      key: string;
      name: string;
      quantity: number;
      rawCostPrice: number;
      costPrice: number;
      budget: number;
      minPrice: number;
      recommendedPrice: number;
      customPrice: number;
      selectedPrice: number;
      profitMargin: number;
      totalWithVat: number;
      items: any[];
    }> = {};
    const standalone: any[] = [];

    editableItems.forEach((item, index) => {
      const isPackage = Boolean(item.packageName) && item.packageName !== STANDALONE;
      const quantity = Number(item.quantity || 1) || 1;
      const costPrice = Number(item.cost || item.costPrice || 0);
      const budget = Number(item.budget || 0);
      const totalCost = costPrice + budget;
      const pricing = getPricingValues(costPrice, budget);
      const minPrice = item.minPrice || pricing.minPrice;
      const recommendedPrice = item.recommendedPrice || pricing.recommendedPrice;
      const selectedPrice = Number(item.selectedPrice !== undefined ? item.selectedPrice : item.sellingPrice || 0);
      const customPrice = Number(item.customPrice !== undefined ? item.customPrice : selectedPrice);
      const norm = Number(item.norm || (item.packageQuantity ? quantity / item.packageQuantity : 1)) || 1;
      const profitMargin = calculateProfitMargin(selectedPrice, costPrice, budget);

      const enrichedItem = {
        ...item,
        originalIndex: index,
        quantity,
        costPrice,
        budget,
        totalCost,
        minPrice,
        recommendedPrice,
        selectedPrice,
        customPrice,
        norm,
        profitMargin,
      };

      if (!isPackage) {
        standalone.push(enrichedItem);
      } else {
        const key = String(item.packageKey || item.servicePackageId || item.packageName);
        if (!packages[key]) {
          packages[key] = {
            key,
            name: item.packageName || 'Gói dịch vụ',
            quantity: Number(item.packageQuantity || 1),
            rawCostPrice: 0,
            costPrice: 0,
            budget: 0,
            minPrice: 0,
            recommendedPrice: 0,
            customPrice: 0,
            selectedPrice: 0,
            profitMargin: 0,
            totalWithVat: 0,
            items: [],
          };
        }

        packages[key].rawCostPrice += costPrice * norm;
        packages[key].costPrice += totalCost * norm;
        packages[key].budget += budget * norm;
        packages[key].minPrice += minPrice * norm;
        packages[key].recommendedPrice += recommendedPrice * norm;
        packages[key].customPrice += customPrice * norm;
        packages[key].selectedPrice += selectedPrice * norm;
        packages[key].items.push(enrichedItem);
      }
    });

    return {
      packages: Object.values(packages).map((pkg) => {
        const profitMargin = calculateProfitMargin(pkg.selectedPrice, pkg.costPrice);
        const revenue = pkg.selectedPrice * pkg.quantity;
        const totalWithVat = revenue * 1.08;
        return {
          ...pkg,
          profitMargin,
          totalWithVat,
        };
      }),
      standalone,
    };
  }, [editableItems]);

  // Tổng kết tài chính
  const totals = useMemo(() => {
    const res = editableItems.reduce(
      (acc, item) => {
        const selectedPrice = Number(item.selectedPrice !== undefined ? item.selectedPrice : item.sellingPrice || 0);
        const costPrice = Number(item.cost || item.costPrice || 0);
        const budget = Number(item.budget || 0);
        const quantity = Number(item.quantity || 1);
        const revenue = selectedPrice * quantity;
        const cost = (costPrice + budget) * quantity;
        const vat = revenue * 0.08;
        return {
          revenue: acc.revenue + revenue,
          cost: acc.cost + cost,
          vat: acc.vat + vat,
          totalWithVat: acc.totalWithVat + revenue + vat,
        };
      },
      { revenue: 0, cost: 0, vat: 0, totalWithVat: 0 }
    );
    const margin = res.revenue > 0 ? ((res.revenue - res.cost) / res.revenue) * 100 : 0;
    return { ...res, margin };
  }, [editableItems]);

  // Sửa giá bán tùy chỉnh dịch vụ lẻ hoặc con
  const handleCustomPriceChange = (index: number, valStr: string, packageLine = false) => {
    onDirty();
    const enteredPrice = parseNumberInput(valStr);
    setEditableItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const norm = packageLine
            ? Number(item.norm || (item.packageQuantity ? (item.quantity || 1) / item.packageQuantity : 1)) || 1
            : 1;
          const numValue = enteredPrice / norm;
          const costPrice = Number(item.cost || item.costPrice || 0);
          const budget = Number(item.budget || 0);
          return {
            ...item,
            customPrice: numValue,
            selectedPrice: numValue,
            sellingPrice: numValue,
            profitMargin: calculateProfitMargin(numValue, costPrice, budget),
          };
        }
        return item;
      })
    );
  };

  // Sửa ngân sách dịch vụ lẻ hoặc con
  const handleBudgetChange = (index: number, valStr: string) => {
    if (!editableItems[index] || !canEditPrices || isMutating || hasConflict || !canEditBudget(editableItems[index])) return;
    onDirty();
    const newBudget = parseNumberInput(valStr);
    setEditableItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const costPrice = Number(item.cost || item.costPrice || 0);
          const { minPrice, recommendedPrice } = getPricingValues(costPrice, newBudget);
          const currentPrice = Number(item.selectedPrice !== undefined ? item.selectedPrice : item.sellingPrice || 0);
          return {
            ...item,
            budget: newBudget,
            minPrice,
            recommendedPrice,
            selectedPrice: currentPrice,
            sellingPrice: currentPrice,
            profitMargin: calculateProfitMargin(currentPrice, costPrice, newBudget),
          };
        }
        return item;
      })
    );
  };

  // Sửa giá tổng gói dịch vụ (Phân bổ tỷ lệ)
  const handlePackageCustomPriceChange = (packageKey: string, valStr: string) => {
    onDirty();
    const totalPrice = parseNumberInput(valStr);
    setEditableItems((prev) => {
      const indexes = prev.reduce<number[]>((result, item, index) => {
        const key = String(item.packageKey || item.servicePackageId || item.packageName);
        return key === String(packageKey) ? [...result, index] : result;
      }, []);
      if (indexes.length === 0) return prev;

      const weights = indexes.map((index) => {
        const item = prev[index];
        const costPrice = Number(item.cost || item.costPrice || 0);
        const budget = Number(item.budget || 0);
        const norm = Number(item.norm || (item.packageQuantity ? (item.quantity || 1) / item.packageQuantity : 1)) || 1;
        const recommended = getPricingValues(costPrice, budget).recommendedPrice;
        return Number(item.recommendedPrice || recommended || costPrice || 1) * norm;
      });
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let allocated = 0;

      return prev.map((item, index) => {
        const position = indexes.indexOf(index);
        if (position < 0) return item;
        const norm = Number(item.norm || (item.packageQuantity ? (item.quantity || 1) / item.packageQuantity : 1)) || 1;
        const linePrice = position === indexes.length - 1
          ? Math.max(0, totalPrice - allocated)
          : Math.round(totalPrice * (totalWeight > 0 ? weights[position] / totalWeight : 1 / indexes.length));
        allocated += linePrice;
        const newSellingPrice = linePrice / norm;
        const costPrice = Number(item.cost || item.costPrice || 0);
        const budget = Number(item.budget || 0);
        return {
          ...item,
          customPrice: newSellingPrice,
          selectedPrice: newSellingPrice,
          sellingPrice: newSellingPrice,
          profitMargin: calculateProfitMargin(newSellingPrice, costPrice, budget),
        };
      });
    });
  };

  // Hành động duyệt / từ chối / gửi lại
  const closeAfterAction = (message: string) => {
    setIsRejectVisible(false);
    onClose();
    Alert.alert('Thành công', message);
  };

  const handleError = (err: any) => {
    Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi xử lý phụ lục');
  };

  const validateBudgetChanges = () => {
    const invalid = editableItems.some((item, index) =>
      !canEditBudget(item) && !new Decimal(item.budget ?? 0).eq(selectedItems[index]?.budget ?? 0),
    );
    if (invalid) {
      Alert.alert('Không thể cập nhật ngân sách', 'Quyền nhập ngân sách của dịch vụ đã thay đổi hoặc chưa được xác định. Vui lòng kiểm tra lại trước khi gửi.');
    }
    return !invalid;
  };

  const runSaleApprove = async () => {
    if (!addendum || !validateBudgetChanges()) return;
    try {
      const payloadItems = editableItems.map((item, index) => ({
        ...selectedItems[index],
        ...item,
        sellingPrice: Math.round(Number(item.selectedPrice !== undefined ? item.selectedPrice : item.sellingPrice || 0)),
        budget: Number(item.budget || 0),
      }));
      await saleApproveMutation.mutateAsync({
        id: addendum.id,
        contractId,
        selectedItems: payloadItems,
      });
      closeAfterAction('Đã duyệt phụ lục');
    } catch (err) {
      handleError(err);
    }
  };

  const runBodApprove = async () => {
    if (!addendum) return;
    try {
      await bodApproveMutation.mutateAsync({ id: addendum.id, contractId, note: '' });
      closeAfterAction('Đã duyệt và sinh công việc');
    } catch (err) {
      handleError(err);
    }
  };

  const runResubmit = async () => {
    if (!addendum || !validateBudgetChanges()) return;
    try {
      const payloadItems = editableItems.map((item, index) => ({
        ...selectedItems[index],
        ...item,
        sellingPrice: Math.round(Number(item.selectedPrice !== undefined ? item.selectedPrice : item.sellingPrice || 0)),
        budget: Number(item.budget || 0),
      }));
      await resubmitMutation.mutateAsync({
        id: addendum.id,
        contractId,
        selectedItems: payloadItems,
      });
      closeAfterAction('Đã gửi lại phụ lục thành công');
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
    Alert.alert('Xác nhận gửi lại', 'Gửi lại phụ lục với giá bán và ngân sách đã cập nhật?', [
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

  const hasServices = displayGroups.packages.length > 0 || displayGroups.standalone.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' }}>
        {/* Nền mờ bấm ra ngoài để đóng */}
        <TouchableOpacity
          activeOpacity={1}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />

        {/* Khung nội dung Bottom Sheet */}
        <View
          style={{ maxHeight: '90%', width: '100%' }}
          className="bg-white rounded-t-[24px] flex-col"
        >
          {/* Header */}
          <View className="px-[20px] pt-[10px] pb-[12px] border-b border-b-slate-100">
            <View className="items-center mb-[10px]">
              <View className="w-[44px] h-[4px] rounded-full bg-slate-300" />
            </View>

            <View className="flex-row items-start justify-between gap-[10px]">
              <View className="flex-row items-start gap-[10px]" style={{ flex: 1 }}>
                <View
                  style={{ backgroundColor: '#FFF7ED', borderColor: '#FDCB9E' }}
                  className="w-[40px] h-[40px] rounded-[11px] items-center justify-center border"
                >
                  <Feather name="file-text" size={19} color="#D97010" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-[16px] font-extrabold text-slate-900" numberOfLines={2}>
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

          {/* Body ScrollView — hỗ trợ cuộn mượt và nested scroll */}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Ghi chú */}
            {hasConflict && (
              <View className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <Text className="text-sm text-amber-900">Phụ lục đã thay đổi. Nội dung đang sửa được giữ lại; hãy xem bản mới nhất trước khi tiếp tục.</Text>
                <TouchableOpacity onPress={onReload} className="mt-2"><Text className="font-bold text-amber-900 underline">Xem bản mới nhất</Text></TouchableOpacity>
              </View>
            )}
            {visible && (serviceQueries.some((query) => query.isError) || selectedItems.some((item) => !item.serviceId)) && (
              <View className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Text className="text-sm text-amber-900">Không xác định được quyền nhập ngân sách của một số dịch vụ. Ngân sách đã lưu được giữ nguyên.</Text>
                {serviceQueries.some((query) => query.isError) && (
                  <TouchableOpacity onPress={() => serviceQueries.forEach((query) => { if (query.isError) void query.refetch(); })} className="mt-2">
                    <Text className="font-bold text-amber-900 underline">Thử tải lại dịch vụ</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
                  Bạn có thể chỉnh sửa giá bán và ngân sách các dịch vụ bên dưới, sau đó bấm nút &quot;Gửi lại&quot; ở cuối để gửi duyệt.
                </Text>
              </View>
            )}

            {/* Chi tiết dịch vụ */}
            <View className="gap-[10px]">
              <Text className="text-[14px] font-extrabold text-slate-900">Chi tiết dịch vụ</Text>

              {!hasServices && (
                <View className="items-center justify-center gap-[6px] p-[24px] border border-dashed border-slate-200 rounded-[12px]">
                  <Feather name="layers" size={22} color="#CBD5E1" />
                  <Text className="text-[12px] italic text-slate-400">
                    Chưa có dịch vụ nào trong phụ lục.
                  </Text>
                </View>
              )}

              {/* Nhóm Gói dịch vụ */}
              {displayGroups.packages.map((pkg) => {
                const isExpanded = !!expandedPackages[pkg.key];
                const pkgMarginStyle = getMarginBadgeStyle(pkg.profitMargin);

                return (
                  <View
                    key={`pkg-${pkg.key}`}
                    className="rounded-[14px] border border-[#FDCB9E]/80 bg-white p-3.5 shadow-xs gap-2"
                  >
                    {/* Header Gói */}
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="gap-1">
                          <View className="self-start flex-row items-center gap-1 rounded-md bg-[#FFF7ED] border border-[#FDCB9E] px-2 py-0.5">
                            <Feather name="package" size={12} color="#D97010" />
                            <Text className="text-[10px] font-extrabold text-[#D97010]">GÓI DỊCH VỤ</Text>
                          </View>
                          <Text className="text-[15px] font-bold text-slate-900">{pkg.name}</Text>
                        </View>
                      </View>
                      <View className="bg-white border border-[#FDCB9E] px-2.5 py-1 rounded-lg">
                        <Text className="text-[11px] font-extrabold text-[#D97010]">
                          {pkg.quantity} Gói
                        </Text>
                      </View>
                    </View>

                    {/* Giá bán gói (VNĐ) — cho phép sửa trực tiếp */}
                    <View className="flex-row items-center justify-between border-t border-slate-100 py-1.5">
                      <Text className="text-[13px] font-semibold text-slate-600">Giá bán gói (VNĐ):</Text>
                      {canEditPrices ? (
                        <TextInput
                          className="min-w-[140px] rounded-lg border border-orange-500 bg-orange-50 px-2.5 py-1 text-right text-sm font-bold text-slate-900"
                          keyboardType="numeric"
                          value={formatNumberInput(pkg.selectedPrice)}
                          onChangeText={(val) => handlePackageCustomPriceChange(pkg.key, val)}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                      ) : (
                        <Text className="text-sm font-bold text-slate-900">
                          {formatNumber(pkg.selectedPrice)} ₫
                        </Text>
                      )}
                    </View>

                    {/* Khối 4 dòng tài chính của gói */}
                    <View className="gap-1.5 border-t border-slate-100 pt-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-slate-500">
                          Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(pkg.rawCostPrice)} ₫</Text>
                        </Text>
                        <Text className="text-xs text-slate-500">
                          Tổng ngân sách: <Text className="font-semibold text-slate-700">{formatNumber(pkg.budget)} ₫</Text>
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-slate-500">
                          Tối thiểu: <Text className="font-semibold text-slate-700">{formatNumber(pkg.minPrice)} ₫</Text>
                        </Text>
                        <Text className="text-xs text-slate-500">
                          Đề xuất: <Text className="font-semibold text-slate-700">{formatNumber(pkg.recommendedPrice)} ₫</Text>
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-slate-600">
                          Đang áp dụng: {formatNumber(pkg.selectedPrice)} ₫
                        </Text>
                        <View
                          style={{ backgroundColor: pkgMarginStyle.bg, borderColor: pkgMarginStyle.border }}
                          className="rounded-md px-2 py-0.5 border"
                        >
                          <Text
                            style={{ color: pkgMarginStyle.text }}
                            className="text-[11px] font-bold"
                          >
                            Tỉ suất lợi nhuận: {pkg.profitMargin.toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[13px] font-bold text-slate-700">Thành tiền (có VAT 8%):</Text>
                        <Text className="text-sm font-extrabold text-blue-600">
                          {formatNumber(Math.round(pkg.totalWithVat))} ₫
                        </Text>
                      </View>
                    </View>

                    {/* Nút Accordion Toggle dịch vụ con */}
                    <TouchableOpacity
                      className="mt-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#FFF7ED] border border-[#FDCB9E] py-2.5"
                      onPress={() =>
                        setExpandedPackages((prev) => ({
                          ...prev,
                          [pkg.key]: !prev[pkg.key],
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Text className="text-xs font-bold text-[#D97010]">
                        {isExpanded ? 'Thu gọn dịch vụ con' : `Xem ${pkg.items.length} dịch vụ con`}
                      </Text>
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#D97010"
                      />
                    </TouchableOpacity>

                    {/* Danh sách dịch vụ con khi bung mở */}
                    {isExpanded && (
                      <View className="mt-2 gap-2 rounded-xl bg-[#FFF7ED]/50 border border-[#FDCB9E]/50 p-2.5">
                        {pkg.items.map((sub: any, sIdx: number) => {
                          const theme = getServiceTheme(sub.serviceName);
                          const subMarginStyle = getMarginBadgeStyle(sub.profitMargin);

                          return (
                            <View
                              key={sub.serviceId || sIdx}
                              className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs gap-2"
                            >
                              <View className="flex-row items-center gap-2">
                                <View
                                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                                  className="w-5 h-5 rounded-md border items-center justify-center"
                                >
                                  <Feather name="box" size={10} color={theme.color} />
                                </View>
                                <Text className="text-xs font-bold text-slate-800 flex-1">
                                  {sub.serviceName}
                                </Text>
                              </View>

                              <Text className="text-[11px] text-slate-500">
                                Định mức: {formatNumber(sub.norm)} {sub.unit || 'lần'} / gói | Số lượng tổng: {formatNumber(sub.quantity)}
                              </Text>

                              {/* Giá bán trong 1 gói */}
                              <View className="flex-row items-center justify-between border-t border-slate-100 pt-1.5">
                                <Text className="text-xs font-semibold text-slate-600">Giá bán trong 1 gói:</Text>
                                {canEditPrices ? (
                                  <TextInput
                                    className="w-[140px] rounded-md border border-orange-500 bg-orange-50 px-2 py-1 text-right text-[13px] font-bold text-slate-900"
                                    keyboardType="numeric"
                                    value={formatNumberInput(sub.selectedPrice * sub.norm)}
                                    onChangeText={(val) => handleCustomPriceChange(sub.originalIndex, val, true)}
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                  />
                                ) : (
                                  <Text className="text-xs font-bold text-slate-900">
                                    {formatNumber(sub.selectedPrice * sub.norm)} ₫
                                  </Text>
                                )}
                              </View>

                              {/* Ngân sách của dịch vụ con */}
                              <View className="flex-row items-center justify-between border-t border-slate-100 pt-1.5">
                                <Text className="text-xs font-semibold text-slate-600">Ngân sách (VNĐ):</Text>
                                {canEditPrices && canEditBudget(sub) && !hasConflict && !isMutating ? (
                                  <TextInput
                                    className="w-[140px] rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-[13px] font-semibold text-slate-900"
                                    keyboardType="numeric"
                                    accessibilityLabel={`Ngân sách ${sub.serviceName}`}
                                    value={formatNumberInput(sub.budget)}
                                    onChangeText={(val) => handleBudgetChange(sub.originalIndex, val)}
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                  />
                                ) : (
                                  <View className="flex-row items-center gap-1">
                                    <Feather name="lock" size={11} color="#64748B" />
                                    <Text className="text-xs font-semibold text-slate-600">{formatNumber(sub.budget)} ₫</Text>
                                  </View>
                                )}
                              </View>

                              {/* Mốc tài chính con */}
                              <View className="gap-1 border-t border-slate-100 pt-1.5">
                                <View className="flex-row items-center justify-between gap-2">
                                  <Text className="text-[11px] text-slate-500">
                                    Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(sub.costPrice * sub.norm)} ₫</Text>
                                  </Text>
                                  <View
                                    style={{ backgroundColor: subMarginStyle.bg, borderColor: subMarginStyle.border }}
                                    className="rounded-md px-1.5 py-0.5 border"
                                  >
                                    <Text
                                      style={{ color: subMarginStyle.text }}
                                      className="text-[10px] font-bold"
                                    >
                                      Lợi nhuận: {sub.profitMargin.toFixed(0)}%
                                    </Text>
                                  </View>
                                </View>

                                <View className="flex-row items-center justify-between">
                                  <Text className="text-[11px] text-slate-500">
                                    Tối thiểu: {formatNumber(sub.minPrice * sub.norm)} ₫
                                  </Text>
                                  <Text className="text-[11px] text-slate-500">
                                    Đề xuất: {formatNumber(sub.recommendedPrice * sub.norm)} ₫
                                  </Text>
                                </View>
                              </View>

                              {/* Hạng mục công việc trong dịch vụ con của gói */}
                              <ServiceJobAccordion jobs={sub.jobs} mode="contract_view" />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Nhóm Dịch vụ lẻ */}
              {displayGroups.standalone.length > 0 && (
                <View className="gap-2">
                  <Text className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5px]">
                    Dịch vụ lẻ
                  </Text>
                  {displayGroups.standalone.map((item) => {
                    const theme = getServiceTheme(item.serviceName);
                    const itemMarginStyle = getMarginBadgeStyle(item.profitMargin);

                    return (
                      <View
                        key={`standalone-${item.originalIndex}`}
                        className="rounded-[14px] border border-[#FDCB9E]/80 bg-white p-3.5 shadow-xs gap-2"
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-row items-center gap-2 flex-1 mr-2">
                            <View
                              style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                              className="w-7 h-7 rounded-lg border items-center justify-center"
                            >
                              <Feather name="layers" size={13} color={theme.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text className="text-[14px] font-bold text-slate-900">{item.serviceName}</Text>
                              <Text className="mt-0.5 text-xs text-slate-500">Đơn vị: {item.unit || 'gói'}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Số lượng */}
                        <View className="flex-row items-center justify-between border-t border-slate-100 py-1.5">
                          <Text className="text-[13px] font-semibold text-slate-600">Số lượng:</Text>
                          <Text className="text-sm font-bold text-slate-900">
                            {formatNumber(item.quantity)} {item.unit || ''}
                          </Text>
                        </View>

                        {/* Đơn giá bán (VNĐ) — cho phép sửa */}
                        <View className="flex-row items-center justify-between border-t border-slate-100 py-1.5">
                          <Text className="text-[13px] font-semibold text-slate-600">Giá bán (VNĐ):</Text>
                          {canEditPrices ? (
                            <TextInput
                              className="min-w-[130px] rounded-lg border border-orange-400 bg-orange-50 px-2.5 py-1 text-right text-sm font-bold text-slate-900"
                              keyboardType="numeric"
                              value={formatNumberInput(item.selectedPrice)}
                              onChangeText={(val) => handleCustomPriceChange(item.originalIndex, val)}
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          ) : (
                            <Text className="text-sm font-bold text-slate-900">
                              {formatNumber(item.selectedPrice)} ₫
                            </Text>
                          )}
                        </View>

                        {/* Ngân sách (VNĐ) — cho phép sửa */}
                        <View className="flex-row items-center justify-between border-t border-slate-100 py-1.5">
                          <Text className="text-[13px] font-semibold text-slate-600">Ngân sách (VNĐ):</Text>
                          {canEditPrices && canEditBudget(item) && !hasConflict && !isMutating ? (
                            <TextInput
                              className="min-w-[130px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right text-sm font-bold text-slate-900"
                              keyboardType="numeric"
                              accessibilityLabel={`Ngân sách ${item.serviceName}`}
                              value={formatNumberInput(item.budget)}
                              onChangeText={(val) => handleBudgetChange(item.originalIndex, val)}
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                          ) : (
                            <View className="flex-row items-center gap-1">
                              <Feather name="lock" size={12} color="#64748B" />
                              <Text className="text-sm font-semibold text-slate-700">{formatNumber(item.budget)} ₫</Text>
                            </View>
                          )}
                        </View>

                        {/* 4 dòng tài chính */}
                        <View className="gap-1.5 border-t border-slate-100 pt-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-slate-500">
                              Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(item.costPrice)} ₫</Text>
                            </Text>
                            <Text className="text-xs text-slate-500">
                              Đang áp dụng: <Text className="font-semibold text-slate-700">{formatNumber(item.selectedPrice)} ₫</Text>
                            </Text>
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-slate-500">
                              Tối thiểu: <Text className="font-semibold text-slate-700">{formatNumber(item.minPrice)} ₫</Text>
                            </Text>
                            <Text className="text-xs text-slate-500">
                              Đề xuất: <Text className="font-semibold text-slate-700">{formatNumber(item.recommendedPrice)} ₫</Text>
                            </Text>
                          </View>
                          <View className="flex-row items-center justify-between">
                            <View
                              style={{ backgroundColor: itemMarginStyle.bg, borderColor: itemMarginStyle.border }}
                              className="rounded-md px-2 py-0.5 border"
                            >
                              <Text
                                style={{ color: itemMarginStyle.text }}
                                className="text-[11px] font-bold"
                              >
                                Tỉ suất lợi nhuận: {item.profitMargin.toFixed(0)}%
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                              <Text className="text-[13px] font-bold text-slate-700">Thành tiền:</Text>
                              <Text className="text-sm font-extrabold text-blue-600">
                                {formatNumber(Math.round(item.selectedPrice * item.quantity * 1.08))} ₫
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Hạng mục công việc */}
                        <ServiceJobAccordion jobs={item.jobs} mode="contract_view" />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer: tổng cộng + hành động */}
          <View className="border-t border-t-slate-100 bg-slate-50 px-[16px] pt-[12px] pb-[18px] gap-[10px]">
            <View className="flex-row items-center justify-between gap-[10px]">
              <View>
                <Text className="text-[12px] font-bold text-slate-600">Tổng cộng (có VAT):</Text>
                <Text className="text-[10px] text-slate-400">
                  Biên lợi nhuận: <Text className="font-bold text-[#D97010]">{totals.margin.toFixed(0)}%</Text>
                </Text>
              </View>
              <Text className="text-[17px] font-black text-[#B45309]" style={{ flexShrink: 1 }}>
                {formatVNDFull(Math.round(totals.totalWithVat))}
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

              {/* Nút Gửi lại khi phụ lục bị từ chối / nháp / PM sửa giá & ngân sách */}
              {canResubmit && (
                <TouchableOpacity
                  onPress={confirmResubmit}
                  disabled={isMutating || hasConflict}
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

              {/* Nút Duyệt / Không duyệt cho Sale và BOD */}
              {canReview && (
                <>
                  <TouchableOpacity
                    onPress={() => { onDirty(); setIsRejectVisible(true); }}
                    disabled={isMutating || hasConflict}
                    activeOpacity={0.8}
                    className="flex-1 min-h-[48px] flex-row items-center justify-center gap-[6px] rounded-[12px] bg-white border border-red-200"
                  >
                    <Feather name="x-circle" size={15} color="#DC2626" />
                    <Text className="text-[14px] font-bold text-red-600">Không duyệt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmApprove}
                    disabled={isMutating || hasConflict}
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
        </View>
      </View>

      {/* Bottom sheet nhập lý do không duyệt */}
      <AddendumRejectModal
        visible={isRejectVisible}
        isLoading={isMutating || hasConflict}
        reviewerLabel={canSaleReview ? 'Sale' : 'BOD'}
        onClose={() => setIsRejectVisible(false)}
        onSubmit={(note) => void runReject(note)}
      />
    </Modal>
  );
}
