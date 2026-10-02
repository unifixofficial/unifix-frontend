import { create } from 'zustand';

type NetworkStatus = 'online' | 'offline' | 'restored';

type NetworkStore = {
  status: NetworkStatus;
  isOnline: boolean;
  setOnline: () => void;
  setOffline: () => void;
  setRestored: () => void;
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  status: 'online',
  isOnline: true,
  setOnline: () => set({ status: 'online', isOnline: true }),
  setOffline: () => set({ status: 'offline', isOnline: false }),
  setRestored: () => set({ status: 'restored', isOnline: true }),
}));