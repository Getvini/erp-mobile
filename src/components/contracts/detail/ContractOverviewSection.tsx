import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ContractItem, ContractStatus } from '@/services/contractService';
import { ProjectItem, PROJECT_STATUS_CONFIG, PROJECT_STATUS_LABELS } from '@/services/projectService';
import { getProjectManagerUser, hasTeamMemberRole } from '@/utils/teamMember';

interface ContractOverviewSectionProps {
  contract: ContractItem;
  project: ProjectItem | null;
  statusConfig: {
    text: string;
    color: string;
    bg: string;
    border: string;
  };
  isAdminOrBod: boolean;
  isAssigningPm: boolean;
  onOpenPmPicker: () => void;
  formatDate: (dateStr?: string) => string;
}

export const ContractOverviewSection: React.FC<ContractOverviewSectionProps> = ({
  contract,
  project,
  statusConfig,
  isAdminOrBod,
  isAssigningPm,
  onOpenPmPicker,
  formatDate,
}) => {
  const router = useRouter();
  const contractCode = contract.contractCode || (contract as any).contract_code || '—';

  const handleCallPhone = (phone?: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Không có số điện thoại liên hệ');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View className="gap-[12px]">
      {/* STATUS & OVERVIEW CARD */}
      <View className="bg-white rounded-[16px] p-[16px] border border-slate-100 shadow-sm">
        <View className="flex-row justify-between items-center mb-[10px] gap-[8px]">
          <View className="flex-row items-center gap-[8px] flex-wrap flex-1">
            <View className="bg-slate-100 px-[8px] py-[3px] rounded-[6px] border border-slate-200">
              <Text className="text-[12px] font-bold text-slate-600">{contractCode}</Text>
            </View>

            <View
              style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
              className="px-[10px] py-[4px] rounded-[8px] border"
            >
              <Text style={{ color: statusConfig.color }} className="text-[12px] font-bold">
                {statusConfig.text}
              </Text>
            </View>
          </View>

          {contract.createdAt && (
            <Text className="text-[11px] text-slate-400">{formatDate(contract.createdAt)}</Text>
          )}
        </View>

        <Text className="text-[18px] font-extrabold text-slate-900 leading-[24px] mb-[6px]">
          {contract.name}
        </Text>

        {contract.description ? (
          <Text className="text-[13px] text-slate-600 leading-[18px] mb-[10px]">
            {contract.description}
          </Text>
        ) : null}

        {/* Alert if Proposal Rejected */}
        {contract.status === ContractStatus.PROPOSAL_REJECTED && contract.rejectReason ? (
          <View className="flex-row gap-[8px] bg-red-50 border border-red-200 rounded-[8px] p-[10px] mb-[10px]">
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text className="text-[12px] font-bold text-red-600 mb-[2px]">
                Lý do từ chối Proposal:
              </Text>
              <Text className="text-[12px] text-[#991B1B] leading-[16px]">
                {contract.rejectReason}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Opportunity Link */}
        {contract.opportunity && (
          <View className="flex-row justify-end items-center border-t border-t-slate-50 pt-[10px] mt-[4px]">
            <TouchableOpacity
              onPress={() => router.push(`/opportunities/${contract.opportunity?.id}`)}
              activeOpacity={0.7}
              className="flex-row items-center gap-[4px] bg-[#ECFEFF] px-[8px] py-[4px] rounded-[6px] border border-[#CFFAFE]"
            >
              <Feather name="external-link" size={12} color="#0891B2" />
              <Text
                className="text-[11px] font-bold text-[#0891B2]"
                style={{ flexShrink: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Cơ hội: {contract.opportunity.opportunityCode || contract.opportunity.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* THÔNG TIN HỢP ĐỒNG */}
      <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
        <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
          <View className="flex-row items-center gap-[8px]">
            <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
              <Feather name="file-text" size={16} color="#2563EB" />
            </View>
            <Text className="text-[14px] font-bold text-slate-800">Thông tin hợp đồng</Text>
          </View>
        </View>

        <View className="gap-[8px]">
          <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
            <Text className="text-[12px] text-slate-500">Mã hợp đồng</Text>
            <View className="bg-slate-50 border border-slate-200 px-[10px] py-[4px] rounded-[6px]">
              <Text selectable={true} className="text-[13px] font-extrabold text-slate-900">
                {contractCode}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
            <Text className="text-[12px] text-slate-500">Tên hợp đồng</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontWeight: '700' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
              {contract.name || '—'}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
            <Text className="text-[12px] text-slate-500">Ngày tạo</Text>
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={13} color="#64748B" />
              <Text className="text-[13px] font-semibold text-slate-800">
                {formatDate(contract.createdAt)}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
            <Text className="text-[12px] text-slate-500">Trạng thái</Text>
            <View
              style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
              className="px-[10px] py-[4px] rounded-[8px] border"
            >
              <Text style={{ color: statusConfig.color }} className="text-[12px] font-bold">
                {statusConfig.text}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* THÔNG TIN KHÁCH HÀNG */}
      <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
        <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
          <View className="flex-row items-center gap-[8px]">
            <View style={{ backgroundColor: '#EFF6FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
              <Feather name="users" size={16} color="#2563EB" />
            </View>
            <Text className="text-[14px] font-bold text-slate-800">Thông tin khách hàng</Text>
          </View>
        </View>

        {contract.customer ? (
          <View className="gap-[8px]">
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Khách hàng / Công ty</Text>
              <Text style={{ color: '#0F172A', fontWeight: '700' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                {contract.customer.name}
              </Text>
            </View>

            {contract.customer.taxId ? (
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Mã số thuế</Text>
                <Text className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                  {contract.customer.taxId}
                </Text>
              </View>
            ) : null}

            {contract.customer.phone ? (
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Số điện thoại</Text>
                <TouchableOpacity
                  onPress={() => handleCallPhone(contract.customer?.phone)}
                  className="flex-row items-center gap-[4px] bg-emerald-50 px-[8px] py-[3px] rounded-[6px]"
                >
                  <Feather name="phone-call" size={13} color="#059669" />
                  <Text className="text-[12px] font-bold text-emerald-600">
                    {contract.customer.phone}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {contract.customer.email ? (
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Email</Text>
                <Text className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                  {contract.customer.email}
                </Text>
              </View>
            ) : null}

            {contract.customer.address ? (
              <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
                <Text className="text-[12px] text-slate-500">Địa chỉ</Text>
                <Text style={{ flex: 1, textAlign: 'right' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                  {contract.customer.address}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text className="text-[12px] text-slate-400 text-center py-[12px]">
            Chưa có thông tin khách hàng gắn với hợp đồng
          </Text>
        )}
      </View>

      {/* DỰ ÁN CỦA HỢP ĐỒNG */}
      {project ? (
        <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
            <View className="flex-row items-center gap-[8px]">
              <View style={{ backgroundColor: '#EEF2FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
                <Feather name="briefcase" size={16} color="#4F46E5" />
              </View>
              <Text className="text-[14px] font-bold text-slate-800">Dự án của hợp đồng</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push(`/projects/${project.id}` as any)}
              activeOpacity={0.7}
              className="flex-row items-center gap-[4px] bg-blue-50 px-[10px] py-[5px] rounded-[6px] border border-blue-200"
            >
              <Feather name="external-link" size={13} color="#2563EB" />
              <Text className="text-[12px] font-semibold text-blue-600">Xem dự án</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-[8px]">
            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Tên dự án</Text>
              <Text
                style={{ flex: 1, textAlign: 'right', fontWeight: '700', color: '#1E1B4B' }}
                className="text-[13px] font-semibold text-slate-800 flex-1 text-right"
              >
                {project.name}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Trạng thái dự án</Text>
              {(() => {
                const projStatusConfig = PROJECT_STATUS_CONFIG[project.status] || {
                  text: PROJECT_STATUS_LABELS[project.status] || project.status || 'Đang thực hiện',
                  color: '#047857',
                  bg: '#ECFDF5',
                  border: '#A7F3D0',
                };
                return (
                  <View
                    style={{ backgroundColor: projStatusConfig.bg, borderColor: projStatusConfig.border }}
                    className="px-[10px] py-[4px] rounded-[8px] border"
                  >
                    <Text style={{ color: projStatusConfig.color }} className="text-[12px] font-bold">
                      {projStatusConfig.text}
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">PM phụ trách</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 }}>
                {(() => {
                  const pmUser = getProjectManagerUser(project);
                  const hasPm = !!pmUser;
                  const pmName = pmUser?.fullName || 'Chưa phân công PM';
                  return (
                    <>
                      <Text
                        style={{ flex: 0, fontWeight: '700', color: hasPm ? '#0F172A' : '#94A3B8' }}
                        className="text-[13px] font-semibold text-slate-800 flex-1 text-right"
                      >
                        {pmName}
                      </Text>

                      {isAdminOrBod && (
                        <TouchableOpacity
                          onPress={onOpenPmPicker}
                          disabled={isAssigningPm}
                          activeOpacity={0.7}
                          className="flex-row items-center gap-[4px] bg-orange-100 border border-[#F38820] px-[8px] py-[3px] rounded-[6px]"
                        >
                          <Feather name="user-plus" size={12} color="#F38820" />
                          <Text className="text-[11px] font-bold text-[#F38820]">
                            {hasPm ? 'Đổi PM' : 'Phân công'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>
            </View>

            <View className="flex-row justify-between items-center py-[4px] gap-[10px]">
              <Text className="text-[12px] text-slate-500">Account</Text>
              <Text style={{ fontWeight: '600' }} className="text-[13px] font-semibold text-slate-800 flex-1 text-right">
                {project.team?.teamLead?.fullName ||
                  project.team?.members?.find((m: any) => hasTeamMemberRole(m, 'LEAD'))?.user?.fullName ||
                  'PM chưa chọn account'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};
