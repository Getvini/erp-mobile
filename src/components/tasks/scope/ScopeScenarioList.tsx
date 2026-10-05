import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { scenarioCode } from '@/utils/sheetScope';
import type { ScenarioInfo } from '@/utils/sheetScope';
import ScopeBadge from './ScopeBadge';

interface ScopeScenarioListProps {
  scenarios: ScenarioInfo[];
  selectedSet: Set<string> | null;
  canToggle: boolean;
  canChange: boolean;
  onTap: (id: string) => void;
  onHold: (id: string) => void;
  onFocus: (scenario: ScenarioInfo) => void;
  onSelectAll: (select: boolean) => void;
}

export default function ScopeScenarioList({
  scenarios,
  selectedSet,
  canToggle,
  canChange,
  onTap,
  onHold,
  onFocus,
  onSelectAll,
}: ScopeScenarioListProps) {
  return (
    <View className="flex-1">
      {canChange ? (
        <View className="flex-row gap-2 pb-2">
          <TouchableOpacity
            onPress={() => onSelectAll(true)}
            accessibilityLabel="Chọn hết kịch bản của sheet"
            className="px-3 h-10 items-center justify-center rounded-lg border border-border bg-surface"
          >
            <Text className="text-xs font-medium text-text-secondary">Chọn hết</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSelectAll(false)}
            accessibilityLabel="Bỏ chọn hết kịch bản của sheet"
            className="px-3 h-10 items-center justify-center rounded-lg border border-border bg-surface"
          >
            <Text className="text-xs font-medium text-text-secondary">Bỏ chọn hết</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={scenarios}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        renderItem={({ item }) => {
          const checked = selectedSet ? selectedSet.has(item.id) : true;
          return (
            <View className="flex-row items-center gap-2 min-h-[44px]">
              {canToggle ? (
                <TouchableOpacity
                  onPress={() => onTap(item.id)}
                  onLongPress={() => onHold(item.id)}
                  accessibilityLabel={`Quét kịch bản ${item.scenarioLabel}`}
                  className="w-10 h-10 items-center justify-center"
                >
                  <Feather name={checked ? 'check-square' : 'square'} size={20} color={checked ? '#F38820' : '#94a3b8'} />
                </TouchableOpacity>
              ) : (
                <View className="w-10 h-10 items-center justify-center">
                  <View className={`w-2 h-2 rounded-full ${checked ? 'bg-info' : 'bg-slate-300'}`} />
                </View>
              )}
              <ScopeBadge tone={checked ? 'blue' : 'slate'}>{scenarioCode(item)}</ScopeBadge>
              <TouchableOpacity
                onPress={() => onFocus(item)}
                onLongPress={canToggle ? () => onHold(item.id) : undefined}
                accessibilityLabel={`Nhảy tới kịch bản ${item.scenarioLabel}`}
                className="flex-1 min-h-[40px] justify-center"
              >
                <Text className="text-xs text-text-primary" numberOfLines={2}>
                  {item.scenarioLabel}
                </Text>
              </TouchableOpacity>
              <Text className="text-xs text-text-muted">
                {item.startRow}–{item.endRow}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}
