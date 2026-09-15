"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Send, CheckCircle2, RotateCcw, FileDown, Check } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { Badge, panelCls } from "@/components/label/LabelShell";
import { fetchArtist, formatDate, type ArtistRow, type MyOrg } from "@/lib/supabase/label";
import {
  ROYALTY_SOURCES,
  advanceBalance,
  deleteStatement,
  fetchAdvances,
  fetchLines,
  fetchStatement,
  fetchStatements,
  fmtPeriod,
  fmtRub,
  replaceLines,
  setStatementStatus,
  statementLabels,
  updateStatementDraft,
  type RoyaltyStatement,
  type StatementStatus,
} from "@/lib/supabase/royalties";
import { downloadRoyaltyPdf } from "@/lib/pdf/royaltyPdf";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8] disabled:bg-[#FAFAF9] dark:disabled:bg-[#232227] disabled:text-[#6E6D73]";
const labelCls = "block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]";

interface DraftLine {
  key: string;
  source: string;
  streams: string;
  revenue: string;
}

const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
let seq = 0;
const newKey = () => `l${++seq}`;

function StatementInner({ org, id }: { org: MyOrg; id: string }) {
  const router = useRouter();
  const [s, setS] = useState<RoyaltyStatement | null>(null);
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [share, setShare] = useState("");
  const [deductions, setDeductions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await fetchStatement(id);
      setS(st);
      if (!st) return;
      const [ls, a, adv, all] = await Promise.all([
        fetchLines(id),
        fetchArtist(st.artist_id),
        fetchAdvances(st.org_id),
        fetchStatements(st.org_id, st.artist_id),
      ]);
      setArtist(a);
      setLines(ls.map((l) => ({ key: newKey(), source: l.source, streams: String(l.streams || ""), revenue: String(l.revenue || "") })));
      setShare(String(st.share_pct));
      setDeductions(st.deductions ? String(st.deductions) : "");
      setDueDate(st.due_date ?? "");
      setNote(st.note ?? "");
      setRemaining(advanceBalance(st.artist_id, adv, all).remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить отчёт");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      await updateStatementDraft(id, {
        sharePct: toNum(share),
        deductions: toNum(deductions),
        dueDate: dueDate || null,
        note,
      });
      await replaceLines(
        id,
        lines.map((l) => ({ source: l.source, streams: toNum(l.streams), revenue: toNum(l.revenue) }))
      );
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  const moveTo = (status: StatementStatus) =>
    run(status, async () => {
      await setStatementStatus(id, status);
      await load();
    });

  if (loading) {
    return (
      <LabelShell org={org} title="Отчёт по роялти">
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </LabelShell>
    );
  }
  if (!s) {
    return <LabelShell org={org} title="Отчёт не найден">{null}</LabelShell>;
  }

  const draft = s.status === "draft";
  const period = fmtPeriod(s.period_start, s.period_end);
  const dirtyGross = lines.reduce((t, l) => t + toNum(l.revenue), 0);
  const unsaved = draft && Math.abs(dirtyGross - s.gross) > 0.004;

  return (
    <LabelShell
      org={org}
      title={`${artist?.stage_name ?? "Артист"} · ${period}`}
      subtitle={draft ? "Черновик виден только лейблу" : s.status === "published" ? "Опубликован — артист видит отчёт" : `Выплачено ${s.paid_at ? formatDate(s.paid_at) : ""}`}
      actions={
        <button
          onClick={() =>
            run("pdf", () =>
              downloadRoyaltyPdf({
                statement: s,
                lines: lines.map((l) => ({ id: l.key, statement_id: id, source: l.source, streams: toNum(l.streams), revenue: toNum(l.revenue) })),
                artistName: artist?.stage_name ?? "Артист",
                labelName: org.name,
                advanceRemaining: remaining,
              })
            )
          }
          disabled={busy !== null || unsaved}
          title={unsaved ? "Сначала сохраните изменения" : undefined}
          className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] bg-white dark:bg-[#1A191D] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition disabled:opacity-40"
        >
          {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" strokeWidth={1.75} />}
          Скачать PDF
        </button>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <div className="min-w-0 space-y-4">
          {/* Доходы */}
          <section className={`${panelCls} p-4`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2]">Доходы по площадкам</h2>
              {draft && (
                <button
                  onClick={() => setLines((ls) => [...ls, { key: newKey(), source: "", streams: "", revenue: "" }])}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[12px] py-[6px] rounded-full transition"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                  Строка
                </button>
              )}
            </div>

            <datalist id="royalty-sources">
              {ROYALTY_SOURCES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>

            {lines.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">
                {draft ? "Добавьте доходы с площадок из отчётов дистрибьютора" : "Строк нет"}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-2 text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] px-1">
                  <span>Площадка</span>
                  <span className="text-right">Прослушивания</span>
                  <span className="text-right">Доход, ₽</span>
                  <span />
                </div>
                {lines.map((l, i) => (
                  <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_32px] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-2 items-center">
                    <input
                      list="royalty-sources"
                      value={l.source}
                      disabled={!draft}
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))}
                      placeholder="Площадка"
                      className={`${inputCls} col-span-1`}
                    />
                    <input
                      inputMode="numeric"
                      value={l.streams}
                      disabled={!draft}
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, streams: e.target.value } : x)))}
                      placeholder="0"
                      className={`${inputCls} text-right order-3 sm:order-none`}
                    />
                    <input
                      inputMode="decimal"
                      value={l.revenue}
                      disabled={!draft}
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, revenue: e.target.value } : x)))}
                      placeholder="0"
                      className={`${inputCls} text-right order-4 sm:order-none`}
                    />
                    {draft ? (
                      <button
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                        aria-label="Удалить строку"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition order-2 sm:order-none"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Параметры */}
          <section className={`${panelCls} p-4`}>
            <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-3">Условия</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className={labelCls}>Доля артиста, %</span>
                <input inputMode="decimal" value={share} disabled={!draft} onChange={(e) => setShare(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Удержания, ₽</span>
                <input inputMode="decimal" value={deductions} disabled={!draft} onChange={(e) => setDeductions(e.target.value)} placeholder="0" className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Срок выплаты</span>
                <input type="date" value={dueDate} disabled={!draft} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </label>
            </div>
            <label className="block mt-3">
              <span className={labelCls}>Комментарий для артиста</span>
              <textarea
                value={note}
                disabled={!draft}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Например: удержаны расходы на клип по договорённости от 12 июля"
                className={`${inputCls} resize-none`}
              />
            </label>

            {draft && (
              <button
                onClick={save}
                disabled={busy !== null}
                className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
              >
                {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" strokeWidth={2.5} /> : null}
                {saved ? "Сохранено и пересчитано" : "Сохранить и пересчитать"}
              </button>
            )}
          </section>
        </div>

        {/* Расчёт */}
        <aside className="space-y-4 lg:sticky lg:top-8">
          <section className={`${panelCls} p-4`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2]">Расчёт</h2>
              <Badge label={statementLabels[s.status].label} cls={statementLabels[s.status].cls} dot />
            </div>
            {unsaved && (
              <p className="text-[12px] text-[#8A5A16] dark:text-[#E8B65A] bg-[#FBF1DE] dark:bg-[#3A2F14] rounded-[12px] px-3 py-2 mb-3">
                Есть несохранённые изменения — расчёт ниже по сохранённым данным
              </p>
            )}
            <dl className="space-y-2 text-[13px]">
              {(
                [
                  ["Доход за период", fmtRub(s.gross)],
                  [`Доля артиста, ${s.share_pct}%`, fmtRub(s.royalty)],
                  ["Удержания", s.deductions ? `− ${fmtRub(s.deductions)}` : "—"],
                  ["Зачёт аванса", s.recouped ? `− ${fmtRub(s.recouped)}` : "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#6E6D73] dark:text-[#9A98A0]">{k}</dt>
                  <dd className="tabular-nums text-[#17161A] dark:text-[#F5F4F2]">{v}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 pt-2 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                <dt className="font-semibold text-[#17161A] dark:text-[#F5F4F2]">К выплате</dt>
                <dd className="text-[18px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2]">{fmtRub(s.payout)}</dd>
              </div>
            </dl>
            <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-3">
              Остаток аванса у артиста: {fmtRub(remaining)}. Суммы считает база — у артиста будут те же цифры.
            </p>
          </section>

          <section className={`${panelCls} p-4 space-y-2`}>
            {s.status === "draft" && (
              <>
                <button
                  onClick={() => moveTo("published")}
                  disabled={busy !== null || unsaved || s.gross <= 0}
                  title={s.gross <= 0 ? "Добавьте доходы и сохраните" : unsaved ? "Сначала сохраните изменения" : undefined}
                  className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === "published" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Опубликовать артисту
                </button>
                <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">После публикации суммы не редактируются.</p>
                <button
                  onClick={() =>
                    run("delete", async () => {
                      await deleteStatement(id);
                      router.push("/label/royalties");
                    })
                  }
                  disabled={busy !== null}
                  className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2] px-[14px] py-[8px] rounded-full transition"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  Удалить черновик
                </button>
              </>
            )}
            {s.status === "published" && (
              <>
                <button
                  onClick={() => moveTo("paid")}
                  disabled={busy !== null}
                  className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
                >
                  {busy === "paid" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Отметить выплаченным
                </button>
                <button
                  onClick={() => moveTo("draft")}
                  disabled={busy !== null}
                  className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4" />
                  Вернуть в черновик
                </button>
                <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">Черновик артист перестанет видеть до повторной публикации.</p>
              </>
            )}
            {s.status === "paid" && (
              <button
                onClick={() => moveTo("published")}
                disabled={busy !== null}
                className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                Отменить отметку о выплате
              </button>
            )}
          </section>
        </aside>
      </div>
    </LabelShell>
  );
}

export default function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LabelGate>{({ org }) => <StatementInner org={org} id={id} />}</LabelGate>;
}
