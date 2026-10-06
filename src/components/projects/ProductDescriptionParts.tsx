import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ExtractedDocumentContent from '@/components/projects/ExtractedDocumentContent';
import { htmlToEditableText } from '@/utils/productDescriptionText';

export interface FormatPreview {
  html: string;
  removed: string[];
  warnings: string[];
}

interface ExtractedContentViewProps {
  html?: string | null;
  maxHeight?: number;
  emptyText?: string;
}

export function ExtractedContentView({ html, maxHeight = 384, emptyText }: ExtractedContentViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const length = useMemo(() => htmlToEditableText(html).length, [html]);

  if (length === 0) {
    return emptyText ? <Text className="text-xs text-slate-400 italic">{emptyText}</Text> : null;
  }

  return (
    <View className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 overflow-hidden">
      <ScrollView
        style={{ maxHeight: Math.min(maxHeight, Math.round(windowHeight * 0.6)) }}
        contentContainerStyle={{ padding: 10 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <ExtractedDocumentContent html={html} />
      </ScrollView>
    </View>
  );
}

export function WarningList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <View className="p-2 rounded-lg bg-amber-50 border border-amber-300 gap-1">
      {items.map((warning, index) => (
        <View key={`${index}-${warning}`} className="flex-row items-start gap-1.5">
          <Text className="text-[11px] text-amber-800">•</Text>
          <Text className="text-[11px] text-amber-800 font-medium flex-1 leading-4">{warning}</Text>
        </View>
      ))}
    </View>
  );
}

interface FormatPreviewPanelProps {
  preview: FormatPreview;
  onApply: () => void;
  onDiscard: () => void;
}

export function FormatPreviewPanel({ preview, onApply, onDiscard }: FormatPreviewPanelProps) {
  const [removedOpen, setRemovedOpen] = useState(false);
  const removedCount = preview.removed.length;

  return (
    <View className="gap-2">
      <Text className="text-[11px] font-semibold text-emerald-700 leading-4">
        Xem trước kết quả AI formatting (chưa áp dụng). Chữ giữ nguyên văn bản gốc, AI chỉ đổi bố cục và loại dòng không liên quan.
      </Text>

      <ExtractedContentView html={preview.html} maxHeight={320} />

      <WarningList items={preview.warnings} />

      {removedCount > 0 ? (
        <View className="rounded-lg border border-amber-300 bg-amber-50">
          <TouchableOpacity
            onPress={() => setRemovedOpen((prev) => !prev)}
            className="flex-row items-center gap-1.5 px-2.5 py-2"
            activeOpacity={0.7}
          >
            <Text className="text-[11px] font-bold text-amber-800 flex-1 leading-4">
              AI đã loại {removedCount} dòng - bấm để kiểm tra không mất thông tin cần thiết
            </Text>
            <Feather name={removedOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#92400E" />
          </TouchableOpacity>

          {removedOpen && (
            <ScrollView
              style={{ maxHeight: 160 }}
              contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 8, gap: 2 }}
              nestedScrollEnabled
            >
              {preview.removed.map((line, index) => (
                <View key={`${index}-${line}`} className="flex-row items-start gap-1.5">
                  <Text className="text-[11px] text-amber-900">•</Text>
                  <Text className="text-[11px] text-amber-900 flex-1 leading-4">{line}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <Text className="text-[11px] text-slate-500">AI không loại dòng nào.</Text>
      )}

      <View className="flex-row justify-end gap-2">
        <TouchableOpacity
          onPress={onDiscard}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
          activeOpacity={0.7}
        >
          <Text className="text-xs font-bold text-slate-600">Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onApply}
          className="px-3 py-1.5 rounded-lg bg-emerald-600"
          activeOpacity={0.8}
        >
          <Text className="text-xs font-bold text-white">Áp dụng</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
