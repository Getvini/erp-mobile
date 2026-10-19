import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { BrandColors } from '@/constants/colors';
import { CreateOpportunityPayload } from '@/services/opportunityService';
import {
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useOpportunityDetailQuery,
} from '@/hooks/queries/useOpportunities';
import { isValidUrl, normalizeUrl } from '@/utils/validators';
import {
  useOpportunityFormStore,
  AttachedFile,
  SelectedPackage,
  SelectedService,
  OpportunityFormData,
} from '@/stores/useOpportunityFormStore';

import {
  STORAGE_DRAFT_KEY,
  FIELDS,
  PRIORITIES,
  PROVINCES_LIST,
  DEFAULT_LINK_PLACEHOLDERS,
  formatVNDInput,
  parseVNDInput,
  formatDateInputMask,
  validateDateString,
  parseDateObj,
  toISODate,
  toDisplayDate,
  calculateDurationMonths,
  formatMonthYear,
  getSuccessChanceMeta,
  formatFileSize,
  Step1BasicInfo,
  Step2Financial,
  Step3TimeLocation,
  Step4Evaluation,
  Step5ServicesPackages,
  Step6RequirementsAttachments,
} from '@/components/opportunities/wizard';

// Re-export constants & types for backward compatibility
export type { AttachedFile, SelectedPackage, SelectedService, OpportunityFormData };
export {
  STORAGE_DRAFT_KEY,
  FIELDS,
  PRIORITIES,
  PROVINCES_LIST,
  DEFAULT_LINK_PLACEHOLDERS,
  formatVNDInput,
  parseVNDInput,
  formatDateInputMask,
  validateDateString,
  parseDateObj,
  toISODate,
  toDisplayDate,
  calculateDurationMonths,
  getSuccessChanceMeta,
};

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const { mode, cloneFromId, editId } = useLocalSearchParams<{
    mode?: string;
    cloneFromId?: string;
    editId?: string;
  }>();

  const isEditMode = mode === 'edit' && !!editId;
  const isCloneMode = !!cloneFromId;

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  // Zustand Store
  const {
    formData,
    updateFormData,
    lastSavedTime,
    setLastSavedTime,
    dateError,
    isSubmitting,
    setIsSubmitting,
    resetForm,
    setNameParts,
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
    attachedFiles,
  } = formData;

  const createOpportunityMutation = useCreateOpportunityMutation();
  const updateOpportunityMutation = useUpdateOpportunityMutation();

  // Queries for Clone and Edit
  const { data: clonedOpp, isLoading: isCloningLoading } = useOpportunityDetailQuery(
    cloneFromId ? String(cloneFromId) : ''
  );
  const { data: oppToEdit, isLoading: isEditLoading } = useOpportunityDetailQuery(
    editId ? String(editId) : ''
  );

  const [hasAppliedClone, setHasAppliedClone] = useState(false);
  const [hasAppliedEdit, setHasAppliedEdit] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const autoSaveTimerRef = useRef<any>(null);

  // Keyboard Visibility Detection
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

  // Reset form if opening clean (not in draft mode, not editing, not cloning)
  useEffect(() => {
    if (mode !== 'draft' && !cloneFromId && !isEditMode) {
      resetForm();
    }
  }, [mode, cloneFromId, isEditMode]);

  // Auto-fill from cloned opportunity
  useEffect(() => {
    if (cloneFromId && clonedOpp && !hasAppliedClone) {
      setHasAppliedClone(true);

      const rawName = String(clonedOpp.name || '');
      const rawParts = rawName.split('_');
      let cust = '';
      let brand = '';
      let my = '';

      if (rawParts.length >= 3) {
        cust = rawParts[0].trim();
        brand = rawParts.slice(1, -1).join('_').trim();
        my = rawParts[rawParts.length - 1].trim();
      } else if (rawParts.length === 2) {
        cust = rawParts[0].trim();
        my = rawParts[1].trim();
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

      const standaloneServices = (clonedOpp.services || [])
        .filter((s: any) => !s.opportunityPackageId && !s.isPackageService)
        .map((s: any) => ({
          serviceId: s.serviceId || s.service?.id || s.id || '',
          quantity: Number(s.quantity) || 1,
        }));

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

      const attachments = clonedOpp.attachments || [];
      const linkUrls = attachments.filter((a: any) => a.type === 'LINK').map((a: any) => a.url);
      const paddedLinks = linkUrls.length >= 3 ? linkUrls : [...linkUrls, ...Array(3 - linkUrls.length).fill('')];

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

  // Auto-fill when in EDIT mode (?mode=edit&editId=...)
  useEffect(() => {
    if (isEditMode && oppToEdit && !hasAppliedEdit) {
      setHasAppliedEdit(true);

      const rawName = String(oppToEdit.name || '');
      const rawParts = rawName.split('_');
      let cust = '';
      let brand = '';
      let my = '';

      if (rawParts.length >= 3) {
        cust = rawParts[0].trim();
        brand = rawParts.slice(1, -1).join('_').trim();
        my = rawParts[rawParts.length - 1].trim();
      } else if (rawParts.length === 2) {
        cust = rawParts[0].trim();
        my = rawParts[1].trim();
      } else {
        cust = rawName.trim();
      }

      if (oppToEdit.customer?.name) {
        cust = oppToEdit.customer.name;
      } else if (oppToEdit.leadName) {
        cust = oppToEdit.leadName;
      }

      setNameParts({
        customerName: cust,
        brandName: brand,
        monthYear: my,
      });

      const standaloneServices = (oppToEdit.services || [])
        .filter((s: any) => !s.opportunityPackageId && !s.isPackageService)
        .map((s: any) => ({
          serviceId: s.serviceId || s.service?.id || s.id || '',
          quantity: Number(s.quantity) || 1,
        }));

      const mappedPackages = (oppToEdit.packages || []).map((pkg: any) => ({
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

      const attachments = oppToEdit.attachments || [];
      const linkUrls = attachments.filter((a: any) => a.type === 'LINK').map((a: any) => a.url);
      const paddedLinks = linkUrls.length >= 3 ? linkUrls : [...linkUrls, ...Array(3 - linkUrls.length).fill('')];

      const regionList = Array.isArray(oppToEdit.region)
        ? oppToEdit.region
        : typeof oppToEdit.region === 'string' && oppToEdit.region
        ? [oppToEdit.region]
        : [];

      updateFormData({
        description: oppToEdit.description || '',
        field: oppToEdit.field || '',
        expectedRevenue: Number(oppToEdit.expectedRevenue) || 0,
        budget: Number(oppToEdit.budget) || 0,
        startDate: oppToEdit.startDate ? toDisplayDate(oppToEdit.startDate) : '',
        endDate: oppToEdit.endDate ? toDisplayDate(oppToEdit.endDate) : '',
        durationMonths: Number(oppToEdit.durationMonths) || 1,
        priority: oppToEdit.priority || 'Medium',
        successChance: Number(oppToEdit.successChance) || 0,
        selectedRegions: regionList,
        customerRequirements: oppToEdit.customerRequirements || '',
        services: standaloneServices.length > 0 ? standaloneServices : [{ serviceId: '', quantity: 1 }],
        packages: mappedPackages.length > 0 ? mappedPackages : [{ servicePackageId: '', quantity: 1 }],
        links: paddedLinks.length > 0 ? paddedLinks : ['', '', ''],
      });
    }
  }, [isEditMode, oppToEdit, hasAppliedEdit]);

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
                monthYear: parts.length >= 2 ? parts[parts.length - 1]?.trim() || '' : '',
              };
            }

            updateFormData({
              ...d,
              ...(restoredNameParts ? { nameParts: restoredNameParts } : {}),
              expectedRevenue: typeof d.expectedRevenue === 'number' ? d.expectedRevenue : parseVNDInput(d.expectedRevenue),
              budget: typeof d.budget === 'number' ? d.budget : parseVNDInput(d.budget),
              startDate: d.startDate ? toDisplayDate(d.startDate) : '',
              endDate: d.endDate ? toDisplayDate(d.endDate) : '',
              durationMonths: Number(d.durationMonths) || 1,
              successChance: Number(d.successChance) || 0,
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
        }
      }
    };

    restoreDraftIfRequested();
  }, [mode]);

  // Auto-Save Debounce Effect
  useEffect(() => {
    if (isEditMode) return; // Do not overwrite local draft when editing directly on server
    if (!name && !description && attachedFiles.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      const draftData = {
        ...formData,
        savedAt: new Date().toISOString(),
      };

      try {
        await AsyncStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draftData));
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        );
      } catch {
        // Ignore
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, isEditMode]);

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
      ...packages.flatMap((pkg) => pkg.services || []),
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
          jobs: s.jobs || [],
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
              jobs: s.jobs || [],
            })),
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
        packages: validPackages.length > 0 ? validPackages : undefined,
      };

      if (isEditMode && editId) {
        await updateOpportunityMutation.mutateAsync({ id: editId, payload });
        Alert.alert('Thành công', 'Đã cập nhật cơ hội kinh doanh thành công!', [
          {
            text: 'Xem chi tiết',
            onPress: () => router.replace(`/opportunities/${editId}`),
          },
        ]);
        return;
      }

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
          },
        },
        {
          text: 'Về trang chủ',
          style: 'cancel',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu cơ hội kinh doanh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSaveDraft = async () => {
    const draftData = {
      ...formData,
      savedAt: new Date().toISOString(),
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

  const isSaving = isSubmitting || updateOpportunityMutation.isPending;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-[16px] py-[12px] bg-white border-b border-b-slate-200">
        <View
          style={isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' }}
          className="flex-row items-center justify-between w-full"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="w-[36px] h-[36px] rounded-[18px] bg-slate-100 justify-center items-center"
          >
            <Feather name="x" size={20} color="#1E293B" />
          </TouchableOpacity>

          <View className="flex-1 ml-[12px]">
            <Text className="text-[17px] font-bold text-slate-900" numberOfLines={1}>
              {isEditMode
                ? 'Chỉnh Sửa Cơ Hội'
                : isCloneMode
                ? 'Sao Chép Cơ Hội'
                : mode === 'draft'
                ? 'Chỉnh Sửa Bản Nháp'
                : 'Tạo Cơ Hội Mới'}
            </Text>
            <View className="flex-row items-center mt-[2px]">
              {lastSavedTime && !isEditMode ? (
                <View className="flex-row items-center bg-emerald-100 px-[6px] py-[2px] rounded-[4px] gap-[4px]">
                  <Feather name="cloud" size={11} color="#059669" />
                  <Text className="text-[10px] font-semibold text-emerald-600">
                    Đã lưu {lastSavedTime}
                  </Text>
                </View>
              ) : (
                <Text className="text-[12px] text-slate-500 mt-[2px]">
                  {isEditMode
                    ? 'Cập nhật lại các thông tin của cơ hội'
                    : isCloneMode
                    ? 'Tạo cơ hội tương tự từ hồ sơ sẵn có'
                    : mode === 'draft'
                    ? 'Chỉnh sửa thông tin bản nháp'
                    : 'Điền thông tin chi tiết của cơ hội'}
                </Text>
              )}
            </View>
          </View>

          {!isEditMode && (
            <TouchableOpacity
              onPress={handleManualSaveDraft}
              activeOpacity={0.7}
              className="flex-row items-center px-[10px] py-[6px] rounded-[8px] bg-blue-50 gap-[4px]"
            >
              <Feather name="save" size={15} color={BrandColors.primary} />
              <Text className="text-[12px] font-semibold text-blue-600">Lưu nháp</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerClassName="p-[16px] gap-[16px]"
        contentContainerStyle={[
          isSmallScreen && { padding: 12, gap: 10 },
          isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' },
          { paddingBottom: isKeyboardVisible ? 100 : 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 70 : 100}
        extraHeight={100}
      >
        {/* Banner trạng thái sao chép cơ hội */}
        {isCloneMode && isCloningLoading && (
          <View className="flex-row items-center gap-2.5 bg-blue-50 border border-blue-200 p-3.5 rounded-2xl mb-2">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text className="text-xs text-blue-700 font-semibold flex-1">
              Đang nạp dữ liệu từ cơ hội gốc...
            </Text>
          </View>
        )}
        {isCloneMode && !isCloningLoading && clonedOpp && (
          <View className="flex-row items-center gap-2.5 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl mb-1">
            <Feather name="check-circle" size={16} color="#059669" />
            <Text className="text-xs text-emerald-800 font-semibold flex-1">
              Đã sao chép dữ liệu từ cơ hội "{clonedOpp.name}". Hãy kiểm tra lại và nhấn tạo mới.
            </Text>
          </View>
        )}

        {/* Banner trạng thái chỉnh sửa cơ hội */}
        {isEditMode && isEditLoading && (
          <View className="flex-row items-center gap-2.5 bg-blue-50 border border-blue-200 p-3.5 rounded-2xl mb-2">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text className="text-xs text-blue-700 font-semibold flex-1">
              Đang tải dữ liệu cơ hội...
            </Text>
          </View>
        )}

        {/* 1. THÔNG TIN CƠ BẢN */}
        <Step1BasicInfo />

        {/* 2. THÔNG TIN TÀI CHÍNH */}
        <Step2Financial />

        {/* 3. THỜI GIAN & ĐỊA ĐIỂM */}
        <Step3TimeLocation />

        {/* 4. ĐÁNH GIÁ CƠ HỘI */}
        <Step4Evaluation />

        {/* 5. DỊCH VỤ ĐỀ XUẤT */}
        <Step5ServicesPackages />

        {/* 6. YÊU CẦU & TÀI LIỆU */}
        <Step6RequirementsAttachments />

        <View style={{ height: 60 }} />
      </KeyboardAwareScrollView>

      {/* Fixed Sticky Action Bar at Bottom */}
      <View
        style={{
          paddingBottom: isKeyboardVisible ? 8 : Math.max(12, insets.bottom),
          paddingTop: isKeyboardVisible ? 8 : 12,
        }}
        className="px-[16px] py-[12px] bg-white border-t border-t-slate-200"
      >
        <View
          style={isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' }}
          className="flex-row items-center justify-between w-full gap-[12px]"
        >
          {!isEditMode && (
            <TouchableOpacity
              onPress={handleManualSaveDraft}
              activeOpacity={0.8}
              className="flex-1 flex-row items-center justify-center py-[12px] rounded-[10px] bg-slate-100 border border-slate-200 gap-[6px]"
            >
              <Feather name="save" size={16} color="#475569" />
              <Text className="text-[13px] font-semibold text-slate-600">Lưu nháp</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSaving}
            activeOpacity={0.85}
            className={[
              'flex-[2] flex-row items-center justify-center py-[12px] rounded-[10px] bg-emerald-600 gap-[6px]',
              isSaving && 'opacity-[0.6]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check-circle" size={18} color="#FFFFFF" />
                <Text className="text-[14px] font-bold text-white">
                  {isEditMode ? 'Lưu Thay Đổi' : 'Tạo Cơ Hội'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
