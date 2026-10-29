import { Decimal } from 'decimal.js';
import type { BudgetAmount } from '@/services/paymentRequestService';

export function parseBudgetAmount(value: BudgetAmount | null | undefined): Decimal | null {
  if (value == null || value === '' || (typeof value === 'string' && !value.trim())) return null;
  try {
    const amount = new Decimal(value);
    return amount.isFinite() ? amount : null;
  } catch {
    return null;
  }
}

/** Preserve server totals, including zero and negative remaining balances. */
export function getBudgetSummaryMetrics(
  budget: BudgetAmount,
  spent: BudgetAmount,
  remaining?: BudgetAmount | null,
  percentage?: BudgetAmount | null,
) {
  const total = parseBudgetAmount(budget);
  const used = parseBudgetAmount(spent);
  const balance = parseBudgetAmount(remaining) ?? (total && used ? total.minus(used) : null);
  const rate = parseBudgetAmount(percentage) ?? (
    total && used ? (total.gt(0) ? used.div(total).times(100).toDecimalPlaces(1) : new Decimal(0)) : null
  );
  return {
    budget: total?.toFixed() ?? null,
    spent: used?.toFixed() ?? null,
    remaining: balance?.toFixed() ?? null,
    percentage: rate?.toFixed() ?? null,
    progress: rate ? Decimal.min(100, Decimal.max(0, rate)).toNumber() : 0,
    isOverBudget: balance?.lt(0) ?? false,
    hasBudget: total?.gt(0) ?? false,
  };
}
