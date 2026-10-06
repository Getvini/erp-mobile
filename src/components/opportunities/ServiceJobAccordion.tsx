import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatVND } from '@/utils/formatters';

export interface ServiceJobItem {
  id?: string;
  jobId?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  costPrice?: number;
  costAtSale?: number;
  isBriefVideo?: boolean;
  isQuotationItem?: boolean;
  included?: boolean;
  briefVideo?: string;
  job?: {
    id?: string;
    name?: string;
    unit?: string;
    costPrice?: number;
    isBriefVideo?: boolean;
  };
}

export type ServiceJobAccordionMode = 'opportunity_create' | 'quotation_edit' | 'quotation_view';

interface ServiceJobAccordionProps {
  jobs?: ServiceJobItem[];
  mode?: ServiceJobAccordionMode;
  serviceIndex?: number;
  onJobIncludedChange?: (jobId: string, included: boolean) => void;
  onJobBriefChange?: (jobId: string, briefVideo: string) => void;
  defaultExpanded?: boolean;
}

export const ServiceJobAccordion: React.FC<ServiceJobAccordionProps> = ({
  jobs = [],
  mode = 'quotation_view',
  onJobIncludedChange,
  onJobBriefChange,
  defaultExpanded = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.headerButton}
      >
        <View style={styles.headerTitleRow}>
          <Feather
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#4F46E5"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.headerTitleText}>
            Hạng mục ({jobs.length})
          </Text>
        </View>
        <Text style={styles.toggleHintText}>
          {isOpen ? 'Thu gọn' : 'Chi tiết'}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.jobsListContainer}>
          {jobs.map((job, index) => {
            const jobId = job.jobId || job.id || job.job?.id || `job-${index}`;
            const jobName = job.name || job.job?.name || 'Hạng mục con';
            const unitStr = job.unit || job.job?.unit || '';
            const qty = job.quantity ?? 1;
            const cost = job.costAtSale ?? job.costPrice ?? job.job?.costPrice ?? 0;
            const isBriefVideo = Boolean(job.isBriefVideo || job.job?.isBriefVideo);
            const isNotQuotation = isBriefVideo || job.isQuotationItem === false;
            const isIncluded = Boolean(job.included);

            return (
              <View key={jobId} style={styles.jobCard}>
                <View style={styles.jobMainRow}>
                  <Feather name="corner-down-right" size={14} color="#6366F1" style={styles.treeIcon} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.jobTitleBadgeRow}>
                      <Text style={styles.jobNameText}>{jobName}</Text>
                      {isNotQuotation && (mode === 'quotation_edit' || mode === 'quotation_view') && (
                        <View style={styles.nonQuoteBadge}>
                          <Text style={styles.nonQuoteBadgeText}>Không tính báo giá</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.jobMetaRow}>
                      <Text style={styles.jobMetaText}>
                        {qty} {unitStr ? unitStr : 'Đơn vị'}
                      </Text>
                      {cost > 0 && (
                        <Text style={styles.jobCostText}>
                          Giá vốn: {formatVND(cost)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Mode opportunity_create: Checkbox Video AI demo & Brief Input */}
                {mode === 'opportunity_create' && isBriefVideo && (
                  <View style={styles.briefSection}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => onJobIncludedChange?.(jobId, !isIncluded)}
                      style={styles.checkboxRow}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isIncluded }}
                      accessibilityLabel={`Thêm hạng mục video demo ${jobName}`}
                    >
                      <View style={[styles.checkbox, isIncluded && styles.checkboxChecked]}>
                        {isIncluded && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.checkboxLabel}>Thêm hạng mục video demo này</Text>
                    </TouchableOpacity>

                    {isIncluded && (
                      <View style={styles.inputBox}>
                        <Text style={styles.inputLabel}>Brief cho {jobName} *</Text>
                        <TextInput
                          style={styles.textArea}
                          multiline
                          numberOfLines={3}
                          placeholder="Nhập nội dung brief chi tiết cho video demo..."
                          placeholderTextColor="#94A3B8"
                          value={job.briefVideo || ''}
                          onChangeText={(text) => onJobBriefChange?.(jobId, text)}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FF',
    paddingTop: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleHintText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '500',
  },
  jobsListContainer: {
    marginTop: 8,
  },
  jobCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 6,
  },
  jobMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  treeIcon: {
    marginRight: 6,
    marginTop: 3,
  },
  jobTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  jobNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  nonQuoteBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  nonQuoteBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  jobMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  jobMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  jobCostText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  briefSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 44,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  inputBox: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 60,
  },
});
