import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatVNDFull, formatNumber } from '@/utils/formatters';
import { ServiceJobAccordion } from '@/components/opportunities/ServiceJobAccordion';

interface PackageServiceItem {
  id?: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  unit: string;
  jobs?: any[];
}

interface PackageItem {
  name: string;
  quantity: number;
  services: PackageServiceItem[];
}

interface StandaloneServiceItem {
  id?: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  unit: string;
  jobs?: any[];
}

interface ContractServicesSectionProps {
  sellingPrice: number;
  costPrice: number;
  totalPaid: number;
  totalDebt: number;
  progressPercent: number;
  packagesList: PackageItem[];
  standaloneList: StandaloneServiceItem[];
  isAdminOrBod?: boolean;
}

export const ContractServicesSection: React.FC<ContractServicesSectionProps> = ({
  sellingPrice,
  costPrice,
  totalPaid,
  totalDebt,
  progressPercent,
  packagesList,
  standaloneList,
  isAdminOrBod = false,
}) => {
  return (
    <View className="gap-[12px]">
      {/* TỔNG KẾT TÀI CHÍNH */}
      <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
        <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
          <View className="flex-row items-center gap-[8px]">
            <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
              <Feather name="dollar-sign" size={16} color="#2563EB" />
            </View>
            <Text className="text-[14px] font-bold text-slate-800">Tổng kết tài chính</Text>
          </View>
        </View>

        <View className="gap-[10px]">
          {/* 1. TỔNG GIÁ TRỊ HỢP ĐỒNG */}
          <View className="bg-[#1E40AF] rounded-[12px] p-[14px] shadow-md">
            <Text className="text-[10px] font-extrabold text-[#DBEAFE] tracking-[0.8px] mb-[4px]">
              TỔNG GIÁ TRỊ HỢP ĐỒNG
            </Text>
            <Text className="text-[18px] font-black text-white">{formatVNDFull(sellingPrice)}</Text>
          </View>

          {/* 2. TỔNG VỐN (Chỉ hiển thị cho Quản trị viên ADMIN/BOD) */}
          {isAdminOrBod && (
            <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
              <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">TỔNG VỐN</Text>
              <Text style={{ color: '#059669' }} className="text-[16px] font-extrabold mt-[2px]">
                {formatVNDFull(costPrice)}
              </Text>
            </View>
          )}

          {/* 3. ĐÃ THANH TOÁN THỰC TẾ */}
          <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
            <View className="flex-row justify-between items-center mb-[2px]">
              <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">
                ĐÃ THANH TOÁN THỰC TẾ
              </Text>
              <View style={{ backgroundColor: '#ECFDF5' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                <Feather name="trending-up" size={13} color="#059669" />
              </View>
            </View>
            <Text style={{ color: '#059669' }} className="text-[16px] font-extrabold mt-[2px]">
              {formatVNDFull(totalPaid)}
            </Text>
            <Text className="text-[11px] text-slate-400 mt-[4px]">
              Bạn đã thu về {progressPercent}% doanh thu
            </Text>
          </View>

          {/* 4. CÔNG NỢ CHỜ THU HỒI */}
          <View className="bg-slate-50 rounded-[12px] p-[12px] border border-slate-200">
            <View className="flex-row justify-between items-center mb-[2px]">
              <Text className="text-[10px] font-bold text-slate-500 tracking-[0.5px]">
                CÔNG NỢ CHỜ THU HỒI
              </Text>
              <View style={{ backgroundColor: '#FEF2F2' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                <Feather name="alert-circle" size={13} color="#DC2626" />
              </View>
            </View>
            <Text style={{ color: '#DC2626' }} className="text-[16px] font-extrabold mt-[2px]">
              {formatVNDFull(totalDebt)}
            </Text>
            <Text className="text-[11px] text-slate-400 mt-[4px]">
              Tổng nợ từ các đợt đã kích hoạt
            </Text>
          </View>
        </View>
      </View>

      {/* DỊCH VỤ & GÓI DỊCH VỤ */}
      <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
        <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
          <View className="flex-row items-center gap-[8px]">
            <View style={{ backgroundColor: '#E0E7FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
              <Feather name="package" size={16} color="#4F46E5" />
            </View>
            <Text className="text-[14px] font-bold text-slate-800">Dịch vụ & Gói dịch vụ</Text>
          </View>
        </View>

        {/* Danh sách các gói thầu */}
        {packagesList.length > 0 && (
          <View className="gap-[12px]">
            {packagesList.map((pkg, idx) => (
              <View key={idx} className="bg-[#F0F9FF] rounded-[12px] p-[12px] border border-[#BAE6FD]">
                <View className="flex-row items-center gap-[8px] mb-[8px]">
                  <View className="w-[24px] h-[24px] rounded-[6px] bg-[#E0F2FE] justify-center items-center">
                    <Feather name="briefcase" size={14} color="#2563EB" />
                  </View>
                  <Text className="text-[14px] font-extrabold text-[#0369A1] flex-1">
                    Gói: {pkg.name}{' '}
                    {pkg.quantity > 1 ? (
                      <Text className="text-[13px] font-semibold text-[#0284C7]">x{pkg.quantity}</Text>
                    ) : null}
                  </Text>
                </View>

                {/* Định mức dịch vụ con */}
                <View className="ml-[8px] pl-[10px] border-l-[2px] border-l-[#BAE6FD] gap-[8px]">
                  <Text className="text-[10px] font-bold text-[#0284C7] uppercase tracking-[0.3px]">
                    Số lượng dưới đây là định mức cho 1 gói:
                  </Text>

                  {pkg.services.length > 0 ? (
                    pkg.services.map((s, sIdx) => (
                      <View
                        key={s.id || sIdx}
                        className="py-[6px] border-b border-b-[#E0F2FE]"
                      >
                        <View className="flex-row justify-between items-center">
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text className="text-[12px] font-semibold text-slate-800">{s.name}</Text>
                            <Text className="text-[11px] text-slate-500 mt-[1px]">
                              Định mức: {s.quantity} {s.unit} / Gói
                            </Text>
                          </View>
                          <Text className="text-[12px] font-bold text-[#0369A1]">
                            {formatNumber(s.sellingPrice)} VNĐ
                          </Text>
                        </View>
                        <ServiceJobAccordion jobs={s.jobs} mode="contract_view" />
                      </View>
                    ))
                  ) : (
                    <Text className="text-[11px] text-slate-400">
                      Chưa có dịch vụ thành phần trong gói.
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Danh sách Dịch vụ lẻ */}
        {standaloneList.length > 0 && (
          <View className="mt-[14px] gap-[6px]">
            <Text className="text-[12px] font-bold text-slate-500 mb-[8px] uppercase tracking-[0.5px]">
              Dịch vụ lẻ
            </Text>
            {standaloneList.map((s, idx) => (
              <View
                key={s.id || idx}
                className="bg-slate-50 rounded-[10px] p-[10px] border border-slate-200 mb-[6px]"
              >
                <View className="flex-row justify-between items-center">
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text className="text-[13px] font-semibold text-slate-800">{s.name}</Text>
                    <Text className="text-[11px] text-slate-500 mt-[1px]">
                      Số lượng: {s.quantity} {s.unit}
                    </Text>
                  </View>
                  <Text className="text-[13px] font-bold text-emerald-600">
                    {formatNumber(s.sellingPrice)} VNĐ
                  </Text>
                </View>
                <ServiceJobAccordion jobs={s.jobs} mode="contract_view" />
              </View>
            ))}
          </View>
        )}

        {packagesList.length === 0 && standaloneList.length === 0 && (
          <View className="p-[24px] items-center justify-center gap-[8px]">
            <Feather name="layers" size={24} color="#CBD5E1" />
            <Text className="text-[12px] text-slate-400 text-center">
              Chưa có dịch vụ hoặc gói nào được chọn.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
