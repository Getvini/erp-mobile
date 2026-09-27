import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { canAccessFinance } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';
import { formatDateToDDMMYYYY, formatNumber, formatVND } from '@/utils/formatters';
import {
  useCreateAcceptanceMinuteMutation,
  useCreateVatInvoiceMutation,
  usePaymentDashboardQuery,
} from '@/hooks/queries/useDashboard';
import {
  FinanceDocument,
  PaymentDashboardParams,
  PaymentDashboardRow,
} from '@/services/paymentDashboardService';
import { uploadToCloudinary, PickedFile } from '@/services/cloudinaryService';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

export type FinanceView = 'OVERVIEW' | 'ACCEPTANCE' | 'VAT';

type FilterOption = { id: string; name: string };
type FilterKey = 'customerId' | 'salesOwnerId' | 'projectManagerId';

const VIEW_ROUTES: Record<FinanceView, string> = {
  OVERVIEW: '/finance/overview',
  ACCEPTANCE: '/finance/acceptance-minutes',
  VAT: '/finance/vat-invoices',
};

const VIEW_LABELS: Record<FinanceView, string> = {
  OVERVIEW: 'Tổng quan',
  ACCEPTANCE: 'Biên bản NT',
  VAT: 'Hóa đơn VAT',
};

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'WAITING', label: 'Đợi thu' },
  { key: 'PAID', label: 'Đã thu' },
  { key: 'UNCONFIRMED', label: 'Chưa xác nhận' },
] as const;

const MetricCard = memo(({ label, value, tone = '#0F172A' }: { label: string; value: string; tone?: string }) => (
  <View className="min-w-[162px] flex-1 rounded-2xl border border-slate-200 bg-white p-4">
    <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
    <Text className="mt-2 text-lg font-extrabold" style={{ color: tone }}>{value}</Text>
  </View>
));
MetricCard.displayName = 'MetricCard';

const MonthCard = memo(({ item }: { item: any }) => {
  const rate = item.planned > 0 ? Math.min(100, (item.paid / item.planned) * 100) : item.paid > 0 ? 100 : 0;
  return (
    <View className="mr-3 w-52 rounded-2xl border border-slate-200 bg-white p-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900">Tháng {item.month}</Text>
        <Text className="text-xs font-bold text-emerald-600">{formatNumber(rate.toFixed(1))}%</Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <View className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
      </View>
      <Text className="mt-2 text-xs text-slate-500">Kế hoạch: {formatVND(item.planned)}</Text>
      <Text className="mt-1 text-xs font-bold text-emerald-700">Đã thu: {formatVND(item.paid)}</Text>
      <Text className="mt-1 text-xs font-bold text-orange-600">Còn lại: {formatVND(item.unpaid)}</Text>
      <View className="mt-2 flex-row flex-wrap gap-1">
        <Text className="rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] text-emerald-700">Đúng kỳ {formatVND(item.breakdown?.onTime || 0)}</Text>
        <Text className="rounded-md bg-amber-50 px-1.5 py-1 text-[10px] text-amber-700">Nợ cũ {formatVND(item.breakdown?.overdue || 0)}</Text>
        <Text className="rounded-md bg-blue-50 px-1.5 py-1 text-[10px] text-blue-700">Thu trước {formatVND(item.breakdown?.prepaid || 0)}</Text>
      </View>
    </View>
  );
});
MonthCard.displayName = 'MonthCard';

