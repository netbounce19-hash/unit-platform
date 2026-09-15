"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Wallet, CalendarClock, AlertTriangle, CheckCircle2, Trash2, HandCoins } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Field, Badge, panelCls } from "@/components/label/LabelShell";
import { fetchRoster, formatDate, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import {
  advanceBalance,
  createAdvance,
  deleteAdvance,
  fetchAdvances,
  fetchStatements,
  fmtPeriod,
  fmtRub,
  setStatementStatus,
  statementLabels,
  type Advance,
  type RoyaltyStatement,
  type StatementStatus,
} from "@/lib/supabase/royalties";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

type Filter = "all" | StatementStatus;

/**
 * Роялти лейбла: что и кому нужно выплатить и к какому сроку, авансы и
 * все отчёты. График выплат — главное на экране: молодые лейблы чаще всего
 * закрываются не из-за релизов, а из-за того, что к сроку не хватило денег.
 */
function RoyaltiesInner({ org }: { org: MyOrg }) {
  const [statements, setStatements] = useState<RoyaltyStatement[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [advOpen, setAdvOpen] = useState(false);
  const [adv, setAdv] = useState({ artistId: "", amount: "", paidOn: new Date().toISOString().slice(0, 10), note: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a, r] = await Promise.all([
        fetchStatements(org.org_id),
        fetchAdvances(org.org_id),
        fetchRoster(org.org_id),
      ]);
      setStatements(s);
      setAdvances(a);
      setArtists(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить роялти");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => new Map(artists.map((a) => [a.id, a.stage_name])), [artists]);
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);

  const toPay = statements
    .filter((s) => s.status === "published")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const overdue = toPay.filter((s) => s.due_date && s.due_date < today);
  const sum = (xs: RoyaltyStatement[]) => xs.reduce((t, s) => t + s.payout, 0);
  const paidThisYear = statements.filter((s) => s.status === "paid" && (s.paid_at ?? "").startsWith(year));
  const drafts = statements.filter((s) => s.status === "draft");

  const withAdvances = artists.filter((a) => advances.some((x) => x.artist_id === a.id));
  const visible = filter === "all" ? statements : statements.filter((s) => s.status === filter);

  const markPaid = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await setStatementStatus(id, "paid");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отметить выплату");
    } finally {
      setBusy(null);
    }
  };

  const submitAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(adv.amount.replace(/\s/g, "").replace(",", "."));
    if (!adv.artistId || !(amount > 0)) return;
    setBusy("advance");
    setError(null);
    try {
      await createAdvance({ orgId: org.org_id, artistId: adv.artistId, amount, paidOn: adv.paidOn, note: adv.note });
      setAdv({ artistId: "", amount: "", paidOn: today, note: "" });
      setAdvOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить аванс");
    } finally {
      setBusy(null);
    }
  };

  const removeAdvance = async (id: string) => {
    setBusy(id);
    try {
      await deleteAdvance(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить аванс");
    } finally {
      setBusy(null);
    }
  };

  const tiles = [
    { label: "к выплате", value: fmtRub(sum(toPay)), hint: `${toPay.length} отчётов`, icon: Wallet },
    { label: "просрочено", value: fmtRub(sum(overdue)), hint: overdue.length ? `${overdue.length} отчётов` : "всё в срок", icon: AlertTriangle },
    { label: `выплачено в ${year}`, value: fmtRub(sum(paidThisYear)), hint: `${paidThisYear.length} отчётов`, icon: CheckCircle2 },
  ];

  return (
    <LabelShell
      org={org}
      title="Роялти"
      subtitle="Отчёты артистам, авансы и график выплат"
      actions={
        <>
          <button
            onClick={() => setAdvOpen((v) => !v)}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] bg-white dark:bg-[#1A191D] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition"
          >
            <HandCoins className="w-4 h-4" strokeWidth={1.75} />
            Выдать аванс
          </button>
          <Link
            href="/label/royalties/new"
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] hover:bg-[#2A282E] px-[14px] py-[8px] rounded-full transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Новый отчёт
          </Link>
        </>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {advOpen && (
        <form onSubmit={submitAdvance} className={`${panelCls} p-4 mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.6fr_auto] lg:items-end`}>
          <label className="block">
            <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]">Артист</span>
            <select value={adv.artistId} onChange={(e) => setAdv({ ...adv, artistId: e.target.value })} className={`${inputCls} cursor-pointer`}>
              <option value="">Выберите артиста</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.stage_name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]">Сумма, ₽</span>
            <input inputMode="decimal" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} placeholder="100 000" className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]">Дата выдачи</span>
            <input type="date" value={adv.paidOn} onChange={(e) => setAdv({ ...adv, paidOn: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]">Комментарий</span>
            <input value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} placeholder="Например: аванс по договору на альбом" className={inputCls} />
          </label>
          <button
            type="submit"
            disabled={busy === "advance" || !adv.artistId || !adv.amount}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[9px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy === "advance" && <Loader2 className="w-4 h-4 animate-spin" />}
            Сохранить
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className={`${panelCls} p-3 flex items-center gap-3`}>
                  <span className="w-9 h-9 rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] truncate">{t.value}</span>
                    <span className="block text-[11.5px] text-[#6E6D73] dark:text-[#9A98A0]">
                      {t.label} · {t.hint}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
            <div className="min-w-0 space-y-4">
              {/* График выплат */}
              <section className={`${panelCls} p-4`}>
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-1">
                  <CalendarClock className="w-4 h-4" strokeWidth={1.75} />
                  График выплат
                </h2>
                <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-3">
                  Опубликованные отчёты по сроку. К этим датам деньги должны быть на счету.
                </p>
                {toPay.length === 0 ? (
                  <div className="py-6 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">Ничего не ждёт выплаты</div>
                ) : (
                  <div className="divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327]">
                    {toPay.map((s) => {
                      const late = s.due_date && s.due_date < today;
                      return (
                        <div key={s.id} className="flex items-center gap-3 py-[10px]">
                          <div className={`w-[74px] shrink-0 text-[12.5px] tabular-nums ${late ? "font-semibold text-[#17161A] dark:text-[#F5F4F2]" : "text-[#6E6D73] dark:text-[#9A98A0]"}`}>
                            {s.due_date ? formatDate(s.due_date) : "без срока"}
                            {late && <span className="block text-[11px] font-medium">просрочено</span>}
                          </div>
                          <Link href={`/label/royalties/${s.id}`} className="min-w-0 flex-1 hover:opacity-80">
                            <span className="block text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">
                              {nameOf.get(s.artist_id) ?? "Артист"}
                            </span>
                            <span className="block text-[12px] text-[#A6A5AB] dark:text-[#6E6D73]">{fmtPeriod(s.period_start, s.period_end)}</span>
                          </Link>
                          <span className="text-[13.5px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] shrink-0">{fmtRub(s.payout)}</span>
                          <button
                            onClick={() => markPaid(s.id)}
                            disabled={busy !== null}
                            className="shrink-0 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[12px] py-[6px] rounded-full transition disabled:opacity-40"
                          >
                            {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Выплачено"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Все отчёты */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2]">Отчёты</h2>
                  <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px]">
                    {(
                      [
                        { key: "all", label: `Все (${statements.length})` },
                        { key: "draft", label: `Черновики (${drafts.length})` },
                        { key: "published", label: `К выплате (${toPay.length})` },
                        { key: "paid", label: "Выплачено" },
                      ] as { key: Filter; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-full transition ${
                          filter === f.key
                            ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]"
                            : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <CardList empty={visible.length === 0 ? "Отчётов пока нет — создайте первый" : null}>
                  {visible.map((s) => (
                    <ListCard key={s.id} href={`/label/royalties/${s.id}`}>
                      <div className="flex items-start justify-between gap-3 mb-[6px]">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{nameOf.get(s.artist_id) ?? "Артист"}</div>
                          <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73]">{fmtPeriod(s.period_start, s.period_end)}</div>
                        </div>
                        <Badge label={statementLabels[s.status].label} cls={statementLabels[s.status].cls} dot />
                      </div>
                      <Field label="Доход">{fmtRub(s.gross)}</Field>
                      <Field label={`Артисту, ${s.share_pct}%`}>{fmtRub(s.royalty)}</Field>
                      {s.recouped > 0 && <Field label="Зачёт аванса">− {fmtRub(s.recouped)}</Field>}
                      <Field label="К выплате">
                        <span className="font-semibold">{fmtRub(s.payout)}</span>
                      </Field>
                    </ListCard>
                  ))}
                </CardList>
              </section>
            </div>

            {/* Авансы */}
            <aside className={`${panelCls} p-4 mt-4 lg:mt-0 lg:sticky lg:top-8`}>
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-1">
                <HandCoins className="w-4 h-4" strokeWidth={1.75} />
                Авансы
              </h2>
              <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-3">
                Остаток гасится из доли артиста в опубликованных отчётах.
              </p>
              {withAdvances.length === 0 ? (
                <div className="py-4 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">Авансов не выдавали</div>
              ) : (
                <div className="space-y-3">
                  {withAdvances.map((a) => {
                    const b = advanceBalance(a.id, advances, statements);
                    const pct = b.issued ? Math.round((b.recouped / b.issued) * 100) : 0;
                    return (
                      <div key={a.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{a.stage_name}</span>
                          <span className="text-[12.5px] tabular-nums text-[#6E6D73] dark:text-[#9A98A0] shrink-0">
                            осталось {fmtRub(b.remaining)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#ECEAE5] dark:bg-[#242327] overflow-hidden mt-1.5">
                          <div className="h-full bg-[#17161A] dark:bg-[#F5F4F2]" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-1">
                          выдано {fmtRub(b.issued)} · погашено {fmtRub(b.recouped)}
                        </div>
                        {advances
                          .filter((x) => x.artist_id === a.id)
                          .map((x) => (
                            <div key={x.id} className="flex items-center gap-2 text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mt-1">
                              <span className="tabular-nums">{formatDate(x.paid_on)}</span>
                              <span className="truncate flex-1">{x.note ?? ""}</span>
                              <span className="tabular-nums">{fmtRub(x.amount)}</span>
                              <button
                                onClick={() => removeAdvance(x.id)}
                                disabled={busy !== null}
                                aria-label="Удалить аванс"
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C3C8] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </LabelShell>
  );
}

export default function RoyaltiesPage() {
  return <LabelGate>{({ org }) => <RoyaltiesInner org={org} />}</LabelGate>;
}
