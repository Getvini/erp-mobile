import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { scenarioCode } from '@/utils/sheetScope';
import type { QcBatchInfo, QcMismatchResultItem } from '@/services/taskResultChecksService';

const STATUS_META: Record<string, { label: string; badge: string; text: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  pending: { label: 'Đang chờ', badge: 'bg-slate-100', text: 'text-slate-600', icon: 'circle' },
  running: { label: 'Đang chạy', badge: 'bg-blue-100', text: 'text-blue-700', icon: 'loader' },
  done: { label: 'Xong', badge: 'bg-emerald-100', text: 'text-emerald-700', icon: 'check-circle' },
  error: { label: 'Lỗi', badge: 'bg-red-100', text: 'text-red-700', icon: 'x-circle' },
};

const idPart = (id: unknown) => String(id || '').split('::').pop() || '';

const rowInRanges = (item: QcMismatchResultItem, scenarios: QcBatchInfo['scenarios']) => {
  const range = Array.isArray(item.row_range) ? item.row_range : [item.row_range, item.row_range];
  const start = Number(range[0]);
  const end = Number(range[1] ?? range[0]);
  return scenarios.some((s) => Array.isArray(s.rowRange) && s.rowRange[0] <= end && s.rowRange[1] >= start);
};

const belongsToBatch = (item: QcMismatchResultItem, batch: QcBatchInfo) => {
  if (item.sheet_name !== batch.sheet) return false;
  if (item.blockId) return batch.blockIds.includes(item.blockId);
  return rowInRanges(item, batch.scenarios || []);
};

