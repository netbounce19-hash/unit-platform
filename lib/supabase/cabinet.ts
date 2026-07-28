"use client";

import { getSupabase } from "./client";
import { BUCKET, buildStoragePath, uploadAsset } from "./uploads";

// ── Заявки на финансирование ────────────────────────────────

export type RequestStatus = "pending" | "approved" | "declined";

export interface BudgetRequestRow {
  id: string;
  owner_id: string;
  purpose: string;
  amount: number;
  status: RequestStatus;
  created_at: string;
}

async function requireUser() {
  const {
    data: { user },
    error,
  } = await getSupabase().auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Нужно войти в аккаунт");
  return user;
}

export async function listBudgetRequests(): Promise<BudgetRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("budget_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetRequestRow[];
}

export async function createBudgetRequest(purpose: string, amount: number): Promise<BudgetRequestRow> {
  const user = await requireUser();
  const { data, error } = await getSupabase()
    .from("budget_requests")
    .insert({ owner_id: user.id, purpose, amount, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as BudgetRequestRow;
}

export async function deleteBudgetRequest(id: string): Promise<void> {
  const { error } = await getSupabase().from("budget_requests").delete().eq("id", id);
  if (error) throw error;
}

// ── Релизы ──────────────────────────────────────────────────

export type ReleaseStatus = "upcoming" | "live";

export interface ReleaseRow {
  id: string;
  owner_id: string;
  title: string;
  status: ReleaseStatus;
  release_date: string | null;
  cover_path: string | null;
  created_at: string;
}

export interface ReleaseView extends ReleaseRow {
  coverUrl: string | null; // подписанная ссылка на обложку
}

async function signCover(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function listReleases(): Promise<ReleaseView[]> {
  const { data, error } = await getSupabase()
    .from("releases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ReleaseRow[];
  return Promise.all(
    rows.map(async (r) => ({ ...r, coverUrl: await signCover(r.cover_path) }))
  );
}

export interface CreateReleaseArgs {
  title: string;
  cover?: File | null;
  audio?: File | null;
  /** id аудио-ассетов из демо, которые прикрепляем к релизу */
  demoAssetIds?: string[];
  onProgress?: (percent: number) => void;
}

/**
 * Создаёт релиз: грузит обложку в хранилище, заводит строку releases,
 * прикрепляет аудио (загруженное или выбранные демо) к релизу.
 */
export async function createRelease({
  title,
  cover,
  audio,
  demoAssetIds,
  onProgress,
}: CreateReleaseArgs): Promise<ReleaseView> {
  const supabase = getSupabase();
  const user = await requireUser();

  // 1. Обложка → хранилище
  let coverPath: string | null = null;
  if (cover) {
    coverPath = buildStoragePath(user.id, "photo", cover.name);
    const { error } = await supabase.storage.from(BUCKET).upload(coverPath, cover, {
      contentType: cover.type || undefined,
      upsert: false,
    });
    if (error) throw error;
  }

  // 2. Строка релиза
  const { data, error } = await supabase
    .from("releases")
    .insert({
      owner_id: user.id,
      title: title.trim() || "Без названия",
      status: "upcoming",
      cover_path: coverPath,
    })
    .select()
    .single();
  if (error) {
    if (coverPath) await supabase.storage.from(BUCKET).remove([coverPath]);
    throw error;
  }
  const release = data as ReleaseRow;

  // 3. Аудио: загруженный файл (resumable) как ассет релиза
  if (audio) {
    const asset = await uploadAsset({ file: audio, kind: "audio", title: audio.name, onProgress });
    await supabase.from("assets").update({ release_id: release.id }).eq("id", asset.id);
  }

  // 4. Выбранные демо привязываем к релизу
  if (demoAssetIds && demoAssetIds.length > 0) {
    await supabase.from("assets").update({ release_id: release.id }).in("id", demoAssetIds);
  }

  return { ...release, coverUrl: await signCover(release.cover_path) };
}

export async function deleteRelease(release: ReleaseRow): Promise<void> {
  const supabase = getSupabase();
  if (release.cover_path) {
    await supabase.storage.from(BUCKET).remove([release.cover_path]);
  }
  const { error } = await supabase.from("releases").delete().eq("id", release.id);
  if (error) throw error;
}
