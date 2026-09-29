import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { BrandColors } from '@/constants/colors';
import { CustomerItem } from '@/services/customerService';
import { useCustomersQuery } from '@/hooks/queries/useCustomers';
import {
  useReferralPartnerDetailQuery,
  useReferralPartnersQuery,
} from '@/hooks/queries/useReferralPartners';
import { ReferralPartnerItem } from '@/services/referralPartnerService';
import { fetchTaxInfo } from '@/utils/tax';
import { isValidEmail, isValidPhone, isValidTaxId } from '@/utils/validators';

export interface CustomerAssignData {
  customerType: 'DIRECT' | 'REFERRAL';
  customerStatus: 'EXISTING' | 'POTENTIAL';
  selectedReferralPartnerId?: string;
  selectedCustomerId?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadAddress?: string;
  leadTaxId?: string;
}

interface CustomerAssignModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CustomerAssignData) => Promise<void>;
  initialData?: {
    customerType?: 'DIRECT' | 'REFERRAL' | string;
    customerId?: string;
    customer?: { id: string; name: string; phone?: string; email?: string; address?: string; taxId?: string };
    leadName?: string;
    leadPhone?: string;
    leadEmail?: string;
    leadAddress?: string;
    leadTaxId?: string;
    referralPartnerId?: string;
  };
}

