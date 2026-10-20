import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PickedFile } from '@/services/cloudinaryService';
import { UserPMItem } from '@/services/projectService';

// ==========================================
// 1. REJECT PROPOSAL MODAL
// ==========================================
interface RejectProposalModalProps {
  visible: boolean;
  rejectReason: string;
  actionLoading: boolean;
  onClose: () => void;
  onChangeReason: (val: string) => void;
  onSubmit: () => void;
}

export const RejectProposalModal: React.FC<RejectProposalModalProps> = ({
  visible,
  rejectReason,
  actionLoading,
  onClose,
  onChangeReason,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
        <View className="bg-white rounded-[16px] w-full max-w-[400px] p-[20px] shadow-lg">
          <View className="flex-row justify-between items-center mb-[8px]">
            <Text className="text-[16px] font-extrabold text-slate-800">Từ chối Proposal</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text className="text-[12px] text-slate-500 leading-[16px] mb-[12px]">
            Vui lòng nêu rõ lý do từ chối để nhân viên cập nhật lại bản dự thảo hợp đồng:
          </Text>

          <TextInput
            value={rejectReason}
            onChangeText={onChangeReason}
            placeholder="Nhập lý do từ chối (ví dụ: điều khoản thanh toán chưa phù hợp...)"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-slate-50 border border-slate-300 rounded-[10px] p-[12px] text-[13px] text-slate-900 min-h-[90px] mb-[16px]"
          />

          <View className="flex-row justify-end gap-[10px]">
            <TouchableOpacity onPress={onClose} className="px-[14px] py-[8px] rounded-[8px] bg-slate-100">
              <Text className="text-[13px] font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSubmit}
              disabled={actionLoading}
              className="px-[16px] py-[8px] rounded-[8px] bg-red-600"
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[13px] font-bold text-white">Xác nhận từ chối</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ==========================================
// 2. UPLOAD PROPOSAL MODAL
// ==========================================
interface UploadProposalModalProps {
  visible: boolean;
  uploadMethod: 'FILE' | 'LINK';
  proposalFile: PickedFile | null;
  proposalLink: string;
  quotationMethod: 'NONE' | 'LINK' | 'FILE';
  quotationFile: PickedFile | null;
  quotationLink: string;
  isUploading: boolean;
  uploadProgress: number;
  onClose: () => void;
  onSetUploadMethod: (method: 'FILE' | 'LINK') => void;
  onPickProposalFile: () => void;
  onSetProposalLink: (val: string) => void;
  onSetQuotationMethod: (method: 'NONE' | 'LINK' | 'FILE') => void;
  onPickQuotationFile: () => void;
  onSetQuotationLink: (val: string) => void;
  onSubmit: () => void;
}

export const UploadProposalModal: React.FC<UploadProposalModalProps> = ({
  visible,
  uploadMethod,
  proposalFile,
  proposalLink,
  quotationMethod,
  quotationFile,
  quotationLink,
  isUploading,
  uploadProgress,
  onClose,
  onSetUploadMethod,
  onPickProposalFile,
  onSetProposalLink,
  onSetQuotationMethod,
  onPickQuotationFile,
  onSetQuotationLink,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!isUploading) onClose();
      }}
    >
      <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
        <View className="bg-white rounded-[16px] w-full max-w-[480px] p-[20px] shadow-lg max-h-[85%]">
          <View className="flex-row justify-between items-center mb-[8px]">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-[22px] h-[22px] rounded-[6px] items-center justify-center">
                <Feather name="upload-cloud" size={16} color="#2563EB" />
              </View>
              <Text className="text-[16px] font-extrabold text-slate-800">
                Cập nhật Proposal hợp đồng
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!isUploading) onClose();
              }}
              disabled={isUploading}
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {/* Section 1: Phương thức tải Hợp đồng */}
            <Text className="text-[13px] font-bold text-slate-700 mb-[8px]">
              1. Chọn hình thức upload hợp đồng
            </Text>
            <View className="flex-row gap-[10px] mb-[10px]">
              <TouchableOpacity
                onPress={() => onSetUploadMethod('FILE')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white ${
                  uploadMethod === 'FILE' ? 'border-[#3B82F6] bg-blue-50' : ''
                }`}
              >
                <Feather
                  name="upload"
                  size={16}
                  color={uploadMethod === 'FILE' ? '#2563EB' : '#64748B'}
                />
                <Text
                  className={`text-[12px] font-semibold text-slate-600 ${
                    uploadMethod === 'FILE' ? 'text-[#1D4ED8] font-bold' : ''
                  }`}
                >
                  Tải file Word/Excel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSetUploadMethod('LINK')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white ${
                  uploadMethod === 'LINK' ? 'border-[#3B82F6] bg-blue-50' : ''
                }`}
              >
                <Feather
                  name="link-2"
                  size={16}
                  color={uploadMethod === 'LINK' ? '#2563EB' : '#64748B'}
                />
                <Text
                  className={`text-[12px] font-semibold text-slate-600 ${
                    uploadMethod === 'LINK' ? 'text-[#1D4ED8] font-bold' : ''
                  }`}
                >
                  Nhập link hợp đồng
                </Text>
              </TouchableOpacity>
            </View>

            {uploadMethod === 'FILE' && (
              <View className="mb-[8px]">
                <Text className="text-[12px] font-medium text-slate-500 mb-[6px]">
                  File hợp đồng (.docx, .xls, .xlsx)
                </Text>
                {proposalFile ? (
                  <View className="flex-row items-center justify-between bg-blue-50 border border-blue-200 rounded-[8px] p-[10px]">
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text numberOfLines={1} className="text-[12px] font-bold text-[#1E40AF]">
                        {proposalFile.name}
                      </Text>
                      <Text className="text-[11px] text-[#3B82F6] mt-[2px]">
                        {proposalFile.size
                          ? `${(proposalFile.size / 1024).toFixed(1)} KB`
                          : 'Đã sẵn sàng tải lên'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={onPickProposalFile}
                      disabled={isUploading}
                      className="px-[10px] py-[5px] bg-white border border-[#93C5FD] rounded-[6px]"
                    >
                      <Text className="text-[11px] font-semibold text-blue-600">Đổi file</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={onPickProposalFile}
                    disabled={isUploading}
                    activeOpacity={0.7}
                    className="border-[1.5px] border-dashed border-[#93C5FD] bg-slate-50 rounded-[10px] p-[14px] items-center justify-center gap-[4px]"
                  >
                    <Feather name="file-plus" size={20} color="#2563EB" />
                    <Text className="text-[13px] font-semibold text-blue-600">
                      Bấm để chọn file từ thiết bị
                    </Text>
                    <Text className="text-[11px] text-slate-400">
                      Hỗ trợ định dạng .docx, .xls, .xlsx
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {uploadMethod === 'LINK' && (
              <View className="mb-[8px]">
                <Text className="text-[12px] font-medium text-slate-500 mb-[6px]">
                  Link hợp đồng (Google Docs, Drive...)
                </Text>
                <TextInput
                  value={proposalLink}
                  onChangeText={onSetProposalLink}
                  placeholder="https://docs.google.com/..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  className="bg-white border border-slate-300 rounded-[8px] px-[12px] py-[10px] text-[13px] text-slate-900"
                />
              </View>
            )}

            {/* Section 2: Báo giá (nếu có) */}
            <Text style={{ marginTop: 16 }} className="text-[13px] font-bold text-slate-700 mb-[8px]">
              2. Báo giá (nếu có)
            </Text>
            <View className="flex-row gap-[10px] mb-[10px]">
              <TouchableOpacity
                onPress={() => onSetQuotationMethod(quotationMethod === 'LINK' ? 'NONE' : 'LINK')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white ${
                  quotationMethod === 'LINK' ? 'border-[#3B82F6] bg-blue-50' : ''
                }`}
              >
                <Feather
                  name="link-2"
                  size={16}
                  color={quotationMethod === 'LINK' ? '#2563EB' : '#64748B'}
                />
                <Text
                  className={`text-[12px] font-semibold text-slate-600 ${
                    quotationMethod === 'LINK' ? 'text-[#1D4ED8] font-bold' : ''
                  }`}
                >
                  Nhập link báo giá
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSetQuotationMethod(quotationMethod === 'FILE' ? 'NONE' : 'FILE')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center gap-[8px] p-[10px] border border-slate-200 rounded-[10px] bg-white ${
                  quotationMethod === 'FILE' ? 'border-[#3B82F6] bg-blue-50' : ''
                }`}
              >
                <Feather
                  name="file-text"
                  size={16}
                  color={quotationMethod === 'FILE' ? '#2563EB' : '#64748B'}
                />
                <Text
                  className={`text-[12px] font-semibold text-slate-600 ${
                    quotationMethod === 'FILE' ? 'text-[#1D4ED8] font-bold' : ''
                  }`}
                >
                  Tải file Excel
                </Text>
              </TouchableOpacity>
            </View>

            {quotationMethod === 'LINK' && (
              <View className="mb-[8px]">
                <TextInput
                  value={quotationLink}
                  onChangeText={onSetQuotationLink}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  className="bg-white border border-slate-300 rounded-[8px] px-[12px] py-[10px] text-[13px] text-slate-900"
                />
              </View>
            )}

            {quotationMethod === 'FILE' && (
              <View className="mb-[8px]">
                {quotationFile ? (
                  <View className="flex-row items-center justify-between bg-blue-50 border border-blue-200 rounded-[8px] p-[10px]">
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text numberOfLines={1} className="text-[12px] font-bold text-[#1E40AF]">
                        {quotationFile.name}
                      </Text>
                      <Text className="text-[11px] text-[#3B82F6] mt-[2px]">
                        {quotationFile.size
                          ? `${(quotationFile.size / 1024).toFixed(1)} KB`
                          : 'Đã sẵn sàng tải lên'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={onPickQuotationFile}
                      disabled={isUploading}
                      className="px-[10px] py-[5px] bg-white border border-[#93C5FD] rounded-[6px]"
                    >
                      <Text className="text-[11px] font-semibold text-blue-600">Đổi file</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={onPickQuotationFile}
                    disabled={isUploading}
                    activeOpacity={0.7}
                    className="border-[1.5px] border-dashed border-[#93C5FD] bg-slate-50 rounded-[10px] p-[14px] items-center justify-center gap-[4px]"
                  >
                    <Feather name="file-plus" size={18} color="#2563EB" />
                    <Text className="text-[13px] font-semibold text-blue-600">
                      Chọn file Excel báo giá
                    </Text>
                    <Text className="text-[11px] text-slate-400">Chỉ chấp nhận file .xls, .xlsx</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Progress bar in modal */}
            {isUploading && (
              <View style={{ marginTop: 16 }} className="mt-[10px] pt-[8px] border-t border-t-slate-100">
                <View className="flex-row justify-between items-center mb-[4px]">
                  <Text className="text-[11px] font-bold text-blue-600 uppercase">
                    Đang tải lên máy chủ Cloudinary...
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
          </ScrollView>

          <View style={{ marginTop: 16 }} className="flex-row justify-end gap-[10px]">
            <TouchableOpacity
              onPress={onClose}
              disabled={isUploading}
              className="px-[14px] py-[8px] rounded-[8px] bg-slate-100"
            >
              <Text className="text-[13px] font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                (isUploading ||
                  (uploadMethod === 'FILE' ? !proposalFile : !proposalLink.trim()))
                  ? { opacity: 0.5 }
                  : undefined
              }
              onPress={onSubmit}
              disabled={
                isUploading ||
                (uploadMethod === 'FILE' ? !proposalFile : !proposalLink.trim())
              }
              className="flex-row items-center gap-[6px] px-[16px] py-[8px] rounded-[8px] bg-blue-600"
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="check" size={16} color="#FFFFFF" />
              )}
              <Text className="text-[13px] font-bold text-white">
                {isUploading ? 'Đang lưu...' : 'Lưu'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ==========================================
// 3. ASSIGN PM MODAL
// ==========================================
interface AssignPmModalProps {
  visible: boolean;
  pmUsers: UserPMItem[];
  selectedPmId: string;
  isAssigning: boolean;
  onClose: () => void;
  onSelectPmId: (id: string) => void;
  onSubmit: (pmId: string) => void;
}

export const AssignPmModal: React.FC<AssignPmModalProps> = ({
  visible,
  pmUsers,
  selectedPmId,
  isAssigning,
  onClose,
  onSelectPmId,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[rgba(0,_0,_0,_0.5)] justify-center items-center p-[20px]">
        <View className="bg-white rounded-[16px] w-full max-w-[400px] p-[20px] shadow-lg">
          <View className="flex-row justify-between items-center mb-[8px]">
            <Text className="text-[16px] font-extrabold text-slate-800">
              Phân công PM phụ trách dự án
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text className="text-[12px] text-slate-500 leading-[16px] mb-[12px]">
            Chọn Quản lý dự án (PM) để chịu trách nhiệm triển khai hợp đồng này:
          </Text>

          <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
            {pmUsers.length > 0 ? (
              pmUsers.map((pm) => {
                const isSelected = selectedPmId === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    onPress={() => onSelectPmId(pm.id)}
                    disabled={isAssigning}
                    activeOpacity={0.7}
                    className={`flex-row items-center gap-[10px] p-[10px] rounded-[10px] border border-slate-200 mb-[8px] bg-white ${
                      isSelected ? 'border-[#F38820] bg-orange-100' : ''
                    }`}
                  >
                    <View
                      style={isSelected ? { backgroundColor: '#F38820' } : undefined}
                      className="w-[32px] h-[32px] rounded-[16px] bg-slate-100 items-center justify-center"
                    >
                      <Text
                        style={isSelected ? { color: '#FFFFFF' } : undefined}
                        className="text-[13px] font-extrabold text-slate-600"
                      >
                        {pm.fullName?.substring(0, 1).toUpperCase() || 'P'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={isSelected ? { color: '#F38820', fontWeight: '700' } : undefined}
                        className="text-[13px] font-semibold text-slate-900"
                      >
                        {pm.fullName}
                      </Text>
                      {pm.email ? (
                        <Text className="text-[11px] text-slate-500">{pm.email}</Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Feather name="check-circle" size={18} color="#F38820" />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text className="text-[12px] text-slate-400 text-center py-[12px]">
                Không tìm thấy tài khoản PM nào
              </Text>
            )}
          </ScrollView>

          <View style={{ marginTop: 16 }} className="flex-row justify-end items-center gap-[10px]">
            <TouchableOpacity
              onPress={onClose}
              className="px-[14px] py-[8px] rounded-[8px] bg-slate-100"
            >
              <Text className="text-[13px] font-semibold text-slate-600">Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onSubmit(selectedPmId)}
              disabled={!selectedPmId || isAssigning}
              className={`flex-row items-center gap-1.5 px-[16px] py-[8px] rounded-[8px] ${
                !selectedPmId || isAssigning ? 'bg-orange-200' : 'bg-orange-600'
              }`}
              activeOpacity={0.8}
            >
              {isAssigning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="user-check" size={14} color="#FFFFFF" />
                  <Text className="text-[13px] font-bold text-white">Phân công</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
