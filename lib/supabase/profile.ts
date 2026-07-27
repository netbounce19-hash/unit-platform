"use client";

import { getSupabase } from "./client";

export interface DbProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  artist_name: string | null;
}

/**
 * Профиль текущего пользователя. RLS сам ограничит выборку одной строкой.
 * Колонки role/telegram не запрашиваем: они появляются только после
 * миграции 20260727101913, а до неё запрос с ними падает с 42703.
 */
export async function fetchMyProfile(): Promise<DbProfile | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, artist_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as DbProfile) ?? null;
}

/** Имя для шапки кабинета: имя артиста → имя → часть email. */
export function displayNameOf(profile: DbProfile | null, fallbackEmail?: string | null): string {
  const email = profile?.email ?? fallbackEmail ?? null;
  return (
    profile?.artist_name?.trim() ||
    profile?.full_name?.trim() ||
    email?.split("@")[0] ||
    "Артист"
  );
}
