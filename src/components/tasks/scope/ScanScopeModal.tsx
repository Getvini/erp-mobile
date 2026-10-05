import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { PreviewSource } from '@/utils/sheetPreviewSource';
import { buildQcRowSet, buildSpellCellMap, computeActiveAreas } from '@/utils/sheetScope';
import type { QcLocatable, ScanRegion, ScenarioInfo, SpellLocatable } from '@/utils/sheetScope';
import ScopeHelpSheet from './ScopeHelpSheet';
import ScopeLegend from './ScopeLegend';
import ScopeRegionList from './ScopeRegionList';
import ScopeScenarioList from './ScopeScenarioList';
import ScopeToolbar from './ScopeToolbar';
import SheetGridPreview from './SheetGridPreview';
import { EMPTY_REGIONS, EMPTY_SCENARIOS } from './gridMetrics';
import type { DrawMode, ScenarioChange, ScopeFocus, ScopeTool } from './scopeTypes';
import { useScopeRegions } from './useScopeRegions';
import { useScopeScenarios } from './useScopeScenarios';

const EMPTY_SHEETS: string[] = [];
const EMPTY_SCENARIO_MAP: Record<string, ScenarioInfo[]> = {};

type PanelTab = 'scenario' | 'region';

export interface ScanScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  source: PreviewSource | null;
  sheets?: string[];
  selectedSheets?: string[] | null;
  scenariosBySheet?: Record<string, ScenarioInfo[]>;
  selectedScenarioIds?: string[] | null;
  onToggleScenario?: (id: string) => void;
  onChangeScenarios?: (change: ScenarioChange) => void;
  fixedRegions?: ScanRegion[];
  draftRegions?: ScanRegion[];
  onDraftRegionsChange?: (regions: ScanRegion[]) => void;
  draftDefinesScope?: boolean;
  onEnsureSheet?: (sheet: string) => void;
  defaultTool?: ScopeTool;
  spellItems?: SpellLocatable[];
  qcItems?: QcLocatable[];
  focus?: ScopeFocus | null;
  showScanState?: boolean;
  footer?: React.ReactNode;
}

