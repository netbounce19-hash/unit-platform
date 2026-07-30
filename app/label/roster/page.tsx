"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, AlertTriangle, Wallet, UserPlus } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { DataTable, Badge } from "@/components/label/LabelShell";
import { fetchRoster, createArtist, type MyOrg, type RosterArtist } from "@/lib/supabase/label";

function RosterInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchRoster(org.org_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить ростер");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

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
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] border border-[#E5E3DE] bg-white px-[13px] py-[8px] rounded-[9px] hover:bg-[#F0EEEA] transition"
          >
            <UserPlus className="w-[15px] h-[15px]" strokeWidth={1.75} />
            Пригласить
          </Link>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#E23A34] text-white px-[13px] py-[8px] rounded-[9px] hover:brightness-95 transition"
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
          className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4 mb-4 flex items-end gap-3"
        >
          <label className="flex-1">
            <span className="block text-[12px] font-medium text-[#6E6D73] mb-[6px]">
              Псевдоним артиста
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="KXDE"
              className="w-full text-[13.5px] rounded-[9px] border border-[#E5E3DE] bg-white px-3 py-[8px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-2 text-[13px] font-medium bg-[#E23A34] text-white px-[14px] py-[9px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
            Добавить
          </button>
        </form>
      )}

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
          head={["Артист", "Статус", "Задачи", "Заявки", "Условия"]}
          empty={rows.length === 0 ? "В ростере пока нет артистов" : null}
        >
          {rows.map((a) => (
            <tr key={a.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
              <td className="px-4 py-[11px]">
                <Link
                  href={`/label/artists/${a.id}`}
                  className="font-medium text-[#17161A] hover:text-[#E23A34] transition"
                >
                  {a.stage_name}
                </Link>
                {!a.user_id && (
                  <span className="ml-2 text-[11.5px] text-[#A6A5AB]">не принял приглашение</span>
                )}
              </td>
              <td className="px-4 py-[11px]">
                <Badge
                  label={a.status === "active" ? "Активен" : "Приглашён"}
                  cls={
                    a.status === "active"
                      ? "bg-[#E9F6EF] text-[#166B49]"
                      : "bg-[#F0EEEA] text-[#6E6D73]"
                  }
                />
              </td>
              <td className="px-4 py-[11px]">
                {a.overdueTasks > 0 ? (
                  <span className="inline-flex items-center gap-[5px] text-[#A62018] font-medium">
                    <AlertTriangle className="w-[13px] h-[13px]" strokeWidth={2} />
                    {a.overdueTasks} просрочено
                  </span>
                ) : (
                  <span className="text-[#6E6D73]">{a.openTasks} открытых</span>
                )}
              </td>
              <td className="px-4 py-[11px]">
                {a.pendingBudgets > 0 ? (
                  <span className="inline-flex items-center gap-[5px] text-[#8A5A16] font-medium">
                    <Wallet className="w-[13px] h-[13px]" strokeWidth={2} />
                    {a.pendingBudgets} ждёт
                  </span>
                ) : (
                  <span className="text-[#A6A5AB]">—</span>
                )}
              </td>
              <td className="px-4 py-[11px] text-[#6E6D73]">
                {a.terms?.royalty_pct != null ? `${a.terms.royalty_pct}%` : "—"}
                {a.terms?.term_months != null && ` · ${a.terms.term_months} мес.`}
                {a.terms?.exclusive && " · экскл."}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </LabelShell>
  );
}

export default function RosterPage() {
  return <LabelGate>{({ org }) => <RosterInner org={org} />}</LabelGate>;
}
