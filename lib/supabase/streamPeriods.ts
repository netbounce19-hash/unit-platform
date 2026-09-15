"use client";

import { getSupabase } from "./client";

/**
 * Помесячная история стримов. Сводные цифры в artist_stream_stats база
 * пересчитывает сама из этой таблицы, поэтому рейтинг и дашборд не нужно
 * обновлять отдельно.
 */

export interface StreamPeriod {
  id: string;
  org_id: string;
  artist_id: string;
  /** YYYY-MM-01 */
  month: string;
  source: string;
  streams: number;
  listeners: number;
  updated_at: string;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const toPeriod = (r: Record<string, unknown>): StreamPeriod =>
  ({ ...r, streams: num(r.streams), listeners: num(r.listeners) }) as StreamPeriod;

/** Общая цифра без разбивки по площадкам. */
export const ALL_SOURCES = "all";

export async function fetchOrgPeriods(orgId: string): Promise<StreamPeriod[]> {
  const { data, error } = await getSupabase()
    .from("artist_stream_periods")
    .select("*")
    .eq("org_id", orgId)
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toPeriod);
}

/** История одного артиста — и лейблу, и самому артисту (RLS). */
export async function fetchArtistPeriods(artistId: string): Promise<StreamPeriod[]> {
  const { data, error } = await getSupabase()
    .from("artist_stream_periods")
    .select("*")
    .eq("artist_id", artistId)
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toPeriod);
}

export interface PeriodInput {
  artistId: string;
  month: string;
  source?: string;
  streams: number;
  listeners: number;
}

/** Записывает месяцы; повторная загрузка того же месяца и площадки заменяет цифры. */
export async function upsertPeriods(orgId: string, rows: PeriodInput[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = rows.map((r) => ({
    org_id: orgId,
    artist_id: r.artistId,
    month: r.month,
    source: r.source?.trim() || ALL_SOURCES,
    streams: Math.max(0, Math.round(r.streams)),
    listeners: Math.max(0, Math.round(r.listeners)),
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("artist_stream_periods")
    .upsert(payload, { onConflict: "artist_id,month,source" });
  if (error) throw error;
}

export async function deletePeriod(id: string): Promise<void> {
  const { error } = await getSupabase().from("artist_stream_periods").delete().eq("id", id);
  if (error) throw error;
}
