import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Decimal } from 'decimal.js';
import { ProjectServiceDraft, getDraftTotals, updateDraftCustomPrice } from '@/utils/projectServiceAddendum';
import { formatNumber, formatNumberInput, formatVND } from '@/utils/formatters';

export function DraftNumberInput({
  label,
  value,
  onChange,
  disabled,
  money = false,
  placeholder,
  suffix,
  className = 'w-full',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  money?: boolean;
  placeholder?: string;
  suffix?: string;
  className?: string;
}) {
  const [integer, fraction] = value.split('.');
  const display = `${formatNumberInput(integer)}${fraction !== undefined ? `,${fraction}` : ''}`;

  return (
    <View className={`gap-1 ${className}`}>
      {label ? <Text className="text-xs font-semibold text-slate-600">{label}</Text> : null}
      <View className={`flex-row items-center rounded-xl border border-slate-200 bg-white px-3 min-h-[44px] ${disabled ? 'opacity-60 bg-slate-50' : ''}`}>
        <TextInput
          accessibilityLabel={label || 'Ô nhập số'}
          value={display}
          editable={!disabled}
          placeholder={placeholder || '0'}
          placeholderTextColor="#94A3B8"
          keyboardType={money ? 'decimal-pad' : 'number-pad'}
          onChangeText={(text) => {
            if (text.includes('-')) return;
            if (money) {
              const [whole, ...decimals] = text.replace(/\./g, '').split(',');
              onChange(`${whole.replace(/\D/g, '')}${decimals.length ? `.${decimals.join('').replace(/\D/g, '')}` : ''}`);
            } else {
              if (/[^\d.]/.test(text)) return;
              onChange(text.replace(/\D/g, ''));
            }
          }}
          className="flex-1 py-2 text-sm font-bold text-slate-900"
        />
        {suffix ? <Text className="ml-1 text-xs font-semibold text-slate-400">{suffix}</Text> : null}
      </View>
    </View>
  );
}

