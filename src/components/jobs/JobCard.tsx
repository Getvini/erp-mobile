import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Job,
  JOB_CATEGORY_COLORS,
  JOB_CATEGORY_LABELS,
  JOB_PERFORMER_TYPE_LABELS,
  toJobNumber,
} from '@/services/jobService';
import { formatVND } from '@/utils/formatters';

interface JobCardProps {
  job: Job;
  onPress: () => void;
}

const DEFAULT_CATEGORY_COLOR = { color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' };

/**
 * Thẻ HẠNG MỤC CÔNG VIỆC (Jobs) — dùng cho danh sách `/jobs`.
 * Hiển thị: mã, tên, badge category, giá vốn, vinicoin (>0), thời gian hoàn thành (giờ),
 * badge "Video AI" khi `isBriefVideo`.
 */
function JobCardComponent({ job, onPress }: JobCardProps) {
  const categories = Array.isArray(job.categories) ? job.categories : [];
  const costPrice = toJobNumber(job.costPrice);
  const vinicoin = toJobNumber(job.vinicoin);
  const hours = toJobNumber(job.timeToComplete);
  const criteriaCount = Array.isArray(job.criteria) ? job.criteria.length : 0;
  const performerLabel = JOB_PERFORMER_TYPE_LABELS[job.defaultPerformerType || 'INTERNAL'];

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]"
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* Header: mã hạng mục + badge AI/Video AI */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-1.5 flex-1">
          <View className="flex-row items-center gap-1 bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
            <Feather name="hash" size={12} color="#2563EB" />
            <Text className="text-xs font-bold text-[#2563EB]">{job.code || '—'}</Text>
          </View>

          {job.isBriefVideo ? (
            <View className="flex-row items-center gap-1 bg-[#ECFEFF] px-2 py-0.5 rounded-md border border-[#A5F3FC]">
              <Feather name="zap" size={12} color="#0E7490" />
              <Text className="text-[11px] font-bold text-[#0E7490]">Video AI</Text>
            </View>
          ) : null}
        </View>

        {criteriaCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Feather name="check-square" size={12} color="#94A3B8" />
            <Text className="text-[11px] font-semibold text-[#94A3B8]">{criteriaCount} tiêu chí</Text>
          </View>
        ) : null}
      </View>

      {/* Tên hạng mục */}
      <Text className="text-[15px] font-bold text-[#0F172A] leading-5 mb-1.5" numberOfLines={2}>
        {job.name || 'Hạng mục công việc'}
      </Text>

      {job.nickname ? (
        <Text className="text-xs text-[#64748B] mb-2" numberOfLines={1}>
          Biệt danh: {job.nickname}
        </Text>
      ) : null}

      {/* Badge category */}
      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {categories.length > 0 ? (
          categories.map((category) => {
            const meta = JOB_CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
            return (
              <View
                key={category}
                className="px-2 py-0.5 rounded-md border"
                style={{ backgroundColor: meta.bg, borderColor: meta.border }}
              >
                <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
                  {JOB_CATEGORY_LABELS[category] || category}
                </Text>
              </View>
            );
          })
        ) : (
          <Text className="text-[11px] italic text-[#94A3B8]">Chưa xác định category</Text>
        )}
      </View>

      {/* Footer: giá vốn / vinicoin / thời gian hoàn thành */}
      <View className="flex-row justify-between items-end pt-2.5 border-t border-[#F1F5F9]">
        <View className="flex-1">
          <Text className="text-[11px] text-[#64748B] mb-0.5">Giá vốn</Text>
          <Text className="text-[15px] font-extrabold text-primary">{formatVND(costPrice)}</Text>
          {vinicoin > 0 ? (
            <View className="flex-row items-center gap-1 mt-1">
              <Feather name="award" size={12} color="#D97706" />
              <Text className="text-[11px] font-bold text-[#D97706]">
                {vinicoin} Vinicoin
              </Text>
            </View>
          ) : null}
        </View>

        <View className="items-end gap-1.5">
          <View className="flex-row items-center gap-1">
            <Feather name="clock" size={13} color="#64748B" />
            <Text className="text-xs font-semibold text-[#334155]">
              {hours > 0 ? `${hours} giờ` : 'Chưa đặt thời gian'}
            </Text>
          </View>
          {performerLabel ? (
            <View className="flex-row items-center gap-1">
              <Feather name={job.defaultPerformerType === 'VENDOR' ? 'truck' : 'users'} size={13} color="#64748B" />
              <Text className="text-xs text-[#64748B]">{performerLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const JobCard = React.memo(JobCardComponent);
export default JobCard;
