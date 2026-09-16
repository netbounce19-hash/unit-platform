"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, LogOut, Trash2, UserPlus } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { formatDate, type MyOrg } from "@/lib/supabase/label";
import { getSupabase } from "@/lib/supabase/client";
import { TEAM_ROLES, isAdmin, roleLabel, type TeamRole } from "@/lib/label/roles";
import {
  createTeamInvite,
  fetchTeam,
  fetchTeamInvites,
  memberName,
  removeMember,
  revokeTeamInvite,
  setMemberRole,
  teamInviteLink,
  type TeamInvite,
  type TeamMember,
} from "@/lib/supabase/team";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

/**
 * Команда лейбла. Стартовому лейблу хватает 3–4 человек, но роли всё равно
 * стоит развести: кто считает деньги, кто договаривается с артистами, кто
 * отгружает. Администратор приглашает и меняет роли; остальные видят состав.
 */
function TeamInner({ org }: { org: MyOrg }) {
  const router = useRouter();
  const admin = isAdmin(org.role);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("project");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, i, u] = await Promise.all([
        fetchTeam(org.org_id),
        admin ? fetchTeamInvites(org.org_id) : Promise.resolve([]),
        getSupabase().auth.getUser(),
      ]);
      setTeam(t);
      setInvites(i);
      setMe(u.data.user?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить команду");
    } finally {
      setLoading(false);
    }
  }, [org.org_id, admin]);

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

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Не удалось скопировать");
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    run("invite", async () => {
      const inv = await createTeamInvite(org.org_id, email, role);
      setEmail("");
      await load();
      await copy(teamInviteLink(inv.token), inv.id);
    });
  };

  const leave = () =>
    run("leave", async () => {
      if (!me) return;
      await removeMember(org.org_id, me);
      router.replace("/");
    });

  return (
    <LabelShell org={org} title="Команда" subtitle="Кто работает в лейбле и что каждому доступно">
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <div className="min-w-0 space-y-4">
          {admin && (
            <form onSubmit={invite} className={`${panelCls} p-4`}>
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-3">
                <UserPlus className="w-4 h-4" strokeWidth={1.75} />
                Пригласить в команду
              </h2>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="почта сотрудника"
                  className={inputCls}
                />
                <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={`${inputCls} cursor-pointer`}>
                  {TEAM_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={busy !== null || !email.trim()}
                  className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[9px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
                >
                  {busy === "invite" && <Loader2 className="w-4 h-4 animate-spin" />}
                  Создать ссылку
                </button>
              </div>
              <p className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mt-2">
                Ссылка скопируется — отправьте её сотруднику. Принять приглашение можно только с этой почты; ссылка действует 14 дней.
              </p>
            </form>
          )}

          <section className={`${panelCls} overflow-hidden`}>
            {loading ? (
              <div className="py-10 flex justify-center text-[#A6A5AB]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              team.map((m, i) => {
                const self = m.user_id === me;
                return (
                  <div
                    key={m.user_id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]" : ""}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-[#17161A] dark:bg-[#242327] text-white dark:text-[#F5F4F2] flex items-center justify-center text-[13px] font-medium shrink-0">
                      {memberName(m).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">
                        {memberName(m)}
                        {self && <span className="text-[#A6A5AB] font-normal"> · вы</span>}
                      </div>
                      <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                        {m.email} · с {formatDate(m.joined_at)}
                      </div>
                    </div>
                    {admin ? (
                      <select
                        value={m.role}
                        disabled={busy !== null}
                        onChange={(e) =>
                          run(m.user_id, async () => {
                            await setMemberRole(org.org_id, m.user_id, e.target.value as TeamRole);
                            // своя роль меняет доступные разделы — перечитываем кабинет
                            if (self) window.location.reload();
                            else await load();
                          })
                        }
                        aria-label={`Роль: ${memberName(m)}`}
                        className="text-[13px] rounded-full border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] text-[#17161A] dark:text-[#F5F4F2] px-[12px] py-[6px] outline-none cursor-pointer"
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[12.5px] font-medium px-[10px] py-[4px] rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]">
                        {roleLabel(m.role)}
                      </span>
                    )}
                    {admin && !self && (
                      <button
                        onClick={() => run(`rm-${m.user_id}`, async () => {
                          await removeMember(org.org_id, m.user_id);
                          await load();
                        })}
                        disabled={busy !== null}
                        aria-label={`Убрать из команды: ${memberName(m)}`}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {admin && invites.length > 0 && (
            <section className={`${panelCls} p-4`}>
              <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-2">Ждут принятия</h2>
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-2 py-2 border-t-[0.5px] first:border-t-0 border-[#ECEAE5] dark:border-[#242327]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] truncate text-[#17161A] dark:text-[#F5F4F2]">{inv.email}</div>
                      <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73]">
                        {roleLabel(inv.role)} · {expired ? "срок истёк" : `до ${formatDate(inv.expires_at)}`}
                      </div>
                    </div>
                    {!expired && (
                      <button
                        onClick={() => copy(teamInviteLink(inv.token), inv.id)}
                        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[12px] py-[6px] rounded-full transition"
                      >
                        {copied === inv.id ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === inv.id ? "Скопировано" : "Ссылка"}
                      </button>
                    )}
                    <button
                      onClick={() => run(`rv-${inv.id}`, async () => {
                        await revokeTeamInvite(inv.id);
                        await load();
                      })}
                      aria-label="Отозвать приглашение"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          {!admin && (
            <button
              onClick={leave}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-[13px] text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
              Выйти из команды лейбла
            </button>
          )}
        </div>

        {/* Что умеет каждая роль */}
        <aside className={`${panelCls} p-4 lg:sticky lg:top-8`}>
          <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-2">Роли</h2>
          <dl className="space-y-2.5">
            {TEAM_ROLES.map((r) => (
              <div key={r.key}>
                <dt className="text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2]">
                  {r.label}
                  {r.key === org.role && <span className="text-[#A6A5AB] font-normal"> · ваша роль</span>}
                </dt>
                <dd className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0]">{r.hint}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-3">
            Ростер, статистику, задачи и переписку видят все сотрудники. Деньги, модерация, скаутинг и состав команды — только по роли.
          </p>
        </aside>
      </div>
    </LabelShell>
  );
}

export default function TeamPage() {
  return <LabelGate>{({ org }) => <TeamInner org={org} />}</LabelGate>;
}