export const CustomerAssignModal: React.FC<CustomerAssignModalProps> = ({
  visible,
  onClose,
  onSave,
  initialData,
}) => {
  const { height } = useWindowDimensions();

  const [customerType, setCustomerType] = useState<'DIRECT' | 'REFERRAL'>('DIRECT');
  const [selectedReferralPartnerId, setSelectedReferralPartnerId] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<'' | 'EXISTING' | 'POTENTIAL'>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const { data: allCustomersData, isLoading: isLoadingCustomers } = useCustomersQuery();
  const allCustomers: CustomerItem[] = allCustomersData || [];

  const { data: referralPartnersData } = useReferralPartnersQuery();
  // Dùng thẳng type của module chuyên trách: `phone`/`taxId` có thể là null từ backend.
  const referralPartners: ReferralPartnerItem[] = referralPartnersData || [];

  const { data: partnerDetailData, isLoading: isLoadingPartnerDetails } =
    useReferralPartnerDetailQuery(
      customerType === 'REFERRAL' ? selectedReferralPartnerId : ''
    );
  const partnerCustomers: CustomerItem[] = (partnerDetailData?.customers as CustomerItem[]) || [];

  const [leadTaxId, setLeadTaxId] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadAddress, setLeadAddress] = useState('');
  const [isFetchingTax, setIsFetchingTax] = useState(false);
  const [autoTaxSuccess, setAutoTaxSuccess] = useState(false);

  const leadTaxIdRef = useRef<TextInput>(null);
  const leadNameRef = useRef<TextInput>(null);
  const leadPhoneRef = useRef<TextInput>(null);
  const leadEmailRef = useRef<TextInput>(null);
  const leadAddressRef = useRef<TextInput>(null);

  const [openPicker, setOpenPicker] = useState<'TYPE' | 'PARTNER' | 'STATUS' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setOpenPicker(null);
    setAutoTaxSuccess(false);

    if (initialData?.customerType === 'REFERRAL') {
      setCustomerType('REFERRAL');
    } else {
      setCustomerType('DIRECT');
    }

    if (initialData?.customerId || initialData?.customer?.id) {
      setCustomerStatus('EXISTING');
      setSelectedCustomerId(initialData?.customerId || initialData?.customer?.id || '');
    } else if (initialData?.leadName) {
      setCustomerStatus('POTENTIAL');
      setLeadName(initialData.leadName || '');
      setLeadPhone(initialData.leadPhone || '');
      setLeadEmail(initialData.leadEmail || '');
      setLeadAddress(initialData.leadAddress || '');
      setLeadTaxId(initialData.leadTaxId || '');
    } else {
      setCustomerStatus('');
      setSelectedCustomerId('');
    }

    if (initialData?.referralPartnerId) {
      setSelectedReferralPartnerId(initialData.referralPartnerId);
    } else {
      setSelectedReferralPartnerId('');
    }
  }, [visible, initialData]);

  useEffect(() => {
    const cleanTax = leadTaxId.replace(/[\s-]/g, '');
    if (visible && customerStatus === 'POTENTIAL' && (cleanTax.length === 10 || cleanTax.length === 13)) {
      setIsFetchingTax(true);
      const timer = setTimeout(async () => {
        try {
          const data = await fetchTaxInfo(cleanTax);
          if (data && data.name) {
            setLeadName(data.name);
            if (data.address) setLeadAddress(data.address);
            setAutoTaxSuccess(true);
          }
        } catch {
          // ignore
        } finally {
          setIsFetchingTax(false);
        }
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setAutoTaxSuccess(false);
    }
  }, [leadTaxId, visible, customerStatus]);

  const displayCustomers = useMemo(() => {
    return customerType === 'REFERRAL' ? partnerCustomers : allCustomers;
  }, [customerType, partnerCustomers, allCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return displayCustomers;
    const lower = customerSearch.toLowerCase();
    return displayCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.taxId && c.taxId.includes(lower)) ||
        (c.phoneNumber && c.phoneNumber.includes(lower)) ||
        (c.phone && c.phone.includes(lower))
    );
  }, [displayCustomers, customerSearch]);

  const isSaveDisabled =
    isSubmitting ||
    !customerStatus ||
    (customerStatus === 'EXISTING' && !selectedCustomerId) ||
    (customerType === 'REFERRAL' && !selectedReferralPartnerId);

  const handleSave = async () => {
    if (customerStatus === 'POTENTIAL') {
      if (!leadName.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khách hàng.');
        return;
      }

      if (leadPhone.trim() && !isValidPhone(leadPhone)) {
        Alert.alert('Lỗi', 'Số điện thoại không hợp lệ (8 - 15 chữ số).');
        return;
      }

      if (leadEmail.trim() && !isValidEmail(leadEmail)) {
        Alert.alert('Lỗi', 'Địa chỉ email không hợp lệ (Ví dụ: user@domain.com).');
        return;
      }

      if (leadTaxId.trim() && !isValidTaxId(leadTaxId)) {
        Alert.alert('Lỗi', 'Mã số thuế không hợp lệ (Phải là 10 số hoặc 13 số).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave({
        customerType,
        customerStatus: customerStatus as 'EXISTING' | 'POTENTIAL',
        selectedReferralPartnerId: customerType === 'REFERRAL' ? selectedReferralPartnerId : undefined,
        selectedCustomerId: customerStatus === 'EXISTING' ? selectedCustomerId : undefined,
        leadName: customerStatus === 'POTENTIAL' ? leadName.trim() : undefined,
        leadPhone: customerStatus === 'POTENTIAL' ? leadPhone.trim() : undefined,
        leadEmail: customerStatus === 'POTENTIAL' ? leadEmail.trim() : undefined,
        leadAddress: customerStatus === 'POTENTIAL' ? leadAddress.trim() : undefined,
        leadTaxId: customerStatus === 'POTENTIAL' ? leadTaxId.trim() : undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi lưu thông tin khách hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPartnerObj = referralPartners.find((p) => p.id === selectedReferralPartnerId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/65 justify-end">
        <View className="bg-surface rounded-t-3xl overflow-hidden" style={{ height: height * 0.82, maxHeight: height * 0.90 }}>
          {/* Header */}
          <View className="flex-row justify-between items-center px-5 py-4 border-b border-border">
            <View>
              <Text className="text-xl font-bold text-text-primary">Thêm thông tin khách hàng</Text>
              <Text className="text-xs text-text-secondary mt-0.5">Gắn khách hàng trực tiếp hoặc khách hàng liên kết</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-[34px] h-[34px] rounded-full bg-slate-100 justify-center items-center" activeOpacity={0.7}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20 }}
            enableOnAndroid={false}
            enableAutomaticScroll={Platform.OS === 'ios'}
            extraScrollHeight={Platform.OS === 'ios' ? 40 : 0}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* 1. LOẠI KHÁCH HÀNG */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-700 mb-2">Loại khách hàng:</Text>
              <TouchableOpacity
                className="flex-row items-center justify-between bg-surface border border-slate-300 rounded-xl px-3.5 py-[11px] min-h-[46px]"
                onPress={() => setOpenPicker(openPicker === 'TYPE' ? null : 'TYPE')}
                activeOpacity={0.8}
              >
                <Text className="text-sm text-text-primary font-medium flex-1">
                  {customerType === 'DIRECT' ? 'Khách hàng trực tiếp' : 'Khách hàng liên kết'}
                </Text>
                <Feather
                  name={openPicker === 'TYPE' ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>

              {openPicker === 'TYPE' && (
                <View className="mt-1.5 bg-surface rounded-xl border border-border shadow-md overflow-hidden">
                  <TouchableOpacity
                    className={`flex-row items-center justify-between px-3.5 py-3 border-b border-slate-100 ${customerType === 'DIRECT' ? 'bg-blue-50' : ''}`}
                    onPress={() => {
                      setCustomerType('DIRECT');
                      setCustomerStatus('');
                      setSelectedReferralPartnerId('');
                      setSelectedCustomerId('');
                      setOpenPicker(null);
                    }}
                  >
                    <Text className={`text-xs ${customerType === 'DIRECT' ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                      Khách hàng trực tiếp
                    </Text>
                    {customerType === 'DIRECT' && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-row items-center justify-between px-3.5 py-3 ${customerType === 'REFERRAL' ? 'bg-blue-50' : ''}`}
                    onPress={() => {
                      setCustomerType('REFERRAL');
                      setCustomerStatus('');
                      setSelectedReferralPartnerId('');
                      setSelectedCustomerId('');
                      setOpenPicker(null);
                    }}
                  >
                    <Text className={`text-xs ${customerType === 'REFERRAL' ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                      Khách hàng liên kết
                    </Text>
                    {customerType === 'REFERRAL' && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 2. ĐỐI TÁC GIỚI THIỆU */}
            {customerType === 'REFERRAL' && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-700 mb-2">
                  Đối tác giới thiệu: <Text className="text-rose-500">*</Text>
                </Text>

                <TouchableOpacity
                  className={`flex-row items-center justify-between bg-surface border rounded-xl px-3.5 py-[11px] min-h-[46px] ${!selectedReferralPartnerId ? 'border-orange-400 bg-orange-50' : 'border-slate-300'}`}
                  onPress={() => setOpenPicker(openPicker === 'PARTNER' ? null : 'PARTNER')}
                  activeOpacity={0.8}
                >
                  <Text className={`text-sm flex-1 ${!selectedReferralPartnerId ? 'text-text-muted italic' : 'text-text-primary font-medium'}`}>
                    {selectedPartnerObj
                      ? `${selectedPartnerObj.name} ${selectedPartnerObj.taxId ? `- ${selectedPartnerObj.taxId}` : ''}`
                      : 'Chọn đối tác giới thiệu'}
                  </Text>
                  <Feather
                    name={openPicker === 'PARTNER' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {!selectedReferralPartnerId && (
                  <Text className="text-xs text-orange-600 mt-[5px] italic">
                    Vui lòng chọn đối tác giới thiệu trước
                  </Text>
                )}

                {openPicker === 'PARTNER' && (
                  <View className="mt-1.5 bg-surface rounded-xl border border-border shadow-md overflow-hidden">
                    {referralPartners.length > 0 ? (
                      referralPartners.map((p) => {
                        const isSelected = selectedReferralPartnerId === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            className={`flex-row items-center justify-between px-3.5 py-3 border-b border-slate-100 ${isSelected ? 'bg-blue-50' : ''}`}
                            onPress={() => {
                              setSelectedReferralPartnerId(p.id);
                              setSelectedCustomerId('');
                              setOpenPicker(null);
                            }}
                          >
                            <Text className={`text-xs ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                              {p.name} {p.taxId ? `- ${p.taxId}` : ''}
                            </Text>
                            {isSelected && <Feather name="check" size={16} color="#2563EB" />}
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View className="p-4 items-center">
                        <Text className="text-xs text-text-muted italic text-center">Chưa có đối tác giới thiệu nào trong hệ thống.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 3. TRẠNG THÁI KHÁCH HÀNG */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-700 mb-2">Trạng thái khách hàng:</Text>
              <TouchableOpacity
                className={`flex-row items-center justify-between bg-surface border border-slate-300 rounded-xl px-3.5 py-[11px] min-h-[46px] ${customerType === 'REFERRAL' && !selectedReferralPartnerId ? 'bg-slate-100 border-slate-200' : ''}`}
                disabled={customerType === 'REFERRAL' && !selectedReferralPartnerId}
                onPress={() => setOpenPicker(openPicker === 'STATUS' ? null : 'STATUS')}
                activeOpacity={0.8}
              >
                <Text className={`text-sm flex-1 ${!customerStatus ? 'text-text-muted italic' : 'text-text-primary font-medium'}`}>
                  {customerStatus === 'POTENTIAL'
                    ? 'Khách hàng tiềm năng'
                    : customerStatus === 'EXISTING'
                    ? 'Khách hàng hiện hữu'
                    : 'Chọn trạng thái'}
                </Text>
                <Feather
                  name={openPicker === 'STATUS' ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={customerType === 'REFERRAL' && !selectedReferralPartnerId ? '#CBD5E1' : '#64748B'}
                />
              </TouchableOpacity>

              {openPicker === 'STATUS' && (
                <View className="mt-1.5 bg-surface rounded-xl border border-border shadow-md overflow-hidden">
                  <TouchableOpacity
                    className={`flex-row items-center justify-between px-3.5 py-3 border-b border-slate-100 ${customerStatus === 'POTENTIAL' ? 'bg-blue-50' : ''}`}
                    onPress={() => {
                      setCustomerStatus('POTENTIAL');
                      setSelectedCustomerId('');
                      setOpenPicker(null);
                    }}
                  >
                    <Text className={`text-xs ${customerStatus === 'POTENTIAL' ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                      Khách hàng tiềm năng
                    </Text>
                    {customerStatus === 'POTENTIAL' && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-row items-center justify-between px-3.5 py-3 ${customerStatus === 'EXISTING' ? 'bg-blue-50' : ''}`}
                    onPress={() => {
                      setCustomerStatus('EXISTING');
                      setOpenPicker(null);
                    }}
                  >
                    <Text className={`text-xs ${customerStatus === 'EXISTING' ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                      Khách hàng hiện hữu
                    </Text>
                    {customerStatus === 'EXISTING' && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* KHÁCH HÀNG HIỆN HỮU */}
            {customerStatus === 'EXISTING' && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-700 mb-2">
                  Chọn khách hàng hiện hữu: <Text className="text-rose-500">*</Text>
                </Text>

                {isLoadingCustomers || isLoadingPartnerDetails ? (
                  <View className="py-5 items-center gap-1.5">
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                    <Text className="text-xs text-text-secondary">Đang tải danh sách khách hàng...</Text>
                  </View>
                ) : displayCustomers.length === 0 ? (
                  <View className="flex-row items-center bg-rose-50 border border-rose-300 rounded-xl px-3.5 py-3 gap-2 mt-1">
                    <Feather name="alert-circle" size={16} color="#DC2626" />
                    <Text className="text-xs font-semibold text-rose-600 flex-1">
                      {customerType === 'REFERRAL'
                        ? 'Đối tác này chưa có khách hàng liên kết nào.'
                        : 'Không có khách hàng hiện hữu nào trong hệ thống.'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center bg-background rounded-xl border border-border px-3 h-[42px] mb-2.5 gap-2">
                      <Feather name="search" size={16} color="#94A3B8" />
                      <TextInput
                        className="flex-1 text-xs text-text-primary"
                        placeholder="Tìm theo tên công ty, MST, SĐT..."
                        placeholderTextColor="#94A3B8"
                        value={customerSearch}
                        onChangeText={setCustomerSearch}
                      />
                      {customerSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setCustomerSearch('')}>
                          <Feather name="x" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <ScrollView className="max-h-[220px]" contentContainerStyle={{ gap: 6, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                      {filteredCustomers.slice(0, 30).map((c) => {
                        const isSelected = selectedCustomerId === c.id;
                        const displayPhone = c.phoneNumber || c.phone;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            className={`flex-row items-center p-3 rounded-xl bg-background border gap-2.5 ${isSelected ? 'bg-blue-50 border-blue-500' : 'border-border'}`}
                            onPress={() => setSelectedCustomerId(c.id)}
                            activeOpacity={0.8}
                          >
                            <View className={`w-[18px] h-[18px] rounded-full border-[1.5px] border-slate-400 justify-center items-center ${isSelected ? 'border-blue-600' : ''}`}>
                              {isSelected && <View className="w-[9px] h-[9px] rounded-full bg-blue-600" />}
                            </View>
                            <View className="flex-1">
                              <Text className={`text-xs font-semibold ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'}`} numberOfLines={1}>
                                {c.name}
                              </Text>
                              <View className="flex-row items-center gap-2 mt-[3px]">
                                {c.taxId ? <Text className="text-[11px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-px rounded">MST: {c.taxId}</Text> : null}
                                {displayPhone ? <Text className="text-[11px] text-text-secondary">SĐT: {displayPhone}</Text> : null}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {displayCustomers.length > 0 && filteredCustomers.length === 0 && (
                        <View className="py-6 items-center gap-1.5">
                          <Feather name="inbox" size={20} color="#CBD5E1" />
                          <Text className="text-xs text-text-muted text-center italic">Không tìm thấy khách hàng nào phù hợp với từ khóa.</Text>
                        </View>
                      )}
                    </ScrollView>
                  </>
                )}
              </View>
            )}

            {/* KHÁCH HÀNG TIỀM NĂNG */}
            {customerStatus === 'POTENTIAL' && (
              <View className="gap-0.5">
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs font-semibold text-slate-700">Mã số thuế:</Text>
                    {isFetchingTax && (
                      <View className="flex-row items-center gap-1">
                        <ActivityIndicator size="small" color="#2563EB" />
                        <Text className="text-[11px] text-blue-600 italic">Đang tra cứu thuế...</Text>
                      </View>
                    )}
                    {autoTaxSuccess && !isFetchingTax && (
                      <View className="flex-row items-center gap-1 bg-emerald-50 px-1.5 py-px rounded">
                        <Feather name="check" size={12} color="#059669" />
                        <Text className="text-[11px] text-emerald-600 font-semibold">Đã tự động điền</Text>
                      </View>
                    )}
                  </View>

                  <TextInput
                    ref={leadTaxIdRef}
                    className="bg-surface rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-text-primary"
                    placeholder="Nhập mã số thuế (10 hoặc 13 số)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    returnKeyType="next"
                    onSubmitEditing={() => leadNameRef.current?.focus()}
                    blurOnSubmit={false}
                    value={leadTaxId}
                    onChangeText={setLeadTaxId}
                  />
                  <Text className="text-[11px] text-text-muted mt-1 italic">
                    Hệ thống sẽ tự động tra cứu tên và địa chỉ công ty sau khi gõ đủ MST.
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-700 mb-2">
                    Tên khách hàng: <Text className="text-rose-500">*</Text>
                  </Text>
                  <TextInput
                    ref={leadNameRef}
                    className={`bg-surface rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-text-primary ${isFetchingTax ? 'bg-slate-100' : ''}`}
                    placeholder={isFetchingTax ? 'Đang tải tên doanh nghiệp...' : 'Nhập tên khách hàng'}
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    onSubmitEditing={() => leadPhoneRef.current?.focus()}
                    blurOnSubmit={false}
                    value={leadName}
                    onChangeText={setLeadName}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-700 mb-2">Điện thoại:</Text>
                  <TextInput
                    ref={leadPhoneRef}
                    className="bg-surface rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-text-primary"
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => leadEmailRef.current?.focus()}
                    blurOnSubmit={false}
                    value={leadPhone}
                    onChangeText={setLeadPhone}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-700 mb-2">Email:</Text>
                  <TextInput
                    ref={leadEmailRef}
                    className="bg-surface rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-text-primary"
                    placeholder="Nhập email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => leadAddressRef.current?.focus()}
                    blurOnSubmit={false}
                    value={leadEmail}
                    onChangeText={setLeadEmail}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-700 mb-2">Địa chỉ:</Text>
                  <TextInput
                    ref={leadAddressRef}
                    className="bg-surface rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-text-primary min-h-[64px]"
                    placeholder="Nhập địa chỉ"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    returnKeyType="done"
                    value={leadAddress}
                    onChangeText={setLeadAddress}
                  />
                </View>
              </View>
            )}

            <View className="h-6" />
          </KeyboardAwareScrollView>

          {/* Footer Actions */}
          <View className="flex-row p-4 border-t border-border gap-2.5 bg-surface">
            <TouchableOpacity
              className={`flex-1 bg-blue-600 py-3 rounded-xl items-center justify-center ${isSaveDisabled ? 'bg-blue-300 opacity-60' : ''}`}
              onPress={handleSave}
              disabled={isSaveDisabled}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-bold text-white">Lưu</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity className="py-3 px-5 rounded-xl bg-slate-100 items-center justify-center" onPress={onClose} activeOpacity={0.8}>
              <Text className="text-sm font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
