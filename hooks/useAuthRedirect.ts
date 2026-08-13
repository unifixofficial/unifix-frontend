import { getAccessToken, clearAuthTokens } from '@/utils/secureAuth';
import { loadUserCache, clearUserCache } from '@/utils/cache';
import { authAPI } from '@/services/api';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

type AuthState = {
  ready: boolean;
  uid: string | null;
  role: string | null;
};

export function useAuthRedirect(): AuthState {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    ready: false,
    uid: null,
    role: null,
  });
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const netState = await NetInfo.fetch();
        const online = !!(netState.isConnected && netState.isInternetReachable);

        const accessToken = await getAccessToken();

        if (!accessToken) {
          if (!online) {
            const cached = uidRef.current ?? loadUserCache()?.uid ?? null;
            if (cached) {
              setState(prev => ({ ...prev, ready: true }));
              return;
            }
          }
          router.replace('/login');
          setState({ ready: true, uid: null, role: null });
          return;
        }

        if (!online) {
          const cached = loadUserCache();
          if (cached?.uid) {
            uidRef.current = cached.uid;
            setState({ ready: true, uid: cached.uid, role: cached.role ?? null });
            return;
          }
          router.replace('/login');
          setState({ ready: true, uid: null, role: null });
          return;
        }

        const profileRes = await authAPI.myProfile();
        const profile = profileRes?.data?.profile ?? profileRes?.profile ?? null;

        if (!profile) {
          router.replace('/login');
          setState({ ready: true, uid: null, role: null });
          return;
        }

        uidRef.current = profile.id;

        if (!profile.profileCompleted) {
          router.replace('/complete-profile');
          setState({ ready: true, uid: profile.id, role: null });
          return;
        }

        const { role, verificationStatus } = profile;

        if (role === 'staff' && verificationStatus !== 'approved') {
          router.replace('/complete-profile');
          setState({ ready: true, uid: profile.id, role });
          return;
        }

        if (role === 'staff' && verificationStatus === 'approved') {
          router.replace('/staff-dashboard');
          setState({ ready: true, uid: profile.id, role });
          return;
        }

        router.replace('/');
        setState({ ready: true, uid: profile.id, role });
      } catch (err: any) {
        if (err?.message === 'SESSION_EXPIRED') {
          await clearAuthTokens();
          clearUserCache();
        }
        router.replace('/login');
        setState({ ready: true, uid: null, role: null });
      }
    };

    checkAuth();
  }, []);

  return state;
}