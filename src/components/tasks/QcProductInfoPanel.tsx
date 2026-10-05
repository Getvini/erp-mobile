import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQcProductInfoQuery } from '@/hooks/queries/useQcSpellCheck';
import { QcProductInfoItem } from '@/services/qcSpellCheckService';
import RichTextContent from '@/components/announcements/RichTextContent';

interface QcProductInfoPanelProps {
  projectId?: string;
}

interface ProductInfoItemProps {
  item: QcProductInfoItem;
  defaultExpanded: boolean;
  showDivider: boolean;
}

const LOAD_ERROR_MESSAGE = 'Không thể tải thông tin sản phẩm chuẩn';

const openDocument = (url?: string | null) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    Alert.alert('Lỗi', 'Không thể mở tài liệu sản phẩm chuẩn.');
  });
};

function ProductInfoItem({ item, defaultExpanded, showDivider }: ProductInfoItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasContent = Boolean(item.extractedText && item.extractedText.trim());
  const hasNote = Boolean(item.note && item.note.trim());

  return (
    <View className={`py-2 gap-1.5 ${showDivider ? 'border-t border-slate-100' : ''}`}>
      <View className="flex-row items-center justify-between gap-2">
        <TouchableOpacity
          className="flex-row items-center gap-1 flex-1"
          onPress={() => setExpanded((prev) => !prev)}
          disabled={!hasContent}
          activeOpacity={0.7}
        >
          {hasContent && <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#64748B" />}
          <Text className="text-xs font-bold text-slate-800 flex-1">{item.productName}</Text>
        </TouchableOpacity>

        {item.fileUrl ? (
          <TouchableOpacity
            className="flex-row items-center gap-1"
            onPress={() => openDocument(item.fileUrl)}
            activeOpacity={0.7}
          >
            <Feather name="external-link" size={11} color="#2563EB" />
            <Text className="text-xs font-bold text-blue-600">Tài liệu</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasContent && expanded && (
        <View className="rounded-lg border border-slate-300 bg-slate-50">
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ padding: 8 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <RichTextContent html={item.extractedText || ''} />
          </ScrollView>
        </View>
      )}

      {hasNote && (
        <View className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
          <Text className="text-xs text-slate-500">
            <Text className="font-semibold">Chú thích:</Text> {item.note}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function QcProductInfoPanel({ projectId }: QcProductInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isFetching, error } = useQcProductInfoQuery(projectId, isOpen);
  const items = data || [];

  if (!projectId) return null;

  const errorMessage = error instanceof Error && error.message ? error.message : LOAD_ERROR_MESSAGE;
  const showLoading = isFetching && items.length === 0;

  return (
    <View className="gap-1.5">
      <TouchableOpacity
        className="flex-row items-center gap-1.5"
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Feather name="info" size={13} color="#475569" />
        <Text className="text-xs font-bold text-slate-600">Thông tin chuẩn đang đối chiếu</Text>
        <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#475569" />
      </TouchableOpacity>

      {isOpen && (
        <View className="px-2 py-1 border border-border rounded-xl bg-surface">
          {showLoading && (
            <View className="flex-row items-center gap-2 py-1">
              <ActivityIndicator size="small" color="#94A3B8" />
              <Text className="text-xs text-slate-400">Đang tải thông tin sản phẩm...</Text>
            </View>
          )}

          {!isFetching && error && <Text className="py-1 text-xs text-danger">{errorMessage}</Text>}

          {!isFetching && !error && items.length === 0 && (
            <Text className="py-1 text-xs text-slate-400">Chưa có thông tin sản phẩm chuẩn</Text>
          )}

          {!error &&
            items.map((item, idx) => (
              <ProductInfoItem
                key={`${item.productName}-${idx}`}
                item={item}
                defaultExpanded={items.length === 1}
                showDivider={idx > 0}
              />
            ))}
        </View>
      )}
    </View>
  );
}
