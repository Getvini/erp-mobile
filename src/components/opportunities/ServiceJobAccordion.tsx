import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatVND } from '@/utils/formatters';

export interface ServiceJobTaskItem {
  id: string;
  status: string;
  customerDecision?: 'APPROVED' | 'NOT_PURCHASED' | null;
  result?: {
    url?: string;
    name?: string;
    note?: string;
  };
  nickname?: string;
  name?: string;
}

export interface ServiceJobItem {
  id?: string;
  jobId?: string;
  serviceId?: string;
  name?: string;
  quantity?: number | string | null;
  unit?: string | null;
  costPrice?: number | string | null;
  costAtSale?: number | string | null;
  isBriefVideo?: boolean;
  isQuotationItem?: boolean;
  isOutput?: boolean;
  included?: boolean;
  briefVideo?: string;
  tasks?: ServiceJobTaskItem[];
  job?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    unit?: string | null;
    costPrice?: number | string | null;
    isBriefVideo?: boolean;
  } | null;
}

export type ServiceJobAccordionMode =
  | 'opportunity_create'
  | 'opportunity_view'
  | 'quotation_edit'
  | 'quotation_view'
  | 'contract_view'
  | 'catalog_view';

export interface ServiceJobAccordionProps {
  jobs?: ServiceJobItem[];
  mode?: ServiceJobAccordionMode;
  serviceIndex?: number;
  onJobIncludedChange?: (jobId: string, included: boolean) => void;
  onJobBriefChange?: (jobId: string, briefVideo: string) => void;
  defaultExpanded?: boolean;
  canHandleDemo?: boolean;
  onPreviewVideo?: (url: string, name?: string) => void;
  onApproveDemo?: (taskId: string) => void;
  onRejectDemo?: (taskId: string) => void;
  onRequestRework?: (task: ServiceJobTaskItem) => void;
  isApprovingDemo?: boolean;
  isRejectingDemo?: boolean;
}

