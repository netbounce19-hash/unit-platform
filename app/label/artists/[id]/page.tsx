"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  ExternalLink,
  FileAudio,
  ImageIcon,
  FileText,
  Check,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Field, Badge } from "@/components/label/LabelShell";
import {
  fetchArtist,
  fetchReleases,
  fetchTasks,
  fetchBudgets,
  fetchArtistAssets,
  signAssetUrl,
  updateArtistTerms,
  releaseStatusLabels,
  budgetStatusLabels,
  formatMoney,
  formatDate,
  isOverdue,
  type MyOrg,
  type ArtistRow,
  type ReleaseRow,
  type TaskRow,
  type BudgetRow,
  type ArtistAsset,
  type ArtistTerms,
} from "@/lib/supabase/label";

const KIND_ICON = {
  audio: <FileAudio className="w-[15px] h-[15px]" strokeWidth={1.75} />,
  photo: <ImageIcon className="w-[15px] h-[15px]" strokeWidth={1.75} />,
  document: <FileText className="w-[15px] h-[15px]" strokeWidth={1.75} />,
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.04em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ArtistInner({ org, artistId }: { org: MyOrg; artistId: string }) {
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [assets, setAssets] = useState<ArtistAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [terms, setTerms] = useState<ArtistTerms>({});
  const [termsBusy, setTermsBusy] = useState(false);
  const [termsSaved, setTermsSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await fetchArtist(artistId);
      setArtist(a);
      setTerms(a?.terms ?? {});

      const [r, t, b] = await Promise.all([
        fetchReleases(org.org_id, artistId),
        fetchTasks(org.org_id, artistId),
        fetchBudgets(org.org_id, artistId),
      ]);
      setReleases(r);
      setTasks(t);
      setBudgets(b);

      if (a?.user_id) setAssets(await fetchArtistAssets(a.user_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить артиста");
    } finally {
      setLoading(false);
    }
  }, [artistId, org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveTerms = async () => {
    setTermsBusy(true);
    setError(null);
    try {
      await updateArtistTerms(artistId, terms);
      setTermsSaved(true);
      setTimeout(() => setTermsSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить условия");
    } finally {
      setTermsBusy(false);
    }
  };

  const openAsset = async (path: string) => {
    const url = await signAssetUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <LabelShell org={org} title="Артист">
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      </LabelShell>
    );
  }

  if (!artist) {
    return (
      <LabelShell org={org} title="Артист не найден">
        <Link href="/label/roster" className="text-[13px] text-[#17161A] hover:opacity-80">
          ← К ростеру
        </Link>
      </LabelShell>
    );
  }

  const inputCls =
    "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition";

  return (
    <LabelShell
      org={org}
      title={artist.stage_name}
      subtitle={artist.user_id ? "Аккаунт привязан" : "Приглашение не принято"}
      actions={
        <>
          <Link
            href={`/label/tasks/new?artist=${artist.id}`}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition"
          >
            <Plus className="w-[15px] h-[15px]" strokeWidth={2} />
            Задача
          </Link>
        </>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {/* Одна колонка: в макете на 720px боковая врезка не помещается */}
      <div className="space-y-5">
        <div className="min-w-0">
          <Panel title="Релизы">
            <CardList empty={releases.length === 0 ? "Релизов нет" : null}>
              {releases.map((r) => {
                const s = releaseStatusLabels[r.status] ?? { label: r.status, cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]" };
                return (
                  <ListCard key={r.id} href={`/label/releases/${r.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-[4px]">
                      <span className="text-[14px] font-medium truncate min-w-0 dark:text-[#F5F4F2]">
                        {r.title}
                      </span>
                      <Badge label={s.label} cls={s.cls} />
                    </div>
                    <Field label="План">{formatDate(r.planned_date)}</Field>
                    {r.strategy && (
                      <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-1">
                        {r.strategy}
                      </div>
                    )}
                  </ListCard>
                );
              })}
            </CardList>
          </Panel>

          <Panel title="Задачи">
            <CardList empty={tasks.length === 0 ? "Задач нет" : null}>
              {tasks.map((t) => (
                <ListCard key={t.id}>
                  <div className="flex items-start justify-between gap-3 mb-[4px]">
                    <span className="text-[14px] font-medium min-w-0 dark:text-[#F5F4F2]">
                      {t.title}
                    </span>
                    <Badge
                      label={t.status === "done" ? "Выполнена" : isOverdue(t.due_date, t.status) ? "Просрочена" : "В работе"}
                      cls={
                        t.status === "done"
                          ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                          : isOverdue(t.due_date, t.status)
                          ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]"
                          : "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]"
                      }
                    />
                  </div>
                  {t.description && (
                    <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1">
                      {t.description}
                    </div>
                  )}
                  <Field label="Дедлайн">
                    <span
                      className={
                        isOverdue(t.due_date, t.status)
                          ? "text-[#17161A] dark:text-[#F5F4F2] font-medium"
                          : ""
                      }
                    >
                      {formatDate(t.due_date)}
                    </span>
                  </Field>
                </ListCard>
              ))}
            </CardList>
          </Panel>

          <Panel title="Заявки">
            <CardList empty={budgets.length === 0 ? "Заявок нет" : null}>
              {budgets.map((b) => (
                <ListCard key={b.id}>
                  <div className="flex items-start justify-between gap-3 mb-[4px]">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium dark:text-[#F5F4F2]">
                        {formatMoney(b.amount)}
                      </span>
                      <span className="block text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-[1px]">
                        {b.category || b.purpose || "—"}
                      </span>
                    </span>
                    <Badge {...(budgetStatusLabels[b.status] ?? { label: b.status, cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]" })} />
                  </div>
                  {b.needed_by && <Field label="Нужны к">{formatDate(b.needed_by)}</Field>}
                </ListCard>
              ))}
            </CardList>
          </Panel>

          <Panel title="Загрузки">
            <CardList
              empty={
                !artist.user_id
                  ? "Артист ещё не принял приглашение"
                  : assets.length === 0
                  ? "Файлов нет"
                  : null
              }
            >
              {assets.map((a) => (
                <ListCard key={a.id}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[12px] bg-[#F0EEEA] dark:bg-[#242327] text-[#6E6D73] dark:text-[#9A98A0] flex items-center justify-center shrink-0">
                      {KIND_ICON[a.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium truncate dark:text-[#F5F4F2]">
                        {a.title ?? "—"}
                      </span>
                      <span className="block text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-[1px]">
                        {a.kind} · {formatDate(a.created_at)}
                      </span>
                    </span>
                    <button
                      onClick={() => openAsset(a.storage_path)}
                      aria-label="Открыть файл"
                      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#6E6D73] dark:text-[#9A98A0] hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </ListCard>
              ))}
            </CardList>
          </Panel>
        </div>

        {/* Условия */}
        <aside className="xl:sticky xl:top-[76px] self-start">
          <Panel title="Условия">
            <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4 space-y-3">
              <label className="block">
                <span className="block text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mb-[5px]">Роялти, %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={terms.royalty_pct ?? ""}
                  onChange={(e) =>
                    setTerms((t) => ({ ...t, royalty_pct: e.target.value === "" ? undefined : Number(e.target.value) }))
                  }
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="block text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mb-[5px]">Срок, мес.</span>
                <input
                  type="number"
                  min={0}
                  value={terms.term_months ?? ""}
                  onChange={(e) =>
                    setTerms((t) => ({ ...t, term_months: e.target.value === "" ? undefined : Number(e.target.value) }))
                  }
                  className={inputCls}
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(terms.exclusive)}
                  onChange={(e) => setTerms((t) => ({ ...t, exclusive: e.target.checked }))}
                  className="w-4 h-4 accent-[#17161A]"
                />
                <span className="text-[13px]">Эксклюзив</span>
              </label>

              <button
                onClick={saveTerms}
                disabled={termsBusy}
                className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
              >
                {termsBusy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
                {termsSaved ? <><Check className="w-4 h-4" strokeWidth={2.5} /> Сохранено</> : "Сохранить"}
              </button>
            </div>
          </Panel>
        </aside>
      </div>
    </LabelShell>
  );
}

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LabelGate>{({ org }) => <ArtistInner org={org} artistId={id} />}</LabelGate>;
}
