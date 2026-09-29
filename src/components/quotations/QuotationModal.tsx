import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
} from '@/hooks/queries/useQuotations';
import { useAvailableServicesQuery } from '@/hooks/queries/useOpportunities';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import {
  formatVND,
  formatNumberInput,
  parseNumberInput,
} from '@/utils/formatters';

export interface EditableQuotationItem {
  _tempId: string;
  serviceId: string;
  name: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  servicePackageId?: string;
  packageName?: string;
  isPackageService?: boolean;
}

export interface QuotationModalProps {
  visible: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityName?: string;
  editQuotation?: any | null;
  onSuccess?: (quotationId?: string) => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  visible,
  onClose,
  opportunityId,
  opportunityName,
  editQuotation,
  onSuccess,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height && width >= 560;

  const isEditMode = Boolean(editQuotation?.id);
  const createMutation = useCreateQuotationMutation();
  const updateMutation = useUpdateQuotationMutation();

  const { data: servicesData = [], isLoading: isLoadingServices } = useAvailableServicesQuery();
  const { data: packagesData = [], isLoading: isLoadingPackages } = useServicePackagesQuery();

  const [items, setItems] = useState<EditableQuotationItem[]>([]);
  const [note, setNote] = useState('');
  const [vatRate, setVatRate] = useState(8); // 8% VAT chuẩn
  const [discountAmountInput, setDiscountAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selector modal state
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Sync edit mode or initial data
  useEffect(() => {
    if (visible && editQuotation) {
      setNote(editQuotation.note || editQuotation.description || '');
      const loaded: EditableQuotationItem[] = (editQuotation.details || []).map(
        (d: any, idx: number) => ({
          _tempId: d.id || `edit_${idx}_${Date.now()}`,
          serviceId: d.serviceId || d.service?.id || '',
          name: d.name || d.service?.name || `Dịch vụ #${idx + 1}`,
          unit: d.service?.unit || d.unit || '',
          costPrice: Number(d.costAtSale || d.costPrice || 0),
          sellingPrice: Number(d.sellingPrice || 0),
          quantity: Number(d.quantity || 1),
          servicePackageId: d.servicePackageId,
          packageName: d.packageName,
          isPackageService: Boolean(d.isPackageService),
        })
      );
      setItems(loaded);
    } else if (visible && !editQuotation) {
      setItems([]);
      setNote('');
      setDiscountAmountInput('');
    }
  }, [visible, editQuotation]);

  // Tính toán số tiền: CHỈ làm tròn giá bán, KHÔNG làm tròn VAT hay thành tiền!
  const { subtotal, vatAmount, discountAmount, totalAmount } = useMemo(() => {
    let sub = 0;
    items.forEach((item) => {
      // Giá bán làm tròn Math.round
      const roundedSellingPrice = Math.round(Number(item.sellingPrice || 0));
      sub += roundedSellingPrice * Number(item.quantity || 1);
    });

    const disc = parseNumberInput(discountAmountInput);
    // VAT 8% TUYỆT ĐỐI KHÔNG làm tròn
    const vat = sub * (vatRate / 100);
    // Thành tiền giữ nguyên độ chính xác nguyên bản
    const total = sub + vat - disc;

    return {
      subtotal: sub,
      vatAmount: vat,
      discountAmount: disc,
      totalAmount: Math.max(0, total),
    };
  }, [items, vatRate, discountAmountInput]);

  // Thêm dịch vụ đơn lẻ
  const handleAddService = (service: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cost = Number(service.costPrice || 0);
    const defaultSelling = Math.round(cost > 0 ? cost / 0.6 : 0); // Lợi nhuận kỳ vọng

    setItems((prev) => [
      ...prev,
      {
        _tempId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        serviceId: service.id,
        name: service.name,
        unit: service.unit,
        costPrice: cost,
        sellingPrice: defaultSelling,
        quantity: 1,
      },
    ]);
    setShowItemPicker(false);
  };

  // Thêm gói dịch vụ
  const handleAddPackage = (pkg: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newItems: EditableQuotationItem[] = (pkg.services || []).map((s: any, idx: number) => {
      const srv = s.service || {};
      const cost = Number(srv.costPrice || s.costPrice || 0);
      const selling = Math.round(Number(s.sellingPrice || (cost > 0 ? cost / 0.6 : 0)));

      return {
        _tempId: `pkg_${pkg.id}_${idx}_${Date.now()}`,
        serviceId: s.serviceId || srv.id,
        name: `${pkg.name} - ${srv.name || 'Dịch vụ'}`,
        unit: srv.unit || s.unit,
        costPrice: cost,
        sellingPrice: selling,
        quantity: Number(s.quantity || 1),
        servicePackageId: pkg.id,
        packageName: pkg.name,
        isPackageService: true,
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    setShowItemPicker(false);
  };

  // Xóa mục
  const handleRemoveItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cập nhật giá bán hoặc số lượng
  const handleUpdateItem = (
    index: number,
    field: 'sellingPrice' | 'quantity',
    value: number
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === 'sellingPrice') {
        copy[index].sellingPrice = Math.round(value); // CHỈ làm tròn giá bán
      } else {
        copy[index].quantity = Math.max(1, value);
      }
      return copy;
    });
  };

  // Submit form
  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Chưa có dịch vụ', 'Vui lòng chọn ít nhất một dịch vụ hoặc gói dịch vụ vào báo giá.');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const payload = {
        opportunityId,
        note: note.trim() || undefined,
        details: items.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          sellingPrice: Math.round(item.sellingPrice),
          costAtSale: item.costPrice,
          name: item.name,
          servicePackageId: item.servicePackageId,
          packageName: item.packageName,
          isPackageService: item.isPackageService,
        })),
      };

      let resultId = '';
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: editQuotation.id, payload });
        resultId = editQuotation.id;
        Alert.alert('Thành công', 'Đã cập nhật báo giá thành công!');
      } else {
        const res = await createMutation.mutateAsync(payload);
        resultId = res?.id || '';
        Alert.alert('Thành công', 'Đã lập báo giá mới thành công!');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      onSuccess?.(resultId);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu báo giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            isLandscape && styles.sheetLandscape,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Handle bar vuốt đóng */}
          <View style={styles.dragBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Feather name="file-text" size={18} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {isEditMode ? `Chỉnh sửa báo giá v${editQuotation?.version || 1}` : 'Lập báo giá mới'}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {opportunityName ? `Cơ hội: ${opportunityName}` : 'Dự toán báo giá khách hàng'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Header Card Danh sách Hạng mục */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Các hạng mục dịch vụ ({items.length})
              </Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setShowItemPicker(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={14} color="#EA580C" />
                <Text style={styles.addItemBtnText}>Thêm dịch vụ / Gói</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Feather name="inbox" size={32} color="#CBD5E1" />
                <Text style={styles.emptyItemsTitle}>Chưa có dịch vụ nào trong báo giá</Text>
                <Text style={styles.emptyItemsDesc}>
                  Bấm "Thêm dịch vụ / Gói" để đưa các dịch vụ niêm yết vào báo giá.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {items.map((item, idx) => (
                  <View key={item._tempId || idx} style={styles.itemCard}>
                    <View style={styles.itemCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.packageName && (
                          <View style={styles.packageTag}>
                            <Text style={styles.packageTagText}>Gói: {item.packageName}</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(idx)}
                        style={styles.removeItemBtn}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Inputs Đơn giá & Số lượng */}
                    <View style={styles.itemInputsRow}>
                      <View style={styles.qtyCol}>
                        <Text style={styles.inputMiniLabel}>Số lượng</Text>
                        <View style={styles.qtyInputBox}>
                          <TouchableOpacity
                            onPress={() => handleUpdateItem(idx, 'quantity', item.quantity - 1)}
                            style={styles.qtyStepperBtn}
                          >
                            <Feather name="minus" size={12} color="#64748B" />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.qtyText}
                            keyboardType="numeric"
                            value={String(item.quantity)}
                            onChangeText={(t) =>
                              handleUpdateItem(idx, 'quantity', parseInt(t, 10) || 1)
                            }
                          />
                          <TouchableOpacity
                            onPress={() => handleUpdateItem(idx, 'quantity', item.quantity + 1)}
                            style={styles.qtyStepperBtn}
                          >
                            <Feather name="plus" size={12} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.priceCol}>
                        <Text style={styles.inputMiniLabel}>Đơn giá bán (VNĐ)</Text>
                        <TextInput
                          style={styles.priceInput}
                          keyboardType="numeric"
                          placeholder="0"
                          value={formatNumberInput(item.sellingPrice)}
                          onChangeText={(t) =>
                            handleUpdateItem(idx, 'sellingPrice', parseNumberInput(t))
                          }
                        />
                      </View>

                      <View style={styles.totalCol}>
                        <Text style={styles.inputMiniLabel}>Thành tiền</Text>
                        <Text style={styles.itemTotalText}>
                          {formatVND(item.sellingPrice * item.quantity)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 2. Chiết khấu & Ghi chú */}
            <View style={styles.cardBox}>
              <View style={styles.formRow}>
                <Text style={styles.boxLabel}>Chiết khấu giảm giá (VNĐ)</Text>
                <TextInput
                  style={styles.discountInput}
                  keyboardType="numeric"
                  placeholder="0"
                  value={discountAmountInput}
                  onChangeText={(t) => {
                    const n = parseNumberInput(t);
                    setDiscountAmountInput(n > 0 ? formatNumberInput(n) : '');
                  }}
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.boxLabel}>Thuế suất VAT (%)</Text>
                <View style={styles.vatToggleRow}>
                  {[0, 8, 10].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.vatBtn,
                        vatRate === rate && styles.vatBtnActive,
                      ]}
                      onPress={() => setVatRate(rate)}
                    >
                      <Text
                        style={[
                          styles.vatBtnText,
                          vatRate === rate && styles.vatBtnTextActive,
                        ]}
                      >
                        {rate}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.boxLabel}>Ghi chú / Điều khoản báo giá</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Nhập ghi chú thêm cho khách hàng..."
                  placeholderTextColor="#94A3B8"
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
              </View>
            </View>

            {/* 3. Tổng hợp Báo giá */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Tạm tính (chưa VAT):</Text>
                <Text style={styles.summaryLineValue}>{formatVND(subtotal)}</Text>
              </View>

              {discountAmount > 0 && (
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLineLabel}>Chiết khấu:</Text>
                  <Text style={[styles.summaryLineValue, { color: '#EF4444' }]}>
                    -{formatVND(discountAmount)}
                  </Text>
                </View>
              )}

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Tiền thuế VAT ({vatRate}%):</Text>
                <Text style={styles.summaryLineValue}>{formatVND(vatAmount)}</Text>
              </View>

              <View style={styles.summaryTotalLine}>
                <Text style={styles.summaryTotalLabel}>TỔNG CỘNG THANH TOÁN:</Text>
                <Text style={styles.summaryTotalValue}>{formatVND(totalAmount)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Submit Bar */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    {isEditMode ? 'Lưu cập nhật báo giá' : 'Tạo báo giá mới'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal Chọn Dịch vụ / Gói dịch vụ */}
        <Modal
          visible={showItemPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowItemPicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerBox}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Chọn Dịch Vụ Hoặc Gói</Text>
                <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.pickerScroll}>
                {/* Gói dịch vụ */}
                <Text style={styles.pickerSectionHeader}>Gói dịch vụ có sẵn</Text>
                {isLoadingPackages ? (
                  <ActivityIndicator size="small" color="#F38820" />
                ) : (
                  (packagesData || []).map((pkg: any) => (
                    <TouchableOpacity
                      key={pkg.id}
                      style={styles.pickerItem}
                      onPress={() => handleAddPackage(pkg)}
                    >
                      <MaterialCommunityIcons name="package-variant" size={16} color="#2563EB" />
                      <Text style={styles.pickerItemText}>{pkg.name}</Text>
                      <Feather name="plus-circle" size={16} color="#EA580C" />
                    </TouchableOpacity>
                  ))
                )}

                {/* Dịch vụ lẻ */}
                <Text style={styles.pickerSectionHeader}>Dịch vụ đơn lẻ</Text>
                {isLoadingServices ? (
                  <ActivityIndicator size="small" color="#F38820" />
                ) : (
                  ((servicesData as any)?.data || servicesData || []).map((srv: any) => (
                    <TouchableOpacity
                      key={srv.id}
                      style={styles.pickerItem}
                      onPress={() => handleAddService(srv)}
                    >
                      <Feather name="layers" size={16} color="#16A34A" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemText}>{srv.name}</Text>
                        <Text style={styles.pickerItemSub}>Đơn vị: {srv.unit || 'Lần'}</Text>
                      </View>
                      <Feather name="plus-circle" size={16} color="#EA580C" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '65%',
  },
  sheetLandscape: {
    maxHeight: '96%',
    minHeight: '88%',
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  emptyItemsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyItemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptyItemsDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  packageTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  packageTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  removeItemBtn: {
    padding: 4,
  },
  itemInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputMiniLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  qtyCol: {
    width: 90,
  },
  qtyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  qtyStepperBtn: {
    padding: 6,
  },
  qtyText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
  },
  priceCol: {
    flex: 1,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  totalCol: {
    width: 100,
    alignItems: 'flex-end',
  },
  itemTotalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 6,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  formRow: {
    gap: 6,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  discountInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
  },
  vatToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vatBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  vatBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F38820',
  },
  vatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  vatBtnTextActive: {
    color: '#EA580C',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    minHeight: 50,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLineLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryLineValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EA580C',
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F38820',
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerBox: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerScroll: {
    maxHeight: 350,
  },
  pickerSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  pickerItemSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
