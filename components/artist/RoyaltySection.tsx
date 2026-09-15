"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileDown, HandCoins, Loader2 } from "lucide-react";
import { fetchMyArtistLink } from "@/lib/supabase/cabinet";
import {
  advanceBalance,
  fetchLines,
  fetchMyAdvances,
  fetchMyStatements,
  fetchOrgName,
  fmtPeriod,
  fmtRub,
  statementLabels,
  type Advance,
  type RoyaltyLine,
  type RoyaltyStatement,
} from "@/lib/supabase/royalties";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";
import { downloadRoyaltyPdf } from "@/lib/pdf/royaltyPdf";

const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/**
 * Роялти в кабинете артиста: сколько и когда заплатят, из чего сложилась
 * сумма, сколько аванса осталось погасить. Только опубликованные лейблом
 * отчёты — черновики база артисту не отдаёт.
 */
export default function RoyaltySection() {
  const [statements, setStatements] = useState<RoyaltyStatement[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [labelName, setLabelName] = useState("Лейбл");
  const [artistName, setArtistName] = useState("Артист");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, RoyaltyLine[]>>({});
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const link = await fetchMyArtistLink();
        if (cancelled) return;
        if (!link) return;
        setArtistId(link.artistId);
        const [s, a, org, profile] = await Promise.all([
          fetchMyStatements(),
          fetchMyAdvances(),
          fetchOrgName(link.orgId),
          fetchMyProfile().catch(() => null),
        ]);
        if (cancelled) return;
        setStatements(s);
        setAdvances(a);
        if (org) setLabelName(org);
        if (profile) setArtistName(displayNameOf(profile));
      } catch {
        /* не залогинен или сеть — покажем пустое состояние */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (id: string) => {
    setOpen((cur) => (cur === id ? null : id));
    if (!lines[id]) {
      try {
        const ls = await fetchLines(id);
        setLines((m) => ({ ...m, [id]: ls }));
      } catch {
        setLines((m) => ({ ...m, [id]: [] }));
      }
    }
  };

  const pdf = async (s: RoyaltyStatement) => {
    setPdfBusy(s.id);
    setError(null);
    try {
      const ls = lines[s.id] ?? (await fetchLines(s.id));
      await downloadRoyaltyPdf({
        statement: s,
        lines: ls,
        artistName,
        labelName,
        advanceRemaining: artistId ? advanceBalance(artistId, advances, statements).remaining : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось собрать PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  const toPay = statements.filter((s) => s.status === "published");
  const nextDue = [...toPay].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  const paidTotal = statements.filter((s) => s.status === "paid").reduce((t, s) => t + s.payout, 0);
  const bal = artistId ? advanceBalance(artistId, advances, statements) : null;

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mb-4">
      <div className="flex items-center gap-2 mb-3">
        <HandCoins className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
        <div className="text-[16px] font-semibold tracking-[-0.01em]">Роялти</div>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !artistId ? (
        <p className="text-[13px] text-[#A6A5AB] pb-2">
          Отчёты по роялти появятся, когда вы подключитесь к лейблу по приглашению.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-[12px] bg-[#FAFAF9] px-4 py-[12px]">
              <div className="text-[11.5px] text-[#A6A5AB]">К выплате</div>
              <div className="text-[20px] font-medium tabular-nums mt-[2px]">{fmtRub(toPay.reduce((t, s) => t + s.payout, 0))}</div>
              <div className="text-[11.5px] text-[#6E6D73] truncate">
                {nextDue?.due_date ? `ближайшая до ${fmtDate(nextDue.due_date)}` : toPay.length ? "срок не указан" : "ничего не ждёт"}
              </div>
            </div>
            <div className="rounded-[12px] bg-[#FAFAF9] px-4 py-[12px]">
              <div className="text-[11.5px] text-[#A6A5AB]">Выплачено</div>
              <div className="text-[20px] font-medium tabular-nums mt-[2px]">{fmtRub(paidTotal)}</div>
              <div className="text-[11.5px] text-[#6E6D73]">за всё время</div>
            </div>
          </div>

          {bal && bal.issued > 0 && (
            <div className="rounded-[12px] border-[0.5px] border-[#ECEAE5] px-4 py-[12px] mb-3">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-[#6E6D73]">Аванс</span>
                <span className="tabular-nums">осталось погасить {fmtRub(bal.remaining)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#ECEAE5] overflow-hidden mt-2">
                <div className="h-full bg-[#17161A]" style={{ width: `${Math.min(100, Math.round((bal.recouped / bal.issued) * 100))}%` }} />
              </div>
              <div className="text-[11.5px] text-[#A6A5AB] mt-1.5">
                получено {fmtRub(bal.issued)} · погашено из роялти {fmtRub(bal.recouped)}
              </div>
            </div>
          )}

          {error && <div className="text-[12.5px] bg-[#F0EEEA] rounded-[12px] px-3 py-2 mb-2">{error}</div>}

          {statements.length === 0 ? (
            <p className="py-5 text-[13px] text-[#A6A5AB] text-center">
              Отчётов пока нет — лейбл публикует их по итогам периода.
            </p>
          ) : (
            statements.map((s, i) => {
              const expanded = open === s.id;
              const st = statementLabels[s.status];
              return (
                <div key={s.id} className={i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}>
                  <button onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 py-[13px] text-left">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{fmtPeriod(s.period_start, s.period_end)}</div>
                      <div className="text-[12px] text-[#A6A5AB] mt-[2px]">
                        {s.status === "paid" && s.paid_at
                          ? `выплачено ${fmtDate(s.paid_at)}`
                          : s.due_date
                            ? `выплата до ${fmtDate(s.due_date)}`
                            : "срок не указан"}
                      </div>
                    </div>
                    <span className="text-[14px] font-semibold tabular-nums shrink-0">{fmtRub(s.payout)}</span>
                    <span className={`text-[11.5px] font-medium px-[8px] py-[3px] rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                    <ChevronDown className={`w-4 h-4 text-[#A6A5AB] shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
                  </button>

                  {expanded && (
                    <div className="pb-[14px]">
                      <div className="rounded-[12px] bg-[#FAFAF9] px-4 py-3 text-[13px] space-y-1.5">
                        {(lines[s.id] ?? []).map((l) => (
                          <div key={l.id} className="flex items-baseline justify-between gap-3">
                            <span className="text-[#6E6D73] truncate">
                              {l.source}
                              {l.streams ? ` · ${l.streams.toLocaleString("ru-RU")} прослушиваний` : ""}
                            </span>
                            <span className="tabular-nums shrink-0">{fmtRub(l.revenue)}</span>
                          </div>
                        ))}
                        {!lines[s.id] && <Loader2 className="w-4 h-4 animate-spin text-[#A6A5AB]" />}
                        <div className="border-t-[0.5px] border-[#ECEAE5] pt-1.5 space-y-1.5">
                          {(
                            [
                              ["Доход за период", fmtRub(s.gross)],
                              [`Ваша доля, ${s.share_pct}%`, fmtRub(s.royalty)],
                              ...(s.deductions ? [["Удержания", `− ${fmtRub(s.deductions)}`]] : []),
                              ...(s.recouped ? [["Зачёт аванса", `− ${fmtRub(s.recouped)}`]] : []),
                            ] as [string, string][]
                          ).map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-3">
                              <span className="text-[#6E6D73]">{k}</span>
                              <span className="tabular-nums">{v}</span>
                            </div>
                          ))}
                          <div className="flex items-baseline justify-between gap-3 font-semibold">
                            <span>К выплате</span>
                            <span className="tabular-nums">{fmtRub(s.payout)}</span>
                          </div>
                        </div>
                        {s.note && <p className="text-[12.5px] text-[#6E6D73] pt-1">«{s.note}»</p>}
                      </div>
                      <button
                        onClick={() => pdf(s)}
                        disabled={pdfBusy !== null}
                        className="mt-2 inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] border border-[#E5E3DE] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition disabled:opacity-40"
                      >
                        {pdfBusy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" strokeWidth={1.75} />}
                        Скачать отчёт PDF
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
