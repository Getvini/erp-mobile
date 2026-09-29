import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { useTaskDailyWorkloadQuery } from '@/hooks/queries/useTasks';
import type { TaskDailyWorkloadDay } from '@/services/taskService';
import {
  buildMonthCells,
  getMonthRange,
  getWorkloadDayTone,
  type WorkloadDayTone,
} from '@/utils/taskLifecycle';
import { formatDateToDDMMYYYY, formatDateToYYYYMMDD } from '@/utils/formatters';

interface TaskWorkloadCalendarProps {
  /** Nhân sự cần xem lịch tải (INTERNAL). Rỗng ⇒ hiện hướng dẫn chọn nhân sự. */
  userId?: string;
  /** Tháng cần xem (thường là tháng của deadline đang chọn) */
  monthDate?: Date | null;
  /** Ngày đang chọn — ô này được viền cam `#F38820` */
  selectedDateKey?: string;
  onSelectDate?: (dateKey: string) => void;
}

/** Nền ô lịch theo mức tải (danger đỏ / warning vàng / info xanh / muted xám) */
const TONE_CELL_CLASS: Record<WorkloadDayTone, string> = {
  danger: 'bg-red-50',
  warning: 'bg-amber-50',
  info: 'bg-blue-50',
  muted: 'bg-slate-50',
};