export default function ScanScopeModal({
  isOpen,
  onClose,
  title = 'Xem trước phạm vi quét',
  source,
  sheets = EMPTY_SHEETS,
  selectedSheets = null,
  scenariosBySheet = EMPTY_SCENARIO_MAP,
  selectedScenarioIds = null,
  onToggleScenario,
  onChangeScenarios,
  fixedRegions = EMPTY_REGIONS,
  draftRegions = EMPTY_REGIONS,
  onDraftRegionsChange,
  draftDefinesScope = false,
  onEnsureSheet,
  defaultTool,
  spellItems,
  qcItems,
  focus = null,
  showScanState = true,
  footer,
}: ScanScopeModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const availableTools = useMemo<ScopeTool[]>(() => {
    const tools: ScopeTool[] = [];
    if (onToggleScenario) tools.push('scenario');
    if (onDraftRegionsChange) tools.push('region');
    tools.push('view');
    return tools;
  }, [onToggleScenario, onDraftRegionsChange]);

  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [tool, setTool] = useState<ScopeTool>(
    defaultTool && availableTools.includes(defaultTool) ? defaultTool : availableTools[0]
  );
  const [drawMode, setDrawMode] = useState<DrawMode>('new');
  const [showHelp, setShowHelp] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('scenario');
  const [panelOpen, setPanelOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setActiveSheet((prev) => (prev && sheets.includes(prev) ? prev : sheets[0] || null));
  }, [isOpen, sheets]);

  useEffect(() => {
    if (!availableTools.includes(tool)) {
      setTool(defaultTool && availableTools.includes(defaultTool) ? defaultTool : availableTools[0]);
    }
  }, [availableTools, tool, defaultTool]);

  useEffect(() => {
    if (!isOpen) setShowHelp(false);
  }, [isOpen]);

  const fallbackSheet = sheets.length === 1 ? sheets[0] : null;
  const sheetScenarios = (activeSheet && scenariosBySheet[activeSheet]) || EMPTY_SCENARIOS;
  const visibleFixed = useMemo(
    () => fixedRegions.filter((f) => !draftRegions.some((d) => d.sheet === f.sheet && d.id === f.id)),
    [fixedRegions, draftRegions]
  );
  const sheetFixed = useMemo(() => visibleFixed.filter((r) => r.sheet === activeSheet), [visibleFixed, activeSheet]);
  const sheetDraft = useMemo(() => draftRegions.filter((r) => r.sheet === activeSheet), [draftRegions, activeSheet]);

  const areas = useMemo(
    () =>
      computeActiveAreas({
        scenarios: sheetScenarios,
        selectedScenarioIds,
        regions: draftDefinesScope ? [...sheetFixed, ...sheetDraft] : sheetFixed,
      }),
    [sheetScenarios, selectedScenarioIds, sheetFixed, sheetDraft, draftDefinesScope]
  );
  const spellCells = useMemo(
    () => buildSpellCellMap(spellItems, activeSheet || '', fallbackSheet),
    [spellItems, activeSheet, fallbackSheet]
  );
  const qcRows = useMemo(() => buildQcRowSet(qcItems, activeSheet || ''), [qcItems, activeSheet]);
  const selectedSet = useMemo(() => (selectedScenarioIds ? new Set(selectedScenarioIds) : null), [selectedScenarioIds]);

  const totalRegions = visibleFixed.length + draftRegions.length;
  const canDraw = Boolean(onDraftRegionsChange);

  const regions = useScopeRegions({
    isOpen,
    sheets,
    activeSheet,
    setActiveSheet,
    sheetScenarios,
    fixedRegions,
    draftRegions,
    sheetFixed,
    sheetDraft,
    totalRegions,
    drawMode,
    canDraw,
    onDraftRegionsChange,
    onChangeScenarios,
    onEnsureSheet,
  });

  const scenarioActions = useScopeScenarios({
    activeSheet,
    sheetScenarios,
    selectedSet,
    onToggleScenario,
    onChangeScenarios,
    setLocalFocus: regions.setLocalFocus,
  });

  const { setLocalFocus } = regions;

  useEffect(() => {
    if (!isOpen || !focus) return;
    if (focus.sheet && sheets.includes(focus.sheet)) setActiveSheet(focus.sheet);
    setLocalFocus(focus);
  }, [isOpen, focus?.nonce]);

  const handleBack = () => {
    if (showHelp) setShowHelp(false);
    else if (regions.activeRegionId) regions.setActiveRegionId(null);
    else onClose();
  };

  const effectiveTab: PanelTab = panelTab === 'scenario' && sheetScenarios.length === 0 ? 'region' : panelTab;
  const panelHeight = Math.min(360, Math.max(220, windowHeight * 0.38));

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={handleBack} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, paddingTop: insets.top }}
          className="bg-background"
        >
          <View className="flex-row items-center gap-2 px-4 py-2 border-b border-border bg-surface">
            <Text className="flex-1 text-base font-extrabold text-text-primary" numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={() => setShowHelp(true)}
              accessibilityLabel="Hướng dẫn"
              className="h-10 px-3 flex-row items-center gap-1.5 rounded-lg border border-border bg-surface"
            >
              <Feather name="help-circle" size={16} color="#475569" />
              <Text className="text-xs font-medium text-text-primary">Hướng dẫn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Đóng"
              className="w-10 h-10 items-center justify-center"
            >
              <Feather name="x" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View className="flex-1 min-h-0 gap-2 px-3 pt-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" contentContainerStyle={{ gap: 6 }}>
              {sheets.map((name) => {
                const included = !selectedSheets || selectedSheets.includes(name);
                const active = name === activeSheet;
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => setActiveSheet(name)}
                    accessibilityLabel={`Sheet ${name}`}
                    className={`h-10 px-3 justify-center rounded-lg border ${active ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                  >
                    <Text className={`text-xs font-medium ${active ? 'text-white' : included ? 'text-text-primary' : 'text-text-muted'}`}>
                      {name}
                      {!included ? ' (chưa chọn)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScopeToolbar
              availableTools={availableTools}
              tool={tool}
              onToolChange={setTool}
              canDraw={canDraw}
              drawMode={drawMode}
              onDrawModeChange={setDrawMode}
              canUndo={regions.canUndo}
              canRedo={regions.canRedo}
              onUndo={regions.undo}
              onRedo={regions.redo}
            />

            <SheetGridPreview
              source={source}
              sheet={activeSheet}
              scenarios={sheetScenarios}
              selectedScenarioIds={selectedScenarioIds}
              fixedRegions={sheetFixed}
              draftRegions={sheetDraft}
              spellCells={spellCells}
              qcRows={qcRows}
              areas={areas}
              showScanState={showScanState}
              tool={tool}
              focus={regions.localFocus}
              activeRegionId={regions.activeRegionId}
              drawMode={drawMode}
              onScenarioTap={onToggleScenario ? scenarioActions.handleScenarioTap : undefined}
              onScenarioHold={onChangeScenarios ? scenarioActions.handleScenarioHold : undefined}
              onPickRegion={regions.handlePickRegion}
              onDrawRegion={regions.handleDraw}
            />

            <TouchableOpacity
              onPress={() => setLegendOpen((prev) => !prev)}
              accessibilityLabel="Chú giải"
              className="h-8 flex-row items-center gap-1"
            >
              <Feather name={legendOpen ? 'chevron-down' : 'chevron-right'} size={14} color="#64748b" />
              <Text className="text-[11px] font-semibold text-text-secondary">Chú giải</Text>
            </TouchableOpacity>
            {legendOpen ? (
              <ScopeLegend canDraw={canDraw} hasSpell={Boolean(spellItems)} hasQc={Boolean(qcItems)} showScanState={showScanState} />
            ) : null}
          </View>

          <View className="border-t border-border bg-surface" style={{ height: panelOpen ? panelHeight : undefined }}>
            <View className="flex-row items-center px-3">
              {sheetScenarios.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setPanelTab('scenario');
                    setPanelOpen(true);
                  }}
                  accessibilityLabel="Tab kịch bản"
                  className={`h-11 px-3 justify-center border-b-2 ${effectiveTab === 'scenario' ? 'border-primary' : 'border-transparent'}`}
                >
                  <Text className={`text-xs font-semibold ${effectiveTab === 'scenario' ? 'text-text-primary' : 'text-text-secondary'}`}>
                    Kịch bản ({sheetScenarios.length})
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  setPanelTab('region');
                  setPanelOpen(true);
                }}
                accessibilityLabel="Tab vùng"
                className={`h-11 px-3 justify-center border-b-2 ${effectiveTab === 'region' ? 'border-primary' : 'border-transparent'}`}
              >
                <Text className={`text-xs font-semibold ${effectiveTab === 'region' ? 'text-text-primary' : 'text-text-secondary'}`}>
                  Vùng ({totalRegions})
                </Text>
              </TouchableOpacity>
              <View className="flex-1" />
              <TouchableOpacity
                onPress={() => setPanelOpen((prev) => !prev)}
                accessibilityLabel={panelOpen ? 'Thu gọn bảng' : 'Mở rộng bảng'}
                className="w-10 h-10 items-center justify-center"
              >
                <Feather name={panelOpen ? 'chevron-down' : 'chevron-up'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            {panelOpen ? (
              <View className="flex-1 px-3 pt-2">
                {effectiveTab === 'scenario' ? (
                  <ScopeScenarioList
                    scenarios={sheetScenarios}
                    selectedSet={selectedSet}
                    canToggle={Boolean(onToggleScenario)}
                    canChange={Boolean(onChangeScenarios)}
                    onTap={scenarioActions.handleScenarioTap}
                    onHold={scenarioActions.handleScenarioHold}
                    onFocus={scenarioActions.focusScenario}
                    onSelectAll={scenarioActions.selectAllScenarios}
                  />
                ) : (
                  <ScopeRegionList
                    visibleFixed={visibleFixed}
                    fixedRegions={fixedRegions}
                    draftRegions={draftRegions}
                    scenariosBySheet={scenariosBySheet}
                    activeRegionId={regions.activeRegionId}
                    activeSheet={activeSheet}
                    canDraw={canDraw}
                    rangeText={regions.rangeText}
                    notice={regions.notice}
                    onRangeTextChange={regions.setRangeText}
                    onAddRange={regions.handleAddRange}
                    onFocusRegion={regions.focusRegion}
                    onActivate={regions.setActiveRegionId}
                    onRemove={regions.removeRegion}
                    onUpdate={regions.updateRegion}
                    onCommitRange={regions.commitRegionRange}
                  />
                )}
              </View>
            ) : null}
          </View>

          {footer ? (
            <View
              className="flex-row flex-wrap items-center justify-end gap-2 px-4 pt-3 border-t border-border bg-surface"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              {footer}
            </View>
          ) : (
            <View style={{ height: insets.bottom }} className="bg-surface" />
          )}

          <ScopeHelpSheet visible={showHelp} onClose={() => setShowHelp(false)} />
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
