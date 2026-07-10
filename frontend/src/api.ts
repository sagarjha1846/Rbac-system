// In dev, Vite's proxy (vite.config.ts) forwards relative paths to the
// local backend. In production the frontend and backend are deployed as
// separate services, so VITE_API_BASE_URL must point at the real backend URL.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
