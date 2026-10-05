import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SpellCheckWhitelist from './SpellCheckWhitelist';
import QcProductInfoPanel from './QcProductInfoPanel';
import ScanScopeModal from './scope/ScanScopeModal';
import type { ScenarioChange } from './scope/scopeTypes';
import { useSpellCheckSheetsFromUrlQuery, useSpellCheckSheetsFromFileQuery } from '@/hooks/queries/useQcSpellCheck';
import { LocalPickedFile } from '@/services/qcSpellCheckService';
import { isSpreadsheetFile } from '@/utils/spellCheckLink';
import { createFileSource, createUrlSource } from '@/utils/sheetPreviewSource';
import { regionRef, scenarioCode } from '@/utils/sheetScope';
import type { ScanRegion, ScenarioInfo } from '@/utils/sheetScope';

export type ResultCheckSource =
  | { kind: 'file'; file: LocalPickedFile }
  | { kind: 'url'; fileUrl: string; fileName?: string };

interface ResultSheetSelectorPanelProps {
  source?: ResultCheckSource;
  projectId?: string;
  selectedSheets: string[];
  onSelectedSheetsChange: (sheets: string[]) => void;
  selectedScenarios: string[];
  onSelectedScenariosChange: (ids: string[]) => void;
  onSelectedScenarioLabelsChange: (labels: string[]) => void;
  customRegions: ScanRegion[];
  onCustomRegionsChange: (regions: ScanRegion[]) => void;
  whitelist: string[];
  onWhitelistChange: (whitelist: string[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const EMPTY_SHEETS: string[] = [];
const EMPTY_SCENARIOS: Record<string, ScenarioInfo[]> = {};

const sheetsErrorMessage = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : '';
  if (status === 413) return 'File quá lớn, không thể đọc danh sách sheet';
  if (status === 0 || /network|timeout|fetch/i.test(message)) {
    return 'Kết nối đến máy chủ kiểm tra bị gián đoạn, vui lòng thử lại';
  }
  return message || 'Không thể đọc danh sách sheet';
};

const Check = ({ checked }: { checked: boolean }) => (
  <View
    className={`w-5 h-5 rounded border items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-slate-300'}`}
  >
    {checked && <Feather name="check" size={13} color="#FFFFFF" />}
  </View>
);

export default function ResultSheetSelectorPanel({
  source,
  projectId,
  selectedSheets,
  onSelectedSheetsChange,
  selectedScenarios,
  onSelectedScenariosChange,
  onSelectedScenarioLabelsChange,
  customRegions,
  onCustomRegionsChange,
  whitelist,
  onWhitelistChange,
  onLoadingChange,
}: ResultSheetSelectorPanelProps) {
  const [sheetSearch, setSheetSearch] = useState('');
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const displayName = source?.kind === 'file' ? source.file.name : source?.fileName || '';
  const hasSheets = isSpreadsheetFile(displayName);
  const currentKey =
    source?.kind === 'file'
      ? `file:${source.file.uri}`
      : source?.kind === 'url'
      ? `url:${source.fileUrl}:${source.fileName || ''}`
      : null;

  const urlQuery = useSpellCheckSheetsFromUrlQuery(
    source?.kind === 'url' ? source.fileUrl : undefined,
    source?.kind === 'url' ? source.fileName : undefined,
    source?.kind === 'url'
  );
  const fileQuery = useSpellCheckSheetsFromFileQuery(
    source?.kind === 'file' ? source.file : undefined,
    source?.kind === 'file'
  );

  const {
    data: sheetsData,
    isFetching: isLoadingSheets,
    error: sheetsError,
  } = source?.kind === 'file' ? fileQuery : urlQuery;
  const sheets = sheetsData?.sheets ?? EMPTY_SHEETS;
  const scenarios = sheetsData?.scenarios ?? EMPTY_SCENARIOS;
  const sheetsReady = Boolean(sheetsData) && initializedKey === currentKey;

  const previewSource = useMemo(() => {
    if (source?.kind === 'file') return createFileSource(source.file);
    if (source?.kind === 'url') return createUrlSource(source.fileUrl, source.fileName || '');
    return null;
  }, [source]);

  useEffect(() => {
    onLoadingChange?.(Boolean(currentKey) && hasSheets && isLoadingSheets);
  }, [currentKey, hasSheets, isLoadingSheets, onLoadingChange]);

  useEffect(() => () => onLoadingChange?.(false), [onLoadingChange]);

  const allScenarioIds = (map: Record<string, ScenarioInfo[]>) =>
    Object.values(map).flat().map((s) => s.id);
  const sheetScenarioIds = (name: string) => (scenarios[name] || []).map((s) => s.id);

  useEffect(() => {
    if (!currentKey) {
      setInitializedKey(null);
      return;
    }
    if (initializedKey && initializedKey !== currentKey) {
      setInitializedKey(null);
      setSheetSearch('');
      setExpandedSheet(null);
      setIsPreviewOpen(false);
      onSelectedSheetsChange([]);
      onSelectedScenariosChange([]);
      onCustomRegionsChange([]);
    }
  }, [currentKey, initializedKey]);

  useEffect(() => {
    if (!currentKey || !sheetsData || initializedKey === currentKey || isLoadingSheets) return;
    onSelectedSheetsChange(sheetsData.sheets);
    onSelectedScenariosChange(allScenarioIds(sheetsData.scenarios));
    setInitializedKey(currentKey);
  }, [sheetsData, currentKey, initializedKey, isLoadingSheets]);

  useEffect(() => {
    if (!sheetsError) return;
    Alert.alert('Lỗi', sheetsErrorMessage(sheetsError));
  }, [sheetsError]);

  useEffect(() => {
    const labelMap: Record<string, string> = {};
    Object.entries(scenarios).forEach(([sheet, list]) => {
      (list || []).forEach((s) => {
        labelMap[s.id] = `${sheet} / ${s.scenarioLabel}`;
      });
    });
    onSelectedScenarioLabelsChange((selectedScenarios || []).map((id) => labelMap[id]).filter(Boolean));
  }, [selectedScenarios, scenarios]);

  const filteredSheets = useMemo(() => {
    const q = sheetSearch.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter((name) => name.toLowerCase().includes(q));
  }, [sheets, sheetSearch]);

  const owningSheetOf = (scenarioId: string) =>
    Object.entries(scenarios).find(([, list]) => (list || []).some((s) => s.id === scenarioId))?.[0];

  const applySheets = (names: string[], select: boolean) => {
    const nameSet = new Set(names);
    const ids = names.flatMap(sheetScenarioIds);
    if (select) {
      onSelectedSheetsChange([...new Set([...selectedSheets, ...names])]);
      onSelectedScenariosChange([...new Set([...(selectedScenarios || []), ...ids])]);
      return;
    }
    const idSet = new Set(ids);
    onSelectedSheetsChange(selectedSheets.filter((s) => !nameSet.has(s)));
    onSelectedScenariosChange((selectedScenarios || []).filter((id) => !idSet.has(id)));
    onCustomRegionsChange(customRegions.filter((r) => !nameSet.has(r.sheet)));
  };

  const toggleSheet = (name: string) => applySheets([name], !selectedSheets.includes(name));

  const soloSheet = (name: string) => {
    onSelectedSheetsChange([name]);
    onSelectedScenariosChange(sheetScenarioIds(name));
    onCustomRegionsChange(customRegions.filter((r) => r.sheet === name));
  };

  const changeScenarios = ({ add = [], remove = [] }: ScenarioChange) => {
    const current = new Set(selectedScenarios || []);
    remove.forEach((id) => current.delete(id));
    add.forEach((id) => current.add(id));
    onSelectedScenariosChange(Array.from(current));
    if (add.length === 0) return;
    const missing = [...new Set(add.map(owningSheetOf).filter(Boolean) as string[])].filter(
      (name) => !selectedSheets.includes(name)
    );
    if (missing.length > 0) onSelectedSheetsChange([...selectedSheets, ...missing]);
    const restored = new Set(add);
    if (customRegions.some((r) => r.extends && restored.has(r.extends))) {
      onCustomRegionsChange(customRegions.filter((r) => !(r.extends && restored.has(r.extends))));
    }
  };

  const toggleSelectAll = () => {
    if (selectedSheets.length === sheets.length) {
      onSelectedSheetsChange([]);
      onSelectedScenariosChange([]);
      onCustomRegionsChange([]);
    } else {
      onSelectedSheetsChange([...sheets]);
      onSelectedScenariosChange(allScenarioIds(scenarios));
    }
  };

  const toggleScenario = (scenarioId: string) => {
    const isSelected = (selectedScenarios || []).includes(scenarioId);
    onSelectedScenariosChange(
      isSelected
        ? (selectedScenarios || []).filter((id) => id !== scenarioId)
        : [...(selectedScenarios || []), scenarioId]
    );
    if (!isSelected) {
      const owningSheet = owningSheetOf(scenarioId);
      if (owningSheet && !selectedSheets.includes(owningSheet)) {
        onSelectedSheetsChange([...selectedSheets, owningSheet]);
      }
      if (customRegions.some((r) => r.extends === scenarioId)) {
        onCustomRegionsChange(customRegions.filter((r) => r.extends !== scenarioId));
      }
    }
  };

  const soloScenario = (scenarioId: string) => {
    const owningSheet = owningSheetOf(scenarioId);
    if (!owningSheet) return;
    onSelectedSheetsChange([owningSheet]);
    onSelectedScenariosChange([scenarioId]);
    onCustomRegionsChange(customRegions.filter((r) => r.sheet === owningSheet && r.extends !== scenarioId));
  };

  const ensureSheetSelected = (name: string) => {
    if (!selectedSheets.includes(name)) onSelectedSheetsChange([...selectedSheets, name]);
  };

  const removeCustomRegion = (id: string) => {
    const target = customRegions.find((r) => r.id === id);
    onCustomRegionsChange(customRegions.filter((r) => r.id !== id));
    if (target?.extends) changeScenarios({ add: [target.extends] });
  };

  const showHelp = () =>
    Alert.alert(
      'Chọn sheet và kịch bản cần quét',
      'Chạm các sheet cần kiểm tra chính tả và QC. Chạm mũi tên bên phải tên sheet để mở danh sách kịch bản bên trong và bật/tắt từng kịch bản.\n\nMỗi kịch bản có một mã định danh (ví dụ R5C1) dùng xuyên suốt khi xem kết quả.\n\nCần quét một vài ô hoặc một khối riêng? Mở "Xem trước và chọn vùng quét" để vẽ vùng mới hoặc mở rộng kịch bản có sẵn.\n\nNhấn giữ một sheet hoặc một kịch bản để chỉ chọn đúng mục đó.'
    );

  const showScopeHelp = () =>
    Alert.alert(
      'Chọn vùng quét trên bảng',
      'Mở bảng tính để chọn chính xác phạm vi quét: bật/tắt kịch bản, vẽ vùng mới, hoặc mở rộng một kịch bản/vùng sẵn có.\n\nTrong cửa sổ đó chạm nút Hướng dẫn để xem cách thao tác.'
    );

  if (!currentKey) return null;

  if (!hasSheets) {
    return (
      <View className="p-4 bg-background border border-border rounded-2xl">
        <Text className="text-xs text-slate-500">
          File này không hỗ trợ chọn sheet, sẽ được nộp mà không tự động kiểm tra chính tả/QC.
        </Text>
      </View>
    );
  }

  return (
    <View className="p-4 bg-background border border-border rounded-2xl gap-3">
      <View className="flex-row items-center gap-2">
        <Feather name="check-square" size={15} color="#334155" />
        <Text className="text-sm font-bold text-text-primary">Chọn sheet</Text>
        <TouchableOpacity onPress={showHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Trợ giúp chọn sheet">
          <Feather name="help-circle" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <SpellCheckWhitelist whitelist={whitelist} onChange={onWhitelistChange} />
      <QcProductInfoPanel projectId={projectId} />

      {isLoadingSheets && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#94A3B8" />
          <Text className="text-xs text-slate-400">Đang đọc danh sách sheet...</Text>
        </View>
      )}

      {!isLoadingSheets && !!sheetsError && (
        <Text className="text-xs text-danger">{sheetsErrorMessage(sheetsError)}</Text>
      )}

      {!isLoadingSheets && sheets.length > 0 && (
        <View className="gap-1.5">
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-3">
            <Feather name="search" size={13} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 py-2.5 text-xs text-text-primary"
              value={sheetSearch}
              onChangeText={setSheetSearch}
              placeholder="Tìm sheet..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View className="border border-border rounded-xl bg-surface p-2">
            <TouchableOpacity
              className="flex-row items-center gap-2 pb-2 border-b border-slate-100"
              onPress={toggleSelectAll}
              activeOpacity={0.7}
              style={{ minHeight: 40 }}
              accessibilityLabel="Chọn tất cả sheet"
            >
              <Check checked={selectedSheets.length === sheets.length} />
              <Text className="text-xs font-bold text-slate-600">Chọn tất cả ({sheets.length} sheet)</Text>
            </TouchableOpacity>

            {filteredSheets.length === 0 && (
              <Text className="text-xs text-slate-400 py-1">Không tìm thấy sheet phù hợp</Text>
            )}

            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filteredSheets.map((name) => {
                const sheetScenarios = scenarios[name] || [];
                const isExpanded = expandedSheet === name;
                const selectedCount = sheetScenarios.filter((s) => (selectedScenarios || []).includes(s.id)).length;
                return (
                  <View key={name}>
                    <View className="flex-row items-center gap-2" style={{ minHeight: 44 }}>
                      <TouchableOpacity
                        className="flex-1 flex-row items-center gap-2"
                        style={{ minHeight: 44 }}
                        onPress={() => toggleSheet(name)}
                        onLongPress={() => soloSheet(name)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Sheet ${name}`}
                      >
                        <Check checked={selectedSheets.includes(name)} />
                        <Text className="flex-1 text-xs text-text-primary" numberOfLines={2}>{name}</Text>
                        {sheetScenarios.length > 0 && (
                          <View className="px-1.5 py-0.5 rounded-full bg-blue-50">
                            <Text className="text-[10px] font-medium text-blue-600">
                              {selectedCount}/{sheetScenarios.length} kịch bản
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      {sheetScenarios.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setExpandedSheet((prev) => (prev === name ? null : name))}
                          className="items-center justify-center"
                          style={{ width: 40, height: 40 }}
                          accessibilityLabel={`Mở kịch bản của ${name}`}
                        >
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {isExpanded && sheetScenarios.length > 0 && (
                      <View className="ml-7 mb-1">
                        {sheetScenarios.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            className="flex-row items-center gap-2"
                            style={{ minHeight: 40 }}
                            onPress={() => toggleScenario(s.id)}
                            onLongPress={() => soloScenario(s.id)}
                            activeOpacity={0.7}
                            accessibilityLabel={`Kịch bản ${s.scenarioLabel}`}
                          >
                            <Check checked={(selectedScenarios || []).includes(s.id)} />
                            <View className="px-1 py-0.5 rounded bg-slate-100">
                              <Text className="text-[10px] font-bold text-slate-600">{scenarioCode(s)}</Text>
                            </View>
                            <Text className="flex-1 text-[11px] font-medium text-slate-700" numberOfLines={2}>
                              {s.scenarioLabel}
                            </Text>
                            <Text className="text-[11px] text-slate-400">
                              dòng {s.startRow}–{s.endRow}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {!isLoadingSheets && sheets.length > 0 && previewSource && (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setIsPreviewOpen(true)}
              className="flex-row items-center gap-1.5 px-3 rounded-lg border border-blue-200 bg-surface"
              style={{ minHeight: 40 }}
              accessibilityLabel="Xem trước và chọn vùng quét"
            >
              <Feather name="eye" size={14} color="#1D4ED8" />
              <Text className="text-xs font-bold text-blue-700">Xem trước và chọn vùng quét</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={showScopeHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Hướng dẫn chọn vùng quét">
              <Feather name="help-circle" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          {customRegions.map((region) => (
            <View
              key={`${region.sheet}:${region.id}`}
              className="flex-row items-center gap-2 pl-2.5 bg-surface border border-amber-200 rounded-lg"
            >
              <View className="px-1 py-0.5 rounded bg-amber-600">
                <Text className="text-[10px] font-bold text-white">{region.id}</Text>
              </View>
              <Text className="flex-1 text-xs text-slate-700" numberOfLines={1}>
                <Text className="font-medium">{region.label || 'Vùng tự chọn'}</Text>
                <Text className="text-slate-400">{`  ${regionRef(region)}`}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => removeCustomRegion(region.id)}
                className="items-center justify-center"
                style={{ width: 40, height: 40 }}
                accessibilityLabel={`Bỏ vùng ${region.label || region.id}`}
              >
                <Feather name="x" size={15} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {!isLoadingSheets && sheetsReady && sheets.length === 0 && (
        <Text className="text-xs text-slate-400">File này không có sheet nào</Text>
      )}

      {sheets.length > 0 && previewSource && (
        <ScanScopeModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title={`Phạm vi quét: ${displayName}`}
          source={previewSource}
          sheets={sheets}
          selectedSheets={selectedSheets}
          scenariosBySheet={scenarios}
          selectedScenarioIds={selectedScenarios || []}
          onToggleScenario={toggleScenario}
          onChangeScenarios={changeScenarios}
          draftRegions={customRegions}
          onDraftRegionsChange={onCustomRegionsChange}
          draftDefinesScope
          onEnsureSheet={ensureSheetSelected}
          footer={
            <TouchableOpacity
              onPress={() => setIsPreviewOpen(false)}
              className="items-center justify-center rounded-xl bg-primary"
              style={{ minHeight: 44 }}
              accessibilityLabel="Xong"
            >
              <Text className="text-sm font-bold text-white">Xong</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}
