import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { useRequestReworkMutation } from '@/hooks/queries/useTasks';
import { isValidUrl, normalizeUrl } from '@/utils/validators';

const ITEM_HEIGHT = 38;

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
    <View className="relative bg-background rounded-xl overflow-hidden border border-border" style={{ height: ITEM_HEIGHT * 3 }}>
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 bg-primary-light border-y border-primary z-10"
        style={{ top: ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
      >
        {data.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={`wheel-item-${item}`}
              className="items-center justify-center"
              style={{ height: ITEM_HEIGHT }}
              onPress={() => onSelect(index)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm ${
                  isSelected ? 'text-base font-extrabold text-primary' : 'font-semibold text-slate-400'
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Custom Full-Featured Calendar & Time Picker Modal
const CalendarPickerModal: React.FC<{
  visible: boolean;
  title?: string;
  currentDateStr?: string;
  onSelectDate: (formattedStr: string) => void;
  onClose: () => void;
}> = ({ visible, title = 'Chọn ngày & giờ', currentDateStr, onSelectDate, onClose }) => {
  const { width } = useWindowDimensions();

  const parseInitialDate = () => {
    if (!currentDateStr) return new Date();
    const clean = currentDateStr.replace('T', ' ');
    const parts = clean.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '17:00';
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d, hh || 17, mm || 0);
    }
    return new Date();
  };

  const initial = parseInitialDate();
  const [selectedDate, setSelectedDate] = useState<Date>(initial);
  const [viewYear, setViewYear] = useState<number>(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initial.getMonth());
  const [selectedHour, setSelectedHour] = useState<number>(initial.getHours());
  const [selectedMin, setSelectedMin] = useState<number>(initial.getMinutes());

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ];
  const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const newD = new Date(selectedDate);
    newD.setFullYear(viewYear);
    newD.setMonth(viewMonth);
    newD.setDate(day);
    setSelectedDate(newD);
  };

  const handleSetToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedHour(now.getHours());
    setSelectedMin(now.getMinutes());
  };

  const handleConfirm = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const hh = String(selectedHour).padStart(2, '0');
    const mm = String(selectedMin).padStart(2, '0');
    const formatted = `${y}-${m}-${d} ${hh}:${mm}`;
    onSelectDate(formatted);
    onClose();
  };

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getDate() === day &&
      now.getMonth() === viewMonth &&
      now.getFullYear() === viewYear
    );
  };

  const isSelected = (day: number) => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear
    );
  };

  const hoursData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  }, []);

  const minutesData = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  }, []);

  if (!visible) return null;

  const calendarWidth = Math.min(width - 32, 360);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-center items-center p-4">
        <View className="bg-surface rounded-3xl p-4 gap-3 shadow-xl" style={{ width: calendarWidth }}>
          {/* Modal Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-2.5">
            <Text className="text-sm font-extrabold text-text-primary">{title}</Text>
            <TouchableOpacity onPress={onClose} className="p-1 rounded-lg bg-slate-100">
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Month/Year Switcher Header */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handlePrevMonth} className="p-1.5 rounded-lg bg-background">
              <Feather name="chevron-left" size={18} color="#334155" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-text-primary">
              {monthNames[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} className="p-1.5 rounded-lg bg-background">
              <Feather name="chevron-right" size={18} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Days of Week Row */}
          <View className="flex-row justify-around py-1">
            {weekDays.map((wd, i) => (
              <Text key={i} className="text-xs font-bold text-slate-500 w-9 text-center">
                {wd}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View className="flex-row flex-wrap">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <View key={`empty-${i}`} className="w-[14.28%] h-[34px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const sel = isSelected(day);
              const tod = isToday(day);

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  className={`w-[14.28%] h-[34px] items-center justify-center my-0.5 rounded-full ${
                    sel
                      ? 'bg-primary'
                      : tod
                      ? 'border-1.5 border-primary'
                      : ''
                  }`}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs ${
                      sel
                        ? 'font-extrabold text-white'
                        : tod
                        ? 'font-extrabold text-primary'
                        : 'font-semibold text-slate-700'
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time Picker Section */}
          <View className="bg-background rounded-xl p-3 gap-2.5 border border-border">
            <View className="gap-2">
              <Text className="text-xs font-bold text-slate-700">Giờ hoàn thành</Text>
              <View className="flex-row items-center gap-1">
                <TextInput
                  className="w-9 h-7 bg-surface border border-primary rounded-md text-center text-xs font-extrabold text-primary p-0"
                  value={String(selectedHour).padStart(2, '0')}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 0 && num <= 23) {
                      setSelectedHour(num);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text className="text-sm font-extrabold text-slate-500">:</Text>
                <TextInput
                  className="w-9 h-7 bg-surface border border-primary rounded-md text-center text-xs font-extrabold text-primary p-0"
                  value={String(selectedMin).padStart(2, '0')}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 0 && num <= 59) {
                      setSelectedMin(num);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>

              {/* Time Presets */}
              <View className="flex-row gap-1.5">
                {[
                  { label: '09:00', h: 9, m: 0 },
                  { label: '12:00', h: 12, m: 0 },
                  { label: '17:00', h: 17, m: 0 },
                  { label: '21:00', h: 21, m: 0 },
                ].map((preset) => {
                  const isActive = selectedHour === preset.h && selectedMin === preset.m;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      className={`px-2 py-1 rounded-md border ${
                        isActive
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-slate-300'
                      }`}
                      onPress={() => {
                        setSelectedHour(preset.h);
                        setSelectedMin(preset.m);
                      }}
                    >
                      <Text
                        className={`text-[11px] ${
                          isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Drag Wheel Columns */}
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-slate-500 mb-1 text-center">GIỜ</Text>
                <WheelPicker
                  data={hoursData}
                  selectedIndex={selectedHour}
                  onSelect={(idx) => setSelectedHour(idx)}
                />
              </View>

              <Text className="text-lg font-extrabold text-slate-600 mt-3.5">:</Text>

              <View className="flex-1">
                <Text className="text-[10px] font-bold text-slate-500 mb-1 text-center">PHÚT</Text>
                <WheelPicker
                  data={minutesData}
                  selectedIndex={selectedMin}
                  onSelect={(idx) => setSelectedMin(idx)}
                />
              </View>
            </View>
          </View>

          {/* Footer Bar */}
          <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
            <TouchableOpacity
              className="flex-row items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-primary-light"
              onPress={handleSetToday}
            >
              <Feather name="calendar" size={13} color="#F38820" />
              <Text className="text-xs font-bold text-primary">Hôm nay</Text>
            </TouchableOpacity>

            <View className="flex-row gap-2">
              <TouchableOpacity className="py-2 px-3.5 rounded-lg bg-slate-100" onPress={onClose}>
                <Text className="text-xs font-bold text-slate-500">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity className="py-2 px-4 rounded-lg bg-primary" onPress={handleConfirm}>
                <Text className="text-xs font-bold text-white">Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface ReworkTaskModalProps {
  visible: boolean;
  onClose: () => void;
  task: any;
  onSuccess: () => void;
}

const getDefaultReworkDeadline = (task: any) => {
  const date = task?.dueDate ? new Date(task.dueDate) : new Date();
  if (!task?.dueDate) date.setDate(date.getDate() + 2);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 17:00`;
};

export default function ReworkTaskModal({
  visible,
  onClose,
  task,
  onSuccess,
}: ReworkTaskModalProps) {
  const [reworkReason, setReworkReason] = useState('');
  const [deadlineAt, setDeadlineAt] = useState(() => getDefaultReworkDeadline(task));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const requestReworkMutation = useRequestReworkMutation();

  const [attachments, setAttachments] = useState<any[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const fileObj = {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        };

        setIsUploading(true);
        const uploaded = await uploadToCloudinary(fileObj, `GETVINI/ERP/REWORK/${task.id}`);
        setIsUploading(false);

        if (uploaded) {
          setAttachments((prev) => [...prev, uploaded]);
        } else {
          Alert.alert('Lỗi', 'Không thể tải file đính kèm lên server.');
        }
      }
    } catch {
      setIsUploading(false);
      Alert.alert('Lỗi', 'Không thể chọn file.');
    }
  };

  const handleAddLink = () => {
    const rawLink = linkInput.trim();
    if (!rawLink) return;

    if (!isValidUrl(rawLink)) {
      Alert.alert('Đường dẫn không hợp lệ', 'Vui lòng nhập đúng định dạng liên kết.');
      return;
    }

    const url = normalizeUrl(rawLink);
    setAttachments((prev) => [...prev, { type: 'LINK', url, name: url }]);
    setLinkInput('');
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reworkReason.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập lý do/yêu cầu sửa lại.');
      return;
    }

    if (!deadlineAt.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn hoặc nhập hạn chót sửa lại.');
      return;
    }

    try {
      await requestReworkMutation.mutateAsync({
        id: task.id,
        payload: {
          feedback: reworkReason.trim(),
          deadlineAt: deadlineAt.trim(),
          attachments,
          projectId: task.project?.id || task.projectId,
        },
      });
      Alert.alert('Thành công', 'Đã tạo yêu cầu làm lại thành công!');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi tạo yêu cầu sửa lại.');
    }
  };

  if (!task) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity className="flex-1 bg-slate-900/50 justify-end" activeOpacity={1} onPress={onClose}>
          <TouchableOpacity className="bg-surface rounded-t-3xl max-h-[85%] pb-6" activeOpacity={1} onPress={() => {}}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-base font-extrabold text-text-primary">Yêu cầu sửa lại (Rework)</Text>
                <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                  {task.name}
                </Text>
              </View>
              <TouchableOpacity className="p-1.5 rounded-lg bg-slate-100" onPress={onClose}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              {/* Rework Reason */}
              <View className="mb-4">
                <Text className="text-[10px] font-extrabold text-slate-500 tracking-wider mb-1.5">LÝ DO / MÔ TẢ SỬA LẠI *</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl p-3 text-sm text-text-primary min-h-[100px] text-left"
                  placeholder="Mô tả chi tiết những phần cần điều chỉnh hoặc làm lại..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={{ textAlignVertical: 'top' }}
                  value={reworkReason}
                  onChangeText={setReworkReason}
                />
              </View>

              {/* New Deadline */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-[10px] font-extrabold text-slate-500 tracking-wider">DEADLINE MỚI (YYYY-MM-DD HH:mm) *</Text>
                  <TouchableOpacity
                    className="flex-row items-center gap-1"
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Feather name="calendar" size={13} color="#F38820" />
                    <Text className="text-xs font-bold text-primary">Chọn từ lịch</Text>
                  </TouchableOpacity>
                </View>

                <View className="relative justify-center">
                  <TouchableOpacity
                    className="absolute left-3 z-10 p-1"
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Feather name="calendar" size={18} color="#F38820" />
                  </TouchableOpacity>
                  <TextInput
                    className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary pl-11"
                    placeholder="YYYY-MM-DD 17:00"
                    placeholderTextColor="#94A3B8"
                    value={deadlineAt}
                    onChangeText={setDeadlineAt}
                  />
                </View>
              </View>

              {/* Attachments Section */}
              <View className="mb-4">
                <Text className="text-[10px] font-extrabold text-slate-500 tracking-wider mb-1.5">TÀI LIỆU / LINK THAM KHẢO ĐÍNH KÈM</Text>

                {attachments.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {attachments.map((att, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center gap-1.5 bg-primary-light border border-blue-200 rounded-lg px-2.5 py-1.5"
                      >
                        <Feather
                          name={att.type === 'LINK' ? 'link' : 'file'}
                          size={12}
                          color="#F38820"
                        />
                        <Text className="text-xs font-semibold text-primary max-w-[160px]" numberOfLines={1}>
                          {att.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemoveAttachment(idx)}>
                          <Feather name="x" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View className="gap-3 mb-3">
                  <TouchableOpacity
                    className="border-1.5 border-dashed border-slate-300 rounded-xl py-4 items-center justify-center gap-1.5 bg-background"
                    onPress={handlePickFile}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#F38820" />
                    ) : (
                      <>
                        <Feather name="upload-cloud" size={20} color="#F38820" />
                        <Text className="text-xs font-bold text-primary">Tải file tham khảo lên</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View className="gap-2 bg-background border border-border rounded-xl p-3">
                    <TextInput
                      className="text-xs text-text-primary bg-surface border border-border rounded-lg px-2.5 py-2"
                      placeholder="Hoặc dán đường dẫn link (Drive, Figma...)"
                      placeholderTextColor="#94A3B8"
                      value={linkInput}
                      onChangeText={setLinkInput}
                      autoCapitalize="none"
                    />
                    {linkInput.trim().length > 0 && (
                      <TouchableOpacity
                        className="bg-primary py-2 rounded-lg items-center"
                        onPress={handleAddLink}
                      >
                        <Text className="text-xs font-bold text-white">Thêm link đính kèm</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View className="flex-row gap-3 px-5 pt-3">
              <TouchableOpacity
                className="flex-1 py-3.5 rounded-xl border border-border items-center bg-surface"
                onPress={onClose}
                disabled={requestReworkMutation.isPending}
              >
                <Text className="text-sm font-bold text-slate-500">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-3.5 rounded-xl bg-primary items-center ${
                  requestReworkMutation.isPending ? 'opacity-60' : ''
                }`}
                onPress={handleSubmit}
                disabled={requestReworkMutation.isPending}
              >
                {requestReworkMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">Gửi yêu cầu</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Picker Modal */}
      {showDatePicker && (
        <CalendarPickerModal
          visible
          title="Chọn Deadline Mới"
          currentDateStr={deadlineAt}
          onSelectDate={(formattedStr) => setDeadlineAt(formattedStr)}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </>
  );
}
