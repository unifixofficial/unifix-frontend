import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'unifix-storage' });

export function mmkvSet(key: string, value: string): void {
  storage.set(key, value);
}

export function mmkvGet(key: string): string | undefined {
  return storage.getString(key);
}

export function mmkvDelete(key: string): void {
  storage.remove(key);
}

export function mmkvSetJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function mmkvGetJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mmkvClearByPrefix(prefix: string): void {
  const keys = storage.getAllKeys();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      storage.remove(key);
    }
  }
}