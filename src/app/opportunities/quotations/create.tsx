import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useOpportunityDetailQuery,
  useAvailableServicesQuery,
  useServicePackagesQuery,
} from '@/hooks/queries/useOpportunities';
import {
  useQuotationDetailQuery,
  useOpportunityServicesQuery,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
} from '@/hooks/queries/useQuotations';
import {
  QuotationDetailResponse,
} from '@/services/quotationService';
import { OpportunityItem } from '@/services/opportunityService';
import {
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '@/utils/formatters';

interface QuotationFormItem {
  serviceId: string;
  serviceName: string;
  quantity: number;
  costPrice: number;
  minPrice: number;
  recommendedPrice: number;
  customPrice: number;
  selectedPrice: number;
  profitMargin: number;
  packageName: string;
  packageQuantity?: number;
  norm?: number;
  servicePackageId?: string;
  unit?: string;
}

export default function QuotationCreateEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ opportunityId: string; quotationId?: string }>();
  const quotationId = params.quotationId;
  const isEditMode = !!quotationId;

  // TanStack Queries
  const { data: quoteData, isLoading: isLoadingQuote } = useQuotationDetailQuery(quotationId || '');
  const opportunityId =
    params.opportunityId ||
    quoteData?.opportunityId ||
    (quoteData?.opportunity as any)?.id ||
    '';

  const { data: oppData, isLoading: isLoadingOpp } = useOpportunityDetailQuery(opportunityId);
  const { data: allServicesRes, isLoading: isLoadingServices } = useAvailableServicesQuery();
  const { data: pkgTemplatesRes, isLoading: isLoadingPackages } = useServicePackagesQuery();
  const { data: servicesRes } = useOpportunityServicesQuery(opportunityId);

  // TanStack Mutations
  const createQuotationMutation = useCreateQuotationMutation();
  const updateQuotationMutation = useUpdateQuotationMutation();
  const isSubmitting = createQuotationMutation.isPending || updateQuotationMutation.isPending;

  const [hasInitialized, setHasInitialized] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationDetailResponse | null>(null);

  const [items, setItems] = useState<QuotationFormItem[]>([]);
  const [priceType, setPriceType] = useState<'minimum' | 'recommended' | 'custom'>('recommended');
  const [notes, setNotes] = useState('');

  // Expand/collapse state for packages
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  // Add Service modal
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');

  // Add Package modal
  const [showAddPackageModal, setShowAddPackageModal] = useState(false);
  const [packageTemplates, setPackageTemplates] = useState<any[]>([]);
  const [packageSearch, setPackageSearch] = useState('');

  const opportunity: OpportunityItem | null = oppData || null;

  const roundToTenThousands = (value: number) => {
    return Math.ceil(value / 10000) * 10000;
  };

  const calculateProfitMargin = (sellingPrice: number, costPrice: number) => {
    if (!sellingPrice || sellingPrice === 0) return 0;
    return ((sellingPrice - costPrice) / sellingPrice) * 100;
  };

  // Sync state from query responses
  useEffect(() => {
    if (hasInitialized || !oppData || !allServicesRes || !pkgTemplatesRes) return;
    if (isEditMode && quotationId && !quoteData) return;
    if (!isEditMode && !servicesRes) return;

    const srvList = Array.isArray(allServicesRes) ? allServicesRes : (allServicesRes as any)?.data || [];
    setAvailableServices(srvList);

    const pkgList = Array.isArray(pkgTemplatesRes) ? pkgTemplatesRes : (pkgTemplatesRes as any)?.data || [];
    setPackageTemplates(pkgList);

    if (isEditMode && quoteData) {
      setEditQuotation(quoteData);
      setNotes(quoteData.note || '');

      const loadedItems: QuotationFormItem[] = (quoteData.details || []).map((detail: any) => {
        const costPrice = parseFloat(String(detail.costAtSale || detail.service?.costPrice || 0));
        const sellingPrice = parseFloat(String(detail.sellingPrice || 0));
        const minPrice = roundToTenThousands(costPrice / 0.8);
        const recommendedPrice = roundToTenThousands(costPrice / 0.6);

        return {
          serviceId: detail.service?.id || detail.serviceId,
          serviceName: detail.service?.name || detail.name || 'Dịch vụ',
          quantity: detail.quantity || 1,
          costPrice,
          minPrice,
          recommendedPrice,
          customPrice: sellingPrice,
          selectedPrice: sellingPrice,
          profitMargin: calculateProfitMargin(sellingPrice, costPrice),
          packageName: detail.packageName || 'STANDALONE',
          packageQuantity: detail.packageQuantity || 1,
          norm: detail.packageQuantity ? (detail.quantity || 1) / detail.packageQuantity : 1,
          servicePackageId: detail.servicePackageId,
          unit: detail.service?.unit || detail.unit || '',
        };
      });

      setItems(loadedItems);
      const expandedMap: Record<string, boolean> = {};
      loadedItems.forEach((item) => {
        if (item.packageName && item.packageName !== 'STANDALONE') {
          expandedMap[item.packageName] = true;
        }
      });
      setExpandedPackages(expandedMap);
      setPriceType('custom');
    } else if (!isEditMode && servicesRes) {
      const servicesData = Array.isArray(servicesRes) ? servicesRes : (servicesRes as any)?.data || [];
      const standaloneItems: QuotationFormItem[] = (servicesData || [])
        .filter((service: any) => !service.opportunityPackageId)
        .map((service: any) => {
          const costPrice = parseFloat(service.service?.costPrice || service.costPrice) || 0;
          const minPrice = roundToTenThousands(costPrice / 0.8);
          const recommendedPrice = roundToTenThousands(costPrice / 0.6);

          return {
            serviceId: service.service?.id || service.serviceId || service.id,
            serviceName: service.service?.name || service.serviceName || service.name || 'Dịch vụ',
            quantity: service.quantity || 1,
            costPrice,
            minPrice,
            recommendedPrice,
            customPrice: recommendedPrice,
            selectedPrice: recommendedPrice,
            profitMargin: calculateProfitMargin(recommendedPrice, costPrice),
            packageName: 'STANDALONE',
            unit: service.service?.unit || service.unit || '',
          };
        });

      const packageItems: QuotationFormItem[] = (oppData?.packages || []).flatMap((pkg: any) =>
        (pkg.services || []).map((ps: any) => {
          const costPrice = parseFloat(ps.service?.costPrice || ps.sellingPrice) || 0;
          const minPrice = roundToTenThousands(costPrice / 0.8);
          const recommendedPrice = roundToTenThousands(costPrice / 0.6);

          return {
            serviceId: ps.serviceId || ps.id,
            serviceName: ps.service?.name || ps.name || 'Dịch vụ trong gói',
            quantity: ps.quantity || 1,
            costPrice,
            minPrice,
            recommendedPrice,
            customPrice: recommendedPrice,
            selectedPrice: recommendedPrice,
            profitMargin: calculateProfitMargin(recommendedPrice, costPrice),
            packageName: pkg.name || 'Gói dịch vụ',
            packageQuantity: pkg.quantity || 1,
            norm: pkg.quantity ? (ps.quantity || 1) / pkg.quantity : 1,
            servicePackageId: pkg.servicePackageId,
            unit: ps.service?.unit || ps.unit || '',
          };
        })
      );

      setItems([...standaloneItems, ...packageItems]);
      setPriceType('recommended');
    }

    setHasInitialized(true);
  }, [hasInitialized, oppData, allServicesRes, pkgTemplatesRes, quoteData, servicesRes, isEditMode, quotationId]);

  const isLoading = isLoadingOpp || isLoadingServices || isLoadingPackages || (isEditMode && isLoadingQuote) || !hasInitialized;

  // Handle switching price type
  const handlePriceTypeChange = (type: 'minimum' | 'recommended' | 'custom') => {
    setPriceType(type);
    if (type === 'custom') {
      const expandedMap: Record<string, boolean> = {};
      items.forEach((item) => {
        if (item.packageName && item.packageName !== 'STANDALONE') {
          expandedMap[item.packageName] = true;
        }
      });
      setExpandedPackages((prev) => ({ ...prev, ...expandedMap }));
    }
    setItems((prev) =>
      prev.map((item) => {
        let selectedPrice = item.selectedPrice;
        if (type === 'minimum') {
          selectedPrice = item.minPrice;
        } else if (type === 'recommended') {
          selectedPrice = item.recommendedPrice;
        } else {
          selectedPrice = item.customPrice;
        }
        return {
          ...item,
          selectedPrice,
          profitMargin: calculateProfitMargin(selectedPrice, item.costPrice),
        };
      })
    );
  };

  // Handle custom price change for a standalone item
  const handleStandaloneCustomPriceChange = (index: number, valStr: string) => {
    const numValue = parseNumberInput(valStr);
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            customPrice: numValue,
            selectedPrice: priceType === 'custom' ? numValue : item.selectedPrice,
            profitMargin:
              priceType === 'custom'
                ? calculateProfitMargin(numValue, item.costPrice)
                : item.profitMargin,
          };
        }
        return item;
      })
    );
  };

  // Handle custom price change for a PACKAGE (proportional redistribution)
  const handlePackageCustomPriceChange = (packageName: string, valStr: string) => {
    const newTotalCustomPrice = parseNumberInput(valStr);
    const packageItems = items.filter((item) => item.packageName === packageName);
    const currentTotalCustomPrice = packageItems.reduce(
      (sum, item) => sum + item.customPrice * (item.norm || 1),
      0
    );

    if (currentTotalCustomPrice === 0) {
      const share = newTotalCustomPrice / (packageItems.length || 1);
      setItems((prev) =>
        prev.map((item) => {
          if (item.packageName === packageName) {
            const unitShare = share / (item.norm || 1);
            return {
              ...item,
              customPrice: unitShare,
              selectedPrice: priceType === 'custom' ? unitShare : item.selectedPrice,
              profitMargin:
                priceType === 'custom'
                  ? calculateProfitMargin(unitShare, item.costPrice)
                  : item.profitMargin,
            };
          }
          return item;
        })
      );
      return;
    }

    const ratio = newTotalCustomPrice / currentTotalCustomPrice;
    setItems((prev) =>
      prev.map((item) => {
        if (item.packageName === packageName) {
          const newCustomPrice = item.customPrice * ratio;
          return {
            ...item,
            customPrice: newCustomPrice,
            selectedPrice: priceType === 'custom' ? newCustomPrice : item.selectedPrice,
            profitMargin:
              priceType === 'custom'
                ? calculateProfitMargin(newCustomPrice, item.costPrice)
                : item.profitMargin,
          };
        }
        return item;
      })
    );
  };

  // Handle quantity change for package
  const handlePackageQuantityChange = (packageName: string, delta: number) => {
    setItems((prev) => {
      const currentPkg = prev.find((item) => item.packageName === packageName);
      const currentQty = currentPkg?.packageQuantity || 1;
      const newQty = Math.max(1, currentQty + delta);

      return prev.map((item) => {
        if (item.packageName === packageName) {
          return {
            ...item,
            packageQuantity: newQty,
            quantity: (item.norm || 1) * newQty,
          };
        }
        return item;
      });
    });
  };

  // Handle quantity change for standalone item
  const handleStandaloneQuantityChange = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const newQty = Math.max(1, (item.quantity || 1) + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Delete standalone item
  const handleDeleteStandaloneItem = (index: number) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa dịch vụ này khỏi báo giá?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  // Delete entire package
  const handleDeletePackage = (packageName: string) => {
    Alert.alert('Xác nhận xóa', `Bạn có chắc chắn muốn xóa toàn bộ gói "${packageName}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((item) => item.packageName !== packageName));
        },
      },
    ]);
  };

  // Add a standalone service from available list
  const handleSelectServiceToAdd = (service: any) => {
    const costPrice = parseFloat(service.costPrice) || 0;
    const minPrice = roundToTenThousands(costPrice / 0.8);
    const recommendedPrice = roundToTenThousands(costPrice / 0.6);
    const initialPrice = priceType === 'minimum' ? minPrice : recommendedPrice;

    const newItem: QuotationFormItem = {
      serviceId: service.id,
      serviceName: service.name,
      quantity: 1,
      costPrice,
      minPrice,
      recommendedPrice,
      customPrice: recommendedPrice,
      selectedPrice: initialPrice,
      profitMargin: calculateProfitMargin(initialPrice, costPrice),
      packageName: 'STANDALONE',
      unit: service.unit || '',
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddServiceModal(false);
  };

  // Add a package template
  const handleSelectPackageToAdd = (template: any) => {
    if (items.some((item) => item.packageName === template.name)) {
      Alert.alert('Thông báo', `Gói "${template.name}" đã có trong báo giá.`);
      return;
    }

    const packageItems: QuotationFormItem[] = (template.items || []).map((ps: any) => {
      const costPrice = parseFloat(ps.service?.costPrice || ps.sellingPrice) || 0;
      const minPrice = roundToTenThousands(costPrice / 0.8);
      const recommendedPrice = roundToTenThousands(costPrice / 0.6);
      const initialPrice = priceType === 'minimum' ? minPrice : recommendedPrice;

      return {
        serviceId: ps.service?.id || ps.serviceId,
        serviceName: ps.service?.name || ps.name || 'Dịch vụ trong gói',
        quantity: ps.defaultQuantity || 1,
        costPrice,
        minPrice,
        recommendedPrice,
        customPrice: recommendedPrice,
        selectedPrice: initialPrice,
        profitMargin: calculateProfitMargin(initialPrice, costPrice),
        packageName: template.name,
        packageQuantity: 1,
        norm: ps.defaultQuantity || 1,
        servicePackageId: template.id,
        unit: ps.service?.unit || ps.unit || '',
      };
    });

    setItems((prev) => [...prev, ...packageItems]);
    setShowAddPackageModal(false);
  };

  // Group items for display
  const displayGroups = useMemo(() => {
    const packages: Record<string, any> = {};
    const standalone: Array<QuotationFormItem & { originalIndex: number }> = [];

    items.forEach((item, index) => {
      const key = item.packageName || 'STANDALONE';
      if (key === 'STANDALONE') {
        standalone.push({ ...item, originalIndex: index });
      } else {
        if (!packages[key]) {
          packages[key] = {
            name: key,
            quantity: item.packageQuantity || 1,
            costPrice: 0,
            minPrice: 0,
            recommendedPrice: 0,
            customPrice: 0,
            selectedPrice: 0,
            items: [],
          };
        }

        const norm = item.norm || 1;
        packages[key].costPrice += (item.costPrice || 0) * norm;
        packages[key].minPrice += (item.minPrice || 0) * norm;
        packages[key].recommendedPrice += (item.recommendedPrice || 0) * norm;
        packages[key].customPrice += (item.customPrice || 0) * norm;
        packages[key].selectedPrice += (item.selectedPrice || 0) * norm;
        packages[key].items.push({ ...item, originalIndex: index });
      }
    });

    return {
      packages: Object.values(packages).map((pkg) => ({
        ...pkg,
        profitMargin: calculateProfitMargin(pkg.selectedPrice, pkg.costPrice),
      })),
      standalone,
    };
  }, [items]);

  // Financial totals calculation
  const totals = useMemo(() => {
    const res = items.reduce(
      (acc, item) => {
        const revenue = (item.selectedPrice || 0) * (item.quantity || 0);
        const cost = (item.costPrice || 0) * (item.quantity || 0);
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
  }, [items]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Lỗi', 'Báo giá phải có ít nhất một dịch vụ');
      return;
    }

    try {
      const submitData: any = {
        opportunityId,
        note: notes,
        totalAmount: totals.totalWithVat,
        details: items.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          sellingPrice: item.selectedPrice,
          costAtSale: item.costPrice,
          name: item.serviceName,
          packageQuantity: item.packageQuantity || 1,
          packageName: item.packageName !== 'STANDALONE' ? item.packageName : undefined,
          servicePackageId: item.servicePackageId,
          isPackageService: item.packageName !== 'STANDALONE',
        })),
      };

      if (isEditMode && quotationId) {
        if (editQuotation?.status === 'REJECTED') {
          submitData.status = 'DRAFT';
          submitData.description = '';
        }
        await updateQuotationMutation.mutateAsync({ id: quotationId, payload: submitData });
      } else {
        await createQuotationMutation.mutateAsync(submitData);
      }

      Alert.alert(
        'Thành công',
        isEditMode ? 'Cập nhật báo giá thành công' : 'Tạo báo giá thành công',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      console.log('Error submitting quotation:', err);
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi lưu báo giá');
    }
  };

  const filteredAvailableServices = useMemo(() => {
    const currentStandaloneIds = new Set(
      items
        .filter((i) => i.packageName === 'STANDALONE')
        .map((i) => String(i.serviceId))
    );
    return availableServices.filter(
      (s) =>
        !currentStandaloneIds.has(String(s.id)) &&
        (serviceSearch.trim() === '' ||
          s.name?.toLowerCase().includes(serviceSearch.toLowerCase()))
    );
  }, [availableServices, items, serviceSearch]);

  const filteredPackageTemplates = useMemo(() => {
    const currentPkgNames = new Set(items.map((i) => i.packageName));
    return packageTemplates.filter(
      (p) =>
        !currentPkgNames.has(p.name) &&
        (packageSearch.trim() === '' ||
          p.name?.toLowerCase().includes(packageSearch.toLowerCase()))
    );
  }, [packageTemplates, items, packageSearch]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity className="rounded-lg bg-slate-100 p-1.5" onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-slate-900">
            {isEditMode ? 'Chỉnh sửa báo giá' : 'Tạo mới báo giá'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-sm text-slate-500">Đang tải dữ liệu báo giá...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      testID="quotationCreateScreen"
      className="flex-1 bg-slate-50"
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className="rounded-lg bg-slate-100 p-1.5"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>

          <View className="mx-3 flex-1">
            <Text className="text-base font-bold text-slate-900">
              {isEditMode ? 'Chỉnh sửa báo giá' : 'Tạo mới báo giá'}
            </Text>
            <Text className="mt-px text-xs text-slate-500" numberOfLines={1}>
              {opportunity?.name || 'Cơ hội kinh doanh'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Segmented Pricing Mode Selector */}
          <View className="mb-4">
            <Text className="mb-2 text-[13px] font-bold text-slate-700">Lựa chọn mức giá áp dụng:</Text>
            <View className="flex-row gap-1 rounded-xl bg-slate-200 p-1">
              <Pressable
                testID="quotationPriceMinimumTab"
                accessibilityRole="tab"
                accessibilityState={{ selected: priceType === 'minimum' }}
                className="flex-1 items-center justify-center rounded-lg py-2"
                style={
                  priceType === 'minimum'
                    ? {
                        backgroundColor: '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 2,
                      }
                    : undefined
                }
                onPress={() => handlePriceTypeChange('minimum')}
              >
                <Text
                  className={`text-[13px] font-semibold ${priceType === 'minimum' ? 'font-bold text-emerald-600' : 'text-slate-500'}`}
                >
                  Giá tối thiểu
                </Text>
                <Text className="mt-0.5 text-[10px] text-slate-400">Cost / 0.8</Text>
              </Pressable>

              <Pressable
                testID="quotationPriceRecommendedTab"
                accessibilityRole="tab"
                accessibilityState={{ selected: priceType === 'recommended' }}
                className="flex-1 items-center justify-center rounded-lg py-2"
                style={
                  priceType === 'recommended'
                    ? {
                        backgroundColor: '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 2,
                      }
                    : undefined
                }
                onPress={() => handlePriceTypeChange('recommended')}
              >
                <Text
                  className={`text-[13px] font-semibold ${priceType === 'recommended' ? 'font-bold text-emerald-600' : 'text-slate-500'}`}
                >
                  Giá đề xuất
                </Text>
                <Text className="mt-0.5 text-[10px] text-slate-400">Cost / 0.6</Text>
              </Pressable>

              <Pressable
                testID="quotationPriceCustomTab"
                accessibilityRole="tab"
                accessibilityState={{ selected: priceType === 'custom' }}
                className="flex-1 items-center justify-center rounded-lg py-2"
                style={
                  priceType === 'custom'
                    ? {
                        backgroundColor: '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 2,
                      }
                    : undefined
                }
                onPress={() => handlePriceTypeChange('custom')}
              >
                <Text
                  className={`text-[13px] font-semibold ${priceType === 'custom' ? 'font-bold text-emerald-600' : 'text-slate-500'}`}
                >
                  Tùy chỉnh
                </Text>
                <Text className="mt-0.5 text-[10px] text-slate-400">Nhập tay</Text>
              </Pressable>
            </View>
          </View>

          {/* Package Services Section */}
          {displayGroups.packages.map((pkg) => {
            const isExpanded = !!expandedPackages[pkg.name];
            return (
              <View key={pkg.name} className="mb-3 rounded-[14px] border border-slate-200 bg-white p-3.5">
                <View className="mb-2.5 flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="gap-1">
                      <View className="self-start flex-row items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5">
                        <Feather name="package" size={12} color="#2563EB" />
                        <Text className="text-[10px] font-extrabold text-blue-600">GÓI DỊCH VỤ</Text>
                      </View>
                      <Text className="text-[15px] font-bold text-slate-900">{pkg.name}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeletePackage(pkg.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="trash-2" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                {/* Package Quantity Stepper */}
                <View className="flex-row items-center justify-between border-t border-slate-100 py-2">
                  <Text className="text-[13px] font-semibold text-slate-600">Số lượng gói:</Text>
                  <View className="flex-row items-center rounded-lg border border-slate-300 bg-slate-50">
                    <TouchableOpacity
                      className="px-3 py-1.5"
                      onPress={() => handlePackageQuantityChange(pkg.name, -1)}
                      activeOpacity={0.7}
                    >
                      <Feather name="minus" size={16} color="#334155" />
                    </TouchableOpacity>
                    <Text className="min-w-7 text-center text-sm font-bold text-slate-900">{formatNumber(pkg.quantity)}</Text>
                    <TouchableOpacity
                      className="px-3 py-1.5"
                      onPress={() => handlePackageQuantityChange(pkg.name, 1)}
                      activeOpacity={0.7}
                    >
                      <Feather name="plus" size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Package Unit Price */}
                <View className="flex-row items-center justify-between border-t border-slate-100 py-2">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[13px] font-semibold text-slate-600">Đơn giá gói (VNĐ):</Text>
                    {priceType === 'custom' && (
                      <View className="flex-row items-center gap-[3px] rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5">
                        <Feather name="lock" size={11} color="#64748B" />
                        <Text className="text-[10px] font-semibold text-slate-500">Khóa</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text className="text-sm font-bold text-slate-900">
                      {formatNumber(pkg.selectedPrice)} ₫
                    </Text>
                    {priceType === 'custom' && (
                      <Text className="mt-0.5 text-[11px] font-medium text-emerald-600">Tự cộng từ dịch vụ con</Text>
                    )}
                  </View>
                </View>

                {/* Total and Margin row - 2 hàng tránh tràn */}
                <View className="mt-1 border-t border-slate-100 pt-2 gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-slate-500">
                      Giá vốn gói: <Text className="font-semibold text-slate-700">{formatNumber(pkg.costPrice)} ₫</Text>
                    </Text>
                    <Text
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        pkg.profitMargin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      Margin: {pkg.profitMargin.toFixed(0)}%
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-bold text-slate-700">Thành tiền:</Text>
                    <Text className="text-sm font-extrabold text-blue-600">
                      {formatNumber(pkg.selectedPrice * pkg.quantity)} ₫
                    </Text>
                  </View>
                </View>

                {/* Toggle Accordion Sub-items */}
                <TouchableOpacity
                  className="mt-1.5 flex-row items-center justify-center gap-1 rounded-lg bg-slate-50 py-2"
                  onPress={() =>
                    setExpandedPackages((prev) => ({
                      ...prev,
                      [pkg.name]: !prev[pkg.name],
                    }))
                  }
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-semibold text-emerald-600">
                    {isExpanded ? 'Thu gọn dịch vụ con' : `Xem ${pkg.items.length} dịch vụ con`}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#059669"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View className="mt-2 gap-1.5 rounded-lg bg-slate-50 p-2">
                    {pkg.items.map((sub: any, sIdx: number) => (
                      <View key={sub.serviceId || sIdx} className="rounded-md border border-slate-200 bg-white p-2">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="text-xs font-bold text-slate-800">{sub.serviceName}</Text>
                          <Text
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              sub.profitMargin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            Margin: {sub.profitMargin.toFixed(0)}%
                          </Text>
                        </View>
                        <Text className="mt-0.5 text-[11px] text-slate-500">
                          Định mức: {formatNumber(sub.norm)} {sub.unit || 'lần'} / gói | Số lượng tổng: {formatNumber(sub.quantity)}
                        </Text>
                        {priceType === 'custom' ? (
                          <View className="mt-2 border-t border-slate-100 pt-2 gap-1.5">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-xs text-slate-500">
                                Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(sub.costPrice)} ₫</Text>
                              </Text>
                            </View>
                            <View className="flex-row items-center justify-between">
                              <Text className="text-xs font-semibold text-slate-600">Đơn giá con (VNĐ):</Text>
                              <TextInput
                                className="w-[140px] rounded-md border border-emerald-600 bg-slate-50 px-2 py-1 text-right text-[13px] font-bold text-slate-900"
                                keyboardType="numeric"
                                value={formatNumberInput(sub.customPrice)}
                                onChangeText={(val) =>
                                  handleStandaloneCustomPriceChange(sub.originalIndex, val)
                                }
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                          </View>
                        ) : (
                          <View className="mt-1.5 flex-row items-center justify-between border-t border-slate-100 pt-1.5">
                            <Text className="text-xs text-slate-500">
                              Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(sub.costPrice)} ₫</Text>
                            </Text>
                            <Text className="text-xs font-bold text-slate-900">
                              Đơn giá con: {formatNumber(sub.selectedPrice)} ₫
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {/* Standalone Services Section */}
          {displayGroups.standalone.map((item) => (
            <View key={item.originalIndex} className="mb-3 rounded-[14px] border border-slate-200 bg-white p-3.5">
              <View className="mb-2.5 flex-row items-start justify-between">
                <View style={{ flex: 1 }}>
                  <Text className="text-[15px] font-bold text-slate-900">{item.serviceName}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">Đơn vị: {item.unit || 'gói'}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteStandaloneItem(item.originalIndex)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="trash-2" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>

              {/* Quantity Stepper */}
              <View className="flex-row items-center justify-between border-t border-slate-100 py-2">
                <Text className="text-[13px] font-semibold text-slate-600">Số lượng:</Text>
                <View className="flex-row items-center rounded-lg border border-slate-300 bg-slate-50">
                  <TouchableOpacity
                    className="px-3 py-1.5"
                    onPress={() => handleStandaloneQuantityChange(item.originalIndex, -1)}
                    activeOpacity={0.7}
                  >
                    <Feather name="minus" size={16} color="#334155" />
                  </TouchableOpacity>
                  <Text className="min-w-7 text-center text-sm font-bold text-slate-900">{formatNumber(item.quantity)}</Text>
                  <TouchableOpacity
                    className="px-3 py-1.5"
                    onPress={() => handleStandaloneQuantityChange(item.originalIndex, 1)}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={16} color="#334155" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Price input */}
              <View className="flex-row items-center justify-between border-t border-slate-100 py-2">
                <Text className="text-[13px] font-semibold text-slate-600">Đơn giá (VNĐ):</Text>
                {priceType === 'custom' ? (
                  <TextInput
                    className="min-w-[130px] rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1.5 text-right text-sm font-bold text-slate-900"
                    keyboardType="numeric"
                    value={formatNumberInput(item.customPrice)}
                    onChangeText={(val) =>
                      handleStandaloneCustomPriceChange(item.originalIndex, val)
                    }
                  />
                ) : (
                  <Text className="text-sm font-bold text-slate-900">
                    {formatNumber(item.selectedPrice)} ₫
                  </Text>
                )}
              </View>

              {/* Standalone Financial info - 2 hàng tránh tràn */}
              <View className="mt-1 border-t border-slate-100 pt-2 gap-1.5">
                {/* Hàng 1: Giá vốn & Margin */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    Giá vốn: <Text className="font-semibold text-slate-700">{formatNumber(item.costPrice)} ₫</Text>
                  </Text>
                  <Text
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      item.profitMargin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Margin: {item.profitMargin.toFixed(0)}%
                  </Text>
                </View>

                {/* Hàng 2: Thành tiền */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] font-bold text-slate-700">Thành tiền:</Text>
                  <Text className="text-sm font-extrabold text-blue-600">
                    {formatNumber(item.selectedPrice * item.quantity)} ₫
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Action Buttons to Add Service / Package */}
          <View className="mb-3.5 flex-row gap-2.5">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 py-3"
              onPress={() => setShowAddServiceModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={16} color="#059669" />
              <Text className="text-[13px] font-bold text-emerald-600">Thêm dịch vụ lẻ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-blue-200 bg-blue-50 py-3"
              onPress={() => setShowAddPackageModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="package" size={16} color="#2563EB" />
              <Text className="text-[13px] font-bold text-blue-600">Thêm gói dịch vụ</Text>
            </TouchableOpacity>
          </View>

          {/* Notes Section */}
          <View className="mb-3 rounded-[14px] border border-slate-200 bg-white p-3.5">
            <Text className="mb-2 text-sm font-bold text-slate-800">Ghi chú báo giá:</Text>
            <TextInput
              className="min-h-[70px] rounded-[10px] border border-slate-300 bg-slate-50 p-2.5 text-[13px] text-slate-900"
              placeholder="Nhập ghi chú cho bản báo giá này (điều kiện thanh toán, bảo hành...)..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <View className="h-[120px]" />
        </ScrollView>

        {/* Sticky Bottom Financial Summary Bar */}
        <View className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 pb-4 pt-2.5 shadow-lg">
          <View className="mb-2 flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] text-slate-500">
                Tổng trước thuế: <Text className="font-bold">{formatNumber(totals.revenue)} ₫</Text>
              </Text>
              <Text className="text-[11px] text-slate-500">
                Thuế VAT (8%): <Text className="font-bold">{formatNumber(totals.vat)} ₫</Text>
              </Text>
            </View>

            <View className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-[3px]">
              <Text className="text-xs font-extrabold text-emerald-800">
                Margin: {totals.margin.toFixed(0)}%
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold text-slate-500">Tổng thanh toán:</Text>
              <Text className="text-lg font-extrabold text-emerald-600">
                {formatNumber(totals.totalWithVat)} ₫
              </Text>
            </View>

            <TouchableOpacity
              className={`flex-row items-center gap-1.5 rounded-[10px] bg-emerald-600 px-[18px] py-[11px] ${
                isSubmitting ? 'opacity-60' : ''
              }`}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {isEditMode ? 'Cập nhật báo giá' : 'Lưu báo giá'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal: Add Standalone Service */}
      <Modal
        visible={showAddServiceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddServiceModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-[20px] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-slate-900">Chọn dịch vụ lẻ thêm vào</Text>
              <TouchableOpacity
                onPress={() => setShowAddServiceModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View className="mb-3 flex-row items-center gap-2 rounded-[10px] bg-slate-100 px-3 py-2">
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                className="flex-1 p-0 text-sm text-slate-900"
                placeholder="Tìm kiếm dịch vụ..."
                placeholderTextColor="#94A3B8"
                value={serviceSearch}
                onChangeText={setServiceSearch}
              />
            </View>

            <FlatList
              data={filteredAvailableServices}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between border-b border-slate-100 py-3"
                  onPress={() => handleSelectServiceToAdd(item)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">{item.name}</Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      Đơn vị: {item.unit || 'gói'} | Giá vốn:{' '}
                      {formatNumber(item.costPrice || 0)} ₫
                    </Text>
                  </View>
                  <Feather name="plus" size={18} color="#059669" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <Text className="text-[13px] text-slate-400">Không có dịch vụ phù hợp</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Add Service Package Template */}
      <Modal
        visible={showAddPackageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddPackageModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-[20px] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-slate-900">Chọn gói mẫu thêm vào</Text>
              <TouchableOpacity
                onPress={() => setShowAddPackageModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View className="mb-3 flex-row items-center gap-2 rounded-[10px] bg-slate-100 px-3 py-2">
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                className="flex-1 p-0 text-sm text-slate-900"
                placeholder="Tìm kiếm gói dịch vụ..."
                placeholderTextColor="#94A3B8"
                value={packageSearch}
                onChangeText={setPackageSearch}
              />
            </View>

            <FlatList
              data={filteredPackageTemplates}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between border-b border-slate-100 py-3"
                  onPress={() => handleSelectPackageToAdd(item)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">{item.name}</Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      Gồm {(item.items || []).length} dịch vụ con
                    </Text>
                  </View>
                  <Feather name="plus" size={18} color="#2563EB" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <Text className="text-[13px] text-slate-400">Không có gói dịch vụ phù hợp</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
