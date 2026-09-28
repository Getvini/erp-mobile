import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useMonthlyWorkTemplateQuery,
  useCreateMonthlyWorkAddendumMutation,
} from '@/hooks/queries/useProjects';
import { useAvailableServicesQuery } from '@/hooks/queries/useOpportunities';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import { formatNumber } from '@/utils/formatters';
import { BrandColors } from '@/constants/colors';

const STANDALONE = 'STANDALONE';

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthKey = (monthKey: string) => {
  if (!monthKey) return '';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  return `${parts[1]}/${parts[0]}`;
};

const getItemTaskCount = (item: any) =>
  (item.jobs || []).reduce((sum: number, job: any) => sum + Number(job.quantity || 1), 0);

interface CreateMonthlyWorkModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: () => void;
}

export default function CreateMonthlyWorkModal({
  visible,
  onClose,
  projectId,
  onSuccess,
}: CreateMonthlyWorkModalProps) {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<any[]>([]);

  const [showAddService, setShowAddService] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const [showAddPackage, setShowAddPackage] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const { data: template, isLoading: isFetchingTemplate } = useMonthlyWorkTemplateQuery(
    projectId,
    monthKey,
    visible
  );
  const { data: servicesResponse } = useAvailableServicesQuery();
  const { data: packagesResponse } = useServicePackagesQuery();

  const allServices = useMemo<any[]>(() => {
    if (Array.isArray(servicesResponse)) return servicesResponse;
    return Array.isArray((servicesResponse as any)?.data)
      ? (servicesResponse as any).data
      : [];
  }, [servicesResponse]);

  const packageTemplates = useMemo<any[]>(() => {
    if (Array.isArray(packagesResponse)) return packagesResponse;
    return Array.isArray((packagesResponse as any)?.data)
      ? (packagesResponse as any).data
      : [];
  }, [packagesResponse]);

  const createAddendumMutation = useCreateMonthlyWorkAddendumMutation();

  useEffect(() => {
    if (!visible) return;
    setMonthKey(getCurrentMonthKey());
    setDescription('');
    setShowAddService(false);
    setShowAddPackage(false);
    setSelectedServiceId('');
    setSelectedPackageId('');
    setExpandedPackages({});
    setExpandedServices({});
  }, [visible]);

  useEffect(() => {
    if (!visible || !template) return;

    const templatePackages = Array.isArray(template.packages) ? template.packages : [];
    const templateStandalone = Array.isArray(template.standalone) ? template.standalone : [];

    const loadedItems = [
      ...templatePackages.flatMap((group: any) =>
        (Array.isArray(group.items) ? group.items : []).map((item: any) => ({
          key: `${group.packageKey || group.packageName}-${item.serviceId}`,
          contractServiceId: item.contractServiceId,
          contractServiceIds: item.contractServiceIds || (item.contractServiceId ? [item.contractServiceId] : []),
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          packageKey: group.packageKey || group.packageName,
          packageName: group.packageName,
          packageQuantity: Number(group.packageQuantity || item.packageQuantity || 1),
          quantity: Number(item.quantity || 1),
          isPackageService: true,
          sellingPrice: Number(item.sellingPrice || 0),
          cost: Number(item.cost || 0),
          jobs: item.jobs || [],
          description: item.description || item.service?.description,
          unit: item.unit || '',
        }))
      ),
      ...templateStandalone.map((item: any) => ({
        key: item.contractServiceId,
        contractServiceId: item.contractServiceId,
        contractServiceIds: item.contractServiceIds || (item.contractServiceId ? [item.contractServiceId] : []),
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        packageName: STANDALONE,
        quantity: Number(item.quantity || 1),
        isPackageService: false,
        sellingPrice: Number(item.sellingPrice || 0),
        cost: Number(item.cost || 0),
        jobs: item.jobs || [],
        description: item.description || item.service?.description,
        unit: item.unit || '',
      })),
    ];

    setName(template.defaultName || '');
    setItems(loadedItems);
  }, [template, visible]);

  const aggregatedItems = useMemo(() => {
    const packagesMap: Record<string, any> = {};
    const standalone: any[] = [];

    items.forEach((item, index) => {
      const groupKey = item.packageKey || item.packageName || STANDALONE;
      const enrichedItem = {
        ...item,
        originalIndex: index,
        taskCount: getItemTaskCount(item),
        profit: Number(item.sellingPrice || 0) - Number(item.cost || 0),
      };

      if (groupKey === STANDALONE) {
        standalone.push(enrichedItem);
        return;
      }

      if (!packagesMap[groupKey]) {
        packagesMap[groupKey] = {
          name: groupKey,
          packageName: item.packageName,
          quantity: Number(item.packageQuantity || 1),
          sellingPrice: 0,
          cost: 0,
          taskCount: 0,
          items: [],
        };
      }

      packagesMap[groupKey].sellingPrice += Number(item.sellingPrice || 0);
      packagesMap[groupKey].cost += Number(item.cost || 0);
      packagesMap[groupKey].taskCount += getItemTaskCount(item);
      packagesMap[groupKey].items.push(enrichedItem);
    });

    return {
      packages: Object.values(packagesMap),
      standalone,
    };
  }, [items]);

  const totals = useMemo(() => {
    const revenue = items.reduce((sum, item) => sum + Number(item.sellingPrice || 0), 0);
    const cost = items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const taskCount = items.reduce((sum, item) => sum + getItemTaskCount(item), 0);
    return {
      revenue,
      cost,
      profit: revenue - cost,
      taskCount,
    };
  }, [items]);

  const availableServices = useMemo(() => {
    return allServices.filter(
      (service: any) =>
        !items.some(
          (item) => item.packageName === STANDALONE && String(item.serviceId) === String(service.id)
        )
    );
  }, [allServices, items]);

  const availablePackages = useMemo(() => {
    return packageTemplates.filter(
      (tmpl: any) => !items.some((item) => item.packageName === tmpl.name)
    );
  }, [packageTemplates, items]);

  const togglePackage = (packageKey: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [packageKey]: !prev[packageKey],
    }));
  };

  const toggleService = (serviceKey: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceKey]: !prev[serviceKey],
    }));
  };

  const handleRemovePackage = (packageName: string) => {
    setItems((prev) => prev.filter((item) => (item.packageKey || item.packageName) !== packageName));
  };

  const handleRemoveService = (originalIndex: number) => {
    setItems((prev) => prev.filter((_, i) => i !== originalIndex));
  };

  const handleAddService = () => {
    if (!selectedServiceId) return;
    const service = allServices.find((item: any) => String(item.id) === String(selectedServiceId));
    if (!service) return;

    setItems((prev) => [
      ...prev,
      {
        key: `new-service-${service.id}-${Date.now()}`,
        serviceId: service.id,
        serviceName: service.name,
        packageName: STANDALONE,
        quantity: 1,
        isPackageService: false,
        sellingPrice: Number(service.costPrice || 0),
        cost: Number(service.costPrice || 0),
        jobs: (service.serviceJobs || []).map((serviceJob: any) => ({
          jobId: serviceJob.job?.id || serviceJob.jobId,
          jobName: serviceJob.job?.name || 'Công việc',
          quantity: Number(serviceJob.quantity || 1),
          isOutput: serviceJob.isOutput,
        })),
        description: service.description,
        unit: service.unit || '',
      },
    ]);
    setSelectedServiceId('');
    setShowAddService(false);
  };

  const handleAddPackage = () => {
    if (!selectedPackageId) return;
    const templatePackage = packageTemplates.find(
      (item: any) => String(item.id) === String(selectedPackageId)
    );
    if (!templatePackage) return;

    if (items.some((item) => item.packageName === templatePackage.name)) {
      Alert.alert('Thông báo', `Gói "${templatePackage.name}" đã có trong phụ lục`);
      return;
    }

    const newPackageKey = `new-package-${templatePackage.id}-${Date.now()}`;
    const packageItems = (templatePackage.items || []).map((packageItem: any) => {
      const service = packageItem.service || {};
      return {
        key: `new-package-${templatePackage.id}-${service.id || packageItem.serviceId}-${Date.now()}`,
        serviceId: service.id || packageItem.serviceId,
        serviceName: service.name || 'Dịch vụ trong gói',
        packageKey: newPackageKey,
        packageName: templatePackage.name,
        packageQuantity: 1,
        quantity: Number(packageItem.defaultQuantity || 1),
        isPackageService: true,
        sellingPrice: Number(service.costPrice || 0) * Number(packageItem.defaultQuantity || 1),
        cost: Number(service.costPrice || 0) * Number(packageItem.defaultQuantity || 1),
        jobs: (service.serviceJobs || []).map((serviceJob: any) => ({
          jobId: serviceJob.job?.id || serviceJob.jobId,
          jobName: serviceJob.job?.name || 'Công việc',
          quantity: Number(serviceJob.quantity || 1) * Number(packageItem.defaultQuantity || 1),
          isOutput: serviceJob.isOutput,
        })),
        description: service.description,
        unit: service.unit || '',
      };
    });

    setItems((prev) => [...prev, ...packageItems]);
    setSelectedPackageId('');
    setShowAddPackage(false);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một dịch vụ');
      return;
    }

    try {
      const payloadItems = items.flatMap((item) => {
        if (item.contractServiceIds?.length > 0) {
          return item.contractServiceIds.map((contractServiceId: string) => ({ contractServiceId }));
        }

        return [
          {
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            packageName: item.packageName !== STANDALONE ? item.packageName : undefined,
            isPackageService: item.packageName !== STANDALONE,
            sellingPrice: item.sellingPrice,
            cost: item.cost,
          },
        ];
      });

      await createAddendumMutation.mutateAsync({
        projectId,
        payload: {
          monthKey,
          name,
          description,
          items: payloadItems,
        },
      });

      Alert.alert('Thành công', 'Đã tạo phụ lục công việc tháng mới thành công');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi tạo phụ lục công việc');
    }
  };

  const changeMonthOffset = (offset: number) => {
    const [yearStr, monthStr] = monthKey.split('-');
    let year = parseInt(yearStr, 10) || new Date().getFullYear();
    let month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

    month += offset;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }

    setMonthKey(`${year}-${String(month).padStart(2, '0')}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center"
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#0F172A" />
            </TouchableOpacity>

            <View className="flex-1 items-center px-2">
              <Text className="text-base font-bold text-slate-900">Tạo công việc tháng mới</Text>
              <Text className="text-xs text-purple-700 font-semibold">{formatMonthKey(monthKey)}</Text>
            </View>

            <View className="w-9" />
          </View>

          {/* Form Scroll Container */}
          <ScrollView
            className="flex-1 px-4 py-3"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Month & Title Header Box */}
            <View className="bg-purple-50 rounded-2xl p-4 border border-purple-100 gap-3 mb-4">
              {/* Month Selector */}
              <View className="gap-1.5">
                <Text className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  Chọn tháng thực hiện
                </Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => changeMonthOffset(-1)}
                    className="p-2.5 rounded-xl bg-white border border-purple-200 justify-center items-center"
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-left" size={18} color="#6B21A8" />
                  </TouchableOpacity>

                  <View className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 justify-center items-center">
                    <Text className="text-sm font-bold text-purple-900">
                      Tháng {formatMonthKey(monthKey)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => changeMonthOffset(1)}
                    className="p-2.5 rounded-xl bg-white border border-purple-200 justify-center items-center"
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-right" size={18} color="#6B21A8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title input */}
              <View className="gap-1.5">
                <Text className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  Tên phụ lục công việc
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={`Phụ lục công việc ${formatMonthKey(monthKey)}`}
                  className="bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Description input */}
              <View className="gap-1.5">
                <Text className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  Ghi chú
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Nhập ghi chú cho phụ lục..."
                  multiline
                  numberOfLines={2}
                  className="bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm text-slate-700 min-h-[50px]"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Services List Section */}
            <View className="gap-3 mb-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-slate-900">Chi tiết dịch vụ</Text>
                <View className="bg-purple-100 px-2.5 py-0.5 rounded-full">
                  <Text className="text-xs font-bold text-purple-800">
                    {totals.taskCount} task tự tạo
                  </Text>
                </View>
              </View>

              {isFetchingTemplate ? (
                <View className="py-8 justify-center items-center gap-2 bg-white rounded-2xl border border-slate-200">
                  <ActivityIndicator size="small" color={BrandColors.primary} />
                  <Text className="text-xs text-slate-500">Đang tải mẫu dịch vụ cho tháng {formatMonthKey(monthKey)}...</Text>
                </View>
              ) : (
                <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Packages section */}
                  {aggregatedItems.packages.map((pkg, pIdx) => {
                    const packageKey = `pkg-${pIdx}-${pkg.name}`;
                    const isPackageExpanded = Boolean(expandedPackages[packageKey]);

                    return (
                      <View key={packageKey} className="border-b border-slate-100">
                        {/* Package Header */}
                        <TouchableOpacity
                          onPress={() => togglePackage(packageKey)}
                          className="flex-row items-center justify-between p-3.5 bg-blue-50/60"
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center gap-2 flex-1 mr-2">
                            <Feather
                              name={isPackageExpanded ? 'chevron-down' : 'chevron-right'}
                              size={18}
                              color="#1D4ED8"
                            />
                            <View className="bg-blue-600 px-1.5 py-0.5 rounded">
                              <Text className="text-[10px] font-extrabold text-white">GÓI</Text>
                            </View>
                            <Text className="text-sm font-bold text-blue-900 flex-1" numberOfLines={1}>
                              {pkg.packageName || pkg.name}
                            </Text>
                          </View>

                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs font-bold text-blue-800">
                              {formatNumber(Math.round(pkg.sellingPrice))} đ
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemovePackage(pkg.name)}
                              className="p-1 rounded-lg bg-rose-50"
                              activeOpacity={0.7}
                            >
                              <Feather name="trash-2" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>

                        {/* Package Items */}
                        {isPackageExpanded && (
                          <View className="bg-slate-50/50 pl-3">
                            {pkg.items.map((item: any, iIdx: number) => {
                              const serviceKey = `${packageKey}-item-${iIdx}`;
                              const isServiceExpanded = Boolean(expandedServices[serviceKey]);

                              return (
                                <View key={serviceKey} className="border-t border-slate-100 p-3">
                                  <TouchableOpacity
                                    onPress={() => toggleService(serviceKey)}
                                    className="flex-row items-center justify-between"
                                    activeOpacity={0.7}
                                  >
                                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                                      <Feather
                                        name={isServiceExpanded ? 'chevron-down' : 'chevron-right'}
                                        size={14}
                                        color="#64748B"
                                      />
                                      <Text className="text-xs font-semibold text-slate-700 flex-1">
                                        {item.serviceName}
                                      </Text>
                                    </View>
                                    <Text className="text-xs text-slate-500 italic">
                                      {formatNumber(Math.round(item.sellingPrice))} đ
                                    </Text>
                                  </TouchableOpacity>

                                  {isServiceExpanded && (
                                    <View className="mt-2 pl-6 pt-1 border-t border-slate-100">
                                      <Text className="text-xs text-slate-600 leading-4.5">
                                        {item.description || 'Không có mô tả chi tiết'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Standalone Section */}
                  {aggregatedItems.standalone.length > 0 && (
                    <View className="border-t border-slate-100">
                      <View className="bg-slate-100 px-3.5 py-1.5">
                        <Text className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          DỊCH VỤ LẺ
                        </Text>
                      </View>

                      {aggregatedItems.standalone.map((item: any, idx: number) => {
                        const serviceKey = `standalone-${idx}`;
                        const isServiceExpanded = Boolean(expandedServices[serviceKey]);

                        return (
                          <View key={serviceKey} className="border-b border-slate-100 p-3.5">
                            <TouchableOpacity
                              onPress={() => toggleService(serviceKey)}
                              className="flex-row items-center justify-between"
                              activeOpacity={0.7}
                            >
                              <View className="flex-row items-center gap-2 flex-1 mr-2">
                                <Feather
                                  name={isServiceExpanded ? 'chevron-down' : 'chevron-right'}
                                  size={16}
                                  color="#475569"
                                />
                                <Text className="text-xs font-bold text-slate-900 flex-1">
                                  {item.serviceName}
                                </Text>
                              </View>

                              <View className="flex-row items-center gap-2">
                                <Text className="text-xs font-bold text-slate-800">
                                  {formatNumber(Math.round(item.sellingPrice))} đ
                                </Text>
                                <TouchableOpacity
                                  onPress={() => handleRemoveService(item.originalIndex)}
                                  className="p-1 rounded-lg bg-rose-50"
                                  activeOpacity={0.7}
                                >
                                  <Feather name="trash-2" size={15} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>

                            {isServiceExpanded && (
                              <View className="mt-2 pl-6 pt-1 border-t border-slate-100">
                                <Text className="text-xs text-slate-600 leading-4.5">
                                  {item.description || 'Không có mô tả chi tiết'}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Empty State */}
                  {items.length === 0 && (
                    <View className="p-6 items-center justify-center gap-1">
                      <Feather name="file-minus" size={24} color="#94A3B8" />
                      <Text className="text-xs text-slate-400 italic">
                        Chưa có dịch vụ nào trong phụ lục tháng mới.
                      </Text>
                    </View>
                  )}

                  {/* Total Summary Footer */}
                  {items.length > 0 && (
                    <View className="bg-slate-50 p-3.5 flex-row justify-between items-center border-t border-slate-200">
                      <Text className="text-xs font-bold text-slate-700">TỔNG CỘNG HỢP ĐỒNG:</Text>
                      <Text className="text-sm font-extrabold text-purple-900">
                        {formatNumber(totals.revenue)} đ
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Add Service / Add Package Actions */}
            <View className="gap-2.5 mb-8">
              {/* Add Standalone Service Picker */}
              {!showAddService ? (
                <TouchableOpacity
                  onPress={() => setShowAddService(true)}
                  className="flex-row items-center justify-center gap-2 bg-blue-50 border border-blue-200 py-3 rounded-xl"
                  activeOpacity={0.8}
                >
                  <Feather name="plus-circle" size={16} color="#2563EB" />
                  <Text className="text-xs font-bold text-blue-600">Thêm dịch vụ lẻ</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 gap-3">
                  <Text className="text-xs font-bold text-blue-900">Chọn dịch vụ lẻ cần thêm:</Text>
                  <View className="gap-1.5">
                    {availableServices.map((svc: any) => (
                      <TouchableOpacity
                        key={svc.id}
                        onPress={() => setSelectedServiceId(String(svc.id))}
                        className={`p-2.5 rounded-lg border ${
                          selectedServiceId === String(svc.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-blue-200'
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            selectedServiceId === String(svc.id) ? 'text-white' : 'text-slate-800'
                          }`}
                        >
                          {svc.name} ({formatNumber(svc.costPrice || 0)} đ)
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {availableServices.length === 0 && (
                      <Text className="text-xs text-slate-500 italic p-2">
                        Không còn dịch vụ lẻ nào khả dụng
                      </Text>
                    )}
                  </View>

                  <View className="flex-row gap-2 mt-1">
                    <TouchableOpacity
                      onPress={handleAddService}
                      disabled={!selectedServiceId}
                      className={`flex-1 py-2.5 rounded-lg justify-center items-center ${
                        selectedServiceId ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-bold text-white">Xác nhận thêm</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setShowAddService(false);
                        setSelectedServiceId('');
                      }}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 justify-center items-center"
                      activeOpacity={0.7}
                    >
                      <Text className="text-xs font-bold text-slate-700">Hủy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Add Package Template Picker */}
              {!showAddPackage ? (
                <TouchableOpacity
                  onPress={() => setShowAddPackage(true)}
                  className="flex-row items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 py-3 rounded-xl"
                  activeOpacity={0.8}
                >
                  <Feather name="package" size={16} color="#4F46E5" />
                  <Text className="text-xs font-bold text-indigo-600">Thêm gói mẫu</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 gap-3">
                  <Text className="text-xs font-bold text-indigo-900">Chọn gói mẫu cần áp dụng:</Text>
                  <View className="gap-1.5">
                    {availablePackages.map((pkg: any) => (
                      <TouchableOpacity
                        key={pkg.id}
                        onPress={() => setSelectedPackageId(String(pkg.id))}
                        className={`p-2.5 rounded-lg border ${
                          selectedPackageId === String(pkg.id)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-white border-indigo-200'
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            selectedPackageId === String(pkg.id) ? 'text-white' : 'text-slate-800'
                          }`}
                        >
                          {pkg.name} ({pkg.items?.length || 0} dịch vụ)
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {availablePackages.length === 0 && (
                      <Text className="text-xs text-slate-500 italic p-2">
                        Không còn gói mẫu nào khả dụng
                      </Text>
                    )}
                  </View>

                  <View className="flex-row gap-2 mt-1">
                    <TouchableOpacity
                      onPress={handleAddPackage}
                      disabled={!selectedPackageId}
                      className={`flex-1 py-2.5 rounded-lg justify-center items-center ${
                        selectedPackageId ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-bold text-white">Áp dụng gói</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setShowAddPackage(false);
                        setSelectedPackageId('');
                      }}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 justify-center items-center"
                      activeOpacity={0.7}
                    >
                      <Text className="text-xs font-bold text-slate-700">Hủy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View className="p-4 bg-white border-t border-slate-200 flex-row gap-3">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={items.length === 0 || createAddendumMutation.isPending}
              className={`flex-1 py-3.5 rounded-xl justify-center items-center flex-row gap-2 ${
                items.length > 0 && !createAddendumMutation.isPending ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              activeOpacity={0.8}
            >
              {createAddendumMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="check-circle" size={18} color="#FFFFFF" />
              )}
              <Text className="text-sm font-bold text-white">
                {createAddendumMutation.isPending ? 'Đang khởi tạo...' : 'Tạo phụ lục công việc'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
