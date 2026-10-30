import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  JOB_LEVEL_OPTIONS, JOB_RESPONSIBLE_ROLE_LABELS, JobLevel, JobResponsibleRole,
} from '@/utils/jobMetadata';

interface Props {
  level: JobLevel;
  responsibleRole: JobResponsibleRole | null;
  description: string;
  sampleDocumentUrl: string;
  onLevelChange: (value: JobLevel) => void;
  onRoleChange: (value: JobResponsibleRole | null) => void;
  onDescriptionChange: (value: string) => void;
  onUrlChange: (value: string) => void;
}

const roleOptions: { value: JobResponsibleRole | null; label: string }[] = [
  { value: null, label: 'Chưa chọn' },
  ...Object.entries(JOB_RESPONSIBLE_ROLE_LABELS).map(([value, label]) => ({ value: value as JobResponsibleRole, label })),
];

export default function JobMetadataFields(props: Props) {
  return (
    <View className="gap-3">
      <Text className="text-xs font-bold text-slate-700">Cấp độ</Text>
      <View className="flex-row gap-2">
        {JOB_LEVEL_OPTIONS.map((value) => (
          <TouchableOpacity
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === props.level }}
            accessibilityLabel={'Cấp độ ' + value}
            className={'min-h-[48px] flex-1 items-center justify-center rounded-xl border ' +
              (value === props.level ? 'bg-primary border-primary' : 'border-slate-200')}
            onPress={() => props.onLevelChange(value)}
          >
            <Text className={value === props.level ? 'text-white font-bold' : 'text-slate-700'}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-xs font-bold text-slate-700">Phụ trách</Text>
      <View className="flex-row flex-wrap gap-2">
        {roleOptions.map(({ value, label }) => (
          <TouchableOpacity
            key={value ?? 'none'}
            accessibilityRole="radio"
            accessibilityState={{ checked: props.responsibleRole === value }}
            className={'min-h-[48px] justify-center px-3 rounded-xl border ' +
              (props.responsibleRole === value ? 'border-primary bg-orange-50' : 'border-slate-200')}
            onPress={() => props.onRoleChange(value)}
          >
            <Text className="text-sm text-slate-700">{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-xs font-bold text-slate-700">Tài liệu mẫu (Link)</Text>
      <TextInput
        accessibilityLabel="Tài liệu mẫu (Link)"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        className="min-h-[48px] border border-slate-200 rounded-xl p-3 text-slate-900"
        placeholder="https://..."
        value={props.sampleDocumentUrl}
        onChangeText={props.onUrlChange}
      />
      <Text className="text-xs font-bold text-slate-700">Mô tả công việc</Text>
      <TextInput
        accessibilityLabel="Mô tả công việc"
        multiline
        textAlignVertical="top"
        className="min-h-[100px] border border-slate-200 rounded-xl p-3 text-slate-900"
        value={props.description}
        onChangeText={props.onDescriptionChange}
      />
      <Text className="text-xs text-slate-500">{props.description.length}/5000 ký tự</Text>
    </View>
  );
}
