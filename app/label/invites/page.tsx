"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Copy, Check, Trash2 } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { DataTable, Badge } from "@/components/label/LabelShell";
import {
  fetchInvites,
  createInvite,
  revokeInvite,
  inviteLink,
  fetchRoster,
  formatDate,
  type MyOrg,
  type InviteRow,
  type RosterArtist,
} from "@/lib/supabase/label";

const inputCls =
  "w-full text-[13.5px] rounded-[9px] border border-[#E5E3DE] bg-white px-3 py-[9px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]";

function inviteState(inv: InviteRow): { label: string; cls: string } {
  if (inv.accepted_at) return { label: "Принято", cls: "bg-[#E9F6EF] text-[#166B49]" };
  if (new Date(inv.expires_at) < new Date())
    return { label: "Истекло", cls: "bg-[#FDEDEB] text-[#A62018]" };
  return { label: "Ожидает", cls: "bg-[#FBF1DE] text-[#8A5A16]" };
}

function InvitesInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [artistId, setArtistId] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, a] = await Promise.all([fetchInvites(org.org_id), fetchRoster(org.org_id)]);
      setRows(i);
      setArtists(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить приглашения");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createInvite(org.org_id, email, artistId || null);
      setEmail("");
      setArtistId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать приглашение");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Не удалось скопировать ссылку");
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await revokeInvite(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отозвать приглашение");
    }
  };

  // Артисты без аккаунта — им и нужны приглашения.
  const unlinked = artists.filter((a) => !a.user_id);

  return (
    <LabelShell
      org={org}
      title="Приглашения"
      subtitle="Ссылка привязывает аккаунт артиста к вашему лейблу"
    >
      <form
        onSubmit={submit}
        className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4 mb-5 flex flex-wrap items-end gap-3"
      >
        <label className="flex-1 min-w-[220px]">
          <span className="block text-[12px] font-medium text-[#6E6D73] mb-[6px]">Email артиста</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artist@example.com"
            className={inputCls}
          />
        </label>

        <label className="min-w-[200px]">
          <span className="block text-[12px] font-medium text-[#6E6D73] mb-[6px]">
            Привязать к артисту
          </span>
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="">Создать нового</option>
            {unlinked.map((a) => (
              <option key={a.id} value={a.id}>
                {a.stage_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={!email.trim() || busy}
          className="inline-flex items-center gap-2 text-[13px] font-medium bg-[#E23A34] text-white px-[14px] py-[9px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="w-4 h-4" strokeWidth={2} />
          )}
          Создать ссылку
        </button>
      </form>

      {error && (
        <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <p className="text-[12.5px] text-[#A6A5AB] mb-3">
        Письма пока не отправляются — скопируйте ссылку и передайте артисту сами.
      </p>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <DataTable
          head={["Email", "Статус", "Действует до", "Ссылка", ""]}
          empty={rows.length === 0 ? "Приглашений пока нет" : null}
        >
          {rows.map((inv) => {
            const s = inviteState(inv);
            return (
              <tr key={inv.id} className="border-b-[0.5px] border-[#ECEAE5] last:border-0 hover:bg-[#FAFAF9]">
                <td className="px-4 py-[11px] font-medium">{inv.email}</td>
                <td className="px-4 py-[11px]"><Badge label={s.label} cls={s.cls} /></td>
                <td className="px-4 py-[11px] text-[#6E6D73] whitespace-nowrap">
                  {formatDate(inv.expires_at)}
                </td>
                <td className="px-4 py-[11px]">
                  {inv.accepted_at ? (
                    <span className="text-[#A6A5AB]">—</span>
                  ) : (
                    <button
                      onClick={() => copy(inv.token)}
                      className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[#17161A] border border-[#E5E3DE] px-[10px] py-[5px] rounded-[8px] hover:bg-[#F0EEEA] transition"
                    >
                      {copied === inv.token ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#166B49]" strokeWidth={2.5} />
                          Скопировано
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Копировать
                        </>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-[11px] text-right">
                  {!inv.accepted_at && (
                    <button
                      onClick={() => revoke(inv.id)}
                      aria-label="Отозвать приглашение"
                      title="Отозвать"
                      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#C4C3C8] hover:text-[#A62018] hover:bg-[#FDEDEB] transition"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
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

export default function InvitesPage() {
  return <LabelGate>{({ org }) => <InvitesInner org={org} />}</LabelGate>;
}
