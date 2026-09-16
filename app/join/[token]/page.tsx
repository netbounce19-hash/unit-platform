"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import AuthPanel from "@/components/auth/AuthPanel";
import { roleLabel, TEAM_ROLES } from "@/lib/label/roles";
import { acceptTeamInvite, fetchTeamInviteInfo } from "@/lib/supabase/team";

/**
 * Приглашение сотрудника в команду лейбла. Принять можно только с той почты,
 * на которую оно выписано, и только аккаунтом, который не состоит в другом
 * лейбле и не является кабинетом артиста — это проверяет база.
 */
function JoinInner({ token }: { token: string }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof fetchTeamInviteInfo>> | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchTeamInviteInfo(token)
      .then(setInfo)
      .catch(() => setInfo(null));
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [token]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptTeamInvite(token);
      setDone(true);
      // полная загрузка — кабинет заново прочитает организацию и роль
      setTimeout(() => window.location.assign("/label/roster"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось принять приглашение");
    } finally {
      setBusy(false);
    }
  };

  const card = "w-full max-w-[420px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] text-center";

  if (info === undefined || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const unusable = !info || info.expired || info.accepted;
  const roleHint = info ? TEAM_ROLES.find((r) => r.key === info.role)?.hint : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-[#FAFAF9]">
      <div className="font-semibold tracking-[0.16em] text-[17px] mb-5">UNIT</div>

      {unusable ? (
        <div className={card}>
          <div className="text-[16px] font-semibold">
            {!info ? "Приглашение не найдено" : info.accepted ? "Приглашение уже принято" : "Срок приглашения истёк"}
          </div>
          <p className="text-[13px] text-[#6E6D73] mt-1">
            {!info ? "Проверьте ссылку." : "Попросите администратора лейбла прислать новую ссылку."}
          </p>
        </div>
      ) : !session ? (
        <>
          <p className="text-[13.5px] text-[#6E6D73] mb-5 text-center max-w-[400px] leading-[1.5]">
            Вас зовут в команду <span className="text-[#17161A] font-medium">{info.org_name}</span> на роль «{roleLabel(info.role)}».
            Войдите или зарегистрируйтесь с почтой, на которую пришло приглашение. Если после регистрации понадобится
            подтвердить почту — подтвердите и откройте эту ссылку ещё раз.
          </p>
          <AuthPanel />
        </>
      ) : (
        <div className={card}>
          {done ? (
            <>
              <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
                <Check className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <div className="text-[16px] font-semibold">Вы в команде</div>
              <p className="text-[13px] text-[#6E6D73] mt-1">Открываем кабинет лейбла…</p>
            </>
          ) : (
            <>
              <div className="text-[16px] font-semibold">Команда {info.org_name}</div>
              <p className="text-[13px] text-[#6E6D73] mt-1 leading-[1.5]">
                Роль — «{roleLabel(info.role)}»{roleHint ? `: ${roleHint.toLowerCase()}` : ""}.
                <br />
                Аккаунт: <span className="text-[#17161A]">{session.user.email}</span>
              </p>
              {error && (
                <div className="text-[13px] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-3 py-[9px] mt-4 text-left">
                  {error}
                </div>
              )}
              <button
                onClick={accept}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#17161A] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 mt-4"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Присоединиться
              </button>
              {error && (
                <button
                  onClick={() => getSupabase().auth.signOut()}
                  className="w-full mt-2 text-[13px] font-medium text-[#6E6D73] hover:text-[#17161A] px-[14px] py-[8px] rounded-full transition"
                >
                  Войти под другой почтой
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <JoinInner token={token} />;
}
