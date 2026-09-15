"use client";

import { getSupabase } from "./client";

/**
 * Отчёты по роялти и авансы.
 *
 * Суммы (gross, royalty, recouped, payout) считает база —
 * recalc_royalty_statement. Клиент только вводит строки дохода, долю и
 * удержания, а потом читает результат: так у лейбла и артиста одни цифры.
 * Артисту видны только опубликованные отчёты.
 */

export type StatementStatus = "draft" | "published" | "paid";

export interface RoyaltyStatement {
  id: string;
  org_id: string;
  artist_id: string;
  period_start: string;
  period_end: string;
  share_pct: number;
  deductions: number;
  gross: number;
  royalty: number;
  recouped: number;
  payout: number;
  status: StatementStatus;
  due_date: string | null;
  note: string | null;
  published_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface RoyaltyLine {
  id: string;
  statement_id: string;
  source: string;
  streams: number;
  revenue: number;
}

export interface Advance {
  id: string;
  org_id: string;
  artist_id: string;
  amount: number;
  paid_on: string;
  note: string | null;
  created_at: string;
}

export const statementLabels: Record<StatementStatus, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-[#F0EEEA] text-[#6E6D73] dark:bg-[#242327] dark:text-[#9A98A0]" },
  published: { label: "К выплате", cls: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]" },
  paid: { label: "Выплачено", cls: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]" },
};

/** Площадки для строк отчёта; можно вписать и свою. */
export const ROYALTY_SOURCES = [
  "Яндекс Музыка",
  "VK Музыка",
  "Звук",
  "МТС Музыка",
  "Spotify",
  "Apple Music",
  "YouTube",
  "TikTok",
  "Прочее",
] as const;

// numeric приходит из PostgREST строкой — приводим к числам
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const toStatement = (r: Record<string, unknown>): RoyaltyStatement =>
  ({
    ...r,
    share_pct: num(r.share_pct),
    deductions: num(r.deductions),
    gross: num(r.gross),
    royalty: num(r.royalty),
    recouped: num(r.recouped),
    payout: num(r.payout),
  }) as RoyaltyStatement;
const toLine = (r: Record<string, unknown>): RoyaltyLine =>
  ({ ...r, streams: num(r.streams), revenue: num(r.revenue) }) as RoyaltyLine;
const toAdvance = (r: Record<string, unknown>): Advance => ({ ...r, amount: num(r.amount) }) as Advance;

export const fmtRub = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ₽";

export function fmtPeriod(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const q = Math.floor(s.getMonth() / 3);
  const isQuarter =
    s.getDate() === 1 && s.getMonth() % 3 === 0 && e.getFullYear() === s.getFullYear() &&
    e.getMonth() === s.getMonth() + 2 && new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate() === e.getDate();
  if (isQuarter) return `${["I", "II", "III", "IV"][q]} квартал ${s.getFullYear()}`;
  const f = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  return `${f(s)} — ${f(e)}`;
}

/** Даты квартала: quarter 1..4 → ["2026-07-01", "2026-09-30"]. */
export function quarterRange(year: number, quarter: number): [string, string] {
  const m = (quarter - 1) * 3;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, m + 3, 0).getDate();
  return [`${year}-${pad(m + 1)}-01`, `${year}-${pad(m + 3)}-${pad(last)}`];
}

// ── Лейбл ──────────────────────────────────────────────────────────────────

export async function fetchStatements(orgId: string, artistId?: string): Promise<RoyaltyStatement[]> {
  let q = getSupabase().from("royalty_statements").select("*").eq("org_id", orgId);
  if (artistId) q = q.eq("artist_id", artistId);
  const { data, error } = await q.order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toStatement);
}

export async function fetchStatement(id: string): Promise<RoyaltyStatement | null> {
  const { data, error } = await getSupabase().from("royalty_statements").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toStatement(data) : null;
}

export async function fetchLines(statementId: string): Promise<RoyaltyLine[]> {
  const { data, error } = await getSupabase()
    .from("royalty_lines")
    .select("*")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toLine);
}

