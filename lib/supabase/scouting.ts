"use client";

import { getSupabase } from "./client";
import { createInvite, type InviteRow } from "./label";

/**
 * Скаутинг: демо от артистов вне ростера и воронка A&R.
 * Публичная форма пишет только через submit_demo() — с проверкой полей,
 * согласием на обработку данных и ограничением частоты.
 */

export type DemoStatus = "new" | "listening" | "shortlist" | "offer" | "signed" | "declined";

export const DEMO_STATUSES: { key: DemoStatus; label: string; hint: string }[] = [
  { key: "new", label: "Новые", hint: "Ещё никто не слушал" },
  { key: "listening", label: "Слушаем", hint: "Взяли в работу" },
  { key: "shortlist", label: "Шортлист", hint: "Стоит обсудить с командой" },
  { key: "offer", label: "Предложение", hint: "Обсуждаем условия" },
  { key: "signed", label: "Подписан", hint: "Можно звать в кабинет" },
  { key: "declined", label: "Отказ", hint: "Не сейчас" },
];

export const demoStatusLabel = (s: DemoStatus) => DEMO_STATUSES.find((x) => x.key === s)?.label ?? s;

export interface DemoSubmission {
  id: string;
  org_id: string;
  source: "form" | "scout";
  artist_name: string;
  contact_name: string | null;
  email: string | null;
  telegram: string | null;
  city: string | null;
  genre: string | null;
  track_url: string;
  links: string[];
  followers: number | null;
  monthly_listeners: number | null;
  message: string | null;
  status: DemoStatus;
  rating: number | null;
  notes: string | null;
  invite_id: string | null;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface LabelSubmissionSettings {
  slug: string | null;
  submissions_open: boolean;
  submissions_intro: string | null;
}

// ── Публичная форма ────────────────────────────────────────────────────────

export async function fetchPublicLabel(
  slug: string
): Promise<{ name: string; submissions_open: boolean; submissions_intro: string | null } | null> {
  const { data, error } = await getSupabase().rpc("public_label", { p_slug: slug });
  if (error) throw error;
  return (data as { name: string; submissions_open: boolean; submissions_intro: string | null }[])?.[0] ?? null;
}

export interface DemoForm {
  artistName: string;
  email: string;
  trackUrl: string;
  consent: boolean;
  contactName?: string;
  telegram?: string;
  city?: string;
  genre?: string;
  links?: string[];
  followers?: number | null;
  monthlyListeners?: number | null;
  message?: string;
}

export async function submitDemo(slug: string, f: DemoForm): Promise<void> {
  const { error } = await getSupabase().rpc("submit_demo", {
    p_slug: slug,
    p_artist_name: f.artistName,
    p_email: f.email,
    p_track_url: f.trackUrl,
    p_consent: f.consent,
    p_contact_name: f.contactName || null,
    p_telegram: f.telegram || null,
    p_city: f.city || null,
    p_genre: f.genre || null,
    p_links: (f.links ?? []).filter(Boolean),
    p_followers: f.followers ?? null,
    p_monthly_listeners: f.monthlyListeners ?? null,
    p_message: f.message || null,
  });
  if (error) throw new Error(error.message);
}

// ── Кабинет лейбла ─────────────────────────────────────────────────────────

export async function fetchSubmissions(orgId: string): Promise<DemoSubmission[]> {
  const { data, error } = await getSupabase()
    .from("demo_submissions")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DemoSubmission[];
}

export async function updateSubmission(
  id: string,
  patch: Partial<Pick<DemoSubmission, "status" | "rating" | "notes">>
): Promise<void> {
  const { error } = await getSupabase().from("demo_submissions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await getSupabase().from("demo_submissions").delete().eq("id", id);
  if (error) throw error;
}

/** Находка скаута — артист, которого команда нашла сама. */
export async function createScoutFind(args: {
  orgId: string;
  artistName: string;
  trackUrl: string;
  email?: string;
  telegram?: string;
  city?: string;
  genre?: string;
  followers?: number | null;
  monthlyListeners?: number | null;
  notes?: string;
}): Promise<DemoSubmission> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("demo_submissions")
    .insert({
      org_id: args.orgId,
      source: "scout",
      artist_name: args.artistName.trim(),
      track_url: args.trackUrl.trim(),
      email: args.email?.trim().toLowerCase() || null,
      telegram: args.telegram?.trim().replace(/^@/, "") || null,
      city: args.city?.trim() || null,
      genre: args.genre?.trim() || null,
      followers: args.followers ?? null,
      monthly_listeners: args.monthlyListeners ?? null,
      notes: args.notes?.trim() || null,
      status: "listening",
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DemoSubmission;
}

/**
 * Подписанного артиста зовём в кабинет: приглашение на его почту и связь
 * с заявкой, чтобы было видно, откуда он пришёл.
 */
export async function inviteFromSubmission(sub: DemoSubmission): Promise<InviteRow> {
  if (!sub.email) throw new Error("У заявки нет почты — добавьте её, чтобы отправить приглашение");
  const invite = await createInvite(sub.org_id, sub.email);
  const { error } = await getSupabase().from("demo_submissions").update({ invite_id: invite.id }).eq("id", sub.id);
  if (error) throw error;
  return invite;
}

export async function fetchSubmissionSettings(orgId: string): Promise<LabelSubmissionSettings> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .select("slug, submissions_open, submissions_intro")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data as LabelSubmissionSettings;
}

export async function saveSubmissionSettings(orgId: string, s: LabelSubmissionSettings): Promise<void> {
  const slug = s.slug?.trim().toLowerCase() || null;
  if (slug && !/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) {
    throw new Error("Адрес: 3–40 символов, латиница, цифры и дефис");
  }
  if (s.submissions_open && !slug) throw new Error("Чтобы открыть приём, задайте адрес страницы");
  const { error } = await getSupabase()
    .from("organizations")
    .update({ slug, submissions_open: s.submissions_open, submissions_intro: s.submissions_intro?.trim() || null })
    .eq("id", orgId);
  if (error) {
    if (error.code === "23505") throw new Error("Этот адрес уже занят другим лейблом");
    throw error;
  }
}

export const submitUrl = (slug: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/submit/${slug}`;
