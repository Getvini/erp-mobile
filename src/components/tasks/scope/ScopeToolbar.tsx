import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DrawMode, ScopeTool } from './scopeTypes';

type IconName = React.ComponentProps<typeof Feather>['name'];

const TOOL_META: Record<ScopeTool, { label: string; icon: IconName }> = {
  scenario: { label: 'Chọn kịch bản', icon: 'mouse-pointer' },
  region: { label: 'Vẽ vùng', icon: 'crosshair' },
  view: { label: 'Chỉ xem', icon: 'eye' },
};

const DRAW_META: Record<DrawMode, { label: string; icon: IconName }> = {
  new: { label: 'Vùng mới', icon: 'plus' },
  expand: { label: 'Mở rộng vùng', icon: 'maximize-2' },
};

interface ScopeToolbarProps {
  availableTools: ScopeTool[];
  tool: ScopeTool;
  onToolChange: (tool: ScopeTool) => void;
  canDraw: boolean;
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function ScopeToolbar({
  availableTools,
  tool,
  onToolChange,
  canDraw,
  drawMode,
  onDrawModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ScopeToolbarProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        {availableTools.length > 1 ? (
          <View className="flex-1 flex-row p-1 gap-1 bg-slate-100 rounded-lg">
            {availableTools.map((key) => {
              const active = tool === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => onToolChange(key)}
                  accessibilityLabel={TOOL_META[key].label}
                  className={`flex-1 h-10 flex-row items-center justify-center gap-1 rounded-md ${active ? 'bg-surface' : ''}`}
                >
                  <Feather name={TOOL_META[key].icon} size={14} color={active ? '#F38820' : '#64748b'} />
                  <Text className={`text-xs font-semibold ${active ? 'text-text-primary' : 'text-text-secondary'}`} numberOfLines={1}>
                    {TOOL_META[key].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {canDraw ? (
          <View className="flex-row gap-1">
            <TouchableOpacity
              onPress={onUndo}
              disabled={!canUndo}
              accessibilityLabel="Hoàn tác"
              className={`w-10 h-10 items-center justify-center rounded-lg border border-border bg-surface ${canUndo ? '' : 'opacity-40'}`}
            >
              <Feather name="corner-up-left" size={16} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRedo}
              disabled={!canRedo}
              accessibilityLabel="Làm lại"
              className={`w-10 h-10 items-center justify-center rounded-lg border border-border bg-surface ${canRedo ? '' : 'opacity-40'}`}
            >
              <Feather name="corner-up-right" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {canDraw && tool === 'region' ? (
        <View className="flex-row p-1 gap-1 bg-warning-light border border-warning/40 rounded-lg">
          {(Object.keys(DRAW_META) as DrawMode[]).map((key) => {
            const active = drawMode === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onDrawModeChange(key)}
                accessibilityLabel={DRAW_META[key].label}
                className={`flex-1 h-10 flex-row items-center justify-center gap-1 rounded-md ${active ? 'bg-surface' : ''}`}
              >
                <Feather name={DRAW_META[key].icon} size={14} color={active ? '#b45309' : '#64748b'} />
                <Text className={`text-xs font-semibold ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {DRAW_META[key].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
