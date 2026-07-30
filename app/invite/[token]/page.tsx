"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { acceptInvite } from "@/lib/supabase/label";
import AuthPanel from "@/components/auth/AuthPanel";

/**
 * Приём приглашения артистом.
 * Строку инвайта артист не видит (нет select-политики) — токен проверяет
 * функция accept_artist_invite() в БД.
 */
function InviteInner({ token }: { token: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token);
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось принять приглашение");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  // Без аккаунта принять приглашение нельзя — сначала регистрация или вход.
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="font-semibold tracking-[0.16em] text-[17px] mb-3">UNIT</div>
        <p className="text-[13px] text-[#6E6D73] mb-6 text-center max-w-[380px]">
          Вас пригласили в лейбл. Войдите или создайте аккаунт — и мы привяжем приглашение
          к нему.
        </p>
        <AuthPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="font-semibold tracking-[0.16em] text-[17px] mb-6">UNIT</div>

      <div className="w-full max-w-[420px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] text-center">
        {done ? (
          <>
            <span className="w-11 h-11 rounded-full bg-[#E9F6EF] text-[#166B49] flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Приглашение принято</div>
            <p className="text-[13px] text-[#6E6D73] mt-1">Открываем кабинет…</p>
          </>
        ) : (
          <>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Приглашение в лейбл</div>
            <p className="text-[13px] text-[#6E6D73] mt-1 leading-[1.5]">
              Аккаунт <span className="text-[#17161A]">{session.user.email}</span> будет привязан
              к лейблу как артист.
            </p>

            {error && (
              <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mt-4 text-left">
                {error}
              </div>
            )}

            <button
              onClick={accept}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[11px] rounded-[10px] hover:brightness-95 transition disabled:opacity-40 mt-4"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
              Принять приглашение
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <InviteInner token={token} />;
}
