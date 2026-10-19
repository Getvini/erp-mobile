import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useOpportunityFormStore } from '@/stores/useOpportunityFormStore';
import { PRIORITIES, getSuccessChanceMeta } from './wizardConstants';

// Interactive Touch Slider Component
const SuccessChanceSlider: React.FC<{
  value: number;
  onChange: (val: number) => void;
}> = ({ value, onChange }) => {
  const [trackWidth, setTrackWidth] = useState(300);
  const trackRef = useRef<View>(null);
  const trackPageXRef = useRef(0);
  const safeVal =
    typeof value === 'number' && !isNaN(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : 0;
  const meta = getSuccessChanceMeta(safeVal);

  const measureTrack = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (width && width > 0) setTrackWidth(width);
      if (typeof pageX === 'number' && !isNaN(pageX)) trackPageXRef.current = pageX;
    });
  };

  const updateFromPageX = (pageX: number) => {
    const width = trackWidth > 0 ? trackWidth : 300;
    const offset = trackPageXRef.current || 20;
    const relativeX = pageX - offset;
    const clamped = Math.max(0, Math.min(width, relativeX));
    const percentage = Math.round((clamped / width) * 100);
    if (!isNaN(percentage)) {
      onChange(Math.max(0, Math.min(100, percentage)));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        measureTrack();
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const knobLeft = useMemo(() => {
    const w = trackWidth > 0 ? trackWidth : 300;
    return Math.max(0, Math.min(w - 24, (w * safeVal) / 100 - 12));
  }, [trackWidth, safeVal]);

  return (
    <View className="mb-[16px]">
      <View className="flex-row justify-between items-center mb-[10px]">
        <View className="flex-row items-center gap-[8px]">
          <Text className="text-[13px] font-semibold text-slate-700">
            Khả năng thành công <Text className="text-[#EF4444]">*</Text>
          </Text>
          <View
            style={{ backgroundColor: meta.bgColor, borderColor: meta.borderColor }}
            className="px-[8px] py-[2px] rounded-[6px] border"
          >
            <Text style={{ color: meta.color }} className="text-[11px] font-bold">
              {meta.label}
            </Text>
          </View>
        </View>

        <View
          style={{ backgroundColor: meta.bgColor, borderColor: meta.borderColor }}
          className="px-[12px] py-[3px] rounded-[8px] border-[1.5px]"
        >
          <Text style={{ color: meta.color }} className="text-[16px] font-extrabold">
            {safeVal}%
          </Text>
        </View>
      </View>

      {/* Slider Track Bar */}
      <View
        ref={trackRef}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w);
          measureTrack();
        }}
        {...panResponder.panHandlers}
        className="h-[36px] justify-center relative"
      >
        <View className="h-[8px] bg-slate-200 rounded-[4px] overflow-hidden">
          <View
            style={{
              width: `${safeVal}%`,
              backgroundColor: meta.color,
            }}
            className="h-full rounded-[4px]"
          />
        </View>

        <View
          style={{
            left: knobLeft,
            borderColor: meta.color,
            shadowColor: meta.color,
          }}
          className="absolute top-[6px] w-[24px] h-[24px] rounded-[12px] bg-white border-[3px] justify-center items-center shadow-md"
        >
          <View style={{ backgroundColor: meta.color }} className="w-[8px] h-[8px] rounded-[4px]" />
        </View>
      </View>

      {/* 0% - Large Value - 100% Display Matching Web */}
      <View className="flex-row justify-between items-center mt-[4px] px-[2px]">
        <Text className="text-[12px] text-slate-400 font-medium">0%</Text>
        <Text style={{ color: meta.color }} className="text-[18px] font-extrabold">
          {safeVal}%
        </Text>
        <Text className="text-[12px] text-slate-400 font-medium">100%</Text>
      </View>

      {/* Quick Select Presets */}
      <View className="flex-row justify-between mt-[10px] gap-[6px]">
        {[0, 25, 35, 50, 75, 100].map((step) => {
          const isCurrent = safeVal === step;
          return (
            <TouchableOpacity
              key={step}
              style={
                isCurrent
                  ? { backgroundColor: meta.bgColor, borderColor: meta.borderColor }
                  : undefined
              }
              onPress={() => onChange(step)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              className="flex-1 py-[6px] rounded-[6px] bg-slate-100 border border-slate-200 items-center"
            >
              <Text
                style={isCurrent ? { color: meta.color, fontWeight: '700' } : undefined}
                className="text-[11px] text-slate-500 font-semibold"
              >
                {step}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const Step4Evaluation: React.FC = () => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const { formData, updateField } = useOpportunityFormStore();
  const { priority, successChance } = formData;

  return (
    <View className="bg-white rounded-[14px] p-[16px] border border-slate-200">
      <View className="flex-row items-center mb-[16px] gap-[12px]">
        <View style={{ backgroundColor: '#FDF2F8' }} className="w-[30px] h-[30px] rounded-[15px] justify-center items-center">
          <Text style={{ color: '#DB2777' }} className="text-[14px] font-bold">4</Text>
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-900">Đánh giá cơ hội</Text>
          <Text className="text-[12px] text-slate-500 mt-[2px]">Mức độ ưu tiên và tỷ lệ thành công dự kiến</Text>
        </View>
      </View>

      {/* Độ ưu tiên */}
      <View className="mb-[16px]">
        <Text className="text-[13px] font-semibold text-slate-700 mb-[6px]">Độ ưu tiên</Text>
        <View style={isSmallScreen ? { gap: 4 } : undefined} className="flex-row gap-[8px]">
          {PRIORITIES.map((p) => {
            const isSelected = (priority || '').toLowerCase() === p.id.toLowerCase();
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  isSmallScreen && { paddingVertical: 8, paddingHorizontal: 4, gap: 4 },
                  isSelected && {
                    borderColor: p.color,
                    backgroundColor: `${p.color}15`,
                  },
                ]}
                onPress={() => updateField('priority', p.id)}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-center py-[10px] rounded-[10px] border border-slate-200 bg-slate-50 gap-[6px]"
              >
                <View style={{ backgroundColor: p.color }} className="w-[8px] h-[8px] rounded-[4px]" />
                <Text
                  style={[
                    isSmallScreen && { fontSize: 12 },
                    isSelected && {
                      color: p.color,
                      fontWeight: '700',
                    },
                  ]}
                  className="text-[13px] text-slate-500 font-semibold"
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Khả năng thành công: Thanh trượt cảm ứng 0% - 35% - 100% */}
      <SuccessChanceSlider
        value={successChance}
        onChange={(val) => updateField('successChance', val)}
      />
    </View>
  );
};
