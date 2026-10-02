import { getAccessToken } from '@/utils/secureAuth';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

const postFile = async (uri: string, fieldMime: string, fileName: string, kind: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData();
  formData.append('photo', { uri, type: fieldMime, name: fileName || `photo-${Date.now()}.jpg` } as any);
  formData.append('kind', kind);
  const res = await fetch(`${BASE_URL}/uploads/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Photo upload failed');
  }
  const data = await res.json();
  const url = data?.data?.url ?? data?.url;
  if (!url) throw new Error('Photo upload failed');
  return url;
};

export const uploadPhotoViaBackend = async (uri: string, kind: string, fileName?: string): Promise<string> => {
  return postFile(uri, 'image/jpeg', fileName || `photo-${Date.now()}.jpg`, kind);
};

export const uploadFileViaBackend = async (uri: string, fileName: string, kind: string): Promise<string> => {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return postFile(uri, 'application/pdf', fileName, 'document');
  const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return postFile(uri, mime, fileName, kind);
};

export { MAX_INPUT_BYTES };
