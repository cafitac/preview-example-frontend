declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl?: string };
  }
}

export function readApiUrl(): string {
  return window.__APP_CONFIG__?.apiUrl?.trim().replace(/\/+$/, '') || 'http://localhost:8000';
}
