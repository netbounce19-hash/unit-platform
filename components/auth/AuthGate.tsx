"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyOrg } from "@/lib/supabase/label";
import AuthPanel from "@/components/auth/AuthPanel";

/**
 * ВРЕМЕННО: автовход в кабинет артиста на время разработки.
 * Работает точно так же, как DEV_AUTOLOGIN в LabelGate —
 * просто удалите эти переменные из .env.local, когда фронт утвердят.
 */
const DEV_EMAIL = process.env.NEXT_PUBLIC_ARTIST_DEV_EMAIL;
const DEV_PASSWORD = process.env.NEXT_PUBLIC_ARTIST_DEV_PASSWORD;
const DEV_AUTOLOGIN = Boolean(DEV_EMAIL && DEV_PASSWORD);

/**
 * Пускает дальше только с активной сессией.
 * Пока сессии нет — показывает окно входа/регистрации.
 */
export default function AuthGate({
  children,
  /** Увести сотрудника лейбла в его кабинет (артистские страницы не для него). */
  redirectLabelToOwnCabinet = true,
}: {
  children: ReactNode;
  redirectLabelToOwnCabinet?: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase не настроен");
      setReady(true);
      return;
    }

    let cancelled = false;

    const resolve = async (s: Session | null) => {
      if (cancelled) return;

      if (!s && DEV_AUTOLOGIN) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: DEV_EMAIL!,
            password: DEV_PASSWORD!,
          });
          if (!error && data.session) {
            if (!cancelled) return resolve(data.session);
          } else if (!cancelled) {
            setDevAuthError(error?.message ?? "Не удалось войти dev-аккаунтом");
          }
        } catch (err) {
          if (!cancelled) {
            setDevAuthError(err instanceof Error ? err.message : "Не удалось войти dev-аккаунтом");
          }
        }
        if (!cancelled) {
          setSession(null);
          setReady(true);
        }
        return;
      }

      setSession(s);

      // Сотрудник лейбла в артистском кабинете делать нечего — уводим к себе.
      if (s && redirectLabelToOwnCabinet) {
        try {
          const org = await fetchMyOrg();
          if (!cancelled && org) {
            router.replace("/label/roster");
            return;
          }
        } catch {
          /* не удалось проверить — оставляем в артистском кабинете */
        }
      }
      if (!cancelled) setReady(true);
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => resolve(next));

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [redirectLabelToOwnCabinet, router]);

  const devBanner = DEV_AUTOLOGIN && (
    <div className="bg-[#17161A] text-white text-[12px] text-center py-[6px] px-4">
      DEV MODE · автовход {DEV_EMAIL} — уберите NEXT_PUBLIC_ARTIST_DEV_EMAIL/PASSWORD из .env.local, чтобы вернуть обычный логин
    </div>
  );

  if (configError) {
    return (
      <div className="max-w-[720px] mx-auto px-5 py-7">
        <div className="bg-white border-[0.5px] border-[#F3C9C6] rounded-[16px] p-[22px]">
          <div className="text-[15px] font-semibold text-[#A62018] mb-2">Supabase не настроен</div>
          <p className="text-[13px] text-[#6E6D73] leading-[1.5]">{configError}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        {devBanner}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
          <div className="font-semibold tracking-[0.16em] text-[17px] mb-6">UNIT</div>
          {devAuthError && (
            <div className="w-full max-w-[420px] text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
              Dev-автовход не сработал: {devAuthError}
            </div>
          )}
          <AuthPanel />
        </div>
      </div>
    );
  }

  return (
    <>
      {devBanner}
      {children}
    </>
  );
}
