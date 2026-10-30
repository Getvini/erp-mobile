import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useServiceDetailQuery } from '@/hooks/queries/useServices';
import { useCatalogViewState } from '@/hooks/useCatalogViewState';
import { formatVND } from '@/utils/formatters';
import type { ServiceItem } from '@/services/catalogService';

export default function CatalogServiceJobs({ serviceId, scope, service }: { serviceId: string; scope: string; service?: ServiceItem | null }) {
  const [expanded, setExpanded] = useCatalogViewState(scope + ':' + serviceId, false);
  const query = useServiceDetailQuery(serviceId, { enabled: expanded && !Array.isArray(service?.serviceJobs) });
  const jobs = Array.isArray(service?.serviceJobs) ? service.serviceJobs : query.data?.serviceJobs;
  return <View className="mt-2 border-t border-slate-100 pt-2">
    <TouchableOpacity className="min-h-[48px] justify-center" accessibilityRole="button" accessibilityState={{ expanded }} onPress={(event) => { event.stopPropagation(); setExpanded(!expanded); }}><Text className="text-xs font-bold text-primary">{expanded ? 'Thu gọn hạng mục' : 'Xem hạng mục công việc'}{Array.isArray(jobs) ? ' (' + jobs.length + ')' : ''}</Text></TouchableOpacity>
    {expanded ? (query.isError && !Array.isArray(service?.serviceJobs) ? <TouchableOpacity className="min-h-[48px] justify-center" onPress={(event) => { event.stopPropagation(); void query.refetch(); }}><Text className="text-xs text-red-600">Không tải được hạng mục. Bấm thử lại.</Text></TouchableOpacity> : !Array.isArray(jobs) ? <View className="py-3"><ActivityIndicator /><Text className="text-xs text-slate-500">Đang tải hạng mục…</Text></View> : jobs.length === 0 ? <Text className="text-xs text-slate-500">Chưa có hạng mục công việc.</Text> : jobs.map((item) => <View key={item.jobId} className="gap-1 border-t border-slate-100 py-2">
      <Text className="text-sm font-bold text-slate-800">{item.job?.name || 'Hạng mục chưa có thông tin'}</Text>
      <Text className="text-xs text-slate-500">Mã: {item.job?.code || '—'} · Đơn vị: {item.job?.unit || '—'}</Text>
      <Text className="text-xs text-slate-600">Số lượng: {item.quantity ?? 1} · Đầu ra: {item.isOutput ? 'Có' : 'Không'}</Text>
      <Text className="text-xs text-slate-600">Đơn giá: {item.job?.costPrice == null ? 'Chưa có dữ liệu' : formatVND(item.job.costPrice)}</Text>
      <Text className="text-xs font-bold text-primary">Thành tiền: {item.job?.costPrice == null ? 'Chưa có dữ liệu' : formatVND(Number(item.job.costPrice) * Number(item.quantity ?? 1))}</Text>
    </View>)) : null}
  </View>;
}
