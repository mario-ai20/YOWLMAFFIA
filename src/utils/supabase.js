import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const publicChatSupabaseUrl = import.meta.env.VITE_PUBLIC_CHAT_SUPABASE_URL?.trim();
const publicChatSupabaseAnonKey = import.meta.env.VITE_PUBLIC_CHAT_SUPABASE_ANON_KEY?.trim();

export { supabaseUrl, supabaseAnonKey, publicChatSupabaseUrl, publicChatSupabaseAnonKey };

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project.supabase.co') &&
    !supabaseAnonKey.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: 'yowlmaffia-auth'
      }
    })
  : null;

export const isPublicChatSupabaseConfigured = Boolean(
  publicChatSupabaseUrl &&
    publicChatSupabaseAnonKey &&
    !publicChatSupabaseUrl.includes('your-project.supabase.co') &&
    !publicChatSupabaseAnonKey.includes('your-anon-key')
);

export const publicChatSupabase = isPublicChatSupabaseConfigured
  ? createClient(publicChatSupabaseUrl, publicChatSupabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: 'yowlmaffia-public-chat-auth'
      }
    })
  : null;

export function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase is nog niet geconfigureerd.');
  }

  return supabase;
}
