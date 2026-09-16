"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Megaphone, Plus, Send, Wallet, Eye, X } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { Badge, CardList, Field, ListCard, panelCls } from "@/components/label/LabelShell";
import { fetchReleases, fetchRoster, formatDate, type MyOrg, type ReleaseRow, type RosterArtist } from "@/lib/supabase/label";
import { fmtRub } from "@/lib/supabase/royalties";
import { fmtCompact } from "@/lib/label/trends";
import {
  CAMPAIGN_CLS,
  CHANNELS,
  PITCH_CLS,
  PITCH_STATUSES,
  campaignLabel,
  campaignTotals,
  channelLabel,
  createCampaign,
  fetchCampaigns,
  fetchItems,
  fetchPitches,
  pitchLabel,
  type Campaign,
  type CampaignChannel,
  type CampaignItem,
  type Pitch,
} from "@/lib/supabase/promo";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

type Tab = "campaigns" | "pitching";

/**
 * Промо и питчинг лейбла: все кампании с бюджетом и охватом и все питчи
 * по релизам. Подробности кампании — на её странице, питча — у релиза.
 */
function CampaignsInner({ org }: { org: MyOrg }) {
  const router = useRouter();
  const params = useSearchParams();
  const releaseFilter = params.get("release");
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ artistId: "", releaseId: releaseFilter ?? "", title: "", channel: "influencers" as CampaignChannel, budget: "", starts_on: "", ends_on: "", goal: "" });

  const load = useCallback(async () => {
    try {
      const [c, i, p, a, r] = await Promise.all([
        fetchCampaigns(org.org_id),
        fetchItems(org.org_id),
        fetchPitches(org.org_id),
        fetchRoster(org.org_id),
        fetchReleases(org.org_id),
      ]);
      setCampaigns(c);
      setItems(i);
      setPitches(p);
      setArtists(a);
      setReleases(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить промо");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Кампания из карточки релиза — подставляем артиста этого релиза
  useEffect(() => {
    if (!releaseFilter || !releases.length) return;
    const r = releases.find((x) => x.id === releaseFilter);
    if (r?.artist_id) setF((x) => ({ ...x, releaseId: r.id, artistId: r.artist_id as string }));
  }, [releaseFilter, releases]);

  const artistName = useMemo(() => new Map(artists.map((a) => [a.id, a.stage_name])), [artists]);
  const releaseById = useMemo(() => new Map(releases.map((r) => [r.id, r])), [releases]);
  const itemsBy = useMemo(() => {
    const m = new Map<string, CampaignItem[]>();
    for (const i of items) m.set(i.campaign_id, [...(m.get(i.campaign_id) ?? []), i]);
    return m;
  }, [items]);

  const visibleCampaigns = releaseFilter ? campaigns.filter((c) => c.release_id === releaseFilter) : campaigns;
  const visiblePitches = releaseFilter ? pitches.filter((p) => p.release_id === releaseFilter) : pitches;

  const live = visibleCampaigns.filter((c) => c.status !== "cancelled");
  const allTotals = campaignTotals(items.filter((i) => live.some((c) => c.id === i.campaign_id)));
  const budgetTotal = live.reduce((t, c) => t + (c.budget ?? 0), 0);
  const placed = visiblePitches.filter((p) => p.status === "placed");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.artistId || !f.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const budget = Number(f.budget.replace(/\s/g, "").replace(",", "."));
      const c = await createCampaign(org.org_id, {
        artist_id: f.artistId,
        release_id: f.releaseId || null,
        title: f.title,
        channel: f.channel,
        budget: f.budget.trim() && Number.isFinite(budget) ? budget : null,
        starts_on: f.starts_on || null,
        ends_on: f.ends_on || null,
        goal: f.goal,
        status: "planned",
      });
      router.push(`/label/campaigns/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать кампанию");
      setBusy(false);
    }
  };

  const artistReleases = releases.filter((r) => r.artist_id === f.artistId);
  const filterRelease = releaseFilter ? releaseById.get(releaseFilter) : null;

  const tiles = [
    { icon: Megaphone, value: String(live.filter((c) => c.status === "active").length), label: "кампаний идёт" },
    { icon: Wallet, value: budgetTotal ? `${fmtRub(allTotals.spent)} из ${fmtRub(budgetTotal)}` : fmtRub(allTotals.spent), label: "потрачено" },
    { icon: Eye, value: fmtCompact(allTotals.reach), label: "охват вышедших размещений" },
    { icon: Send, value: `${placed.length} из ${visiblePitches.filter((p) => p.status !== "draft").length}`, label: "питчей попали" },
  ];

  return (
    <LabelShell
      org={org}
      title="Промо и питчинг"
      subtitle="Кампании с инфлюенсерами и медиа, бюджет и охват, питчинг релизов в редакции"
      actions={
        <button
          onClick={() => {
            setTab("campaigns");
            setAdding((v) => !v);
          }}
          className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] hover:bg-[#2A282E] px-[14px] py-[8px] rounded-full transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.25} />
          Новая кампания
        </button>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {filterRelease && (
        <div className="inline-flex items-center gap-2 text-[12.5px] bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-full pl-[12px] pr-[4px] py-[3px] mb-4">
          Релиз: <span className="font-medium text-[#17161A] dark:text-[#F5F4F2]">{filterRelease.title}</span>
          <Link href="/label/campaigns" aria-label="Показать все" className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[#F0EEEA] dark:hover:bg-[#242327]">
            <X className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {adding && (
        <form onSubmit={submit} className={`${panelCls} p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <select value={f.artistId} onChange={(e) => setF({ ...f, artistId: e.target.value, releaseId: "" })} className={`${inputCls} cursor-pointer`}>
            <option value="">Артист *</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.stage_name}</option>
            ))}
          </select>
          <select value={f.releaseId} onChange={(e) => setF({ ...f, releaseId: e.target.value })} disabled={!f.artistId} className={`${inputCls} cursor-pointer`}>
            <option value="">Без привязки к релизу</option>
            {artistReleases.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} placeholder="Название *" className={`${inputCls} sm:col-span-2`} />
          <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as CampaignChannel })} className={`${inputCls} cursor-pointer`}>
            {CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <input inputMode="decimal" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} placeholder="Бюджет, ₽" className={inputCls} />
          <input type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} aria-label="Начало" className={inputCls} />
          <input type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} aria-label="Окончание" className={inputCls} />
          <input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} maxLength={500} placeholder="Цель — видит артист: например, 500 тыс. просмотров сниппета" className={`${inputCls} sm:col-span-2 lg:col-span-3`} />
          <button
            type="submit"
            disabled={busy || !f.artistId || !f.title.trim()}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[9px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Создать
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className={`${panelCls} p-3 flex items-center gap-2.5 min-w-0`}>
                  <span className="w-8 h-8 rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold tabular-nums truncate text-[#17161A] dark:text-[#F5F4F2]">{t.value}</span>
                    <span className="block text-[11px] text-[#6E6D73] dark:text-[#9A98A0] truncate">{t.label}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px] mb-3">
            {(
              [
                ["campaigns", `Кампании · ${visibleCampaigns.length}`],
                ["pitching", `Питчинг · ${visiblePitches.length}`],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-full transition ${
                  tab === k ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]" : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "campaigns" ? (
            <CardList empty={visibleCampaigns.length === 0 ? "Кампаний пока нет — создайте первую" : null}>
              {visibleCampaigns.map((c) => {
                const t = campaignTotals(itemsBy.get(c.id) ?? []);
                const over = c.budget !== null && t.spent > c.budget;
                return (
                  <ListCard key={c.id} href={`/label/campaigns/${c.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-[6px]">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{c.title}</div>
                        <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                          {artistName.get(c.artist_id) ?? "Артист"}
                          {c.release_id ? ` · ${releaseById.get(c.release_id)?.title ?? "релиз"}` : ""}
                        </div>
                      </div>
                      <Badge label={campaignLabel(c.status)} cls={CAMPAIGN_CLS[c.status]} />
                    </div>
                    <Field label="Канал">{channelLabel(c.channel)}</Field>
                    <Field label="Сроки">
                      {c.starts_on ? formatDate(c.starts_on) : "—"} — {c.ends_on ? formatDate(c.ends_on) : "—"}
                    </Field>
                    <Field label="Потрачено">
                      <span className={over ? "font-semibold" : ""}>
                        {fmtRub(t.spent)}
                        {c.budget !== null ? ` из ${fmtRub(c.budget)}` : ""}
                        {over ? " · сверх бюджета" : ""}
                      </span>
                    </Field>
                    <Field label="Вышло">
                      {t.published} из {t.planned} · охват {fmtCompact(t.reach)}
                    </Field>
                  </ListCard>
                );
              })}
            </CardList>
          ) : (
            <div className="space-y-4">
              {PITCH_STATUSES.map((s) => {
                const rows = visiblePitches.filter((p) => p.status === s.key);
                if (!rows.length) return null;
                return (
                  <section key={s.key}>
                    <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] mb-2">
                      {s.label} · {rows.length}
                    </h2>
                    <CardList>
                      {rows.map((p) => (
                        <ListCard key={p.id} href={`/label/releases/${p.release_id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{p.target}</div>
                              <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                                {releaseById.get(p.release_id)?.title ?? "Релиз"}
                                {p.curator ? ` · ${p.curator}` : ""}
                              </div>
                            </div>
                            <Badge label={pitchLabel(p.status)} cls={PITCH_CLS[p.status]} />
                          </div>
                          {(p.sent_on || p.result) && (
                            <div className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mt-1 truncate">
                              {[p.sent_on ? `отправлен ${formatDate(p.sent_on)}` : null, p.result, p.reach ? `охват ${fmtCompact(p.reach)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </ListCard>
                      ))}
                    </CardList>
                  </section>
                );
              })}
              {visiblePitches.length === 0 && (
                <div className={`${panelCls} px-4 py-8 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}>
                  Питчей пока нет — добавьте их на странице релиза
                </div>
              )}
            </div>
          )}
        </>
      )}
    </LabelShell>
  );
}

export default function CampaignsPage() {
  return (
    <LabelGate>
      {({ org }) => (
        <Suspense>
          <CampaignsInner org={org} />
        </Suspense>
      )}
    </LabelGate>
  );
}
