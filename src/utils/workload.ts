const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const mix = (from: string, to: string, ratio: number): string => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const t = clamp(ratio, 0, 1);
  return `rgb(${Math.round(start.r + (end.r - start.r) * t)}, ${Math.round(start.g + (end.g - start.g) * t)}, ${Math.round(start.b + (end.b - start.b) * t)})`;
};

export interface WorkloadInfo {
  userId?: string;
  kpi?: number;
  pendingVinicoin?: number;
  rawRatio?: number;
  displayRatio?: number;
  percent?: number;
  displayPercent?: number;
  taskCount?: number;
}

export const getWorkloadColor = (percent = 0): string => {
  const clamped = clamp(Number(percent || 0), 0, 200);
  if (clamped <= 100) return mix('#10b981', '#ef4444', clamped / 100);
  return mix('#ef4444', '#7c3aed', (clamped - 100) / 100);
};

export const getWorkloadPercent = (workload?: WorkloadInfo | null): number =>
  Number(workload?.percent || 0);

export const getWorkloadDisplayPercent = (workload?: WorkloadInfo | null): number =>
  workload ? Number(workload.displayPercent ?? Math.min(getWorkloadPercent(workload), 200)) : 0;

export const formatWorkloadLabel = (workload?: WorkloadInfo | null): string =>
  `${getWorkloadPercent(workload)}%`;
