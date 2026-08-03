"use client";

import { getSupabase } from "./client";

// ── Типы ────────────────────────────────────────────────────────────────────

export type MemberRole = "label_admin" | "label_manager";
export type TaskStatus = "todo" | "done";
export type BudgetStatus = "pending" | "approved" | "rejected" | "declined";
export type PromoStatus = "submitted" | "accepted" | "needs_changes";

/** Новый словарь + legacy-значения артистского кабинета (см. миграцию 20260730000000). */
export type ReleaseStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "in_progress"
  | "released"
  | "rejected"
  | "upcoming"
  | "live";

export interface ArtistTerms {
  royalty_pct?: number;
  term_months?: number;
  exclusive?: boolean;
}

export interface ArtistRow {
  id: string;
  org_id: string;
  user_id: string | null;
  stage_name: string;
  terms: ArtistTerms;
  status: string;
  created_at: string;
}

export interface ReleaseRow {
  id: string;
  org_id: string | null;
  artist_id: string | null;
  owner_id: string | null;
  title: string;
  status: ReleaseStatus;
  strategy: string | null;
  planned_date: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  org_id: string;
  artist_id: string;
  release_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BudgetRow {
  id: string;
  org_id: string | null;
  artist_id: string | null;
  owner_id: string | null;
  purpose: string | null;
  category: string | null;
  amount: number;
  comment: string | null;
  /** к какой дате артисту нужны средства, YYYY-MM-DD */
  needed_by: string | null;
  status: BudgetStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  created_at: string;
}

export interface InviteRow {
  id: string;
  org_id: string;
  artist_id: string | null;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// ── Организация текущего пользователя ───────────────────────────────────────

export interface MyOrg {
  org_id: string;
  name: string;
  role: MemberRole;
}

/** Организация, в которой пользователь состоит как сотрудник лейбла. */
export async function fetchMyOrg(): Promise<MyOrg | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Миграция кабинета лейбла ещё не применена — таблицы нет.
    // Для гейта это то же самое, что «пользователь не в лейбле».
    if (error.code === "42P01") return null;
    throw error;
  }
  if (!data) return null;

  const row = data as unknown as {
    org_id: string;
    role: MemberRole;
    organizations: { name: string } | { name: string }[] | null;
  };
  const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;

  return { org_id: row.org_id, name: org?.name ?? "Лейбл", role: row.role };
}

// ── Ростер ──────────────────────────────────────────────────────────────────

export interface RosterArtist extends ArtistRow {
  overdueTasks: number;
  openTasks: number;
  pendingBudgets: number;
}

/** Ростер с индикаторами: просроченные задачи и заявки, ждущие решения. */
export async function fetchRoster(orgId: string): Promise<RosterArtist[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [artistsRes, tasksRes, budgetsRes] = await Promise.all([
    supabase.from("artists").select("*").eq("org_id", orgId).order("stage_name"),
    supabase.from("tasks").select("artist_id, status, due_date").eq("org_id", orgId),
    supabase.from("budget_requests").select("artist_id, status").eq("org_id", orgId),
  ]);

  if (artistsRes.error) throw artistsRes.error;

  const tasks = (tasksRes.data ?? []) as Pick<TaskRow, "artist_id" | "status" | "due_date">[];
  const budgets = (budgetsRes.data ?? []) as Pick<BudgetRow, "artist_id" | "status">[];

  return ((artistsRes.data ?? []) as ArtistRow[]).map((a) => {
    const mine = tasks.filter((t) => t.artist_id === a.id && t.status === "todo");
    return {
      ...a,
      openTasks: mine.length,
      overdueTasks: mine.filter((t) => t.due_date && t.due_date < today).length,
      pendingBudgets: budgets.filter((b) => b.artist_id === a.id && b.status === "pending").length,
    };
  });
}

export async function fetchArtist(id: string): Promise<ArtistRow | null> {
  const { data, error } = await getSupabase().from("artists").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ArtistRow) ?? null;
}

export async function updateArtistTerms(id: string, terms: ArtistTerms): Promise<void> {
  const { error } = await getSupabase().from("artists").update({ terms }).eq("id", id);
  if (error) throw error;
}

export async function createArtist(
  orgId: string,
  stageName: string,
  terms: ArtistTerms = {}
): Promise<ArtistRow> {
  const { data, error } = await getSupabase()
    .from("artists")
    .insert({ org_id: orgId, stage_name: stageName.trim(), terms, status: "invited" })
    .select()
    .single();
  if (error) throw error;
  return data as ArtistRow;
}

// ── Релизы ──────────────────────────────────────────────────────────────────

