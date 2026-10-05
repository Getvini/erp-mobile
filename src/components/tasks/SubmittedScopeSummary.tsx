import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { regionRange } from '@/utils/sheetScope';
import type { TaskDetail } from '@/services/taskService';

const COLLAPSED_COUNT = 6;

interface ScopeRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  count: string;
  children: React.ReactNode;
}

function ScopeRow({ icon, label, count, children }: ScopeRowProps) {
  return (
    <View className="gap-2.5 py-2.5">
      <View className="flex-row items-center gap-2.5">
        <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center">
          <Feather name={icon} size={16} color="#2563EB" />
        </View>
        <View>
          <Text className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</Text>
          <Text className="text-sm font-extrabold text-blue-600">{count}</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

interface SubmittedScopeSummaryProps {
  result?: TaskDetail['result'] | null;
}

export default function SubmittedScopeSummary({ result }: SubmittedScopeSummaryProps) {
  const [showAllScenarios, setShowAllScenarios] = useState(false);

  const sheetNames = result?.sheetNames || [];
  const scenarioLabels = result?.scenarioLabels || [];
  const regions = result?.scanScope?.regions || [];
  if (sheetNames.length === 0 && scenarioLabels.length === 0 && regions.length === 0) return null;

  const hiddenScenarios = Math.max(scenarioLabels.length - COLLAPSED_COUNT, 0);
  const visibleScenarios = showAllScenarios ? scenarioLabels : scenarioLabels.slice(0, COLLAPSED_COUNT);
  const showRegionSheet = sheetNames.length > 1;

  return (
    <View className="bg-white rounded-2xl p-4 border border-blue-200">
      <Text className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Phạm vi đã nộp</Text>

      {sheetNames.length > 0 && (
        <ScopeRow icon="file-text" label="Sheet" count={`${sheetNames.length} sheet`}>
          {sheetNames.map((name) => (
            <View
              key={name}
              className="flex-row items-center gap-1.5 max-w-full rounded-full border border-blue-200 bg-blue-50 px-3 py-1"
            >
              <Feather name="grid" size={13} color="#059669" />
              <Text className="shrink text-xs font-bold text-slate-800" numberOfLines={1}>
                {name}
              </Text>
            </View>
          ))}
        </ScopeRow>
      )}

      {scenarioLabels.length > 0 && (
        <ScopeRow icon="layers" label="Kịch bản" count={`${scenarioLabels.length} kịch bản`}>
          {visibleScenarios.map((label, index) => (
            <View
              key={`${label}-${index}`}
              className="flex-row items-start gap-2 max-w-full rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-1.5"
            >
              <View className="mt-px min-w-5 h-5 px-1 rounded-md bg-blue-600 items-center justify-center">
                <Text className="text-[10px] font-extrabold text-white">{index + 1}</Text>
              </View>
              <Text className="shrink text-xs font-semibold text-slate-700">{label}</Text>
            </View>
          ))}
          {hiddenScenarios > 0 && (
            <TouchableOpacity
              onPress={() => setShowAllScenarios((value) => !value)}
              accessibilityLabel={showAllScenarios ? 'Thu gọn danh sách kịch bản' : 'Xem thêm kịch bản'}
              className="min-h-10 flex-row items-center gap-1 rounded-xl border border-dashed border-blue-300 px-3 py-1.5"
            >
              <Text className="text-xs font-bold text-blue-600">
                {showAllScenarios ? 'Thu gọn' : `+${hiddenScenarios} kịch bản khác`}
              </Text>
              <Feather name={showAllScenarios ? 'chevron-up' : 'chevron-down'} size={14} color="#2563EB" />
            </TouchableOpacity>
          )}
        </ScopeRow>
      )}

      {regions.length > 0 && (
        <ScopeRow icon="crop" label="Vùng tự chọn" count={`${regions.length} vùng`}>
          {regions.map((region) => (
            <View
              key={`${region.sheet}:${region.id}`}
              className="flex-row flex-wrap items-center gap-2 max-w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 px-2.5 py-1.5"
            >
              <Text className="text-xs font-bold text-slate-800">{region.label || 'Vùng'}</Text>
              <View className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5">
                <Text className="font-mono text-[11px] font-bold text-blue-700">{regionRange(region)}</Text>
              </View>
              {showRegionSheet && (
                <Text className="shrink text-[11px] font-medium text-slate-500" numberOfLines={1}>
                  {region.sheet}
                </Text>
              )}
              {region.qc === false && (
                <Text className="text-[10px] font-bold uppercase text-slate-400">không QC</Text>
              )}
            </View>
          ))}
        </ScopeRow>
      )}
    </View>
  );
}
