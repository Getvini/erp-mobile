import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,

  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Modal,
  useWindowDimensions,
  Keyboard } from
'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { BrandColors } from '@/constants/colors';
import { CreateOpportunityPayload } from '@/services/opportunityService';
import {
  useCreateOpportunityMutation,
  useAvailableServicesQuery,
  useOpportunityDetailQuery } from
'@/hooks/queries/useOpportunities';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';

import {
  formatNumber,
  formatVND,
  formatVNDFull,
  formatNumberInput,
  parseNumberInput,
  formatQuantity } from
'@/utils/formatters';
import { isValidUrl, normalizeUrl } from '@/utils/validators';

import {
  useOpportunityFormStore,
  AttachedFile,
  SelectedPackage,
  SelectedService,
  OpportunityFormData,
  INITIAL_OPPORTUNITY_FORM_DATA } from
'@/stores/useOpportunityFormStore';

export type { AttachedFile, SelectedPackage, SelectedService, OpportunityFormData };

export const STORAGE_DRAFT_KEY = '@erp_opportunity_draft_v3';

export const FIELDS = [
{ value: '', label: '-- Chọn lĩnh vực --' },
{ value: 'CNTT', label: 'Công nghệ thông tin' },
{ value: 'XayDung', label: 'Xây dựng' },
{ value: 'SanXuat', label: 'Sản xuất' },
{ value: 'ThuongMai', label: 'Thương mại' },
{ value: 'DichVu', label: 'Dịch vụ' },
{ value: 'GiaoDuc', label: 'Giáo dục' },
{ value: 'YTe', label: 'Y tế' },
{ value: 'Khac', label: 'Khác' }];


export const PRIORITIES = [
{ id: 'Low', label: 'Thấp', color: '#64748B' },
{ id: 'Medium', label: 'Trung bình', color: '#3B82F6' },
{ id: 'High', label: 'Cao', color: '#F97316' }];


export const PROVINCES_LIST = [
'Hà Nội',
'TP. Hồ Chí Minh',
'Đà Nẵng',
'Hải Phòng',
'Cần Thơ',
'Bình Dương',
'Đồng Nai',
'Khánh Hòa',
'Quảng Ninh',
'Bà Rịa - Vũng Tàu',
'Thừa Thiên Huế',
'Bắc Ninh',
'Hải Dương',
'Hưng Yên',
'Thái Nguyên',
'Nghệ An',
'Thanh Hóa',
'Lâm Đồng',
'Bình Định',
'Kiên Giang',
'Khác'];


export const DEFAULT_LINK_PLACEHOLDERS = [
'https://drive.google.com/... (Link tài liệu)',
'https://docs.google.com/... (Link kế hoạch)',
'https://example.com/spec.pdf (Link báo giá đối thủ)'];

// Format VND currency input with thousand separator (dots)
export const formatVNDInput = formatNumberInput;

// Parse formatted string back to number
export const parseVNDInput = parseNumberInput;

// Auto-mask DD/MM/YYYY date input
export const formatDateInputMask = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Validate if a DD/MM/YYYY string is a real calendar date
export const validateDateString = (dateStr: string): boolean => {
  if (!dateStr || dateStr.length !== 10) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  if (y < 1970 || y > 2100) return false;
  const maxDays = new Date(y, m, 0).getDate();
  return d >= 1 && d <= maxDays;
};

// Parse DD/MM/YYYY string to Date object
export const parseDateObj = (dateStr: string): Date | null => {
  if (!validateDateString(dateStr)) return null;
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
};

// Convert DD/MM/YYYY to ISO YYYY-MM-DD
export const toISODate = (ddmmyyyy: string): string | undefined => {
  if (!ddmmyyyy) return undefined;
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3 && parts[2]?.length === 4) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return ddmmyyyy;
};

// Convert YYYY-MM-DD from backend to DD/MM/YYYY
export const toDisplayDate = (isoOrVn: string): string => {
  if (!isoOrVn) return '';
  if (isoOrVn.includes('-')) {
    const parts = isoOrVn.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  return isoOrVn;
};

// Calculate months between DD/MM/YYYY dates (if < 1 returns 1)
export const calculateDurationMonths = (startStr: string, endStr: string): number => {
  const start = parseDateObj(startStr);
  const end = parseDateObj(endStr);
  if (start && end && end >= start) {
    const diffYears = end.getFullYear() - start.getFullYear();
    const diffMonths = end.getMonth() - start.getMonth();
    const totalMonths = diffYears * 12 + diffMonths;
    return totalMonths <= 0 ? 1 : totalMonths;
  }
  return 1;
};

// Color tier metadata for Success Chance (0% - 100%)
export const getSuccessChanceMeta = (chance: number) => {
  const val = isNaN(chance) ? 0 : Math.max(0, Math.min(100, chance));
  if (val < 30) {
    return {
      color: '#EF4444',
      bgColor: '#FEF2F2',
      borderColor: '#FCA5A5',
      label: 'Rất thấp / Rủi ro'
    };
  }
  if (val < 50) {
    return {
      color: '#F97316',
      bgColor: '#FFF7ED',
      borderColor: '#FDBA74',
      label: 'Trung bình thấp'
    };
  }
  if (val < 70) {
    return {
      color: '#EAB308',
      bgColor: '#FEFCE8',
      borderColor: '#FDE047',
      label: 'Tiềm năng'
    };
  }
  if (val < 85) {
    return {
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#93C5FD',
      label: 'Khả quan'
    };
  }
  return {
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    label: 'Rất cao / Chắc chắn'
  };
};

// Interactive Touch Slider Component
const SuccessChanceSlider: React.FC<{
  value: number;
  onChange: (val: number) => void;
}> = ({ value, onChange }) => {
  const [trackWidth, setTrackWidth] = useState(300);
  const trackRef = useRef<View>(null);
  const trackPageXRef = useRef(0);
  const safeVal = typeof value === 'number' && !isNaN(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const meta = getSuccessChanceMeta(safeVal);

  const measureTrack = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (width && width > 0) setTrackWidth(width);
      if (typeof pageX === 'number' && !isNaN(pageX)) trackPageXRef.current = pageX;
    });
  };

  const updateFromPageX = (pageX: number) => {
    const width = trackWidth > 0 ? trackWidth : 300;
    const offset = trackPageXRef.current || 20;
    const relativeX = pageX - offset;
    const clamped = Math.max(0, Math.min(width, relativeX));
    const percentage = Math.round(clamped / width * 100);
    if (!isNaN(percentage)) {
      onChange(Math.max(0, Math.min(100, percentage)));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        measureTrack();
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderTerminationRequest: () => false
    })
  ).current;

  const knobLeft = useMemo(() => {
    const w = trackWidth > 0 ? trackWidth : 300;
    return Math.max(0, Math.min(w - 24, w * safeVal / 100 - 12));
  }, [trackWidth, safeVal]);

  return (
    <View className="mb-[16px]">
      <View className="flex-row justify-between items-center mb-[10px]">
        <View className="flex-row items-center gap-[8px]">
          <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
            Khả năng thành công <Text className="text-[#EF4444]">*</Text>
          </Text>
          <View
            style={

            { backgroundColor: meta.bgColor, borderColor: meta.borderColor }} className="px-[8px] py-[2px] rounded-[6px] border">

            
            <Text style={{ color: meta.color }} className="text-[11px] font-bold">
              {meta.label}
            </Text>
          </View>
        </View>

        <View
          style={

          { backgroundColor: meta.bgColor, borderColor: meta.borderColor }} className="px-[12px] py-[3px] rounded-[8px] border-[1.5px]">

          
          <Text style={{ color: meta.color }} className="text-[16px] font-extrabold">
            {safeVal}%
          </Text>
        </View>
      </View>

      {/* Slider Track Bar */}
      <View
        ref={trackRef}

        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w);
          measureTrack();
        }}
        {...panResponder.panHandlers} className="h-[36px] justify-center relative">
        
        <View className="h-[8px] bg-slate-200 rounded-[4px] overflow-hidden">
          <View
            style={

            {
              width: `${safeVal}%`,
              backgroundColor: meta.color
            }} className="h-full rounded-[4px]" />

          
        </View>

        <View
          style={

          {
            left: knobLeft,
            borderColor: meta.color,
            shadowColor: meta.color
          }} className="absolute top-[6px] w-[24px] h-[24px] rounded-[12px] bg-white border-[3px] justify-center items-center shadow-md">

          
          <View style={{ backgroundColor: meta.color }} className="w-[8px] h-[8px] rounded-[4px]" />
        </View>
      </View>

      {/* 0% - Large Value - 100% Display Matching Web */}
      <View className="flex-row justify-between items-center mt-[4px] px-[2px]">
        <Text className="text-[12px] text-slate-400 font-medium">0%</Text>
        <Text style={{ color: meta.color }} className="text-[18px] font-extrabold">
          {safeVal}%
        </Text>
        <Text className="text-[12px] text-slate-400 font-medium">100%</Text>
      </View>

      {/* Quick Select Presets */}
      <View className="flex-row justify-between mt-[10px] gap-[6px]">
        {[0, 25, 35, 50, 75, 100].map((step) => {
          const isCurrent = safeVal === step;
          return (
            <TouchableOpacity
              key={step}
              style={

              isCurrent && { backgroundColor: meta.bgColor, borderColor: meta.borderColor }}

              onPress={() => onChange(step)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} className="flex-1 py-[6px] rounded-[6px] bg-slate-100 border border-slate-200 items-center">
              
              <Text
                style={

                isCurrent && { color: meta.color, fontWeight: '700' }} className="text-[11px] text-slate-500 font-semibold">

                
                {step}%
              </Text>
            </TouchableOpacity>);

        })}
      </View>
    </View>);

};

