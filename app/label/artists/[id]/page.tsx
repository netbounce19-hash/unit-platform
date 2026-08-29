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
  Disc3,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Calendar,
  Percent,
  Clock,
  ShieldCheck,
  ListTodo,
  FolderDown,
  Sparkles,
  type LucideIcon,
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

const KIND_CONFIG: Record<
  string,
  { icon: LucideIcon; cls: string; label: string }
> = {
  audio: {
    icon: FileAudio,
    cls: "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]",
    label: "Аудио",
  },
  photo: {
    icon: ImageIcon,
    cls: "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]",
    label: "Фото/Арт",
  },
  document: {
    icon: FileText,
    cls: "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]",
    label: "Документ",
  },
};

function Panel({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#6E6D73] dark:text-[#9A98A0]" strokeWidth={2} />}
          <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em]">
            {title}
          </h2>
          {count !== undefined && (
            <span className="text-[11px] font-medium text-[#A6A5AB] dark:text-[#6E6D73] bg-[#F0EEEA] dark:bg-[#242327] px-1.5 py-0.2 rounded-full">
              {count}
            </span>
          )}
        </div>
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
        <Link href="/label/roster" className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] hover:opacity-80">
          ← К ростеру
        </Link>
      </LabelShell>
    );
  }

  const inputCls =
    "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition";

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const overdueTasks = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const activeReleases = releases.filter((r) => r.status !== "released").length;
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <LabelShell
      org={org}
      title={artist.stage_name}
      subtitle={artist.user_id ? "Аккаунт артиста привязан" : "Приглашение ожидает принятия"}
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

      {/* Мини-KPI инфографика профиля артиста */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5">
          <div className="flex items-center gap-1 text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1">
            <Disc3 className="w-3 h-3" />
            <span>Релизы</span>
          </div>
          <div className="text-[15px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-tight">
            {releases.length}
            <span className="text-[11px] font-normal text-[#6E6D73] dark:text-[#9A98A0] ml-1">
              ({activeReleases} в работе)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5">
          <div className="flex items-center gap-1 text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1">
            <ListTodo className="w-3 h-3" />
            <span>Задачи</span>
          </div>
          <div className="text-[15px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-tight">
            {doneTasks}/{tasks.length}
            {overdueTasks > 0 && (
              <span className="text-[11px] font-medium text-[#E23A34] dark:text-[#F87171] ml-1">
                ({overdueTasks} ⚠)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5">
          <div className="flex items-center gap-1 text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1">
            <Wallet className="w-3 h-3" />
            <span>Бюджеты</span>
          </div>
          <div className="text-[15px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-tight">
            {formatMoney(totalBudget)}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="min-w-0">
          {/* Релизы */}
          <Panel title="Релизы" icon={Disc3} count={releases.length}>
            <CardList empty={releases.length === 0 ? "Релизов нет" : null}>
              {releases.map((r) => {
                const s = releaseStatusLabels[r.status] ?? {
                  label: r.status,
                  cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]",
                };
                return (
                  <ListCard key={r.id} href={`/label/releases/${r.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-[4px]">
                      <span className="text-[14px] font-medium truncate min-w-0 text-[#17161A] dark:text-[#F5F4F2] flex items-center gap-1.5">
                        <Disc3 className="w-4 h-4 text-[#6E6D73] dark:text-[#9A98A0] shrink-0" />
                        {r.title}
                      </span>
                      <Badge label={s.label} cls={s.cls} dot />
                    </div>
                    <Field label="План">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#A6A5AB]" />
                        {formatDate(r.planned_date)}
                      </span>
                    </Field>
                    {r.strategy && (
                      <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-1 flex items-start gap-1">
                        <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{r.strategy}</span>
                      </div>
                    )}
                  </ListCard>
                );
              })}
            </CardList>
          </Panel>

          {/* Задачи */}
          <Panel title="Задачи" icon={ListTodo} count={tasks.length}>
            <CardList empty={tasks.length === 0 ? "Задач нет" : null}>
              {tasks.map((t) => {
                const overdue = isOverdue(t.due_date, t.status);
                const isDone = t.status === "done";
                return (
                  <ListCard key={t.id}>
                    <div className="flex items-start justify-between gap-3 mb-[4px]">
                      <span className="text-[14px] font-medium min-w-0 text-[#17161A] dark:text-[#F5F4F2] flex items-center gap-1.5">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-[#1F9D6B] shrink-0" strokeWidth={2.2} />
                        ) : overdue ? (
                          <AlertTriangle className="w-4 h-4 text-[#E23A34] shrink-0" strokeWidth={2.2} />
                        ) : (
                          <Clock className="w-4 h-4 text-[#D97706] shrink-0" strokeWidth={2} />
                        )}
                        {t.title}
                      </span>
                      <Badge
                        label={isDone ? "Выполнена" : overdue ? "Просрочена" : "В работе"}
                        cls={
                          isDone
                            ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                            : overdue
                            ? "bg-[#FDF0EE] dark:bg-[#341B1A] text-[#E23A34] dark:text-[#F87171]"
                            : "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]"
                        }
                        dot
                      />
                    </div>
                    {t.description && (
                      <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1">
                        {t.description}
                      </div>
                    )}
                    <Field label="Дедлайн">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          overdue ? "text-[#E23A34] dark:text-[#F87171] font-medium" : ""
                        }`}
                      >
                        <Calendar className="w-3 h-3 text-[#A6A5AB]" />
                        {formatDate(t.due_date)}
                      </span>
                    </Field>
                  </ListCard>
                );
              })}
            </CardList>
          </Panel>

          {/* Заявки на бюджет */}
          <Panel title="Заявки на бюджет" icon={Wallet} count={budgets.length}>
            <CardList empty={budgets.length === 0 ? "Заявок нет" : null}>
              {budgets.map((b) => (
                <ListCard key={b.id}>
                  <div className="flex items-start justify-between gap-3 mb-[4px]">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2]">
                        {formatMoney(b.amount)}
                      </span>
                      <span className="block text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mt-[1px]">
                        {b.category || b.purpose || "—"}
                      </span>
                    </span>
                    <Badge
                      {...(budgetStatusLabels[b.status] ?? {
                        label: b.status,
                        cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]",
                      })}
                      dot
                    />
                  </div>
                  {b.needed_by && (
                    <Field label="Нужны к">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#A6A5AB]" />
                        {formatDate(b.needed_by)}
                      </span>
                    </Field>
                  )}
                </ListCard>
              ))}
            </CardList>
          </Panel>

          {/* Загрузки / Материалы */}
          <Panel title="Материалы и файлы" icon={FolderDown} count={assets.length}>
            <CardList
              empty={
                !artist.user_id
                  ? "Артист ещё не принял приглашение"
                  : assets.length === 0
                  ? "Файлов нет"
                  : null
              }
            >
              {assets.map((a) => {
                const conf = KIND_CONFIG[a.kind] ?? KIND_CONFIG.document;
                const Icon = conf.icon;
                return (
                  <ListCard key={a.id}>
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${conf.cls}`}
                      >
                        <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">
                          {a.title ?? "—"}
                        </span>
                        <span className="block text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-[1px]">
                          {conf.label} · {formatDate(a.created_at)}
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
                );
              })}
            </CardList>
          </Panel>
        </div>

        {/* Условия контракта */}
        <aside className="xl:sticky xl:top-[76px] self-start">
          <Panel title="Условия контракта" icon={ShieldCheck}>
            <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4 space-y-3">
              <label className="block">
                <span className="flex items-center gap-1 text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mb-[5px]">
                  <Percent className="w-3 h-3" />
                  Роялти артиста, %
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={terms.royalty_pct ?? ""}
                  onChange={(e) =>
                    setTerms((t) => ({
                      ...t,
                      royalty_pct: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-1 text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mb-[5px]">
                  <Calendar className="w-3 h-3" />
                  Срок контракта, мес.
                </span>
                <input
                  type="number"
                  min={0}
                  value={terms.term_months ?? ""}
                  onChange={(e) =>
                    setTerms((t) => ({
                      ...t,
                      term_months: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={Boolean(terms.exclusive)}
                  onChange={(e) => setTerms((t) => ({ ...t, exclusive: e.target.checked }))}
                  className="w-4 h-4 accent-[#17161A]"
                />
                <span className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A5A16] dark:text-[#E8B65A]" />
                  Эксклюзивный контракт
                </span>
              </label>

              <button
                onClick={saveTerms}
                disabled={termsBusy}
                className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
              >
                {termsBusy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
                {termsSaved ? (
                  <>
                    <Check className="w-4 h-4" strokeWidth={2.5} /> Сохранено
                  </>
                ) : (
                  "Сохранить условия"
                )}
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
