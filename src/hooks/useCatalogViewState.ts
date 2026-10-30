import { useCallback, useState, useSyncExternalStore, Dispatch, SetStateAction } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

const views = new Map<string, unknown>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useCatalogViewState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const userId = useAuthStore((state) => state.user?.id);
  const scopedKey = String(userId ?? 'anonymous') + ':' + key;
  const [defaultValue] = useState(initial);
  const getSnapshot = useCallback(() => views.has(scopedKey) ? views.get(scopedKey) as T : defaultValue, [scopedKey, defaultValue]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const previous = views.has(scopedKey) ? views.get(scopedKey) as T : defaultValue;
    views.set(scopedKey, typeof next === 'function' ? (next as (previous: T) => T)(previous) : next);
    listeners.forEach((listener) => listener());
  }, [scopedKey, defaultValue]);
  return [value, setValue];
}
