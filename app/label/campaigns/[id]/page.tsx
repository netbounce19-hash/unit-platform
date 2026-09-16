"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { Badge, panelCls } from "@/components/label/LabelShell";
import {
  fetchArtist,
  fetchPromoReports,
  fetchRelease,
  formatDate,
  promoStatusLabels,
  type ArtistRow,
  type MyOrg,
  type PromoRow,
  type ReleaseRow,
} from "@/lib/supabase/label";
import { fmtRub } from "@/lib/supabase/royalties";
import { fmtCompact } from "@/lib/label/trends";
import {
  CAMPAIGN_CLS,
  CAMPAIGN_STATUSES,
  CHANNELS,
  ITEM_STATUSES,
  campaignLabel,
  campaignTotals,
  createItem,
  deleteCampaign,
  deleteItem,
  fetchCampaign,
  fetchItems,
  itemLabel,
  updateCampaign,
  updateItem,
  type Campaign,
  type CampaignChannel,
  type CampaignItem,
  type CampaignStatus,
  type ItemStatus,
} from "@/lib/supabase/promo";

const inputCls =
  "w-full text-[13px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
// в строке размещения поля узкие — без w-full
const cellCls = inputCls.replace("w-full ", "");
const labelCls = "block text-[11.5px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-1";

const toNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

const ITEM_CLS: Record<ItemStatus, string> = {
  agreed: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]",
  published: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]",
  cancelled: "bg-[#F0EEEA] text-[#A6A5AB] dark:bg-[#242327] dark:text-[#6E6D73]",
};

