import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'unifix_access_token';
const REFRESH_TOKEN_KEY = 'unifix_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearAuthTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getValidAccessToken(): Promise<string | null> {
  const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp && exp - now > 60) return token;
  } catch {
    return token;
  }

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data?.token;
    const newRefresh = data?.refreshToken;
    if (!newToken) return null;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newToken);
    if (newRefresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefresh);
    return newToken;
  } catch {
    return null;
  }
}