import { mmkvGet, mmkvSet } from '../utils/mmkv';

export function getMeta(key: string): string | null {
  return mmkvGet(key) ?? null;
}

export function setMeta(key: string, value: string): void {
  mmkvSet(key, value);
}