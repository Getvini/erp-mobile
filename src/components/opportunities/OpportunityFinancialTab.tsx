import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getEditableOpportunityJobs,
  getVisibleOpportunityJobs,
  OpportunityItem,
} from '@/services/opportunityService';
import { formatVND } from '@/utils/formatters';
import { useUpdateOpportunityServiceMutation } from '@/hooks/queries/useOpportunities';
import {
  useApproveByCustomerMutation,
  useCustomerNotPurchaseMutation,
} from '@/hooks/queries/useTasks';
import ReworkTaskModal from '@/components/tasks/ReworkTaskModal';

export interface OpportunityFinancialTabProps {
  opportunity: OpportunityItem;
  currentUser?: { id?: string; role?: string } | null;
  onAddCustomer?: () => void;
  onRefresh?: () => void;
}

const normalizeMoneyInput = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

type OpportunityService = NonNullable<OpportunityItem['services']>[number];

interface ServiceCardProps {
  service: OpportunityService;
  opportunityId: string;
  canEditPrices: boolean;
  canHandleDemo: boolean;
  packageQuantity?: number;
  onRefresh?: () => void;
}

function ServiceCard({
  service,
  opportunityId,
  canEditPrices,
  canHandleDemo,
  packageQuantity = 1,
  onRefresh,
}: ServiceCardProps) {
  const jobs = getVisibleOpportunityJobs(service.jobs);
  const editableJobs = getEditableOpportunityJobs(service.jobs);
  const demoTasks = (service.jobs || [])
    .filter((job) => job.isBriefVideo)
    .flatMap((job) => job.tasks || []);
  const requiresCustomerApproval = demoTasks.length > 0;
  const customerApproved = demoTasks.some((task) => task.customerDecision === 'APPROVED');
  const canEnterCost = canEditPrices && (!requiresCustomerApproval || customerApproved);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reworkTask, setReworkTask] = useState<any>(null);
  const updateServiceMutation = useUpdateOpportunityServiceMutation();
  const approveByCustomerMutation = useApproveByCustomerMutation();
  const customerNotPurchaseMutation = useCustomerNotPurchaseMutation();
  const isDecisionPending =
    approveByCustomerMutation.isPending || customerNotPurchaseMutation.isPending;

  const saveCosts = async () => {
    if (!service.id || !canEnterCost) return;
    try {
      await updateServiceMutation.mutateAsync({
        id: service.id,
        opportunityId,
        jobs: editableJobs.map((job) => ({
          id: job.id,
          costAtSale: Number(drafts[job.id] ?? job.costAtSale ?? 0),
        })),
      });
      Alert.alert('Thành công', 'Đã cập nhật giá vốn các hạng mục.');
      onRefresh?.();
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể cập nhật giá hạng mục.');
    }
  };

  const updateCustomerDecision = (task: any, decision: 'APPROVED' | 'NOT_PURCHASED') => {
    const execute = async () => {
      try {
        if (decision === 'APPROVED') {
          await approveByCustomerMutation.mutateAsync({
            taskId: task.id,
            projectId: task.project?.id || task.projectId,
          });
        } else {
          await customerNotPurchaseMutation.mutateAsync({
            id: task.id,
            projectId: task.project?.id || task.projectId,
          });
        }
        Alert.alert(
          'Đã cập nhật',
          decision === 'APPROVED'
            ? 'Đã ghi nhận khách hàng duyệt mua.'
            : 'Đã ghi nhận khách hàng không mua.'
        );
        onRefresh?.();
      } catch (error: any) {
        Alert.alert('Lỗi', error?.message || 'Không thể cập nhật quyết định khách hàng.');
      }
    };

    if (decision === 'NOT_PURCHASED') {
      Alert.alert('Khách hàng không mua', 'Xác nhận khách hàng không mua video demo này?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', style: 'destructive', onPress: execute },
      ]);
      return;
    }
    execute();
  };

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-slate-900">
            {service.serviceName || service.service?.name || 'Dịch vụ'}
          </Text>
          <Text className="mt-1 text-[11px] text-slate-500">
            Số lượng: {Number(service.quantity || 1) / Number(packageQuantity || 1)}{' '}
            {service.unit || service.service?.unit || ''}
          </Text>
        </View>
        <Text className="text-[11px] text-slate-500">
          Giá vốn: <Text className="font-bold text-slate-700">{formatVND(service.costAtSale)}</Text>
        </Text>
      </View>

      {jobs.map((job) => {
        const isBriefVideo = Boolean(job.isBriefVideo);
        const canEditJob = editableJobs.some((item) => item.id === job.id);
        const approvedResults = (job.tasks || []).filter(
          (task) =>
            ['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED'].includes(task.status || '') &&
            task.result?.url
        );

        return (
          <View key={job.id} className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-900">
                  {job.name || job.job?.name || 'Hạng mục'}
                </Text>
                {job.briefVideo ? (
                  <Text className="mt-1 text-[11px] leading-4 text-blue-700">Brief: {job.briefVideo}</Text>
                ) : null}
              </View>
              {isBriefVideo ? (
                <View className="rounded-full bg-amber-100 px-2 py-1">
                  <Text className="text-[9px] font-bold text-amber-700">Video demo</Text>
                </View>
              ) : null}
            </View>

            {canEditJob && canEnterCost ? (
              <View className="mt-3">
                <Text className="mb-1 text-[11px] text-slate-500">Giá vốn</Text>
                <TextInput
                  value={drafts[job.id] ?? String(Math.round(Number(job.costAtSale || 0)))}
                  onChangeText={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [job.id]: normalizeMoneyInput(value),
                    }))
                  }
                  keyboardType="number-pad"
                  selectTextOnFocus
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  accessibilityLabel={`Giá vốn ${job.name || job.job?.name || 'hạng mục'}`}
                />
              </View>
            ) : canEditJob && requiresCustomerApproval ? (
              <Text className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                Giá vốn chỉ được nhập sau khi khách hàng duyệt video demo.
              </Text>
            ) : !isBriefVideo ? (
              <Text className="mt-2 text-[11px] text-slate-600">
                Chi phí thực tế: <Text className="font-bold">{formatVND(job.costAtSale)}</Text>
              </Text>
            ) : null}

            {isBriefVideo && approvedResults.map((task) => (
              <View key={task.id} className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <View className="flex-row items-center gap-2">
                  <Feather name="check-circle" size={15} color="#047857" />
                  <Text className="flex-1 text-[11px] font-bold text-emerald-700">
                    Kết quả video demo đã được PM xác nhận
                  </Text>
                </View>
                <TouchableOpacity
                  className="mt-2 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3"
                  onPress={() => task.result?.url && Linking.openURL(task.result.url)}
                >
                  <Feather name="play-circle" size={17} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Mở video kết quả</Text>
                </TouchableOpacity>
                {task.result?.note ? (
                  <Text className="mt-2 text-[11px] text-slate-600">{task.result.note}</Text>
                ) : null}
                {task.customerDecision ? (
                  <Text
                    className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-bold ${
                      task.customerDecision === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {task.customerDecision === 'APPROVED'
                      ? 'Khách hàng đã duyệt mua'
                      : 'Khách hàng không mua'}
                  </Text>
                ) : null}
                {task.status === 'INTERNAL_COMPLETED' && !task.customerDecision && canHandleDemo ? (
                  <View className="mt-3 gap-2 border-t border-emerald-100 pt-3">
                    <TouchableOpacity
                      className="min-h-[44px] items-center justify-center rounded-xl bg-emerald-600"
                      disabled={isDecisionPending}
                      onPress={() => updateCustomerDecision(task, 'APPROVED')}
                    >
                      <Text className="text-xs font-bold text-white">Khách hàng duyệt</Text>
                    </TouchableOpacity>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-amber-300 bg-white"
                        disabled={isDecisionPending}
                        onPress={() => updateCustomerDecision(task, 'NOT_PURCHASED')}
                      >
                        <Text className="text-xs font-bold text-amber-700">Không mua</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-purple-300 bg-white"
                        disabled={isDecisionPending}
                        onPress={() => setReworkTask(task)}
                      >
                        <Text className="text-xs font-bold text-purple-700">Yêu cầu làm lại</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}

      {editableJobs.length > 0 && canEnterCost ? (
        <TouchableOpacity
          className={`mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 ${
            updateServiceMutation.isPending ? 'opacity-60' : ''
          }`}
          disabled={updateServiceMutation.isPending}
          onPress={saveCosts}
        >
          {updateServiceMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Feather name="save" size={16} color="#FFFFFF" />
          )}
          <Text className="text-xs font-bold text-white">Lưu giá vốn hạng mục</Text>
        </TouchableOpacity>
      ) : null}

      <ReworkTaskModal
        visible={Boolean(reworkTask)}
        task={reworkTask}
        onClose={() => setReworkTask(null)}
        onSuccess={() => {
          setReworkTask(null);
          onRefresh?.();
        }}
      />
    </View>
  );
}

export const OpportunityFinancialTab: React.FC<OpportunityFinancialTabProps> = ({
  opportunity,
  currentUser,
  onAddCustomer,
  onRefresh,
}) => {
  const packages = opportunity.packages || [];
  const services = (opportunity.services || []).filter((service) => !service.opportunityPackageId);
  const hasServices = packages.length > 0 || services.length > 0;
  const canEditPrices = Boolean(opportunity.customer || opportunity.leadName?.trim());
  const canHandleDemo = useMemo(() => {
    const isSalesOwner =
      ['BD', 'ADMIN_SALE'].includes(currentUser?.role || '') &&
      currentUser?.id === opportunity.createdBy?.id;
    return isSalesOwner || ['ADMIN', 'BOD'].includes(currentUser?.role || '');
  }, [currentUser?.id, currentUser?.role, opportunity.createdBy?.id]);

  return (
    <View className="gap-3">
      <View className="rounded-xl border border-slate-200 bg-white p-3.5">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-lg bg-orange-50">
            <Feather name="pie-chart" size={16} color="#EA580C" />
          </View>
          <Text className="text-[13px] font-extrabold text-slate-800">Thông tin tài chính</Text>
        </View>
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-[11px] text-slate-500">Doanh thu kỳ vọng</Text>
            <Text className="mt-0.5 text-[15px] font-black text-emerald-700">
              {formatVND(opportunity.expectedRevenue)}
            </Text>
          </View>
          <View className="mx-3 h-8 w-px bg-slate-200" />
          <View className="flex-1">
            <Text className="text-[11px] text-slate-500">Ngân sách dự kiến</Text>
            <Text className="mt-0.5 text-[15px] font-extrabold text-blue-700">
              {formatVND(opportunity.budget)}
            </Text>
          </View>
        </View>
      </View>

      {!canEditPrices && hasServices ? (
        <View className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <Text className="text-xs leading-5 text-amber-800">
            Vui lòng chọn khách hàng trước khi điền giá vốn dịch vụ.
          </Text>
          {onAddCustomer ? (
            <TouchableOpacity
              className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-amber-600"
              onPress={onAddCustomer}
            >
              <Feather name="user-plus" size={16} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Chọn khách hàng</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {packages.map((pkg) => (
        <View key={pkg.id} className="rounded-xl border border-blue-100 bg-blue-50 p-3.5">
          <View className="mb-3 flex-row items-center gap-2">
            <View className="h-[30px] w-[30px] items-center justify-center rounded-lg bg-blue-600">
              <MaterialCommunityIcons name="package-variant" size={16} color="#FFFFFF" />
            </View>
            <Text className="flex-1 text-[13px] font-extrabold text-blue-900">Gói: {pkg.name}</Text>
            <Text className="text-xs font-bold text-blue-600">x{pkg.quantity || 1}</Text>
          </View>
          <View className="gap-2.5">
            {(pkg.services || []).map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                opportunityId={opportunity.id}
                canEditPrices={canEditPrices}
                canHandleDemo={canHandleDemo}
                packageQuantity={pkg.quantity}
                onRefresh={onRefresh}
              />
            ))}
          </View>
        </View>
      ))}

      {services.length > 0 ? (
        <View className="rounded-xl border border-slate-200 bg-white p-3.5">
          <View className="mb-3 flex-row items-center gap-2">
            <View className="h-[30px] w-[30px] items-center justify-center rounded-lg bg-emerald-50">
              <Feather name="layers" size={16} color="#16A34A" />
            </View>
            <Text className="text-[13px] font-extrabold text-slate-800">Dịch vụ lẻ</Text>
          </View>
          <View className="gap-2.5">
            {services.map((service, index) => (
              <ServiceCard
                key={service.id || index}
                service={service}
                opportunityId={opportunity.id}
                canEditPrices={canEditPrices}
                canHandleDemo={canHandleDemo}
                onRefresh={onRefresh}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!hasServices ? (
        <View className="rounded-xl border border-slate-200 bg-white p-6">
          <Text className="text-center text-xs italic text-slate-400">Chưa có dịch vụ nào được chọn</Text>
        </View>
      ) : null}
    </View>
  );
};
