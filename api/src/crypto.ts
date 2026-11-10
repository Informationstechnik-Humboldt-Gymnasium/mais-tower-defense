const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return b64url(new Uint8Array(h));
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keyCache.set(secret, k);
  }
  return k;
}

export interface AccessClaims {
  sub: number; // Spieler-ID
  sid: string; // Sitzungs-ID
  exp: number; // Unix-Sekunden
}

/** Kurzlebiges Zugriffstoken (JWT, HS256). */
export async function signJwt(claims: AccessClaims, secret: string): Promise<string> {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

/** Prüft Signatur (zeitkonstant via WebCrypto) und Ablauf. */
export async function verifyJwt(token: string, secret: string, nowSec: number): Promise<AccessClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 2048) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    if (head.alg !== 'HS256') return null;
    const c = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as AccessClaims;
    if (typeof c.sub !== 'number' || typeof c.sid !== 'string' || typeof c.exp !== 'number') return null;
    if (c.exp <= nowSec) return null;
    return c;
  } catch {
    return null;
  }
}