function FinanceFilterSheet({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: { customers: FilterOption[]; salesOwners: FilterOption[]; projectManagers: FilterOption[] };
  selected: Record<FilterKey, string>;
  onSelect: (key: FilterKey, value: string) => void;
  onClose: () => void;
}) {
  const sections = useMemo(() => [
    { title: 'Khách hàng', keyName: 'customerId' as FilterKey, data: [{ id: '', name: 'Tất cả khách hàng' }, ...options.customers] },
    { title: 'Team kinh doanh', keyName: 'salesOwnerId' as FilterKey, data: [{ id: '', name: 'Tất cả team/người phụ trách' }, ...options.salesOwners] },
    { title: 'Quản lý dự án (PM)', keyName: 'projectManagerId' as FilterKey, data: [{ id: '', name: 'Tất cả PM' }, ...options.projectManagers] },
  ], [options]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[82%] rounded-t-[28px] bg-white px-4 pt-3 pb-5">
          <View className="mb-3 h-1 w-11 self-center rounded-full bg-slate-300" />
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-slate-900">Bộ lọc nâng cao</Text>
            <TouchableOpacity onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => <Text className="mt-3 mb-2 text-sm font-extrabold text-slate-800">{section.title}</Text>}
            renderItem={({ item, section }) => {
              const active = selected[section.keyName] === item.id;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(section.keyName, item.id)}
                  className={`mb-2 min-h-12 flex-row items-center justify-between rounded-xl border px-3 ${active ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`flex-1 text-sm ${active ? 'font-bold text-orange-700' : 'text-slate-700'}`}>{item.name}</Text>
                  {active && <Feather name="check" size={18} color="#F38820" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function DocumentUploadSheet({
  row,
  type,
  onClose,
}: {
  row: PaymentDashboardRow | null;
  type: 'acceptance' | 'invoice';
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const acceptanceMutation = useCreateAcceptanceMinuteMutation();
  const invoiceMutation = useCreateVatInvoiceMutation();

  if (!row) return null;
  const isAcceptance = type === 'acceptance';

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size || 0) > 20 * 1024 * 1024) {
      Alert.alert('Tệp quá lớn', 'Kích thước tài liệu tối đa là 20MB.');
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined, size: asset.size });
    if (!name.trim()) setName(asset.name.replace(/\.[^/.]+$/, ''));
  };

  const submit = async () => {
    if (!name.trim() || (!file && !url.trim())) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên và chọn tệp hoặc đường dẫn tài liệu.');
      return;
    }
    try {
      setSaving(true);
      let fileUrl = url.trim();
      if (file) {
        const uploaded = await uploadToCloudinary(
          file,
          isAcceptance ? 'GETVINI/ERP/acceptance-minutes' : 'GETVINI/ERP/vat-invoices',
          setProgress
        );
        fileUrl = uploaded.url;
      }
      const payload = { contractId: row.id, name: name.trim(), fileUrl };
      if (isAcceptance) await acceptanceMutation.mutateAsync(payload);
      else await invoiceMutation.mutateAsync(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Thành công', isAcceptance ? 'Đã thêm biên bản nghiệm thu.' : 'Đã thêm hóa đơn VAT.');
      onClose();
    } catch (error: any) {
      Alert.alert('Không thể lưu tài liệu', error?.message || 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-[28px] bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="mb-4 h-1 w-11 self-center rounded-full bg-slate-300" />
          <Text className="text-lg font-extrabold text-slate-900">{isAcceptance ? 'Thêm biên bản nghiệm thu' : 'Thêm hóa đơn VAT'}</Text>
          <Text className="mt-1 text-xs text-slate-500">{row.contractCode} · {row.projectName || row.contractName}</Text>
          <Text className="mt-4 mb-1.5 text-xs font-bold text-slate-700">Tên tài liệu *</Text>
          <TextInput value={name} onChangeText={setName} placeholder={isAcceptance ? 'VD: BBNT Giai đoạn 1' : 'VD: Hóa đơn VAT đợt 1'} className="h-12 rounded-xl border border-slate-300 px-3 text-sm text-slate-900" />
          <Text className="mt-3 mb-1.5 text-xs font-bold text-slate-700">Tệp tài liệu hoặc liên kết *</Text>
          <TouchableOpacity onPress={pickFile} disabled={saving} className="min-h-14 flex-row items-center rounded-xl border border-dashed border-orange-300 bg-orange-50 px-3">
            <Feather name="upload-cloud" size={20} color="#F38820" />
            <Text numberOfLines={1} className="ml-2 flex-1 text-sm font-bold text-orange-700">{file?.name || 'Chọn tệp PDF, ảnh hoặc Word (tối đa 20MB)'}</Text>
          </TouchableOpacity>
          <Text className="my-2 text-center text-xs text-slate-400">hoặc</Text>
          <TextInput value={url} onChangeText={setUrl} editable={!file && !saving} autoCapitalize="none" keyboardType="url" placeholder="https://drive.google.com/..." className={`h-12 rounded-xl border border-slate-300 px-3 text-sm text-slate-900 ${file ? 'opacity-40' : ''}`} />
          {saving && file && (
            <View className="mt-3">
              <View className="flex-row justify-between"><Text className="text-xs text-slate-500">Đang tải lên</Text><Text className="text-xs font-bold text-orange-600">{progress}%</Text></View>
              <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><View className="h-full bg-primary" style={{ width: `${progress}%` }} /></View>
            </View>
          )}
          <View className="mt-5 flex-row gap-3">
            <TouchableOpacity onPress={onClose} disabled={saving} className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-300"><Text className="font-bold text-slate-600">Hủy</Text></TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={saving} className="h-12 flex-[1.4] flex-row items-center justify-center rounded-xl bg-primary">
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-extrabold text-white">Lưu tài liệu</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const FinanceRowCard = memo(({ row, view, onUpload, onPreview }: {
  row: PaymentDashboardRow;
  view: FinanceView;
  onUpload: (row: PaymentDashboardRow, type: 'acceptance' | 'invoice') => void;
  onPreview: (document: FinanceDocument) => void;
}) => {
  const documents = view === 'ACCEPTANCE' ? row.acceptanceMinutes || [] : view === 'VAT' ? row.vatInvoices || [] : [];
  return (
    <View className="mx-4 mb-3 flex-1 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-extrabold text-orange-600">{row.contractCode || 'Chưa có mã HĐ'}</Text>
          <Text className="mt-1 text-[15px] font-extrabold text-slate-900">{row.projectName || row.contractName || 'Dự án chưa đặt tên'}</Text>
          <Text className="mt-1 text-xs text-slate-500">{row.customerName || 'Chưa cập nhật khách hàng'}</Text>
        </View>
        <View className={`rounded-lg px-2 py-1 ${row.paymentStatus === 'PAID' ? 'bg-emerald-50' : 'bg-orange-50'}`}>
          <Text className={`text-[10px] font-bold ${row.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-orange-700'}`}>{row.paymentStatus === 'PAID' ? 'Đã thu' : row.paymentStatus === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu'}</Text>
        </View>
      </View>
      <View className="mt-3 flex-row rounded-xl bg-slate-50 p-3">
        <View className="flex-1"><Text className="text-[10px] text-slate-500">Tổng HĐ</Text><Text className="mt-1 text-xs font-extrabold text-slate-900">{formatVND(row.totalWithVat)}</Text></View>
        <View className="flex-1"><Text className="text-[10px] text-slate-500">Đã thu</Text><Text className="mt-1 text-xs font-extrabold text-emerald-700">{formatVND(row.paidAmount)}</Text></View>
        <View className="flex-1"><Text className="text-[10px] text-slate-500">Còn lại</Text><Text className="mt-1 text-xs font-extrabold text-orange-700">{formatVND(row.unpaidAmount)}</Text></View>
      </View>
      {view !== 'OVERVIEW' && (
        <View className="mt-3 border-t border-slate-100 pt-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-bold text-slate-700">{view === 'ACCEPTANCE' ? 'Biên bản nghiệm thu' : 'Hóa đơn VAT'} ({documents.length})</Text>
            <TouchableOpacity onPress={() => onUpload(row, view === 'ACCEPTANCE' ? 'acceptance' : 'invoice')} className="min-h-11 flex-row items-center rounded-xl bg-orange-50 px-3">
              <Feather name="plus" size={16} color="#F38820" /><Text className="ml-1 text-xs font-bold text-orange-700">Thêm</Text>
            </TouchableOpacity>
          </View>
          {documents.length === 0 ? <Text className="py-2 text-xs italic text-slate-400">Chưa có tài liệu.</Text> : documents.map((doc) => (
            <View key={doc.id} className="mb-2 min-h-12 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Feather name="file-text" size={17} color={view === 'ACCEPTANCE' ? '#10B981' : '#F38820'} />
              <TouchableOpacity onPress={() => onPreview(doc)} className="ml-2 flex-1 py-3"><Text numberOfLines={1} className="text-xs font-bold text-slate-700">{doc.name}</Text><Text className="mt-0.5 text-[10px] text-slate-400">{formatDateToDDMMYYYY(doc.createdAt, 'Chưa rõ ngày')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL(doc.fileUrl)} className="h-11 w-11 items-center justify-center"><Feather name="download" size={17} color="#64748B" /></TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {view === 'OVERVIEW' && (
        <View className="mt-3 flex-row justify-between">
          <Text className="text-xs text-slate-500">BBNT: <Text className="font-bold text-emerald-700">{row.acceptanceMinutes?.length || 0}</Text></Text>
          <Text className="text-xs text-slate-500">HĐ VAT: <Text className="font-bold text-orange-700">{row.vatInvoices?.length || 0}</Text></Text>
          <Text className="text-xs text-slate-500">Thu gần nhất: <Text className="font-bold text-slate-700">{formatDateToDDMMYYYY(row.latestPaymentDate, '—')}</Text></Text>
        </View>
      )}
    </View>
  );
});
FinanceRowCard.displayName = 'FinanceRowCard';

export function FinanceDocumentsScreen({ initialView }: { initialView: FinanceView }) {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const hasAccess = canAccessFinance(user?.role);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['key']>('ALL');
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState<Record<FilterKey, string>>({ customerId: '', salesOwnerId: '', projectManagerId: '' });
  const [filterVisible, setFilterVisible] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{ row: PaymentDashboardRow; type: 'acceptance' | 'invoice' } | null>(null);
  const [preview, setPreview] = useState<FinanceDocument | null>(null);

  const params = useMemo<PaymentDashboardParams>(() => ({
    year,
    paymentMonth: month,
    search: search.trim() || undefined,
    paymentStatus: status === 'WAITING' ? 'WAITING' : status === 'PAID' ? 'PAID' : undefined,
    confirmationStatus: status === 'UNCONFIRMED' ? 'UNCONFIRMED' : undefined,
    ...advanced,
    page,
    limit: width >= 700 ? 20 : 10,
  }), [advanced, month, page, search, status, width, year]);
  const query = usePaymentDashboardQuery(params);
  const data = query.data;
  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const options = data?.filterOptions || {};

  const setView = (view: FinanceView) => router.replace(VIEW_ROUTES[view] as any);
  const resetPage = () => setPage(1);
  const renderRow = useCallback(({ item }: { item: PaymentDashboardRow }) => (
    <FinanceRowCard row={item} view={initialView} onUpload={(row, type) => setUploadTarget({ row, type })} onPreview={setPreview} />
  ), [initialView]);

  if (!hasAccess) {
    return <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6"><Feather name="shield" size={48} color="#EF4444" /><Text className="mt-4 text-center text-lg font-extrabold text-slate-900">Bạn không có quyền xem dữ liệu tài chính</Text><TouchableOpacity onPress={() => safeGoBack(router)} className="mt-5 h-12 justify-center rounded-xl bg-primary px-6"><Text className="font-bold text-white">Quay lại</Text></TouchableOpacity></SafeAreaView>;
  }

  const header = (
    <View>
      <View className="px-4 pt-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => safeGoBack(router)} className="h-12 w-12 items-center justify-center rounded-full bg-white"><Feather name="arrow-left" size={21} color="#0F172A" /></TouchableOpacity>
          <View className="flex-1"><Text className="text-lg font-extrabold text-slate-900">Thanh toán & chứng từ</Text><Text className="text-xs text-slate-500">Niên độ {year}</Text></View>
          <TouchableOpacity onPress={() => setFilterVisible(true)} className="h-12 w-12 items-center justify-center rounded-full bg-orange-50"><Feather name="sliders" size={20} color="#F38820" /></TouchableOpacity>
        </View>
        <View className="mt-4 flex-row rounded-xl bg-slate-200 p-1">
          {(Object.keys(VIEW_LABELS) as FinanceView[]).map((view) => <TouchableOpacity key={view} onPress={() => setView(view)} className={`min-h-11 flex-1 items-center justify-center rounded-lg ${initialView === view ? 'bg-white' : ''}`}><Text className={`text-xs font-bold ${initialView === view ? 'text-orange-600' : 'text-slate-600'}`}>{VIEW_LABELS[view]}</Text></TouchableOpacity>)}
        </View>
        <View className="mt-4 flex-row gap-2">
          <TouchableOpacity onPress={() => { setYear((v) => v - 1); resetPage(); }} className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white"><Feather name="chevron-left" size={19} color="#475569" /></TouchableOpacity>
          <View className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white"><Text className="text-sm font-extrabold text-slate-800">Năm {year}</Text></View>
          <TouchableOpacity onPress={() => { setYear((v) => v + 1); resetPage(); }} className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white"><Feather name="chevron-right" size={19} color="#475569" /></TouchableOpacity>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} className="mt-3" data={[null, ...Array.from({ length: 12 }, (_, i) => i + 1)]} keyExtractor={(item) => String(item ?? 'all')} renderItem={({ item }) => <TouchableOpacity onPress={() => { setMonth(item); resetPage(); }} className={`mr-2 min-h-11 justify-center rounded-xl border px-3 ${month === item ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}><Text className={`text-xs font-bold ${month === item ? 'text-orange-700' : 'text-slate-600'}`}>{item ? `Tháng ${item}` : 'Cả năm'}</Text></TouchableOpacity>} />
        <TextInput value={search} onChangeText={(value) => { setSearch(value); resetPage(); }} placeholder="Tìm mã HĐ, dự án, khách hàng..." className="mt-3 h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900" />
        <FlatList horizontal showsHorizontalScrollIndicator={false} className="mt-3" data={STATUS_TABS} keyExtractor={(item) => item.key} renderItem={({ item }) => <TouchableOpacity onPress={() => { setStatus(item.key); resetPage(); }} className={`mr-2 min-h-11 justify-center rounded-xl px-3 ${status === item.key ? 'bg-slate-900' : 'bg-white'}`}><Text className={`text-xs font-bold ${status === item.key ? 'text-white' : 'text-slate-600'}`}>{item.label}</Text></TouchableOpacity>} />
        <View className="mt-4 flex-row flex-wrap gap-3"><MetricCard label="Tổng giá trị HĐ" value={formatVND(summary.totalContractValue)} /><MetricCard label="Đã thanh toán" value={formatVND(summary.totalPaid)} tone="#059669" /><MetricCard label="Chưa thanh toán" value={formatVND(summary.totalUnpaid)} tone="#EA580C" /><MetricCard label="Tiến độ thực thu" value={`${formatNumber(Number(summary.collectionRate || 0).toFixed(1))}%`} tone="#F38820" /></View>
        {initialView === 'OVERVIEW' && <View className="mt-5"><Text className="mb-3 text-base font-extrabold text-slate-900">Đối soát dòng tiền 12 tháng</Text><FlatList horizontal data={data?.monthly || []} keyExtractor={(item) => String(item.month)} renderItem={({ item }) => <MonthCard item={item} />} showsHorizontalScrollIndicator={false} /></View>}
        <View className="mt-5 mb-3 flex-row items-center justify-between"><Text className="text-base font-extrabold text-slate-900">{initialView === 'OVERVIEW' ? 'Hợp đồng theo dõi' : initialView === 'ACCEPTANCE' ? 'Biên bản nghiệm thu' : 'Hóa đơn VAT'}</Text><Text className="text-xs text-slate-500">{data?.meta?.total || 0} hợp đồng</Text></View>
      </View>
    </View>
  );

  if (query.isLoading) return <SafeAreaView className="flex-1 bg-slate-50 px-4 pt-6">{header}<View className="mt-4 gap-3">{[1, 2, 3].map((key) => <View key={key} className="h-36 animate-pulse rounded-2xl bg-slate-200" />)}</View></SafeAreaView>;
  if (query.isError) return <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6"><Feather name="alert-circle" size={48} color="#EF4444" /><Text className="mt-4 text-center font-bold text-slate-900">Không thể tải dữ liệu tài chính</Text><TouchableOpacity onPress={() => query.refetch()} className="mt-4 h-12 justify-center rounded-xl bg-primary px-6"><Text className="font-bold text-white">Thử lại</Text></TouchableOpacity></SafeAreaView>;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
      <FlatList
        key={width >= 700 ? 'tablet' : 'phone'}
        data={rows}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        numColumns={width >= 700 ? 2 : 1}
        ListHeaderComponent={header}
        ListEmptyComponent={<View className="mx-4 items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8"><Feather name="inbox" size={42} color="#94A3B8" /><Text className="mt-3 font-bold text-slate-700">Không có dữ liệu phù hợp</Text><Text className="mt-1 text-center text-xs text-slate-400">Hãy thử thay đổi năm, tháng hoặc bộ lọc.</Text></View>}
        ListFooterComponent={data?.meta && data.meta.totalPages > 1 ? <View className="mb-8 mt-2 flex-row items-center justify-center gap-3"><TouchableOpacity disabled={page <= 1} onPress={() => setPage((v) => Math.max(1, v - 1))} className={`h-11 justify-center rounded-xl border border-slate-200 bg-white px-4 ${page <= 1 ? 'opacity-40' : ''}`}><Text className="font-bold text-slate-600">Trang trước</Text></TouchableOpacity><Text className="text-xs font-bold text-slate-600">{page}/{data.meta.totalPages}</Text><TouchableOpacity disabled={page >= data.meta.totalPages} onPress={() => setPage((v) => v + 1)} className={`h-11 justify-center rounded-xl bg-primary px-4 ${page >= data.meta.totalPages ? 'opacity-40' : ''}`}><Text className="font-bold text-white">Trang sau</Text></TouchableOpacity></View> : <View className="h-8" />}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} colors={['#F38820']} tintColor="#F38820" />}
        contentContainerStyle={{ paddingBottom: 20 }}
        columnWrapperStyle={width >= 700 ? { gap: 12 } : undefined}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
      <FinanceFilterSheet visible={filterVisible} options={{ customers: options.customers || [], salesOwners: options.salesOwners || [], projectManagers: options.projectManagers || [] }} selected={advanced} onSelect={(key, value) => { setAdvanced((current) => ({ ...current, [key]: value })); resetPage(); }} onClose={() => setFilterVisible(false)} />
      <DocumentUploadSheet row={uploadTarget?.row || null} type={uploadTarget?.type || 'acceptance'} onClose={() => setUploadTarget(null)} />
      <DocumentPreviewModal visible={!!preview} url={preview?.fileUrl || ''} fileName={preview?.name} onClose={() => setPreview(null)} />
    </SafeAreaView>
  );
}

export default FinanceDocumentsScreen;
