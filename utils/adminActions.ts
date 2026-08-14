import { getValidAccessToken } from './secureAuth';

export async function getAdminToken(): Promise<string> {
const token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}