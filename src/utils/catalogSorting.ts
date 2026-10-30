export interface CatalogSort { key: string; direction: 'asc' | 'desc' }
export function sortCatalog<T>(items: T[], sort: CatalogSort): T[] {
  return [...items].sort((left, right) => {
    const a = (left as Record<string, unknown>)[sort.key], b = (right as Record<string, unknown>)[sort.key];
    const numeric = ['costPrice', 'vinicoin'].includes(sort.key);
    const result = numeric ? Number(a ?? 0) - Number(b ?? 0) : String(a ?? '').localeCompare(String(b ?? ''), 'vi', { sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  });
}
