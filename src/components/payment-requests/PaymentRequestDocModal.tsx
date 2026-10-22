import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { readMoneyToWords } from '@/utils/numberToWordsVi';
import {
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';
import {
  formatDocFileName,
  getPositionByRole,
  getDepartmentByRole,
} from '@/utils/paymentRequestHelper';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { ProductionDocItem } from '@/components/payment-requests/ProductionDocumentPicker';

export interface DocTemplateData {
  voucherNo: string;
  requestDate: string;
  requesterName: string;
  position: string;
  department: string;
  amount: number;
  amountInWords: string;
  reason: string;
  dueDate: string;
  projectName: string;
}

export interface PaymentRequestDocModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyDoc: (docItem: ProductionDocItem, syncData?: { amount: number; reason: string; dueDate: string }) => void;
  currentUser?: { fullName?: string; role?: string } | null;
  initialAmount?: number;
  initialReason?: string;
  initialDueDate?: string;
  projectName?: string;
  requestType?: string;
}

export const PaymentRequestDocModal: React.FC<PaymentRequestDocModalProps> = ({
  visible,
  onClose,
  onApplyDoc,
  currentUser,
  initialAmount = 0,
  initialReason = '',
  initialDueDate = '',
  projectName = '',
  requestType = 'PROJECT',
}) => {
  const [voucherNo, setVoucherNo] = useState('01');
  const [requestDate, setRequestDate] = useState(() => formatDateToDDMMYYYY(new Date()));
  const [requesterName, setRequesterName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [reason, setReason] = useState('');
  const [dueDateIso, setDueDateIso] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Khởi tạo và đồng bộ dữ liệu ban đầu khi mở modal
  useEffect(() => {
    if (visible) {
      setRequesterName(currentUser?.fullName || '');
      setPosition(getPositionByRole(currentUser?.role));
      setDepartment(getDepartmentByRole(currentUser?.role));
      setVoucherNo('01');
      setRequestDate(formatDateToDDMMYYYY(new Date()));

      if (initialAmount > 0) {
        setAmountRaw(formatNumberInput(String(initialAmount)));
      } else {
        setAmountRaw('');
      }

      setReason(initialReason || '');
      setDueDateIso(initialDueDate || formatDateToYYYYMMDD(new Date(Date.now() + 7 * 86400000)));
    }
  }, [visible, currentUser, initialAmount, initialReason, initialDueDate]);

  const numAmount = parseNumberInput(amountRaw) || 0;
  const amountInWords = numAmount > 0 ? readMoneyToWords(numAmount) : 'Không đồng';

  const handleApply = () => {
    if (!requesterName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên người đề nghị');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do / nội dung đề nghị thanh toán');
      return;
    }

    if (numAmount <= 0) {
      Alert.alert('Thiếu số tiền', 'Vui lòng nhập số tiền thanh toán lớn hơn 0 VNĐ');
      return;
    }

    const { standardName, safeUploadName } = formatDocFileName({
      fileName: 'DNTT-GETVINI.docx',
      docType: 'PAYMENT_REQUEST_DOC',
      projectName,
      requestType,
    });

    const docData: DocTemplateData = {
      voucherNo: voucherNo.trim() || '01',
      requestDate: requestDate.trim(),
      requesterName: requesterName.trim(),
      position: position.trim() || 'Nhân viên',
      department: department.trim() || 'Dự án',
      amount: numAmount,
      amountInWords,
      reason: reason.trim(),
      dueDate: dueDateIso ? formatDateToDDMMYYYY(dueDateIso) : requestDate,
      projectName: projectName || (requestType === 'OTHER_WORK' ? 'CongViecKhac' : 'GETVINI'),
    };

    const docItem: ProductionDocItem = {
      id: `doc_template_${Date.now()}`,
      uri: '', // File do Backend tự sinh từ template Word
      name: safeUploadName,
      standardName,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docType: 'PAYMENT_REQUEST_DOC',
      isGeneratedDoc: true,
      docData,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    onApplyDoc(docItem, {
      amount: numAmount,
      reason: reason.trim(),
      dueDate: dueDateIso,
    });

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            maxHeight: '90%',
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFF7ED',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#F38820',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="file-text" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>
                  Lập Giấy Đề Nghị Thanh Toán
                </Text>
                <Text style={{ fontSize: 11, color: '#C2410C' }}>
                  Mẫu chuẩn Word Getvini • Tự động sinh file khi gửi
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form ScrollView */}
          <ScrollView
            style={{ paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* STT & Ngày đề nghị */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 80 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Số phiếu
                </Text>
                <TextInput
                  value={voucherNo}
                  onChangeText={setVoucherNo}
                  placeholder="01"
                  keyboardType="numeric"
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    fontSize: 13,
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                    textAlign: 'center',
                    fontWeight: '700',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Ngày đề nghị
                </Text>
                <TextInput
                  value={requestDate}
                  onChangeText={setRequestDate}
                  placeholder="DD/MM/YYYY"
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 13,
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                  }}
                />
              </View>
            </View>

            {/* Họ tên người đề nghị */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                Họ và tên người đề nghị <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                value={requesterName}
                onChangeText={setRequesterName}
                placeholder="Nhập họ và tên..."
                style={{
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>

            {/* Chức vụ & Bộ phận */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Chức danh
                </Text>
                <TextInput
                  value={position}
                  onChangeText={setPosition}
                  placeholder="Nhân viên / Quản lý..."
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 13,
                    color: '#0F172A',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Phòng ban / Bộ phận
                </Text>
                <TextInput
                  value={department}
                  onChangeText={setDepartment}
                  placeholder="Phòng dự án / Kinh doanh..."
                  style={{
                    height: 42,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 13,
                    color: '#0F172A',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            </View>

            {/* Dự án liên quan */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                Dự án áp dụng
              </Text>
              <View
                style={{
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor: '#F1F5F9',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }} numberOfLines={1}>
                  {projectName || (requestType === 'OTHER_WORK' ? 'Công việc khác' : 'Chưa chọn dự án')}
                </Text>
              </View>
            </View>

            {/* Số tiền thanh toán */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                Số tiền đề nghị (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 44,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <TextInput
                  value={amountRaw}
                  onChangeText={(val) => setAmountRaw(formatNumberInput(val))}
                  keyboardType="numeric"
                  placeholder="0"
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#F38820',
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>VNĐ</Text>
              </View>

              {/* Số tiền viết bằng chữ */}
              <View
                style={{
                  marginTop: 6,
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FDBA74',
                }}
              >
                <Text style={{ fontSize: 11, color: '#C2410C', fontWeight: '500' }}>
                  Bằng chữ: <Text style={{ fontStyle: 'italic', fontWeight: '700' }}>{amountInWords}</Text>
                </Text>
              </View>
            </View>

            {/* Lý do đề nghị thanh toán */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                Lý do / Nội dung chi tiết <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Nhập lý do chi phí sản xuất, mua sắm, họ tên đối tác..."
                style={{
                  minHeight: 64,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 13,
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                  textAlignVertical: 'top',
                }}
              />
            </View>

            {/* Thời hạn thanh toán */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                Thời hạn thanh toán cần nhận
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 13, color: dueDateIso ? '#0F172A' : '#94A3B8' }}>
                  {dueDateIso ? formatDateToDDMMYYYY(dueDateIso) : 'Chọn hạn thanh toán'}
                </Text>
                <Feather name="calendar" size={16} color="#F38820" />
              </TouchableOpacity>
            </View>

            <DatePickerModal
              visible={showDatePicker}
              initialDate={dueDateIso}
              title="Chọn hạn thanh toán"
              onConfirm={(_, yyyymmdd) => {
                setDueDateIso(yyyymmdd);
                setShowDatePicker(false);
              }}
              onClose={() => setShowDatePicker(false)}
            />
          </ScrollView>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 24,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              flexDirection: 'row',
              gap: 12,
              backgroundColor: '#FFFFFF',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#CBD5E1',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={{
                flex: 2,
                height: 46,
                borderRadius: 8,
                backgroundColor: '#F38820',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                Áp Dụng Vào Đề Xuất
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
