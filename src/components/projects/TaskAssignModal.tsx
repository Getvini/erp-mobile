import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { TaskDetail } from '@/services/taskService';
import { TEAM_MEMBER_ROLE_LABELS } from '@/services/teamService';
import {
  useAssignTaskMutation,
  useBulkAssignTasksMutation,
  useAssignSupportTeamMutation,
  useRequestSupportMutation,
  useTaskDetailQuery,
  useTaskDailyWorkloadQuery,
} from '@/hooks/queries/useTasks';
import { useVendorsByJobQuery, useBulkVendorsByJobsQuery } from '@/hooks/queries/useVendors';
import { useTeamsQuery } from '@/hooks/queries/useTeams';
import { uploadToCloudinary, PickedFile } from '@/services/cloudinaryService';
import { BrandColors } from '@/constants/colors';
import { isValidUrl, normalizeUrl } from '@/utils/validators';
import { getTaskJobId } from '@/utils/vendorEligibility';
import {
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
  formatDateTimeToDDMMYYYYHHMM,
} from '@/utils/formatters';
import { combineDateWithDefaultTime, getMonthRange } from '@/utils/taskLifecycle';
import TaskWorkloadCalendar from '@/components/tasks/TaskWorkloadCalendar';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';
import { getTeamMemberRoles } from '@/utils/teamMember';
import { getWorkloadPercent } from '@/utils/workload';
import * as Haptics from 'expo-haptics';
import AssigneeSelectorModal from './AssigneeSelectorModal';

const ITEM_HEIGHT = 38;
const VISIBLE_ITEMS = 3;

// Wheel Picker Component for dragging/swiping hours and minutes
const WheelPicker: React.FC<{
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}> = ({ data, selectedIndex, onSelect }) => {
  const scrollRef = useRef<ScrollView>(null);
  const isProgrammaticScroll = useRef(false);

  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0 && selectedIndex < data.length) {
      isProgrammaticScroll.current = true;
      scrollRef.current.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: true,
      });
      const timer = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex, data.length]);

  const handleScrollEnd = (e: any) => {
    if (isProgrammaticScroll.current) return;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  };

  return (
    <View className="h-[114px] w-[60px] overflow-hidden relative bg-slate-50 rounded-xl border border-slate-200">
      {/* Active selection background bar */}
      <View pointerEvents="none" className="absolute top-[38px] left-0 right-0 h-[38px] bg-blue-50 border-y-[1.5px] border-primary z-0" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        className="flex-1 z-10"
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
      >
        {data.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <TouchableOpacity
              key={idx}
              className="h-[38px] justify-center items-center z-20"
              onPress={() => {
                onSelect(idx);
                scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text className={`text-sm font-medium ${isSelected ? 'text-[17px] font-bold text-primary' : 'text-slate-400'}`}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Helper to parse date string into Date, Hour, Minute
const parseDateObj = (dateStr: string): { date: Date; hour: string; minute: string } => {
  const now = new Date();
  const currentH = String(now.getHours()).padStart(2, '0');
  const currentM = String(now.getMinutes()).padStart(2, '0');

  if (!dateStr) {
    return { date: now, hour: currentH, minute: currentM };
  }

  // 1. DD/MM/YYYY HH:mm or DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [dPart, tPart] = dateStr.split(/\s+/);
    const [d, m, y] = dPart.split('/').map(Number);
    let h = now.getHours(), min = now.getMinutes();
    if (tPart && tPart.includes(':')) {
      const [hNum, minNum] = tPart.split(':').map(Number);
      if (!isNaN(hNum)) h = hNum;
      if (!isNaN(minNum)) min = minNum;
    }
    const dt = new Date(y, m - 1, d, h, min);
    return {
      date: isNaN(dt.getTime()) ? new Date() : dt,
      hour: String(h).padStart(2, '0'),
      minute: String(min).padStart(2, '0'),
    };
  }

  // 2. YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm or YYYY-MM-DD
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    return {
      date: dt,
      hour: String(dt.getHours()).padStart(2, '0'),
      minute: String(dt.getMinutes()).padStart(2, '0'),
    };
  }

  return { date: now, hour: currentH, minute: currentM };
};

// Format user-entered or selected date string to ISO string for backend
const formatDueDateToISO = (str?: string) => {
  if (!str || !str.trim()) return undefined;
  const trimmed = str.trim();

  // If DD/MM/YYYY HH:mm
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(trimmed)) {
    const [dStr, tStr] = trimmed.split(/\s+/);
    const [d, m, y] = dStr.split('/').map(Number);
    const [h, min] = tStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, min).toISOString();
  }

  // If DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    return new Date(y, m - 1, d, 17, 0, 0).toISOString();
  }

  // If YYYY-MM-DDTHH:mm or ISO date
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString();
  }

  return trimmed;
};

