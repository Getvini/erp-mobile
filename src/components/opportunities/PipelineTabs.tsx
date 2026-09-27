import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

export interface PipelineTabItem {
  id: string;
  title: string;
  count?: number;
}

interface PipelineTabsProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  tabCounts?: Record<string, number>;
}

export const PIPELINE_TABS: PipelineTabItem[] = [
  { id: 'ALL', title: 'Tất cả' },
  { id: 'OPEN', title: 'Mới' },
  { id: 'PENDING_OPP_APPROVAL', title: 'Đang chờ duyệt' },
  { id: 'OPP_REJECTED', title: 'Không duyệt' },
  { id: 'OPP_APPROVED', title: 'Đã duyệt' },
  { id: 'QUOTATION_DRAFTING', title: 'Đang làm báo giá' },
  { id: 'PENDING_QUOTE_APPROVAL', title: 'Chờ duyệt báo giá' },
  { id: 'QUOTE_APPROVED', title: 'Đã duyệt báo giá' },
  { id: 'CONTRACT_CREATED', title: 'Đang làm hợp đồng' },
  { id: 'CONTRACT_APPROVED', title: 'Đã tạo hợp đồng' },
  { id: 'PROJECT_ASSIGNED', title: 'Đã giao dự án' },
  { id: 'IMPLEMENTATION', title: 'Triển khai' },
  { id: 'COMPLETED', title: 'Hoàn thành' },
  { id: 'CANCELLED', title: 'Đã hủy' },
];

export const PipelineTabs: React.FC<PipelineTabsProps> = ({
  activeTab,
  onSelectTab,
  tabCounts = {},
}) => {
  return (
    <View className="bg-surface border-b border-slate-100">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {PIPELINE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];

          return (
            <TouchableOpacity
              key={tab.id}
              className={`flex-row items-center px-3.5 py-2 rounded-full border gap-1.5 ${
                isActive
                  ? 'bg-primary border-primary'
                  : 'bg-background border-border'
              }`}
              style={
                isActive
                  ? {
                      shadowColor: '#F38820',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.15,
                      shadowRadius: 2,
                      elevation: 2,
                    }
                  : undefined
              }
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.75}
            >
              <Text className={`text-xs ${isActive ? 'font-bold text-white' : 'font-semibold text-text-secondary'}`}>
                {tab.title}
              </Text>
              {typeof count === 'number' && (
                <View className={`px-1.5 py-px rounded-full ${isActive ? 'bg-white/30' : 'bg-slate-200'}`}>
                  <Text className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};
