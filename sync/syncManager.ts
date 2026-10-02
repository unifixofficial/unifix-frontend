import NetInfo from '@react-native-community/netinfo';
import { getAllComplaintsLocal, getComplaintsByUser, upsertComplaints } from '../db/complaintsDb';
import { getMeta, setMeta } from '../db/metadataDb';
import { complaintsAPI } from '../services/api';

const STUDENT_HASH_KEY = 'student_complaints_hash';
const STUDENT_SYNC_KEY = 'student_complaints_synced_at';
const ADMIN_HASH_KEY = 'admin_complaints_hash';
const ADMIN_SYNC_KEY = 'admin_complaints_synced_at';
const STAFF_HASH_KEY = 'staff_complaints_hash';
const STAFF_SYNC_KEY = 'staff_complaints_synced_at';
const MIN_SYNC_INTERVAL_MS = 30000;

const inFlight = new Map();
const lastSync = new Map();

const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

const guarded = async (key: string, fn: () => Promise<void>): Promise<void> => {
  const now = Date.now();
  const last = lastSync.get(key) || 0;
  if (now - last < MIN_SYNC_INTERVAL_MS && !key.startsWith('force:')) return;
  if (inFlight.has(key)) return inFlight.get(key);
  const p = (async () => {
    try {
      await fn();
      lastSync.set(key, Date.now());
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
};

export const syncStudentComplaints = async (uid: string): Promise<void> => {
  return guarded(`student:${uid}`, async () => {
    const online = await isOnline();
    if (!online) return;
    try {
      const storedHash = await getMeta(STUDENT_HASH_KEY);
      const hashRes = await complaintsAPI.getHash();
      const newHash = hashRes?.hash;
      if (storedHash && storedHash === newHash) return;
      const since = await getMeta(STUDENT_SYNC_KEY);
      const data = await complaintsAPI.myComplaintsSince(since ? parseInt(since) : null);
      const incoming = data?.data?.complaints ?? data?.complaints ?? [];
      if (incoming.length > 0) await upsertComplaints(incoming.slice(0, 200));
      if (newHash) await setMeta(STUDENT_HASH_KEY, newHash);
      if (hashRes?.serverTime) await setMeta(STUDENT_SYNC_KEY, String(hashRes.serverTime));
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') return;
    }
  });
};

export const syncAdminComplaints = async (): Promise<void> => {
  return guarded('admin', async () => {
    const online = await isOnline();
    if (!online) return;
    try {
      const storedHash = await getMeta(ADMIN_HASH_KEY);
      const hashRes = await complaintsAPI.getAdminHash();
      const newHash = hashRes?.hash;
      if (storedHash && storedHash === newHash) return;
      const since = await getMeta(ADMIN_SYNC_KEY);
      const data = await complaintsAPI.allComplaintsSince(since ? parseInt(since) : null);
      const incoming = data?.data?.complaints ?? data?.complaints ?? [];
      if (incoming.length > 0) await upsertComplaints(incoming.slice(0, 200));
      if (newHash) await setMeta(ADMIN_HASH_KEY, newHash);
      if (hashRes?.serverTime) await setMeta(ADMIN_SYNC_KEY, String(hashRes.serverTime));
    } catch {}
  });
};

export const getStudentComplaintsFromDb = async (uid: string) => {
  return getComplaintsByUser(uid);
};

export const forceRefreshStudentComplaints = async (uid: string): Promise<void> => {
  const online = await isOnline();
  if (!online) return;
  try {
    await setMeta(STUDENT_HASH_KEY, '');
    await setMeta(STUDENT_SYNC_KEY, '');
    lastSync.delete(`student:${uid}`);
    await syncStudentComplaints(uid);
  } catch {}
};
export const getAdminComplaintsFromDb = async () => {
  return getAllComplaintsLocal();
};

export const syncStaffComplaints = async (): Promise<void> => {
  return guarded('staff', async () => {
    const online = await isOnline();
    if (!online) return;
    try {
      const storedHash = await getMeta(STAFF_HASH_KEY);
      const hashRes = await complaintsAPI.getStaffHash();
      const newHash = hashRes?.hash;
      if (storedHash && storedHash === newHash) return;
      const since = await getMeta(STAFF_SYNC_KEY);
      const data = await complaintsAPI.staffComplaintsSince(since ? parseInt(since) : null);
      const combined = [
        ...(data.pending || []),
        ...(data.active || []),
        ...(data.completed || []),
        ...(data.rejected || []),
      ];
      const seen = new Set<string>();
      const unique = combined.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
      if (unique.length > 0) await upsertComplaints(unique.slice(0, 200));
      if (newHash) await setMeta(STAFF_HASH_KEY, newHash);
      if (hashRes?.serverTime) await setMeta(STAFF_SYNC_KEY, String(hashRes.serverTime));
    } catch {}
  });
};

export const getStaffComplaintsFromDb = async (uid: string) => {
  return getAllComplaintsLocal();
};
