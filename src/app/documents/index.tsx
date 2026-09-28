import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canManageDocumentLibrary } from '@/utils/rbac';
import {
  useDocumentsQuery,
  useDocumentTagsQuery,
} from '@/hooks/queries/useDocumentLibrary';
import { DocumentEntity } from '@/services/documentLibraryService';
import { DocumentListItem } from '@/components/documents/DocumentListItem';
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
  DOCUMENT_SORT_LABELS,
  DOCUMENT_SORT_ORDER,
  DocumentFilters,
  buildDocumentQueryParams,
  getUploaderName,
} from '@/utils/documentLibrary';

interface UploaderOption {
  id: string;
  name: string;
}

export default function DocumentsIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((state) => state.user);
  const canManage = canManageDocumentLibrary(user?.role);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState('newest');
  const [uploadedById, setUploadedById] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);

  // Deep-link từ nơi khác: /documents?category=pdf
  // Điều chỉnh state trong lúc render thay vì useEffect (tránh set-state-in-effect).
  const [syncedCategoryParam, setSyncedCategoryParam] = useState<string | null>(null);
  if (params.category !== syncedCategoryParam) {
    setSyncedCategoryParam(params.category ?? null);
    if (typeof params.category === 'string' && params.category) {
      setCategory(params.category);
    }
  }

  // Debounce ô tìm kiếm (server chỉ tìm trên displayName).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: DocumentFilters = useMemo(
    () => ({
      search: debouncedSearch,
      category,
      tags: selectedTags,
      uploadedById,
      fromDate,
      toDate,
      sort,
    }),
    [debouncedSearch, category, selectedTags, uploadedById, fromDate, toDate, sort],
  );

  const {
    data: documents = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useDocumentsQuery(filters);

  const { data: allTags = [] } = useDocumentTagsQuery();

  // Danh sách người tải lên suy ra từ kết quả hiện có (backend không có endpoint riêng).
  const uploaderOptions: UploaderOption[] = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach((doc) => {
      if (doc.uploadedById) map.set(doc.uploadedById, getUploaderName(doc.uploadedBy));
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [documents]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (uploadedById !== 'all') count += 1;
    if (fromDate) count += 1;
    if (toDate) count += 1;
    return count;
  }, [uploadedById, fromDate, toDate]);

  const hasAnyCondition = useMemo(
    () => Object.keys(buildDocumentQueryParams(filters)).length > 0,
    [filters],
  );

  const toggleTag = (tag: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSelectCategory = (next: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCategory(next);
  };

  const handleResetFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setUploadedById('all');
    setFromDate('');
    setToDate('');
  };

  const handleOpenDetail = useCallback(
    (doc: DocumentEntity) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.push(`/documents/${doc.id}` as any);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: DocumentEntity }) => (
      <DocumentListItem document={item} onPress={handleOpenDetail} />
    ),
    [handleOpenDetail],
  );

  const renderCategoryChip = (key: string) => {
    const active = category === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => handleSelectCategory(key)}
        activeOpacity={0.75}
        style={[
          styles.chip,
          active ? { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary } : null,
        ]}
      >
        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
          {DOCUMENT_CATEGORY_LABELS[key]}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Thư viện Tài liệu</Text>
          <Text style={styles.headerSubtitle}>Biểu mẫu & tài liệu nội bộ</Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnPrimary]}
          onPress={() => setShowSortSheet(true)}
          activeOpacity={0.75}
        >
          <Feather name="bar-chart-2" size={18} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Tìm theo tên tài liệu..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchInput ? (
            <TouchableOpacity
              onPress={() => setSearchInput('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilterSheet(true)}
          activeOpacity={0.8}
        >
          <Feather
            name="sliders"
            size={16}
            color={activeFilterCount > 0 ? BrandColors.primary : '#475569'}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <View style={styles.chipsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {DOCUMENT_CATEGORY_ORDER.map((key) => renderCategoryChip(key))}
        </ScrollView>
      </View>

      {/* Tag chips */}
      {allTags.length > 0 ? (
        <View style={styles.tagsSection}>
          <View style={styles.tagsHeaderRow}>
            <Text style={styles.tagsLabel}>Thẻ:</Text>
            {selectedTags.length > 0 ? (
              <TouchableOpacity onPress={() => setSelectedTags([])} activeOpacity={0.7}>
                <Text style={styles.tagsClear}>Bỏ chọn ({selectedTags.length})</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.75}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                >
                  <Feather name="tag" size={11} color={active ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Sort indicator */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sắp xếp: {DOCUMENT_SORT_LABELS[sort]}</Text>
        <Text style={styles.resultCount}>
          {documents.length} tài liệu
        </Text>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={styles.centerStateText}>Đang tải thư viện tài liệu...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <Feather name="cloud-off" size={46} color="#FCA5A5" />
          <Text style={styles.centerStateTitle}>Không tải được thư viện</Text>
          <Text style={styles.centerStateText}>
            {(error as Error)?.message || 'Vui lòng kiểm tra kết nối và thử lại.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + (canManage ? 84 : 16) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={BrandColors.primary}
              colors={[BrandColors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <MaterialCommunityIcons name="file-document-outline" size={54} color="#CBD5E1" />
              <Text style={styles.centerStateTitle}>Chưa có tài liệu nào</Text>
              <Text style={styles.centerStateText}>
                {hasAnyCondition
                  ? 'Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.'
                  : 'Thư viện đang trống. Hãy tải lên biểu mẫu hoặc tài liệu đầu tiên.'}
              </Text>
              {hasAnyCondition ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setSearchInput('');
                    setCategory('all');
                    setSelectedTags([]);
                    handleResetFilters();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryBtnText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* FAB tải lên — chỉ role MANAGE */}
      {canManage ? (
        <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setShowUploadModal(true);
            }}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.fabText}>Tải lên</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Sort bottom sheet */}
      <Modal
        visible={showSortSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowSortSheet(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={styles.sheetTitle}>Sắp xếp theo</Text>
            {DOCUMENT_SORT_ORDER.map((key) => {
              const active = sort === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.sheetOption, active && styles.sheetOptionActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSort(key);
                    setShowSortSheet(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                    {DOCUMENT_SORT_LABELS[key]}
                  </Text>
                  {active ? <Feather name="check" size={17} color={BrandColors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Advanced filter bottom sheet */}
      <Modal
        visible={showFilterSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowFilterSheet(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Bộ lọc nâng cao</Text>
              <TouchableOpacity
                onPress={() => setShowFilterSheet(false)}
                style={styles.sheetCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Người tải lên */}
              <Text style={styles.fieldLabel}>Người tải lên</Text>
              <View style={styles.wrapRow}>
                <TouchableOpacity
                  style={[styles.selectChip, uploadedById === 'all' && styles.selectChipActive]}
                  onPress={() => setUploadedById('all')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.selectChipText,
                      uploadedById === 'all' && styles.selectChipTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>

                {uploaderOptions.map((option) => {
                  const active = uploadedById === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.selectChip, active && styles.selectChipActive]}
                      onPress={() => setUploadedById(option.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {uploaderOptions.length === 0 ? (
                <Text style={styles.fieldHint}>
                  Chưa có dữ liệu người tải lên trong kết quả hiện tại.
                </Text>
              ) : null}

              {/* Khoảng ngày */}
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Từ ngày</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setDatePickerTarget('from')}
                activeOpacity={0.8}
              >
                <Feather name="calendar" size={15} color={fromDate ? BrandColors.primary : '#94A3B8'} />
                <Text style={[styles.dateBtnText, fromDate ? styles.dateBtnTextActive : null]}>
                  {fromDate ? formatDateToDDMMYYYY(fromDate) : 'Chọn ngày bắt đầu'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity onPress={() => setFromDate('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x-circle" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Đến ngày</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setDatePickerTarget('to')}
                activeOpacity={0.8}
              >
                <Feather name="calendar" size={15} color={toDate ? BrandColors.primary : '#94A3B8'} />
                <Text style={[styles.dateBtnText, toDate ? styles.dateBtnTextActive : null]}>
                  {toDate ? formatDateToDDMMYYYY(toDate) : 'Chọn ngày kết thúc'}
                </Text>
                {toDate ? (
                  <TouchableOpacity onPress={() => setToDate('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x-circle" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sheetActionsRow}>
              <TouchableOpacity
                style={styles.sheetResetBtn}
                onPress={handleResetFilters}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetResetBtnText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetApplyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setShowFilterSheet(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.sheetApplyBtnText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
        initialDate={datePickerTarget === 'from' ? fromDate : toDate}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(_ddmmyyyy, yyyymmdd) => {
          if (datePickerTarget === 'from') setFromDate(yyyymmdd);
          if (datePickerTarget === 'to') setToDate(yyyymmdd);
          setDatePickerTarget(null);
        }}
      />

      <DocumentUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        mode="create"
        onSuccess={(created) => {
          refetch();
          router.push(`/documents/${created.id}` as any);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDCB9E' },
  headerTitleCol: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { marginTop: 1, fontSize: 11, color: '#94A3B8' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 0 },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#F38820' },
  filterCountBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  chipsSection: { backgroundColor: '#FFFFFF', paddingBottom: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  tagsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  tagsLabel: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  tagsClear: { fontSize: 11, fontWeight: '700', color: '#F38820' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagChipActive: { backgroundColor: '#F38820', borderColor: '#F38820' },
  tagChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tagChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sortLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  resultCount: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  listContent: { paddingHorizontal: 16, paddingTop: 10 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 44 },
  centerStateTitle: { fontSize: 15, fontWeight: '700', color: '#334155', textAlign: 'center' },
  centerStateText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  fabWrap: { position: 'absolute', right: 16 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F38820',
    shadowColor: '#F38820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheetBackdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHandleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  sheetOptionActive: { borderColor: '#F38820', backgroundColor: '#FFF7ED' },
  sheetOptionText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  sheetOptionTextActive: { color: '#EA580C', fontWeight: '800' },
  sheetBody: { maxHeight: 420 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  fieldLabelSpaced: { marginTop: 18 },
  fieldHint: { marginTop: 6, fontSize: 11, color: '#94A3B8' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectChip: {
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectChipActive: { backgroundColor: '#FFF7ED', borderColor: '#F38820' },
  selectChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  selectChipTextActive: { color: '#EA580C', fontWeight: '800' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  dateBtnText: { flex: 1, fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  dateBtnTextActive: { color: '#0F172A' },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sheetResetBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  sheetResetBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  sheetApplyBtn: {
    flex: 1.6,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F38820',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetApplyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
