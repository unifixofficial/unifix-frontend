import { getAccessToken } from './secureAuth';

export async function getAdminToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}