// Auto-format MM/YY input (chuẩn Web)
const formatMonthYear = (value: string, prevValue: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  // Backspace handling: nếu prev kết thúc bằng '/' và người dùng xóa
  if (prevValue.endsWith('/') && digits.length === 2 && !value.includes('/')) {
    return digits.slice(0, 1);
  }
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const { mode, cloneFromId } = useLocalSearchParams<{ mode?: string; cloneFromId?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const isLandscape = width > height;

  // Zustand Store
  const {
    formData,
    updateField,
    updateFormData,
    lastSavedTime,
    setLastSavedTime,
    dateError,
    setDateError,
    isSubmitting,
    setIsSubmitting,
    toggleRegion,
    addPackage,
    removePackage,
    selectPackageTemplate,
    setPackageQuantity,
    addService,
    removeService,
    selectServiceItem,
    setServiceQuantity,
    addPackageService,
    removePackageService,
    updatePackageService,
    setPackageServiceJobIncluded,
    setPackageServiceJobBrief,
    setServiceJobIncluded,
    setServiceJobBrief,
    addLink,
    removeLink,
    updateLink,
    addAttachedFiles,
    removeAttachedFile,
    resetForm,
    setNameParts
  } = useOpportunityFormStore();

  const {
    name,
    nameParts,
    description,
    field,
    expectedRevenue,
    budget,
    startDate,
    endDate,
    durationMonths,
    selectedRegions,
    priority,
    successChance,
    packages,
    services,
    customerRequirements,
    links,
    attachedFiles
  } = formData;

  // Refs cho việc nhảy tự động giữa các ô nhập liệu khi nhấn Hoàn tất/Next
  const brandNameRef = useRef<TextInput>(null);
  const monthYearRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);

  // Auto-combine: customerName_brandName_MM/YY
  const opportunityName = useMemo(() => {
    if (!nameParts) return name || '';
    const { customerName = '', brandName = '', monthYear = '' } = nameParts;
    return [customerName.trim(), brandName.trim(), monthYear.trim()].filter(Boolean).join('_');
  }, [nameParts, name]);

  // Convenience Setters
  const setDescription = (val: string) => updateField('description', val);
  const setField = (val: string) => updateField('field', val);
  const setExpectedRevenue = (val: number | string) =>
  updateField('expectedRevenue', typeof val === 'number' ? val : parseNumberInput(val));
  const setBudget = (val: number | string) =>
  updateField('budget', typeof val === 'number' ? val : parseNumberInput(val));
  const setStartDate = (val: string) => updateField('startDate', val);
  const setEndDate = (val: string) => updateField('endDate', val);
  const setDurationMonths = (val: number | string) =>
  updateField('durationMonths', typeof val === 'number' ? val : parseInt(String(val), 10) || 1);
  const setPriority = (val: string) => updateField('priority', val);
  const setSuccessChance = (val: number) => updateField('successChance', val);
  const setCustomerRequirements = (val: string) => updateField('customerRequirements', val);

  // Metadata catalogs via TanStack Query
  const { data: rawServ, isLoading: isLoadingServices } = useAvailableServicesQuery();
  const { data: rawPkg, isLoading: isLoadingPackages } = useServicePackagesQuery();

  const availableServices = useMemo<Array<{ id: string; name: string; costPrice?: number; serviceJobs?: any[] }>>(() => {
    if (!rawServ) return [];
    return Array.isArray(rawServ) ? rawServ : (rawServ as any)?.data && Array.isArray((rawServ as any).data) ? (rawServ as any).data : [];
  }, [rawServ]);

  const availablePackages = useMemo<Array<any>>(() => {
    if (!rawPkg) return [];
    return Array.isArray(rawPkg) ? rawPkg : (rawPkg as any)?.data && Array.isArray((rawPkg as any).data) ? (rawPkg as any).data : [];
  }, [rawPkg]);

  const isLoadingMeta = isLoadingServices || isLoadingPackages;
  const createOpportunityMutation = useCreateOpportunityMutation();
  const { data: clonedOpp, isLoading: isCloningLoading } = useOpportunityDetailQuery(cloneFromId ? String(cloneFromId) : '');
  const [hasAppliedClone, setHasAppliedClone] = useState(false);

  // UI Selection Modals State
  const [isFieldModalVisible, setIsFieldModalVisible] = useState(false);
  const [isRegionModalVisible, setIsRegionModalVisible] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [activePackageIndex, setActivePackageIndex] = useState<number | null>(null);
  const [activeServiceTarget, setActiveServiceTarget] = useState<
    | { type: 'standalone'; index: number }
    | { type: 'package'; pkgIndex: number; serviceIndex: number }
    | null
  >(null);
  const [expandedPackages, setExpandedPackages] = useState<Record<number, boolean>>({ 0: true });

  const autoSaveTimerRef = useRef<any>(null);

  // Keyboard Visibility Detection for Seamless Layout Adjustments
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Immediate Real-Time Date Validation & Duration Auto-Calculation
  useEffect(() => {
    // If either date is empty or incomplete
    if (!startDate && !endDate) {
      setDateError('');
      setDurationMonths(1);
      return;
    }

    const isStartComplete = startDate.length === 10;
    const isEndComplete = endDate.length === 10;

    const startValid = isStartComplete ? validateDateString(startDate) : false;
    const endValid = isEndComplete ? validateDateString(endDate) : false;

    if (isStartComplete && !startValid) {
      setDateError('Ngày bắt đầu không hợp lệ (DD/MM/YYYY)');
      return;
    }

    if (isEndComplete && !endValid) {
      setDateError('Ngày kết thúc không hợp lệ (DD/MM/YYYY)');
      return;
    }

    if (startValid && endValid) {
      const pStart = parseDateObj(startDate)!;
      const pEnd = parseDateObj(endDate)!;

      if (pEnd < pStart) {
        setDateError('Ngày kết thúc phải sau ngày dự kiến bắt đầu');
        setDurationMonths(1);
      } else {
        setDateError('');
        const months = calculateDurationMonths(startDate, endDate);
        setDurationMonths(months < 1 ? 1 : months);
      }
    } else {
      setDateError('');
      if (!durationMonths) {
        setDurationMonths(1);
      }
    }
  }, [startDate, endDate]);

  // Reset form if opening clean (not in draft mode)
  useEffect(() => {
    if (mode !== 'draft' && !cloneFromId) {
      resetForm();
    }
  }, [mode, cloneFromId]);

  // Auto-fill from cloned opportunity if ?cloneFromId=...
  useEffect(() => {
    if (cloneFromId && clonedOpp && !hasAppliedClone) {
      setHasAppliedClone(true);

      const rawName = String(clonedOpp.name || '');
      const rawNameParts = rawName.split('_');
      let cust = '';
      let brand = '';
      let my = '';

      if (rawNameParts.length >= 3) {
        cust = rawNameParts[0].trim();
        brand = rawNameParts.slice(1, -1).join('_').trim();
        my = rawNameParts[rawNameParts.length - 1].trim();
      } else if (rawNameParts.length === 2) {
        cust = rawNameParts[0].trim();
        my = rawNameParts[1].trim();
      } else {
        cust = rawName.trim();
      }

      if (clonedOpp.customer?.name) {
        cust = clonedOpp.customer.name;
      } else if (clonedOpp.leadName) {
        cust = clonedOpp.leadName;
      }

      setNameParts({
        customerName: cust,
        brandName: brand,
        monthYear: my,
      });

      // Standalone services (not belonging to any package)
      const standaloneServices = (clonedOpp.services || [])
        .filter((s: any) => !s.opportunityPackageId && !s.isPackageService)
        .map((s: any) => ({
          serviceId: s.serviceId || s.service?.id || s.id || '',
          quantity: Number(s.quantity) || 1,
        }));

      // Packages
      const mappedPackages = (clonedOpp.packages || []).map((pkg: any) => ({
        servicePackageId:
          pkg.servicePackageId ||
          pkg.servicePackage?.id ||
          pkg.package?.id ||
          pkg.id ||
          '',
        name: pkg.name || pkg.servicePackage?.name || pkg.package?.name || '',
        description: pkg.description || pkg.servicePackage?.description || '',
        quantity: Number(pkg.quantity) || 1,
        services: (pkg.services || pkg.items || []).map((s: any) => ({
          serviceId: s.serviceId || s.service?.id || '',
          quantity: Number(s.quantity) || 1,
          sellingPrice: Number(s.sellingPrice ?? s.service?.costPrice ?? 0),
        })),
      }));

      // Attachments / Links
      const attachments = clonedOpp.attachments || [];
      const links = attachments.filter((a: any) => a.type === 'LINK').map((a: any) => a.url);
      const paddedLinks = links.length >= 3 ? links : [...links, ...Array(3 - links.length).fill('')];

      const regionList = Array.isArray(clonedOpp.region)
        ? clonedOpp.region
        : typeof clonedOpp.region === 'string' && clonedOpp.region
        ? [clonedOpp.region]
        : [];

      updateFormData({
        description: clonedOpp.description || '',
        field: clonedOpp.field || '',
        expectedRevenue: Number(clonedOpp.expectedRevenue) || 0,
        budget: Number(clonedOpp.budget) || 0,
        startDate: clonedOpp.startDate ? toDisplayDate(clonedOpp.startDate) : '',
        endDate: clonedOpp.endDate ? toDisplayDate(clonedOpp.endDate) : '',
        durationMonths: Number(clonedOpp.durationMonths) || 1,
        priority: clonedOpp.priority || 'Medium',
        successChance: Number(clonedOpp.successChance) || 0,
        selectedRegions: regionList,
        customerRequirements: clonedOpp.customerRequirements || '',
        services: standaloneServices.length > 0 ? standaloneServices : [{ serviceId: '', quantity: 1 }],
        packages: mappedPackages.length > 0 ? mappedPackages : [{ servicePackageId: '', quantity: 1 }],
        links: paddedLinks.length > 0 ? paddedLinks : ['', '', ''],
      });
    }
  }, [cloneFromId, clonedOpp, hasAppliedClone]);

  // Auto-restore draft if opened in draft mode (?mode=draft)
  useEffect(() => {
    const restoreDraftIfRequested = async () => {
      if (mode === 'draft') {
        try {
          const savedDraft = await AsyncStorage.getItem(STORAGE_DRAFT_KEY);
          if (savedDraft) {
            const d = JSON.parse(savedDraft);
            let restoredNameParts = d.nameParts;
            if (!restoredNameParts && d.name) {
              const parts = String(d.name).split('_');
              restoredNameParts = {
                customerName: parts[0]?.trim() || '',
                brandName: parts.length >= 3 ? parts.slice(1, -1).join('_').trim() : parts[1]?.trim() || '',
                monthYear: parts.length >= 2 ? parts[parts.length - 1]?.trim() || '' : ''
              };
            }

            updateFormData({
              ...d,
              ...(restoredNameParts ? { nameParts: restoredNameParts } : {}),
              expectedRevenue: typeof d.expectedRevenue === 'number' ? d.expectedRevenue : parseNumberInput(d.expectedRevenue),
              budget: typeof d.budget === 'number' ? d.budget : parseNumberInput(d.budget),
              startDate: d.startDate ? toDisplayDate(d.startDate) : '',
              endDate: d.endDate ? toDisplayDate(d.endDate) : '',
              durationMonths: Number(d.durationMonths) || 1,
              successChance: Number(d.successChance) || 0
            });

            if (d.savedAt) {
              const rawStr = String(d.savedAt).trim();
              if (/^\d{1,2}:\d{2}$/.test(rawStr)) {
                setLastSavedTime(rawStr);
              } else {
                const dTime = new Date(rawStr);
                if (!isNaN(dTime.getTime())) {
                  setLastSavedTime(
                    `${dTime.getHours().toString().padStart(2, '0')}:${dTime.getMinutes().toString().padStart(2, '0')}`
                  );
                } else {
                  setLastSavedTime('Gần đây');
                }
              }
            }
          }
        } catch {

          // Ignore
        }}
    };

    restoreDraftIfRequested();
  }, [mode]);

  // Auto-Save Debounce Effect
  useEffect(() => {
    if (!name && !description && attachedFiles.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      const draftData = {
        ...formData,
        savedAt: new Date().toISOString()
      };

      try {
        await AsyncStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draftData));
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        );
      } catch {

        // Ignore auto-save error
      }}, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData]);

  // Packages Management
  const handleAddPackage = () => addPackage();

  const handleRemovePackage = (index: number) => removePackage(index);

  const handleSelectPackageTemplate = (index: number, templateId: string) => {
    const template = availablePackages.find((t) => String(t.id) === String(templateId));
    selectPackageTemplate(index, template);
    setActivePackageIndex(null);
    setExpandedPackages((prev) => ({ ...prev, [index]: true }));
  };

  const handleToggleExpandPackage = (index: number) => {
    setExpandedPackages((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handlePackageQuantityChange = (index: number, qty: number) => {
    setPackageQuantity(index, Math.max(1, qty));
  };

  // Services Management
  const handleAddService = () => addService();

  const handleRemoveService = (index: number) => removeService(index);

  const handleSelectServiceFromModal = (serviceId: string) => {
    if (!activeServiceTarget) return;

    if (activeServiceTarget.type === 'standalone') {
      const found = availableServices.find((s) => String(s.id) === String(serviceId));
      selectServiceItem(activeServiceTarget.index, serviceId, found);
    } else if (activeServiceTarget.type === 'package') {
      const found = availableServices.find((s) => String(s.id) === String(serviceId));
      updatePackageService(activeServiceTarget.pkgIndex, activeServiceTarget.serviceIndex, 'serviceId', serviceId, found);
    }
    setActiveServiceTarget(null);
  };

  const handleServiceQuantityChange = (index: number, qty: number) => {
    setServiceQuantity(index, Math.max(1, qty));
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

  // Links Management
  const handleAddLink = () => addLink();

  const handleRemoveLink = (index: number) => removeLink(index);

  const handleUpdateLink = (index: number, value: string) => updateLink(index, value);

  // Region Toggle
  const handleToggleRegion = (reg: string) => toggleRegion(reg);

  // Document Picker
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (attachedFiles.length + result.assets.length > 5) {
          Alert.alert('Giới hạn', 'Bạn chỉ có thể đính kèm tối đa 5 tệp tin.');
          return;
        }

        const newFiles: AttachedFile[] = result.assets.map((asset) => ({
          name: asset.name,
          size: asset.size,
          uri: asset.uri,
          mimeType: asset.mimeType
        }));
        addAttachedFiles(newFiles);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn tệp.');
    }
  };

  const handleRemoveFile = (index: number) => removeAttachedFile(index);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!nameParts.customerName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khách hàng.');
      return;
    }
    if (!nameParts.brandName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên Brand.');
      return;
    }
    const monthYearNorm = nameParts.monthYear.trim();
    const monthYearMatch = monthYearNorm.match(/^(\d{2})\/(\d{2})$/);
    const monthVal = monthYearMatch ? Number(monthYearMatch[1]) : 0;
    if (!monthYearNorm) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tháng/năm (MM/YY).');
      return;
    }
    if (!monthYearMatch || monthVal < 1 || monthVal > 12) {
      Alert.alert('Sai định dạng', 'Tháng/năm phải có định dạng MM/YY, ví dụ 09/26.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả chi tiết về cơ hội.');
      return;
    }

    if (!field) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn lĩnh vực cho cơ hội.');
      return;
    }

    const expRevNum = Number(expectedRevenue) || 0;
    if (expRevNum <= 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Doanh thu kỳ vọng lớn hơn 0 VNĐ.');
      return;
    }

    const budgetNum = Number(budget) || 0;
    if (budgetNum <= 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Ngân sách dự kiến lớn hơn 0 VNĐ.');
      return;
    }

    const successChanceNum = Number(successChance) || 0;
    if (successChanceNum <= 0) {
      Alert.alert('Thiếu thông tin', 'Tỉ lệ thành công phải lớn hơn 0%.');
      return;
    }

    if (!startDate || startDate.length !== 10 || !validateDateString(startDate)) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ và đúng định dạng ngày dự kiến bắt đầu (DD/MM/YYYY).');
      return;
    }

    if (!endDate || endDate.length !== 10 || !validateDateString(endDate)) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ và đúng định dạng ngày dự kiến kết thúc (DD/MM/YYYY).');
      return;
    }

    if (dateError) {
      Alert.alert('Lỗi ngày tháng', dateError);
      return;
    }

    const missingBrief = [
      ...services,
      ...packages.flatMap((pkg) => pkg.services || [])
    ].some((service) =>
      (service.jobs || []).some((job) => job.isBriefVideo && job.included && !job.briefVideo?.trim())
    );

    if (missingBrief) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ brief cho hạng mục Video AI demo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const validServices = services
        .filter((s) => s.serviceId && s.quantity > 0)
        .map((s) => ({
          id: s.serviceId,
          quantity: Number(s.quantity) || 1,
          jobs: s.jobs || []
        }));

      const validPackages = packages
        .filter((pkg) => pkg.servicePackageId)
        .map((pkg) => ({
          servicePackageId: pkg.servicePackageId,
          name: pkg.name,
          description: pkg.description,
          quantity: Number(pkg.quantity) || 1,
          services: (pkg.services || [])
            .filter((s) => s.serviceId)
            .map((s) => ({
              serviceId: s.serviceId,
              quantity: Number(s.quantity) || 1,
              sellingPrice: s.sellingPrice,
              jobs: s.jobs || []
            }))
        }));

      if (validServices.length === 0 && validPackages.length === 0) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất 1 dịch vụ lẻ hoặc 1 gói dịch vụ.');
        setIsSubmitting(false);
        return;
      }

      const rawLinks = links.map((l) => l.trim()).filter((l) => l.length > 0);
      for (const linkItem of rawLinks) {
        if (!isValidUrl(linkItem)) {
          Alert.alert(
            'Sai định dạng liên kết',
            `Đường dẫn "${linkItem}" không đúng định dạng. Vui lòng kiểm tra lại (Ví dụ: google.com hoặc https://example.com).`
          );
          setIsSubmitting(false);
          return;
        }
      }
      const validLinks = rawLinks.map((l) => normalizeUrl(l));

      const payload: CreateOpportunityPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        field: field || undefined,
        priority: priority,
        successChance: Number(successChance) || 0,
        expectedRevenue: Number(expectedRevenue) || 0,
        budget: Number(budget) || 0,
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
        durationMonths: Number(durationMonths) || 1,
        region: selectedRegions.length > 0 ? selectedRegions : undefined,
        customerRequirements: customerRequirements.trim() || undefined,
        links: validLinks.length > 0 ? validLinks : undefined,
        services: validServices.length > 0 ? validServices : undefined,
        packages: validPackages.length > 0 ? validPackages : undefined
      };

      const resData = await createOpportunityMutation.mutateAsync(payload);
      await AsyncStorage.removeItem(STORAGE_DRAFT_KEY);
      resetForm();

      Alert.alert('Thành công', 'Đã tạo cơ hội kinh doanh mới thành công!', [
      {
        text: 'Xem chi tiết',
        onPress: () => {
          if (resData?.id) {
            router.replace(`/opportunities/${resData.id}`);
          } else {
            router.replace('/opportunities');
          }
        }
      },
      {
        text: 'Về trang chủ',
        style: 'cancel',
        onPress: () => router.replace('/')
      }]
      );
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo cơ hội kinh doanh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSaveDraft = async () => {
    const draftData = {
      ...formData,
      savedAt: new Date().toISOString()
    };

    try {
      await AsyncStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draftData));
      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
      router.back();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu bản nháp.');
    }
  };

  const selectedFieldLabel = useMemo(() => {
    const found = FIELDS.find((f) => f.value === field);
    return found ? found.label : '-- Chọn lĩnh vực --';
  }, [field]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-[16px] py-[12px] bg-white border-b border-b-slate-200">
        <View style={isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' }} className="flex-row items-center justify-between w-full">
          <TouchableOpacity

            onPress={() => router.back()}
            activeOpacity={0.7} className="w-[36px] h-[36px] rounded-[18px] bg-slate-100 justify-center items-center">
            
            <Feather name="x" size={20} color="#1E293B" />
          </TouchableOpacity>

          <View className="flex-1 ml-[12px]">
            <Text className="text-[17px] font-bold text-slate-900">
              {cloneFromId ? 'Sao Chép Cơ Hội' : mode === 'draft' ? 'Chỉnh Sửa Bản Nháp' : 'Tạo Cơ Hội Mới'}
            </Text>
            <View className="flex-row items-center mt-[2px]">
              {lastSavedTime ?
              <View className="flex-row items-center bg-emerald-100 px-[6px] py-[2px] rounded-[4px] gap-[4px]">
                  <Feather name="cloud" size={11} color="#059669" />
                  <Text className="text-[10px] font-semibold text-emerald-600">Đã lưu {lastSavedTime}</Text>
                </View> :

              <Text className="text-[12px] text-slate-500 mt-[2px]">
                  {cloneFromId ? 'Tạo cơ hội tương tự từ hồ sơ sẵn có' : mode === 'draft' ? 'Chỉnh sửa thông tin bản nháp' : 'Điền thông tin chi tiết của cơ hội'}
                </Text>
              }
            </View>
          </View>

          <TouchableOpacity

            onPress={handleManualSaveDraft}
            activeOpacity={0.7} className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]">
            
            <Feather name="save" size={15} color={BrandColors.primary} />
            <Text className="text-[12px] font-semibold">Lưu nháp</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerClassName="p-[16px] gap-[16px]"
        contentContainerStyle={[
        isSmallScreen && { padding: 12, gap: 10 },
        isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' },
        { paddingBottom: isKeyboardVisible ? 100 : 40 }]
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 70 : 100}
        extraHeight={100}>
        
          {/* Banner trạng thái sao chép cơ hội */}
          {cloneFromId && isCloningLoading && (
            <View className="flex-row items-center gap-2.5 bg-blue-50 border border-blue-200 p-3.5 rounded-2xl mb-2">
              <ActivityIndicator size="small" color="#2563EB" />
              <Text className="text-xs text-blue-700 font-semibold flex-1">
                Đang nạp dữ liệu từ cơ hội gốc...
              </Text>
            </View>
          )}
          {cloneFromId && !isCloningLoading && clonedOpp && (
            <View className="flex-row items-center gap-2.5 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl mb-1">
              <Feather name="check-circle" size={16} color="#059669" />
              <Text className="text-xs text-emerald-800 font-semibold flex-1">
                Đã sao chép dữ liệu từ cơ hội "{clonedOpp.name}". Hãy kiểm tra lại và nhấn tạo mới.
              </Text>
            </View>
          )}

          {/* 1. THÔNG TIN CƠ BẢN */}
          <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
            <View className="flex-row items-center mb-[16px] gap-[12px]">
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
                <Text style={{ color: '#2563EB' }} className="text-[14px] font-bold">1</Text>
              </View>
              <View>
                <Text className="text-[15px] font-bold text-slate-900">Thông tin cơ bản</Text>
                <Text className="text-[12px] text-slate-500 mt-[2px]">Tên cơ hội, mô tả và lĩnh vực kinh doanh</Text>
              </View>
            </View>

            {/* Tên cơ hội: 3 ô ghép chuẩn Web (customerName + brandName + MM/YY) */}
            <View className="mb-[16px]">
              <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                Tên cơ hội<Text className="text-[#EF4444]">*</Text>
              </Text>

              {/* Preview tên cơ hội kết hợp */}
              {opportunityName.length > 0 &&
            <View className="flex-row items-center bg-blue-50 border border-blue-200 rounded-[8px] px-[10px] py-[7px] mb-[10px] gap-[6px]">
                  <Feather name="tag" size={13} color="#2563EB" />
                  <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-[#1D4ED8]">
                    {opportunityName}
                  </Text>
                </View>
            }

              {/* Row 1: Tên khách hàng */}
              <View className="mb-[10px]">
                <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">Tên khách hàng <Text className="text-[#EF4444]">*</Text></Text>
                <TextInput
                  placeholder="VD: Công ty ABC"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  onSubmitEditing={() => brandNameRef.current?.focus()}
                  blurOnSubmit={false}
                  value={nameParts?.customerName || ''}
                  onChangeText={(v) => setNameParts({ customerName: v })}
                  className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
                />
              </View>

              {/* Row 2: Tên Brand + MM/YY cạnh nhau */}
              <View className="flex-row items-start">
                <View style={{ flex: 1, marginRight: 8 }} className="mb-[10px]">
                  <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">Tên Brand <Text className="text-[#EF4444]">*</Text></Text>
                  <TextInput
                    ref={brandNameRef}
                    placeholder="VD: GETVINI"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    onSubmitEditing={() => monthYearRef.current?.focus()}
                    blurOnSubmit={false}
                    value={nameParts?.brandName || ''}
                    onChangeText={(v) => setNameParts({ brandName: v })}
                    className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
                  />
                </View>

                <View style={{ width: 100 }} className="mb-[10px]">
                  <Text className="text-[12px] font-semibold text-slate-600 mb-[5px]">Tháng/Năm <Text className="text-[#EF4444]">*</Text></Text>
                  <TextInput
                    ref={monthYearRef}
                    placeholder="mm/yy"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={5}
                    returnKeyType="next"
                    onSubmitEditing={() => descriptionRef.current?.focus()}
                    blurOnSubmit={false}
                    value={nameParts?.monthYear || ''}
                    onChangeText={(v) =>
                      setNameParts({ monthYear: formatMonthYear(v, nameParts?.monthYear || '') })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900"
                  />
                </View>
              </View>
            </View>

            {/* Mô tả chi tiết (Nằm trên Lĩnh vực) */}
            <View className="mb-[16px]">
              <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                Mô tả <Text className="text-[#EF4444]">*</Text>
              </Text>
              <TextInput
              ref={descriptionRef}

              placeholder="Mô tả chi tiết về cơ hội..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top" className={["bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900", "min-h-[84px]"].filter(Boolean).join(" ")} />
            
              <View className="flex-row justify-end mt-[4px]">
                <Text
                style={

                {
                  color: description.length > 180 ? '#F97316' : '#94A3B8'
                }} className="text-[11px]">

                
                  {description.length}/200
                </Text>
              </View>
            </View>

            {/* Lĩnh vực */}
            <View className="mb-[16px]">
              <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                Lĩnh vực <Text className="text-[#EF4444]">*</Text>
              </Text>
              <TouchableOpacity

              onPress={() => setIsFieldModalVisible(true)}
              activeOpacity={0.7} className="flex-row items-center justify-between bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[11px]">
              
                <Text className={["text-[14px] text-slate-900 font-medium flex-1",


              !field && "text-slate-400"].filter(Boolean).join(" ")}>

                
                  {selectedFieldLabel}
                </Text>
                <Feather name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. THÔNG TIN TÀI CHÍNH */}
          <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
            <View className="flex-row items-center mb-[16px] gap-[12px]">
              <View style={{ backgroundColor: '#FEF3C7' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
                <Text style={{ color: '#D97706' }} className="text-[14px] font-bold">2</Text>
              </View>
              <View>
                <Text className="text-[15px] font-bold text-slate-900">Thông tin tài chính</Text>
                <Text className="text-[12px] text-slate-500 mt-[2px]">Kỳ vọng doanh thu và ngân sách dự kiến</Text>
              </View>
            </View>

            {/* Doanh thu & Ngân sách */}
            <View className={["flex-row", isSmallScreen && "flex-col"].filter(Boolean).join(" ")}>
              <View className={["mb-[16px]", isSmallScreen ? "w-full mr-0 ml-0" : "flex-1 mr-[8px]"].filter(Boolean).join(" ")}>
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                  Doanh thu kỳ vọng <Text className="text-[#EF4444]">*</Text> <Text className="text-[11px] font-normal text-slate-500">(giá muốn bán cho khách)</Text>
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[12px]">
                  <TextInput

                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={expectedRevenue ? formatNumberInput(expectedRevenue) : '0'}
                  onChangeText={(val) => setExpectedRevenue(parseNumberInput(val))} className="flex-1 py-[10px] text-[14px] font-semibold text-slate-900" />
                
                  <Text className="text-[13px] font-bold text-slate-500 ml-[4px]">VNĐ</Text>
                </View>
              </View>

              <View className={["mb-[16px]", isSmallScreen ? "w-full mr-0 ml-0" : "flex-1 ml-[8px]"].filter(Boolean).join(" ")}>
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                  Ngân sách dự kiến <Text className="text-[#EF4444]">*</Text> <Text className="text-[11px] font-normal text-slate-500">(ngân sách của khách đề xuất)</Text>
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[12px]">
                  <TextInput

                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={budget ? formatNumberInput(budget) : '0'}
                  onChangeText={(val) => setBudget(parseNumberInput(val))} className="flex-1 py-[10px] text-[14px] font-semibold text-slate-900" />
                
                  <Text className="text-[13px] font-bold text-slate-500 ml-[4px]">VNĐ</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. THỜI GIAN & ĐỊA ĐIỂM */}
          <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
            <View className="flex-row items-center mb-[16px] gap-[12px]">
              <View style={{ backgroundColor: '#F3E8FF' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
                <Text style={{ color: '#9333EA' }} className="text-[14px] font-bold">3</Text>
              </View>
              <View>
                <Text className="text-[15px] font-bold text-slate-900">Thời gian & Địa điểm</Text>
                <Text className="text-[12px] text-slate-500 mt-[2px]">Lịch trình dự kiến và phạm vi địa lý triển khai</Text>
              </View>
            </View>

            {/* Ngày bắt đầu & Ngày kết thúc */}
            <View className={["flex-row", isSmallScreen && "flex-col"].filter(Boolean).join(" ")}>
              <View className={["mb-[16px]", isSmallScreen ? "w-full mr-0 ml-0" : "flex-1 mr-[8px]"].filter(Boolean).join(" ")}>
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                  Dự kiến bắt đầu <Text className="text-[#EF4444]">*</Text>
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[10px]">
                  <TouchableOpacity
                  onPress={() => setActiveDatePicker('start')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  
                    <Feather name="calendar" size={16} color="#2563EB" className="mr-[6px]" />
                  </TouchableOpacity>
                  <TextInput

                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={10}
                  value={startDate}
                  onChangeText={(val) => setStartDate(formatDateInputMask(val))} className="flex-1 py-[10px] text-[14px] text-slate-900" />
                
                </View>
              </View>

              <View className={["mb-[16px]", isSmallScreen ? "w-full mr-0 ml-0" : "flex-1 ml-[8px]"].filter(Boolean).join(" ")}>
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">
                  Dự kiến kết thúc <Text className="text-[#EF4444]">*</Text>
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-[10px] px-[10px]">
                  <TouchableOpacity
                  onPress={() => setActiveDatePicker('end')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  
                    <Feather name="calendar" size={16} color="#2563EB" className="mr-[6px]" />
                  </TouchableOpacity>
                  <TextInput

                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={10}
                  value={endDate}
                  onChangeText={(val) => setEndDate(formatDateInputMask(val))} className="flex-1 py-[10px] text-[14px] text-slate-900" />
                
                </View>
              </View>
            </View>

            {/* Immediate Validation Error Message */}
            {dateError ?
          <View className="flex-row items-center gap-[6px] bg-red-50 border border-red-200 rounded-[8px] px-[10px] py-[8px] mt-[-8px] mb-[14px]">
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text className="text-[12px] font-semibold text-red-600 flex-1">{dateError}</Text>
              </View> :
          null}

            {/* Địa điểm triển khai (Multi select) */}
            <View className="mb-[16px]">
              <View className="flex-row justify-between items-center mb-[6px]">
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">Địa điểm triển khai</Text>
                <TouchableOpacity
                onPress={() => setIsRegionModalVisible(true)} className="py-[2px]">

                
                  <Text className="text-[12px] font-semibold">Chọn tỉnh thành</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity

              onPress={() => setIsRegionModalVisible(true)}
              activeOpacity={0.7} className="flex-row items-center justify-between bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[11px]">
              
                <Text




                numberOfLines={1} className={["text-[14px] text-slate-900 font-medium flex-1", selectedRegions.length === 0 && "text-slate-400"].filter(Boolean).join(" ")}>
                
                  {selectedRegions.length > 0 ?
                `Đã chọn: ${selectedRegions.join(', ')}` :
                'Chọn tỉnh thành (có thể chọn nhiều)...'}
                </Text>
                <Feather name="map-pin" size={16} color="#64748B" />
              </TouchableOpacity>

              {/* Quick selected chips */}
              {selectedRegions.length > 0 &&
            <View className="flex-row flex-wrap gap-[6px] mt-[8px]">
                  {selectedRegions.map((reg) =>
              <View key={reg} className="flex-row items-center bg-blue-50 border border-blue-200 rounded-[6px] px-[8px] py-[4px] gap-[6px]">
                      <Text className="text-[12px] text-[#1D4ED8] font-medium">{reg}</Text>
                      <TouchableOpacity
                  onPress={() => handleToggleRegion(reg)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                  
                        <Feather name="x" size={12} color="#475569" />
                      </TouchableOpacity>
                    </View>
              )}
                </View>
            }
            </View>

            {/* Số tháng triển khai (Tự động tính, mặc định 1, nếu <1 thì là 1, không cho sửa) */}
            <View className="mb-[16px]">
              <View className="flex-row justify-between items-center mb-[6px]">
                <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">Số tháng triển khai</Text>
              </View>
              <View className="flex-row items-center bg-slate-100 border border-slate-200 rounded-[10px] px-[12px] py-[11px]">
                <Text className="text-[14px] font-semibold text-slate-700">
                  {durationMonths && durationMonths > 0 ?
                `${durationMonths} Tháng` :
                '1 Tháng'}
                </Text>
              </View>
            </View>
          </View>

          {/* 4. ĐÁNH GIÁ CƠ HỘI */}
          <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
            <View className="flex-row items-center mb-[16px] gap-[12px]">
              <View style={{ backgroundColor: '#FDF2F8' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
                <Text style={{ color: '#DB2777' }} className="text-[14px] font-bold">4</Text>
              </View>
              <View>
                <Text className="text-[15px] font-bold text-slate-900">Đánh giá cơ hội</Text>
                <Text className="text-[12px] text-slate-500 mt-[2px]">Mức độ ưu tiên và tỷ lệ thành công dự kiến</Text>
              </View>
            </View>

            {/* Độ ưu tiên */}
            <View className="mb-[16px]">
              <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">Độ ưu tiên</Text>
              <View style={isSmallScreen && { gap: 4 }} className="flex-row gap-[8px]">
                {PRIORITIES.map((p) => {
                const isSelected = priority.toLowerCase() === p.id.toLowerCase();
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[

                    isSmallScreen && { paddingVertical: 8, paddingHorizontal: 4, gap: 4 },
                    isSelected && {
                      borderColor: p.color,
                      backgroundColor: `${p.color}15`
                    }]}

                    onPress={() => setPriority(p.id)}
                    activeOpacity={0.7} className="flex-1 flex-row items-center justify-center py-[10px] rounded-[10px] border border-slate-200 bg-slate-50 gap-[6px]">
                    
                      <View
                      style={

                      { backgroundColor: p.color }} className="w-[8px] h-[8px] rounded-[4px]" />

                    
                      <Text
                      style={[

                      isSmallScreen && { fontSize: 12 },
                      isSelected && {
                        color: p.color,
                        fontWeight: '700'
                      }]} className="text-[13px] text-slate-500 font-semibold">

                      
                        {p.label}
                      </Text>
                    </TouchableOpacity>);

              })}
              </View>
            </View>

            {/* Khả năng thành công: Thanh trượt cảm ứng 0% - 35% - 100% */}
            <SuccessChanceSlider
            value={successChance}
            onChange={setSuccessChance} />
          
          </View>

          {/* 5. DỊCH VỤ ĐỀ XUẤT (100% Khớp với Web UI & Ảnh người dùng) */}
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

              onPress={handleAddPackage}
              activeOpacity={0.7} className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]">
              
                <Feather name="plus" size={14} color="#2563EB" />
                <Text className="text-[13px] font-semibold text-blue-600">Gói dịch vụ</Text>
              </TouchableOpacity>
            </View>

            {/* A. GÓI DỊCH VỤ ĐỀ XUẤT */}
            <View className="mb-[6px]">
              <Text className="text-[11px] font-extrabold text-slate-400 tracking-[0.8px] mb-[8px]">GÓI DỊCH VỤ ĐỀ XUẤT</Text>

              {packages.map((pkg, idx) => {
                const selectedPkg = availablePackages.find((p) => String(p.id) === String(pkg.servicePackageId));
                const isExpanded = expandedPackages[idx] ?? true;
                const pkgServices = pkg.services || [];

                // If package not chosen yet: render clean select box with trash icon (like screenshot)
                if (!pkg.servicePackageId) {
                  return (
                    <View key={idx} className="flex-row items-center bg-[rgba(239,_246,_255,_0.4)] border border-blue-200 rounded-[12px] p-[10px] gap-[10px] mb-[8px]">
                      <TouchableOpacity
                        onPress={() => setActivePackageIndex(idx)}
                        activeOpacity={0.7}
                        className="flex-1 flex-row items-center justify-between bg-white border-[2px] border-blue-200 rounded-[8px] px-[12px] py-[9px]">
                        <Text className="text-[13px] font-bold text-[#1E3A8A]">-- Chọn gói dịch vụ --</Text>
                        <Feather name="chevron-down" size={18} color="#1E3A8A" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRemovePackage(idx)}
                        activeOpacity={0.7}
                        className="p-[6px]">
                        <Feather name="trash-2" size={18} color="#F87171" />
                      </TouchableOpacity>
                    </View>
                  );
                }

                // If package chosen: render PackageItem card matching Web (with accordion & sub-services)
                return (
                  <View key={idx} className="bg-[rgba(239,_246,_255,_0.4)] border-[2px] border-[#DBEAFE] rounded-[14px] p-[12px] mb-[12px]">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-[10px] flex-1">
                        <View className="w-[34px] h-[34px] rounded-[10px] bg-blue-600 justify-center items-center">
                          <Feather name="briefcase" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text className="text-[14px] font-bold text-[#1E3A8A]">{selectedPkg?.name || pkg.name || 'Gói dịch vụ'}</Text>
                          <Text className="text-[9px] font-extrabold text-blue-600 tracking-[0.6px] mt-[1px]">GÓI DỊCH VỤ</Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-[8px]">
                        <View className="flex-row items-center bg-white border border-slate-300 rounded-[8px] px-[6px] h-[38px]">
                          <Text className="text-[11px] text-slate-500 mr-[4px]">SL</Text>
                          <TextInput
                            keyboardType="numeric"
                            value={formatNumberInput(String(pkg.quantity))}
                            onChangeText={(txt) => handlePackageQuantityChange(idx, parseNumberInput(txt) || 1)}
                            className="w-[36px] text-center text-[14px] font-bold text-slate-900"
                          />
                        </View>

                        <TouchableOpacity
                          onPress={() => handleRemovePackage(idx)}
                          activeOpacity={0.7}
                          className="p-[6px]">
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
                          className="flex-row items-center gap-[6px] py-[4px]">
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
                            className="flex-row items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] bg-blue-100">
                            <Feather name="plus" size={12} color="#1D4ED8" />
                            <Text className="text-[11px] font-semibold text-[#1D4ED8]">Thêm dịch vụ</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Package Sub-Services List */}
                      {isExpanded && (
                        <View className="gap-[8px]">
                          {pkgServices.map((serviceItem, sIdx) => {
                            const foundSub = availableServices.find((s) => String(s.id) === String(serviceItem.serviceId));
                            const briefJobs = (serviceItem.jobs || []).filter((j) => j.isBriefVideo);

                            return (
                              <View
                                key={sIdx}
                                className="bg-white rounded-[10px] p-[10px] border border-blue-100 gap-[8px]">
                                <View className="flex-row items-center gap-[8px]">
                                  <TouchableOpacity
                                    onPress={() => setActiveServiceTarget({ type: 'package', pkgIndex: idx, serviceIndex: sIdx })}
                                    activeOpacity={0.7}
                                    className="flex-1 flex-row items-center justify-between bg-slate-50 rounded-[8px] px-[10px] py-[8px] border border-slate-200">
                                    <Text
                                      numberOfLines={1}
                                      className={`text-[12px] font-semibold flex-1 ${foundSub ? 'text-slate-900' : 'text-slate-400 font-normal'}`}>
                                      {foundSub ? foundSub.name : '-- Chọn dịch vụ --'}
                                    </Text>
                                    <Feather name="chevron-down" size={14} color="#64748B" />
                                  </TouchableOpacity>

                                  <View className="w-[48px] h-[36px] bg-white border border-slate-300 rounded-[8px] justify-center items-center">
                                    <TextInput
                                      keyboardType="numeric"
                                      value={formatNumberInput(String(serviceItem.quantity || 1))}
                                      onChangeText={(txt) =>
                                        updatePackageService(idx, sIdx, 'quantity', parseNumberInput(txt) || 1)
                                      }
                                      className="w-full h-full text-center text-[13px] font-bold text-slate-900"
                                    />
                                  </View>

                                  <TouchableOpacity
                                    onPress={() => removePackageService(idx, sIdx)}
                                    activeOpacity={0.7}
                                    className="p-[6px]">
                                    <Feather name="trash-2" size={16} color="#F87171" />
                                  </TouchableOpacity>
                                </View>

                                {/* Brief jobs for package sub-service */}
                                {briefJobs.map((job) => (
                                  <View key={job.jobId} className="pt-[6px] border-t border-t-slate-100 gap-[6px]">
                                    <TouchableOpacity
                                      onPress={() =>
                                        setPackageServiceJobIncluded(idx, sIdx, job.jobId, !job.included)
                                      }
                                      activeOpacity={0.7}
                                      className="flex-row items-center gap-[8px]">
                                      <Feather
                                        name={job.included ? 'check-square' : 'square'}
                                        size={16}
                                        color={job.included ? '#2563EB' : '#94A3B8'}
                                      />
                                      <Text className="text-[12px] font-semibold text-blue-900">
                                        Thêm công việc: {job.name}
                                      </Text>
                                    </TouchableOpacity>

                                    {job.included && (
                                      <View className="mt-[2px]">
                                        <Text className="text-[11px] font-bold text-slate-700 mb-[4px]">
                                          Brief cho {job.name} <Text className="text-[#EF4444]">*</Text>
                                        </Text>
                                        <TextInput
                                          multiline
                                          numberOfLines={3}
                                          textAlignVertical="top"
                                          value={job.briefVideo || ''}
                                          onChangeText={(txt) =>
                                            setPackageServiceJobBrief(idx, sIdx, job.jobId, txt)
                                          }
                                          placeholder="Nhập brief khách hàng để thực hiện video AI demo..."
                                          placeholderTextColor="#94A3B8"
                                          className="w-full min-h-[70px] bg-slate-50 border border-slate-200 rounded-[8px] p-[8px] text-[12px] text-slate-900"
                                        />
                                      </View>
                                    )}
                                  </View>
                                ))}
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
                <Text className="text-[11px] font-extrabold text-slate-400 tracking-[0.8px] mb-[8px]">DỊCH VỤ LẺ</Text>
                <TouchableOpacity
                  onPress={handleAddService}
                  activeOpacity={0.7}
                  className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]">
                  <Feather name="plus" size={14} color="#6366F1" />
                  <Text style={{ color: '#6366F1' }} className="text-[13px] font-semibold text-blue-600">Dịch vụ lẻ</Text>
                </TouchableOpacity>
              </View>

              {services.map((row, idx) => {
                const selectedServ = availableServices.find((s) => String(s.id) === String(row.serviceId));
                const briefJobs = (row.jobs || []).filter((j) => j.isBriefVideo);

                return (
                  <View key={idx} className="bg-slate-50 rounded-[12px] p-[10px] border border-slate-200 mb-[8px] gap-[8px]">
                    <View className="flex-row items-center gap-[8px]">
                      <TouchableOpacity
                        onPress={() => setActiveServiceTarget({ type: 'standalone', index: idx })}
                        activeOpacity={0.7}
                        className="flex-1 flex-row items-center justify-between bg-white rounded-[8px] px-[12px] py-[9px] border border-slate-300">
                        <Text
                          numberOfLines={1}
                          className={`text-[13px] font-semibold flex-1 ${selectedServ ? 'text-slate-900' : 'text-slate-400 font-normal'}`}>
                          {selectedServ ? selectedServ.name : '-- Chọn dịch vụ --'}
                        </Text>
                        <Feather name="chevron-down" size={16} color="#64748B" />
                      </TouchableOpacity>

                      <View className="w-[52px] h-[38px] bg-white border border-slate-300 rounded-[8px] justify-center items-center">
                        <TextInput
                          keyboardType="numeric"
                          value={formatNumberInput(String(row.quantity))}
                          onChangeText={(txt) => handleServiceQuantityChange(idx, parseNumberInput(txt) || 1)}
                          className="w-full h-full text-center text-[14px] font-bold text-slate-900"
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRemoveService(idx)}
                        activeOpacity={0.7}
                        className="p-[6px]">
                        <Feather name="trash-2" size={18} color="#F87171" />
                      </TouchableOpacity>
                    </View>

                    {/* Brief jobs for standalone service */}
                    {briefJobs.map((job) => (
                      <View key={job.jobId} className="pt-[6px] border-t border-t-slate-200 gap-[6px]">
                        <TouchableOpacity
                          onPress={() => setServiceJobIncluded(idx, job.jobId, !job.included)}
                          activeOpacity={0.7}
                          className="flex-row items-center gap-[8px]">
                          <Feather
                            name={job.included ? 'check-square' : 'square'}
                            size={16}
                            color={job.included ? '#2563EB' : '#94A3B8'}
                          />
                          <Text className="text-[12px] font-semibold text-slate-800">
                            Thêm công việc: {job.name}
                          </Text>
                        </TouchableOpacity>

                        {job.included && (
                          <View className="mt-[2px]">
                            <Text className="text-[11px] font-bold text-slate-700 mb-[4px]">
                              Brief cho {job.name} <Text className="text-[#EF4444]">*</Text>
                            </Text>
                            <TextInput
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={job.briefVideo || ''}
                              onChangeText={(txt) => setServiceJobBrief(idx, job.jobId, txt)}
                              placeholder="Nhập brief khách hàng để thực hiện video AI demo..."
                              placeholderTextColor="#94A3B8"
                              className="w-full min-h-[70px] bg-white border border-slate-300 rounded-[8px] p-[8px] text-[12px] text-slate-900"
                            />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            {/* C. TỔNG GIÁ VỐN GRADIENT BANNER (Y chang bên Web) */}
            <View className={["mt-[12px] bg-[#6D28D9] rounded-[12px] px-[16px] py-[14px] flex-row items-center justify-between", isSmallScreen && "flex-col items-start gap-[4px]"].filter(Boolean).join(" ")}>
              <Text className="text-[12px] font-medium text-white flex-1">
                Tổng giá vốn của các dịch vụ đã chọn:
              </Text>
              <Text style={isSmallScreen && { fontSize: 17, marginTop: 4 }} className="text-[20px] font-extrabold text-white">
                {formatVNDFull(totalServicesCost)}
              </Text>
            </View>
          </View>

          {/* 6. YÊU CẦU & TÀI LIỆU */}
          <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
            <View className="flex-row items-center mb-[16px] gap-[12px]">
              <View style={{ backgroundColor: '#EDE9FE' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
                <Text style={{ color: '#7C3AED' }} className="text-[14px] font-bold">6</Text>
              </View>
              <View>
                <Text className="text-[15px] font-bold text-slate-900">Yêu cầu & Tài liệu</Text>
                <Text className="text-[12px] text-slate-500 mt-[2px]">Tài liệu mô tả yêu cầu khách hàng & tệp đính kèm</Text>
              </View>
            </View>

            {/* Tài liệu mô tả yêu cầu khách hàng */}
            <View className="mb-[16px]">
              <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">Tài liệu mô tả yêu cầu khách hàng</Text>
            </View>

            {/* Link tài liệu tham khảo */}
            <View className="flex-row justify-between items-center mb-[10px]">
              <Text className="text-[13px] font-bold text-slate-800">Link tài liệu tham khảo</Text>
              <TouchableOpacity

              onPress={handleAddLink}
              activeOpacity={0.7} className="flex-row items-center px-[8px] py-[5px] rounded-[6px] bg-blue-50 gap-[4px]">
              
                <Feather name="plus" size={14} color={BrandColors.primary} />
                <Text className="text-[12px] font-semibold">Thêm link</Text>
              </TouchableOpacity>
            </View>

            {links.map((linkVal, idx) => {
            const placeholder = DEFAULT_LINK_PLACEHOLDERS[idx % DEFAULT_LINK_PLACEHOLDERS.length];
            return (
              <View key={idx} className="flex-row items-center mb-[8px]">
                  <Feather name="link-2" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                  style={{ flex: 1 }}
                  placeholder={placeholder}
                  placeholderTextColor="#94A3B8"
                  value={linkVal}
                  onChangeText={(t) => handleUpdateLink(idx, t)}
                  autoCapitalize="none" className="bg-slate-50 border border-slate-300 rounded-[10px] px-[12px] py-[10px] text-[14px] text-slate-900" />
                
                  {links.length > 1 &&
                <TouchableOpacity

                  onPress={() => handleRemoveLink(idx)} className="ml-[8px] p-[6px]">
                  
                      <Feather name="x" size={16} color="#EF4444" />
                    </TouchableOpacity>
                }
                </View>);

          })}

            {/* Tệp đính kèm */}
            <View style={{ marginTop: 18 }} className="flex-row justify-between items-center mb-[10px]">
              <Text className="text-[13px] font-bold text-slate-800">
                Tệp đính kèm ({attachedFiles.length}/5)
              </Text>
              <TouchableOpacity

              onPress={handlePickDocument}
              activeOpacity={0.8} className="flex-row items-center px-[10px] py-[6px] rounded-[6px] bg-blue-600 gap-[6px]">
              
                <Feather name="paperclip" size={14} color="#FFFFFF" />
                <Text className="text-[12px] font-semibold text-white">Chọn tệp từ máy</Text>
              </TouchableOpacity>
            </View>

            {attachedFiles.length > 0 ?
          <View className="gap-[6px] mt-[6px]">
                {attachedFiles.map((file, idx) =>
            <View key={idx} className="flex-row items-center bg-slate-50 rounded-[8px] p-[10px] border border-slate-200 gap-[10px]">
                    <View className="w-[32px] h-[32px] rounded-[6px] bg-blue-50 justify-center items-center">
                      <Feather name="file" size={16} color={BrandColors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-[13px] font-semibold text-slate-900">
                        {file.name}
                      </Text>
                      <Text className="text-[11px] text-slate-500 mt-[2px]">
                        {formatFileSize(file.size)}
                      </Text>
                    </View>
                    <TouchableOpacity

                onPress={() => handleRemoveFile(idx)}
                activeOpacity={0.7} className="p-[6px]">
                
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
            )}
              </View> :

          <TouchableOpacity

            onPress={handlePickDocument}
            activeOpacity={0.7} className="border-[1.5px] border-dashed border-slate-300 rounded-[10px] p-[20px] items-center bg-slate-50 mt-[6px]">
            
                <Feather name="upload-cloud" size={24} color="#94A3B8" />
                <Text className="text-[13px] font-semibold text-slate-600 mt-[8px]">Kéo thả file hoặc click để chọn</Text>
                <Text className="text-[11px] text-slate-400 text-center mt-[4px] leading-[15px]">
                  Tối đa 5 file, tổng dung lượng 25MB{'\n'}PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
                </Text>
              </TouchableOpacity>
          }
          </View>

          <View style={{ height: 60 }} />
        </KeyboardAwareScrollView>

        {/* Fixed Sticky Action Bar at Bottom */}
        <View
        style={

        {
          paddingBottom: isKeyboardVisible ? 8 : Math.max(12, insets.bottom),
          paddingTop: isKeyboardVisible ? 8 : 12
        }} className="px-[16px] py-[12px] bg-white border-t border-t-slate-200">

        
          <View style={isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' }} className="flex-row items-center justify-between w-full gap-[12px]">

            <TouchableOpacity

            onPress={handleManualSaveDraft}
            activeOpacity={0.8} className="flex-1 flex-row items-center justify-center py-[12px] rounded-[10px] bg-slate-100 border border-slate-200 gap-[6px]">
            
              <Feather name="save" size={16} color="#475569" />
              <Text className="text-[13px] font-semibold text-slate-600">Lưu nháp</Text>
            </TouchableOpacity>

            <TouchableOpacity

            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85} className={["flex-[2] flex-row items-center justify-center py-[12px] rounded-[10px] bg-emerald-600 gap-[6px]", isSubmitting && "opacity-[0.6]"].filter(Boolean).join(" ")}>
            
              {isSubmitting ?
            <ActivityIndicator size="small" color="#FFFFFF" /> :

            <>
                  <Feather name="check-circle" size={18} color="#FFFFFF" />
                  <Text className="text-[14px] font-bold text-white">Tạo Cơ Hội</Text>
                </>
            }
            </TouchableOpacity>
          </View>
        </View>

      {/* Shared Calendar Picker Modal */}
      <DatePickerModal
        visible={activeDatePicker !== null}
        title={activeDatePicker === 'start' ? 'Chọn ngày dự kiến bắt đầu' : 'Chọn ngày dự kiến kết thúc'}
        initialDate={activeDatePicker === 'start' ? startDate : endDate}
        onConfirm={(_, formattedYYYYMMDD) => {
          const selectedStr = toDisplayDate(formattedYYYYMMDD);
          if (activeDatePicker === 'start') {
            setStartDate(selectedStr);
          } else {
            setEndDate(selectedStr);
          }
          setActiveDatePicker(null);
        }}
        onClose={() => setActiveDatePicker(null)} />
      

      {/* Field Selection Modal */}
      <Modal
        visible={isFieldModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFieldModalVisible(false)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.45)] justify-center items-center p-[20px]">
          <View
            style={

            {
              width: isTablet ? 520 : Math.min(width * 0.94, 420),
              maxHeight: isLandscape ? height * 0.88 : '80%'
            }} className="w-full max-h-[80%] bg-white rounded-[16px] p-[16px] shadow-lg">

            
            <View className="flex-row justify-between items-center pb-[12px] border-b border-b-slate-200">
              <Text className="text-[16px] font-bold text-slate-900">Chọn lĩnh vực kinh doanh</Text>
              <TouchableOpacity
                onPress={() => setIsFieldModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              {FIELDS.map((f) => {
                const isSelected = field === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}

                    onPress={() => {
                      setField(f.value);
                      setIsFieldModalVisible(false);
                    }} className={["flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100", isSelected && "bg-blue-50 rounded-[8px]"].filter(Boolean).join(" ")}>
                    
                    <Text className={["text-[14px] text-slate-700",


                    isSelected && "text-blue-600 font-semibold"].filter(Boolean).join(" ")}>

                      
                      {f.label}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>);

              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Region Selection Modal */}
      <Modal
        visible={isRegionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRegionModalVisible(false)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.45)] justify-center items-center p-[20px]">
          <View
            style={

            {
              width: isTablet ? 520 : Math.min(width * 0.94, 420),
              maxHeight: isLandscape ? height * 0.88 : '80%'
            }} className="w-full max-h-[80%] bg-white rounded-[16px] p-[16px] shadow-lg">

            
            <View className="flex-row justify-between items-center pb-[12px] border-b border-b-slate-200">
              <Text className="text-[16px] font-bold text-slate-900">Chọn địa điểm triển khai</Text>
              <TouchableOpacity
                onPress={() => setIsRegionModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              {PROVINCES_LIST.map((reg) => {
                const isSelected = selectedRegions.includes(reg);
                return (
                  <TouchableOpacity
                    key={reg}

                    onPress={() => handleToggleRegion(reg)} className={["flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100", isSelected && "bg-blue-50 rounded-[8px]"].filter(Boolean).join(" ")}>
                    
                    <Text className={["text-[14px] text-slate-700",


                    isSelected && "text-blue-600 font-semibold"].filter(Boolean).join(" ")}>

                      
                      {reg}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#2563EB" />}
                  </TouchableOpacity>);

              })}
            </ScrollView>

            <View className="pt-[10px] border-t border-t-slate-200">
              <TouchableOpacity

                onPress={() => setIsRegionModalVisible(false)} className="bg-blue-600 py-[12px] rounded-[8px] items-center">
                
                <Text className="text-white font-bold text-[14px]">
                  Xác nhận ({selectedRegions.length} đã chọn)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Package Template Selection Modal */}
      <Modal
        visible={activePackageIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePackageIndex(null)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.45)] justify-center items-center p-[20px]">
          <View
            style={

            {
              width: isTablet ? 520 : Math.min(width * 0.94, 420),
              maxHeight: isLandscape ? height * 0.88 : '80%'
            }} className="w-full max-h-[80%] bg-white rounded-[16px] p-[16px] shadow-lg">

            
            <View className="flex-row justify-between items-center pb-[12px] border-b border-b-slate-200">
              <Text className="text-[16px] font-bold text-slate-900">Chọn gói dịch vụ mẫu</Text>
              <TouchableOpacity
                onPress={() => setActivePackageIndex(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              <TouchableOpacity

                onPress={() => {
                  if (activePackageIndex !== null) handleSelectPackageTemplate(activePackageIndex, '');
                }} className="flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100">
                
                <Text className="text-[14px] text-slate-700">-- Chọn gói mẫu --</Text>
              </TouchableOpacity>

              {availablePackages.map((pkg) =>
              <TouchableOpacity
                key={pkg.id}

                onPress={() => {
                  if (activePackageIndex !== null) handleSelectPackageTemplate(activePackageIndex, pkg.id);
                }} className="flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100">
                
                  <View style={{ flex: 1 }}>
                    <Text className="text-[14px] font-semibold text-slate-900">{pkg.name}</Text>
                    {pkg.description ?
                  <Text numberOfLines={2} className="text-[12px] text-slate-500 mt-[2px]">
                        {pkg.description}
                      </Text> :
                  null}
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Selection Modal (Supports both Standalone and Package Sub-Services) */}
      <Modal
        visible={activeServiceTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveServiceTarget(null)}>
        
        <View className="flex-1 bg-[rgba(0,_0,_0,_0.45)] justify-center items-center p-[20px]">
          <View
            style={{
              width: isTablet ? 520 : Math.min(width * 0.94, 420),
              maxHeight: isLandscape ? height * 0.88 : '80%'
            }}
            className="w-full max-h-[80%] bg-white rounded-[16px] p-[16px] shadow-lg">
            
            <View className="flex-row justify-between items-center pb-[12px] border-b border-b-slate-200">
              <Text className="text-[16px] font-bold text-slate-900">
                {activeServiceTarget?.type === 'package' ? 'Chọn dịch vụ trong gói' : 'Chọn dịch vụ lẻ'}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveServiceTarget(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-[10px]">
              <TouchableOpacity
                onPress={() => handleSelectServiceFromModal('')}
                className="flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100">
                <Text className="text-[14px] text-slate-700">-- Chọn dịch vụ --</Text>
              </TouchableOpacity>

              {availableServices.map((serv) => (
                <TouchableOpacity
                  key={serv.id}
                  onPress={() => handleSelectServiceFromModal(serv.id)}
                  className="flex-row items-center justify-between py-[12px] px-[8px] border-b border-b-slate-100">
                  <View style={{ flex: 1 }}>
                    <Text className="text-[14px] font-semibold text-slate-900">{serv.name}</Text>
                    {serv.costPrice ? (
                      <Text className="text-[12px] text-slate-500 mt-[2px]">
                        Giá vốn: {formatVNDFull(serv.costPrice)}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>);

}
