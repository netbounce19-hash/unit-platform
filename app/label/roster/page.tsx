"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, AlertTriangle, Wallet, UserPlus } from "lucide-react";
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

  return (
    <LabelShell
      org={org}
      title="Ростер"
      subtitle={`${rows.length} ${rows.length === 1 ? "артист" : "артистов"} · ${totalOverdue} просроченных задач · ${totalPending} заявок ждут`}
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
              <div className="flex items-start justify-between gap-3 mb-[6px]">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate dark:text-[#F5F4F2]">
                    {a.stage_name}
                  </div>
                  {!a.user_id && (
                    <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-[1px]">
                      не принял приглашение
                    </div>
                  )}
                </div>
                <Badge
                  label={a.status === "active" ? "Активен" : "Приглашён"}
                  cls={
                    a.status === "active"
                      ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                      : "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]"
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                {a.overdueTasks > 0 ? (
                  <span className="inline-flex items-center gap-[5px] text-[#17161A] dark:text-[#F5F4F2] font-medium">
                    <AlertTriangle className="w-[13px] h-[13px]" strokeWidth={2} />
                    {a.overdueTasks} просрочено
                  </span>
                ) : (
                  <span className="text-[#6E6D73] dark:text-[#9A98A0]">
                    {a.openTasks} открытых задач
                  </span>
                )}
                {a.pendingBudgets > 0 && (
                  <span className="inline-flex items-center gap-[5px] text-[#8A5A16] dark:text-[#E8B65A] font-medium">
                    <Wallet className="w-[13px] h-[13px]" strokeWidth={2} />
                    {a.pendingBudgets} заявок ждёт
                  </span>
                )}
                <span className="text-[#A6A5AB] dark:text-[#6E6D73]">
                  {a.terms?.royalty_pct != null ? `${a.terms.royalty_pct}%` : "—"}
                  {a.terms?.term_months != null && ` · ${a.terms.term_months} мес.`}
                  {a.terms?.exclusive && " · экскл."}
                </span>
              </div>

              {/* Рейтинговая шкала. Те же метрики и та же формула, что на
                  странице статистики — считаются в lib/label/ranking. */}
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
