import { mmkvGet, mmkvSet, mmkvDelete, mmkvGetJSON, mmkvSetJSON } from './mmkv';

const USER_CACHE_KEY = 'unifix_cached_user';
const USER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export function saveCache(key: string, data: any): void {
  mmkvSetJSON(key, { data, savedAt: Date.now() });
}

export function saveUserCache(user: any): void {
  const existing = mmkvGetJSON<any>(USER_CACHE_KEY) ?? {};
  mmkvSetJSON(USER_CACHE_KEY, { ...existing, ...user, cachedAt: Date.now() });
}

export function loadUserCache(): any | null {
  const parsed = mmkvGetJSON<any>(USER_CACHE_KEY);
  if (!parsed) return null;
  if (Date.now() - (parsed.cachedAt ?? 0) > USER_CACHE_TTL) {
    mmkvDelete(USER_CACHE_KEY);
    return null;
  }
  return parsed;
}

export function loadCache(key: string, maxAgeMs = 10 * 60 * 1000, forceLoad = false): any | null {
  const parsed = mmkvGetJSON<any>(key);
  if (!parsed) return null;
  if (!forceLoad && Date.now() - parsed.savedAt > maxAgeMs) return null;
  return parsed.data;
}

export function loadCacheForce(key: string): any | null {
  return loadCache(key, 0, true);
}

export function clearUserCache(): void {
  mmkvDelete(USER_CACHE_KEY);
}