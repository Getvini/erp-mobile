import React, { useRef, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useCreateTaskMutation } from '@/hooks/queries/useTasks';
import { useProjectDetailQuery } from '@/hooks/queries/useProjects';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import { useAuthStore } from '@/stores/useAuthStore';
import { canCreateProjectTask } from '@/utils/taskOutcomeAuthorization';
import { createExtraTaskBatch, validateExtraTaskRows, ExtraTaskRow } from '@/utils/extraTaskCreation';

interface Props { visible: boolean; onClose: () => void; projectId: string; onSuccess: () => void }

// This legacy modal intentionally has no new project-screen entry point.
export default function AddExtraTaskModal({ visible, onClose, projectId, onSuccess }: Props) {
  const user = useAuthStore((state) => state.user);
  const projectQuery = useProjectDetailQuery(visible ? projectId : '');
  const jobsQuery = useJobsQuery({}, { enabled: visible });
  const create = useCreateTaskMutation();
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<ExtraTaskRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [createdCount, setCreatedCount] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const [errorText, setErrorText] = useState('');
  const loading = projectQuery.isFetching || jobsQuery.isFetching;
  const failed = projectQuery.isError || jobsQuery.isError;
  const allowed = !loading && !failed && canCreateProjectTask(projectQuery.data, { id: user?.id, role: user?.role });
  const jobs = (jobsQuery.data || []).filter((job) => !rows.some((row) => row.jobId === job.id) &&
    (job.name + ' ' + (job.code || '')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const inputClass = 'min-h-[48px] border border-slate-200 rounded-xl p-3 text-slate-900';
  const close = () => {
    if (busy.current) return;
    if (uncertain) Alert.alert('Cần đối chiếu công việc', 'Có request chưa được xác nhận. Kiểm tra danh sách trước khi tạo lại.', [
      { text: 'Ở lại', style: 'cancel' }, { text: 'Đóng', onPress: onClose },
    ]);
    else onClose();
  };
  const submit = async () => {
    if (busy.current || !allowed || uncertain) return;
    const validation = validateExtraTaskRows(rows);
    if (validation) { Alert.alert('Chưa hợp lệ', validation); return; }
    if (plannedEndDate && (!/^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate) ||
      !Number.isFinite(Date.parse(plannedEndDate)) || new Date(plannedEndDate).toISOString().slice(0, 10) !== plannedEndDate)) {
      Alert.alert('Chưa hợp lệ', 'Hạn chót cần là ngày hợp lệ theo YYYY-MM-DD.'); return;
    }
    busy.current = true; setSubmitting(true); setErrorText('');
    let completed = 0;
    try {
      await createExtraTaskBatch(rows, { projectId, description: description.trim() || undefined,
        plannedEndDate: plannedEndDate || undefined }, (payload) => create.mutateAsync(payload), (remaining, created) => {
        completed = created;
        setRows(remaining);
        setQuantities(Object.fromEntries(remaining.map((row) => [row.jobId, String(row.quantity)])));
        setCreatedCount(createdCount + created);
      });
      setDescription(''); setPlannedEndDate(''); setCreatedCount(0);
      Alert.alert('Thành công', 'Đã thêm ' + (createdCount + completed) + ' công việc phát sinh, chờ định giá.');
      onSuccess(); onClose();
    } catch (error) {
      setUncertain(true);
      setErrorText('Đã xác nhận tạo ' + (createdCount + completed) + ' công việc. ' +
        (error instanceof Error ? error.message : 'Không thể tạo tiếp.') +
        ' Phần chưa xác nhận được giữ lại. Cần đối chiếu danh sách trước khi tiếp tục.');
      if (completed) onSuccess();
    } finally { busy.current = false; setSubmitting(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView className="flex-1 bg-black/50 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="max-h-[90%] bg-white rounded-t-3xl">
          <View className="p-4 border-b border-slate-100"><Text className="text-lg font-bold text-slate-900">Thêm công việc phát sinh</Text></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
            {loading ? <ActivityIndicator /> : failed ? <TouchableOpacity className="min-h-[48px] justify-center" onPress={() => { projectQuery.refetch(); jobsQuery.refetch(); }}><Text className="text-red-600">Không tải được dự án/hạng mục. Bấm thử lại.</Text></TouchableOpacity> :
              !allowed ? <Text className="text-red-600">Bạn không có quyền hoặc dự án chưa đủ điều kiện tạo công việc.</Text> : null}
            {rows.map((row) => <View key={row.jobId} className="border border-slate-200 rounded-xl p-3 gap-2">
              <Text className="font-bold text-slate-900">{row.name}</Text>
              <Text className="text-xs text-slate-600">Số lượng</Text>
              <TextInput accessibilityLabel={'Số lượng ' + row.name} className={inputClass} keyboardType="number-pad" value={quantities[row.jobId] ?? String(row.quantity)} editable={!submitting} onChangeText={(value) => {
                setQuantities((previous) => ({ ...previous, [row.jobId]: value }));
                setRows((previous) => previous.map((item) => item.jobId === row.jobId ? { ...item, quantity: Number(value) } : item));
              }} />
              <TouchableOpacity disabled={submitting} className="min-h-[48px] justify-center" onPress={() => setRows((previous) => previous.filter((item) => item.jobId !== row.jobId))}><Text className="text-red-600">Gỡ hạng mục</Text></TouchableOpacity>
            </View>)}
            <Text className="font-bold text-slate-700">Chọn hạng mục có sẵn</Text>
            <TextInput accessibilityLabel="Tìm hạng mục phát sinh" value={search} onChangeText={setSearch} editable={!submitting} placeholder="Tìm tên / mã hạng mục" className={inputClass} />
            {!loading && !failed && !jobs.length ? <Text className="text-slate-500">Không còn hạng mục phù hợp.</Text> : null}
            {jobs.map((job) => <TouchableOpacity key={job.id} disabled={!allowed || submitting} className="min-h-[48px] justify-center border-b border-slate-100" onPress={() => setRows((previous) => previous.some((row) => row.jobId === job.id) ? previous : [...previous, { jobId: job.id, name: job.name, quantity: 1 }])}><Text className="text-primary">+ {job.code ? job.code + ' · ' : ''}{job.name}</Text></TouchableOpacity>)}
            <Text className="text-xs font-bold text-slate-600">Mô tả công việc</Text>
            <TextInput accessibilityLabel="Mô tả công việc phát sinh" multiline value={description} onChangeText={setDescription} editable={!submitting} className={inputClass} />
            <Text className="text-xs font-bold text-slate-600">Hạn chót (YYYY-MM-DD)</Text>
            <TextInput accessibilityLabel="Hạn chót công việc phát sinh" value={plannedEndDate} onChangeText={setPlannedEndDate} editable={!submitting} placeholder="2026-10-30" className={inputClass} />
            {!!errorText && <Text accessibilityRole="alert" className="text-red-600">{errorText}</Text>}
            {uncertain ? <TouchableOpacity disabled={submitting} className="min-h-[48px] justify-center" onPress={() => Alert.alert('Đã đối chiếu danh sách?', 'Chỉ tiếp tục với số lượng còn thiếu. Nếu task của request lỗi đã tồn tại, giảm số lượng hoặc gỡ dòng tương ứng trước khi gửi.', [{ text: 'Chưa', style: 'cancel' }, { text: 'Đã đối chiếu', onPress: () => setUncertain(false) }])}><Text className="font-bold text-primary">Xác nhận đã đối chiếu để tiếp tục</Text></TouchableOpacity> : null}
          </ScrollView>
          <View className="flex-row gap-3 p-4 border-t border-slate-100">
            <TouchableOpacity disabled={submitting} className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-slate-100" onPress={close}><Text className="font-bold text-slate-600">Đóng</Text></TouchableOpacity>
            <TouchableOpacity disabled={!allowed || submitting || uncertain || !rows.length} className="min-h-[48px] flex-1 justify-center items-center rounded-xl bg-primary" onPress={submit}>{submitting ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">{createdCount ? 'Tạo phần còn lại' : 'Tạo công việc'}</Text>}</TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}