export async function fetchReleases(orgId: string, artistId?: string): Promise<ReleaseRow[]> {
  let q = getSupabase().from("releases").select("*").eq("org_id", orgId);
  if (artistId) q = q.eq("artist_id", artistId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReleaseRow[];
}

export async function fetchRelease(id: string): Promise<ReleaseRow | null> {
  const { data, error } = await getSupabase().from("releases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ReleaseRow) ?? null;
}

export async function decideRelease(
  id: string,
  decision: "approved" | "rejected",
  strategy?: string
): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patch: Record<string, unknown> = {
    status: decision,
    approved_by: user?.id ?? null,
    approved_at: new Date().toISOString(),
  };
  if (strategy !== undefined) patch.strategy = strategy;

  const { error } = await supabase.from("releases").update(patch).eq("id", id);
  if (error) throw error;
}

export async function saveReleaseStrategy(id: string, strategy: string): Promise<void> {
  const { error } = await getSupabase().from("releases").update({ strategy }).eq("id", id);
  if (error) throw error;
}

// ── Задачи ──────────────────────────────────────────────────────────────────

export async function fetchTasks(orgId: string, artistId?: string): Promise<TaskRow[]> {
  let q = getSupabase().from("tasks").select("*").eq("org_id", orgId);
  if (artistId) q = q.eq("artist_id", artistId);
  const { data, error } = await q.order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export interface NewTask {
  orgId: string;
  artistId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  releaseId?: string | null;
}

export async function createTask(t: NewTask): Promise<TaskRow> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: t.orgId,
      artist_id: t.artistId,
      title: t.title.trim(),
      description: t.description?.trim() || null,
      due_date: t.dueDate || null,
      release_id: t.releaseId || null,
      created_by: user?.id ?? null,
      status: "todo",
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabase().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ── Обязательность (реальные данные из tasks) ───────────────────────────────

export interface ObligationStat {
  artistId: string;
  total: number;
  done: number;
  /** 0..100, null если у артиста ещё нет ни одной задачи — делить не на что. */
  ratio: number | null;
}

/** Доля выполненных задач по каждому артисту org — основа метрики «обязательность». */
export async function fetchObligationStats(orgId: string): Promise<ObligationStat[]> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("artist_id, status")
    .eq("org_id", orgId);
  if (error) throw error;

  const rows = (data ?? []) as Pick<TaskRow, "artist_id" | "status">[];
  const byArtist = new Map<string, { total: number; done: number }>();

  for (const r of rows) {
    const cur = byArtist.get(r.artist_id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (r.status === "done") cur.done += 1;
    byArtist.set(r.artist_id, cur);
  }

  return Array.from(byArtist.entries()).map(([artistId, v]) => ({
    artistId,
    total: v.total,
    done: v.done,
    ratio: v.total > 0 ? Math.round((v.done / v.total) * 100) : null,
  }));
}

// ── Заявки на финансирование ────────────────────────────────────────────────

export async function fetchBudgets(orgId: string, artistId?: string): Promise<BudgetRow[]> {
  let q = getSupabase().from("budget_requests").select("*").eq("org_id", orgId);
  if (artistId) q = q.eq("artist_id", artistId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetRow[];
}

/**
 * Решение по заявке. Триггер budget_guard_columns не даст изменить
 * ничего, кроме полей решения, и сам проставит decided_by/decided_at.
 */
export async function decideBudget(
  id: string,
  decision: "approved" | "rejected",
  comment?: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("budget_requests")
    .update({ status: decision, decision_comment: comment?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

// ── Загрузки артиста ────────────────────────────────────────────────────────

export interface ArtistAsset {
  id: string;
  kind: "audio" | "photo" | "document";
  title: string | null;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
}

/** Файлы артиста: политика assets открывает их участникам org. */
export async function fetchArtistAssets(artistUserId: string): Promise<ArtistAsset[]> {
  const { data, error } = await getSupabase()
    .from("assets")
    .select("id, kind, title, storage_path, size_bytes, created_at")
    .eq("owner_id", artistUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArtistAsset[];
}

export async function signAssetUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from("artist-files")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ── Приглашения ─────────────────────────────────────────────────────────────

export async function fetchInvites(orgId: string): Promise<InviteRow[]> {
  const { data, error } = await getSupabase()
    .from("artist_invites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createInvite(
  orgId: string,
  email: string,
  artistId?: string | null
): Promise<InviteRow> {
  const { data, error } = await getSupabase()
    .from("artist_invites")
    .insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      artist_id: artistId ?? null,
      token: generateToken(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as InviteRow;
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await getSupabase().from("artist_invites").delete().eq("id", id);
  if (error) throw error;
}

export function inviteLink(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${token}`;
}

/** Артист гасит приглашение: строку он не видит, всё делает функция в БД. */
export async function acceptInvite(token: string): Promise<void> {
  const { error } = await getSupabase().rpc("accept_artist_invite", { p_token: token });
  if (error) throw error;
}

// ── Форматирование ──────────────────────────────────────────────────────────

export const releaseStatusLabels: Record<ReleaseStatus, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-[#F0EEEA] text-[#6E6D73]" },
  pending_approval: { label: "На утверждении", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Утверждён", cls: "bg-[#E9F6EF] text-[#166B49]" },
  in_progress: { label: "В работе", cls: "bg-[#FDEDEB] text-[#A62018]" },
  released: { label: "Вышел", cls: "bg-[#E9F6EF] text-[#166B49]" },
  rejected: { label: "Отклонён", cls: "bg-[#FDEDEB] text-[#A62018]" },
  // legacy из артистского кабинета
  upcoming: { label: "Готовится", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  live: { label: "Вышел", cls: "bg-[#E9F6EF] text-[#166B49]" },
};

export const budgetStatusLabels: Record<BudgetStatus, { label: string; cls: string }> = {
  pending: { label: "Ждёт решения", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Одобрена", cls: "bg-[#E9F6EF] text-[#166B49]" },
  rejected: { label: "Отклонена", cls: "bg-[#FDEDEB] text-[#A62018]" },
  declined: { label: "Отклонена", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

export function formatMoney(n: number): string {
  return `${Number(n).toLocaleString("ru-RU")} ₽`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === "done") return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}
