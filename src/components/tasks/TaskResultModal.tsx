import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { TaskDetail } from '@/services/taskService';
import { useSubmitTaskResultMutation, useSubmitTaskResultFileMutation } from '@/hooks/queries/useTasks';
import { isValidUrl, normalizeUrl } from '@/utils/validators';
import { resolveSpellCheckLinkSource } from '@/utils/spellCheckLink';
import type { ScanRegion } from '@/utils/sheetScope';
import ResultSheetSelectorPanel, { ResultCheckSource } from './ResultSheetSelectorPanel';

interface TaskResultModalProps {
  visible: boolean;
  onClose: () => void;
  task: TaskDetail | null;
  onSuccess: () => void;
}

type SubmissionType = 'file' | 'link';

interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export default function TaskResultModal({
  visible,
  onClose,
  task,
  onSuccess,
}: TaskResultModalProps) {
  const [submissionType, setSubmissionType] = useState<SubmissionType>('file');
  const [resultLink, setResultLink] = useState('');
  const [resultFile, setResultFile] = useState<PickedFile | null>(null);
  const [isCheckStage, setIsCheckStage] = useState(false);
  const [checkSource, setCheckSource] = useState<ResultCheckSource | undefined>(undefined);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [selectedScenarioLabels, setSelectedScenarioLabels] = useState<string[]>([]);
  const [customRegions, setCustomRegions] = useState<ScanRegion[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const submitResultMutation = useSubmitTaskResultMutation();
  const submitResultFileMutation = useSubmitTaskResultFileMutation();

  useEffect(() => {
    if (visible) {
      setResultFile(null);
      setResultLink('');
      setSubmissionType('file');
      setIsCheckStage(false);
      setCheckSource(undefined);
      setSelectedSheets([]);
      setSelectedScenarios([]);
      setSelectedScenarioLabels([]);
      setCustomRegions([]);
      setIsLoadingSheets(false);
      setWhitelist([]);
    }
  }, [visible, task?.id]);

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setResultFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        });
        setResultLink('');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn file.');
    }
  };

  const isReady =
    submissionType === 'file' ? Boolean(resultFile) : Boolean(resultLink.trim());

  const handleGoToCheckStage = () => {
    if (!isReady) return;

    if (submissionType === 'file' && resultFile) {
      setCheckSource({ kind: 'file', file: resultFile });
      setIsCheckStage(true);
      return;
    }

    const rawLink = resultLink.trim();
    if (!isValidUrl(rawLink)) {
      Alert.alert(
        'Đường dẫn không hợp lệ',
        'Vui lòng nhập đúng định dạng liên kết (Ví dụ: google.com hoặc https://example.com).'
      );
      return;
    }
    const normalized = normalizeUrl(rawLink);
    const { url, fileName } = resolveSpellCheckLinkSource(normalized);
    setCheckSource({ kind: 'url', fileUrl: url, fileName });
    setIsCheckStage(true);
  };

  const handleBackFromCheckStage = () => {
    setIsCheckStage(false);
    setCheckSource(undefined);
    setSelectedSheets([]);
    setSelectedScenarios([]);
    setSelectedScenarioLabels([]);
    setCustomRegions([]);
    setIsLoadingSheets(false);
    setWhitelist([]);
  };

  const handleSubmit = async () => {
    if (!task || isLoadingSheets) return;

    try {
      if (submissionType === 'file') {
        if (!resultFile) return;
        await submitResultFileMutation.mutateAsync({
          id: task.id,
          file: resultFile,
          sheetNames: selectedSheets,
          whitelist,
          scenarioIds: selectedScenarios,
          scenarioLabels: selectedScenarioLabels,
          regions: customRegions,
          draft: true,
        });
      } else {
        const rawLink = resultLink.trim();
        const url = normalizeUrl(rawLink);
        const source = checkSource?.kind === 'url' ? checkSource : undefined;
        await submitResultMutation.mutateAsync({
          id: task.id,
          payload: {
            result: { type: 'LINK', url, name: url },
            projectId: task.project?.id,
            sheetNames: selectedSheets,
            whitelist,
            scenarioIds: selectedScenarios,
            scenarioLabels: selectedScenarioLabels,
            regions: customRegions,
            checkFileUrl: source?.fileUrl,
            checkFileName: source?.fileName,
            draft: true,
          },
        });
      }

      Alert.alert('Thành công', 'Đã lưu kết quả. Bạn có thể chỉnh sửa hoặc gửi duyệt.');
      setCheckSource(undefined);
      setIsCheckStage(false);
      setSelectedSheets([]);
      setSelectedScenarios([]);
      setSelectedScenarioLabels([]);
      setCustomRegions([]);
      setWhitelist([]);
      setResultFile(null);
      setResultLink('');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi lưu kết quả.');
    }
  };

  const isPending = submitResultMutation.isPending || submitResultFileMutation.isPending;
  const submitDisabled = isPending || isLoadingSheets;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-slate-900/50 justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity className="bg-surface rounded-t-3xl max-h-[90%] pb-6" activeOpacity={1} onPress={() => {}}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <Text className="text-base font-extrabold text-text-primary">
              {isCheckStage ? 'Chọn sheet kiểm tra' : 'Gửi kết quả công việc'}
            </Text>
            <TouchableOpacity className="p-1.5 rounded-lg bg-slate-100" onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {!isCheckStage ? (
            <>
              <View className="flex-row p-1.5 bg-slate-100 mx-5 mt-3.5 rounded-xl gap-1">
                <TouchableOpacity
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg ${
                    submissionType === 'file' ? 'bg-surface shadow-xs' : ''
                  }`}
                  onPress={() => setSubmissionType('file')}
                >
                  <Feather
                    name="upload"
                    size={14}
                    color={submissionType === 'file' ? '#F38820' : '#64748B'}
                  />
                  <Text
                    className={`text-xs ${
                      submissionType === 'file' ? 'font-bold text-primary' : 'font-semibold text-slate-500'
                    }`}
                  >
                    Tải file
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg ${
                    submissionType === 'link' ? 'bg-surface shadow-xs' : ''
                  }`}
                  onPress={() => setSubmissionType('link')}
                >
                  <Feather
                    name="link"
                    size={14}
                    color={submissionType === 'link' ? '#F38820' : '#64748B'}
                  />
                  <Text
                    className={`text-xs ${
                      submissionType === 'link' ? 'font-bold text-primary' : 'font-semibold text-slate-500'
                    }`}
                  >
                    Gửi link
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
                {submissionType === 'file' && (
                  <View className="gap-3">
                    <TouchableOpacity
                      className="border-2 border-dashed border-slate-300 rounded-2xl p-6 items-center bg-background gap-2"
                      onPress={handlePickFile}
                    >
                      <View className="w-11 h-11 rounded-full bg-primary-light items-center justify-center">
                        <Feather name="upload-cloud" size={24} color="#F38820" />
                      </View>
                      <Text className="text-sm font-bold text-text-primary text-center">
                        {resultFile ? resultFile.name : 'Nhấn để chọn file kết quả'}
                      </Text>
                      <Text className="text-xs text-slate-400 text-center">Chấp nhận file hình ảnh, PDF, Word, Excel...</Text>
                    </TouchableOpacity>

                    {resultFile && (
                      <Text className="text-[10px] text-blue-500 font-bold text-center">
                        File sẽ được kiểm tra chính tả trước khi nộp
                      </Text>
                    )}

                    {resultFile && (
                      <TouchableOpacity
                        className="flex-row items-center justify-center gap-1.5 py-1.5"
                        onPress={() => setResultFile(null)}
                      >
                        <Feather name="trash-2" size={13} color="#EF4444" />
                        <Text className="text-xs font-bold text-danger">Gỡ bỏ file đã chọn</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {submissionType === 'link' && (
                  <View className="gap-3">
                    <Text className="text-[10px] font-extrabold text-slate-500 tracking-wider mb-1">ĐƯỜNG DẪN KẾT QUẢ *</Text>
                    <View className="flex-row items-center bg-background border border-border rounded-xl px-3">
                      <Feather name="link" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                      <TextInput
                        className="flex-1 py-3 text-sm text-text-primary"
                        placeholder="https://drive.google.com/..."
                        placeholderTextColor="#94A3B8"
                        value={resultLink}
                        onChangeText={setResultLink}
                        autoCapitalize="none"
                      />
                    </View>
                    <Text className="text-xs text-slate-400 italic">
                      * Vui lòng đảm bảo quyền truy cập link cho quản lý và khách hàng. Link phải cho phép tải file trực tiếp để kiểm tra chính tả.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View className="flex-row gap-3 px-5 pt-3">
                <TouchableOpacity
                  className="flex-1 py-3.5 rounded-xl border border-border items-center bg-surface"
                  onPress={onClose}
                >
                  <Text className="text-sm font-bold text-slate-500">Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-3.5 rounded-xl bg-primary items-center ${!isReady ? 'opacity-50' : ''}`}
                  onPress={handleGoToCheckStage}
                  disabled={!isReady}
                >
                  <Text className="text-sm font-bold text-white">Tiếp tục</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
                <View className="p-3 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
                  <Text className="text-sm font-bold text-blue-800">Chọn sheet để kiểm tra chính tả & QC</Text>
                  <Text className="text-xs text-blue-600 mt-1">
                    Kết quả được lưu nháp, việc quét chạy khi bạn bấm Gửi duyệt.
                  </Text>
                </View>

                <ResultSheetSelectorPanel
                  source={checkSource}
                  projectId={task?.project?.id}
                  selectedSheets={selectedSheets}
                  onSelectedSheetsChange={setSelectedSheets}
                  selectedScenarios={selectedScenarios}
                  onSelectedScenariosChange={setSelectedScenarios}
                  onSelectedScenarioLabelsChange={setSelectedScenarioLabels}
                  customRegions={customRegions}
                  onCustomRegionsChange={setCustomRegions}
                  whitelist={whitelist}
                  onWhitelistChange={setWhitelist}
                  onLoadingChange={setIsLoadingSheets}
                />
              </ScrollView>

              <View className="flex-row gap-3 px-5 pt-3">
                <TouchableOpacity
                  className="flex-1 py-3.5 rounded-xl border border-border items-center bg-surface"
                  onPress={handleBackFromCheckStage}
                  disabled={isPending}
                >
                  <Text className="text-sm font-bold text-slate-500">Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-3.5 rounded-xl bg-primary items-center ${submitDisabled ? 'opacity-50' : ''}`}
                  onPress={handleSubmit}
                  disabled={submitDisabled}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-bold text-white">
                      {isLoadingSheets ? 'Đang đọc sheet...' : 'Lưu kết quả'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