function ProfitMarginBadge({ margin }: { margin: Decimal | number }) {
  const val = typeof margin === 'number' ? margin : margin.toNumber();
  let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (val < 0) {
    badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (val < 30) {
    badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  const textColor = badgeStyle.split(' ')[1];

  return (
    <View className={`self-start rounded-md border px-2 py-0.5 ${badgeStyle}`}>
      <Text className={`text-[11px] font-bold ${textColor}`}>
        Tỉ suất LN: {formatNumber(Math.round(val))}%
      </Text>
    </View>
  );
}

export function ProjectPackageDraftCard({
  packageKey,
  packageName,
  packageQuantity,
  packagePrice,
  items,
  disabled,
  onUpdateQuantity,
  onUpdatePackagePrice,
  onUpdateChildItem,
  onRemovePackage,
}: {
  packageKey: string;
  packageName: string;
  packageQuantity: string;
  packagePrice: Decimal;
  items: ProjectServiceDraft[];
  disabled: boolean;
  onUpdateQuantity: (quantity: string) => void;
  onUpdatePackagePrice: (price: string) => void;
  onUpdateChildItem: (key: string, patch: Partial<ProjectServiceDraft>) => void;
  onRemovePackage: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totals = getDraftTotals(items);

  const handleStepperChange = (delta: number) => {
    if (disabled) return;
    const current = parseInt(packageQuantity, 10) || 1;
    const nextVal = Math.max(1, current + delta);
    onUpdateQuantity(String(nextVal));
  };

  return (
    <View className="mb-3.5 rounded-2xl border border-[#FDCB9E] bg-[#FFF7ED]/70 p-4 shadow-xs">
      {/* Header: Package Badge + Name + Delete */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 self-start rounded-md border border-[#FDCB9E] bg-[#FFF7ED] px-2 py-0.5">
            <Feather name="package" size={12} color="#D97010" />
            <Text className="text-[10px] font-extrabold tracking-wider text-[#D97010]">GÓI DỊCH VỤ</Text>
          </View>
          <Text className="mt-1.5 text-[15px] font-bold text-slate-900 leading-5">{packageName}</Text>
        </View>

        <TouchableOpacity
          disabled={disabled}
          onPress={onRemovePackage}
          accessibilityRole="button"
          accessibilityLabel={`Xóa gói ${packageName}`}
          className="h-10 w-10 items-center justify-center rounded-lg bg-white/80 border border-rose-200"
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={17} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Package Quantity Stepper */}
      <View className="mt-3 flex-row items-center justify-between border-t border-[#FDCB9E]/60 pt-2.5">
        <Text className="text-xs font-semibold text-slate-600">Số lượng gói:</Text>
        <View className="flex-row items-center rounded-xl border border-slate-300 bg-white">
          <TouchableOpacity
            disabled={disabled}
            className="h-9 w-9 items-center justify-center"
            onPress={() => handleStepperChange(-1)}
            activeOpacity={0.7}
          >
            <Feather name="minus" size={15} color={disabled ? '#94A3B8' : '#334155'} />
          </TouchableOpacity>
          <Text className="min-w-8 text-center text-sm font-bold text-slate-900">
            {formatNumber(packageQuantity || '1')}
          </Text>
          <TouchableOpacity
            disabled={disabled}
            className="h-9 w-9 items-center justify-center"
            onPress={() => handleStepperChange(1)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={15} color={disabled ? '#94A3B8' : '#334155'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Package Unit Price Input */}
      <View className="mt-2.5 flex-row items-center justify-between border-t border-[#FDCB9E]/60 pt-2.5">
        <Text className="text-xs font-semibold text-slate-600">Giá bán / gói:</Text>
        <View className="w-44">
          <DraftNumberInput
            className="w-full"
            value={packagePrice.toDecimalPlaces(6).toFixed()}
            disabled={disabled}
            money
            suffix="₫"
            onChange={onUpdatePackagePrice}
          />
        </View>
      </View>

      {/* Financial Overview Card */}
      <View className="mt-2.5 gap-1.5 rounded-xl border border-[#FDCB9E]/60 bg-white/90 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            Giá vốn: <Text className="font-semibold text-slate-700">{formatVND(totals.cost.toFixed())}</Text>
          </Text>
          <Text className="text-xs text-slate-500">
            Ngân sách: <Text className="font-semibold text-slate-700">{formatVND(totals.budget.toFixed())}</Text>
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            Doanh thu: <Text className="font-semibold text-slate-700">{formatVND(totals.revenue.toFixed())}</Text>
          </Text>
          <ProfitMarginBadge margin={totals.margin} />
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-100 pt-1.5">
          <Text className="text-xs font-bold text-slate-700">Thành tiền (có VAT 8%):</Text>
          <Text className="text-sm font-extrabold text-[#D97010]">
            {formatVND(totals.totalWithVat.toFixed())}
          </Text>
        </View>
      </View>

      {/* Toggle Child Services Accordion */}
      <TouchableOpacity
        className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#FDCB9E] bg-white py-2.5 shadow-xs"
        onPress={() => setExpanded((val) => !val)}
        activeOpacity={0.7}
      >
        <Text className="text-xs font-bold text-[#D97010]">
          {expanded ? 'Thu gọn dịch vụ con' : `Xem ${items.length} dịch vụ con trong gói`}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#D97010" />
      </TouchableOpacity>

      {/* Expanded Child Services List */}
      {expanded && (
        <View className="mt-2.5 gap-2.5 border-t border-[#FDCB9E]/60 pt-2.5">
          {items.map((subItem) => {
            const subQuantity = new Decimal(subItem.quantity || 0);
            const subCost = new Decimal(subItem.cost || 0).mul(subQuantity);
            const subTotals = getDraftTotals([subItem]);

            return (
              <View
                key={subItem.key}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800">{subItem.service.name}</Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      Định mức: {formatNumber(subItem.norm)} {subItem.service.unit || 'Lần'} / gói · Tổng SL:{' '}
                      {formatNumber(subItem.quantity)}
                    </Text>
                  </View>
                  <ProfitMarginBadge margin={subTotals.margin} />
                </View>

                {/* Budget input if permitted */}
                {subItem.service.isBudget === true && (
                  <View className="mt-2 w-full">
                    <DraftNumberInput
                      className="w-full"
                      label="Ngân sách / đơn vị (VNĐ)"
                      value={subItem.budget}
                      disabled={disabled}
                      money
                      suffix="₫"
                      onChange={(val) => onUpdateChildItem(subItem.key, { budget: val })}
                    />
                  </View>
                )}

                <View className="mt-2 flex-row items-center justify-between border-t border-slate-100 pt-1.5">
                  <Text className="text-xs text-slate-500">
                    Giá vốn: <Text className="font-semibold text-slate-700">{formatVND(subCost.toFixed())}</Text>
                  </Text>
                  <Text className="text-xs font-bold text-slate-800">
                    Giá bán: {formatVND(subTotals.revenue.toFixed())}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default React.memo(function ProjectServiceDraftCard({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: ProjectServiceDraft;
  disabled: boolean;
  onChange: (patch: Partial<ProjectServiceDraft>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const quantity = new Decimal(item.quantity || 0);
  const lineCost = new Decimal(item.cost || 0).mul(quantity);
  const lineBudget = new Decimal(item.budget || 0).mul(quantity);
  const totals = getDraftTotals([item]);
  const displayedPrice = item.sellingPrice
    ? new Decimal(item.sellingPrice).mul(item.packageKey ? item.norm : 1).toDecimalPlaces(6).toFixed()
    : '';

  const jobs = item.service.serviceJobs || [];

  return (
    <View className="mb-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      {/* Header: Service Badge + Name + Delete Button */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 self-start rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5">
            <Feather name="layers" size={11} color="#2563EB" />
            <Text className="text-[10px] font-extrabold tracking-wider text-blue-700">DỊCH VỤ LẺ</Text>
          </View>
          <Text className="mt-1.5 text-[15px] font-bold text-slate-900 leading-5">{item.service.name}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {item.service.code ? `${item.service.code} · ` : ''}
            {item.service.unit || 'Lần'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRemove}
          disabled={disabled}
          className="h-10 w-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/50"
          accessibilityRole="button"
          accessibilityLabel={`Xóa ${item.service.name}`}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={17} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Controls: Quantity & Custom Selling Price */}
      <View className="mt-3 flex-row items-end gap-2.5 border-t border-slate-100 pt-3">
        <DraftNumberInput
          className="flex-1"
          label="Số lượng"
          value={item.quantity}
          disabled={disabled}
          onChange={(val) => onChange({ quantity: val })}
        />
        <DraftNumberInput
          className="flex-1"
          label="Đơn giá bán (VNĐ)"
          value={displayedPrice}
          disabled={disabled}
          money
          suffix="₫"
          onChange={(val) => onChange({ sellingPrice: updateDraftCustomPrice(item, val).sellingPrice })}
        />
      </View>

      {/* Budget Input (if enabled) */}
      {item.service.isBudget === true ? (
        <View className="mt-2.5 w-full">
          <DraftNumberInput
            className="w-full"
            label="Ngân sách / đơn vị (VNĐ)"
            value={item.budget}
            disabled={disabled}
            money
            suffix="₫"
            onChange={(val) => onChange({ budget: val })}
          />
        </View>
      ) : null}

      {/* Financial Summary Box */}
      <View className="mt-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            Giá vốn: <Text className="font-semibold text-slate-700">{formatVND(lineCost.toFixed())}</Text>
          </Text>
          <Text className="text-xs text-slate-500">
            Ngân sách: <Text className="font-semibold text-slate-700">{formatVND(lineBudget.toFixed())}</Text>
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            Doanh thu: <Text className="font-semibold text-slate-700">{formatVND(totals.revenue.toFixed())}</Text>
          </Text>
          <ProfitMarginBadge margin={totals.margin} />
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-200/60 pt-1.5">
          <Text className="text-xs font-bold text-slate-700">Thành tiền (có VAT 8%):</Text>
          <Text className="text-sm font-extrabold text-[#F38820]">
            {formatVND(totals.totalWithVat.toFixed())}
          </Text>
        </View>
      </View>

      {/* Jobs Accordion */}
      {jobs.length > 0 && (
        <View className="mt-2.5">
          <TouchableOpacity
            onPress={() => setExpanded((val) => !val)}
            className="flex-row items-center justify-between rounded-lg bg-slate-100/70 px-3 py-2"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="briefcase" size={13} color="#475569" />
              <Text className="text-xs font-semibold text-slate-700">
                Chi tiết công việc ({jobs.length})
              </Text>
            </View>
            <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#64748B" />
          </TouchableOpacity>

          {expanded && (
            <View className="mt-2 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              {jobs.map((job, idx) => {
                const count = new Decimal(job.quantity || 1).mul(quantity);
                const cost = new Decimal(job.job?.costPrice || 0).mul(count);
                return (
                  <View key={`${job.jobId || idx}`} className="flex-row items-center justify-between py-1">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-semibold text-slate-800">{job.job?.name || 'Công việc'}</Text>
                      <Text className="text-[11px] text-slate-500">
                        {formatNumber(count.toFixed())} {job.job?.unit || ''}
                      </Text>
                    </View>
                    <Text className="text-xs font-semibold text-slate-600">{formatVND(cost.toFixed())}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
});