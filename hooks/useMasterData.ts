import { useEffect, useRef, useState } from 'react';
import { mmkvGetJSON, mmkvSetJSON } from '../utils/mmkv';

const BACKEND_URL = process.env.EXPO_PUBLIC_BASE_URL;
const MMKV_KEY = 'master_data_cache';
const MMKV_TS_KEY = 'master_data_fetched_at';
const CACHE_TTL = 60 * 60 * 1000;

export type SubCategory = { id: string; name: string };
export type Category = {
  id: string;
  name: string;
  iconName: string;
  color: string;
  designation: string | null;
  displayOrder: number;
  subCategories: SubCategory[];
};
export type Room = { id: string; roomNumber: string; roomName: string; floorId: string | null; remark: string | null };
export type Building = { id: string; name: string; code: string; rooms: Room[] };
export type LFCategory = { id: string; name: string; type: 'found' | 'lost'; displayOrder: number };

export type MasterData = {
  categories: Category[];
  buildings: Building[];
  lfCategories: LFCategory[];
};

type State = { data: MasterData | null; loading: boolean; error: string | null };

const FALLBACK: MasterData = { categories: [], buildings: [], lfCategories: [] };

async function fetchMaster(): Promise<MasterData> {
  const res = await fetch(`${BACKEND_URL}/master/all`);
  if (!res.ok) throw new Error('Failed to fetch master data');
  const json = await res.json();
  const d = json.data ?? json;
  if (!d?.categories) throw new Error(`Bad response shape: ${JSON.stringify(json).slice(0, 200)}`);
  return d as MasterData;
}

function readMMKVCache(): MasterData | null {
  const fetchedAt = mmkvGetJSON<number>(MMKV_TS_KEY);
  if (!fetchedAt || Date.now() - fetchedAt > CACHE_TTL) return null;
  return mmkvGetJSON<MasterData>(MMKV_KEY);
}

function writeMMKVCache(data: MasterData): void {
  mmkvSetJSON(MMKV_KEY, data);
  mmkvSetJSON(MMKV_TS_KEY, Date.now());
}

export function useMasterData(): State & { refetch: () => void } {
  const cached = readMMKVCache();
  const [state, setState] = useState<State>({
    data: cached,
    loading: !cached,
    error: null,
  });
  const mounted = useRef(true);

  const load = async (retries = 2) => {
    const hit = readMMKVCache();
    if (hit) {
      setState({ data: hit, loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        const data = await fetchMaster();
        writeMMKVCache(data);
        if (mounted.current) setState({ data, loading: false, error: null });
        return;
      } catch (e: any) {
        lastErr = e;
        if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    const stale = mmkvGetJSON<MasterData>(MMKV_KEY);
    if (stale && mounted.current) {
      setState({ data: stale, loading: false, error: null });
      return;
    }
    if (mounted.current) setState(s => ({ ...s, loading: false, error: lastErr?.message ?? 'Failed' }));
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, []);

  return { ...state, refetch: () => load() };
}

export function resolveRoom(buildings: Building[], roomNumber: string): { building: string; label: string } | null {
  for (const b of buildings) {
    const room = b.rooms.find(r => r.roomNumber.toUpperCase() === roomNumber.toUpperCase());
    if (room) return { building: b.name, label: room.roomName };
  }
  return null;
}

export function getRoomByNumber(buildings: Building[], roomNumber: string): Room | null {
  for (const b of buildings) {
    const room = b.rooms.find(r => r.roomNumber.toUpperCase() === roomNumber.toUpperCase());
    if (room) return room;
  }
  return null;
}

export function getSubCategories(categories: Category[], categoryId: string): SubCategory[] {
  return categories.find(c => c.id === categoryId)?.subCategories ?? [];
}

export function getCategoryByName(categories: Category[], name: string): Category | undefined {
  return categories.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function getLFCategories(lfCategories: LFCategory[], type: 'found' | 'lost'): string[] {
  return lfCategories.filter(c => c.type === type).map(c => c.name);
}