import { useRef } from 'react';
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import type { ScenarioInfo } from '@/utils/sheetScope';
import type { ScenarioChange, ScopeFocus } from './scopeTypes';
import { makeFocus } from './useScopeRegions';

interface UseScopeScenariosOptions {
  activeSheet: string | null;
  sheetScenarios: ScenarioInfo[];
  selectedSet: Set<string> | null;
  onToggleScenario?: (id: string) => void;
  onChangeScenarios?: (change: ScenarioChange) => void;
  setLocalFocus: (focus: ScopeFocus) => void;
}

export function useScopeScenarios({
  activeSheet,
  sheetScenarios,
  selectedSet,
  onToggleScenario,
  onChangeScenarios,
  setLocalFocus,
}: UseScopeScenariosOptions) {
  const lastScenarioRef = useRef<string | null>(null);

  const focusScenario = (scenario: ScenarioInfo) => {
    if (!activeSheet) return;
    setLocalFocus(makeFocus(activeSheet, scenario.startRow, (scenario.colStart ?? 0) + 1));
  };

  const scenarioIds = () => sheetScenarios.map((s) => s.id);

  const handleScenarioTap = (id: string) => {
    if (!onToggleScenario) return;
    onToggleScenario(id);
    lastScenarioRef.current = id;
  };

  const keepOnlyScenario = (id: string) => {
    if (!onChangeScenarios) return;
    onChangeScenarios({ add: [id], remove: scenarioIds().filter((x) => x !== id) });
    lastScenarioRef.current = id;
  };

  const selectScenarioRange = (id: string) => {
    const last = lastScenarioRef.current;
    const ids = scenarioIds();
    if (!onChangeScenarios || !last || !ids.includes(last)) return;
    const isSelected = selectedSet ? selectedSet.has(id) : true;
    const from = ids.indexOf(last);
    const to = ids.indexOf(id);
    const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
    onChangeScenarios(isSelected ? { remove: range } : { add: range });
    lastScenarioRef.current = id;
  };

  const handleScenarioHold = (id: string) => {
    if (!onChangeScenarios) return;
    const last = lastScenarioRef.current;
    const label = sheetScenarios.find((s) => s.id === id)?.scenarioLabel || 'Kịch bản';
    const buttons: AlertButton[] = [{ text: 'Chỉ giữ kịch bản này', onPress: () => keepOnlyScenario(id) }];
    if (last && last !== id && scenarioIds().includes(last)) {
      buttons.push({ text: 'Chọn/bỏ cả dải kịch bản tới đây', onPress: () => selectScenarioRange(id) });
    }
    buttons.push({ text: 'Hủy', style: 'cancel' });
    Alert.alert(label, undefined, buttons);
  };

  const selectAllScenarios = (select: boolean) => {
    if (!onChangeScenarios || sheetScenarios.length === 0) return;
    const ids = scenarioIds();
    onChangeScenarios(select ? { add: ids } : { remove: ids });
  };

  return { focusScenario, handleScenarioTap, handleScenarioHold, selectAllScenarios };
}