const TONE_TEXT_CLASS: Record<WorkloadDayTone, string> = {
  danger: 'text-red-700',
  warning: 'text-amber-700',
  info: 'text-blue-700',
  muted: 'text-slate-500',
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function TaskWorkloadCalendar({
  userId,
  monthDate,
  selectedDateKey,
  onSelectDate,
}: TaskWorkloadCalendarProps) {
  const propMonth =
    monthDate && !Number.isNaN(monthDate.getTime()) ? monthDate : new Date();
  const propMonthKey = `${propMonth.getFullYear()}-${propMonth.getMonth()}`;

  /** Tháng đang xem do người dùng bấm trước/sau (null ⇒ theo tháng của prop) */
  const [viewMonthOverride, setViewMonthOverride] = useState<Date | null>(null);
  const [syncedPropMonthKey, setSyncedPropMonthKey] = useState(propMonthKey);

  /**
   * Điều chỉnh state trong lúc render khi màn cha đổi tháng (React khuyến nghị,
   * KHÔNG setState trong useEffect để tránh cascading render).
   */
  if (propMonthKey !== syncedPropMonthKey) {
    setSyncedPropMonthKey(propMonthKey);
    setViewMonthOverride(null);
  }

  const viewMonth = viewMonthOverride ?? propMonth;
  const viewYear = viewMonth.getFullYear();
  const viewMonthIndex = viewMonth.getMonth();

  // `getMonthRange` nhận Date; memo theo (năm, tháng) để không phụ thuộc identity của Date
  const range = useMemo(
    () => getMonthRange(new Date(viewYear, viewMonthIndex, 1)),
    [viewYear, viewMonthIndex]
  );
  const { data, isLoading, isError } = useTaskDailyWorkloadQuery(
    userId || '',
    range.startDate,
    range.endDate
  );

  const cells = useMemo(
    () => buildMonthCells(new Date(viewYear, viewMonthIndex, 1)),
    [viewYear, viewMonthIndex]
  );

  const daysByDate = useMemo(() => {
    const map = new Map<string, TaskDailyWorkloadDay>();
    (data?.days || []).forEach((day) => {
      if (!day?.date) return;
      map.set(formatDateToYYYYMMDD(day.date), day);
    });
    return map;
  }, [data?.days]);

  const selectedDay = selectedDateKey ? daysByDate.get(selectedDateKey) : undefined;
  const selectedTasks = selectedDay?.tasks || [];
  const isCurrentMonthView =
    viewYear === new Date().getFullYear() && viewMonthIndex === new Date().getMonth();

  const handlePrevMonth = () => {
    setViewMonthOverride(new Date(viewYear, viewMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonthOverride(new Date(viewYear, viewMonthIndex + 1, 1));
  };

  if (!userId) {
    return (
      <View className="bg-white border border-slate-200 rounded-2xl p-4 flex-row items-center gap-2.5">
        <Feather name="calendar" size={16} color="#94A3B8" />
        <Text className="flex-1 text-xs font-semibold text-slate-400">
          Chọn nhân sự để xem lịch tải
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-3 gap-3">
      {/* Header đổi tháng */}
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          className="w-12 h-12 rounded-xl bg-slate-50 items-center justify-center"
          onPress={handlePrevMonth}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-[13px] font-bold text-slate-900">
            Lịch tải tháng {viewMonthIndex + 1}/{viewYear}
          </Text>
          <Text className="text-[10px] font-semibold text-slate-400">
            {isCurrentMonthView ? 'Chọn ngày để đặt deadline' : 'Đang xem tháng khác'}
          </Text>
        </View>

        <TouchableOpacity
          className="w-12 h-12 rounded-xl bg-slate-50 items-center justify-center"
          onPress={handleNextMonth}
          activeOpacity={0.7}
        >
          <Feather name="chevron-right" size={20} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-row items-center justify-center gap-2 py-5">
          <ActivityIndicator size="small" color={BrandColors.primary} />
          <Text className="text-xs font-semibold text-slate-400">Đang tải lịch tải...</Text>
        </View>
      ) : isError ? (
        <View className="flex-row items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <Feather name="alert-circle" size={14} color="#DC2626" />
          <Text className="flex-1 text-[11px] font-bold text-red-600">
            Không tải được lịch tải nhân sự
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {/* Header thứ trong tuần */}
          <View className="flex-row">
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} className="w-[14.28%] items-center py-1">
                <Text className="text-[10px] font-extrabold text-slate-400">{label}</Text>
              </View>
            ))}
          </View>

          {/* Lưới 7 cột — KHÔNG dùng ScrollView dọc cho lưới */}
          <View className="flex-row flex-wrap">
            {cells.map((cell, index) => {
              if (cell.day === null || !cell.dateKey) {
                return <View key={`blank-${index}`} className="w-[14.28%] h-[54px] p-0.5" />;
              }

              const day = daysByDate.get(cell.dateKey);
              const taskCount = Number(day?.taskCount || 0);
              const workloadPercent = Number(day?.workloadPercent ?? 0);
              const tone = getWorkloadDayTone(workloadPercent, taskCount);
              const isSelected = cell.dateKey === selectedDateKey;
              const hasData = daysByDate.has(cell.dateKey);

              return (
                <View key={cell.dateKey} className="w-[14.28%] h-[54px] p-0.5">
                  <TouchableOpacity
                    className={`flex-1 rounded-lg items-center justify-center border ${
                      TONE_CELL_CLASS[tone]
                    } ${isSelected ? 'border-2' : 'border-transparent'}`}
                    style={isSelected ? { borderColor: BrandColors.primary } : undefined}
                    onPress={() => onSelectDate?.(cell.dateKey)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-[10px] font-bold ${TONE_TEXT_CLASS[tone]} opacity-80`}>
                      {cell.day}
                    </Text>
                    <Text className={`text-[10px] font-extrabold ${TONE_TEXT_CLASS[tone]}`}>
                      {hasData ? `${workloadPercent}%` : '-'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Chi tiết ngày đang chọn */}
          <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 gap-2">
            {selectedDay ? (
              <>
                <View className="flex-row items-center gap-2">
                  <Feather name="calendar" size={13} color={BrandColors.primary} />
                  <Text className="flex-1 text-[11px] font-bold text-slate-700">
                    {formatDateToDDMMYYYY(selectedDateKey)}: {Number(selectedDay.taskCount || 0)} task -{' '}
                    {Number(selectedDay.workloadPercent ?? 0)}% tải ngày
                  </Text>
                </View>

                {selectedTasks.length === 0 ? (
                  <Text className="text-[11px] text-slate-400 italic">
                    Chưa có công việc nào trong ngày này
                  </Text>
                ) : (
                  // Danh sách task trong 1 ngày luôn ngắn ⇒ dùng map để tránh nested VirtualizedList
                  <View className="gap-1.5">
                    {selectedTasks.map((item) => (
                      <View key={item.id} className="flex-row items-center gap-2">
                        <View className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <Text className="text-[10px] font-extrabold text-slate-400">
                          {item.code || '—'}
                        </Text>
                        <Text className="flex-1 text-[11px] font-semibold text-slate-700" numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text className="text-[11px] text-slate-400 italic">
                Chọn một ngày trên lịch để xem chi tiết tải công việc
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
