"use client";

import { getSupabase } from "./client";

/**
 * Стримы и слушатели из artist_stream_stats.
 *
 * Раньше эти цифры жили в Map в памяти вкладки: менеджер вводил их у себя,
 * артист не видел ничего, после перезагрузки значения пересеивались.
 * Вводит по-прежнему только лейбл — это закрыто RLS, иначе артист мог бы
 * приписать себе стримы, по которым его же ранжируют.
 */

export interface StreamStat {
  artist_id: string;
  org_id: string;
  streams: number;
  listeners: number;
  updated_at: string;
}

/** Цифры одного артиста — для его собственного кабинета. */
export async function fetchMyStreamStat(artistId: string): Promise<StreamStat | null> {
  const { data, error } = await getSupabase()
    .from("artist_stream_stats")
    .select("*")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) throw error;
  return (data as StreamStat) ?? null;
}

/** Цифры всего ростера — для рейтинга и загрузки данных в кабинете лейбла. */
export async function fetchOrgStreamStats(orgId: string): Promise<Map<string, StreamStat>> {
  const { data, error } = await getSupabase()
    .from("artist_stream_stats")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [(r as StreamStat).artist_id, r as StreamStat]));
}

/** Сохраняет введённые менеджером цифры. Артисту запись закрыта политикой. */
export async function saveStreamStat(args: {
  artistId: string;
  orgId: string;
  streams: number;
  listeners: number;
}): Promise<StreamStat> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("artist_stream_stats")
    .upsert(
      {
        artist_id: args.artistId,
        org_id: args.orgId,
        streams: Math.max(0, Math.round(args.streams)),
        listeners: Math.max(0, Math.round(args.listeners)),
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "artist_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as StreamStat;
}

/** 65000 → «65k», 1200000 → «1.2M» */
export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
