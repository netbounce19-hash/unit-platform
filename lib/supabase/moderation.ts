"use client";

import { getSupabase } from "./client";

/**
 * Модерация контента перед отгрузкой.
 *
 * Проверку проводит сотрудник лейбла вручную: слушает трек, отмечает пункты
 * чек-листа и выносит решение. База сама не пустит релиз в отгрузку без
 * пройденной модерации и не даст артисту поменять её поля
 * (guard_release_decision).
 */

export type ModerationStatus = "pending" | "passed" | "needs_changes";

export type ModerationCheckKey = "lyrics" | "drugs" | "violence" | "profanity";

export type ModerationChecks = Partial<Record<ModerationCheckKey, boolean>>;

export const MODERATION_CHECKS: { key: ModerationCheckKey; label: string; hint: string }[] = [
  { key: "lyrics", label: "Трек прослушан целиком", hint: "Текст и вокал, включая скиты и бэки" },
  { key: "drugs", label: "Нет пропаганды наркотиков", hint: "Упоминания, призывы, романтизация" },
  { key: "violence", label: "Нет призывов к насилию и экстремизму", hint: "И оправдания таких действий" },
  {
    key: "profanity",
    label: "Мат отмечен знаком 18+ или его нет",
    hint: "Для площадок с детской аудиторией нужна цензурная версия",
  },
];

export const moderationLabels: Record<ModerationStatus, { label: string; cls: string }> = {
  pending: { label: "Ждёт модерации", cls: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]" },
  passed: { label: "Модерация пройдена", cls: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]" },
  needs_changes: {
    label: "Нужны правки",
    cls: "bg-[#F0EEEA] text-[#17161A] dark:bg-[#242327] dark:text-[#F5F4F2]",
  },
};

export const allChecksDone = (c: ModerationChecks) => MODERATION_CHECKS.every((k) => c[k.key] === true);

export interface ModerationRow {
  id: string;
  org_id: string | null;
  artist_id: string | null;
  title: string;
  status: string;
  planned_date: string | null;
  moderation_status: ModerationStatus;
  moderation_checks: ModerationChecks;
  is_explicit: boolean;
  moderation_comment: string | null;
  moderated_at: string | null;
  created_at: string;
}

const COLS =
  "id, org_id, artist_id, title, status, planned_date, moderation_status, moderation_checks, is_explicit, moderation_comment, moderated_at, created_at";

/** Очередь модерации: всё непроверенное, включая уже вышедший каталог. */
export async function fetchModerationQueue(orgId: string): Promise<ModerationRow[]> {
  const { data, error } = await getSupabase()
    .from("releases")
    .select(COLS)
    .eq("org_id", orgId)
    .neq("status", "rejected")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ModerationRow[];
}

/** Сохранить промежуточное состояние чек-листа, не вынося решения. */
export async function saveModerationChecks(
  releaseId: string,
  checks: ModerationChecks,
  isExplicit: boolean
): Promise<void> {
  const { error } = await getSupabase()
    .from("releases")
    .update({ moderation_checks: checks, is_explicit: isExplicit })
    .eq("id", releaseId);
  if (error) throw error;
}

export async function decideModeration(args: {
  releaseId: string;
  decision: "passed" | "needs_changes";
  checks: ModerationChecks;
  isExplicit: boolean;
  comment?: string;
}): Promise<void> {
  if (args.decision === "passed" && !allChecksDone(args.checks)) {
    throw new Error("Отметьте все пункты чек-листа");
  }
  if (args.decision === "needs_changes" && !args.comment?.trim()) {
    throw new Error("Напишите артисту, что нужно исправить");
  }
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("releases")
    .update({
      moderation_status: args.decision,
      moderation_checks: args.checks,
      is_explicit: args.isExplicit,
      moderation_comment: args.comment?.trim() || null,
      moderated_by: user?.id ?? null,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", args.releaseId);
  if (error) throw error;
}

/** Отгрузка и выход. База откажет, если модерация не пройдена. */
export async function setReleaseStage(releaseId: string, status: "in_progress" | "released"): Promise<void> {
  const { error } = await getSupabase().from("releases").update({ status }).eq("id", releaseId);
  if (error) throw error;
}
