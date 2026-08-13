import { create } from 'zustand'

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
}

export const useLoadingStore = create<LoadingStore>((set, get) => ({
  loadingMap: {},
  setLoading: (key, value) =>
    set((state) => ({ loadingMap: { ...state.loadingMap, [key]: value } })),
  isLoading: (key) => get().loadingMap[key] ?? false,

  loaded: {},
  markLoaded: (key) =>
    set((state) => ({ loaded: { ...state.loaded, [key]: true } })),
  isLoaded: (key) => get().loaded[key] === true,

  dataCache: {},
  setDataCache: (key, value) =>
    set((state) => ({ dataCache: { ...state.dataCache, [key]: value } })),
  getDataCache: (key) => get().dataCache[key] ?? null,

  activeTab: {},
  setActiveTab: (screen, tab) =>
    set((state) => ({ activeTab: { ...state.activeTab, [screen]: tab } })),
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
}))