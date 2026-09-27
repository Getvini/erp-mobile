import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { canAccessOpportunities } from '@/utils/rbac';
import { BrandColors } from '@/constants/colors';
import { formatVND, formatVNDFull, formatNumber } from '@/utils/formatters';
import { safeGoBack } from '@/utils/navigation';
import { OpportunityItem, OpportunityListFilters } from '@/services/opportunityService';
import { PipelineTabs } from '@/components/opportunities/PipelineTabs';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import BottomNavBar from '@/components/BottomNavBar';
import { STORAGE_DRAFT_KEY } from './create';
import { useSSERefresh } from '@/hooks/useSSERefresh';
import { useOpportunitiesQuery } from '@/hooks/queries/useOpportunities';

export default function OpportunitiesScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Check RBAC permission
  const hasAccess = canAccessOpportunities(user?.role);

  // Compute filters for TanStack Query
  const filters = useMemo<OpportunityListFilters>(() => {
    const f: OpportunityListFilters = {
      search: searchQuery.trim() || undefined,
      limit: 50,
    };

    if (activeTab !== 'ALL') {
      f.status = activeTab;
    }
    return f;
  }, [activeTab, searchQuery]);

  // Query opportunities list via TanStack Query
  const {
    data: opportunityResponse,
    isLoading: isQueryLoading,
    isFetching: isRefreshing,
    refetch,
  } = useOpportunitiesQuery(filters);

  const opportunities: OpportunityItem[] = useMemo(() => {
    if (!opportunityResponse) return [];
    return Array.isArray(opportunityResponse.data) ? opportunityResponse.data : [];
  }, [opportunityResponse]);

  const totalCount = useMemo(() => {
    if (!opportunityResponse) return 0;
    return opportunityResponse.meta?.total ?? opportunities.length;
  }, [opportunityResponse, opportunities]);

  const isLoading = isQueryLoading && !opportunityResponse;

  useSSERefresh('invalidate_Opportunities', refetch);

  // Draft Opportunity State & Detection
  const [draftOpportunity, setDraftOpportunity] = useState<any | null>(null);

  const checkDraft = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.name || parsed.description || parsed.expectedRevenue || parsed.budget)) {
          setDraftOpportunity(parsed);
          return;
        }
      }
      setDraftOpportunity(null);
    } catch {
      setDraftOpportunity(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkDraft();
    }, [checkDraft])
  );

  const handleDeleteDraft = () => {
    Alert.alert(
      'Xóa bản nháp',
      'Bạn có chắc chắn muốn xóa bản nháp cơ hội này không? Dữ liệu chưa lưu sẽ bị xóa vĩnh viễn.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bản nháp',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_DRAFT_KEY);
            setDraftOpportunity(null);
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    refetch();
    checkDraft();
  };

  // Render Draft Card at top of List
  const renderListHeader = () => {
    if (!draftOpportunity) return null;
    if (searchQuery && !draftOpportunity.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return null;
    }

    const formatDraftTime = (savedAt?: string | null) => {
      if (!savedAt) return 'Gần đây';
      const rawStr = String(savedAt).trim();
      if (/^\d{1,2}:\d{2}$/.test(rawStr)) {
        return rawStr;
      }
      const d = new Date(rawStr);
      if (isNaN(d.getTime())) {
        return rawStr;
      }
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${hours}:${minutes} ${day}/${month}/${year}`;
    };

    const timeFormatted = formatDraftTime(draftOpportunity.savedAt);

    return (
      <View className="mx-4 mb-3 bg-amber-50 rounded-2xl border-[1.5px] border-amber-200 shadow-sm">
        <TouchableOpacity
          className="p-3.5 flex-row items-center justify-between"
          onPress={() => router.push('/opportunities/create?mode=draft' as any)}
          activeOpacity={0.85}
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-[38px] h-[38px] rounded-xl bg-amber-100 justify-center items-center border border-amber-200">
              <Feather name="file-text" size={18} color="#D97706" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                  <Text className="text-[10px] font-extrabold text-amber-800 tracking-wider">BẢN NHÁP</Text>
                </View>
                <Text className="text-[11px] text-amber-900 font-medium">Lưu lúc {timeFormatted}</Text>
              </View>
              <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                {draftOpportunity.name || 'Cơ hội chưa đặt tên'}
              </Text>
              <Text className="text-xs text-amber-800 mt-0.5 font-semibold" numberOfLines={1}>
                {draftOpportunity.expectedRevenue
                  ? `Kỳ vọng: ${formatVNDFull(draftOpportunity.expectedRevenue)}`
                  : draftOpportunity.description || 'Chạm để tiếp tục chỉnh sửa & hoàn thiện'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2 ml-2.5">
            <TouchableOpacity
              className="flex-row items-center bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 gap-1"
              onPress={() => router.push('/opportunities/create?mode=draft' as any)}
              activeOpacity={0.7}
            >
              <Feather name="edit-3" size={13} color="#B45309" />
              <Text className="text-xs font-bold text-amber-800">Sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-1.5"
              onPress={handleDeleteDraft}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Calculate sum of expected revenue for displayed opportunities
  const totalExpectedRevenue = useMemo(() => {
    return opportunities.reduce((sum, item) => {
      const rev = Number(item.expectedRevenue) || 0;
      return sum + rev;
    }, 0);
  }, [opportunities]);

  const formatTotalMoney = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2).replace('.', ',')} Tỷ`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(0)} Triệu`;
    }
    return formatVND(val);
  };

  if (isAuthLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </View>
    );
  }

  // Guard screen if role is unauthorized (e.g. STAFF_*)
  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-1 justify-center items-center p-8">
          <View className="w-[72px] h-[72px] rounded-full bg-red-100 justify-center items-center mb-4">
            <Feather name="lock" size={36} color="#DC2626" />
          </View>
          <Text className="text-lg font-extrabold text-red-800 mb-2">Giới hạn quyền truy cập</Text>
          <Text className="text-[13px] text-slate-500 text-center leading-5 mb-6">
            Phân hệ Quản lý Cơ hội & CRM chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh (Sales).
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-slate-900 px-4 py-3 rounded-xl"
            onPress={() => router.replace('/')}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={16} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Về Bảng điều khiển</Text>
          </TouchableOpacity>
        </View>
        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity
          className="w-[38px] h-[38px] rounded-xl bg-slate-100 justify-center items-center"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View className="flex-1 mx-3">
          <Text className="text-lg font-extrabold text-slate-900">Quản lý Cơ hội</Text>
          <Text className="text-xs text-slate-500 mt-0.5">Phễu bán hàng & CRM</Text>
        </View>

        <TouchableOpacity
          className="flex-row items-center gap-1 bg-primary px-3 py-2 rounded-xl"
          onPress={() => router.push('/opportunities/create' as any)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text className="text-[13px] font-bold text-white">Tạo</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Search */}
      <View className="px-4 py-2.5 bg-white">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2 gap-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            className="flex-1 text-sm text-slate-900 p-0"
            placeholder="Tìm tên cơ hội, khách hàng, lead..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pipeline Stage Tabs */}
      <PipelineTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Overview Stat Ribbon */}
      <View className="flex-row items-center bg-white px-5 py-2.5 mb-2 border-b border-slate-200">
        <View className="flex-1">
          <Text className="text-[11px] text-slate-500 font-semibold">Số lượng cơ hội</Text>
          <Text className="text-[15px] font-extrabold text-slate-900 mt-0.5">{totalCount}</Text>
        </View>
        <View className="w-px h-7 bg-slate-200 mx-4" />
        <View className="flex-1">
          <Text className="text-[11px] text-slate-500 font-semibold">Doanh thu kỳ vọng</Text>
          <Text className="text-[15px] font-extrabold text-primary mt-0.5">
            {formatTotalMoney(totalExpectedRevenue)}
          </Text>
        </View>
      </View>

      {/* Opportunities List */}
      {isLoading && !isRefreshing ? (
        <View className="flex-1 justify-center items-center gap-2">
          <ActivityIndicator size="small" color={BrandColors.primary} />
          <Text className="text-[13px] text-slate-500">Đang tải danh sách cơ hội...</Text>
        </View>
      ) : (
        <FlatList
          data={opportunities}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          renderItem={({ item }) => (
            <OpportunityCard
              item={item}
              onPress={() => router.push(`/opportunities/${item.id}` as any)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          ListEmptyComponent={
            <View className="p-8 items-center justify-center mt-10">
              <View className="w-16 h-16 rounded-full bg-slate-200 justify-center items-center mb-3.5">
                <Ionicons name="folder-open-outline" size={32} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-slate-800 mb-1.5">Chưa có cơ hội nào</Text>
              <Text className="text-[13px] text-slate-500 text-center leading-[19px] mb-4">
                {searchQuery
                  ? 'Không tìm thấy cơ hội phù hợp với từ khóa.'
                  : 'Hãy bấm nút Tạo mới để ghi nhận cơ hội tiềm năng đầu tiên.'}
              </Text>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-primary px-4 py-2.5 rounded-xl"
                onPress={() => router.push('/opportunities/create' as any)}
                activeOpacity={0.8}
              >
                <Feather name="plus-circle" size={16} color="#FFFFFF" />
                <Text className="text-[13px] font-bold text-white">Thêm cơ hội mới</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