export async function createStatement(args: {
  orgId: string;
  artistId: string;
  periodStart: string;
  periodEnd: string;
  sharePct: number;
  dueDate?: string | null;
}): Promise<RoyaltyStatement> {
  const { data, error } = await getSupabase()
    .from("royalty_statements")
    .insert({
      org_id: args.orgId,
      artist_id: args.artistId,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      share_pct: args.sharePct,
      due_date: args.dueDate || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Отчёт за этот период у артиста уже есть");
    throw error;
  }
  return toStatement(data);
}

export async function updateStatementDraft(
  id: string,
  patch: { sharePct?: number; deductions?: number; dueDate?: string | null; note?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.sharePct !== undefined) body.share_pct = patch.sharePct;
  if (patch.deductions !== undefined) body.deductions = patch.deductions;
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate || null;
  if (patch.note !== undefined) body.note = patch.note?.trim() || null;
  const { error } = await getSupabase().from("royalty_statements").update(body).eq("id", id);
  if (error) throw error;
}

/** Заменяет строки отчёта целиком — так проще, чем сверять правки по одной. */
export async function replaceLines(
  statementId: string,
  lines: { source: string; streams: number; revenue: number }[]
): Promise<void> {
  const supabase = getSupabase();
  const del = await supabase.from("royalty_lines").delete().eq("statement_id", statementId);
  if (del.error) throw del.error;
  const rows = lines
    .filter((l) => l.source.trim() && (l.revenue > 0 || l.streams > 0))
    .map((l) => ({
      statement_id: statementId,
      source: l.source.trim(),
      streams: Math.max(0, Math.round(l.streams)),
      revenue: Math.max(0, Math.round(l.revenue * 100) / 100),
    }));
  if (rows.length === 0) return;
  const ins = await supabase.from("royalty_lines").insert(rows);
  if (ins.error) throw ins.error;
}

export async function setStatementStatus(id: string, status: StatementStatus): Promise<void> {
  const { error } = await getSupabase().from("royalty_statements").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteStatement(id: string): Promise<void> {
  const { error } = await getSupabase().from("royalty_statements").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAdvances(orgId: string): Promise<Advance[]> {
  const { data, error } = await getSupabase()
    .from("artist_advances")
    .select("*")
    .eq("org_id", orgId)
    .order("paid_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toAdvance);
}

export async function createAdvance(args: {
  orgId: string;
  artistId: string;
  amount: number;
  paidOn: string;
  note?: string;
}): Promise<void> {
  const { error } = await getSupabase().from("artist_advances").insert({
    org_id: args.orgId,
    artist_id: args.artistId,
    amount: args.amount,
    paid_on: args.paidOn,
    note: args.note?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteAdvance(id: string): Promise<void> {
  const { error } = await getSupabase().from("artist_advances").delete().eq("id", id);
  if (error) throw error;
}

/** Остаток аванса: выдано минус погашено опубликованными и выплаченными отчётами. */
export function advanceBalance(artistId: string, advances: Advance[], statements: RoyaltyStatement[]) {
  const issued = advances.filter((a) => a.artist_id === artistId).reduce((s, a) => s + a.amount, 0);
  const recouped = statements
    .filter((s) => s.artist_id === artistId && s.status !== "draft")
    .reduce((s, r) => s + r.recouped, 0);
  return { issued, recouped, remaining: Math.max(0, issued - recouped) };
}

// ── Артист ─────────────────────────────────────────────────────────────────

/** Название своего лейбла — для шапки PDF. */
export async function fetchOrgName(orgId: string): Promise<string | null> {
  const { data } = await getSupabase().from("organizations").select("name").eq("id", orgId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

/** Свои опубликованные отчёты — черновики RLS не отдаёт. */
export async function fetchMyStatements(): Promise<RoyaltyStatement[]> {
  const { data, error } = await getSupabase()
    .from("royalty_statements")
    .select("*")
    .order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toStatement);
}

export async function fetchMyAdvances(): Promise<Advance[]> {
  const { data, error } = await getSupabase().from("artist_advances").select("*").order("paid_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toAdvance);
}