// Interactive Calendar & Swipeable Wheel Time Picker Modal
const CalendarPickerModal: React.FC<{
  visible: boolean;
  title: string;
  currentDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}> = ({ visible, title, currentDateStr, onSelectDate, onClose }) => {
  const { width } = useWindowDimensions();
  const [viewDate, setViewDate] = useState(new Date());
  const [hour, setHour] = useState('17');
  const [minute, setMinute] = useState('00');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  /** Khoá đồng bộ: mỗi lần mở picker (hoặc đổi ngày) thì nạp lại giá trị từ prop */
  const [syncedPickerKey, setSyncedPickerKey] = useState('closed');

  const hoursData = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutesData = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);

  /**
   * Điều chỉnh state trong lúc render khi mở picker / đổi ngày (React khuyến nghị,
   * KHÔNG setState trong useEffect để tránh cascading render).
   */
  const pickerKey = visible ? `open:${currentDateStr || ''}` : 'closed';
  if (pickerKey !== syncedPickerKey) {
    setSyncedPickerKey(pickerKey);
    if (visible) {
      const parsed = parseDateObj(currentDateStr);
      setViewDate(parsed.date);
      setSelectedDay(parsed.date.getDate());
      setHour(parsed.hour);
      setMinute(parsed.minute);
    }
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleConfirm = () => {
    const activeDay = selectedDay || viewDate.getDate();
    const safeH = String(Math.min(23, Math.max(0, parseInt(hour || '17', 10)))).padStart(2, '0');
    const safeM = String(Math.min(59, Math.max(0, parseInt(minute || '00', 10)))).padStart(2, '0');
    const formatted = `${String(activeDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year} ${safeH}:${safeM}`;
    onSelectDate(formatted);
    onClose();
  };

  const handleSelectDay = (dayNum: number) => {
    setSelectedDay(dayNum);
  };

  const handleSelectToday = () => {
    const today = new Date();
    setViewDate(today);
    setSelectedDay(today.getDate());
    const dayStr = String(today.getDate()).padStart(2, '0');
    const monthStr = String(today.getMonth() + 1).padStart(2, '0');
    const yearStr = today.getFullYear();
    const curH = String(today.getHours()).padStart(2, '0');
    const curM = String(today.getMinutes()).padStart(2, '0');
    setHour(curH);
    setMinute(curM);
    const formatted = `${dayStr}/${monthStr}/${yearStr} ${curH}:${curM}`;
    onSelectDate(formatted);
    onClose();
  };

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = new Date();
  const isCurrentMonthToday = todayDate.getFullYear() === year && todayDate.getMonth() === month;

  // Tính trực tiếp (không useMemo) vì React Compiler không giữ được memoization này
  const parsedPickerDate = parseDateObj(currentDateStr);
  const currentSelectedDay =
    selectedDay ??
    (parsedPickerDate.date.getFullYear() === year && parsedPickerDate.date.getMonth() === month
      ? parsedPickerDate.date.getDate()
      : null);

  const selectedHourIndex = Math.max(0, hoursData.indexOf(hour.padStart(2, '0')));
  const selectedMinuteIndex = Math.max(0, minutesData.indexOf(minute.padStart(2, '0')));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/60 justify-center items-center">
        <View className="bg-white rounded-2xl p-4 shadow-xl" style={{ width: Math.min(width * 0.94, 380) }}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <Text className="text-[15px] font-bold text-slate-900">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Month Navigator */}
          <View className="flex-row justify-between items-center mb-3">
            <TouchableOpacity onPress={prevMonth} className="p-1.5 rounded-lg bg-slate-50">
              <Feather name="chevron-left" size={20} color="#1E293B" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-slate-900">
              Tháng {month + 1}, {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} className="p-1.5 rounded-lg bg-slate-50">
              <Feather name="chevron-right" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View className="flex-row justify-between mb-2">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => (
              <Text key={i} className={`w-10 text-center text-xs font-bold ${i >= 5 ? 'text-red-500' : 'text-slate-500'}`}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View className="flex-row flex-wrap">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <View key={`empty-${i}`} className="w-[14.28%] h-[38px] justify-center items-center my-0.5" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = dayNum === currentSelectedDay;
              const isToday = isCurrentMonthToday && todayDate.getDate() === dayNum;

              return (
                <TouchableOpacity
                  key={`day-${dayNum}`}
                  className={`w-[14.28%] h-[38px] justify-center items-center my-0.5 rounded-lg ${
                    isSelected
                      ? 'bg-primary'
                      : isToday
                      ? 'bg-blue-50 border border-primary'
                      : ''
                  }`}
                  onPress={() => handleSelectDay(dayNum)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      isSelected
                        ? 'text-white font-bold'
                        : isToday
                        ? 'text-primary font-bold'
                        : 'text-slate-800'
                    }`}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time Picker Section */}
          <View className="mt-3 pt-3 border-t border-slate-200 gap-2.5">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <View className="flex-row items-center gap-1.5">
                  <Feather name="clock" size={15} color={BrandColors.primary} />
                  <Text className="text-[13px] font-bold text-slate-700">Giờ : Phút</Text>
                </View>

                {/* Direct TextInput fields for hour and minute */}
                <View className="flex-row items-center gap-1 mt-0.5">
                  <TextInput
                    className="w-[38px] h-8 border border-slate-300 rounded-lg text-center text-[13px] font-bold text-primary bg-slate-50 p-0"
                    value={hour}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, '');
                      setHour(cleaned);
                    }}
                    onBlur={() => {
                      const hNum = parseInt(hour, 10);
                      if (isNaN(hNum)) setHour('17');
                      else setHour(String(Math.min(23, Math.max(0, hNum))).padStart(2, '0'));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text className="text-7xl" style={{ fontSize: 14, fontWeight: '800', color: '#64748B' }}>:</Text>
                  <TextInput
                    className="w-[38px] h-8 border border-slate-300 rounded-lg text-center text-[13px] font-bold text-primary bg-slate-50 p-0"
                    value={minute}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, '');
                      setMinute(cleaned);
                    }}
                    onBlur={() => {
                      const mNum = parseInt(minute, 10);
                      if (isNaN(mNum)) setMinute('00');
                      else setMinute(String(Math.min(59, Math.max(0, mNum))).padStart(2, '0'));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Scrollable Wheel Picker for Hour and Minute */}
              <View className="flex-row items-center gap-2">
                <WheelPicker
                  data={hoursData}
                  selectedIndex={selectedHourIndex >= 0 ? selectedHourIndex : 17}
                  onSelect={(idx) => setHour(hoursData[idx])}
                />
                <Text className="text-lg font-extrabold text-primary">:</Text>
                <WheelPicker
                  data={minutesData}
                  selectedIndex={selectedMinuteIndex >= 0 ? selectedMinuteIndex : 0}
                  onSelect={(idx) => setMinute(minutesData[idx])}
                />
              </View>
            </View>
          </View>

          {/* Footer actions */}
          <View className="flex-row justify-between items-center mt-3 pt-2.5 border-t border-slate-100">
            <TouchableOpacity onPress={handleSelectToday} className="py-2 px-3.5 rounded-lg bg-blue-50">
              <Text className="text-xs font-bold text-primary">Hôm nay</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleConfirm} className="py-2 px-4 rounded-lg bg-primary">
              <Text className="text-xs font-bold text-white">Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface TaskAssignModalProps {
  visible: boolean;
  onClose: () => void;
  task: TaskDetail | TaskDetail[] | null;
  project?: any;
  teamMembers: {
    id: string;
    role: string;
    roles?: (string | { role?: string })[];
    user?: {
      id: string;
      fullName: string;
      email?: string;
      workload?: {
        percent?: number;
        displayPercent?: number;
        taskCount?: number;
      } | null;
    };
  }[];
  onSuccess: () => void;
}

export default function TaskAssignModal({
  visible,
  onClose,
  task,
  project,
  teamMembers,
  onSuccess,
}: TaskAssignModalProps) {
  const isBulk = Array.isArray(task);
  const tasks = useMemo(() => (Array.isArray(task) ? task : task ? [task] : []), [task]);
  const representativeTask = tasks[0] || null;

  const [performerType, setPerformerType] = useState<'INTERNAL' | 'VENDOR'>('INTERNAL');
  const [isTeamAssignment, setIsTeamAssignment] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [isAssigneePickerVisible, setIsAssigneePickerVisible] = useState(false);

  const [dueDate, setDueDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDueDateChange = (text: string) => {
    if (text.length < dueDate.length) {
      setDueDate(text);
      return;
    }

    const digits = text.replace(/\D/g, '');
    if (!digits) {
      setDueDate('');
      return;
    }

    let res = '';
    if (digits.length > 0) res += digits.slice(0, 2);
    if (digits.length > 2) res += '/' + digits.slice(2, 4);
    if (digits.length > 4) res += '/' + digits.slice(4, 8);
    if (digits.length > 8) res += ' ' + digits.slice(8, 10);
    if (digits.length > 10) res += ':' + digits.slice(10, 12);
    setDueDate(res);
  };
  const [description, setDescription] = useState<string>('');
  const [links, setLinks] = useState<string[]>(['']);
  const [files, setFiles] = useState<PickedFile[]>([]);

  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const assignTaskMutation = useAssignTaskMutation();
  const bulkAssignMutation = useBulkAssignTasksMutation();
  const assignSupportTeamMutation = useAssignSupportTeamMutation();
  const requestSupportMutation = useRequestSupportMutation();

  const isPending =
    assignTaskMutation.isPending ||
    bulkAssignMutation.isPending ||
    assignSupportTeamMutation.isPending ||
    requestSupportMutation.isPending ||
    isUploading;

  const isSupportRequested = !isBulk && representativeTask ? (representativeTask as any).isSupportRequested : false;
  const isSupportMode = !isBulk && representativeTask ? !isSupportRequested && (representativeTask.status === 'DOING' || representativeTask.status === 'REWORKING') : false;

  const jobId =
    representativeTask?.jobId ||
    representativeTask?.job?.id ||
    (representativeTask as any)?.contractService?.jobId ||
    (representativeTask as any)?.contractService?.job?.id ||
    '';

  const selectedTaskJobIds = useMemo(
    () => [...new Set(tasks.map(getTaskJobId).filter(Boolean))],
    [tasks]
  );
  const hasTaskWithoutJob = useMemo(
    () => tasks.some((t) => !getTaskJobId(t)),
    [tasks]
  );

  const { data: singleJobVendorsData, isLoading: isLoadingSingleJobVendors } = useVendorsByJobQuery(
    performerType === 'VENDOR' && !isBulk ? jobId : '',
    performerType === 'VENDOR' && !isBulk
  );

  const { data: bulkVendorsData, isLoading: isLoadingBulkVendors } = useBulkVendorsByJobsQuery(
    selectedTaskJobIds,
    performerType === 'VENDOR' && isBulk && !hasTaskWithoutJob
  );

  const vendors = isBulk
    ? hasTaskWithoutJob
      ? []
      : bulkVendorsData || []
    : singleJobVendorsData || [];

  const isLoadingVendors = isBulk
    ? hasTaskWithoutJob
      ? false
      : isLoadingBulkVendors
    : isLoadingSingleJobVendors;

  const { data: teamsData, isLoading: isLoadingTeams } = useTeamsQuery();
  const allTeams = teamsData || [];

  const [syncedAssignTaskKey, setSyncedAssignTaskKey] = useState('closed');
  const nextAssignTaskKey = visible && representativeTask ? `open:${representativeTask.id || ''}` : 'closed';
  if (nextAssignTaskKey !== syncedAssignTaskKey) {
    setSyncedAssignTaskKey(nextAssignTaskKey);
    if (visible && representativeTask) {
      setSelectedAssigneeId(representativeTask.assigneeId || representativeTask.assignee?.id || '');
      const defaultPerfType = (representativeTask as any).performerType === 'VENDOR' ? 'VENDOR' : 'INTERNAL';
      setPerformerType(defaultPerfType);
      setIsTeamAssignment(false);
      setSelectedTeamId('');
      setSelectedVendorId('');
      const storedDueDate = representativeTask.dueDate || (representativeTask as any).plannedEndDate;
      setDueDate(formatDateTimeToDDMMYYYYHHMM(storedDueDate, storedDueDate || ''));
      setDescription(representativeTask.description || '');
      setLinks(['']);
      setFiles([]);
      setUploadProgress({});
    }
  }

  const parsedDeadline = useMemo(() => parseDateObj(dueDate), [dueDate]);

  const selectedDeadlineDateKey = useMemo(
    () => (dueDate ? formatDateToYYYYMMDD(parsedDeadline.date) : ''),
    [dueDate, parsedDeadline.date]
  );

  /** Task cha (khi phân công công việc con) — lấy từ payload hoặc fetch riêng */
  const parentTaskId = (representativeTask as any)?.parentTaskId as string | undefined;
  const { data: fetchedParentTask } = useTaskDetailQuery(parentTaskId || '');
  const parentTask: any = (representativeTask as any)?.parentTask || fetchedParentTask || null;
  const parentDeadline = parentTask?.plannedEndDate ? new Date(parentTask.plannedEndDate) : null;

  /** Tháng của deadline đang chọn — nguồn cho lịch tải nhân sự */
  const workloadRange = useMemo(() => getMonthRange(parsedDeadline.date), [parsedDeadline.date]);
  const shouldFetchWorkload =
    Boolean(selectedAssigneeId) && performerType === 'INTERNAL' && !isTeamAssignment;

  const { data: workloadData } = useTaskDailyWorkloadQuery(
    shouldFetchWorkload ? selectedAssigneeId : '',
    workloadRange.startDate,
    workloadRange.endDate,
    shouldFetchWorkload
  );

  /** % tải của nhân sự trong ngày deadline đang chọn (cảnh báo nếu ≥ 100%) */
  const selectedDayWorkloadPercent = useMemo(() => {
    const day = (workloadData?.days || []).find(
      (item) => formatDateToYYYYMMDD(item.date) === selectedDeadlineDateKey
    );
    return Number(day?.workloadPercent ?? 0) || 0;
  }, [workloadData?.days, selectedDeadlineDateKey]);

  const selectedAssigneeName = useMemo(() => {
    const member = teamMembers.find((item) => item.user?.id === selectedAssigneeId);
    return member?.user?.fullName || 'Nhân sự được chọn';
  }, [teamMembers, selectedAssigneeId]);

  const selectedMember = useMemo(() => {
    return teamMembers.find((m) => m.user?.id === selectedAssigneeId) || null;
  }, [teamMembers, selectedAssigneeId]);

  const quickSuggestions = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return [];
    const valid = teamMembers.filter((m) => m.user?.id);
    return [...valid]
      .sort((a, b) => {
        const wA = getWorkloadPercent(a.user?.workload);
        const wB = getWorkloadPercent(b.user?.workload);
        return wA - wB;
      })
      .slice(0, 3);
  }, [teamMembers]);

  /** Chọn 1 ngày trên lịch tải ⇒ đặt deadline = ngày đó lúc 17:30 (DEFAULT_DEADLINE_TIME) */
  const handleSelectWorkloadDate = useCallback((dateKey: string) => {
    setDueDate(formatDateTimeToDDMMYYYYHHMM(combineDateWithDefaultTime(dateKey)));
  }, []);

  const handlePerformerTypeChange = (type: 'INTERNAL' | 'VENDOR') => {
    setPerformerType(type);
    setSelectedAssigneeId('');
    setSelectedVendorId('');
  };

  const handleToggleTeamAssignment = () => {
    const nextVal = !isTeamAssignment;
    setIsTeamAssignment(nextVal);
    setSelectedAssigneeId('');
    setSelectedTeamId('');
    setSelectedVendorId('');
  };

  const handleAddLink = () => {
    setLinks((prev) => [...prev, '']);
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, value: string) => {
    setLinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handlePickFile = async () => {
    if (files.length >= 5) {
      Alert.alert('Cảnh báo', 'Chỉ được chọn tối đa 5 file đính kèm.');
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const newFile: PickedFile = {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        };

        const currentTotalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
        if (currentTotalSize + (asset.size || 0) > 25 * 1024 * 1024) {
          Alert.alert('Cảnh báo', 'Tổng dung lượng các file không được vượt quá 25MB.');
          return;
        }

        setFiles((prev) => [...prev, newFile]);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể chọn tệp. ' + (err?.message || ''));
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!task) return null;

  /** Thân xử lý phân công — chỉ chạy sau khi đã qua toàn bộ validate của `handleSubmit` */
  const performSubmit = async () => {
    try {
      const attachmentsList: Array<{ type: string; name: string; url: string; size?: number }> = [];

      for (const l of links) {
        const trimmed = l.trim();
        if (trimmed) {
          if (!isValidUrl(trimmed)) {
            Alert.alert(
              'Liên kết không hợp lệ',
              `Đường dẫn "${trimmed}" không đúng định dạng. Vui lòng kiểm tra lại (Ví dụ: google.com hoặc https://example.com).`
            );
            return;
          }
          const formattedUrl = normalizeUrl(trimmed);
          attachmentsList.push({
            type: 'LINK',
            name: formattedUrl,
            url: formattedUrl,
          });
        }
      }

      if (files.length > 0) {
        setIsUploading(true);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const uploaded = await uploadToCloudinary(file, 'GETVINI/ERP/tasks', (percent) => {
            setUploadProgress((prev) => ({ ...prev, [i]: percent }));
          });
          attachmentsList.push({
            type: 'FILE',
            name: uploaded.name,
            url: uploaded.url,
            size: uploaded.size,
          });
        }
        setIsUploading(false);
      }

      if (!task || tasks.length === 0) return null;

      const projectId = project?.id || (representativeTask as any)?.projectId;
      const formattedPlannedEndDate = formatDueDateToISO(dueDate);

      if (isBulk) {
        const finalAssigneeId = performerType === 'INTERNAL' ? selectedAssigneeId : selectedVendorId;
        await bulkAssignMutation.mutateAsync({
          taskIds: tasks.map((t) => t.id),
          assigneeId: finalAssigneeId,
          performerType,
          plannedEndDate: formattedPlannedEndDate,
          plannedStartDate: new Date().toISOString(),
          description: description.trim() || undefined,
          attachments: attachmentsList,
          projectId,
        });

        Alert.alert('Thành công', `Đã phân công ${tasks.length} công việc hàng loạt thành công!`);
      /*
      // Deprecated cross-team assignSupportTeam mutation
      } else if (isTeamAssignment) {
        if (representativeTask && representativeTask.status === 'DOING' && !isSupportRequested) {
          await requestSupportMutation.mutateAsync({
            taskId: representativeTask.id,
            reason: description || 'Cần hỗ trợ thực hiện công việc này',
            projectId,
          });
        }

        await assignSupportTeamMutation.mutateAsync({
          taskId: representativeTask?.id || '',
          teamId: selectedTeamId,
          projectId,
        });
        Alert.alert('Thành công', 'Đã phân công Team hỗ trợ thực hiện công việc thành công!');
      */
      } else {
        const finalAssigneeId = performerType === 'INTERNAL' ? selectedAssigneeId : selectedVendorId;
        await assignTaskMutation.mutateAsync({
          id: representativeTask?.id || '',
          payload: {
            assigneeId: finalAssigneeId,
            performerType,
            plannedEndDate: formattedPlannedEndDate,
            description: description.trim() || undefined,
            attachments: attachmentsList,
            projectId,
          },
        });

        Alert.alert('Thành công', `Đã phân công công việc "${representativeTask?.name}" thành công!`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setIsUploading(false);
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi phân công công việc.');
    }
  };

  const handleSubmit = async () => {
    if (isTeamAssignment) {
      if (!selectedTeamId) {
        Alert.alert('Cảnh báo', 'Vui lòng chọn Team hỗ trợ.');
        return;
      }
    } else {
      if (performerType === 'INTERNAL' && !selectedAssigneeId) {
        Alert.alert('Cảnh báo', 'Vui lòng chọn nhân sự thực hiện trong đội dự án.');
        return;
      }
      if (performerType === 'VENDOR' && !selectedVendorId) {
        Alert.alert('Cảnh báo', 'Vui lòng chọn đối tác Vendor thực hiện.');
        return;
      }
    }

    // Ràng buộc 1: deadline không được ở quá khứ (mirror erp-UI TaskAssignModal.jsx:377-388)
    if (dueDate && !Number.isNaN(parsedDeadline.date.getTime())) {
      const now = new Date();
      now.setSeconds(0, 0);
      if (parsedDeadline.date.getTime() < now.getTime() - 60 * 1000) {
        Alert.alert('Cảnh báo', 'Deadline không được ở trong quá khứ.');
        return;
      }

      // Ràng buộc 2: công việc con không được có deadline sau deadline công việc cha
      if (parentDeadline && !Number.isNaN(parentDeadline.getTime()) && parsedDeadline.date > parentDeadline) {
        Alert.alert(
          'Cảnh báo',
          `Deadline của công việc con không được sau deadline của công việc cha (Hạn chót cha: ${formatDateToDDMMYYYY(
            parentDeadline
          )}).`
        );
        return;
      }
    }

    // Ràng buộc 3: cảnh báo quá tải nếu nhân sự đã ≥ 100% tải trong ngày được chọn
    if (
      performerType === 'INTERNAL' &&
      !isTeamAssignment &&
      selectedAssigneeId &&
      selectedDayWorkloadPercent >= 100
    ) {
      Alert.alert(
        'Nhân sự đã quá tải trong ngày này',
        `${selectedAssigneeName} đang có ${selectedDayWorkloadPercent}% tải công việc trong ngày ${
          selectedDeadlineDateKey ? formatDateToDDMMYYYY(selectedDeadlineDateKey) : 'đã chọn'
        }. Bạn vẫn muốn phân công?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Vẫn phân công', onPress: () => { performSubmit(); } },
        ]
      );
      return;
    }

    await performSubmit();
  };

  if (!task || tasks.length === 0) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-white rounded-t-[24px] p-5 maxHeight-[90%] gap-3">
            {/* Header */}
            <View className="flex-row justify-between items-start pb-2.5 border-b border-slate-100">
              <View className="flex-1 gap-0.5">
                <Text className="text-lg font-bold text-slate-900">
                  {isBulk
                    ? `Phân công (${tasks.length}) công việc`
                    : representativeTask?.assigneeId
                    ? 'Đổi người thực hiện'
                    : 'Phân công công việc'}
                </Text>
                <Text className="text-xs font-semibold text-slate-500" numberOfLines={1}>
                  {isBulk
                    ? `Đang gán hàng loạt cho ${tasks.length} công việc đã chọn`
                    : `#${representativeTask?.code || 'TASK'} • ${representativeTask?.name}`}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1.5 rounded-lg bg-slate-100">
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[460px]">
              {/* Performer Type Selector (Internal vs Vendor) */}
              {!isTeamAssignment && (
                <>
                  <Text className="text-xs font-bold text-slate-700 mt-3 mb-1.5">1. Hình thức thực hiện</Text>
                  <View className="flex-row gap-2.5 mb-1">
                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center gap-1.5 border rounded-xl py-2.5 ${
                        performerType === 'INTERNAL'
                          ? 'border-primary bg-teal-50/50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                      onPress={() => handlePerformerTypeChange('INTERNAL')}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="users"
                        size={15}
                        color={performerType === 'INTERNAL' ? BrandColors.primary : '#64748B'}
                      />
                      <Text
                        className={`text-[13px] ${
                          performerType === 'INTERNAL' ? 'font-bold text-primary' : 'font-semibold text-slate-500'
                        }`}
                      >
                        Nội bộ
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center gap-1.5 border rounded-xl py-2.5 ${
                        performerType === 'VENDOR'
                          ? 'border-primary bg-teal-50/50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                      onPress={() => handlePerformerTypeChange('VENDOR')}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="briefcase"
                        size={15}
                        color={performerType === 'VENDOR' ? BrandColors.primary : '#64748B'}
                      />
                      <Text
                        className={`text-[13px] ${
                          performerType === 'VENDOR' ? 'font-bold text-primary' : 'font-semibold text-slate-500'
                        }`}
                      >
                        Vendor
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Support Team Request Toggle Banner */}
              <Text className="text-xs font-bold text-slate-700 mt-3 mb-1.5">
                {performerType === 'INTERNAL'
                  ? `2. Người thực hiện (${teamMembers.length} thành viên)`
                  : '2. Đối tác Vendor'}
              </Text>

              {/* Assignee / Team Selection */}
              {isTeamAssignment ? (
                <View className="mt-0.5 mb-1.5">
                  {isLoadingTeams ? (
                    <View className="flex-row items-center gap-2 py-3">
                      <ActivityIndicator size="small" color={BrandColors.primary} />
                      <Text className="text-[13px] text-slate-500">Đang tải danh sách Team...</Text>
                    </View>
                  ) : allTeams.length === 0 ? (
                    <Text className="text-xs text-slate-400 italic py-2">Không có team hỗ trợ nào khả dụng.</Text>
                  ) : (
                    <View className="gap-1.5">
                      {allTeams.map((t) => {
                        const isSelected = selectedTeamId === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            className={`flex-row items-center gap-2.5 p-2.5 border rounded-xl bg-white ${
                              isSelected ? 'border-primary bg-teal-50/50' : 'border-slate-200'
                            }`}
                            onPress={() => setSelectedTeamId(t.id)}
                            activeOpacity={0.7}
                          >
                            <View className="w-8 h-8 rounded-full bg-blue-50 justify-center items-center">
                              <Feather name="users" size={16} color={BrandColors.primary} />
                            </View>
                            <View className="flex-1">
                              <Text className="text-[13px] font-bold text-slate-900">{t.name}</Text>
                              <Text className="text-[11px] text-slate-500">
                                Lead: {t.teamLead?.fullName || 'Chưa phân công'}
                              </Text>
                            </View>
                            {isSelected && (
                              <Feather name="check-circle" size={18} color={BrandColors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : performerType === 'INTERNAL' ? (
                <View className="mt-0.5 mb-1.5">
                  {teamMembers.length === 0 ? (
                    <Text className="text-xs text-slate-400 italic py-2">
                      Đội dự án chưa có thành viên nào. Vui lòng thêm nhân sự vào đội ở Tab Tổng quan.
                    </Text>
                  ) : (
                    <>
                      {/* Trigger Card */}
                      {selectedMember ? (
                        <TouchableOpacity
                          className="flex-row items-center gap-3 p-3 border border-primary bg-orange-50/40 rounded-xl"
                          onPress={() => setIsAssigneePickerVisible(true)}
                          activeOpacity={0.75}
                        >
                          <View className="w-10 h-10 rounded-full bg-orange-100 justify-center items-center">
                            <Text className="text-base font-bold text-primary">
                              {selectedMember.user?.fullName
                                ? selectedMember.user.fullName.trim().charAt(0).toUpperCase()
                                : 'U'}
                            </Text>
                          </View>

                          <View className="flex-1 justify-center min-w-0">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              <Text className="text-[13px] font-bold text-slate-900" numberOfLines={1}>
                                {selectedMember.user?.fullName}
                              </Text>
                              <WorkloadBadge workload={selectedMember.user?.workload} />
                            </View>
                            <Text className="text-[11px] font-medium text-slate-500 mt-0.5" numberOfLines={1}>
                              {((getTeamMemberRoles(selectedMember) as string[]) || [])
                                .map((r) => TEAM_MEMBER_ROLE_LABELS[r] || r)
                                .join(' · ') || 'Thành viên'}
                            </Text>
                          </View>

                          <View className="flex-row items-center gap-2">
                            <View className="px-2.5 py-1 rounded-lg bg-white border border-primary/30">
                              <Text className="text-xs font-bold text-primary">Đổi</Text>
                            </View>
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedAssigneeId('');
                              }}
                              className="p-1 rounded-full bg-slate-200/60"
                              activeOpacity={0.7}
                            >
                              <Feather name="x" size={14} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          className="flex-row items-center justify-between p-3.5 border border-dashed border-slate-300 bg-slate-50/80 rounded-xl"
                          onPress={() => setIsAssigneePickerVisible(true)}
                          activeOpacity={0.75}
                        >
                          <View className="flex-row items-center gap-2.5">
                            <View className="w-8 h-8 rounded-full bg-orange-100/70 justify-center items-center">
                              <Feather name="user-plus" size={16} color={BrandColors.primary} />
                            </View>
                            <View>
                              <Text className="text-[13px] font-semibold text-slate-700">
                                Chạm để chọn người thực hiện
                              </Text>
                              <Text className="text-[11px] text-slate-400">
                                {teamMembers.length} nhân sự sẵn sàng trong dự án
                              </Text>
                            </View>
                          </View>
                          <Feather name="chevron-right" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      )}

                      {/* Quick Suggestion Chips (Gợi ý nhanh 1-tap) */}
                      {quickSuggestions.length > 0 && (
                        <View className="mt-2 flex-row items-center gap-1.5 flex-wrap">
                          <View className="flex-row items-center gap-1 mr-0.5">
                            <Feather name="zap" size={12} color={BrandColors.primary} />
                            <Text className="text-[11px] font-semibold text-slate-500">Gợi ý nhanh:</Text>
                          </View>
                          {quickSuggestions.map((m) => {
                            const uId = m.user?.id;
                            if (!uId) return null;
                            const isCurrent = selectedAssigneeId === uId;
                            const workload = getWorkloadPercent(m.user?.workload);
                            const nameParts = (m.user?.fullName || '').trim().split(' ');
                            const shortName =
                              nameParts.length > 1
                                ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
                                : m.user?.fullName;

                            return (
                              <TouchableOpacity
                                key={uId}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedAssigneeId(uId);
                                }}
                                activeOpacity={0.7}
                                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${
                                  isCurrent
                                    ? 'bg-primary border-primary'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <Text
                                  className={`text-[11px] font-semibold ${
                                    isCurrent ? 'text-white' : 'text-slate-700'
                                  }`}
                                >
                                  {shortName}
                                </Text>
                                <Text
                                  className={`text-[10px] font-bold ${
                                    isCurrent ? 'text-orange-100' : 'text-slate-400'
                                  }`}
                                >
                                  ({workload}%)
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View className="mt-0.5 mb-1.5">
                  {isLoadingVendors ? (
                    <View className="flex-row items-center gap-2 py-3">
                      <ActivityIndicator size="small" color={BrandColors.primary} />
                      <Text className="text-[13px] text-slate-500">Đang tải danh sách Vendor...</Text>
                    </View>
                  ) : isBulk && hasTaskWithoutJob ? (
                    <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                      <Feather name="alert-triangle" size={16} color="#D97706" />
                      <Text className="text-xs font-bold text-amber-700 flex-1">
                        Có công việc chưa xác định hạng mục nên chưa thể chọn vendor.
                      </Text>
                    </View>
                  ) : vendors.length === 0 ? (
                    <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                      <Feather name="alert-circle" size={16} color="#DC2626" />
                      <Text className="text-xs font-bold text-red-600 flex-1">
                        Chưa có vendor cung cấp {isBulk ? 'đồng thời các' : ''} dịch vụ này
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-1.5">
                      {vendors.map((v) => {
                        const isSelected = selectedVendorId === v.id;
                        return (
                          <TouchableOpacity
                            key={v.id}
                            className={`flex-row items-center gap-2.5 p-2.5 border rounded-xl bg-white ${
                              isSelected ? 'border-primary bg-teal-50/50' : 'border-slate-200'
                            }`}
                            onPress={() => setSelectedVendorId(v.id)}
                            activeOpacity={0.7}
                          >
                            <View className="w-8 h-8 rounded-full bg-blue-50 justify-center items-center">
                              <Feather name="briefcase" size={15} color={BrandColors.primary} />
                            </View>
                            <View className="flex-1">
                              <Text className="text-[13px] font-bold text-slate-900">{v.name}</Text>
                              {/* Vendor entity không có `contactPerson` — dùng SĐT, fallback nhãn chung. */}
                              <Text className="text-[11px] text-slate-500">{v.phone || 'Đối tác Vendor'}</Text>
                            </View>
                            {isSelected && (
                              <Feather name="check-circle" size={18} color={BrandColors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Lịch tải nhân sự — hiện ngay khi đã chọn nhân sự INTERNAL (không cần phải chọn ngày trước) */}
              {performerType === 'INTERNAL' && !isTeamAssignment && Boolean(selectedAssigneeId) && (
                <View className="mt-3 gap-1.5">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="bar-chart-2" size={13} color={BrandColors.primary} />
                    <Text className="text-xs font-bold text-slate-700">
                      Lịch tải nhân sự — {selectedAssigneeName}
                    </Text>
                  </View>
                  <TaskWorkloadCalendar
                    userId={selectedAssigneeId}
                    monthDate={parsedDeadline.date}
                    selectedDateKey={selectedDeadlineDateKey}
                    onSelectDate={handleSelectWorkloadDate}
                  />
                  {parentDeadline && !Number.isNaN(parentDeadline.getTime()) && (
                    <Text className="text-[11px] font-semibold text-amber-600">
                      ⚠️ Công việc con: hạn chót tối đa theo task cha là{' '}
                      {formatDateToDDMMYYYY(parentDeadline)}
                    </Text>
                  )}
                </View>
              )}

              {/* Deadline (Planned End Date) with Date & Time Picker */}
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-bold text-slate-700 mt-3 mb-1.5">3. Hạn hoàn thành (Deadline)</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg"
                  activeOpacity={0.7}
                >
                  <Feather name="calendar" size={13} color={BrandColors.primary} />
                  <Text className="text-[11px] font-bold text-primary">Mở lịch chọn</Text>
                </TouchableOpacity>
              </View>

              <View className="relative justify-center">
                <TouchableOpacity
                  className="absolute left-3 z-10 p-1"
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Feather name="calendar" size={18} color={BrandColors.primary} />
                </TouchableOpacity>
                <TextInput
                  className="border border-slate-200 rounded-xl pl-11 pr-3 py-2.5 text-[13px] text-slate-900 bg-white"
                  placeholder="dd/mm/yyyy --:--"
                  placeholderTextColor="#94A3B8"
                  value={dueDate}
                  onChangeText={handleDueDateChange}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* Description & Instruction */}
              <Text className="text-xs font-bold text-slate-700 mt-3 mb-1.5">4. Ghi chú & Chỉ dẫn công việc</Text>
              <View className="relative justify-center">
                <Feather name="file-text" size={16} color="#64748B" className="absolute left-3 top-3 z-10" />
                <TextInput
                  className="border border-slate-200 rounded-xl pl-11 pr-3 py-2.5 text-[13px] text-slate-900 bg-white min-h-[70px]"
                  placeholder="Mô tả chi tiết công việc hoặc lưu ý cho người thực hiện..."
                  placeholderTextColor="#94A3B8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  style={{ textAlignVertical: 'top' }}
                />
              </View>

              {/* Attachments Section: Links & Files */}
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-bold text-slate-700 mt-3 mb-1.5">5. Tài liệu đính kèm & Links</Text>
                <TouchableOpacity
                  className="flex-row items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-xl"
                  onPress={handleAddLink}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={BrandColors.primary} />
                  <Text className="text-[11px] font-bold text-primary">Thêm Link</Text>
                </TouchableOpacity>
              </View>

              {/* Links List */}
              {links.map((link, idx) => (
                <View key={`link-${idx}`} className="flex-row items-center gap-2 mb-2 relative">
                  <Feather name="link" size={15} color="#64748B" className="absolute left-3 z-10" />
                  <TextInput
                    className="flex-1 border border-slate-200 rounded-lg pl-9 pr-2.5 py-2 text-xs text-slate-900 bg-slate-50"
                    placeholder="Nhập link tài liệu (Google Drive, Figma, Dropbox...)"
                    placeholderTextColor="#94A3B8"
                    value={link}
                    onChangeText={(text) => handleLinkChange(idx, text)}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                  {links.length > 1 && (
                    <TouchableOpacity
                      className="p-2"
                      onPress={() => handleRemoveLink(idx)}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Files Section */}
              <TouchableOpacity
                className="border-[1.5px] border-dashed border-slate-300 rounded-2xl bg-slate-50 p-4 items-center justify-center gap-1 mt-1.5"
                onPress={handlePickFile}
                activeOpacity={0.8}
              >
                <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mb-0.5">
                  <Feather name="upload-cloud" size={22} color={BrandColors.primary} />
                </View>
                <Text className="text-[13px] font-bold text-slate-700">Bấm để chọn tệp đính kèm</Text>
                <Text className="text-[11px] text-slate-400">Tối đa 5 file, tổng dung lượng 25MB</Text>
              </TouchableOpacity>

              {files.length > 0 && (
                <View className="gap-1.5 mt-2">
                  {files.map((file, idx) => {
                    const progress = uploadProgress[idx];
                    return (
                      <View key={`file-${idx}`} className="flex-row items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-white">
                        <View className="flex-1 flex-row items-center gap-2.5">
                          <Feather name="file" size={18} color="#64748B" />
                          <View className="flex-1">
                            <Text className="text-xs font-semibold text-slate-900" numberOfLines={1}>
                              {file.name}
                            </Text>
                            {file.size ? (
                              <Text className="text-[10px] text-slate-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </Text>
                            ) : null}
                            {isUploading && progress !== undefined && (
                              <View className="h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
                                <View className="h-full bg-primary" style={{ width: `${progress}%` }} />
                              </View>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveFile(idx)}
                          disabled={isUploading}
                          className="p-1.5"
                        >
                          <Feather name="x" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Footer Actions */}
            <View className="flex-row gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl border border-slate-200 items-center justify-center"
                onPress={onClose}
                disabled={isPending}
              >
                <Text className="text-sm font-semibold text-slate-600">Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-[2] flex-row items-center justify-center gap-1.5 bg-primary py-3 rounded-xl ${
                  isPending ? 'opacity-60' : ''
                }`}
                onPress={handleSubmit}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white">Đang xử lý...</Text>
                  </>
                ) : (
                  <>
                    <Feather name="user-check" size={16} color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white">
                      {isBulk
                        ? `Phân công (${tasks.length}) việc`
                        : representativeTask?.assigneeId
                        ? 'Lưu đổi người'
                        : 'Xác nhận phân công'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date & Time Picker Modal */}
      <CalendarPickerModal
        visible={showDatePicker}
        title="Chọn hạn hoàn thành (Ngày & Giờ)"
        currentDateStr={dueDate}
        onSelectDate={(d) => setDueDate(d)}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Sub-sheet: Dedicated Assignee Selector */}
      <AssigneeSelectorModal
        visible={isAssigneePickerVisible}
        onClose={() => setIsAssigneePickerVisible(false)}
        teamMembers={teamMembers}
        selectedAssigneeId={selectedAssigneeId}
        onSelect={(assigneeId) => setSelectedAssigneeId(assigneeId)}
      />
    </>
  );
}
