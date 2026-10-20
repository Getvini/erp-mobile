import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ContractItem, ContractStatus } from '@/services/contractService';
import { DocumentCard } from '@/components/common/DocumentCard';

interface ContractFilesSectionProps {
  contract: ContractItem;
  isLocked: boolean;
  isAdminOrBod: boolean;
  actionLoading: boolean;
  isUploadingProposal: boolean;
  isUploadingSigned: boolean;
  uploadProgress: number;
  onOpenPreview: (url: string, fileName?: string) => void;
  onApproveProposal: () => void;
  onOpenRejectModal: () => void;
  onOpenUploadProposal: () => void;
  onUploadSignedFile: () => void;
}

export const ContractFilesSection: React.FC<ContractFilesSectionProps> = ({
  contract,
  isLocked,
  isAdminOrBod,
  actionLoading,
  isUploadingProposal,
  isUploadingSigned,
  uploadProgress,
  onOpenPreview,
  onApproveProposal,
  onOpenRejectModal,
  onOpenUploadProposal,
  onUploadSignedFile,
}) => {
  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-100 shadow-sm">
      <View className="flex-row items-center justify-between mb-[12px] border-b border-b-slate-50 pb-[8px]">
        <View className="flex-row items-center gap-[8px]">
          <View style={{ backgroundColor: '#F3E8FF' }} className="w-[28px] h-[28px] rounded-[7px] items-center justify-center">
            <Feather name="file-text" size={16} color="#9333EA" />
          </View>
          <Text className="text-[14px] font-bold text-slate-800">Quản lý hợp đồng</Text>
        </View>
      </View>

      <View className="gap-[12px]">
        {/* Box 1: Hợp đồng dự thảo (Proposal) */}
        <View className="bg-white border border-slate-200 rounded-[12px] p-[14px]">
          {/* Title row */}
          <View className="flex-row items-center gap-[10px] mb-[12px]">
            <View style={{ backgroundColor: '#F3E8FF' }} className="w-[36px] h-[36px] rounded-[9px] items-center justify-center">
              <Feather name="file-text" size={18} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-[14px] font-bold text-slate-900">
                Hợp đồng dự thảo
              </Text>
              <Text className="text-[12px] text-slate-500 mt-[2px]">
                {contract.proposal_contract
                  ? '✓ Đã upload · .docx / Excel / link'
                  : 'Chưa có file · .docx, Excel hoặc link'}
              </Text>
            </View>
          </View>

          {/* Action buttons row */}
          <View className="flex-row gap-[8px]">
            {contract.proposal_contract ? (
              <>
                {/* Nút Xem */}
                <TouchableOpacity
                  onPress={() => onOpenPreview(contract.proposal_contract!, 'Hợp đồng dự thảo')}
                  activeOpacity={0.7}
                  className="flex-1 flex-row items-center justify-center gap-[5px] py-[9px] bg-slate-100 rounded-[8px] border border-slate-200"
                >
                  <Feather name="eye" size={14} color="#334155" />
                  <Text className="text-[12px] font-bold text-slate-700">Xem</Text>
                </TouchableOpacity>

                {/* Nút Duyệt + Từ chối (chỉ hiện khi PROPOSAL_UPLOADED và là BOD/Admin, chưa khóa) */}
                {!isLocked && contract.status === ContractStatus.PROPOSAL_UPLOADED && isAdminOrBod && (
                  <>
                    <TouchableOpacity
                      onPress={onApproveProposal}
                      disabled={actionLoading || isUploadingProposal || isUploadingSigned}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-[5px] py-[9px] bg-[#16A34A] rounded-[8px]"
                    >
                      <Feather name="check-circle" size={14} color="#FFFFFF" />
                      <Text className="text-[12px] font-bold text-white">Duyệt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onOpenRejectModal}
                      disabled={actionLoading || isUploadingProposal || isUploadingSigned}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-[4px] py-[9px] bg-red-50 border border-red-200 rounded-[8px]"
                    >
                      <Feather name="x" size={14} color="#DC2626" />
                      <Text className="text-[12px] font-bold text-red-600">Từ chối</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Nút Upload bản mới khi bị từ chối (ẩn khi hợp đồng đã khóa) */}
                {!isLocked && contract.status === ContractStatus.PROPOSAL_REJECTED && (
                  <TouchableOpacity
                    onPress={onOpenUploadProposal}
                    disabled={isUploadingProposal || isUploadingSigned}
                    activeOpacity={0.7}
                    className="flex-1 flex-row items-center justify-center gap-[5px] py-[9px] bg-blue-600 rounded-[8px]"
                  >
                    {isUploadingProposal ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="upload" size={14} color="#FFFFFF" />
                    )}
                    <Text className="text-[12px] font-bold text-white">Upload mới</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : isLocked ? (
              /* Hợp đồng đã ký duyệt → KHÓA upload proposal */
              <View className="flex-1 flex-row items-center gap-[6px] bg-slate-50 border border-slate-200 rounded-[8px] px-[10px] py-[9px]">
                <Feather name="lock" size={13} color="#94A3B8" />
                <Text className="text-[11px] font-bold text-slate-500">
                  Đã khóa (hợp đồng đã ký)
                </Text>
              </View>
            ) : (
              /* Chưa có file → chỉ nút Upload */
              <TouchableOpacity
                onPress={onOpenUploadProposal}
                disabled={isUploadingProposal || isUploadingSigned}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-center gap-[5px] py-[9px] bg-blue-600 rounded-[8px]"
              >
                {isUploadingProposal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="upload" size={14} color="#FFFFFF" />
                )}
                <Text className="text-[12px] font-bold text-white">Upload hợp đồng</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quotation link if exists */}
          {contract.quotation_link ? (
            <View className="mt-[10px] pt-[8px] border-t border-t-slate-100">
              <DocumentCard
                url={contract.quotation_link}
                fileName="Báo giá hợp đồng"
                onPreview={onOpenPreview}
              />
            </View>
          ) : null}

          {/* Rejection callout box if PROPOSAL_REJECTED */}
          {contract.status === ContractStatus.PROPOSAL_REJECTED &&
            (contract.rejectReason || (contract as any).rejectionReason) && (
              <View className="mt-[10px] p-[10px] bg-red-50 border border-red-100 rounded-[8px]">
                <Text className="text-[10px] font-extrabold text-[#991B1B] uppercase tracking-[0.5px] mb-[4px]">
                  LÝ DO TỪ CHỐI HIỆN TẠI:
                </Text>
                <Text className="text-[12px] text-red-700 leading-[16px]">
                  {contract.rejectReason || (contract as any).rejectionReason}
                </Text>
              </View>
            )}

          {/* Progress bar if uploading proposal */}
          {isUploadingProposal && (
            <View className="mt-[10px] pt-[8px] border-t border-t-slate-100">
              <View className="flex-row justify-between items-center mb-[4px]">
                <Text className="text-[11px] font-bold text-blue-600 uppercase">
                  Đang tải lên hợp đồng...
                </Text>
                <Text className="text-[11px] font-extrabold text-blue-600">{uploadProgress}%</Text>
              </View>
              <View className="h-[6px] bg-blue-50 rounded-[99px] overflow-hidden border border-[#DBEAFE]">
                <View
                  style={{ width: `${uploadProgress}%` }}
                  className="h-full bg-blue-600 rounded-[99px]"
                />
              </View>
            </View>
          )}
        </View>

        {/* Box 2: Hợp đồng đã ký (Signed Contract) */}
        <View className="bg-white border border-slate-200 rounded-[12px] p-[14px]">
          <View className="flex-row items-start justify-between">
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text className="text-[14px] font-bold text-slate-900">
                Hợp đồng đã ký{' '}
                <Text className="text-[12px] font-normal text-slate-400">(.pdf)</Text>
              </Text>
              <Text className="text-[12px] text-slate-500 mt-[4px]">
                {contract.signed_contract ? 'Đã upload' : 'Chưa có file'}
              </Text>
            </View>

            <View className="flex-row items-center gap-[8px]">
              {contract.signed_contract ? (
                <View className="flex-row items-center gap-[4px] bg-emerald-50 border border-emerald-200 px-[8px] py-[4px] rounded-[6px]">
                  <Feather name="check-circle" size={12} color="#16A34A" />
                  <Text className="text-[11px] font-black text-[#15803D]">Đã ký</Text>
                </View>
              ) : null}

              {contract.signed_contract ? (
                <TouchableOpacity
                  onPress={() => onOpenPreview(contract.signed_contract!, 'Hợp đồng đã ký')}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-[5px] px-[12px] py-[7px] bg-emerald-50 rounded-[8px] border border-emerald-200"
                >
                  <Feather name="eye" size={13} color="#16A34A" />
                  <Text style={{ color: '#16A34A' }} className="text-[12px] font-semibold">
                    Xem
                  </Text>
                </TouchableOpacity>
              ) : isLocked ? null : (
                <TouchableOpacity
                  onPress={onUploadSignedFile}
                  disabled={isUploadingSigned || isUploadingProposal}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-[5px] px-[14px] py-[7px] bg-[#4F46E5] rounded-[8px]"
                >
                  {isUploadingSigned ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="upload" size={13} color="#FFFFFF" />
                  )}
                  <Text className="text-[12px] font-bold text-white">Upload</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progress bar if uploading signed contract */}
          {isUploadingSigned && (
            <View className="mt-[10px] pt-[8px] border-t border-t-slate-100">
              <View className="flex-row justify-between items-center mb-[4px]">
                <Text className="text-[11px] font-bold text-blue-600 uppercase">
                  Đang tải lên bản đã ký...
                </Text>
                <Text className="text-[11px] font-extrabold text-blue-600">{uploadProgress}%</Text>
              </View>
              <View className="h-[6px] bg-blue-50 rounded-[99px] overflow-hidden border border-[#DBEAFE]">
                <View
                  style={{ backgroundColor: '#4F46E5', width: `${uploadProgress}%` }}
                  className="h-full bg-blue-600 rounded-[99px]"
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
