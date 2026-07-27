import { useEffect, useRef, useState } from 'react';

const BACKEND_URL = process.env.EXPO_PUBLIC_BASE_URL;
const CACHE_KEY = 'unifix_master_data';
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
  return json.data as MasterData;
}

function readCache(): MasterData | null {
  try {
    const raw = require('@react-native-async-storage/async-storage').default;
    return null;
  } catch {
    return null;
  }
}

let memCache: { data: MasterData; at: number } | null = null;

export function useMasterData(): State & { refetch: () => void } {
  const [state, setState] = useState<State>({
    data: memCache ? memCache.data : null,
    loading: !memCache,
    error: null,
  });
  const mounted = useRef(true);

  const load = async () => {
    if (memCache && Date.now() - memCache.at < CACHE_TTL) {
      setState({ data: memCache.data, loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await fetchMaster();
      memCache = { data, at: Date.now() };
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (e: any) {
      if (mounted.current) setState(s => ({ ...s, loading: false, error: e.message }));
    }
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, []);

  return { ...state, refetch: load };
}

export function resolveRoom(buildings: Building[], roomNumber: string): { building: string; label: string } | null {
  for (const b of buildings) {
    const room = b.rooms.find(r => r.roomNumber.toUpperCase() === roomNumber.toUpperCase());
    if (room) {
      const num = parseInt(roomNumber.replace(/\D/g, ''), 10);
      const floor = Math.floor(num / 100);
      return {
        building: floor === 0 ? 'Ground Floor' : `Floor ${floor}`,
        label: room.roomName,
      };
    }
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