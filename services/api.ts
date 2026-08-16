import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearAuthTokens } from '@/utils/secureAuth';
import { clearUserCache } from '@/utils/cache';
import { mmkvDelete } from '@/utils/mmkv';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const TAB_KEYS = ['unifix_active_tab', 'unifix_staff_active_tab', 'unifix_admin_active_tab'];

const clearSessionData = (): void => {
  clearUserCache();
  for (const key of TAB_KEYS) {
    mmkvDelete(key);
  }
};

const getToken = async (): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return token;
};

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string> => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('SESSION_EXPIRED');

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          await clearAuthTokens();
          clearSessionData();
          throw new Error('SESSION_EXPIRED');
        }
        throw new Error('REFRESH_FAILED');
      }

      const data = await res.json();
      const token = data?.data?.token ?? data?.token;
      const newRefresh = data?.data?.refreshToken ?? data?.refreshToken;
      if (!token) {
        await clearAuthTokens();
        clearSessionData();
        throw new Error('SESSION_EXPIRED');
      }
      await setAccessToken(token);
      if (newRefresh) await setRefreshToken(newRefresh);
      return token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};
const request = async (
  method: string,
  endpoint: string,
  body?: object,
  requiresAuth = true
): Promise<any> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = await getToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && requiresAuth) {
    try {
      const freshToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${freshToken}`;
      const retry = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (retry.status === 401) {
        await clearAuthTokens();
        clearSessionData();
        throw new Error('SESSION_EXPIRED');
      }

      const retryType = retry.headers.get('content-type');
      const retryData = retryType?.includes('application/json')
        ? await retry.json()
        : { message: await retry.text() };

      if (!retry.ok) {
        const retryErr: any = new Error(retryData?.error || retryData?.message || 'Request failed');
        retryErr.code = retryData?.code ?? null;
        retryErr.status = retry.status;
        throw retryErr;
      }
      return retryData;
    } catch (err: any) {
      throw err;
    }
  }

  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? await res.json()
    : { message: await res.text() };

  if (!res.ok) {
    const err: any = new Error(data?.error || data?.message || 'Request failed');
    err.code = data?.code ?? null;
    err.status = res.status;
    throw err;
  }
  return data;
};

const get = (endpoint: string) => request('GET', endpoint);
const post = (endpoint: string, body: object, requiresAuth = true) =>
  request('POST', endpoint, body, requiresAuth);

export const authAPI = {
  googleSignIn: (idToken: string) =>
    post('/auth/firebase', { idToken }, false),

  selectRole: (role: string) =>
    post('/auth/select-role', { role }),

  signup: (fullName: string, email: string, password: string, role: string) =>
    post('/auth/signup', { fullName, email, password, role }, false),

  verifyOtp: (email: string, otp: string, fullName: string, password: string, role: string) =>
    post('/auth/verify-otp', { email, otp, fullName, password, role }, false),

  resendOtp: (email: string, fullName: string, type: string) =>
    post('/auth/resend-otp', { email, fullName, type }, false),

  login: (email: string, password: string) =>
    post('/auth/login', { email, password }, false),

  forgotPassword: (email: string) =>
    post('/auth/forgot-password', { email }, false),

  validateResetOtp: (email: string, otp: string) =>
    post('/auth/validate-reset-otp', { email, otp }, false),

  verifyResetOtp: (email: string, otp: string, newPassword: string) =>
    post('/auth/verify-reset-otp', { email, otp, newPassword }, false),

  refreshToken: (refreshToken: string) =>
    post('/auth/refresh', { refreshToken }, false),

  changePassword: (currentPassword: string, newPassword: string) =>
    post('/auth/change-password', { currentPassword, newPassword }),

  updateProfile: (fullName: string, phone?: string) =>
    post('/auth/update-profile', { fullName, phone }),

  logoutAllDevices: (fcmToken?: string | null) =>
    post('/auth/logout-all-devices', fcmToken ? { fcmToken } : {}),

  deleteAccount: () => post('/auth/delete-account', {}),

  reportSecurityIssue: (issueType: string, description: string) =>
    post('/auth/report-security-issue', { issueType, description }),

  requestIdCardUpdate: (newIdCardUrl: string, newIdCardName?: string) =>
    post('/auth/request-idcard-update', { newIdCardUrl, newIdCardName }),

  myProfile: () => get('/auth/my-profile'),

  savePushToken: (fcmToken: string) =>
    post('/auth/save-push-token', { fcmToken }),

  removePushToken: (fcmToken: string) =>
    post('/auth/remove-push-token', { fcmToken }),

  reportRagging: (payload: {
    incidentDate: string;
    incidentTime: string;
    location: string;
    description: string;
    bullyDescription: string;
    isAnonymous: boolean;
  }) => post('/auth/report-ragging', payload),
};

export const complaintsAPI = {
  submit: (payload: {
    category: string;
    subIssue: string | null;
    customIssue: string | null;
    description: string;
    building: string;
    roomDetail: string;
    photoUrl: string | null;
  }) => post('/complaints/submit', payload),

  accept: (complaintId: string) =>
    post('/complaints/accept', { complaintId }),

  updateStatus: (complaintId: string, status: string) =>
    post('/complaints/update-status', { complaintId, status }),

  reject: (complaintId: string, reason: string) =>
    post('/complaints/reject', { complaintId, reason }),

  rate: (complaintId: string, rating: number, comment?: string) =>
    post('/complaints/rate', { complaintId, rating, comment }),

  myComplaints: () => get('/complaints/my-complaints'),
  myComplaintsSince: (since: number | null) =>
    get(`/complaints/my-complaints${since ? `?since=${since}` : ''}`),
  getHash: () => get('/complaints/my-complaints/hash'),
  allComplaintsSince: (since: number | null) =>
    get(`/admin/all-complaints${since ? `?since=${since}` : ''}`),
  getAdminHash: () => get('/admin/all-complaints/hash'),

  staffComplaints: () => get('/complaints/staff-complaints'),
  staffComplaintsSince: (since: number | null) =>
    get(`/complaints/staff-complaints${since ? `?since=${since}` : ''}`),
  getStaffHash: () => get('/complaints/staff-complaints/hash'),
  getById: (id: string) => get(`/complaints/${id}`),
};

export const lostFoundAPI = {
  feed: (cursor?: string) =>
    get(`/lost-found/feed?limit=10${cursor ? `&after=${cursor}` : ''}`),
  feedSince: (since: number | null) =>
    get(`/lost-found/feed${since ? `?since=${since}` : ''}`),
  getFeedHash: () => get('/lost-found/feed/hash'),

  myPosts: () => get('/lost-found/my-posts'),
  myPostsSince: (since: number | null) =>
    get(`/lost-found/my-posts${since ? `?since=${since}` : ''}`),

  claims: () => get('/lost-found/claims'),
  claimsSince: (since: number | null) =>
    get(`/lost-found/claims${since ? `?since=${since}` : ''}`),
  getClaimsHash: () => get('/lost-found/claims/hash'),

  postItem: (payload: {
    itemName: string;
    category: string;
    description: string;
    roomNumber: string;
    roomLabel: string;
    collectLocation: string;
    photoUrl: string | null;
  }) => post('/lost-found/post', payload),

  handover: (itemId: string, handedToName: string) =>
    post('/lost-found/handover', { itemId, handedToName }),

  deletePost: (itemId: string) =>
    request('DELETE', `/lost-found/${itemId}`, undefined),
};

export const lostReportsAPI = {
  feed: (cursor?: string) =>
    get(`/lost-reports/feed?limit=10${cursor ? `&after=${cursor}` : ''}`),
  feedSince: (since: number | null) =>
    get(`/lost-reports/feed${since ? `?since=${since}` : ''}`),
  getFeedHash: () => get('/lost-reports/feed/hash'),

  post: (payload: {
    itemName: string;
    category: string;
    description: string;
    locationLost: string;
    dateLost: string;
    howToReach: string;
    images: string[];
  }) => request('POST', '/lost-reports/post', payload),

  markFound: (id: string) => request('PATCH', `/lost-reports/${id}/found`, {}),

  deleteReport: (id: string) => request('DELETE', `/lost-reports/${id}`, undefined),
};