const formatDuration = (ms: number | null) => {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

interface QcMismatchRowProps {
  item: QcMismatchResultItem;
  readOnly?: boolean;
  disabled?: boolean;
  onToggle?: (itemId: string, confirmed: boolean) => void;
  onLocate?: (item: QcMismatchResultItem) => void;
  canLocate?: boolean;
}

export function QcMismatchRow({ item, readOnly, disabled, onToggle, onLocate, canLocate }: QcMismatchRowProps) {
  return (
    <View className="flex-row items-start gap-2 px-3 py-2">
      {readOnly ? (
        <View className="mt-1.5 w-2 h-2 rounded-full bg-red-400" />
      ) : (
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onToggle?.(item.id, !item.confirmed)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Xác nhận điểm chưa khớp"
          className={`mt-0.5 w-5 h-5 rounded border items-center justify-center ${
            item.confirmed ? 'bg-success border-success' : 'border-slate-300'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          {item.confirmed && <Feather name="check" size={13} color="#FFFFFF" />}
        </TouchableOpacity>
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-xs font-medium text-slate-700">
          {item.sheet_name ? `${item.sheet_name}${item.scenario ? ` / ${item.scenario}` : ''} · ` : ''}
          {item.product_ref || 'Không rõ sản phẩm'} · {item.attribute}
        </Text>
        <Text className="text-xs text-slate-500">
          <Text className="text-red-600">{item.claimed_value}</Text>
          <Text className="text-slate-400">{' → '}</Text>
          {item.expected_value != null ? (
            <Text className="font-medium text-emerald-700">{item.expected_value}</Text>
          ) : (
            <Text className="italic text-slate-400">không tìm thấy</Text>
          )}
        </Text>
        {!!item.reasoning && <Text className="text-xs italic text-slate-400">{item.reasoning}</Text>}
        {canLocate && (
          <TouchableOpacity
            onPress={() => onLocate?.(item)}
            className="self-start py-1.5"
            accessibilityLabel="Xem trên bảng"
          >
            <Text className="text-xs font-bold text-blue-600">Xem trên bảng</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface QcBatchPanelProps {
  batches?: QcBatchInfo[];
  reviewedItems?: QcMismatchResultItem[];
  settled: boolean;
  multiSheet: boolean;
  isFinalized: boolean;
  canReview: boolean;
  onToggle: (itemId: string, confirmed: boolean) => void;
  onLocate: (item: QcMismatchResultItem) => void;
  canLocate: (item: QcMismatchResultItem) => boolean;
}

export default function QcBatchPanel({
  batches = [],
  reviewedItems = [],
  settled,
  multiSheet,
  isFinalized,
  canReview,
  onToggle,
  onLocate,
  canLocate,
}: QcBatchPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const total = batches.length;
  const finished = batches.filter((b) => b.status === 'done' || b.status === 'error').length;
  const failed = batches.filter((b) => b.status === 'error').length;
  const percent = total === 0 ? 0 : Math.round((finished / total) * 100);

  const rowsByBatch = useMemo(() => {
    const map = new Map<string, { rows: QcMismatchResultItem[]; readOnly: boolean }>();
    batches.forEach((batch) => {
      const live = (batch.mismatches || []).filter((m) => m.status !== 'unresolved');
      const reviewed = reviewedItems.filter((item) => belongsToBatch(item, batch));
      map.set(
        batch.key,
        settled && reviewed.length > 0 ? { rows: reviewed, readOnly: false } : { rows: live, readOnly: true }
      );
    });
    return map;
  }, [batches, reviewedItems, settled]);

  const orphanItems = useMemo(
    () => (settled ? reviewedItems.filter((item) => !batches.some((batch) => belongsToBatch(item, batch))) : []),
    [batches, reviewedItems, settled]
  );

  const isOpen = (batch: QcBatchInfo, rowCount: number) =>
    expanded[batch.key] ?? (rowCount > 0 || batch.status === 'error' || batch.status === 'running');

  const showHelp = () =>
    Alert.alert(
      'QC chạy theo từng batch',
      'Các kịch bản được chia thành nhiều batch để gửi cho AI đối chiếu. Mỗi batch trả kết quả riêng ngay khi chạy xong, bạn không cần chờ toàn bộ.\n\nChạm vào một batch để xem danh sách kịch bản (kèm mã định danh) và các điểm chưa khớp của riêng batch đó.\n\nBatch báo Lỗi nghĩa là các kịch bản trong batch chưa được đối chiếu. Bấm Kiểm tra lại QC để chạy lại.'
    );

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-bold text-slate-700">Kết quả theo batch</Text>
        <TouchableOpacity onPress={showHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Trợ giúp về batch">
          <Feather name="help-circle" size={14} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="ml-auto text-[11px] text-slate-500">
          {finished}/{total} batch
          {failed > 0 && <Text className="text-red-600">{` · ${failed} lỗi`}</Text>}
        </Text>
      </View>

      <View className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <View
          className={failed > 0 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${percent}%` }}
        />
      </View>

      {failed > 0 && settled && (
        <View className="flex-row items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <Feather name="alert-triangle" size={15} color="#92400E" />
          <Text className="flex-1 text-xs text-amber-800">
            {failed} batch bị lỗi nên kết quả QC chưa đầy đủ. Hãy kiểm tra lại QC trước khi chốt.
          </Text>
        </View>
      )}

      <View className="gap-2">
        {batches.map((batch, position) => {
          const meta = STATUS_META[batch.status] || STATUS_META.pending;
          const { rows, readOnly } = rowsByBatch.get(batch.key) || { rows: [], readOnly: true };
          const open = isOpen(batch, rows.length);
          const duration = formatDuration(batch.durationMs);
          const scenarios = batch.scenarios || [];
          const preview = scenarios.slice(0, 3).map((s) => s.label).join(', ');
          const more = scenarios.length - 3;
          return (
            <View key={batch.key} className="border border-border rounded-xl bg-surface overflow-hidden">
              <TouchableOpacity
                onPress={() => setExpanded((prev) => ({ ...prev, [batch.key]: !open }))}
                className="flex-row items-center gap-2 px-3 py-2.5"
                activeOpacity={0.7}
                accessibilityLabel={`Batch ${position + 1}`}
              >
                <Feather name={open ? 'chevron-down' : 'chevron-right'} size={14} color="#94A3B8" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-700">
                    Batch {position + 1}/{total}
                    {multiSheet ? <Text className="font-normal text-slate-500">{`  ${batch.sheet}`}</Text> : null}
                  </Text>
                  {!!preview && (
                    <Text className="text-[11px] text-slate-400" numberOfLines={1}>
                      {preview}
                      {more > 0 ? ` +${more}` : ''}
                    </Text>
                  )}
                </View>
                <View className="items-end gap-1">
                  {rows.length > 0 && (
                    <View className="px-1.5 py-0.5 rounded-full bg-red-50">
                      <Text className="text-[10px] font-bold text-red-600">{rows.length} chưa khớp</Text>
                    </View>
                  )}
                  {batch.status === 'done' && rows.length === 0 && (
                    <View className="px-1.5 py-0.5 rounded-full bg-emerald-50">
                      <Text className="text-[10px] font-bold text-emerald-600">Khớp hết</Text>
                    </View>
                  )}
                  <View className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                    <Feather name={meta.icon} size={10} color="#475569" />
                    <Text className={`text-[10px] font-bold ${meta.text}`}>{meta.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {open && (
                <View className="border-t border-slate-100">
                  <View className="px-3 py-2 flex-row flex-wrap gap-1.5 bg-background">
                    {scenarios.map((s) => (
                      <View
                        key={s.id}
                        className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border"
                      >
                        <Text className="text-[10px] font-bold text-slate-700">
                          {scenarioCode({ id: s.id }) || idPart(s.id)}
                        </Text>
                        <Text className="text-[10px] text-slate-600" numberOfLines={1} style={{ maxWidth: 140 }}>
                          {s.label}
                        </Text>
                        {Array.isArray(s.rowRange) && (
                          <Text className="text-[10px] text-slate-400">
                            {s.rowRange[0]}–{s.rowRange[1]}
                          </Text>
                        )}
                      </View>
                    ))}
                    {(duration || batch.cached || batch.unverified > 0) && (
                      <Text className="text-[10px] text-slate-400 self-center">
                        {duration}
                        {batch.cached ? ' · từ cache' : ''}
                        {batch.unverified > 0 ? ` · soát lại ${batch.unverified} kịch bản` : ''}
                      </Text>
                    )}
                  </View>

                  {batch.status === 'error' && (
                    <View className="px-3 py-2 bg-red-50 border-t border-red-100">
                      <Text className="text-xs text-red-600">{batch.error || 'Batch này bị lỗi'}</Text>
                    </View>
                  )}

                  {(batch.status === 'pending' || batch.status === 'running') && rows.length === 0 && (
                    <View className="px-3 py-2">
                      <Text className="text-xs text-slate-400">
                        {batch.status === 'running' ? 'Đang đối chiếu batch này...' : 'Chưa tới lượt batch này'}
                      </Text>
                    </View>
                  )}

                  {batch.status === 'done' && rows.length === 0 && (
                    <View className="px-3 py-2">
                      <Text className="text-xs text-slate-400">Không phát hiện điểm chưa khớp trong batch này</Text>
                    </View>
                  )}

                  {rows.map((item, index) => (
                    <View key={`${item.id}-${index}`} className="border-t border-slate-100">
                      <QcMismatchRow
                        item={item}
                        readOnly={readOnly}
                        disabled={isFinalized || !canReview}
                        onToggle={onToggle}
                        onLocate={onLocate}
                        canLocate={canLocate(item)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {orphanItems.length > 0 && (
        <View className="border border-border rounded-xl bg-surface">
          <Text className="px-3 py-1.5 text-[11px] font-bold text-slate-500 border-b border-slate-100">
            Kết quả không thuộc batch nào
          </Text>
          {orphanItems.map((item, index) => (
            <View key={item.id} className={index > 0 ? 'border-t border-slate-100' : ''}>
              <QcMismatchRow
                item={item}
                disabled={isFinalized || !canReview}
                onToggle={onToggle}
                onLocate={onLocate}
                canLocate={canLocate(item)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
