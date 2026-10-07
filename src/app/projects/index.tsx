import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ProjectItem,
  PROJECT_STATUS_CONFIG,
} from '@/services/projectService';
import BottomNavBar from '@/components/BottomNavBar';
import { safeGoBack } from '@/utils/navigation';
import { formatNumber } from '@/utils/formatters';
import { useProjectsQuery } from '@/hooks/queries/useProjects';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING_CONFIRMATION', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { key: 'PENDING_PAUSE_APPROVAL', label: 'Chờ duyệt tạm dừng' },
  { key: 'ON_HOLD', label: 'Tạm dừng' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const ProjectCardItem = React.memo(function ProjectCardItem({
  item,
  getStatusColor,
  onPress,
}: {
  item: ProjectItem;
  getStatusColor: (status: string) => { bg: string; text: string; label: string };
  onPress: (id: string) => void;
}) {
  const status = getStatusColor(item.status);
  const progress = item.progress ?? 0;

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl p-4 border border-border shadow-xs"
      activeOpacity={0.8}
      onPress={() => onPress(item.id)}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: status.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: status.text }}>{status.label}</Text>
        </View>
        {item.contract?.contractCode && (
          <Text className="text-xs color-slate-400 font-semibold">#{item.contract.contractCode}</Text>
        )}
      </View>

      <Text className="text-base font-bold text-text-primary leading-5 mb-1.5" numberOfLines={2}>
        {item.name}
      </Text>

      {item.contract?.customer?.name && (
        <View className="flex-row items-center gap-1.5 mb-3">
          <Feather name="briefcase" size={13} color="#64748B" />
          <Text className="text-xs text-slate-500 font-medium flex-1" numberOfLines={1}>
            {item.contract.customer.name}
          </Text>
        </View>
      )}

      {/* Progress Bar */}
      <View className="bg-background rounded-xl p-2.5 mb-3">
        <View className="flex-row justify-between items-center mb-1.5">
          <Text className="text-[11px] text-slate-500 font-medium">Tiến độ hoàn thành</Text>
          <Text className="text-xs font-bold text-primary">{progress}%</Text>
        </View>
        <View className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </View>
      </View>

      {/* Card Footer */}
      <View className="flex-row justify-between items-center border-t border-slate-100 pt-2.5">
        <View className="flex-row items-center gap-1.5 flex-1 mr-2 overflow-hidden">
          <Feather name="users" size={13} color="#64748B" />
          <Text className="text-xs text-slate-500 flex-1" numberOfLines={1}>
            {item.team?.name || 'Nhóm dự án Getvini'}
          </Text>
        </View>

        {item.contract?.sellingPrice ? (
          <Text className="text-xs font-bold text-text-primary flex-shrink-0">
            {formatNumber(item.contract.sellingPrice)} đ
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function ProjectsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  const { data: projectsRes, isLoading, isFetching, refetch } = useProjectsQuery();

  const projects: ProjectItem[] = useMemo(() => {
    if (!projectsRes) return [];
    return Array.isArray(projectsRes) ? projectsRes : [];
  }, [projectsRes]);

  const handleRefresh = () => {
    refetch();
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Filter by status
      if (selectedStatusFilter !== 'ALL' && p.status !== selectedStatusFilter) {
        return false;
      }
      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.contract?.customer?.name?.toLowerCase().includes(q) ||
        p.contract?.contractCode?.toLowerCase().includes(q)
      );
    });
  }, [projects, selectedStatusFilter, searchQuery]);

  const getStatusColor = useCallback((status: string) => {
    const config = PROJECT_STATUS_CONFIG[status];
    if (config) {
      return { bg: config.bg, text: config.color, label: config.text };
    }
    return { bg: '#F1F5F9', text: '#64748B', label: status || 'Khởi tạo' };
  }, []);

  const handleProjectPress = useCallback((id: string) => {
    router.push(`/projects/${id}` as any);
  }, [router]);

  const renderProjectCard = useCallback(({ item }: { item: ProjectItem }) => {
    return <ProjectCardItem item={item} getStatusColor={getStatusColor} onPress={handleProjectPress} />;
  }, [getStatusColor, handleProjectPress]);

  const keyExtractor = useCallback((item: ProjectItem) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          onPress={() => safeGoBack(router, '/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-text-primary">Dự án Doanh nghiệp</Text>
        <View className="w-10" />
      </View>

      {/* Search Input */}
      <View className="px-4 pt-3 pb-2 bg-surface border-b border-border gap-2.5">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 h-10.5">
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 ml-2 text-sm text-text-primary"
            placeholder="Tìm theo tên dự án, đối tác, mã HĐ..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {STATUS_FILTERS.map((f) => {
            const isActive = selectedStatusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                className={`px-3 py-1.5 rounded-full border ${
                  isActive
                    ? 'bg-primary border-primary'
                    : 'bg-slate-100 border-border'
                }`}
                onPress={() => setSelectedStatusFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs ${
                    isActive ? 'font-bold text-white' : 'font-semibold text-slate-500'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content List */}
      {isLoading && !isFetching ? (
        <View className="flex-1 justify-center items-center gap-2.5">
          <ActivityIndicator size="large" color="#F38820" />
          <Text className="text-xs text-slate-400">Đang tải dữ liệu dự án Getvini...</Text>
        </View>
      ) : (
        <FlashList
          data={filteredProjects}
          keyExtractor={keyExtractor}
          renderItem={renderProjectCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={['#F38820']}
              tintColor="#F38820"
            />
          }
          ListEmptyComponent={
            <View className="py-15 items-center justify-center gap-2.5">
              <Feather name="folder" size={44} color="#CBD5E1" />
              <Text className="text-base font-bold text-slate-600">Chưa có dự án nào</Text>
              <Text className="text-xs text-slate-400 text-center max-w-[260px]">
                {searchQuery || selectedStatusFilter !== 'ALL'
                  ? 'Không tìm thấy dự án phù hợp với bộ lọc.'
                  : 'Hiện tại chưa có dự án nào được giao kết.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}

