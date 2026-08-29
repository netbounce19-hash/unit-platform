"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  AlertTriangle,
  Wallet,
  UserPlus,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Percent,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Badge } from "@/components/label/LabelShell";
import ScoreMeter from "@/components/label/ScoreMeter";
import {
  fetchRoster,
  fetchObligationStats,
  createArtist,
  type MyOrg,
  type RosterArtist,
  type ObligationStat,
} from "@/lib/supabase/label";
import { fetchOrgStreamStats, type StreamStat } from "@/lib/supabase/streamStats";
import { computeScores, fmtStreams } from "@/lib/label/ranking";

function RosterInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<RosterArtist[]>([]);
  const [obligations, setObligations] = useState<ObligationStat[]>([]);
  const [streamsMap, setStreamsMap] = useState<Map<string, StreamStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [roster, obl, streams] = await Promise.all([
        fetchRoster(org.org_id),
        fetchObligationStats(org.org_id),
        fetchOrgStreamStats(org.org_id),
      ]);
      setRows(roster);
      setObligations(obl);
      setStreamsMap(streams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить ростер");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const scores = useMemo(
    () => computeScores(rows, obligations, streamsMap),
    [rows, obligations, streamsMap]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createArtist(org.org_id, name);
      setName("");
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить артиста");
    } finally {
      setBusy(false);
    }
  };

  const totalOverdue = rows.reduce((s, r) => s + r.overdueTasks, 0);
  const totalPending = rows.reduce((s, r) => s + r.pendingBudgets, 0);
  const totalActive = rows.filter((r) => r.status === "active").length;

  return (
    <LabelShell
      org={org}
      title="Ростер"
      subtitle={`${rows.length} ${rows.length === 1 ? "артист" : "артистов"} в ростере лейбла`}
      actions={
        <>
          <Link
            href="/label/invites"
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-[14px] py-[8px] rounded-full hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition"
          >
            <UserPlus className="w-[15px] h-[15px]" strokeWidth={1.75} />
            Пригласить
          </Link>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition"
          >
            <Plus className="w-[15px] h-[15px]" strokeWidth={2} />
            Артист
          </button>
        </>
      }
    >
      {/* Сводная инфографическая лента ключевых статусов ростера */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {rows.length}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                {totalActive} активных
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              totalOverdue > 0
                ? "bg-[#FDF0EE] dark:bg-[#341B1A] text-[#E23A34] dark:text-[#F87171]"
                : "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
            }`}>
              {totalOverdue > 0 ? (
                <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {totalOverdue}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                {totalOverdue > 0 ? "просрочено" : "в графике"}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              totalPending > 0
                ? "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]"
                : "bg-[#F0EEEA] dark:bg-[#242327] text-[#6E6D73] dark:text-[#9A98A0]"
            }`}>
              <Wallet className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {totalPending}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                {totalPending > 0 ? "заявок ждёт" : "нет заявок"}
              </div>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <form
          onSubmit={submit}
          className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4 mb-4 flex flex-col gap-3"
        >
          <label className="block">
            <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]">
              Псевдоним артиста
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="KXDE"
              className="w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
            Добавить
          </button>
        </form>
      )}

      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList empty={rows.length === 0 ? "В ростере пока нет артистов" : null}>
          {scores.map(({ artist: a, streams, streamsScore, obligationScore, efficiency }) => (
            <ListCard key={a.id} href={`/label/artists/${a.id}`}>
              <div className="flex items-center justify-between gap-3 mb-[8px]">
                {/* Аватар + имя */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[#17161A] dark:bg-[#242327] text-white dark:text-[#F5F4F2] flex items-center justify-center text-[12.5px] font-semibold border border-black/5 dark:border-white/10">
                      {a.stage_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A191D] ${
                        a.status === "active" ? "bg-[#1F9D6B]" : "bg-[#C4C3C8] dark:bg-[#6E6D73]"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold truncate text-[#17161A] dark:text-[#F5F4F2]">
                      {a.stage_name}
                    </div>
                    {!a.user_id && (
                      <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>не принял приглашение</span>
                      </div>
                    )}
                  </div>
                </div>

                <Badge
                  label={a.status === "active" ? "Активен" : "Приглашён"}
                  cls={
                    a.status === "active"
                      ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                      : "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]"
                  }
                  dot
                />
              </div>

              {/* Метки задач, бюджета и условий */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] my-2">
                {a.overdueTasks > 0 ? (
                  <span className="inline-flex items-center gap-[4px] text-[#E23A34] dark:text-[#F87171] font-medium bg-[#FDF0EE] dark:bg-[#341B1A] px-2 py-0.5 rounded-[8px]">
                    <AlertTriangle className="w-[12px] h-[12px]" strokeWidth={2.2} />
                    {a.overdueTasks} просрочено
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-[4px] text-[#6E6D73] dark:text-[#9A98A0]">
                    <CheckCircle2 className="w-[12px] h-[12px] text-[#1F9D6B]" strokeWidth={2} />
                    {a.openTasks} открытых задач
                  </span>
                )}

                {a.pendingBudgets > 0 && (
                  <span className="inline-flex items-center gap-[4px] text-[#8A5A16] dark:text-[#E8B65A] font-medium bg-[#FBF1DE] dark:bg-[#3A2F14] px-2 py-0.5 rounded-[8px]">
                    <Wallet className="w-[12px] h-[12px]" strokeWidth={2} />
                    {a.pendingBudgets} заявок ждёт
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-[#A6A5AB] dark:text-[#6E6D73] bg-[#FAFAF9] dark:bg-[#232227] px-2 py-0.5 rounded-[8px] border border-[#ECEAE5] dark:border-[#242327]">
                  {a.terms?.royalty_pct != null ? (
                    <span className="inline-flex items-center gap-0.5 text-[#17161A] dark:text-[#F5F4F2] font-medium">
                      {a.terms.royalty_pct}%
                    </span>
                  ) : (
                    "—"
                  )}
                  {a.terms?.term_months != null && (
                    <span>· {a.terms.term_months} мес.</span>
                  )}
                  {a.terms?.exclusive && (
                    <span className="text-[#8A5A16] dark:text-[#E8B65A] font-medium">· экскл.</span>
                  )}
                </span>
              </div>

              {/* Рейтинговая шкала */}
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                <ScoreMeter label="Стримы" value={streamsScore} display={fmtStreams(streams)} />
                <ScoreMeter
                  label="Обязательность"
                  value={obligationScore}
                  display={obligationScore === null ? "—" : `${obligationScore}%`}
                />
                <ScoreMeter label="Эффективность" value={efficiency} display={String(efficiency)} accent />
              </div>
            </ListCard>
          ))}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function RosterPage() {
  return <LabelGate>{({ org }) => <RosterInner org={org} />}</LabelGate>;
}
