/** Client der Spiel-API. Ohne VITE_API_URL läuft das Spiel ohne Anmeldung (Testbetrieb). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

const RT_KEY = 'mtd-refresh';
let accessToken = '';
let accessExp = 0;

export interface Player {
  name: string;
  paidMonth: string | null;
}

export type Result<T> = ({ ok: true } & T) | { ok: false; code: string; message: string };

function storeRefresh(t: string | null): void {
  try {
    if (t) localStorage.setItem(RT_KEY, t);
    else localStorage.removeItem(RT_KEY);
  } catch {
    /* privater Modus: Sitzung gilt nur bis zum Neuladen */
  }
}
function loadRefresh(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown, auth = false): Promise<Result<T>> {
  try {
    const r = await fetch(API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth && accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (j && typeof j === 'object') return j as Result<T>;
    return { ok: false, code: 'http_' + r.status, message: 'Unerwartete Antwort vom Server.' };
  } catch {
    return { ok: false, code: 'network', message: 'Server nicht erreichbar.' };
  }
}

interface TokenResp {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function takeTokens(t: TokenResp): void {
  accessToken = t.accessToken;
  accessExp = Date.now() + (t.expiresIn - 30) * 1000;
  storeRefresh(t.refreshToken);
}

export async function login(ident: string, password: string): Promise<Result<{ player: Player }>> {
  const r = await post<TokenResp & { player: Player }>('/api/login', { ident, password });
  if (r.ok) takeTokens(r);
  return r;
}

/** Stille Anmeldung über gespeichertes Refresh-Token. */
export async function resume(): Promise<Player | null> {
  const rt = loadRefresh();
  if (!rt) return null;
  const r = await post<TokenResp>('/api/refresh', { refreshToken: rt });
  if (!r.ok) {
    if (r.code !== 'network') storeRefresh(null);
    return null;
  }
  takeTokens(r);
  const me = await authedGet<{ player: Player }>('/api/me');
  return me.ok ? me.player : null;
}

async function ensureAccess(): Promise<boolean> {
  if (accessToken && Date.now() < accessExp) return true;
  const rt = loadRefresh();
  if (!rt) return false;
  const r = await post<TokenResp>('/api/refresh', { refreshToken: rt });
  if (!r.ok) return false;
  takeTokens(r);
  return true;
}

export async function authedGet<T>(path: string): Promise<Result<T>> {
  if (!(await ensureAccess())) return { ok: false, code: 'invalid_session', message: 'Bitte erneut anmelden.' };
  try {
    const r = await fetch(API_URL + path, { headers: { Authorization: 'Bearer ' + accessToken } });
    return (await r.json()) as Result<T>;
  } catch {
    return { ok: false, code: 'network', message: 'Server nicht erreichbar.' };
  }
}

export async function logout(): Promise<void> {
  const rt = loadRefresh();
  storeRefresh(null);
  accessToken = '';
  if (rt) await post('/api/logout', { refreshToken: rt });
}
