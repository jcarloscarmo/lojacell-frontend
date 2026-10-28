/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_STORAGE_KEY = 'shlojacell_supabase_config_v1';

const DEFAULT_SUPABASE_URL = 'https://szqzxqkriibqjxdtcqyr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_bKoZ7bOkl91UTFTu4lCXNQ_JruiwxRE';

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigHash = '';

export function obterConfigSupabase(): SupabaseConnectionConfig | null {
  if (import.meta.env.MODE === 'test') {
    return null;
  }

  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (envUrl && envKey && envUrl.startsWith('http')) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SupabaseConnectionConfig;
      if (parsed.url?.trim().startsWith('http') && parsed.anonKey?.trim()) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
        };
      }
    }
  } catch {
    // Ignora erro de leitura do localStorage e usa o padrão
  }

  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
  };
}

export function salvarConfigSupabaseLocal(config: SupabaseConnectionConfig | null): void {
  if (!config || !config.url.trim() || !config.anonKey.trim()) {
    localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
    cachedClient = null;
    cachedConfigHash = '';
    return;
  }
  localStorage.setItem(
    SUPABASE_CONFIG_STORAGE_KEY,
    JSON.stringify({
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
    })
  );
  cachedClient = null;
  cachedConfigHash = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = obterConfigSupabase();
  if (!cfg) return null;

  const hash = `${cfg.url}::${cfg.anonKey}`;
  if (cachedClient && cachedConfigHash === hash) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedConfigHash = hash;
    return cachedClient;
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

export function supabaseEstaConfigurado(): boolean {
  return obterConfigSupabase() !== null;
}
