import React, { useRef, useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useUpdateTaskMutation, useTaskDetailQuery } from '@/hooks/queries/useTasks';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { formatDateToDDMMYYYY, formatDateToYYYYMMDD } from '@/utils/formatters';
import { getTaskPolicy } from '@/utils/taskPolicy';

export default function TaskDeadlineEditor({ task, onChanged }: { task: any; onChanged: () => void }) {
  const { user } = useAuth();
  const policy = getTaskPolicy(task, user).editDeadline;
  const update = useUpdateTaskMutation();
  const { data: fetchedParent, isLoading: isParentLoading } = useTaskDetailQuery(task?.parentTaskId || '');
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('17:30');
  const [reason, setReason] = useState('');
  const saving = useRef(false);
  const save = async () => {
    if (!policy.enabled || update.isPending || isParentLoading || saving.current) return;
    if (!day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !reason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ngày, nhập giờ HH:mm và lý do đổi hạn chót.'); return;
    }
    const deadline = new Date(`${day}T${time}:00`);
    const parentDeadline = task.parentTask?.plannedEndDate || fetchedParent?.plannedEndDate;
    if (parentDeadline && deadline > new Date(parentDeadline)) {
      Alert.alert('Hạn chót không hợp lệ', 'Hạn chót công việc con không được sau công việc cha.'); return;
    }
    saving.current = true;
    try {
      await update.mutateAsync({ id: task.id, payload: { plannedEndDate: deadline.toISOString(), deadlineChangeReason: reason.trim(), projectId: task.project?.id } });
      setEditing(false); onChanged();
    } catch (error: any) { Alert.alert('Không thể đổi hạn chót', error.message || 'Vui lòng thử lại.'); }
    finally { saving.current = false; }
  };
  return <View className="gap-2">
    {!editing && policy.enabled && (
      <TouchableOpacity accessibilityLabel="Sửa hạn chót" className="rounded-xl bg-orange-50 border border-orange-200/80 px-3 py-2.5 items-center justify-center" onPress={() => {
        const date = task.plannedEndDate ? new Date(task.plannedEndDate) : new Date();
        setDay(formatDateToYYYYMMDD(date));
        setTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        setReason(''); setEditing(true);
      }} accessibilityRole="button"><Text className="font-bold text-orange-700">Sửa hạn chót</Text></TouchableOpacity>
    )}
    {editing && <View className="gap-2 rounded-xl border border-slate-200 p-3">
      <TouchableOpacity disabled={update.isPending} onPress={() => setPicker(true)} className="rounded-lg bg-slate-50 p-3"><Text>{formatDateToDDMMYYYY(day)}</Text></TouchableOpacity>
      <TextInput accessibilityLabel="Giờ hạn chót" editable={!update.isPending} value={time} onChangeText={setTime} placeholder="HH:mm" className="rounded-lg border border-slate-200 p-3" />
      <TextInput accessibilityLabel="Lý do đổi hạn chót" editable={!update.isPending} value={reason} onChangeText={setReason} placeholder="Lý do đổi hạn chót" multiline className="rounded-lg border border-slate-200 p-3" />
      {policy.enabled && (
        <TouchableOpacity accessibilityLabel="Lưu hạn chót" disabled={update.isPending} onPress={save} className="rounded-lg bg-primary p-3 items-center justify-center" style={[update.isPending ? { opacity: 0.5 } : undefined]} accessibilityRole="button"><Text className="text-xs font-bold text-white">Lưu hạn chót</Text></TouchableOpacity>
      )}
      <TouchableOpacity disabled={update.isPending} onPress={() => Alert.alert('Bỏ thay đổi?', 'Hạn chót đang nhập chưa được lưu.', [
        { text: 'Tiếp tục chỉnh sửa', style: 'cancel' }, { text: 'Lưu', onPress: save }, { text: 'Bỏ thay đổi', style: 'destructive', onPress: () => setEditing(false) },
      ])} className="p-3"><Text>Hủy</Text></TouchableOpacity>
    </View>}
    <DatePickerModal visible={picker} initialDate={day} onClose={() => setPicker(false)} onConfirm={(_, iso) => { setDay(iso); setPicker(false); }} />
  </View>;
}