export const ServiceJobAccordion: React.FC<ServiceJobAccordionProps> = ({
  jobs = [],
  mode = 'quotation_view',
  onJobIncludedChange,
  onJobBriefChange,
  defaultExpanded = false,
  canHandleDemo = false,
  onPreviewVideo,
  onApproveDemo,
  onRejectDemo,
  onRequestRework,
  isApprovingDemo = false,
  isRejectingDemo = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const handleToggle = () => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Haptics optional fallback
    }
    setIsOpen(!isOpen);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleToggle}
        style={styles.headerButton}
        accessibilityRole="button"
        accessibilityLabel={`Hạng mục công việc, ${jobs.length} mục`}
      >
        <View style={styles.headerTitleRow}>
          <Feather
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#D97010"
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
            const qty = Number(job.quantity) || 1;
            const cost = Number(job.costAtSale ?? job.costPrice ?? job.job?.costPrice ?? 0);
            const isBriefVideo = Boolean(job.isBriefVideo || job.job?.isBriefVideo);
            const isNotQuotation = isBriefVideo || job.isQuotationItem === false;
            const isIncluded = Boolean(job.included);

            const approvedResults = (job.tasks || []).filter(
              (task) =>
                ['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED'].includes(task.status) &&
                Boolean(task.result?.url)
            );

            return (
              <View key={jobId} style={styles.jobCard}>
                <View style={styles.jobMainRow}>
                  <Feather name="corner-down-right" size={14} color="#F38820" style={styles.treeIcon} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.jobTitleBadgeRow}>
                      <Text style={styles.jobNameText}>{jobName}</Text>
                      {isNotQuotation && (mode === 'quotation_edit' || mode === 'quotation_view') && (
                        <View style={styles.nonQuoteBadge}>
                          <Text style={styles.nonQuoteBadgeText}>Không tính báo giá</Text>
                        </View>
                      )}
                      {isBriefVideo && mode === 'opportunity_view' && (
                        <View style={styles.nonQuoteBadge}>
                          <Text style={styles.nonQuoteBadgeText}>Video AI demo</Text>
                        </View>
                      )}
                    </View>

                    {job.briefVideo && mode === 'opportunity_view' ? (
                      <Text style={styles.briefPreviewText}>
                        Brief: {job.briefVideo}
                      </Text>
                    ) : null}

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

                {/* Mode opportunity_view: Khối kết quả Video AI Demo & Các nút duyệt */}
                {mode === 'opportunity_view' && isBriefVideo && approvedResults.length > 0 && (
                  <View style={styles.demoSection}>
                    <View style={styles.demoSectionHeader}>
                      <Feather name="check-circle" size={13} color="#059669" />
                      <Text style={styles.demoSectionHeaderText}>
                        Kết quả Video AI demo đã được xác nhận
                      </Text>
                    </View>

                    {approvedResults.map((task) => (
                      <View key={task.id} style={styles.demoTaskCard}>
                        <View style={styles.demoTaskTitleRow}>
                          <Text style={styles.demoTaskName} numberOfLines={1}>
                            {task.result?.name || task.nickname || task.name || 'Video AI demo'}
                          </Text>
                          {task.result?.url ? (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() =>
                                onPreviewVideo?.(
                                  task.result!.url!,
                                  task.result?.name || task.nickname || task.name
                                )
                              }
                              style={styles.openVideoBtn}
                            >
                              <Text style={styles.openVideoText}>Xem video</Text>
                              <Feather name="external-link" size={12} color="#EA580C" />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {task.result?.note ? (
                          <Text style={styles.demoTaskNote}>{task.result.note}</Text>
                        ) : null}

                        {task.customerDecision === 'APPROVED' && (
                          <View style={styles.decisionApprovedBadge}>
                            <Feather name="check" size={12} color="#059669" />
                            <Text style={styles.decisionApprovedText}>Khách hàng đã duyệt mua</Text>
                          </View>
                        )}

                        {task.customerDecision === 'NOT_PURCHASED' && (
                          <View style={styles.decisionRejectedBadge}>
                            <Feather name="slash" size={12} color="#D97706" />
                            <Text style={styles.decisionRejectedText}>Khách hàng không mua</Text>
                          </View>
                        )}

                        {task.status === 'INTERNAL_COMPLETED' &&
                          !task.customerDecision &&
                          canHandleDemo && (
                            <View style={styles.demoActionsRow}>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => onApproveDemo?.(task.id)}
                                disabled={isApprovingDemo || isRejectingDemo}
                                style={[styles.demoBtn, styles.demoBtnApprove]}
                              >
                                <Feather name="check" size={12} color="#FFFFFF" />
                                <Text style={styles.demoBtnApproveText}>Khách duyệt</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => onRejectDemo?.(task.id)}
                                disabled={isApprovingDemo || isRejectingDemo}
                                style={[styles.demoBtn, styles.demoBtnReject]}
                              >
                                <Feather name="x" size={12} color="#B45309" />
                                <Text style={styles.demoBtnRejectText}>Không mua</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => onRequestRework?.(task)}
                                disabled={isApprovingDemo || isRejectingDemo}
                                style={[styles.demoBtn, styles.demoBtnRework]}
                              >
                                <Feather name="rotate-ccw" size={12} color="#7C3AED" />
                                <Text style={styles.demoBtnReworkText}>Làm lại</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                      </View>
                    ))}
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
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    minHeight: 40,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97010',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleHintText: {
    fontSize: 11,
    color: '#F38820',
    fontWeight: '600',
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
  briefPreviewText: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 3,
    fontStyle: 'italic',
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
    backgroundColor: '#F38820',
    borderColor: '#F38820',
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
  demoSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  demoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  demoSectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  demoTaskCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 8,
    marginBottom: 6,
  },
  demoTaskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  demoTaskName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  openVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  openVideoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  demoTaskNote: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  decisionApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  decisionApprovedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  decisionRejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  decisionRejectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  demoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  demoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 34,
  },
  demoBtnApprove: {
    backgroundColor: '#16A34A',
  },
  demoBtnApproveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  demoBtnReject: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  demoBtnRejectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  demoBtnRework: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  demoBtnReworkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
