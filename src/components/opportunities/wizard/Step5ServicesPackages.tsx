import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useOpportunityFormStore } from '@/stores/useOpportunityFormStore';
import {
  useAvailableServicesQuery,
} from '@/hooks/queries/useOpportunities';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import {
  ServicePackageBottomSheet,
  ServiceSelectionBottomSheet,
  ServiceJobAccordion,
} from '@/components/opportunities';
import { formatNumberInput, parseNumberInput, formatVND, formatVNDFull } from '@/utils/formatters';

export const Step5ServicesPackages: React.FC = () => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const {
    formData,
    addPackage,
    removePackage,
    selectPackageTemplate,
    setPackageQuantity,
    addPackageService,
    removePackageService,
    updatePackageService,
    setPackageServiceBudget,
    setPackageServiceJobIncluded,
    setPackageServiceJobBrief,
    addService,
    removeService,
    selectServiceItem,
    setServiceQuantity,
    setServiceBudget,
    setServiceJobIncluded,
    setServiceJobBrief,
  } = useOpportunityFormStore();

  const { packages, services } = formData;

  // Metadata catalogs
  const { data: rawServ } = useAvailableServicesQuery();
  const { data: rawPkg } = useServicePackagesQuery();

  const availableServices = useMemo<Array<{
    id: string;
    name: string;
    costPrice?: number;
    isBudget?: boolean;
    serviceJobs?: any[];
  }>>(() => {
    if (!rawServ) return [];
    return Array.isArray(rawServ)
      ? rawServ
      : (rawServ as any)?.data && Array.isArray((rawServ as any).data)
        ? (rawServ as any).data
        : [];
  }, [rawServ]);

  const availablePackages = useMemo<Array<any>>(() => {
    if (!rawPkg) return [];
    return Array.isArray(rawPkg)
      ? rawPkg
      : (rawPkg as any)?.data && Array.isArray((rawPkg as any).data)
        ? (rawPkg as any).data
        : [];
  }, [rawPkg]);

  // Helper functions tính giá vốn chuẩn khớp với Web
  const getServiceJobsCost = (jobs: any[] = [], serviceObj?: any) =>
    jobs.reduce((total, sj) => {
      if (sj?.included === false) return total;
      const qty = Number(sj.quantity || 1);
      const fallbackJob = serviceObj?.serviceJobs?.find(
        (item: any) => String(item.job?.id || item.jobId || item.id) === String(sj.jobId || sj.id)
      );
      const unitCost = Number(
        sj.costPrice ??
        sj.costAtSale ??
        sj.job?.costPrice ??
        fallbackJob?.costPrice ??
        fallbackJob?.costAtSale ??
        fallbackJob?.job?.costPrice ??
        0
      );
      return total + unitCost * qty;
    }, 0);

  const getServiceBaseCost = (service: any, jobs: any[] = []) => {
    // 1. Ưu tiên giá của dịch vụ do API trả ra
    const serviceCost = Number(service?.costPrice || 0);
    if (serviceCost > 0) {
      return serviceCost;
    }

    // 2. Khi nào giá dịch vụ trả ra là 0 (hoặc <= 0), mới tính đến các hạng mục (jobs) bên trong
    const jobsToCalculate = jobs && jobs.length > 0 ? jobs : (service?.serviceJobs || service?.jobs || []);
    return getServiceJobsCost(jobsToCalculate, service);
  };

  const getLineCost = (
    item: { quantity?: number; budget?: number; jobs?: any[]; sellingPrice?: number },
    serviceObj?: any
  ) => {
    const jobs = item.jobs && item.jobs.length > 0 ? item.jobs : (serviceObj?.serviceJobs || []);
    const baseCost = getServiceBaseCost(serviceObj, jobs);
    const budget = Number(item.budget || 0);
    return (baseCost + budget) * Math.max(1, Number(item.quantity) || 1);
  };

  const getPackageLineCost = (pkg: any) => {
    const pkgQty = Math.max(1, Number(pkg.quantity) || 1);
    const servicesTotal = (pkg.services || []).reduce((sum: number, s: any) => {
      if (!s.serviceId) return sum;
      const found = availableServices.find((serv) => String(serv.id) === String(s.serviceId));
      const baseCost = getServiceBaseCost(found, s.jobs || found?.serviceJobs || []);
      const budget = Number(s.budget || 0);
      return sum + (baseCost + budget) * Math.max(1, Number(s.quantity) || 1);
    }, 0);
    return servicesTotal * pkgQty;
  };

  // Modal / BottomSheet States
  const [activePackageIndex, setActivePackageIndex] = useState<number | null>(null);
  const [activeServiceTarget, setActiveServiceTarget] = useState<
    | { type: 'standalone'; index: number }
    | { type: 'package'; pkgIndex: number; serviceIndex: number }
    | null
  >(null);
  const [expandedPackages, setExpandedPackages] = useState<Record<number, boolean>>({ 0: true });

  const handleToggleExpandPackage = (index: number) => {
    setExpandedPackages((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSelectPackageTemplate = (index: number, templateId: string) => {
    const template = availablePackages.find((t) => String(t.id) === String(templateId));
    selectPackageTemplate(index, template);
    setActivePackageIndex(null);
    setExpandedPackages((prev) => ({ ...prev, [index]: true }));
  };

  const handleSelectServiceFromModal = (serviceId: string) => {
    if (!activeServiceTarget) return;

    if (activeServiceTarget.type === 'standalone') {
      const found = availableServices.find((s) => String(s.id) === String(serviceId));
      selectServiceItem(activeServiceTarget.index, serviceId, found);
    } else if (activeServiceTarget.type === 'package') {
      const found = availableServices.find((s) => String(s.id) === String(serviceId));
      updatePackageService(
        activeServiceTarget.pkgIndex,
        activeServiceTarget.serviceIndex,
        'serviceId',
        serviceId,
        found
      );
    }
    setActiveServiceTarget(null);
  };

  // Total Cost Calculation (Tổng giá vốn của các dịch vụ đã chọn)
  const totalServicesCost = useMemo(() => {
    const standaloneCost = services.reduce((total, item) => {
      if (!item.serviceId) return total;
      const found = availableServices.find((s) => String(s.id) === String(item.serviceId));
      return total + getLineCost(item, found);
    }, 0);

    const packagesCost = packages.reduce((total, pkg) => {
      if (!pkg.servicePackageId) return total;
      return total + getPackageLineCost(pkg);
    }, 0);

    return standaloneCost + packagesCost;
  }, [services, packages, availableServices]);

  const expectedSellingValue = useMemo(() => {
    return Math.round(totalServicesCost * 1.4);
  }, [totalServicesCost]);

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center justify-between pb-[14px] border-b border-b-slate-200 mb-[16px]">
        <View className="flex-row items-center gap-[12px] flex-1 mr-[8px]">
          <View style={{ backgroundColor: '#FFF7ED' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center border border-[#FDCB9E]">
            <Text style={{ color: '#F38820' }} className="text-[14px] font-bold">5</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-[15px] font-bold text-slate-900">
              Dịch vụ đề xuất <Text className="text-[#EF4444]">*</Text>
            </Text>
            <Text className="text-[12px] text-slate-500 mt-[2px]" numberOfLines={1}>
              Chọn gói hoặc dịch vụ lẻ và tính giá vốn
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => addPackage()}
          activeOpacity={0.7}
          className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-[#FFF7ED] border border-[#FDCB9E] gap-[4px]"
        >
          <Feather name="plus" size={14} color="#D97010" />
          <Text className="text-[13px] font-semibold text-[#D97010]">Gói dịch vụ</Text>
        </TouchableOpacity>
      </View>

      {/* A. GÓI DỊCH VỤ ĐỀ XUẤT */}
      <View className="mb-[6px]">
        <Text className="text-[11px] font-extrabold text-slate-400 tracking-[0.8px] mb-[8px]">
          GÓI DỊCH VỤ ĐỀ XUẤT
        </Text>

        {packages.map((pkg, idx) => {
          const selectedPkg = availablePackages.find(
            (p) => String(p.id) === String(pkg.servicePackageId)
          );
          const isExpanded = expandedPackages[idx] ?? true;
          const pkgServices = pkg.services || [];

          if (!pkg.servicePackageId) {
            return (
              <View
                key={idx}
                className="flex-row items-center bg-[#FFF7ED]/70 rounded-[12px] p-[10px] gap-[10px] mb-[8px]"
              >
                <TouchableOpacity
                  onPress={() => setActivePackageIndex(idx)}
                  activeOpacity={0.7}
                  className="flex-1 flex-row items-center justify-between bg-white border border-[#FDCB9E] rounded-[8px] px-[12px] py-[9px]"
                >
                  <Text className="text-[13px] font-bold text-orange-950">
                    -- Chọn gói dịch vụ --
                  </Text>
                  <Feather name="chevron-down" size={18} color="#D97010" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => removePackage(idx)}
                  activeOpacity={0.7}
                  className="p-[6px]"
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          }

          const pkgLineCost = getPackageLineCost(pkg);

          return (
            <View
              key={idx}
              className="bg-[#FFF7ED]/70 rounded-[14px] p-[12px] mb-[12px]"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-[10px] flex-1 mr-[8px]">
                  <View className="w-[34px] h-[34px] rounded-[10px] bg-[#F38820] justify-center items-center">
                    <Feather name="briefcase" size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-[14px] font-bold text-slate-900 leading-[19px]">
                      {selectedPkg?.name || pkg.name || 'Gói dịch vụ'}
                    </Text>
                    <Text className="text-[10px] font-extrabold text-[#F38820] tracking-[0.6px] mt-[1px]">
                      GÓI DỊCH VỤ
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-[8px]">
                  <View className="flex-row items-center bg-white border border-slate-300 rounded-[8px] px-[6px] h-[36px]">
                    <Text className="text-[11px] text-slate-500 mr-[4px]">SL</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={formatNumberInput(String(pkg.quantity))}
                      onChangeText={(txt) =>
                        setPackageQuantity(idx, Math.max(1, parseNumberInput(txt) || 1))
                      }
                      style={{ paddingVertical: 0 }}
                      className="w-[32px] text-center text-[13px] font-bold text-slate-900"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => removePackage(idx)}
                    activeOpacity={0.7}
                    className="p-[6px]"
                  >
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dòng Giá vốn gói: Xuống dòng riêng biệt, rõ ràng và không chèn ép tên gói */}
              <View className="flex-row items-center justify-between mt-[10px] bg-white border border-[#FDCB9E]/80 rounded-[8px] py-[6px] px-[10px]">
                <Text className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.3px]">
                  Giá vốn gói:
                </Text>
                <Text className="text-[13px] font-extrabold text-[#D97010]">
                  {formatVND(pkgLineCost)}
                </Text>
              </View>

              {pkg.description ? (
                <View className="mt-[8px] bg-white/70 rounded-[8px] p-[8px]">
                  <Text className="text-[12px] text-slate-600">{pkg.description}</Text>
                </View>
              ) : null}

              {/* Accordion Toggle Bar: Dịch vụ trong gói */}
              <View className="mt-[10px] pt-[8px] border-t border-t-[#FDCB9E]/60">
                <View className="flex-row items-center justify-between mb-[8px]">
                  <TouchableOpacity
                    onPress={() => handleToggleExpandPackage(idx)}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-[6px] py-[4px]"
                  >
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#D97010"
                    />
                    <Text className="text-[12px] font-bold text-[#D97010] uppercase tracking-[0.4px]">
                      Dịch vụ trong gói ({pkgServices.length})
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <TouchableOpacity
                      onPress={() => addPackageService(idx)}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] bg-[#FFF7ED] border border-[#FDCB9E]"
                    >
                      <Feather name="plus" size={12} color="#D97010" />
                      <Text className="text-[11px] font-semibold text-[#D97010]">Thêm dịch vụ</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Package Sub-Services List */}
                {isExpanded && (
                  <View className="gap-[8px]">
                    {pkgServices.map((serviceItem, sIdx) => {
                      const foundSub = availableServices.find(
                        (s) => String(s.id) === String(serviceItem.serviceId)
                      );
                      const subLineCost = getLineCost(serviceItem, foundSub);
                      const allJobs =
                        serviceItem.jobs && serviceItem.jobs.length > 0
                          ? serviceItem.jobs
                          : (foundSub?.serviceJobs || []).map((sj: any) => ({
                            jobId: sj.job?.id || sj.jobId || sj.id,
                            name: sj.job?.name || sj.name || 'Hạng mục',
                            costPrice: sj.job?.costPrice || sj.costPrice || 0,
                            unit: sj.job?.unit || sj.unit || '',
                            isBriefVideo: Boolean(sj.job?.isBriefVideo || sj.isBriefVideo),
                            isQuotationItem:
                              sj.job?.isQuotationItem !== false && sj.isQuotationItem !== false,
                            included: !Boolean(sj.job?.isBriefVideo || sj.isBriefVideo),
                            briefVideo: '',
                          }));

                      return (
                        <View
                          key={sIdx}
                          className="bg-white rounded-[10px] p-[10px] border border-border gap-[8px]"
                        >
                          <View className="flex-row items-center gap-[8px]">
                            <TouchableOpacity
                              onPress={() =>
                                setActiveServiceTarget({
                                  type: 'package',
                                  pkgIndex: idx,
                                  serviceIndex: sIdx,
                                })
                              }
                              activeOpacity={0.7}
                              className="flex-1 flex-row items-center justify-between bg-slate-50 rounded-[8px] px-[10px] py-[8px] border border-slate-200"
                            >
                              <Text
                                numberOfLines={1}
                                className={`text-[12px] font-semibold flex-1 ${foundSub ? 'text-slate-900' : 'text-slate-400 font-normal'
                                  }`}
                              >
                                {foundSub ? foundSub.name : '-- Chọn dịch vụ --'}
                              </Text>
                              <Feather name="chevron-down" size={14} color="#64748B" />
                            </TouchableOpacity>

                            <View className="w-[48px] h-[36px] bg-white border border-slate-300 rounded-[8px] justify-center items-center">
                              <TextInput
                                keyboardType="numeric"
                                value={formatNumberInput(String(serviceItem.quantity || 1))}
                                onChangeText={(txt) =>
                                  updatePackageService(
                                    idx,
                                    sIdx,
                                    'quantity',
                                    parseNumberInput(txt) || 1
                                  )
                                }
                                className="w-full h-full text-center text-[13px] font-bold text-slate-900"
                              />
                            </View>

                            <TouchableOpacity
                              onPress={() => removePackageService(idx, sIdx)}
                              activeOpacity={0.7}
                              className="p-[6px]"
                            >
                              <Feather name="trash-2" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>

                          {/* Giá vốn dòng */}
                          {foundSub ? (
                            <View className="flex-row items-center justify-between px-1">
                              <Text className="text-[11px] text-slate-500 font-medium">Giá vốn:</Text>
                              <Text className="text-[12px] font-bold text-slate-800">
                                {formatVND(subLineCost)}
                              </Text>
                            </View>
                          ) : null}

                          {/* Ô nhập Ngân sách nếu dịch vụ có isBudget */}
                          {foundSub?.isBudget ? (
                            <View className="bg-amber-50/80 border border-amber-200 rounded-[8px] p-[8px] flex-row items-center justify-between">
                              <View className="flex-row items-center gap-[6px] flex-1 mr-[8px]">
                                <Feather name="dollar-sign" size={13} color="#D97706" />
                                <Text className="text-[12px] font-bold text-amber-800">
                                  Ngân sách dịch vụ <Text className="text-red-500">*</Text>
                                </Text>
                              </View>
                              <View className="w-[125px] h-[36px] bg-white border border-amber-300 rounded-[6px] px-[8px] flex-row items-center">
                                <TextInput
                                  keyboardType="numeric"
                                  placeholder="0"
                                  placeholderTextColor="#94A3B8"
                                  value={serviceItem.budget ? formatNumberInput(String(serviceItem.budget)) : ''}
                                  onChangeText={(txt) =>
                                    updatePackageService(
                                      idx,
                                      sIdx,
                                      'budget',
                                      parseNumberInput(txt) || 0
                                    )
                                  }
                                  style={{ paddingVertical: 0 }}
                                  className="flex-1 text-right text-[13px] font-bold text-slate-900"
                                />
                                <Text className="text-[11px] font-bold text-amber-700 ml-[4px]">₫</Text>
                              </View>
                            </View>
                          ) : null}

                          {/* Hạng mục con lồng trong dịch vụ gói */}
                          <ServiceJobAccordion
                            jobs={allJobs}
                            mode="opportunity_create"
                            onJobIncludedChange={(jobId, included) =>
                              setPackageServiceJobIncluded(idx, sIdx, jobId, included)
                            }
                            onJobBriefChange={(jobId, briefText) =>
                              setPackageServiceJobBrief(idx, sIdx, jobId, briefText)
                            }
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* B. DỊCH VỤ LẺ */}
      <View style={{ marginTop: 16 }} className="mb-[6px]">
        <View className="flex-row items-center justify-between mb-[8px]">
          <Text className="text-[11px] font-extrabold text-slate-400 tracking-[0.8px] mb-[8px]">
            DỊCH VỤ LẺ
          </Text>
          <TouchableOpacity
            onPress={() => addService()}
            activeOpacity={0.7}
            className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-[#FFF7ED] border border-[#FDCB9E] gap-[4px]"
          >
            <Feather name="plus" size={14} color="#D97010" />
            <Text className="text-[13px] font-semibold text-[#D97010]">
              Dịch vụ lẻ
            </Text>
          </TouchableOpacity>
        </View>

        {services.map((row, idx) => {
          const selectedServ = availableServices.find((s) => String(s.id) === String(row.serviceId));
          const allJobs =
            row.jobs && row.jobs.length > 0
              ? row.jobs
              : (selectedServ?.serviceJobs || []).map((sj: any) => ({
                jobId: sj.job?.id || sj.jobId || sj.id,
                name: sj.job?.name || sj.name || 'Hạng mục',
                costPrice: sj.job?.costPrice || sj.costPrice || 0,
                unit: sj.job?.unit || sj.unit || '',
                isBriefVideo: Boolean(sj.job?.isBriefVideo || sj.isBriefVideo),
                isQuotationItem:
                  sj.job?.isQuotationItem !== false && sj.isQuotationItem !== false,
                included: !Boolean(sj.job?.isBriefVideo || sj.isBriefVideo),
                briefVideo: '',
              }));

          const lineCost = getLineCost(row, selectedServ);

          return (
            <View
              key={idx}
              className="bg-[#FFF7ED]/70 rounded-[14px] p-[12px] border border-[#FDCB9E]/80 mb-[10px] gap-[8px]"
            >
              <View className="flex-row items-center gap-[8px]">
                <TouchableOpacity
                  onPress={() => setActiveServiceTarget({ type: 'standalone', index: idx })}
                  activeOpacity={0.7}
                  className="flex-1 flex-row items-center justify-between bg-white rounded-[8px] px-[12px] py-[9px] border border-[#FDCB9E]"
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[13px] font-semibold flex-1 ${selectedServ ? 'text-slate-900' : 'text-slate-400 font-normal'
                      }`}
                  >
                    {selectedServ ? selectedServ.name : '-- Chọn dịch vụ --'}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#D97010" />
                </TouchableOpacity>

                <View className="w-[52px] h-[38px] bg-white border border-[#FDCB9E] rounded-[8px] justify-center items-center">
                  <TextInput
                    keyboardType="numeric"
                    value={formatNumberInput(String(row.quantity))}
                    onChangeText={(txt) =>
                      setServiceQuantity(idx, Math.max(1, parseNumberInput(txt) || 1))
                    }
                    className="w-full h-full text-center text-[14px] font-bold text-slate-900"
                  />
                </View>

                <TouchableOpacity
                  onPress={() => removeService(idx)}
                  activeOpacity={0.7}
                  className="p-[6px]"
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Giá vốn dòng */}
              {selectedServ ? (
                <View className="flex-row items-center justify-between bg-white border border-[#FDCB9E]/80 rounded-[8px] py-[6px] px-[10px]">
                  <Text className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.3px]">Giá vốn:</Text>
                  <Text className="text-[13px] font-extrabold text-[#D97010]">
                    {formatVND(lineCost)}
                  </Text>
                </View>
              ) : null}

              {/* Ô nhập Ngân sách nếu dịch vụ có isBudget */}
              {selectedServ?.isBudget ? (
                <View className="bg-amber-50/80 border border-amber-200 rounded-[8px] p-[8px] flex-row items-center justify-between">
                  <View className="flex-row items-center gap-[6px] flex-1 mr-[8px]">
                    <Feather name="dollar-sign" size={13} color="#D97706" />
                    <Text className="text-[12px] font-bold text-amber-800">
                      Ngân sách dịch vụ <Text className="text-red-500">*</Text>
                    </Text>
                  </View>
                  <View className="w-[125px] h-[36px] bg-white border border-amber-300 rounded-[6px] px-[8px] flex-row items-center">
                    <TextInput
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={row.budget ? formatNumberInput(String(row.budget)) : ''}
                      onChangeText={(txt) =>
                        setServiceBudget(idx, parseNumberInput(txt) || 0)
                      }
                      style={{ paddingVertical: 0 }}
                      className="flex-1 text-right text-[13px] font-bold text-slate-900"
                    />
                    <Text className="text-[11px] font-bold text-amber-700 ml-[4px]">₫</Text>
                  </View>
                </View>
              ) : null}

              {/* Hạng mục con lồng trong dịch vụ lẻ */}
              <ServiceJobAccordion
                jobs={allJobs}
                mode="opportunity_create"
                onJobIncludedChange={(jobId, included) =>
                  setServiceJobIncluded(idx, jobId, included)
                }
                onJobBriefChange={(jobId, briefText) =>
                  setServiceJobBrief(idx, jobId, briefText)
                }
              />
            </View>
          );
        })}
      </View>

      {/* C. TỔNG GIÁ VỐN & GIÁ BÁN DỰ KIẾN (Chuẩn sắc cam Getvini) */}
      <View className="mt-[14px] bg-[#F38820] rounded-[14px] px-[16px] py-[14px] shadow-sm">
        {/* Hàng 1: Tổng giá vốn */}
        <View
          className={`flex-row items-center justify-between ${isSmallScreen ? 'flex-col items-start gap-[4px]' : ''
            }`}
        >
          <Text className="text-[12px] font-medium text-white/95 flex-1">
            Tổng giá vốn của các dịch vụ đã chọn:
          </Text>
          <Text
            style={isSmallScreen ? { fontSize: 16, marginTop: 4 } : undefined}
            className="text-[18px] font-extrabold text-white"
          >
            {formatVNDFull(totalServicesCost)}
          </Text>
        </View>

        {/* Hàng 2: Giá bán dự kiến (140% giá vốn) */}
        <View
          className={`mt-[10px] pt-[10px] border-t border-white/30 flex-row items-center justify-between ${isSmallScreen ? 'flex-col items-start gap-[4px]' : ''
            }`}
        >
          <Text className="text-[12px] font-medium text-white/95 flex-1">
            Giá bán dự kiến (140% giá vốn):
          </Text>
          <Text
            style={isSmallScreen ? { fontSize: 17, marginTop: 4 } : undefined}
            className="text-[20px] font-black text-white"
          >
            {formatVNDFull(expectedSellingValue)}
          </Text>
        </View>
      </View>

      {/* Service Package Bottom Sheet Modal */}
      <ServicePackageBottomSheet
        visible={activePackageIndex !== null}
        packages={availablePackages}
        selectedPackageId={
          activePackageIndex !== null
            ? packages[activePackageIndex]?.servicePackageId || ''
            : ''
        }
        onSelectPackage={(pkg) => {
          if (activePackageIndex !== null) {
            handleSelectPackageTemplate(activePackageIndex, pkg.id);
          }
        }}
        onClose={() => setActivePackageIndex(null)}
      />

      {/* Service Selection Bottom Sheet Modal */}
      <ServiceSelectionBottomSheet
        visible={activeServiceTarget !== null}
        services={availableServices}
        selectedServiceId={
          activeServiceTarget
            ? activeServiceTarget.type === 'standalone'
              ? services[activeServiceTarget.index]?.serviceId || ''
              : packages[activeServiceTarget.pkgIndex]?.services?.[
                activeServiceTarget.serviceIndex
              ]?.serviceId || ''
            : ''
        }
        onSelectService={(serviceId: string) => handleSelectServiceFromModal(serviceId)}
        onClose={() => setActiveServiceTarget(null)}
      />
    </View>
  );
};
