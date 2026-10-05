import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { QcMismatchRow } from '@/components/tasks/QcBatchPanel';
import { formatDateTimeToDDMMYYYYHHMM } from '@/utils/formatters';
import type { QcMismatchResultItem, SpellCheckResultItem } from '@/services/taskResultChecksService';

const MAX_VISIBLE_LOCATIONS = 6;

interface SpellGroup {
  token: string;
  items: SpellCheckResultItem[];
}

const groupSpellErrors = (items?: SpellCheckResultItem[]): SpellGroup[] => {
  const map = new Map<string, SpellGroup>();
  (items || []).forEach((item) => {
    const group = map.get(item.token);
    if (group) {
      group.items.push(item);
    } else {
      map.set(item.token, { token: item.token, items: [item] });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
};

const locationLabel = (item: SpellCheckResultItem) =>
  `${item.sheetName ? `${item.sheetName}!` : ''}${item.location}`;

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <View className="px-1.5 py-0.5 rounded-full bg-red-50">
      <Text className="text-[10px] font-bold text-red-600">{children}</Text>
    </View>
  );
}

function SpellGroupRow({ group }: { group: SpellGroup }) {
  const [expanded, setExpanded] = useState(false);
  const total = group.items.length;
  const visible = expanded ? group.items : group.items.slice(0, MAX_VISIBLE_LOCATIONS);
  const hidden = total - visible.length;
  const single = total === 1 ? group.items[0] : null;

  return (
    <View className="px-3 py-2 gap-1.5">
      <View className="flex-row items-center gap-2">
        <Text className="shrink text-xs font-bold text-red-600">{group.token}</Text>
        {total > 1 && <CountBadge>{`x${total}`}</CountBadge>}
      </View>
      <View className="flex-row flex-wrap items-center gap-1">
        {visible.map((item, idx) => (
          <View
            key={`${item.id ?? 'item'}-${idx}`}
            className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200"
          >
            {item.sheetName ? <Feather name="grid" size={11} color="#64748B" /> : null}
            <Text className="font-mono text-[11px] text-slate-500">{locationLabel(item)}</Text>
          </View>
        ))}
        {hidden > 0 && (
          <TouchableOpacity
            onPress={() => setExpanded(true)}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityLabel="Xem thêm vị trí lỗi"
            className="px-1.5 py-0.5"
          >
            <Text className="text-[11px] font-bold text-blue-600">{`+${hidden} vị trí`}</Text>
          </TouchableOpacity>
        )}
        {expanded && total > MAX_VISIBLE_LOCATIONS && (
          <TouchableOpacity
            onPress={() => setExpanded(false)}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityLabel="Thu gọn danh sách vị trí lỗi"
            className="px-1.5 py-0.5"
          >
            <Text className="text-[11px] font-bold text-slate-400">Thu gọn</Text>
          </TouchableOpacity>
        )}
      </View>
      {single?.scenarioLabel ? (
        <Text className="text-xs italic text-slate-400">{single.scenarioLabel}</Text>
      ) : null}
    </View>
  );
}

interface ErrorColumnProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  count: number;
  children: React.ReactNode;
}

function ErrorColumn({ icon, title, count, children }: ErrorColumnProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={16} color="#334155" />
        <Text className="text-sm font-bold text-slate-700">{title}</Text>
        <CountBadge>{String(count)}</CountBadge>
      </View>
      <View className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <ScrollView nestedScrollEnabled className="max-h-80">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

interface ConfirmedCheckErrorsProps {
  spellErrors?: SpellCheckResultItem[];
  qcMismatches?: QcMismatchResultItem[];
  title?: string;
  collapsible?: boolean;
  variant?: 'inline' | 'section';
  finalizedAt?: string | null;
}

export default function ConfirmedCheckErrors({
  spellErrors,
  qcMismatches,
  title = 'Lỗi đã chốt ở bản nộp trước',
  collapsible = false,
  variant = 'inline',
  finalizedAt,
}: ConfirmedCheckErrorsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const spellGroups = useMemo(() => groupSpellErrors(spellErrors), [spellErrors]);
  const spellCount = spellErrors?.length || 0;
  const qcCount = qcMismatches?.length || 0;
  if (spellCount === 0 && qcCount === 0) return null;

  const isSection = variant === 'section';

  const summary = (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {spellCount > 0 && <CountBadge>{`${spellCount} lỗi chính tả`}</CountBadge>}
      {qcCount > 0 && <CountBadge>{`${qcCount} QC chưa khớp`}</CountBadge>}
      {finalizedAt ? (
        <View className="flex-row items-center gap-1">
          <Feather name="lock" size={11} color="#94A3B8" />
          <Text className="text-[11px] font-medium text-slate-400">
            {`Chốt lúc ${formatDateTimeToDDMMYYYYHHMM(finalizedAt)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const headerContent = isSection ? (
    <View className="flex-1 flex-row items-center gap-3">
      <View className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center">
        <Feather name="shield" size={20} color="#DC2626" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[15px] font-bold text-slate-900">{title}</Text>
        {summary}
      </View>
    </View>
  ) : (
    <View className="flex-1 gap-1">
      <View className="flex-row items-center gap-2">
        <Feather name="alert-circle" size={14} color="#94A3B8" />
        <Text className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{title}</Text>
      </View>
      {summary}
    </View>
  );

  return (
    <View className={isSection ? 'gap-4' : 'gap-2'}>
      {collapsible ? (
        <TouchableOpacity
          onPress={() => setIsCollapsed((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: !isCollapsed }}
          accessibilityLabel={isCollapsed ? `Mở ${title}` : `Thu gọn ${title}`}
          className="min-h-10 flex-row items-center justify-between gap-2"
        >
          {headerContent}
          <Feather name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={16} color="#94A3B8" />
        </TouchableOpacity>
      ) : (
        <View>{headerContent}</View>
      )}

      {!(collapsible && isCollapsed) && (
        <View className="p-3 bg-slate-50 border border-slate-200 rounded-2xl gap-4">
          {spellCount > 0 && (
            <ErrorColumn icon="type" title="Lỗi chính tả" count={spellCount}>
              <View className="gap-0">
                {spellGroups.map((group) => (
                  <View key={group.token} className="border-b border-slate-100">
                    <SpellGroupRow group={group} />
                  </View>
                ))}
              </View>
            </ErrorColumn>
          )}
          {qcCount > 0 && (
            <ErrorColumn icon="clipboard" title="QC chưa khớp" count={qcCount}>
              <View>
                {(qcMismatches || []).map((item, idx) => (
                  <View key={`${item.id ?? 'qc'}-${idx}`} className="border-b border-slate-100">
                    <QcMismatchRow item={item} readOnly />
                  </View>
                ))}
              </View>
            </ErrorColumn>
          )}
        </View>
      )}
    </View>
  );
}
