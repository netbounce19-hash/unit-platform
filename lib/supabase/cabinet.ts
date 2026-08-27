"use client";

import { getSupabase } from "./client";
import { BUCKET, buildStoragePath, uploadAsset, type Asset, type AssetKind } from "./uploads";

// ── Заявки на финансирование ────────────────────────────────

/**
 * Кабинет лейбла пишет "rejected", ранние заявки использовали "declined" —
 * артист должен понимать оба, иначе отклонённая заявка роняет его экран.
 */
export type RequestStatus = "pending" | "approved" | "rejected" | "declined";

export interface BudgetRequestRow {
  id: string;
  owner_id: string;
  org_id: string | null;
  artist_id: string | null;
  purpose: string;
  amount: number;
  /** к какой дате нужны средства, YYYY-MM-DD */
  needed_by: string | null;
  status: RequestStatus;
  decision_comment: string | null;
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

/**
 * Заводит заявку. Без org_id она не попадёт в кабинет лейбла и менеджер
 * её не увидит — а срок «когда нужны средства» адресован именно ему.
 */
export async function createBudgetRequest(
  purpose: string,
  amount: number,
  neededBy?: string | null
): Promise<BudgetRequestRow> {
  const user = await requireUser();
  const link = await fetchMyArtistLink();
  const { data, error } = await getSupabase()
    .from("budget_requests")
    .insert({
      owner_id: user.id,
      org_id: link?.orgId ?? null,
      artist_id: link?.artistId ?? null,
      purpose,
      amount,
      needed_by: neededBy || null,
      status: "pending",
    })
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

/** Общий словарь с кабинетом лейбла (см. миграцию 20260803120000). */
export type ReleaseStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "in_progress"
  | "released"
  | "rejected";

export interface ReleaseRow {
  id: string;
  owner_id: string;
  org_id: string | null;
  artist_id: string | null;
  title: string;
  status: ReleaseStatus;
  planned_date: string | null; // YYYY-MM-DD
  strategy: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cover_path: string | null;
  created_at: string;
}

export interface ReleaseView extends ReleaseRow {
  coverUrl: string | null; // подписанная ссылка на обложку
}

/** Как показывать статус приёмки артисту. */
export const releaseStatusLabels: Record<ReleaseStatus, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-[#F0EEEA] text-[#6E6D73]" },
  pending_approval: { label: "На согласовании", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Принят менеджером", cls: "bg-[#E9F6EF] text-[#166B49]" },
  in_progress: { label: "В работе", cls: "bg-[#EAF1FB] text-[#1B4F9C]" },
  released: { label: "Вышел", cls: "bg-[#E9F6EF] text-[#166B49]" },
  rejected: { label: "Отклонён", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

/** Связка текущего пользователя с артистом лейбла — нужна, чтобы релиз дошёл до менеджера. */
export interface MyArtistLink {
  artistId: string;
  orgId: string;
}

export async function fetchMyArtistLink(): Promise<MyArtistLink | null> {
  const user = await requireUser();
  const { data, error } = await getSupabase()
    .from("artists")
    .select("id, org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return { artistId: data.id as string, orgId: data.org_id as string };
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
  /** планируемая дата релиза, YYYY-MM-DD */
  plannedDate?: string | null;
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
  plannedDate,
  cover,
  audio,
  demoAssetIds,
  onProgress,
}: CreateReleaseArgs): Promise<ReleaseView> {
  const supabase = getSupabase();
  const user = await requireUser();
  // Без org_id релиз не попадёт в кабинет лейбла и менеджер его не увидит
  const link = await fetchMyArtistLink();

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
      org_id: link?.orgId ?? null,
      artist_id: link?.artistId ?? null,
      title: title.trim() || "Без названия",
      status: "pending_approval",
      planned_date: plannedDate || null,
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

export async function fetchRelease(id: string): Promise<ReleaseView | null> {
  const { data, error } = await getSupabase()
    .from("releases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ReleaseRow;
  return { ...row, coverUrl: await signCover(row.cover_path) };
}

/**
 * Правит поля, которые артист может менять сам. Статус приёмки сюда не
 * входит — его меняет только лейбл, это стоит на триггере в БД.
 */
export async function updateRelease(
  id: string,
  patch: { title?: string; plannedDate?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title.trim() || "Без названия";
  if (patch.plannedDate !== undefined) body.planned_date = patch.plannedDate || null;
  if (Object.keys(body).length === 0) return;

  const { error } = await getSupabase().from("releases").update(body).eq("id", id);
  if (error) throw error;
}

/** Файлы, прикреплённые к релизу. */
export interface ReleaseAsset extends Asset {
  url: string | null;
}

export async function listReleaseAssets(releaseId: string): Promise<ReleaseAsset[]> {
  const { data, error } = await getSupabase()
    .from("assets")
    .select("*")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Asset[];
  return Promise.all(
    rows.map(async (a) => {
      const { data: signed } = await getSupabase()
        .storage.from(BUCKET)
        .createSignedUrl(a.storage_path, 3600);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );
}

/** «Догрузить данные» — добавляет файл к уже созданному релизу. */
export async function addReleaseAsset(
  releaseId: string,
  file: File,
  kind: AssetKind,
  onProgress?: (percent: number) => void
): Promise<void> {
  const asset = await uploadAsset({ file, kind, title: file.name, onProgress });
  const { error } = await getSupabase()
    .from("assets")
    .update({ release_id: releaseId })
    .eq("id", asset.id);
  if (error) throw error;
}

// ── Подтверждения промо-действий ────────────────────────────

export type PromoStatus = "submitted" | "accepted" | "needs_changes";

export interface PromoReportRow {
  id: string;
  org_id: string;
  artist_id: string;
  release_id: string | null;
  platform: string;
  url: string | null;
  status: PromoStatus;
  created_at: string;
}

export const promoStatusLabels: Record<PromoStatus, { label: string; cls: string }> = {
  submitted: { label: "На проверке", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  accepted: { label: "Принято", cls: "bg-[#E9F6EF] text-[#166B49]" },
  needs_changes: { label: "Нужны правки", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

/** Площадки, на которых артист отчитывается о промо. */
export const PROMO_PLATFORMS = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "VK Клипы",
  "Telegram",
  "Другое",
] as const;

export async function listPromoReports(): Promise<PromoReportRow[]> {
  const { data, error } = await getSupabase()
    .from("promo_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromoReportRow[];
}

/**
 * Отправляет менеджеру ссылку на выполненное промо-действие.
 * org_id и artist_id в таблице NOT NULL, поэтому без привязки артиста
 * к лейблу отчёт отправить некуда — об этом честно говорим наверх.
 */
export async function createPromoReport(args: {
  platform: string;
  url: string;
  releaseId?: string | null;
}): Promise<PromoReportRow> {
  const link = await fetchMyArtistLink();
  if (!link) {
    throw new Error("Аккаунт не привязан к лейблу — отчёт отправить некому");
  }

  const { data, error } = await getSupabase()
    .from("promo_reports")
    .insert({
      org_id: link.orgId,
      artist_id: link.artistId,
      release_id: args.releaseId ?? null,
      platform: args.platform,
      url: args.url.trim(),
      status: "submitted",
    })
    .select()
    .single();
  if (error) throw error;
  return data as PromoReportRow;
}

export async function deletePromoReport(id: string): Promise<void> {
  const { error } = await getSupabase().from("promo_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteRelease(release: ReleaseRow): Promise<void> {
  const supabase = getSupabase();
  if (release.cover_path) {
    await supabase.storage.from(BUCKET).remove([release.cover_path]);
  }
  const { error } = await supabase.from("releases").delete().eq("id", release.id);
  if (error) throw error;
}
