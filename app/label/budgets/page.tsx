"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Check, X } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Field, Badge } from "@/components/label/LabelShell";
import {
  fetchBudgets,
  fetchRoster,
  decideBudget,
  budgetStatusLabels,
  formatMoney,
  formatDate,
  type MyOrg,
  type BudgetRow,
  type RosterArtist,
} from "@/lib/supabase/label";

type Filter = "pending" | "all";

function BudgetsInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([fetchBudgets(org.org_id), fetchRoster(org.org_id)]);
      setRows(b);
      setArtists(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const map = new Map(artists.map((a) => [a.id, a.stage_name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [artists]);

  const visible = filter === "pending" ? rows.filter((r) => r.status === "pending") : rows;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const pendingSum = rows
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setError(null);
    try {
      await decideBudget(id, decision, comment);
      setOpenId(null);
      setComment("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить решение");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LabelShell
      org={org}
      title="Заявки на финансирование"
      subtitle={`${pendingCount} ждут решения · ${formatMoney(pendingSum)}`}
      actions={
        <div className="flex items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[9px] p-[3px]">
          {(["pending", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-[7px] transition ${
                filter === f ? "bg-[#FDEDEB] dark:bg-[#3A2422] text-[#A62018] dark:text-[#F3928C]" : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
              }`}
            >
              {f === "pending" ? "Ждут решения" : "Все"}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="text-[13px] text-[#A62018] dark:text-[#F3928C] bg-[#FDEDEB] dark:bg-[#3A2422] border-[0.5px] border-[#F3C9C6] dark:border-[#4A2F2C] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList
          empty={
            visible.length === 0
              ? filter === "pending"
                ? "Нет заявок, ждущих решения"
                : "Заявок нет"
              : null
          }
        >
          {visible.map((b) => {
            const s = budgetStatusLabels[b.status] ?? {
              label: b.status,
              cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]",
            };
            const isOpen = openId === b.id;
            const rowBusy = busyId === b.id;

            return (
              <ListCard key={b.id}>
                <div className="flex items-start justify-between gap-3 mb-[8px]">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium dark:text-[#F5F4F2]">
                      {formatMoney(b.amount)}
                    </div>
                    <div className="text-[13px] text-[#6E6D73] dark:text-[#9A98A0] mt-[1px]">
                      {b.category || b.purpose || "—"}
                    </div>
                  </div>
                  <Badge label={s.label} cls={s.cls} />
                </div>

                <Field label="Артист">
                  {b.artist_id ? (
                    <Link
                      href={`/label/artists/${b.artist_id}`}
                      className="font-medium hover:text-[#E23A34] transition"
                    >
                      {nameOf(b.artist_id)}
                    </Link>
                  ) : (
                    <span className="text-[#A6A5AB] dark:text-[#6E6D73]">—</span>
                  )}
                </Field>
                <Field label="Подана">{formatDate(b.created_at)}</Field>
                {b.needed_by && <Field label="Нужны к">{formatDate(b.needed_by)}</Field>}
                {b.status !== "pending" && (
                  <Field label="Решение">{formatDate(b.decided_at)}</Field>
                )}

                {b.comment && (
                  <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-2">
                    {b.comment}
                  </div>
                )}
                {b.decision_comment && (
                  <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-2">
                    Комментарий: {b.decision_comment}
                  </div>
                )}

                {b.status === "pending" &&
                  (isOpen ? (
                    <div className="mt-3">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        autoFocus
                        placeholder="Комментарий к решению"
                        className="w-full resize-none text-[12.5px] rounded-[8px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-[10px] py-[7px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => decide(b.id, "approved")}
                          disabled={rowBusy}
                          className="flex-1 inline-flex items-center justify-center gap-[5px] text-[12.5px] font-medium bg-[#1F9D6B] text-white px-[10px] py-[9px] rounded-[8px] hover:brightness-95 transition disabled:opacity-40"
                        >
                          {rowBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                          ) : (
                            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          )}
                          Одобрить
                        </button>
                        <button
                          onClick={() => decide(b.id, "rejected")}
                          disabled={rowBusy}
                          className="flex-1 inline-flex items-center justify-center gap-[5px] text-[12.5px] font-medium text-[#A62018] dark:text-[#F3928C] border border-[#F3C9C6] dark:border-[#4A2F2C] bg-[#FDEDEB] dark:bg-[#3A2422] px-[10px] py-[9px] rounded-[8px] hover:brightness-95 transition disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Отклонить
                        </button>
                        <button
                          onClick={() => {
                            setOpenId(null);
                            setComment("");
                          }}
                          className="text-[12.5px] text-[#A6A5AB] dark:text-[#6E6D73] px-[8px] py-[9px] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition shrink-0"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setOpenId(b.id);
                        setComment("");
                      }}
                      className="w-full mt-3 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] px-[11px] py-[9px] rounded-[8px] hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition"
                    >
                      Решение
                    </button>
                  ))}
              </ListCard>
            );
          })}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function BudgetsPage() {
  return <LabelGate>{({ org }) => <BudgetsInner org={org} />}</LabelGate>;
}
