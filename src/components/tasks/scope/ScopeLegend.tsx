import React from 'react';
import { Text, View } from 'react-native';

interface SwatchProps {
  color: string;
  children: string;
}

const Swatch = ({ color, children }: SwatchProps) => (
  <View className="flex-row items-center gap-1.5">
    <View className="w-3.5 h-3.5 rounded border border-slate-300" style={{ backgroundColor: color }} />
    <Text className="text-[11px] text-text-secondary">{children}</Text>
  </View>
);

interface ScopeLegendProps {
  canDraw: boolean;
  hasSpell: boolean;
  hasQc: boolean;
  showScanState: boolean;
}

export default function ScopeLegend({ canDraw, hasSpell, hasQc, showScanState }: ScopeLegendProps) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <Swatch color="#eff6ff">Kịch bản được quét</Swatch>
      <Swatch color="#f1f5f9">Kịch bản bỏ qua</Swatch>
      <Swatch color="#ede9fe">Vùng tự chọn đã nộp</Swatch>
      {canDraw ? <Swatch color="#fef3c7">Vùng đang chọn</Swatch> : null}
      {canDraw ? <Swatch color="#bae6fd">Đang kéo để mở rộng</Swatch> : null}
      {hasSpell ? <Swatch color="#fef08a">Lỗi chính tả</Swatch> : null}
      {hasQc ? <Swatch color="#fee2e2">Dòng có điểm QC chưa khớp</Swatch> : null}
      {showScanState ? <Text className="text-[11px] text-text-muted">Chữ mờ là ô không bị quét</Text> : null}
    </View>
  );
}
