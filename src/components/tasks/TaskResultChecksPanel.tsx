import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SpellCheckWhitelist from './SpellCheckWhitelist';
import QcBatchPanel, { QcMismatchRow } from './QcBatchPanel';
import ScanScopeModal from './scope/ScanScopeModal';
import type { ScopeFocus } from './scope/scopeTypes';
import { apiService } from '@/services/api';
import {
  useTaskResultCheckQuery,
  useToggleResultCheckItemMutation,
  useToggleResultCheckItemsMutation,
  useFinalizeResultCheckMutation,
  useRerunResultCheckMutation,
} from '@/hooks/queries/useTaskResultChecks';
import type {
  CheckRunStatus,
  QcMismatchResultItem,
  RerunKind,
  SpellCheckResultItem,
} from '@/services/taskResultChecksService';
import { createTaskSource } from '@/utils/sheetPreviewSource';
import { locateQcItem, locateSpellItem, regionRef } from '@/utils/sheetScope';
import type { LocatedCell, ScanRegion, ScenarioInfo } from '@/utils/sheetScope';

interface TaskResultChecksPanelProps {
  taskId: string;
  projectId?: string;
}

interface SpellGroup {
  token: string;
  items: SpellCheckResultItem[];
  confirmedCount: number;
}

const groupSpellItems = (items: SpellCheckResultItem[]): SpellGroup[] => {
  const map = new Map<string, SpellCheckResultItem[]>();
  items.forEach((item) => {
    if (!map.has(item.token)) map.set(item.token, []);
    map.get(item.token)!.push(item);
  });
  return Array.from(map.entries())
    .map(([token, group]) => ({
      token,
      items: group,
      confirmedCount: group.filter((i) => i.confirmed).length,
    }))
    .sort((a, b) => b.items.length - a.items.length);
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

interface CheckStateBoxProps {
  status?: CheckRunStatus;
  errorMessage?: string | null;
  label: string;
  onRetry: () => void;
  isRetrying: boolean;
  canRetry: boolean;
}

function CheckStateBox({ status, errorMessage, label, onRetry, isRetrying, canRetry }: CheckStateBoxProps) {
  if (status === 'PENDING' || status === 'RUNNING') {
    return (
      <View className="flex-row items-center gap-2 py-2">
        <ActivityIndicator size="small" color="#F38820" />
        <Text className="text-xs text-slate-400">Đang kiểm tra {label}...</Text>
      </View>
    );
  }
  if (status === 'ERROR') {
    return (
      <View className="p-3 bg-red-50 border border-red-100 rounded-xl gap-2">
        <Text className="text-xs text-danger">{errorMessage || `Lỗi khi kiểm tra ${label}`}</Text>
        {canRetry && (
          <TouchableOpacity
            onPress={onRetry}
            disabled={isRetrying}
            className="flex-row items-center justify-center gap-1.5 self-start px-3 py-2.5 rounded-xl border border-border bg-surface"
            accessibilityLabel={`Kiểm tra lại ${label}`}
          >
            {isRetrying ? <ActivityIndicator size="small" color="#475569" /> : <Feather name="refresh-cw" size={13} color="#475569" />}
            <Text className="text-xs font-bold text-slate-600">Kiểm tra lại {label}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return null;
}

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
  icon?: React.ComponentProps<typeof Feather>['name'];
}

function ActionButton({ label, onPress, loading, disabled, primary, icon }: OutlineButtonProps) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.8}
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-1.5 px-3 rounded-xl ${primary ? 'bg-primary' : 'border border-border bg-surface'} ${off ? 'opacity-50' : ''}`}
      style={{ minHeight: 40 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? '#FFFFFF' : '#475569'} />
      ) : icon ? (
        <Feather name={icon} size={13} color={primary ? '#FFFFFF' : '#475569'} />
      ) : null}
      <Text className={`text-xs font-bold ${primary ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckBox({ checked, partial, disabled, onPress, label }: { checked: boolean; partial?: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={label}
      className={`w-5 h-5 rounded border items-center justify-center ${checked || partial ? 'bg-success border-success' : 'border-slate-300'} ${disabled ? 'opacity-50' : ''}`}
    >
      {checked && <Feather name="check" size={13} color="#FFFFFF" />}
      {!checked && partial && <Feather name="minus" size={13} color="#FFFFFF" />}
    </TouchableOpacity>
  );
}

export default function TaskResultChecksPanel({ taskId, projectId }: TaskResultChecksPanelProps) {
  const router = useRouter();
  const { data: record, isLoading } = useTaskResultCheckQuery(taskId, Boolean(taskId));
  const toggleItemMutation = useToggleResultCheckItemMutation();
  const toggleItemsMutation = useToggleResultCheckItemsMutation();
  const finalizeMutation = useFinalizeResultCheckMutation();
  const rerunSpellMutation = useRerunResultCheckMutation();
  const rerunQcMutation = useRerunResultCheckMutation();
  const rerunScopedMutation = useRerunResultCheckMutation();
  const [rerunWhitelist, setRerunWhitelist] = useState<string[] | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFocus, setPreviewFocus] = useState<ScopeFocus | null>(null);
  const [rerunRegions, setRerunRegions] = useState<ScanRegion[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const focusCounter = useRef(0);

  const recordId = record?.id;
  const previewSource = useMemo(
    () => (taskId && recordId ? createTaskSource(taskId, recordId) : null),
    [taskId, recordId]
  );

  const scannedScenarios = record?.scannedScenarios;
  const scenariosBySheet = useMemo(() => {
    const map: Record<string, ScenarioInfo[]> = {};
    (scannedScenarios || []).forEach((scenario) => {
      if (!map[scenario.sheet]) map[scenario.sheet] = [];
      map[scenario.sheet].push(scenario as unknown as ScenarioInfo);
    });
    return map;
  }, [scannedScenarios]);

  const spellItems = useMemo(() => record?.reviewedSpellErrors || [], [record?.reviewedSpellErrors]);
  const spellGroups = useMemo(() => groupSpellItems(spellItems), [spellItems]);

  if (isLoading) {
    return (
      <View className="flex-row items-center gap-2 p-4">
        <ActivityIndicator size="small" color="#94A3B8" />
        <Text className="text-xs text-slate-400">Đang tải kết quả kiểm tra...</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View className="p-4 bg-background border border-border rounded-2xl">
        <Text className="text-xs text-slate-500">Kết quả này không được tự động kiểm tra chính tả/QC.</Text>
      </View>
    );
  }

  const canReview = Boolean(record.canReview);
  const isFinalized = Boolean(record.finalizedAt);

  if (!canReview && !isFinalized) {
    return (
      <View className="flex-row items-center gap-2 p-4 bg-background border border-border rounded-2xl">
        <ActivityIndicator size="small" color="#F38820" />
        <Text className="flex-1 text-xs text-slate-500">
          Kết quả đang được rà soát chính tả/QC, sẽ hiển thị sau khi được chốt.
        </Text>
      </View>
    );
  }

  const spellStatus = record.spellStatus || record.status;
  const qcStatus = record.qcStatus || record.status;
  const spellReady = spellStatus === 'DONE';
  const qcReady = qcStatus === 'DONE';
  const canFinalize = spellReady && qcReady;
  const qcItems = record.reviewedQcMismatches || [];
  const qcMismatchItems = qcItems.filter((i) => i.status !== 'unresolved');
  const qcNoteItems = qcItems.filter((i) => i.status === 'unresolved');
  const qcBatches = record.qcBatches || [];
  const confirmedSpellCount = spellItems.filter((i) => i.confirmed).length;
  const confirmedQcCount = qcMismatchItems.filter((i) => i.confirmed).length;
  const activeWhitelist = rerunWhitelist ?? record.reviewerWhitelist ?? [];
  const scopeSheets = record.sheetNames || [];
  const scopeRegions = record.scanRegions || [];
  const detectedScenarios = record.scannedScenarios || [];
  const selectedScenarioIds = record.scenarioIds ?? detectedScenarios.map((s) => s.id);
  const selectedScenarioCount = detectedScenarios.filter((s) => selectedScenarioIds.includes(s.id)).length;
  const fallbackSheet = scopeSheets.length === 1 ? scopeSheets[0] : null;
  const canRerunScoped = canReview && !isFinalized;
  const isAnyRunning = spellStatus === 'RUNNING' || qcStatus === 'RUNNING';
  const canEdit = !isFinalized && canReview;

  const openPreview = (target: LocatedCell | null) => {
    focusCounter.current += 1;
    setPreviewFocus(target ? { ...target, nonce: focusCounter.current } : null);
    setIsPreviewOpen(true);
  };

  const locateSpell = (item: SpellCheckResultItem) => {
    const target = locateSpellItem(item, fallbackSheet);
    if (target) openPreview(target);
  };

  const locateQc = (item: QcMismatchResultItem) => {
    const target = locateQcItem(item);
    if (target) openPreview(target);
  };

  const canLocateQc = (item: QcMismatchResultItem) => Boolean(locateQcItem(item));

  const handleScopedRerun = async (kind: RerunKind) => {
    try {
      await rerunScopedMutation.mutateAsync({
        taskId,
        kind,
        whitelist: activeWhitelist,
        scope: { scenarioIds: [], regions: rerunRegions },
      });
      Alert.alert('Thành công', 'Đang quét lại các vùng đã chọn...');
      setRerunRegions([]);
      setIsPreviewOpen(false);
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể quét lại các vùng đã chọn'));
    }
  };

  const syncLocalWhitelist = (itemIds: string[], confirmed: boolean) => {
    if (rerunWhitelist === null) return;
    const idSet = new Set(itemIds);
    const tokens = Array.from(
      new Set(spellItems.filter((i) => idSet.has(i.id)).map((i) => i.token).filter(Boolean))
    );
    if (!confirmed) {
      setRerunWhitelist((prev) => Array.from(new Set([...(prev ?? []), ...tokens])));
      return;
    }
    const stillDismissed = new Set(spellItems.filter((i) => !i.confirmed && !idSet.has(i.id)).map((i) => i.token));
    const restored = new Set(tokens.filter((token) => !stillDismissed.has(token)));
    setRerunWhitelist((prev) => (prev ?? []).filter((word) => !restored.has(word)));
  };

  const handleToggle = async (kind: 'SPELL' | 'QC', itemId: string, confirmed: boolean) => {
    try {
      await toggleItemMutation.mutateAsync({ taskId, kind, itemId, confirmed });
      if (kind === 'SPELL') syncLocalWhitelist([itemId], confirmed);
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể cập nhật mục kiểm tra'));
    }
  };

  const handleToggleGroup = async (group: SpellGroup, confirmed: boolean) => {
    try {
      const itemIds = group.items.map((item) => item.id);
      await toggleItemsMutation.mutateAsync({ taskId, kind: 'SPELL', itemIds, confirmed });
      syncLocalWhitelist(itemIds, confirmed);
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể cập nhật mục kiểm tra'));
    }
  };

  const toggleExpanded = (token: string) => {
    setExpandedTokens((prev) => ({ ...prev, [token]: !prev[token] }));
  };

  const handleFinalize = async () => {
    try {
      await finalizeMutation.mutateAsync(taskId);
      Alert.alert('Thành công', 'Đã chốt kết quả kiểm tra');
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể chốt kết quả kiểm tra'));
    }
  };

  const handleRerunSpell = async () => {
    try {
      await rerunSpellMutation.mutateAsync({ taskId, kind: 'SPELL', whitelist: activeWhitelist });
      Alert.alert('Thành công', 'Đang kiểm tra lại chính tả...');
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể kiểm tra lại chính tả'));
    }
  };

  const handleRerunQc = async () => {
    try {
      await rerunQcMutation.mutateAsync({ taskId, kind: 'QC', whitelist: activeWhitelist });
      Alert.alert('Thành công', 'Đang kiểm tra lại QC...');
    } catch (err) {
      Alert.alert('Lỗi', errorText(err, 'Không thể kiểm tra lại QC'));
    }
  };

  const handleOpenExport = (path: string) => {
    const url = `${apiService.getBaseUrl()}${path}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở file xuất.');
    });
  };

  const showScopeHelp = () =>
    Alert.alert(
      'Phạm vi quét',
      'Hiển thị các sheet, kịch bản và vùng tự chọn đã được quét. Mỗi kịch bản/vùng có mã định danh riêng (R5C1, K1...).\n\nVới người rà soát, có thể mở bảng để quét lại từng vùng: dùng Vẽ vùng để tạo vùng mới hoặc Mở rộng để nới một vùng/kịch bản đã quét.\n\nTrong cửa sổ bảng chạm nút Hướng dẫn để xem cách thao tác.'
    );

  const showQcHelp = () =>
    Alert.alert(
      'QC chưa khớp',
      'So sánh nội dung kịch bản với thông tin chuẩn của sản phẩm trong dự án.\n\nTick để xác nhận một điểm là lỗi thật, bỏ tick nếu AI báo nhầm. Chỉ các mục đang tick mới được chốt vào báo cáo.\n\nKết quả được chia theo batch, xem ngay từng batch khi nó chạy xong.'
    );

  const rerunBusy = rerunScopedMutation.isPending;
  const noRegions = rerunRegions.length === 0;

  return (
    <View className="p-4 bg-background border border-border rounded-2xl gap-4">
      {scopeSheets.length > 0 && previewSource && (
        <View className="gap-2 pb-3 border-b border-border">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2 flex-1">
              <Text className="text-sm font-bold text-slate-700">Phạm vi quét</Text>
              <TouchableOpacity onPress={showScopeHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Trợ giúp về phạm vi quét">
                <Feather name="help-circle" size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => openPreview(null)}
              className="flex-row items-center gap-1.5 px-3 rounded-lg border border-blue-200 bg-surface"
              style={{ minHeight: 40 }}
              accessibilityLabel="Mở bảng phạm vi quét"
            >
              <Feather name="eye" size={14} color="#1D4ED8" />
              <Text className="text-xs font-bold text-blue-700">
                {canRerunScoped ? 'Xem bảng và quét lại' : 'Xem trên bảng'}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {scopeSheets.map((name) => (
              <View key={name} className="px-2 py-0.5 bg-surface border border-border rounded-full">
                <Text className="text-[11px] font-medium text-slate-700">{name}</Text>
              </View>
            ))}
          </View>
          <Text className="text-xs text-slate-500">
            {detectedScenarios.length > 0 ? `Kịch bản quét: ${selectedScenarioCount}/${detectedScenarios.length}` : ''}
            {detectedScenarios.length > 0 && scopeRegions.length > 0 ? ' · ' : ''}
            {scopeRegions.length > 0 ? `Vùng tự chọn: ${scopeRegions.length}` : ''}
            {detectedScenarios.length === 0 && scopeRegions.length === 0 ? 'Quét toàn bộ nội dung các sheet đã chọn' : ''}
          </Text>
          {scopeRegions.map((region) => (
            <Text key={`${region.sheet}:${region.id}`} className="text-xs text-slate-600">
              <Text className="font-medium">{region.label || 'Vùng tự chọn'}</Text>
              <Text className="text-slate-400">{` · ${regionRef(region)}${region.qc === false ? ' · không QC' : ''}`}</Text>
            </Text>
          ))}
        </View>
      )}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Feather name="check-square" size={15} color="#334155" />
          <Text className="text-sm font-bold text-slate-700">
            Lỗi chính tả ({confirmedSpellCount}/{spellItems.length})
          </Text>
        </View>
        {isFinalized && <Feather name="lock" size={13} color="#94A3B8" />}
      </View>

      {!spellReady && (
        <CheckStateBox
          status={spellStatus}
          errorMessage={record.spellErrorMessage || record.errorMessage}
          label="chính tả"
          canRetry={canEdit}
          isRetrying={rerunSpellMutation.isPending}
          onRetry={handleRerunSpell}
        />
      )}

      {spellReady && (
        <View className="border border-border rounded-xl bg-surface">
          {spellItems.length === 0 && (
            <View className="px-3 py-2">
              <Text className="text-xs text-slate-400">Không phát hiện lỗi chính tả</Text>
            </View>
          )}
          {spellGroups.map((group, idx) => {
            const isExpanded = Boolean(expandedTokens[group.token]);
            const allConfirmed = group.confirmedCount === group.items.length;
            const noneConfirmed = group.confirmedCount === 0;
            const single = group.items[0];
            return (
              <View key={group.token} className={idx > 0 ? 'border-t border-slate-100' : ''}>
                <View className="flex-row items-center gap-2 px-3 py-2">
                  <CheckBox
                    checked={allConfirmed}
                    partial={!allConfirmed && !noneConfirmed}
                    disabled={!canEdit}
                    onPress={() => handleToggleGroup(group, !allConfirmed)}
                    label={`Chọn tất cả ${group.token}`}
                  />
                  <TouchableOpacity
                    className="flex-1 flex-row items-center gap-1"
                    onPress={() => toggleExpanded(group.token)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Mở nhóm ${group.token}`}
                  >
                    {group.items.length > 1 && (
                      <Feather name={isExpanded ? 'chevron-down' : 'chevron-right'} size={13} color="#475569" />
                    )}
                    <Text className="text-xs font-medium text-slate-700">{group.token}</Text>
                    <Text className="text-xs text-slate-400">x{group.items.length}</Text>
                  </TouchableOpacity>
                  {group.items.length === 1 && (
                    <TouchableOpacity
                      onPress={() => locateSpell(single)}
                      className="flex-row items-center gap-1 py-1"
                      accessibilityLabel="Xem ô này trên bảng"
                    >
                      {!!single.sheetName && <Feather name="file-text" size={12} color="#94A3B8" />}
                      <Text className="text-xs text-slate-400">
                        {single.sheetName ? `${single.sheetName}!` : ''}
                        {single.location}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isExpanded && group.items.length > 1 && (
                  <View className="pl-10 pr-3 pb-2 gap-2">
                    {group.items.map((item) => (
                      <View key={item.id} className="flex-row items-center gap-2">
                        <CheckBox
                          checked={item.confirmed}
                          disabled={!canEdit}
                          onPress={() => handleToggle('SPELL', item.id, !item.confirmed)}
                          label="Xác nhận lỗi chính tả"
                        />
                        <TouchableOpacity
                          onPress={() => locateSpell(item)}
                          className="flex-row items-center gap-1 py-1 flex-1"
                          accessibilityLabel="Xem ô này trên bảng"
                        >
                          {!!item.sheetName && <Feather name="file-text" size={12} color="#94A3B8" />}
                          <Text className="text-xs text-slate-400">
                            {item.sheetName ? `${item.sheetName}!` : ''}
                            {item.location}
                          </Text>
                        </TouchableOpacity>
                        {!!item.scenarioLabel && (
                          <Text className="text-xs italic text-slate-400" numberOfLines={1} style={{ maxWidth: 120 }}>
                            {item.scenarioLabel}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {spellReady && canEdit && (
        <View className="gap-2">
          <SpellCheckWhitelist whitelist={activeWhitelist} onChange={setRerunWhitelist} />
          <View className="self-start">
            <ActionButton
              label="Kiểm tra lại chính tả"
              icon="refresh-cw"
              onPress={handleRerunSpell}
              loading={rerunSpellMutation.isPending}
            />
          </View>
        </View>
      )}

      <View className="flex-row items-center gap-2 pt-2 border-t border-border">
        <Feather name="clipboard" size={15} color="#334155" />
        <Text className="text-sm font-bold text-slate-700">
          QC chưa khớp ({confirmedQcCount}/{qcMismatchItems.length})
        </Text>
        <TouchableOpacity onPress={showQcHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Trợ giúp về QC">
          <Feather name="help-circle" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {!qcReady && (
        <CheckStateBox
          status={qcStatus}
          errorMessage={record.qcErrorMessage || record.errorMessage}
          label="QC"
          canRetry={canEdit}
          isRetrying={rerunQcMutation.isPending}
          onRetry={handleRerunQc}
        />
      )}

      {!qcReady && qcBatches.length > 0 && (
        <QcBatchPanel
          batches={qcBatches}
          reviewedItems={[]}
          settled={false}
          multiSheet={scopeSheets.length > 1}
          isFinalized={isFinalized}
          canReview={canReview}
          onToggle={(itemId, confirmed) => handleToggle('QC', itemId, confirmed)}
          onLocate={locateQc}
          canLocate={canLocateQc}
        />
      )}

      {qcReady && (
        <>
          {!!record.qcModels && (
            <View className="flex-row flex-wrap gap-1.5">
              <View className="px-2 py-0.5 bg-purple-100 rounded-full">
                <Text className="text-[10px] font-medium text-purple-700">Đối chiếu: {record.qcModels.verify}</Text>
              </View>
            </View>
          )}

          {!!record.qcSkippedReason && (
            <View className="flex-row items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Feather name="alert-triangle" size={15} color="#92400E" />
              <View className="flex-1">
                <Text className="text-xs font-bold text-amber-800">QC chưa được quét</Text>
                <Text className="text-xs text-amber-800">{record.qcSkippedReason}</Text>
              </View>
            </View>
          )}

          {qcBatches.length > 0 ? (
            <QcBatchPanel
              batches={qcBatches}
              reviewedItems={qcMismatchItems}
              settled
              multiSheet={scopeSheets.length > 1}
              isFinalized={isFinalized}
              canReview={canReview}
              onToggle={(itemId, confirmed) => handleToggle('QC', itemId, confirmed)}
              onLocate={locateQc}
              canLocate={canLocateQc}
            />
          ) : (
            <View className="border border-border rounded-xl bg-surface">
              {qcMismatchItems.length === 0 && (
                <View className="px-3 py-2">
                  <Text className="text-xs text-slate-400">
                    {record.qcSkippedReason ? 'Chưa có kết quả đối chiếu QC' : 'Không phát hiện điểm chưa khớp'}
                  </Text>
                </View>
              )}
              {qcMismatchItems.map((item, idx) => (
                <View key={item.id} className={idx > 0 ? 'border-t border-slate-100' : ''}>
                  <QcMismatchRow
                    item={item}
                    disabled={!canEdit}
                    onToggle={(itemId, confirmed) => handleToggle('QC', itemId, confirmed)}
                    onLocate={locateQc}
                    canLocate={canLocateQc(item)}
                  />
                </View>
              ))}
            </View>
          )}

          {qcNoteItems.length > 0 && (
            <View>
              <TouchableOpacity onPress={() => setShowNotes((v) => !v)} className="flex-row items-center gap-1 py-1.5" accessibilityLabel="Thông tin không có dữ liệu chuẩn">
                <Feather name={showNotes ? 'chevron-down' : 'chevron-right'} size={13} color="#94A3B8" />
                <Text className="flex-1 text-xs text-slate-400">
                  Thông tin không có dữ liệu chuẩn để đối chiếu ({qcNoteItems.length})
                </Text>
              </TouchableOpacity>
              {showNotes && (
                <View className="mt-1.5 border border-slate-100 rounded-xl bg-background">
                  {qcNoteItems.map((item, idx) => (
                    <Text key={item.id} className={`px-3 py-1.5 text-xs text-slate-400 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                      {item.sheet_name ? `${item.sheet_name} · ` : ''}
                      {item.product_ref || 'Không rõ sản phẩm'} · {item.attribute}: {item.claimed_value}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {canEdit && (
            <View className="gap-2">
              {!!projectId && (
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 self-start py-2"
                  onPress={() => router.push(`/projects/${projectId}`)}
                  activeOpacity={0.7}
                  accessibilityLabel="Cập nhật thông tin sản phẩm"
                >
                  <Feather name="package" size={13} color="#2563EB" />
                  <Text className="text-xs font-bold text-blue-600">Thêm/cập nhật thông tin sản phẩm để đối chiếu</Text>
                </TouchableOpacity>
              )}
              <View className="self-start">
                <ActionButton label="Kiểm tra lại QC" icon="refresh-cw" onPress={handleRerunQc} loading={rerunQcMutation.isPending} />
              </View>
            </View>
          )}
        </>
      )}

      <View className="flex-row items-center gap-4 pt-2 border-t border-border">
        {canEdit && (
          <ActionButton
            label="Chốt kiểm tra"
            primary
            onPress={handleFinalize}
            loading={finalizeMutation.isPending}
            disabled={!canFinalize}
          />
        )}
        {isFinalized && (
          <>
            <TouchableOpacity
              className="flex-row items-center gap-1.5 py-2"
              onPress={() => handleOpenExport(`/task-result-checks/task/${taskId}/pdf`)}
              activeOpacity={0.7}
              accessibilityLabel="Xuất PDF"
            >
              <Feather name="download" size={13} color="#2563EB" />
              <Text className="text-xs font-bold text-blue-600">Xuất PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center gap-1.5 py-2"
              onPress={() => handleOpenExport(`/task-result-checks/task/${taskId}/xlsx`)}
              activeOpacity={0.7}
              accessibilityLabel="Xuất Excel"
            >
              <Feather name="file-text" size={13} color="#059669" />
              <Text className="text-xs font-bold text-emerald-600">Xuất Excel (đã tô màu)</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {scopeSheets.length > 0 && previewSource && (
        <ScanScopeModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="Phạm vi quét của công việc"
          source={previewSource}
          sheets={scopeSheets}
          scenariosBySheet={scenariosBySheet}
          selectedScenarioIds={selectedScenarioIds}
          fixedRegions={scopeRegions}
          draftRegions={canRerunScoped ? rerunRegions : []}
          onDraftRegionsChange={canRerunScoped ? setRerunRegions : undefined}
          defaultTool="view"
          spellItems={spellItems}
          qcItems={qcMismatchItems}
          focus={previewFocus}
          footer={
            canRerunScoped ? (
              <View className="gap-2">
                <Text className="text-xs text-slate-500">
                  {rerunRegions.length > 0
                    ? `${rerunRegions.length} vùng sẽ được quét lại`
                    : 'Dùng công cụ Vẽ vùng để chọn vùng cần quét lại'}
                </Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <ActionButton label="Quét lại chính tả" loading={rerunBusy} disabled={noRegions || isAnyRunning} onPress={() => handleScopedRerun('SPELL')} />
                  </View>
                  <View className="flex-1">
                    <ActionButton label="Quét lại QC" loading={rerunBusy} disabled={noRegions || isAnyRunning} onPress={() => handleScopedRerun('QC')} />
                  </View>
                </View>
                <ActionButton label="Quét lại cả hai" primary loading={rerunBusy} disabled={noRegions || isAnyRunning} onPress={() => handleScopedRerun('BOTH')} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
