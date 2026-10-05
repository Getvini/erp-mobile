import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { regionCellCount, regionRange, scenarioCode } from '@/utils/sheetScope';
import type { ScanRegion, ScenarioInfo } from '@/utils/sheetScope';
import ScopeBadge from './ScopeBadge';

interface RangeFieldProps {
  region: ScanRegion;
  onCommit: (region: ScanRegion, text: string) => boolean;
}

function RangeField({ region, onCommit }: RangeFieldProps) {
  const current = regionRange(region);
  const [text, setText] = useState(current);

  useEffect(() => {
    setText(current);
  }, [current]);

  const commit = () => {
    const value = text.trim();
    if (!value || value.toUpperCase() === current) {
      setText(current);
      return;
    }
    if (!onCommit(region, value)) setText(current);
  };

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      autoCapitalize="characters"
      autoCorrect={false}
      accessibilityLabel="Toạ độ vùng, sửa để mở rộng hoặc thu hẹp"
      className="w-28 h-10 px-2 text-xs text-text-primary border border-border rounded-md bg-surface"
    />
  );
}

interface ScopeRegionListProps {
  visibleFixed: ScanRegion[];
  fixedRegions: ScanRegion[];
  draftRegions: ScanRegion[];
  scenariosBySheet: Record<string, ScenarioInfo[]>;
  activeRegionId: string | null;
  activeSheet: string | null;
  canDraw: boolean;
  rangeText: string;
  notice: string;
  onRangeTextChange: (text: string) => void;
  onAddRange: () => void;
  onFocusRegion: (region: ScanRegion) => void;
  onActivate: (id: string) => void;
  onRemove: (region: ScanRegion) => void;
  onUpdate: (id: string, patch: Partial<ScanRegion>) => void;
  onCommitRange: (region: ScanRegion, text: string) => boolean;
}

export default function ScopeRegionList({
  visibleFixed,
  fixedRegions,
  draftRegions,
  scenariosBySheet,
  activeRegionId,
  activeSheet,
  canDraw,
  rangeText,
  notice,
  onRangeTextChange,
  onAddRange,
  onFocusRegion,
  onActivate,
  onRemove,
  onUpdate,
  onCommitRange,
}: ScopeRegionListProps) {
  const total = visibleFixed.length + draftRegions.length;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={{ paddingBottom: 12 }}>
      {total === 0 ? (
        <Text className="text-xs text-text-muted pb-2">
          {canDraw
            ? 'Chưa có vùng nào. Chọn công cụ Vẽ vùng rồi vẽ trên bảng, hoặc nhập toạ độ bên dưới.'
            : 'Không có vùng tự chọn.'}
        </Text>
      ) : null}
      <View className="gap-2">
        {visibleFixed.map((region) => {
          const isActive = activeRegionId === region.id && region.sheet === activeSheet;
          return (
            <View
              key={`${region.sheet}:${region.id}`}
              className={`p-2 rounded-lg border bg-violet-50 gap-0.5 ${isActive ? 'border-warning' : 'border-violet-200'}`}
            >
              <View className="flex-row items-center gap-2">
                <ScopeBadge tone="violet">{region.id}</ScopeBadge>
                <TouchableOpacity
                  onPress={() => onFocusRegion(region)}
                  accessibilityLabel={`Nhảy tới vùng ${region.id}`}
                  className="flex-1 min-h-[40px] justify-center"
                >
                  <Text className="text-xs font-medium text-text-primary" numberOfLines={1}>
                    {region.label || 'Vùng tự chọn'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-text-secondary">
                {region.sheet}!{regionRange(region)} · {regionCellCount(region)} ô{region.qc === false ? ' · không QC' : ''}
              </Text>
            </View>
          );
        })}
        {draftRegions.map((region) => {
          const isActive = activeRegionId === region.id && region.sheet === activeSheet;
          const overridesFixed = fixedRegions.some((f) => f.sheet === region.sheet && f.id === region.id);
          const extended = region.extends
            ? (scenariosBySheet[region.sheet] || []).find((s) => s.id === region.extends)
            : null;
          return (
            <View
              key={`${region.sheet}:${region.id}`}
              className={`p-2 rounded-lg border bg-warning-light gap-1.5 ${isActive ? 'border-warning' : 'border-warning/40'}`}
            >
              <View className="flex-row items-center gap-2">
                <ScopeBadge tone="amber">{region.id}</ScopeBadge>
                <TextInput
                  value={region.label ?? ''}
                  onChangeText={(value) => onUpdate(region.id, { label: value.slice(0, 100) })}
                  onFocus={() => onActivate(region.id)}
                  accessibilityLabel="Tên vùng"
                  className="flex-1 min-w-0 h-10 px-2 text-xs text-text-primary border border-border rounded-md bg-surface"
                />
                <TouchableOpacity
                  onPress={() => onRemove(region)}
                  accessibilityLabel="Xoá vùng"
                  className="w-10 h-10 items-center justify-center"
                >
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {region.extends || overridesFixed ? (
                <Text className="text-[11px] text-amber-700">
                  {region.extends
                    ? `Mở rộng từ kịch bản ${extended ? `${scenarioCode(extended)} · ${extended.scenarioLabel}` : region.extends.split('::').pop()}`
                    : 'Mở rộng từ vùng đã nộp, sẽ thay thế vùng cũ khi quét lại'}
                </Text>
              ) : null}
              <View className="flex-row items-center gap-2">
                <RangeField region={region} onCommit={onCommitRange} />
                <TouchableOpacity
                  onPress={() => onFocusRegion(region)}
                  accessibilityLabel={`Nhảy tới vùng ${region.id}`}
                  className="flex-1 min-h-[40px] justify-center"
                >
                  <Text className="text-xs text-text-secondary">
                    {region.sheet} · {regionCellCount(region)} ô
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-xs text-text-secondary">Đối chiếu QC cho vùng này</Text>
                <Switch
                  value={region.qc !== false}
                  onValueChange={(value) => onUpdate(region.id, { qc: value })}
                  trackColor={{ true: '#F38820', false: '#cbd5e1' }}
                  accessibilityLabel="Đối chiếu QC cho vùng này"
                />
              </View>
            </View>
          );
        })}
      </View>
      {canDraw ? (
        <View className="flex-row gap-2 pt-3">
          <TextInput
            value={rangeText}
            onChangeText={onRangeTextChange}
            onSubmitEditing={onAddRange}
            placeholder="A1:D20"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Nhập toạ độ vùng"
            className="flex-1 min-w-0 h-10 px-3 text-xs text-text-primary border border-border rounded-lg bg-surface"
          />
          <TouchableOpacity
            onPress={onAddRange}
            accessibilityLabel="Thêm vùng"
            className="px-4 h-10 items-center justify-center rounded-lg border border-border bg-surface"
          >
            <Text className="text-xs font-semibold text-text-primary">Thêm</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {notice ? <Text className="pt-2 text-xs text-danger">{notice}</Text> : null}
    </ScrollView>
  );
}
