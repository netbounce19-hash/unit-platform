"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Браузерный клиент Supabase.
 * Используется ТОЛЬКО анонимный ключ — service_role в клиент не попадает никогда.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Скопируйте .env.example в .env.local и заполните значениями вашего инстанса."
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  return client;
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Не задан NEXT_PUBLIC_SUPABASE_URL");
  return url;
}
