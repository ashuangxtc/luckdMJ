import { getClientId } from "./clientId";

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`.replace(/([^:])\/\/+/, "$1/");
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('X-Client-Id', getClientId());
  const base = (import.meta as any)?.env?.VITE_API_BASE || '';
  let url: RequestInfo | URL = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    url = joinUrl(base, input);
  }
  return fetch(url, { ...init, headers, credentials: 'include', mode: 'cors' as any });
}


