"use client";

import { getSupabase } from "./client";

/**
 * Питчинг релизов и промо-кампании. Ведут администратор, менеджер,
 * маркетинг и проджект (RLS). Артист получает итоги через
 * my_release_promo() — без стоимости, контактов и заметок.
 */

export type PitchStatus = "draft" | "sent" | "in_review" | "placed" | "declined";
export type CampaignStatus = "planned" | "active" | "done" | "cancelled";
export type CampaignChannel = "influencers" | "ads" | "press" | "radio" | "offline" | "other";
export type ItemStatus = "agreed" | "published" | "cancelled";

export const PITCH_STATUSES: { key: PitchStatus; label: string }[] = [
  { key: "draft", label: "Готовим" },
  { key: "sent", label: "Отправлен" },
  { key: "in_review", label: "На рассмотрении" },
  { key: "placed", label: "Попали" },
  { key: "declined", label: "Отказ" },
];

export const CAMPAIGN_STATUSES: { key: CampaignStatus; label: string }[] = [
  { key: "planned", label: "Планируется" },
  { key: "active", label: "Идёт" },
  { key: "done", label: "Завершена" },
  { key: "cancelled", label: "Отменена" },
];

export const CHANNELS: { key: CampaignChannel; label: string }[] = [
  { key: "influencers", label: "Инфлюенсеры" },
  { key: "ads", label: "Реклама" },
  { key: "press", label: "Пресса и медиа" },
  { key: "radio", label: "Радио" },
  { key: "offline", label: "Офлайн" },
  { key: "other", label: "Другое" },
];

export const ITEM_STATUSES: { key: ItemStatus; label: string }[] = [
  { key: "agreed", label: "Договорились" },
  { key: "published", label: "Вышло" },
  { key: "cancelled", label: "Отменено" },
];

/** Куда питчат чаще всего; можно вписать своё. */
export const PITCH_TARGETS = [
  "Яндекс Музыка — редакция",
  "VK Музыка — редакция",
  "Звук — редакция",
  "МТС Музыка — редакция",
  "Spotify — редакция",
  "Apple Music — редакция",
  "Независимый плейлист",
  "Радио",
] as const;

export const pitchLabel = (s: PitchStatus) => PITCH_STATUSES.find((x) => x.key === s)?.label ?? s;
export const campaignLabel = (s: CampaignStatus) => CAMPAIGN_STATUSES.find((x) => x.key === s)?.label ?? s;
export const channelLabel = (s: CampaignChannel) => CHANNELS.find((x) => x.key === s)?.label ?? s;
export const itemLabel = (s: ItemStatus) => ITEM_STATUSES.find((x) => x.key === s)?.label ?? s;

export const PITCH_CLS: Record<PitchStatus, string> = {
  draft: "bg-[#F0EEEA] text-[#6E6D73] dark:bg-[#242327] dark:text-[#9A98A0]",
  sent: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]",
  in_review: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]",
  placed: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]",
  declined: "bg-[#F0EEEA] text-[#A6A5AB] dark:bg-[#242327] dark:text-[#6E6D73]",
};

export const CAMPAIGN_CLS: Record<CampaignStatus, string> = {
  planned: "bg-[#F0EEEA] text-[#17161A] dark:bg-[#242327] dark:text-[#F5F4F2]",
  active: "bg-[#17161A] text-white dark:bg-[#F5F4F2] dark:text-[#17161A]",
  done: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]",
  cancelled: "bg-[#F0EEEA] text-[#A6A5AB] dark:bg-[#242327] dark:text-[#6E6D73]",
};

export interface Pitch {
  id: string;
  org_id: string;
  release_id: string;
  target: string;
  curator: string | null;
  contact: string | null;
  status: PitchStatus;
  sent_on: string | null;
  result: string | null;
  result_url: string | null;
  reach: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  artist_id: string;
  release_id: string | null;
  title: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  budget: number | null;
  starts_on: string | null;
  ends_on: string | null;
  goal: string | null;
  notes: string | null;
  created_at: string;
}

export interface CampaignItem {
  id: string;
  org_id: string;
  campaign_id: string;
  name: string;
  platform: string | null;
  status: ItemStatus;
  cost: number | null;
  reach: number | null;
  url: string | null;
  published_on: string | null;
  created_at: string;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toCampaign = (r: Record<string, unknown>) => ({ ...r, budget: num(r.budget) }) as Campaign;
const toItem = (r: Record<string, unknown>) => ({ ...r, cost: num(r.cost) }) as CampaignItem;

/** Пустые строки → null, чтобы проверки ссылок в базе не падали на "". */
const clean = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])) as T;

