import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';

export type StatusDomain =
  | 'opportunity'
  | 'contract'
  | 'quotation'
  | 'project'
  | 'task'
  | 'paymentRequest'
  | 'debt'
  | 'acceptance';

export type StatusTone =
  | 'positive'
  | 'pending'
  | 'active'
  | 'negative'
  | 'warning'
  | 'neutral'
  | 'purple'
  | 'cyan'
  | 'orange';

export interface StatusConfig {
  label: string;
  tone: StatusTone;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Bảng ánh xạ trạng thái chuẩn theo docs/design-tokens.shared.md Mục 3
 */
export const STATUS_MAPPINGS: Record<StatusDomain, Record<string, StatusConfig>> = {
  opportunity: {
    OPEN: { label: 'Mới tạo', tone: 'neutral', icon: 'add-circle-outline' },
    PENDING_OPP_APPROVAL: { label: 'Chờ BOD duyệt', tone: 'pending', icon: 'time-outline' },
    OPP_REJECTED: { label: 'BOD từ chối', tone: 'negative', icon: 'close-circle' },
    OPP_APPROVED: { label: 'Cơ hội đã duyệt', tone: 'positive', icon: 'checkmark-outline' },
    QUOTATION_DRAFTING: { label: 'Đang lập báo giá', tone: 'active', icon: 'create-outline' },
    PENDING_QUOTE_APPROVAL: { label: 'Chờ duyệt báo giá', tone: 'pending', icon: 'time-outline' },
    QUOTE_APPROVED: { label: 'Báo giá đã duyệt', tone: 'positive', icon: 'checkmark-circle' },
    CONTRACT_CREATED: { label: 'Đang làm hợp đồng', tone: 'purple', icon: 'document-text-outline' },
    CONTRACT_APPROVED: { label: 'Hợp đồng đã duyệt', tone: 'positive', icon: 'checkmark-circle' },
    PROJECT_ASSIGNED: { label: 'Đã giao dự án', tone: 'cyan', icon: 'person-add-outline' },
    IMPLEMENTATION: { label: 'Đang triển khai', tone: 'orange', icon: 'play-circle-outline' },
    COMPLETED: { label: 'Hoàn tất', tone: 'positive', icon: 'checkmark-circle' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
    // Aliases
    WON: { label: 'Thành công', tone: 'positive', icon: 'checkmark-circle' },
    LOST: { label: 'Thất bại', tone: 'negative', icon: 'close-circle' },
    LEAD: { label: 'Tiềm năng', tone: 'neutral', icon: 'ellipse-outline' },
    CONTACTED: { label: 'Đã liên hệ', tone: 'active', icon: 'play-circle-outline' },
    PROPOSAL: { label: 'Đã gửi đề xuất', tone: 'pending', icon: 'time-outline' },
    NEGOTIATION: { label: 'Đang thương lượng', tone: 'purple', icon: 'time-outline' },
  },
  quotation: {
    DRAFT: { label: 'Báo giá nháp', tone: 'neutral', icon: 'document-text-outline' },
    PENDING_APPROVAL: { label: 'Chờ BOD duyệt', tone: 'pending', icon: 'time-outline' },
    PENDING: { label: 'Chờ BOD duyệt', tone: 'pending', icon: 'time-outline' },
    APPROVED: { label: 'Đã duyệt', tone: 'positive', icon: 'checkmark-circle' },
    REJECTED: { label: 'Bị từ chối', tone: 'negative', icon: 'close-circle' },
    ARCHIVED: { label: 'Đã lưu trữ', tone: 'neutral', icon: 'archive-outline' },
  },
  contract: {
    DRAFT: { label: 'Hợp đồng nháp', tone: 'neutral', icon: 'document-text-outline' },
    PENDING: { label: 'Chờ duyệt', tone: 'pending', icon: 'time-outline' },
    APPROVED: { label: 'Đã duyệt', tone: 'positive', icon: 'checkmark-circle' },
    PROPOSAL_UPLOADED: { label: 'Đã tải đề xuất', tone: 'active', icon: 'cloud-upload-outline' },
    PROPOSAL_APPROVED: { label: 'Đề xuất đã duyệt', tone: 'active', icon: 'checkmark-outline' },
    PROPOSAL_REJECTED: { label: 'Đề xuất bị từ chối', tone: 'negative', icon: 'close-circle' },
    SIGNED: { label: 'Đã ký kết', tone: 'positive', icon: 'checkmark-circle' },
    ACTIVE: { label: 'Đang thực hiện', tone: 'active', icon: 'play-circle-outline' },
    COMPLETED: { label: 'Hoàn thành', tone: 'positive', icon: 'ribbon-outline' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
  },
  project: {
    PENDING_CONFIRMATION: { label: 'Chờ Team Lead nhận', tone: 'pending', icon: 'time-outline' },
    CONFIRMED: { label: 'Đã tiếp nhận', tone: 'active', icon: 'checkmark-outline' },
    IN_PROGRESS: { label: 'Đang thực hiện', tone: 'active', icon: 'play-circle-outline' },
    PENDING_PAUSE_APPROVAL: { label: 'Chờ duyệt tạm dừng', tone: 'pending', icon: 'time-outline' },
    ON_HOLD: { label: 'Tạm dừng', tone: 'neutral', icon: 'pause-circle-outline' },
    COMPLETED: { label: 'Hoàn thành', tone: 'positive', icon: 'checkmark-circle' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
    PLANNING: { label: 'Đang lập kế hoạch', tone: 'neutral', icon: 'document-text-outline' },
    REVIEW: { label: 'Đang đánh giá', tone: 'pending', icon: 'time-outline' },
  },
  task: {
    PENDING: { label: 'Chờ phân công', tone: 'pending', icon: 'time-outline' },
    NOT_STARTED: { label: 'Chưa bắt đầu', tone: 'neutral', icon: 'ellipse-outline' },
    TODO: { label: 'Cần làm', tone: 'neutral', icon: 'ellipse-outline' },
    DOING: { label: 'Đang thực hiện', tone: 'active', icon: 'play-circle-outline' },
    IN_PROGRESS: { label: 'Đang thực hiện', tone: 'active', icon: 'play-circle-outline' },
    AWAITING_REVIEW: { label: 'Chờ duyệt nội bộ', tone: 'pending', icon: 'time-outline' },
    AWAITING_ACCEPTANCE: { label: 'Chờ khách nghiệm thu', tone: 'pending', icon: 'time-outline' },
    INTERNAL_COMPLETED: { label: 'Hoàn thành nội bộ', tone: 'active', icon: 'checkmark-outline' },
    ACCEPTED: { label: 'Đã nghiệm thu', tone: 'positive', icon: 'checkmark-circle' },
    COMPLETED: { label: 'Hoàn thành', tone: 'positive', icon: 'checkmark-circle' },
    DONE: { label: 'Hoàn thành', tone: 'positive', icon: 'checkmark-circle' },
    REWORKING: { label: 'Đang làm lại', tone: 'warning', icon: 'refresh-outline' },
    ON_HOLD: { label: 'Tạm dừng', tone: 'neutral', icon: 'pause-circle-outline' },
    OVERDUE: { label: 'Quá hạn', tone: 'negative', icon: 'warning-outline' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
    REJECTED: { label: 'Bị từ chối', tone: 'negative', icon: 'close-circle' },
    REJECTED_BILLABLE: { label: 'Từ chối (tính phí)', tone: 'negative', icon: 'close-circle' },
    REJECTED_SUPPORT: { label: 'Từ chối (hỗ trợ)', tone: 'negative', icon: 'close-circle' },
    AWAITING_PRICING: { label: 'Chờ định giá', tone: 'pending', icon: 'time-outline' },
    AWAITING_SUPPORT: { label: 'Chờ hỗ trợ', tone: 'pending', icon: 'time-outline' },
    SUPPORT_PENDING: { label: 'Chờ xử lý hỗ trợ', tone: 'pending', icon: 'time-outline' },
    SUPPORT_AWAITING_RETURN: { label: 'Chờ trả kết quả', tone: 'pending', icon: 'time-outline' },
  },
  paymentRequest: {
    DRAFT: { label: 'Nháp', tone: 'neutral', icon: 'document-text-outline' },
    PENDING_REVIEWER: { label: 'Chờ quản lý duyệt', tone: 'pending', icon: 'time-outline' },
    NEED_MORE_DOCS: { label: 'Cần bổ sung chứng từ', tone: 'warning', icon: 'alert-circle-outline' },
    PENDING_BOD: { label: 'Chờ BOD duyệt', tone: 'pending', icon: 'time-outline' },
    PENDING: { label: 'Chờ duyệt', tone: 'pending', icon: 'time-outline' },
    APPROVED: { label: 'Đã duyệt chi', tone: 'positive', icon: 'checkmark-circle' },
    REJECTED: { label: 'Bị từ chối', tone: 'negative', icon: 'close-circle' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
    WAITING: { label: 'Chưa đến hạn', tone: 'neutral', icon: 'calendar-outline' },
    DUE_SOON: { label: 'Sắp đến hạn', tone: 'warning', icon: 'warning-outline' },
    OVERDUE: { label: 'Quá hạn thanh toán', tone: 'negative', icon: 'alert-circle-outline' },
    PARTIALLY_PAID: { label: 'Đã chi một phần', tone: 'active', icon: 'pie-chart-outline' },
    PAID: { label: 'Đã chi đủ 100%', tone: 'positive', icon: 'checkmark-circle' },
  },
  debt: {
    UNPAID: { label: 'Chưa thanh toán', tone: 'pending', icon: 'time-outline' },
    PARTIAL: { label: 'Đã thu một phần', tone: 'active', icon: 'pie-chart-outline' },
    PAID: { label: 'Đã thu đủ 100%', tone: 'positive', icon: 'checkmark-circle' },
    OVERDUE: { label: 'Quá hạn thu nợ', tone: 'negative', icon: 'warning-outline' },
    LOCKED: { label: 'Đã khóa nợ', tone: 'neutral', icon: 'lock-closed-outline' },
  },
  acceptance: {
    DRAFT: { label: 'Biên bản nháp', tone: 'neutral', icon: 'document-text-outline' },
    PENDING: { label: 'Chờ duyệt', tone: 'pending', icon: 'time-outline' },
    APPROVED: { label: 'Đã duyệt', tone: 'positive', icon: 'checkmark-circle' },
    PROCESSED: { label: 'Đã xử lý', tone: 'positive', icon: 'checkmark-circle' },
    REJECTED: { label: 'Bị từ chối', tone: 'negative', icon: 'close-circle' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban-outline' },
  },
};

export const TONE_COLOR_MAP: Record<StatusTone, { bg: string; text: string; icon: string }> = {
  positive: {
    bg: BrandColors.successLight,
    text: BrandColors.successStrong,
    icon: BrandColors.successStrong,
  },
  pending: {
    bg: BrandColors.primaryLight,
    text: BrandColors.primaryOnSoft,
    icon: BrandColors.primaryOnSoft,
  },
  active: {
    bg: BrandColors.infoLight,
    text: BrandColors.infoStrong,
    icon: BrandColors.infoStrong,
  },
  negative: {
    bg: BrandColors.dangerLight,
    text: BrandColors.dangerStrong,
    icon: BrandColors.dangerStrong,
  },
  warning: {
    bg: BrandColors.warningLight,
    text: BrandColors.warningStrong,
    icon: BrandColors.warningStrong,
  },
  neutral: {
    bg: BrandColors.neutralLight,
    text: BrandColors.neutralStrong,
    icon: BrandColors.neutralStrong,
  },
  purple: {
    bg: '#F3E8FF',
    text: '#7E22CE',
    icon: '#7E22CE',
  },
  cyan: {
    bg: '#ECFEFF',
    text: '#0E7490',
    icon: '#0E7490',
  },
  orange: {
    bg: BrandColors.primarySoft,
    text: BrandColors.primaryOnSoft,
    icon: BrandColors.primaryOnSoft,
  },
};

export interface StatusBadgeProps {
  domain: StatusDomain;
  status: string;
  size?: 'sm' | 'md';
  hideIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  domain,
  status,
  size = 'md',
  hideIcon = false,
}) => {
  const domainMap = STATUS_MAPPINGS[domain] || {};
  const config = domainMap[status];

  if (!config) {
    const fallbackColor = TONE_COLOR_MAP.neutral;
    return (
      <View
        className="flex-row items-center rounded-full self-start"
        style={{
          backgroundColor: fallbackColor.bg,
          paddingVertical: size === 'sm' ? 2 : 3,
          paddingHorizontal: size === 'sm' ? 8 : 10,
        }}
      >
        {!hideIcon && (
          <Ionicons
            name="help-circle-outline"
            size={size === 'sm' ? 12 : 14}
            color={fallbackColor.icon}
            style={{ marginRight: 4 }}
          />
        )}
        <Text
          style={{
            color: fallbackColor.text,
            fontSize: size === 'sm' ? 11 : 12,
            fontWeight: '600',
          }}
        >
          {status || 'Không rõ'}
        </Text>
      </View>
    );
  }

  const { label, tone, icon } = config;
  const colors = TONE_COLOR_MAP[tone] || TONE_COLOR_MAP.neutral;

  return (
    <View
      className="flex-row items-center rounded-full self-start"
      style={{
        backgroundColor: colors.bg,
        paddingVertical: size === 'sm' ? 2 : 3,
        paddingHorizontal: size === 'sm' ? 8 : 10,
      }}
    >
      {!hideIcon && (
        <Ionicons
          name={icon}
          size={size === 'sm' ? 12 : 14}
          color={colors.icon}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={{
          color: colors.text,
          fontSize: size === 'sm' ? 11 : 12,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
};
