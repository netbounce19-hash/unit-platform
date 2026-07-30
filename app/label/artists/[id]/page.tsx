"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Plus,
  ExternalLink,
  FileAudio,
  ImageIcon,
  FileText,
  Check,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { DataTable, Badge } from "@/components/label/LabelShell";
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
        <h2 className="text-[13px] font-semibold text-[#6E6D73] uppercase tracking-[0.04em]">{title}</h2>
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
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      </LabelShell>
    );
  }

  if (!artist) {
    return (
      <LabelShell org={org} title="Артист не найден">
        <Link href="/label/roster" className="text-[13px] text-[#E23A34] hover:opacity-80">
          ← К ростеру
        </Link>
      </LabelShell>
    );
  }

  const inputCls =
    "w-full text-[13.5px] rounded-[9px] border border-[#E5E3DE] bg-white px-3 py-[8px] outline-none focus:border-[#E23A34] transition";

  return (
    <LabelShell
      org={org}
      title={artist.stage_name}
      subtitle={artist.user_id ? "Аккаунт привязан" : "Приглашение не принято"}
      actions={
        <>
          <Link
            href="/label/roster"
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#6E6D73] px-[12px] py-[8px] rounded-[9px] hover:bg-[#F0EEEA] transition"
          >
            <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={1.75} />
            Ростер
          </Link>
          <Link
            href={`/label/tasks/new?artist=${artist.id}`}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#E23A34] text-white px-[13px] py-[8px] rounded-[9px] hover:brightness-95 transition"
          >
            <Plus className="w-[15px] h-[15px]" strokeWidth={2} />
            Задача
          </Link>
        </>
      }
    >
      {error && (
        <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        <div className="min-w-0">
          <Panel title="Релизы">
            <DataTable
              head={["Название", "Статус", "План", "Стратегия"]}
              empty={releases.length === 0 ? "Релизов нет" : null}
            >
              {releases.map((r) => {
                const s = releaseStatusLabels[r.status] ?? { label: r.status, cls: "bg-[#F0EEEA] text-[#6E6D73]" };
                return (
                  <tr key={r.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
                    <td className="px-4 py-[10px]">
                      <Link href={`/label/releases/${r.id}`} className="font-medium hover:text-[#E23A34] transition">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-[10px]"><Badge label={s.label} cls={s.cls} /></td>
                    <td className="px-4 py-[10px] text-[#6E6D73]">{formatDate(r.planned_date)}</td>
                    <td className="px-4 py-[10px] text-[#A6A5AB] truncate max-w-[220px]">
                      {r.strategy || "—"}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </Panel>

          <Panel title="Задачи">
            <DataTable
              head={["Задача", "Дедлайн", "Статус"]}
              empty={tasks.length === 0 ? "Задач нет" : null}
            >
              {tasks.map((t) => (
                <tr key={t.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
                  <td className="px-4 py-[10px]">
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-[12px] text-[#A6A5AB] truncate max-w-[380px]">{t.description}</div>
                    )}
                  </td>
                  <td className={`px-4 py-[10px] ${isOverdue(t.due_date, t.status) ? "text-[#A62018] font-medium" : "text-[#6E6D73]"}`}>
                    {formatDate(t.due_date)}
                  </td>
                  <td className="px-4 py-[10px]">
                    <Badge
                      label={t.status === "done" ? "Выполнена" : isOverdue(t.due_date, t.status) ? "Просрочена" : "В работе"}
                      cls={
                        t.status === "done"
                          ? "bg-[#E9F6EF] text-[#166B49]"
                          : isOverdue(t.due_date, t.status)
                          ? "bg-[#FDEDEB] text-[#A62018]"
                          : "bg-[#FBF1DE] text-[#8A5A16]"
                      }
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>

          <Panel title="Заявки">
            <DataTable
              head={["Назначение", "Сумма", "Статус"]}
              empty={budgets.length === 0 ? "Заявок нет" : null}
            >
              {budgets.map((b) => (
                <tr key={b.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
                  <td className="px-4 py-[10px]">{b.category || b.purpose || "—"}</td>
                  <td className="px-4 py-[10px] font-medium">{formatMoney(b.amount)}</td>
                  <td className="px-4 py-[10px]">
                    <Badge {...(budgetStatusLabels[b.status] ?? { label: b.status, cls: "bg-[#F0EEEA] text-[#6E6D73]" })} />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>

          <Panel title="Загрузки">
            <DataTable
              head={["Файл", "Тип", "Загружен", ""]}
              empty={
                !artist.user_id
                  ? "Артист ещё не принял приглашение"
                  : assets.length === 0
                  ? "Файлов нет"
                  : null
              }
            >
              {assets.map((a) => (
                <tr key={a.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
                  <td className="px-4 py-[10px] font-medium truncate max-w-[300px]">{a.title ?? "—"}</td>
                  <td className="px-4 py-[10px] text-[#6E6D73]">
                    <span className="inline-flex items-center gap-[6px]">
                      {KIND_ICON[a.kind]}
                      {a.kind}
                    </span>
                  </td>
                  <td className="px-4 py-[10px] text-[#6E6D73]">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-[10px] text-right">
                    <button
                      onClick={() => openAsset(a.storage_path)}
                      aria-label="Открыть файл"
                      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>

        {/* Условия */}
        <aside className="xl:sticky xl:top-[76px] self-start">
          <Panel title="Условия">
            <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4 space-y-3">
              <label className="block">
                <span className="block text-[12px] text-[#6E6D73] mb-[5px]">Роялти, %</span>
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
                <span className="block text-[12px] text-[#6E6D73] mb-[5px]">Срок, мес.</span>
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
                  className="w-4 h-4 accent-[#E23A34]"
                />
                <span className="text-[13px]">Эксклюзив</span>
              </label>

              <button
                onClick={saveTerms}
                disabled={termsBusy}
                className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#E23A34] text-white px-[14px] py-[9px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
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
