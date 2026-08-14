import { mmkvGetJSON, mmkvSetJSON, mmkvDelete } from '@/utils/mmkv';
import { create } from 'zustand';

const LOADED_CACHE_KEY = 'unifix_loaded_map';
const DATA_CACHE_KEY = 'unifix_data_cache';
const ACTIVE_TAB_KEY = 'unifix_active_tabs';

function readLoaded(): Record<string, boolean> {
  return mmkvGetJSON<Record<string, boolean>>(LOADED_CACHE_KEY) ?? {};
}

function writeLoaded(map: Record<string, boolean>): void {
  mmkvSetJSON(LOADED_CACHE_KEY, map);
}

function readDataCache(): Record<string, any> {
  return mmkvGetJSON<Record<string, any>>(DATA_CACHE_KEY) ?? {};
}

function writeDataCache(cache: Record<string, any>): void {
  mmkvSetJSON(DATA_CACHE_KEY, cache);
}

function readActiveTabs(): Record<string, string> {
  return mmkvGetJSON<Record<string, string>>(ACTIVE_TAB_KEY) ?? {};
}

function writeActiveTabs(tabs: Record<string, string>): void {
  mmkvSetJSON(ACTIVE_TAB_KEY, tabs);
}

type LoadingStore = {
  loadingMap: Record<string, boolean>
  setLoading: (key: string, value: boolean) => void
  isLoading: (key: string) => boolean
  loaded: Record<string, boolean>
  markLoaded: (key: string) => void
  isLoaded: (key: string) => boolean
  dataCache: Record<string, any>
  setDataCache: (key: string, value: any) => void
  getDataCache: (key: string) => any
  activeTab: Record<string, string>
  setActiveTab: (screen: string, tab: string) => void
  getActiveTab: (screen: string, defaultTab: string) => string
  studentData: {
    userData: any | null
    complaints: any[]
    feedItems: any[]
    lostReports: any[]
    claimItems: any[]
    userLostReports: any[]
    currentUserId: string
    userRole: string
    hasPendingIdCard: boolean
  }
  setStudentData: (patch: Partial<LoadingStore['studentData']>) => void
  staffData: {
    allComplaints: any[]
    staffUid: string | null
    staffProfile: any | null
    avgRating: number | null
    ratingCount: number
  }
  setStaffData: (patch: Partial<LoadingStore['staffData']>) => void
  adminData: {
    allComplaints: any[]
    flaggedComplaints: any[]
    pendingStaff: any[]
    adminProfile: any | null
  }
  setAdminData: (patch: Partial<LoadingStore['adminData']>) => void
  clearPersistedState: () => void
}

export const useLoadingStore = create<LoadingStore>((set, get) => ({
  loadingMap: {},
  setLoading: (key, value) =>
    set((state) => ({ loadingMap: { ...state.loadingMap, [key]: value } })),
  isLoading: (key) => get().loadingMap[key] ?? false,

  loaded: readLoaded(),
  markLoaded: (key) => {
    const next = { ...get().loaded, [key]: true };
    writeLoaded(next);
    set({ loaded: next });
  },
  isLoaded: (key) => get().loaded[key] === true,

  dataCache: readDataCache(),
  setDataCache: (key, value) => {
    const next = { ...get().dataCache, [key]: value };
    writeDataCache(next);
    set({ dataCache: next });
  },
  getDataCache: (key) => get().dataCache[key] ?? null,

  activeTab: readActiveTabs(),
  setActiveTab: (screen, tab) => {
    const next = { ...get().activeTab, [screen]: tab };
    writeActiveTabs(next);
    set({ activeTab: next });
  },
  getActiveTab: (screen, defaultTab) =>
    get().activeTab[screen] ?? defaultTab,

  studentData: {
    userData: null,
    complaints: [],
    feedItems: [],
    lostReports: [],
    claimItems: [],
    userLostReports: [],
    currentUserId: '',
    userRole: '',
    hasPendingIdCard: false,
  },
  setStudentData: (patch) =>
    set((state) => ({ studentData: { ...state.studentData, ...patch } })),

  staffData: {
    allComplaints: [],
    staffUid: null,
    staffProfile: null,
    avgRating: null,
    ratingCount: 0,
  },
  setStaffData: (patch) =>
    set((state) => ({ staffData: { ...state.staffData, ...patch } })),

  adminData: {
    allComplaints: [],
    flaggedComplaints: [],
    pendingStaff: [],
    adminProfile: null,
  },
  setAdminData: (patch) =>
    set((state) => ({ adminData: { ...state.adminData, ...patch } })),

  clearPersistedState: () => {
    mmkvDelete(LOADED_CACHE_KEY);
    mmkvDelete(DATA_CACHE_KEY);
    set({ loaded: {}, dataCache: {} });
  },
}));