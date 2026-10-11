export const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
  return `${baseUrl || ''}${path}`;
};

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(getApiUrl(path), options);
  } catch {
    throw new Error('Cannot reach the StudySnap backend. Start it with start_studysnap.bat. For a deployed site, check VITE_API_BASE_URL and that the backend is running.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`The backend returned an unexpected response (HTTP ${response.status}). Check that /api requests reach Flask. For a deployed site, set VITE_API_BASE_URL to the backend URL and rebuild the frontend.`);
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Backend request failed (HTTP ${response.status}).`);
  }
  return payload as T;
}
