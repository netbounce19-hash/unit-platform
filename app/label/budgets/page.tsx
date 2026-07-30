"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Check, X } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { DataTable, Badge } from "@/components/label/LabelShell";
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
        <div className="flex items-center gap-1 bg-white border-[0.5px] border-[#ECEAE5] rounded-[9px] p-[3px]">
          {(["pending", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-[7px] transition ${
                filter === f ? "bg-[#FDEDEB] text-[#A62018]" : "text-[#6E6D73] hover:text-[#17161A]"
              }`}
            >
              {f === "pending" ? "Ждут решения" : "Все"}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <DataTable
          head={["Артист", "Назначение", "Сумма", "Подана", "Статус", ""]}
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
              cls: "bg-[#F0EEEA] text-[#6E6D73]",
            };
            const isOpen = openId === b.id;
            const rowBusy = busyId === b.id;

            return (
              <tr key={b.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 align-top">
                <td className="px-4 py-[11px]">
                  {b.artist_id ? (
                    <Link
                      href={`/label/artists/${b.artist_id}`}
                      className="font-medium hover:text-[#E23A34] transition"
                    >
                      {nameOf(b.artist_id)}
                    </Link>
                  ) : (
                    <span className="text-[#A6A5AB]">—</span>
                  )}
                </td>
                <td className="px-4 py-[11px]">
                  <div>{b.category || b.purpose || "—"}</div>
                  {b.comment && (
                    <div className="text-[12px] text-[#A6A5AB] max-w-[280px]">{b.comment}</div>
                  )}
                  {isOpen && (
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="Комментарий к решению"
                      className="mt-2 w-full max-w-[320px] resize-none text-[12.5px] rounded-[8px] border border-[#E5E3DE] bg-white px-[10px] py-[7px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                    />
                  )}
                </td>
                <td className="px-4 py-[11px] font-medium whitespace-nowrap">
                  {formatMoney(b.amount)}
                </td>
                <td className="px-4 py-[11px] text-[#6E6D73] whitespace-nowrap">
                  {formatDate(b.created_at)}
                </td>
                <td className="px-4 py-[11px]">
                  <Badge label={s.label} cls={s.cls} />
                  {b.decision_comment && (
                    <div className="text-[11.5px] text-[#A6A5AB] mt-1 max-w-[200px]">
                      {b.decision_comment}
                    </div>
                  )}
                </td>
                <td className="px-4 py-[11px] text-right whitespace-nowrap">
                  {b.status === "pending" ? (
                    isOpen ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => decide(b.id, "approved")}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-[5px] text-[12.5px] font-medium bg-[#1F9D6B] text-white px-[10px] py-[6px] rounded-[8px] hover:brightness-95 transition disabled:opacity-40"
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
                          className="inline-flex items-center gap-[5px] text-[12.5px] font-medium text-[#A62018] border border-[#F3C9C6] bg-[#FDEDEB] px-[10px] py-[6px] rounded-[8px] hover:brightness-95 transition disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Отклонить
                        </button>
                        <button
                          onClick={() => {
                            setOpenId(null);
                            setComment("");
                          }}
                          className="text-[12.5px] text-[#A6A5AB] px-[8px] py-[6px] hover:text-[#17161A] transition"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setOpenId(b.id);
                          setComment("");
                        }}
                        className="text-[12.5px] font-medium text-[#17161A] border border-[#E5E3DE] px-[11px] py-[6px] rounded-[8px] hover:bg-[#F0EEEA] transition"
                      >
                        Решение
                      </button>
                    )
                  ) : (
                    <span className="text-[12px] text-[#A6A5AB]">{formatDate(b.decided_at)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </LabelShell>
  );
}

export default function BudgetsPage() {
  return <LabelGate>{({ org }) => <BudgetsInner org={org} />}</LabelGate>;
}
