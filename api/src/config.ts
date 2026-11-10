export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionSecret: string;
  walletRpc: string;
  walletArgs: string;
  walletRecipient: string;
  priceMinor: number;
  allowedOrigins: string[];
}

export type EnvLike = Record<string, unknown>;

/** Standard-Argumente der Überweisungs-RPC. Platzhalter werden typerhaltend ersetzt. */
export const DEFAULT_WALLET_ARGS = JSON.stringify({
  p_recipient: '{{recipient}}',
  p_amount_minor: '{{amount}}',
  p_reason: 'Mais Tower Defense Abo {{month}}',
  p_idempotency_key: '{{key}}',
});

export function readConfig(env: EnvLike): Config {
  const s = (k: string) => (typeof env[k] === 'string' ? (env[k] as string).trim() : '');
  const price = Number(s('ABO_PRICE_MINOR') || '50000');
  return {
    supabaseUrl: s('SUPABASE_URL').replace(/\/+$/, ''),
    supabaseAnonKey: s('SUPABASE_ANON_KEY'),
    sessionSecret: s('SESSION_SECRET'),
    walletRpc: s('WALLET_TRANSFER_RPC'),
    walletArgs: s('WALLET_TRANSFER_ARGS') || DEFAULT_WALLET_ARGS,
    walletRecipient: s('WALLET_RECIPIENT'),
    priceMinor: Number.isInteger(price) && price > 0 ? price : 50000,
    allowedOrigins: s('ALLOWED_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean),
  };
}

/** Fehlende Pflicht-Einstellungen (ohne Werte zu verraten). */
export function configProblems(c: Config): string[] {
  const p: string[] = [];
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl) && !c.supabaseUrl.startsWith('http://127.0.0.1')) p.push('SUPABASE_URL');
  if (!c.supabaseAnonKey) p.push('SUPABASE_ANON_KEY');
  if (c.sessionSecret.length < 32) p.push('SESSION_SECRET');
  return p;
}