function CampaignInner({ org, id }: { org: MyOrg; id: string }) {
  const router = useRouter();
  const [c, setC] = useState<Campaign | null>(null);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [release, setRelease] = useState<ReleaseRow | null>(null);
  const [reports, setReports] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ status: "planned" as CampaignStatus, channel: "influencers" as CampaignChannel, budget: "", starts_on: "", ends_on: "", goal: "", notes: "" });
  const [item, setItem] = useState({ name: "", platform: "", cost: "", reach: "", url: "" });

  const load = useCallback(async () => {
    try {
      const camp = await fetchCampaign(id);
      setC(camp);
      if (!camp) return;
      setForm({
        status: camp.status,
        channel: camp.channel,
        budget: camp.budget !== null ? String(camp.budget) : "",
        starts_on: camp.starts_on ?? "",
        ends_on: camp.ends_on ?? "",
        goal: camp.goal ?? "",
        notes: camp.notes ?? "",
      });
      const [it, a, r, rep] = await Promise.all([
        fetchItems(camp.org_id, camp.id),
        fetchArtist(camp.artist_id),
        camp.release_id ? fetchRelease(camp.release_id) : Promise.resolve(null),
        fetchPromoReports(camp.org_id, camp.artist_id),
      ]);
      setItems(it);
      setArtist(a);
      setRelease(r);
      // Отчёты артиста, которые относятся к кампании: тот же релиз и сроки
      setReports(
        rep.filter((p) => {
          if (camp.release_id && p.release_id && p.release_id !== camp.release_id) return false;
          const d = p.created_at.slice(0, 10);
          if (camp.starts_on && d < camp.starts_on) return false;
          if (camp.ends_on && d > camp.ends_on) return false;
          return true;
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить кампанию");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>, reload = true) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (reload) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <LabelShell org={org} title="Кампания">
        <div className="py-12 flex justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </LabelShell>
    );
  }
  if (!c) return <LabelShell org={org} title="Кампания не найдена">{null}</LabelShell>;

  const t = campaignTotals(items);
  const pct = c.budget ? Math.min(100, Math.round((t.spent / c.budget) * 100)) : null;
  const over = c.budget !== null && t.spent > c.budget;

  const save = () =>
    run("save", async () => {
      await updateCampaign(c.id, {
        status: form.status,
        channel: form.channel,
        budget: toNum(form.budget),
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        goal: form.goal,
        notes: form.notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.name.trim()) return;
    if (item.url && !/^https?:\/\//.test(item.url.trim())) {
      setError("Ссылка должна начинаться с https://");
      return;
    }
    run("item", async () => {
      await createItem(c.org_id, c.id, {
        name: item.name,
        platform: item.platform,
        cost: toNum(item.cost),
        reach: toNum(item.reach) !== null ? Math.round(toNum(item.reach) as number) : null,
        url: item.url,
        status: "agreed",
      });
      setItem({ name: "", platform: "", cost: "", reach: "", url: "" });
    });
  };

  return (
    <LabelShell
      org={org}
      title={c.title}
      subtitle={[artist?.stage_name, release?.title].filter(Boolean).join(" · ")}
      actions={<Badge label={campaignLabel(c.status)} cls={CAMPAIGN_CLS[c.status]} dot />}
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {[
          ["Потрачено", c.budget !== null ? `${fmtRub(t.spent)} из ${fmtRub(c.budget)}` : fmtRub(t.spent)],
          ["Вышло размещений", `${t.published} из ${t.planned}`],
          ["Охват", fmtCompact(t.reach)],
          ["Цена 1000 показов", t.cpm !== null ? fmtRub(t.cpm) : "—"],
        ].map(([k, v]) => (
          <div key={k} className={`${panelCls} px-3 py-2.5 min-w-0`}>
            <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">{k}</div>
            <div className="text-[15px] font-semibold tabular-nums truncate text-[#17161A] dark:text-[#F5F4F2]">{v}</div>
          </div>
        ))}
      </div>
      {pct !== null && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-[#ECEAE5] dark:bg-[#242327] overflow-hidden">
            <div className="h-full bg-[#17161A] dark:bg-[#F5F4F2]" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-1">
            {over ? `Сверх бюджета на ${fmtRub(t.spent - (c.budget ?? 0))}` : `Бюджет использован на ${pct}%`}
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <div className="min-w-0 space-y-4">
          {/* Размещения */}
          <section className={`${panelCls} p-4`}>
            <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-3">Размещения</h2>
            <form onSubmit={addItem} className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_110px] mb-2">
              <input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} maxLength={120} placeholder="Блогер, паблик или медиа *" className={inputCls} />
              <input value={item.platform} onChange={(e) => setItem({ ...item, platform: e.target.value })} maxLength={60} placeholder="Площадка: TikTok, VK…" className={inputCls} />
              <input inputMode="decimal" value={item.cost} onChange={(e) => setItem({ ...item, cost: e.target.value })} placeholder="Цена, ₽" className={inputCls} />
              <input inputMode="numeric" value={item.reach} onChange={(e) => setItem({ ...item, reach: e.target.value })} placeholder="Охват" className={inputCls} />
              <input value={item.url} onChange={(e) => setItem({ ...item, url: e.target.value })} placeholder="Ссылка на публикацию https://…" className={`${inputCls} sm:col-span-3`} />
              <button
                type="submit"
                disabled={busy !== null || !item.name.trim()}
                className="inline-flex items-center justify-center gap-1 text-[12.5px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[12px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
              >
                {busy === "item" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
                Добавить
              </button>
            </form>

            {items.length === 0 ? (
              <p className="text-[12.5px] text-[#A6A5AB] dark:text-[#6E6D73] py-3">Пока пусто — добавьте, с кем договорились о публикации.</p>
            ) : (
              <div className="divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327]">
                {items.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    busy={busy === i.id}
                    onPatch={(patch) => run(i.id, () => updateItem(i.id, patch))}
                    onDelete={() => run(i.id, () => deleteItem(i.id))}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Отчёты артиста */}
          <section className={`${panelCls} p-4`}>
            <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-1">Отчёты артиста</h2>
            <p className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mb-2">
              Публикации самого артиста {release ? "по этому релизу " : ""}за сроки кампании. Проверяются в разделе{" "}
              <Link href="/label/promo" className="underline underline-offset-2">«Отчёты артистов»</Link>.
            </p>
            {reports.length === 0 ? (
              <p className="text-[12.5px] text-[#A6A5AB] dark:text-[#6E6D73]">Нет отчётов за этот период</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-[#17161A] dark:text-[#F5F4F2]">{r.platform}</span>
                  <span className="text-[12px] text-[#A6A5AB] shrink-0">{formatDate(r.created_at)}</span>
                  <Badge label={promoStatusLabels[r.status].label} cls={promoStatusLabels[r.status].cls} />
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть публикацию" className="text-[#6E6D73] hover:text-[#17161A] dark:hover:text-[#F5F4F2]">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </section>
        </div>

        {/* Параметры */}
        <aside className={`${panelCls} p-4 space-y-3 lg:sticky lg:top-8`}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Статус</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })} className={`${inputCls} cursor-pointer`}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Канал</span>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as CampaignChannel })} className={`${inputCls} cursor-pointer`}>
                {CHANNELS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Начало</span>
              <input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Окончание</span>
              <input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Бюджет, ₽</span>
            <input inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Цель — видит артист</span>
            <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} maxLength={500} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Заметки — только команда</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000} className={`${inputCls} resize-y`} />
          </label>
          <button
            onClick={save}
            disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" strokeWidth={2.5} /> : null}
            {saved ? "Сохранено" : "Сохранить"}
          </button>
          <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
            Артист видит название, сроки, цель и вышедшие размещения с охватом — без стоимости и заметок.
          </p>
          <button
            onClick={() =>
              run(
                "delete",
                async () => {
                  await deleteCampaign(c.id);
                  router.push("/label/campaigns");
                },
                false
              )
            }
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Удалить кампанию
          </button>
        </aside>
      </div>
    </LabelShell>
  );
}

function ItemRow({
  item,
  busy,
  onPatch,
  onDelete,
}: {
  item: CampaignItem;
  busy: boolean;
  onPatch: (p: Partial<CampaignItem>) => void;
  onDelete: () => void;
}) {
  const [reach, setReach] = useState(item.reach !== null ? String(item.reach) : "");
  const [url, setUrl] = useState(item.url ?? "");

  return (
    <div className="py-2.5 flex flex-wrap items-center gap-2">
      <div className="min-w-[140px] flex-1">
        <div className="text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{item.name}</div>
        <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
          {[item.platform, item.cost !== null ? fmtRub(item.cost) : null, item.published_on ? `вышло ${formatDate(item.published_on)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <select
        value={item.status}
        disabled={busy}
        onChange={(e) => {
          const status = e.target.value as ItemStatus;
          onPatch({
            status,
            published_on: status === "published" ? item.published_on ?? new Date().toISOString().slice(0, 10) : null,
          });
        }}
        aria-label="Статус размещения"
        className={`text-[12px] font-medium rounded-full px-[10px] py-[4px] outline-none cursor-pointer border-0 ${ITEM_CLS[item.status]}`}
      >
        {ITEM_STATUSES.map((s) => (
          <option key={s.key} value={s.key}>{itemLabel(s.key)}</option>
        ))}
      </select>
      <input
        inputMode="numeric"
        value={reach}
        onChange={(e) => setReach(e.target.value)}
        onBlur={() => {
          const n = toNum(reach);
          if ((n === null ? null : Math.round(n)) !== item.reach) onPatch({ reach: n === null ? null : Math.round(n) });
        }}
        placeholder="охват"
        aria-label="Охват"
        className={`${cellCls} w-[96px]`}
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => {
          const v = url.trim();
          if (v === (item.url ?? "")) return;
          if (v && !/^https?:\/\//.test(v)) return;
          onPatch({ url: v || null });
        }}
        placeholder="ссылка"
        aria-label="Ссылка на публикацию"
        className={`${cellCls} w-[160px] max-w-full`}
      />
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть публикацию" className="text-[#6E6D73] hover:text-[#17161A] dark:hover:text-[#F5F4F2]">
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
      <button onClick={onDelete} disabled={busy} aria-label="Удалить размещение" className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LabelGate>{({ org }) => <CampaignInner org={org} id={id} />}</LabelGate>;
}
