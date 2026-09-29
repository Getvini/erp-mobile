import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { JobCriteriaInput } from '@/services/jobService';
import { BrandColors } from '@/constants/colors';

interface JobCriteriaEditorProps {
  /** Danh sách tiêu chí hiện tại (giữ `id` của tiêu chí cũ để tránh bị soft-delete khi sync). */
  criteria: JobCriteriaInput[];
  /** Trả về mảng `[{ id?, name, description }]` cho form cha. */
  onChange: (criteria: JobCriteriaInput[]) => void;
  /** Bật hiển thị lỗi "Tên tiêu chí không được để trống" (form cha bật khi submit lỗi). */
  showErrors?: boolean;
}

/**
 * Trình soạn TIÊU CHÍ ĐÁNH GIÁ (Job Criteria) dùng trong JobFormModal.
 * - Giữ nguyên `id` của dòng cũ (bắt buộc: PUT /job-criteria/job/:jobId là replace-toàn-bộ).
 * - Validate tên không rỗng.
 */
export default function JobCriteriaEditor({
  criteria,
  onChange,
  showErrors = false,
}: JobCriteriaEditorProps) {
  const rows = Array.isArray(criteria) ? criteria : [];

  const handleAdd = () => {
    onChange([...rows, { name: '', description: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(rows.filter((_, idx) => idx !== index));
  };

  const handlePatch = (index: number, patch: Partial<JobCriteriaInput>) => {
    onChange(rows.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  return (
    <View className="border-t border-[#F1F5F9] pt-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2 flex-1">
          <Feather name="clipboard" size={16} color={BrandColors.primary} />
          <Text className="text-xs font-bold text-[#334155] uppercase">Tiêu chí đánh giá</Text>
        </View>

        <TouchableOpacity
          className="flex-row items-center gap-1.5 bg-[#FFF4EA] border border-[#FDCB9E] px-3 rounded-xl min-h-[48px]"
          onPress={handleAdd}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={15} color={BrandColors.primary} />
          <Text className="text-[13px] font-bold text-primary">Thêm tiêu chí</Text>
        </TouchableOpacity>
      </View>

      {rows.length === 0 ? (
        <View className="items-center justify-center py-6 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
          <Feather name="check-square" size={22} color="#CBD5E1" />
          <Text className="text-xs italic text-[#94A3B8] mt-2">
            Chưa có tiêu chí nào. Nhấn &quot;Thêm tiêu chí&quot; để bắt đầu.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {rows.map((row, index) => {
            const isNameInvalid = showErrors && !String(row.name || '').trim();
            const rowKey = row.id ? `criteria-${row.id}` : `criteria-new-${index}`;

            return (
              <View
                key={rowKey}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-[#64748B] mb-1">
                      Tiêu chí {index + 1} <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      className={
                        'bg-white border rounded-xl px-3 py-2.5 text-sm text-[#0F172A] min-h-[48px] ' +
                        (isNameInvalid ? 'border-red-400' : 'border-[#E2E8F0]')
                      }
                      placeholder="Tên tiêu chí"
                      placeholderTextColor="#94A3B8"
                      value={row.name}
                      onChangeText={(value) => handlePatch(index, { name: value })}
                    />
                    {isNameInvalid ? (
                      <Text className="text-[11px] font-semibold text-red-500 mt-1">
                        Tên tiêu chí không được để trống
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    className="w-12 h-12 items-center justify-center rounded-xl bg-white border border-[#E2E8F0] mt-5"
                    onPress={() => handleRemove(index)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Xóa tiêu chí ${index + 1}`}
                  >
                    <Feather name="trash-2" size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <Text className="text-[11px] font-bold text-[#64748B] mb-1 mt-3">Mô tả tiêu chí</Text>
                <TextInput
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] min-h-[48px]"
                  placeholder="Mô tả chi tiết nội dung cần đánh giá..."
                  placeholderTextColor="#94A3B8"
                  value={String(row.description || '')}
                  onChangeText={(value) => handlePatch(index, { description: value })}
                  multiline
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
