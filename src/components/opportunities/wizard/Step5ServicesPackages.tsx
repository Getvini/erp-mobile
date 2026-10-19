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
import { formatNumberInput, parseNumberInput, formatVNDFull } from '@/utils/formatters';

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
    setPackageServiceJobIncluded,
    setPackageServiceJobBrief,
    addService,
    removeService,
    selectServiceItem,
    setServiceQuantity,
    setServiceJobIncluded,
    setServiceJobBrief,
  } = useOpportunityFormStore();

  const { packages, services } = formData;

  // Metadata catalogs
  const { data: rawServ } = useAvailableServicesQuery();
  const { data: rawPkg } = useServicePackagesQuery();

  const availableServices = useMemo<Array<{ id: string; name: string; costPrice?: number; serviceJobs?: any[] }>>(() => {
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
      return total + (found?.costPrice || 0) * (item.quantity || 1);
    }, 0);

    const packagesCost = packages.reduce((total, pkg) => {
      const pkgQty = Number(pkg.quantity) || 1;
      const pkgServicesTotal = (pkg.services || []).reduce((pSum, s) => {
        return pSum + (s.sellingPrice || 0) * (s.quantity || 1) * pkgQty;
      }, 0);
      return total + pkgServicesTotal;
    }, 0);

    return standaloneCost + packagesCost;
  }, [services, packages, availableServices]);

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center justify-between pb-[12px] border-b border-b-slate-200 mb-[14px]">
        <View className="flex-row items-center gap-[8px]">
          <View className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF2FF] justify-center items-center">
            <Feather name="briefcase" size={18} color="#6366F1" />
          </View>
          <Text className="text-[15px] font-bold text-slate-900">
            Dịch vụ đề xuất <Text className="text-[#EF4444]">*</Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => addPackage()}
          activeOpacity={0.7}
          className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]"
        >
          <Feather name="plus" size={14} color="#2563EB" />
          <Text className="text-[13px] font-semibold text-blue-600">Gói dịch vụ</Text>
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
                className="flex-row items-center bg-[rgba(239,_246,_255,_0.4)] border border-blue-200 rounded-[12px] p-[10px] gap-[10px] mb-[8px]"
              >
                <TouchableOpacity
                  onPress={() => setActivePackageIndex(idx)}
                  activeOpacity={0.7}
                  className="flex-1 flex-row items-center justify-between bg-white border-[2px] border-blue-200 rounded-[8px] px-[12px] py-[9px]"
                >
                  <Text className="text-[13px] font-bold text-[#1E3A8A]">
                    -- Chọn gói dịch vụ --
                  </Text>
                  <Feather name="chevron-down" size={18} color="#1E3A8A" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => removePackage(idx)}
                  activeOpacity={0.7}
                  className="p-[6px]"
                >
                  <Feather name="trash-2" size={18} color="#F87171" />
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View
              key={idx}
              className="bg-[rgba(239,_246,_255,_0.4)] border-[2px] border-[#DBEAFE] rounded-[14px] p-[12px] mb-[12px]"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-[10px] flex-1">
                  <View className="w-[34px] h-[34px] rounded-[10px] bg-blue-600 justify-center items-center">
                    <Feather name="briefcase" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-[14px] font-bold text-[#1E3A8A]">
                      {selectedPkg?.name || pkg.name || 'Gói dịch vụ'}
                    </Text>
                    <Text className="text-[9px] font-extrabold text-blue-600 tracking-[0.6px] mt-[1px]">
                      GÓI DỊCH VỤ
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-[8px]">
                  <View className="flex-row items-center bg-white border border-slate-300 rounded-[8px] px-[6px] h-[38px]">
                    <Text className="text-[11px] text-slate-500 mr-[4px]">SL</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={formatNumberInput(String(pkg.quantity))}
                      onChangeText={(txt) =>
                        setPackageQuantity(idx, Math.max(1, parseNumberInput(txt) || 1))
                      }
                      className="w-[36px] text-center text-[14px] font-bold text-slate-900"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => removePackage(idx)}
                    activeOpacity={0.7}
                    className="p-[6px]"
                  >
                    <Feather name="trash-2" size={18} color="#F87171" />
                  </TouchableOpacity>
                </View>
              </View>

              {pkg.description ? (
                <View className="mt-[8px] bg-white/70 rounded-[8px] p-[8px]">
                  <Text className="text-[12px] text-slate-600">{pkg.description}</Text>
                </View>
              ) : null}

              {/* Accordion Toggle Bar: Dịch vụ trong gói */}
              <View className="mt-[10px] pt-[8px] border-t border-t-[#DBEAFE]">
                <View className="flex-row items-center justify-between mb-[8px]">
                  <TouchableOpacity
                    onPress={() => handleToggleExpandPackage(idx)}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-[6px] py-[4px]"
                  >
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#1D4ED8"
                    />
                    <Text className="text-[12px] font-bold text-[#1D4ED8] uppercase tracking-[0.4px]">
                      Dịch vụ trong gói ({pkgServices.length})
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <TouchableOpacity
                      onPress={() => addPackageService(idx)}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] bg-blue-100"
                    >
                      <Feather name="plus" size={12} color="#1D4ED8" />
                      <Text className="text-[11px] font-semibold text-[#1D4ED8]">Thêm dịch vụ</Text>
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
                          className="bg-white rounded-[10px] p-[10px] border border-blue-100 gap-[8px]"
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
                                className={`text-[12px] font-semibold flex-1 ${
                                  foundSub ? 'text-slate-900' : 'text-slate-400 font-normal'
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
                              <Feather name="trash-2" size={16} color="#F87171" />
                            </TouchableOpacity>
                          </View>

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
            className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]"
          >
            <Feather name="plus" size={14} color="#6366F1" />
            <Text style={{ color: '#6366F1' }} className="text-[13px] font-semibold">
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

          return (
            <View
              key={idx}
              className="bg-slate-50 rounded-[12px] p-[10px] border border-slate-200 mb-[8px] gap-[8px]"
            >
              <View className="flex-row items-center gap-[8px]">
                <TouchableOpacity
                  onPress={() => setActiveServiceTarget({ type: 'standalone', index: idx })}
                  activeOpacity={0.7}
                  className="flex-1 flex-row items-center justify-between bg-white rounded-[8px] px-[12px] py-[9px] border border-slate-300"
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[13px] font-semibold flex-1 ${
                      selectedServ ? 'text-slate-900' : 'text-slate-400 font-normal'
                    }`}
                  >
                    {selectedServ ? selectedServ.name : '-- Chọn dịch vụ --'}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>

                <View className="w-[52px] h-[38px] bg-white border border-slate-300 rounded-[8px] justify-center items-center">
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
                  <Feather name="trash-2" size={18} color="#F87171" />
                </TouchableOpacity>
              </View>

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

      {/* C. TỔNG GIÁ VỐN GRADIENT BANNER (Y chang bên Web) */}
      <View
        className={`mt-[12px] bg-[#6D28D9] rounded-[12px] px-[16px] py-[14px] flex-row items-center justify-between ${
          isSmallScreen ? 'flex-col items-start gap-[4px]' : ''
        }`}
      >
        <Text className="text-[12px] font-medium text-white flex-1">
          Tổng giá vốn của các dịch vụ đã chọn:
        </Text>
        <Text
          style={isSmallScreen ? { fontSize: 17, marginTop: 4 } : undefined}
          className="text-[20px] font-extrabold text-white"
        >
          {formatVNDFull(totalServicesCost)}
        </Text>
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