// ── Питчинг ────────────────────────────────────────────────────────────────

export async function fetchPitches(orgId: string, releaseId?: string): Promise<Pitch[]> {
  let q = getSupabase().from("release_pitches").select("*").eq("org_id", orgId);
  if (releaseId) q = q.eq("release_id", releaseId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pitch[];
}

export type PitchInput = Partial<Omit<Pitch, "id" | "org_id" | "created_at" | "updated_at">>;

export async function createPitch(orgId: string, releaseId: string, p: PitchInput): Promise<Pitch> {
  const { data, error } = await getSupabase()
    .from("release_pitches")
    .insert(clean({ ...p, org_id: orgId, release_id: releaseId }))
    .select()
    .single();
  if (error) throw error;
  return data as Pitch;
}

export async function updatePitch(id: string, p: PitchInput): Promise<void> {
  const { error } = await getSupabase().from("release_pitches").update(clean(p)).eq("id", id);
  if (error) throw error;
}

export async function deletePitch(id: string): Promise<void> {
  const { error } = await getSupabase().from("release_pitches").delete().eq("id", id);
  if (error) throw error;
}

// ── Кампании ───────────────────────────────────────────────────────────────

export async function fetchCampaigns(orgId: string): Promise<Campaign[]> {
  const { data, error } = await getSupabase()
    .from("promo_campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("starts_on", { ascending: false, nullsFirst: true });
  if (error) throw error;
  return (data ?? []).map(toCampaign);
}

export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await getSupabase().from("promo_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCampaign(data) : null;
}

export type CampaignInput = Partial<Omit<Campaign, "id" | "org_id" | "created_at">>;

export async function createCampaign(orgId: string, c: CampaignInput): Promise<Campaign> {
  const { data, error } = await getSupabase()
    .from("promo_campaigns")
    .insert(clean({ ...c, org_id: orgId }))
    .select()
    .single();
  if (error) throw error;
  return toCampaign(data);
}

export async function updateCampaign(id: string, c: CampaignInput): Promise<void> {
  const { error } = await getSupabase().from("promo_campaigns").update(clean(c)).eq("id", id);
  if (error) throw error;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await getSupabase().from("promo_campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchItems(orgId: string, campaignId?: string): Promise<CampaignItem[]> {
  let q = getSupabase().from("campaign_items").select("*").eq("org_id", orgId);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toItem);
}

export type ItemInput = Partial<Omit<CampaignItem, "id" | "org_id" | "campaign_id" | "created_at">>;

export async function createItem(orgId: string, campaignId: string, i: ItemInput): Promise<void> {
  const { error } = await getSupabase()
    .from("campaign_items")
    .insert(clean({ ...i, org_id: orgId, campaign_id: campaignId }));
  if (error) throw error;
}

export async function updateItem(id: string, i: ItemInput): Promise<void> {
  const { error } = await getSupabase().from("campaign_items").update(clean(i)).eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("campaign_items").delete().eq("id", id);
  if (error) throw error;
}

/** Итоги кампании: потрачено, охват, цена тысячи показов. */
export function campaignTotals(items: CampaignItem[]) {
  const live = items.filter((i) => i.status !== "cancelled");
  const spent = live.reduce((t, i) => t + (i.cost ?? 0), 0);
  const published = live.filter((i) => i.status === "published");
  const reach = published.reduce((t, i) => t + (i.reach ?? 0), 0);
  return {
    spent,
    reach,
    published: published.length,
    planned: live.length,
    cpm: reach > 0 ? Math.round((spent / reach) * 1000 * 100) / 100 : null,
  };
}

// ── Артист ─────────────────────────────────────────────────────────────────

export interface ArtistPromo {
  pitches: Pick<Pitch, "id" | "target" | "curator" | "status" | "sent_on" | "result" | "result_url" | "reach">[];
  campaigns: {
    id: string;
    title: string;
    channel: CampaignChannel;
    status: CampaignStatus;
    starts_on: string | null;
    ends_on: string | null;
    goal: string | null;
    items: { name: string; platform: string | null; reach: number | null; url: string | null; published_on: string | null }[];
  }[];
}

export async function fetchMyReleasePromo(releaseId: string): Promise<ArtistPromo | null> {
  const { data, error } = await getSupabase().rpc("my_release_promo", { p_release: releaseId });
  if (error) throw error;
  return (data as ArtistPromo | null) ?? null;
}
